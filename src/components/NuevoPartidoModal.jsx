import { useState } from 'react'
import { addPartido, getJugadores, resolveNombreToEntrada } from '../services/firestore'
import SelectorJugador from './SelectorJugador'
import './NuevoPartidoModal.css'

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * Obtiene la próxima fecha que cae en el día de la semana dado (0=domingo, 1=lunes, ...).
 */
function getNextWeekdayDate(dayIndex, hour, minute = 0) {
  const hoy = new Date()
  let d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), hour, minute)
  let currentDay = d.getDay()
  let diff = dayIndex - currentDay
  if (diff < 0) diff += 7
  if (diff === 0 && d <= hoy) diff = 7
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Parsea un mensaje de partido en el formato esperado.
 * Ejemplo:
 *   "Village \\ Lunes 21 hs\n\n📘 Azul:\n1. Jony\n..."
 * @returns {{ lugar: string, fechaLabel: string, fecha: string, hora: string, jugadoresAzul: string[], jugadoresRojo: string[] } | { error: string }}
 */
export function parsePartidoMessage(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return { error: 'El mensaje está vacío' }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim())

  let lugar = ''
  let fechaStr = ''
  let horaStr = '21'
  const jugadoresAzul = []
  const jugadoresRojo = []

  // Primera línea: "Village \ Lunes 21 hs" o "Village \\ Lunes 21 hs"
  const firstLine = lines[0] || ''
  const firstParts = firstLine.split(/\s*[\\|]\s*/).map((s) => s.trim()).filter(Boolean)
  if (firstParts.length >= 1) lugar = firstParts[0]
  if (firstParts.length >= 2) {
    const dayTime = firstParts[1]
    const match = dayTime.match(/(\w+)\s+(\d{1,2})\s*(?:hs)?/i)
    if (match) {
      fechaStr = match[1]
      horaStr = match[2].padStart(2, '0')
    }
  }

  let section = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/📘\s*Azul:?/i.test(line) || /^Azul:?\s*$/i.test(line)) {
      section = 'azul'
      continue
    }
    if (/^\s*Vs\s*$/i.test(line)) {
      section = null
      continue
    }
    if (/📕\s*Rojo:?/i.test(line) || /^Rojo:?\s*$/i.test(line)) {
      section = 'rojo'
      continue
    }
    const playerMatch = line.match(/^\d+\.\s*(.+)$/)
    if (playerMatch && section) {
      const name = playerMatch[1].trim()
      if (section === 'azul') jugadoresAzul.push(name)
      else if (section === 'rojo') jugadoresRojo.push(name)
    }
  }

  const dayIndex = fechaStr
    ? DIAS_SEMANA.findIndex((d) => fechaStr.toLowerCase().startsWith(d.substring(0, 3)))
    : -1
  if (dayIndex === -1 && fechaStr) return { error: 'No se pudo reconocer el día de la semana' }

  const hour = parseInt(horaStr, 10) || 21
  const nextDate = dayIndex >= 0 ? getNextWeekdayDate(dayIndex, hour, 0) : new Date()
  const y = nextDate.getFullYear()
  const m = String(nextDate.getMonth() + 1).padStart(2, '0')
  const day = nextDate.getDate()
  const d = String(day).padStart(2, '0')
  const fecha = `${y}-${m}-${d}`
  const hora = `${String(hour).padStart(2, '0')}:00`
  const diaNombre = DIAS_SEMANA[nextDate.getDay()]
  const fechaLabel = `próximo ${diaNombre} a las ${hora} horas`

  return {
    lugar,
    fechaLabel,
    fecha,
    hora,
    jugadoresAzul,
    jugadoresRojo,
  }
}

function NuevoPartidoModal({ onClose, onPartidoCreado }) {
  const [step, setStep] = useState('ingreso')
  const [texto, setTexto] = useState('')
  const [parseError, setParseError] = useState('')
  const [datos, setDatos] = useState(null)
  const [jugadoresList, setJugadoresList] = useState([])
  const [editRojo, setEditRojo] = useState([])
  const [editAzul, setEditAzul] = useState([])
  const [editFecha, setEditFecha] = useState('')
  const [editHora, setEditHora] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loadingConfirm, setLoadingConfirm] = useState(false)

  const handleProcesar = async () => {
    setParseError('')
    const result = parsePartidoMessage(texto)
    if (result.error) {
      setParseError(result.error)
      return
    }
    setLoadingConfirm(true)
    try {
      const jugadores = await getJugadores()
      const rojo = (result.jugadoresRojo || []).map((nombre) => {
        const e = resolveNombreToEntrada(nombre, jugadores)
        return e.id ? { tipo: 'jugador', id: e.id } : { tipo: 'invitado', nombre: e.nombre || nombre }
      })
      const azul = (result.jugadoresAzul || []).map((nombre) => {
        const e = resolveNombreToEntrada(nombre, jugadores)
        return e.id ? { tipo: 'jugador', id: e.id } : { tipo: 'invitado', nombre: e.nombre || nombre }
      })
      setDatos(result)
      setJugadoresList(jugadores)
      setEditRojo(rojo)
      setEditAzul(azul)
      setEditFecha(result.fecha || '')
      setEditHora(result.hora || '21:00')
      setStep('confirmacion')
    } catch (err) {
      setParseError(err.message || 'Error al cargar jugadores')
    } finally {
      setLoadingConfirm(false)
    }
  }

  const handleCorregir = () => {
    setStep('ingreso')
    setParseError('')
    setDatos(null)
    setJugadoresList([])
    setEditRojo([])
    setEditAzul([])
    setEditFecha('')
    setEditHora('')
  }

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

  const handleDarDeAlta = async () => {
    if (!datos) return
    setSaveError('')
    setSaving(true)
    try {
      const jugadoresRojo = editRojo.map((e) =>
        e.tipo === 'jugador' ? { id: e.id } : { nombre: e.nombre }
      )
      const jugadoresAzul = editAzul.map((e) =>
        e.tipo === 'jugador' ? { id: e.id } : { nombre: e.nombre }
      )
      await addPartido({
        fecha: editFecha || datos.fecha,
        hora: editHora || datos.hora,
        lugar: datos.lugar || 'Por definir',
        concluido: false,
        equipoLocal: {
          nombre: 'Rojo',
          jugadores: jugadoresRojo,
          goles: 0,
        },
        equipoVisitante: {
          nombre: 'Azul',
          jugadores: jugadoresAzul,
          goles: 0,
        },
        ganador: 'Empate',
      })
      onPartidoCreado?.()
      onClose?.()
    } catch (err) {
      setSaveError(err.message || 'Error al crear el partido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="nuevo-partido-overlay" onClick={onClose}>
      <div className="nuevo-partido-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nuevo-partido-header">
          <h3>Nuevo partido</h3>
          <button type="button" className="nuevo-partido-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        {step === 'ingreso' && (
          <>
            <p className="nuevo-partido-hint">
              Pegá el mensaje del partido (lugar, fecha/hora, jugadores Azul y Rojo).
            </p>
            <textarea
              className="nuevo-partido-textarea"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={'Ejemplo:\nVillage \\ Lunes 21 hs\n\n📘 Azul:\n1. Jony\n2. Hernán\n...\n\nVs\n\n📕 Rojo:\n1. Chino\n...'}
              rows={12}
            />
            {parseError && <p className="nuevo-partido-error">{parseError}</p>}
            <div className="nuevo-partido-actions">
              <button type="button" className="nuevo-partido-btn secundario" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="nuevo-partido-btn" onClick={handleProcesar} disabled={loadingConfirm}>
                {loadingConfirm ? 'Procesando…' : 'Procesar'}
              </button>
            </div>
          </>
        )}

        {step === 'confirmacion' && datos && (
          <>
            <p className="nuevo-partido-pregunta">¿La información es correcta? Podés corregir fecha, hora y cada jugador.</p>
            <div className="nuevo-partido-resumen">
              <p><strong>Lugar:</strong> {datos.lugar || '—'}</p>
              <div className="nuevo-partido-fecha-hora">
                <p className="nuevo-partido-fecha-label">
                  <strong>Fecha y hora del partido</strong>
                  {datos.fechaLabel && (
                    <span className="nuevo-partido-fecha-sugerido"> (sugerido: {datos.fechaLabel})</span>
                  )}
                </p>
                <div className="nuevo-partido-fecha-inputs">
                  <label className="nuevo-partido-date-label">
                    Fecha
                    <input
                      type="date"
                      value={editFecha}
                      onChange={(e) => setEditFecha(e.target.value)}
                      className="nuevo-partido-input-date"
                    />
                  </label>
                  <label className="nuevo-partido-date-label">
                    Hora
                    <input
                      type="time"
                      value={editHora}
                      onChange={(e) => setEditHora(e.target.value)}
                      className="nuevo-partido-input-time"
                    />
                  </label>
                </div>
              </div>
              <p><strong>Jugadores de Azul:</strong></p>
              <ul className="nuevo-partido-jugadores-edit">
                {editAzul.map((_, i) => (
                  <li key={i} className="nuevo-partido-jugador-row">
                    <span className="nuevo-partido-parsed-name">¿{datos.jugadoresAzul[i]} es invitado o jugador?</span>
                    <SelectorJugador
                      id={`nuevo-azul-${i}`}
                      parsedName={datos.jugadoresAzul[i]}
                      value={editAzul[i]}
                      jugadores={jugadoresList}
                      onChange={(val) => setEditAzulAt(i, val)}
                    />
                  </li>
                ))}
              </ul>
              <p><strong>Jugadores de Rojo:</strong></p>
              <ul className="nuevo-partido-jugadores-edit">
                {editRojo.map((_, i) => (
                  <li key={i} className="nuevo-partido-jugador-row">
                    <span className="nuevo-partido-parsed-name">¿{datos.jugadoresRojo[i]} es invitado o jugador?</span>
                    <SelectorJugador
                      id={`nuevo-rojo-${i}`}
                      parsedName={datos.jugadoresRojo[i]}
                      value={editRojo[i]}
                      jugadores={jugadoresList}
                      onChange={(val) => setEditRojoAt(i, val)}
                    />
                  </li>
                ))}
              </ul>
            </div>
            {saveError && <p className="nuevo-partido-error">{saveError}</p>}
            <div className="nuevo-partido-actions">
              <button type="button" className="nuevo-partido-btn secundario" onClick={handleCorregir} disabled={saving}>
                Corregir
              </button>
              <button type="button" className="nuevo-partido-btn" onClick={handleDarDeAlta} disabled={saving}>
                {saving ? 'Guardando…' : 'Dar de alta'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default NuevoPartidoModal
