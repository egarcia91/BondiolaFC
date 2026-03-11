# Firestore: jugadores, partidos, organizaciones e invitaciones

La app usa **Firestore** para leer y escribir jugadores, partidos, organizaciones e invitaciones.

## Colecciones

### `organizaciones`

Cada documento representa un grupo/organización con sus propios jugadores y partidos.

| Campo     | Tipo   | Descripción |
| --------- | ------ | ----------- |
| nombre    | string | Nombre de la organización (ej. "Bondiola FC") |
| slug      | string | (opcional) Identificador URL-friendly |
| creadoPor | string | UID del usuario que creó la organización |
| creadoEn  | timestamp | Fecha de creación |

### `invitaciones`

Códigos de invitación para que un usuario se una a una organización.

| Campo         | Tipo      | Descripción |
| ------------- | --------- | ----------- |
| codigo        | string    | Código corto (ej. "ABC123") |
| organizacionId| string    | ID del documento en `organizaciones` |
| creadoPor     | string    | UID del admin que creó la invitación |
| creadoEn      | timestamp | Fecha de creación |
| expiraEn      | timestamp | Fecha de vencimiento |
| usado         | boolean   | `true` si ya se usó la invitación |

### `jugadores`

Cada documento tiene estos campos (y opcionalmente **organizacionId** y **userId** para la etapa multi-organización):

| Campo        | Tipo    | Ejemplo                    |
| ------------ | ------- | -------------------------- |
| organizacionId | string | (opcional) ID de la organización a la que pertenece el jugador. Requerido después de la migración. |
| userId       | string  | (opcional) UID de Firebase Auth del usuario vinculado a este jugador. |
| nombre       | string  | "Hernan Zaniratto"         |
| posicion     | string  | "Delantero", "Defensor", "Mediocampista", "Arquero" |
| apodo        | string  | "Herni"                    |
| partidos     | number  | 0                          |
| victorias    | number  | 0                          |
| partidosEmpatados | number | 0                    |
| partidosPerdidos  | number | 0                    |
| goles        | number  | 0                          |
| elo          | number  | 900                        |
| eloHistorial | array   | [] — historial de Elo por partido, ej. [900, 908, 905] |
| descripcion  | string  | ""                         |
| mail         | string  | Email del usuario que se registró como este jugador (vacío si no está registrado). |
| registrado   | boolean | `true` si un usuario con Google vinculó su cuenta a este jugador. |
| admin        | boolean | `true` si el jugador es administrador de la página. Por defecto `false`. |
| fechaNacimiento | string | Fecha de nacimiento (YYYY-MM-DD). El usuario la edita en configuración. |
| equipoFavorito | string | `"rojo"` o `"azul"`. El usuario lo elige en configuración. |
| mvp            | number | 0 — cantidad de veces elegido MVP del partido (puede ser fracción si hay empate en votos). |

La **edad** no se guarda en la base: se calcula al leer a partir de `fechaNacimiento` y se muestra en la interfaz solo como número.

### `partidos`

Cada documento tiene estos campos (y opcionalmente **organizacionId** para la etapa multi-organización):

| Campo              | Tipo   | Descripción |
| ------------------ | ------ | ----------- |
| organizacionId     | string | (opcional) ID de la organización. Requerido después de la migración. |
| fecha              | string | "2026-02-26" |
| hora               | string | "21:00"     |
| lugar              | string | "Por definir" |
| concluido          | boolean | `true` si el partido ya se jugó y tiene resultado; `false` por defecto si aún no ocurrió. |
| estadisticasAplicadas | boolean | `true` cuando ya se actualizaron partidos/victorias/elo de los jugadores; evita duplicar al re-editar. |
| equipoLocal        | map    | Ver abajo   |
| equipoVisitante    | map    | Ver abajo   |
| ganador            | string | "Empate" o nombre del equipo ganador |
| mvpVotos           | array  | (opcional) Encuesta MVP: `[{ votanteId, votadoId }, ...]`. Un voto por jugador participante. |
| mvpEstadisticasAplicadas | boolean | `true` cuando ya se sumó el MVP a los jugadores ganadores. |
| mvpResultado       | array  | (opcional) `[{ jugadorId, mvpSumado }, ...]` para poder revertir al dar de baja el partido. |

**equipoLocal / equipoVisitante** (mapas):

- `nombre` (string): ej. "Rojo", "Azul"
- `jugadores` (array de objetos): cada elemento es `{ id?: string, nombre?: string }`. Si el jugador está registrado se guarda `{ id: "<docId del jugador>" }`; si es invitado, `{ nombre: "Nombre" }`. Así, si un usuario cambia su apodo, el partido sigue reconociendo al jugador por ID.
- `goles` (number)
- `golesAnotadores` (array de strings, opcional): un elemento por gol; cada valor es el **ID** del jugador anotador, o `"__general__"` para "Anotador general", o `"guest:Nombre"` para invitados. Ej. `["<idChino>", "__general__", "<idCris>"]`.

La app normaliza partidos antiguos (donde `jugadores` o `golesAnotadores` eran nombres/apodos) al cargar, resolviendo nombres a IDs cuando hay coincidencia con la colección `jugadores`.

## Cómo cargar datos

1. En [Firebase Console](https://console.firebase.google.com) → tu proyecto → **Firestore Database**.
2. Creá la colección `jugadores` y agregá documentos (el **ID** puede ser automático).
3. Creá la colección `partidos` y agregá documentos con la estructura de arriba.

Para migrar los datos que tenés en `src/data/jugadores.json` y `src/data/partidos.json`, podés copiarlos manualmente o usar la consola de Firestore para importar.

## Migración de datos

En la app, entrá a **Migrar datos** (en la navegación) y hacé clic en **Migrar datos a Firestore**. Eso copia los jugadores y partidos desde los archivos locales a Firestore. Solo hace falta ejecutarlo una vez; si ya hay datos, no se vuelve a migrar para evitar duplicados.

Para que la migración pueda escribir, las reglas de Firestore tienen que permitir `write` (por ejemplo solo si el usuario está autenticado). Después de migrar podés volver a reglas de solo lectura si querés.

## Reglas de seguridad

En Firestore → Reglas. Para **permitir migración y uso con organizaciones** (usuarios logueados pueden leer y escribir):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /jugadores/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /partidos/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /organizaciones/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /invitaciones/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Así cualquiera puede leer; solo usuarios autenticados (Google o invitado no es “auth” de Firebase) pueden escribir. Para migrar, iniciá sesión con Google y después usá “Migrar datos”.

Si más adelante querés que solo usuarios logueados lean o que nadie pueda escribir, se pueden ajustar estas reglas.
