import { useState, useEffect, useMemo } from 'react'
import { getPartidos, getJugadores, normalizePartidos, darDeBajaPartido, votarMvp } from '../services/firestore'
import NuevoPartidoModal from './NuevoPartidoModal'
import EditarPartidoModal from './EditarPartidoModal'
import EditarPartidoEquiposModal from './EditarPartidoEquiposModal'
import PartidoEnVivo from './PartidoEnVivo'
import './Partidos.css'

function getParticipantesIds(partido) {
  const local = (partido.equipoLocal?.jugadores ?? []).map((e) => e?.id).filter(Boolean)
  const visitante = (partido.equipoVisitante?.jugadores ?? []).map((e) => e?.id).filter(Boolean)
  return [...new Set([...local, ...visitante])]
}

function PartidoMvpBlock({
  partido,
  jugadoresById,
  jugadorActual,
  displayJugador,
  mvpVotandoPartidoId,
  mvpSeleccionadoId,
  setMvpVotandoPartidoId,
  setMvpSeleccionadoId,
  onVotar,
  enviando,
}) {
  const participantes = getParticipantesIds(partido)
  const mvpVotos = partido.mvpVotos ?? []
  const mvpResultado = partido.mvpResultado ?? []
  const aplicado = partido.mvpEstadisticasAplicadas === true
  const yaVoto = mvpVotos.some((v) => v.votanteId === jugadorActual?.id)
  const puedeVotar = jugadorActual?.id && jugadorActual?.admin === true && !aplicado
  const votadoActual = mvpVotos.find((v) => v.votanteId === jugadorActual?.id)?.votadoId ?? ''
  const seleccionActual = mvpVotandoPartidoId === partido.id ? mvpSeleccionadoId : votadoActual

  return (
    <div className="partido-mvp">
      <h4 className="partido-mvp-titulo">MVP del partido</h4>
      {aplicado && mvpResultado.length > 0 && (
        <p className="partido-mvp-ganadores">
          {mvpResultado
            .map(({ jugadorId, mvpSumado }) => {
              const j = jugadoresById.get(jugadorId)
              const nombre = j ? (j.apodo || j.nombre) : jugadorId
              const valor = mvpSumado === 1 ? '1' : mvpSumado.toFixed(2)
              return `${nombre} (${valor})`
            })
            .join(', ')}
        </p>
      )}
      {mvpVotos.length > 0 && (
        <ul className="partido-mvp-votos" aria-label="Votos visibles">
          {mvpVotos.map((v, idx) => {
            const votante = jugadoresById.get(v.votanteId)
            const votado = jugadoresById.get(v.votadoId)
            const nomVotante = votante ? (votante.apodo || votante.nombre) : v.votanteId
            const nomVotado = votado ? (votado.apodo || votado.nombre) : v.votadoId
            return (
              <li key={idx} className="partido-mvp-voto-item">
                {nomVotante} votó por {nomVotado}
              </li>
            )
          })}
        </ul>
      )}
      {puedeVotar && (
        <div className="partido-mvp-votar">
          <label htmlFor={`mvp-select-${partido.id}`} className="partido-mvp-label">
            {yaVoto ? 'Cambiar MVP:' : 'Elegir MVP:'}
          </label>
          <select
            id={`mvp-select-${partido.id}`}
            className="partido-mvp-select"
            value={seleccionActual}
            onChange={(e) => {
              setMvpVotandoPartidoId(partido.id)
              setMvpSeleccionadoId(e.target.value)
            }}
            disabled={enviando}
          >
            <option value="">—</option>
            {participantes.map((id) => (
              <option key={id} value={id}>
                {displayJugador({ id })}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="partido-mvp-btn"
            disabled={!seleccionActual || enviando}
            onClick={() => seleccionActual && onVotar(seleccionActual)}
          >
            {enviando ? 'Enviando…' : yaVoto ? 'Cambiar voto' : 'Votar'}
          </button>
        </div>
      )}
    </div>
  )
}

function Partidos({ organizacionId, isAdmin, isAuthenticated, jugadorActual }) {
  const [partidos, setPartidos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandidoId, setExpandidoId] = useState(null)
  const [showNuevoPartidoModal, setShowNuevoPartidoModal] = useState(false)
  const [partidoEditando, setPartidoEditando] = useState(null)
  const [partidoEditandoEquipos, setPartidoEditandoEquipos] = useState(null)
  const [bajandoPartidoId, setBajandoPartidoId] = useState(null)
  const [partidoEnVivo, setPartidoEnVivo] = useState(null)
  const [mvpVotandoPartidoId, setMvpVotandoPartidoId] = useState(null)
  const [mvpSeleccionadoId, setMvpSeleccionadoId] = useState('')
  const [mvpEnviandoPartidoId, setMvpEnviandoPartidoId] = useState(null)

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

  /** Cantidad de goles de un jugador en un partido (por equipo). */
  const getGolesEnPartido = (partido, equipoKey, entrada) => {
    const arr = partido?.[equipoKey]?.golesAnotadores ?? []
    if (!entrada) return 0
    if (entrada.id) {
      return arr.filter((id) => id === entrada.id).length
    }
    if (entrada.nombre) {
      return arr.filter((val) => val === `guest:${entrada.nombre}`).length
    }
    return 0
  }

  const GolesIcon = ({ count }) => {
    if (!count || count < 1) return null
    return (
      <span className="partido-jugador-goles" title={`${count} gol${count > 1 ? 'es' : ''}`} aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="partido-gol-icon" aria-hidden>⚽</span>
        ))}
      </span>
    )
  }

  const refreshPartidos = () => {
    if (organizacionId) getPartidos(organizacionId).then(setPartidos).catch(() => {})
  }

  const handleDarDeBaja = async (partido) => {
    const mensaje = '¿Dar de baja este partido? Se eliminará y se restarán partido, victoria/empate/derrota, goles y Elo a los jugadores que participaron.'
    if (!window.confirm(mensaje)) return
    setBajandoPartidoId(partido.id)
    try {
      const jugadoresActuales = await getJugadores(organizacionId)
      await darDeBajaPartido(partido, jugadoresActuales)
      if (organizacionId) {
        await getPartidos(organizacionId).then(setPartidos)
        await getJugadores(organizacionId).then(setJugadores)
      }
    } catch (err) {
      console.error(err)
      alert(err.message || 'Error al dar de baja el partido')
    } finally {
      setBajandoPartidoId(null)
    }
  }

  useEffect(() => {
    if (!organizacionId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getPartidos(organizacionId), getJugadores(organizacionId)])
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
  }, [organizacionId])

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
          organizacionId={organizacionId}
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

      {partidoEditandoEquipos && (
        <EditarPartidoEquiposModal
          partido={partidoEditandoEquipos}
          jugadores={jugadores}
          onClose={() => setPartidoEditandoEquipos(null)}
          onSaved={refreshPartidos}
        />
      )}

      {partidoEnVivo ? (
        <PartidoEnVivo
          partido={partidoEnVivo}
          jugadores={jugadores}
          onTerminar={() => {
            setPartidoEnVivo(null)
            refreshPartidos()
            getJugadores(organizacionId).then(setJugadores).catch(() => {})
          }}
          onVolver={() => setPartidoEnVivo(null)}
        />
      ) : partidosNormalized.length === 0 ? (
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
                    <>
                      <div className="partido-resultado partido-resultado-futuro">
                        <span className="partido-aun-no">Aún no ocurrió</span>
                        <div className="partido-elo-promedio-futuro">
                          <span>Elo prom. Rojo: {getEloPromedio(partido.equipoLocal?.jugadores)}</span>
                          <span>Elo prom. Azul: {getEloPromedio(partido.equipoVisitante?.jugadores)}</span>
                        </div>
                      </div>
                      <div className="partido-card-actions">
                        {isAuthenticated && (
                          <button
                            type="button"
                            className="partido-btn-en-vivo"
                            onClick={() => setPartidoEnVivo(partido)}
                          >
                            Partido en vivo
                          </button>
                        )}
                      </div>
                    </>
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
                          const goles = getGolesEnPartido(partido, 'equipoLocal', jugador)
                          const esMvp = partido.mvpResultado?.some((r) => r.jugadorId === jugador?.id)
                          return (
                            <li key={idx}>
                              {displayJugador(jugador)}
                              {esMvp && <span className="partido-jugador-mvp" title="MVP del partido" aria-hidden>🏆</span>}
                              <GolesIcon count={goles} />
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
                          const goles = getGolesEnPartido(partido, 'equipoVisitante', jugador)
                          const esMvp = partido.mvpResultado?.some((r) => r.jugadorId === jugador?.id)
                          return (
                            <li key={idx}>
                              {displayJugador(jugador)}
                              {esMvp && <span className="partido-jugador-mvp" title="MVP del partido" aria-hidden>🏆</span>}
                              <GolesIcon count={goles} />
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
                        onClick={() => setPartidoEditandoEquipos(partido)}
                      >
                        Editar equipos
                      </button>
                      <button
                        type="button"
                        className="partido-btn-editar"
                        onClick={() => setPartidoEditando(partido)}
                      >
                        Editar resultado
                      </button>
                      <button
                        type="button"
                        className="partido-btn-editar partido-btn-baja"
                        onClick={() => handleDarDeBaja(partido)}
                        disabled={bajandoPartidoId === partido.id}
                      >
                        {bajandoPartidoId === partido.id ? 'Dando de baja…' : 'Dar de baja'}
                      </button>
                    </div>
                  )}
                  {concluido && (
                    <PartidoMvpBlock
                      partido={partido}
                      jugadoresById={jugadoresById}
                      jugadorActual={jugadorActual}
                      displayJugador={displayJugador}
                      mvpVotandoPartidoId={mvpVotandoPartidoId}
                      mvpSeleccionadoId={mvpSeleccionadoId}
                      setMvpVotandoPartidoId={setMvpVotandoPartidoId}
                      setMvpSeleccionadoId={setMvpSeleccionadoId}
                      onVotar={async (votadoId) => {
                        if (!jugadorActual?.id) return
                        setMvpEnviandoPartidoId(partido.id)
                        try {
                          await votarMvp(partido.id, jugadorActual.id, votadoId)
                          refreshPartidos()
                          getJugadores(organizacionId).then(setJugadores).catch(() => {})
                        } catch (e) {
                          alert(e.message || 'Error al votar')
                        } finally {
                          setMvpEnviandoPartidoId(null)
                          setMvpSeleccionadoId('')
                        }
                      }}
                      enviando={mvpEnviandoPartidoId === partido.id}
                    />
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
                        <>
                          <div className="partido-detail-resultado partido-resultado-futuro">
                            <span className="partido-aun-no">Aún no ocurrió</span>
                            <div className="partido-elo-promedio-futuro">
                              <span>Elo prom. Rojo: {getEloPromedio(partido.equipoLocal?.jugadores)}</span>
                              <span>Elo prom. Azul: {getEloPromedio(partido.equipoVisitante?.jugadores)}</span>
                            </div>
                          </div>
                          <div className="partido-detail-actions">
                            {isAuthenticated && (
                              <button
                                type="button"
                                className="partido-btn-en-vivo partido-btn-editar-mobile"
                                onClick={() => setPartidoEnVivo(partido)}
                              >
                                Partido en vivo
                              </button>
                            )}
                          </div>
                        </>
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
                            const goles = getGolesEnPartido(partido, 'equipoLocal', jugador)
                            const esMvp = partido.mvpResultado?.some((r) => r.jugadorId === jugador?.id)
                            return (
                              <li key={idx}>
                                {displayJugador(jugador)}
                                {esMvp && <span className="partido-jugador-mvp" title="MVP del partido" aria-hidden>🏆</span>}
                                <GolesIcon count={goles} />
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
                            const goles = getGolesEnPartido(partido, 'equipoVisitante', jugador)
                            const esMvp = partido.mvpResultado?.some((r) => r.jugadorId === jugador?.id)
                            return (
                              <li key={idx}>
                                {displayJugador(jugador)}
                                {esMvp && <span className="partido-jugador-mvp" title="MVP del partido" aria-hidden>🏆</span>}
                                <GolesIcon count={goles} />
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
                        <div className="partido-detail-actions">
                          <button
                            type="button"
                            className="partido-btn-editar partido-btn-editar-mobile"
                            onClick={() => setPartidoEditandoEquipos(partido)}
                          >
                            Editar equipos
                          </button>
                          <button
                            type="button"
                            className="partido-btn-editar partido-btn-editar-mobile"
                            onClick={() => setPartidoEditando(partido)}
                          >
                            Editar resultado
                          </button>
                          <button
                            type="button"
                            className="partido-btn-editar partido-btn-editar-mobile partido-btn-baja"
                            onClick={() => handleDarDeBaja(partido)}
                            disabled={bajandoPartidoId === partido.id}
                          >
                            {bajandoPartidoId === partido.id ? 'Dando de baja…' : 'Dar de baja'}
                          </button>
                        </div>
                      )}
                      {concluido && (
                        <PartidoMvpBlock
                          partido={partido}
                          jugadoresById={jugadoresById}
                          jugadorActual={jugadorActual}
                          displayJugador={displayJugador}
                          mvpVotandoPartidoId={mvpVotandoPartidoId}
                          mvpSeleccionadoId={mvpSeleccionadoId}
                          setMvpVotandoPartidoId={setMvpVotandoPartidoId}
                          setMvpSeleccionadoId={setMvpSeleccionadoId}
                          onVotar={async (votadoId) => {
                            if (!jugadorActual?.id) return
                            setMvpEnviandoPartidoId(partido.id)
                            try {
                              await votarMvp(partido.id, jugadorActual.id, votadoId)
                              refreshPartidos()
                              getJugadores(organizacionId).then(setJugadores).catch(() => {})
                            } catch (e) {
                              alert(e.message || 'Error al votar')
                            } finally {
                              setMvpEnviandoPartidoId(null)
                              setMvpSeleccionadoId('')
                            }
                          }}
                          enviando={mvpEnviandoPartidoId === partido.id}
                        />
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
