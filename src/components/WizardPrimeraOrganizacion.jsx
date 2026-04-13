import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { asegurarJugadorAdminCreador } from '../services/firestore'
import { CREAR_ORG_PERFIL_KEY } from '../constants/onboarding'
import CrearOrganizacionPantalla from './CrearOrganizacionPantalla'
import './WizardPrimeraOrganizacion.css'

/**
 * Tras Google + perfil en sessionStorage: pantalla completa de nueva organización y alta como admin.
 * @param {{ perfil: { nombre: string, apellido: string, fechaNacimiento: string }, onTerminado: () => void }} props
 */
export default function WizardPrimeraOrganizacion({ perfil, onTerminado }) {
  const { user } = useAuth()
  const { organizaciones, loading: orgLoading, refreshOrganizaciones, setCurrentOrgId } = useOrg()
  const [error, setError] = useState('')
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

  const handleOrgCreada = async (orgId) => {
    setError('')
    if (user?.type !== 'google' || !user.uid || !user.email) {
      setError('Sesión inválida. Volvé a iniciar sesión con Google.')
      return
    }
    try {
      await asegurarJugadorAdminCreador(orgId, user, perfil)
      sessionStorage.removeItem(CREAR_ORG_PERFIL_KEY)
      await refreshOrganizaciones()
      setCurrentOrgId(orgId)
      onTerminado()
    } catch (err) {
      setError(err.message || 'Se creó la organización pero no se pudo registrar tu jugador. Probá desde Configuración.')
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
      <CrearOrganizacionPantalla
        className="wizard-primera-org-crear"
        user={user}
        titulo="Último paso"
        descripcion="Definí nombre, deporte, una frase opcional y los colores de los dos equipos. Vas a entrar como administrador de la organización."
        onCreada={handleOrgCreada}
      />
      {error ? <p className="wizard-primera-org-error wizard-primera-org-error--externo">{error}</p> : null}
    </div>
  )
}
