// Primera vez: tutorial de bienvenida (4 pantallas) y lista de "Primeros pasos" en Inicio.
// Qué se ha visto o descartado se guarda en el propio móvil, por usuario (no necesita base de datos).
import { sb, session } from './db.js';
import { html, raw, setHtml } from './util.js';
import { t } from './i18n.js';
import { ICONS, LOGO } from './icons.js';

const key = (k) => `${k}_${session.user ? session.user.id : 'anon'}`;
const read = (k) => { try { return localStorage.getItem(key(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(key(k), v); } catch { /* sin almacenamiento */ } };
const clear = (k) => { try { localStorage.removeItem(key(k)); } catch { /* sin almacenamiento */ } };

// ---------- tutorial de bienvenida ----------
const SLIDES = [
  { art: () => LOGO.replace('width="48" height="48"', 'width="84" height="84"'), id: 'welcome' },
  { art: () => ICONS.body, id: 'weight' },
  { art: () => ICONS.photos, id: 'photos' },
  { art: () => ICONS.food, id: 'food' },
];

export function openTour() {
  document.querySelector('.tour')?.remove();
  const host = document.createElement('div');
  host.className = 'tour';
  document.body.appendChild(host);
  document.body.classList.add('modal-open');
  let i = 0;
  const finish = () => {
    write('tourSeen', '1');
    host.remove();
    if (!document.querySelector('.modal')) document.body.classList.remove('modal-open');
  };
  const draw = () => {
    const s = SLIDES[i];
    const last = i === SLIDES.length - 1;
    setHtml(host, html`
      <div class="tour-card" role="dialog" aria-modal="true" aria-label="${t('tour.title.' + s.id)}">
        <div class="tour-art">${raw(s.art())}</div>
        <h2>${t('tour.title.' + s.id)}</h2>
        <p>${t('tour.text.' + s.id)}</p>
        <div class="tour-dots" aria-hidden="true">${SLIDES.map((_, n) => html`<i class="${n === i ? 'on' : ''}"></i>`)}</div>
        <div class="tour-actions">
          <button class="btn ghost" data-skip ${last ? 'hidden' : ''}>${t('tour.skip')}</button>
          <button class="btn primary" data-next>${last ? t('tour.start') : t('tour.next')}</button>
        </div>
      </div>`);
    host.querySelector('[data-next]').focus();
  };
  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-skip]')) finish();
    else if (e.target.closest('[data-next]')) { if (i === SLIDES.length - 1) finish(); else { i += 1; draw(); } }
  });
  draw();
}

export function maybeTour() {
  if (read('tourSeen') !== '1') openTour();
}

// ---------- primeros pasos (Inicio) ----------
const STEPS = [
  { id: 'profile', table: 'profiles', col: 'user_id', href: '#/profile' },
  { id: 'weight', table: 'weigh_ins', col: 'id', href: '#/body' },
  { id: 'photos', table: 'photos', col: 'id', href: '#/photos' },
  { id: 'meals', table: 'meals', col: 'id', href: '#/food' },
  { id: 'workouts', table: 'workouts', col: 'id', href: '#/sport' },
];

// Devuelve la lista de pasos con su estado, o null si ya no hay que enseñarla (descartada o completada).
export async function firstSteps() {
  if (read('stepsHidden') === '1' || read('stepsDone') === '1') return null;
  const done = await Promise.all(STEPS.map(async (s) => {
    try {
      const { data, error } = await sb.from(s.table).select(s.col).limit(1);
      return !error && Array.isArray(data) && data.length > 0;
    } catch { return false; }
  }));
  if (done.every(Boolean)) { write('stepsDone', '1'); return null; }
  return STEPS.map((s, n) => ({ ...s, done: done[n] }));
}

export const hideSteps = () => write('stepsHidden', '1');
export const showSteps = () => clear('stepsHidden');

export async function renderSteps(el) {
  const steps = await firstSteps();
  if (!steps) { setHtml(el, html``); return; }
  const n = steps.filter((s) => s.done).length;
  setHtml(el, html`
    <div class="card steps">
      <div class="steps-head">
        <div><h3>${t('steps.title')}</h3><p class="muted small">${t('steps.progress', { n, total: steps.length })}</p></div>
        <button class="icon-btn" data-hide-steps aria-label="${t('steps.hide')}">✕</button>
      </div>
      <div class="bar"><i style="width:${Math.round((n / steps.length) * 100)}%"></i></div>
      <ul>${steps.map((s) => html`<li class="${s.done ? 'done' : ''}"><a href="${s.href}" data-step="${s.id}"><span class="tick">${s.done ? '✓' : ''}</span><span class="grow">${t('steps.' + s.id)}</span><span class="chev">›</span></a></li>`)}</ul>
    </div>`);
  el.querySelector('[data-hide-steps]').onclick = () => { hideSteps(); setHtml(el, html``); };
}
