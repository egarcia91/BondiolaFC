/**
 * Ejemplo / demostración del NUEVO sistema de Elo "agresivo e individual".
 *
 * No toca Firestore: usa la lógica pura de `src/utils/partidoEloPure.js` con
 * jugadores inventados, para poder ver cómo quedarían los puntajes ANTES de
 * llevar los cambios a producción.
 *
 * Uso:
 *   node scripts/ejemplo-elo-nuevo.js
 *   node scripts/ejemplo-elo-nuevo.js --partidos=60   (cambia la cantidad de fechas simuladas)
 *   node scripts/ejemplo-elo-nuevo.js --seed=7        (cambia la semilla aleatoria)
 */

import {
  calcularDeltaElo,
  computeEloUpdatesForPartido,
  ELO_BASE_GANAR,
  ELO_BASE_EMPATE,
  ELO_MIN_CAMBIO,
  ELO_MAX_CAMBIO,
} from '../src/utils/partidoEloPure.js'

// ----------------------------- utilidades -----------------------------

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      out[k] = v === undefined ? true : v
    }
  }
  return out
}

// PRNG determinista (mulberry32) para que el ejemplo sea reproducible.
function crearRandom(seed) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const fmt = (n, w) => String(n).padEnd(w)
const fmtNum = (n, w) => String(n).padStart(w)
const signo = (n) => (n >= 0 ? `+${n}` : `${n}`)

function linea(char = '─', n = 64) {
  return char.repeat(n)
}

// --------------------- 1) Tabla del diferencial ---------------------

function mostrarTablaDiferencial() {
  console.log(linea('═'))
  console.log('1) DIFERENCIAL POR DISTANCIA AL ELO PROMEDIO DEL RIVAL')
  console.log(linea('═'))
  console.log(
    `Base ganar/perder: ${ELO_BASE_GANAR} · Base empate: ${ELO_BASE_EMPATE} · ` +
      `Tope: ${ELO_MAX_CAMBIO} · Mínimo: ${ELO_MIN_CAMBIO}\n`,
  )

  const avgRival = 1000 // valor de referencia para mostrar la distancia en %
  const distancias = [-50, -30, -20, -10, 0, 10, 20, 30, 50, 100]

  console.log(
    fmt('Jugador vs rival', 18) +
      fmt('Elo jugador', 13) +
      fmt('GANA', 8) +
      fmt('EMPATA', 9) +
      fmt('PIERDE', 8),
  )
  console.log(linea('─'))
  for (const pct of distancias) {
    const eloJugador = Math.round(avgRival * (1 + pct / 100))
    const win = Math.round(calcularDeltaElo(eloJugador, avgRival, 'win'))
    const tie = Math.round(calcularDeltaElo(eloJugador, avgRival, 'tie'))
    const loss = Math.round(calcularDeltaElo(eloJugador, avgRival, 'loss'))
    const etiqueta =
      pct === 0 ? 'igual (0%)' : pct > 0 ? `+${pct}% mejor` : `${Math.abs(pct)}% peor`
    console.log(
      fmt(etiqueta, 18) +
        fmt(String(eloJugador), 13) +
        fmt(signo(win), 8) +
        fmt(signo(tie), 9) +
        fmt(signo(loss), 8),
    )
  }
  console.log('')
  console.log('Lectura: un jugador 10% mejor que el promedio rival que gana suma +18;')
  console.log('si es 10% peor y gana suma +22. Al perder es al revés (mejor = pierde más).')
  console.log('')
}

// --------------------- 2) Partidos de ejemplo ---------------------

function jugador(id, nombre, elo) {
  return {
    id,
    nombre,
    elo,
    partidos: 0,
    victorias: 0,
    partidosEmpatados: 0,
    partidosPerdidos: 0,
    eloHistorial: [elo],
    goles: 0,
  }
}

function armarPartido(rojo, azul, ganador) {
  return {
    equipoLocal: { nombre: 'Rojo', jugadores: rojo.map((j) => ({ id: j.id })) },
    equipoVisitante: { nombre: 'Azul', jugadores: azul.map((j) => ({ id: j.id })) },
    ganador,
  }
}

function mostrarPartidoEjemplo(titulo, rojo, azul, ganador) {
  const jugadores = [...rojo, ...azul]
  const avgRojo = Math.round(rojo.reduce((a, j) => a + j.elo, 0) / rojo.length)
  const avgAzul = Math.round(azul.reduce((a, j) => a + j.elo, 0) / azul.length)
  const partido = armarPartido(rojo, azul, ganador)
  const { updates } = computeEloUpdatesForPartido(partido, ganador, jugadores)
  const byId = new Map(jugadores.map((j) => [j.id, j]))

  console.log(linea('─'))
  console.log(titulo)
  console.log(`Rojo (prom ${avgRojo}) vs Azul (prom ${avgAzul}) · Ganador: ${ganador}`)
  console.log(linea('─'))
  console.log(
    fmt('Jugador', 14) +
      fmt('Equipo', 8) +
      fmtNum('Elo', 6) +
      '  ' +
      fmtNum('Δ', 5) +
      '  ' +
      fmtNum('Nuevo', 6),
  )
  const idsRojo = new Set(rojo.map((j) => j.id))
  for (const u of updates) {
    const j = byId.get(u.id)
    const delta = u.newElo - j.elo
    console.log(
      fmt(j.nombre, 14) +
        fmt(idsRojo.has(j.id) ? 'Rojo' : 'Azul', 8) +
        fmtNum(j.elo, 6) +
        '  ' +
        fmtNum(signo(delta), 5) +
        '  ' +
        fmtNum(u.newElo, 6),
    )
  }
  console.log('')
}

function mostrarPartidosEjemplo() {
  console.log(linea('═'))
  console.log('2) PARTIDOS DE EJEMPLO (un solo partido cada uno)')
  console.log(linea('═'))
  console.log('')

  // Caso A: equipos parejos. El que gana suma ~20, el que pierde ~-20.
  mostrarPartidoEjemplo(
    'CASO A · Equipos parejos, gana Rojo',
    [jugador('r1', 'Ana', 1000), jugador('r2', 'Beto', 1000)],
    [jugador('a1', 'Caro', 1000), jugador('a2', 'Dani', 1000)],
    'Rojo',
  )

  // Caso B: Rojo (fuerte) le gana a Azul (débil). Rojo suma poco; Azul pierde poco.
  mostrarPartidoEjemplo(
    'CASO B · Favorito (Rojo, fuerte) le gana al débil (Azul)',
    [jugador('r1', 'Fuerte1', 1200), jugador('r2', 'Fuerte2', 1200)],
    [jugador('a1', 'Debil1', 800), jugador('a2', 'Debil2', 800)],
    'Rojo',
  )

  // Caso C: BATACAZO. Azul (débil) le gana al fuerte (Rojo). Azul suma mucho; Rojo cae fuerte.
  mostrarPartidoEjemplo(
    'CASO C · Batacazo: el débil (Azul) le gana al favorito (Rojo)',
    [jugador('r1', 'Fuerte1', 1200), jugador('r2', 'Fuerte2', 1200)],
    [jugador('a1', 'Debil1', 800), jugador('a2', 'Debil2', 800)],
    'Azul',
  )

  // Caso D: Empate entre equipos disparejos. El débil sube, el fuerte baja (base 10).
  mostrarPartidoEjemplo(
    'CASO D · Empate entre fuerte (Rojo) y débil (Azul)',
    [jugador('r1', 'Fuerte1', 1200), jugador('r2', 'Fuerte2', 1200)],
    [jugador('a1', 'Debil1', 800), jugador('a2', 'Debil2', 800)],
    'Empate',
  )
}

// --------------------- 3) Simulación de temporada ---------------------

function aplicarUpdates(jugadoresMap, updates) {
  for (const u of updates) {
    const j = jugadoresMap.get(u.id)
    j.elo = u.newElo
    j.partidos = u.partidos
    j.victorias = u.victorias
    j.partidosEmpatados = u.partidosEmpatados
    j.partidosPerdidos = u.partidosPerdidos
    j.eloHistorial = u.eloHistorial
  }
}

function simularTemporada(nPartidos, seed) {
  const random = crearRandom(seed)

  // Pool de jugadores con una "habilidad real" oculta (no es el Elo).
  // El Elo arranca igual para todos (900) y debería separarse con el tiempo.
  const base = [
    ['Cracks', 1300],
    ['Cracks', 1280],
    ['Buenos', 1100],
    ['Buenos', 1080],
    ['Buenos', 1060],
    ['Promedio', 950],
    ['Promedio', 950],
    ['Promedio', 930],
    ['Flojos', 780],
    ['Flojos', 760],
    ['Flojos', 740],
    ['Malos', 600],
  ]
  const jugadores = base.map((b, i) =>
    Object.assign(jugador(`p${i}`, `${b[0]}-${i}`, 900), { habilidad: b[1] }),
  )
  const map = new Map(jugadores.map((j) => [j.id, j]))

  const shuffle = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const k = Math.floor(random() * (i + 1))
      ;[a[i], a[k]] = [a[k], a[i]]
    }
    return a
  }

  for (let p = 0; p < nPartidos; p++) {
    const mezclados = shuffle(jugadores)
    const mitad = Math.floor(mezclados.length / 2)
    const rojo = mezclados.slice(0, mitad)
    const azul = mezclados.slice(mitad, mitad * 2)

    // El ganador depende de la habilidad REAL del equipo + algo de azar.
    const habRojo = rojo.reduce((a, j) => a + j.habilidad, 0) / rojo.length
    const habAzul = azul.reduce((a, j) => a + j.habilidad, 0) / azul.length
    const ruido = (random() - 0.5) * 300
    const margen = habRojo - habAzul + ruido
    let ganador
    if (Math.abs(margen) < 40) ganador = 'Empate'
    else ganador = margen > 0 ? 'Rojo' : 'Azul'

    const partido = armarPartido(rojo, azul, ganador)
    const { updates } = computeEloUpdatesForPartido(partido, ganador, [...rojo, ...azul])
    aplicarUpdates(map, updates)
  }

  return jugadores
}

function mostrarSimulacion(nPartidos, seed) {
  console.log(linea('═'))
  console.log(`3) SIMULACIÓN DE TEMPORADA (${nPartidos} partidos, semilla ${seed})`)
  console.log(linea('═'))
  console.log('Todos arrancan en Elo 900. El resultado de cada partido depende de la')
  console.log('"habilidad real" oculta de cada jugador. Veamos si el Elo los separa.\n')

  const jugadores = simularTemporada(nPartidos, seed)
  jugadores.sort((a, b) => b.elo - a.elo)

  console.log(
    fmt('Jugador', 12) +
      fmtNum('Habilidad', 10) +
      fmtNum('Elo final', 11) +
      fmtNum('PJ', 5) +
      fmtNum('G', 4) +
      fmtNum('E', 4) +
      fmtNum('P', 4),
  )
  console.log(linea('─'))
  for (const j of jugadores) {
    console.log(
      fmt(j.nombre, 12) +
        fmtNum(j.habilidad, 10) +
        fmtNum(j.elo, 11) +
        fmtNum(j.partidos, 5) +
        fmtNum(j.victorias, 4) +
        fmtNum(j.partidosEmpatados, 4) +
        fmtNum(j.partidosPerdidos, 4),
    )
  }

  const elos = jugadores.map((j) => j.elo)
  const max = Math.max(...elos)
  const min = Math.min(...elos)
  console.log('')
  console.log(`Elo máximo: ${max} · Elo mínimo: ${min} · Brecha: ${max - min} puntos`)
  console.log('Cuanto mayor la brecha, más "agresiva" es la separación entre niveles.\n')
}

// ------------------------------- main -------------------------------

function main() {
  const flags = parseArgs(process.argv.slice(2))
  const nPartidos = Number(flags.partidos) || 40
  const seed = Number(flags.seed) || 42

  console.log('')
  console.log('NUEVO SISTEMA DE ELO — INDIVIDUAL Y AGRESIVO (demo, no escribe en Firestore)')
  console.log('')
  mostrarTablaDiferencial()
  mostrarPartidosEjemplo()
  mostrarSimulacion(nPartidos, seed)
}

main()
