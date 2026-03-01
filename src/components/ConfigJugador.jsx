import { useState, useEffect } from 'react'
import { getJugadores, updateJugadorPerfil } from '../services/firestore'
import './ConfigJugador.css'

const POSICIONES = ['Delantero', 'Defensor', 'Mediocampista', 'Arquero']
const EQUIPOS = [
  { value: 'rojo', label: 'Rojo' },
  { value: 'azul', label: 'Azul' },
]

function ConfigJugador({ userEmail, onClose, onSaved }) {
  const [jugadores, setJugadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const jugador = jugadores.find((j) => j.mail === userEmail)

  const [apodo, setApodo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [posicion, setPosicion] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [equipoFavorito, setEquipoFavorito] = useState('rojo')

  useEffect(() => {
    getJugadores()
      .then(setJugadores)
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (jugador) {
      setApodo(jugador.apodo ?? '')
      setDescripcion(jugador.descripcion ?? '')
      setPosicion(jugador.posicion ?? '')
      setFechaNacimiento(jugador.fechaNacimiento ? jugador.fechaNacimiento.slice(0, 10) : '')
      setEquipoFavorito(jugador.equipoFavorito === 'azul' ? 'azul' : 'rojo')
    }
  }, [jugador])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!jugador) return
    setError('')
    setSaving(true)
    try {
      await updateJugadorPerfil(jugador.id, {
        apodo: apodo.trim(),
        descripcion: descripcion.trim(),
        posicion: posicion || '',
        fechaNacimiento: fechaNacimiento || '',
        equipoFavorito,
      })
      onSaved?.(equipoFavorito)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="config-overlay" onClick={onClose}>
        <div className="config-modal" onClick={(e) => e.stopPropagation()}>
          <p>Cargando…</p>
        </div>
      </div>
    )
  }

  if (!jugador) {
    return (
      <div className="config-overlay" onClick={onClose}>
        <div className="config-modal" onClick={(e) => e.stopPropagation()}>
          <div className="config-header">
            <h3>Configuración</h3>
            <button type="button" className="config-close" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
          <p className="config-sin-registro">Primero registrate como jugador en &quot;Mi jugador&quot; para poder configurar tu perfil.</p>
          <button type="button" className="config-btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="config-overlay" onClick={onClose}>
      <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="config-header">
          <h3>Configuración de perfil</h3>
          <button type="button" className="config-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="config-form">
          <label className="config-label">
            Apodo
            <input
              type="text"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
              className="config-input"
              placeholder="Tu apodo"
            />
          </label>

          <label className="config-label">
            Posición
            <select
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
              className="config-select"
            >
              <option value="">Seleccionar…</option>
              {POSICIONES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          <label className="config-label">
            Fecha de nacimiento
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className="config-input"
            />
          </label>

          <label className="config-label">
            Equipo favorito
            <select
              value={equipoFavorito}
              onChange={(e) => setEquipoFavorito(e.target.value)}
              className="config-select"
            >
              {EQUIPOS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="config-label">
            Descripción
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="config-textarea"
              placeholder="Algo sobre vos..."
              rows={3}
            />
          </label>

          {error && <p className="config-error">{error}</p>}

          <div className="config-actions">
            <button type="button" className="config-btn config-btn-sec" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="config-btn" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ConfigJugador
