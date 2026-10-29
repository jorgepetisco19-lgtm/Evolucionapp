// Cuerpo: pesos (con OCR de la captura de la báscula) y medidas con cinta.
import { listAll, upsert, remove } from '../db.js';
import { FIELDS, MEASURES } from '../fields.js';
import { lineChart } from '../charts.js';
import {
  html, raw, setHtml, on, openModal, spinner, todayStr, dateShort, num, signed, toNum, fail, toast, navigate, refresh, confirmBox, addDays,
} from '../util.js';
import { t, locale } from '../i18n.js';
import { ICONS } from '../icons.js';
import { loadProfile, saveProfile } from '../plan.js';
import { trendSeries, projection, MIN_TARGET, MAX_TARGET } from '../weight-trend.js';

const MEASURE_FIELDS = MEASURES.map((key) => ({ key, unit: 'cm', step: 0.1, min: 20, max: 250 }));

const CFG = {
  weight: {
    table: 'weigh_ins', fields: FIELDS, primary: 'weight_kg', extras: ['body_fat_pct', 'muscle_mass_kg', 'bmi'], ocr: true,
    primaryDec: 2, defaultMetric: 'weight_kg',
  },
  measures: {
    table: 'measurements', fields: MEASURE_FIELDS, primary: 'waist_cm', extras: ['hip_cm', 'chest_cm', 'arm_cm', 'thigh_cm'], ocr: false,
    primaryDec: 1, defaultMetric: 'waist_cm',
  },
};
const view = { weight: { metric: 'weight_kg', range: 'all' }, measures: { metric: 'waist_cm', range: 'all' } };
const decOf = (f) => (f.step >= 1 ? 0 : f.step >= 0.1 ? 1 : 2);

export async function render(el, params) {
  const tab = params.tab === 'measures' ? 'measures' : 'weight';
  setHtml(el, html`
    <div class="seg" role="tablist">
      <button data-tab="weight" class="${tab === 'weight' ? 'on' : ''}">${t('body.weight')}</button>
      <button data-tab="measures" class="${tab === 'measures' ? 'on' : ''}">${t('body.measures')}</button>
    </div>
    <div id="body-content"></div>`);
  on(el, 'click', '.seg [data-tab]', (e, b) => navigate('body', { tab: b.dataset.tab }));
  const box = el.querySelector('#body-content');
  setHtml(box, spinner()); // mientras llegan los datos se ve el círculo, no un hueco vacío
  await renderRecords(box, tab, params);
}

async function renderRecords(el, tab, params) {
  const cfg = CFG[tab];
  const rows = await listAll(cfg.table, { asc: true });
  const st = view[tab];
  // Solo en Peso (v16): tendencia y meta. La meta es el «peso objetivo» del Perfil; si no se puede leer el perfil, simplemente no hay meta.
  let goal = null;
  if (tab === 'weight') {
    try { const p = await loadProfile(); goal = p && p.goal_weight_kg != null ? Number(p.goal_weight_kg) : null; } catch (e) { console.warn(e); }
  }
  const weights = tab === 'weight' ? rows.filter((r) => r.weight_kg != null).map((r) => ({ x: r.date, y: Number(r.weight_kg) })) : [];
  const trendAll = trendSeries(weights);
  const withData = cfg.fields.filter((f) => rows.some((r) => r[f.key] != null));
  if (!withData.find((f) => f.key === st.metric)) st.metric = (withData[0] || cfg.fields[0]).key;

  const draw = () => {
    const field = cfg.fields.find((f) => f.key === st.metric);
    const dec = decOf(field);
    let pts = rows.filter((r) => r[st.metric] != null);
    if (st.range !== 'all') {
      const from = addDays(todayStr(), -Number(st.range));
      pts = pts.filter((r) => r.date >= from);
    }
    const points = pts.map((r) => ({ x: r.date, y: Number(r[st.metric]) }));
    const inView = new Set(pts.map((r) => r.date));
    const showTrend = tab === 'weight' && st.metric === 'weight_kg' && points.length >= 3;
    const last = rows.filter((r) => r[cfg.primary] != null);
    const cur = last[last.length - 1];
    const prev = last[last.length - 2];
    const first = last[0];
    const pdec = cfg.primaryDec;
    const unit = cfg.fields.find((f) => f.key === cfg.primary).unit;
    const stats = cur
      ? html`<div class="stats">
          <div><span class="muted small">${t('body.current')}</span><strong>${num(cur[cfg.primary], pdec)} <small>${unit}</small></strong><span class="muted tiny">${dateShort(cur.date)}</span></div>
          <div><span class="muted small">${t('body.vsPrev')}</span><strong>${prev ? signed(cur[cfg.primary] - prev[cfg.primary], pdec) : '—'}</strong></div>
          <div><span class="muted small">${t('body.total')}</span><strong>${first && first !== cur ? signed(cur[cfg.primary] - first[cfg.primary], pdec) : '—'}</strong></div>
        </div>${tab === 'weight' ? trendBlock(weights, goal) : ''}`
      : '';
    const list = [...rows].reverse();
    setHtml(el, html`
      <div class="row-actions">
        ${cfg.ocr ? html`<button class="btn primary" id="ocr-btn">${raw(ICONS.camera)}<span>${t('body.fromCapture')}</span></button>` : ''}
        <button class="btn ${cfg.ocr ? '' : 'primary'}" id="add-btn">${raw(ICONS.plus)}<span>${t('body.addManual')}</span></button>
        ${cfg.ocr ? html`<input type="file" id="ocr-file" accept="image/*" hidden>` : ''}
      </div>
      ${rows.length === 0
        ? html`<div class="card empty"><p>${t(cfg.ocr ? 'body.emptyWeight' : 'body.emptyMeasures')}</p></div>`
        : html`
        <div class="card">
          ${stats}
          <div class="chart-controls">
            <select id="metric" aria-label="${t('body.metric')}">${withData.map((f) => html`<option value="${f.key}" ${f.key === st.metric ? 'selected' : ''}>${t('f.' + f.key)}${f.unit ? ' (' + f.unit + ')' : ''}</option>`)}</select>
            <div class="seg small">
              ${['30', '90', 'all'].map((r) => html`<button data-range="${r}" class="${st.range === r ? 'on' : ''}">${t('body.range.' + r)}</button>`)}
            </div>
          </div>
          ${lineChart(points, { unit: field.unit, decimals: dec, trend: showTrend ? trendAll.filter((p) => inView.has(p.x)) : null })}
          ${showTrend && points.length >= 3 ? html`<p class="tiny muted chart-legend">${t('trend.legend')}</p>` : ''}
        </div>
        <div class="card list">
          <h3>${t('body.history')}</h3>
          ${list.map((r, i) => {
            const older = list[i + 1];
            const d = older && r[cfg.primary] != null && older[cfg.primary] != null ? r[cfg.primary] - older[cfg.primary] : null;
            const extras = cfg.extras.filter((k) => r[k] != null).slice(0, 3)
              .map((k) => `${t('f.' + k)} ${num(r[k], decOf(cfg.fields.find((f) => f.key === k)))}`).join(' · ');
            return html`<button class="row" data-id="${r.id}">
              <div class="grow"><strong>${dateShort(r.date)}</strong><div class="muted small">${extras}</div></div>
              <div class="right"><strong>${num(r[cfg.primary], pdec)} ${unit}</strong>${d !== null ? html`<div class="small ${d > 0 ? 'up' : d < 0 ? 'down' : 'muted'}">${signed(d, pdec)}</div>` : ''}</div>
            </button>`;
          })}
        </div>`}`);
  };
  // Los listeners se añaden una sola vez (delegación); draw() solo repinta el HTML.
  on(el, 'change', '#metric', (e, sel) => { st.metric = sel.value; draw(); });
  on(el, 'click', '[data-range]', (e, b) => { st.range = b.dataset.range; draw(); });
  on(el, 'click', '.row[data-id]', (e, b) => {
    const rec = rows.find((r) => r.id === b.dataset.id);
    openForm(tab, rows, { date: rec.date, existing: rec });
  });
  on(el, 'click', '#add-btn', () => openForm(tab, rows, { date: todayStr() }));
  on(el, 'click', '[data-goal]', () => openGoal(goal));
  on(el, 'click', '#ocr-btn', () => el.querySelector('#ocr-file').click());
  on(el, 'change', '#ocr-file', (e, input) => { if (input.files[0]) fromCapture(input.files[0], rows); input.value = ''; });
  draw();

  if (params.date) {
    const existing = rows.find((r) => r.date === params.date);
    history.replaceState({}, '', `#/body?tab=${tab}`);
    openForm(tab, rows, { date: params.date, existing });
  }
}

// ---------- tendencia y meta (v16) ----------
const fmtEta = (d) => {
  const date = new Date(d + 'T12:00:00');
  const opts = date.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat(locale(), opts).format(date);
};

/** Filas «Tendencia · Meta · A este ritmo» bajo las cifras del peso. */
function trendBlock(weights, goal) {
  const pr = projection(weights, goal, todayStr());
  if (pr.status === 'noData') return '';
  const rate = pr.perWeek === null ? '' : Math.abs(pr.perWeek) < 0.05 ? ` · ${t('trend.stable')}` : ` · ${signed(pr.perWeek, 1)} ${t('trend.week')}`;
  const hasGoal = pr.status !== 'noTarget';
  const goalVal = !hasGoal ? html`<span class="muted">${t('trend.noGoal')}</span>`
    : pr.status === 'reached' ? html`${num(goal, 1)} kg · ✅ ${t('trend.reached')}`
    : html`${num(goal, 1)} kg · ${t('trend.left', { n: num(Math.abs(pr.remaining), 1) })}`;
  const pace = pr.status === 'eta' ? t('trend.eta', { d: fmtEta(pr.date) })
    : pr.status === 'away' ? t('trend.away') : pr.status === 'far' ? t('trend.far') : '';
  return html`
    <dl class="kv trend-kv">
      <div><dt>${t('trend.label')}</dt><dd>${num(pr.current, 1)} kg${rate}</dd></div>
      <div><dt>${t('trend.goal')}</dt><dd class="wrap">${goalVal} <button type="button" class="btn-link" data-goal="1">${t(hasGoal ? 'trend.change' : 'trend.set')}</button></dd></div>
      ${pace ? html`<div><dt>${t('trend.pace')}</dt><dd class="wrap">${pace}</dd></div>` : ''}
    </dl>
    ${pr.perWeek === null ? html`<p class="tiny muted">${t('trend.few')}</p>` : ''}`;
}

/** Ventana para fijar, cambiar o quitar la meta (se guarda en el Perfil: profiles.goal_weight_kg). */
function openGoal(goal) {
  const m = openModal(html`
    <form id="goal-form" autocomplete="off">
      <label class="field"><span>${t('trend.goalField')}</span>
        <input type="number" name="goal" inputmode="decimal" step="any" min="${MIN_TARGET}" max="${MAX_TARGET}" value="${goal ?? ''}" placeholder="—" required></label>
      <p class="tiny muted">${t('trend.goalHint')}</p>
      <div class="form-actions">
        ${goal != null ? html`<button type="button" class="btn danger" id="goal-del">${t('trend.remove')}</button>` : ''}
        <button class="btn primary" type="submit">${t('common.save')}</button>
      </div>
    </form>`, { title: t('trend.modal') });
  const form = m.body.querySelector('#goal-form');
  const store = async (val, btn) => {
    btn.disabled = true;
    try { await saveProfile({ goal_weight_kg: val }); m.close(); toast(t('common.saved')); refresh(); } catch (err) { btn.disabled = false; fail(err); }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const v = toNum(form.goal.value);
    if (v === null || v < MIN_TARGET || v > MAX_TARGET) { toast(t('trend.badGoal', { min: MIN_TARGET, max: MAX_TARGET }), 'error'); return; }
    store(Math.round(v * 10) / 10, form.querySelector('[type=submit]'));
  };
  const del = m.body.querySelector('#goal-del');
  if (del) del.onclick = () => store(null, del);
  return m;
}

// ---------- formulario (crear / editar) ----------
function openForm(tab, rows, { date, existing, values = {}, lowConf = [], preview = '', ocr = null }) {
  const cfg = CFG[tab];
  const v0 = existing || values;
  const low = new Set(lowConf);
  const m = openModal(html`
    <form id="rec-form" autocomplete="off">
      ${preview ? html`<img class="ocr-preview" src="${preview}" alt="">` : ''}
      ${ocr ? html`<p class="note ${ocr.found ? '' : 'warn'}">${ocr.found ? t('ocr.found', { n: ocr.found, total: cfg.fields.length }) : t('ocr.none')}</p>` : ''}
      <label class="field"><span>${t('common.date')}</span><input type="date" name="date" value="${date}" required max="2100-01-01"></label>
      <p class="note warn" id="exists" hidden>${t('body.exists')}</p>
      <div class="grid2">
        ${cfg.fields.map((f) => html`<label class="field ${low.has(f.key) ? 'low' : ''}">
          <span>${t('f.' + f.key)}${f.unit ? html` <small>${f.unit}</small>` : ''}</span>
          <input type="number" inputmode="decimal" step="any" name="${f.key}" value="${v0[f.key] ?? ''}" min="0" placeholder="—">
        </label>`)}
      </div>
      ${low.size ? html`<p class="tiny muted">${t('ocr.lowHint')}</p>` : ''}
      <div class="form-actions">
        ${existing ? html`<button type="button" class="btn danger" id="del">${raw(ICONS.trash)}<span>${t('common.delete')}</span></button>` : ''}
        <button class="btn primary" type="submit">${t('common.save')}</button>
      </div>
    </form>`, { title: t(tab === 'weight' ? 'body.formWeight' : 'body.formMeasures') });
  const form = m.body.querySelector('#rec-form');
  const note = m.body.querySelector('#exists');
  const check = () => { note.hidden = !(rows.find((r) => r.date === form.date.value) && !(existing && existing.date === form.date.value)); };
  form.date.addEventListener('change', check);
  check();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const row = { date: form.date.value };
    let count = 0;
    for (const f of cfg.fields) {
      const val = toNum(form[f.key].value);
      if (val !== null && (val < 0 || val > 100000)) { toast(t('body.badValue', { f: t('f.' + f.key) }), 'error'); return; }
      row[f.key] = val;
      if (val !== null) count++;
    }
    if (!row.date) { toast(t('body.needDate'), 'error'); return; }
    if (!count) { toast(t('body.needValue'), 'error'); return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await upsert(cfg.table, row, 'user_id,date');
      m.close();
      toast(t('common.saved'));
      refresh();
    } catch (err) { btn.disabled = false; fail(err); }
  };
  const del = m.body.querySelector('#del');
  if (del) {
    del.onclick = async () => {
      if (!(await confirmBox(t('common.confirmDelete')))) return;
      try { await remove(cfg.table, existing.id); m.close(); toast(t('common.deleted')); refresh(); } catch (err) { fail(err); }
    };
  }
  m.onClose = () => { if (preview) URL.revokeObjectURL(preview); };
  return m;
}

// ---------- OCR de la captura ----------
async function fromCapture(file, rows) {
  const status = html`<div id="ocr-status">${spinner(t('ocr.reading'))}</div>`;
  const m = openModal(status, { title: t('ocr.title') });
  const setText = (txt) => { const s = m.el.querySelector('.loading'); if (s) s.lastChild.textContent = txt; };
  try {
    const { runOcr } = await import('../ocr.js');
    const res = await runOcr(file, (s) => {
      if (s.stage === 'load') setText(t('ocr.stage.load'));
      else if (s.stage === 'engine') setText(t('ocr.stage.engine') + (s.progress ? ` ${Math.round(s.progress * 100)} %` : ''));
      else if (s.stage === 'read') setText(t('ocr.reading'));
      else if (s.stage === 'numbers') setText(t('ocr.stage.numbers'));
    });
    m.close();
    const preview = URL.createObjectURL(file);
    openForm('weight', rows, { date: todayStr(), values: res.values, lowConf: res.lowConf, preview, ocr: res });
  } catch (e) {
    m.close();
    console.error(e);
    toast(t('ocr.failed'), 'error');
    openForm('weight', rows, { date: todayStr() });
  }
}
