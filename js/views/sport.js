// Deporte: registro de entrenos (gimnasio, pádel, caminar...) y rutinas guardadas con series, repeticiones y carga.
import { listRange, listAll, insert, update, remove } from '../db.js';
import { healthSupported, ensureAccess, recentWorkouts, heartStats, toRow, openHealthSettings } from '../health.js';
import { exerciseEditor, summarize, cleanExercises, setsText } from '../exercises.js';
import {
  html, raw, setHtml, on, openModal, spinner, todayStr, addDays, dateLong, toNum, fail, toast, navigate, refresh, confirmBox, weekdayIndex, parseDate,
} from '../util.js';
import { t, locale } from '../i18n.js';
import { ICONS } from '../icons.js';

const TYPES = ['gym', 'run', 'walk', 'cycling', 'swim', 'padel', 'other'];
const nf = (n, d = 2) => new Intl.NumberFormat(locale(), { maximumFractionDigits: d }).format(n);
// Datos del reloj de un entreno en una línea: "5,23 km · 320 kcal · 142 ppm de media · 168 máx."
function statsText(w) {
  const p = [];
  if (w.distance_km != null) p.push(`${nf(w.distance_km)} km`);
  if (w.calories_kcal != null) p.push(`${nf(w.calories_kcal, 0)} kcal`);
  if (w.hr_avg != null) p.push(t('sport.hrAvgText', { n: w.hr_avg }));
  if (w.hr_max != null) p.push(t('sport.hrMaxText', { n: w.hr_max }));
  return p.join(' · ');
}
// Si falta ejecutar el SQL 07 en Supabase, el error técnico no le dice nada a nadie: se avisa con una frase clara.
const sqlMissing = (e) => !!e && (['PGRST204', '42703'].includes(e.code) || (e.code === '23514' && /workouts_type_check/.test(e.message || '')) || /workouts_type_check|calories_kcal|hr_avg|distance_km/.test(e.message || ''));
const weekdayName = (i, style = 'short') => new Intl.DateTimeFormat(locale(), { weekday: style }).format(new Date(2024, 0, 1 + i));
const clone = (x) => JSON.parse(JSON.stringify(x));

export async function render(el, params) {
  const tab = params.tab === 'routines' ? 'routines' : 'day';
  setHtml(el, html`
    <div class="seg" role="tablist">
      <button data-tab="day" class="${tab === 'day' ? 'on' : ''}">${t('sport.day')}</button>
      <button data-tab="routines" class="${tab === 'routines' ? 'on' : ''}">${t('sport.routines')}</button>
    </div>
    <div id="sport-content"></div>`);
  on(el, 'click', '.seg [data-tab]', (e, b) => navigate('sport', { tab: b.dataset.tab }));
  const box = el.querySelector('#sport-content');
  setHtml(box, spinner()); // mientras llegan los datos se ve el círculo, no un hueco vacío
  if (tab === 'day') await renderDay(box, params); else await renderRoutines(box);
}

// ---------- diario ----------
async function renderDay(el, params) {
  const date = params.date || todayStr();
  const [workouts, routines] = await Promise.all([
    listRange('workouts', date, date, '*', 'created_at'),
    listAll('routines', { order: 'name', asc: true }),
  ]);
  const wd = weekdayIndex(date);
  const todays = routines.filter((r) => r.weekday === wd);
  setHtml(el, html`
    <div class="date-nav">
      <button class="icon-btn" data-d="-1" aria-label="${t('cal.prev')}">‹</button>
      <strong>${dateLong(date)}</strong>
      <button class="icon-btn" data-d="1" aria-label="${t('cal.next')}">›</button>
    </div>
    ${todays.length ? html`<div class="card suggest"><span>${t('sport.todayIs')}</span>
      ${todays.map((r) => html`<button class="btn small primary" data-start="${r.id}">${r.name}</button>`)}</div>` : ''}
    <div class="row-actions"><button class="btn primary" id="add-w">${raw(ICONS.plus)}<span>${t('sport.add')}</span></button>
      ${healthSupported() ? html`<button class="btn" id="hc-import">${t('hc.btn')}</button>` : ''}</div>
    ${workouts.length === 0 ? html`<div class="card empty"><p>${t('sport.empty')}</p></div>` : workouts.map((w) => html`
      <div class="card workout">
        <div class="wk-head">
          <i class="dot k-workouts"></i>
          <strong class="grow">${w.name || t('sport.type.' + w.type)}</strong>
          <span class="muted small">${w.duration_min ? w.duration_min + ' min' : ''}</span>
          <button class="icon-btn" data-edit="${w.id}" aria-label="${t('common.edit')}">${raw(ICONS.edit)}</button>
          <button class="icon-btn" data-del="${w.id}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>
        </div>
        ${statsText(w) ? html`<p class="wk-stats small">${statsText(w)}${w.source === 'capture' ? html` <span class="muted tiny">· ${t('sport.fromCaptureTag')}</span>` : ''}</p>` : ''}
        ${w.exercises && w.exercises.length ? html`<ul class="ex-list">${w.exercises.map((e) => html`<li><b>${e.name}</b> <span class="muted">${setsText(e, ' · ')}</span></li>`)}</ul>` : ''}
        ${w.notes ? html`<p class="muted small">${w.notes}</p>` : ''}
      </div>`)}`);
  on(el, 'click', '[data-d]', (e, b) => navigate('sport', { date: addDays(date, Number(b.dataset.d)) }));
  on(el, 'click', '#add-w', () => openWorkout({ date, routines }));
  on(el, 'click', '#hc-import', () => openImport());
  on(el, 'click', '[data-start]', (e, b) => openWorkout({ date, routines, type: 'gym', routine: routines.find((r) => r.id === b.dataset.start) }));
  on(el, 'click', '[data-edit]', (e, b) => openWorkout({ date, routines, existing: workouts.find((w) => w.id === b.dataset.edit) }));
  on(el, 'click', '[data-del]', async (e, b) => {
    if (!(await confirmBox(t('common.confirmDelete')))) return;
    try { await remove('workouts', b.dataset.del); toast(t('common.deleted')); refresh(); } catch (err) { fail(err); }
  });
  if (params.add) {
    history.replaceState({}, '', `#/sport?date=${date}`);
    openWorkout({ date, routines });
  }
}

function openWorkout({ date, routines, existing, type, routine }) {
  const state = {
    type: existing ? existing.type : type || 'gym',
    exercises: existing ? clone(existing.exercises || []) : routine ? clone(routine.exercises) : [],
    routineName: routine ? routine.name : existing && existing.type === 'gym' ? existing.name || '' : '',
    date: existing ? existing.date : date,
    name: existing && existing.type !== 'gym' ? existing.name || '' : '',
    duration: existing && existing.duration_min != null ? existing.duration_min : '',
    notes: existing && existing.notes ? existing.notes : '',
    saveRoutine: false,
    calories: existing && existing.calories_kcal != null ? existing.calories_kcal : '',
    distance: existing && existing.distance_km != null ? existing.distance_km : '',
    hr_avg: existing && existing.hr_avg != null ? existing.hr_avg : '',
    hr_max: existing && existing.hr_max != null ? existing.hr_max : '',
    fromCapture: false,                 // se rellenó con una captura (se guarda como origen del dato)
    cap: null,                          // { busy, text, found, lowConf, preview } mientras dura / tras leer una captura
    watchOpen: false,                   // el bloque "Datos del reloj" lo abrió la persona a mano
  };
  const hasWatch = () => ['calories', 'distance', 'hr_avg', 'hr_max'].some((k) => state[k] !== '' && state[k] !== null);
  const m = openModal(html`<form id="w-form" autocomplete="off"></form>`, { title: existing ? t('sport.edit') : t('sport.add'), wide: true });
  const form = m.body.querySelector('#w-form');
  const draw = () => {
    const lowSet = new Set(state.cap && !state.cap.busy ? state.cap.lowConf : []);
    setHtml(form, html`
      <label class="field"><span>${t('common.date')}</span><input type="date" name="date" value="${state.date}" required></label>
      <div class="chips" id="types">${TYPES.map((k) => html`<button type="button" class="chip ${state.type === k ? 'on' : ''}" data-type="${k}">${t('sport.type.' + k)}</button>`)}</div>
      ${state.type === 'gym' ? html`
        ${routines.length ? html`<label class="field"><span>${t('sport.fromRoutine')}</span>
          <select id="routine"><option value="">${t('sport.noRoutine')}</option>${routines.map((r) => html`<option value="${r.id}" ${r.name === state.routineName ? 'selected' : ''}>${r.name}</option>`)}</select></label>` : ''}
        <div id="ex-editor"></div>
        <div class="card save-routine">
          <label class="check"><input type="checkbox" id="save-routine" ${state.saveRoutine ? 'checked' : ''}><span>${t('sport.saveAsRoutine')}</span></label>
          ${state.saveRoutine ? html`<label class="field"><span>${t('sport.routineName')}</span>
            <input type="text" name="routineName" value="${state.routineName}" maxlength="60" placeholder="${t('sport.routinePh')}"></label>
            <p class="tiny muted">${t('sport.saveAsRoutineHint')}</p>` : ''}
        </div>` : html`
        <label class="field"><span>${t('sport.nameOpt')}</span><input type="text" name="name" value="${state.name}" maxlength="80"></label>`}
      <div class="grid2">
        <label class="field ${lowSet.has('duration_min') ? 'low' : ''}"><span>${t('sport.duration')}</span><input type="number" name="duration" min="0" inputmode="numeric" value="${state.duration}" placeholder="—"></label>
      </div>
      <details class="wk-extra" ${state.watchOpen || hasWatch() || state.cap ? 'open' : ''}>
        <summary>${t('sport.watchData')}</summary>
        <div class="cap-box">
          ${state.cap && state.cap.busy ? spinner(state.cap.msg || t('ocr.reading')) : html`
            <button type="button" class="btn small" id="cap-btn">${raw(ICONS.camera)}<span>${t('sport.fromCapture')}</span></button>
            <input type="file" id="cap-file" accept="image/*" hidden>
            ${state.cap ? '' : html`<p class="tiny muted">${t('sport.captureHint')}</p>`}`}
          ${state.cap && !state.cap.busy ? html`
            ${state.cap.preview ? html`<img class="ocr-preview" src="${state.cap.preview}" alt="">` : ''}
            <p class="note ${state.cap.found ? '' : 'warn'}">${state.cap.found ? t('sport.captureFound', { n: state.cap.found }) : t('sport.captureNone')}</p>
            ${state.cap.lowConf.length ? html`<p class="tiny muted">${t('ocr.lowHint')}</p>` : ''}
            ${state.cap.text ? html`<details class="tiny"><summary>${t('sport.captureText')}</summary><pre class="cap-text">${state.cap.text}</pre></details>` : ''}` : ''}
        </div>
        <div class="grid2">
          <label class="field ${lowSet.has('calories_kcal') ? 'low' : ''}"><span>${t('sport.calories')}</span><input type="number" name="calories" min="0" max="20000" inputmode="numeric" value="${state.calories}" placeholder="—"></label>
          <label class="field ${lowSet.has('distance_km') ? 'low' : ''}"><span>${t('sport.distance')}</span><input type="number" name="distance" min="0" max="1000" step="any" inputmode="decimal" value="${state.distance}" placeholder="—"></label>
          <label class="field ${lowSet.has('hr_avg') ? 'low' : ''}"><span>${t('sport.hrAvg')}</span><input type="number" name="hr_avg" min="30" max="250" inputmode="numeric" value="${state.hr_avg}" placeholder="—"></label>
          <label class="field ${lowSet.has('hr_max') ? 'low' : ''}"><span>${t('sport.hrMax')}</span><input type="number" name="hr_max" min="30" max="250" inputmode="numeric" value="${state.hr_max}" placeholder="—"></label>
        </div>
      </details>
      <label class="field"><span>${t('sport.notes')}</span><textarea name="notes" rows="2" maxlength="500">${state.notes}</textarea></label>
      <div class="form-actions"><button class="btn primary" type="submit">${t('common.save')}</button></div>`);
    if (state.type === 'gym') exerciseEditor(form.querySelector('#ex-editor'), state.exercises);
  };
  // Los campos sencillos se guardan en `state` al escribir, así sobreviven a los repintados.
  on(form, 'input', 'input[name], textarea[name]', (e, inp) => { state[inp.name] = inp.value; });
  on(form, 'click', '[data-type]', (e, b) => { state.type = b.dataset.type; draw(); });
  on(form, 'change', '#save-routine', (e, c) => { state.saveRoutine = c.checked; draw(); });
  on(form, 'change', '#routine', (e, sel) => {
    const r = routines.find((x) => x.id === sel.value);
    if (r) { state.exercises = clone(r.exercises); state.routineName = r.name; draw(); }
  });
  // "toggle" no se propaga hacia arriba: se escucha en la fase de captura para recordar si la persona abrió el bloque.
  form.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('wk-extra')) state.watchOpen = e.target.open; }, true);
  on(form, 'click', '#cap-btn', () => form.querySelector('#cap-file').click());
  on(form, 'change', '#cap-file', (e, input) => { if (input.files[0]) readCapture(input.files[0]); input.value = ''; });
  // Lee la captura del resumen del reloj y rellena el formulario (la persona lo revisa antes de guardar).
  async function readCapture(file) {
    if (state.cap && state.cap.preview) URL.revokeObjectURL(state.cap.preview);
    state.cap = { busy: true, msg: t('ocr.reading') };
    draw();
    const setMsg = (msg) => { state.cap.msg = msg; const l = form.querySelector('.cap-box .loading'); if (l && l.lastChild) l.lastChild.textContent = msg; };
    try {
      const { runWorkoutOcr } = await import('../workout-ocr.js');
      const res = await runWorkoutOcr(file, (st) => {
        if (st.stage === 'load') setMsg(t('ocr.stage.load'));
        else if (st.stage === 'engine') setMsg(t('ocr.stage.engine') + (st.progress ? ` ${Math.round(st.progress * 100)} %` : ''));
        else if (st.stage === 'read') setMsg(t('ocr.reading'));
      });
      const v = res.values;
      if (v.duration_min != null) state.duration = v.duration_min;
      if (v.calories_kcal != null) state.calories = v.calories_kcal;
      if (v.distance_km != null) state.distance = v.distance_km;
      if (v.hr_avg != null) state.hr_avg = v.hr_avg;
      if (v.hr_max != null) state.hr_max = v.hr_max;
      // El tipo solo se cambia si el entreno es nuevo y la persona no había empezado una rutina de gimnasio.
      if (res.type && !existing && !(state.type === 'gym' && state.exercises.length)) state.type = res.type;
      if (res.found) state.fromCapture = true;
      state.cap = { busy: false, found: res.found, lowConf: res.lowConf, text: res.text, preview: URL.createObjectURL(file) };
    } catch (err) {
      console.warn(err);
      toast(t('ocr.failed'), 'error');
      state.cap = { busy: false, found: 0, lowConf: [], text: '', preview: '' };
    }
    draw();
  }
  m.onClose = () => { if (state.cap && state.cap.preview) URL.revokeObjectURL(state.cap.preview); };
  draw();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const row = {
      date: state.date,
      type: state.type,
      name: state.type === 'gym' ? String(state.routineName || '').trim() || null : String(state.name).trim() || null,
      duration_min: toNum(state.duration),
      notes: String(state.notes).trim() || null,
      exercises: state.type === 'gym' ? cleanExercises(state.exercises) : [],
    };
    // Datos del reloj: solo se envían si tienen valor (o si había uno y se ha vaciado), así nada se rompe si aún no se ha ejecutado el SQL 07.
    const extra = {
      calories_kcal: toNum(state.calories), distance_km: toNum(state.distance), hr_avg: toNum(state.hr_avg), hr_max: toNum(state.hr_max),
    };
    const LIMITS = { calories_kcal: [0, 20000, 'sport.calories'], distance_km: [0, 1000, 'sport.distance'], hr_avg: [30, 250, 'sport.hrAvg'], hr_max: [30, 250, 'sport.hrMax'] };
    for (const [k, [lo, hi, label]] of Object.entries(LIMITS)) {
      if (extra[k] !== null && (extra[k] < lo || extra[k] > hi)) { toast(t('body.badValue', { f: t(label) }), 'error'); return; }
    }
    if (extra.hr_avg !== null && extra.hr_max !== null && extra.hr_avg > extra.hr_max) { toast(t('sport.badHr'), 'error'); return; }
    if (extra.calories_kcal !== null) extra.calories_kcal = Math.round(extra.calories_kcal);
    if (extra.hr_avg !== null) extra.hr_avg = Math.round(extra.hr_avg);
    if (extra.hr_max !== null) extra.hr_max = Math.round(extra.hr_max);
    for (const [k, v] of Object.entries(extra)) if (v !== null || (existing && existing[k] != null)) row[k] = v;
    if (state.fromCapture) row.source = 'capture';
    const asRoutine = state.type === 'gym' && state.saveRoutine;
    if (asRoutine && !row.name) { toast(t('sport.routineNameReq'), 'error'); return; }
    if (asRoutine && !row.exercises.length) { toast(t('sport.routineNeedsEx'), 'error'); return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (existing) await update('workouts', existing.id, row); else await insert('workouts', row);
      if (asRoutine) {
        // Si ya existe una rutina con ese nombre se actualiza; si no, se crea.
        const same = routines.find((r) => r.name.trim().toLowerCase() === row.name.toLowerCase());
        const data = { name: row.name, exercises: row.exercises };
        if (same) await update('routines', same.id, data); else await insert('routines', { ...data, weekday: null });
      }
      m.close(); toast(asRoutine ? t('sport.savedWithRoutine') : t('common.saved')); refresh();
    } catch (err) {
      btn.disabled = false;
      if (sqlMissing(err)) { console.warn(err); toast(t('sport.needSql'), 'error'); } else fail(err);
    }
  };
}

// ---------- importar de Health Connect (solo APK) ----------
const dayShort = (d) => new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(parseDate(d));
const hcSqlMissing = (e) => !!e && (['PGRST204', '42703'].includes(e.code) || /external_id/.test(e.message || ''));
function openImport() {
  const m = openModal(html`<div id="hc-box"></div>`, { title: t('hc.title'), wide: true });
  const box = m.body.querySelector('#hc-box');
  const S = { phase: 'loading', msg: '', list: [], picked: new Set(), imported: new Set(), sameDay: new Set(), hr: true };
  const line = (c) => [c.duration_min ? `${c.duration_min} min` : '', statsText(c)].filter(Boolean).join(' · ');
  const draw = () => {
    if (S.phase === 'loading') return setHtml(box, spinner(S.msg || t('hc.loading')));
    if (S.phase === 'msg') {
      return setHtml(box, html`<p class="note warn">${S.msg}</p>
        ${S.settings ? html`<button class="btn" id="hc-settings">${t('hc.openSettings')}</button>` : ''}`);
    }
    if (!S.list.length) return setHtml(box, html`<p class="note">${t('hc.empty')}</p>`);
    const n = S.picked.size;
    setHtml(box, html`
      <p class="tiny muted">${t('hc.hint')}</p>
      ${S.hr ? '' : html`<p class="note warn">${t('hc.noHr')}</p>`}
      <div class="hc-list">${S.list.map((c) => html`
        <label class="hc-item ${S.imported.has(c.id) ? 'done' : ''}">
          <input type="checkbox" data-id="${c.id}" ${S.picked.has(c.id) ? 'checked' : ''} ${S.imported.has(c.id) ? 'disabled' : ''}>
          <span class="grow">
            <strong>${t('sport.type.' + c.type)}</strong> <span class="muted small">${dayShort(c.date)} · ${c.time}</span><br>
            <span class="small">${line(c) || '—'}</span>
            ${S.imported.has(c.id) ? html`<br><span class="tiny muted">${t('hc.already')}</span>` : S.sameDay.has(c.date) ? html`<br><span class="tiny warn-text">${t('hc.sameDay')}</span>` : ''}
          </span>
        </label>`)}</div>
      <div class="form-actions"><button class="btn primary" id="hc-go" ${n ? '' : 'disabled'}>${t('hc.import', { n })}</button></div>`);
  };
  const stop = (msg, settings = false) => { S.phase = 'msg'; S.msg = msg; S.settings = settings; draw(); };
  on(box, 'change', '[data-id]', (e, c) => { if (c.checked) S.picked.add(c.dataset.id); else S.picked.delete(c.dataset.id); draw(); });
  on(box, 'click', '#hc-settings', () => { openHealthSettings().catch((e) => console.warn(e)); });
  on(box, 'click', '#hc-go', async () => {
    const chosen = S.list.filter((c) => S.picked.has(c.id));
    let ok = 0;
    S.phase = 'loading';
    try {
      for (const [i, c] of chosen.entries()) {
        S.msg = t('hc.importing', { i: i + 1, n: chosen.length });
        draw();
        const hr = S.hr ? await heartStats(c) : {};
        try { await insert('workouts', toRow(c, hr)); ok++; } catch (err) { if (err && err.code === '23505') continue; throw err; } // 23505: ya estaba importado
      }
      m.close(); toast(t('hc.imported', { n: ok })); refresh();
    } catch (err) {
      if (hcSqlMissing(err)) { console.warn(err); stop(t('hc.needSql')); } else { console.error(err); stop(t('hc.fail') + ((err && err.message) ? ` (${err.message})` : '')); }
    }
  });
  (async () => {
    try {
      const acc = await ensureAccess();
      if (!acc.ok) return stop(acc.reason === 'denied' ? t('hc.denied') : t('hc.unavailable'), acc.reason === 'denied');
      S.hr = acc.hr;
      const list = await recentWorkouts(30);
      let known = [];
      if (list.length) {
        try { known = await listRange('workouts', addDays(todayStr(), -40), addDays(todayStr(), 1), 'id,date,external_id'); } catch (err) {
          if (hcSqlMissing(err)) return stop(t('hc.needSql'));
          throw err;
        }
      }
      S.imported = new Set(known.map((w) => w.external_id).filter(Boolean));
      S.sameDay = new Set(known.filter((w) => !w.external_id).map((w) => w.date));
      S.list = list;
      // Marcados de entrada: los nuevos de días en los que aún no hay ningún entreno.
      S.picked = new Set(list.filter((c) => !S.imported.has(c.id) && !S.sameDay.has(c.date)).map((c) => c.id));
      S.phase = 'list';
      draw();
    } catch (err) {
      console.error(err);
      stop(t('hc.fail') + ((err && err.message) ? ` (${err.message})` : ''));
    }
  })();
  draw();
}

// ---------- rutinas ----------
async function renderRoutines(el) {
  const routines = await listAll('routines', { order: 'name', asc: true });
  setHtml(el, html`
    <div class="row-actions"><button class="btn primary" id="new-r">${raw(ICONS.plus)}<span>${t('sport.newRoutine')}</span></button></div>
    ${routines.length === 0 ? html`<div class="card empty"><p>${t('sport.noRoutines')}</p></div>` : routines.map((r) => html`
      <div class="card workout">
        <div class="wk-head">
          <strong class="grow">${r.name}</strong>
          ${r.weekday !== null && r.weekday !== undefined ? html`<span class="badge-day">${weekdayName(r.weekday)}</span>` : ''}
          <button class="icon-btn" data-edit="${r.id}" aria-label="${t('common.edit')}">${raw(ICONS.edit)}</button>
          <button class="icon-btn" data-del="${r.id}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>
        </div>
        <p class="muted small clamp">${summarize(r.exercises) || t('sport.noExercises')}</p>
      </div>`)}`);
  on(el, 'click', '#new-r', () => openRoutine(null));
  on(el, 'click', '[data-edit]', (e, b) => openRoutine(routines.find((r) => r.id === b.dataset.edit)));
  on(el, 'click', '[data-del]', async (e, b) => {
    if (!(await confirmBox(t('common.confirmDelete')))) return;
    try { await remove('routines', b.dataset.del); toast(t('common.deleted')); refresh(); } catch (err) { fail(err); }
  });
}

function openRoutine(routine) {
  const exercises = routine ? clone(routine.exercises) : [{ name: '', unit: 'kg', sets: [{ reps: null, kg: null, sec: null }] }];
  const m = openModal(html`
    <form id="r-form" autocomplete="off">
      <label class="field"><span>${t('sport.routineName')}</span><input type="text" name="name" value="${routine ? routine.name : ''}" required maxlength="60" placeholder="${t('sport.routinePh')}"></label>
      <label class="field"><span>${t('sport.weekday')}</span>
        <select name="weekday"><option value="">${t('sport.anyDay')}</option>
          ${Array.from({ length: 7 }, (_, i) => html`<option value="${i}" ${routine && routine.weekday === i ? 'selected' : ''}>${weekdayName(i, 'long')}</option>`)}</select></label>
      <div id="r-ex"></div>
      <div class="form-actions"><button class="btn primary" type="submit">${t('common.save')}</button></div>
    </form>`, { title: routine ? t('sport.editRoutine') : t('sport.newRoutine'), wide: true });
  exerciseEditor(m.body.querySelector('#r-ex'), exercises);
  const form = m.body.querySelector('#r-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const row = {
      name: form.name.value.trim(),
      weekday: form.weekday.value === '' ? null : Number(form.weekday.value),
      exercises: cleanExercises(exercises),
    };
    if (!row.name) return;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (routine) await update('routines', routine.id, row); else await insert('routines', row);
      m.close(); toast(t('common.saved')); refresh();
    } catch (err) { btn.disabled = false; fail(err); }
  };
}
