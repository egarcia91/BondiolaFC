/**
 * Script de migración: crea la organización "Bondiola FC" en Firestore
 * y asigna organizacionId a todos los jugadores y partidos existentes.
 *
 * Requisitos:
 * 1. Archivo .env con VITE_FIREBASE_PROJECT_ID (o FIREBASE_PROJECT_ID).
 * 2. Credenciales de cuenta de servicio:
 *    - Opción A: Variable de entorno GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON de la cuenta de servicio.
 *    - Opción B: Pasar la ruta como argumento: node scripts/migrar-firebase-organizaciones.js ./ruta/al-sa.json
 *
 * En Firebase Console: Proyecto → Configuración del proyecto → Cuentas de servicio →
 * Generar nueva clave privada. Guardar el JSON y usar su ruta.
 *
 * Ejecución: npm run migrar:organizaciones
 * O: node scripts/migrar-firebase-organizaciones.js [ruta-sa.json]
 */

import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
const SA_PATH = process.argv[2]

function getCredential() {
  let path = null
  if (SA_PATH) {
    path = resolve(process.cwd(), SA_PATH)
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const p = process.env.GOOGLE_APPLICATION_CREDENTIALS
    path = p.startsWith('/') || (p.length >= 2 && p[1] === ':') ? p : resolve(process.cwd(), p)
  }
  if (path && existsSync(path)) {
    const sa = JSON.parse(readFileSync(path, 'utf8'))
    return cert(sa)
  }
  return undefined
}

async function main() {
  if (!PROJECT_ID) {
    console.error('Falta PROJECT_ID. Definí VITE_FIREBASE_PROJECT_ID o FIREBASE_PROJECT_ID en .env')
    process.exit(1)
  }

  const credential = getCredential()
  if (!credential) {
    console.error('Faltan credenciales. Opciones:')
    console.error('  1. Variable GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON de la cuenta de servicio')
    console.error('  2. Pasar la ruta como argumento: node scripts/migrar-firebase-organizaciones.js ./ruta/sa.json')
    console.error('Obtener el JSON en Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada')
    process.exit(1)
  }

  if (!getApps().length) {
    initializeApp({ credential, projectId: PROJECT_ID })
  }

  const db = getFirestore()

  const ORGANIZACIONES = 'organizaciones'
  const JUGADORES = 'jugadores'
  const PARTIDOS = 'partidos'

  // Comprobar si ya existe una org Bondiola
  const orgsSnap = await db.collection(ORGANIZACIONES).get()
  const existente = orgsSnap.docs.find((d) => (d.data().nombre || '').toLowerCase().includes('bondiola'))
  if (existente) {
    console.error('Ya existe una organización Bondiola (id:', existente.id, '). No ejecutar la migración de nuevo.')
    process.exit(1)
  }

  // Crear organización Bondiola FC
  const orgRef = await db.collection(ORGANIZACIONES).add({
    nombre: 'Bondiola FC',
    slug: 'bondiola-fc',
    creadoPor: '',
    creadoEn: new Date(),
  })
  const organizacionId = orgRef.id
  console.log('Organización creada:', organizacionId, 'Bondiola FC')

  let jugadoresActualizados = 0
  const jugadoresSnap = await db.collection(JUGADORES).get()
  for (const d of jugadoresSnap.docs) {
    if (!d.data().organizacionId) {
      await d.ref.update({ organizacionId })
      jugadoresActualizados++
    }
  }
  console.log('Jugadores actualizados:', jugadoresActualizados)

  let partidosActualizados = 0
  const partidosSnap = await db.collection(PARTIDOS).get()
  for (const d of partidosSnap.docs) {
    if (!d.data().organizacionId) {
      await d.ref.update({ organizacionId })
      partidosActualizados++
    }
  }
  console.log('Partidos actualizados:', partidosActualizados)

  console.log('Migración completada. Organización ID:', organizacionId)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
