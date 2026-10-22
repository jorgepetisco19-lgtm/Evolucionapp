// Comidas: diario con kcal y macros, y recetas propias (eliges ingredientes y la app las guarda con su nombre).
import { listRange, listAll, insert, remove } from '../db.js';
import { searchFoods, totals } from '../off.js';
import { currentPlan } from '../plan.js';
import { openImport, openCopyMeals, openSuggest, saveRecipeRow } from './food-tools.js';
import { SLOTS } from '../menu.js';
import {
  html, raw, setHtml, on, openModal, spinner, todayStr, addDays, dateLong, num, toNum, fail, toast, navigate, refresh, confirmBox,
} from '../util.js';
import { t } from '../i18n.js';
import { ICONS } from '../icons.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
const guessMeal = () => { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snack' : 'dinner'; };

export async function render(el, params) {
  const tab = params.tab === 'recipes' ? 'recipes' : 'day';
  setHtml(el, html`
    <div class="seg" role="tablist">
      <button data-tab="day" class="${tab === 'day' ? 'on' : ''}">${t('food.day')}</button>
      <button data-tab="recipes" class="${tab === 'recipes' ? 'on' : ''}">${t('food.recipes')}</button>
    </div>
    <div id="food-content"></div>`);
  on(el, 'click', '.seg [data-tab]', (e, b) => navigate('food', { tab: b.dataset.tab }));
  const box = el.querySelector('#food-content');
  if (tab === 'day') await renderDay(box, params); else await renderRecipes(box);
}

// ---------- diario ----------
async function renderDay(el, params) {
  const date = params.date || todayStr();
  const [meals, recipes, goalPlan] = await Promise.all([
    listRange('meals', date, date, '*', 'created_at'),
    listAll('recipes', { order: 'name', asc: true }),
    currentPlan(),
  ]);
  const sum = meals.reduce((s, m) => ({
    kcal: s.kcal + Number(m.kcal), protein: s.protein + Number(m.protein_g), carbs: s.carbs + Number(m.carbs_g), fat: s.fat + Number(m.fat_g),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  setHtml(el, html`
    <div class="date-nav">
      <button class="icon-btn" data-d="-1" aria-label="${t('cal.prev')}">‹</button>
      <strong>${dateLong(date)}</strong>
      <button class="icon-btn" data-d="1" aria-label="${t('cal.next')}">›</button>
    </div>
    <div class="card">
      <div class="kcal-big"><strong>${num(sum.kcal, 0)}</strong> <span class="muted">kcal</span></div>
      ${goalPlan ? html`<div class="goal-line">
        <div class="bar"><i style="width:${Math.min(100, Math.round((sum.kcal / goalPlan.target) * 100))}%" class="${sum.kcal > goalPlan.target ? 'over' : ''}"></i></div>
        <p class="small muted">${t('food.goal')}: <b>${num(goalPlan.target, 0)} kcal</b> · ${sum.kcal > goalPlan.target ? t('food.over', { n: num(sum.kcal - goalPlan.target, 0) }) : t('food.left', { n: num(goalPlan.target - sum.kcal, 0) })}</p></div>`
        : html`<p class="tiny"><a href="#/profile">${t('food.setGoal')} ›</a></p>`}
      <div class="macros">
        <div><b>${num(sum.protein, 0)} g</b><span>${t('food.protein')}</span></div>
        <div><b>${num(sum.carbs, 0)} g</b><span>${t('food.carbs')}</span></div>
        <div><b>${num(sum.fat, 0)} g</b><span>${t('food.fat')}</span></div>
      </div>
    </div>
    <div class="row-actions"><button class="btn primary" id="add-meal">${raw(ICONS.plus)}<span>${t('food.add')}</span></button></div>
    <div class="row-actions"><button class="btn" id="suggest-menu">${t('menu.btn')}</button><button class="btn" id="copy-meals">${t('copy.btn')}</button></div>
    ${meals.length === 0 ? html`<div class="card empty"><p>${t('food.empty')}</p></div>` : MEAL_TYPES.map((mt) => {
      const list = meals.filter((m) => m.meal_type === mt);
      if (!list.length) return '';
      return html`<div class="card list"><h3>${t('food.type.' + mt)}</h3>
        ${list.map((m) => html`<div class="row static">
          <div class="grow"><strong>${m.name}</strong>
            <div class="muted small">${Number(m.factor) !== 1 ? num(m.factor, 2) + ' × · ' : ''}P ${num(m.protein_g, 0)} · C ${num(m.carbs_g, 0)} · G ${num(m.fat_g, 0)}</div></div>
          <div class="right"><strong>${num(m.kcal, 0)} kcal</strong></div>
          <button class="icon-btn" data-del="${m.id}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>
        </div>`)}</div>`;
    })}`);
  on(el, 'click', '[data-d]', (e, b) => navigate('food', { date: addDays(date, Number(b.dataset.d)) }));
  on(el, 'click', '#add-meal', () => openAddMeal(date, recipes));
  on(el, 'click', '#copy-meals', () => openCopyMeals(date));
  on(el, 'click', '#suggest-menu', () => openSuggest({ date, meals, recipes, goalPlan }));
  on(el, 'click', '[data-del]', async (e, b) => {
    if (!(await confirmBox(t('common.confirmDelete')))) return;
    try { await remove('meals', b.dataset.del); toast(t('common.deleted')); refresh(); } catch (err) { fail(err); }
  });
  if (params.add) {
    history.replaceState({}, '', `#/food?date=${date}`);
    openAddMeal(date, recipes);
  }
}

function openAddMeal(date, recipes) {
  let mealType = guessMeal();
  let pane = recipes.length ? 'recipes' : 'new';
  const m = openModal(html`
    <div class="chips" id="meal-types">${MEAL_TYPES.map((k) => html`<button class="chip ${k === mealType ? 'on' : ''}" data-mt="${k}">${t('food.type.' + k)}</button>`)}</div>
    <div class="seg small" id="panes">
      <button data-pane="recipes" class="${pane === 'recipes' ? 'on' : ''}">${t('food.myRecipes')}</button>
      <button data-pane="new" class="${pane === 'new' ? 'on' : ''}">${t('food.newMeal')}</button>
    </div>
    <div id="pane"></div>`, { title: t('food.add'), wide: true });
  const paneEl = m.body.querySelector('#pane');
  const showPane = () => {
    m.body.querySelectorAll('[data-pane]').forEach((b) => b.classList.toggle('on', b.dataset.pane === pane));
    if (pane === 'recipes') {
      setHtml(paneEl, recipes.length === 0 ? html`<p class="muted">${t('food.noRecipes')}</p>` : html`
        <div class="list">${recipes.map((r) => {
          const tt = totals(r.items, 1);
          return html`<div class="row static" data-recipe="${r.id}">
            <div class="grow"><strong>${r.name}</strong><div class="muted small">${num(tt.kcal, 0)} kcal · P ${num(tt.protein, 0)} · C ${num(tt.carbs, 0)} · G ${num(tt.fat, 0)}</div></div>
            <input class="factor" type="number" step="0.25" min="0.25" value="1" inputmode="decimal" aria-label="${t('food.servings')}">
            <button class="btn small primary" data-use>${t('food.addShort')}</button>
          </div>`;
        })}</div>`);
    } else {
      setHtml(paneEl, html`<div id="nb"></div>`); // contenedor nuevo para no duplicar listeners
      builder(paneEl.querySelector('#nb'), {
        mode: 'meal',
        onSubmit: async ({ name, items, saveRecipe, mealTypes }) => {
          let recipeId = null;
          if (saveRecipe) recipeId = (await saveRecipeRow(null, { name, items, meal_types: mealTypes || [] })).id;
          const tt = totals(items, 1);
          await insert('meals', { date, meal_type: mealType, name, recipe_id: recipeId, factor: 1, items, kcal: tt.kcal, protein_g: tt.protein, carbs_g: tt.carbs, fat_g: tt.fat });
          m.close(); toast(t('common.saved')); refresh();
        },
      });
    }
  };
  on(m.body, 'click', '[data-mt]', (e, b) => {
    mealType = b.dataset.mt;
    m.body.querySelectorAll('[data-mt]').forEach((x) => x.classList.toggle('on', x === b));
  });
  on(m.body, 'click', '[data-pane]', (e, b) => { pane = b.dataset.pane; showPane(); });
  on(m.body, 'click', '[data-use]', async (e, b) => {
    const row = b.closest('[data-recipe]');
    const rec = recipes.find((r) => r.id === row.dataset.recipe);
    const factor = toNum(row.querySelector('.factor').value) || 1;
    const tt = totals(rec.items, factor);
    b.disabled = true;
    try {
      await insert('meals', { date, meal_type: mealType, name: rec.name, recipe_id: rec.id, factor, items: rec.items, kcal: tt.kcal, protein_g: tt.protein, carbs_g: tt.carbs, fat_g: tt.fat });
      m.close(); toast(t('common.saved')); refresh();
    } catch (err) { b.disabled = false; fail(err); }
  });
  showPane();
}

// ---------- recetas ----------
async function renderRecipes(el) {
  const recipes = await listAll('recipes', { order: 'name', asc: true });
  setHtml(el, html`
    <div class="row-actions"><button class="btn primary" id="new-recipe">${raw(ICONS.plus)}<span>${t('food.newRecipe')}</span></button><button class="btn" id="import-recipes">${t('imp.btn')}</button></div>
    ${recipes.length === 0 ? html`<div class="card empty"><p>${t('food.noRecipes')}</p></div>` : html`
    <div class="card list">${recipes.map((r) => {
      const tt = totals(r.items, 1);
      return html`<div class="row static">
        <div class="grow"><strong>${r.name}</strong>${(r.meal_types || []).length ? html`<div class="tags">${r.meal_types.map((k) => html`<span class="tag">${t('menu.slot.' + k)}</span>`)}</div>` : ''}<div class="muted small">${r.items.map((i) => i.name).join(', ')}</div>
          <div class="muted small">${num(tt.kcal, 0)} kcal · P ${num(tt.protein, 0)} · C ${num(tt.carbs, 0)} · G ${num(tt.fat, 0)}</div></div>
        <button class="icon-btn" data-edit="${r.id}" aria-label="${t('common.edit')}">${raw(ICONS.edit)}</button>
        <button class="icon-btn" data-del="${r.id}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>
      </div>`;
    })}</div>`}`);
  on(el, 'click', '#new-recipe', () => openRecipeEditor(null));
  on(el, 'click', '#import-recipes', () => openImport(recipes));
  on(el, 'click', '[data-edit]', (e, b) => openRecipeEditor(recipes.find((r) => r.id === b.dataset.edit)));
  on(el, 'click', '[data-del]', async (e, b) => {
    if (!(await confirmBox(t('common.confirmDelete')))) return;
    try { await remove('recipes', b.dataset.del); toast(t('common.deleted')); refresh(); } catch (err) { fail(err); }
  });
}

function openRecipeEditor(recipe) {
  const m = openModal(html`<div id="rb"></div>`, { title: recipe ? t('food.editRecipe') : t('food.newRecipe'), wide: true });
  builder(m.body.querySelector('#rb'), {
    mode: 'recipe', init: recipe,
    onSubmit: async ({ name, items, mealTypes }) => {
      await saveRecipeRow(recipe ? recipe.id : null, { name, items, meal_types: mealTypes });
      m.close(); toast(t('common.saved')); refresh();
    },
  });
}

// ---------- constructor de comida/receta (ingredientes + gramos) ----------
function builder(el, { mode, init, onSubmit }) {
  const state = { name: init ? init.name : '', items: init ? JSON.parse(JSON.stringify(init.items)) : [], results: null, searching: false, error: '', manual: false, saveRecipe: false, tags: new Set(init && init.meal_types ? init.meal_types : []) };

  const itemRow = (it, i) => html`<div class="item" data-i="${i}">
    <div class="grow"><strong>${it.name}</strong><div class="muted tiny">${num(it.kcal100, 0)} kcal/100 g</div></div>
    <input class="grams" type="number" inputmode="decimal" step="any" min="0" value="${it.grams}" aria-label="${t('food.grams')}"><span class="muted small">g</span>
    <button type="button" class="icon-btn" data-rm="${i}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>
  </div>`;

  const draw = () => {
    setHtml(el, html`
      <label class="field"><span>${t(mode === 'recipe' ? 'food.recipeName' : 'food.mealName')}</span>
        <input type="text" id="b-name" value="${state.name}" placeholder="${t('food.namePh')}" maxlength="80"></label>
      <div class="items" id="b-items">${state.items.length ? state.items.map(itemRow) : html`<p class="muted small">${t('food.noItems')}</p>`}</div>
      <div class="totals" id="b-totals"></div>
      <div class="search">
        <div class="search-bar"><input type="search" id="b-q" placeholder="${t('food.searchPh')}" enterkeyhint="search"><button type="button" class="btn" id="b-search">${raw(ICONS.search)}<span>${t('food.search')}</span></button></div>
        ${state.searching ? spinner(t('food.searching')) : ''}
        ${state.error ? html`<p class="note warn">${state.error}</p>` : ''}
        ${state.results ? (state.results.length === 0 ? html`<p class="muted small">${t('food.noResults')}</p>` : html`<div class="results">${state.results.map((r, i) => html`<button type="button" class="result" data-res="${i}">
          <span class="grow"><strong>${r.name}</strong><span class="muted tiny"> P ${num(r.p100)} · C ${num(r.c100)} · G ${num(r.f100)} /100 g</span></span><b>${num(r.kcal100, 0)} kcal</b>${raw(ICONS.plus)}</button>`)}</div>`) : ''}
        <button type="button" class="link" id="b-manual-toggle">${state.manual ? t('food.hideManual') : t('food.manual')}</button>
        ${state.manual ? html`<div class="manual grid2">
          <label class="field"><span>${t('food.ingName')}</span><input type="text" id="m-name"></label>
          <label class="field"><span>${t('food.grams')} (g)</span><input type="number" step="any" inputmode="decimal" id="m-g" value="100"></label>
          <label class="field"><span>kcal / 100 g</span><input type="number" step="any" inputmode="decimal" id="m-k"></label>
          <label class="field"><span>${t('food.protein')} / 100 g</span><input type="number" step="any" inputmode="decimal" id="m-p"></label>
          <label class="field"><span>${t('food.carbs')} / 100 g</span><input type="number" step="any" inputmode="decimal" id="m-c"></label>
          <label class="field"><span>${t('food.fat')} / 100 g</span><input type="number" step="any" inputmode="decimal" id="m-f"></label>
          <button type="button" class="btn" id="m-add">${t('food.addIngredient')}</button></div>` : ''}
      </div>
      ${mode === 'recipe' ? html`<div class="field"><span>${t('menu.tagsLabel')}</span><div class="chips" id="b-tags">${SLOTS.map((k) => html`<button type="button" class="chip ${state.tags.has(k) ? 'on' : ''}" data-tag="${k}">${t('menu.slot.' + k)}</button>`)}</div><p class="tiny muted">${t('menu.tagsHelp')}</p></div>` : ''}
      ${mode === 'meal' ? html`<label class="check"><input type="checkbox" id="b-save" ${state.saveRecipe ? 'checked' : ''}> ${t('food.saveAsRecipe')}</label>` : ''}
      <div class="form-actions"><button type="button" class="btn primary" id="b-ok">${t(mode === 'recipe' ? 'common.save' : 'food.addToDay')}</button></div>`);
    drawTotals();
  };
  const drawTotals = () => {
    const tt = totals(state.items, 1);
    setHtml(el.querySelector('#b-totals'), html`<strong>${num(tt.kcal, 0)} kcal</strong> <span class="muted">P ${num(tt.protein, 0)} g · C ${num(tt.carbs, 0)} g · G ${num(tt.fat, 0)} g</span>`);
  };

  on(el, 'input', '#b-name', (e, inp) => { state.name = inp.value; });
  on(el, 'input', '.grams', (e, inp) => {
    const i = Number(inp.closest('.item').dataset.i);
    state.items[i].grams = toNum(inp.value) ?? 0;
    drawTotals();
  });
  on(el, 'click', '[data-tag]', (e, b) => { const k = b.dataset.tag; if (state.tags.has(k)) state.tags.delete(k); else state.tags.add(k); b.classList.toggle('on', state.tags.has(k)); });
  on(el, 'change', '#b-save', (e, c) => { state.saveRecipe = c.checked; });
  on(el, 'click', '[data-rm]', (e, b) => { state.items.splice(Number(b.dataset.rm), 1); draw(); });
  on(el, 'click', '#b-manual-toggle', () => { state.manual = !state.manual; draw(); });
  const doSearch = async () => {
    const q = el.querySelector('#b-q').value.trim();
    if (q.length < 2) return;
    state.searching = true; state.error = ''; state.results = null; draw();
    el.querySelector('#b-q').value = q;
    try { state.results = await searchFoods(q); } catch (err) { console.error(err); state.error = t('food.searchFailed'); }
    state.searching = false; draw();
    el.querySelector('#b-q').value = q;
  };
  on(el, 'click', '#b-search', doSearch);
  on(el, 'keydown', '#b-q', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  on(el, 'click', '[data-res]', (e, b) => {
    const r = state.results[Number(b.dataset.res)];
    state.items.push({ name: r.name, grams: 100, kcal100: r.kcal100, p100: r.p100, c100: r.c100, f100: r.f100 });
    state.results = null; draw();
    const inputs = el.querySelectorAll('.grams');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  });
  on(el, 'click', '#m-add', () => {
    const name = el.querySelector('#m-name').value.trim();
    const g = toNum(el.querySelector('#m-g').value) ?? 0;
    const k = toNum(el.querySelector('#m-k').value);
    if (!name || k === null) { toast(t('food.needIng'), 'error'); return; }
    state.items.push({ name, grams: g, kcal100: k, p100: toNum(el.querySelector('#m-p').value) ?? 0, c100: toNum(el.querySelector('#m-c').value) ?? 0, f100: toNum(el.querySelector('#m-f').value) ?? 0 });
    state.manual = false; draw();
  });
  on(el, 'click', '#b-ok', async (e, btn) => {
    if (!state.items.length) { toast(t('food.needItems'), 'error'); return; }
    let name = state.name.trim();
    if (!name && (mode === 'recipe' || state.saveRecipe)) { toast(t('food.needName'), 'error'); return; }
    if (!name) name = state.items.slice(0, 3).map((i) => i.name.split('(')[0].trim()).join(', ');
    btn.disabled = true;
    try { await onSubmit({ name, items: state.items, saveRecipe: state.saveRecipe, mealTypes: SLOTS.filter((k) => state.tags.has(k)) }); } catch (err) { btn.disabled = false; fail(err); }
  });
  draw();
}

// exportado para pruebas
export { builder };
