// Service worker: guarda la "cáscara" de la app para que abra rápido y sin conexión.
// Los datos (pesos, fotos...) siempre se piden a Supabase; esto solo cachea archivos de la propia app.
// La versión vive en js/version.js (se cambia solo allí, en cada publicación) para que los móviles descarguen la versión nueva.
importScripts('js/version.js');
const VERSION = self.APP_VERSION;
const CACHE = `evolucionapp-${VERSION}`;
const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/logo.svg', 'icons/icon-192.png',
  'js/app.js', 'js/config.js', 'js/db.js', 'js/i18n.js', 'js/util.js', 'js/icons.js', 'js/calendar.js', 'js/charts.js',
  'js/fields.js', 'js/exercises.js', 'js/off.js', 'js/ocr.js', 'js/workout-ocr.js', 'js/health.js', 'js/reminders.js', 'js/sport-stats.js', 'js/weight-trend.js', 'js/version.js', 'js/nutrition.js', 'js/plan.js', 'js/onboarding.js',
  'js/views/home.js', 'js/views/body.js', 'js/views/photos.js', 'js/views/compare.js', 'js/views/food.js', 'js/views/sport.js', 'js/views/sport-summary.js', 'js/views/settings.js', 'js/views/reminders-card.js', 'js/views/profile.js',
  'js/views/food-tools.js', 'js/recipe-import.js', 'js/xlsx-read.js', 'js/menu.js', 'js/foods-db.js', 'js/estimate.js', 'js/net.js', 'js/ingredients.js',
  'vendor/supabase.js',
];

// Instalación: se descargan TODOS los archivos de la app de una vez y saltándose la caché HTTP del navegador
// ("reload"); si no, podría guardar copias de hace unos minutos y mezclar archivos viejos con nuevos.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('evolucionapp-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Los archivos de la app salen SIEMPRE de la caché de esta versión (nunca de otra) y no se refrescan por su cuenta:
// solo cambian cuando cambia la versión (js/version.js) y se instala un service worker nuevo. Así nunca se mezclan versiones.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase, Open Food Facts, etc.: siempre a la red
  if (url.searchParams.has('code')) return;   // vuelta del login de Google: no tocar
  const isOcr = url.pathname.includes('/vendor/tesseract/'); // archivos pesados del OCR: se guardan la primera vez que se usan
  e.respondWith(
    caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && (isOcr || /\.(js|css|svg|png|webmanifest|html|gz)$/.test(url.pathname) || url.pathname.endsWith('/'))) cache.put(req, res.clone());
        return res;
      }).catch(() => cache.match('index.html'));
    })),
  );
});
