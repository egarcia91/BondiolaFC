import { useState, useEffect } from 'react'
import { updatePartido, getPartidos, normalizePartido } from '../services/firestore'
import SelectorJugador from './SelectorJugador'
import './EditarPartidoEquiposModal.css'

function formatFechaPartido(fecha, hora) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  const date = new Date(y, m - 1, d)
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const str = date.toLocaleDateString('es-ES', opts)
  return hora ? `${str} ${hora}` : str
}

/** Convierte entradas del partido (jugadores) a estado editable. */
function jugadoresToEdit(entradas = []) {
  return entradas.map((e) => {
    if (e?.id) return { tipo: 'jugador', id: e.id }
    return { tipo: 'invitado', nombre: e?.nombre || 'Invitado' }
  })
}

/** Convierte estado editable a formato Firestore. */
function editToJugadores(editList) {
  return (editList || []).map((e) => {
    if (e?.tipo === 'jugador' && e?.id) return { id: e.id }
    return { nombre: e?.nombre || 'Invitado' }
  })
}

function EditarPartidoEquiposModal({ partido, jugadores = [], onClose, onSaved }) {
  const [partidoCargado, setPartidoCargado] = useState(null)
  const [editRojo, setEditRojo] = useState([])
  const [editAzul, setEditAzul] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const partidoParaForm = partidoCargado ?? partido

  useEffect(() => {
    if (!partido?.id || !jugadores?.length) {
      setPartidoCargado(null)
      setEditRojo([])
      setEditAzul([])
      return
    }
    setEditRojo(jugadoresToEdit(partido.equipoLocal?.jugadores))
    setEditAzul(jugadoresToEdit(partido.equipoVisitante?.jugadores))
    let cancelled = false
    getPartidos()
      .then((lista) => {
        if (cancelled) return
        const p = lista.find((x) => x.id === partido.id)
        if (p) {
          const normalized = normalizePartido(p, jugadores)
          setPartidoCargado(normalized)
          setEditRojo(jugadoresToEdit(normalized.equipoLocal?.jugadores))
          setEditAzul(jugadoresToEdit(normalized.equipoVisitante?.jugadores))
        }
      })
      .catch(() => setPartidoCargado(null))
    return () => { cancelled = true }
  }, [partido?.id, jugadores])

  const setEditRojoAt = (index, val) => {
    setEditRojo((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
  }

  const setEditAzulAt = (index, val) => {
    setEditAzul((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
  }

  const addRojo = () => setEditRojo((prev) => [...prev, { tipo: 'invitado', nombre: 'Invitado' }])
  const addAzul = () => setEditAzul((prev) => [...prev, { tipo: 'invitado', nombre: 'Invitado' }])

  const removeRojo = (index) => setEditRojo((prev) => prev.filter((_, i) => i !== index))
  const removeAzul = (index) => setEditAzul((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!partido?.id || !partidoParaForm) return
    setError('')
    setSaving(true)
    try {
      const jugadoresRojo = editToJugadores(editRojo)
      const jugadoresAzul = editToJugadores(editAzul)
      await updatePartido(partido.id, {
        equipoLocal: {
          ...partidoParaForm.equipoLocal,
          jugadores: jugadoresRojo,
        },
        equipoVisitante: {
          ...partidoParaForm.equipoVisitante,
          jugadores: jugadoresAzul,
        },
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
    <div className="editar-equipos-overlay" onClick={onClose}>
      <div className="editar-equipos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editar-equipos-header">
          <h3>Editar equipos del partido</h3>
          <button type="button" className="editar-equipos-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <p className="editar-equipos-meta">
          {formatFechaPartido(partidoParaForm?.fecha, partidoParaForm?.hora)} · {partidoParaForm?.lugar ?? partido?.lugar}
        </p>

        <p className="editar-equipos-hint">
          Corregí los jugadores de cada equipo. Podés agregar, quitar o cambiar entre jugador registrado e invitado.
        </p>

        <form onSubmit={handleSubmit} className="editar-equipos-form">
          <div className="editar-equipos-block">
            <h4 className="editar-equipos-titulo">Rojo</h4>
            <ul className="editar-equipos-lista">
              {editRojo.map((val, i) => (
                <li key={i} className="editar-equipos-fila">
                  <SelectorJugador
                    id={`editar-rojo-${i}`}
                    parsedName={val?.tipo === 'invitado' ? val.nombre : 'Invitado'}
                    value={val}
                    jugadores={jugadores}
                    onChange={(v) => setEditRojoAt(i, v)}
                  />
                  <button
                    type="button"
                    className="editar-equipos-quitar"
                    onClick={() => removeRojo(i)}
                    aria-label="Quitar jugador"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="editar-equipos-agregar" onClick={addRojo}>
              + Agregar jugador a Rojo
            </button>
          </div>

          <div className="editar-equipos-block">
            <h4 className="editar-equipos-titulo">Azul</h4>
            <ul className="editar-equipos-lista">
              {editAzul.map((val, i) => (
                <li key={i} className="editar-equipos-fila">
                  <SelectorJugador
                    id={`editar-azul-${i}`}
                    parsedName={val?.tipo === 'invitado' ? val.nombre : 'Invitado'}
                    value={val}
                    jugadores={jugadores}
                    onChange={(v) => setEditAzulAt(i, v)}
                  />
                  <button
                    type="button"
                    className="editar-equipos-quitar"
                    onClick={() => removeAzul(i)}
                    aria-label="Quitar jugador"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="editar-equipos-agregar" onClick={addAzul}>
              + Agregar jugador a Azul
            </button>
          </div>

          {error && <p className="editar-equipos-error">{error}</p>}
          <div className="editar-equipos-actions">
            <button type="button" className="editar-equipos-btn secundario" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="editar-equipos-btn" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditarPartidoEquiposModal
