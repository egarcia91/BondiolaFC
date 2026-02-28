import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isFirebaseConfigured } from '../firebase'
import './Login.css'

function Login() {
  const { signInWithGoogle, signInAsGuest } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión con Google.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">⚽ Bondiola FC</h1>
        <p className="login-subtitle">Fútbol en dos cómodas cuotas</p>

        <p className="login-text">Ingresá para ver jugadores y partidos.</p>

        {isFirebaseConfigured && (
          <>
            <button
              type="button"
              className="login-btn login-btn-google"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <span>Entrando…</span>
              ) : (
                <>
                  <span className="login-btn-icon">G</span>
                  Continuar con Google
                </>
              )}
            </button>
            <div className="login-divider">
              <span>o</span>
            </div>
          </>
        )}

        {!isFirebaseConfigured && (
          <p className="login-hint">Configurá Firebase (archivo .env) para habilitar inicio con Google.</p>
        )}

        <button
          type="button"
          className="login-btn login-btn-guest"
          onClick={signInAsGuest}
          disabled={loading}
        >
          Entrar como invitado
        </button>

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  )
}

export default Login
