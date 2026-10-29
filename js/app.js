// Arranque de la app: sesión, tema, idioma, navegación por pestañas y pantalla de acceso.
import { sb, session, signInWithGoogle, listenNativeLogin, isNative } from './db.js';
import { t, getLang, setLang, onLangChange } from './i18n.js';
import { html, raw, setHtml, fail, spinner, closeAllModals } from './util.js';
import { ICONS, LOGO } from './icons.js';
import { maybeTour } from './onboarding.js';
import { setSearchProxy } from './off.js';
import { initReminders } from './reminders.js';

const TABS = [
  { name: 'home', icon: 'home' },
  { name: 'body', icon: 'body' },
  { name: 'photos', icon: 'photos' },
  { name: 'food', icon: 'food' },
  { name: 'sport', icon: 'sport' },
];
const VIEWS = {
  home: () => import('./views/home.js'),
  body: () => import('./views/body.js'),
  photos: () => import('./views/photos.js'),
  food: () => import('./views/food.js'),
  sport: () => import('./views/sport.js'),
  settings: () => import('./views/settings.js'),
  profile: () => import('./views/profile.js'),
};

const root = document.getElementById('app');

// Búsqueda de alimentos: por la función de Supabase "off-search" (ver supabase/functions/off-search/index.ts y js/off.js).
setSearchProxy(async (q) => {
  const { data, error } = await sb.functions.invoke('off-search', { body: { q } });
  if (error) throw error;
  return data && data.products;
});

// ---------- tema ----------
export function applyTheme() {
  let pref = 'auto';
  try { pref = localStorage.getItem('theme') || 'auto'; } catch { /* sin almacenamiento */ }
  const el = document.documentElement;
  if (pref === 'auto') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', pref);
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f141b' : '#f5f7fa');
}
window.applyTheme = applyTheme;
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------- pantalla de acceso ----------
function showLogin(message) {
  setHtml(root, html`
    <main class="login">
      <div class="login-card">
        <div class="logo">${raw(LOGO)}</div>
        <h1>Evolucionapp</h1>
        <p class="muted">${t('login.tagline')}</p>
        <button class="btn google" id="btn-google">${raw(ICONS.google)}<span>${t('login.google')}</span></button>
        ${message ? html`<p class="error-text">${message}</p>` : ''}
        <div class="lang-switch">
          <button data-lang="es" class="${getLang() === 'es' ? 'on' : ''}">ES</button>
          <button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">EN</button>
        </div>
        <p class="tiny muted"><a href="privacidad.html">${t('login.privacy')}</a> · <a href="terminos.html">${t('login.terms')}</a></p>
      </div>
    </main>`);
  root.querySelector('#btn-google').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const btn = e.currentTarget;
    try {
      // En la APK el login ocurre en el navegador del sistema: si la persona lo cierra sin terminar, el botón debe poder pulsarse otra vez.
      if (await signInWithGoogle()) setTimeout(() => { btn.disabled = false; }, 2000);
    } catch (err) { btn.disabled = false; fail(err); }
  };
  root.querySelectorAll('[data-lang]').forEach((b) => { b.onclick = () => { setLang(b.dataset.lang); showLogin(message); }; });
}

// ---------- aplicación (con sesión) ----------
let token = 0;

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, q] = h.split('?');
  return { name: VIEWS[name] ? name : 'home', params: Object.fromEntries(new URLSearchParams(q || '')) };
}

function shell() {
  setHtml(root, html`
    <header class="top">
      <a class="brand" href="#/home">${raw(LOGO.replace('width="48" height="48"', 'width="28" height="28"'))}<span>Evolucionapp</span><small class="ver">${window.APP_VERSION || ''}</small></a>
      <a class="icon-btn" href="#/settings" aria-label="${t('nav.settings')}">${raw(ICONS.settings)}</a>
    </header>
    <main id="view" tabindex="-1"></main>
    <nav class="tabs" aria-label="Principal">
      ${TABS.map((tab) => html`<a href="#/${tab.name}" data-tab="${tab.name}">${raw(ICONS[tab.icon])}<span>${t('nav.' + tab.name)}</span></a>`)}
    </nav>`);
}

async function renderRoute() {
  if (!session.user) return;
  closeAllModals();
  if (!document.getElementById('view')) shell();
  const { name, params } = currentRoute();
  const my = ++token;
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
  // Cada pantalla recibe un contenedor NUEVO: así no se acumulan los "oyentes" de clics de las pantallas anteriores
  // (si se reutilizara, al pulsar "Medidas" también se ejecutaría el código de "Fotos" y te llevaría allí).
  const old = document.getElementById('view');
  const view = document.createElement('main');
  view.id = 'view';
  view.tabIndex = -1;
  old.replaceWith(view);
  setHtml(view, spinner());
  // Si tarda más de lo normal, se avisa en pantalla en vez de dejar un círculo girando sin explicación.
  const slow = setTimeout(() => {
    const l = my === token ? view.querySelector('.loading') : null;
    if (l && !l.textContent.trim()) l.append(t('common.slow'));
  }, 4000);
  try {
    const mod = await VIEWS[name]();
    if (my !== token) return;
    await mod.render(view, params);
    if (my === token) window.scrollTo({ top: 0 });
  } catch (e) {
    if (my !== token) return;
    console.error(e);
    setHtml(view, html`<div class="card error-card"><p>${t('common.error')}</p><p class="tiny muted">${(e && e.message) || e}</p><button class="btn" id="retry">${t('common.retry')}</button></div>`);
    view.querySelector('#retry').onclick = renderRoute;
  } finally {
    clearTimeout(slow);
  }
}

function startApp() {
  shell();
  renderRoute();
  maybeTour();
  try { initReminders(); } catch (e) { console.warn(e); } // avisos de la APK (en la web no hace nada)
}

window.addEventListener('hashchange', renderRoute);
onLangChange(() => { if (session.user) { shell(); renderRoute(); } });

// ---------- sesión ----------
let lastId = undefined;
function setUser(user, errorMsg) {
  const id = user ? user.id : null;
  if (id === lastId && !errorMsg) return;
  lastId = id;
  session.user = user;
  // Quita ?code=... de la barra de direcciones tras volver de Google.
  const u = new URL(location.href);
  if (u.searchParams.has('code') || u.searchParams.has('error')) {
    history.replaceState({}, '', u.pathname + (location.hash || ''));
  }
  if (!user) window.dispatchEvent(new Event('evo:logout')); // las pantallas con trabajo en marcha (importación) lo descartan
  if (user) startApp(); else showLogin(errorMsg);
}

async function boot() {
  applyTheme();
  document.documentElement.lang = getLang();
  const params = new URL(location.href).searchParams;
  const oauthError = params.get('error_description') || params.get('error');
  setHtml(root, spinner());
  try { listenNativeLogin((msg) => fail(new Error(msg))); } catch (e) { console.error(e); } // solo hace algo dentro de la APK
  try {
    const { data } = await sb.auth.getSession();
    setUser(data.session ? data.session.user : null, oauthError);
  } catch (e) {
    setUser(null, (e && e.message) || String(e));
  }
  // Solo reaccionamos si cambia el usuario (no al renovar el token), para no borrar formularios a medias.
  sb.auth.onAuthStateChange((_evt, s) => setUser(s ? s.user : null));
}

// ---------- PWA ----------
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });
// En la APK los archivos ya van dentro de la app: no hace falta (ni conviene) el service worker.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isNative()) {
  const hadController = !!navigator.serviceWorker.controller;
  // Cuando se instala una versión nueva, se recarga sola para no tener que abrir la app dos veces
  // (salvo que haya una ventana abierta o estés escribiendo, para no perder lo que llevas).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (hadController && !typing && !document.querySelector('.modal, .tour')) location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
}

// Si el arranque falla por lo que sea, se muestra el motivo en pantalla en vez de dejar un círculo girando para siempre.
boot().catch((e) => { console.error(e); setUser(null, (e && e.message) || String(e)); });
