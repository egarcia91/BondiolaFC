import { useState, useEffect } from 'react'
import { updatePartido } from '../services/firestore'
import { partidoVideosYouTubeIds, parseYouTubeLines } from '../utils/youtube'
import './PartidoVideosModal.css'

function PartidoVideosModal({ partido, onClose, onSaved }) {
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!partido) return
    const ids = partidoVideosYouTubeIds(partido)
    setTexto(ids.length ? ids.join('\n') : '')
    setError('')
  }, [partido])

  const handleGuardar = async (e) => {
    e.preventDefault()
    if (!partido?.id) return
    setError('')
    const { ids, invalid } = parseYouTubeLines(texto)
    if (invalid.length > 0) {
      setError(`No se reconocen como YouTube: ${invalid.slice(0, 3).join('; ')}${invalid.length > 3 ? '…' : ''}`)
      return
    }
    setSaving(true)
    try {
      await updatePartido(partido.id, { videosYouTube: ids })
      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!partido) return null

  return (
    <div className="partido-videos-modal-overlay" onClick={onClose} role="presentation">
      <div className="partido-videos-modal" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-labelledby="partido-videos-modal-title">
        <div className="partido-videos-modal-header">
          <h3 id="partido-videos-modal-title">Videos de YouTube</h3>
          <button type="button" className="partido-videos-modal-cerrar" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="partido-videos-modal-desc">
          Pegá una URL o el ID del video por línea. Ejemplos: <code>https://www.youtube.com/watch?v=…</code>, <code>https://youtu.be/…</code>
        </p>
        <form onSubmit={handleGuardar}>
          <label htmlFor="partido-videos-textarea" className="partido-videos-modal-label">
            Enlaces (uno por línea)
          </label>
          <textarea
            id="partido-videos-textarea"
            className="partido-videos-modal-textarea"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder="https://www.youtube.com/watch?v=…"
            disabled={saving}
          />
          {error && <p className="partido-videos-modal-error">{error}</p>}
          <div className="partido-videos-modal-actions">
            <button type="button" className="partido-videos-modal-btn partido-videos-modal-btn-sec" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="partido-videos-modal-btn partido-videos-modal-btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PartidoVideosModal
