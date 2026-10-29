# Evolucionapp en APK (Android) — guía

Última revisión: 28 de octubre de 2026 (v13). Elegida la **opción B: Capacitor** (la misma web dentro de una APK con acceso al móvil).
**Estado (28 oct 2026):** la fase 1 funciona en tu móvil (APK instalada, login con Google OK). La fase 2 (importar del reloj) está hecha en la **v13**, pendiente de probar.

Historial de la fase 1: la construcción en GitHub **funciona** (la primera APK se compiló sin errores). Al instalarla, se quedó en una rueda de carga: faltaba cargar una pieza de Capacitor (`@capacitor/core`) que el puente de Android no trae; corregido en la **v12.2** (el arranque ahora también muestra el motivo en pantalla si algo falla, en vez de dejar la rueda para siempre). Pendiente de que lo pruebes en el móvil.

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
| `js/health.js` | Lee Health Connect (solo APK): permisos, lista de entrenos, pulsaciones y conversión a un entreno de la app. |
| `js/account.js` · `js/export.js` · `js/views/delete-account.js` | Borrar cuenta y descargar datos (v17). |
| `js/reminders.js` · `js/views/reminders-card.js` | Avisos (v15): ajustes en el móvil, planificador de 14 días, permiso y notificaciones locales; tarjeta de Ajustes. |
| `vendor/capacitor.js` (solo dentro de la APK; lo añade `prepare-www.mjs`) | La pieza `@capacitor/core` que permite usar el navegador del sistema y el enlace de vuelta del login. |
| `js/db.js`, `js/app.js` | Login con Google en el navegador del sistema cuando la app va dentro de la APK (en la web normal no cambia nada) y sin service worker en la APK. |

**Decisiones que conviene conocer**
- **Identificador `com.evolucionapp.app`**: no se puede cambiar después de publicar en Play.
- **La web va dentro de la APK** (no se carga de GitHub Pages): funciona sin conexión para lo básico y no depende de que la web esté arriba, pero **cada cambio de la web exige una APK nueva** (la web instalada/PWA sigue actualizándose sola).
- **Firma de pruebas pública:** la clave está en el repositorio (`android/app/evolucionapp.keystore`, contraseña `evolucionapp`). Sirve para que las actualizaciones se instalen encima; **no es secreta ni vale para Google Play**. Para publicar habría que crear una clave privada propia y guardarla bien (si se pierde, no se puede actualizar la app).
- **Copia de seguridad de Android desactivada** (`allowBackup=false`): la sesión no se copia a la nube de Google.
- **Barra de estado:** la APK deja la web entre las barras del sistema (hora/batería arriba, gestos abajo) quitando `viewport-fit=cover` en la copia que va dentro. El color de esas barras sigue el tema del sistema, no el de la app.
- **WebView antiguo:** el puente de Capacitor se inyecta bien en cualquier Android con WebView actualizado (Android 7 o superior es el mínimo del proyecto). En un WebView muy viejo, la política de seguridad (CSP) de la web podría bloquearlo; no lo he podido comprobar.

---

## Fase 2 · Importar entrenos del reloj con Health Connect (v13, ya hecha; pendiente de probar en tu móvil)

**Health Connect** es el «buzón de salud» de Android: la app de tu reloj deja ahí sus entrenos y Evolucionapp los **lee en el propio móvil**, sin cuentas ni servidores intermedios.

**Cómo se usa:** en *Deporte → Diario* (solo en la APK) aparece **Importar del reloj**. La primera vez Android pide permiso para *leer* entrenos, pulsaciones, calorías activas y distancia. Sale una lista de los entrenos de los últimos 30 días; marcas los que quieras y **Importar**. Cada uno se guarda como un entreno más (tipo, fecha, duración, kcal, distancia, pulsaciones media y máxima calculadas con las muestras del reloj) con origen «health_connect». No se duplican si importas dos veces. **Nunca sobrescribe nada:** crea un entreno nuevo. Si ese día ya tienes uno, el entreno del reloj sale sin marcar y con un desplegable para elegir **«Añadir los datos a: …»** tu entreno: entonces no se crea otro, solo se rellenan sus campos vacíos (kcal, distancia, pulsaciones, duración) y no se toca lo que ya escribiste (nombre, notas, ejercicios, tipo).

**Para que salga algo, tú:**
1. Ejecuta en Supabase el archivo `supabase/08-entrenos-health-connect.sql` (como hiciste con el 07). Sin él, la importación te lo dirá.
2. En la app de tu reloj (Mi Fitness / Zepp / Samsung Health / Garmin Connect…), activa el envío de datos a **Health Connect**. Si el reloj no lo ofrece, no habrá nada que importar (en ese caso sigue valiendo la captura del resumen).
3. En Android 13 o anterior hay que instalar «Health Connect» desde Google Play; en Android 14 o superior ya viene incluida.

**Qué se ha decidido**
- **Solo lectura:** el plugin trae declarados ~40 permisos (muchos de escritura); en `AndroidManifest.xml` se **quitan todos** salvo 4 de lectura (entrenos, pulsaciones, calorías activas, distancia).
- **Calorías = activas** (lo que Health Connect marca como «calorías activas» del entreno), que suele coincidir con las del resumen del reloj, pero puede diferir de las «totales».
- **Tipos:** correr, caminar/senderismo, bici, natación y gimnasio/fuerza se asignan solos; tenis, squash, bádminton y similares se proponen como **Pádel** (Health Connect no tiene pádel); lo demás, «Otro». Se puede editar el entreno después.
- **Solo 30 días hacia atrás** (límite de Health Connect sin un permiso extra, que no pedimos).
- **Android 8 o superior** (se subió el mínimo de 7 a 8 porque Health Connect lo exige).
- **Plugin:** [`@capgo/capacitor-health`](https://github.com/Cap-go/capacitor-health) 8.11.13, licencia MPL-2.0 (uso libre; solo obliga a compartir cambios en los archivos del propio plugin, que no tocamos).
- La **política de privacidad** se actualizó y se copia como `privacypolicy.html` dentro de la APK: es la página que Health Connect enseña al pulsar «Política de privacidad» en su pantalla de permisos.

**Riesgos:** la compilación en GitHub puede fallar la primera vez por el plugin nuevo (Kotlin/Gradle; no he podido compilarlo aquí): si pasa, copia el error y se arregla. Y todo lo de Health Connect está probado con el puente real de Android simulado, **no con un móvil y un reloj reales**.

## Fase 3 · Avisos (v15, solo APK)

Dos recordatorios opcionales, que tú configuras en **Ajustes → Avisos**: «¿Te has pesado hoy?» y «¿Has entrenado hoy?». Cada uno tiene su interruptor (apagados de entrada), su hora (por defecto 09:00 y 21:00) y los días de la semana.

- **Cómo funcionan:** la app programa en el propio móvil los avisos de los **próximos 14 días**, uno por día, y los vuelve a programar cada vez que la abres, vuelves a ella o guardas un peso/entreno. Si **hoy ya has registrado** ese dato, el aviso de hoy no suena. Si pasas unas dos semanas sin abrir la app, los avisos se acaban solos (no hay servidor que los siga mandando).
- **Permiso:** Android 13 o superior pide permiso de notificaciones; la app lo pide **solo al activar el primer aviso**. Si lo rechazas, el interruptor se queda apagado y se explica cómo darlo desde los ajustes del móvil.
- **Sin alarmas exactas:** el aviso llega «sobre» la hora (puede variar unos minutos, más si el móvil está en reposo). A cambio no se pide el permiso especial de alarmas exactas.
- **Al tocar el aviso:** el de peso abre Cuerpo y el de entreno abre Deporte.
- **Datos:** la hora y los días se guardan solo en el móvil (no en Supabase; no hay SQL nuevo). Cambiar de móvil o reinstalar obliga a configurarlos de nuevo. Al cerrar sesión se cancelan todos.
- **Xiaomi / Redmi / POCO y similares:** si no llegan a su hora, ve a Ajustes → Apps → Evolucionapp → **Ahorro de batería → Sin restricciones** y activa también **Inicio automático**. El botón «Probar con un aviso» de Ajustes lanza uno de prueba a los 5 segundos para comprobarlo.
- **Plugin:** `@capacitor/local-notifications` 8.3.1 (MIT). Se quita el permiso de alarmas exactas (`SCHEDULE_EXACT_ALARM`) del manifiesto; se mantienen los de notificaciones, arranque (para reprogramar tras reiniciar el móvil) y `WAKE_LOCK`. El icono de la notificación es `android/app/src/main/res/drawable/ic_stat_evolucionapp.xml`.
- **Sin probar en móvil real:** la lógica y el puente con el plugin están probados con una simulación en el navegador; la entrega real (sobre todo en Xiaomi) hay que verla en tu móvil.

## Fase 4 · Descargar datos y borrar cuenta (v17)

Primer paso hacia Google Play (que exige poder borrar la cuenta desde la app). En **Ajustes → Cuenta**:

- **Descargar mis datos:** un ZIP con un CSV por tabla (perfil, pesos, medidas, entrenos, rutinas, comidas, recetas, ingredientes y la lista de fotos) y un LEEME. **Las fotos no se incluyen.** En la web se descarga; en la APK se guarda en la caché y se abre el menú de «Compartir» de Android (Drive, correo, Telegram…). Usa dos plugins oficiales nuevos: `@capacitor/filesystem` 8.1.5 y `@capacitor/share` 8.0.3 (MIT, sin permisos nuevos en el manifiesto).
- **Borrar mi cuenta y mis datos:** hay que escribir BORRAR para confirmar. Orden: (1) ensayo en el servidor — si falta el SQL se avisa sin tocar nada; (2) se borran los archivos de las fotos del almacenamiento; (3) se borra el usuario y la base de datos borra con él todas sus filas; (4) se cierra la sesión. **No se puede deshacer.**
- **SQL nuevo:** `supabase/10-borrar-cuenta.sql` (función `delete_my_account`, solo borra a quien la llama).
- **Para Play:** además de esto faltan el `.aab` firmado, una página pública que explique cómo borrar la cuenta (con un correo de contacto), el aviso de «no es consejo médico», la ficha de la tienda y la prueba cerrada con 12 testers durante 14 días.
- **Sin probar en móvil real:** el guardado y el menú de compartir (solo simulados) y la compilación con los dos plugins nuevos.

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
