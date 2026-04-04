import { useState, useEffect, useMemo } from 'react'
import { getJugadores, getPartidos, normalizePartidos } from '../services/firestore'
import NuevoJugadorModal from './NuevoJugadorModal'
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

function Jugadores({ organizacionId, isAdmin }) {
  const [jugadores, setJugadores] = useState([])
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroPosicion, setFiltroPosicion] = useState('')
  const [ordenPor, setOrdenPor] = useState('presentes')
  const [expandidoId, setExpandidoId] = useState(null)
  const [showNuevoJugadorModal, setShowNuevoJugadorModal] = useState(false)

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
        <div className="jugadores-controles">
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
        </div>
      )}
      
      {jugadores.length === 0 ? (
        <p className="empty-state">No hay jugadores registrados</p>
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
                    <span className="stat-label">Elo:</span>
                    <span className="stat-value">{jugador.elo ?? 900}</span>
                  </div>
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
                <button
                  type="button"
                  className="jugador-list-item-header"
                  onClick={() => setExpandidoId((id) => (id === jugador.id ? null : jugador.id))}
                  aria-expanded={expandidoId === jugador.id}
                >
                  <span className="jugador-list-apodo">{jugador.apodo || jugador.nombre}</span>
                  <span
                    className={
                      ordenPor === 'ranking'
                        ? 'jugador-list-partidos jugador-list-metric--elo'
                        : ordenPor === 'goles'
                          ? 'jugador-list-partidos jugador-list-metric--goles'
                          : ordenPor === 'presentes' && ultimosPartidosVentana > 0
                            ? 'jugador-list-partidos jugador-list-metric--presencias'
                            : ORDEN_PROMEDIO_KEYS.has(ordenPor)
                              ? 'jugador-list-partidos jugador-list-metric--promedio'
                              : 'jugador-list-partidos'
                    }
                  >
                    {ordenPor === 'ranking' ? (
                      <>
                        <span className="jugador-list-elo-num">{jugador.elo ?? 900}</span>
                        <span className="jugador-list-elo-lbl"> Elo</span>
                      </>
                    ) : ordenPor === 'goles' ? (
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
                  <span className="jugador-list-chevron" aria-hidden>›</span>
                </button>
                {expandidoId === jugador.id && (
                  <div className="jugador-list-item-detail">
                    {jugador.apodo && <p className="jugador-list-nombre">{jugador.nombre}</p>}
                    <span className="jugador-posicion">{jugador.posicion}</span>
                    <div className="jugador-list-stats">
                      <p><strong>Partidos:</strong> {jugador.partidos}</p>
                      <p><strong>Victorias:</strong> {jugador.victorias}</p>
                      <p><strong>Goles:</strong> {jugador.goles}</p>
                      <p><strong>Elo:</strong> {jugador.elo ?? 900}</p>
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

      {jugadores.length > 0 && jugadoresFiltradosYOrdenados.length === 0 && (
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
