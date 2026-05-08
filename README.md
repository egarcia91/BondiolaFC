# ⚽ Bondiola FC

Futbol en dos cómodas cuotas

## 📋 Descripción

Aplicación web desarrollada en React con Vite para gestionar y visualizar información de jugadores y partidos de fútbol del equipo Bondiola FC.

## 🚀 Características

- **Sección de Jugadores**: Visualiza información detallada de cada jugador incluyendo:
  - Cantidad de partidos jugados
  - Edad
  - Victorias
  - Goles
  - Posición
  - Descripción

- **Sección de Partidos**: Muestra todos los partidos con:
  - Fecha y hora
  - Lugar del partido
  - Jugadores por equipo
  - Goles de cada equipo
  - Equipo ganador
  - Distinción entre partidos pasados y futuros

## 🛠️ Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Inicia el servidor de desarrollo:
```bash
npm run dev
```

3. Abre tu navegador en `http://localhost:5173`

## 📦 Estructura del Proyecto

```
BondiolaFC/
├── garmin-connectiq/          # Watch app Garmin Connect IQ (demo; ver README allí)
├── src/
│   ├── components/
│   │   ├── Jugadores.jsx      # Componente de listado de jugadores
│   │   ├── Jugadores.css
│   │   ├── Partidos.jsx       # Componente de listado de partidos
│   │   └── Partidos.css
│   ├── data/
│   │   ├── jugadores.json     # Datos de jugadores
│   │   └── partidos.json      # Datos de partidos
│   ├── App.jsx                # Componente principal
│   ├── App.css
│   ├── main.jsx               # Punto de entrada
│   └── index.css              # Estilos globales
├── index.html
├── package.json
└── vite.config.js
```

## 📝 Agregar Nuevos Partidos

Para agregar un nuevo partido, edita el archivo `src/data/partidos.json` y agrega un nuevo objeto con la siguiente estructura:

```json
{
  "id": 3,
  "fecha": "2024-02-01",
  "hora": "20:00",
  "lugar": "Cancha Principal",
  "equipoLocal": {
    "nombre": "Bondiola FC",
    "jugadores": ["Juan Pérez", "Carlos Rodríguez", "Luis Martínez"],
    "goles": 2
  },
  "equipoVisitante": {
    "nombre": "Rival FC",
    "jugadores": ["Pedro García", "Miguel López"],
    "goles": 1
  },
  "ganador": "Bondiola FC"
}
```

**Importante**: Cada nuevo partido debe ser agregado mediante un commit a GitHub para mantener un historial completo de todos los partidos y poder rastrear quién los agregó y cuándo.

### Proceso recomendado:

1. Edita `src/data/partidos.json`
2. Agrega el nuevo partido con un `id` único
3. Haz commit del cambio:
```bash
git add src/data/partidos.json
git commit -m "Agregar partido vs [Equipo] - [Fecha]"
git push
```

## 👥 Agregar Nuevos Jugadores

Para agregar un nuevo jugador, edita el archivo `src/data/jugadores.json`:

```json
{
  "id": 4,
  "nombre": "Nuevo Jugador",
  "posicion": "Mediocampista",
  "años": 26,
  "partidos": 0,
  "victorias": 0,
  "goles": 0,
  "descripcion": "Descripción del jugador"
}
```

## 🎨 Tecnologías Utilizadas

- **React 18**: Biblioteca de JavaScript para construir interfaces de usuario
- **Vite**: Herramienta de construcción rápida para desarrollo frontend
- **CSS3**: Estilos modernos y responsive

## 📱 Responsive Design

La aplicación está completamente optimizada para dispositivos móviles, tablets y escritorio.

## 🚢 Build y despliegue

Para crear una versión optimizada para producción:

```bash
npm run build
```

Los archivos se generarán en la carpeta `dist/`. Para previsualizar el build: `npm run preview`.

**Despliegue a GitHub Pages**: El proyecto usa GitHub Actions (`.github/workflows/deploy.yml`) para construir y publicar en cada push a `main`. La configuración de Firebase se inyecta desde **GitHub Secrets**; así la clave de API no se commitea. Ver [docs/SEGURIDAD-FIREBASE.md](docs/SEGURIDAD-FIREBASE.md) para configurar secretos y rotar claves si fue expuesta.
