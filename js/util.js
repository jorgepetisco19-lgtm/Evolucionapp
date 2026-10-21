// Utilidades comunes: plantillas HTML seguras, fechas, eventos, avisos y ventanas.
import { t, locale } from './i18n.js';

// ---------- HTML seguro ----------
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(s);
const part = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join('') : v == null || v === false ? '' : esc(v));
// html`<b>${texto}</b>`: escapa todo salvo otros html`` anidados.
export function html(strings, ...vals) {
  let s = '';
  strings.forEach((str, i) => { s += str; if (i < vals.length) s += part(vals[i]); });
  return new Raw(s);
}
export const setHtml = (el, r) => { el.innerHTML = String(r); };

// ---------- fechas (siempre en hora local, nunca UTC) ----------
export const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => fmtDate(new Date());
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
export const monthRange = (y, m) => ({ from: `${y}-${pad(m + 1)}-01`, to: fmtDate(new Date(y, m + 1, 0)) });
export const weekdayIndex = (s) => (parseDate(s).getDay() + 6) % 7; // 0 = lunes
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export function dateLong(s) {
  return cap(new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(s)));
}
export function dateShort(s) {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDate(s));
}
export function dateTiny(s) {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(parseDate(s));
}

// ---------- números ----------
export function num(v, dec = 1) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString(locale(), { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}
export function signed(v, dec = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const r = Math.round(v * 10 ** dec) / 10 ** dec;
  return (r > 0 ? '+' : '') + r.toLocaleString(locale(), { maximumFractionDigits: dec });
}
export const toNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// ---------- navegación (rutas con #) ----------
export function navigate(name, params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const q = new URLSearchParams(clean).toString();
  const target = `#/${name}${q ? '?' + q : ''}`;
  if (location.hash === target) refresh();
  else location.hash = target;
}
export const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

// ---------- eventos ----------
// Delegación: on(el, 'click', '[data-act]', (e, target) => ...)
export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(e, el);
  });
}

// ---------- avisos ----------
export function toast(msg, kind = 'info') {
  let host = document.getElementById('toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  if ([...host.children].some((c) => c.textContent === msg)) return; // sin avisos repetidos
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3000);
}
export const errMsg = (e) => (e && (e.message || e.error_description)) || String(e);
export function fail(e) { console.error(e); toast(errMsg(e), 'error'); }

// ---------- ventana modal (hoja desde abajo) ----------
export function openModal(content, { title = '', wide = false } = {}) {
  const host = document.createElement('div');
  host.className = 'modal';
  host.innerHTML = String(html`
    <div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
      <header class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="${t('common.close')}">✕</button></header>
      <div class="sheet-body">${content}</div>
    </div>`);
  document.body.appendChild(host);
  document.body.classList.add('modal-open');
  const api = {
    el: host,
    body: host.querySelector('.sheet-body'),
    close() {
      host.remove();
      if (!document.querySelector('.modal')) document.body.classList.remove('modal-open');
      api.onClose && api.onClose();
    },
  };
  host.addEventListener('click', (e) => { if (e.target === host || e.target.closest('[data-close]')) api.close(); });
  return api;
}

// Cierra las ventanas abiertas (al cambiar de pantalla no deben quedarse encima).
export function closeAllModals() {
  document.querySelectorAll('.modal').forEach((m) => m.remove());
  document.body.classList.remove('modal-open');
}

export const spinner = (text = '') => html`<div class="loading"><span class="spin"></span>${text}</div>`;

export function confirmBox(message) {
  return Promise.resolve(window.confirm(message));
}

// ---------- imágenes ----------
// Redimensiona una foto a un lado máximo y la devuelve como JPEG (ahorra datos y espacio en la nube).
export async function compressImage(file, maxSide = 1280, quality = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', quality));
}
