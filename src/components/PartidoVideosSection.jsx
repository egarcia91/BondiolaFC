import { partidoVideosYouTubeIds, partidoVideosYouTubePlaylistId, youtubeEmbedSrc, youtubePlaylistEmbedSrc } from '../utils/youtube'
import './PartidoVideosSection.css'

function PartidoVideosSection({ partido }) {
  const playlistId = partidoVideosYouTubePlaylistId(partido)
  const playlistSrc = playlistId ? youtubePlaylistEmbedSrc(playlistId) : null
  const ids = partidoVideosYouTubeIds(partido)
  if (!playlistSrc && ids.length === 0) return null

  return (
    <div className="partido-videos">
      <h4 className="partido-videos-titulo">Videos del partido</h4>
      {playlistSrc && (
        <div className="partido-videos-playlist-block">
          <p className="partido-videos-playlist-label">Playlist</p>
          <div className="partido-videos-wrap partido-videos-wrap--playlist">
            <iframe
              title={`YouTube playlist ${playlistId}`}
              src={playlistSrc}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      )}
      {ids.length > 0 && (
        <ul className={`partido-videos-lista ${playlistSrc ? 'partido-videos-lista--with-playlist' : ''}`}>
          {ids.map((id) => {
            const src = youtubeEmbedSrc(id)
            if (!src) return null
            return (
              <li key={id} className="partido-videos-item">
                <div className="partido-videos-wrap">
                  <iframe
                    title={`YouTube ${id}`}
                    src={src}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default PartidoVideosSection
