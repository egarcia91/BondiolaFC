import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isFirebaseConfigured } from '../firebase'
import './Login.css'

/**
 * @param {{ onVolverInicio?: () => void }} props
 */
function Login({ onVolverInicio }) {
  const { signInWithGooglePopup, authError, clearAuthError } = useAuth()
  const [error, setError] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)

  const handleGoogleSignIn = async () => {
    setError('')
    clearAuthError()
    setLoadingGoogle(true)
    try {
      await signInWithGooglePopup()
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión con Google.')
    } finally {
      setLoadingGoogle(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {onVolverInicio && (
          <button
            type="button"
            className="login-volver"
            onClick={onVolverInicio}
          >
            ← Inicio
          </button>
        )}
        <h1 className="login-title">Cable a Tierra</h1>
        <p className="login-subtitle">¡Logueate para ver tus organizaciones!</p>

        {isFirebaseConfigured && (
          <button
            type="button"
            className="login-btn login-btn-google"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle}
          >
            {loadingGoogle ? (
              <span>Entrando…</span>
            ) : (
              <>
                <span className="login-btn-icon">G</span>
                Continuar con Google
              </>
            )}
          </button>
        )}

        {!isFirebaseConfigured && (
          <p className="login-hint">Configurá Firebase (archivo .env) para habilitar inicio con Google.</p>
        )}

        {error && <p className="login-error">{error}</p>}
        {authError && <p className="login-error" role="alert">{authError}</p>}
      </div>
    </div>
  )
}

export default Login
