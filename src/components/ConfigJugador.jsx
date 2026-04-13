import { useState, useEffect } from 'react'
import { getJugadores, updateJugadorPerfil } from '../services/firestore'
import './ConfigJugador.css'

const POSICIONES = ['Delantero', 'Defensor', 'Mediocampista', 'Arquero']

/**
 * @param {{
 *   userEmail: string,
 *   organizacionId: string,
 *   onClose: () => void,
 *   onSaved?: (equipoFavorito?: string) => void,
 *   onCerrarSesion?: () => void,
 *   onEquipoPreview?: (equipo: 'azul' | 'rojo') => void,
 *   onAbrirInvitar?: () => void,
 *   organizaciones?: Array<{ id: string, nombre?: string }>,
 *   currentOrgId?: string | null,
 *   onCambiarOrganizacion?: (organizacionId: string | null) => void,
 *   onAbrirUnirseCodigo?: () => void,
 *   puedeEliminarOrganizacion?: boolean,
 *   nombreOrganizacion?: string,
 *   onEliminarOrganizacion?: () => void | Promise<void>,
 * }} props
 */

const TEXTO_CONFIRMACION_ELIMINAR_ORG = 'ELIMINAR'

function ConfigJugador({
  userEmail,
  organizacionId,
  onClose,
  onSaved,
  onCerrarSesion,
  onEquipoPreview,
  onAbrirInvitar,
  organizaciones = [],
  currentOrgId = null,
  onCambiarOrganizacion,
  onAbrirUnirseCodigo,
  puedeEliminarOrganizacion = false,
  nombreOrganizacion = '',
  onEliminarOrganizacion,
}) {
  const [jugadores, setJugadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [faseEliminarOrg, setFaseEliminarOrg] = useState(null)
  const [textoConfirmacionEliminarOrg, setTextoConfirmacionEliminarOrg] = useState('')
  const [eliminandoOrg, setEliminandoOrg] = useState(false)

  const jugador = jugadores.find((j) => j.mail === userEmail)

  const [apodo, setApodo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [posicion, setPosicion] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [equipoFavorito, setEquipoFavorito] = useState('rojo')

  const showOrgSelect = organizaciones.length > 1 && typeof onCambiarOrganizacion === 'function'
  const showUnirseCodigo = typeof onAbrirUnirseCodigo === 'function'
  const cuentaOrgBlock = (showOrgSelect || showUnirseCodigo) && (
    <div className="config-org-block">
      <p className="config-org-block-title">Organización</p>
      {showOrgSelect && (
        <label className="config-label">
          Cambiar de organización
          <select
            className="config-select"
            value={currentOrgId || ''}
            onChange={(e) => onCambiarOrganizacion?.(e.target.value || null)}
            title="Organización activa"
            aria-label="Organización activa"
          >
            {organizaciones.map((org) => (
              <option key={org.id} value={org.id}>{org.nombre || org.id}</option>
            ))}
          </select>
        </label>
      )}
      {showUnirseCodigo && (
        <button
          type="button"
          className="config-btn config-btn-outline config-btn-full"
          onClick={onAbrirUnirseCodigo}
        >
          Unirme con código
        </button>
      )}
    </div>
  )

  const initialEquipo = jugador?.equipoFavorito === 'azul' ? 'azul' : 'rojo'
  const hasUnsavedChanges = !!jugador && (
    (apodo !== (jugador.apodo ?? '')) ||
    (descripcion !== (jugador.descripcion ?? '')) ||
    (posicion !== (jugador.posicion ?? '')) ||
    (fechaNacimiento !== (jugador.fechaNacimiento ? jugador.fechaNacimiento.slice(0, 10) : '')) ||
    (equipoFavorito !== initialEquipo)
  )

  useEffect(() => {
    if (!organizacionId) return
    getJugadores(organizacionId)
      .then(setJugadores)
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false))
  }, [organizacionId])

  useEffect(() => {
    setFaseEliminarOrg(null)
    setTextoConfirmacionEliminarOrg('')
    setEliminandoOrg(false)
  }, [organizacionId])

  useEffect(() => {
    if (jugador) {
      setApodo(jugador.apodo ?? '')
      setDescripcion(jugador.descripcion ?? '')
      setPosicion(jugador.posicion ?? '')
      setFechaNacimiento(jugador.fechaNacimiento ? jugador.fechaNacimiento.slice(0, 10) : '')
      setEquipoFavorito(jugador.equipoFavorito === 'azul' ? 'azul' : 'rojo')
    }
  }, [jugador])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!jugador) return
    setError('')
    setSaving(true)
    try {
      await updateJugadorPerfil(jugador.id, {
        apodo: apodo.trim(),
        descripcion: descripcion.trim(),
        posicion: posicion || '',
        fechaNacimiento: fechaNacimiento || '',
        equipoFavorito,
      })
      onSaved?.(equipoFavorito)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="config-overlay" onClick={onClose}>
        <div className="config-modal" onClick={(e) => e.stopPropagation()}>
          <div className="config-header">
            <h3>Configuración de perfil</h3>
            <button type="button" className="config-close" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
          {cuentaOrgBlock}
          <p>Cargando…</p>
        </div>
      </div>
    )
  }

  if (!jugador) {
    return (
      <div className="config-overlay" onClick={onClose}>
        <div className="config-modal" onClick={(e) => e.stopPropagation()}>
          <div className="config-header">
            <h3>Configuración</h3>
            <button type="button" className="config-close" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
          {cuentaOrgBlock}
          <p className="config-sin-registro">Primero registrate como jugador en &quot;Mi jugador&quot; para poder configurar tu perfil.</p>
          <div className="config-actions config-actions-single">
            <button type="button" className="config-btn" onClick={onClose}>
              Cerrar
            </button>
            {onCerrarSesion && (
              <button type="button" className="config-btn config-btn-outline" onClick={onCerrarSesion}>
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="config-overlay" onClick={onClose}>
      <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="config-header">
          <h3>Configuración de perfil</h3>
          <button type="button" className="config-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        {cuentaOrgBlock}

        <form onSubmit={handleSubmit} className="config-form">
          <label className="config-label">
            Apodo
            <input
              type="text"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
              className="config-input"
              placeholder="Tu apodo"
            />
          </label>

          <label className="config-label">
            Posición
            <select
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
              className="config-select"
            >
              <option value="">Seleccionar…</option>
              {POSICIONES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          <label className="config-label">
            Fecha de nacimiento
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className="config-input"
            />
          </label>

          <div className="config-label">
            <span className="config-label-text">Equipo favorito</span>
            <div className="config-equipo-btns" role="group" aria-label="Equipo favorito">
              <button
                type="button"
                className={`config-equipo-btn config-equipo-btn--azul ${equipoFavorito === 'azul' ? 'config-equipo-btn--selected' : ''}`}
                onClick={() => {
                  setEquipoFavorito('azul')
                  onEquipoPreview?.('azul')
                }}
                aria-pressed={equipoFavorito === 'azul'}
              >
                Azul
              </button>
              <button
                type="button"
                className={`config-equipo-btn config-equipo-btn--rojo ${equipoFavorito === 'rojo' ? 'config-equipo-btn--selected' : ''}`}
                onClick={() => {
                  setEquipoFavorito('rojo')
                  onEquipoPreview?.('rojo')
                }}
                aria-pressed={equipoFavorito === 'rojo'}
              >
                Rojo
              </button>
            </div>
          </div>

          <label className="config-label">
            Descripción
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="config-textarea"
              placeholder="Algo sobre vos..."
              rows={3}
            />
          </label>

          {jugador.admin === true && onAbrirInvitar && (
            <div className="config-admin-invite">
              <p className="config-admin-invite-title">Invitaciones</p>
              <p className="config-admin-invite-desc">
                Generá un código para que otras personas se sumen a esta organización.
              </p>
              <button
                type="button"
                className="config-btn config-btn-outline config-btn-full"
                onClick={onAbrirInvitar}
              >
                Invitar a la organización
              </button>
            </div>
          )}

          {puedeEliminarOrganizacion && typeof onEliminarOrganizacion === 'function' && (
            <div className="config-zona-peligro">
              <p className="config-zona-peligro-title">Acción irreversible</p>
              {!faseEliminarOrg ? (
                <>
                  <p className="config-zona-peligro-desc">
                    Solo vos, como creador de la organización, podés borrarla por completo. Se eliminarán
                    todos los jugadores, partidos e invitaciones asociados a
                    {' '}
                    <strong>{nombreOrganizacion?.trim() || 'esta organización'}</strong>
                    . No hay forma de recuperar esos datos.
                  </p>
                  <button
                    type="button"
                    className="config-btn config-btn-peligro-outline config-btn-full"
                    onClick={() => {
                      setFaseEliminarOrg('confirmar')
                      setTextoConfirmacionEliminarOrg('')
                      setError('')
                    }}
                  >
                    Eliminar esta organización…
                  </button>
                </>
              ) : (
                <div className="config-eliminar-org-confirm">
                  <p className="config-eliminar-org-aviso">
                    Si continuás, la organización desaparece para siempre junto con todo su historial.
                    Para confirmar, escribí exactamente
                    {' '}
                    <strong>{TEXTO_CONFIRMACION_ELIMINAR_ORG}</strong>
                    {' '}
                    en el campo de abajo.
                  </p>
                  <label className="config-label" htmlFor="config-confirm-eliminar-org">
                    Confirmación
                    <input
                      id="config-confirm-eliminar-org"
                      type="text"
                      className="config-input"
                      value={textoConfirmacionEliminarOrg}
                      onChange={(e) => setTextoConfirmacionEliminarOrg(e.target.value)}
                      placeholder={TEXTO_CONFIRMACION_ELIMINAR_ORG}
                      autoComplete="off"
                      autoCapitalize="characters"
                    />
                  </label>
                  <div className="config-eliminar-org-actions">
                    <button
                      type="button"
                      className="config-btn config-btn-sec"
                      disabled={eliminandoOrg}
                      onClick={() => {
                        setFaseEliminarOrg(null)
                        setTextoConfirmacionEliminarOrg('')
                      }}
                    >
                      No, volver
                    </button>
                    <button
                      type="button"
                      className="config-btn config-btn-peligro"
                      disabled={
                        eliminandoOrg
                        || textoConfirmacionEliminarOrg.trim() !== TEXTO_CONFIRMACION_ELIMINAR_ORG
                      }
                      onClick={async () => {
                        setEliminandoOrg(true)
                        setError('')
                        try {
                          await onEliminarOrganizacion()
                          onClose?.()
                        } catch (err) {
                          setError(err?.message || 'No se pudo eliminar la organización.')
                        } finally {
                          setEliminandoOrg(false)
                        }
                      }}
                    >
                      {eliminandoOrg ? 'Eliminando…' : 'Sí, eliminar para siempre'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="config-error">{error}</p>}

          <div className="config-actions">
            <button type="button" className="config-btn config-btn-sec" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className={`config-btn ${hasUnsavedChanges ? 'config-btn-unsaved' : ''}`}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          {onCerrarSesion && (
            <button type="button" className="config-btn config-btn-outline config-btn-full" onClick={onCerrarSesion}>
              Cerrar sesión
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

export default ConfigJugador
