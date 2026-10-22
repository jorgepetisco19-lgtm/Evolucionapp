// Completa kcal y macros de un ingrediente cuando no se conocen: primero la tabla propia (js/foods-db.js)
// y, si no está, Open Food Facts (mediana de los primeros resultados). Si no encuentra nada, no se inventa nada.
import { lookupFood, norm } from './foods-db.js';
import { searchFoods } from './off.js';

// Open Food Facts solo permite 10 búsquedas por minuto y por conexión (si te pasas, te bloquea): se va a un ritmo de una cada 6,5 s
// y, si responde con error, se espera y se reintenta poco a poco. Los valores se pueden cambiar en pruebas.
const gapMs = () => globalThis.__OFF_GAP_MS ?? 6500;
const backoffMs = () => globalThis.__OFF_BACKOFF_MS ?? 30000;
const sleep = (ms, signal) => new Promise((resolve) => {
  if (!(ms > 0) || (signal && signal.aborted)) return resolve();
  const timer = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});
export const OFF_GAP_MS = () => gapMs();

export const keyOf = (name) => norm(name).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const queryOf = (name) => String(name || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

// De entre los productos devueltos se toma el de kcal "del medio": así un paquete raro (patatas fritas buscando "patata") no desvirtúa el valor,
// y los cuatro valores salen de un mismo producto (coherentes entre sí).
export function pickMedian(foods) {
  const usable = foods.filter((f) => f.kcal100 > 0 && f.kcal100 <= 900).slice(0, 10).sort((a, b) => a.kcal100 - b.kcal100);
  if (!usable.length) return null;
  const mid = usable[Math.floor((usable.length - 1) / 2)];
  return { kcal100: mid.kcal100, p100: mid.p100, c100: mid.c100, f100: mid.f100, count: usable.length };
}

/**
 * Estima un ingrediente y dice cómo ha ido: state = 'mem' (tu memoria de ingredientes, js/ingredients.js) | 'db' (tabla propia) | 'off' (Open Food Facts) |
 * 'none' (Open Food Facts respondió pero no hay nada útil: no tiene sentido reintentar) | 'error' (sin conexión, límite, caído: sí se puede reintentar).
 * `memory`: mapa clave -> ingrediente recordado (se consulta primero). `search` se puede sustituir en pruebas.
 */
export async function estimateDetailed(name, { search = searchFoods, memory } = {}) {
  const mem = memory && memory.get(keyOf(name));
  if (mem) return { state: 'mem', est: { kcal100: mem.kcal100, p100: mem.p100, c100: mem.c100, f100: mem.f100, source: 'mem', note: mem.source } };
  const hit = lookupFood(name);
  if (hit) return { state: 'db', est: { kcal100: hit.kcal100, p100: hit.p100, c100: hit.c100, f100: hit.f100, source: 'db', note: hit.key } };
  const q = queryOf(name);
  if (q.length < 2) return { state: 'none', est: null };
  try {
    const m = pickMedian(await search(q));
    if (m) return { state: 'off', est: { kcal100: m.kcal100, p100: m.p100, c100: m.c100, f100: m.f100, source: 'off', note: String(m.count) } };
    return { state: 'none', est: null };
  } catch (error) {
    return { state: 'error', est: null, error };
  }
}

/** Devuelve { kcal100, p100, c100, f100, source: 'mem' | 'db' | 'off', note } o null (sin lanzar nunca error). */
export async function estimateOne(name, opts) {
  return (await estimateDetailed(name, opts)).est;
}

/**
 * items: ingredientes con `missing: true` se completan (se modifican en el sitio, con `est: 'mem' | 'db' | 'off'`).
 * Cada nombre distinto se busca una sola vez. Primero salen los de tu memoria y la tabla propia (instantáneo) y luego los de Open Food Facts,
 * a su ritmo permitido, con hasta 3 intentos por nombre si hay errores. Si dos nombres seguidos fallan del todo, se para
 * (el servicio está caído o te ha limitado) para no insistir. `skip`: nombres que Open Food Facts ya dijo que no tiene (no se repiten).
 * `signal`: para cancelar. `memory`: tu memoria de ingredientes. `onFound(nombre, est)`: se llama con cada ingrediente hallado en Open Food Facts
 * (para guardarlo en la memoria). onProgress(hechos, total, { remoteLeft, waiting }).
 * Devuelve { mem, db, off, none, failed, left, stopped, noResult }: ingredientes distintos de cada tipo; `left` = los que quedan por consultar
 * por el tope de `cap`; `stopped` = false | 'cancel' | 'blocked'; `noResult` = nombres sin resultado (para pasarlos como `skip` la próxima vez).
 */
export async function completeItems(items, { onProgress, search, cap = 60, skip = new Set(), signal, memory, onFound } = {}) {
  const groups = new Map();
  for (const it of items) {
    if (!it.missing) continue;
    const k = keyOf(it.name);
    if (skip.has(k)) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const local = [], remote = [];
  for (const k of groups.keys()) ((memory && memory.has(k)) || lookupFood(groups.get(k)[0].name) ? local : remote).push(k);
  const todo = remote.slice(0, cap);
  const names = [...local, ...todo];
  const out = { mem: 0, db: 0, off: 0, none: 0, failed: 0, left: 0, stopped: false, noResult: [] };
  const remoteSet = new Set(todo);
  let done = 0, lastOff = 0, strikes = 0, remoteLeft = todo.length;
  const report = (extra = {}) => { if (onProgress) onProgress(done, names.length, { remoteLeft, ...extra }); };
  report(); // para enseñar enseguida cuántos hay y el tiempo aproximado
  for (const k of names) {
    if (signal && signal.aborted) { out.stopped = 'cancel'; break; }
    const list = groups.get(k);
    const isRemote = remoteSet.has(k);
    let r = null;
    for (let tries = 1; tries <= 3; tries++) {
      if (isRemote) {
        const wait = lastOff + gapMs() - Date.now();
        if (wait > 0) await sleep(wait, signal);
        if (signal && signal.aborted) break;
        lastOff = Date.now();
      }
      r = await estimateDetailed(list[0].name, { search, memory });
      if (r.state !== 'error' || tries === 3) break;
      report({ waiting: backoffMs() });
      await sleep(backoffMs(), signal);
      if (signal && signal.aborted) break;
    }
    if (!r || (signal && signal.aborted && (!r || r.state === 'error'))) { out.stopped = 'cancel'; break; }
    if (r.est) {
      for (const it of list) {
        it.kcal100 = r.est.kcal100; it.p100 = r.est.p100; it.c100 = r.est.c100; it.f100 = r.est.f100;
        it.est = r.est.source; delete it.missing;
      }
      out[r.est.source]++;
      if (r.est.source === 'off' && onFound) { try { onFound(list[0].name, r.est); } catch (e) { /* guardar en la memoria nunca debe parar la tanda */ } }
      strikes = 0;
    } else if (r.state === 'none') { out.none++; out.noResult.push(k); strikes = 0; }
    else { out.failed++; strikes++; }
    if (isRemote) remoteLeft--;
    done++;
    report();
    if (strikes >= 2) { out.stopped = 'blocked'; break; }
  }
  out.left = remote.length - (todo.length - remoteLeft); // por consultar todavía (tope de la tanda o parada antes de tiempo)
  return out;
}
