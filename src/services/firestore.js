import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, limit } from 'firebase/firestore'
import { db } from '../firebase'

const JUGADORES = 'jugadores'
const PARTIDOS = 'partidos'

/** Normaliza nombre para comparar (minúsculas, sin acentos). */
function normalizeName(s) {
  if (s == null || s === '') return ''
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento (YYYY-MM-DD).
 */
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento || typeof fechaNacimiento !== 'string') return null
  const hoy = new Date()
  const nacimiento = new Date(fechaNacimiento)
  if (Number.isNaN(nacimiento.getTime())) return null
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const m = hoy.getMonth() - nacimiento.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad >= 0 ? edad : null
}

/**
 * Obtiene todos los jugadores desde Firestore.
 * El campo "años" se calcula a partir de fechaNacimiento cuando existe.
 * @returns {Promise<Array>} Lista de jugadores con id del documento
 */
export async function getJugadores() {
  if (!db) return []
  const snap = await getDocs(collection(db, JUGADORES))
  return snap.docs.map((d) => {
    const data = d.data()
    const añosCalculados = calcularEdad(data.fechaNacimiento)
    const { años: _omit, ...rest } = data
    return {
      id: d.id,
      ...rest,
      admin: data.admin === true,
      años: añosCalculados ?? 0,
    }
  })
}

/**
 * Obtiene el jugador cuyo mail coincide con el email dado (usuario registrado).
 * @param {string} email
 * @returns {Promise<{ id: string, equipoFavorito?: string } | null>}
 */
export async function getJugadorByEmail(email) {
  if (!db || !email) return null
  const q = query(
    collection(db, JUGADORES),
    where('mail', '==', email),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

/** Valor guardado para "Anotador general" en golesAnotadores. */
export const ANOTADOR_GENERAL_ID = '__general__'

/**
 * Convierte un nombre (apodo, nombre completo o primer nombre) a entrada de jugador { id?, nombre? }.
 * @param {string} nombre - Nombre tal como aparece en el partido
 * @param {Array} jugadores - Lista de jugadores con id, apodo, nombre
 * @returns {{ id?: string, nombre?: string }}
 */
export function resolveNombreToEntrada(nombre, jugadores) {
  const n = (nombre || '').trim()
  if (!n) return {}
  const key = normalizeName(n)
  for (const j of jugadores) {
    const kApodo = normalizeName(j.apodo)
    const kNombre = normalizeName(j.nombre)
    const kPrimer = normalizeName((j.nombre || '').split(/\s/)[0])
    if (key === kApodo || key === kNombre || key === kPrimer) return { id: j.id }
  }
  return { nombre: n }
}

/**
 * Normaliza un partido para que jugadores y golesAnotadores usen IDs.
 * Acepta formato legacy (array de strings) y lo convierte a { id?, nombre? } o id/__general__.
 * @param {Object} partido - Partido tal como viene de Firestore
 * @param {Array} jugadores - Lista de jugadores con id, apodo, nombre
 * @returns {Object} Partido con equipoLocal.jugadores, equipoVisitante.jugadores y golesAnotadores normalizados
 */
export function normalizePartido(partido, jugadores) {
  if (!partido || !jugadores || jugadores.length === 0) return partido
  const normalizeJugadoresList = (arr) => {
    if (!Array.isArray(arr)) return []
    return arr.map((item) => {
      if (item == null) return {}
      if (typeof item === 'string') {
        const resolved = resolveNombreToEntrada(item, jugadores)
        return resolved.id ? { id: resolved.id } : { nombre: item }
      }
      if (typeof item === 'object' && (item.id || item.nombre)) return { id: item.id, nombre: item.nombre }
      return {}
    })
  }
  const normalizeGolesAnotadores = (arr) => {
    if (!Array.isArray(arr)) return []
    const idOrGeneral = (v) => {
      if (v == null || v === '' || v === 'Anotador general') return ANOTADOR_GENERAL_ID
      if (typeof v === 'string' && v.startsWith('guest:')) return v
      if (typeof v === 'string' && v.length > 0 && v !== ANOTADOR_GENERAL_ID) return v
      const resolved = resolveNombreToEntrada(String(v), jugadores)
      return resolved.id || (resolved.nombre ? `guest:${resolved.nombre}` : ANOTADOR_GENERAL_ID)
    }
    return arr.map(idOrGeneral)
  }
  const equipoLocal = partido.equipoLocal
    ? {
        ...partido.equipoLocal,
        jugadores: normalizeJugadoresList(partido.equipoLocal.jugadores ?? []),
        golesAnotadores: normalizeGolesAnotadores(partido.equipoLocal.golesAnotadores ?? []),
      }
    : partido.equipoLocal
  const equipoVisitante = partido.equipoVisitante
    ? {
        ...partido.equipoVisitante,
        jugadores: normalizeJugadoresList(partido.equipoVisitante.jugadores ?? []),
        golesAnotadores: normalizeGolesAnotadores(partido.equipoVisitante.golesAnotadores ?? []),
      }
    : partido.equipoVisitante
  return { ...partido, equipoLocal, equipoVisitante }
}

/**
 * Normaliza una lista de partidos (jugadores y golesAnotadores por ID).
 */
export function normalizePartidos(partidos, jugadores) {
  if (!partidos || !jugadores) return partidos || []
  return partidos.map((p) => normalizePartido(p, jugadores))
}

/**
 * Obtiene todos los partidos desde Firestore, ordenados por fecha (más recientes primero).
 * @returns {Promise<Array>} Lista de partidos con id del documento (formato crudo; usar normalizePartidos con jugadores para IDs)
 */
export async function getPartidos() {
  if (!db) return []
  const snap = await getDocs(collection(db, PARTIDOS))
  const partidos = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
  return partidos.sort((a, b) => {
    const dateA = new Date((a.fecha || '') + ' ' + (a.hora || ''))
    const dateB = new Date((b.fecha || '') + ' ' + (b.hora || ''))
    return dateB - dateA
  })
}

/**
 * Escribe un jugador en Firestore (sin el campo id).
 * @param {Object} jugador - Datos del jugador
 * @returns {Promise<string>} ID del documento creado
 */
export async function addJugador(jugador) {
  if (!db) throw new Error('Firestore no está configurado')
  const { id, años: _omit, ...data } = jugador
  const ref = await addDoc(collection(db, JUGADORES), {
    ...data,
    admin: data.admin === true,
  })
  return ref.id
}

/**
 * Escribe un partido en Firestore (sin el campo id).
 * @param {Object} partido - Datos del partido
 * @returns {Promise<string>} ID del documento creado
 */
export async function addPartido(partido) {
  if (!db) throw new Error('Firestore no está configurado')
  const { id, ...data } = partido
  const ref = await addDoc(collection(db, PARTIDOS), data)
  return ref.id
}

/**
 * Quita undefined de la estructura (Firestore no las acepta). Omite claves undefined y en arrays reemplaza undefined por null.
 * @param {*} obj
 * @returns {*}
 */
function removeUndefined(obj) {
  if (obj === undefined) return null
  if (obj === null) return null
  if (Array.isArray(obj)) {
    return obj.map((v) => {
      const c = removeUndefined(v)
      return c === undefined ? null : c
    })
  }
  if (typeof obj === 'object' && obj.constructor === Object) {
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue
      const cleaned = removeUndefined(v)
      if (cleaned !== undefined) out[k] = cleaned
    }
    return out
  }
  return obj
}

/**
 * Actualiza campos de un partido (ej. concluido, goles, ganador).
 * @param {string} partidoId - ID del documento del partido
 * @param {Object} data - Campos a actualizar (concluido, equipoLocal, equipoVisitante, ganador, etc.)
 */
export async function updatePartido(partidoId, data) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, PARTIDOS, partidoId)
  const cleaned = removeUndefined(data)
  if (cleaned && Object.keys(cleaned).length > 0) {
    await updateDoc(ref, cleaned)
  }
}

/**
 * Elimina un partido de Firestore.
 * @param {string} partidoId - ID del documento del partido
 */
export async function deletePartido(partidoId) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, PARTIDOS, partidoId)
  await deleteDoc(ref)
}

/**
 * Revierte las estadísticas de los jugadores que participaron en un partido
 * (restar 1 partido, victoria/empate/derrota según corresponda, goles del partido y Elo).
 * Solo tiene efecto si el partido tiene estadisticasAplicadas === true.
 * @param {Object} partido - Partido con equipoLocal, equipoVisitante, ganador, eloDeltas, golesAnotadores
 * @param {Array} jugadores - Lista actual de jugadores (con partidos, victorias, goles, elo, eloHistorial)
 */
export async function revertirEstadisticasPartido(partido, jugadores) {
  if (!partido || partido.estadisticasAplicadas !== true) return
  const jugadoresById = new Map(jugadores.map((j) => [j.id, j]))
  const nombreLocal = partido.equipoLocal?.nombre || 'Rojo'
  const nombreVisitante = partido.equipoVisitante?.nombre || 'Azul'
  const ganador = partido.ganador
  const empate = ganador === 'Empate'
  const ganadorEsLocal = !empate && ganador === nombreLocal

  const countGolesPorId = (arr) => {
    const m = new Map()
    ;(arr || []).forEach((v) => {
      if (v && v !== ANOTADOR_GENERAL_ID && !String(v).startsWith('guest:')) {
        m.set(v, (m.get(v) || 0) + 1)
      }
    })
    return m
  }
  const golesLocal = countGolesPorId(partido.equipoLocal?.golesAnotadores)
  const golesVisitante = countGolesPorId(partido.equipoVisitante?.golesAnotadores)

  const listaLocal = partido.equipoLocal?.jugadores ?? []
  const listaVisitante = partido.equipoVisitante?.jugadores ?? []
  const deltasLocal = partido.equipoLocal?.eloDeltas ?? []
  const deltasVisitante = partido.equipoVisitante?.eloDeltas ?? []

  const updates = []
  listaLocal.forEach((entrada, idx) => {
    if (!entrada?.id) return
    const j = jugadoresById.get(entrada.id)
    if (!j) return
    const delta = deltasLocal[idx]
    const golesEnPartido = golesLocal.get(entrada.id) || 0
    const partidos = Math.max(0, (j.partidos ?? 0) - 1)
    const victorias = Math.max(0, (j.victorias ?? 0) - (empate ? 0 : ganadorEsLocal ? 1 : 0))
    const partidosEmpatados = Math.max(0, (j.partidosEmpatados ?? 0) - (empate ? 1 : 0))
    const partidosPerdidos = Math.max(0, (j.partidosPerdidos ?? 0) - (empate ? 0 : ganadorEsLocal ? 0 : 1))
    const goles = Math.max(0, (j.goles ?? 0) - golesEnPartido)
    const hasDelta = typeof delta === 'number'
    const eloAnterior = hasDelta ? (j.elo ?? 900) - delta : (j.elo ?? 900)
    const eloHistorial =
      hasDelta && Array.isArray(j.eloHistorial) && j.eloHistorial.length > 0
        ? j.eloHistorial.slice(0, -1)
        : (j.eloHistorial ?? [])
    updates.push({
      id: entrada.id,
      partidos,
      victorias,
      partidosEmpatados,
      partidosPerdidos,
      goles,
      elo: Math.max(0, Math.round(eloAnterior)),
      eloHistorial,
    })
  })
  listaVisitante.forEach((entrada, idx) => {
    if (!entrada?.id) return
    const j = jugadoresById.get(entrada.id)
    if (!j) return
    const delta = deltasVisitante[idx]
    const golesEnPartido = golesVisitante.get(entrada.id) || 0
    const partidos = Math.max(0, (j.partidos ?? 0) - 1)
    const victorias = Math.max(0, (j.victorias ?? 0) - (empate ? 0 : !ganadorEsLocal ? 1 : 0))
    const partidosEmpatados = Math.max(0, (j.partidosEmpatados ?? 0) - (empate ? 1 : 0))
    const partidosPerdidos = Math.max(0, (j.partidosPerdidos ?? 0) - (empate ? 0 : !ganadorEsLocal ? 0 : 1))
    const goles = Math.max(0, (j.goles ?? 0) - golesEnPartido)
    const hasDelta = typeof delta === 'number'
    const eloAnterior = hasDelta ? (j.elo ?? 900) - delta : (j.elo ?? 900)
    const eloHistorial =
      hasDelta && Array.isArray(j.eloHistorial) && j.eloHistorial.length > 0
        ? j.eloHistorial.slice(0, -1)
        : (j.eloHistorial ?? [])
    updates.push({
      id: entrada.id,
      partidos,
      victorias,
      partidosEmpatados,
      partidosPerdidos,
      goles,
      elo: Math.max(0, Math.round(eloAnterior)),
      eloHistorial,
    })
  })

  await Promise.all(
    updates.map((u) =>
      updateJugadorDespuesPartido(u.id, {
        elo: u.elo,
        eloHistorial: u.eloHistorial,
        partidos: u.partidos,
        victorias: u.victorias,
        partidosEmpatados: u.partidosEmpatados,
        partidosPerdidos: u.partidosPerdidos,
        goles: u.goles,
      })
    )
  )
}

/**
 * Da de baja un partido: revierte estadísticas de jugadores (si estaban aplicadas) y elimina el partido.
 * @param {Object} partido - Partido normalizado (con jugadores por id, eloDeltas, golesAnotadores)
 * @param {Array} jugadores - Lista actual de jugadores
 */
export async function darDeBajaPartido(partido, jugadores) {
  if (!partido?.id) throw new Error('Partido inválido')
  if (partido.estadisticasAplicadas === true) {
    await revertirEstadisticasPartido(partido, jugadores)
  }
  await deletePartido(partido.id)
}

/**
 * Aplica el resultado de un partido: actualiza goles, calcula Elo y estadísticas de jugadores, guarda partido como concluido.
 * @param {Object} partidoActualizado - Partido con id, equipoLocal { nombre, jugadores, goles, golesAnotadores }, equipoVisitante igual
 * @param {Array} jugadores - Lista actual de jugadores
 */
export async function aplicarResultadoPartido(partidoActualizado, jugadores) {
  if (!partidoActualizado?.id) throw new Error('Partido inválido')
  const partido = partidoActualizado
  const golesLocal = partido.equipoLocal?.goles ?? 0
  const golesVisitante = partido.equipoVisitante?.goles ?? 0
  const nombreLocal = partido.equipoLocal?.nombre || 'Rojo'
  const nombreVisitante = partido.equipoVisitante?.nombre || 'Azul'
  const ganador =
    golesLocal > golesVisitante ? nombreLocal : golesVisitante > golesLocal ? nombreVisitante : 'Empate'

  const equipoLocal = {
    ...partido.equipoLocal,
    nombre: nombreLocal,
    jugadores: partido.equipoLocal?.jugadores ?? [],
    goles: golesLocal,
    golesAnotadores: partido.equipoLocal?.golesAnotadores ?? [],
  }
  const equipoVisitante = {
    ...partido.equipoVisitante,
    nombre: nombreVisitante,
    jugadores: partido.equipoVisitante?.jugadores ?? [],
    goles: golesVisitante,
    golesAnotadores: partido.equipoVisitante?.golesAnotadores ?? [],
  }

  const aplicarEstadisticas = partido.estadisticasAplicadas !== true
  if (aplicarEstadisticas) {
    const { updates: eloUpdates, eloDeltasLocal, eloDeltasVisitante } = computeEloUpdatesForPartido(
      { ...partido, equipoLocal, equipoVisitante, ganador },
      ganador,
      jugadores
    )
    equipoLocal.eloDeltas = eloDeltasLocal
    equipoVisitante.eloDeltas = eloDeltasVisitante

    const countGolesPorId = (arr) => {
      const m = new Map()
      ;(arr || []).forEach((v) => {
        if (v && v !== ANOTADOR_GENERAL_ID && !String(v).startsWith('guest:')) {
          m.set(v, (m.get(v) || 0) + 1)
        }
      })
      return m
    }
    const golesRojoMap = countGolesPorId(equipoLocal.golesAnotadores)
    const golesAzulMap = countGolesPorId(equipoVisitante.golesAnotadores)
    const jugadoresByIdMap = new Map(jugadores.map((j) => [j.id, j]))
    const idsLocal = new Set((equipoLocal.jugadores ?? []).map((e) => e?.id).filter(Boolean))
    const idsVisitante = new Set((equipoVisitante.jugadores ?? []).map((e) => e?.id).filter(Boolean))
    const golesParaJugador = (j, golesMap) => (j && golesMap.get(j.id)) || 0

    await Promise.all(
      eloUpdates.map((u) => {
        const j = jugadoresByIdMap.get(u.id)
        const enRojo = j && idsLocal.has(j.id)
        const golesEnPartido = enRojo ? golesParaJugador(j, golesRojoMap) : golesParaJugador(j, golesAzulMap)
        const newGoles = (j?.goles ?? 0) + golesEnPartido
        return updateJugadorDespuesPartido(u.id, {
          elo: u.newElo,
          eloHistorial: u.eloHistorial,
          partidos: u.partidos,
          victorias: u.victorias,
          partidosEmpatados: u.partidosEmpatados,
          partidosPerdidos: u.partidosPerdidos,
          goles: newGoles,
        })
      })
    )
  }

  await updatePartido(partido.id, {
    concluido: true,
    equipoLocal,
    equipoVisitante,
    ganador,
    ...(aplicarEstadisticas ? { estadisticasAplicadas: true } : {}),
  })
}

/**
 * Actualiza el registro de un jugador (mail y registrado).
 * @param {string} jugadorId - ID del documento del jugador
 * @param {{ mail: string, registrado: boolean }} data
 */
export async function updateJugadorRegistro(jugadorId, { mail, registrado }) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, JUGADORES, jugadorId)
  await updateDoc(ref, { mail: mail || '', registrado: !!registrado })
}

/**
 * Actualiza el campo admin de un jugador.
 * @param {string} jugadorId - ID del documento
 * @param {boolean} admin
 */
export async function updateJugadorAdmin(jugadorId, admin) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, JUGADORES, jugadorId)
  await updateDoc(ref, { admin: !!admin })
}

/**
 * Actualiza el Elo de un jugador (solo el campo elo).
 * @param {string} jugadorId - ID del documento
 * @param {number} nuevoElo - Nuevo valor de Elo (entero >= 0)
 */
export async function updateJugadorElo(jugadorId, nuevoElo) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, JUGADORES, jugadorId)
  const elo = Math.max(0, Math.round(Number(nuevoElo) || 0))
  await updateDoc(ref, { elo })
}

/**
 * Actualiza jugador tras un partido: elo, historial de Elo, partidos, victorias, empatados, perdidos, goles.
 * @param {string} jugadorId - ID del documento
 * @param {{ elo: number, eloHistorial: number[], partidos: number, victorias: number, partidosEmpatados: number, partidosPerdidos: number, goles?: number }} data
 */
export async function updateJugadorDespuesPartido(jugadorId, data) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, JUGADORES, jugadorId)
  const elo = Math.max(0, Math.round(Number(data.elo) || 0))
  const eloHistorial = Array.isArray(data.eloHistorial) ? data.eloHistorial : []
  const partidos = Math.max(0, Math.round(Number(data.partidos) || 0))
  const victorias = Math.max(0, Math.round(Number(data.victorias) || 0))
  const partidosEmpatados = Math.max(0, Math.round(Number(data.partidosEmpatados) || 0))
  const partidosPerdidos = Math.max(0, Math.round(Number(data.partidosPerdidos) || 0))
  const goles = Math.max(0, Math.round(Number(data.goles) || 0))
  await updateDoc(ref, {
    elo,
    eloHistorial,
    partidos,
    victorias,
    partidosEmpatados,
    partidosPerdidos,
    goles,
  })
}

function buildEloHistorial(j, newElo) {
  const actual = j.elo ?? 900
  const prev = Array.isArray(j.eloHistorial) && j.eloHistorial.length > 0 ? j.eloHistorial : [actual]
  return [...prev, Math.round(newElo)]
}

/**
 * Calcula los nuevos Elo y estadísticas de cada jugador tras un partido (empate o victoria).
 * partido.equipoLocal/Visitante.jugadores deben ser arrays de { id?, nombre? } (por ID).
 * @param {Object} partido - Partido con equipoLocal.jugadores, equipoVisitante.jugadores (entradas con id)
 * @param {string} ganador - 'Empate' | nombre del equipo ganador (ej. 'Rojo', 'Azul')
 * @param {Array} jugadores - Lista de jugadores con id, apodo, elo, partidos, victorias, eloHistorial
 * @returns {{ updates: Array<{ id, newElo, partidos, victorias, partidosEmpatados, partidosPerdidos, eloHistorial }>, eloDeltasLocal: number[], eloDeltasVisitante: number[] }}
 */
export function computeEloUpdatesForPartido(partido, ganador, jugadores) {
  const jugadoresById = new Map(jugadores.map((j) => [j.id, j]))
  const getJugadorFromEntrada = (entrada) => (entrada && entrada.id ? jugadoresById.get(entrada.id) : null)
  const getEloFromEntrada = (entrada) => {
    const j = getJugadorFromEntrada(entrada)
    return j != null && typeof j.elo === 'number' ? j.elo : 900
  }

  const listaRojo = partido.equipoLocal?.jugadores ?? []
  const listaAzul = partido.equipoVisitante?.jugadores ?? []

  const elosRojo = listaRojo.map(getEloFromEntrada).filter((e) => Number.isFinite(e))
  const elosAzul = listaAzul.map(getEloFromEntrada).filter((e) => Number.isFinite(e))
  const avgRojo = elosRojo.length ? Math.round(elosRojo.reduce((a, b) => a + b, 0) / elosRojo.length) : 0
  const avgAzul = elosAzul.length ? Math.round(elosAzul.reduce((a, b) => a + b, 0) / elosAzul.length) : 0

  const diff = Math.abs(avgRojo - avgAzul)
  const updates = []
  const eloDeltasLocal = []
  const eloDeltasVisitante = []

  const nombreLocal = partido.equipoLocal?.nombre || 'Rojo'
  const nombreVisitante = partido.equipoVisitante?.nombre || 'Azul'
  const ganadorEsLocal = ganador === nombreLocal
  const empate = ganador === 'Empate'

  if (ganador === 'Empate') {
    if (diff === 0) {
      listaRojo.forEach((entrada) => {
        const j = getJugadorFromEntrada(entrada)
        eloDeltasLocal.push(0)
        if (!j) return
        const eloActual = j.elo ?? 900
        updates.push({
          id: j.id,
          newElo: eloActual,
          partidos: (j.partidos ?? 0) + 1,
          victorias: j.victorias ?? 0,
          partidosEmpatados: (j.partidosEmpatados ?? 0) + 1,
          partidosPerdidos: j.partidosPerdidos ?? 0,
          eloHistorial: buildEloHistorial(j, eloActual),
        })
      })
      listaAzul.forEach((entrada) => {
        const j = getJugadorFromEntrada(entrada)
        eloDeltasVisitante.push(0)
        if (!j) return
        const eloActual = j.elo ?? 900
        updates.push({
          id: j.id,
          newElo: eloActual,
          partidos: (j.partidos ?? 0) + 1,
          victorias: j.victorias ?? 0,
          partidosEmpatados: (j.partidosEmpatados ?? 0) + 1,
          partidosPerdidos: j.partidosPerdidos ?? 0,
          eloHistorial: buildEloHistorial(j, eloActual),
        })
      })
      return { updates, eloDeltasLocal, eloDeltasVisitante }
    }
    const half = diff / 2
    const deltaRojo = Math.round(avgRojo <= avgAzul ? half : -half)
    const deltaAzul = Math.round(avgAzul <= avgRojo ? half : -half)
    listaRojo.forEach((entrada) => {
      const j = getJugadorFromEntrada(entrada)
      eloDeltasLocal.push(j ? deltaRojo : 0)
      if (!j) return
      const newElo = Math.max(0, (j.elo ?? 900) + deltaRojo)
      const newEloR = Math.round(newElo)
      updates.push({
        id: j.id,
        newElo: newEloR,
        partidos: (j.partidos ?? 0) + 1,
        victorias: j.victorias ?? 0,
        partidosEmpatados: (j.partidosEmpatados ?? 0) + 1,
        partidosPerdidos: j.partidosPerdidos ?? 0,
        eloHistorial: buildEloHistorial(j, newElo),
      })
    })
    listaAzul.forEach((entrada) => {
      const j = getJugadorFromEntrada(entrada)
      eloDeltasVisitante.push(j ? deltaAzul : 0)
      if (!j) return
      const newElo = Math.max(0, (j.elo ?? 900) + deltaAzul)
      const newEloR = Math.round(newElo)
      updates.push({
        id: j.id,
        newElo: newEloR,
        partidos: (j.partidos ?? 0) + 1,
        victorias: j.victorias ?? 0,
        partidosEmpatados: (j.partidosEmpatados ?? 0) + 1,
        partidosPerdidos: j.partidosPerdidos ?? 0,
        eloHistorial: buildEloHistorial(j, newElo),
      })
    })
    return { updates, eloDeltasLocal, eloDeltasVisitante }
  }

  const factor = ganadorEsLocal ? (avgRojo >= avgAzul ? 0.25 : 0.75) : (avgAzul >= avgRojo ? 0.25 : 0.75)
  const deltaGanador = diff * factor
  const deltaPerdedor = -diff * factor
  const deltaRojo = Math.round(ganadorEsLocal ? deltaGanador : deltaPerdedor)
  const deltaAzul = Math.round(ganadorEsLocal ? deltaPerdedor : deltaGanador)

  listaRojo.forEach((entrada) => {
    const j = getJugadorFromEntrada(entrada)
    eloDeltasLocal.push(j ? deltaRojo : 0)
    if (!j) return
    const newElo = Math.max(0, (j.elo ?? 900) + deltaRojo)
    const newEloR = Math.round(newElo)
    const win = ganadorEsLocal
    updates.push({
      id: j.id,
      newElo: newEloR,
      partidos: (j.partidos ?? 0) + 1,
      victorias: (j.victorias ?? 0) + (win ? 1 : 0),
      partidosEmpatados: j.partidosEmpatados ?? 0,
      partidosPerdidos: (j.partidosPerdidos ?? 0) + (win ? 0 : 1),
      eloHistorial: buildEloHistorial(j, newElo),
    })
  })
  listaAzul.forEach((entrada) => {
    const j = getJugadorFromEntrada(entrada)
    eloDeltasVisitante.push(j ? deltaAzul : 0)
    if (!j) return
    const newElo = Math.max(0, (j.elo ?? 900) + deltaAzul)
    const newEloR = Math.round(newElo)
    const win = !ganadorEsLocal
    updates.push({
      id: j.id,
      newElo: newEloR,
      partidos: (j.partidos ?? 0) + 1,
      victorias: (j.victorias ?? 0) + (win ? 1 : 0),
      partidosEmpatados: j.partidosEmpatados ?? 0,
      partidosPerdidos: (j.partidosPerdidos ?? 0) + (win ? 0 : 1),
      eloHistorial: buildEloHistorial(j, newElo),
    })
  })
  return { updates, eloDeltasLocal, eloDeltasVisitante }
}

/**
 * Actualiza el perfil editable de un jugador (apodo, descripcion, posicion, fechaNacimiento, equipoFavorito).
 * @param {string} jugadorId - ID del documento
 * @param {Object} data - Campos a actualizar
 */
export async function updateJugadorPerfil(jugadorId, data) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, JUGADORES, jugadorId)
  const allowed = ['apodo', 'descripcion', 'posicion', 'fechaNacimiento', 'equipoFavorito']
  const toUpdate = {}
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      if (key === 'fechaNacimiento') toUpdate[key] = data[key] || ''
      else if (key === 'equipoFavorito') toUpdate[key] = data[key] === 'azul' ? 'azul' : 'rojo'
      else toUpdate[key] = data[key] ?? ''
    }
  })
  if (Object.keys(toUpdate).length) await updateDoc(ref, toUpdate)
}
