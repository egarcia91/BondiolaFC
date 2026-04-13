import { useState, useEffect } from 'react'
import { eliminarJugadorDeOrganizacion } from '../services/firestore'
import './NuevoJugadorModal.css'

const TEXTO_CONFIRMACION = 'ELIMINAR'

/**
 * @param {{
 *   jugador: { id: string, nombre?: string, apodo?: string },
 *   organizacionId: string,
 *   onClose: () => void,
 *   onEliminado?: (jugadorId: string) => void
 * }} props
 */
function AdminEliminarJugadorModal({ jugador, organizacionId, onClose, onEliminado }) {
  const [texto, setTexto] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setTexto('')
    setError('')
    setEliminando(false)
  }, [jugador?.id])

  const etiqueta = (jugador?.apodo || jugador?.nombre || 'este jugador').trim() || 'este jugador'

  const handleEliminar = async () => {
    setEliminando(true)
    setError('')
    try {
      await eliminarJugadorDeOrganizacion(jugador.id, organizacionId)
      onEliminado?.(jugador.id)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar al jugador.')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="nuevo-jugador-overlay" onClick={onClose}>
      <div className="nuevo-jugador-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="nuevo-jugador-header">
          <h3>Eliminar jugador</h3>
          <button type="button" className="nuevo-jugador-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <p className="admin-eliminar-jugador-aviso">
          Vas a borrar de forma permanente a <strong>{etiqueta}</strong> de la organización. Los partidos en los que
          figuró pueden seguir mostrando datos históricos con su nombre guardado en el momento del partido.
        </p>
        <p className="admin-eliminar-jugador-aviso admin-eliminar-jugador-aviso--fuerte">
          Para confirmar, escribí exactamente <strong>{TEXTO_CONFIRMACION}</strong> en el campo de abajo.
        </p>

        <div className="nuevo-jugador-form">
          <label className="nuevo-jugador-label" htmlFor="admin-eliminar-jugador-confirm">
            Confirmación
            <input
              id="admin-eliminar-jugador-confirm"
              type="text"
              className="nuevo-jugador-input"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={TEXTO_CONFIRMACION}
              autoComplete="off"
              autoCapitalize="characters"
            />
          </label>

          {error && <p className="nuevo-jugador-error">{error}</p>}

          <div className="nuevo-jugador-actions">
            <button type="button" className="nuevo-jugador-btn nuevo-jugador-btn-sec" onClick={onClose} disabled={eliminando}>
              Cancelar
            </button>
            <button
              type="button"
              className="nuevo-jugador-btn admin-eliminar-jugador-btn-peligro"
              disabled={eliminando || texto.trim() !== TEXTO_CONFIRMACION}
              onClick={handleEliminar}
            >
              {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminEliminarJugadorModal
