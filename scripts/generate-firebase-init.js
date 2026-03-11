/**
 * Genera public/firebase/init.json con la config de Firebase para que el SDK/Auth
 * no reciba 404 al pedir ese recurso (p. ej. en redirect de Google).
 * Se ejecuta antes del build (prebuild) para que el deploy incluya el archivo.
 *
 * Requiere .env con VITE_FIREBASE_API_KEY y VITE_FIREBASE_AUTH_DOMAIN (y opcionales).
 * Ejecución: npm run prebuild (o automático antes de npm run build)
 */

import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outDir = resolve(root, 'public', 'firebase')
const outFile = resolve(outDir, 'init.json')

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
}

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, JSON.stringify(config, null, 2), 'utf8')
console.log('Generado public/firebase/init.json')
