import { useState, useEffect, useMemo } from 'react'
import { getJugadores } from '../services/firestore'
import './Jugadores.css'

const POSICIONES = ['Delantero', 'Defensor', 'Mediocampista', 'Arquero']

function Jugadores() {
  const [jugadores, setJugadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroPosicion, setFiltroPosicion] = useState('')
  const [ordenPor, setOrdenPor] = useState(null) // null | 'partidos' | 'goles' | 'presentes'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getJugadores()
      .then((data) => {
        if (!cancelled) setJugadores(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error al cargar jugadores')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const jugadoresFiltradosYOrdenados = useMemo(() => {
    let lista = [...jugadores]
    if (filtroPosicion) {
      lista = lista.filter((j) => j.posicion === filtroPosicion)
    }
    if (ordenPor === 'partidos') {
      lista.sort((a, b) => b.partidos - a.partidos)
    } else if (ordenPor === 'goles') {
      lista.sort((a, b) => b.goles - a.goles)
    } else if (ordenPor === 'presentes') {
      // Cuando haya partidos: ordenar por cantidad de presencias en los últimos partidos
      // Por ahora sin partidos no se modifica el orden
    }
    return lista
  }, [jugadores, filtroPosicion, ordenPor])

  if (loading) {
    return (
      <div className="jugadores-container">
        <h2 className="section-title">Jugadores</h2>
        <p className="empty-state">Cargando jugadores…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="jugadores-container">
        <h2 className="section-title">Jugadores</h2>
        <p className="empty-state jugadores-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="jugadores-container">
      <h2 className="section-title">Jugadores</h2>

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
            <span className="controles-label">Ordenar por</span>
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
              className={`controles-btn ${ordenPor === 'presentes' ? 'active' : ''}`}
              onClick={() => setOrdenPor(ordenPor === 'presentes' ? null : 'presentes')}
            >
              Últimos partidos
            </button>
          </div>
        </div>
      )}
      
      {jugadores.length === 0 ? (
        <p className="empty-state">No hay jugadores registrados</p>
      ) : (
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
                {typeof jugador.años === 'number' && jugador.años > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Edad:</span>
                    <span className="stat-value">{jugador.años}</span>
                  </div>
                )}
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
              
              {jugador.descripcion && (
                <div className="jugador-descripcion">
                  <p>{jugador.descripcion}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {jugadores.length > 0 && jugadoresFiltradosYOrdenados.length === 0 && (
        <p className="empty-state">Ningún jugador en esa posición</p>
      )}
    </div>
  )
}

export default Jugadores
