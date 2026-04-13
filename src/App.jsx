import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useOrg } from './contexts/OrgContext'
import { getJugadorByEmail, getJugadores, getPartidos } from './services/firestore'
import Login from './components/Login'
import PantallaInicio from './components/PantallaInicio'
import CrearOrganizacionPublica from './components/CrearOrganizacionPublica'
import WizardPrimeraOrganizacion from './components/WizardPrimeraOrganizacion'
import { CREAR_ORG_PERFIL_KEY } from './constants/onboarding'
import Jugadores from './components/Jugadores'
import Partidos from './components/Partidos'
import RegistroJugador from './components/RegistroJugador'
import ConfigJugador from './components/ConfigJugador'
import ElegirOrganizacion from './components/ElegirOrganizacion'
import UnirseConCodigoModal from './components/UnirseConCodigoModal'
import InvitarModal from './components/InvitarModal'
import { OrgProvider } from './contexts/OrgContext'
import { deporteEsFutbol } from './utils/deporte'
import './App.css'

const THEME_KEY = 'bondiola-fc-theme'

function PortadaSesionGoogle({ onCerrar }) {
  const { setCurrentOrgId } = useOrg()
  return (
    <PantallaInicio
      modoConSesion
      onVolverAlPanel={onCerrar}
      onSeleccionarOrganizacion={(orgId) => {
        setCurrentOrgId(orgId)
        onCerrar()
      }}
      onCrearOrganizacion={() => {
        setCurrentOrgId(null)
        onCerrar()
      }}
    />
  )
}

function App() {
  const { user, loading, isAuthenticated } = useAuth()
  const [vistaAccesoPublico, setVistaAccesoPublico] = useState('inicio')
  const [wizardPerfil, setWizardPerfil] = useState(null)
  const [portadaDesdeSesion, setPortadaDesdeSesion] = useState(false)
  const eraAutenticadoRef = useRef(false)

  const leerPerfilCrearOrg = useCallback(() => {
    if (typeof sessionStorage === 'undefined') return null
    try {
      const raw = sessionStorage.getItem(CREAR_ORG_PERFIL_KEY)
      if (!raw) return null
      const p = JSON.parse(raw)
      if (p?.nombre && p?.apellido && p?.fechaNacimiento) return p
    } catch {
      sessionStorage.removeItem(CREAR_ORG_PERFIL_KEY)
    }
    return null
  }, [])

  useEffect(() => {
    if (eraAutenticadoRef.current && !isAuthenticated) {
      setVistaAccesoPublico('inicio')
    }
    eraAutenticadoRef.current = isAuthenticated
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) setPortadaDesdeSesion(false)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google') {
      setWizardPerfil(null)
      return
    }
    setWizardPerfil(leerPerfilCrearOrg())
  }, [isAuthenticated, user, leerPerfilCrearOrg])

  const handleWizardTerminado = useCallback(() => {
    sessionStorage.removeItem(CREAR_ORG_PERFIL_KEY)
    setWizardPerfil(null)
  }, [])

  if (loading) {
    return (
      <div className="app app-loading">
        <p>Cargando…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    if (vistaAccesoPublico === 'inicio') {
      return (
        <PantallaInicio
          onCrearOrganizacion={() => setVistaAccesoPublico('crear-org')}
          onIrALogin={() => setVistaAccesoPublico('login')}
        />
      )
    }
    if (vistaAccesoPublico === 'crear-org') {
      return <CrearOrganizacionPublica onVolver={() => setVistaAccesoPublico('inicio')} />
    }
    return <Login onVolverInicio={() => setVistaAccesoPublico('inicio')} />
  }

  if (user?.type === 'google' && wizardPerfil) {
    return (
      <OrgProvider user={user}>
        <WizardPrimeraOrganizacion perfil={wizardPerfil} onTerminado={handleWizardTerminado} />
      </OrgProvider>
    )
  }

  return (
    <OrgProvider user={user}>
      {portadaDesdeSesion ? (
        <PortadaSesionGoogle onCerrar={() => setPortadaDesdeSesion(false)} />
      ) : (
        <AppConOrg onAbrirPortada={() => setPortadaDesdeSesion(true)} />
      )}
    </OrgProvider>
  )
}

/**
 * @param {{ onAbrirPortada?: () => void }} props
 */
function AppConOrg({ onAbrirPortada }) {
  const { user, signOut, isAuthenticated } = useAuth()
  const { organizaciones, currentOrgId, currentOrg, setCurrentOrgId, loading: orgLoading } = useOrg()
  const [activeSection, setActiveSection] = useState('jugadores')
  const [showRegistroModal, setShowRegistroModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showUnirseCodigo, setShowUnirseCodigo] = useState(false)
  const [showInvitar, setShowInvitar] = useState(false)
  const [yaRegistrado, setYaRegistrado] = useState(null)
  const [jugadorActual, setJugadorActual] = useState(null)
  const [equipoPreview, setEquipoPreview] = useState(null)
  /** Contadores de la org: jugadores con ≥1 partido, partidos concluidos. */
  const [orgStats, setOrgStats] = useState({ jugadoresActivos: null, partidosJugados: null })
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [isDarkMode])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google') {
      document.documentElement.setAttribute('data-equipo', 'azul')
      return
    }
    const equipo = equipoPreview ?? (jugadorActual?.equipoFavorito === 'rojo' ? 'rojo' : 'azul')
    document.documentElement.setAttribute('data-equipo', equipo)
  }, [isAuthenticated, user?.type, equipoPreview, jugadorActual?.equipoFavorito])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google' || !user?.email) return
    let cancelled = false
    getJugadorByEmail(user.email, currentOrgId || null)
      .then((jugador) => {
        if (cancelled) return
        setJugadorActual(jugador || null)
        setYaRegistrado(!!jugador)
      })
      .catch(() => {
        if (!cancelled) {
          setJugadorActual(null)
          setYaRegistrado(false)
        }
      })
    return () => { cancelled = true }
  }, [isAuthenticated, user?.type, user?.email, currentOrgId])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google') {
      setYaRegistrado(null)
      setJugadorActual(null)
    }
  }, [isAuthenticated, user?.type])

  useEffect(() => {
    if (!currentOrgId) return
    let cancelled = false
    setOrgStats({ jugadoresActivos: null, partidosJugados: null })
    Promise.all([getJugadores(currentOrgId), getPartidos(currentOrgId)])
      .then(([jugadores, partidos]) => {
        if (cancelled) return
        const jugadoresActivos = jugadores.filter((j) => (j.partidos ?? 0) >= 1).length
        const partidosJugados = partidos.filter((p) => p.concluido === true).length
        setOrgStats({ jugadoresActivos, partidosJugados })
      })
      .catch(() => {
        if (!cancelled) setOrgStats({ jugadoresActivos: 0, partidosJugados: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [currentOrgId])

  if (orgLoading) {
    return (
      <div className="app app-loading">
        <p>Cargando…</p>
      </div>
    )
  }

  if (!currentOrgId) {
    const inviteCode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('invite')
    const showUnirse = showUnirseCodigo || (inviteCode && user?.type === 'google')
    return (
      <div className="app">
        <ElegirOrganizacion
          user={user}
          onUnirseConCodigo={user?.type === 'google' ? () => setShowUnirseCodigo(true) : undefined}
          onElegida={() => {}}
        />
        {showUnirse && (
          <UnirseConCodigoModal
            codigoInicial={inviteCode || ''}
            onClose={() => setShowUnirseCodigo(false)}
            onUnido={() => setShowUnirseCodigo(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-header-title">
            <h1>
              {deporteEsFutbol(currentOrg?.deporte) && (
                <>
                  <span className="header-ball" aria-hidden="true">⚽</span>{' '}
                </>
              )}
              {currentOrg?.nombre || 'Bondiola FC'}
            </h1>
            <p className="subtitle">Estadísticas de {currentOrg?.deporte || 'Futbol'} día a día</p>
          </div>
          <div className="app-header-actions">
            {user?.type === 'google' && currentOrgId && onAbrirPortada && (
              <button
                type="button"
                className="app-registro-btn"
                onClick={onAbrirPortada}
                title="Ver el inicio público y el listado de organizaciones"
              >
                Pantalla principal
              </button>
            )}
            {organizaciones.length > 1 && (
              <select
                className="app-org-select"
                value={currentOrgId}
                onChange={(e) => setCurrentOrgId(e.target.value || null)}
                title="Cambiar de organización"
                aria-label="Organización"
              >
                {organizaciones.map((org) => (
                  <option key={org.id} value={org.id}>{org.nombre || org.id}</option>
                ))}
              </select>
            )}
            {user?.type === 'google' && (
              <>
                {yaRegistrado === false && (
                  <button
                    type="button"
                    className="app-registro-btn"
                    onClick={() => setShowRegistroModal(true)}
                    title="Registrarme como jugador"
                  >
                    Mi jugador
                  </button>
                )}
                <button
                  type="button"
                  className="app-icon-btn"
                  onClick={() => setShowConfigModal(true)}
                  title="Configuración de perfil"
                  aria-label="Configuración"
                >
                  ⚙
                </button>
              </>
            )}
            <span className="app-user-badge" title={user?.type === 'google' && jugadorActual ? user?.email : undefined}>
              {user?.type === 'guest' ? 'Invitado' : (jugadorActual?.apodo || user?.email)}
            </span>
            {user?.type === 'guest' && (
              <button
                type="button"
                className="app-registro-btn"
                onClick={signOut}
                title="Iniciar sesión con Google"
              >
                Login
              </button>
            )}
            <button
            type="button"
            className="theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
            aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDarkMode ? '○' : '●'}
          </button>
          </div>
        </div>
      </header>

      <nav className="app-nav" aria-live="polite">
        <button
          type="button"
          className={`nav-button ${activeSection === 'jugadores' ? 'active' : ''}`}
          onClick={() => setActiveSection('jugadores')}
          title="Jugadores de la organización que jugaron al menos un partido"
        >
          <span className="nav-button-label">Jugadores</span>
          <span className="nav-button-count">{orgStats.jugadoresActivos ?? '…'}</span>
        </button>
        <button
          type="button"
          className={`nav-button ${activeSection === 'partidos' ? 'active' : ''}`}
          onClick={() => setActiveSection('partidos')}
          title="Partidos con resultado cargado en la organización"
        >
          <span className="nav-button-label">Partidos</span>
          <span className="nav-button-count">{orgStats.partidosJugados ?? '…'}</span>
        </button>
      </nav>

      <main className="app-main">
        {activeSection === 'jugadores' && <Jugadores organizacionId={currentOrgId} isAdmin={jugadorActual?.admin === true} />}
        {activeSection === 'partidos' && <Partidos organizacionId={currentOrgId} isAdmin={jugadorActual?.admin === true} isAuthenticated={isAuthenticated} jugadorActual={jugadorActual} />}
      </main>

      {showRegistroModal && user?.type === 'google' && (
        <RegistroJugador
          organizacionId={currentOrgId}
          userEmail={user.email}
          userDisplayName={user.displayName || ''}
          onClose={() => setShowRegistroModal(false)}
          onRegistered={() => {
            setShowRegistroModal(false)
            setYaRegistrado(true)
            getJugadorByEmail(user.email, currentOrgId).then((j) => setJugadorActual(j || null))
          }}
        />
      )}

      {showConfigModal && user?.type === 'google' && (
        <ConfigJugador
          userEmail={user.email}
          organizacionId={currentOrgId}
          onClose={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
          }}
          onEquipoPreview={setEquipoPreview}
          onSaved={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
            getJugadorByEmail(user.email, currentOrgId).then((j) => setJugadorActual(j || null))
          }}
          onCerrarSesion={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
            signOut()
          }}
          onAbrirInvitar={
            jugadorActual?.admin === true
              ? () => {
                  setEquipoPreview(null)
                  setShowConfigModal(false)
                  setShowInvitar(true)
                }
              : undefined
          }
        />
      )}
      {showInvitar && (
        <InvitarModal
          organizacionId={currentOrgId}
          creadoPor={user?.uid ?? ''}
          onClose={() => setShowInvitar(false)}
        />
      )}
    </div>
  )
}

export default App
