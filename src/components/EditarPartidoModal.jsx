import { useState, useEffect } from 'react'
import { updatePartido } from '../services/firestore'
import './EditarPartidoModal.css'

function formatFechaPartido(fecha, hora) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  const date = new Date(y, m - 1, d)
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const str = date.toLocaleDateString('es-ES', opts)
  return hora ? `${str} ${hora}` : str
}

function EditarPartidoModal({ partido, onClose, onSaved }) {
  const [golesRojo, setGolesRojo] = useState(0)
  const [golesAzul, setGolesAzul] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (partido) {
      setGolesRojo(partido.equipoLocal?.goles ?? 0)
      setGolesAzul(partido.equipoVisitante?.goles ?? 0)
    }
  }, [partido])

  const ganador =
    golesRojo > golesAzul
      ? (partido?.equipoLocal?.nombre || 'Rojo')
      : golesAzul > golesRojo
        ? (partido?.equipoVisitante?.nombre || 'Azul')
        : 'Empate'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!partido) return
    setError('')
    setSaving(true)
    try {
      await updatePartido(partido.id, {
        concluido: true,
        equipoLocal: {
          ...partido.equipoLocal,
          nombre: partido.equipoLocal?.nombre || 'Rojo',
          jugadores: partido.equipoLocal?.jugadores ?? [],
          goles: Number(golesRojo) || 0,
        },
        equipoVisitante: {
          ...partido.equipoVisitante,
          nombre: partido.equipoVisitante?.nombre || 'Azul',
          jugadores: partido.equipoVisitante?.jugadores ?? [],
          goles: Number(golesAzul) || 0,
        },
        ganador,
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
    <div className="editar-partido-overlay" onClick={onClose}>
      <div className="editar-partido-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editar-partido-header">
          <h3>Editar partido</h3>
          <button type="button" className="editar-partido-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <p className="editar-partido-meta">
          {formatFechaPartido(partido.fecha, partido.hora)} · {partido.lugar}
        </p>

        <form onSubmit={handleSubmit} className="editar-partido-form">
          <div className="editar-partido-resultado">
            <div className="editar-partido-equipo">
              <label htmlFor="goles-rojo">Rojo</label>
              <input
                id="goles-rojo"
                type="number"
                min={0}
                max={99}
                value={golesRojo}
                onChange={(e) => setGolesRojo(Number(e.target.value) || 0)}
                className="editar-partido-input"
              />
            </div>
            <span className="editar-partido-vs">—</span>
            <div className="editar-partido-equipo">
              <label htmlFor="goles-azul">Azul</label>
              <input
                id="goles-azul"
                type="number"
                min={0}
                max={99}
                value={golesAzul}
                onChange={(e) => setGolesAzul(Number(e.target.value) || 0)}
                className="editar-partido-input"
              />
            </div>
          </div>
          <p className="editar-partido-ganador">
            Resultado: <strong>{ganador}</strong>
          </p>
          {error && <p className="editar-partido-error">{error}</p>}
          <div className="editar-partido-actions">
            <button type="button" className="editar-partido-btn secundario" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="editar-partido-btn" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditarPartidoModal
