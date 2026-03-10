# Backup pre-migración a organizaciones

Este directorio guarda una copia de los datos de Firestore **antes** de aplicar la migración que introduce organizaciones (múltiples grupos con sus propios jugadores y partidos).

## Cómo generar el backup

1. **Desde la app (recomendado):** Iniciá sesión como administrador, entrá en **Configuración** (⚙) y usá el botón **Exportar backup**. Se descargará un archivo JSON con jugadores y partidos. Guardalo en esta carpeta como `backup-YYYY-MM-DD.json`.

2. **Desde Firebase Console:** En tu proyecto → Firestore → exportá las colecciones `jugadores` y `partidos` (por ejemplo desde "Importar/Exportar" o copiando los documentos manualmente).

## Contenido del backup

- `jugadores`: todos los documentos de la colección jugadores.
- `partidos`: todos los documentos de la colección partidos.

Después de la migración, la app usará `organizacionId` en jugadores y partidos. Este backup permite recuperar el estado anterior si fuera necesario.
