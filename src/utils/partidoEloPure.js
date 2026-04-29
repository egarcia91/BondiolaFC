/** Lógica pura (sin Firebase) para normalizar partidos y calcular Elo. Mantener alineado con el uso en `firestore.js`. */

function normalizeName(s) {
  if (s == null || s === '') return ''
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
}

/** Valor guardado para "Anotador general" en golesAnotadores. */
export const ANOTADOR_GENERAL_ID = '__general__'

/**
 * @param {string} nombre
 * @param {Array} jugadores
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
 * @param {Object} partido
 * @param {Array} jugadores
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

function buildEloHistorial(j, newElo) {
  const actual = j.elo ?? 900
  const prev = Array.isArray(j.eloHistorial) && j.eloHistorial.length > 0 ? j.eloHistorial : [actual]
  return [...prev, Math.round(newElo)]
}

/**
 * @param {Object} partido
 * @param {string} ganador
 * @param {Array} jugadores
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

  const DELTA_ELO_EMPATE_PROMEDIO = 20
  if (diff === 0) {
    const deltaRojo = ganadorEsLocal ? DELTA_ELO_EMPATE_PROMEDIO : -DELTA_ELO_EMPATE_PROMEDIO
    const deltaAzul = ganadorEsLocal ? -DELTA_ELO_EMPATE_PROMEDIO : DELTA_ELO_EMPATE_PROMEDIO
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
