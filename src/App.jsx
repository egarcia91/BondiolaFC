import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { getJugadorByEmail } from './services/firestore'
import Login from './components/Login'
import Jugadores from './components/Jugadores'
import Partidos from './components/Partidos'
import RegistroJugador from './components/RegistroJugador'
import ConfigJugador from './components/ConfigJugador'
import './App.css'

const THEME_KEY = 'bondiola-fc-theme'

function App() {
  const { user, loading, signOut, isAuthenticated } = useAuth()
  const [activeSection, setActiveSection] = useState('jugadores')
  const [showRegistroModal, setShowRegistroModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [yaRegistrado, setYaRegistrado] = useState(null)
  const [jugadorActual, setJugadorActual] = useState(null) // jugador vinculado al usuario (Google)
  const [equipoPreview, setEquipoPreview] = useState(null) // previsualización de equipo en modal config
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
    getJugadorByEmail(user.email)
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
  }, [isAuthenticated, user?.type, user?.email])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google') {
      setYaRegistrado(null)
      setJugadorActual(null)
    }
  }, [isAuthenticated, user?.type])

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
    <div className="app">
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-header-title">
            <h1><span className="header-ball" aria-hidden="true">⚽</span> Bondiola FC</h1>
            <p className="subtitle">Futbol en dos cómodas cuotas</p>
          </div>
          <div className="app-header-actions">
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
        {activeSection === 'jugadores' && <Jugadores isAdmin={jugadorActual?.admin === true} />}
        {activeSection === 'partidos' && <Partidos isAdmin={jugadorActual?.admin === true} />}
      </main>

      {showRegistroModal && user?.type === 'google' && (
        <RegistroJugador
          userEmail={user.email}
          userDisplayName={user.displayName || ''}
          onClose={() => setShowRegistroModal(false)}
          onRegistered={() => {
            setShowRegistroModal(false)
            setYaRegistrado(true)
            getJugadorByEmail(user.email).then((j) => setJugadorActual(j || null))
          }}
        />
      )}

      {showConfigModal && user?.type === 'google' && (
        <ConfigJugador
          userEmail={user.email}
          onClose={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
          }}
          onEquipoPreview={setEquipoPreview}
          onSaved={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
            getJugadorByEmail(user.email).then((j) => setJugadorActual(j || null))
          }}
          onCerrarSesion={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
            signOut()
          }}
        />
      )}
    </div>
  )
}

export default App
