import { useState, useEffect, useMemo } from 'react'
import { getPartidos, getJugadores, normalizePartidos } from '../services/firestore'
import NuevoPartidoModal from './NuevoPartidoModal'
import EditarPartidoModal from './EditarPartidoModal'
import './Partidos.css'

function Partidos({ isAdmin }) {
  const [partidos, setPartidos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandidoId, setExpandidoId] = useState(null)
  const [showNuevoPartidoModal, setShowNuevoPartidoModal] = useState(false)
  const [partidoEditando, setPartidoEditando] = useState(null)

  const partidosNormalized = useMemo(
    () => normalizePartidos(partidos, jugadores),
    [partidos, jugadores]
  )

  const jugadoresById = useMemo(
    () => new Map(jugadores.map((j) => [j.id, j])),
    [jugadores]
  )

  const getElo = (entrada) => {
    if (!entrada) return 900
    if (entrada.id) {
      const j = jugadoresById.get(entrada.id)
      return j != null && typeof j.elo === 'number' ? j.elo : 900
    }
    return 900
  }

  const getEloPromedio = (lista) => {
    if (!lista || lista.length === 0) return 0
    const sum = lista.reduce((acc, entrada) => acc + getElo(entrada), 0)
    return Math.round(sum / lista.length)
  }

  const displayJugador = (entrada) => {
    if (!entrada) return 'invitado'
    if (entrada.id) {
      const j = jugadoresById.get(entrada.id)
      return (j && (j.apodo || j.nombre)) || entrada.nombre || 'invitado'
    }
    return entrada.nombre ? `invitado (${entrada.nombre})` : 'invitado'
  }

  const refreshPartidos = () => {
    getPartidos().then(setPartidos).catch(() => {})
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getPartidos(), getJugadores()])
      .then(([partidosData, jugadoresData]) => {
        if (!cancelled) {
          setPartidos(partidosData)
          setJugadores(jugadoresData)
        }
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
        <div className="partidos-header">
          <h2 className="section-title">Partidos</h2>
          {isAdmin && (
            <button type="button" className="partidos-btn-nuevo" onClick={() => setShowNuevoPartidoModal(true)} disabled>
              Nuevo partido
            </button>
          )}
        </div>
        <p className="empty-state">Cargando partidos…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="partidos-container">
        <div className="partidos-header">
          <h2 className="section-title">Partidos</h2>
          {isAdmin && (
            <button type="button" className="partidos-btn-nuevo" onClick={() => setShowNuevoPartidoModal(true)} disabled>
              Nuevo partido
            </button>
          )}
        </div>
        <p className="empty-state partidos-error">{error}</p>
      </div>
    )
  }

  return (
    <div className="partidos-container">
      <div className="partidos-header">
        <h2 className="section-title">Partidos</h2>
        {isAdmin && (
          <button type="button" className="partidos-btn-nuevo" onClick={() => setShowNuevoPartidoModal(true)}>
            Nuevo partido
          </button>
        )}
      </div>

      {showNuevoPartidoModal && (
        <NuevoPartidoModal
          onClose={() => setShowNuevoPartidoModal(false)}
          onPartidoCreado={refreshPartidos}
        />
      )}

      {partidoEditando && (
        <EditarPartidoModal
          partido={partidoEditando}
          jugadores={jugadores}
          onClose={() => setPartidoEditando(null)}
          onSaved={refreshPartidos}
        />
      )}
      
      {partidosNormalized.length === 0 ? (
        <p className="empty-state">No hay partidos registrados</p>
      ) : (
        <>
          {/* Vista desktop: tarjetas completas */}
          <div className="partidos-list partidos-list-desktop">
            {partidosNormalized.map((partido) => {
              const esFuturo = isPartidoFuturo(partido.fecha, partido.hora)
              const concluido = partido.concluido === true
              const aunNoOcurrio = !concluido && (partido.concluido === false || esFuturo)
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

                  {aunNoOcurrio ? (
                    <div className="partido-resultado partido-resultado-futuro">
                      <span className="partido-aun-no">Aún no ocurrió</span>
                      <div className="partido-elo-promedio-futuro">
                        <span>Elo prom. Rojo: {getEloPromedio(partido.equipoLocal?.jugadores)}</span>
                        <span>Elo prom. Azul: {getEloPromedio(partido.equipoVisitante?.jugadores)}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="partido-resultado">
                        <div className="equipo-info">
                          <div className="equipo-nombre equipo-local">
                            Rojo
                            {!esEmpate && partido.ganador === partido.equipoLocal?.nombre && (
                              <span className="badge-ganador">🏆</span>
                            )}
                          </div>
                          <div className="equipo-goles">{partido.equipoLocal?.goles ?? 0}</div>
                          <div className="equipo-elo-promedio">Elo prom. {getEloPromedio(partido.equipoLocal?.jugadores)}</div>
                        </div>

                        <div className="vs-separator">VS</div>

                        <div className="equipo-info">
                          <div className="equipo-nombre equipo-visitante">
                            Azul
                            {!esEmpate && partido.ganador === partido.equipoVisitante?.nombre && (
                              <span className="badge-ganador">🏆</span>
                            )}
                          </div>
                          <div className="equipo-goles">{partido.equipoVisitante?.goles ?? 0}</div>
                          <div className="equipo-elo-promedio">Elo prom. {getEloPromedio(partido.equipoVisitante?.jugadores)}</div>
                        </div>
                      </div>

                      {esEmpate && (
                        <div className="resultado-empate">Empate</div>
                      )}
                    </>
                  )}

                  <div className="partido-jugadores">
                    <div className="jugadores-equipo">
                      <h4 className="jugadores-titulo">Rojo</h4>
                      <ul className="jugadores-lista">
                        {(partido.equipoLocal?.jugadores ?? []).map((jugador, idx) => {
                          const delta = partido.equipoLocal?.eloDeltas?.[idx]
                          return (
                            <li key={idx}>
                              {displayJugador(jugador)}
                              <span className="partido-jugador-elo-wrap">
                                <span className="partido-jugador-elo">{getElo(jugador)}</span>
                                {delta != null && delta !== 0 && (
                                  <span className={`partido-elo-delta ${delta > 0 ? 'partido-elo-delta-positivo' : 'partido-elo-delta-negativo'}`}>
                                    {delta > 0 ? `+${delta}` : delta}
                                  </span>
                                )}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    <div className="jugadores-equipo">
                      <h4 className="jugadores-titulo">Azul</h4>
                      <ul className="jugadores-lista">
                        {(partido.equipoVisitante?.jugadores ?? []).map((jugador, idx) => {
                          const delta = partido.equipoVisitante?.eloDeltas?.[idx]
                          return (
                            <li key={idx}>
                              {displayJugador(jugador)}
                              <span className="partido-jugador-elo-wrap">
                                <span className="partido-jugador-elo">{getElo(jugador)}</span>
                                {delta != null && delta !== 0 && (
                                  <span className={`partido-elo-delta ${delta > 0 ? 'partido-elo-delta-positivo' : 'partido-elo-delta-negativo'}`}>
                                    {delta > 0 ? `+${delta}` : delta}
                                  </span>
                                )}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="partido-card-actions">
                      <button
                        type="button"
                        className="partido-btn-editar"
                        onClick={() => setPartidoEditando(partido)}
                      >
                        Editar resultado
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Vista móvil: listado compacto expandible */}
          <div className="partidos-list-mobile">
            {partidosNormalized.map((partido) => {
              const esFuturo = isPartidoFuturo(partido.fecha, partido.hora)
              const concluido = partido.concluido === true
              const aunNoOcurrio = !concluido && (partido.concluido === false || esFuturo)
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
                    <span className="partido-list-resultado">
                      {aunNoOcurrio ? 'Aún no ocurrió' : resultadoTexto(partido)}
                    </span>
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

                      {aunNoOcurrio ? (
                        <div className="partido-detail-resultado partido-resultado-futuro">
                          <span className="partido-aun-no">Aún no ocurrió</span>
                          <div className="partido-elo-promedio-futuro">
                            <span>Elo prom. Rojo: {getEloPromedio(partido.equipoLocal?.jugadores)}</span>
                            <span>Elo prom. Azul: {getEloPromedio(partido.equipoVisitante?.jugadores)}</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="partido-detail-resultado">
                            <div className="partido-detail-equipo">
                              <span className="partido-detail-equipo-nombre">Rojo</span>
                              <span className="partido-detail-goles">{partido.equipoLocal?.goles ?? 0}</span>
                              <span className="partido-detail-elo-prom">Elo prom. {getEloPromedio(partido.equipoLocal?.jugadores)}</span>
                            </div>
                            <div className="partido-detail-vs">VS</div>
                            <div className="partido-detail-equipo">
                              <span className="partido-detail-equipo-nombre">Azul</span>
                              <span className="partido-detail-goles">{partido.equipoVisitante?.goles ?? 0}</span>
                              <span className="partido-detail-elo-prom">Elo prom. {getEloPromedio(partido.equipoVisitante?.jugadores)}</span>
                            </div>
                          </div>
                          {esEmpate && (
                            <div className="resultado-empate partido-detail-empate">Empate</div>
                          )}
                        </>
                      )}

                      <div className="partido-detail-jugadores">
                        <ul className="jugadores-lista">
                          {(partido.equipoLocal?.jugadores ?? []).map((jugador, idx) => {
                            const delta = partido.equipoLocal?.eloDeltas?.[idx]
                            return (
                              <li key={idx}>
                                {displayJugador(jugador)}
                                <span className="partido-jugador-elo-wrap">
                                  <span className="partido-jugador-elo">{getElo(jugador)}</span>
                                  {delta != null && delta !== 0 && (
                                    <span className={`partido-elo-delta ${delta > 0 ? 'partido-elo-delta-positivo' : 'partido-elo-delta-negativo'}`}>
                                      {delta > 0 ? `+${delta}` : delta}
                                    </span>
                                  )}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                        <ul className="jugadores-lista">
                          {(partido.equipoVisitante?.jugadores ?? []).map((jugador, idx) => {
                            const delta = partido.equipoVisitante?.eloDeltas?.[idx]
                            return (
                              <li key={idx}>
                                {displayJugador(jugador)}
                                <span className="partido-jugador-elo-wrap">
                                  <span className="partido-jugador-elo">{getElo(jugador)}</span>
                                  {delta != null && delta !== 0 && (
                                    <span className={`partido-elo-delta ${delta > 0 ? 'partido-elo-delta-positivo' : 'partido-elo-delta-negativo'}`}>
                                      {delta > 0 ? `+${delta}` : delta}
                                    </span>
                                  )}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          className="partido-btn-editar partido-btn-editar-mobile"
                          onClick={() => setPartidoEditando(partido)}
                        >
                          Editar resultado
                        </button>
                      )}
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
