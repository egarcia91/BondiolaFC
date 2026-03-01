# Seguridad: claves de Firebase y despliegue

## Qué pasó

La **clave de API de Firebase** (y el resto de la config) se incluye en el JavaScript cuando hacés `npm run build`. Si ese build se sube a GitHub (por ejemplo la carpeta `dist/` o la rama `gh-pages`), la clave queda expuesta en el repositorio.

En una app web el front-end siempre “lleva” la config de Firebase (el navegador la necesita), pero **no debe estar en el historial del repo** para poder rotar claves y evitar alertas de seguridad.

## Pasos urgentes: rotar la clave expuesta

1. **Entrá a Google Cloud Console**  
   https://console.cloud.google.com/apis/credentials

2. **Seleccioná el proyecto** de Firebase (ej. `bondiolafc-3951d`).

3. **En “Credenciales”**, buscá la clave de API del navegador (Web API key) que termina en `...eQeDI` (la que apareció en el mail).

4. **Restringir o eliminar esa clave**  
   - Opción A: Editá la clave y restringila por “Referentes HTTP” a tus dominios (ej. `https://egarcia91.github.io/*`, `http://localhost:*`).  
   - Opción B: Eliminá esa clave y creá una nueva en “Credenciales” → “Crear credenciales” → “Clave de API”. Anotá la nueva clave.

5. **Actualizá tu `.env` local** (nunca lo subas a Git) con la nueva clave:
   ```env
   VITE_FIREBASE_API_KEY=tu_nueva_clave
   VITE_FIREBASE_AUTH_DOMAIN=bondiolafc-3951d.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=bondiolafc-3951d
   VITE_FIREBASE_STORAGE_BUCKET=bondiolafc-3951d.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=11725352130
   VITE_FIREBASE_APP_ID=1:11725352130:web:8cee15666d7a632e761f5b
   ```

6. **Configurá los secretos en GitHub** (ver más abajo) con la **nueva** clave para que el deploy desde Actions use la clave correcta y no la vieja.

## Cómo evitar que la clave se suba de nuevo

- **Nunca** hagas commit de:
  - `.env`
  - `.env.local`
  - La carpeta `dist/` (ya está en `.gitignore`).

- **No subas** el contenido de `dist/` a ninguna rama (ni `main` ni `gh-pages`) desde tu máquina. El deploy debe hacerse con **GitHub Actions** usando secretos, así la clave solo vive en GitHub Secrets y no en el código ni en el historial.

## Despliegue con GitHub Actions (recomendado)

El workflow en `.github/workflows/deploy.yml`:

1. Hace build en los servidores de GitHub.
2. Usa las variables de Firebase desde **GitHub Secrets** (no desde archivos del repo).
3. Sube el resultado como “artifact” y GitHub Pages lo publica **sin** que esos archivos queden en una rama del repo.

Así la clave **no se commitea** en ningún lado.

### Configurar los secretos en GitHub

1. En el repo: **Settings → Secrets and variables → Actions**.
2. **New repository secret** para cada uno (con los valores de tu proyecto Firebase):

   | Nombre del secreto              | Valor (ejemplo)                              |
   |--------------------------------|----------------------------------------------|
   | `VITE_FIREBASE_API_KEY`        | Tu nueva clave de API (Web)                  |
   | `VITE_FIREBASE_AUTH_DOMAIN`    | `bondiolafc-3951d.firebaseapp.com`          |
   | `VITE_FIREBASE_PROJECT_ID`     | `bondiolafc-3951d`                          |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `bondiolafc-3951d.firebasestorage.app`      |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `11725352130`                         |
   | `VITE_FIREBASE_APP_ID`         | `1:11725352130:web:8cee15666d7a632e761f5b`  |

3. En **Settings → Pages**: origen **“GitHub Actions”** (no la rama `gh-pages`).

Después de eso, cada push a `main` puede disparar el workflow y publicar la app con la config que está solo en los secretos.

## Limpiar el historial (opcional)

La clave vieja ya quedó en commits pasados. Rotarla en Google Cloud es lo importante. Si querés que esa clave no aparezca en el historial del repo, hace falta reescribir historia (por ejemplo con `git filter-repo` o BFG), lo cual cambia todos los hashes de commits; si ya alguien clonó el repo, tendrá que volver a clonar. Para la mayoría de los casos, **rotar la clave y usar solo Actions + secretos** es suficiente.
