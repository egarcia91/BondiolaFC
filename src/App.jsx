import { useState } from 'react'
import Jugadores from './components/Jugadores'
import Partidos from './components/Partidos'
import './App.css'

function App() {
  const [activeSection, setActiveSection] = useState('jugadores')

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚽ Bondiola FC</h1>
        <p className="subtitle">Futbol en dos cómodas cuotas</p>
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
    </div>
  )
}

export default App
