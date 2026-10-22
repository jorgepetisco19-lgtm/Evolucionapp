// Memoria de ingredientes (v11): lo que ya has completado (con Open Food Facts o escrito a mano) se guarda en tu cuenta
// y se consulta antes que Open Food Facts, así solo esperas la primera vez. Si la tabla aún no existe (falta ejecutar 06-ingredientes.sql)
// o hay un error, la app sigue funcionando igual, solo que sin memoria.
import { listAll, upsertMany, session } from './db.js';
import { keyOf } from './estimate.js';
import { queryTokens, matchScore } from './foods-db.js';

let cache = null; // Map clave -> { key, name, kcal100, p100, c100, f100, source }
let owner = null;
let unavailable = false;

/** ¿Está la tabla disponible? (false si falló la última carga o guardado por falta de la tabla). */
export const memoryAvailable = () => !unavailable;

export function clearMemory() { cache = null; owner = null; unavailable = false; }

/** Mapa clave -> ingrediente recordado. Nunca lanza error: si algo falla, devuelve un mapa vacío. */
export async function loadMemory({ force = false } = {}) {
  const uid = session.user && session.user.id;
  if (cache && owner === uid && !force) return cache;
  try {
    const rows = await listAll('ingredients', { order: 'key', asc: true, limit: 5000 });
    cache = new Map(rows.map((r) => [r.key, { key: r.key, name: r.name, kcal100: +r.kcal100, p100: +r.p100, c100: +r.c100, f100: +r.f100, source: r.source }]));
    unavailable = false;
  } catch (e) {
    cache = new Map();
    unavailable = true;
  }
  owner = uid;
  return cache;
}

const num = (v) => (Number.isFinite(+v) ? +v : NaN);
const round2 = (v) => Math.round(v * 100) / 100;

/** Normaliza y valida una entrada; devuelve la fila o null si no vale (no se guarda nada raro). */
export function toEntry(name, v, source) {
  const key = keyOf(name);
  const kcal = num(v && v.kcal100), p = num(v && v.p100), c = num(v && v.c100), f = num(v && v.f100);
  if (key.length < 2 || key.length > 120) return null;
  if (!(kcal > 0 && kcal <= 900)) return null;
  for (const m of [p, c, f]) if (!(m >= 0 && m <= 100)) return null;
  return { key, name: String(name).trim().slice(0, 120), kcal100: round2(kcal), p100: round2(p), c100: round2(c), f100: round2(f), source: source === 'off' ? 'off' : 'manual' };
}

/**
 * Guarda (o actualiza) ingredientes: entries = [{ name, kcal100, p100, c100, f100, source }]. Devuelve cuántos se guardaron.
 * Nunca lanza error. Lo escrito a mano manda sobre lo de Open Food Facts de la misma clave dentro de la misma tanda.
 */
export async function remember(entries) {
  const byKey = new Map();
  for (const e of entries) {
    const row = toEntry(e.name, e, e.source);
    if (!row) continue;
    const prev = byKey.get(row.key);
    if (!prev || row.source === 'manual' || prev.source !== 'manual') byKey.set(row.key, row);
  }
  const rows = [...byKey.values()];
  if (!rows.length || !session.user) return 0;
  try {
    await upsertMany('ingredients', rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), 'user_id,key');
    unavailable = false;
    if (cache && owner === session.user.id) for (const r of rows) cache.set(r.key, r); // si aún no se ha cargado, se leerá completo la próxima vez
    return rows.length;
  } catch (e) {
    unavailable = true;
    return 0;
  }
}

/** Busca en tu memoria por lo que se escribe en el buscador. Devuelve [{ name, kcal100, p100, c100, f100, src: 'mem', memSrc }], lo más parecido primero. */
export function searchMemory(memory, query, limit = 5) {
  const qt = queryTokens(query);
  if (!qt.length || !memory) return [];
  const found = [];
  for (const m of memory.values()) {
    const sc = matchScore(qt, m.name);
    if (sc !== null) found.push({ sc, name: m.name, kcal100: m.kcal100, p100: m.p100, c100: m.c100, f100: m.f100, src: 'mem', memSrc: m.source });
  }
  return found.sort((a, b) => a.sc - b.sc || a.name.length - b.name.length).slice(0, limit).map(({ sc: _s, ...r }) => r);
}
