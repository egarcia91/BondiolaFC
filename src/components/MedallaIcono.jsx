/** Tonos de cada material: base, brillo (disco interior) y sombra (borde, detalles, número). */
const MATERIALES = {
  madera: { base: '#A0703F', brillo: '#C79A66', sombra: '#5E3D1E' },
  bronce: { base: '#B5713A', brillo: '#DB9A62', sombra: '#6B3E17' },
  plata: { base: '#A9AFB7', brillo: '#DCE0E5', sombra: '#5C626B' },
  oro: { base: '#D2A42B', brillo: '#F2D46E', sombra: '#7D5C0C' },
}

const REMACHES = [0, 45, 90, 135, 180, 225, 270, 315].map((grados) => {
  const rad = (grados * Math.PI) / 180
  return { cx: 60 + 37.5 * Math.cos(rad), cy: 88 + 37.5 * Math.sin(rad) }
})

/**
 * Medalla de partidos: mismo diseño para todos los niveles, cambia el material.
 * La cinta toma el color del equipo favorito de quien mira (variables `--medalla-cinta*`).
 */
export default function MedallaIcono({ material = 'bronce', numero, size = 22, className = '' }) {
  const m = MATERIALES[material] ?? MATERIALES.bronce
  return (
    <svg
      className={className}
      width={size}
      height={size * 1.25}
      viewBox="0 0 120 150"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M38 0h18l14 40H52z" fill="var(--medalla-cinta)" />
      <path d="M64 0h18L68 40H50z" fill="var(--medalla-cinta-oscura)" />
      <path d="M44 0h4l14 40h-4z" fill="var(--medalla-cinta-brillo)" />
      <path d="M72 0h4L62 40h-4z" fill="var(--medalla-cinta-brillo)" />
      <circle cx="60" cy="88" r="46" fill={m.sombra} />
      <circle cx="60" cy="88" r="42" fill={m.base} />
      <circle cx="60" cy="88" r="33" fill={m.brillo} />
      {material === 'madera' && (
        <g stroke={m.sombra} strokeWidth="1.2" fill="none" opacity="0.45">
          <path d="M36 70c8-6 14 6 22 0s14 6 24 0" />
          <path d="M34 82c10-5 16 5 26 0s14 5 26 0" />
          <path d="M38 94c8-5 14 5 22 0s14 5 22 0" />
          <path d="M44 106c8-4 12 4 20 0s12 4 16 0" />
        </g>
      )}
      <circle cx="60" cy="88" r="33" fill="none" stroke={m.sombra} strokeWidth="1.5" />
      <g fill={m.sombra}>
        {REMACHES.map(({ cx, cy }) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" />
        ))}
      </g>
      <g fill="none" stroke={m.sombra} strokeWidth="1.6">
        <rect x="47" y="62" width="26" height="15" rx="1.5" />
        <path d="M60 62v15" />
        <circle cx="60" cy="69.5" r="3.2" />
      </g>
      {numero != null && (
        <text
          x="60"
          y="108"
          textAnchor="middle"
          fontSize={numero > 9 ? 26 : 28}
          fontWeight="700"
          fill={m.sombra}
        >
          {numero}
        </text>
      )}
    </svg>
  )
}
