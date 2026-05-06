import { useState, useEffect } from 'react'
import { updatePartido } from '../services/firestore'
import {
  partidoVideosYouTubeIds,
  partidoVideosYouTubePlaylistId,
  parseYouTubeLines,
  parseYouTubePlaylistId,
} from '../utils/youtube'
import './PartidoVideosModal.css'

function PartidoVideosModal({ partido, onClose, onSaved }) {
  const [texto, setTexto] = useState('')
  const [playlistTexto, setPlaylistTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!partido) return
    const ids = partidoVideosYouTubeIds(partido)
    setTexto(ids.length ? ids.join('\n') : '')
    const pl = partidoVideosYouTubePlaylistId(partido)
    setPlaylistTexto(pl ? `https://www.youtube.com/playlist?list=${pl}` : '')
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
    const plTrim = playlistTexto.trim()
    let playlistId = null
    if (plTrim) {
      playlistId = parseYouTubePlaylistId(plTrim)
      if (!playlistId) {
        setError(
          'La playlist no es válida. Usá un enlace como https://www.youtube.com/playlist?list=… o el ID de la lista (no el de un video suelto).'
        )
        return
      }
    }
    setSaving(true)
    try {
      await updatePartido(partido.id, {
        videosYouTube: ids,
        videosYouTubePlaylist: playlistId,
      })
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
          Videos: una URL o ID por línea (
          <code>watch?v=…</code>, <code>youtu.be/…</code>). Playlist (opcional): enlace con{' '}
          <code>list=…</code> o solo el ID de la lista; se muestra un reproductor con toda la lista.
        </p>
        <form onSubmit={handleGuardar}>
          <label htmlFor="partido-videos-playlist" className="partido-videos-modal-label">
            Playlist de YouTube (opcional)
          </label>
          <input
            id="partido-videos-playlist"
            type="url"
            className="partido-videos-modal-input"
            value={playlistTexto}
            onChange={(e) => setPlaylistTexto(e.target.value)}
            placeholder="https://www.youtube.com/playlist?list=…"
            disabled={saving}
            autoComplete="off"
          />
          <label htmlFor="partido-videos-textarea" className="partido-videos-modal-label partido-videos-modal-label--after">
            Videos sueltos (uno por línea)
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
