import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Jugadores from './components/Jugadores'
import Partidos from './components/Partidos'
import RegistroJugador from './components/RegistroJugador'
import './App.css'

const THEME_KEY = 'bondiola-fc-theme'

function App() {
  const { user, loading, signOut, isAuthenticated } = useAuth()
  const [activeSection, setActiveSection] = useState('jugadores')
  const [showRegistroModal, setShowRegistroModal] = useState(false)
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
          <div>
            <h1>⚽ Bondiola FC</h1>
            <p className="subtitle">Futbol en dos cómodas cuotas</p>
          </div>
          <div className="app-header-actions">
            {user?.type === 'google' && (
              <button
                type="button"
                className="app-registro-btn"
                onClick={() => setShowRegistroModal(true)}
                title="Registrarme como jugador"
              >
                Mi jugador
              </button>
            )}
            <span className="app-user-badge">
              {user?.type === 'guest' ? 'Invitado' : user?.email}
            </span>
            <button
              type="button"
              className="app-logout"
              onClick={signOut}
              title="Cerrar sesión"
            >
              Salir
            </button>
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
        {activeSection === 'jugadores' && <Jugadores />}
        {activeSection === 'partidos' && <Partidos />}
      </main>

      {showRegistroModal && user?.type === 'google' && (
        <RegistroJugador
          userEmail={user.email}
          userDisplayName={user.displayName || ''}
          onClose={() => setShowRegistroModal(false)}
          onRegistered={() => setShowRegistroModal(false)}
        />
      )}
    </div>
  )
}

export default App
