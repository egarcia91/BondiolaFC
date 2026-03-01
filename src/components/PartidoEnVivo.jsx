import { useState, useEffect } from 'react'
import { aplicarResultadoPartido, ANOTADOR_GENERAL_ID } from '../services/firestore'
import './PartidoEnVivo.css'

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function PartidoEnVivo({ partido, jugadores = [], onTerminar, onVolver }) {
  const [golesRojo, setGolesRojo] = useState(0)
  const [golesAzul, setGolesAzul] = useState(0)
  const [golesAnotadoresRojo, setGolesAnotadoresRojo] = useState([])
  const [golesAnotadoresAzul, setGolesAnotadoresAzul] = useState([])
  const [historialGoles, setHistorialGoles] = useState([]) // 'rojo' | 'azul' por cada gol
  const [startTime] = useState(() => Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const jugadoresById = new Map((jugadores || []).map((j) => [j.id, j]))

  const displayJugador = (entrada) => {
    if (!entrada) return 'Invitado'
    if (entrada.id) {
      const j = jugadoresById.get(entrada.id)
      return (j && (j.apodo || j.nombre)) || entrada.nombre || 'Invitado'
    }
    return entrada.nombre ? `Invitado (${entrada.nombre})` : 'Invitado'
  }

  const golesDeAnotador = (anotadorId, lista) =>
    (lista || []).filter((id) => id === anotadorId).length

  const labelBotonJugador = (nombre, anotadorId, golesAnotadores) => {
    const goles = golesDeAnotador(anotadorId, golesAnotadores)
    if (goles === 0) return nombre
    if (goles === 1) return `⚽ ${nombre}`
    return `⚽ ${goles} ${nombre}`
  }

  const addGolRojo = (anotadorId) => {
    setGolesRojo((n) => n + 1)
    setGolesAnotadoresRojo((arr) => [...arr, anotadorId])
    setHistorialGoles((h) => [...h, 'rojo'])
  }

  const addGolAzul = (anotadorId) => {
    setGolesAzul((n) => n + 1)
    setGolesAnotadoresAzul((arr) => [...arr, anotadorId])
    setHistorialGoles((h) => [...h, 'azul'])
  }

  const handleRevertirUltima = () => {
    if (historialGoles.length === 0) return
    const ultimo = historialGoles[historialGoles.length - 1]
    setHistorialGoles((h) => h.slice(0, -1))
    if (ultimo === 'rojo') {
      setGolesRojo((n) => Math.max(0, n - 1))
      setGolesAnotadoresRojo((arr) => arr.slice(0, -1))
    } else {
      setGolesAzul((n) => Math.max(0, n - 1))
      setGolesAnotadoresAzul((arr) => arr.slice(0, -1))
    }
  }

  const handleTerminar = async () => {
    if (!window.confirm('¿Terminar el partido y guardar el resultado? Esta acción no se puede deshacer.')) {
      return
    }
    setError('')
    setSaving(true)
    try {
      const partidoActualizado = {
        ...partido,
        equipoLocal: {
          ...partido.equipoLocal,
          nombre: partido.equipoLocal?.nombre || 'Rojo',
          jugadores: partido.equipoLocal?.jugadores ?? [],
          goles: golesRojo,
          golesAnotadores: golesAnotadoresRojo,
        },
        equipoVisitante: {
          ...partido.equipoVisitante,
          nombre: partido.equipoVisitante?.nombre || 'Azul',
          jugadores: partido.equipoVisitante?.jugadores ?? [],
          goles: golesAzul,
          golesAnotadores: golesAnotadoresAzul,
        },
      }
      await aplicarResultadoPartido(partidoActualizado, jugadores)
      onTerminar?.()
    } catch (err) {
      setError(err.message || 'Error al terminar el partido')
    } finally {
      setSaving(false)
    }
  }

  if (!partido) return null

  const listaRojo = partido.equipoLocal?.jugadores ?? []
  const listaAzul = partido.equipoVisitante?.jugadores ?? []

  return (
    <div className="partido-en-vivo">
      <div className="partido-en-vivo-header">
        <button type="button" className="partido-en-vivo-volver" onClick={onVolver}>
          ← Volver
        </button>
        <h2 className="partido-en-vivo-titulo">Partido en vivo</h2>
      </div>

      <p className="partido-en-vivo-meta">
        {partido.lugar || '—'} · {partido.fecha} {partido.hora}
      </p>

      <div className="partido-en-vivo-cuerpo">
        <div className="partido-en-vivo-centro">
          <div className="partido-en-vivo-marcador">
            <div className="partido-en-vivo-equipo partido-en-vivo-rojo">
              <span className="partido-en-vivo-equipo-nombre">Rojo</span>
              <span className="partido-en-vivo-goles">{golesRojo}</span>
            </div>
            <span className="partido-en-vivo-vs">—</span>
            <div className="partido-en-vivo-equipo partido-en-vivo-azul">
              <span className="partido-en-vivo-equipo-nombre">Azul</span>
              <span className="partido-en-vivo-goles">{golesAzul}</span>
            </div>
          </div>

      <div className="partido-en-vivo-cronometro">
            <span className="partido-en-vivo-cronometro-label">Tiempo</span>
            <span className="partido-en-vivo-cronometro-valor">{formatTimer(elapsedSeconds)}</span>
          </div>
          <div className="partido-en-vivo-actions">
            <button
              type="button"
              className="partido-en-vivo-btn-revertir"
              onClick={handleRevertirUltima}
              disabled={historialGoles.length === 0 || saving}
              title="Deshacer el último gol anotado"
            >
              Revertir última acción
            </button>
            <button
              type="button"
              className="partido-en-vivo-btn-terminar"
              onClick={handleTerminar}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Terminar partido'}
            </button>
          </div>
          {error && <p className="partido-en-vivo-error">{error}</p>}
        </div>

      <p className="partido-en-vivo-hint">Tocá un jugador o “Gol general” para anotar un gol.</p>

      <div className="partido-en-vivo-columna partido-en-vivo-columna-rojo">
          <h3 className="partido-en-vivo-columna-titulo">Rojo</h3>
          <div className="partido-en-vivo-jugadores">
            {listaRojo.map((entrada, idx) => {
              const anotadorId = entrada?.id || `guest:${entrada?.nombre || 'Invitado'}`
              return (
                <button
                  key={idx}
                  type="button"
                  className="partido-en-vivo-jugador-btn"
                  onClick={() => addGolRojo(anotadorId)}
                >
                  {labelBotonJugador(displayJugador(entrada), anotadorId, golesAnotadoresRojo)}
                </button>
              )
            })}
            <button
              type="button"
              className="partido-en-vivo-jugador-btn partido-en-vivo-gol-general"
              onClick={() => addGolRojo(ANOTADOR_GENERAL_ID)}
            >
              {labelBotonJugador('Gol general', ANOTADOR_GENERAL_ID, golesAnotadoresRojo)}
            </button>
          </div>
        </div>
        <div className="partido-en-vivo-columna partido-en-vivo-columna-azul">
          <h3 className="partido-en-vivo-columna-titulo">Azul</h3>
          <div className="partido-en-vivo-jugadores">
            {listaAzul.map((entrada, idx) => {
              const anotadorId = entrada?.id || `guest:${entrada?.nombre || 'Invitado'}`
              return (
                <button
                  key={idx}
                  type="button"
                  className="partido-en-vivo-jugador-btn"
                  onClick={() => addGolAzul(anotadorId)}
                >
                  {labelBotonJugador(displayJugador(entrada), anotadorId, golesAnotadoresAzul)}
                </button>
              )
            })}
            <button
              type="button"
              className="partido-en-vivo-jugador-btn partido-en-vivo-gol-general"
              onClick={() => addGolAzul(ANOTADOR_GENERAL_ID)}
            >
              {labelBotonJugador('Gol general', ANOTADOR_GENERAL_ID, golesAnotadoresAzul)}
            </button>
          </div>
        </div>
      </div>

      <p className="partido-en-vivo-hint">Tocá un jugador o &quot;Gol general&quot; para anotar un gol.</p>
    </div>
  )
}

export default PartidoEnVivo
