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
js/ocr.js           lectura de la captura (2 pasadas: etiquetas y números)
js/db.js            todo el acceso a Supabase
js/i18n.js          textos en español e inglés
supabase/schema.sql tablas + seguridad (se ejecuta una vez)
sw.js               caché para que abra rápido y sin conexión
js/version.js       número de versión (se ve en la cabecera)
js/nutrition.js     fórmulas de metabolismo basal y objetivo de kcal
js/onboarding.js    tutorial de bienvenida y lista de primeros pasos
js/recipe-import.js lee recetas de CSV/Excel (formatos, avisos, plantilla)
js/xlsx-read.js     lector de .xlsx sin librerías
js/menu.js          cálculo de la sugerencia de menú del día
js/views/food-tools.js  pantallas de importar recetas, repetir comidas y menú del día
supabase/03-menu.sql   (v6) añade las etiquetas de toma a las recetas
```

## Puesta en marcha (una sola vez)

1. **Base de datos.** En Supabase: *SQL Editor* → *New query* → pega el contenido de `supabase/schema.sql` → *Run*.
   Comprueba que en *Table Editor* aparecen 8 tablas (`weigh_ins`, `measurements`, `photos`, `routines`, `workouts`, `recipes`, `meals`, `profiles`) y en *Storage* el bucket `photos`.
2. **Subir el código.** En GitHub Desktop verás todos los archivos nuevos → *Commit to main* → *Push origin*.
3. **Publicar la web.** En github.com, repositorio → *Settings* → *Pages* → *Build and deployment*: *Deploy from a branch*, rama `main`, carpeta `/ (root)` → *Save*.
   A los 1-2 minutos estará en `https://jorgepetisco19-lgtm.github.io/Evolucionapp/`.
4. **Probar.** Abre esa dirección en Chrome del móvil → *Continuar con Google*.
5. **Instalar.** Menú ⋮ de Chrome → *Instalar app* (o *Añadir a la pantalla de inicio*). Mejor haz el primer inicio de sesión desde Chrome *antes* de instalar.

**Si ya tenías la base de datos creada antes de la v6:** ejecuta además `supabase/03-menu.sql` (SQL Editor → pegar → Run). Sin él todo funciona, pero las recetas no guardan sus etiquetas (desayuno/comida/merienda/cena).

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
- **Comidas:** Open Food Facts es colaborativo; algunos productos vienen sin datos. Siempre puedes añadir un ingrediente a mano.
- **Una medición por día:** si guardas dos pesos o dos medidas el mismo día, el segundo reemplaza al primero.
