import { useState } from 'react'
import { createInvitacion } from '../services/firestore'
import './InvitarModal.css'

function InvitarModal({ organizacionId, creadoPor, onClose }) {
  const [loading, setLoading] = useState(false)
  const [codigo, setCodigo] = useState(null)
  const [error, setError] = useState('')

  const generar = async () => {
    if (!organizacionId || !creadoPor) return
    setError('')
    setLoading(true)
    setCodigo(null)
    try {
      const c = await createInvitacion(organizacionId, creadoPor, 7)
      setCodigo(c)
    } catch (err) {
      setError(err.message || 'Error al generar código')
    } finally {
      setLoading(false)
    }
  }

  const url = typeof window !== 'undefined' && codigo
    ? `${window.location.origin}${window.location.pathname}?invite=${codigo}`
    : ''

  return (
    <div className="invitar-overlay" onClick={onClose}>
      <div className="invitar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invitar-header">
          <h3>Invitar a la organización</h3>
          <button type="button" className="invitar-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="invitar-desc">Generá un código de invitación. Quien lo use se unirá a esta organización (debe tener cuenta con Google).</p>
        {error && <p className="invitar-error">{error}</p>}
        {codigo ? (
          <div className="invitar-resultado">
            <label className="invitar-label">Código</label>
            <p className="invitar-codigo">{codigo}</p>
            {url && (
              <>
                <label className="invitar-label">Link</label>
                <p className="invitar-url">{url}</p>
              </>
            )}
            <button type="button" className="invitar-btn invitar-btn-sec" onClick={generar} disabled={loading}>
              Generar otro
            </button>
          </div>
        ) : (
          <button type="button" className="invitar-btn invitar-btn-primary" onClick={generar} disabled={loading}>
            {loading ? 'Generando…' : 'Generar código'}
          </button>
        )}
      </div>
    </div>
  )
}

export default InvitarModal
