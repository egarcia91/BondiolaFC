import { useState, useEffect } from 'react'
import jugadoresData from '../data/jugadores.json'
import './Jugadores.css'

function Jugadores() {
  const [jugadores, setJugadores] = useState([])

  useEffect(() => {
    setJugadores(jugadoresData)
  }, [])

  return (
    <div className="jugadores-container">
      <h2 className="section-title">Jugadores</h2>
      
      {jugadores.length === 0 ? (
        <p className="empty-state">No hay jugadores registrados</p>
      ) : (
        <div className="jugadores-grid">
          {jugadores.map((jugador) => (
            <div key={jugador.id} className="jugador-card">
              <div className="jugador-header">
                <h3 className="jugador-nombre">{jugador.nombre}</h3>
                <span className="jugador-posicion">{jugador.posicion}</span>
              </div>
              
              <div className="jugador-stats">
                <div className="stat-item">
                  <span className="stat-label">Edad:</span>
                  <span className="stat-value">{jugador.años} años</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Partidos:</span>
                  <span className="stat-value">{jugador.partidos}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Victorias:</span>
                  <span className="stat-value stat-success">{jugador.victorias}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Goles:</span>
                  <span className="stat-value stat-goals">{jugador.goles}</span>
                </div>
              </div>
              
              <div className="jugador-descripcion">
                <p>{jugador.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Jugadores
