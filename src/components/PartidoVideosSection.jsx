import { partidoVideosYouTubeIds, youtubeEmbedSrc } from '../utils/youtube'
import './PartidoVideosSection.css'

function PartidoVideosSection({ partido }) {
  const ids = partidoVideosYouTubeIds(partido)
  if (ids.length === 0) return null

  return (
    <div className="partido-videos">
      <h4 className="partido-videos-titulo">Videos del partido</h4>
      <ul className="partido-videos-lista">
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
    </div>
  )
}

export default PartidoVideosSection
