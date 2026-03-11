import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { getInvitacionByCodigo, marcarInvitacionUsada, addJugador } from '../services/firestore'
import './UnirseConCodigoModal.css'

function UnirseConCodigoModal({ codigoInicial = '', onClose, onUnido }) {
  const { user } = useAuth()
  const { refreshOrganizaciones, setCurrentOrgId } = useOrg()
  const [codigo, setCodigo] = useState(codigoInicial)

  useEffect(() => {
    if (codigoInicial) setCodigo(codigoInicial)
  }, [codigoInicial])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const code = (codigo || '').trim().toUpperCase()
    if (!code) {
      setError('Ingresá el código')
      return
    }
    if (user?.type !== 'google' || !user?.uid || !user?.email) {
      setError('Tenés que iniciar sesión con Google para unirte')
      return
    }
    setError('')
    setLoading(true)
    try {
      const inv = await getInvitacionByCodigo(code)
      if (!inv) {
        setError('Código inválido, vencido o ya usado')
        setLoading(false)
        return
      }
      await addJugador({
        organizacionId: inv.organizacionId,
        userId: user.uid,
        nombre: user.displayName || 'Jugador',
        apodo: (user.displayName || '').split(/\s/)[0] || 'Jugador',
        mail: user.email,
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
      await marcarInvitacionUsada(inv.id)
      refreshOrganizaciones()
      setCurrentOrgId(inv.organizacionId)
      onUnido?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al unirse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="unirse-codigo-overlay" onClick={onClose}>
      <div className="unirse-codigo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="unirse-codigo-header">
          <h3>Unirme con código</h3>
          <button type="button" className="unirse-codigo-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="unirse-codigo-form">
          <label className="unirse-codigo-label">
            Código de invitación
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej. ABC123"
              className="unirse-codigo-input"
              maxLength={10}
              autoComplete="off"
            />
          </label>
          {error && <p className="unirse-codigo-error">{error}</p>}
          <div className="unirse-codigo-actions">
            <button type="button" className="unirse-codigo-btn unirse-codigo-btn-sec" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="unirse-codigo-btn unirse-codigo-btn-primary" disabled={loading}>
              {loading ? 'Uniendo…' : 'Unirme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UnirseConCodigoModal
