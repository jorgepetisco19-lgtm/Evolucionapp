// Editor de ejercicios con series (repeticiones y carga). Modifica el array que se le pasa.
// Forma de los datos: [{ name: 'Press banca', sets: [{ reps: 8, kg: 60 }, ...] }]
import { html, setHtml, on, toNum, raw } from './util.js';
import { t } from './i18n.js';
import { ICONS } from './icons.js';

export function exerciseEditor(el, exercises) {
  const draw = () => {
    setHtml(el, html`
      ${exercises.map((ex, i) => html`<div class="ex" data-i="${i}">
        <div class="ex-head">
          <input type="text" class="ex-name" value="${ex.name}" placeholder="${t('sport.exercisePh')}" maxlength="80" aria-label="${t('sport.exercise')}">
          <button type="button" class="icon-btn" data-del-ex="${i}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>
        </div>
        <div class="sets">
          <div class="set head"><span>#</span><span>${t('sport.reps')}</span><span>kg</span><span></span></div>
          ${ex.sets.map((s, j) => html`<div class="set" data-j="${j}">
            <span>${j + 1}</span>
            <input type="number" inputmode="numeric" min="0" step="1" data-f="reps" value="${s.reps ?? ''}" aria-label="${t('sport.reps')}">
            <input type="number" inputmode="decimal" min="0" step="any" data-f="kg" value="${s.kg ?? ''}" aria-label="kg">
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
  on(el, 'click', '[data-del-ex]', (e, b) => { exercises.splice(Number(b.dataset.delEx), 1); draw(); });
  on(el, 'click', '[data-del-set]', (e, b) => {
    const ex = exercises[Number(b.closest('.ex').dataset.i)];
    ex.sets.splice(Number(b.dataset.delSet), 1);
    draw();
  });
  on(el, 'click', '[data-add-set]', (e, b) => {
    const ex = exercises[Number(b.dataset.addSet)];
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(last ? { reps: last.reps, kg: last.kg } : { reps: null, kg: null }); // copia la serie anterior
    draw();
  });
  on(el, 'click', '#add-ex', () => {
    exercises.push({ name: '', sets: [{ reps: null, kg: null }] });
    draw();
    const names = el.querySelectorAll('.ex-name');
    names[names.length - 1].focus();
  });
  draw();
}

// "Press banca 8×60, 8×60"
export function summarize(exercises) {
  return (exercises || [])
    .filter((e) => e.name)
    .map((e) => `${e.name}${e.sets && e.sets.length ? ' ' + e.sets.map((s) => `${s.reps ?? '?'}×${s.kg ?? 0}`).join(', ') : ''}`)
    .join(' · ');
}

export const cleanExercises = (exercises) =>
  exercises
    .filter((e) => e.name && e.name.trim())
    .map((e) => ({ name: e.name.trim(), sets: (e.sets || []).filter((s) => s.reps !== null || s.kg !== null) }));
