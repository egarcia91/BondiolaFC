import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useOrg } from './contexts/OrgContext'
import { getJugadorByEmail } from './services/firestore'
import Login from './components/Login'
import Jugadores from './components/Jugadores'
import Partidos from './components/Partidos'
import RegistroJugador from './components/RegistroJugador'
import ConfigJugador from './components/ConfigJugador'
import ElegirOrganizacion from './components/ElegirOrganizacion'
import UnirseConCodigoModal from './components/UnirseConCodigoModal'
import InvitarModal from './components/InvitarModal'
import { OrgProvider } from './contexts/OrgContext'
import './App.css'

const THEME_KEY = 'bondiola-fc-theme'

function App() {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="app app-loading">
        <p>Cargando…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <OrgProvider user={user}>
      <AppConOrg />
    </OrgProvider>
  )
}

function AppConOrg() {
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
            <h1><span className="header-ball" aria-hidden="true">⚽</span> {currentOrg?.nombre || 'Bondiola FC'}</h1>
            <p className="subtitle">Futbol en dos cómodas cuotas</p>
          </div>
          <div className="app-header-actions">
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
            {user?.type === 'google' && jugadorActual?.admin === true && (
              <button
                type="button"
                className="app-registro-btn"
                onClick={() => setShowInvitar(true)}
                title="Generar código de invitación"
              >
                Invitar
              </button>
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

      <nav className="app-nav">
        <button
          className={`nav-button ${activeSection === 'jugadores' ? 'active' : ''}`}
          onClick={() => setActiveSection('jugadores')}
        >
          Jugadores
        </button>
        <button
          className={`nav-button ${activeSection === 'partidos' ? 'active' : ''}`}
          onClick={() => setActiveSection('partidos')}
        >
          Partidos
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
          isAdmin={jugadorActual?.admin === true}
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
