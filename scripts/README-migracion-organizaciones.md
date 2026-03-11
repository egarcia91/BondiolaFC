# Migración a organizaciones en Firebase

Este script (y la opción desde la app) crean la organización **Bondiola FC** en Firestore y asignan `organizacionId` a todos los jugadores y partidos existentes.

## Opción 1: Desde la app (recomendado si no usás cuenta de servicio)

1. Abrí la app publicada (o `npm run dev` en local).
2. Iniciá sesión con **Google** usando una cuenta que sea **administrador** en Bondiola FC.
3. Entrá en **Configuración** (⚙ en el header).
4. Hacé clic en **"Migrar a organizaciones"**.
5. Confirmá en el diálogo. Al terminar, recargá la página.

Con eso Firestore queda con la nueva estructura y la app mostrará la organización Bondiola FC.

## Opción 2: Script con cuenta de servicio (Node)

Útil si querés automatizar o ejecutar desde CI.

### Requisitos

- Archivo **.env** en la raíz del proyecto con `VITE_FIREBASE_PROJECT_ID` (o `FIREBASE_PROJECT_ID`).
- **Cuenta de servicio** de Firebase:
  1. [Firebase Console](https://console.firebase.google.com) → tu proyecto → ⚙ **Configuración del proyecto**.
  2. Pestaña **Cuentas de servicio** → **Generar nueva clave privada**.
  3. Guardá el JSON en un lugar seguro (ej. `firebase-sa.json` en la raíz, y agregalo a `.gitignore`).

### Ejecución

**Windows (PowerShell):**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "firebase-sa.json"
npm run migrar:organizaciones
```

**O pasando la ruta como argumento:**
```powershell
node scripts/migrar-firebase-organizaciones.js ./firebase-sa.json
```

**Linux / macOS:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=firebase-sa.json
npm run migrar:organizaciones
```

El script crea la colección `organizaciones` con un documento "Bondiola FC" y actualiza todos los documentos de `jugadores` y `partidos` con el campo `organizacionId`. Solo debe ejecutarse **una vez**.
