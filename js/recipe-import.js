// Importar recetas desde una tabla (CSV o Excel). Funciones puras: no tocan la pantalla ni la nube.
// Formato recomendado: UNA FILA POR INGREDIENTE
//   receta | tipo | ingrediente | gramos | kcal_100g | proteinas_100g | hidratos_100g | grasas_100g
// Las columnas sin "100" (kcal, proteína...) se entienden como el total para los gramos de esa fila.
// También vale UNA FILA POR RECETA con los totales de una ración: receta | tipo | kcal | proteinas | hidratos | grasas.

export const MEAL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner', 'starter', 'side'];
const MAX_RECIPES = 500, MAX_ITEMS = 60;

const strip = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- números ("1,5", "1.5", "1.234,5", "150 g") ----------
export function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').replace(/[\s ]/g, '');
  if (!s) return null;
  s = s.replace(/[^0-9.,-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return null;
  const dot = s.lastIndexOf('.'), com = s.lastIndexOf(',');
  if (dot >= 0 && com >= 0) s = dot > com ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (com >= 0) s = s.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 1.500 = mil quinientos
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}
const r1 = (x) => Math.round(x * 10) / 10;
export const normName = strip;

// ---------- CSV ----------
export function parseCsv(text) {
  let s = String(text ?? '').replace(/^﻿/, '');
  const first = s.split(/\r?\n/).find((l) => l.trim()) || '';
  const count = (ch) => (first.match(new RegExp(ch === '\t' ? '\\t' : '\\' + ch, 'g')) || []).length;
  const delim = [';', ',', '\t'].map((d) => [d, count(d)]).sort((a, b) => b[1] - a[1])[0];
  const D = delim[1] > 0 ? delim[0] : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === D) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Decodifica los bytes de un CSV: UTF-8 y, si no es válido, Windows-1252 (lo que guarda Excel en español).
export function decodeCsv(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

// ---------- cabeceras ----------
function classify(h) {
  const k = strip(h);
  if (!k) return null;
  if (/^(receta|recetas|plato|recipe|nombrereceta|nombredelareceta|nombredelplato)$/.test(k)) return 'recipe';
  if (/^(tipo|tipodecomida|momento|cuando|meal|type|categoria|comida|toma)$/.test(k)) return 'types';
  if (/^(ingrediente|ingredientes|alimento|ingredient|food)$/.test(k)) return 'ingredient';
  if (/^(raciones|racion|porciones|porcion|servings|serving|rations|numeroderaciones|nraciones)$/.test(k)) return 'servings';
  if (/^(gramos|gr|g|cantidad|cantidadg|peso|grams|qty)$/.test(k)) return 'grams';
  if (/^(kcal|calorias|calories|energia|energy)/.test(k)) return k.includes('100') ? 'kcal100' : 'kcal';
  if (/^(prot|proteina|proteinas|protein)/.test(k)) return k.includes('100') ? 'p100' : 'p';
  if (/^(hidrat|carbo|carbs|hc|hidratosdecarbono)/.test(k)) return k.includes('100') ? 'c100' : 'c';
  if (/^(grasa|grasas|fat|lipid)/.test(k)) return k.includes('100') ? 'f100' : 'f';
  return null;
}

export function parseSlots(v) {
  const out = new Set(), bad = [];
  for (const raw of String(v ?? '').split(/[\/|,;+]|\sy\s/i)) {
    const k = strip(raw);
    if (!k) continue;
    if (/^(desayuno|breakfast|almuerzomanana)$/.test(k)) out.add('breakfast');
    else if (/^(comida|almuerzo|lunch)$/.test(k)) out.add('lunch');
    else if (/^(merienda|snack|mediamanana|tentempie|aperitivo)$/.test(k)) out.add('snack');
    else if (/^(cena|dinner|supper)$/.test(k)) out.add('dinner');
    else if (/^(primero|primeros|primerplato|primerosplatos|entrante|entrantes|starter|starters|firstcourse)$/.test(k)) out.add('starter');
    else if (/^(guarnicion|guarniciones|acompanamiento|acompanante|side|sidedish|garnish)$/.test(k)) out.add('side');
    else bad.push(raw.trim());
  }
  return { slots: MEAL_SLOTS.filter((s) => out.has(s)), bad };
}

/**
 * table: array de filas (array de celdas). Devuelve { layout, recipes, warnings, error }.
 * recipes: [{ name, meal_types, items: [{ name, grams, kcal100, p100, c100, f100 }] }]
 */
export function buildRecipes(table) {
  const warnings = [];
  const warn = (row, text) => warnings.push({ row, text });
  const rows = (table || []).map((r) => (r || []).map((c) => (typeof c === 'string' ? c.trim() : c)));
  const first = rows.findIndex((r) => r.some((c) => c !== '' && c != null));
  if (first < 0) return { layout: null, recipes: [], warnings, error: 'empty' };
  // La fila de cabeceras no tiene por qué ser la primera: muchos Excel llevan un título o notas encima.
  let hi = first;
  for (let i = first; i < Math.min(rows.length, first + 30); i++) {
    const ks = new Set(rows[i].map(classify).filter(Boolean));
    if (ks.has('recipe') && ['ingredient', 'kcal', 'kcal100'].some((k) => ks.has(k))) { hi = i; break; }
  }
  const col = {};
  rows[hi].forEach((h, i) => { const k = classify(h); if (k && col[k] === undefined) col[k] = i; });
  const kcalCol = col.kcal100 ?? col.kcal, pCol = col.p100 ?? col.p, cCol = col.c100 ?? col.c, fCol = col.f100 ?? col.f;
  const any100 = [col.kcal100, col.p100, col.c100, col.f100].some((x) => x !== undefined);
  let layout = null;
  if (col.ingredient !== undefined) layout = 'items';
  else if (kcalCol !== undefined) layout = 'recipes';
  if (col.recipe === undefined || !layout) return { layout: null, recipes: [], warnings, error: 'headers' };

  const byName = new Map();
  const order = [];
  const get = (name, slots) => {
    const key = strip(name);
    if (!byName.has(key)) {
      if (order.length >= MAX_RECIPES) return null;
      byName.set(key, { name: name.slice(0, 80), meal_types: new Set(), items: [] });
      order.push(key);
    }
    const r = byName.get(key);
    slots.forEach((s) => r.meal_types.add(s));
    return r;
  };
  const cell = (r, i) => (i === undefined ? null : r[i]);
  const seen = new Map(); // nombre -> fila donde aparece
  const servingsOf = new Map(); // nombre -> raciones que da la receta (columna opcional)
  let curName = '', curSlots = [];
  for (let n = hi + 1; n < rows.length; n++) {
    const r = rows[n];
    if (!r.some((c) => c !== '' && c != null)) continue;
    const line = n + 1;
    const nameCell = String(cell(r, col.recipe) ?? '').trim();
    if (nameCell) {
      curName = nameCell;
      if (!seen.has(strip(nameCell))) seen.set(strip(nameCell), { name: nameCell, line });
      const sl = parseSlots(cell(r, col.types));
      curSlots = sl.slots;
      if (sl.bad.length) warn(line, `tipo "${sl.bad.join(', ')}" no reconocido (usa desayuno, comida, merienda, cena, primer plato o guarnición)`);
    } else if (col.types !== undefined) {
      const sl = parseSlots(cell(r, col.types));
      if (sl.slots.length) curSlots = [...new Set([...curSlots, ...sl.slots])];
    }
    if (!curName) { warn(line, 'fila sin nombre de receta'); continue; }
    const rawServ = cell(r, col.servings);
    if (rawServ !== undefined && rawServ !== null && rawServ !== '') {
      const sv = parseNumber(rawServ);
      if (sv !== null && sv > 0 && sv <= 50) servingsOf.set(strip(curName), sv);
      else warn(line, `"${curName}": raciones no válidas ("${rawServ}"), se usa 1`);
    }
    let k = parseNumber(cell(r, kcalCol)), p = parseNumber(cell(r, pCol)), c = parseNumber(cell(r, cCol)), f = parseNumber(cell(r, fCol));
    if (layout === 'items') {
      const ing = String(cell(r, col.ingredient) ?? '').trim();
      if (!ing) continue; // fila solo con el nombre de la receta
      const g = parseNumber(cell(r, col.grams));
      if (g === null || g <= 0) { warn(line, `"${ing}": faltan los gramos`); continue; }
      // Si alguna columna dice "100 g", todas van por 100 g. Si ninguna lo dice (kcal, proteína...), son el total de ESA fila: los gramos que lleva la receta.
      const per = (v) => (v === null || any100 ? v : (v / g) * 100);
      k = per(k); p = per(p); c = per(c); f = per(f);
      if (k === null && (p !== null || c !== null || f !== null)) k = 4 * (p || 0) + 4 * (c || 0) + 9 * (f || 0);
      const missing = k === null; // sin kcal ni macros: se importa igualmente y se puede completar después
      if (missing) { k = 0; p = 0; c = 0; f = 0; }
      if (k > 950) warn(line, `"${ing}": ${Math.round(k)} kcal/100 g parece demasiado (¿son kcal de toda la ración?)`);
      const rec = get(curName, curSlots);
      if (!rec) { warn(line, 'demasiadas recetas (máximo 500)'); break; }
      if (rec.items.length >= MAX_ITEMS) { warn(line, `"${curName}": máximo ${MAX_ITEMS} ingredientes`); continue; }
      rec.items.push({ name: ing.slice(0, 120), grams: r1(g), kcal100: r1(k), p100: r1(p || 0), c100: r1(c || 0), f100: r1(f || 0), ...(missing ? { missing: true } : {}) });
    } else {
      if (k === null && (p !== null || c !== null || f !== null)) k = 4 * (p || 0) + 4 * (c || 0) + 9 * (f || 0);
      if (k === null) { warn(line, `"${curName}": faltan las kcal`); continue; }
      const rec = get(curName, curSlots);
      if (!rec) { warn(line, 'demasiadas recetas (máximo 500)'); break; }
      if (rec.items.length) { warn(line, `"${curName}" aparece repetida: se usa la última fila`); rec.items = []; }
      // Una ración = 100 "g" con los valores de la ración, así el cálculo de raciones funciona igual.
      rec.items.push({ name: curName.slice(0, 120), grams: 100, kcal100: r1(k), p100: r1(p || 0), c100: r1(c || 0), f100: r1(f || 0) });
    }
  }
  const recipes = order.map((key) => byName.get(key)).filter((x) => x.items.length)
    .map((x) => ({ name: x.name, meal_types: MEAL_SLOTS.filter((s) => x.meal_types.has(s)), servings: servingsOf.get(strip(x.name)) ?? 1, items: x.items }));
  for (const [key, v] of seen) if (!(byName.get(key) && byName.get(key).items.length)) warn(v.line, `"${v.name}": sin ingredientes válidos, no se importa`);
  return { layout, recipes, warnings, error: recipes.length ? null : 'none' };
}

// Plantilla descargable (separador ";" y decimales con coma: se abre bien en Excel en español).
export function csvTemplate() {
  const L = [
    'receta;tipo;raciones;ingrediente;gramos;kcal_100g;proteinas_100g;hidratos_100g;grasas_100g',
    'Pollo con arroz;comida/cena;1;Pechuga de pollo;150;110;23;0;1,5',
    'Pollo con arroz;;;Arroz blanco cocido;200;130;2,7;28;0,3',
    'Pollo con arroz;;;Aceite de oliva;10;884;0;0;100',
    'Tostada con aguacate;desayuno;1;Pan integral;60;250;9;45;3',
    'Tostada con aguacate;;;Aguacate;50;160;2;9;15',
    'Yogur con nueces;merienda;1;Yogur natural;125;60;4,5;5;3',
    'Yogur con nueces;;;Nueces;15;654;15;14;65',
  ];
  return '﻿' + L.join('\r\n') + '\r\n';
}
