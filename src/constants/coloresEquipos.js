/**
 * Colores predefinidos para equipos (local / visitante) al crear una organización.
 * `hex` en formato #rrggbb para guardar en Firestore y mostrar en la UI.
 */
export const COLOR_EQUIPO_PRESETS = [
  { id: 'rojo', nombre: 'Rojo', hex: '#c62828' },
  { id: 'azul', nombre: 'Azul', hex: '#1565c0' },
  { id: 'verde', nombre: 'Verde', hex: '#2e7d32' },
  { id: 'naranja', nombre: 'Naranja', hex: '#ef6c00' },
  { id: 'negro', nombre: 'Negro', hex: '#212121' },
  /** Gris muy claro: legible en modo oscuro con borde; representa “camiseta blanca”. */
  { id: 'blanco', nombre: 'Blanco', hex: '#eceff1' },
]
