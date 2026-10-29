// Tendencia de peso y proyección a la meta (v16). Funciones puras: reciben los pesajes y devuelven números.
// Idea: el peso de cada día sube y baja por agua, comida y báscula; lo que enseña si avanzas es la TENDENCIA.
//  · tendencia = media móvil exponencial (cada pesaje pesa la mitad cada 7 días que pasan; vale con pesajes irregulares)
//  · ritmo = recta que mejor se ajusta a los pesajes de los últimos 28 días (kg por semana)
//  · proyección = cuántos días tardarías en llegar a la meta si mantienes ese ritmo, solo si hay datos suficientes
import { addDays, daysBetween } from './util.js';

export const HALF_LIFE_DAYS = 7;
export const WINDOW_DAYS = 28;      // ventana para calcular el ritmo
export const MIN_POINTS = 5;        // pesajes mínimos en esa ventana
export const MIN_SPAN_DAYS = 14;    // y que abarquen al menos dos semanas
export const MIN_RATE = 0.05;       // kg/semana por debajo de esto se considera «sin movimiento»
export const REACHED_KG = 0.3;      // a menos de 300 g de la meta se considera alcanzada
export const MAX_DAYS = 730;        // más de dos años: no se da fecha
export const MIN_TARGET = 20;       // mismos límites que el campo «peso objetivo» del Perfil (profiles.goal_weight_kg, 1 decimal)
export const MAX_TARGET = 400;

const clean = (points) => points.filter((p) => p && p.x && Number.isFinite(Number(p.y))).map((p) => ({ x: p.x, y: Number(p.y) })).sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : 0));

/** Serie suavizada: un punto por pesaje, con la tendencia de ese día. */
export function trendSeries(points) {
  const out = [];
  let t = null, prev = null;
  for (const p of clean(points)) {
    if (t === null) t = p.y;
    else {
      const a = 1 - Math.pow(0.5, Math.max(0, daysBetween(prev, p.x)) / HALF_LIFE_DAYS);
      t += a * (p.y - t);
    }
    prev = p.x;
    out.push({ x: p.x, y: t });
  }
  return out;
}

/** Ritmo en kg/semana (negativo = bajando) con los pesajes de los últimos 28 días, o null si no hay datos suficientes. */
export function weeklyRate(points, today) {
  const from = addDays(today, -WINDOW_DAYS);
  const w = clean(points).filter((p) => p.x >= from && p.x <= today);
  if (w.length < MIN_POINTS) return null;
  const x0 = w[0].x;
  const xs = w.map((p) => daysBetween(x0, p.x));
  if (xs[xs.length - 1] < MIN_SPAN_DAYS) return null;
  const n = w.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = w.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0;
  w.forEach((p, i) => { sxy += (xs[i] - mx) * (p.y - my); sxx += (xs[i] - mx) ** 2; });
  return sxx === 0 ? null : (sxy / sxx) * 7;
}

/**
 * Estado de la tarjeta de tendencia:
 *  noData · noTarget · reached · few (pocos pesajes) · away (la tendencia no se acerca) · far (más de 2 años) · eta (con fecha)
 * `current` es el peso de tendencia de hoy; `remaining` = current − meta (positivo: falta por bajar).
 */
export function projection(points, target, today) {
  const series = trendSeries(points);
  if (!series.length) return { status: 'noData' };
  const current = series[series.length - 1].y;
  const perWeek = weeklyRate(points, today);
  const base = { current, perWeek };
  const tg = Number(target);
  if (target == null || target === '' || !Number.isFinite(tg)) return { ...base, status: 'noTarget' };
  const remaining = current - tg;
  base.remaining = remaining; base.target = tg;
  if (Math.abs(remaining) <= REACHED_KG) return { ...base, status: 'reached' };
  if (perWeek === null) return { ...base, status: 'few' };
  if (Math.abs(perWeek) < MIN_RATE || Math.sign(perWeek) === Math.sign(remaining)) return { ...base, status: 'away' };
  const days = Math.ceil((Math.abs(remaining) / Math.abs(perWeek)) * 7);
  if (days > MAX_DAYS) return { ...base, status: 'far' };
  return { ...base, status: 'eta', days, date: addDays(today, days) };
}
