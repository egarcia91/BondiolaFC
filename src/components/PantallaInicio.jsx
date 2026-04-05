import { useState, useEffect, useCallback } from 'react'
import { getResumenPublicoOrganizaciones } from '../services/firestore'
import { isFirebaseConfigured } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { ORG_STORAGE_KEY } from '../contexts/OrgContext'
import './PantallaInicio.css'

/**
 * @param {{ onIngresar: () => void }} props
 */
export default function PantallaInicio({ onIngresar }) {
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
          <h1 className="pantalla-inicio-title">
            <span className="pantalla-inicio-ball" aria-hidden="true">
              ⚽
            </span>{' '}
            Bondiola FC
          </h1>
          <p className="pantalla-inicio-subtitle">Fútbol en dos cómodas cuotas</p>
        </header>

        <section className="pantalla-inicio-panel" aria-labelledby="pantalla-inicio-org-heading">
          <h2 id="pantalla-inicio-org-heading" className="pantalla-inicio-panel-title">
            Organizaciones
          </h2>
          {!loading && !error && filas.length > 0 && (
            <p className="pantalla-inicio-panel-hint">
              Hacé clic en una organización para verla como invitado.
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
            <ul className="pantalla-inicio-list">
              {filas.map(({ org, jugadoresActivos, partidosJugados }) => {
                const nombreOrg = org.nombre || org.id
                return (
                  <li key={org.id} className="pantalla-inicio-li">
                    <button
                      type="button"
                      className="pantalla-inicio-item"
                      onClick={() => entrarComoInvitadoEn(org.id)}
                      aria-label={`Entrar como invitado en ${nombreOrg}`}
                    >
                      <span className="pantalla-inicio-item-nombre">{nombreOrg}</span>
                      <span className="pantalla-inicio-item-metricas">
                        <span className="pantalla-inicio-metrica" title="Jugadores que jugaron al menos un partido">
                          <span className="pantalla-inicio-metrica-label">Jugadores</span>
                          <span className="pantalla-inicio-metrica-valor">{jugadoresActivos}</span>
                        </span>
                        <span className="pantalla-inicio-metrica" title="Partidos con resultado cargado">
                          <span className="pantalla-inicio-metrica-label">Partidos</span>
                          <span className="pantalla-inicio-metrica-valor">{partidosJugados}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="pantalla-inicio-actions">
          <button type="button" className="pantalla-inicio-btn-ingresar" onClick={onIngresar}>
            Ingresar
          </button>
        </div>
      </div>
    </div>
  )
}
