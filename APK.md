# Evolucionapp en APK (Android) — guía

Última revisión: 28 de octubre de 2026. Elegida la **opción B: Capacitor** (la misma web dentro de una APK con acceso al móvil).
**Estado:** la fase 1 (la app dentro de una APK + login con Google + construcción automática en GitHub) está preparada pero **todavía no se ha compilado nunca**: desde el entorno donde trabajo Claude no se pueden descargar las herramientas de Android, así que el primer intento real lo haces tú en GitHub. Si falla, se arregla viendo el registro de errores (es lo normal en un primer intento).

---

## Fase 1 · Conseguir tu primera APK (paso a paso)

### Paso 1 · Subir los archivos nuevos (en dos partes)
**1a. Con GitHub Desktop:** verás unos 60 archivos nuevos (carpeta `android/`, `scripts/`, `package.json`, `package-lock.json`, `capacitor.config.json`, `.gitignore`) y algunos cambiados (`js/app.js`, `js/db.js`, `js/version.js`…). *Commit to main* → *Push origin*.

**1b. La receta de GitHub hay que crearla a mano en la web** (por seguridad, a Claude no se le permite escribir en la carpeta `.github` de tu ordenador):
1. Abre en tu PC el archivo `scripts/receta-github-android.yml` (con el Bloc de notas), selecciona todo y copia.
2. En github.com → tu repositorio → *Add file* → *Create new file*.
3. En el nombre escribe exactamente `.github/workflows/android.yml` (al escribir las `/` se crean las carpetas solas).
4. Pega el contenido → *Commit changes…* → *Commit changes*.
5. En GitHub Desktop pulsa *Fetch origin* para traer ese archivo a tu PC (así no hay conflictos la próxima vez).

### Paso 2 · Permitir el regreso del login en Supabase
Supabase → tu proyecto → *Authentication* → *URL Configuration* → en **Redirect URLs** pulsa *Add URL* y añade:

```
com.evolucionapp.app://**
```
y *Save*. **No borres** la dirección de la web que ya está. Sin esto, el login de la APK falla al volver.

### Paso 3 · Pedir a GitHub que construya la APK
1. En github.com → tu repositorio → pestaña **Actions**. Si sale un aviso de activar los workflows, acéptalo.
2. A la izquierda: **Construir APK de Android** → botón **Run workflow** → *Run workflow* (verde).
3. Espera entre 5 y 15 minutos (la primera vez tarda más). Verás un círculo naranja y luego un ✔ verde.
4. Entra en esa ejecución y, abajo del todo, en **Artifacts**, descarga **Evolucionapp-APK** (es un `.zip`). Descomprímelo: dentro está `app-release.apk`.
5. **Si sale una ✗ roja:** entra en el paso que falló, copia el texto del error (o haz captura) y pásamelo.

### Paso 4 · Instalarla en el móvil
1. Pasa el `.apk` al móvil (cable, Google Drive, Telegram, correo…).
2. Ábrelo desde el móvil. Android te pedirá permitir «instalar apps desconocidas» para la app desde la que lo abres (Chrome, Drive, Archivos…): actívalo solo para esa.
3. Si Google Play Protect avisa de que la app no es conocida, pulsa *Más detalles → Instalar de todos modos* (es normal: es una APK de pruebas tuya).
4. Si tenías la web instalada como app (PWA), puedes dejarla o quitarla; son dos apps distintas y la APK te pedirá iniciar sesión otra vez.

### Paso 5 · Probar (esto es lo importante)
1. Abre la app → *Continuar con Google* → se abre una pestaña de Chrome con tu cuenta → eliges cuenta → **debe volver sola a la app ya con tu sesión**.
2. Comprueba: ver tus pesos/entrenos, registrar un entreno, subir una foto de progreso, leer una captura de la báscula, buscar un alimento, y que el botón *atrás* y los menús inferiores se ven bien (no tapados por la barra del sistema).
3. Cuéntame qué falla. Los candidatos más probables: la vuelta del login, la barra inferior tapada o el selector de fotos.

### Para las siguientes versiones
Cada vez que cambie la web: *Commit + Push* y repetir el **Paso 3**. Las APK nuevas se instalan **encima** de la anterior sin desinstalar (están firmadas con la misma clave y cada construcción sube su número de versión).

---

## Qué se ha preparado (para que sepas qué hay en cada carpeta)

| Archivo / carpeta | Para qué sirve |
|---|---|
| `package.json`, `package-lock.json` | Lista las herramientas (Capacitor 8.5.3) con versión exacta, para que siempre se construya igual. |
| `capacitor.config.json` | Nombre (`Evolucionapp`) e identificador (`com.evolucionapp.app`) de la app. |
| `scripts/prepare-www.mjs` | Copia solo la web (index, js, css, icons, vendor…) a `www/`, lo que va dentro de la APK. Deja fuera pruebas, SQL y guías. |
| `android/` | El proyecto Android: icono y pantalla de arranque con tu logo, permiso de Internet, enlace de vuelta del login, firma fija. |
| `.github/workflows/android.yml` (se crea en el paso 1b; copia en `scripts/receta-github-android.yml`) | La receta que instala Java/Node, copia la web, construye la APK y te la deja descargar. |
| `js/db.js`, `js/app.js` | Login con Google en el navegador del sistema cuando la app va dentro de la APK (en la web normal no cambia nada) y sin service worker en la APK. |

**Decisiones que conviene conocer**
- **Identificador `com.evolucionapp.app`**: no se puede cambiar después de publicar en Play.
- **La web va dentro de la APK** (no se carga de GitHub Pages): funciona sin conexión para lo básico y no depende de que la web esté arriba, pero **cada cambio de la web exige una APK nueva** (la web instalada/PWA sigue actualizándose sola).
- **Firma de pruebas pública:** la clave está en el repositorio (`android/app/evolucionapp.keystore`, contraseña `evolucionapp`). Sirve para que las actualizaciones se instalen encima; **no es secreta ni vale para Google Play**. Para publicar habría que crear una clave privada propia y guardarla bien (si se pierde, no se puede actualizar la app).
- **Copia de seguridad de Android desactivada** (`allowBackup=false`): la sesión no se copia a la nube de Google.
- **Barra de estado:** la APK deja la web entre las barras del sistema (hora/batería arriba, gestos abajo) quitando `viewport-fit=cover` en la copia que va dentro. El color de esas barras sigue el tema del sistema, no el de la app.
- **WebView antiguo:** el puente de Capacitor se inyecta bien en cualquier Android con WebView actualizado (Android 7 o superior es el mínimo del proyecto). En un WebView muy viejo, la política de seguridad (CSP) de la web podría bloquearlo; no lo he podido comprobar.

---

## Fase 2 · Leer el reloj con Health Connect (después de que la fase 1 funcione)

**Health Connect** es el «buzón» de salud de Android: apps como Samsung Health, Garmin Connect o Fitbit/Pixel Watch dejan ahí sus datos (según mi conocimiento; hay que confirmarlo con tu reloj) y Evolucionapp los lee **en el propio móvil, sin cuentas, sin servidor y sin revisiones de Google**.

- Plugin candidato: [`@capgo/capacitor-health`](https://cdn.jsdelivr.net/npm/@capgo/capacitor-health@8.7.0/README.md). Según su documentación lee entrenos (duración en segundos, kcal, distancia en metros) y pulsaciones aparte, y necesita Android 8+. **Por comprobar:** su licencia (la documentación no la indica) y que los entrenos funcionen bien en Android. Alternativa de pago: Capawesome Insiders.
- Se añadiría un botón «Importar desde Health Connect» en Deporte (solo en la APK) que rellena los mismos campos que ya tiene el formulario (duración, kcal, pulsaciones media/máx., distancia) y guarda el entreno con origen `health_connect` (el SQL 07 ya lo permite).
- **Tú:** al primer uso, Android pregunta si dejas a Evolucionapp leer esos datos; y en la app de tu reloj hay que activar el envío a Health Connect.
- **Probarlo solo se puede en un Android real con tu reloj vinculado.**

## Publicar en Google Play (solo si algún día lo quieres)
- 25 $ una sola vez. Si la cuenta de desarrollador es personal y se creó después del 13 de noviembre de 2023, Google exige una **prueba cerrada con al menos 12 testers inscritos 14 días seguidos** antes de publicar ([ayuda de Google Play](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)).
- Hace falta una clave de firma propia y privada, y, con datos de salud, la *declaración de apps de salud* ([documentación de Android](https://developer.android.com/health-and-fitness/health-connect/declare-access)). No he comprobado si hace falta para instalaciones a mano.
- Con tu límite de «no gastar dinero», mi consejo sigue siendo **no pasar por Play Store** de momento.

## iPhone
No entra en este plan: haría falta un Mac y la cuenta de Apple de pago (99 $/año, dato de mi conocimiento, no verificado hoy). En iPhone se sigue usando la web instalada (PWA), que ya incluye la captura del resumen del entreno.

## Riesgos que conviene tener presentes
- **El primer build puede fallar** por detalles de configuración que no he podido probar (Gradle y las herramientas de Android no se pueden descargar desde mi entorno). Se arregla con el registro de errores.
- **El login con Google dentro de la APK** es lo más delicado: si falla, la app no se puede usar. Está probado con una simulación en el navegador, no en un móvil real.
- **Solo Android.**
- **Datos de salud = datos sensibles** (cuando llegue la fase 2): mantener al día la política de privacidad.
