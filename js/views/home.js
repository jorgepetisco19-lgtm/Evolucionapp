// Inicio: calendario con lo que has registrado cada día. Al tocar un día se ve el resumen y se salta al registro.
import { listRange } from '../db.js';
import { renderCalendar, buildMarkers } from '../calendar.js';
import { html, raw, setHtml, monthRange, todayStr, parseDate, dateLong, num, navigate, on } from '../util.js';
import { t } from '../i18n.js';
import { renderSteps } from '../onboarding.js';
import { ICONS } from '../icons.js';

let cur = null; // { y, m, sel }: se recuerda al volver a la pestaña

export async function render(el, params) {
  const now = new Date();
  if (!cur) cur = { y: now.getFullYear(), m: now.getMonth(), sel: todayStr() };
  if (params.date) {
    const d = parseDate(params.date);
    cur = { y: d.getFullYear(), m: d.getMonth(), sel: params.date };
  }
  setHtml(el, html`
    <section class="home">
      <div id="steps"></div>
      <div class="card" id="cal"></div>
      <div class="row-actions">
        <button class="btn ghost" id="today">${t('home.today')}</button>
        <button class="btn" id="compare">${raw(ICONS.compare)}<span>${t('home.compare')}</span></button>
      </div>
      <div class="card" id="day"></div>
    </section>`);
  el.querySelector('#today').onclick = () => {
    const n = new Date();
    cur = { y: n.getFullYear(), m: n.getMonth(), sel: todayStr() };
    draw(el);
  };
  el.querySelector('#compare').onclick = () => navigate('photos', { tab: 'compare' });
  on(el.querySelector('#day'), 'click', '[data-go]', (e, b) => {
    const { go, date, add } = b.dataset;
    if (go === 'weight') navigate('body', { tab: 'weight', date });
    else if (go === 'measures') navigate('body', { tab: 'measures', date });
    else if (go === 'photos') navigate('photos', { tab: 'gallery', date, add });
    else if (go === 'meals') navigate('food', { date, add });
    else if (go === 'workouts') navigate('sport', { date, add });
  });
  renderSteps(el.querySelector('#steps')).catch(() => {}); // sin bloquear el calendario
  await draw(el);
}

async function draw(el) {
  const { from, to } = monthRange(cur.y, cur.m);
  const [weight, measures, photos, meals, workouts] = await Promise.all([
    listRange('weigh_ins', from, to, 'id,date,weight_kg,body_fat_pct'),
    listRange('measurements', from, to, 'id,date,waist_cm,hip_cm'),
    listRange('photos', from, to, 'id,date,kind'),
    listRange('meals', from, to, 'id,date,name,kcal'),
    listRange('workouts', from, to, 'id,date,type,name,duration_min'),
  ]);
  const data = { weight, measures, photos, meals, workouts };
  const markers = buildMarkers(data);
  const calEl = el.querySelector('#cal');
  const paint = () => {
    renderCalendar(calEl, {
      year: cur.y, month: cur.m, markers, selected: { [cur.sel]: '' },
      onPick: (d) => { cur.sel = d; paint(); },
      onMonth: (y, m) => {
        const n = new Date();
        cur = { y, m, sel: y === n.getFullYear() && m === n.getMonth() ? todayStr() : `${y}-${String(m + 1).padStart(2, '0')}-01` };
        draw(el);
      },
    });
    paintDay(el.querySelector('#day'), data);
  };
  paint();
}

function paintDay(el, data) {
  const d = cur.sel;
  const at = (rows) => rows.filter((r) => r.date === d);
  const w = at(data.weight)[0];
  const ms = at(data.measures)[0];
  const ph = at(data.photos);
  const me = at(data.meals);
  const wo = at(data.workouts);
  const kcal = me.reduce((s, m) => s + Number(m.kcal || 0), 0);
  const kindName = (k) => t('photos.kind.' + k);
  const row = (kind, go, label, detail, hasData) => html`
    <div class="day-row">
      <i class="dot k-${kind}"></i>
      <div class="grow"><strong>${label}</strong>${detail ? html`<div class="muted small">${detail}</div>` : ''}</div>
      <button class="btn small ${hasData ? '' : 'primary'}" data-go="${go}" data-date="${d}" ${hasData ? '' : html`data-add="1"`}>${hasData ? t('home.open') : t('home.add')}</button>
    </div>`;
  setHtml(el, html`
    <h3 class="day-title">${dateLong(d)}</h3>
    ${row('weight', 'weight', t('cal.weight'), w ? `${num(w.weight_kg, 2)} kg${w.body_fat_pct != null ? ' · ' + num(w.body_fat_pct) + ' %' : ''}` : t('home.empty'), !!w)}
    ${row('measures', 'measures', t('cal.measures'), ms ? [ms.waist_cm != null ? `${t('f.waist_cm')} ${num(ms.waist_cm)}` : '', ms.hip_cm != null ? `${t('f.hip_cm')} ${num(ms.hip_cm)}` : ''].filter(Boolean).join(' · ') || '✓' : t('home.empty'), !!ms)}
    ${row('photos', 'photos', t('cal.photos'), ph.length ? ph.map((p) => kindName(p.kind)).join(', ') : t('home.empty'), ph.length > 0)}
    ${row('meals', 'meals', t('cal.meals'), me.length ? `${me.length} · ${num(kcal, 0)} kcal` : t('home.empty'), me.length > 0)}
    ${row('workouts', 'workouts', t('cal.workouts'), wo.length ? wo.map((x) => x.name || t('sport.type.' + x.type)).join(', ') : t('home.empty'), wo.length > 0)}`);
}
