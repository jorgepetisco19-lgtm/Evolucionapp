// Arranque de la app: sesión, tema, idioma, navegación por pestañas y pantalla de acceso.
import { sb, session, signInWithGoogle } from './db.js';
import { t, getLang, setLang, onLangChange } from './i18n.js';
import { html, raw, setHtml, fail, spinner, closeAllModals } from './util.js';
import { ICONS, LOGO } from './icons.js';
import { maybeTour } from './onboarding.js';

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
    try { await signInWithGoogle(); } catch (err) { e.currentTarget.disabled = false; fail(err); }
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
  }
}

function startApp() {
  shell();
  renderRoute();
  maybeTour();
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
  if (user) startApp(); else showLogin(errorMsg);
}

async function boot() {
  applyTheme();
  document.documentElement.lang = getLang();
  const params = new URL(location.href).searchParams;
  const oauthError = params.get('error_description') || params.get('error');
  setHtml(root, spinner());
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
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
}

boot();
