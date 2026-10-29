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
 * Todas las medallas automáticas del jugador, de mayor a menor prestigio.
 * @param {Object} jugador
 * @param {{ puestosGoleador?: Map<string, number> }} [contexto] - Datos de toda la organización.
 */
export function medallasAutomaticas(jugador, contexto = {}) {
  return [
    medallaGoleador(jugador, contexto.puestosGoleador),
    medallaGoles(jugador),
    medallaPartidos(jugador),
  ].filter(Boolean)
}
