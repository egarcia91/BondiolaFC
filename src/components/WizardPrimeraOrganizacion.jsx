import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { createOrganizacion, addJugador } from '../services/firestore'
import { CREAR_ORG_PERFIL_KEY } from '../constants/onboarding'
import './WizardPrimeraOrganizacion.css'

const DEPORTES_PRESET = ['Futbol', 'Padel', 'Tenis', 'Basquet', 'Voley', 'Otro']

/**
 * Tras Google + perfil en sessionStorage: nombre de organización, deporte, creación en Firestore.
 * @param {{ perfil: { nombre: string, apellido: string, fechaNacimiento: string }, onTerminado: () => void }} props
 */
export default function WizardPrimeraOrganizacion({ perfil, onTerminado }) {
  const { user } = useAuth()
  const { organizaciones, loading: orgLoading, refreshOrganizaciones, setCurrentOrgId } = useOrg()
  const [nombreOrg, setNombreOrg] = useState('')
  const [deporte, setDeporte] = useState('Futbol')
  const [deporteOtro, setDeporteOtro] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cargaInicialLista = useRef(false)

  /** Si ya tenía organizaciones al abrir el asistente (perfil viejo en session), salir sin crear de nuevo. */
  useEffect(() => {
    if (orgLoading) return
    if (cargaInicialLista.current) return
    cargaInicialLista.current = true
    if (organizaciones.length > 0) {
      sessionStorage.removeItem(CREAR_ORG_PERFIL_KEY)
      onTerminado()
    }
  }, [orgLoading, organizaciones.length, onTerminado])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombreOrg.trim()) return
    const deporteElegido = deporte === 'Otro' ? deporteOtro.trim() : deporte
    if (!deporteElegido) {
      setError('Elegí o ingresá un deporte.')
      return
    }
    if (user?.type !== 'google' || !user.uid || !user.email) {
      setError('Sesión inválida. Volvé a iniciar sesión con Google.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      const orgId = await createOrganizacion(nombreOrg.trim(), user.uid, deporteElegido)
      const nombreCompleto = `${perfil.nombre} ${perfil.apellido}`.trim()
      const apodo =
        (perfil.nombre || '').trim().split(/\s/)[0]
        || (user.displayName || '').trim().split(/\s/)[0]
        || 'Admin'
      await addJugador({
        organizacionId: orgId,
        userId: user.uid,
        nombre: nombreCompleto || user.displayName || user.email,
        apodo: apodo || 'Admin',
        mail: user.email,
        posicion: '',
        descripcion: '',
        fechaNacimiento: perfil.fechaNacimiento || '',
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
        admin: true,
      })
      sessionStorage.removeItem(CREAR_ORG_PERFIL_KEY)
      await refreshOrganizaciones()
      setCurrentOrgId(orgId)
      onTerminado()
    } catch (err) {
      setError(err.message || 'No se pudo crear la organización.')
    } finally {
      setGuardando(false)
    }
  }

  if (orgLoading) {
    return (
      <div className="wizard-primera-org">
        <p className="wizard-primera-org-loading">Cargando…</p>
      </div>
    )
  }

  if (organizaciones.length > 0) {
    return null
  }

  return (
    <div className="wizard-primera-org">
      <div className="wizard-primera-org-card">
        <h2 className="wizard-primera-org-title">Último paso</h2>
        <p className="wizard-primera-org-desc">
          Ya validamos tu cuenta con Google. Definí el nombre y el deporte de tu organización.
        </p>
        <form className="wizard-primera-org-form" onSubmit={handleSubmit}>
          <label className="wizard-primera-org-label" htmlFor="wizard-nombre-org">
            Nombre de la organización
          </label>
          <input
            id="wizard-nombre-org"
            type="text"
            className="wizard-primera-org-input"
            value={nombreOrg}
            onChange={(e) => setNombreOrg(e.target.value)}
            placeholder="Ej. Club Los Amigos"
            required
            autoFocus
          />

          <label className="wizard-primera-org-label" htmlFor="wizard-deporte">
            Deporte
          </label>
          <select
            id="wizard-deporte"
            className="wizard-primera-org-input"
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
              className="wizard-primera-org-input"
              value={deporteOtro}
              onChange={(e) => setDeporteOtro(e.target.value)}
              placeholder="Nombre del deporte"
            />
          )}

          {error && <p className="wizard-primera-org-error">{error}</p>}

          <button type="submit" className="wizard-primera-org-submit" disabled={guardando || !nombreOrg.trim()}>
            {guardando ? 'Creando…' : 'Crear organización'}
          </button>
        </form>
      </div>
    </div>
  )
}
