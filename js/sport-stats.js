// Cuentas de la pestaña Resumen de Deporte (v14). Funciones puras: reciben la lista de entrenos y devuelven números.
// Una «semana» va de lunes a domingo. Todo en fechas locales 'YYYY-MM-DD'.
import { parseDate, addDays, fmtDate, weekdayIndex } from './util.js';

export const DEFAULT_GOAL = 3;
export const MAX_GOAL = 14;
export const METRICS = ['count', 'minutes', 'km', 'kcal'];

const FIELD = { minutes: 'duration_min', km: 'distance_km', kcal: 'calories_kcal' };
/** Valor de un entreno para una métrica (null si no tiene ese dato). 'count' siempre vale 1. */
export function valueOf(w, metric) {
  if (metric === 'count') return 1;
  const v = w[FIELD[metric]];
  return v == null || v === '' ? null : Number(v);
}

export const weekStart = (d) => addDays(d, -weekdayIndex(d));
export const monthKey = (d) => d.slice(0, 7);

/** Cuántos entrenos hay en cada semana: { 'lunes YYYY-MM-DD': n }. */
export function weeklyCounts(workouts) {
  const out = {};
  for (const w of workouts) { const k = weekStart(w.date); out[k] = (out[k] || 0) + 1; }
  return out;
}

/**
 * Racha de semanas seguidas con el objetivo cumplido.
 * La semana en curso no rompe la racha mientras no acabe: si aún no llegas al objetivo, se cuenta hasta la anterior.
 * Se calcula con el objetivo ACTUAL para todas las semanas.
 */
export function streaks(workouts, goal, today) {
  const g = Math.max(1, Number(goal) || DEFAULT_GOAL);
  const counts = weeklyCounts(workouts);
  const cur = weekStart(today);
  const met = (k) => (counts[k] || 0) >= g;
  let start = met(cur) ? cur : addDays(cur, -7);
  let current = 0;
  while (met(start)) { current++; start = addDays(start, -7); }
  // Mejor racha: recorrer las semanas con entrenos de la más antigua a la más reciente.
  const keys = Object.keys(counts).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    if (!met(k)) { run = 0; prev = null; continue; }
    run = prev && addDays(prev, 7) === k ? run + 1 : 1;
    prev = k;
    if (run > best) best = run;
  }
  const done = counts[cur] || 0;
  return { current, best: Math.max(best, current), thisWeek: { start: cur, count: done, goal: g, met: done >= g }, anyMet: keys.some(met) };
}

/** Medallas calculadas con lo que ya hay guardado (sin tabla propia). */
export function medals(workouts, goal, today) {
  const total = workouts.length;
  const s = streaks(workouts, goal, today);
  const list = [
    { id: 'first', icon: '🏁', cur: total, target: 1 },
    { id: 'w10', icon: '💪', cur: total, target: 10 },
    { id: 'w50', icon: '🔥', cur: total, target: 50 },
    { id: 'w100', icon: '🏆', cur: total, target: 100 },
    { id: 'goal', icon: '🎯', cur: s.anyMet ? 1 : 0, target: 1 },
    { id: 's4', icon: '📅', cur: s.best, target: 4 },
    { id: 's12', icon: '⭐', cur: s.best, target: 12 },
  ];
  return list.map((m) => ({ ...m, earned: m.cur >= m.target, cur: Math.min(m.cur, m.target) }));
}

const inMonth = (w, y, m) => w.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`); // m: 0-11
const sum = (list, metric) => list.reduce((a, w) => a + (valueOf(w, metric) || 0), 0);
const round1 = (n) => Math.round(n * 10) / 10;

/** Cifras de un mes. `type` filtra por tipo (null = todos). `missing` = entrenos del mes sin ese dato (para avisar). */
export function monthTotals(workouts, y, m, type = null) {
  const list = workouts.filter((w) => inMonth(w, y, m) && (!type || w.type === type));
  const res = { count: list.length, missing: {} };
  for (const k of ['minutes', 'km', 'kcal']) {
    res[k] = round1(sum(list, k));
    res.missing[k] = list.filter((w) => valueOf(w, k) == null).length;
  }
  return res;
}

/** Reparto del mes por tipo (sin filtrar), de más a menos entrenos: [{ type, count, minutes }]. */
export function byType(workouts, y, m) {
  const map = new Map();
  for (const w of workouts.filter((x) => inMonth(x, y, m))) {
    const e = map.get(w.type) || { type: w.type, count: 0, minutes: 0 };
    e.count++; e.minutes += valueOf(w, 'minutes') || 0;
    map.set(w.type, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes);
}

/** Semanas (lunes–domingo) que tocan el mes, con la suma de la métrica SOLO de los días de ese mes. */
export function weeksOfMonth(workouts, y, m, metric = 'count', type = null) {
  const first = fmtDate(new Date(y, m, 1));
  const last = fmtDate(new Date(y, m + 1, 0));
  const out = [];
  for (let s = weekStart(first); s <= last; s = addDays(s, 7)) {
    const e = addDays(s, 6);
    const from = s < first ? first : s, to = e > last ? last : e;
    const list = workouts.filter((w) => w.date >= from && w.date <= to && (!type || w.type === type));
    out.push({ start: from, end: to, value: metric === 'count' ? list.length : round1(sum(list, metric)) });
  }
  return out;
}

/** Los `n` meses que terminan en (y, m), de más antiguo a más reciente. */
export function lastMonths(workouts, y, m, n = 6, metric = 'count', type = null) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
    const list = workouts.filter((w) => inMonth(w, d.getFullYear(), d.getMonth()) && (!type || w.type === type));
    out.push({ y: d.getFullYear(), m: d.getMonth(), value: metric === 'count' ? list.length : round1(sum(list, metric)) });
  }
  return out;
}

export const prevMonth = (y, m) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
export const nextMonth = (y, m) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });
export const monthOf = (dateStr) => { const d = parseDate(dateStr); return { y: d.getFullYear(), m: d.getMonth() }; };
