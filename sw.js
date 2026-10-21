// Service worker: guarda la "cáscara" de la app para que abra rápido y sin conexión.
// Los datos (pesos, fotos...) siempre se piden a Supabase; esto solo cachea archivos de la propia app.
// Al publicar cambios, sube el número de VERSION para que los móviles descarguen la versión nueva.
const VERSION = 'v1';
const CACHE = `evolucionapp-${VERSION}`;
const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/logo.svg', 'icons/icon-192.png',
  'js/app.js', 'js/config.js', 'js/db.js', 'js/i18n.js', 'js/util.js', 'js/icons.js', 'js/calendar.js', 'js/charts.js',
  'js/fields.js', 'js/exercises.js', 'js/off.js', 'js/ocr.js',
  'js/views/home.js', 'js/views/body.js', 'js/views/photos.js', 'js/views/compare.js', 'js/views/food.js', 'js/views/sport.js', 'js/views/settings.js',
  'vendor/supabase.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('evolucionapp-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase, Open Food Facts, etc.: siempre a la red
  if (url.searchParams.has('code')) return;   // vuelta del login de Google: no tocar
  // Archivos pesados del OCR: se guardan la primera vez que se usan.
  const isOcr = url.pathname.includes('/vendor/tesseract/');
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit && (isOcr || SHELL.some((p) => url.pathname.endsWith(p.replace(/^\.\//, '')) || url.pathname.endsWith('/')))) {
        // Cache primero, y se refresca en segundo plano.
        fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res)); }).catch(() => {});
        return hit;
      }
      return fetch(req).then((res) => {
        if (res.ok && (isOcr || /\.(js|css|svg|png|webmanifest|html|gz)$/.test(url.pathname) || url.pathname.endsWith('/'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit || caches.match('index.html'));
    }),
  );
});
