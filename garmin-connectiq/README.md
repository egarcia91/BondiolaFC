# Bondiola FC — Connect IQ (Garmin), demo

Watch app mínima para anotar **gol Rojo / gol Azul** y **revertir** el último, sin teléfono todavía. Sirve para validar flujo en cancha y, en el siguiente paso, enlazar con la app web vía **Connect IQ Mobile SDK** (Companion) y Firestore.

## Requisitos

1. Cuenta de desarrollador en [Garmin Developer](https://developer.garmin.com/connect-iq/sdk/).
2. **Connect IQ SDK** instalado (incluye el compilador `monkeyc` y el simulador).
3. **OpenJDK** compatible con la versión del SDK que instales (el instalador de Garmin suele indicarlo).

## Clave de desarrollador

Generá `developer_key.der` con la herramienta del SDK y colocá el archivo en esta carpeta **sin commitearlo** (está ignorado en el `.gitignore` del repo).

## Compilar (línea de comandos)

Ajustá rutas según tu instalación del SDK. Ejemplo típico en Windows (PowerShell), desde `garmin-connectiq/`:

```powershell
$sdk = "$env:USERPROFILE\AppData\Roaming\Garmin\ConnectIQ\Sdks\connectiq-sdk-win-*\bin"
& (Join-Path $sdk "monkeyc.bat") `
  -o bondiolagol.prg `
  -f monkey.jungle `
  -y developer_key.der `
  -d fr255_sim `
  -w
```

- `-d`: dispositivo o simulador (ver `connectiq` del SDK).
- El `.prg` resultante se puede cargar en el simulador o en un reloj con modo desarrollador.

También podés abrir la carpeta como proyecto en **Visual Studio Code** con la extensión oficial de Connect IQ.

## Relación con BondiolaFC / Firestore

En la web, el partido en vivo guarda por equipo `goles`, `golesAnotadores` (IDs de jugador, `"__general__"` o `"guest:Nombre"`). Esta demo solo lleva el **marcador**; el siguiente paso es que el reloj (o el Companion en el celular) envíe eventos del estilo:

```json
{
  "v": 1,
  "tipo": "gol",
  "equipo": "local",
  "anotadorId": "DOCUMENT_ID_JUGADOR"
}
```

`equipo`: `local` ↔ `equipoLocal` (Rojo por defecto), `visitante` ↔ `equipoVisitante` (Azul). El Companion puede mapear eso a `updatePartido` en la app React o a Cloud Functions si preferís no exponer Firestore al reloj.

## Archivos

| Archivo | Rol |
|--------|-----|
| `manifest.xml` | Tipo `watch-app`, productos soportados de demo, `minSdkVersion` 3.4. |
| `monkey.jungle` | Entrada del proyecto para `monkeyc`. |
| `source/BondiolaGolApp.mc` | UI y lógica del marcador. |
| `resources/drawables/` | Icono launcher (placeholder). |

Si tu reloj no está en la lista de `manifest.xml`, agregá su `<iq:product id="..."/>` según la [tabla de dispositivos](https://developer.garmin.com/connect-iq/compatible-devices/) y recompilá.
