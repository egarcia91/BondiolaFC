import { useState, useEffect, useMemo } from 'react'
import { getJugadores, getPartidos, normalizePartidos } from '../services/firestore'
import NuevoJugadorModal from './NuevoJugadorModal'
import JugadorEloChart from './JugadorEloChart'
import JugadorEloComparacionChart from './JugadorEloComparacionChart'
import { serieEloParaGrafico } from '../utils/eloSerie'
import './Jugadores.css'

const POSICIONES = ['Delantero', 'Defensor', 'Mediocampista', 'Arquero']

/** Órdenes por promedio (goles, victorias, empates, derrotas sobre partidos jugados). */
const ORDEN_PROMEDIO_KEYS = new Set([
  'goles_partido',
  'victorias_partido',
  'empates_partido',
  'derrotas_partido',
])

const PROMEDIO_MOVIL_LABEL = {
  goles_partido: ' goles/part.',
  victorias_partido: ' vic./part.',
  empates_partido: ' emp./part.',
  derrotas_partido: ' der./part.',
}

/** Etiquetas largas para la tarjeta en escritorio (métrica destacada por orden). */
const RATIO_DESKTOP_LABEL = {
  goles_partido: 'Goles por partido',
  victorias_partido: 'Victorias por partido',
  empates_partido: 'Empates por partido',
  derrotas_partido: 'Derrotas por partido',
}

function ratioPorPartido(j, tipo) {
  const p = j.partidos ?? 0
  if (p <= 0) return 0
  switch (tipo) {
    case 'goles_partido':
      return (j.goles ?? 0) / p
    case 'victorias_partido':
      return (j.victorias ?? 0) / p
    case 'empates_partido':
      return (j.partidosEmpatados ?? 0) / p
    case 'derrotas_partido':
      return (j.partidosPerdidos ?? 0) / p
    default:
      return 0
  }
}

/** Solo filtros por promedio (goles/victorias/empates/derrotas por partido): 2 decimales fijos, ej. 3.00, 2.38. */
function formatMovilDosDecimales(value) {
  const x = Number(value)
  if (!Number.isFinite(x)) return '0.00'
  return (Math.round(x * 100) / 100).toFixed(2)
}

function accentClassForMetric(clave) {
  switch (clave) {
    case 'ultimos':
      return 'stat-item--accent-presencias'
    case 'partidos':
      return 'stat-item--accent-partidos'
    case 'goles':
      return 'stat-item--accent-goles'
    case 'elo':
      return 'stat-item--accent-elo'
    case 'goles_partido':
      return 'stat-item--accent-goles'
    case 'victorias_partido':
      return 'stat-item--accent-victorias'
    case 'empates_partido':
      return 'stat-item--accent-empates'
    case 'derrotas_partido':
      return 'stat-item--accent-derrotas'
    default:
      return ''
  }
}

/** Mapea métrica de comparación → clave para `ratioPorPartido` (promedios). */
const COMPARAR_RATIO_TIPO = {
  victorias: 'victorias_partido',
  derrotas: 'derrotas_partido',
  empates: 'empates_partido',
  goles: 'goles_partido',
}

/** Ícono junto al Elo: sugiere que hay gráfico al hacer clic. */
const COMPARAR_METRICAS = [
  { key: 'partidos', label: 'Partidos', get: (j) => (j ? (j.partidos ?? 0) : null) },
  { key: 'victorias', label: 'Victorias', get: (j) => (j ? (j.victorias ?? 0) : null) },
  { key: 'derrotas', label: 'Derrotas', get: (j) => (j ? (j.partidosPerdidos ?? 0) : null) },
  { key: 'empates', label: 'Empates', get: (j) => (j ? (j.partidosEmpatados ?? 0) : null) },
  { key: 'goles', label: 'Goles', get: (j) => (j ? (j.goles ?? 0) : null) },
  { key: 'elo', label: 'Elo', get: (j) => (j ? (j.elo ?? 900) : null) },
  { key: 'mvp', label: 'MVP', get: (j) => (j ? (j.mvp ?? 0) : null) },
]

/** Sufijo corto en la columna central: totales (n°) vs proporcional por partido (%). */
function etiquetaCompararCentro(labelBase, key, porPartido) {
  const conModo = key === 'partidos' || Boolean(COMPARAR_RATIO_TIPO[key])
  if (!conModo) return labelBase
  return `${labelBase}${porPartido ? ' (%)' : ' (n°)'}`
}

function formatMvpComparar(m) {
  const x = Number(m) || 0
  if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x))
  return x.toFixed(2)
}

function textoMetricaComparar(key, val, valorEsRatio = false) {
  if (val == null) return '—'
  if (key === 'mvp') return formatMvpComparar(val)
  if (valorEsRatio && COMPARAR_RATIO_TIPO[key]) return formatMovilDosDecimales(val)
  return String(val)
}

function formatoDeltaComparar(delta, esRatio) {
  const d = Math.abs(delta)
  return esRatio ? (Math.round(d * 100) / 100).toFixed(2) : String(Math.round(d))
}

/**
 * Texto “+Δ” en verde si este jugador sale favorecido respecto al otro; si no hay ventaja, null.
 * (Las derrotas van aparte: ver `diffCompararDerrotasPeor`.)
 * @param {boolean} [valorEsRatio] - victorias/goles/… como promedio por partido
 */
function diffCompararFavor(key, valSelf, valOtro, valorEsRatio = false) {
  if (key === 'derrotas' || key === 'empates') return null
  if (valSelf == null || valOtro == null) return null
  const a = Number(valSelf)
  const b = Number(valOtro)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const iguales = valorEsRatio ? Math.abs(a - b) < 1e-6 : a === b
  if (iguales) return null
  const delta = a - b
  if (delta <= 0) return null
  if (key === 'mvp') {
    const rounded = Math.round(delta * 100) / 100
    const dec = Math.abs(rounded - Math.round(rounded)) >= 1e-6
    const body = dec ? rounded.toFixed(2) : String(Math.round(rounded))
    return `+${body}`
  }
  return `+${formatoDeltaComparar(delta, valorEsRatio)}`
}

/**
 * “-Δ” en rojo junto al jugador que tiene más derrotas (totales o por partido).
 */
function diffCompararDerrotasPeor(valSelf, valOtro, valorEsRatio = false) {
  if (valSelf == null || valOtro == null) return null
  const a = Number(valSelf)
  const b = Number(valOtro)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const peor = valorEsRatio ? a > b + 1e-6 : a > b
  if (!peor) return null
  const delta = a - b
  return `-${formatoDeltaComparar(delta, valorEsRatio)}`
}

function IconoEloGrafico() {
  return (
    <svg
      className="jugador-elo-grafico-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 19V10M10 19v-6m6 7V5m6 14V9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Jugadores({ organizacionId, isAdmin }) {
  const [jugadores, setJugadores] = useState([])
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroPosicion, setFiltroPosicion] = useState('')
  const [ordenPor, setOrdenPor] = useState('presentes')
  const [modoVista, setModoVista] = useState('listado')
  const [compararIdA, setCompararIdA] = useState('')
  const [compararIdB, setCompararIdB] = useState('')
  /** Comparar jugadores: totales vs promedios por partido (toggle en fila Partidos). */
  const [compararPorPartido, setCompararPorPartido] = useState(false)
  const [expandidoId, setExpandidoId] = useState(null)
  /** Solo un gráfico de Elo abierto a la vez (acordeón). */
  const [eloGraficoJugadorId, setEloGraficoJugadorId] = useState(null)
  const [showNuevoJugadorModal, setShowNuevoJugadorModal] = useState(false)

  const toggleEloGrafico = (jugadorId) => {
    setEloGraficoJugadorId((actual) => (actual === jugadorId ? null : jugadorId))
  }

  useEffect(() => {
    if (!organizacionId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getJugadores(organizacionId), getPartidos(organizacionId)])
      .then(([jugadoresData, partidosData]) => {
        if (!cancelled) {
          setJugadores(jugadoresData)
          setPartidos(partidosData)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error al cargar jugadores')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [organizacionId])

  const partidosNormalized = useMemo(
    () => normalizePartidos(partidos, jugadores),
    [partidos, jugadores]
  )

  /** Últimos 10 partidos (o menos si hay menos en la org): presencias por jugadorId para el listado móvil. */
  const { presenciasUltimosMap, ultimosPartidosVentana } = useMemo(() => {
    const n = Math.min(10, partidosNormalized.length)
    const slice = partidosNormalized.slice(0, n)
    const map = new Map()
    for (const j of jugadores) {
      if (!j?.id) continue
      let count = 0
      for (const p of slice) {
        const ids = new Set([
          ...(p.equipoLocal?.jugadores ?? []).map((e) => e?.id).filter(Boolean),
          ...(p.equipoVisitante?.jugadores ?? []).map((e) => e?.id).filter(Boolean),
        ])
        if (ids.has(j.id)) count++
      }
      map.set(j.id, count)
    }
    return { presenciasUltimosMap: map, ultimosPartidosVentana: n }
  }, [partidosNormalized, jugadores])

  /** Lista para selects de comparar (solo posición; incluye todos los jugadores de la org). */
  const jugadoresListaComparar = useMemo(() => {
    let lista = [...jugadores]
    if (filtroPosicion) {
      lista = lista.filter((j) => j.posicion === filtroPosicion)
    }
    lista.sort((a, b) =>
      (a.apodo || a.nombre || '').localeCompare(b.apodo || b.nombre || '', 'es', { sensitivity: 'base' })
    )
    return lista
  }, [jugadores, filtroPosicion])

  const jugadorCompararA = useMemo(
    () => jugadoresListaComparar.find((j) => j.id === compararIdA) ?? null,
    [jugadoresListaComparar, compararIdA]
  )
  const jugadorCompararB = useMemo(
    () => jugadoresListaComparar.find((j) => j.id === compararIdB) ?? null,
    [jugadoresListaComparar, compararIdB]
  )

  const compararListaKey = useMemo(
    () => jugadoresListaComparar.map((j) => j.id).join('|'),
    [jugadoresListaComparar]
  )

  useEffect(() => {
    if (modoVista !== 'comparar') setCompararPorPartido(false)
  }, [modoVista])

  useEffect(() => {
    if (modoVista !== 'comparar') return
    const list = jugadoresListaComparar
    if (!list.length) {
      setCompararIdA('')
      setCompararIdB('')
      return
    }
    setCompararIdA((a) => {
      const nextA = a && list.some((j) => j.id === a) ? a : list[0].id
      setCompararIdB((b) => {
        if (list.length < 2) return ''
        const nextB =
          b && list.some((j) => j.id === b) && b !== nextA
            ? b
            : list.find((j) => j.id !== nextA)?.id ?? ''
        return nextB
      })
      return nextA
    })
  }, [modoVista, compararListaKey])

  const jugadoresFiltradosYOrdenados = useMemo(() => {
    let lista = [...jugadores]
    if (filtroPosicion) {
      lista = lista.filter((j) => j.posicion === filtroPosicion)
    }
    if (ordenPor !== 'ninguno') {
      lista = lista.filter((j) => (j.partidos ?? 0) > 0)
    }
    if (ordenPor === 'ninguno') {
      // Solo filtro por posición; sin reordenar (orden de Firestore)
    } else if (ordenPor === 'partidos') {
      lista.sort((a, b) => b.partidos - a.partidos)
    } else if (ordenPor === 'goles') {
      lista.sort((a, b) => b.goles - a.goles)
    } else if (ordenPor === 'ranking') {
      lista.sort((a, b) => (b.elo ?? 900) - (a.elo ?? 900))
    } else if (ordenPor === 'presentes' && partidosNormalized.length > 0) {
      const ultimo = partidosNormalized[0]
      const presentes = new Set([
        ...(ultimo.equipoLocal?.jugadores ?? []).map((e) => e?.id).filter(Boolean),
        ...(ultimo.equipoVisitante?.jugadores ?? []).map((e) => e?.id).filter(Boolean),
      ])
      lista.sort((a, b) => {
        const aJugo = presentes.has(a.id)
        const bJugo = presentes.has(b.id)
        if (aJugo && !bJugo) return -1
        if (!aJugo && bJugo) return 1
        return b.partidos - a.partidos
      })
    } else if (ordenPor === 'goles_partido') {
      lista.sort((a, b) => ratioPorPartido(b, 'goles_partido') - ratioPorPartido(a, 'goles_partido'))
    } else if (ordenPor === 'victorias_partido') {
      lista.sort(
        (a, b) => ratioPorPartido(b, 'victorias_partido') - ratioPorPartido(a, 'victorias_partido')
      )
    } else if (ordenPor === 'empates_partido') {
      lista.sort(
        (a, b) => ratioPorPartido(b, 'empates_partido') - ratioPorPartido(a, 'empates_partido')
      )
    } else if (ordenPor === 'derrotas_partido') {
      lista.sort(
        (a, b) => ratioPorPartido(b, 'derrotas_partido') - ratioPorPartido(a, 'derrotas_partido')
      )
    }
    return lista
  }, [jugadores, partidosNormalized, filtroPosicion, ordenPor])

  /** Métrica principal en vista escritorio (tarjetas): clase stat-item--highlight + extras. */
  const metricaDesktopDestacada = useMemo(() => {
    if (ordenPor === 'ninguno') return null
    if (ordenPor === 'presentes') {
      return ultimosPartidosVentana > 0 ? 'ultimos' : 'partidos'
    }
    if (ordenPor === 'partidos') return 'partidos'
    if (ordenPor === 'goles') return 'goles'
    if (ordenPor === 'ranking') return 'elo'
    if (ORDEN_PROMEDIO_KEYS.has(ordenPor)) return ordenPor
    return null
  }, [ordenPor, ultimosPartidosVentana])

  const statDesktopClass = (clave) => {
    const base = 'stat-item'
    if (metricaDesktopDestacada && clave === metricaDesktopDestacada) {
      return `${base} stat-item--highlight ${accentClassForMetric(clave)}`.trim()
    }
    return base
  }

  if (loading) {
    return (
      <div className="jugadores-container">
        <div className="jugadores-header">
          <h2 className="section-title">Jugadores</h2>
          {isAdmin && (
            <button type="button" className="jugadores-btn-nuevo" disabled>
              Nuevo jugador
            </button>
          )}
        </div>
        <p className="empty-state">Cargando jugadores…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="jugadores-container">
        <div className="jugadores-header">
          <h2 className="section-title">Jugadores</h2>
          {isAdmin && (
            <button type="button" className="jugadores-btn-nuevo" onClick={() => setShowNuevoJugadorModal(true)}>
              Nuevo jugador
            </button>
          )}
        </div>
        <p className="empty-state jugadores-error">{error}</p>
        {showNuevoJugadorModal && (
          <NuevoJugadorModal
            organizacionId={organizacionId}
            onClose={() => setShowNuevoJugadorModal(false)}
            onSaved={() => { setShowNuevoJugadorModal(false); getJugadores(organizacionId).then(setJugadores).catch(() => {}) }}
          />
        )}
      </div>
    )
  }

  const refreshJugadores = () => {
    if (organizacionId) getJugadores(organizacionId).then(setJugadores).catch(() => {})
  }

  return (
    <div className="jugadores-container">
      <div className="jugadores-header">
        <h2 className="section-title">Jugadores</h2>
        {isAdmin && (
          <button
            type="button"
            className="jugadores-btn-nuevo"
            onClick={() => setShowNuevoJugadorModal(true)}
          >
            Nuevo jugador
          </button>
        )}
      </div>

      {showNuevoJugadorModal && (
        <NuevoJugadorModal
          organizacionId={organizacionId}
          onClose={() => setShowNuevoJugadorModal(false)}
          onSaved={refreshJugadores}
        />
      )}

      {jugadores.length > 0 && (
        <div
          className={`jugadores-controles ${modoVista === 'comparar' ? 'jugadores-controles--comparar' : ''}`}
        >
          <div className="jugadores-filtro">
            <label htmlFor="filtro-posicion" className="controles-label">Posición</label>
            <select
              id="filtro-posicion"
              value={filtroPosicion}
              onChange={(e) => setFiltroPosicion(e.target.value)}
              className="controles-select"
            >
              <option value="">Todas</option>
              {POSICIONES.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
          <div className="jugadores-vista">
            <label htmlFor="jugadores-modo-vista" className="controles-label">Vista</label>
            <select
              id="jugadores-modo-vista"
              value={modoVista}
              className="controles-select controles-modo-vista-select"
              onChange={(e) => {
                const v = e.target.value
                setModoVista(v)
                if (v !== 'comparar') return
                const list = filtroPosicion
                  ? jugadores.filter((j) => j.posicion === filtroPosicion)
                  : [...jugadores]
                list.sort((a, b) =>
                  (a.apodo || a.nombre || '').localeCompare(b.apodo || b.nombre || '', 'es', {
                    sensitivity: 'base',
                  })
                )
                const validIds = new Set(list.map((j) => j.id))
                let nextA = compararIdA
                let nextB = compararIdB
                if (!nextA || !validIds.has(nextA)) nextA = list[0]?.id ?? ''
                if (!nextB || !validIds.has(nextB) || nextB === nextA) {
                  nextB = list.find((j) => j.id !== nextA)?.id ?? ''
                }
                setCompararIdA(nextA)
                setCompararIdB(nextB)
              }}
            >
              <option value="listado">Listado</option>
              <option value="comparar">Comparar</option>
            </select>
          </div>
          {modoVista === 'listado' ? (
            <div className="jugadores-orden">
              <label htmlFor="filtro-orden" className="controles-label">
                Ordenar por
              </label>
              <select
                id="filtro-orden"
                value={ordenPor}
                onChange={(e) => setOrdenPor(e.target.value)}
                className="controles-select controles-orden-select"
              >
                <option value="presentes">Últimos partidos</option>
                <option value="ninguno">Sin filtros</option>
                <option value="partidos">Más partidos</option>
                <option value="goles">Más goles</option>
                <option value="ranking">Ranking</option>
                <option value="goles_partido">Goles por partido</option>
                <option value="victorias_partido">Victorias por partido</option>
                <option value="empates_partido">Empates por partido</option>
                <option value="derrotas_partido">Derrotas por partido</option>
              </select>
            </div>
          ) : (
            <div className="jugadores-comparar-picks">
              <div className="jugadores-comparar-pick">
                <label htmlFor="comparar-jugador-a" className="controles-label">Jugador (izq.)</label>
                <select
                  id="comparar-jugador-a"
                  value={compararIdA}
                  className="controles-select controles-comparar-select"
                  onChange={(e) => {
                    const id = e.target.value
                    setCompararIdA(id)
                    if (id && id === compararIdB) setCompararIdB('')
                  }}
                >
                  <option value="">Elegir jugador…</option>
                  {jugadoresListaComparar.map((j) => (
                    <option key={j.id} value={j.id} disabled={j.id === compararIdB}>
                      {j.apodo || j.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="jugadores-comparar-pick">
                <label htmlFor="comparar-jugador-b" className="controles-label">Jugador (der.)</label>
                <select
                  id="comparar-jugador-b"
                  value={compararIdB}
                  className="controles-select controles-comparar-select"
                  onChange={(e) => {
                    const id = e.target.value
                    setCompararIdB(id)
                    if (id && id === compararIdA) setCompararIdA('')
                  }}
                >
                  <option value="">Elegir jugador…</option>
                  {jugadoresListaComparar.map((j) => (
                    <option key={j.id} value={j.id} disabled={j.id === compararIdA}>
                      {j.apodo || j.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
      
      {jugadores.length === 0 ? (
        <p className="empty-state">No hay jugadores registrados</p>
      ) : modoVista === 'comparar' ? (
        <div className="jugadores-comparar-vista">
          {jugadoresListaComparar.length < 2 ? (
            <p className="empty-state jugadores-comparar-aviso">
              Para comparar hacen falta al menos dos jugadores
              {filtroPosicion ? ' con la posición elegida' : ''}. Cambiá el filtro o agregá jugadores.
            </p>
          ) : (
            <>
              <div className="jugadores-comparar-grid">
                <div className="jugadores-comparar-row jugadores-comparar-row--cabeceras">
                  <div className="jugadores-comparar-celda jugadores-comparar-celda--jugador">
                    <div className="jugadores-comparar-mini-card">
                      {jugadorCompararA ? (
                        <>
                          <div className="jugadores-comparar-mini-titulo">
                            <h3 className="jugador-apodo">{jugadorCompararA.apodo || jugadorCompararA.nombre}</h3>
                            {jugadorCompararA.apodo && (
                              <span className="jugador-nombre">{jugadorCompararA.nombre}</span>
                            )}
                          </div>
                          <span className="jugador-posicion">{jugadorCompararA.posicion}</span>
                        </>
                      ) : (
                        <p className="jugadores-comparar-placeholder">Elegí jugador (izq.)</p>
                      )}
                    </div>
                  </div>
                  <div className="jugadores-comparar-celda jugadores-comparar-celda--centro" aria-hidden="true" />
                  <div className="jugadores-comparar-celda jugadores-comparar-celda--jugador">
                    <div className="jugadores-comparar-mini-card">
                      {jugadorCompararB ? (
                        <>
                          <div className="jugadores-comparar-mini-titulo">
                            <h3 className="jugador-apodo">{jugadorCompararB.apodo || jugadorCompararB.nombre}</h3>
                            {jugadorCompararB.apodo && (
                              <span className="jugador-nombre">{jugadorCompararB.nombre}</span>
                            )}
                          </div>
                          <span className="jugador-posicion">{jugadorCompararB.posicion}</span>
                        </>
                      ) : (
                        <p className="jugadores-comparar-placeholder">Elegí jugador (der.)</p>
                      )}
                    </div>
                  </div>
                </div>
                {COMPARAR_METRICAS.map(({ key, label: labelBase, get }) => {
                  const valorEsRatio = compararPorPartido && Boolean(COMPARAR_RATIO_TIPO[key])
                  const va = valorEsRatio
                    ? jugadorCompararA
                      ? ratioPorPartido(jugadorCompararA, COMPARAR_RATIO_TIPO[key])
                      : null
                    : get(jugadorCompararA)
                  const vb = valorEsRatio
                    ? jugadorCompararB
                      ? ratioPorPartido(jugadorCompararB, COMPARAR_RATIO_TIPO[key])
                      : null
                    : get(jugadorCompararB)
                  const labelCentro = etiquetaCompararCentro(labelBase, key, compararPorPartido)
                  const ambos = jugadorCompararA && jugadorCompararB
                  const esDerrotas = key === 'derrotas'
                  const marcadorIzq = ambos
                    ? esDerrotas
                      ? diffCompararDerrotasPeor(va, vb, valorEsRatio)
                      : diffCompararFavor(key, va, vb, valorEsRatio)
                    : null
                  const marcadorDer = ambos
                    ? esDerrotas
                      ? diffCompararDerrotasPeor(vb, va, valorEsRatio)
                      : diffCompararFavor(key, vb, va, valorEsRatio)
                    : null
                  const classMarcador = esDerrotas
                    ? 'jugadores-comparar-diff-peor'
                    : 'jugadores-comparar-diff-favor'
                  const titleMarcador = esDerrotas
                    ? valorEsRatio
                      ? 'Más derrotas por partido que el otro jugador'
                      : 'Más derrotas que el otro jugador'
                    : 'Ventaja vs el otro jugador'
                  const etiquetaCentral =
                    key === 'partidos' ? (
                      <button
                        type="button"
                        className={`jugadores-comparar-partidos-toggle ${compararPorPartido ? 'jugadores-comparar-partidos-toggle--activo' : ''}`}
                        onClick={() => setCompararPorPartido((v) => !v)}
                        aria-pressed={compararPorPartido}
                        title={
                          compararPorPartido
                            ? 'Mostrar totales (clic)'
                            : 'Mostrar victorias, derrotas, empates y goles por partido (clic)'
                        }
                      >
                        {labelCentro}
                      </button>
                    ) : (
                      labelCentro
                    )
                  return (
                    <div key={key} className="jugadores-comparar-row jugadores-comparar-row--metrica">
                      <div className="jugadores-comparar-celda jugadores-comparar-celda--valor jugadores-comparar-celda--izq">
                        <span className="jugadores-comparar-valor-line jugadores-comparar-valor-line--izq">
                          {marcadorIzq && (
                            <span className={classMarcador} title={titleMarcador}>
                              {marcadorIzq}
                            </span>
                          )}
                          <span className="jugadores-comparar-valor-num">
                            {textoMetricaComparar(key, va, valorEsRatio)}
                          </span>
                        </span>
                      </div>
                      <div className="jugadores-comparar-celda jugadores-comparar-celda--etiqueta">
                        {etiquetaCentral}
                      </div>
                      <div className="jugadores-comparar-celda jugadores-comparar-celda--valor jugadores-comparar-celda--der">
                        <span className="jugadores-comparar-valor-line jugadores-comparar-valor-line--der">
                          <span className="jugadores-comparar-valor-num">
                            {textoMetricaComparar(key, vb, valorEsRatio)}
                          </span>
                          {marcadorDer && (
                            <span className={classMarcador} title={titleMarcador}>
                              {marcadorDer}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {jugadorCompararA && jugadorCompararB && (
                <JugadorEloComparacionChart
                  valuesA={serieEloParaGrafico(jugadorCompararA, {
                    jugadorId: jugadorCompararA.id,
                    partidosNormalized,
                  })}
                  valuesB={serieEloParaGrafico(jugadorCompararB, {
                    jugadorId: jugadorCompararB.id,
                    partidosNormalized,
                  })}
                  etiquetaA={jugadorCompararA.apodo || jugadorCompararA.nombre}
                  etiquetaB={jugadorCompararB.apodo || jugadorCompararB.nombre}
                  jugadorIdA={jugadorCompararA.id}
                  jugadorIdB={jugadorCompararB.id}
                  partidosNormalized={partidosNormalized}
                />
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Vista desktop: grilla de tarjetas */}
          <div className="jugadores-grid">
            {jugadoresFiltradosYOrdenados.map((jugador) => (
              <div key={jugador.id} className="jugador-card">
                <div className="jugador-header">
                  <div className="jugador-titulo">
                    <h3 className="jugador-apodo">{jugador.apodo || jugador.nombre}</h3>
                    {jugador.apodo && <span className="jugador-nombre">{jugador.nombre}</span>}
                  </div>
                  <span className="jugador-posicion">{jugador.posicion}</span>
                </div>
                <div className="jugador-stats">
                  {ordenPor === 'presentes' && ultimosPartidosVentana > 0 && (
                    <div className={statDesktopClass('ultimos')}>
                      <span className="stat-label">
                        Últimos {ultimosPartidosVentana} partidos
                      </span>
                      <span className="stat-value stat-value--sub">
                        {presenciasUltimosMap.get(jugador.id) ?? 0} de {ultimosPartidosVentana}
                      </span>
                    </div>
                  )}
                  <div className={statDesktopClass('partidos')}>
                    <span className="stat-label">Partidos:</span>
                    <span className="stat-value">{jugador.partidos}</span>
                  </div>
                  <div className={statDesktopClass('victorias')}>
                    <span className="stat-label">Victorias:</span>
                    <span className="stat-value stat-success">{jugador.victorias}</span>
                  </div>
                  <div className={statDesktopClass('goles')}>
                    <span className="stat-label">Goles:</span>
                    <span className="stat-value stat-goals">{jugador.goles}</span>
                  </div>
                  <div className={statDesktopClass('elo')}>
                    <button
                      type="button"
                      className="jugador-elo-trigger"
                      onClick={() => toggleEloGrafico(jugador.id)}
                      aria-expanded={eloGraficoJugadorId === jugador.id}
                      aria-controls={`jugador-elo-chart-${jugador.id}`}
                    >
                      <span className="stat-label jugador-elo-label-with-icon">
                        <span>Elo:</span>
                        <IconoEloGrafico />
                      </span>
                      <span className="stat-value">{jugador.elo ?? 900}</span>
                    </button>
                  </div>
                  {eloGraficoJugadorId === jugador.id && (
                    <div
                      className="jugador-elo-chart-slot"
                      id={`jugador-elo-chart-${jugador.id}`}
                    >
                      <JugadorEloChart
                        values={serieEloParaGrafico(jugador, {
                          jugadorId: jugador.id,
                          partidosNormalized,
                        })}
                        jugadorId={jugador.id}
                        partidosNormalized={partidosNormalized}
                      />
                    </div>
                  )}
                  <div className={statDesktopClass('mvp')}>
                    <span className="stat-label">MVP:</span>
                    <span className="stat-value stat-mvp">{jugador.mvp ?? 0}</span>
                  </div>
                  {ORDEN_PROMEDIO_KEYS.has(ordenPor) && (
                    <div className={statDesktopClass(ordenPor)}>
                      <span className="stat-label">{RATIO_DESKTOP_LABEL[ordenPor]}</span>
                      <span className="stat-value stat-value--ratio">
                        {formatMovilDosDecimales(ratioPorPartido(jugador, ordenPor))}
                      </span>
                    </div>
                  )}
                </div>
                {(typeof jugador.años === 'number' && jugador.años > 0) || jugador.descripcion ? (
                  <div className="jugador-descripcion">
                    {typeof jugador.años === 'number' && jugador.años > 0 && (
                      <p className="jugador-edad">Edad: {jugador.años}</p>
                    )}
                    {jugador.descripcion && <p>{jugador.descripcion}</p>}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Vista móvil: listado compacto expandible */}
          <div className="jugadores-list-mobile">
            {jugadoresFiltradosYOrdenados.map((jugador) => (
              <div
                key={jugador.id}
                className={`jugador-list-item ${expandidoId === jugador.id ? 'expandido' : ''}`}
              >
                <div
                  className={ordenPor === 'ranking' ? 'jugador-list-item-header-row' : undefined}
                >
                  <button
                    type="button"
                    className={
                      ordenPor === 'ranking'
                        ? 'jugador-list-item-header jugador-list-item-header--split'
                        : 'jugador-list-item-header'
                    }
                    onClick={() => setExpandidoId((id) => (id === jugador.id ? null : jugador.id))}
                    aria-expanded={expandidoId === jugador.id}
                  >
                    <span className="jugador-list-apodo">{jugador.apodo || jugador.nombre}</span>
                    {ordenPor !== 'ranking' && (
                      <span
                        className={
                          ordenPor === 'goles'
                            ? 'jugador-list-partidos jugador-list-metric--goles'
                            : ordenPor === 'presentes' && ultimosPartidosVentana > 0
                              ? 'jugador-list-partidos jugador-list-metric--presencias'
                              : ORDEN_PROMEDIO_KEYS.has(ordenPor)
                                ? 'jugador-list-partidos jugador-list-metric--promedio'
                                : 'jugador-list-partidos'
                        }
                      >
                        {ordenPor === 'goles' ? (
                          <>
                            <span className="jugador-list-goles-num">{jugador.goles ?? 0}</span>
                            <span className="jugador-list-goles-lbl"> {jugador.goles === 1 ? 'gol' : 'goles'}</span>
                          </>
                        ) : ordenPor === 'presentes' && ultimosPartidosVentana > 0 ? (
                          <>
                            <span className="jugador-list-presencias-num">{presenciasUltimosMap.get(jugador.id) ?? 0}</span>
                            <span className="jugador-list-presencias-lbl"> de {ultimosPartidosVentana} partidos</span>
                          </>
                        ) : ORDEN_PROMEDIO_KEYS.has(ordenPor) ? (
                          <>
                            <span className="jugador-list-prom-num">
                              {formatMovilDosDecimales(ratioPorPartido(jugador, ordenPor))}
                            </span>
                            <span className="jugador-list-prom-lbl">{PROMEDIO_MOVIL_LABEL[ordenPor]}</span>
                          </>
                        ) : (
                          `${jugador.partidos} partidos`
                        )}
                      </span>
                    )}
                    <span className="jugador-list-chevron" aria-hidden>›</span>
                  </button>
                  {ordenPor === 'ranking' && (
                    <button
                      type="button"
                      className="jugador-list-header-elo-btn jugador-list-metric--elo"
                      onClick={() => toggleEloGrafico(jugador.id)}
                      aria-expanded={eloGraficoJugadorId === jugador.id}
                      aria-controls={`jugador-elo-chart-m-${jugador.id}`}
                    >
                      <span className="jugador-list-elo-num">{jugador.elo ?? 900}</span>
                      <span className="jugador-list-elo-lbl"> Elo</span>
                      <IconoEloGrafico />
                    </button>
                  )}
                </div>
                {eloGraficoJugadorId === jugador.id && (
                  <div
                    className="jugador-list-elo-chart-outer"
                    id={`jugador-elo-chart-m-${jugador.id}`}
                  >
                    <JugadorEloChart
                      values={serieEloParaGrafico(jugador, {
                        jugadorId: jugador.id,
                        partidosNormalized,
                      })}
                      jugadorId={jugador.id}
                      partidosNormalized={partidosNormalized}
                    />
                  </div>
                )}
                {expandidoId === jugador.id && (
                  <div className="jugador-list-item-detail">
                    {jugador.apodo && <p className="jugador-list-nombre">{jugador.nombre}</p>}
                    <span className="jugador-posicion">{jugador.posicion}</span>
                    <div className="jugador-list-stats">
                      <p><strong>Partidos:</strong> {jugador.partidos}</p>
                      <p><strong>Victorias:</strong> {jugador.victorias}</p>
                      <p><strong>Goles:</strong> {jugador.goles}</p>
                      <p className="jugador-list-stat-elo-wrap">
                        <button
                          type="button"
                          className="jugador-list-stat-elo-btn"
                          onClick={() => toggleEloGrafico(jugador.id)}
                          aria-expanded={eloGraficoJugadorId === jugador.id}
                          aria-controls={`jugador-elo-chart-m-${jugador.id}`}
                        >
                          <strong>Elo:</strong> {jugador.elo ?? 900}
                          <IconoEloGrafico />
                        </button>
                      </p>
                      <p><strong>MVP:</strong> {jugador.mvp ?? 0}</p>
                    </div>
                    {(typeof jugador.años === 'number' && jugador.años > 0) || jugador.descripcion ? (
                      <div className="jugador-descripcion">
                        {typeof jugador.años === 'number' && jugador.años > 0 && (
                          <p className="jugador-edad">Edad: {jugador.años}</p>
                        )}
                        {jugador.descripcion && <p>{jugador.descripcion}</p>}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {jugadores.length > 0 &&
        modoVista === 'listado' &&
        jugadoresFiltradosYOrdenados.length === 0 && (
        <p className="empty-state">
          {filtroPosicion && ordenPor === 'ninguno'
            ? 'Ningún jugador en esa posición.'
            : filtroPosicion
              ? 'Ningún jugador en esa posición con los filtros actuales.'
              : ordenPor !== 'ninguno'
                ? 'No hay jugadores con al menos un partido para este orden.'
                : 'Ningún jugador coincide con los filtros.'}
        </p>
      )}
    </div>
  )
}

export default Jugadores
