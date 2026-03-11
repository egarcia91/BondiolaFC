import { useState, useEffect } from 'react'
import { useOrg } from '../contexts/OrgContext'
import { createOrganizacion, getOrganizaciones, addJugador, getJugadorByEmail } from '../services/firestore'
import './ElegirOrganizacion.css'

function ElegirOrganizacion({ user, onCrearOrganizacion, onUnirseConCodigo, onElegida }) {
  const { organizaciones, currentOrgId, setCurrentOrgId, loading, refreshOrganizaciones, errorOrgs } = useOrg()
  const [creando, setCreando] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [error, setError] = useState('')
  const [orgParaUnirse, setOrgParaUnirse] = useState(null)
  const [entrando, setEntrando] = useState(false)

  const uid = user?.uid ?? ''
  const email = user?.email ?? ''
  const displayName = user?.displayName ?? ''

  useEffect(() => {
    if (!loading && organizaciones.length === 0 && user?.type === 'google') {
      getOrganizaciones()
        .then((list) => {
          if (list.length === 1) setOrgParaUnirse(list[0])
          else setOrgParaUnirse(null)
        })
        .catch(() => setOrgParaUnirse(null))
    } else {
      setOrgParaUnirse(null)
    }
  }, [loading, organizaciones.length, user?.type])

  const handleEntrarAOrg = async () => {
    if (!orgParaUnirse?.id || !uid || !email) return
    setError('')
    setEntrando(true)
    try {
      const yaExiste = await getJugadorByEmail(email, orgParaUnirse.id)
      if (yaExiste) {
        await refreshOrganizaciones()
        setCurrentOrgId(orgParaUnirse.id)
        onElegida?.()
        return
      }
      const apodo = (displayName || '').trim().split(/\s/)[0] || 'Jugador'
      await addJugador({
        organizacionId: orgParaUnirse.id,
        userId: uid,
        nombre: (displayName || '').trim() || email,
        apodo: apodo || 'Jugador',
        mail: email,
        posicion: '',
        descripcion: '',
        fechaNacimiento: '',
        equipoFavorito: 'rojo',
        partidos: 0,
        victorias: 0,
        partidosEmpatados: 0,
        partidosPerdidos: 0,
        goles: 0,
        elo: 900,
        eloHistorial: [],
        mvp: 0,
        registrado: true,
        admin: false,
      })
      await refreshOrganizaciones()
      setCurrentOrgId(orgParaUnirse.id)
      onElegida?.()
    } catch (err) {
      setError(err.message || 'Error al entrar')
    } finally {
      setEntrando(false)
    }
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    if (!nombreNueva.trim()) return
    setError('')
    setCreando(true)
    try {
      const orgId = await createOrganizacion(nombreNueva.trim(), uid)
      setCurrentOrgId(orgId)
      onCrearOrganizacion?.(orgId)
      onElegida?.()
    } catch (err) {
      setError(err.message || 'Error al crear la organización')
    } finally {
      setCreando(false)
    }
  }

  if (loading) {
    return (
      <div className="elegir-org elegir-org-loading">
        <p>Cargando…</p>
      </div>
    )
  }

  const tieneAlguna = organizaciones.length > 0
  const esInvitado = user?.type === 'guest'

  return (
    <div className="elegir-org">
      <div className="elegir-org-card">
        <h2 className="elegir-org-titulo">Organizaciones</h2>
        <p className="elegir-org-desc">
          {esInvitado
            ? 'Elegí una organización para ver jugadores y partidos (solo lectura).'
            : tieneAlguna
              ? 'Elegí una organización para ver jugadores y partidos, o creá una nueva.'
              : 'Creá una organización o unite con un código de invitación.'}
        </p>

        {!tieneAlguna && orgParaUnirse && !esInvitado && (
          <div className="elegir-org-entrar-existente">
            <p className="elegir-org-desc">Ya existe la organización <strong>{orgParaUnirse.nombre}</strong>. Entrá con tu cuenta de Google para sumarte.</p>
            {error && <p className="elegir-org-error">{error}</p>}
            <button
              type="button"
              className="elegir-org-btn elegir-org-btn-primary"
              onClick={handleEntrarAOrg}
              disabled={entrando}
            >
              {entrando ? 'Entrando…' : `Entrar a ${orgParaUnirse.nombre || 'la organización'}`}
            </button>
          </div>
        )}

        {esInvitado && !tieneAlguna && !loading && (
          <div className="elegir-org-entrar-existente">
            {errorOrgs ? (
              <p className="elegir-org-error">{errorOrgs}</p>
            ) : (
              <p className="elegir-org-desc">No hay organizaciones para mostrar. Revisá que la colección <strong>organizaciones</strong> exista en Firestore y que las reglas permitan lectura sin login (<code>allow read: if true</code>).</p>
            )}
            <button
              type="button"
              className="elegir-org-btn elegir-org-btn-primary"
              onClick={() => refreshOrganizaciones()}
            >
              Reintentar
            </button>
          </div>
        )}

        {tieneAlguna && (
          <div className="elegir-org-lista">
            <label className="elegir-org-label">
              {esInvitado ? 'Organizaciones' : 'Tus organizaciones'}
            </label>
            {organizaciones.map((org) => (
              <button
                key={org.id}
                type="button"
                className={`elegir-org-item ${currentOrgId === org.id ? 'elegir-org-item--activa' : ''}`}
                onClick={() => {
                  setCurrentOrgId(org.id)
                  onElegida?.()
                }}
              >
                <span className="elegir-org-item-nombre">{org.nombre || org.id}</span>
              </button>
            ))}
          </div>
        )}

        {!esInvitado && onUnirseConCodigo && (
          <button type="button" className="elegir-org-btn elegir-org-btn-sec" onClick={onUnirseConCodigo}>
            Unirme con código
          </button>
        )}

        {!esInvitado && (
        <div className="elegir-org-crear">
          {!creando ? (
            <button
              type="button"
              className="elegir-org-btn elegir-org-btn-primary"
              onClick={() => setCreando(true)}
            >
              Crear nueva organización
            </button>
          ) : (
            <form onSubmit={handleCrear} className="elegir-org-form">
              <input
                type="text"
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                placeholder="Nombre de la organización"
                className="elegir-org-input"
                autoFocus
              />
              {error && <p className="elegir-org-error">{error}</p>}
              <div className="elegir-org-form-actions">
                <button type="button" className="elegir-org-btn elegir-org-btn-sec" onClick={() => { setCreando(false); setError('') }}>
                  Cancelar
                </button>
                <button type="submit" className="elegir-org-btn elegir-org-btn-primary" disabled={!nombreNueva.trim()}>
                  Crear
                </button>
              </div>
            </form>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

export default ElegirOrganizacion
