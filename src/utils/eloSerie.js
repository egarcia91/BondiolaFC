import { partidosJugadorConEloAsc } from './eloEjeFechas'

/** Valor inicial de Elo para jugadores nuevos y punto de partida del gráfico. */
export const ELO_INICIAL = 900

/**
 * Serie de Elo para el gráfico: evolución partido a partido empezando en 900.
 * Usa `eloHistorial` del documento; si falta, aproxima con Elo actual.
 *
 * Si se pasa `jugadorId` y `partidosNormalized`, el largo de la serie se alinea al número
 * de partidos con estadísticas aplicadas (`estadisticasAplicadas`), rellenando con el
 * `elo` actual cuando el historial en Firestore quedó una entrada corta (evita que el
 * eje por fecha muestre el último punto en la fecha del anteúltimo partido).
 *
 * @param {{ elo?: number, eloHistorial?: number[], partidos?: number }} jugador
 * @param {{ jugadorId?: string, partidosNormalized?: Array }} [opts]
 * @returns {number[]}
 */
export function serieEloParaGrafico(jugador, opts = {}) {
  const eloActual =
    typeof jugador?.elo === 'number' && Number.isFinite(jugador.elo)
      ? Math.round(jugador.elo)
      : ELO_INICIAL
  const partidos = jugador?.partidos ?? 0
  const h = jugador?.eloHistorial

  let serie
  if (Array.isArray(h) && h.length > 0) {
    const nums = h.map((x) =>
      typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : ELO_INICIAL
    )
    serie = nums[0] !== ELO_INICIAL ? [ELO_INICIAL, ...nums] : nums
  } else if (partidos <= 0) {
    serie = [ELO_INICIAL]
  } else {
    serie = [ELO_INICIAL, eloActual]
  }

  const { jugadorId, partidosNormalized } = opts
  if (jugadorId && Array.isArray(partidosNormalized) && partidosNormalized.length > 0) {
    const nConElo = partidosJugadorConEloAsc(jugadorId, partidosNormalized).length
    const need = nConElo + 1
    if (serie.length < need) {
      const tail = eloActual
      serie = [...serie, ...Array(need - serie.length).fill(tail)]
    }
  }

  return serie
}
