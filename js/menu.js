// Sugerencia de menú del día: reparte las kcal que te quedan entre las comidas que faltan y propone una receta tuya
// (con la ración ajustada) para cada una. Funciones puras; la pantalla está en views/food.js.
import { totals } from './off.js';

export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
// Etiquetas que se pueden poner a una receta: las 4 tomas, "primer plato" (crema, sopa, ensalada...) y "guarnición" (patata, boniato, arroz...).
export const TAGS = [...SLOTS, 'starter', 'side'];
// El primer plato y la guarnición solo se añaden a comida y cena. Entran enteros (1 ración) y el plato principal se ajusta a lo que queda.
export const SIDE_SLOTS = ['lunch', 'dinner'];
export const STARTER_SLOTS = ['lunch', 'dinner'];
export const STARTER_DEFAULT = ['lunch']; // el primer plato se propone de entrada solo en la comida; en la cena se puede poner con un botón
const SIDE_MAX = 0.5;      // una guarnición no puede pasar del 50 % de las kcal de la toma
const SIDE_IDEAL = 0.2;    // lo que más se busca: que sea ~20 % de la toma
const STARTER_MAX = 0.4;   // un primer plato, como mucho el 40 %
const STARTER_IDEAL = 0.25;
const EXTRAS_MAX = 0.65;   // primer plato + guarnición juntos, como mucho el 65 %; el principal necesita su sitio
// Reparto habitual del día; si ya has comido algo en una toma, se reparte lo que queda entre las demás.
export const WEIGHTS = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };
export const FACTORS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]; // raciones permitidas (pasos de 0,25 para que no salgan cantidades absurdas)
const OPTIONS_PER_SLOT = 10;

export const isSide = (r) => !!(r.meal_types && r.meal_types.includes('side'));
export const isStarter = (r) => !!(r.meal_types && r.meal_types.includes('starter'));
// Tomas en las que puede ir como plato principal. Sin etiquetas = comida o cena (lo más habitual);
// una receta que solo es guarnición o primer plato no sale como principal. Si además lleva una toma
// (p. ej. crema = primer plato + cena), en esa toma sí puede ser el plato único.
export const slotsOf = (r) => {
  const t = (r.meal_types || []).filter((x) => x !== 'side' && x !== 'starter');
  return t.length ? t : isSide(r) || isStarter(r) ? [] : ['lunch', 'dinner'];
};

export function splitTargets(remaining, openSlots) {
  const w = openSlots.reduce((s, k) => s + WEIGHTS[k], 0);
  return Object.fromEntries(openSlots.map((k) => [k, w ? (remaining * WEIGHTS[k]) / w : 0]));
}

function shuffle(a, rng) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

const baseKcal = (r) => totals(r.items || [], 1).kcal;

function fit(base, target) {
  let best = null;
  for (const f of FACTORS) {
    const score = Math.abs(base * f - target) / Math.max(target, 1) + 0.03 * Math.abs(f - 1);
    if (!best || score < best.score) best = { f, score };
  }
  return best;
}
export const bestFactor = (base, target) => fit(base, target).f;

// Recetas aptas para la toma, ordenadas de más a menos cercanas al objetivo de kcal, con su mejor ración.
export function rankFor(recipes, slot, target, rng = Math.random) {
  const scored = [];
  for (const r of recipes) {
    if (!slotsOf(r).includes(slot)) continue;
    const base = baseKcal(r);
    if (!(base > 0)) continue;
    const best = fit(base, target);
    scored.push({ id: r.id, f: best.f, score: best.score });
  }
  scored.sort((a, b) => a.score - b.score);
  if (!scored.length) return [];
  // Entre las que quedan casi igual de bien, se baraja para no proponer siempre lo mismo.
  const top = scored.filter((s) => s.score <= scored[0].score + 0.1);
  return [...shuffle(top, rng), ...scored.slice(top.length)].slice(0, OPTIONS_PER_SLOT).map((s) => [s.id, s.f]);
}

// Recetas con una etiqueta extra (guarnición o primer plato) para una toma (ids): las más cercanas a su kcal ideal,
// descartando las que pasan del máximo. Sin etiquetar nada, la lista queda vacía.
function rankExtras(recipes, isTag, target, maxKcal, ideal, rng) {
  const scored = [];
  for (const r of recipes) {
    if (!isTag(r)) continue;
    const base = baseKcal(r);
    if (!(base > 0) || base > maxKcal) continue;
    scored.push({ id: r.id, score: Math.abs(base - ideal * target) / Math.max(target, 1) });
  }
  scored.sort((a, b) => a.score - b.score);
  if (!scored.length) return [];
  const top = scored.filter((x) => x.score <= scored[0].score + 0.08);
  return [...shuffle(top, rng), ...scored.slice(top.length)].slice(0, OPTIONS_PER_SLOT).map((x) => x.id);
}
export const rankSides = (recipes, target, rng = Math.random, maxKcal = SIDE_MAX * target) => rankExtras(recipes, isSide, target, maxKcal, SIDE_IDEAL, rng);
export const rankStarters = (recipes, target, rng = Math.random) => rankExtras(recipes, isStarter, target, STARTER_MAX * target, STARTER_IDEAL, rng);

/**
 * remaining: kcal que quedan por comer; openSlots: tomas sin registrar hoy.
 * Devuelve [{ slot, target, opts: [[id, ración]...], i: 0, f: null, starterOpts: [id...], ti: 0 | -1, sideOpts: [id...], si: 0 | -1 }]
 * en el orden de SLOTS. En comida y cena, si hay primeros o guarniciones, se eligen primero (enteros) y el plato principal
 * se ajusta al resto de kcal. ti / si = -1 significa "sin primer plato" / "sin guarnición" (se pueden poner con un botón).
 */
export function suggest(recipes, remaining, openSlots, rng = Math.random) {
  const targets = splitTargets(remaining, openSlots);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const usedSides = new Set(), usedStarters = new Set();
  const out = openSlots.map((slot) => {
    const target = targets[slot];
    const starterOpts = STARTER_SLOTS.includes(slot) ? rankStarters(recipes, target, rng) : [];
    let ti = -1;
    if (starterOpts.length && STARTER_DEFAULT.includes(slot)) {
      ti = starterOpts.findIndex((id) => !usedStarters.has(id));
      if (ti < 0) ti = 0;
      usedStarters.add(starterOpts[ti]);
    }
    const starterId = ti >= 0 ? starterOpts[ti] : null;
    const starterK = starterId ? baseKcal(byId.get(starterId)) : 0;
    const pool = recipes.filter((r) => r.id !== starterId);
    const sideCap = Math.min(SIDE_MAX * target, EXTRAS_MAX * target - starterK);
    const sideOpts = SIDE_SLOTS.includes(slot) && sideCap > 0 ? rankSides(pool, target, rng, sideCap) : [];
    let si = sideOpts.findIndex((id) => !usedSides.has(id));
    if (si < 0 && sideOpts.length) si = 0;
    if (si >= 0) usedSides.add(sideOpts[si]);
    const sideId = si >= 0 ? sideOpts[si] : null;
    const rest = target - starterK - (sideId ? baseKcal(byId.get(sideId)) : 0);
    const opts = rankFor(recipes.filter((r) => r.id !== starterId && r.id !== sideId), slot, rest, rng);
    // Sin plato principal no se proponen primeros ni guarniciones sueltos.
    const has = opts.length > 0;
    return { slot, target: Math.round(target), opts, i: 0, f: null,
      starterOpts: has ? starterOpts : [], ti: has ? ti : -1, sideOpts: has ? sideOpts : [], si: has ? si : -1 };
  });
  // Evitar la misma receta dos veces en el día, empezando por la toma con menos opciones.
  const used = new Set();
  [...out].sort((a, b) => a.opts.length - b.opts.length).forEach((s) => {
    if (!s.opts.length) return;
    const k = s.opts.findIndex(([id]) => !used.has(id) && id !== s.sideOpts[s.si] && id !== s.starterOpts[s.ti]);
    s.i = k >= 0 ? k : 0;
    used.add(s.opts[s.i][0]);
  });
  return out.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
}

// Lo que se enseña de una toma: plato principal con su ración y valores, más el primer plato y la guarnición si los hay
// (enteros, sin escalar). Si la receta principal ya no existe, null. Con primero o guarnición, la ración del principal
// se ajusta a lo que ellos dejan libre.
export function describe(slot, recipesById) {
  const opt = slot.opts[slot.i];
  if (!opt) return null;
  const recipe = recipesById.get(opt[0]);
  if (!recipe) return null;
  const extra = (ids, idx) => {
    const r = idx >= 0 && ids ? recipesById.get(ids[idx]) : null;
    return r ? { recipe: r, tt: totals(r.items || [], 1) } : null;
  };
  const starter = extra(slot.starterOpts, slot.ti ?? -1);
  const side = extra(slot.sideOpts, slot.si ?? -1);
  const taken = (starter ? starter.tt.kcal : 0) + (side ? side.tt.kcal : 0);
  const factor = slot.f ?? (starter || side ? bestFactor(baseKcal(recipe), (slot.target || 0) - taken) : opt[1]);
  const tt = totals(recipe.items || [], factor);
  const total = { kcal: tt.kcal, protein: tt.protein, carbs: tt.carbs, fat: tt.fat };
  for (const x of [starter, side]) if (x) { total.kcal += x.tt.kcal; total.protein += x.tt.protein; total.carbs += x.tt.carbs; total.fat += x.tt.fat; }
  return { recipe, factor, tt, starter, side, total };
}

export function sumSlots(slots, recipesById) {
  const s = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const sl of slots) {
    const d = describe(sl, recipesById);
    if (!d) continue;
    s.kcal += d.total.kcal; s.protein += d.total.protein; s.carbs += d.total.carbs; s.fat += d.total.fat;
  }
  return s;
}

// Datos para guardar la toma como comida registrada. Solo el principal: la receta tal cual, con su ración.
// Con primer plato o guarnición: una sola comida con los ingredientes de todos ya en gramos
// (primero entero + principal × ración + guarnición entera) y el nombre "Primero + Principal + Guarnición".
export function mealPayload(d) {
  if (!d.side && !d.starter) {
    return { name: d.recipe.name, recipe_id: d.recipe.id, factor: d.factor, items: d.recipe.items, kcal: d.tt.kcal, protein_g: d.tt.protein, carbs_g: d.tt.carbs, fat_g: d.tt.fat };
  }
  const whole = (x) => (x ? (x.recipe.items || []).map((it) => ({ ...it })) : []);
  const items = [
    ...whole(d.starter),
    ...(d.recipe.items || []).map((it) => ({ ...it, grams: Math.round(Number(it.grams) * d.factor * 10) / 10 })),
    ...whole(d.side),
  ];
  const tt = totals(items, 1);
  const name = [d.starter && d.starter.recipe.name, d.recipe.name, d.side && d.side.recipe.name].filter(Boolean).join(' + ');
  return { name, recipe_id: null, factor: 1, items, kcal: tt.kcal, protein_g: tt.protein, carbs_g: tt.carbs, fat_g: tt.fat };
}
