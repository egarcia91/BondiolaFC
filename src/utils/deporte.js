/**
 * Normaliza el nombre del deporte para comparar (minúsculas, sin acentos).
 * @param {string | null | undefined} deporte
 * @returns {string}
 */
function normalizeDeporteKey(deporte) {
  return String(deporte ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
}

/**
 * True si la organización practica fútbol (incluye variantes como "Fútbol 11").
 * @param {string | null | undefined} deporte
 * @returns {boolean}
 */
export function deporteEsFutbol(deporte) {
  const k = normalizeDeporteKey(deporte || 'Futbol')
  if (!k) return true
  if (k === 'futbol') return true
  if (k.startsWith('futbol')) return true
  if (k.includes('football')) return true
  return false
}

/**
 * True si el deporte es pádel / paddle (nombre preset u otras variantes).
 * @param {string | null | undefined} deporte
 * @returns {boolean}
 */
export function deporteEsPadel(deporte) {
  const k = normalizeDeporteKey(deporte || '')
  if (!k) return false
  if (k === 'padel' || k === 'paddle') return true
  if (k.startsWith('padel')) return true
  if (k.startsWith('paddle')) return true
  return false
}

/**
 * True si el deporte es básquet (preset “Basquet”, basketball, baloncesto, etc.).
 * @param {string | null | undefined} deporte
 * @returns {boolean}
 */
export function deporteEsBasquet(deporte) {
  const k = normalizeDeporteKey(deporte || '')
  if (!k) return false
  if (k.includes('baloncesto') || k.includes('basketball')) return true
  if (k === 'basquet' || k === 'basket') return true
  if (k.startsWith('basquet') || k.startsWith('basket')) return true
  return false
}

/**
 * Texto del deporte para UI cuando no es fútbol (columna angosta; puede truncarse con CSS).
 * @param {string | null | undefined} deporte
 * @returns {string}
 */
export function deporteTextoLista(deporte) {
  const d = String(deporte ?? '').trim()
  return d || '—'
}

/**
 * Abreviatura 2–3 letras para columna fija (no usar para fútbol: ahí va solo el ícono).
 * @param {string | null | undefined} deporte
 * @returns {string}
 */
export function deporteAbreviatura(deporte) {
  const raw = String(deporte ?? '').trim()
  if (!raw) return '—'
  const k = normalizeDeporteKey(raw).replace(/[^a-z0-9]/g, '')
  if (!k) return '—'
  if (k.length <= 3) return k.toUpperCase()
  return k.slice(0, 3).toUpperCase()
}
