import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

const JUGADORES = 'jugadores'
const PARTIDOS = 'partidos'

/**
 * Obtiene todos los jugadores desde Firestore.
 * @returns {Promise<Array>} Lista de jugadores con id del documento
 */
export async function getJugadores() {
  if (!db) return []
  const snap = await getDocs(collection(db, JUGADORES))
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      admin: data.admin === true,
    }
  })
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
  const { id, ...data } = jugador
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
