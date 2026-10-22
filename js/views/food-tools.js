// Herramientas de Comidas: importar recetas (CSV/Excel), repetir comidas de otro día y sugerir el menú del día.
import { listRange, insert, insertMany, update, session } from '../db.js';
import { totals, itemTotals } from '../off.js';
import { completeItems, OFF_GAP_MS } from '../estimate.js';
import { csvTemplate, parseCsv, decodeCsv, buildRecipes, normName } from '../recipe-import.js';
import { readXlsx } from '../xlsx-read.js';
import { suggest, describe, sumSlots, mealPayload, SLOTS, TAGS } from '../menu.js';
import { html, raw, setHtml, on, openModal, spinner, addDays, dateLong, num, toNum, fail, toast, refresh, navigate } from '../util.js';
import { t } from '../i18n.js';

const slotName = (s) => t('menu.slot.' + s);
const BIG_KCAL = 900; // una ración de más de esto casi seguro es una olla entera
const servOf = (r) => (Number(r.servings) > 0 ? Number(r.servings) : 1);
const mealRow = (date, m) => ({
  date, meal_type: m.meal_type, name: m.name, recipe_id: m.recipe_id || null, factor: m.factor, items: m.items,
  kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g,
});

// Guarda una receta; si aún no se ha ejecutado el SQL 03 (columna meal_types), la guarda sin etiquetas y lo avisa.
export async function saveRecipeRow(id, row) {
  if (!id && row.meal_types && !row.meal_types.length) { const { meal_types: _empty, ...rest } = row; row = rest; } // sin etiquetas: no hace falta la columna
  const attempt = (r) => (id ? update('recipes', id, r) : insert('recipes', r));
  try { return await attempt(row); } catch (e) {
    if (/meal_types/.test((e && e.message) || '')) { toast(t('food.needSql'), 'error'); const { meal_types: _drop, ...rest } = row; return attempt(rest); }
    throw e;
  }
}

// ---------- repetir comidas de otro día ----------
export function openCopyMeals(date) {
  const st = { from: addDays(date, -1), rows: null, off: new Set() };
  const m = openModal(html`<div id="cp"></div>`, { title: t('copy.title') });
  const box = m.body.querySelector('#cp');
  const load = async () => {
    st.rows = null; st.off = new Set(); draw();
    if (st.from && st.from !== date) {
      try { st.rows = await listRange('meals', st.from, st.from, '*', 'created_at'); } catch (e) { fail(e); st.rows = []; }
    }
    draw();
  };
  const draw = () => {
    const picked = st.rows ? st.rows.filter((r) => !st.off.has(r.id)) : [];
    setHtml(box, html`
      <label class="field"><span>${t('copy.from')}</span><input type="date" id="cp-date" value="${st.from}"></label>
      ${st.from === date ? html`<p class="muted">${t('copy.same')}</p>` : st.rows === null ? spinner() : st.rows.length === 0 ? html`<p class="muted">${t('copy.none')}</p>` : html`
        <div class="list">${st.rows.map((r) => html`<label class="row static check-row">
          <input type="checkbox" data-id="${r.id}" ${st.off.has(r.id) ? '' : 'checked'}>
          <div class="grow"><strong>${r.name}</strong><div class="muted small">${t('food.type.' + r.meal_type)}</div></div>
          <div class="right"><strong>${num(r.kcal, 0)} kcal</strong></div></label>`)}</div>
        <div class="form-actions"><button class="btn primary" id="cp-go" ${picked.length ? '' : 'disabled'}>${t('copy.go')}</button></div>`}`);
  };
  on(box, 'change', '#cp-date', (e, inp) => { st.from = inp.value; load(); });
  on(box, 'change', '[data-id]', (e, c) => { if (c.checked) st.off.delete(c.dataset.id); else st.off.add(c.dataset.id); draw(); });
  on(box, 'click', '#cp-go', async (e, btn) => {
    const rows = st.rows.filter((r) => !st.off.has(r.id)).map((r) => mealRow(date, r));
    if (!rows.length) return;
    btn.disabled = true;
    try { await insertMany('meals', rows); m.close(); toast(t('copy.done', { n: rows.length })); refresh(); } catch (err) { btn.disabled = false; fail(err); }
  });
  load();
}

// ---------- importar recetas ----------
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function readTable(file) {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  const zip = head[0] === 0x50 && head[1] === 0x4b, oldXls = head[0] === 0xd0 && head[1] === 0xcf;
  if (/\.xlsx?$/i.test(file.name) || zip || oldXls) return readXlsx(buf);
  return parseCsv(decodeCsv(buf));
}

export function openImport(existing) {
  const byName = new Map();
  existing.forEach((r) => { if (!byName.has(normName(r.name))) byName.set(normName(r.name), r); });
  const st = { stage: 'pick', busy: false, error: '', result: null, fileName: '', open: new Set(), progress: null, report: null, onlyPend: false, noResult: new Set(), abort: null };
  const m = openModal(html`<div id="im"></div>`, { title: t('imp.title'), wide: true });
  const box = m.body.querySelector('#im');
  // Progreso de "Completar": texto, tiempo aproximado (Open Food Facts limita a 10 consultas por minuto) y botón de cancelar.
  const progHtml = () => {
    const p = st.progress;
    const mins = Math.ceil(((p.remoteLeft || 0) * OFF_GAP_MS()) / 60000);
    return html`${spinner(t('imp.completing', p))}
      ${p.waiting ? html`<p class="small">${t('imp.waiting')}</p>` : mins >= 1 ? html`<p class="tiny muted">${t('imp.eta', { m: mins })}</p>` : ''}
      <button class="btn small" id="im-cancel">${t('common.cancel')}</button>`;
  };
  const draw = () => {
    if (st.stage === 'pick') {
      setHtml(box, html`
        <p class="muted">${t('imp.intro')}</p>
        <p class="muted small">${t('imp.altLayout')}</p>
        <div class="row-actions">
          <button class="btn" id="im-tpl">${t('imp.template')}</button>
          <button class="btn primary" id="im-pick">${t('imp.choose')}</button>
        </div>
        <input type="file" id="im-file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
        ${st.busy ? spinner(t('imp.reading')) : ''}
        ${st.error ? html`<p class="note warn">${st.error}</p>` : ''}`);
    } else {
      const rs = st.result.recipes;
      const nNew = rs.filter((r) => !byName.has(normName(r.name))).length;
      const w = st.result.warnings;
      const all = rs.flatMap((r) => r.items);
      const nMissing = new Set(all.filter((i) => i.missing).map((i) => normName(i.name))).size; // ingredientes DISTINTOS sin datos
      const sameCount = new Map();
      all.forEach((i) => sameCount.set(normName(i.name), (sameCount.get(normName(i.name)) || 0) + 1));
      // Recetas con ingredientes que siguen sin datos (tras "Completar" o si no se ha pulsado), para marcarlas y poder filtrarlas.
      const pend = rs.map((r, ri) => ({ ri, n: r.items.filter((i) => i.missing).length })).filter((x) => x.n);
      const pendSet = new Set(pend.map((x) => x.ri));
      const pendNames = [...new Map(all.filter((i) => i.missing).map((i) => [normName(i.name), i.name])).values()];
      if (!pend.length) st.onlyPend = false;
      const nEst = all.filter((i) => i.est).length;
      const nBig = rs.filter((r) => servOf(r) === 1 && totals(r.items, 1).kcal > BIG_KCAL).length;
      const nUntag = rs.filter((r) => !r.meal_types.length && !((byName.get(normName(r.name)) || {}).meal_types || []).length).length;
      const field = (it, f, label) => html`<label><span>${label}</span><input type="number" inputmode="decimal" step="any" min="0" data-f="${f}" value="${it[f]}"></label>`;
      setHtml(box, html`
        <p><strong>${t('imp.summary', { n: rs.length, new: nNew, upd: rs.length - nNew })}</strong> <span class="muted small">${st.fileName}</span></p>
        <div class="note"><strong>${t('imp.servTitle')}</strong><p class="small">${t('imp.servNote')}</p>
          ${nBig ? html`<p class="small"><b>${t('imp.bigCount', { n: nBig })}</b></p>` : ''}</div>
        ${nUntag ? html`<div class="note warn"><strong>${t('imp.noType', { n: nUntag, total: rs.length })}</strong><p class="small">${t('imp.noTypeHelp')}</p></div>` : ''}
        ${nMissing ? html`<div class="note warn"><strong>${t('imp.missing', { n: nMissing })}</strong>
          <p class="small">${t('imp.missingHelp')}</p>
          <button class="btn small primary" id="im-complete" ${st.busy ? 'disabled' : ''}>${t('imp.complete')}</button></div>` : ''}
        ${st.progress ? html`<div id="im-prog">${progHtml()}</div>` : ''}
        ${st.report ? html`<div class="note"><p>${t('imp.completed', st.report)}</p>
          ${st.report.failed ? html`<p class="small">${t('imp.failedNote', { n: st.report.failed })}</p>` : ''}
          ${st.report.stopped === 'blocked' ? html`<p class="small"><b>${t('imp.blocked')}</b></p>` : st.report.stopped === 'cancel' ? html`<p class="small">${t('imp.cancelled')}</p>` : ''}
          ${st.report.left ? html`<p class="small">${t('imp.leftNote', { n: st.report.left })}</p>` : ''}</div>` : ''}
        ${st.report && pend.length ? html`<div class="note warn pend"><strong>${t('imp.pendTitle', { n: pendNames.length, r: pend.length })}</strong>
          <div class="pend-names">${pendNames.slice(0, 12).map((n) => html`<span class="tag bad">${n}</span>`)}${pendNames.length > 12 ? html`<span class="muted small">${t('imp.andMore', { n: pendNames.length - 12 })}</span>` : ''}</div>
          <p class="small">${t('imp.pendHelp')}</p>
          <button class="btn small" id="im-only">${st.onlyPend ? t('imp.showAll') : t('imp.onlyPend')}</button></div>` : ''}
        ${nEst ? html`<p class="muted small">${t('imp.estHelp')}</p>` : ''}
        <div class="list imp-list">${rs.map((r, ri) => {
          if (st.onlyPend && !pendSet.has(ri)) return '';
          const sv = servOf(r);
          const nPend = r.items.filter((i) => i.missing).length;
          const tt = totals(r.items, 1 / sv);
          const big = sv === 1 && tt.kcal > BIG_KCAL;
          const isNew = !byName.has(normName(r.name));
          return html`<details class="imp-rec ${nPend ? 'has-miss' : ''}" data-r="${ri}" ${st.open.has(ri) ? 'open' : ''}>
            <summary class="row static"><div class="grow"><strong>${r.name}</strong>
              <div class="muted small">${t('imp.items', { n: r.items.length })} · ${num(tt.kcal, 0)} kcal · P ${num(tt.protein, 0)} · C ${num(tt.carbs, 0)} · G ${num(tt.fat, 0)}</div>
              <div class="tags">${r.meal_types.map((x) => html`<span class="tag">${slotName(x)}</span>`)}${sv > 1 ? html`<span class="tag est">÷ ${num(sv, 2)}</span>` : ''}${big ? html`<span class="tag warn">${t('imp.bigBadge')}</span>` : ''}${nPend ? html`<span class="tag bad">${t('imp.pendBadge', { n: nPend })}</span>` : ''}</div></div>
              <span class="imp-badge ${isNew ? 'new' : 'upd'}">${isNew ? t('imp.new') : t('imp.update')}</span></summary>
            <div class="imp-rec-opts">
              <label class="serv"><span>${t('imp.servLabel')}</span><input type="number" min="1" max="50" step="any" inputmode="decimal" data-sv value="${sv}"></label>
              <div class="chips">${TAGS.map((k) => html`<button type="button" class="chip ${r.meal_types.includes(k) ? 'on' : ''}" data-rtag="${k}">${slotName(k)}</button>`)}</div>
            </div>
            <div class="imp-ings">${r.items.map((it, ii) => html`<div class="imp-ing ${it.missing ? 'miss' : ''}" data-r="${ri}" data-i="${ii}">
              <div class="imp-ing-head"><span class="grow"><strong>${it.name}</strong> <span class="muted small">${num(it.grams / sv, 0)} g · ${num(itemTotals(it).kcal / sv, 0)} kcal</span></span>
                ${it.missing ? html`<span class="tag warn">${t('imp.noData')}</span>` : it.manual ? html`<span class="tag est">${t('imp.manualTag')}</span>` : it.est ? html`<span class="tag est">${t('imp.est.' + it.est)}</span>` : ''}</div>
              ${it.missing || it.est || it.manual ? html`<p class="tiny muted">${t('imp.per100')}${sameCount.get(normName(it.name)) > 1 ? html` · ${t('imp.sameAll', { n: sameCount.get(normName(it.name)) - 1 })}` : ''}</p><div class="est-grid">${field(it, 'kcal100', 'kcal')}${field(it, 'p100', 'P')}${field(it, 'c100', 'C')}${field(it, 'f100', 'G')}</div>` : ''}
            </div>`)}</div></details>`;
        })}</div>
        ${w.length ? html`<details class="warn-box"><summary>${t('imp.warnings', { n: w.length })}</summary><ul>${w.slice(0, 12).map((x) => html`<li>${x.row ? t('imp.row', { n: x.row }) + ': ' : ''}${x.text}</li>`)}${w.length > 12 ? html`<li>${t('imp.more', { n: w.length - 12 })}</li>` : ''}</ul></details>` : ''}
        <div class="form-actions two"><button class="btn" id="im-back">${t('imp.other')}</button><button class="btn primary" id="im-run" ${st.busy ? 'disabled' : ''}>${t('imp.run', { n: rs.length })}</button></div>
        ${st.busy ? spinner() : ''}`);
    }
  };
  box.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d && d.matches && d.matches('details.imp-rec')) { if (d.open) st.open.add(Number(d.dataset.r)); else st.open.delete(Number(d.dataset.r)); }
  }, true);
  on(box, 'change', '[data-sv]', (e, inp) => {
    const r = st.result.recipes[Number(inp.closest('.imp-rec').dataset.r)];
    const n = Number(String(inp.value).replace(',', '.'));
    r.servings = n > 0 && n <= 50 ? n : 1;
    draw();
  });
  on(box, 'click', '[data-rtag]', (e, b) => {
    const r = st.result.recipes[Number(b.closest('.imp-rec').dataset.r)];
    const set = new Set(r.meal_types);
    if (set.has(b.dataset.rtag)) set.delete(b.dataset.rtag); else set.add(b.dataset.rtag);
    r.meal_types = TAGS.filter((k) => set.has(k));
    draw();
  });
  on(box, 'change', '.est-grid input', (e, inp) => {
    const row = inp.closest('.imp-ing');
    const it = st.result.recipes[Number(row.dataset.r)].items[Number(row.dataset.i)];
    const f = inp.dataset.f, v = toNum(inp.value) ?? 0;
    // Lo que se escribe se copia a las demás líneas con el mismo ingrediente (las que faltaban, eran estimadas o ya se rellenaron así),
    // salvo el campo que la persona haya escrito a mano en esa otra línea, para no pisarlo. Así no hay que repetirlo en cada receta.
    const key = normName(it.name);
    it.typed = { ...(it.typed || {}), [f]: true };
    const same = st.result.recipes.flatMap((r) => r.items).filter((o) => o !== it && normName(o.name) === key && (o.missing || o.est || o.manual) && !(o.typed && o.typed[f]));
    for (const x of [it, ...same]) {
      x[f] = v;
      if (v > 0) { delete x.missing; x.manual = true; } // ya lo ha puesto la persona
    }
    draw();
  });
  on(box, 'click', '#im-complete', async () => {
    const items = st.result.recipes.flatMap((r) => r.items);
    const names = new Set(items.filter((x) => x.missing).map((x) => normName(x.name))).size;
    st.busy = true; st.report = null; st.progress = { i: 0, n: names, remoteLeft: 0 }; st.abort = new AbortController(); draw();
    let wake = null;
    try { wake = navigator.wakeLock ? await navigator.wakeLock.request('screen') : null; } catch { /* sin permiso: no pasa nada */ } // que el móvil no se apague mientras busca
    try {
      st.report = await completeItems(items, {
        skip: st.noResult, signal: st.abort.signal,
        onProgress: (i, n, info) => { st.progress = { i, n, ...info }; const el = box.querySelector('#im-prog'); if (el) setHtml(el, progHtml()); },
      });
      st.report.noResult.forEach((k) => st.noResult.add(k)); // lo que Open Food Facts no tiene no se vuelve a preguntar
    } catch (err) { fail(err); }
    if (wake) wake.release().catch(() => {});
    st.abort = null; st.busy = false; st.progress = null;
    // Si quedan ingredientes sin datos, se enseñan directamente solo esas recetas, ya abiertas.
    st.result.recipes.forEach((r, ri) => { if (r.items.some((i) => i.missing)) { st.onlyPend = true; st.open.add(ri); } });
    draw();
    const pendEl = box.querySelector('.pend');
    if (pendEl) pendEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  on(box, 'click', '#im-cancel', () => { if (st.abort) st.abort.abort(); });
  on(box, 'click', '#im-only', () => {
    st.onlyPend = !st.onlyPend;
    if (st.onlyPend) st.result.recipes.forEach((r, ri) => { if (r.items.some((i) => i.missing)) st.open.add(ri); });
    draw();
  });
  on(box, 'click', '#im-tpl', () => download('plantilla-recetas.csv', csvTemplate(), 'text/csv;charset=utf-8'));
  on(box, 'click', '#im-pick', () => box.querySelector('#im-file').click());
  on(box, 'click', '#im-back', () => { st.stage = 'pick'; st.error = ''; draw(); });
  on(box, 'change', '#im-file', async (e, input) => {
    const file = input.files[0];
    if (!file) return;
    st.busy = true; st.error = ''; draw();
    try {
      const res = buildRecipes(await readTable(file));
      if (res.error) st.error = res.error === 'none' && res.warnings.length ? `${t('imp.err.none')} (${res.warnings[0].text})` : t('imp.err.' + res.error);
      else { st.result = res; st.stage = 'preview'; st.fileName = file.name; }
    } catch (err) { console.warn(err); st.error = `${t('imp.err.read')}: ${(err && err.message) || err}`; }
    st.busy = false; draw();
  });
  on(box, 'click', '#im-run', async () => {
    st.busy = true; draw();
    try {
      const fresh = [], updates = [];
      // 'missing' es solo una marca de la vista previa; si la receta da varias raciones, se guarda UNA ración (gramos divididos).
      const prep = (r) => r.items.map(({ missing: _m, manual: _n, typed: _t, ...it }) => (servOf(r) === 1 ? it : { ...it, grams: Math.round((it.grams / servOf(r)) * 10) / 10 }));
      for (const r of st.result.recipes) {
        const old = byName.get(normName(r.name));
        if (old) updates.push([old, r]); else fresh.push(r);
      }
      let sqlMissing = false;
      if (fresh.length) {
        try { await insertMany('recipes', fresh.map((r) => ({ name: r.name, items: prep(r), meal_types: r.meal_types }))); } catch (e) {
          if (!/meal_types/.test((e && e.message) || '')) throw e;
          sqlMissing = true;
          await insertMany('recipes', fresh.map((r) => ({ name: r.name, items: prep(r) })));
        }
      }
      for (const [old, r] of updates) {
        // Si el archivo no trae tipo para esa receta, se conservan las etiquetas que ya tenía.
        const row = { name: r.name, items: prep(r), meal_types: r.meal_types.length ? r.meal_types : old.meal_types || [] };
        if (sqlMissing) delete row.meal_types;
        try { await update('recipes', old.id, row); } catch (e) {
          if (!/meal_types/.test((e && e.message) || '')) throw e;
          sqlMissing = true; delete row.meal_types; await update('recipes', old.id, row);
        }
      }
      if (sqlMissing) toast(t('food.needSql'), 'error');
      m.close(); toast(t('imp.done', { new: fresh.length, upd: updates.length })); refresh();
    } catch (err) { st.busy = false; draw(); fail(err); }
  });
  draw();
}

// ---------- sugerir el menú del día ----------
const loadSaved = (key) => { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } };
const store = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

export function openSuggest({ date, meals, recipes, goalPlan }) {
  const eatenMeals = [...meals];
  const m = openModal(html`<div id="sg"></div>`, { title: t('menu.title') });
  const box = m.body.querySelector('#sg');
  let dirty = false;
  m.onClose = () => { if (dirty) refresh(); };

  if (!goalPlan) {
    setHtml(box, html`<p class="muted">${t('menu.noPlan')}</p><div class="form-actions"><button class="btn primary" id="sg-profile">${t('menu.noPlanBtn')}</button></div>`);
    on(box, 'click', '#sg-profile', () => { m.close(); navigate('profile'); });
    return;
  }
  if (!recipes.length) {
    setHtml(box, html`<p class="muted">${t('menu.noRecipes')}</p><div class="form-actions"><button class="btn primary" id="sg-recipes">${t('menu.goRecipes')}</button></div>`);
    on(box, 'click', '#sg-recipes', () => { m.close(); navigate('food', { tab: 'recipes' }); });
    return;
  }

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const key = `menu3_${session.user ? session.user.id : 'anon'}_${date}`;
  const eaten = () => eatenMeals.reduce((s, x) => ({ kcal: s.kcal + Number(x.kcal || 0), protein: s.protein + Number(x.protein_g || 0) }), { kcal: 0, protein: 0 });
  const openSlots = () => SLOTS.filter((s) => !eatenMeals.some((x) => x.meal_type === s));
  const remaining = () => goalPlan.target - eaten().kcal;

  let slots = [];
  const generate = () => { slots = suggest(recipes, remaining(), openSlots()); store(key, { slots }); };
  const saved = loadSaved(key);
  if (saved && Array.isArray(saved.slots)) {
    slots = saved.slots.filter((s) => openSlots().includes(s.slot));
    slots.forEach((s) => {
      s.opts = (s.opts || []).filter(([id]) => byId.has(id)); if (s.i >= s.opts.length) s.i = 0;
      for (const [optsKey, idxKey] of [['sideOpts', 'si'], ['starterOpts', 'ti']]) {
        const cur = s[optsKey] && s[idxKey] >= 0 ? s[optsKey][s[idxKey]] : null;
        s[optsKey] = (s[optsKey] || []).filter((id) => byId.has(id));
        s[idxKey] = cur && s[optsKey].includes(cur) ? s[optsKey].indexOf(cur) : -1;
      }
    });
    if (openSlots().some((s) => !slots.some((x) => x.slot === s))) generate();
  } else generate();

  // Primer plato o guarnición de una toma: el plato entero con sus botones (cambiar / quitar / poner).
  const extra = (kind, s, d) => {
    const opts = kind === 'starter' ? s.starterOpts : s.sideOpts;
    const x = d[kind];
    if (!opts || !opts.length) return '';
    return html`${x ? html`<div class="slot-side ${kind}"><span class="tag">${t('menu.slot.' + kind)}</span> <strong>${x.recipe.name}</strong>
        <div class="muted small">${t('menu.sideWhole')} · <b>${num(x.tt.kcal, 0)} kcal</b> · P ${num(x.tt.protein, 0)} · C ${num(x.tt.carbs, 0)} · G ${num(x.tt.fat, 0)}</div></div>` : ''}
      <div class="slot-actions side-actions">
        ${x ? html`<button class="btn small ghost" data-${kind}-change ${opts.length > 1 ? '' : 'disabled'}>${t('menu.' + kind + 'Change')}</button>` : ''}
        <button class="btn small ghost" data-${kind}-off>${x ? t('menu.' + kind + 'Remove') : t('menu.' + kind + 'Add')}</button>
      </div>`;
  };
  const draw = () => {
    const left = remaining();
    if (!openSlots().length || slots.length === 0) {
      setHtml(box, html`<p class="muted">${eatenMeals.length && !openSlots().length ? t('menu.allDone') : t('menu.reached')}</p>`);
      return;
    }
    if (left < 100) { setHtml(box, html`<p class="muted">${t('menu.reached')}</p>`); return; }
    const sum = sumSlots(slots, byId);
    const protein = eaten().protein + sum.protein;
    setHtml(box, html`
      <p class="muted">${t('menu.intro')}</p>
      <div class="card plan-line"><strong>${t('menu.left', { n: num(left, 0) })}</strong>
        <span class="muted small"> · ${t('food.goal')}: ${num(goalPlan.target, 0)} kcal</span></div>
      ${slots.map((s) => {
        const d = describe(s, byId);
        return html`<div class="card slot" data-slot="${s.slot}">
          <div class="slot-head"><h3>${slotName(s.slot)}</h3><span class="muted small">${t('menu.target', { n: num(s.target, 0) })}</span></div>
          ${d ? html`${extra('starter', s, d)}
            <strong class="slot-name">${d.recipe.name}</strong>
            <div class="muted small">× ${num(d.factor, 2)} · <b>${num(d.tt.kcal, 0)} kcal</b> · P ${num(d.tt.protein, 0)} · C ${num(d.tt.carbs, 0)} · G ${num(d.tt.fat, 0)}</div>
            ${extra('side', s, d)}
            ${d.side || d.starter ? html`<div class="small"><b>${t('menu.slotTotal', { n: num(d.total.kcal, 0) })}</b></div>` : ''}
            <div class="slot-actions">
              <button class="btn small" data-less aria-label="${t('menu.less')}">−</button><button class="btn small" data-more aria-label="${t('menu.more')}">+</button>
              <button class="btn small ghost" data-change ${s.opts.length > 1 ? '' : 'disabled'}>${t('menu.change')}</button>
              <button class="btn small primary" data-eat>${t('menu.eaten')} ✓</button>
            </div>`
    : html`<p class="muted small">${t('menu.noneFor', { slot: slotName(s.slot) })}</p>`}
        </div>`;
      })}
      <p class="small">${t('menu.total', { kcal: num(sum.kcal, 0), p: num(protein, 0) })} <span class="muted">(${t('menu.proteinRef', { t: num(goalPlan.protein, 0) })})</span></p>
      <div class="form-actions two"><button class="btn" id="sg-again">${t('menu.again')}</button><button class="btn primary" id="sg-all">${t('menu.registerAll')} ✓</button></div>
      <p class="tiny muted">${t('menu.disclaimer')}</p>`);
  };
  const slotOf = (el) => slots.find((s) => s.slot === el.closest('[data-slot]').dataset.slot);
  const mealFor = (s) => {
    const d = describe(s, byId);
    if (!d) return null;
    return { date, meal_type: s.slot, ...mealPayload(d) };
  };
  const done = (rows) => {
    rows.forEach((r) => eatenMeals.push(r));
    slots = slots.filter((s) => !rows.some((r) => r.meal_type === s.slot));
    store(key, { slots }); dirty = true; toast(t('menu.saved')); draw();
  };
  on(box, 'click', '[data-more]', (e, b) => { const s = slotOf(b); const d = describe(s, byId); s.f = Math.min(3, (d.factor || 1) + 0.25); store(key, { slots }); draw(); });
  on(box, 'click', '[data-less]', (e, b) => { const s = slotOf(b); const d = describe(s, byId); s.f = Math.max(0.25, (d.factor || 1) - 0.25); store(key, { slots }); draw(); });
  on(box, 'click', '[data-change]', (e, b) => { const s = slotOf(b); s.i = (s.i + 1) % s.opts.length; s.f = null; store(key, { slots }); draw(); });
  // Primer plato y guarnición: cambiar por otro, o quitarlo / ponerlo. Al tocarlos, la ración del principal se recalcula.
  for (const [kind, optsKey, idxKey] of [['side', 'sideOpts', 'si'], ['starter', 'starterOpts', 'ti']]) {
    on(box, 'click', `[data-${kind}-change]`, (e, b) => { const s = slotOf(b); s[idxKey] = (s[idxKey] + 1) % s[optsKey].length; s.f = null; store(key, { slots }); draw(); });
    on(box, 'click', `[data-${kind}-off]`, (e, b) => { const s = slotOf(b); s[idxKey] = s[idxKey] >= 0 ? -1 : 0; s.f = null; store(key, { slots }); draw(); });
  }
  on(box, 'click', '[data-eat]', async (e, b) => {
    const s = slotOf(b); const row = mealFor(s);
    if (!row) return;
    b.disabled = true;
    try { await insert('meals', row); done([{ ...row }]); } catch (err) { b.disabled = false; fail(err); }
  });
  on(box, 'click', '#sg-again', () => { generate(); draw(); });
  on(box, 'click', '#sg-all', async (e, b) => {
    const rows = slots.map(mealFor).filter(Boolean);
    if (!rows.length) return;
    b.disabled = true;
    try { await insertMany('meals', rows); done(rows); } catch (err) { b.disabled = false; fail(err); }
  });
  draw();
}
