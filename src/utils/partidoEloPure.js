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
 * Constantes del sistema de Elo "agresivo e individual".
 *
 * - La base por ganar/perder es 20 puntos; empatar usa una base de 10.
 * - El cambio real de cada jugador se ajusta según la distancia (en %) entre su
 *   Elo y el Elo promedio del equipo RIVAL:
 *     · Ganar siendo mejor que el rival suma menos (mínimo 1).
 *     · Ganar siendo peor que el rival suma más (máximo {@link ELO_MAX_CAMBIO}).
 *     · Perder siendo mejor que el rival resta más (máximo {@link ELO_MAX_CAMBIO}).
 *     · Perder siendo peor que el rival resta menos (mínimo 1).
 */
export const ELO_BASE_GANAR = 20
export const ELO_BASE_EMPATE = 10
export const ELO_MIN_CAMBIO = 1
export const ELO_MAX_CAMBIO = 30

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

/**
 * Calcula el cambio de Elo (sin redondear) de UN jugador según su Elo y el Elo
 * promedio del equipo rival.
 *
 * @param {number} eloJugador - Elo actual del jugador.
 * @param {number} avgRival - Elo promedio del equipo rival.
 * @param {'win'|'loss'|'tie'} resultado - Resultado para este jugador.
 * @returns {number} Delta de Elo ya acotado (puede ser fraccionario).
 */
export function calcularDeltaElo(eloJugador, avgRival, resultado) {
  // ratio > 0: el jugador es MEJOR que el promedio rival (ej. 0.10 = 10% mejor).
  // ratio < 0: el jugador es PEOR que el promedio rival.
  const ratio = avgRival > 0 ? (eloJugador - avgRival) / avgRival : 0

  if (resultado === 'win') {
    // Base 20. Si es 10% mejor → 18; si es 10% peor → 22. Acotado a [1, 30].
    return clamp(ELO_BASE_GANAR * (1 - ratio), ELO_MIN_CAMBIO, ELO_MAX_CAMBIO)
  }
  if (resultado === 'loss') {
    // Base -20. Si era 10% mejor → -22 (penaliza más); si era 10% peor → -18.
    // Acotado a [-30, -1].
    return clamp(-ELO_BASE_GANAR * (1 + ratio), -ELO_MAX_CAMBIO, -ELO_MIN_CAMBIO)
  }
  // Empate: base 10 escalada por la distancia. Si los Elos son iguales el cambio
  // es 0; el favorito (mejor que el rival) pierde un poco y el de menor Elo gana.
  return clamp(-ELO_BASE_EMPATE * ratio, -ELO_MAX_CAMBIO, ELO_MAX_CAMBIO)
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

  const updates = []
  const eloDeltasLocal = []
  const eloDeltasVisitante = []

  const nombreLocal = partido.equipoLocal?.nombre || 'Rojo'
  const ganadorEsLocal = ganador === nombreLocal
  const esEmpate = ganador === 'Empate'

  /**
   * Procesa una lista de jugadores de un equipo.
   * @param {Array} lista
   * @param {number} avgRival - Elo promedio del equipo contrario.
   * @param {boolean} ganoEsteEquipo
   * @param {Array<number>} deltasOut - Array donde apilar el delta por índice.
   */
  const procesarEquipo = (lista, avgRival, ganoEsteEquipo, deltasOut) => {
    const resultado = esEmpate ? 'tie' : ganoEsteEquipo ? 'win' : 'loss'
    lista.forEach((entrada) => {
      const j = getJugadorFromEntrada(entrada)
      if (!j) {
        deltasOut.push(0)
        return
      }
      const eloActual = j.elo ?? 900
      const deltaExacto = calcularDeltaElo(eloActual, avgRival, resultado)
      const delta = Math.round(deltaExacto)
      deltasOut.push(delta)
      const newElo = Math.round(Math.max(0, eloActual + delta))
      const gano = resultado === 'win'
      const empato = resultado === 'tie'
      updates.push({
        id: j.id,
        newElo,
        partidos: (j.partidos ?? 0) + 1,
        victorias: (j.victorias ?? 0) + (gano ? 1 : 0),
        partidosEmpatados: (j.partidosEmpatados ?? 0) + (empato ? 1 : 0),
        partidosPerdidos: (j.partidosPerdidos ?? 0) + (!gano && !empato ? 1 : 0),
        eloHistorial: buildEloHistorial(j, newElo),
      })
    })
  }

  procesarEquipo(listaRojo, avgAzul, !esEmpate && ganadorEsLocal, eloDeltasLocal)
  procesarEquipo(listaAzul, avgRojo, !esEmpate && !ganadorEsLocal, eloDeltasVisitante)

  return { updates, eloDeltasLocal, eloDeltasVisitante }
}
