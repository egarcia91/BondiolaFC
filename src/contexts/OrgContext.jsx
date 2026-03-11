import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getOrganizacionesForUser, getOrganizaciones } from '../services/firestore'

const ORG_KEY = 'bondiola-fc-org'

const OrgContext = createContext(null)

export function OrgProvider({ children, user }) {
  const [organizaciones, setOrganizaciones] = useState([])
  const [currentOrgId, setCurrentOrgIdState] = useState(() => localStorage.getItem(ORG_KEY))
  const [loading, setLoading] = useState(true)
  const [errorOrgs, setErrorOrgs] = useState(null)

  const uid = user?.uid ?? null
  const email = user?.email ?? null
  const isGoogle = user?.type === 'google'
  const isGuest = user?.type === 'guest'

  const setCurrentOrgId = useCallback((id) => {
    if (id) localStorage.setItem(ORG_KEY, id)
    else localStorage.removeItem(ORG_KEY)
    setCurrentOrgIdState(id)
  }, [])

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
          const saved = localStorage.getItem(ORG_KEY)
          if (saved && list.some((o) => o.id === saved)) {
            setCurrentOrgIdState(saved)
          } else if (list.length === 1) {
            setCurrentOrgIdState(list[0].id)
            localStorage.setItem(ORG_KEY, list[0].id)
          } else {
            setCurrentOrgIdState(null)
          }
        })
        .catch((err) => {
          console.error('Error al cargar organizaciones (invitado):', err)
          setOrganizaciones([])
          setErrorOrgs(err?.message || 'No se pudieron cargar las organizaciones')
        })
        .finally(() => setLoading(false))
      return
    }
    getOrganizacionesForUser(uid, email)
      .then((list) => {
        setOrganizaciones(list)
        const saved = localStorage.getItem(ORG_KEY)
        if (saved && list.some((o) => o.id === saved)) {
          setCurrentOrgIdState(saved)
        } else if (list.length === 1) {
          setCurrentOrgIdState(list[0].id)
          localStorage.setItem(ORG_KEY, list[0].id)
        } else {
          setCurrentOrgIdState(null)
        }
      })
      .catch(() => setOrganizaciones([]))
      .finally(() => setLoading(false))
  }, [uid, email, isGoogle, isGuest])

  const refreshOrganizaciones = useCallback(() => {
    if (isGuest) {
      setErrorOrgs(null)
      getOrganizaciones().then((list) => {
        setOrganizaciones(list)
        const saved = localStorage.getItem(ORG_KEY)
        if (saved && list.some((o) => o.id === saved)) setCurrentOrgIdState(saved)
        else if (list.length === 1) {
          setCurrentOrgIdState(list[0].id)
          localStorage.setItem(ORG_KEY, list[0].id)
        }
      }).catch((err) => {
        setOrganizaciones([])
        setErrorOrgs(err?.message || 'Error al cargar')
      })
      return
    }
    if (!isGoogle || !uid) return
    getOrganizacionesForUser(uid, email).then((list) => {
      setOrganizaciones(list)
      const saved = localStorage.getItem(ORG_KEY)
      if (saved && list.some((o) => o.id === saved)) setCurrentOrgIdState(saved)
      else if (list.length === 1) {
        setCurrentOrgIdState(list[0].id)
        localStorage.setItem(ORG_KEY, list[0].id)
      }
    })
  }, [uid, email, isGoogle, isGuest])

  const currentOrg = organizaciones.find((o) => o.id === currentOrgId) ?? null

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
