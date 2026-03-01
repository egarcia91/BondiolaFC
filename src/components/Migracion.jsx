import { useState } from 'react'
import { getJugadores, getPartidos, addJugador, addPartido } from '../services/firestore'
import jugadoresData from '../data/jugadores.json'
import partidosData from '../data/partidos.json'
import './Migracion.css'

function Migracion() {
  const [status, setStatus] = useState('idle') // idle | checking | migrating | done | error
  const [message, setMessage] = useState('')

  const runMigration = async () => {
    setStatus('checking')
    setMessage('')
    try {
      const [existingJugadores, existingPartidos] = await Promise.all([
        getJugadores(),
        getPartidos(),
      ])
      if (existingJugadores.length > 0 || existingPartidos.length > 0) {
        setStatus('done')
        setMessage(`Ya hay datos en Firestore (${existingJugadores.length} jugadores, ${existingPartidos.length} partidos). No se migró para evitar duplicados.`)
        return
      }

      setStatus('migrating')
      setMessage('Migrando jugadores…')
      let countJ = 0
      for (const jugador of jugadoresData) {
        await addJugador(jugador)
        countJ++
      }
      setMessage('Migrando partidos…')
      let countP = 0
      for (const partido of partidosData) {
        await addPartido(partido)
        countP++
      }
      setStatus('done')
      setMessage(`Listo: ${countJ} jugadores y ${countP} partidos migrados a Firestore.`)
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Error al migrar.')
    }
  }

  return (
    <div className="migracion">
      <h2 className="section-title">Migrar datos a Firestore</h2>
      <p className="migracion-desc">
        Copia los jugadores y partidos desde los archivos locales a la base de datos de Firebase.
        Solo conviene ejecutarlo una vez.
      </p>
      <button
        type="button"
        className="migracion-btn"
        onClick={runMigration}
        disabled={status === 'checking' || status === 'migrating'}
      >
        {status === 'checking' && 'Comprobando…'}
        {status === 'migrating' && 'Migrando…'}
        {(status === 'idle' || status === 'error') && 'Migrar datos a Firestore'}
        {status === 'done' && 'Migración lista'}
      </button>
      {message && (
        <p className={`migracion-message ${status === 'error' ? 'migracion-error' : ''}`}>
          {message}
        </p>
      )}
    </div>
  )
}

export default Migracion
