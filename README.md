# Evolucionapp

App personal para llevar tu evolución: **peso** (leído de la captura de tu app de báscula con OCR), **medidas**, **fotos** clasificadas
(frontal / lateral / espalda) con **comparador de dos fechas**, **comidas** con recetas propias y **entrenos** (gimnasio, pádel, caminar).
Es una web instalable en el móvil (PWA): español e inglés, modo claro y oscuro, inicio de sesión con Google y datos en la nube.

## Cómo está montada (para entenderla)

| Pieza | Qué hace | Coste |
|---|---|---|
| **GitHub Pages** | Aloja los archivos de la web (`index.html`, `js/`, `css/`...). | Gratis |
| **Supabase** | Inicio de sesión con Google, base de datos (pesos, comidas...) y almacén de fotos. | Gratis (500 MB de datos, 1 GB de fotos) |
| **Tesseract.js** (carpeta `vendor/`) | Lee la captura de la báscula **en tu móvil**; la imagen no se sube a ningún sitio. | Gratis |
| **Open Food Facts** | Buscador público de alimentos (kcal y macros por 100 g). | Gratis |

Seguridad: cada tabla tiene reglas RLS (en `supabase/schema.sql`) que hacen que cada usuario solo pueda leer y escribir **sus** filas, y las fotos
están en un almacén privado con una carpeta por usuario. La clave "anon" que hay en `js/config.js` es pública por diseño.

```
index.html          pantalla única; todo se pinta con JavaScript
js/app.js           arranque, sesión, navegación por pestañas
js/views/           una pantalla por archivo (inicio, cuerpo, fotos, comparador, comidas, deporte, ajustes)
js/ocr.js           lectura de la captura de la báscula (2 pasadas: etiquetas y números)
js/workout-ocr.js   (v12) lectura de la captura del resumen de un entreno (duración, kcal, pulsaciones, distancia)
js/db.js            todo el acceso a Supabase
js/net.js           corta las peticiones que no responden (12 s) y reintenta las lecturas una vez
js/i18n.js          textos en español e inglés
supabase/schema.sql tablas + seguridad (se ejecuta una vez)
sw.js               caché para que abra rápido y sin conexión
js/version.js       número de versión (se ve en la cabecera)
js/nutrition.js     fórmulas de metabolismo basal y objetivo de kcal
js/onboarding.js    tutorial de bienvenida y lista de primeros pasos
js/recipe-import.js lee recetas de CSV/Excel (formatos, avisos, plantilla)
js/xlsx-read.js     lector de .xlsx sin librerías
js/menu.js          cálculo de la sugerencia de menú del día
js/foods-db.js      tabla propia de ~150 ingredientes habituales (kcal y macros aproximados)
js/estimate.js      completa kcal/macros que faltan: tu memoria, tabla propia y, si no, Open Food Facts
js/ingredients.js   (v11) memoria de ingredientes: lo ya completado (Open Food Facts o a mano) para no esperar otra vez
js/views/food-tools.js  pantallas de importar recetas (también «completar en segundo plano»), repetir comidas y menú del día
supabase/03-menu.sql   (v6) añade las etiquetas de toma a las recetas
supabase/04-guarniciones.sql   (v9) añade la etiqueta «guarnición» a esa lista
supabase/05-primeros.sql   (v10) añade la etiqueta «primer plato» (incluye lo del 04)
supabase/06-ingredientes.sql   (v11) crea la tabla de tu memoria de ingredientes
APK.md              guía para conseguir la APK de Android (paso a paso, costes y riesgos)
android/            (v12.1) proyecto Android generado con Capacitor; no se edita a mano
capacitor.config.json, package.json, package-lock.json, scripts/prepare-www.mjs   (v12.1) ajustes y herramientas de la APK
.github/workflows/android.yml   (v12.1) receta que construye la APK en GitHub (pestaña Actions → Run workflow)
supabase/07-entrenos-reloj.sql   (v12) añade calorías, pulsaciones, distancia y los tipos Correr / Bici / Natación a los entrenos
supabase/functions/off-search/index.ts   (v11.2) función de Supabase que busca alimentos en Open Food Facts por ti (el navegador no puede)
```

## Puesta en marcha (una sola vez)

1. **Base de datos.** En Supabase: *SQL Editor* → *New query* → pega el contenido de `supabase/schema.sql` → *Run*.
   Comprueba que en *Table Editor* aparecen 9 tablas (`weigh_ins`, `measurements`, `photos`, `routines`, `workouts`, `recipes`, `meals`, `profiles`, `ingredients`) y en *Storage* el bucket `photos`.
2. **Subir el código.** En GitHub Desktop verás todos los archivos nuevos → *Commit to main* → *Push origin*.
3. **Publicar la web.** En github.com, repositorio → *Settings* → *Pages* → *Build and deployment*: *Deploy from a branch*, rama `main`, carpeta `/ (root)` → *Save*.
   A los 1-2 minutos estará en `https://jorgepetisco19-lgtm.github.io/Evolucionapp/`.
4. **Probar.** Abre esa dirección en Chrome del móvil → *Continuar con Google*.
5. **Instalar.** Menú ⋮ de Chrome → *Instalar app* (o *Añadir a la pantalla de inicio*). Mejor haz el primer inicio de sesión desde Chrome *antes* de instalar.

**Si ya tenías la base de datos creada antes de la v6:** ejecuta además `supabase/03-menu.sql` (SQL Editor → pegar → Run). Sin él todo funciona, pero las recetas no guardan sus etiquetas (desayuno/comida/merienda/cena).

**Para las etiquetas «guarnición» (v9) y «primer plato» (v10):** ejecuta también `supabase/05-primeros.sql` (después del 03; ya incluye lo del 04). Sin él, al etiquetar una receta como guarnición o primer plato la base de datos la rechaza.

**Para la memoria de ingredientes (v11):** ejecuta `supabase/06-ingredientes.sql`. Es seguro repetirlo y no toca nada existente. Sin él la app funciona igual, pero no recuerda los ingredientes (hay que esperar a Open Food Facts cada vez).

**Para los datos del reloj en los entrenos (v12):** ejecuta `supabase/07-entrenos-reloj.sql` (SQL Editor → pegar → Run). Es seguro repetirlo y no borra ni cambia tus entrenos. Sin él, los entrenos de siempre funcionan igual, pero al guardar calorías, pulsaciones, distancia o los tipos Correr / Bici / Natación la app avisa de que falta ejecutarlo.

Si Google devuelve `redirect_uri_mismatch`, espera unos minutos (Google tarda en aplicar los cambios) y revisa que la URI de redirección sea exactamente
`https://nxcyupxvkygghlwpboge.supabase.co/auth/v1/callback`.

## Tener un APK (opcional)

1. Entra en **pwabuilder.com**, pega la URL de tu web y pulsa *Start*.
2. *Package for stores* → *Android* → *Generate package* (deja la firma en "New") → descarga el `.zip`.
3. Dentro hay un `.apk` firmado. Pásalo al móvil e instálalo (Android te pedirá permitir "instalar apps desconocidas").

Ojo: como la web cuelga de `.../Evolucionapp/` y no de la raíz de GitHub Pages, Android no podrá verificar el dominio y es probable que el APK muestre una
barra de dirección arriba. La app funciona igual. La opción 5 de arriba (instalar desde Chrome) da el mismo resultado sin APK.

## Actualizar la app

Los cambios los prepara Claude y deja los archivos en esta carpeta. Tú solo haces *Commit to main* y *Push origin* en GitHub Desktop.
Cada cambio sube el número de `APP_VERSION` en `js/version.js` (es el que ves junto al nombre, arriba a la izquierda) para que los móviles descarguen la versión nueva (la app se actualiza al cerrarla del todo y volver a abrirla, a veces dos veces).

## Probar en el ordenador (opcional)

Con Python instalado: abre una terminal en esta carpeta y ejecuta `python -m http.server 8000`; entra en `http://localhost:8000`.
(Ya está permitida como "Redirect URL" en Supabase.)

## Cosas que conviene saber

- **Supabase gratis pausa el proyecto tras 7 días sin uso.** Los datos no se pierden: entra en supabase.com y pulsa *Restore* / *Resume project*.
- **Fotos:** se reducen a ~1280 px (≈ 300 KB) antes de subirse, más una miniatura. En 1 GB caben unas 3.000.
- **OCR:** está afinado con la app de báscula de tus capturas (rejilla de 3 columnas con 13 datos). Con otras apps puede leer menos campos; la pantalla de
  confirmación siempre te deja corregir a mano antes de guardar. Los campos en naranja son los dudosos.
- **Captura del entreno (v12):** en *Deporte → Registrar entreno → Datos del reloj* puedes subir una captura del resumen de tu reloj (Samsung Health, Garmin, Apple, Strava...). Cada app dibuja su pantalla distinta, así que lee lo que reconoce (duración, calorías, pulsaciones media/máx., distancia) y los campos en naranja son los dudosos; revísalos siempre. Si no lee nada, abre «Ver lo que he leído en la imagen»: ese texto sirve para ajustar el lector.
- **Comidas:** Open Food Facts es colaborativo; algunos productos vienen sin datos. Siempre puedes añadir un ingrediente a mano.
- **Una medición por día:** si guardas dos pesos o dos medidas el mismo día, el segundo reemplaza al primero.

**Para que el buscador de Open Food Facts funcione (v11.2):** Open Food Facts bloquea las búsquedas hechas directamente desde el navegador, así que la app las pide a una función de Supabase.
En Supabase → *Edge Functions* → *Deploy a new function* → *Via Editor* → nombre `off-search` → pega TODO `supabase/functions/off-search/index.ts` → *Deploy*. Deja activada la opción *Verify JWT*. Sin ella la app sigue funcionando (con la tabla interna, tu memoria y la llamada directa, que suele fallar).
Si cambias la dirección de la web, hay que cambiar `SITE` en esa función. Si cambias de proyecto de Supabase, hay que cambiar su dirección en `index.html` (línea `Content-Security-Policy`) y en `js/config.js`.

## Seguridad: qué guarda la app y qué hace falta cuidar

- **Contraseñas:** la app no tiene contraseñas. El acceso es «Continuar con Google»: tu contraseña de Google nunca llega a la app ni a Supabase. Supabase guarda solo lo que Google comparte al iniciar sesión: nombre, correo, foto de perfil e identificador.
- **Quién ve qué:** cada persona solo ve sus filas (reglas RLS en `schema.sql`, comprobadas con dos cuentas en las pruebas). Las fotos están en un almacenamiento privado y se ven con enlaces que caducan a la hora. La clave pública (`anon`) del código es pública por diseño; la clave `service_role` no está ni debe estar nunca en el código.
- **Quién tiene acceso total:** quien administra el proyecto de Supabase puede ver todos los datos de todos. Por eso lo más importante es proteger las cuentas de *Supabase*, *GitHub* y *Google* del administrador con verificación en dos pasos (2FA) y contraseñas únicas.
- **Código inyectado (XSS):** el texto que escribe la gente se escapa siempre antes de pintarse, y `index.html` lleva una política (CSP) que impide ejecutar código ajeno y hablar con servidores distintos de Supabase y Open Food Facts. Está probado.
- **Lo que hay que revisar en los paneles (no se puede desde el código):**
  1. Supabase → *Authentication* → *URL Configuration*: «Site URL» y «Redirect URLs» solo con `https://jorgepetisco19-lgtm.github.io/Evolucionapp/`.
  2. Supabase → *Authentication* → *Providers*: solo Google activado (nada de email/contraseña ni otros).
  3. Supabase → *Settings* → *API*: la clave `service_role` no se comparte ni se pega en ningún sitio.
  4. Google Cloud → *Credenciales*: el cliente OAuth solo con la dirección de retorno de Supabase, y los permisos pedidos solo `openid`, `email` y `profile`.
  5. GitHub: 2FA activado en la cuenta y el repositorio sin secretos.
