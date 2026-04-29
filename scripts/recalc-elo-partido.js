/**
 * Recalcula Elo de un partido (misma lógica que `computeEloUpdatesForPartido` en la app).
 *
 * Uso:
 *   node scripts/recalc-elo-partido.js --fecha=2026-04-25 --org="Sabados"
 *   node scripts/recalc-elo-partido.js --fecha=2026-04-25 --org-id=ORG_ID
 *   node scripts/recalc-elo-partido.js ... --apply [./cuenta-servicio.json]
 *
 * Por defecto solo imprime el resultado. Con `--apply` actualiza Firestore (jugadores + partido)
 * solo si `estadisticasAplicadas !== true` en ese partido (evita doble conteo de partidos/Elo).
 *
 * Requisitos: .env con VITE_FIREBASE_PROJECT_ID (o FIREBASE_PROJECT_ID) y cuenta de servicio
 * (GOOGLE_APPLICATION_CREDENTIALS o JSON como último argumento). Igual que migrar-firebase-organizaciones.
 */

import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  normalizePartido,
  computeEloUpdatesForPartido,
  ANOTADOR_GENERAL_ID,
} from '../src/utils/partidoEloPure.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const JUGADORES = 'jugadores'
const PARTIDOS = 'partidos'
const ORGANIZACIONES = 'organizaciones'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID

function parseArgs(argv) {
  const out = { flags: {}, positional: [] }
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, ...rest] = a.slice(2).split('=')
      const v = rest.length ? rest.join('=') : true
      out.flags[k] = v
    } else {
      out.positional.push(a)
    }
  }
  return out
}

function getCredential(SA_PATH) {
  let path = SA_PATH || null
  if (!path && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const p = process.env.GOOGLE_APPLICATION_CREDENTIALS
    path = p.startsWith('/') || (p.length >= 2 && p[1] === ':') ? p : resolve(process.cwd(), p)
  }
  if (path && existsSync(path)) {
    const sa = JSON.parse(readFileSync(path, 'utf8'))
    return cert(sa)
  }
  return undefined
}

function mapJugadorDoc(d) {
  const data = d.data()
  const elo = typeof data.elo === 'number' && Number.isFinite(data.elo) ? data.elo : 900
  return {
    id: d.id,
    ...data,
    elo,
    mvp: typeof data.mvp === 'number' && Number.isFinite(data.mvp) ? data.mvp : 0,
  }
}

function countGolesPorId(arr) {
  const m = new Map()
  ;(arr || []).forEach((v) => {
    if (v && v !== ANOTADOR_GENERAL_ID && !String(v).startsWith('guest:')) {
      m.set(v, (m.get(v) || 0) + 1)
    }
  })
  return m
}

async function findOrganizacionId(db, orgNeedle, orgIdDirect) {
  if (orgIdDirect) return orgIdDirect
  if (!orgNeedle) throw new Error('Pasá --org="texto" o --org-id=ID')
  const snap = await db.collection(ORGANIZACIONES).get()
  const needle = orgNeedle.trim().toLowerCase()
  const matches = snap.docs.filter((d) => (d.data().nombre || '').toLowerCase().includes(needle))
  if (matches.length === 0) throw new Error(`No hay organización cuyo nombre incluya "${orgNeedle}"`)
  if (matches.length > 1) {
    console.error('Varias organizaciones coinciden; usá --org-id con uno de estos ids:')
    matches.forEach((d) => console.error(`  ${d.id}  ${d.data().nombre || ''}`))
    throw new Error('Ambigüedad: acotá --org o usá --org-id')
  }
  return matches[0].id
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2))
  const fecha = flags.fecha
  const orgNeedle = flags.org
  const orgIdDirect = flags['org-id']
  const apply = flags.apply === true || flags.apply === ''

  if (!PROJECT_ID) {
    console.error('Falta VITE_FIREBASE_PROJECT_ID o FIREBASE_PROJECT_ID en .env')
    process.exit(1)
  }

  const SA_PATH = positional[positional.length - 1]?.endsWith('.json') ? positional.pop() : undefined
  const credential = getCredential(SA_PATH)
  if (!credential) {
    console.error('Faltan credenciales de cuenta de servicio (JSON o GOOGLE_APPLICATION_CREDENTIALS).')
    process.exit(1)
  }

  if (!fecha) {
    console.error('Uso: node scripts/recalc-elo-partido.js --fecha=YYYY-MM-DD --org="..." [--apply] [sa.json]')
    process.exit(1)
  }

  if (!getApps().length) {
    initializeApp({ credential, projectId: PROJECT_ID })
  }
  const db = getFirestore()

  const organizacionId = await findOrganizacionId(db, orgNeedle, orgIdDirect)
  const orgDoc = await db.collection(ORGANIZACIONES).doc(organizacionId).get()
  console.log('Organización:', orgDoc.data()?.nombre || organizacionId, `(${organizacionId})`)

  const partSnap = await db
    .collection(PARTIDOS)
    .where('organizacionId', '==', organizacionId)
    .where('fecha', '==', fecha)
    .get()

  if (partSnap.empty) {
    console.error(`No hay partidos con fecha=${fecha} en esa organización.`)
    process.exit(1)
  }

  const candidatos = partSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  candidatos.sort((a, b) => String(b.hora || '').localeCompare(String(a.hora || ''), 'es'))
  const partidoRaw = candidatos[0]
  if (candidatos.length > 1) {
    console.log(`Nota: hay ${candidatos.length} partidos ese día; se usa el de hora más tardía: ${partidoRaw.hora || 'sin hora'} (id ${partidoRaw.id})`)
  }

  const jugSnap = await db.collection(JUGADORES).where('organizacionId', '==', organizacionId).get()
  const jugadores = jugSnap.docs.map(mapJugadorDoc)
  if (jugadores.length === 0) {
    console.error('No hay jugadores en esa organización.')
    process.exit(1)
  }

  const partido = normalizePartido({ id: partidoRaw.id, ...partidoRaw }, jugadores)
  const ganador =
    partido.ganador
    || (() => {
      const gl = partido.equipoLocal?.goles ?? 0
      const gv = partido.equipoVisitante?.goles ?? 0
      const nl = partido.equipoLocal?.nombre || 'Rojo'
      const nv = partido.equipoVisitante?.nombre || 'Azul'
      if (gl > gv) return nl
      if (gv > gl) return nv
      return 'Empate'
    })()

  const { updates, eloDeltasLocal, eloDeltasVisitante } = computeEloUpdatesForPartido(partido, ganador, jugadores)

  const nombreLocal = partido.equipoLocal?.nombre || 'Rojo'
  const nombreVisitante = partido.equipoVisitante?.nombre || 'Azul'
  console.log('\n--- Partido ---')
  console.log('id:', partido.id)
  console.log('concluido:', partido.concluido, '| estadisticasAplicadas:', partido.estadisticasAplicadas)
  console.log('ganador (usado):', ganador)
  console.log(`${nombreLocal} ${partido.equipoLocal?.goles ?? 0} - ${partido.equipoVisitante?.goles ?? 0} ${nombreVisitante}`)
  console.log('eloDeltas actuales en doc local:', partido.equipoLocal?.eloDeltas)
  console.log('eloDeltas actuales en doc visitante:', partido.equipoVisitante?.eloDeltas)

  const jugById = new Map(jugadores.map((j) => [j.id, j]))
  const idsLocal = new Set((partido.equipoLocal?.jugadores ?? []).map((e) => e?.id).filter(Boolean))
  const idsVis = new Set((partido.equipoVisitante?.jugadores ?? []).map((e) => e?.id).filter(Boolean))
  const golesRojoMap = countGolesPorId(partido.equipoLocal?.golesAnotadores)
  const golesAzulMap = countGolesPorId(partido.equipoVisitante?.golesAnotadores)
  const golesParaJugador = (j, golesMap) => (j && golesMap.get(j.id)) || 0

  console.log('\n--- Recálculo Elo (por jugador) ---')
  console.log(
    ['Jugador', 'Elo actual', 'Δ', 'Elo nuevo', 'PJ+1', 'Goles partido'].map((h) => h.padEnd(14)).join('')
  )
  for (const u of updates) {
    const j = jugById.get(u.id)
    const label = j ? (j.apodo || j.nombre || u.id) : u.id
    const enRojo = j && idsLocal.has(j.id)
    const gPart = enRojo ? golesParaJugador(j, golesRojoMap) : golesParaJugador(j, golesAzulMap)
    const delta = u.newElo - (j?.elo ?? 900)
    console.log(
      [
        String(label).slice(0, 20).padEnd(20),
        String(j?.elo ?? 900).padEnd(10),
        String(delta >= 0 ? `+${delta}` : delta).padEnd(8),
        String(u.newElo).padEnd(10),
        String(u.partidos).padEnd(8),
        String(gPart),
      ].join(' ')
    )
  }

  console.log('\n--- Deltas por índice (equipo local / visitante) ---')
  console.log(nombreLocal + ':', eloDeltasLocal)
  console.log(nombreVisitante + ':', eloDeltasVisitante)

  if (updates.length === 0) {
    console.warn('\nNo hay updates (¿solo invitados sin id en la nómina?). No se puede aplicar Elo a documentos de jugador.')
  }

  if (!apply) {
    console.log('\n(Dry-run) No se escribió nada. Para aplicar: añadí --apply')
    return
  }

  if (updates.length === 0) {
    console.error('No hay jugadores registrados en la nómina; no se puede --apply.')
    process.exit(1)
  }

  if (partido.estadisticasAplicadas === true) {
    console.error(
      '\nAbort: el partido ya tiene estadisticasAplicadas=true. Aplicar de nuevo duplicaría partidos/Elo.',
    )
    console.error('Si estás seguro de que el doc está mal, revertí a mano o contactá soporte.')
    process.exit(1)
  }

  const equipoLocal = {
    ...partido.equipoLocal,
    eloDeltas: eloDeltasLocal,
  }
  const equipoVisitante = {
    ...partido.equipoVisitante,
    eloDeltas: eloDeltasVisitante,
  }

  const batch = db.batch()
  for (const u of updates) {
    const j = jugById.get(u.id)
    const enRojo = j && idsLocal.has(j.id)
    const golesEnPartido = enRojo ? golesParaJugador(j, golesRojoMap) : golesParaJugador(j, golesAzulMap)
    const newGoles = (j?.goles ?? 0) + golesEnPartido
    const ref = db.collection(JUGADORES).doc(u.id)
    batch.update(ref, {
      elo: u.newElo,
      eloHistorial: u.eloHistorial,
      partidos: u.partidos,
      victorias: u.victorias,
      partidosEmpatados: u.partidosEmpatados,
      partidosPerdidos: u.partidosPerdidos,
      goles: newGoles,
    })
  }
  const partRef = db.collection(PARTIDOS).doc(partido.id)
  batch.update(partRef, {
    concluido: true,
    ganador,
    equipoLocal,
    equipoVisitante,
    estadisticasAplicadas: true,
  })
  await batch.commit()
  console.log('\nListo: estadísticas y Elo aplicados en Firestore.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
