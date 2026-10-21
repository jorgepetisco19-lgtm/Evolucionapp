// Perfil: de dónde partes -> metabolismo basal, mantenimiento y objetivo diario de kcal (estimación orientativa).
import { loadProfile, latestWeighIn, saveProfile } from '../plan.js';
import { plan, ACTIVITY, PACES } from '../nutrition.js';
import { html, setHtml, on, num, toNum, fail, toast, dateShort, addDays, todayStr } from '../util.js';
import { t } from '../i18n.js';

const ACTS = Object.keys(ACTIVITY);

export async function render(el) {
  let saved = null, weighIn = null, loadError = null;
  try { [saved, weighIn] = await Promise.all([loadProfile(), latestWeighIn()]); } catch (e) { loadError = e; }
  if (loadError) {
    setHtml(el, html`<a class="back" href="#/settings">‹ ${t('profile.back')}</a><div class="card error-card"><p>${t('common.error')}</p><p class="tiny muted">${(loadError && loadError.message) || loadError}</p><p class="tiny muted">¿Has ejecutado supabase/02-perfil.sql en Supabase?</p></div>`);
    return;
  }
  const state = {
    sex: saved?.sex || '', birth_date: saved?.birth_date || '', height_cm: saved?.height_cm ?? '', weight_kg: saved?.weight_kg ?? '',
    activity: saved?.activity || 'light', goal: saved?.goal || 'lose', pace: saved?.pace != null ? Number(saved.pace) : 0.5,
    goal_weight_kg: saved?.goal_weight_kg ?? '',
  };
  const paceOk = () => { const list = PACES[state.goal]; if (list && !list.includes(state.pace)) state.pace = list.includes(0.5) ? 0.5 : list[0]; };
  paceOk();

  setHtml(el, html`
    <a class="back" href="#/settings">‹ ${t('profile.back')}</a>
    <h2 class="page-title">${t('profile.title')}</h2>
    <p class="muted">${t('profile.intro')}</p>
    <form class="card" id="p-form" autocomplete="off"></form>
    <div id="p-result"></div>`);
  const form = el.querySelector('#p-form');
  const box = el.querySelector('#p-result');

  const profileNow = () => ({
    sex: state.sex, birth_date: state.birth_date || null, height_cm: toNum(state.height_cm), weight_kg: toNum(state.weight_kg),
    activity: state.activity, goal: state.goal, pace: state.pace, goal_weight_kg: toNum(state.goal_weight_kg),
  });
  const kgNow = () => (weighIn ? weighIn.kg : toNum(state.weight_kg));

  const drawForm = () => {
    setHtml(form, html`
      <div class="field"><span>${t('profile.sex')}</span>
        <div class="chips">${['male', 'female'].map((k) => html`<button type="button" class="chip ${state.sex === k ? 'on' : ''}" data-sex="${k}">${t('profile.' + k)}</button>`)}</div></div>
      <div class="grid2">
        <label class="field"><span>${t('profile.birth')}</span><input type="date" name="birth_date" value="${state.birth_date}" max="${todayStr()}"></label>
        <label class="field"><span>${t('profile.height')}</span><input type="number" name="height_cm" inputmode="decimal" min="80" max="250" step="any" value="${state.height_cm}"></label>
      </div>
      <label class="field"><span>${t('profile.weight')}</span><input type="number" name="weight_kg" inputmode="decimal" min="20" max="400" step="any" value="${state.weight_kg}"></label>
      ${weighIn ? html`<p class="tiny muted">${t('profile.weightUsed', { kg: num(weighIn.kg, 1), date: dateShort(weighIn.date) })}</p>` : ''}
      <label class="field"><span>${t('profile.activity')}</span>
        <select name="activity">${ACTS.map((k) => html`<option value="${k}" ${state.activity === k ? 'selected' : ''}>${t('profile.act.' + k)}</option>`)}</select></label>
      <div class="field"><span>${t('profile.goal')}</span>
        <div class="chips">${['lose', 'maintain', 'gain'].map((k) => html`<button type="button" class="chip ${state.goal === k ? 'on' : ''}" data-goal="${k}">${t('profile.goal.' + k)}</button>`)}</div></div>
      ${PACES[state.goal] ? html`<div class="field"><span>${t('profile.pace')}</span>
        <div class="chips">${PACES[state.goal].map((p) => html`<button type="button" class="chip ${state.pace === p ? 'on' : ''}" data-pace="${p}">${t('profile.pace.' + p)}</button>`)}</div></div>
        <label class="field"><span>${t('profile.goalWeight')}</span><input type="number" name="goal_weight_kg" inputmode="decimal" min="20" max="400" step="any" value="${state.goal_weight_kg}"></label>` : ''}
      <div class="form-actions"><button class="btn primary" type="submit">${t('profile.save')}</button></div>`);
  };

  const drawResult = () => {
    const p = plan(profileNow(), kgNow());
    if (!p) { setHtml(box, html`<div class="card empty"><p>${t('profile.needData')}</p></div>`); return; }
    const gw = toNum(state.goal_weight_kg);
    const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + num(Math.abs(n), 0);
    setHtml(box, html`
      <div class="card plan">
        <h3>${t('profile.result')}</h3>
        <div class="kcal-big"><span class="muted small">${t('profile.target')}</span><br><strong>${num(p.target, 0)}</strong> <span class="muted">kcal</span></div>
        <div class="macros">
          <div><b>${num(p.protein, 0)} g</b><span>${t('food.protein')}</span></div>
          <div><b>${num(p.carbs, 0)} g</b><span>${t('food.carbs')}</span></div>
          <div><b>${num(p.fat, 0)} g</b><span>${t('food.fat')}</span></div>
        </div>
        <dl class="kv">
          <div><dt>${t('profile.bmr')} <small class="muted">${t('profile.bmrHelp')}</small></dt><dd>${num(p.bmr, 0)} kcal</dd></div>
          <div><dt>${t('profile.tdee')} <small class="muted">${t('profile.tdeeHelp')}</small></dt><dd>${num(p.tdee, 0)} kcal</dd></div>
          <div><dt>${t('profile.adjust')}</dt><dd>${sign(p.delta)} kcal</dd></div>
          <div><dt>${t('profile.bmi')}</dt><dd>${num(p.bmi, 1)}</dd></div>
        </dl>
        ${weighIn && weighIn.scaleBmr ? html`<p class="tiny muted">${t('profile.scaleBmr', { n: num(weighIn.scaleBmr, 0) })}</p>` : ''}
        ${p.weeks && gw ? html`<p class="small">${t('profile.eta', { kg: num(gw, 1), n: p.weeks, date: dateShort(addDays(todayStr(), p.weeks * 7)) })}</p>` : ''}
        ${p.warnings.map((w) => html`<p class="warn small">⚠ ${t('profile.w.' + w)}</p>`)}
        <p class="tiny muted">${t('profile.disclaimer')}</p>
      </div>`);
  };

  // Lo escrito se guarda en `state` sin repintar el formulario (no se pierde el foco); los botones sí repintan.
  on(form, 'input', 'input[name], select[name]', (e, inp) => { state[inp.name] = inp.value; drawResult(); });
  on(form, 'change', 'select[name]', (e, sel) => { state[sel.name] = sel.value; drawResult(); });
  on(form, 'click', '[data-sex]', (e, b) => { state.sex = b.dataset.sex; drawForm(); drawResult(); });
  on(form, 'click', '[data-goal]', (e, b) => { state.goal = b.dataset.goal; paceOk(); drawForm(); drawResult(); });
  on(form, 'click', '[data-pace]', (e, b) => { state.pace = Number(b.dataset.pace); drawForm(); drawResult(); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const row = profileNow();
    if (!row.sex || !row.birth_date || !row.height_cm || !kgNow()) { toast(t('profile.needSaveFirst'), 'error'); return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try { await saveProfile(row); toast(t('profile.saved')); } catch (err) { fail(err); }
    btn.disabled = false;
  };
  drawForm();
  drawResult();
}
