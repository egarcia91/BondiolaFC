import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import {
  ejeTiempoParaSerieElo,
  formatoEjeFechaCorta,
  rangoTiempoComparacion,
  ticksTiempoUniformes,
} from '../utils/eloEjeFechas'
import './JugadorEloComparacionChart.css'

const COLOR_A = '#dc2626'
const COLOR_B = '#2563eb'

const VB_W = 340
const VB_H = 170
const ML = 38
const MR = 12
const MT = 20
const MB = 40

function textoTooltipCompara(etiqueta, indice, elo, fechaMs, porFecha) {
  const e = Math.round(elo)
  const pref = indice === 0 ? 'Inicio' : `Partido ${indice}`
  let s = `${etiqueta} · ${pref} · Elo ${e}`
  if (porFecha && fechaMs != null && Number.isFinite(fechaMs)) {
    const f = formatoEjeFechaCorta(fechaMs)
    if (f) s = `${etiqueta} · ${f} · ${pref} · Elo ${e}`
  }
  return s
}

function niceYTicks(min, max, targetCount = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    const m = Math.round(min) || 0
    return [m - 20, m, m + 20]
  }
  const span = max - min
  const rough = span / Math.max(1, targetCount - 1)
  const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-6))))
  const norm = rough / pow10
  const niceUnit = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  const step = niceUnit * pow10
  const t0 = Math.floor(min / step) * step
  const ticks = []
  for (let t = t0; t <= max + step * 0.001; t += step) {
    if (t >= min - step * 0.001) ticks.push(t)
    if (ticks.length > 12) break
  }
  if (ticks.length < 2) {
    const mid = (min + max) / 2
    return [mid - 25, mid, mid + 25]
  }
  return ticks
}

function xLabelIndices(n) {
  if (n <= 1) return [0]
  if (n <= 8) return Array.from({ length: n }, (_, i) => i)
  const want = [0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]
  const uniq = [...new Set(want.filter((i) => i >= 0 && i < n))].sort((a, b) => a - b)
  return uniq
}

function formatYTick(v) {
  return String(Math.round(v))
}

function formatXTick(i) {
  if (i === 0) return '0'
  return String(i)
}

function nDotRadius(n, i) {
  if (n <= 1) return 4
  if (n > 24) return 2.5
  if (i === 0 || i === n - 1) return 3.5
  return 2.8
}

/**
 * @param {{ valuesA: number[], valuesB: number[], etiquetaA: string, etiquetaB: string, jugadorIdA?: string, jugadorIdB?: string, partidosNormalized?: Array }} props
 */
export default function JugadorEloComparacionChart({
  valuesA,
  valuesB,
  etiquetaA,
  etiquetaB,
  jugadorIdA,
  jugadorIdB,
  partidosNormalized,
}) {
  const wrapRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const [ejePorFecha, setEjePorFecha] = useState(false)

  const puedeFecha = Boolean(
    jugadorIdA &&
      jugadorIdB &&
      Array.isArray(partidosNormalized) &&
      partidosNormalized.length > 0
  )

  useEffect(() => {
    if (!puedeFecha && ejePorFecha) setEjePorFecha(false)
  }, [puedeFecha, ejePorFecha])

  const updateTooltipPosition = useCallback((clientX, clientY) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTooltip((prev) =>
      prev ? { ...prev, x: clientX - r.left, y: clientY - r.top } : null
    )
  }, [])

  const chart = useMemo(() => {
    const a = Array.isArray(valuesA) ? valuesA : []
    const b = Array.isArray(valuesB) ? valuesB : []
    if (a.length === 0 && b.length === 0) return null

    const allVals = [...a, ...b].filter((x) => typeof x === 'number' && Number.isFinite(x))
    const minRaw = allVals.length ? Math.min(...allVals) : 0
    const maxRaw = allVals.length ? Math.max(...allVals) : 0
    const span = maxRaw - minRaw
    const pad = span < 1 ? 28 : Math.max(14, span * 0.1)
    let yMin = minRaw - pad
    let yMax = maxRaw + pad
    if (yMax <= yMin) {
      yMin = minRaw - 28
      yMax = maxRaw + 28
    }
    const yTicks = niceYTicks(yMin, yMax, 5)
    const yTickMin = Math.min(...yTicks)
    const yTickMax = Math.max(...yTicks)
    yMin = Math.min(yMin, yTickMin)
    yMax = Math.max(yMax, yTickMax)

    const plotW = VB_W - ML - MR
    const plotH = VB_H - MT - MB
    const yAtValue = (val) => MT + plotH * (1 - (val - yMin) / (yMax - yMin))

    const buildSerie = (vals, etiqueta, color, timesMs, xAtIndex) => {
      const pts = []
      const dots = []
      const n = vals.length
      vals.forEach((val, i) => {
        if (typeof val !== 'number' || !Number.isFinite(val)) return
        const t = timesMs && timesMs.length > i ? timesMs[i] : null
        const x = xAtIndex(i, t)
        const y = yAtValue(val)
        pts.push(`${x},${y}`)
        dots.push({ cx: x, cy: y, val, i, fechaMs: t, etiqueta, color, nSerie: n })
      })
      return { points: pts.join(' '), dots }
    }

    const usarFecha = ejePorFecha && puedeFecha

    if (usarFecha) {
      const ejeA = ejeTiempoParaSerieElo(jugadorIdA, partidosNormalized, a)
      const ejeB = ejeTiempoParaSerieElo(jugadorIdB, partidosNormalized, b)
      const { tMin, tMax } = rangoTiempoComparacion(ejeA.timesMs, ejeB.timesMs)
      const spanT = tMax - tMin
      const xAtT = (t) =>
        spanT <= 0 ? ML + plotW / 2 : ML + ((t - tMin) / spanT) * plotW

      const xAtIndex = (i, t) => xAtT(t)

      const serieA = buildSerie(a, etiquetaA, COLOR_A, ejeA.timesMs, xAtIndex)
      const serieB = buildSerie(b, etiquetaB, COLOR_B, ejeB.timesMs, xAtIndex)

      const timeTicks = ticksTiempoUniformes(tMin, tMax, 5)
      const xGridLines = timeTicks.map((t, idx) => ({ key: `t-${idx}`, x: xAtT(t) }))
      const xBottomTicks = timeTicks.map((t) => ({
        x: xAtT(t),
        label: formatoEjeFechaCorta(t),
      }))

      const yGridLines = yTicks.map((tick) => ({ tick, y: yAtValue(tick) }))

      return {
        modoFecha: true,
        serieA,
        serieB,
        yGridLines,
        xGridLines,
        xBottomTicks,
        axisXTitle: 'Fecha (partido)',
        plotW,
        nRef: Math.max(a.length, b.length, 1),
      }
    }

    const N = Math.max(a.length, b.length, 1)
    const xAt = (i) => (N === 1 ? ML + plotW / 2 : ML + (i / Math.max(N - 1, 1)) * plotW)
    const xAtIndex = (i) => xAt(i)
    const emptyTimes = []

    const serieA = buildSerie(a, etiquetaA, COLOR_A, emptyTimes, (i) => xAtIndex(i))
    const serieB = buildSerie(b, etiquetaB, COLOR_B, emptyTimes, (i) => xAtIndex(i))

    const yGridLines = yTicks.map((tick) => ({ tick, y: yAtValue(tick) }))
    const xGridLines =
      N <= 22
        ? Array.from({ length: N }, (_, i) => ({ key: `xi-${i}`, x: xAt(i) }))
        : xLabelIndices(N).map((i) => ({ key: `xi-${i}`, x: xAt(i) }))
    const xIdx = xLabelIndices(N)
    const xBottomTicks = xIdx.map((i) => ({
      x: xAt(i),
      label: formatXTick(i),
    }))

    return {
      modoFecha: false,
      serieA,
      serieB,
      yGridLines,
      xGridLines,
      xBottomTicks,
      axisXTitle: 'Partidos jugados',
      plotW,
      nRef: N,
    }
  }, [
    valuesA,
    valuesB,
    etiquetaA,
    etiquetaB,
    ejePorFecha,
    puedeFecha,
    jugadorIdA,
    jugadorIdB,
    partidosNormalized,
  ])

  if (!chart) return null

  const {
    modoFecha,
    serieA,
    serieB,
    yGridLines,
    xGridLines,
    xBottomTicks,
    axisXTitle,
    plotW,
    nRef,
  } = chart

  const plotBottom = VB_H - MB
  const dotsAll = [...serieA.dots, ...serieB.dots]

  return (
    <div className="jugador-elo-compara">
      <div className="jugador-elo-compara-meta">
        <span className="jugador-elo-compara-title">Elo histórico · comparación</span>
        <div className="jugador-elo-compara-meta-right">
          {puedeFecha && (
            <div
              className="jugador-elo-compara-eje-toggle"
              role="group"
              aria-label="Eje horizontal"
            >
              <button
                type="button"
                className={`jugador-elo-compara-eje-btn ${!ejePorFecha ? 'jugador-elo-compara-eje-btn--active' : ''}`}
                aria-pressed={!ejePorFecha}
                onClick={() => setEjePorFecha(false)}
              >
                N.º partido
              </button>
              <button
                type="button"
                className={`jugador-elo-compara-eje-btn ${ejePorFecha ? 'jugador-elo-compara-eje-btn--active' : ''}`}
                aria-pressed={ejePorFecha}
                onClick={() => setEjePorFecha(true)}
              >
                Fecha
              </button>
            </div>
          )}
          <div className="jugador-elo-compara-leyenda" aria-hidden>
            <span className="jugador-elo-compara-leyenda-item jugador-elo-compara-leyenda--a">
              <span className="jugador-elo-compara-leyenda-swatch" />
              {etiquetaA}
            </span>
            <span className="jugador-elo-compara-leyenda-item jugador-elo-compara-leyenda--b">
              <span className="jugador-elo-compara-leyenda-swatch" />
              {etiquetaB}
            </span>
          </div>
        </div>
      </div>
      <div className="jugador-elo-compara-svg-wrap" ref={wrapRef}>
        <svg
          className="jugador-elo-compara-svg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Comparación del Elo histórico entre dos jugadores"
        >
          {yGridLines.map(({ tick, y }) => (
            <g key={`y-${tick}`}>
              <line
                className="jugador-elo-compara-grid-h"
                x1={ML}
                y1={y}
                x2={VB_W - MR}
                y2={y}
              />
              <text
                className="jugador-elo-compara-tick jugador-elo-compara-tick--y"
                x={ML - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatYTick(tick)}
              </text>
            </g>
          ))}

          {xGridLines.map((item) => (
            <line
              key={item.key}
              className="jugador-elo-compara-grid-v"
              x1={item.x}
              y1={MT}
              x2={item.x}
              y2={VB_H - MB}
            />
          ))}

          <rect
            className="jugador-elo-compara-plot-frame"
            x={ML}
            y={MT}
            width={VB_W - ML - MR}
            height={VB_H - MT - MB}
            fill="none"
          />

          {serieA.points && (
            <polyline
              className="jugador-elo-compara-line jugador-elo-compara-line--a"
              points={serieA.points}
              fill="none"
              stroke={COLOR_A}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {serieB.points && (
            <polyline
              className="jugador-elo-compara-line jugador-elo-compara-line--b"
              points={serieB.points}
              fill="none"
              stroke={COLOR_B}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {dotsAll.map((d, idx) => {
            const rVis = nDotRadius(Math.max(d.nSerie, nRef), d.i)
            const tip = textoTooltipCompara(d.etiqueta, d.i, d.val, d.fechaMs, modoFecha)
            return (
              <g key={`${d.etiqueta}-${d.i}-${idx}`}>
                <circle
                  className="jugador-elo-compara-dot-hit"
                  cx={d.cx}
                  cy={d.cy}
                  r={rVis + 12}
                  fill="transparent"
                  aria-hidden
                  onMouseEnter={(e) => {
                    const el = wrapRef.current
                    if (!el) return
                    const rect = el.getBoundingClientRect()
                    setTooltip({
                      text: tip,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    })
                  }}
                  onMouseMove={(e) => updateTooltipPosition(e.clientX, e.clientY)}
                  onMouseLeave={() => setTooltip(null)}
                />
                <circle
                  className="jugador-elo-compara-dot"
                  cx={d.cx}
                  cy={d.cy}
                  r={rVis}
                  fill="var(--card-bg, #fff)"
                  stroke={d.color}
                  strokeWidth={2}
                  aria-label={tip}
                />
              </g>
            )
          })}

          {xBottomTicks.map((row, idx) => (
            <text
              key={`xt-${idx}-${row.label}`}
              className={`jugador-elo-compara-tick jugador-elo-compara-tick--x ${modoFecha ? 'jugador-elo-compara-tick--fecha' : ''}`}
              x={row.x}
              y={plotBottom + 13}
              textAnchor="middle"
            >
              {row.label}
            </text>
          ))}

          <text
            className="jugador-elo-compara-axis-title jugador-elo-compara-axis-title--x"
            x={ML + plotW / 2}
            y={plotBottom + 26}
            textAnchor="middle"
          >
            {axisXTitle}
          </text>
        </svg>
        {tooltip && (
          <div
            className="jugador-elo-compara-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
            role="tooltip"
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  )
}
