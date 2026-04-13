import { useState, useEffect } from 'react'
import { updateJugadorPerfil } from '../services/firestore'
import './NuevoJugadorModal.css'

/**
 * Modal para que un administrador edite nombre, apodo y fecha de nacimiento de cualquier jugador.
 * @param {{
 *   jugador: { id: string, nombre?: string, apodo?: string, fechaNacimiento?: string },
 *   onClose: () => void,
 *   onSaved?: () => void,
 * }} props
 */
function AdminEditarJugadorModal({ jugador, onClose, onSaved }) {
  const [nombre, setNombre] = useState('')
  const [apodo, setApodo] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jugador) return
    setNombre(jugador.nombre ?? '')
    setApodo(jugador.apodo ?? '')
    const fn = jugador.fechaNacimiento
    setFechaNacimiento(typeof fn === 'string' && fn.length >= 10 ? fn.slice(0, 10) : '')
    setError('')
  }, [jugador])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nombreTrim = nombre.trim()
    const apodoTrim = apodo.trim()
    if (!nombreTrim || !apodoTrim) {
      setError('Nombre y apodo son obligatorios')
      return
    }
    setError('')
    setSaving(true)
    try {
      await updateJugadorPerfil(jugador.id, {
        nombre: nombreTrim,
        apodo: apodoTrim,
        fechaNacimiento: fechaNacimiento || '',
      })
      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="nuevo-jugador-overlay" onClick={onClose}>
      <div className="nuevo-jugador-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="nuevo-jugador-header">
          <h3>Editar jugador</h3>
          <button type="button" className="nuevo-jugador-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="admin-editar-jugador-hint">
          Como administrador podés corregir el nombre completo, el apodo y la fecha de nacimiento de este jugador.
        </p>

        <form onSubmit={handleSubmit} className="nuevo-jugador-form">
          <label className="nuevo-jugador-label">
            Nombre completo
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="nuevo-jugador-input"
              placeholder="Nombre y apellido"
              autoComplete="name"
            />
          </label>

          <label className="nuevo-jugador-label">
            Apodo
            <input
              type="text"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
              className="nuevo-jugador-input"
              placeholder="Apodo en la organización"
              autoComplete="nickname"
            />
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

          {error && <p className="nuevo-jugador-error">{error}</p>}

          <div className="nuevo-jugador-actions">
            <button type="button" className="nuevo-jugador-btn nuevo-jugador-btn-sec" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="nuevo-jugador-btn nuevo-jugador-btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminEditarJugadorModal
