// Lee la captura del RESUMEN de un entreno (Samsung Health, Garmin, Apple Fitness, Strava, Fitbit...) en el propio móvil.
// Cada app dibuja su pantalla distinta, así que aquí no se busca una posición fija: se buscan números con su unidad
// (kcal, lpm/bpm, km, min, 00:45:12) y, cuando hace falta, la etiqueta que tienen al lado o encima (media / máx / activas).
// Siempre hay pantalla de confirmación: el lector propone, la persona decide.
import { loadCanvas, makeWorker, norm } from './ocr.js';

const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
};

// Número con posibles separadores: 1.234 / 1,234 (miles) o 5,23 / 5.23 (decimales).
const N = '\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?';
const toNumber = (s, { thousands = false } = {}) => {
  let x = String(s).trim();
  if (thousands && /^\d{1,3}(?:[.,]\d{3})+$/.test(x)) x = x.replace(/[.,]/g, '');
  else x = x.replace(',', '.');
  const v = parseFloat(x);
  return Number.isFinite(v) ? v : null;
};

// Pequeñas confusiones típicas del OCR dentro de números ("1O5" -> "105", "l2" -> "12").
const fixDigits = (s) => String(s)
  .replace(/(?<=\d)[oO](?=\d|\s*(?:kcal|lpm|bpm|ppm|km))/g, '0')
  .replace(/(?<=\d)[lI|](?=\d)/g, '1')
  .replace(/\b[oO](?=\d)/g, '0');

const KW = {
  avg: /\b(media|medio|promedio|prom|avg|average|mean)\b/,
  max: /\b(max|maxima|maximo|pico|peak|maximum)\b/,
  low: /\b(minima|minimo|reposo|resting|lowest)\b/,
  zone: /\b(zona|zonas|zone|zones|rango)\b/,
  active: /\b(activa|activas|activo|active)\b/,
  total: /\b(total|totales|reposo|basal|resting)\b/,
  hr: /\b(frecuencia|cardiaca|cardiaco|cardio|pulso|pulsaciones|latidos|heart|fc|hr)\b/,
  kcal: /\b(calorias|calorias|kcal|energia|energy|calories)\b/,
  dist: /\b(distancia|distance)\b/,
  dur: /\b(duracion|tiempo|time|duration)\b/,
  badTime: /\b(pausa|descanso|ritmo|pace|vuelta|lap|reposo|rest|moving|movimiento)\b/,
};

// Tipo de entreno sugerido por las palabras de la pantalla.
export function guessType(text) {
  const s = norm(text);
  if (/\bpadel\b/.test(s)) return 'padel';
  if (/\b(natacion|nadar|swim\w*|piscina)\b/.test(s)) return 'swim';
  if (/\b(ciclismo|bici\w*|cycling|bike|biking)\b/.test(s)) return 'cycling';
  if (/\b(correr|carrera|running|run|trote|jogging)\b/.test(s)) return 'run';
  if (/\b(caminar|caminata|andar|paseo|walking|walk|senderismo|hiking|hike)\b/.test(s)) return 'walk';
  if (/\b(fuerza|gimnasio|gym|pesas|strength|musculacion|weight training)\b/.test(s)) return 'gym';
  return null;
}

const hasLetters = (t) => (t.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 3;
const isPureNumber = (t) => /^\s*\d[\d.,:]*\s*$/.test(t);
// "lpm" suele salir del OCR como "Ipm", "1pm" o "Ibm"; se aceptan esas variantes.
const HRU = '(?:[lI1|]pm|[lI1|]bm|bpm|ppm)';
const startsWithUnit = (t) => new RegExp(`^\\s*(kcal|cal\\b|${HRU}|km\\b|mi\\b|min\\b|h\\b)`, 'i').test(t);

/**
 * Convierte las líneas leídas (texto + caja) en datos de entreno. Función pura, se puede probar sin imagen.
 * lines: [{ text, x0, y0, x1, y1 }]; size: { w, h } de la imagen.
 * Devuelve { values, lowConf, found, type } con values = { duration_min, calories_kcal, hr_avg, hr_max, distance_km }.
 */
export function parseWorkout(lines, size = {}) {
  const W = size.w || Math.max(1, ...lines.map((l) => l.x1));
  const H = size.h || Math.max(1, ...lines.map((l) => l.y1));
  // Se ignora la barra de estado del móvil (hora, batería): ahí hay "horas" que no son duraciones.
  const all = lines
    .map((l) => ({ ...l, text: fixDigits(String(l.text || '').replace(/\s+/g, ' ').trim()) }))
    .filter((l) => l.text && l.y0 >= H * 0.05);
  const lh = median(all.map((l) => l.y1 - l.y0)) || 24;
  const cx = (l) => (l.x0 + l.x1) / 2;
  const cy = (l) => (l.y0 + l.y1) / 2;

  // Un número suelto con su unidad en la línea de al lado ("132" + "lpm") se une en una línea sintética.
  // Cada línea de unidad se empareja con un solo número (el más cercano); los tiempos (1:02:10) no llevan unidad aparte.
  const pairs = [];
  for (const L of all) {
    if (!isPureNumber(L.text) || L.text.includes(':')) continue;
    for (const N2 of all) {
      if (N2 === L || !startsWithUnit(N2.text)) continue;
      const sameRow = Math.abs(cy(N2) - cy(L)) <= lh * 0.9 && N2.x0 >= L.x1 - lh * 0.5 && N2.x0 - L.x1 <= W * 0.3;
      const below = N2.y0 >= L.y1 - lh * 0.4 && N2.y0 - L.y1 <= lh * 2.5 && Math.abs(cx(N2) - cx(L)) <= Math.max(L.x1 - L.x0, N2.x1 - N2.x0) * 1.2;
      const d = sameRow ? Math.abs(N2.x0 - L.x1) : below ? (N2.y0 - L.y1) + Math.abs(cx(N2) - cx(L)) : Infinity;
      if (Number.isFinite(d)) pairs.push({ L, N2, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedNum = new Set(), usedUnit = new Set(), synth = [];
  for (const { L, N2 } of pairs) {
    if (usedNum.has(L) || usedUnit.has(N2)) continue;
    usedNum.add(L); usedUnit.add(N2);
    synth.push({ text: `${L.text} ${N2.text}`, x0: Math.min(L.x0, N2.x0), y0: Math.min(L.y0, N2.y0), x1: Math.max(L.x1, N2.x1), y1: Math.max(L.y1, N2.y1), synth: true });
  }
  const parseLines = [...all, ...synth];

  // Etiquetas (líneas con letras) más cercanas a una línea: a la izquierda, encima y debajo; se usa la más próxima de cada lado.
  const labelLines = all.filter((l) => hasLetters(l.text) && !/\d/.test(l.text)); // etiquetas = texto sin cifras (una línea con cifras es otro dato)
  const nearestLabels = (L) => {
    const others = labelLines.filter((o) => o !== L && !(L.synth && (L.text.includes(o.text))));
    const pick = (cands) => cands.sort((a, b) => a.d - b.d)[0];
    const left = pick(others.filter((o) => Math.abs(cy(o) - cy(L)) <= lh * 0.9 && o.x1 <= L.x0 + lh).map((o) => ({ o, d: L.x0 - o.x1 })));
    const overlapX = (o) => Math.abs(cx(o) - cx(L)) <= Math.max(L.x1 - L.x0, o.x1 - o.x0, W * 0.15) * 0.75;
    const above = pick(others.filter((o) => o.y1 <= L.y0 + lh * 0.4 && L.y0 - o.y1 <= lh * 2.6 && overlapX(o)).map((o) => ({ o, d: L.y0 - o.y1 })));
    const below = pick(others.filter((o) => o.y0 >= L.y1 - lh * 0.4 && o.y0 - L.y1 <= lh * 2 && overlapX(o)).map((o) => ({ o, d: o.y0 - L.y1 })));
    return [left, above, below].filter(Boolean).map((x) => norm(x.o.text));
  };

  const cands = { kcal: [], dist: [], dur: [], hr: [] };
  const seen = new Map();
  const add = (kind, c) => {
    const key = `${kind}|${c.value}|${c.sub || ''}|${Math.round(c.y / (lh * 1.5))}`;
    const prev = seen.get(key);
    // El mismo dato leído dos veces (suelto y unido a su unidad): se queda la lectura con unidad, que es más fiable.
    if (prev) { if (prev.level !== c.level && c.level !== 'label' && prev.level === 'label') Object.assign(prev, c); return; }
    seen.set(key, c);
    cands[kind].push(c);
  };

  for (const L of parseLines) {
    const raw = L.text;
    const rest = (m) => norm(raw.slice(0, m.index) + ' ' + raw.slice(m.index + m[0].length));
    const ctxOf = (m) => [rest(m), ...nearestLabels(L)];
    const y = L.y0;
    let m;

    // Calorías
    const kc = new RegExp(`(${N})\\s*(?:kcal|kcals|kilocal\\w*|cal\\b|calor\\w*)`, 'gi');
    while ((m = kc.exec(raw))) {
      const v = toNumber(m[1], { thousands: true });
      if (v !== null && v >= 1 && v <= 20000) add('kcal', { value: Math.round(v), ctx: ctxOf(m), level: 'unit', y });
    }

    // Pulsaciones
    const hrRe = new RegExp(`(\\d{2,3})\\s*(?:${HRU}|puls\\w*|latidos)`, 'gi');
    while ((m = hrRe.exec(raw))) {
      const v = parseInt(m[1], 10);
      if (v < 30 || v > 250) continue;
      const ctx = ctxOf(m);
      add('hr', { value: v, ctx, level: 'unit', y, sub: hrSub(ctx) });
    }

    // Distancia
    const dRe = new RegExp(`(${N})\\s*(km|kms|kil[oó]metros?|mi|millas?)(?![\\w/])(?!\\s*/)`, 'gi');
    while ((m = dRe.exec(raw))) {
      let v = toNumber(m[1]);
      if (v === null) continue;
      if (/^(mi|milla)/i.test(m[2])) v *= 1.609344;
      if (v >= 0.01 && v <= 1000) add('dist', { value: Math.round(v * 100) / 100, ctx: ctxOf(m), level: 'unit', y, miles: /^(mi|milla)/i.test(m[2]) });
    }
    const mRe = /(\d{3,5})\s*(?:m|metros)\b(?!\s*\/)/gi;
    while ((m = mRe.exec(raw))) {
      const ctx = ctxOf(m);
      if (ctx.some((c) => KW.dist.test(c))) add('dist', { value: Math.round(parseInt(m[1], 10)) / 1000, ctx, level: 'label', y });
    }

    // Duración: h:mm:ss, "1 h 12 min", "45 min", mm:ss
    const paceAfter = (idx, len) => /^\s*(?:min\w*)?\s*\/\s*(?:km|mi|100)/i.test(raw.slice(idx + len));
    const hms = /(?<![\d:])(\d{1,2})\s*[:;]\s*(\d{2})\s*[:;]\s*(\d{2})(?![\d:])/g;
    while ((m = hms.exec(raw))) {
      if (paceAfter(m.index, m[0].length)) continue;
      const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3], 10) / 60;
      add('dur', { value: Math.round(mins), ctx: ctxOf(m), level: 'hms', y });
    }
    const hmin = /(?<!\d)(\d{1,2})\s*h(?:oras?|rs?)?\b\s*(?:(\d{1,2})\s*(?:min\w*|m)\b)?/gi;
    while ((m = hmin.exec(raw))) {
      const mins = parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
      add('dur', { value: mins, ctx: ctxOf(m), level: 'hmin', y });
    }
    const onlyMin = /(?<![\d:])(\d{1,3})\s*(?:min|mins|minutos?)\b(?!\s*\/)/gi;
    while ((m = onlyMin.exec(raw))) {
      // Un "45 min" que forma parte de "1 h 45 min" ya se cuenta arriba.
      if (/\d\s*h(?:oras?|rs?)?\s*$/i.test(raw.slice(0, m.index))) continue;
      add('dur', { value: parseInt(m[1], 10), ctx: ctxOf(m), level: 'min', y });
    }
    const ms = /(?<![\d:])(\d{1,3})\s*[:;]\s*(\d{2})(?![\d:])/g;
    while ((m = ms.exec(raw))) {
      if (paceAfter(m.index, m[0].length)) continue;
      // "18:45 - 19:32" son horas de inicio y fin, no una duración.
      if (/\d\s*[:;]\s*\d{2}\s*[-–—]\s*$/.test(raw.slice(0, m.index)) || /^\s*[-–—]\s*\d{1,2}\s*[:;]\s*\d{2}/.test(raw.slice(m.index + m[0].length))) continue;
      const mins = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
      add('dur', { value: Math.round(mins), ctx: ctxOf(m), level: 'ms', y });
    }

    // Números sueltos cuya etiqueta dice qué son ("Calorías" encima de "456").
    if (isPureNumber(raw) && !raw.includes(':')) {
      const labs = nearestLabels(L);
      const hit = (re) => labs.find((c) => re.test(c));
      const v = toNumber(raw, { thousands: true });
      if (v !== null) {
        if (hit(KW.kcal) && v >= 1 && v <= 20000 && Number.isInteger(v)) add('kcal', { value: v, ctx: labs, level: 'label', y });
        else if (hit(KW.hr) && Number.isInteger(v) && v >= 30 && v <= 250) add('hr', { value: v, ctx: labs, level: 'label', y, sub: hrSub(labs) });
        else if (hit(KW.dist) && v > 0 && v <= 1000) add('dist', { value: v, ctx: labs, level: 'label', y });
      }
    }
  }

  // Dentro del contexto de una pulsación, ¿es la media, la máxima, otra cosa a ignorar o no se sabe?
  function hrSub(ctx) {
    for (const c of ctx) {
      if (KW.zone.test(c)) return 'skip';
      if (KW.low.test(c)) return 'skip';
      if (KW.max.test(c)) return 'max';
      if (KW.avg.test(c)) return 'avg';
    }
    return '?';
  }

  const values = {};
  const low = new Set();
  const labelHas = (c, re) => c.ctx.some((x) => re.test(x));

  // Calorías: mejor las "activas"; si hay varias sin etiqueta, la primera y se avisa.
  if (cands.kcal.length) {
    const act = cands.kcal.filter((c) => labelHas(c, KW.active));
    const notTotal = cands.kcal.filter((c) => !labelHas(c, KW.total));
    const pool = act.length ? act : notTotal.length ? notTotal : cands.kcal;
    pool.sort((a, b) => (a.level === 'unit' ? 0 : 1) - (b.level === 'unit' ? 0 : 1));
    const pick = pool[0];
    values.calories_kcal = pick.value;
    if (pick.level !== 'unit' || (!act.length && new Set(cands.kcal.map((c) => c.value)).size > 1)) low.add('calories_kcal');
  }

  // Pulsaciones
  const hrs = cands.hr.filter((c) => c.sub !== 'skip');
  const firstOf = (sub) => hrs.filter((c) => c.sub === sub).sort((a, b) => (a.level === 'unit' ? 0 : 1) - (b.level === 'unit' ? 0 : 1))[0];
  let avg = firstOf('avg'), max = firstOf('max');
  const unk = [...new Set(hrs.filter((c) => c.sub === '?').map((c) => c.value))];
  if (!avg && !max && unk.length) {
    if (unk.length === 1) { values.hr_avg = unk[0]; low.add('hr_avg'); }
    else { values.hr_avg = Math.min(...unk); values.hr_max = Math.max(...unk); low.add('hr_avg'); low.add('hr_max'); }
  } else {
    if (!avg && unk.length) { values.hr_avg = unk[0]; low.add('hr_avg'); }
    if (!max && unk.length && avg) { values.hr_max = Math.max(...unk); low.add('hr_max'); }
    if (avg) { values.hr_avg = avg.value; if (avg.level !== 'unit') low.add('hr_avg'); }
    if (max) { values.hr_max = max.value; if (max.level !== 'unit') low.add('hr_max'); }
  }
  if (values.hr_avg != null && values.hr_max != null && values.hr_avg > values.hr_max) {
    [values.hr_avg, values.hr_max] = [values.hr_max, values.hr_avg];
    low.add('hr_avg'); low.add('hr_max');
  }

  // Distancia: la primera con unidad; si hay varias distintas se avisa.
  if (cands.dist.length) {
    const pool = [...cands.dist].sort((a, b) => (a.level === 'unit' ? 0 : 1) - (b.level === 'unit' ? 0 : 1));
    values.distance_km = pool[0].value;
    if (pool[0].level !== 'unit' || pool[0].miles || new Set(cands.dist.map((c) => c.value)).size > 1) low.add('distance_km');
  }

  // Duración: h:mm:ss o "1 h 12 min" > "45 min" > mm:ss; se descartan las etiquetadas como pausa / ritmo / vuelta.
  if (cands.dur.length) {
    const rank = { hms: 0, hmin: 0, min: 1, ms: 2 };
    const good = cands.dur.filter((c) => c.value >= 1 && c.value <= 1440 && !labelHas(c, KW.badTime));
    const pool = (good.length ? good : cands.dur.filter((c) => c.value >= 1 && c.value <= 1440))
      .sort((a, b) => (rank[a.level] - rank[b.level]) || ((labelHas(a, KW.dur) ? 0 : 1) - (labelHas(b, KW.dur) ? 0 : 1)));
    if (pool.length) {
      values.duration_min = pool[0].value;
      if (pool[0].level === 'ms' || new Set(pool.filter((c) => rank[c.level] === rank[pool[0].level]).map((c) => c.value)).size > 1) low.add('duration_min');
    }
  }

  const text = lines.map((l) => l.text).join(' ');
  return { values, lowConf: [...low], found: Object.keys(values).length, type: guessType(text) };
}

/** Lee la captura con el OCR y devuelve { values, lowConf, found, type, text }. */
export async function runWorkoutOcr(file, onStatus, opts = {}) {
  const status = (s) => onStatus && onStatus(s);
  status({ stage: 'load' });
  const canvas = await loadCanvas(file);
  const worker = await makeWorker((m) => status({ stage: 'engine', progress: m.progress, status: m.status }));
  try {
    status({ stage: 'read' });
    const readLines = async (psm) => {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await worker.recognize(canvas);
      return (data.lines || [])
        .map((l) => ({ text: (l.text || '').trim(), x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1 }))
        .filter((l) => l.text);
    };
    const size = { w: canvas.width, h: canvas.height };
    let lines = await readLines('11');
    let res = parseWorkout(lines, size);
    // Si con la lectura "suelta" salen pocos datos, se prueba la lectura por bloques y nos quedamos con la que más encuentre.
    if (res.found < 3) {
      const lines2 = await readLines('3');
      const res2 = parseWorkout(lines2, size);
      if (res2.found > res.found) { res = res2; lines = lines2; }
    }
    return { ...res, text: lines.map((l) => l.text).join('\n'), size, lines: opts.debug ? lines : undefined };
  } finally {
    await worker.terminate();
  }
}
