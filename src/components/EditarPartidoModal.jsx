import { useState, useEffect, useMemo } from 'react'
import {
  updatePartido,
  getPartidos,
  getJugadores,
  computeEloUpdatesForPartido,
  updateJugadorDespuesPartido,
  normalizePartido,
  ANOTADOR_GENERAL_ID,
} from '../services/firestore'
import './EditarPartidoModal.css'

const ANOTADOR_GENERAL_LABEL = 'Anotador general'

function formatFechaPartido(fecha, hora) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  const date = new Date(y, m - 1, d)
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const str = date.toLocaleDateString('es-ES', opts)
  return hora ? `${str} ${hora}` : str
}

function EditarPartidoModal({ partido, jugadores = [], onClose, onSaved }) {
  const [partidoCargado, setPartidoCargado] = useState(null)
  const [golesRojo, setGolesRojo] = useState(0)
  const [golesAzul, setGolesAzul] = useState(0)
  const [golesAnotadoresRojo, setGolesAnotadoresRojo] = useState([])
  const [golesAnotadoresAzul, setGolesAnotadoresAzul] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const partidoParaForm = partidoCargado ?? partido

  useEffect(() => {
    if (!partido?.id || !jugadores?.length) {
      setPartidoCargado(null)
      return
    }
    let cancelled = false
    getPartidos()
      .then((lista) => {
        if (cancelled) return
        const p = lista.find((x) => x.id === partido.id)
        if (p) setPartidoCargado(normalizePartido(p, jugadores))
      })
      .catch(() => setPartidoCargado(null))
    return () => { cancelled = true }
  }, [partido?.id, jugadores])

  const jugadoresById = useMemo(
    () => new Map((jugadores || []).map((j) => [j.id, j])),
    [jugadores]
  )

  const optsRojo = useMemo(() => {
    const list = partidoParaForm?.equipoLocal?.jugadores ?? []
    const seen = new Set()
    const opts = [{ value: ANOTADOR_GENERAL_ID, label: ANOTADOR_GENERAL_LABEL }]
    list.forEach((entrada) => {
      const value = entrada?.id || (entrada?.nombre ? `guest:${entrada.nombre}` : '')
      if (!value || seen.has(value)) return
      seen.add(value)
      const label = entrada.id ? (jugadoresById.get(entrada.id)?.apodo || jugadoresById.get(entrada.id)?.nombre || entrada.nombre) : (entrada.nombre || '')
      opts.push({ value, label: label || value })
    })
    const anotadores = partidoParaForm?.equipoLocal?.golesAnotadores ?? []
    anotadores.forEach((v) => {
      const val = v != null ? String(v) : ''
      if (!val || val === ANOTADOR_GENERAL_ID || val.startsWith('guest:') || seen.has(val)) return
      seen.add(val)
      const j = jugadoresById.get(val)
      opts.push({ value: val, label: (j?.apodo || j?.nombre || val) })
    })
    return opts
  }, [partidoParaForm?.equipoLocal?.jugadores, partidoParaForm?.equipoLocal?.golesAnotadores, jugadoresById])

  const optsAzul = useMemo(() => {
    const list = partidoParaForm?.equipoVisitante?.jugadores ?? []
    const seen = new Set()
    const opts = [{ value: ANOTADOR_GENERAL_ID, label: ANOTADOR_GENERAL_LABEL }]
    list.forEach((entrada) => {
      const value = entrada?.id || (entrada?.nombre ? `guest:${entrada.nombre}` : '')
      if (!value || seen.has(value)) return
      seen.add(value)
      const label = entrada.id ? (jugadoresById.get(entrada.id)?.apodo || jugadoresById.get(entrada.id)?.nombre || entrada.nombre) : (entrada.nombre || '')
      opts.push({ value, label: label || value })
    })
    const anotadores = partidoParaForm?.equipoVisitante?.golesAnotadores ?? []
    anotadores.forEach((v) => {
      const val = v != null ? String(v) : ''
      if (!val || val === ANOTADOR_GENERAL_ID || val.startsWith('guest:') || seen.has(val)) return
      seen.add(val)
      const j = jugadoresById.get(val)
      opts.push({ value: val, label: (j?.apodo || j?.nombre || val) })
    })
    return opts
  }, [partidoParaForm?.equipoVisitante?.jugadores, partidoParaForm?.equipoVisitante?.golesAnotadores, jugadoresById])

  useEffect(() => {
    if (partidoParaForm) {
      const gr = Number(partidoParaForm.equipoLocal?.goles) || 0
      const ga = Number(partidoParaForm.equipoVisitante?.goles) || 0
      setGolesRojo(gr)
      setGolesAzul(ga)
      const arrRojo = partidoParaForm.equipoLocal?.golesAnotadores ?? []
      const arrAzul = partidoParaForm.equipoVisitante?.golesAnotadores ?? []
      const toValue = (v) => (v != null && String(v).trim() !== '' ? String(v) : ANOTADOR_GENERAL_ID)
      setGolesAnotadoresRojo(
        Array.isArray(arrRojo) && arrRojo.length >= gr
          ? arrRojo.slice(0, gr).map(toValue)
          : Array(gr).fill(ANOTADOR_GENERAL_ID)
      )
      setGolesAnotadoresAzul(
        Array.isArray(arrAzul) && arrAzul.length >= ga
          ? arrAzul.slice(0, ga).map(toValue)
          : Array(ga).fill(ANOTADOR_GENERAL_ID)
      )
    }
  }, [partidoParaForm])

  useEffect(() => {
    const n = Number(golesRojo) || 0
    setGolesAnotadoresRojo((prev) => {
      if (prev.length === n) return prev
      if (prev.length > n) return prev.slice(0, n)
      return [...prev, ...Array(n - prev.length).fill(ANOTADOR_GENERAL_ID)]
    })
  }, [golesRojo])

  useEffect(() => {
    const n = Number(golesAzul) || 0
    setGolesAnotadoresAzul((prev) => {
      if (prev.length === n) return prev
      if (prev.length > n) return prev.slice(0, n)
      return [...prev, ...Array(n - prev.length).fill(ANOTADOR_GENERAL_ID)]
    })
  }, [golesAzul])

  const ganador =
    golesRojo > golesAzul
      ? (partido?.equipoLocal?.nombre || 'Rojo')
      : golesAzul > golesRojo
        ? (partido?.equipoVisitante?.nombre || 'Azul')
        : 'Empate'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!partido) return
    setError('')
    setSaving(true)
    try {
      const equipoLocal = {
        ...partido.equipoLocal,
        nombre: partido.equipoLocal?.nombre || 'Rojo',
        jugadores: partido.equipoLocal?.jugadores ?? [],
        goles: Number(golesRojo) || 0,
        golesAnotadores: golesAnotadoresRojo.slice(0, Number(golesRojo) || 0),
      }
      const equipoVisitante = {
        ...partido.equipoVisitante,
        nombre: partido.equipoVisitante?.nombre || 'Azul',
        jugadores: partido.equipoVisitante?.jugadores ?? [],
        goles: Number(golesAzul) || 0,
        golesAnotadores: golesAnotadoresAzul.slice(0, Number(golesAzul) || 0),
      }
      const partidoActualizado = { ...partido, equipoLocal, equipoVisitante, ganador }

      const aplicarEstadisticas = partido.estadisticasAplicadas !== true
      if (aplicarEstadisticas) {
        const jugadores = await getJugadores()
        const { updates: eloUpdates, eloDeltasLocal, eloDeltasVisitante } = computeEloUpdatesForPartido(
          partidoActualizado,
          ganador,
          jugadores
        )
        equipoLocal.eloDeltas = eloDeltasLocal
        equipoVisitante.eloDeltas = eloDeltasVisitante

        const countGolesPorId = (arr) => {
          const m = new Map()
          ;(arr || []).forEach((v) => {
            if (v && v !== ANOTADOR_GENERAL_ID && !String(v).startsWith('guest:')) {
              m.set(v, (m.get(v) || 0) + 1)
            }
          })
          return m
        }
        const golesRojoMap = countGolesPorId(equipoLocal.golesAnotadores)
        const golesAzulMap = countGolesPorId(equipoVisitante.golesAnotadores)
        const jugadoresByIdMap = new Map(jugadores.map((j) => [j.id, j]))
        const idsLocal = new Set((partidoActualizado.equipoLocal?.jugadores ?? []).map((e) => e?.id).filter(Boolean))
        const idsVisitante = new Set((partidoActualizado.equipoVisitante?.jugadores ?? []).map((e) => e?.id).filter(Boolean))

        const golesParaJugador = (j, golesMap) => (j && golesMap.get(j.id)) || 0

        await Promise.all(
          eloUpdates.map((u) => {
            const j = jugadoresByIdMap.get(u.id)
            const enRojo = j && idsLocal.has(j.id)
            const golesEnPartido = enRojo ? golesParaJugador(j, golesRojoMap) : golesParaJugador(j, golesAzulMap)
            const newGoles = (j?.goles ?? 0) + golesEnPartido
            return updateJugadorDespuesPartido(u.id, {
              elo: u.newElo,
              eloHistorial: u.eloHistorial,
              partidos: u.partidos,
              victorias: u.victorias,
              partidosEmpatados: u.partidosEmpatados,
              partidosPerdidos: u.partidosPerdidos,
              goles: newGoles,
            })
          })
        )
      } else {
        // Partido ya tenía estadísticas aplicadas: solo actualizar goles según anotadores (delta)
        const countGolesPorId = (arr) => {
          const m = new Map()
          ;(arr || []).forEach((v) => {
            if (v && v !== ANOTADOR_GENERAL_ID && !String(v).startsWith('guest:')) {
              m.set(v, (m.get(v) || 0) + 1)
            }
          })
          return m
        }
        const mergeCounts = (m1, m2) => {
          const out = new Map(m1)
          m2.forEach((v, k) => out.set(k, (out.get(k) || 0) + v))
          return out
        }
        const oldRojo = countGolesPorId(partido.equipoLocal?.golesAnotadores)
        const oldAzul = countGolesPorId(partido.equipoVisitante?.golesAnotadores)
        const newRojo = countGolesPorId(equipoLocal.golesAnotadores)
        const newAzul = countGolesPorId(equipoVisitante.golesAnotadores)
        const oldCount = mergeCounts(oldRojo, oldAzul)
        const newCount = mergeCounts(newRojo, newAzul)
        const allIds = new Set([...oldCount.keys(), ...newCount.keys()])
        const jugadoresList = await getJugadores()
        const jugadoresByIdMap = new Map(jugadoresList.map((j) => [j.id, j]))
        const toUpdate = []
        allIds.forEach((id) => {
          const delta = (newCount.get(id) || 0) - (oldCount.get(id) || 0)
          if (delta === 0) return
          const j = jugadoresByIdMap.get(id)
          if (!j) return
          toUpdate.push({ jugador: j, newGoles: Math.max(0, (j.goles ?? 0) + delta) })
        })
        await Promise.all(
          toUpdate.map(({ jugador, newGoles }) =>
            updateJugadorDespuesPartido(jugador.id, {
              elo: jugador.elo ?? 900,
              eloHistorial: jugador.eloHistorial ?? [],
              partidos: jugador.partidos ?? 0,
              victorias: jugador.victorias ?? 0,
              partidosEmpatados: jugador.partidosEmpatados ?? 0,
              partidosPerdidos: jugador.partidosPerdidos ?? 0,
              goles: newGoles,
            })
          )
        )
      }

      await updatePartido(partido.id, {
        concluido: true,
        equipoLocal,
        equipoVisitante,
        ganador,
        ...(aplicarEstadisticas ? { estadisticasAplicadas: true } : {}),
      })

      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!partido) return null

  return (
    <div className="editar-partido-overlay" onClick={onClose}>
      <div className="editar-partido-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editar-partido-header">
          <h3>Editar partido</h3>
          <button type="button" className="editar-partido-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <p className="editar-partido-meta">
          {formatFechaPartido(partidoParaForm?.fecha, partidoParaForm?.hora)} · {partidoParaForm?.lugar ?? partido?.lugar}
        </p>

        <form onSubmit={handleSubmit} className="editar-partido-form">
          <div className="editar-partido-resultado">
            <div className="editar-partido-equipo">
              <label htmlFor="goles-rojo">Rojo</label>
              <input
                id="goles-rojo"
                type="number"
                min={0}
                max={99}
                value={golesRojo}
                onChange={(e) => setGolesRojo(Number(e.target.value) || 0)}
                className="editar-partido-input"
              />
            </div>
            <span className="editar-partido-vs">—</span>
            <div className="editar-partido-equipo">
              <label htmlFor="goles-azul">Azul</label>
              <input
                id="goles-azul"
                type="number"
                min={0}
                max={99}
                value={golesAzul}
                onChange={(e) => setGolesAzul(Number(e.target.value) || 0)}
                className="editar-partido-input"
              />
            </div>
          </div>
          <p className="editar-partido-ganador">
            Resultado: <strong>{ganador}</strong>
          </p>

          {golesRojo > 0 && (
            <div className="editar-partido-anotadores">
              <label className="editar-partido-anotadores-label">Anotadores Rojo ({golesRojo})</label>
              <div className="editar-partido-anotadores-list">
                {golesAnotadoresRojo.slice(0, golesRojo).map((valor, idx) => (
                  <select
                    key={`rojo-${idx}`}
                    value={valor}
                    onChange={(e) => {
                      const v = e.target.value
                      setGolesAnotadoresRojo((prev) => {
                        const next = [...prev]
                        next[idx] = v
                        return next
                      })
                    }}
                    className="editar-partido-select-anotador"
                  >
                    {optsRojo.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          )}

          {golesAzul > 0 && (
            <div className="editar-partido-anotadores">
              <label className="editar-partido-anotadores-label">Anotadores Azul ({golesAzul})</label>
              <div className="editar-partido-anotadores-list">
                {golesAnotadoresAzul.slice(0, golesAzul).map((valor, idx) => (
                  <select
                    key={`azul-${idx}`}
                    value={valor}
                    onChange={(e) => {
                      const v = e.target.value
                      setGolesAnotadoresAzul((prev) => {
                        const next = [...prev]
                        next[idx] = v
                        return next
                      })
                    }}
                    className="editar-partido-select-anotador"
                  >
                    {optsAzul.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          )}

          {error && <p className="editar-partido-error">{error}</p>}
          <div className="editar-partido-actions">
            <button type="button" className="editar-partido-btn secundario" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="editar-partido-btn" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditarPartidoModal
