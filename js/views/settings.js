// Ajustes: idioma, tema, avisos (solo APK), instalar la app y cerrar sesión.
import { session, signOut } from '../db.js';
import { html, setHtml, on, fail, toast } from '../util.js';
import { t, getLang, setLang } from '../i18n.js';
import { openTour, showSteps } from '../onboarding.js';
import { mountReminders } from './reminders-card.js';
import { openDeleteAccount } from './delete-account.js';
import { exportAndSave } from '../export.js';

const THEMES = ['auto', 'light', 'dark'];
const getTheme = () => { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } };

export async function render(el) {
  const theme = getTheme();
  const email = (session.user && session.user.email) || '';
  setHtml(el, html`
    <h2 class="page-title">${t('nav.settings')}</h2>
    <a class="card link-card" href="#/profile"><div><h3>${t('profile.link')}</h3><p class="muted small">${t('profile.linkHelp')}</p></div><span class="chev">›</span></a>
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
    <div id="rem-box"></div>
    <div class="card"><h3>${t('settings.tour')}</h3><p class="muted small">${t('settings.tourHelp')}</p><button class="btn" id="tour">${t('settings.tourBtn')}</button></div>
    ${window.__installPrompt ? html`<div class="card"><h3>${t('settings.install')}</h3><p class="muted small">${t('settings.installHelp')}</p><button class="btn primary" id="install">${t('settings.installBtn')}</button></div>` : html`<div class="card"><h3>${t('settings.install')}</h3><p class="muted small">${t('settings.installManual')}</p></div>`}
    <div class="card">
      <h3>${t('settings.account')}</h3>
      <p class="muted">${email}</p>
      <div class="row-actions">
        <button class="btn" id="export">${t('exp.btn')}</button>
        <button class="btn danger" id="logout">${t('settings.logout')}</button>
      </div>
      <p class="tiny muted">${t('exp.help')}</p>
      <p class="tiny muted acct-del"><button type="button" class="btn-link" id="del-acct">${t('acct.open')}</button></p>
    </div>
    <p class="tiny muted center"><a href="privacidad.html">${t('login.privacy')}</a> · <a href="terminos.html">${t('login.terms')}</a> · ${window.APP_VERSION || ''}</p>`);
  mountReminders(el.querySelector('#rem-box'));
  on(el, 'click', '[data-lang]', (e, b) => { setLang(b.dataset.lang); });
  on(el, 'click', '[data-theme]', (e, b) => {
    try { localStorage.setItem('theme', b.dataset.theme); } catch { /* sin almacenamiento */ }
    window.applyTheme();
    el.querySelectorAll('[data-theme]').forEach((x) => x.classList.toggle('on', x === b));
  });
  on(el, 'click', '#tour', () => { showSteps(); openTour(); });
  on(el, 'click', '#install', async () => {
    const p = window.__installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice;
    window.__installPrompt = null;
  });
  // Descargar mis datos: el botón se desactiva mientras se prepara (si no, dos toques seguidos descargarían dos copias).
  const runExport = async () => {
    const b = el.querySelector('#export');
    const label = b ? b.textContent : '';
    if (b) { if (b.disabled) return; b.disabled = true; b.textContent = t('exp.preparing'); }
    try {
      const r = await exportAndSave();
      toast(t(r.kind === 'shared' ? 'exp.shared' : 'exp.saved', { name: r.name }));
    } catch (e) {
      if (e && e.message === 'NEEDS_UPDATE') toast(t('exp.needsApk'), 'error'); else fail(e);
    } finally { if (b) { b.disabled = false; b.textContent = label; } }
  };
  on(el, 'click', '#export', runExport);
  on(el, 'click', '#del-acct', () => openDeleteAccount({ onExport: runExport }));
  on(el, 'click', '#logout', async () => {
    try { await signOut(); } catch (e) { fail(e); }
  });
}
