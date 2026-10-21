// Deporte: registro de entrenos (gimnasio, pádel, caminar...) y rutinas guardadas con series, repeticiones y carga.
import { listRange, listAll, insert, update, remove } from '../db.js';
import { exerciseEditor, summarize, cleanExercises } from '../exercises.js';
import {
  html, raw, setHtml, on, openModal, todayStr, addDays, dateLong, toNum, fail, toast, navigate, refresh, confirmBox, weekdayIndex,
} from '../util.js';
import { t, locale } from '../i18n.js';
import { ICONS } from '../icons.js';

const TYPES = ['gym', 'padel', 'walk', 'other'];
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
    <div class="row-actions"><button class="btn primary" id="add-w">${raw(ICONS.plus)}<span>${t('sport.add')}</span></button></div>
    ${workouts.length === 0 ? html`<div class="card empty"><p>${t('sport.empty')}</p></div>` : workouts.map((w) => html`
      <div class="card workout">
        <div class="wk-head">
          <i class="dot k-workouts"></i>
          <strong class="grow">${w.name || t('sport.type.' + w.type)}</strong>
          <span class="muted small">${w.duration_min ? w.duration_min + ' min' : ''}</span>
          <button class="icon-btn" data-edit="${w.id}" aria-label="${t('common.edit')}">${raw(ICONS.edit)}</button>
          <button class="icon-btn" data-del="${w.id}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>
        </div>
        ${w.exercises && w.exercises.length ? html`<ul class="ex-list">${w.exercises.map((e) => html`<li><b>${e.name}</b> <span class="muted">${(e.sets || []).map((s) => `${s.reps ?? '?'}×${s.kg ?? 0}`).join(' · ')}</span></li>`)}</ul>` : ''}
        ${w.notes ? html`<p class="muted small">${w.notes}</p>` : ''}
      </div>`)}`);
  on(el, 'click', '[data-d]', (e, b) => navigate('sport', { date: addDays(date, Number(b.dataset.d)) }));
  on(el, 'click', '#add-w', () => openWorkout({ date, routines }));
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
  };
  const m = openModal(html`<form id="w-form" autocomplete="off"></form>`, { title: existing ? t('sport.edit') : t('sport.add'), wide: true });
  const form = m.body.querySelector('#w-form');
  const draw = () => {
    setHtml(form, html`
      <label class="field"><span>${t('common.date')}</span><input type="date" name="date" value="${state.date}" required></label>
      <div class="chips" id="types">${TYPES.map((k) => html`<button type="button" class="chip ${state.type === k ? 'on' : ''}" data-type="${k}">${t('sport.type.' + k)}</button>`)}</div>
      ${state.type === 'gym' ? html`
        ${routines.length ? html`<label class="field"><span>${t('sport.fromRoutine')}</span>
          <select id="routine"><option value="">${t('sport.noRoutine')}</option>${routines.map((r) => html`<option value="${r.id}" ${r.name === state.routineName ? 'selected' : ''}>${r.name}</option>`)}</select></label>` : ''}
        <div id="ex-editor"></div>` : html`
        <label class="field"><span>${t('sport.nameOpt')}</span><input type="text" name="name" value="${state.name}" maxlength="80"></label>`}
      <div class="grid2">
        <label class="field"><span>${t('sport.duration')}</span><input type="number" name="duration" min="0" inputmode="numeric" value="${state.duration}" placeholder="—"></label>
      </div>
      <label class="field"><span>${t('sport.notes')}</span><textarea name="notes" rows="2" maxlength="500">${state.notes}</textarea></label>
      <div class="form-actions"><button class="btn primary" type="submit">${t('common.save')}</button></div>`);
    if (state.type === 'gym') exerciseEditor(form.querySelector('#ex-editor'), state.exercises);
  };
  // Los campos sencillos se guardan en `state` al escribir, así sobreviven a los repintados.
  on(form, 'input', 'input[name], textarea[name]', (e, inp) => { state[inp.name] = inp.value; });
  on(form, 'click', '[data-type]', (e, b) => { state.type = b.dataset.type; draw(); });
  on(form, 'change', '#routine', (e, sel) => {
    const r = routines.find((x) => x.id === sel.value);
    if (r) { state.exercises = clone(r.exercises); state.routineName = r.name; draw(); }
  });
  draw();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const row = {
      date: state.date,
      type: state.type,
      name: state.type === 'gym' ? state.routineName || null : String(state.name).trim() || null,
      duration_min: toNum(state.duration),
      notes: String(state.notes).trim() || null,
      exercises: state.type === 'gym' ? cleanExercises(state.exercises) : [],
    };
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (existing) await update('workouts', existing.id, row); else await insert('workouts', row);
      m.close(); toast(t('common.saved')); refresh();
    } catch (err) { btn.disabled = false; fail(err); }
  };
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
  const exercises = routine ? clone(routine.exercises) : [{ name: '', sets: [{ reps: null, kg: null }] }];
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
