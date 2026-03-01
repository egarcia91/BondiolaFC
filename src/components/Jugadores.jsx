import { useState, useEffect, useMemo } from 'react'
import { getJugadores, getPartidos, normalizePartidos } from '../services/firestore'
import NuevoJugadorModal from './NuevoJugadorModal'
import './Jugadores.css'

const POSICIONES = ['Delantero', 'Defensor', 'Mediocampista', 'Arquero']

function Jugadores({ isAdmin }) {
  const [jugadores, setJugadores] = useState([])
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroPosicion, setFiltroPosicion] = useState('')
  const [ordenPor, setOrdenPor] = useState('presentes') // 'presentes' por defecto
  const [expandidoId, setExpandidoId] = useState(null)
  const [showNuevoJugadorModal, setShowNuevoJugadorModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getJugadores(), getPartidos()])
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
  }, [])

  const partidosNormalized = useMemo(
    () => normalizePartidos(partidos, jugadores),
    [partidos, jugadores]
  )

  const jugadoresFiltradosYOrdenados = useMemo(() => {
    let lista = [...jugadores]
    if (filtroPosicion) {
      lista = lista.filter((j) => j.posicion === filtroPosicion)
    }
    if (ordenPor === 'partidos') {
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
    }
    return lista
  }, [jugadores, partidosNormalized, filtroPosicion, ordenPor])

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
            onClose={() => setShowNuevoJugadorModal(false)}
            onSaved={() => { setShowNuevoJugadorModal(false); getJugadores().then(setJugadores).catch(() => {}) }}
          />
        )}
      </div>
    )
  }

  const refreshJugadores = () => {
    getJugadores().then(setJugadores).catch(() => {})
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
            <span className="controles-label controles-label-buttons">Ordenar por</span>
            <div className="controles-orden-buttons">
              <button
                type="button"
                className={`controles-btn ${ordenPor === 'partidos' ? 'active' : ''}`}
                onClick={() => setOrdenPor(ordenPor === 'partidos' ? null : 'partidos')}
              >
                Más partidos
              </button>
              <button
                type="button"
                className={`controles-btn ${ordenPor === 'goles' ? 'active' : ''}`}
                onClick={() => setOrdenPor(ordenPor === 'goles' ? null : 'goles')}
              >
                Más goles
              </button>
              <button
                type="button"
                className={`controles-btn ${ordenPor === 'ranking' ? 'active' : ''}`}
                onClick={() => setOrdenPor(ordenPor === 'ranking' ? null : 'ranking')}
              >
                Ranking
              </button>
              <button
                type="button"
                className={`controles-btn ${ordenPor === 'presentes' ? 'active' : ''}`}
                onClick={() => setOrdenPor(ordenPor === 'presentes' ? null : 'presentes')}
              >
                Últimos partidos
              </button>
            </div>
            <label htmlFor="filtro-orden" className="controles-label controles-label-select">
              Ordenar por
            </label>
            <select
              id="filtro-orden"
              value={ordenPor || ''}
              onChange={(e) => setOrdenPor(e.target.value || null)}
              className="controles-select controles-orden-select"
            >
              <option value="">—</option>
              <option value="partidos">Más partidos</option>
              <option value="goles">Más goles</option>
              <option value="ranking">Ranking</option>
              <option value="presentes">Últimos partidos</option>
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
                  <div className="stat-item">
                    <span className="stat-label">Partidos:</span>
                    <span className="stat-value">{jugador.partidos}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Victorias:</span>
                    <span className="stat-value stat-success">{jugador.victorias}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Goles:</span>
                    <span className="stat-value stat-goals">{jugador.goles}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Elo:</span>
                    <span className="stat-value">{jugador.elo ?? 900}</span>
                  </div>
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
                  <span className="jugador-list-partidos">{jugador.partidos} partidos</span>
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
        <p className="empty-state">Ningún jugador en esa posición</p>
      )}
    </div>
  )
}

export default Jugadores
