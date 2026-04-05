import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import {
  ejeTiempoParaSerieElo,
  formatoEjeFechaCorta,
  ticksTiempoUniformes,
} from '../utils/eloEjeFechas'
import './JugadorEloChart.css'

function textoTooltipPunto(indice, elo, fechaMs, modoFecha) {
  const e = Math.round(elo)
  const base = indice === 0 ? `Inicio · Elo ${e}` : `Partido ${indice} · Elo ${e}`
  if (modoFecha && fechaMs != null && Number.isFinite(fechaMs)) {
    const f = formatoEjeFechaCorta(fechaMs)
    return f ? `${f} · ${base}` : base
  }
  return base
}

const VB_W = 340
const VB_H = 170
const ML = 38
const MR = 12
const MT = 20
const MB = 40

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

/**
 * @param {{ values: number[], jugadorId?: string, partidosNormalized?: Array }} props
 */
export default function JugadorEloChart({ values, jugadorId, partidosNormalized }) {
  const wrapRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const [ejePorFecha, setEjePorFecha] = useState(false)

  const puedeFecha = Boolean(jugadorId && Array.isArray(partidosNormalized))

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
    const v = Array.isArray(values) ? values : []
    if (v.length === 0) return null

    const minRaw = Math.min(...v)
    const maxRaw = Math.max(...v)
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
    const n = v.length
    const yAtValue = (val) => MT + plotH * (1 - (val - yMin) / (yMax - yMin))

    const usarFecha = ejePorFecha && puedeFecha
    let timesMs = []

    if (usarFecha) {
      const eje = ejeTiempoParaSerieElo(jugadorId, partidosNormalized, v)
      timesMs = eje.timesMs
      const tMin = eje.tMin
      const tMax = eje.tMax
      const spanT = tMax - tMin
      const xAtT = (t) => (spanT <= 0 ? ML + plotW / 2 : ML + ((t - tMin) / spanT) * plotW)

      const pts = []
      const dots = []
      v.forEach((val, i) => {
        if (typeof val !== 'number' || !Number.isFinite(val)) return
        const t = timesMs[i]
        const x = xAtT(t)
        const y = yAtValue(val)
        pts.push(`${x},${y}`)
        dots.push({ cx: x, cy: y, val, i, fechaMs: t })
      })

      const timeTicks = ticksTiempoUniformes(tMin, tMax, 5)
      const xGridLines = timeTicks.map((t, idx) => ({ key: `t-${idx}`, x: xAtT(t) }))
      const xBottomTicks = timeTicks.map((t) => ({
        x: xAtT(t),
        label: formatoEjeFechaCorta(t),
      }))

      const yGridLines = yTicks.map((tick) => ({ tick, y: yAtValue(tick) }))

      return {
        modoFecha: true,
        points: pts.join(' '),
        dots,
        yGridLines,
        xGridLines,
        xBottomTicks,
        axisXTitle: 'Fecha (partido)',
        yMin,
        yMax,
        plotW,
        plotH,
        n,
      }
    }

    const xAt = (i) => (n === 1 ? ML + plotW / 2 : ML + (i / Math.max(n - 1, 1)) * plotW)
    const pts = []
    const dots = []
    v.forEach((val, i) => {
      const x = xAt(i)
      const y = yAtValue(val)
      pts.push(`${x},${y}`)
      dots.push({ cx: x, cy: y, val, i, fechaMs: null })
    })

    const yGridLines = yTicks.map((tick) => ({ tick, y: yAtValue(tick) }))
    const xGridLines =
      n <= 22
        ? Array.from({ length: n }, (_, i) => ({ key: `xi-${i}`, x: xAt(i) }))
        : xLabelIndices(n).map((i) => ({ key: `xi-${i}`, x: xAt(i) }))
    const xIdx = xLabelIndices(n)
    const xBottomTicks = xIdx.map((i) => ({
      x: xAt(i),
      label: formatXTick(i),
    }))

    return {
      modoFecha: false,
      points: pts.join(' '),
      dots,
      yGridLines,
      xGridLines,
      xBottomTicks,
      axisXTitle: 'Partidos jugados',
      yMin,
      yMax,
      plotW,
      plotH,
      n,
    }
  }, [values, ejePorFecha, puedeFecha, jugadorId, partidosNormalized])

  if (!chart) return null

  const {
    modoFecha,
    points,
    dots,
    yGridLines,
    xGridLines,
    xBottomTicks,
    axisXTitle,
    n,
    plotW,
  } = chart

  const plotBottom = VB_H - MB

  return (
    <div className="jugador-elo-chart">
      <div className="jugador-elo-chart-meta">
        <span className="jugador-elo-chart-title">Evolución del Elo</span>
        {puedeFecha && (
          <div className="jugador-elo-chart-eje-toggle" role="group" aria-label="Eje horizontal">
            <button
              type="button"
              className={`jugador-elo-chart-eje-btn ${!ejePorFecha ? 'jugador-elo-chart-eje-btn--active' : ''}`}
              aria-pressed={!ejePorFecha}
              onClick={() => setEjePorFecha(false)}
            >
              N.º partido
            </button>
            <button
              type="button"
              className={`jugador-elo-chart-eje-btn ${ejePorFecha ? 'jugador-elo-chart-eje-btn--active' : ''}`}
              aria-pressed={ejePorFecha}
              onClick={() => setEjePorFecha(true)}
            >
              Fecha
            </button>
          </div>
        )}
      </div>
      <div className="jugador-elo-chart-svg-wrap" ref={wrapRef}>
        <svg
          className="jugador-elo-chart-svg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Evolución del Elo"
        >
          {yGridLines.map(({ tick, y }) => (
            <g key={`y-${tick}`}>
              <line
                className="jugador-elo-chart-grid-h"
                x1={ML}
                y1={y}
                x2={VB_W - MR}
                y2={y}
              />
              <text
                className="jugador-elo-chart-tick jugador-elo-chart-tick--y"
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
              className="jugador-elo-chart-grid-v"
              x1={item.x}
              y1={MT}
              x2={item.x}
              y2={VB_H - MB}
            />
          ))}

          <rect
            className="jugador-elo-chart-plot-frame"
            x={ML}
            y={MT}
            width={VB_W - ML - MR}
            height={VB_H - MT - MB}
            fill="none"
          />

          {points && (
            <polyline
              className="jugador-elo-chart-line"
              points={points}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {dots.map((d) => {
            const rVis = nDotRadius(n, d.i)
            const tip = textoTooltipPunto(d.i, d.val, d.fechaMs, modoFecha)
            return (
              <g key={d.i}>
                <circle
                  className="jugador-elo-chart-dot-hit"
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
                  className="jugador-elo-chart-dot"
                  cx={d.cx}
                  cy={d.cy}
                  r={rVis}
                  aria-label={tip}
                />
              </g>
            )
          })}

          {xBottomTicks.map((row, idx) => (
            <text
              key={`xt-${idx}-${row.label}`}
              className={`jugador-elo-chart-tick jugador-elo-chart-tick--x ${modoFecha ? 'jugador-elo-chart-tick--fecha' : ''}`}
              x={row.x}
              y={plotBottom + 13}
              textAnchor="middle"
            >
              {row.label}
            </text>
          ))}

          <text
            className="jugador-elo-chart-axis-title jugador-elo-chart-axis-title--x"
            x={ML + plotW / 2}
            y={plotBottom + 26}
            textAnchor="middle"
          >
            {axisXTitle}
          </text>
        </svg>
        {tooltip && (
          <div
            className="jugador-elo-chart-tooltip"
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

function nDotRadius(n, i) {
  if (n <= 1) return 4
  if (n > 24) return 2.5
  if (i === 0 || i === n - 1) return 3.5
  return 2.8
}
