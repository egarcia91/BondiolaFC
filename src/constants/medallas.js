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

export const MATERIAL_NOMBRE = {
  madera: 'Madera',
  bronce: 'Bronce',
  plata: 'Plata',
  oro: 'Oro',
}

/**
 * Medalla de partidos más alta alcanzada (o null si todavía no llegó a la primera).
 * @param {{ partidos?: number }} jugador
 */
export function medallaPartidos(jugador) {
  const partidos = Number(jugador?.partidos) || 0
  let idx = -1
  MEDALLAS_PARTIDOS.forEach((m, i) => {
    if (partidos >= m.umbral) idx = i
  })
  if (idx < 0) return null
  const nivel = MEDALLAS_PARTIDOS[idx]
  const siguiente = MEDALLAS_PARTIDOS[idx + 1]
  const descripcion = siguiente
    ? `${partidos} partidos jugados · próxima: ${siguiente.umbral} (${MATERIAL_NOMBRE[siguiente.material].toLowerCase()})`
    : `${partidos} partidos jugados`
  return {
    id: `partidos-${nivel.umbral}`,
    tipo: 'partidos',
    material: nivel.material,
    umbral: nivel.umbral,
    nombre: `${nivel.umbral} partidos`,
    descripcion: `Medalla de ${MATERIAL_NOMBRE[nivel.material].toLowerCase()} · ${descripcion}`,
  }
}

/** Todas las medallas automáticas del jugador (por ahora, solo partidos). */
export function medallasAutomaticas(jugador) {
  return [medallaPartidos(jugador)].filter(Boolean)
}
