import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

const AUTH_KEY = 'bondiola-fc-auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      const stored = localStorage.getItem(AUTH_KEY)
      setUser(stored === 'guest' ? { type: 'guest' } : null)
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        localStorage.removeItem(AUTH_KEY)
        setUser({ type: 'google', ...firebaseUser })
      } else {
        const stored = localStorage.getItem(AUTH_KEY)
        setUser(stored === 'guest' ? { type: 'guest' } : null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    if (!auth) {
      throw new Error('Google no está configurado. Usá "Entrar como invitado".')
    }
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error('Error al iniciar sesión con Google:', err)
      throw err
    }
  }

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
    signInAsGuest,
    signOut,
    isAuthenticated: !!user,
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
