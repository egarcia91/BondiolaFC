import { useState, useEffect } from 'react'
import { getPartidos } from '../services/firestore'
import './Partidos.css'

function Partidos() {
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPartidos()
      .then((data) => {
        if (!cancelled) setPartidos(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error al cargar partidos')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const formatFecha = (fecha) => {
    const date = new Date(fecha)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const isPartidoFuturo = (fecha, hora) => {
    const ahora = new Date()
    const fechaPartido = new Date(fecha + ' ' + hora)
    return fechaPartido > ahora
  }

  if (loading) {
    return (
      <div className="partidos-container">
        <h2 className="section-title">Partidos</h2>
        <p className="empty-state">Cargando partidos…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="partidos-container">
        <h2 className="section-title">Partidos</h2>
        <p className="empty-state partidos-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="partidos-container">
      <h2 className="section-title">Partidos</h2>
      
      {partidos.length === 0 ? (
        <p className="empty-state">No hay partidos registrados</p>
      ) : (
        <div className="partidos-list">
          {partidos.map((partido) => {
            const esFuturo = isPartidoFuturo(partido.fecha, partido.hora)
            const esEmpate = partido.ganador === 'Empate'
            
            return (
              <div key={partido.id} className={`partido-card ${esFuturo ? 'futuro' : ''}`}>
                <div className="partido-header">
                  <div className="partido-fecha">
                    <span className="fecha-texto">{formatFecha(partido.fecha)}</span>
                    <span className="hora-texto">{partido.hora}</span>
                  </div>
                  <div className="partido-lugar">
                    <span className="lugar-icon">📍</span>
                    <span>{partido.lugar}</span>
                  </div>
                  {esFuturo && <span className="badge-futuro">Próximo</span>}
                </div>

                <div className="partido-resultado">
                  <div className="equipo-info">
                    <div className="equipo-nombre equipo-local">
                      Rojo
                      {!esFuturo && !esEmpate && partido.ganador === partido.equipoLocal?.nombre && (
                        <span className="badge-ganador">🏆</span>
                      )}
                    </div>
                    <div className="equipo-goles">{partido.equipoLocal?.goles ?? 0}</div>
                  </div>

                  <div className="vs-separator">VS</div>

                  <div className="equipo-info">
                    <div className="equipo-nombre equipo-visitante">
                      Azul
                      {!esFuturo && !esEmpate && partido.ganador === partido.equipoVisitante?.nombre && (
                        <span className="badge-ganador">🏆</span>
                      )}
                    </div>
                    <div className="equipo-goles">{partido.equipoVisitante?.goles ?? 0}</div>
                  </div>
                </div>

                {esEmpate && !esFuturo && (
                  <div className="resultado-empate">Empate</div>
                )}

                <div className="partido-jugadores">
                  <div className="jugadores-equipo">
                    <h4 className="jugadores-titulo">Rojo</h4>
                    <ul className="jugadores-lista">
                      {(partido.equipoLocal?.jugadores ?? []).map((jugador, idx) => (
                        <li key={idx}>{jugador}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="jugadores-equipo">
                    <h4 className="jugadores-titulo">Azul</h4>
                    <ul className="jugadores-lista">
                      {(partido.equipoVisitante?.jugadores ?? []).map((jugador, idx) => (
                        <li key={idx}>{jugador}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Partidos
