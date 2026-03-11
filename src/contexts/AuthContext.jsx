import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged, signInWithRedirect, signInWithPopup, getRedirectResult, signOut as firebaseSignOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

const AUTH_KEY = 'bondiola-fc-auth'
const AUTH_ERROR_KEY = 'bondiola-fc-auth-error'
const AUTH_REDIRECTING_KEY = 'bondiola-fc-auth-redirecting'

/** Mensaje legible para errores de Firebase Auth (redirect/popup) */
function mensajeAuthError(err) {
  const code = err?.code || ''
  const map = {
    'auth/unauthorized-domain': 'Este dominio no está autorizado. En Firebase Console → Authentication → Settings → Authorized domains, agregá este dominio (ej. localhost o tu URL).',
    'auth/operation-not-allowed': 'El proveedor Google no está habilitado. En Firebase Console → Authentication → Sign-in method, activá "Google".',
    'auth/popup-closed-by-user': 'Cerraste la ventana antes de terminar. Intentá de nuevo.',
    'auth/cancelled-popup-request': 'Se abrió otra ventana de login. Cerrala e intentá de nuevo.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de login. Permití ventanas emergentes para este sitio.',
    'auth/network-request-failed': 'Error de red. Revisá tu conexión e intentá de nuevo.',
    'auth/timeout': 'Tardó demasiado. Si estás en modo incógnito o con extensiones que bloquean cookies, probá en una ventana normal.',
    'auth/app-not-authorized': 'Esta app no está autorizada para usar Firebase Auth. Revisá la configuración del proyecto y dominios autorizados.',
  }
  return map[code] || err?.message || 'Error al iniciar sesión con Google.'
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(() => {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(AUTH_ERROR_KEY) || null
  })

  useEffect(() => {
    if (!auth) {
      const stored = localStorage.getItem(AUTH_KEY)
      setUser(stored === 'guest' ? { type: 'guest' } : null)
      setLoading(false)
      return
    }
    const init = async () => {
      try {
        const result = await getRedirectResult(auth)
        if (result?.user) {
          setUser({ type: 'google', ...result.user })
          setAuthError(null)
          localStorage.removeItem(AUTH_KEY)
          localStorage.removeItem(AUTH_ERROR_KEY)
          localStorage.removeItem(AUTH_REDIRECTING_KEY)
        } else {
          setAuthError(null)
          localStorage.removeItem(AUTH_ERROR_KEY)
          const wasRedirecting = localStorage.getItem(AUTH_REDIRECTING_KEY)
          localStorage.removeItem(AUTH_REDIRECTING_KEY)
          const stored = localStorage.getItem(AUTH_KEY)
          setUser(stored === 'guest' ? { type: 'guest' } : null)
          if (wasRedirecting) {
            const msg = 'El inicio de sesión no se completó (cancelado o error). Intentá de nuevo.'
            setAuthError(msg)
            localStorage.setItem(AUTH_ERROR_KEY, msg)
          }
        }
      } catch (err) {
        console.error('Error al procesar redirección de Google:', err)
        const message = mensajeAuthError(err)
        setAuthError(message)
        localStorage.setItem(AUTH_ERROR_KEY, message)
        localStorage.removeItem(AUTH_REDIRECTING_KEY)
        const stored = localStorage.getItem(AUTH_KEY)
        setUser(stored === 'guest' ? { type: 'guest' } : null)
      } finally {
        setLoading(false)
      }
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        localStorage.removeItem(AUTH_KEY)
        setUser({ type: 'google', ...firebaseUser })
        setLoading(false)
      } else {
        init()
      }
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      throw new Error('Google no está configurado. Usá "Entrar como invitado".')
    }
    setAuthError(null)
    localStorage.removeItem(AUTH_ERROR_KEY)
    localStorage.setItem(AUTH_REDIRECTING_KEY, '1')
    try {
      await signInWithRedirect(auth, googleProvider)
    } catch (err) {
      console.error('Error al iniciar sesión con Google:', err)
      const message = mensajeAuthError(err)
      setAuthError(message)
      localStorage.setItem(AUTH_ERROR_KEY, message)
      localStorage.removeItem(AUTH_REDIRECTING_KEY)
      throw new Error(message)
    }
  }, [])

  /** Inicio de sesión con ventana emergente (alternativa al redirect; suele funcionar cuando el redirect falla) */
  const signInWithGooglePopup = useCallback(async () => {
    if (!auth) {
      throw new Error('Google no está configurado. Usá "Entrar como invitado".')
    }
    setAuthError(null)
    localStorage.removeItem(AUTH_ERROR_KEY)
    localStorage.removeItem(AUTH_REDIRECTING_KEY)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      if (result?.user) {
        setUser({ type: 'google', ...result.user })
        localStorage.removeItem(AUTH_ERROR_KEY)
      }
    } catch (err) {
      console.error('Error al iniciar sesión con Google (popup):', err)
      const message = mensajeAuthError(err)
      setAuthError(message)
      localStorage.setItem(AUTH_ERROR_KEY, message)
      throw new Error(message)
    }
  }, [])

  const signInAsGuest = () => {
    setUser({ type: 'guest' })
    localStorage.setItem(AUTH_KEY, 'guest')
  }

  const signOut = async () => {
    if (user?.type === 'guest') {
      setUser(null)
      localStorage.removeItem(AUTH_KEY)
      return
    }
    if (auth) {
      await firebaseSignOut(auth)
    }
    setUser(null)
  }

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithGooglePopup,
    signInAsGuest,
    signOut,
    isAuthenticated: !!user,
    authError,
    clearAuthError: useCallback(() => {
      setAuthError(null)
      localStorage.removeItem(AUTH_ERROR_KEY)
    }, []),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
