import { useState, useEffect } from 'react'
import { getPartidos } from '../services/firestore'
import './Partidos.css'

function Partidos() {
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandidoId, setExpandidoId] = useState(null)

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

  // Parsea YYYY-MM-DD como fecha local (evita desfase por UTC)
  const parseFechaLocal = (fechaStr, horaStr = '00:00') => {
    if (!fechaStr) return null
    const [y, m, d] = fechaStr.split('-').map(Number)
    if (!y || !m || !d) return null
    const [h = 0, min = 0] = (horaStr || '00:00').toString().split(':').map(Number)
    return new Date(y, m - 1, d, h, min)
  }

  const formatFecha = (fecha) => {
    const date = parseFechaLocal(fecha)
    if (!date || Number.isNaN(date.getTime())) return fecha
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatFechaShort = (fecha) => {
    const date = parseFechaLocal(fecha)
    if (!date || Number.isNaN(date.getTime())) return fecha
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    })
  }

  const resultadoTexto = (partido) => {
    const golesLocal = partido.equipoLocal?.goles ?? 0
    const golesVisitante = partido.equipoVisitante?.goles ?? 0
    return `Rojo ${golesLocal} - ${golesVisitante} Azul`
  }

  const isPartidoFuturo = (fecha, hora) => {
    const ahora = new Date()
    const fechaPartido = parseFechaLocal(fecha, hora)
    return fechaPartido ? fechaPartido > ahora : false
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
        <>
          {/* Vista desktop: tarjetas completas */}
          <div className="partidos-list partidos-list-desktop">
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

          {/* Vista móvil: listado compacto expandible */}
          <div className="partidos-list-mobile">
            {partidos.map((partido) => {
              const esFuturo = isPartidoFuturo(partido.fecha, partido.hora)
              const esEmpate = partido.ganador === 'Empate'
              const expandido = expandidoId === partido.id

              return (
                <div
                  key={partido.id}
                  className={`partido-list-item ${expandido ? 'expandido' : ''}`}
                >
                  <button
                    type="button"
                    className="partido-list-item-header"
                    onClick={() => setExpandidoId((id) => (id === partido.id ? null : partido.id))}
                    aria-expanded={expandido}
                  >
                    <span className="partido-list-fecha">{formatFechaShort(partido.fecha)}</span>
                    <span className="partido-list-resultado">{resultadoTexto(partido)}</span>
                    <span className="partido-list-chevron" aria-hidden>›</span>
                  </button>
                  {expandido && (
                    <div className="partido-list-item-detail">
                      <button
                        type="button"
                        className="partido-detail-cerrar"
                        onClick={() => setExpandidoId(null)}
                        aria-label="Cerrar"
                      >
                        ↑ Cerrar
                      </button>
                      <div className="partido-detail-meta">
                        <span className="fecha-texto">{formatFecha(partido.fecha)}</span>
                        <span className="hora-texto">{partido.hora}</span>
                        <span className="partido-lugar">
                          <span className="lugar-icon" aria-hidden>📍</span>
                          {partido.lugar}
                        </span>
                        {esFuturo && <span className="badge-futuro">Próximo</span>}
                      </div>

                      <div className="partido-detail-resultado">
                        <div className="partido-detail-equipo">
                          <span className="partido-detail-equipo-nombre">Rojo</span>
                          <span className="partido-detail-goles">{partido.equipoLocal?.goles ?? 0}</span>
                        </div>
                        <div className="partido-detail-vs">VS</div>
                        <div className="partido-detail-equipo">
                          <span className="partido-detail-equipo-nombre">Azul</span>
                          <span className="partido-detail-goles">{partido.equipoVisitante?.goles ?? 0}</span>
                        </div>
                      </div>

                      {esEmpate && !esFuturo && (
                        <div className="resultado-empate partido-detail-empate">Empate</div>
                      )}

                      <div className="partido-detail-jugadores">
                        <ul className="jugadores-lista">
                          {(partido.equipoLocal?.jugadores ?? []).map((jugador, idx) => (
                            <li key={idx}>{jugador}</li>
                          ))}
                        </ul>
                        <ul className="jugadores-lista">
                          {(partido.equipoVisitante?.jugadores ?? []).map((jugador, idx) => (
                            <li key={idx}>{jugador}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default Partidos
