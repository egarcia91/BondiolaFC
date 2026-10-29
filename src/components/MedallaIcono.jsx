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

/** Hojas de laurel a ambos lados del disco (medalla de goleador). */
const HOJAS_LAUREL = [-1, 1].flatMap((lado) =>
  [0, 1, 2, 3, 4].map((i) => {
    const rad = ((200 - i * 24) * Math.PI) / 180
    const cx = 60 + lado * -26 * Math.cos(rad)
    const cy = 90 - 26 * Math.sin(rad)
    return { cx, cy, rot: lado * (70 - i * 24) }
  })
)

function Pelota({ cx, cy, r, m }) {
  const vertices = [0, 1, 2, 3, 4].map((i) => {
    const rad = ((-90 + i * 72) * Math.PI) / 180
    return [cx + r * 0.42 * Math.cos(rad), cy + r * 0.42 * Math.sin(rad)]
  })
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={m.brillo} stroke={m.sombra} strokeWidth="2" />
      <polygon points={vertices.map(([x, y]) => `${x},${y}`).join(' ')} fill={m.sombra} />
      <g stroke={m.sombra} strokeWidth="1.6">
        {vertices.map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x} ${y}L${cx + (x - cx) * 2.35} ${cy + (y - cy) * 2.35}`} />
        ))}
      </g>
    </>
  )
}

/** Balón de oro: trofeo único (no es un disco); pelota dorada sobre pedestal con la cinta del equipo. */
function BalonDeOro({ size, className }) {
  const m = MATERIALES.oro
  return (
    <svg
      className={className}
      width={size}
      height={size * 1.25}
      viewBox="0 0 120 150"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M30 128h60l6 18H24z" fill={m.sombra} />
      <path d="M38 116h44l4 12H34z" fill={m.base} />
      <rect x="24" y="131" width="72" height="7" fill="var(--medalla-cinta)" />
      <rect x="24" y="131" width="72" height="2" fill="var(--medalla-cinta-brillo)" />
      <path d="M50 104h20l-2 12H52z" fill={m.sombra} />
      <circle cx="60" cy="60" r="47" fill={m.sombra} />
      <circle cx="60" cy="60" r="43" fill={m.base} />
      <circle cx="52" cy="50" r="30" fill={m.brillo} opacity="0.55" />
      <Pelota cx={60} cy={60} r={43} m={{ ...m, brillo: 'none' }} />
      <path d="M33 38a33 33 0 0 1 20-14" fill="none" stroke="#FFF6D6" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

function NumeroMedalla({ numero, m }) {
  return (
    <text x="60" y="108" textAnchor="middle" fontSize={numero > 9 ? 26 : 28} fontWeight="700" fill={m.sombra}>
      {numero}
    </text>
  )
}

/**
 * Medalla por hitos: mismo diseño para todas, cambian el material y el símbolo central
 * (`cancha` = partidos, `pelota` = goles, `laureles` = ranking de goleadores, `racha` = partidos seguidos).
 * La cinta toma el color del equipo favorito de quien mira (variables `--medalla-cinta*`).
 */
export default function MedallaIcono({ material = 'bronce', simbolo = 'cancha', numero, size = 22, className = '' }) {
  const m = MATERIALES[material] ?? MATERIALES.bronce
  if (simbolo === 'balon') return <BalonDeOro size={size} className={className} />
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
      {simbolo === 'cancha' && (
        <>
          <g fill="none" stroke={m.sombra} strokeWidth="1.6">
            <rect x="47" y="62" width="26" height="15" rx="1.5" />
            <path d="M60 62v15" />
            <circle cx="60" cy="69.5" r="3.2" />
          </g>
          {numero != null && <NumeroMedalla numero={numero} m={m} />}
        </>
      )}
      {simbolo === 'pelota' && (
        <>
          <Pelota cx={60} cy={72} r={10} m={m} />
          {numero != null && <NumeroMedalla numero={numero} m={m} />}
        </>
      )}
      {simbolo === 'racha' && (
        <>
          <path
            d="M60 52c3 7 11 10 11 20a11 11 0 0 1-22 0c0-5 3-8 5-10 0 4 2 6 4 6-2-6 0-12 2-16z"
            fill={m.sombra}
          />
          <path d="M60 70c2 3 5 4 5 8a5 5 0 0 1-10 0c0-2 2-4 3-5 0 2 1 3 2 3-1-2 0-4 0-6z" fill={m.brillo} />
          {numero != null && <NumeroMedalla numero={numero} m={m} />}
        </>
      )}
      {simbolo === 'laureles' && (
        <>
          <g fill={m.sombra}>
            {HOJAS_LAUREL.map(({ cx, cy, rot }) => (
              <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="3.2" ry="6.5" transform={`rotate(${rot} ${cx} ${cy})`} />
            ))}
          </g>
          <Pelota cx={60} cy={88} r={15} m={m} />
        </>
      )}
    </svg>
  )
}
