// Sugerencia de menú del día: reparte las kcal que te quedan entre las comidas que faltan y propone una receta tuya
// (con la ración ajustada) para cada una. Funciones puras; la pantalla está en views/food.js.
import { totals } from './off.js';

export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
// Reparto habitual del día; si ya has comido algo en una toma, se reparte lo que queda entre las demás.
export const WEIGHTS = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };
export const FACTORS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]; // raciones permitidas (pasos de 0,25 para que no salgan cantidades absurdas)
const OPTIONS_PER_SLOT = 10;

// Una receta sin etiquetas se considera de comida o cena (lo más habitual).
export const slotsOf = (r) => (r.meal_types && r.meal_types.length ? r.meal_types : ['lunch', 'dinner']);

export function splitTargets(remaining, openSlots) {
  const w = openSlots.reduce((s, k) => s + WEIGHTS[k], 0);
  return Object.fromEntries(openSlots.map((k) => [k, w ? (remaining * WEIGHTS[k]) / w : 0]));
}

function shuffle(a, rng) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

// Recetas aptas para la toma, ordenadas de más a menos cercanas al objetivo de kcal, con su mejor ración.
export function rankFor(recipes, slot, target, rng = Math.random) {
  const scored = [];
  for (const r of recipes) {
    if (!slotsOf(r).includes(slot)) continue;
    const base = totals(r.items || [], 1).kcal;
    if (!(base > 0)) continue;
    let best = null;
    for (const f of FACTORS) {
      const score = Math.abs(base * f - target) / Math.max(target, 1) + 0.03 * Math.abs(f - 1);
      if (!best || score < best.score) best = { id: r.id, f, score };
    }
    scored.push(best);
  }
  scored.sort((a, b) => a.score - b.score);
  if (!scored.length) return [];
  // Entre las que quedan casi igual de bien, se baraja para no proponer siempre lo mismo.
  const top = scored.filter((s) => s.score <= scored[0].score + 0.1);
  return [...shuffle(top, rng), ...scored.slice(top.length)].slice(0, OPTIONS_PER_SLOT).map((s) => [s.id, s.f]);
}

/**
 * remaining: kcal que quedan por comer; openSlots: tomas sin registrar hoy.
 * Devuelve [{ slot, target, opts: [[id, ración]...], i: 0, f: null }] en el orden de SLOTS.
 */
export function suggest(recipes, remaining, openSlots, rng = Math.random) {
  const targets = splitTargets(remaining, openSlots);
  const out = openSlots.map((slot) => ({ slot, target: Math.round(targets[slot]), opts: rankFor(recipes, slot, targets[slot], rng), i: 0, f: null }));
  // Evitar la misma receta dos veces en el día, empezando por la toma con menos opciones.
  const used = new Set();
  [...out].sort((a, b) => a.opts.length - b.opts.length).forEach((s) => {
    if (!s.opts.length) return;
    const k = s.opts.findIndex(([id]) => !used.has(id));
    s.i = k >= 0 ? k : 0;
    used.add(s.opts[s.i][0]);
  });
  return out.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
}

// Lo que se enseña de una toma: receta, ración y valores. Si la receta ya no existe, null.
export function describe(slot, recipesById) {
  const opt = slot.opts[slot.i];
  if (!opt) return null;
  const recipe = recipesById.get(opt[0]);
  if (!recipe) return null;
  const factor = slot.f ?? opt[1];
  return { recipe, factor, tt: totals(recipe.items || [], factor) };
}

export function sumSlots(slots, recipesById) {
  const s = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const sl of slots) {
    const d = describe(sl, recipesById);
    if (!d) continue;
    s.kcal += d.tt.kcal; s.protein += d.tt.protein; s.carbs += d.tt.carbs; s.fat += d.tt.fat;
  }
  return s;
}
