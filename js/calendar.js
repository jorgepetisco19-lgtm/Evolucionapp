// Calendario mensual reutilizable (inicio y comparador).
import { html, pad, todayStr, cap } from './util.js';
import { t, locale } from './i18n.js';

export const KINDS = ['weight', 'measures', 'photos', 'meals', 'workouts'];

/**
 * opts: { year, month (0-11), markers: { 'YYYY-MM-DD': ['weight', ...] },
 *         selected: { 'YYYY-MM-DD': 'A' | 'B' | '' }, onPick(date), onMonth(year, month), legendKinds }
 */
export function renderCalendar(el, opts) {
  const { year, month, markers = {}, selected = {}, onPick, onMonth, legendKinds = KINDS } = opts;
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  const days = new Date(year, month + 1, 0).getDate();
  const today = todayStr();
  const title = cap(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(first));
  const wd = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale(), { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)));

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(html`<span class="day empty"></span>`);
  for (let d = 1; d <= days; d++) {
    const ds = `${year}-${pad(month + 1)}-${pad(d)}`;
    const ks = markers[ds] || [];
    const sel = Object.prototype.hasOwnProperty.call(selected, ds);
    cells.push(html`<button type="button" class="day ${ds === today ? 'today' : ''} ${sel ? 'sel' : ''} ${ks.length ? 'has' : ''}" data-date="${ds}" aria-label="${ds}">
      <span class="n">${d}</span>
      <span class="dots">${ks.map((k) => html`<i class="dot k-${k}"></i>`)}</span>
      ${sel && selected[ds] ? html`<b class="badge">${selected[ds]}</b>` : ''}
    </button>`);
  }
  const legendHtml = legendKinds.length
    ? html`<div class="legend">${legendKinds.map((k) => html`<span><i class="dot k-${k}"></i>${t('cal.' + k)}</span>`)}</div>`
    : '';
  el.innerHTML = String(html`
    <div class="cal">
      <div class="cal-head">
        <button type="button" class="icon-btn" data-nav="-1" aria-label="${t('cal.prev')}">‹</button>
        <strong class="cal-title">${title}</strong>
        <button type="button" class="icon-btn" data-nav="1" aria-label="${t('cal.next')}">›</button>
      </div>
      <div class="cal-grid wd">${wd.map((w) => html`<span>${w}</span>`)}</div>
      <div class="cal-grid">${cells}</div>
      ${legendHtml}
    </div>`);
  el.onclick = (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const d = new Date(year, month + Number(nav.dataset.nav), 1);
      onMonth && onMonth(d.getFullYear(), d.getMonth());
      return;
    }
    const day = e.target.closest('.day[data-date]');
    if (day) onPick && onPick(day.dataset.date);
  };
}

// Junta en un mapa fecha -> tipos los registros de las distintas tablas.
export function buildMarkers(parts) {
  const m = {};
  for (const [kind, rows] of Object.entries(parts)) {
    for (const r of rows || []) {
      const set = (m[r.date] ||= []);
      if (!set.includes(kind)) set.push(kind);
    }
  }
  for (const d of Object.keys(m)) m[d].sort((a, b) => KINDS.indexOf(a) - KINDS.indexOf(b));
  return m;
}
