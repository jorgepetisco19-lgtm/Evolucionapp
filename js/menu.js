// Sugerencia de menú del día: reparte las kcal que te quedan entre las comidas que faltan y propone una receta tuya
// (con la ración ajustada) para cada una. Funciones puras; la pantalla está en views/food.js.
import { totals } from './off.js';

export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
// Etiquetas que se pueden poner a una receta: las 4 tomas y "guarnición" (acompañamiento: patata, boniato, arroz...).
export const TAGS = [...SLOTS, 'side'];
// La guarnición solo se añade a comida y cena. Entra entera (1 ración) y el plato principal se ajusta a lo que queda.
export const SIDE_SLOTS = ['lunch', 'dinner'];
const SIDE_MAX = 0.5;   // una guarnición no puede pasar del 50 % de las kcal de la toma
const SIDE_IDEAL = 0.2; // lo que más se busca: que sea ~20 % de la toma
// Reparto habitual del día; si ya has comido algo en una toma, se reparte lo que queda entre las demás.
export const WEIGHTS = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };
export const FACTORS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]; // raciones permitidas (pasos de 0,25 para que no salgan cantidades absurdas)
const OPTIONS_PER_SLOT = 10;

export const isSide = (r) => !!(r.meal_types && r.meal_types.includes('side'));
// Tomas en las que puede ir como plato principal. Sin etiquetas = comida o cena (lo más habitual);
// una receta que solo es guarnición no sale como plato principal.
export const slotsOf = (r) => {
  const t = (r.meal_types || []).filter((x) => x !== 'side');
  return t.length ? t : isSide(r) ? [] : ['lunch', 'dinner'];
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

// Guarniciones para una toma (ids), de más a menos cercanas a ~20 % del objetivo; las que pasan del 50 % se descartan.
export function rankSides(recipes, target, rng = Math.random) {
  const scored = [];
  for (const r of recipes) {
    if (!isSide(r)) continue;
    const base = baseKcal(r);
    if (!(base > 0) || base > SIDE_MAX * target) continue;
    scored.push({ id: r.id, score: Math.abs(base - SIDE_IDEAL * target) / Math.max(target, 1) });
  }
  scored.sort((a, b) => a.score - b.score);
  if (!scored.length) return [];
  const top = scored.filter((s) => s.score <= scored[0].score + 0.08);
  return [...shuffle(top, rng), ...scored.slice(top.length)].slice(0, OPTIONS_PER_SLOT).map((s) => s.id);
}

/**
 * remaining: kcal que quedan por comer; openSlots: tomas sin registrar hoy.
 * Devuelve [{ slot, target, opts: [[id, ración]...], i: 0, f: null, sideOpts: [id...], si: 0 | -1 }] en el orden de SLOTS.
 * En comida y cena, si hay guarniciones, se elige primero la guarnición y el plato principal se ajusta al resto de kcal.
 */
export function suggest(recipes, remaining, openSlots, rng = Math.random) {
  const targets = splitTargets(remaining, openSlots);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const usedSides = new Set();
  const out = openSlots.map((slot) => {
    const target = targets[slot];
    const sideOpts = SIDE_SLOTS.includes(slot) ? rankSides(recipes, target, rng) : [];
    let si = sideOpts.findIndex((id) => !usedSides.has(id));
    if (si < 0 && sideOpts.length) si = 0;
    if (si >= 0) usedSides.add(sideOpts[si]);
    const sideId = si >= 0 ? sideOpts[si] : null;
    const rest = target - (sideId ? baseKcal(byId.get(sideId)) : 0);
    const opts = rankFor(recipes.filter((r) => r.id !== sideId), slot, rest, rng);
    // Sin plato principal no se propone guarnición suelta.
    return { slot, target: Math.round(target), opts, i: 0, f: null, sideOpts: opts.length ? sideOpts : [], si: opts.length ? si : -1 };
  });
  // Evitar la misma receta dos veces en el día, empezando por la toma con menos opciones.
  const used = new Set();
  [...out].sort((a, b) => a.opts.length - b.opts.length).forEach((s) => {
    if (!s.opts.length) return;
    const k = s.opts.findIndex(([id]) => !used.has(id) && id !== s.sideOpts[s.si]);
    s.i = k >= 0 ? k : 0;
    used.add(s.opts[s.i][0]);
  });
  return out.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
}

// Lo que se enseña de una toma: plato principal, ración y valores, y la guarnición si la hay (entera, sin escalar).
// Si la receta principal ya no existe, null. Con guarnición, la ración del principal se ajusta a lo que ella deja libre.
export function describe(slot, recipesById) {
  const opt = slot.opts[slot.i];
  if (!opt) return null;
  const recipe = recipesById.get(opt[0]);
  if (!recipe) return null;
  const sideId = slot.si >= 0 && slot.sideOpts ? slot.sideOpts[slot.si] : null;
  const sideRecipe = sideId ? recipesById.get(sideId) : null;
  const side = sideRecipe ? { recipe: sideRecipe, tt: totals(sideRecipe.items || [], 1) } : null;
  const factor = slot.f ?? (side ? bestFactor(baseKcal(recipe), (slot.target || 0) - side.tt.kcal) : opt[1]);
  const tt = totals(recipe.items || [], factor);
  const total = side
    ? { kcal: tt.kcal + side.tt.kcal, protein: tt.protein + side.tt.protein, carbs: tt.carbs + side.tt.carbs, fat: tt.fat + side.tt.fat }
    : tt;
  return { recipe, factor, tt, side, total };
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

// Datos para guardar la toma como comida registrada. Sin guarnición: la receta tal cual, con su ración.
// Con guarnición: una sola comida con los ingredientes de ambas ya en gramos (principal × ración + guarnición entera).
export function mealPayload(d) {
  if (!d.side) {
    return { name: d.recipe.name, recipe_id: d.recipe.id, factor: d.factor, items: d.recipe.items, kcal: d.tt.kcal, protein_g: d.tt.protein, carbs_g: d.tt.carbs, fat_g: d.tt.fat };
  }
  const items = [
    ...(d.recipe.items || []).map((it) => ({ ...it, grams: Math.round(Number(it.grams) * d.factor * 10) / 10 })),
    ...(d.side.recipe.items || []).map((it) => ({ ...it })),
  ];
  const tt = totals(items, 1);
  return { name: `${d.recipe.name} + ${d.side.recipe.name}`, recipe_id: null, factor: 1, items, kcal: tt.kcal, protein_g: tt.protein, carbs_g: tt.carbs, fat_g: tt.fat };
}
