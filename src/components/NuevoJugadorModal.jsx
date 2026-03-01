import { useState } from 'react'
import { addJugador } from '../services/firestore'
import './NuevoJugadorModal.css'

const POSICIONES = ['Delantero', 'Defensor', 'Mediocampista', 'Arquero']

function NuevoJugadorModal({ onClose, onSaved }) {
  const [nombre, setNombre] = useState('')
  const [apodo, setApodo] = useState('')
  const [posicion, setPosicion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [equipoFavorito, setEquipoFavorito] = useState('rojo')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nombreTrim = nombre.trim()
    const apodoTrim = apodo.trim()
    if (!nombreTrim || !apodoTrim) {
      setError('Nombre y apodo son obligatorios')
      return
    }
    if (!posicion) {
      setError('Elegí una posición')
      return
    }
    setError('')
    setSaving(true)
    try {
      await addJugador({
        nombre: nombreTrim,
        apodo: apodoTrim,
        posicion,
        descripcion: descripcion.trim(),
        fechaNacimiento: fechaNacimiento || '',
        equipoFavorito,
        partidos: 0,
        victorias: 0,
        partidosEmpatados: 0,
        partidosPerdidos: 0,
        goles: 0,
        elo: 900,
        eloHistorial: [],
        mail: '',
        registrado: false,
        admin: false,
      })
      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al guardar el jugador')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="nuevo-jugador-overlay" onClick={onClose}>
      <div className="nuevo-jugador-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nuevo-jugador-header">
          <h3>Nuevo jugador</h3>
          <button type="button" className="nuevo-jugador-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="nuevo-jugador-form">
          <label className="nuevo-jugador-label">
            Nombre completo
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="nuevo-jugador-input"
              placeholder="Ej. Hernán Zaniratto"
            />
          </label>

          <label className="nuevo-jugador-label">
            Apodo
            <input
              type="text"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
              className="nuevo-jugador-input"
              placeholder="Ej. Herni"
            />
          </label>

          <label className="nuevo-jugador-label">
            Posición
            <select
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
              className="nuevo-jugador-select"
            >
              <option value="">Seleccionar…</option>
              {POSICIONES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          <label className="nuevo-jugador-label">
            Fecha de nacimiento
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className="nuevo-jugador-input"
            />
          </label>

          <div className="nuevo-jugador-label">
            <span className="nuevo-jugador-label-text">Equipo favorito</span>
            <div className="nuevo-jugador-equipo-btns" role="group" aria-label="Equipo favorito">
              <button
                type="button"
                className={`nuevo-jugador-equipo-btn nuevo-jugador-equipo-btn--azul ${equipoFavorito === 'azul' ? 'nuevo-jugador-equipo-btn--selected' : ''}`}
                onClick={() => setEquipoFavorito('azul')}
                aria-pressed={equipoFavorito === 'azul'}
              >
                Azul
              </button>
              <button
                type="button"
                className={`nuevo-jugador-equipo-btn nuevo-jugador-equipo-btn--rojo ${equipoFavorito === 'rojo' ? 'nuevo-jugador-equipo-btn--selected' : ''}`}
                onClick={() => setEquipoFavorito('rojo')}
                aria-pressed={equipoFavorito === 'rojo'}
              >
                Rojo
              </button>
            </div>
          </div>

          <label className="nuevo-jugador-label">
            Descripción
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="nuevo-jugador-textarea"
              placeholder="Opcional"
              rows={3}
            />
          </label>

          {error && <p className="nuevo-jugador-error">{error}</p>}

          <div className="nuevo-jugador-actions">
            <button type="button" className="nuevo-jugador-btn nuevo-jugador-btn-sec" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="nuevo-jugador-btn nuevo-jugador-btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Dar de alta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NuevoJugadorModal
