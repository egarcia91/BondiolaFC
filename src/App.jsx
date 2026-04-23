import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useOrg } from './contexts/OrgContext'
import { asegurarJugadorAdminCreador, eliminarOrganizacionSiCreador, getJugadorByEmail, getJugadores, getOrganizacion, getPartidos } from './services/firestore'
import Login from './components/Login'
import PantallaInicio from './components/PantallaInicio'
import WizardPrimeraOrganizacion from './components/WizardPrimeraOrganizacion'
import { CREAR_ORG_PERFIL_KEY } from './constants/onboarding'
import Jugadores from './components/Jugadores'
import Partidos from './components/Partidos'
import RegistroJugador from './components/RegistroJugador'
import ConfigJugador from './components/ConfigJugador'
import CrearOrganizacionPantalla from './components/CrearOrganizacionPantalla'
import UnirseConCodigoModal from './components/UnirseConCodigoModal'
import InvitarModal from './components/InvitarModal'
import IconoPaletaPadel from './components/IconoPaletaPadel'
import { OrgProvider } from './contexts/OrgContext'
import { deporteEsFutbol, deporteEsBasquet, deporteEsTenis, deporteEsPadel } from './utils/deporte'
import './App.css'

const THEME_KEY = 'bondiola-fc-theme'

function PortadaSesionGoogle({ onCerrar, onPedirCrearOrganizacionDirecto }) {
  const { setCurrentOrgId } = useOrg()
  return (
    <PantallaInicio
      modoConSesion
      onVolverAlPanel={onCerrar}
      onSeleccionarOrganizacion={(orgId) => {
        setCurrentOrgId(orgId)
        onCerrar()
      }}
      onCrearOrganizacion={() => {
        onPedirCrearOrganizacionDirecto?.()
        onCerrar()
      }}
    />
  )
}

function App() {
  const { user, loading, isAuthenticated } = useAuth()
  const [vistaAccesoPublico, setVistaAccesoPublico] = useState('inicio')
  /** Si el usuario llegó a login desde "Crear nueva organización" en la portada (sin sesión). */
  const [loginParaCrearOrganizacion, setLoginParaCrearOrganizacion] = useState(false)
  const [wizardPerfil, setWizardPerfil] = useState(null)
  const [portadaDesdeSesion, setPortadaDesdeSesion] = useState(false)
  /** Tras "Crear nueva organización" en la portada con sesión: abrir el formulario sin pasar por la lista. */
  const [forzarVistaCrearOrganizacion, setForzarVistaCrearOrganizacion] = useState(false)
  const eraAutenticadoRef = useRef(false)

  const consumirForzarVistaCrearOrganizacion = useCallback(() => {
    setForzarVistaCrearOrganizacion(false)
  }, [])

  const leerPerfilCrearOrg = useCallback(() => {
    if (typeof sessionStorage === 'undefined') return null
    try {
      const raw = sessionStorage.getItem(CREAR_ORG_PERFIL_KEY)
      if (!raw) return null
      const p = JSON.parse(raw)
      if (p?.nombre && p?.apellido && p?.fechaNacimiento) return p
    } catch {
      sessionStorage.removeItem(CREAR_ORG_PERFIL_KEY)
    }
    return null
  }, [])

  useEffect(() => {
    if (eraAutenticadoRef.current && !isAuthenticated) {
      setVistaAccesoPublico('inicio')
      setLoginParaCrearOrganizacion(false)
    }
    eraAutenticadoRef.current = isAuthenticated
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) setPortadaDesdeSesion(false)
    else setLoginParaCrearOrganizacion(false)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google') {
      setWizardPerfil(null)
      return
    }
    setWizardPerfil(leerPerfilCrearOrg())
  }, [isAuthenticated, user, leerPerfilCrearOrg])

  const handleWizardTerminado = useCallback(() => {
    sessionStorage.removeItem(CREAR_ORG_PERFIL_KEY)
    setWizardPerfil(null)
  }, [])

  if (loading) {
    return (
      <div className="app app-loading">
        <p>Cargando…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    if (vistaAccesoPublico === 'inicio') {
      return (
        <PantallaInicio
          onCrearOrganizacion={() => {
            setLoginParaCrearOrganizacion(true)
            setVistaAccesoPublico('login')
          }}
          onIrALogin={() => {
            setLoginParaCrearOrganizacion(false)
            setVistaAccesoPublico('login')
          }}
        />
      )
    }
    return (
      <Login
        paraCrearOrganizacion={loginParaCrearOrganizacion}
        onVolverInicio={() => {
          setLoginParaCrearOrganizacion(false)
          setVistaAccesoPublico('inicio')
        }}
      />
    )
  }

  if (user?.type === 'google' && wizardPerfil) {
    return (
      <OrgProvider user={user}>
        <WizardPrimeraOrganizacion perfil={wizardPerfil} onTerminado={handleWizardTerminado} />
      </OrgProvider>
    )
  }

  return (
    <OrgProvider user={user}>
      {portadaDesdeSesion ? (
        <PortadaSesionGoogle
          onCerrar={() => setPortadaDesdeSesion(false)}
          onPedirCrearOrganizacionDirecto={() => setForzarVistaCrearOrganizacion(true)}
        />
      ) : (
        <AppConOrg
          onAbrirPortada={() => setPortadaDesdeSesion(true)}
          forzarVistaCrearOrganizacion={forzarVistaCrearOrganizacion}
          onConsumidoForzarVistaCrearOrganizacion={consumirForzarVistaCrearOrganizacion}
          onPedirCrearOrganizacionDirecto={() => setForzarVistaCrearOrganizacion(true)}
        />
      )}
    </OrgProvider>
  )
}

/**
 * Contenedor con org activa o formulario de creación. `onAbrirPortada` abre la portada con sesión.
 * @param {{
 *   onAbrirPortada?: () => void,
 *   forzarVistaCrearOrganizacion?: boolean,
 *   onConsumidoForzarVistaCrearOrganizacion?: () => void,
 *   onPedirCrearOrganizacionDirecto?: () => void,
 * }} props
 */
function AppConOrg({
  onAbrirPortada,
  forzarVistaCrearOrganizacion = false,
  onConsumidoForzarVistaCrearOrganizacion,
  onPedirCrearOrganizacionDirecto,
}) {
  const { user, signOut, isAuthenticated } = useAuth()
  const {
    organizaciones,
    currentOrgId,
    currentOrg,
    setCurrentOrgId,
    loading: orgLoading,
    refreshOrganizaciones,
    errorOrgs,
  } = useOrg()
  const [activeSection, setActiveSection] = useState('jugadores')
  const [showRegistroModal, setShowRegistroModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showUnirseCodigo, setShowUnirseCodigo] = useState(false)
  const [errorCrearOrganizacion, setErrorCrearOrganizacion] = useState(null)
  const abrioPortadaSinOrgsRef = useRef(false)
  const [showInvitar, setShowInvitar] = useState(false)
  const [yaRegistrado, setYaRegistrado] = useState(null)
  const [jugadorActual, setJugadorActual] = useState(null)
  const [equipoPreview, setEquipoPreview] = useState(null)
  /** Contadores de la org: jugadores con ≥1 partido, partidos concluidos. */
  const [orgStats, setOrgStats] = useState({ jugadoresActivos: null, partidosJugados: null })
  /** Si la lista del contexto aún no trae nombre, se completa con una lectura directa del doc. */
  const [headerOrgSnap, setHeaderOrgSnap] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [isDarkMode])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google') {
      document.documentElement.setAttribute('data-equipo', 'azul')
      return
    }
    const equipo = equipoPreview ?? (jugadorActual?.equipoFavorito === 'rojo' ? 'rojo' : 'azul')
    document.documentElement.setAttribute('data-equipo', equipo)
  }, [isAuthenticated, user?.type, equipoPreview, jugadorActual?.equipoFavorito])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google' || !user?.email) return
    let cancelled = false
    getJugadorByEmail(user.email, currentOrgId || null)
      .then((jugador) => {
        if (cancelled) return
        setJugadorActual(jugador || null)
        setYaRegistrado(!!jugador)
      })
      .catch(() => {
        if (!cancelled) {
          setJugadorActual(null)
          setYaRegistrado(false)
        }
      })
    return () => { cancelled = true }
  }, [isAuthenticated, user?.type, user?.email, currentOrgId])

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'google') {
      setYaRegistrado(null)
      setJugadorActual(null)
    }
  }, [isAuthenticated, user?.type])

  useEffect(() => {
    if (!currentOrgId) return
    let cancelled = false
    setOrgStats({ jugadoresActivos: null, partidosJugados: null })
    Promise.all([getJugadores(currentOrgId), getPartidos(currentOrgId)])
      .then(([jugadores, partidos]) => {
        if (cancelled) return
        const jugadoresActivos = jugadores.filter((j) => (j.partidos ?? 0) >= 1).length
        const partidosJugados = partidos.filter((p) => p.concluido === true).length
        setOrgStats({ jugadoresActivos, partidosJugados })
      })
      .catch(() => {
        if (!cancelled) setOrgStats({ jugadoresActivos: 0, partidosJugados: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [currentOrgId])

  useEffect(() => {
    if (!currentOrgId) {
      setHeaderOrgSnap(null)
      return
    }
    if ((currentOrg?.nombre || '').trim()) {
      setHeaderOrgSnap(null)
      return
    }
    let cancelled = false
    getOrganizacion(currentOrgId)
      .then((org) => {
        if (!cancelled) setHeaderOrgSnap(org)
      })
      .catch(() => {
        if (!cancelled) setHeaderOrgSnap(null)
      })
    return () => {
      cancelled = true
    }
  }, [currentOrgId, currentOrg?.id, currentOrg?.nombre])

  const nombreTituloHeader = useMemo(
    () => (currentOrg?.nombre || headerOrgSnap?.nombre || '').trim(),
    [currentOrg?.nombre, headerOrgSnap?.nombre]
  )
  const deporteHeader = currentOrg?.deporte ?? headerOrgSnap?.deporte
  const fraseHeader = (currentOrg?.frase ?? headerOrgSnap?.frase ?? '').trim()

  useEffect(() => {
    if (user?.type !== 'google') return
    if (typeof window === 'undefined') return
    const invite = new URLSearchParams(window.location.search).get('invite')
    if (invite) setShowUnirseCodigo(true)
  }, [user?.type])

  useEffect(() => {
    if (orgLoading || user?.type !== 'google' || !isAuthenticated) return
    if (forzarVistaCrearOrganizacion) return
    if (organizaciones.length > 0) {
      abrioPortadaSinOrgsRef.current = false
      return
    }
    if (abrioPortadaSinOrgsRef.current) return
    abrioPortadaSinOrgsRef.current = true
    onAbrirPortada?.()
  }, [orgLoading, user?.type, isAuthenticated, organizaciones.length, forzarVistaCrearOrganizacion, onAbrirPortada])

  if (forzarVistaCrearOrganizacion && user?.type === 'google') {
    const inviteCodigo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') || '' : ''
    return (
      <div className="app">
        {errorCrearOrganizacion && (
          <p className="app-inline-error" role="alert">{errorCrearOrganizacion}</p>
        )}
        <CrearOrganizacionPantalla
          user={user}
          onVolver={() => {
            setErrorCrearOrganizacion(null)
            onConsumidoForzarVistaCrearOrganizacion?.()
            onAbrirPortada?.()
          }}
          onCreada={async (orgId) => {
            setErrorCrearOrganizacion(null)
            try {
              await asegurarJugadorAdminCreador(orgId, user)
              await refreshOrganizaciones()
            } catch (e) {
              console.error(e)
              setErrorCrearOrganizacion(e?.message || 'No se pudo completar el alta del administrador.')
            }
            setCurrentOrgId(orgId)
            onConsumidoForzarVistaCrearOrganizacion?.()
          }}
        />
        {showUnirseCodigo && (
          <UnirseConCodigoModal
            codigoInicial={inviteCodigo}
            onClose={() => setShowUnirseCodigo(false)}
            onUnido={() => setShowUnirseCodigo(false)}
          />
        )}
      </div>
    )
  }

  if (orgLoading) {
    return (
      <div className="app app-loading">
        <p>Cargando…</p>
      </div>
    )
  }

  if (!currentOrgId) {
    const inviteCodigo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') || '' : ''
    return (
      <div className="app app-loading app-sin-org-fallback">
        {errorOrgs && <p className="app-inline-error" role="alert">{errorOrgs}</p>}
        <p>No hay una organización para mostrar.</p>
        {user?.type === 'google' && (
          <>
            <button
              type="button"
              className="app-registro-btn"
              onClick={() => onPedirCrearOrganizacionDirecto?.()}
            >
              Crear nueva organización
            </button>
            <button
              type="button"
              className="app-registro-btn"
              onClick={() => setShowUnirseCodigo(true)}
            >
              Unirme con código
            </button>
            {onAbrirPortada && (
              <button type="button" className="app-registro-btn" onClick={onAbrirPortada}>
                Pantalla principal
              </button>
            )}
          </>
        )}
        {user?.type === 'guest' && (
          <button type="button" className="app-registro-btn" onClick={() => signOut()}>
            Volver al inicio
          </button>
        )}
        {showUnirseCodigo && user?.type === 'google' && (
          <UnirseConCodigoModal
            codigoInicial={inviteCodigo}
            onClose={() => setShowUnirseCodigo(false)}
            onUnido={() => setShowUnirseCodigo(false)}
          />
        )}
      </div>
    )
  }

  const esCreadorOrganizacionActual =
    user?.type === 'google'
    && !!user?.uid
    && !!currentOrg?.creadoPor
    && String(currentOrg.creadoPor).trim() === String(user.uid).trim()

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-header-title">
            <h1>
              {deporteEsFutbol(deporteHeader) && (
                <>
                  <span className="header-ball" aria-hidden="true" title="Fútbol">⚽</span>{' '}
                </>
              )}
              {deporteEsPadel(deporteHeader) && (
                <>
                  <span className="header-ball header-ball--padel" title="Pádel">
                    <IconoPaletaPadel />
                  </span>{' '}
                </>
              )}
              {deporteEsBasquet(deporteHeader) && (
                <>
                  <span className="header-ball" aria-hidden="true" title="Básquet">🏀</span>{' '}
                </>
              )}
              {deporteEsTenis(deporteHeader) && (
                <>
                  <span className="header-ball" aria-hidden="true" title="Tenis">🎾</span>{' '}
                </>
              )}
              {nombreTituloHeader || 'Organización'}
            </h1>
            <p className="subtitle">
              {fraseHeader
                ? fraseHeader
                : `Estadísticas de ${deporteHeader || 'Futbol'} día a día`}
            </p>
          </div>
          <div className="app-header-actions">
            {user?.type === 'google' && currentOrgId && onAbrirPortada && (
              <button
                type="button"
                className="app-registro-btn"
                onClick={onAbrirPortada}
                title="Volver al inicio público"
              >
                Pantalla principal
              </button>
            )}
            {user?.type === 'google' && (
              <>
                {yaRegistrado === false && (
                  <button
                    type="button"
                    className="app-registro-btn"
                    onClick={() => setShowRegistroModal(true)}
                    title="Registrarme como jugador"
                  >
                    Mi jugador
                  </button>
                )}
                <button
                  type="button"
                  className="app-icon-btn"
                  onClick={() => setShowConfigModal(true)}
                  title="Configuración de perfil"
                  aria-label="Configuración"
                >
                  ⚙
                </button>
              </>
            )}
            <span className="app-user-badge" title={user?.type === 'google' && jugadorActual ? user?.email : undefined}>
              {user?.type === 'guest' ? 'Invitado' : (jugadorActual?.apodo || user?.email)}
            </span>
            {user?.type === 'guest' && (
              <button
                type="button"
                className="app-registro-btn"
                onClick={signOut}
                title="Iniciar sesión con Google"
              >
                Login
              </button>
            )}
            <button
            type="button"
            className="theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
            aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDarkMode ? '○' : '●'}
          </button>
          </div>
        </div>
      </header>

      <nav className="app-nav" aria-live="polite">
        <button
          type="button"
          className={`nav-button ${activeSection === 'jugadores' ? 'active' : ''}`}
          onClick={() => setActiveSection('jugadores')}
          title="Jugadores de la organización que jugaron al menos un partido"
        >
          <span className="nav-button-label">Jugadores</span>
          <span className="nav-button-count">{orgStats.jugadoresActivos ?? '…'}</span>
        </button>
        <button
          type="button"
          className={`nav-button ${activeSection === 'partidos' ? 'active' : ''}`}
          onClick={() => setActiveSection('partidos')}
          title="Partidos con resultado cargado en la organización"
        >
          <span className="nav-button-label">Partidos</span>
          <span className="nav-button-count">{orgStats.partidosJugados ?? '…'}</span>
        </button>
      </nav>

      <main className="app-main">
        {activeSection === 'jugadores' && <Jugadores organizacionId={currentOrgId} isAdmin={jugadorActual?.admin === true} />}
        {activeSection === 'partidos' && <Partidos organizacionId={currentOrgId} isAdmin={jugadorActual?.admin === true} isAuthenticated={isAuthenticated} jugadorActual={jugadorActual} />}
      </main>

      {showRegistroModal && user?.type === 'google' && (
        <RegistroJugador
          organizacionId={currentOrgId}
          userEmail={user.email}
          userDisplayName={user.displayName || ''}
          onClose={() => setShowRegistroModal(false)}
          onRegistered={() => {
            setShowRegistroModal(false)
            setYaRegistrado(true)
            getJugadorByEmail(user.email, currentOrgId).then((j) => setJugadorActual(j || null))
          }}
        />
      )}

      {showConfigModal && user?.type === 'google' && (
        <ConfigJugador
          userEmail={user.email}
          organizacionId={currentOrgId}
          organizaciones={organizaciones}
          currentOrgId={currentOrgId}
          onCambiarOrganizacion={setCurrentOrgId}
          onAbrirUnirseCodigo={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
            setShowUnirseCodigo(true)
          }}
          onClose={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
          }}
          onEquipoPreview={setEquipoPreview}
          onSaved={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
            getJugadorByEmail(user.email, currentOrgId).then((j) => setJugadorActual(j || null))
          }}
          onCerrarSesion={() => {
            setEquipoPreview(null)
            setShowConfigModal(false)
            signOut()
          }}
          onAbrirInvitar={
            jugadorActual?.admin === true
              ? () => {
                  setEquipoPreview(null)
                  setShowConfigModal(false)
                  setShowInvitar(true)
                }
              : undefined
          }
          puedeEliminarOrganizacion={esCreadorOrganizacionActual}
          nombreOrganizacion={nombreTituloHeader}
          onEliminarOrganizacion={
            esCreadorOrganizacionActual && currentOrgId
              ? async () => {
                  await eliminarOrganizacionSiCreador(currentOrgId, user.uid)
                  await refreshOrganizaciones()
                }
              : undefined
          }
        />
      )}
      {showInvitar && (
        <InvitarModal
          organizacionId={currentOrgId}
          creadoPor={user?.uid ?? ''}
          onClose={() => setShowInvitar(false)}
        />
      )}
      {showUnirseCodigo && user?.type === 'google' && (
        <UnirseConCodigoModal
          codigoInicial={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') || '' : ''}
          onClose={() => setShowUnirseCodigo(false)}
          onUnido={() => setShowUnirseCodigo(false)}
        />
      )}
    </div>
  )
}

export default App
