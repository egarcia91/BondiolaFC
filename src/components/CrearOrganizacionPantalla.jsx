import { useState, useCallback } from 'react'
import { createOrganizacion } from '../services/firestore'
import { DEPORTES_PRESET } from '../constants/deportes'
import { COLOR_EQUIPO_PRESETS } from '../constants/coloresEquipos'
import './CrearOrganizacionPantalla.css'

const ROJO_DEFAULT = COLOR_EQUIPO_PRESETS.find((p) => p.id === 'rojo')
const AZUL_DEFAULT = COLOR_EQUIPO_PRESETS.find((p) => p.id === 'azul')

/**
 * @param {{
 *   user: { uid?: string, type?: string },
 *   onCreada: (orgId: string) => void | Promise<void>,
 *   onVolver?: () => void,
 *   titulo?: string,
 *   descripcion?: string,
 *   className?: string,
 * }} props
 */
export default function CrearOrganizacionPantalla({
  user,
  onCreada,
  onVolver,
  titulo = 'Crear nueva organización',
  descripcion = 'Completá los datos de tu grupo: deporte, nombre, una frase que los identifique y los colores con los que suelen jugar los dos equipos (local y visitante).',
  className = '',
}) {
  const [deporte, setDeporte] = useState('Futbol')
  const [deporteOtro, setDeporteOtro] = useState('')
  const [nombre, setNombre] = useState('')
  const [frase, setFrase] = useState('')
  const [equipoLocalColor, setEquipoLocalColor] = useState({
    nombreVisible: ROJO_DEFAULT?.nombre ?? 'Rojo',
    hex: ROJO_DEFAULT?.hex ?? '#c62828',
  })
  const [equipoVisitanteColor, setEquipoVisitanteColor] = useState({
    nombreVisible: AZUL_DEFAULT?.nombre ?? 'Azul',
    hex: AZUL_DEFAULT?.hex ?? '#1565c0',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [modalEquipo, setModalEquipo] = useState(null)
  const [modalNombre, setModalNombre] = useState('')
  const [modalHex, setModalHex] = useState('#2ecc71')
  const [modalError, setModalError] = useState('')

  const abrirPersonalizado = useCallback((cual) => {
    const actual = cual === 'local' ? equipoLocalColor : equipoVisitanteColor
    setModalEquipo(cual)
    setModalNombre(actual.nombreVisible)
    setModalHex(/^#[0-9A-Fa-f]{6}$/.test(actual.hex) ? actual.hex : '#2ecc71')
    setModalError('')
  }, [equipoLocalColor, equipoVisitanteColor])

  const cerrarModal = useCallback(() => {
    setModalEquipo(null)
    setModalNombre('')
    setModalHex('#2ecc71')
    setModalError('')
  }, [])

  const guardarPersonalizado = useCallback(() => {
    const n = modalNombre.trim()
    const h = (modalHex || '').trim()
    if (n.length < 2) {
      setModalError('El nombre del color debe tener al menos 2 caracteres (ej. Esmeralda).')
      return
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(h)) {
      setModalError('Elegí un color válido (formato hexadecimal #rrggbb).')
      return
    }
    setModalError('')
    const payload = { nombreVisible: n, hex: h.toLowerCase() }
    if (modalEquipo === 'local') setEquipoLocalColor(payload)
    else if (modalEquipo === 'visitante') setEquipoVisitanteColor(payload)
    cerrarModal()
  }, [modalEquipo, modalNombre, modalHex, cerrarModal])

  const aplicarPreset = useCallback((cual, preset) => {
    const payload = { nombreVisible: preset.nombre, hex: preset.hex }
    if (cual === 'local') setEquipoLocalColor(payload)
    else setEquipoVisitanteColor(payload)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nombreTrim = nombre.trim()
    if (nombreTrim.length < 2) {
      setError('Ingresá un nombre de organización (al menos 2 caracteres).')
      return
    }
    const deporteElegido = deporte === 'Otro' ? deporteOtro.trim() : deporte
    if (!deporteElegido) {
      setError('Elegí o ingresá un deporte.')
      return
    }
    const uid = user?.uid ?? ''
    if (!uid) {
      setError('No hay sesión activa. Iniciá sesión con Google e intentá de nuevo.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      const orgId = await createOrganizacion({
        nombre: nombreTrim,
        creadoPor: uid,
        deporte: deporteElegido,
        frase: frase.trim().slice(0, 240),
        equipoLocalColor,
        equipoVisitanteColor,
      })
      await onCreada(orgId)
    } catch (err) {
      setError(err.message || 'No se pudo crear la organización.')
    } finally {
      setGuardando(false)
    }
  }

  const renderSelectorEquipo = (cual, label, descripcionEquipo, valor) => (
    <div className="crear-org-pantalla-equipo-bloque">
      <div className="crear-org-pantalla-equipo-head">
        <span className="crear-org-pantalla-equipo-label">{label}</span>
        <span
          className="crear-org-pantalla-equipo-muestra"
          style={{ background: valor.hex, color: luminanciaClara(valor.hex) ? '#111' : '#fff' }}
        >
          {valor.nombreVisible}
        </span>
      </div>
      <p className="crear-org-pantalla-equipo-desc">{descripcionEquipo}</p>
      <div className="crear-org-pantalla-presets" role="group" aria-label={`Colores para ${label}`}>
        {COLOR_EQUIPO_PRESETS.map((p) => (
          <button
            key={`${cual}-${p.id}`}
            type="button"
            className={`crear-org-pantalla-preset ${valor.hex === p.hex && valor.nombreVisible === p.nombre ? 'crear-org-pantalla-preset--activo' : ''}`}
            onClick={() => aplicarPreset(cual, p)}
            title={p.nombre}
            style={{ background: p.hex, color: luminanciaClara(p.hex) ? '#111' : '#fff' }}
          >
            {p.nombre}
          </button>
        ))}
        <button type="button" className="crear-org-pantalla-preset crear-org-pantalla-preset--custom" onClick={() => abrirPersonalizado(cual)}>
          Otro color…
        </button>
      </div>
    </div>
  )

  return (
    <div className={`crear-org-pantalla ${className}`.trim()}>
      <div className="crear-org-pantalla-card">
        {onVolver && (
          <button type="button" className="crear-org-pantalla-volver" onClick={onVolver}>
            ← Volver
          </button>
        )}
        <header className="crear-org-pantalla-header">
          <h1 className="crear-org-pantalla-titulo">{titulo}</h1>
          <p className="crear-org-pantalla-sub">{descripcion}</p>
        </header>

        <form className="crear-org-pantalla-form" onSubmit={handleSubmit}>
          <label className="crear-org-pantalla-field-label" htmlFor="cop-deporte">
            Deporte
          </label>
          <select
            id="cop-deporte"
            className="crear-org-pantalla-input crear-org-pantalla-select"
            value={deporte}
            onChange={(e) => setDeporte(e.target.value)}
          >
            {DEPORTES_PRESET.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {deporte === 'Otro' && (
            <input
              type="text"
              className="crear-org-pantalla-input"
              value={deporteOtro}
              onChange={(e) => setDeporteOtro(e.target.value)}
              placeholder="Nombre del deporte"
              aria-label="Deporte personalizado"
            />
          )}

          <label className="crear-org-pantalla-field-label" htmlFor="cop-nombre">
            Nombre de la organización
          </label>
          <input
            id="cop-nombre"
            type="text"
            className="crear-org-pantalla-input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder='Ej. "Bondiola FC"'
            autoComplete="organization"
          />

          <label className="crear-org-pantalla-field-label" htmlFor="cop-frase">
            Frase de la organización <span className="crear-org-pantalla-opcional">(opcional)</span>
          </label>
          <textarea
            id="cop-frase"
            className="crear-org-pantalla-textarea"
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            placeholder='Ej. "Fútbol en dos cómodas cuotas"'
            rows={2}
            maxLength={240}
          />

          <fieldset className="crear-org-pantalla-fieldset">
            <legend className="crear-org-pantalla-legend">Colores de los equipos</legend>
            <p className="crear-org-pantalla-fieldset-hint">
              Elegí un color predefinido o definí uno propio con nombre (ej. Esmeralda). Estos datos ayudan a identificar al equipo local y al visitante en los partidos.
            </p>
            {renderSelectorEquipo(
              'local',
              'Equipo local',
              'Suele ser el que juega en cancha propia o el primero en la planilla del partido.',
              equipoLocalColor
            )}
            {renderSelectorEquipo(
              'visitante',
              'Equipo visitante',
              'El rival del día; en la app aparece como segundo equipo en cada partido.',
              equipoVisitanteColor
            )}
          </fieldset>

          {error && <p className="crear-org-pantalla-error" role="alert">{error}</p>}

          <div className="crear-org-pantalla-actions">
            {onVolver && (
              <button type="button" className="crear-org-pantalla-btn crear-org-pantalla-btn-sec" onClick={onVolver} disabled={guardando}>
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="crear-org-pantalla-btn crear-org-pantalla-btn-primary"
              disabled={guardando || nombre.trim().length < 2}
            >
              {guardando ? 'Creando…' : 'Crear organización'}
            </button>
          </div>
        </form>
      </div>

      {modalEquipo && (
        <div className="crear-org-pantalla-modal-overlay" role="presentation" onClick={cerrarModal}>
          <div
            className="crear-org-pantalla-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cop-modal-titulo"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="cop-modal-titulo" className="crear-org-pantalla-modal-titulo">
              Color propio — equipo {modalEquipo === 'local' ? 'local' : 'visitante'}
            </h2>
            <p className="crear-org-pantalla-modal-desc">
              Elegí un color y asignale un nombre representativo para el equipo.
            </p>
            <label className="crear-org-pantalla-field-label" htmlFor="cop-modal-nombre">
              Nombre del color / equipo
            </label>
            <input
              id="cop-modal-nombre"
              type="text"
              className="crear-org-pantalla-input"
              value={modalNombre}
              onChange={(e) => setModalNombre(e.target.value)}
              placeholder="Ej. Esmeralda"
              autoFocus
            />
            <label className="crear-org-pantalla-field-label" htmlFor="cop-modal-color">
              Color
            </label>
            <div className="crear-org-pantalla-color-row">
              <input
                id="cop-modal-color"
                type="color"
                className="crear-org-pantalla-color-input"
                value={/^#[0-9A-Fa-f]{6}$/.test(modalHex) ? modalHex : '#2ecc71'}
                onChange={(e) => setModalHex(e.target.value)}
              />
              <input
                type="text"
                className="crear-org-pantalla-input crear-org-pantalla-input--hex"
                value={modalHex}
                onChange={(e) => setModalHex(e.target.value)}
                placeholder="#rrggbb"
                spellCheck={false}
                aria-label="Código hexadecimal del color"
              />
            </div>
            {modalError ? <p className="crear-org-pantalla-error crear-org-pantalla-error--modal" role="alert">{modalError}</p> : null}
            <div className="crear-org-pantalla-modal-actions">
              <button type="button" className="crear-org-pantalla-btn crear-org-pantalla-btn-sec" onClick={cerrarModal}>
                Cancelar
              </button>
              <button type="button" className="crear-org-pantalla-btn crear-org-pantalla-btn-primary" onClick={guardarPersonalizado}>
                Guardar color
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Texto legible sobre fondo claro u oscuro (aprox. luminancia relativa). */
function luminanciaClara(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return true
  const n = parseInt(m[1], 16)
  const r = (n >> 16) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return L > 0.55
}
