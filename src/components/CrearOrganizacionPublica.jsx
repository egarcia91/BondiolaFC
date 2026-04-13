import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isFirebaseConfigured } from '../firebase'
import { CREAR_ORG_PERFIL_KEY } from '../constants/onboarding'
import './CrearOrganizacionPublica.css'

/**
 * @param {{ onVolver: () => void }} props
 */
export default function CrearOrganizacionPublica({ onVolver }) {
  const { signInWithGoogle, signInWithGooglePopup, authError, clearAuthError } = useAuth()
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [error, setError] = useState('')
  const [loadingRedirect, setLoadingRedirect] = useState(false)
  const [loadingPopup, setLoadingPopup] = useState(false)

  const validar = () => {
    const n = nombre.trim()
    const a = apellido.trim()
    if (n.length < 2) {
      setError('Ingresá un nombre válido (al menos 2 letras).')
      return false
    }
    if (a.length < 2) {
      setError('Ingresá un apellido válido (al menos 2 letras).')
      return false
    }
    if (!fechaNacimiento) {
      setError('Seleccioná tu fecha de nacimiento.')
      return false
    }
    const d = new Date(fechaNacimiento)
    if (Number.isNaN(d.getTime())) {
      setError('La fecha de nacimiento no es válida.')
      return false
    }
    return true
  }

  const guardarPerfilYGoogle = async (signInFn) => {
    setError('')
    clearAuthError()
    if (!validar()) return
    try {
      const payload = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        fechaNacimiento,
      }
      sessionStorage.setItem(CREAR_ORG_PERFIL_KEY, JSON.stringify(payload))
      await signInFn()
    } catch (err) {
      sessionStorage.removeItem(CREAR_ORG_PERFIL_KEY)
      setError(err.message || 'No se pudo iniciar sesión con Google.')
    }
  }

  const handleGoogleRedirect = async () => {
    setLoadingRedirect(true)
    try {
      await guardarPerfilYGoogle(signInWithGoogle)
    } finally {
      setLoadingRedirect(false)
    }
  }

  const handleGooglePopup = async () => {
    setLoadingPopup(true)
    try {
      await guardarPerfilYGoogle(signInWithGooglePopup)
    } finally {
      setLoadingPopup(false)
    }
  }

  return (
    <div className="crear-org-pub">
      <div className="crear-org-pub-inner">
        <button type="button" className="crear-org-pub-volver" onClick={onVolver}>
          ← Volver al inicio
        </button>
        <header className="crear-org-pub-header">
          <h1 className="crear-org-pub-title">Crear nueva organización</h1>
          <p className="crear-org-pub-subtitle">
            Completá tus datos y validá tu identidad con Google. No usamos usuario ni contraseña propios.
          </p>
        </header>

        <div className="crear-org-pub-card">
          <form
            className="crear-org-pub-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (isFirebaseConfigured) handleGoogleRedirect()
            }}
          >
            <label className="crear-org-pub-label" htmlFor="crear-org-nombre">
              Nombre
            </label>
            <input
              id="crear-org-nombre"
              type="text"
              className="crear-org-pub-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="given-name"
              required
              minLength={2}
            />

            <label className="crear-org-pub-label" htmlFor="crear-org-apellido">
              Apellido
            </label>
            <input
              id="crear-org-apellido"
              type="text"
              className="crear-org-pub-input"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              autoComplete="family-name"
              required
              minLength={2}
            />

            <label className="crear-org-pub-label" htmlFor="crear-org-fecha">
              Fecha de nacimiento
            </label>
            <input
              id="crear-org-fecha"
              type="date"
              className="crear-org-pub-input"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              required
            />

            {error && <p className="crear-org-pub-error">{error}</p>}
            {authError && <p className="crear-org-pub-error" role="alert">{authError}</p>}

            {!isFirebaseConfigured && (
              <p className="crear-org-pub-hint">Configurá Firebase (archivo .env) para habilitar Google.</p>
            )}

            {isFirebaseConfigured && (
              <>
                <button
                  type="submit"
                  className="crear-org-pub-btn crear-org-pub-btn-google"
                  disabled={loadingRedirect || loadingPopup}
                >
                  {loadingRedirect ? (
                    <span>Abriendo Google…</span>
                  ) : (
                    <>
                      <span className="crear-org-pub-btn-icon" aria-hidden="true">G</span>
                      Validar identidad con Google
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="crear-org-pub-btn crear-org-pub-btn-sec"
                  onClick={handleGooglePopup}
                  disabled={loadingRedirect || loadingPopup}
                >
                  {loadingPopup ? 'Abriendo…' : 'Usar ventana emergente'}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
