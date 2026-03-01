import { useState, useEffect } from 'react'
import { getJugadores, updateJugadorRegistro } from '../services/firestore'
import './RegistroJugador.css'

function RegistroJugador({ userEmail, userDisplayName, onClose, onRegistered }) {
  const [jugadores, setJugadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const jugadorRegistrado = jugadores.find((j) => j.mail === userEmail)
  // Solo mostrar jugadores que nadie ha registrado (sin mail ni registrado)
  const jugadoresDisponibles = jugadores.filter((j) => {
    const yaRegistrado = j.registrado === true || (j.mail && String(j.mail).trim() !== '')
    return !yaRegistrado
  })

  useEffect(() => {
    getJugadores()
      .then(setJugadores)
      .catch(() => setError('Error al cargar jugadores'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (jugadores.length && userDisplayName && !selectedId) {
      const match = jugadores.find(
        (j) => j.nombre && j.nombre.trim().toLowerCase() === (userDisplayName || '').trim().toLowerCase()
      )
      if (match) setSelectedId(match.id)
    }
  }, [jugadores, userDisplayName, selectedId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedId) return
    setError('')
    setSaving(true)
    try {
      await updateJugadorRegistro(selectedId, { mail: userEmail, registrado: true })
      onRegistered?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al registrarse')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="registro-overlay" onClick={onClose}>
        <div className="registro-modal" onClick={(e) => e.stopPropagation()}>
          <p>Cargando jugadores…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="registro-overlay" onClick={onClose}>
      <div className="registro-modal" onClick={(e) => e.stopPropagation()}>
        <div className="registro-header">
          <h3>Registrarme como jugador</h3>
          <button type="button" className="registro-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        {jugadorRegistrado ? (
          <div className="registro-ya">
            <p>
              Ya estás registrado como <strong>{jugadorRegistrado.apodo || jugadorRegistrado.nombre}</strong>.
            </p>
            <button type="button" className="registro-btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="registro-form">
            <p className="registro-desc">Elegí tu ficha para vincular tu cuenta con un jugador del equipo.</p>
            <label htmlFor="registro-select" className="registro-label">
              Jugador
            </label>
            <select
              id="registro-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="registro-select"
              required
            >
              <option value="">Seleccionar…</option>
              {jugadoresDisponibles.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.apodo || j.nombre} — {j.nombre}
                </option>
              ))}
            </select>
            {error && <p className="registro-error">{error}</p>}
            <div className="registro-actions">
              <button type="button" className="registro-btn secundary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="registro-btn" disabled={!selectedId || saving}>
                {saving ? 'Guardando…' : 'Registrarme'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default RegistroJugador
