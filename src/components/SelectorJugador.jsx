import { useState, useEffect, useRef } from 'react'
import './SelectorJugador.css'

/** Normaliza texto para búsqueda (minúsculas, sin acentos). */
export function normalizeSearch(s) {
  if (s == null || s === '') return ''
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
}

/**
 * Selector: invitado (con nombre) o jugador registrado con búsqueda.
 * @param {string} parsedName - Nombre por defecto para la opción "Invitado (parsedName)"
 * @param {{ tipo: 'invitado'|'jugador', id?: string, nombre?: string }} value - Valor actual
 * @param {Array} jugadores - Lista de jugadores con id, apodo, nombre
 * @param {Function} onChange - Se llama con { tipo: 'invitado', nombre } o { tipo: 'jugador', id }
 */
function SelectorJugador({ parsedName, value, jugadores = [], onChange, id: idAttr }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const boxRef = useRef(null)

  const isInvitado = value?.tipo === 'invitado'
  const jugadorSelected = value?.tipo === 'jugador' && value?.id
    ? jugadores.find((j) => j.id === value.id)
    : null
  const displayText = isInvitado
    ? `Invitado (${value?.nombre ?? parsedName})`
    : jugadorSelected
      ? `${jugadorSelected.apodo || jugadorSelected.nombre} – ${jugadorSelected.nombre}`
      : 'Elegir…'

  const keyFilter = normalizeSearch(filter)
  const filteredJugadores = keyFilter
    ? jugadores.filter(
        (j) =>
          normalizeSearch(j.apodo).includes(keyFilter) ||
          normalizeSearch(j.nombre).includes(keyFilter)
      )
    : jugadores

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  const handleSelectInvitado = () => {
    onChange({ tipo: 'invitado', nombre: parsedName })
    setOpen(false)
    setFilter('')
  }

  const handleSelectJugador = (j) => {
    onChange({ tipo: 'jugador', id: j.id })
    setOpen(false)
    setFilter('')
  }

  return (
    <div className="selector-jugador" ref={boxRef}>
      <button
        type="button"
        id={idAttr}
        className="selector-jugador-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {displayText}
        <span className="selector-jugador-chevron" aria-hidden>▼</span>
      </button>
      {open && (
        <div className="selector-jugador-dropdown" role="listbox">
          <div className="selector-jugador-opt selector-jugador-opt-invitado" onClick={handleSelectInvitado} role="option">
            Invitado ({parsedName})
          </div>
          <input
            type="text"
            className="selector-jugador-filter"
            placeholder="Buscar por apodo o nombre…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            autoFocus
          />
          <div className="selector-jugador-list">
            {filteredJugadores.length === 0 ? (
              <div className="selector-jugador-empty">Ningún jugador coincide</div>
            ) : (
              filteredJugadores.map((j) => (
                <div
                  key={j.id}
                  className="selector-jugador-opt"
                  onClick={() => handleSelectJugador(j)}
                  role="option"
                >
                  {j.apodo || j.nombre} – {j.nombre}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SelectorJugador
