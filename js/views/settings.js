// Ajustes: idioma, tema, instalar la app y cerrar sesión.
import { session, signOut } from '../db.js';
import { html, setHtml, on, fail } from '../util.js';
import { t, getLang, setLang } from '../i18n.js';

const THEMES = ['auto', 'light', 'dark'];
const getTheme = () => { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } };

export async function render(el) {
  const theme = getTheme();
  const email = (session.user && session.user.email) || '';
  setHtml(el, html`
    <h2 class="page-title">${t('nav.settings')}</h2>
    <div class="card">
      <h3>${t('settings.language')}</h3>
      <div class="chips">
        <button class="chip ${getLang() === 'es' ? 'on' : ''}" data-lang="es">Español</button>
        <button class="chip ${getLang() === 'en' ? 'on' : ''}" data-lang="en">English</button>
      </div>
    </div>
    <div class="card">
      <h3>${t('settings.theme')}</h3>
      <div class="chips">${THEMES.map((k) => html`<button class="chip ${theme === k ? 'on' : ''}" data-theme="${k}">${t('settings.theme.' + k)}</button>`)}</div>
    </div>
    ${window.__installPrompt ? html`<div class="card"><h3>${t('settings.install')}</h3><p class="muted small">${t('settings.installHelp')}</p><button class="btn primary" id="install">${t('settings.installBtn')}</button></div>` : html`<div class="card"><h3>${t('settings.install')}</h3><p class="muted small">${t('settings.installManual')}</p></div>`}
    <div class="card">
      <h3>${t('settings.account')}</h3>
      <p class="muted">${email}</p>
      <button class="btn danger" id="logout">${t('settings.logout')}</button>
    </div>
    <p class="tiny muted center"><a href="privacidad.html">${t('login.privacy')}</a> · <a href="terminos.html">${t('login.terms')}</a> · v1.0</p>`);
  on(el, 'click', '[data-lang]', (e, b) => { setLang(b.dataset.lang); });
  on(el, 'click', '[data-theme]', (e, b) => {
    try { localStorage.setItem('theme', b.dataset.theme); } catch { /* sin almacenamiento */ }
    window.applyTheme();
    el.querySelectorAll('[data-theme]').forEach((x) => x.classList.toggle('on', x === b));
  });
  on(el, 'click', '#install', async () => {
    const p = window.__installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice;
    window.__installPrompt = null;
  });
  on(el, 'click', '#logout', async () => {
    try { await signOut(); } catch (e) { fail(e); }
  });
}
