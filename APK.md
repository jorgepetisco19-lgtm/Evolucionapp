# Pasar Evolucionapp a APK: qué hay que hacer

Guía para ti (no hace falta saber programar). Última revisión: 25 de octubre de 2026.
Lo que está marcado con **[Claude]** lo preparo yo cuando me digas «ejecuta»; lo marcado con **[Tú]** son cosas que solo puedes hacer tú (cuentas, clics, probar en el móvil).

---

## 1. Qué tipo de APK te conviene

| Opción | Qué es | Health Connect (datos del reloj) | Coste | Mi opinión |
|---|---|---|---|---|
| **A. Envoltorio web «TWA»** (PWABuilder) | La web actual dentro de una APK | **No** | 0 € | Solo vale si no quieres leer el reloj |
| **B. Capacitor** | La misma web dentro de una APK con acceso al móvil | **Sí** | 0 € (instalando a mano) | **La recomendada** |
| C. Reescribir en nativo | App hecha desde cero en Kotlin | Sí | 0 € | No: tirar todo lo hecho por nada |

**Recomiendo la B.** Se reutiliza el 100 % del código actual. Capacitor es una herramienta gratuita que mete tu web en una APK y le da acceso a funciones del móvil.

## 2. Costes reales

- **Instalar la APK a mano en los móviles (sin Play Store): 0 €.** Cada persona tiene que permitir «instalar apps desconocidas» una vez, y para actualizar hay que pasarle el APK nuevo.
- **Publicar en Google Play: 25 $ una sola vez.** Además, si la cuenta de desarrollador es personal y se creó después del 13 de noviembre de 2023, Google exige una **prueba cerrada con al menos 12 testers que se mantengan inscritos 14 días seguidos** antes de dejarte publicar para todo el mundo ([fuente: ayuda de Google Play](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)). Con tu límite de «no gastar dinero», **mi consejo es empezar sin Play Store**.
- **iPhone: no entra en este plan.** Haría falta un Mac y la cuenta de Apple de pago (99 $/año, dato de mi conocimiento, no verificado hoy). En iPhone se sigue usando la web instalada como app (PWA), que ya funciona.

## 3. Cómo se construye la APK sin instalar nada en tu PC

Como tú no editas código y subes con GitHub Desktop, lo más cómodo es que **GitHub construya la APK por ti** (GitHub Actions, gratis en repositorios públicos). Tú haces *Commit + Push* y, a los pocos minutos, en la pestaña *Actions* de tu repositorio descargas el archivo `.apk`.

**[Claude]** prepararía estos archivos nuevos en tu carpeta:

1. `package.json` y `capacitor.config.json` (nombre de la app, identificador, qué carpeta se empaqueta).
2. Un script que copia solo los archivos de la web a una carpeta `www/` (sin `_test`, sin `supabase/`).
3. `.github/workflows/android.yml`: la receta que instala Java, Node y las herramientas de Android, crea el proyecto Android con `npx cap add android` y genera la APK.
4. Los cambios en la app (ver punto 4).

**[Tú]**: subir los archivos (Commit + Push), abrir *Actions*, esperar al tick verde y descargar el APK del apartado *Artifacts*.

**Alternativa en tu PC (Windows):** instalar Android Studio, abrir una terminal en la carpeta y ejecutar `npm install @capacitor/android`, `npx cap add android`, `npx cap open android` y pulsar *Run* ([documentación de Capacitor](https://capacitorjs.com/docs/android)). Funciona, pero son varios GB de instalación y más cosas que pueden fallar. La dejaría solo como plan B.

> **Lo que NO he podido probar:** desde mi entorno no puedo descargar las herramientas de Android (Gradle, SDK), así que **no puedo construir ni probar la APK aquí**. El primer intento en GitHub Actions puede fallar por detalles de configuración; lo iríamos corrigiendo viendo el registro de errores que me pegues. Es normal y se arregla en pocas vueltas, pero cuenta con ello.

## 4. Cosas de la app que hay que cambiar

### 4.1. El inicio de sesión con Google (imprescindible)
Google **bloquea** el login dentro de una web embebida en una app. Hay que abrirlo en el navegador del sistema y volver a la app con un enlace especial.

- **[Claude]**: en `js/db.js`, si la app detecta que va dentro de la APK, pide a Supabase la dirección de login con `skipBrowserRedirect: true`, la abre con el plugin `@capacitor/browser` y, al volver por el enlace `com.evolucionapp.app://auth`, cierra el navegador y completa el login (`exchangeCodeForSession`). En la web normal no cambia nada. ([Guía de Supabase sobre enlaces profundos](https://supabase.com/docs/guides/auth/native-mobile-deep-linking))
- **[Tú]**: en Supabase → *Authentication → URL Configuration → Redirect URLs* añadir `com.evolucionapp.app://**`.

### 4.2. Que la app abra sin internet y no choque con la caché
Dentro de la APK los archivos ya van incluidos, así que el `sw.js` (caché web) se desactiva en ese modo. **[Claude]**.

### 4.3. Política de privacidad
Para pedir permisos de salud, Android exige poder mostrar una política de privacidad. Ya tienes `privacidad.html`; **[Claude]** la enlaza desde la APK y añadiré la frase de los datos de salud.

### 4.4. Actualizaciones
Con la APK, cada cambio de la web exige una APK nueva (la receta de GitHub la genera sola cada vez que haces Push; a los testers hay que pasarles el APK nuevo). Mientras pruebas, **la web instalada (PWA) se sigue actualizando sola**, así que no hace falta abandonarla.

## 5. Leer el reloj: Health Connect (solo Android)

**Health Connect** es el «buzón» de salud de Android: apps como Samsung Health, Garmin Connect o Fitbit/Pixel Watch dejan ahí sus datos (según mi conocimiento; hay que confirmarlo con tu reloj), y Evolucionapp los lee directamente en el móvil, **sin cuentas, sin servidor y sin revisiones de Google**.

- Plugin candidato: [`@capgo/capacitor-health`](https://cdn.jsdelivr.net/npm/@capgo/capacitor-health@8.7.0/README.md). Según su documentación lee entrenos (duración en segundos, kcal, distancia en metros) y pulsaciones aparte, y necesita Android 8 o superior. **Por comprobar antes de decidir:** su licencia (la documentación no la indica) y que los entrenos funcionen bien en Android. Hay una alternativa de pago (Capawesome Insiders) por si falla.
- **[Claude]** añadiría un botón «Importar desde Health Connect» en Deporte, solo visible en la APK. Rellena los **mismos campos** que ya tiene el formulario de la v12 (duración, kcal, pulsaciones media/máx., distancia) y guarda el entreno con origen `health_connect` (el SQL 07 ya lo permite).
- **[Tú]**: al primer uso, Android pregunta si dejas a Evolucionapp leer esos datos; y en tu app de reloj (Samsung Health, Garmin…) hay que **activar el envío a Health Connect**. Si tu reloj no escribe ahí, la importación saldría vacía; lo sabremos en cuanto lo probemos con el tuyo.
- **Probarlo solo se puede en un móvil Android real con un reloj vinculado.** Yo no puedo; lo probarías tú y me contarías qué sale.
- **Google Play y datos de salud:** si algún día publicas en Play, Google pide una *declaración de apps de salud* y una sección de seguridad de datos ([documentación de Android](https://developer.android.com/health-and-fitness/health-connect/declare-access)). No he comprobado si hace falta para instalaciones a mano; sospecho que no, pero **no lo he verificado**.

## 6. Orden recomendado

1. **Ahora (hecho en la v12):** entrenos con kcal, pulsaciones y distancia + lectura de capturas. Funciona en Android e iPhone.
2. Probar la v12 con tu reloj y con 2 o 3 personas; ajustar el lector con capturas reales.
3. **Fase APK 1 (sin reloj):** montar el envoltorio, el login con Google y la receta de GitHub. Comprobar que se instala y se puede entrar. Es la parte con más riesgo de fallos «de configuración», por eso va sola.
4. **Fase APK 2:** Health Connect + botón de importar. Probar con tu móvil y tu reloj.
5. Solo si el grupo crece y quieres Play Store: pagar los 25 $, reunir los 12 testers 14 días y hacer la declaración de salud.

## 7. Riesgos que conviene tener presentes

- **El login con Google dentro de la APK** es lo más delicado: si falla, la app no se puede usar. Lo probaremos primero y solo.
- **Firma de la APK:** la receta usará una firma de pruebas («debug»). Vale para repartir a amigos, **no para Play Store**; para publicar habría que crear una clave propia y guardarla bien (si se pierde, no se puede actualizar la app).
- **Solo Android.** Quien tenga iPhone seguirá con la web instalada y con la captura del resumen, que es lo que da la v12.
- **Datos de salud = datos sensibles.** Todo se queda en el móvil y en tu Supabase, con las mismas reglas por usuario que ya tienes; al ser salud, conviene mantener la política de privacidad al día.
