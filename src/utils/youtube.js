/**
 * Extrae el ID de un video de YouTube desde URL o texto (11 caracteres típicos).
 */
export function parseYouTubeVideoId(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v')
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})\/?/)
      if (m) return m[1]
    }
  } catch {
    return null
  }
  return null
}

export function youtubeEmbedSrc(videoId) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null
  return `https://www.youtube.com/embed/${videoId}`
}

/**
 * Extrae el ID de una playlist (parámetro list= en youtube.com).
 * No acepta strings de 11 caracteres solos (se confunden con IDs de video).
 */
export function parseYouTubePlaylistId(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const list = u.searchParams.get('list')
      if (list && /^[a-zA-Z0-9_-]+$/.test(list) && list.length >= 8) return list
    }
  } catch {
    /* texto plano */
  }
  if (/^[a-zA-Z0-9_-]+$/.test(s) && s.length >= 10 && !/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  return null
}

/** Embed oficial de una playlist completa (reproductor con lista). */
export function youtubePlaylistEmbedSrc(playlistId) {
  if (!playlistId || typeof playlistId !== 'string') return null
  const s = playlistId.trim()
  const id =
    parseYouTubePlaylistId(s) ||
    (/^[a-zA-Z0-9_-]+$/.test(s) && s.length >= 10 && !/^[a-zA-Z0-9_-]{11}$/.test(s) ? s : null)
  if (!id) return null
  return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(id)}`
}

/**
 * Normaliza entradas de usuario (una por línea) a IDs válidos.
 * @returns {{ ids: string[], invalid: string[] }}
 */
export function parseYouTubeLines(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const ids = []
  const invalid = []
  const seen = new Set()
  for (const line of lines) {
    const id = parseYouTubeVideoId(line)
    if (id && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    } else if (!id) {
      invalid.push(line)
    }
  }
  return { ids, invalid }
}

/** Asegura array de IDs desde datos de Firestore (array de strings o vacío). */
export function partidoVideosYouTubeIds(partido) {
  const raw = partido?.videosYouTube
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const item of raw) {
    const id = parseYouTubeVideoId(item)
    if (id && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

/** ID de playlist guardado en el partido (string o URL legada). */
export function partidoVideosYouTubePlaylistId(partido) {
  const raw = partido?.videosYouTubePlaylist
  if (raw == null || raw === '') return null
  const parsed = parseYouTubePlaylistId(String(raw).trim())
  if (parsed) return parsed
  return null
}
