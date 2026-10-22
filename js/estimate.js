// Completa kcal y macros de un ingrediente cuando no se conocen: primero la tabla propia (js/foods-db.js)
// y, si no está, Open Food Facts (mediana de los primeros resultados). Si no encuentra nada, no se inventa nada.
import { lookupFood, norm } from './foods-db.js';
import { searchFoods } from './off.js';

const keyOf = (name) => norm(name).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const queryOf = (name) => String(name || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

// De entre los productos devueltos se toma el de kcal "del medio": así un paquete raro (patatas fritas buscando "patata") no desvirtúa el valor,
// y los cuatro valores salen de un mismo producto (coherentes entre sí).
export function pickMedian(foods) {
  const usable = foods.filter((f) => f.kcal100 > 0 && f.kcal100 <= 900).slice(0, 10).sort((a, b) => a.kcal100 - b.kcal100);
  if (!usable.length) return null;
  const mid = usable[Math.floor((usable.length - 1) / 2)];
  return { kcal100: mid.kcal100, p100: mid.p100, c100: mid.c100, f100: mid.f100, count: usable.length };
}

/** Devuelve { kcal100, p100, c100, f100, source: 'db' | 'off', note } o null. `search` se puede sustituir en pruebas. */
export async function estimateOne(name, { search = searchFoods } = {}) {
  const hit = lookupFood(name);
  if (hit) return { kcal100: hit.kcal100, p100: hit.p100, c100: hit.c100, f100: hit.f100, source: 'db', note: hit.key };
  const q = queryOf(name);
  if (q.length < 2) return null;
  try {
    const m = pickMedian(await search(q));
    if (m) return { kcal100: m.kcal100, p100: m.p100, c100: m.c100, f100: m.f100, source: 'off', note: String(m.count) };
  } catch { /* sin conexión o servicio caído: se queda sin estimar */ }
  return null;
}

/**
 * items: ingredientes con `missing: true` se completan (se modifican en el sitio, con `est: 'db' | 'off'`).
 * Cada nombre distinto se busca una sola vez. onProgress(hechos, total).
 * Devuelve { db, off, none } (cuántos ingredientes distintos de cada tipo).
 */
export async function completeItems(items, { onProgress, search, concurrency = 3, cap = 60 } = {}) {
  const groups = new Map();
  for (const it of items) {
    if (!it.missing) continue;
    const k = keyOf(it.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const names = [...groups.keys()].slice(0, cap);
  const out = { db: 0, off: 0, none: 0 };
  let done = 0, next = 0;
  const worker = async () => {
    while (next < names.length) {
      const k = names[next++];
      const list = groups.get(k);
      const est = await estimateOne(list[0].name, { search });
      if (est) {
        for (const it of list) {
          it.kcal100 = est.kcal100; it.p100 = est.p100; it.c100 = est.c100; it.f100 = est.f100;
          it.est = est.source; delete it.missing;
        }
        out[est.source]++;
      } else out.none++;
      done++;
      if (onProgress) onProgress(done, names.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, names.length) }, worker));
  return out;
}
