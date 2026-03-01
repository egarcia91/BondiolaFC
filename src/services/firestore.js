import { collection, getDocs, addDoc, doc, updateDoc, query, where, limit } from 'firebase/firestore'
import { db } from '../firebase'

const JUGADORES = 'jugadores'
const PARTIDOS = 'partidos'

/**
 * Calcula la edad en años a partir de una fecha de nacimiento (YYYY-MM-DD).
 */
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento || typeof fechaNacimiento !== 'string') return null
  const hoy = new Date()
  const nacimiento = new Date(fechaNacimiento)
  if (Number.isNaN(nacimiento.getTime())) return null
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const m = hoy.getMonth() - nacimiento.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad >= 0 ? edad : null
}

/**
 * Obtiene todos los jugadores desde Firestore.
 * El campo "años" se calcula a partir de fechaNacimiento cuando existe.
 * @returns {Promise<Array>} Lista de jugadores con id del documento
 */
export async function getJugadores() {
  if (!db) return []
  const snap = await getDocs(collection(db, JUGADORES))
  return snap.docs.map((d) => {
    const data = d.data()
    const añosCalculados = calcularEdad(data.fechaNacimiento)
    const { años: _omit, ...rest } = data
    return {
      id: d.id,
      ...rest,
      admin: data.admin === true,
      años: añosCalculados ?? 0,
    }
  })
}

/**
 * Obtiene el jugador cuyo mail coincide con el email dado (usuario registrado).
 * @param {string} email
 * @returns {Promise<{ id: string, equipoFavorito?: string } | null>}
 */
export async function getJugadorByEmail(email) {
  if (!db || !email) return null
  const q = query(
    collection(db, JUGADORES),
    where('mail', '==', email),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

/**
 * Obtiene todos los partidos desde Firestore, ordenados por fecha (más recientes primero).
 * @returns {Promise<Array>} Lista de partidos con id del documento
 */
export async function getPartidos() {
  if (!db) return []
  const snap = await getDocs(collection(db, PARTIDOS))
  const partidos = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
  return partidos.sort((a, b) => {
    const dateA = new Date((a.fecha || '') + ' ' + (a.hora || ''))
    const dateB = new Date((b.fecha || '') + ' ' + (b.hora || ''))
    return dateB - dateA
  })
}

/**
 * Escribe un jugador en Firestore (sin el campo id).
 * @param {Object} jugador - Datos del jugador
 * @returns {Promise<string>} ID del documento creado
 */
export async function addJugador(jugador) {
  if (!db) throw new Error('Firestore no está configurado')
  const { id, años: _omit, ...data } = jugador
  const ref = await addDoc(collection(db, JUGADORES), {
    ...data,
    admin: data.admin === true,
  })
  return ref.id
}

/**
 * Escribe un partido en Firestore (sin el campo id).
 * @param {Object} partido - Datos del partido
 * @returns {Promise<string>} ID del documento creado
 */
export async function addPartido(partido) {
  if (!db) throw new Error('Firestore no está configurado')
  const { id, ...data } = partido
  const ref = await addDoc(collection(db, PARTIDOS), data)
  return ref.id
}

/**
 * Actualiza campos de un partido (ej. concluido, goles, ganador).
 * @param {string} partidoId - ID del documento del partido
 * @param {Object} data - Campos a actualizar (concluido, equipoLocal, equipoVisitante, ganador, etc.)
 */
export async function updatePartido(partidoId, data) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, PARTIDOS, partidoId)
  await updateDoc(ref, data)
}

/**
 * Actualiza el registro de un jugador (mail y registrado).
 * @param {string} jugadorId - ID del documento del jugador
 * @param {{ mail: string, registrado: boolean }} data
 */
export async function updateJugadorRegistro(jugadorId, { mail, registrado }) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, JUGADORES, jugadorId)
  await updateDoc(ref, { mail: mail || '', registrado: !!registrado })
}

/**
 * Actualiza el campo admin de un jugador.
 * @param {string} jugadorId - ID del documento
 * @param {boolean} admin
 */
export async function updateJugadorAdmin(jugadorId, admin) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, JUGADORES, jugadorId)
  await updateDoc(ref, { admin: !!admin })
}

/**
 * Actualiza el perfil editable de un jugador (apodo, descripcion, posicion, fechaNacimiento, equipoFavorito).
 * @param {string} jugadorId - ID del documento
 * @param {Object} data - Campos a actualizar
 */
export async function updateJugadorPerfil(jugadorId, data) {
  if (!db) throw new Error('Firestore no está configurado')
  const ref = doc(db, JUGADORES, jugadorId)
  const allowed = ['apodo', 'descripcion', 'posicion', 'fechaNacimiento', 'equipoFavorito']
  const toUpdate = {}
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      if (key === 'fechaNacimiento') toUpdate[key] = data[key] || ''
      else if (key === 'equipoFavorito') toUpdate[key] = data[key] === 'azul' ? 'azul' : 'rojo'
      else toUpdate[key] = data[key] ?? ''
    }
  })
  if (Object.keys(toUpdate).length) await updateDoc(ref, toUpdate)
}
