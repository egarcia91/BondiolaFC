import { useState, useEffect, useCallback } from 'react'
import { getResumenPublicoOrganizaciones } from '../services/firestore'
import { isFirebaseConfigured } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { ORG_STORAGE_KEY } from '../contexts/OrgContext'
import { deporteEsFutbol, deporteTextoLista, deporteAbreviatura } from '../utils/deporte'
import './PantallaInicio.css'

/**
 * @param {{
 *   onCrearOrganizacion: () => void,
 *   onIrALogin?: () => void,
 *   modoConSesion?: boolean,
 *   onVolverAlPanel?: () => void,
 *   onSeleccionarOrganizacion?: (organizacionId: string) => void,
 * }} props
 */
export default function PantallaInicio({
  onCrearOrganizacion,
  onIrALogin,
  modoConSesion = false,
  onVolverAlPanel,
  onSeleccionarOrganizacion,
}) {
  const { signInAsGuest } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filas, setFilas] = useState([])

  const entrarComoInvitadoEn = useCallback(
    (organizacionId) => {
      if (!organizacionId) return
      localStorage.setItem(ORG_STORAGE_KEY, organizacionId)
      signInAsGuest()
    },
    [signInAsGuest]
  )

  const handleClickOrganizacion = useCallback(
    (organizacionId) => {
      if (modoConSesion && onSeleccionarOrganizacion) {
        onSeleccionarOrganizacion(organizacionId)
      } else {
        entrarComoInvitadoEn(organizacionId)
      }
    },
    [modoConSesion, onSeleccionarOrganizacion, entrarComoInvitadoEn]
  )

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      setFilas([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getResumenPublicoOrganizaciones()
      .then(({ organizaciones, statsPorId }) => {
        if (cancelled) return
        setFilas(
          organizaciones.map((org) => ({
            org,
            ...statsPorId[org.id],
          }))
        )
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'No se pudieron cargar las organizaciones.')
          setFilas([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="pantalla-inicio">
      <div className="pantalla-inicio-inner">
        <header className="pantalla-inicio-header">
          <p className="pantalla-inicio-kicker">Bienvenidos a</p>
          <h1 className="pantalla-inicio-title">
            Cable a Tierra
          </h1>
          <p className="pantalla-inicio-subtitle">¡Estadísticas de tu deporte día a día!</p>
          {modoConSesion && onVolverAlPanel && (
            <button
              type="button"
              className="pantalla-inicio-btn-volver-panel"
              onClick={onVolverAlPanel}
            >
              Volver al panel
            </button>
          )}
        </header>

        <section className="pantalla-inicio-panel" aria-labelledby="pantalla-inicio-org-heading">
          <h2 id="pantalla-inicio-org-heading" className="pantalla-inicio-panel-title">
            Organizaciones
          </h2>
          {!loading && !error && filas.length > 0 && (
            <p className="pantalla-inicio-panel-hint">
              {modoConSesion
                ? 'Hacé clic en una organización para abrirla con tu cuenta.'
                : 'Hacé clic en una organización para verla como invitado.'}
            </p>
          )}
          {!isFirebaseConfigured && (
            <p className="pantalla-inicio-hint">Configurá Firebase para ver el listado.</p>
          )}
          {loading && isFirebaseConfigured && (
            <p className="pantalla-inicio-loading">Cargando…</p>
          )}
          {error && <p className="pantalla-inicio-error" role="alert">{error}</p>}
          {!loading && !error && isFirebaseConfigured && filas.length === 0 && (
            <p className="pantalla-inicio-empty">Todavía no hay organizaciones registradas.</p>
          )}
          {!loading && !error && filas.length > 0 && (
            <div className="pantalla-inicio-org-table">
              <div className="pantalla-inicio-grid pantalla-inicio-grid--header" aria-hidden="true">
                <span className="pantalla-inicio-th pantalla-inicio-th--deporte">Dep.</span>
                <span className="pantalla-inicio-th pantalla-inicio-th--nombre">Organización</span>
                <span className="pantalla-inicio-th pantalla-inicio-th--num">Jugadores</span>
                <span className="pantalla-inicio-th pantalla-inicio-th--num">Partidos</span>
                <span className="pantalla-inicio-th pantalla-inicio-th--num">Goles</span>
              </div>
              <ul className="pantalla-inicio-list">
                {filas.map(({ org, jugadoresActivos, partidosJugados, golesTotales }) => {
                  const nombreOrg = org.nombre || org.id
                  const deporteOrg = org.deporte || 'Futbol'
                  const esFutbol = deporteEsFutbol(deporteOrg)
                  const golesOrg = typeof golesTotales === 'number' ? golesTotales : 0
                  const ariaLabelBtn = modoConSesion
                    ? (esFutbol
                      ? `Abrir organización ${nombreOrg}`
                      : `Abrir organización ${nombreOrg}, ${deporteTextoLista(deporteOrg)}`)
                    : (esFutbol
                      ? `Entrar como invitado en ${nombreOrg}`
                      : `Entrar como invitado en ${nombreOrg}, ${deporteTextoLista(deporteOrg)}`)
                  return (
                    <li key={org.id} className="pantalla-inicio-li">
                      <button
                        type="button"
                        className="pantalla-inicio-item pantalla-inicio-grid"
                        onClick={() => handleClickOrganizacion(org.id)}
                        aria-label={ariaLabelBtn}
                      >
                        <span
                          className="pantalla-inicio-col-deporte"
                          title={esFutbol ? 'Fútbol' : deporteTextoLista(deporteOrg)}
                        >
                          {esFutbol ? (
                            <span className="pantalla-inicio-item-ball" role="img" aria-label="Fútbol">⚽</span>
                          ) : (
                            <span className="pantalla-inicio-deporte-texto">{deporteAbreviatura(deporteOrg)}</span>
                          )}
                        </span>
                        <span className="pantalla-inicio-col-nombre" title={nombreOrg}>
                          {nombreOrg}
                        </span>
                        <span
                          className="pantalla-inicio-col-num"
                          title="Jugadores que jugaron al menos un partido"
                        >
                          {jugadoresActivos}
                        </span>
                        <span className="pantalla-inicio-col-num" title="Partidos con resultado cargado">
                          {partidosJugados}
                        </span>
                        <span
                          className="pantalla-inicio-col-num"
                          title="Suma de goles de ambos equipos en todos los partidos de la organización"
                        >
                          {golesOrg}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>

        <div className="pantalla-inicio-actions">
          <button type="button" className="pantalla-inicio-btn-ingresar" onClick={onCrearOrganizacion}>
            Crear nueva organización
          </button>
          {!modoConSesion && onIrALogin && (
            <button type="button" className="pantalla-inicio-btn-secundario" onClick={onIrALogin}>
              Ya tengo cuenta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
