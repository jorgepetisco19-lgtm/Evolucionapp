// Editor de ejercicios con series (repeticiones y carga). Modifica el array que se le pasa.
// Forma de los datos: [{ name: 'Press banca', unit: 'kg', sets: [{ reps: 8, kg: 60 }, ...] }]
// Cada ejercicio mide su carga en kilos (unit 'kg', campo kg) o en segundos (unit 's', campo sec; p. ej. una plancha).
// Los datos antiguos no tienen "unit": se tratan como kilos.
import { html, setHtml, on, toNum, raw } from './util.js';
import { t } from './i18n.js';
import { ICONS } from './icons.js';

export const unitOf = (ex) => (ex && ex.unit === 's' ? 's' : 'kg');
const fieldOf = (ex) => (unitOf(ex) === 's' ? 'sec' : 'kg');
const blankSet = () => ({ reps: null, kg: null, sec: null });

export function exerciseEditor(el, exercises) {
  const draw = () => {
    setHtml(el, html`
      ${exercises.map((ex, i) => html`<div class="ex" data-i="${i}">
        <div class="ex-head">
          <input type="text" class="ex-name" value="${ex.name}" placeholder="${t('sport.exercisePh')}" maxlength="80" aria-label="${t('sport.exercise')}">
          <button type="button" class="icon-btn" data-del-ex="${i}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>
        </div>
        <div class="chips unit-chips" role="group" aria-label="${t('sport.unit')}">
          <button type="button" class="chip ${unitOf(ex) === 'kg' ? 'on' : ''}" data-unit="kg" data-i="${i}">${t('sport.unitKg')}</button>
          <button type="button" class="chip ${unitOf(ex) === 's' ? 'on' : ''}" data-unit="s" data-i="${i}">${t('sport.unitSec')}</button>
        </div>
        <div class="sets">
          <div class="set head"><span>#</span><span>${t('sport.reps')}</span><span>${unitOf(ex) === 's' ? t('sport.sec') : 'kg'}</span><span></span></div>
          ${ex.sets.map((s, j) => html`<div class="set" data-j="${j}">
            <span>${j + 1}</span>
            <input type="number" inputmode="numeric" min="0" step="1" data-f="reps" value="${s.reps ?? ''}" aria-label="${t('sport.reps')}">
            <input type="number" inputmode="decimal" min="0" step="any" data-f="${fieldOf(ex)}" value="${s[fieldOf(ex)] ?? ''}" aria-label="${unitOf(ex) === 's' ? t('sport.sec') : 'kg'}">
            <button type="button" class="icon-btn" data-del-set="${j}" aria-label="${t('common.delete')}">✕</button>
          </div>`)}
          <button type="button" class="btn small ghost" data-add-set="${i}">+ ${t('sport.addSet')}</button>
        </div>
      </div>`)}
      <button type="button" class="btn" id="add-ex">${raw(ICONS.plus)}<span>${t('sport.addExercise')}</span></button>`);
  };
  on(el, 'input', '.ex-name', (e, inp) => { exercises[Number(inp.closest('.ex').dataset.i)].name = inp.value; });
  on(el, 'input', '.set input', (e, inp) => {
    const ex = exercises[Number(inp.closest('.ex').dataset.i)];
    ex.sets[Number(inp.closest('.set').dataset.j)][inp.dataset.f] = toNum(inp.value);
  });
  on(el, 'click', '[data-unit]', (e, b) => {
    exercises[Number(b.dataset.i)].unit = b.dataset.unit;
    draw();
  });
  on(el, 'click', '[data-del-ex]', (e, b) => { exercises.splice(Number(b.dataset.delEx), 1); draw(); });
  on(el, 'click', '[data-del-set]', (e, b) => {
    const ex = exercises[Number(b.closest('.ex').dataset.i)];
    ex.sets.splice(Number(b.dataset.delSet), 1);
    draw();
  });
  on(el, 'click', '[data-add-set]', (e, b) => {
    const ex = exercises[Number(b.dataset.addSet)];
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(last ? { ...blankSet(), ...last } : blankSet()); // copia la serie anterior
    draw();
  });
  on(el, 'click', '#add-ex', () => {
    exercises.push({ name: '', unit: 'kg', sets: [blankSet()] });
    draw();
    const names = el.querySelectorAll('.ex-name');
    names[names.length - 1].focus();
  });
  draw();
}

// "8×60, 8×60" (kilos) o "3×45s, 3×45s" (segundos)
export const setsText = (ex, sep = ', ') =>
  (ex.sets || []).map((s) => (unitOf(ex) === 's' ? `${s.reps ?? '?'}×${s.sec ?? 0}s` : `${s.reps ?? '?'}×${s.kg ?? 0}`)).join(sep);

// "Press banca 8×60, 8×60"
export function summarize(exercises) {
  return (exercises || [])
    .filter((e) => e.name)
    .map((e) => `${e.name}${e.sets && e.sets.length ? ' ' + setsText(e) : ''}`)
    .join(' · ');
}

export const cleanExercises = (exercises) =>
  exercises
    .filter((e) => e.name && e.name.trim())
    .map((e) => {
      const unit = unitOf(e), f = fieldOf(e);
      const sets = (e.sets || []).filter((s) => s.reps != null || s[f] != null).map((s) => ({ reps: s.reps ?? null, [f]: s[f] ?? null }));
      return { name: e.name.trim(), unit, sets };
    });
