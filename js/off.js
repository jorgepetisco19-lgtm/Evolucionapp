// Búsqueda de alimentos en Open Food Facts (base de datos libre y gratuita, sin clave).
// Devuelve valores por 100 g: { name, kcal100, p100, c100, f100 }.
const ENDPOINT = 'https://world.openfoodfacts.org/cgi/search.pl';

const n = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const r1 = (x) => Math.round(x * 10) / 10;

export function toFood(p) {
  const nu = (p && p.nutriments) || {};
  const name = String(p.product_name_es || p.product_name || '').trim();
  if (!name) return null;
  let kcal = n(nu['energy-kcal_100g']) ?? n(nu['energy-kcal']);
  if (kcal === null) {
    const kj = n(nu['energy-kj_100g']) ?? n(nu['energy_100g']); // la energía "a secas" viene en kJ
    if (kj !== null) kcal = kj / 4.184;
  }
  if (kcal === null) return null; // sin energía no sirve para calcular
  const brand = String(p.brands || '').split(',')[0].trim();
  return {
    code: p.code || '',
    name: brand ? `${name} (${brand})` : name,
    kcal100: Math.round(kcal),
    p100: r1(n(nu.proteins_100g) ?? 0),
    c100: r1(n(nu.carbohydrates_100g) ?? 0),
    f100: r1(n(nu.fat_100g) ?? 0),
  };
}

// Las búsquedas que han ido bien se recuerdan 10 minutos: repetir la misma no gasta otra de las 10 por minuto que permite Open Food Facts.
const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

export async function searchFoods(query, { signal } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const ck = q.toLowerCase();
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.foods;
  const params = new URLSearchParams({
    search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '20',
    sort_by: 'unique_scans_n', fields: 'code,product_name,product_name_es,brands,nutriments', lc: 'es',
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  if (signal) signal.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
    let data;
    try { data = await res.json(); } catch { throw new Error('Open Food Facts: respuesta no válida (suele ser una página de "servicio saturado")'); }
    const foods = (data.products || []).map(toFood).filter(Boolean);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    cache.set(ck, { at: Date.now(), foods });
    return foods;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- cálculo de macros ----------
// item: { name, grams, kcal100, p100, c100, f100 }
export function itemTotals(item) {
  const k = (Number(item.grams) || 0) / 100;
  return {
    kcal: (Number(item.kcal100) || 0) * k,
    protein: (Number(item.p100) || 0) * k,
    carbs: (Number(item.c100) || 0) * k,
    fat: (Number(item.f100) || 0) * k,
  };
}
export function totals(items, factor = 1) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const it of items) {
    const x = itemTotals(it);
    t.kcal += x.kcal; t.protein += x.protein; t.carbs += x.carbs; t.fat += x.fat;
  }
  const f = Number(factor) || 0;
  return { kcal: r1(t.kcal * f), protein: r1(t.protein * f), carbs: r1(t.carbs * f), fat: r1(t.fat * f) };
}
