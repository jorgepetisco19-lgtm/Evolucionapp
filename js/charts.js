// Gráfica de líneas en SVG, sin librerías. Los colores salen de variables CSS (sirven en claro y oscuro).
import { html, raw, dateTiny, parseDate, num } from './util.js';

/**
 * points: [{ x: 'YYYY-MM-DD', y: number }] ordenados por fecha.
 */
export function lineChart(points, { unit = '', decimals = 1, height = 180 } = {}) {
  const W = 340, H = height, L = 44, R = 14, T = 14, B = 24;
  if (points.length < 2) {
    return html`<div class="chart-empty">${points.length ? num(points[0].y, decimals) + ' ' + unit : ''}</div>`;
  }
  const xs = points.map((p) => parseDate(p.x).getTime());
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const padY = (y1 - y0) * 0.15;
  y0 -= padY; y1 += padY;
  const sx = (x) => L + 6 + ((x - x0) / (x1 - x0 || 1)) * (W - L - R - 12);
  const sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = `${path} L${sx(xs[xs.length - 1]).toFixed(1)},${H - B} L${sx(xs[0]).toFixed(1)},${H - B} Z`;
  const ticks = [y0 + padY, (y0 + y1) / 2, y1 - padY];
  const last = points[points.length - 1];
  const dots = points.length <= 40
    ? points.map((p, i) => `<circle cx="${sx(xs[i]).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" class="ch-dot"><title>${dateTiny(p.x)}: ${num(p.y, decimals)} ${unit}</title></circle>`).join('')
    : '';
  return html`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" preserveAspectRatio="xMidYMid meet">
    ${raw(ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" class="ch-grid"/><text x="${L - 4}" y="${(sy(v) + 3).toFixed(1)}" class="ch-axis" text-anchor="end">${num(v, decimals)}</text>`).join(''))}
    <path d="${area}" class="ch-area"/>
    <path d="${path}" class="ch-line"/>
    ${raw(dots)}
    <circle cx="${sx(xs[xs.length - 1]).toFixed(1)}" cy="${sy(last.y).toFixed(1)}" r="4.5" class="ch-last"/>
    <text x="${L}" y="${H - 6}" class="ch-axis">${dateTiny(points[0].x)}</text>
    <text x="${W - R}" y="${H - 6}" class="ch-axis" text-anchor="end">${dateTiny(last.x)}</text>
  </svg>`;
}

/**
 * Gráfica de barras en SVG (sin librerías). items: [{ label, value, title?, current? }].
 * La barra con current:true se resalta (por ejemplo, la semana o el mes que estás viendo).
 */
export function barChart(items, { unit = '', decimals = 0, height = 170 } = {}) {
  const W = 340, H = height, L = 8, R = 8, T = 20, B = 24;
  if (!items.length) return html`<div class="chart-empty"></div>`;
  const max = Math.max(...items.map((i) => i.value), 0);
  const band = (W - L - R) / items.length;
  const bw = Math.min(band * 0.62, 38);
  const base = H - B;
  const sy = (v) => (max > 0 ? (v / max) * (base - T) : 0);
  const bars = items.map((it, i) => {
    const cx = L + band * i + band / 2;
    const h = sy(it.value);
    const tip = `${it.title || it.label}: ${num(it.value, decimals)}${unit ? ' ' + unit : ''}`;
    return `<g><title>${esc(tip)}</title>`
      + (it.value > 0
        ? `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 2).toFixed(1)}" rx="4" class="ch-bar${it.current ? ' cur' : ''}"/>`
          + `<text x="${cx.toFixed(1)}" y="${(base - h - 5).toFixed(1)}" class="ch-val" text-anchor="middle">${esc(num(it.value, decimals))}</text>`
        : `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(base - 2).toFixed(1)}" width="${bw.toFixed(1)}" height="2" rx="1" class="ch-bar zero"/>`)
      + `<text x="${cx.toFixed(1)}" y="${H - 7}" class="ch-axis" text-anchor="middle">${esc(it.label)}</text></g>`;
  }).join('');
  return html`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" preserveAspectRatio="xMidYMid meet">
    <line x1="${L}" x2="${W - R}" y1="${base}" y2="${base}" class="ch-grid"/>
    ${raw(bars)}
  </svg>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
