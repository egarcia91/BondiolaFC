import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getOrganizacionesForUser, getOrganizaciones } from '../services/firestore'

/** Clave `localStorage` para la organización del invitado (portada pública → entrar sin cuenta). */
export const ORG_STORAGE_KEY = 'bondiola-fc-org'

/**
 * Clave donde persiste la última organización abierta con Google (por `uid`).
 * @param {{ type?: string, uid?: string } | null | undefined} user
 * @returns {string}
 */
export function getOrgStorageKeyForUser(user) {
  if (user?.type === 'google' && user?.uid) {
    return `${ORG_STORAGE_KEY}-google-${user.uid}`
  }
  return ORG_STORAGE_KEY
}

/**
 * @param {Array<{ id: string }>} list
 * @param {string} googleKey
 * @returns {string | null} id guardado válido o null
 */
function idEnLista(list, id) {
  if (id == null || id === '') return false
  const want = String(id).trim()
  return list.some((o) => String(o.id) === want)
}

/** Normaliza id de organización para estado y comparaciones. */
function normalizeOrgIdState(id) {
  if (id == null || id === '') return null
  const t = String(id).trim()
  return t || null
}

function leerUltimaOrgGoogle(list, googleKey) {
  let saved = localStorage.getItem(googleKey)?.trim()
  if (saved && idEnLista(list, saved)) return saved
  if (saved) localStorage.removeItem(googleKey)

  const legacy = localStorage.getItem(ORG_STORAGE_KEY)?.trim()
  if (legacy && idEnLista(list, legacy)) {
    localStorage.setItem(googleKey, legacy)
    return legacy
  }
  return null
}

/**
 * Primera organización por nombre (fallback cuando no hay última guardada válida).
 * @param {Array<{ id: string, nombre?: string }>} list
 * @param {string | null} storageKey - si no es null, conviene persistir en localStorage
 */
function elegirPrimeraOrg(list, storageKey) {
  if (!list.length) return { id: null, persistir: null }
  const sorted = [...list].sort((a, b) =>
    (a.nombre || a.id || '').localeCompare(b.nombre || b.id || '', 'es', { sensitivity: 'base' })
  )
  return { id: sorted[0].id, persistir: storageKey }
}

/**
 * @param {Array<{ id: string }>} list
 * @param {string | null} saved
 */
function aplicarOrgInicialGuest(list, saved) {
  const savedTrim = saved?.trim?.() ?? saved
  if (savedTrim && idEnLista(list, savedTrim)) {
    return { id: String(savedTrim), persistir: null }
  }
  if (saved) localStorage.removeItem(ORG_STORAGE_KEY)
  return elegirPrimeraOrg(list, ORG_STORAGE_KEY)
}

/**
 * @param {Array<{ id: string }>} list
 * @param {string | null} saved
 * @param {string} googleKey
 */
function aplicarOrgInicialGoogle(list, saved, googleKey) {
  const savedTrim = saved?.trim?.() ?? saved
  if (savedTrim && idEnLista(list, savedTrim)) {
    return { id: String(savedTrim), persistir: googleKey }
  }
  if (saved) localStorage.removeItem(googleKey)
  return elegirPrimeraOrg(list, googleKey)
}

const OrgContext = createContext(null)

export function OrgProvider({ children, user }) {
  const [organizaciones, setOrganizaciones] = useState([])
  const [currentOrgId, setCurrentOrgIdState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorOrgs, setErrorOrgs] = useState(null)

  const uid = user?.uid ?? null
  const email = user?.email ?? null
  const isGoogle = user?.type === 'google'
  const isGuest = user?.type === 'guest'

  const setCurrentOrgId = useCallback(
    (id) => {
      const key = getOrgStorageKeyForUser(user)
      const normalized = normalizeOrgIdState(id)
      if (normalized) localStorage.setItem(key, normalized)
      else localStorage.removeItem(key)
      setCurrentOrgIdState(normalized)
    },
    [user]
  )

  useEffect(() => {
    if (!isGoogle && !isGuest) {
      setOrganizaciones([])
      setCurrentOrgIdState(null)
      setErrorOrgs(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setErrorOrgs(null)
    if (isGuest) {
      getOrganizaciones()
        .then((list) => {
          setOrganizaciones(list)
          setErrorOrgs(null)
          const saved = localStorage.getItem(ORG_STORAGE_KEY)
          const { id, persistir } = aplicarOrgInicialGuest(list, saved)
          const idNorm = normalizeOrgIdState(id)
          setCurrentOrgIdState(idNorm)
          if (persistir && idNorm) localStorage.setItem(persistir, idNorm)
        })
        .catch((err) => {
          console.error('Error al cargar organizaciones (invitado):', err)
          setOrganizaciones([])
          setErrorOrgs(err?.message || 'No se pudieron cargar las organizaciones')
        })
        .finally(() => setLoading(false))
      return
    }
    const googleKey = getOrgStorageKeyForUser({ type: 'google', uid })
    getOrganizacionesForUser(uid, email)
      .then((list) => {
        setOrganizaciones(list)
        const saved = leerUltimaOrgGoogle(list, googleKey)
        const { id, persistir } = aplicarOrgInicialGoogle(list, saved, googleKey)
        const idNorm = normalizeOrgIdState(id)
        setCurrentOrgIdState(idNorm)
        if (persistir && idNorm) localStorage.setItem(persistir, idNorm)
      })
      .catch(() => setOrganizaciones([]))
      .finally(() => setLoading(false))
  }, [uid, email, isGoogle, isGuest])

  const refreshOrganizaciones = useCallback(() => {
    if (isGuest) {
      setErrorOrgs(null)
      return getOrganizaciones()
        .then((list) => {
          setOrganizaciones(list)
          const saved = localStorage.getItem(ORG_STORAGE_KEY)
          const { id, persistir } = aplicarOrgInicialGuest(list, saved)
          const idNorm = normalizeOrgIdState(id)
          setCurrentOrgIdState(idNorm)
          if (persistir && idNorm) localStorage.setItem(persistir, idNorm)
        })
        .catch((err) => {
          setOrganizaciones([])
          setErrorOrgs(err?.message || 'Error al cargar')
        })
    }
    if (!isGoogle || !uid) return Promise.resolve()
    const googleKey = getOrgStorageKeyForUser({ type: 'google', uid })
    return getOrganizacionesForUser(uid, email).then((list) => {
      setOrganizaciones(list)
      const saved = leerUltimaOrgGoogle(list, googleKey)
      const { id, persistir } = aplicarOrgInicialGoogle(list, saved, googleKey)
      const idNorm = normalizeOrgIdState(id)
      setCurrentOrgIdState(idNorm)
      if (persistir && idNorm) localStorage.setItem(persistir, idNorm)
    })
  }, [uid, email, isGoogle, isGuest])

  const currentOrg =
    organizaciones.find((o) => String(o.id).trim() === String(currentOrgId ?? '').trim()) ?? null

  const value = {
    organizaciones,
    currentOrgId,
    currentOrg,
    setCurrentOrgId,
    loading,
    refreshOrganizaciones,
    errorOrgs,
  }

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (!context) {
    throw new Error('useOrg debe usarse dentro de OrgProvider')
  }
  return context
}
