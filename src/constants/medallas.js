/**
 * Medallas automáticas por hitos. Se calculan a partir de las estadísticas del jugador
 * (no se guardan en Firestore), así siempre coinciden con los datos y son retroactivas.
 */

/** Escalera de medallas por partidos jugados: cada nivel reemplaza al anterior. */
export const MEDALLAS_PARTIDOS = [
  { umbral: 5, material: 'madera' },
  { umbral: 10, material: 'bronce' },
  { umbral: 20, material: 'plata' },
  { umbral: 40, material: 'oro' },
]

/** Escalera de medallas por goles convertidos: cada nivel reemplaza al anterior. */
export const MEDALLAS_GOLES = [
  { umbral: 10, material: 'madera' },
  { umbral: 20, material: 'bronce' },
  { umbral: 40, material: 'plata' },
  { umbral: 80, material: 'oro' },
]

export const MATERIAL_NOMBRE = {
  madera: 'Madera',
  bronce: 'Bronce',
  plata: 'Plata',
  oro: 'Oro',
}

/**
 * Nivel más alto alcanzado en una escalera (o null si todavía no llegó al primero).
 * @param {number} valor
 * @param {Array<{ umbral: number, material: string }>} escalera
 * @param {{ tipo: string, simbolo: string, unidad: string, verbo: string }} opciones
 */
function medallaDeEscalera(valor, escalera, { tipo, simbolo, unidad, verbo }) {
  let idx = -1
  escalera.forEach((m, i) => {
    if (valor >= m.umbral) idx = i
  })
  if (idx < 0) return null
  const nivel = escalera[idx]
  const siguiente = escalera[idx + 1]
  const detalle = siguiente
    ? `${valor} ${unidad} ${verbo} · próxima: ${siguiente.umbral} (${MATERIAL_NOMBRE[siguiente.material].toLowerCase()})`
    : `${valor} ${unidad} ${verbo}`
  return {
    id: `${tipo}-${nivel.umbral}`,
    tipo,
    material: nivel.material,
    simbolo,
    umbral: nivel.umbral,
    nombre: `${nivel.umbral} ${unidad}`,
    descripcion: `Medalla de ${MATERIAL_NOMBRE[nivel.material].toLowerCase()} · ${detalle}`,
  }
}

/** @param {{ partidos?: number }} jugador */
export function medallaPartidos(jugador) {
  return medallaDeEscalera(Number(jugador?.partidos) || 0, MEDALLAS_PARTIDOS, {
    tipo: 'partidos',
    simbolo: 'cancha',
    unidad: 'partidos',
    verbo: 'jugados',
  })
}

/** @param {{ goles?: number }} jugador */
export function medallaGoles(jugador) {
  return medallaDeEscalera(Number(jugador?.goles) || 0, MEDALLAS_GOLES, {
    tipo: 'goles',
    simbolo: 'pelota',
    unidad: 'goles',
    verbo: 'convertidos',
  })
}

/** Medalla de goleador según el puesto en goles de la organización. */
export const MEDALLAS_GOLEADOR = { 1: 'oro', 2: 'plata', 3: 'bronce' }

/**
 * Puesto de goleador (1, 2 o 3) de cada jugador con goles. Los empatados comparten puesto
 * y el siguiente toma el puesto inmediato (ej. 10, 8, 8, 5 goles → 1º, 2º, 2º, 3º).
 * @param {Array<{ id: string, goles?: number }>} jugadores - Todos los jugadores de la organización.
 * @returns {Map<string, number>}
 */
export function calcularPuestosGoleador(jugadores) {
  const golesDistintos = [...new Set((jugadores ?? []).map((j) => Number(j.goles) || 0))]
    .filter((g) => g > 0)
    .sort((a, b) => b - a)
    .slice(0, 3)
  const puestos = new Map()
  for (const j of jugadores ?? []) {
    const idx = golesDistintos.indexOf(Number(j.goles) || 0)
    if (idx >= 0) puestos.set(j.id, idx + 1)
  }
  return puestos
}

/**
 * @param {{ id: string, goles?: number }} jugador
 * @param {Map<string, number>} [puestosGoleador] - Resultado de `calcularPuestosGoleador`.
 */
export function medallaGoleador(jugador, puestosGoleador) {
  const puesto = puestosGoleador?.get(jugador?.id)
  if (!puesto) return null
  const material = MEDALLAS_GOLEADOR[puesto]
  const goles = Number(jugador.goles) || 0
  return {
    id: `goleador-${puesto}`,
    tipo: 'goleador',
    material,
    simbolo: 'laureles',
    nombre: puesto === 1 ? 'Máximo goleador' : `${puesto}º goleador`,
    descripcion: `Medalla de ${MATERIAL_NOMBRE[material].toLowerCase()} · ${puesto}º goleador con ${goles} goles`,
  }
}

/**
 * Mayor cantidad de MVP de la organización (0 si nadie tiene). Puede ser fraccionaria
 * (los empates en la votación reparten el MVP).
 * @param {Array<{ mvp?: number }>} jugadores
 */
export function calcularMaximoMvp(jugadores) {
  return Math.max(0, ...(jugadores ?? []).map((j) => Number(j.mvp) || 0))
}

/**
 * Balón de oro: único premio para quien tiene más MVP. Si hay empate, lo comparten.
 * @param {{ mvp?: number }} jugador
 * @param {number} [maximoMvp] - Resultado de `calcularMaximoMvp`.
 */
export function medallaBalonDeOro(jugador, maximoMvp) {
  const mvp = Number(jugador?.mvp) || 0
  if (!maximoMvp || mvp <= 0 || Math.abs(mvp - maximoMvp) > 1e-6) return null
  const mvpTexto = Number.isInteger(mvp) ? String(mvp) : mvp.toFixed(2)
  return {
    id: 'balon-de-oro',
    tipo: 'balon-de-oro',
    material: 'oro',
    simbolo: 'balon',
    nombre: 'Balón de oro',
    descripcion: `Balón de oro · el que más veces fue MVP (${mvpTexto})`,
  }
}

function fechaPartido(p) {
  const [y, m, d] = String(p?.fecha ?? '').split('-').map(Number)
  if (!y || !m || !d) return null
  const [h = 0, min = 0] = String(p?.hora || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

/** Un partido cuenta si se marcó como concluido o si su fecha ya pasó (y no está marcado como no concluido). */
function partidoYaJugado(p, ahora) {
  if (p?.concluido === true) return true
  if (p?.concluido === false) return false
  const f = fechaPartido(p)
  return f != null && f <= ahora
}

/**
 * Racha más larga de partidos seguidos jugados por cada jugador (sin faltar a ninguno
 * de los partidos de la organización entre medio).
 * @param {Array} partidos - Partidos normalizados (con `{ id }` en las listas de jugadores), en cualquier orden.
 * @returns {{ rachas: Map<string, number>, maximo: number }}
 */
export function calcularRachasPartidos(partidos, ahora = new Date()) {
  const jugados = (partidos ?? [])
    .filter((p) => partidoYaJugado(p, ahora))
    .sort((a, b) => (fechaPartido(a) ?? 0) - (fechaPartido(b) ?? 0))
  const actual = new Map()
  const rachas = new Map()
  for (const p of jugados) {
    const presentes = new Set(
      [...(p.equipoLocal?.jugadores ?? []), ...(p.equipoVisitante?.jugadores ?? [])]
        .map((e) => e?.id)
        .filter(Boolean)
    )
    for (const id of actual.keys()) {
      if (!presentes.has(id)) actual.set(id, 0)
    }
    for (const id of presentes) {
      const n = (actual.get(id) ?? 0) + 1
      actual.set(id, n)
      if (n > (rachas.get(id) ?? 0)) rachas.set(id, n)
    }
  }
  return { rachas, maximo: Math.max(0, ...rachas.values()) }
}

/**
 * Medalla única de oro para quien tiene la racha más larga de partidos seguidos.
 * Si hay empate, la comparten.
 * @param {{ id: string }} jugador
 * @param {{ rachas: Map<string, number>, maximo: number }} [rachasPartidos] - Resultado de `calcularRachasPartidos`.
 */
export function medallaRacha(jugador, rachasPartidos) {
  const maximo = rachasPartidos?.maximo ?? 0
  const racha = rachasPartidos?.rachas?.get(jugador?.id) ?? 0
  if (maximo < 2 || racha !== maximo) return null
  return {
    id: 'racha-partidos',
    tipo: 'racha',
    material: 'oro',
    simbolo: 'racha',
    umbral: racha,
    nombre: 'Racha de partidos',
    descripcion: `Medalla de oro · la racha más larga: ${racha} partidos seguidos`,
  }
}

/**
 * Todas las medallas automáticas del jugador, de mayor a menor prestigio.
 * @param {Object} jugador
 * @param {{ puestosGoleador?: Map<string, number>, maximoMvp?: number, rachasPartidos?: Object }} [contexto] - Datos de toda la organización.
 */
export function medallasAutomaticas(jugador, contexto = {}) {
  return [
    medallaBalonDeOro(jugador, contexto.maximoMvp),
    medallaRacha(jugador, contexto.rachasPartidos),
    medallaGoleador(jugador, contexto.puestosGoleador),
    medallaGoles(jugador),
    medallaPartidos(jugador),
  ].filter(Boolean)
}

/** Valor de cada material para elegir la mejor medalla (mayor = mejor). */
const VALOR_MATERIAL = { oro: 4, plata: 3, bronce: 2, madera: 1 }

/**
 * La mejor medalla de una lista: primero el balón de oro, después por material
 * (oro > plata > bronce > madera); a igual material gana la que aparece antes
 * (goleador > goles > partidos). Las asignadas a mano sin material van al final.
 * @param {Array<{ tipo?: string, material?: string }>} medallas
 */
export function mejorMedalla(medallas) {
  const valor = (m) => (m.tipo === 'balon-de-oro' ? 10 : VALOR_MATERIAL[m.material] ?? 0)
  return (medallas ?? []).reduce((mejor, m) => (!mejor || valor(m) > valor(mejor) ? m : mejor), null)
}
