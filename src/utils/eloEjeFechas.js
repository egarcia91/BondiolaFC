/** Ms en un día (zonas locales: solo escala lineal en el eje). */
const DAY_MS = 86400000

/**
 * @param {Object} p - Partido con fecha (YYYY-MM-DD) y hora opcional
 * @returns {number} timestamp en ms
 */
export function parsePartidoMs(p) {
  const f = (p?.fecha || '1970-01-01').trim()
  let h = (p?.hora || '12:00').trim()
  if (/^\d{1,2}:\d{2}$/.test(h)) {
    const [hh, mm] = h.split(':')
    h = `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00`
  } else if (/^\d{1,2}:\d{2}:\d{2}$/.test(h)) {
    const parts = h.split(':')
    h = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`
  } else {
    h = '12:00:00'
  }
  const d = new Date(`${f}T${h}`)
  const t = d.getTime()
  return Number.isNaN(t) ? Date.parse(f) || 0 : t
}

/**
 * Partidos donde el jugador participó y ya se aplicaron estadísticas (Elo), del más viejo al más nuevo.
 * @param {string} jugadorId
 * @param {Array} partidosNormalized
 * @returns {Array<Object>}
 */
export function partidosJugadorConEloAsc(jugadorId, partidosNormalized) {
  if (!jugadorId || !Array.isArray(partidosNormalized) || partidosNormalized.length === 0) {
    return []
  }
  const list = []
  for (const p of partidosNormalized) {
    if (p.estadisticasAplicadas !== true) continue
    const ids = new Set([
      ...(p.equipoLocal?.jugadores ?? []).map((e) => e?.id).filter(Boolean),
      ...(p.equipoVisitante?.jugadores ?? []).map((e) => e?.id).filter(Boolean),
    ])
    if (!ids.has(jugadorId)) continue
    list.push(p)
  }
  list.sort((a, b) => parsePartidoMs(a) - parsePartidoMs(b))
  return list
}

/**
 * Tiempos en ms alineados a cada punto de la serie de Elo (índice 0 = inicio, antes del 1.er partido con stats).
 * @param {string} jugadorId
 * @param {Array} partidosNormalized
 * @param {number[]} serieValores - resultado de serieEloParaGrafico
 * @returns {{ timesMs: number[], tMin: number, tMax: number }}
 */
export function ejeTiempoParaSerieElo(jugadorId, partidosNormalized, serieValores) {
  const L = Array.isArray(serieValores) ? serieValores.length : 0
  if (L === 0) {
    return { timesMs: [], tMin: 0, tMax: 1 }
  }

  const chrono = partidosJugadorConEloAsc(jugadorId, partidosNormalized)
  const timesMs = []

  if (chrono.length === 0) {
    const now = Date.now()
    for (let i = 0; i < L; i++) {
      timesMs.push(now - (L - 1 - i) * DAY_MS)
    }
    let tMin = Math.min(...timesMs)
    let tMax = Math.max(...timesMs)
    if (tMax <= tMin) tMax = tMin + DAY_MS
    return { timesMs, tMin, tMax }
  }

  const firstT = parsePartidoMs(chrono[0])
  timesMs.push(firstT - DAY_MS)

  for (let i = 1; i < L; i++) {
    const mIdx = i - 1
    if (mIdx < chrono.length) {
      timesMs.push(parsePartidoMs(chrono[mIdx]))
    } else {
      const prev = timesMs[timesMs.length - 1]
      const lastChrono = parsePartidoMs(chrono[chrono.length - 1])
      const base = Math.max(prev, lastChrono)
      timesMs.push(base + (i - chrono.length) * DAY_MS + DAY_MS)
    }
  }

  let tMin = Math.min(...timesMs)
  let tMax = Math.max(...timesMs)
  if (tMax <= tMin) tMax = tMin + DAY_MS
  return { timesMs, tMin, tMax }
}

/**
 * rango global para dos jugadores (comparación en el mismo eje temporal).
 */
export function rangoTiempoComparacion(timesA, timesB) {
  const all = [...timesA, ...timesB].filter((t) => Number.isFinite(t))
  if (all.length === 0) return { tMin: 0, tMax: 1 }
  let tMin = Math.min(...all)
  let tMax = Math.max(...all)
  if (tMax <= tMin) tMax = tMin + DAY_MS
  return { tMin, tMax }
}

/**
 * @param {number} tMs
 * @returns {string}
 */
export function formatoEjeFechaCorta(tMs) {
  if (!Number.isFinite(tMs)) return ''
  try {
    return new Date(tMs).toLocaleDateString('es', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return ''
  }
}

/**
 * Ticks temporales uniformes para la grilla (no lineal respecto a índice de partido).
 * @param {number} tMin
 * @param {number} tMax
 * @param {number} [targetTicks]
 * @returns {number[]}
 */
export function ticksTiempoUniformes(tMin, tMax, targetTicks = 5) {
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) {
    return [tMin]
  }
  const n = Math.max(2, targetTicks)
  const ticks = []
  for (let i = 0; i < n; i++) {
    ticks.push(tMin + (i / (n - 1)) * (tMax - tMin))
  }
  return ticks
}
