// Comidas: diario con kcal y macros, y recetas propias (eliges ingredientes y la app las guarda con su nombre).
import { listRange, listAll, insert, remove, updateMany } from '../db.js';
import { searchFoods, totals } from '../off.js';
import { currentPlan } from '../plan.js';
import { openImport, openCopyMeals, openSuggest, saveRecipeRow } from './food-tools.js';
import { TAGS } from '../menu.js';
import { estimateOne } from '../estimate.js';
import { loadMemory, remember, searchMemory } from '../ingredients.js';
import { searchTable } from '../foods-db.js';
import { keyOf } from '../estimate.js';
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
  setHtml(box, spinner()); // mientras llegan los datos se ve el círculo, no un hueco vacío
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
  // Selección múltiple: se entra con "Seleccionar" o manteniendo pulsada una receta; sirve para etiquetar varias a la vez.
  const st = { filter: 'all', selecting: false, sel: new Set(), mode: 'add', busy: false };
  const tagsOf = (r) => r.meal_types || [];
  const shown = () => recipes.filter((r) => (st.filter === 'all' ? true : st.filter === 'none' ? !tagsOf(r).length : tagsOf(r).includes(st.filter)));
  const draw = () => {
    const list = shown();
    const nNone = recipes.filter((r) => !tagsOf(r).length).length;
    const filters = [['all', t('food.filterAll')], ['none', `${t('food.filterNone')} (${nNone})`], ...TAGS.map((k) => [k, t('menu.slot.' + k)])];
    setHtml(el, html`
      <div class="row-actions"><button class="btn primary" id="new-recipe">${raw(ICONS.plus)}<span>${t('food.newRecipe')}</span></button><button class="btn" id="import-recipes">${t('imp.btn')}</button></div>
      ${recipes.length === 0 ? html`<div class="card empty"><p>${t('food.noRecipes')}</p></div>` : html`
      <div class="chips filter-chips">${filters.map(([k, label]) => html`<button class="chip ${st.filter === k ? 'on' : ''}" data-filter="${k}">${label}</button>`)}</div>
      <div class="sel-top">${st.selecting ? html`<span class="muted small">${t('food.selectHint')}</span><button class="link" id="sel-all">${t('food.selectAll', { n: list.length })}</button>`
        : html`<button class="link" id="sel-start">${t('food.select')}</button><span class="tiny muted">${t('food.selectLong')}</span>`}</div>
      ${list.length === 0 ? html`<div class="card empty"><p>${t('food.filterEmpty')}</p></div>` : html`
      <div class="card list ${st.selecting ? 'selecting' : ''}">${list.map((r) => {
        const tt = totals(r.items, 1);
        const on = st.sel.has(r.id);
        return html`<div class="row static rec-row ${on ? 'picked' : ''}" data-rec="${r.id}">
          ${st.selecting ? html`<span class="sel-dot ${on ? 'on' : ''}" aria-hidden="true">${on ? '✓' : ''}</span>` : ''}
          <div class="grow"><strong>${r.name}</strong>${tagsOf(r).length ? html`<div class="tags">${tagsOf(r).map((k) => html`<span class="tag">${t('menu.slot.' + k)}</span>`)}</div>` : ''}<div class="muted small">${r.items.map((i) => i.name).join(', ')}</div>
            <div class="muted small">${num(tt.kcal, 0)} kcal · P ${num(tt.protein, 0)} · C ${num(tt.carbs, 0)} · G ${num(tt.fat, 0)}</div></div>
          ${st.selecting ? '' : html`<button class="icon-btn" data-edit="${r.id}" aria-label="${t('common.edit')}">${raw(ICONS.edit)}</button>
          <button class="icon-btn" data-del="${r.id}" aria-label="${t('common.delete')}">${raw(ICONS.trash)}</button>`}
        </div>`;
      })}</div>`}`}
      ${st.selecting ? html`<div class="sel-pad"></div><div class="sel-bar" role="toolbar">
        <div class="sel-head"><strong>${t('food.selected', { n: st.sel.size })}</strong>
          <div class="seg small" id="sel-mode"><button data-mode="add" class="${st.mode === 'add' ? 'on' : ''}">${t('food.modeAdd')}</button><button data-mode="remove" class="${st.mode === 'remove' ? 'on' : ''}">${t('food.modeRemove')}</button></div></div>
        <div class="chips">${TAGS.map((k) => html`<button class="chip" data-apply="${k}" ${st.sel.size && !st.busy ? '' : 'disabled'}>${t('menu.slot.' + k)}</button>`)}</div>
        <div class="sel-foot"><button class="btn small" data-apply="clear" ${st.sel.size && !st.busy ? '' : 'disabled'}>${t('food.clearTags')}</button><button class="btn small ghost" id="sel-cancel">${t('common.cancel')}</button></div>
      </div>` : ''}`);
  };
  const enter = (id) => { st.selecting = true; if (id) st.sel.add(id); draw(); };
  const stop = () => { st.selecting = false; st.sel.clear(); draw(); };
  // pulsación larga sobre una receta
  let timer = null, startXY = null, pressed = false, suppressUntil = 0;
  const cancelPress = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', (e) => {
    const row = e.target.closest && e.target.closest('.rec-row');
    if (!row || st.selecting || e.target.closest('button')) return;
    startXY = [e.clientX, e.clientY];
    timer = setTimeout(() => { timer = null; pressed = true; if (navigator.vibrate) navigator.vibrate(30); enter(row.dataset.rec); }, 550);
  });
  el.addEventListener('pointermove', (e) => { if (timer && startXY && Math.hypot(e.clientX - startXY[0], e.clientY - startXY[1]) > 10) cancelPress(); });
  // Al soltar tras una pulsación larga, el "clic" que genera el propio dedo no debe marcar/desmarcar la receta (solo se ignora justo en ese instante).
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, () => { cancelPress(); if (pressed) { pressed = false; suppressUntil = Date.now() + 150; } }));
  el.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.rec-row')) e.preventDefault(); });
  el.addEventListener('click', (e) => { if (Date.now() < suppressUntil) { suppressUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);

  on(el, 'click', '#new-recipe', () => openRecipeEditor(null));
  on(el, 'click', '#import-recipes', () => openImport(recipes));
  on(el, 'click', '[data-filter]', (e, b) => { st.filter = b.dataset.filter; draw(); });
  on(el, 'click', '#sel-start', () => enter(null));
  on(el, 'click', '#sel-cancel', stop);
  on(el, 'click', '#sel-all', () => { const ids = shown().map((r) => r.id); const all = ids.every((id) => st.sel.has(id)); ids.forEach((id) => (all ? st.sel.delete(id) : st.sel.add(id))); draw(); });
  on(el, 'click', '[data-mode]', (e, b) => { st.mode = b.dataset.mode; draw(); });
  on(el, 'click', '.rec-row', (e, row) => {
    if (!st.selecting || e.target.closest('button')) return;
    const id = row.dataset.rec;
    if (st.sel.has(id)) st.sel.delete(id); else st.sel.add(id);
    draw();
  });
  on(el, 'click', '[data-apply]', async (e, b) => {
    if (!st.sel.size || st.busy) return;
    const tag = b.dataset.apply;
    // Se agrupan las recetas que quedan con las mismas etiquetas para hacer pocas peticiones.
    const groups = new Map();
    for (const r of recipes.filter((x) => st.sel.has(x.id))) {
      const cur = new Set(tagsOf(r));
      if (tag === 'clear') cur.clear(); else if (st.mode === 'add') cur.add(tag); else cur.delete(tag);
      const next = TAGS.filter((k) => cur.has(k));
      const key = next.join(',');
      if (!groups.has(key)) groups.set(key, { next, ids: [] });
      groups.get(key).ids.push(r.id);
    }
    st.busy = true; draw();
    try {
      for (const g of groups.values()) await updateMany('recipes', g.ids, { meal_types: g.next });
      const n = st.sel.size;
      st.busy = false; st.selecting = false; st.sel.clear();
      toast(t('food.tagged', { n }));
      refresh();
    } catch (err) {
      st.busy = false; draw();
      if (/meal_types/.test((err && err.message) || '')) toast(t('food.needSql'), 'error'); else fail(err);
    }
  });
  on(el, 'click', '[data-edit]', (e, b) => openRecipeEditor(recipes.find((r) => r.id === b.dataset.edit)));
  on(el, 'click', '[data-del]', async (e, b) => {
    if (!(await confirmBox(t('common.confirmDelete')))) return;
    try { await remove('recipes', b.dataset.del); toast(t('common.deleted')); refresh(); } catch (err) { fail(err); }
  });
  draw();
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
    <div class="grow"><strong>${it.name}</strong><div class="muted tiny">${num(it.kcal100, 0)} kcal/100 g${it.est ? html` · <span class="est-flag">${t('food.estimated')}</span>` : ''}</div></div>
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
          <span class="grow"><strong>${r.name}</strong>${r.src ? html` <span class="tag est">${t('food.src.' + r.src)}</span>` : ''}<span class="muted tiny"> P ${num(r.p100)} · C ${num(r.c100)} · G ${num(r.f100)} /100 g</span></span><b>${num(r.kcal100, 0)} kcal</b>${raw(ICONS.plus)}</button>`)}</div>`) : ''}
        <button type="button" class="link" id="b-manual-toggle">${state.manual ? t('food.hideManual') : t('food.manual')}</button>
        ${state.manual ? html`<div class="manual grid2">
          <label class="field"><span>${t('food.ingName')}</span><input type="text" id="m-name"></label>
          <button type="button" class="btn small" id="m-est">${t('food.estimate')}</button>
          <p class="tiny muted" id="m-est-note"></p>
          <label class="field"><span>${t('food.grams')} (g)</span><input type="number" step="any" inputmode="decimal" id="m-g" value="100"></label>
          <label class="field"><span>kcal / 100 g</span><input type="number" step="any" inputmode="decimal" id="m-k"></label>
          <label class="field"><span>${t('food.protein')} / 100 g</span><input type="number" step="any" inputmode="decimal" id="m-p"></label>
          <label class="field"><span>${t('food.carbs')} / 100 g</span><input type="number" step="any" inputmode="decimal" id="m-c"></label>
          <label class="field"><span>${t('food.fat')} / 100 g</span><input type="number" step="any" inputmode="decimal" id="m-f"></label>
          <button type="button" class="btn" id="m-add">${t('food.addIngredient')}</button></div>` : ''}
      </div>
      ${mode === 'recipe' ? html`<div class="field"><span>${t('menu.tagsLabel')}</span><div class="chips" id="b-tags">${TAGS.map((k) => html`<button type="button" class="chip ${state.tags.has(k) ? 'on' : ''}" data-tag="${k}">${t('menu.slot.' + k)}</button>`)}</div><p class="tiny muted">${t('menu.tagsHelp')}</p></div>` : ''}
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
    // Primero lo que ya tenemos (tu memoria y la tabla propia): sale al instante y sirve aunque Open Food Facts no responda.
    const memory = await loadMemory();
    const mine = searchMemory(memory, q, 5);
    const taken = new Set(mine.map((m) => keyOf(m.name)));
    const local = [...mine, ...searchTable(q, 8).filter((x) => !taken.has(keyOf(x.name)))];
    state.error = ''; state.results = local.length ? local : null; state.searching = true; draw();
    el.querySelector('#b-q').value = q;
    let off = [];
    try { off = await searchFoods(q); } catch (err) { console.warn(err); state.error = t(local.length ? 'food.searchOffDown' : 'food.searchFailed'); }
    const all = [...local, ...off];
    state.results = state.error && !all.length ? null : all;
    state.searching = false; draw();
    el.querySelector('#b-q').value = q;
  };
  on(el, 'click', '#b-search', doSearch);
  on(el, 'keydown', '#b-q', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  on(el, 'click', '[data-res]', (e, b) => {
    const r = state.results[Number(b.dataset.res)];
    // Lo de la tabla propia es aproximado (se marca como estimado); lo de tu memoria, según de dónde saliera.
    const est = r.src === 'db' ? 'db' : r.src === 'mem' && r.memSrc === 'off' ? 'off' : null;
    state.items.push({ name: r.name, grams: 100, kcal100: r.kcal100, p100: r.p100, c100: r.c100, f100: r.f100, ...(est ? { est } : {}) });
    state.results = null; draw();
    const inputs = el.querySelectorAll('.grams');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  });
  on(el, 'click', '#m-est', async (e, btn) => {
    const name = el.querySelector('#m-name').value.trim();
    if (name.length < 2) { toast(t('food.needIng'), 'error'); return; }
    btn.disabled = true;
    const est = await estimateOne(name, { memory: await loadMemory() }); // primero tu memoria de ingredientes, luego la tabla y por último Open Food Facts
    btn.disabled = false;
    if (!est) { toast(t('food.estNone'), 'error'); return; }
    if (est.source === 'off') remember([{ name, ...est }]); // lo encontrado en Open Food Facts se recuerda para la próxima vez
    el.querySelector('#m-k').value = est.kcal100; el.querySelector('#m-p').value = est.p100; el.querySelector('#m-c').value = est.c100; el.querySelector('#m-f').value = est.f100;
    state.estSource = est.source === 'mem' ? (est.note === 'off' ? 'off' : null) : est.source; // lo recordado que escribiste tú a mano no es una estimación
    el.querySelector('#m-est-note').textContent = t('food.estDone', { src: t('food.estFrom.' + est.source) });
  });
  on(el, 'click', '#m-add', () => {
    const name = el.querySelector('#m-name').value.trim();
    const g = toNum(el.querySelector('#m-g').value) ?? 0;
    const k = toNum(el.querySelector('#m-k').value);
    if (!name || k === null) { toast(t('food.needIng'), 'error'); return; }
    state.items.push({ name, grams: g, kcal100: k, p100: toNum(el.querySelector('#m-p').value) ?? 0, c100: toNum(el.querySelector('#m-c').value) ?? 0, f100: toNum(el.querySelector('#m-f').value) ?? 0, ...(state.estSource ? { est: state.estSource } : {}) });
    state.estSource = null; state.manual = false; draw();
  });
  on(el, 'click', '#b-ok', async (e, btn) => {
    if (!state.items.length) { toast(t('food.needItems'), 'error'); return; }
    let name = state.name.trim();
    if (!name && (mode === 'recipe' || state.saveRecipe)) { toast(t('food.needName'), 'error'); return; }
    if (!name) name = state.items.slice(0, 3).map((i) => i.name.split('(')[0].trim()).join(', ');
    btn.disabled = true;
    try { await onSubmit({ name, items: state.items, saveRecipe: state.saveRecipe, mealTypes: TAGS.filter((k) => state.tags.has(k)) }); } catch (err) { btn.disabled = false; fail(err); }
  });
  draw();
}

// exportado para pruebas
export { builder };
