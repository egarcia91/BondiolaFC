import './IconoPaletaPadel.css'

/**
 * Ícono de paleta de pádel (cara perforada + mango) para listados.
 * @param {{ className?: string, title?: string }} props
 */
export default function IconoPaletaPadel({ className = '', title }) {
  return (
    <span className={`icono-padel-paleta ${className}`.trim()} aria-hidden="true" title={title}>
      <svg
        className="icono-padel-paleta-svg"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <ellipse
          cx="11"
          cy="8.5"
          rx="6.2"
          ry="7.2"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
        <circle cx="8.5" cy="6.8" r="1.05" fill="currentColor" />
        <circle cx="13.5" cy="6.8" r="1.05" fill="currentColor" />
        <circle cx="11" cy="9.6" r="1.05" fill="currentColor" />
        <circle cx="8.2" cy="11.2" r="0.85" fill="currentColor" />
        <circle cx="13.8" cy="11.2" r="0.85" fill="currentColor" />
        <path
          d="M11 15.8v5.2"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
