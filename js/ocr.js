// OCR en el propio móvil (Tesseract.js, sin servidor).
// Estrategia en dos pasadas:
//  1) Se lee toda la captura y se localizan las etiquetas (Peso, IMC, Grasa corporal...) por su posición.
//  2) Se recorta el número que hay debajo (o a la derecha) de cada etiqueta, se aísla de su unidad
//     (kg, %, kcal) y se vuelve a leer solo con dígitos, mucho más fiable.
// Siempre hay una pantalla de confirmación: el OCR propone, la persona decide.
import { FIELDS } from './fields.js';

// Rutas absolutas a los archivos del OCR (van dentro del repositorio, carpeta vendor/).
const abs = (p) => new URL('../' + p, import.meta.url).href;

// ---------- utilidades de texto ----------
export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
const sim = (a, b) => {
  const m = Math.max(a.length, b.length);
  return m ? 1 - lev(a, b) / m : 0;
};

const CHIPS = ['promedio', 'alto', 'bajo', 'excelente', 'en forma', 'normal', 'optimo', 'estandar', 'saludable',
  'delgado', 'sobrepeso', 'obesidad', 'bien', 'deficiente', 'insuficiente', 'elevado', 'high', 'low', 'standard',
  'excellent', 'good', 'average', 'fit', 'obese', 'overweight', 'healthy', 'ordenar', 'mostrar menos', 'mostrar mas'];

function isChip(text) {
  const t = norm(text);
  return !!t && CHIPS.some((c) => t === c || (c.length > 4 && sim(t, c) >= 0.8));
}

export function matchField(text) {
  const t = norm(text);
  if (!t) return null;
  let best = null;
  for (const f of FIELDS) {
    for (const s of f.syn) {
      const sc = sim(t, s);
      const ok = s.length <= 4 ? lev(t, s) <= 1 && Math.abs(t.length - s.length) <= 1 : sc >= 0.78;
      if (ok && (!best || sc > best.score)) best = { key: f.key, score: sc };
    }
  }
  return best;
}

const decimalsOf = (f) => (f.step >= 1 ? 0 : f.step >= 0.1 ? 1 : 2);

// Convierte el texto leído en número y, si queda fuera del rango lógico, intenta recolocar el punto decimal.
export function fixValue(field, raw) {
  const s = String(raw || '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  if (!/\d/.test(s)) return null;
  const clean = s.replace(/^\.+|\.+$/g, '');
  const parts = clean.split('.');
  const asNum = parts.length > 2 ? parseFloat(parts[0] + '.' + parts.slice(1).join('')) : parseFloat(clean);
  const inRange = (v) => v >= field.min && v <= field.max;
  if (Number.isFinite(asNum) && clean.includes('.') && inRange(asNum)) return asNum;
  const digits = clean.replace(/\./g, '');
  if (!digits) return null;
  const cands = [];
  const whole = parseFloat(digits);
  if (inRange(whole)) cands.push(whole);
  for (let p = 1; p < digits.length; p++) {
    const v = parseFloat(digits.slice(0, p) + '.' + digits.slice(p));
    if (inRange(v)) cands.push(v);
  }
  if (!cands.length) return null;
  // Preferimos la opción con los decimales habituales de ese campo (0, 1 o 2).
  const want = decimalsOf(field);
  const pref = cands.find((v) => (String(v).split('.')[1] || '').length === want);
  return pref !== undefined ? pref : cands[0];
}

// ---------- imagen ----------
export async function loadCanvas(file, maxW = 1600) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = bmp.width > maxW ? maxW / bmp.width : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
};

// Aísla el número (dígitos y punto) dentro del recuadro de una línea y descarta la unidad (kg, %, kcal),
// que es más pequeña. Devuelve un canvas listo para el OCR (texto oscuro sobre fondo claro).
function cropNumber(src, box) {
  const pad = 4;
  const x0 = Math.max(0, Math.floor(box.x0 - pad)), y0 = Math.max(0, Math.floor(box.y0 - pad));
  const x1 = Math.min(src.width, Math.ceil(box.x1 + pad)), y1 = Math.min(src.height, Math.ceil(box.y1 + pad));
  const w = x1 - x0, h = y1 - y0;
  if (w < 4 || h < 4) return null;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(x0, y0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * img[i * 4] + 0.587 * img[i * 4 + 1] + 0.114 * img[i * 4 + 2];
  // Fondo = mediana del borde.
  const border = [];
  for (let x = 0; x < w; x++) { border.push(gray[x], gray[(h - 1) * w + x]); }
  for (let y = 0; y < h; y++) { border.push(gray[y * w], gray[y * w + w - 1]); }
  const bg = median(border);
  const sorted = Array.from(gray).sort((a, b) => a - b);
  const range = sorted[Math.floor(sorted.length * 0.98)] - sorted[Math.floor(sorted.length * 0.02)];
  const thr = Math.max(25, range * 0.35);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = Math.abs(gray[i] - bg) >= thr ? 1 : 0;
  // Columnas con tinta -> glifos.
  const cols = [];
  for (let x = 0; x < w; x++) {
    let mn = -1, mx = -1;
    for (let y = 0; y < h; y++) if (ink[y * w + x]) { if (mn < 0) mn = y; mx = y; }
    cols.push(mn < 0 ? null : [mn, mx]);
  }
  const runs = [];
  let cur = null;
  for (let x = 0; x < w; x++) {
    if (cols[x]) {
      if (!cur) cur = { x0: x, x1: x, y0: cols[x][0], y1: cols[x][1] };
      else { cur.x1 = x; cur.y0 = Math.min(cur.y0, cols[x][0]); cur.y1 = Math.max(cur.y1, cols[x][1]); }
    } else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  if (!runs.length) return null;
  const hOf = (r) => r.y1 - r.y0 + 1;
  const maxH = Math.max(...runs.map(hOf));
  const digitIdx = runs.map((r, i) => (hOf(r) >= 0.6 * maxH ? i : -1)).filter((i) => i >= 0);
  if (!digitIdx.length) return null;
  const first = digitIdx[0], last = digitIdx[digitIdx.length - 1];
  // Se queda desde el primer dígito hasta el último; lo de en medio (el punto) se conserva.
  const keep = runs.slice(first, last + 1);
  const kx0 = Math.min(...keep.map((r) => r.x0)), kx1 = Math.max(...keep.map((r) => r.x1));
  const ky0 = Math.min(...keep.map((r) => r.y0)), ky1 = Math.max(...keep.map((r) => r.y1));
  const kw = kx1 - kx0 + 1, kh = ky1 - ky0 + 1;
  const scale = Math.max(1, 70 / kh);
  const margin = 24;
  const out = document.createElement('canvas');
  out.width = Math.round(kw * scale) + margin * 2;
  out.height = Math.round(kh * scale) + margin * 2;
  const octx = out.getContext('2d');
  // Dibujo manual: negro sobre blanco con el contraste normalizado.
  const tmp = document.createElement('canvas');
  tmp.width = kw; tmp.height = kh;
  const tctx = tmp.getContext('2d');
  const id = tctx.createImageData(kw, kh);
  for (let y = 0; y < kh; y++) {
    for (let x = 0; x < kw; x++) {
      const g = gray[(ky0 + y) * w + (kx0 + x)];
      // 0 = tinta, 255 = fondo
      const t = Math.min(1, Math.abs(g - bg) / Math.max(1, range * 0.7));
      const v = Math.round(255 * (1 - t));
      const o = (y * kw + x) * 4;
      id.data[o] = id.data[o + 1] = id.data[o + 2] = v;
      id.data[o + 3] = 255;
    }
  }
  tctx.putImageData(id, 0, 0);
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(tmp, margin, margin, Math.round(kw * scale), Math.round(kh * scale));
  return out;
}

// ---------- worker ----------
// El motor (unos 70 KB) solo se descarga cuando se usa el OCR por primera vez.
function ensureTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = abs('vendor/tesseract/tesseract.min.js');
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar el lector de imágenes'));
    document.head.appendChild(s);
  });
}

export async function makeWorker(onStatus) {
  await ensureTesseract();
  return window.Tesseract.createWorker('spa', 1, {
    workerPath: abs('vendor/tesseract/worker.min.js'),
    corePath: abs('vendor/tesseract/core/'),
    langPath: abs('vendor/tesseract/lang/'),
    gzip: true,
    logger: (m) => onStatus && onStatus(m),
  });
}

// ---------- agrupar líneas en etiquetas ----------
function groupLabelLines(lines, lh) {
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0);
  const groups = [];
  for (const l of sorted) {
    const h = l.y1 - l.y0;
    const g = groups.find((g) => {
      const gap = l.y0 - g.y1;
      if (gap < -h * 0.5 || gap > Math.max(h, lh) * 0.9) return false;
      const ov = Math.min(l.x1, g.x1) - Math.max(l.x0, g.x0);
      return ov >= 0.5 * Math.min(l.x1 - l.x0, g.x1 - g.x0);
    });
    if (g) {
      g.lines.push(l);
      g.x0 = Math.min(g.x0, l.x0); g.x1 = Math.max(g.x1, l.x1);
      g.y0 = Math.min(g.y0, l.y0); g.y1 = Math.max(g.y1, l.y1);
      g.text += ' ' + l.text;
    } else {
      groups.push({ lines: [l], x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, text: l.text });
    }
  }
  return groups;
}

/**
 * Lee una captura de báscula y devuelve { values, lowConf, found, debug }.
 * values: { weight_kg: 80.85, ... } (solo lo que se ha encontrado)
 */
export async function runOcr(file, onStatus, opts = {}) {
  const status = (s) => onStatus && onStatus(s);
  const canvas = await loadCanvas(file);
  status({ stage: 'load' });
  const worker = await makeWorker((m) => status({ stage: 'engine', progress: m.progress, status: m.status }));
  try {
    status({ stage: 'read' });
    await worker.setParameters({ tessedit_pageseg_mode: '11' });
    const { data } = await worker.recognize(canvas);
    const lines = (data.lines || [])
      .map((l) => ({ text: (l.text || '').trim(), x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1, conf: l.confidence }))
      .filter((l) => l.text);

    // Altura típica de una línea de etiqueta (texto sin dígitos, de 4+ letras).
    const wordy = lines.filter((l) => !/\d/.test(l.text) && (l.text.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 4);
    const lh = median(wordy.map((l) => l.y1 - l.y0)) || 22;

    const labelLines = lines.filter((l) => (l.y1 - l.y0) <= lh * 1.35 && !/\d/.test(l.text) && !isChip(l.text));
    const numLines = lines.filter((l) => (l.y1 - l.y0) >= lh * 1.4);

    const groups = groupLabelLines(labelLines, lh)
      .map((g) => ({ ...g, cx: (g.x0 + g.x1) / 2, match: matchField(g.text) }))
      .filter((g) => g.match);
    // Si un mismo campo aparece dos veces nos quedamos con la mejor coincidencia.
    const byKey = new Map();
    for (const g of groups) {
      const prev = byKey.get(g.match.key);
      if (!prev || g.match.score > prev.match.score) byKey.set(g.match.key, g);
    }
    const labels = [...byKey.values()];

    // Separación entre columnas (rejilla de 3 columnas en las apps típicas).
    const dxs = [];
    for (const a of labels) for (const b of labels) {
      if (a !== b && Math.abs(a.y0 - b.y0) < lh * 1.2 && b.cx > a.cx) dxs.push(b.cx - a.cx);
    }
    const pitch = dxs.length ? Math.min(...dxs) : canvas.width / 3.2;
    const gridLayout = dxs.length > 0;

    const values = {};
    const lowConf = new Set();
    const debug = [];
    status({ stage: 'numbers', total: labels.length });
    await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789.,' });

    for (const g of labels) {
      const field = FIELDS.find((f) => f.key === g.match.key);
      // Candidato 1: número justo debajo de la etiqueta, en su columna.
      let cands = numLines.filter((n) =>
        n.y0 >= g.y1 - lh * 0.3 && n.y0 <= g.y1 + lh * 3.6 && Math.abs((n.x0 + n.x1) / 2 - g.cx) <= pitch * 0.45);
      cands.sort((a, b) => a.y0 - b.y0);
      let pick = gridLayout ? cands[0] : undefined;
      // Candidato 2: número a la derecha, en la misma fila (listas tipo "Peso ........ 80,85 kg").
      if (!pick) {
        const right = numLines
          .filter((n) => n.x0 >= g.x1 - lh * 0.5 && (n.y0 + n.y1) / 2 >= g.y0 - lh * 0.8 && (n.y0 + n.y1) / 2 <= g.y1 + lh * 0.8)
          .sort((a, b) => a.x0 - b.x0);
        pick = right[0] || cands[0];
      }
      if (!pick) { debug.push({ key: g.match.key, label: g.text, note: 'sin número' }); continue; }
      const crop = cropNumber(canvas, pick);
      if (!crop) { debug.push({ key: g.match.key, label: g.text, note: 'recorte vacío', line: pick.text }); continue; }
      // Pasada 2: solo dígitos. Si no lee nada (un dígito suelto como el "6"), se prueba como palabra y como carácter.
      let res = await worker.recognize(crop);
      let txt = (res.data.text || '').trim();
      if (!/\d/.test(txt)) {
        for (const psm of ['8', '10']) {
          await worker.setParameters({ tessedit_pageseg_mode: psm });
          const r2 = await worker.recognize(crop);
          if (/\d/.test(r2.data.text || '')) { res = r2; txt = (r2.data.text || '').trim(); break; }
        }
        await worker.setParameters({ tessedit_pageseg_mode: '7' });
      }
      const conf2 = res.data.confidence;
      const v2 = fixValue(field, txt);
      // Lectura de la pasada 1 (la línea completa), solo si ya trae el decimal y está en rango.
      const tok = (pick.text.match(/\d+(?:[.,]\d+)?/) || [''])[0];
      const v1 = tok ? fixValue(field, tok) : null;
      let v = v2, low = false;
      if (v2 === null) { v = v1; low = v1 !== null; }
      else if (v1 !== null && v1 !== v2) {
        // Las dos pasadas discrepan: manda la 2 si está muy segura; si no, la 1; en ambos casos se avisa.
        if (conf2 >= 90) { v = v2; low = true; } else { v = v1; low = true; }
      } else if (conf2 < 50) low = true;
      debug.push({ key: g.match.key, label: g.text, line: pick.text, read: txt, v1, v2, value: v, conf: Math.round(conf2), low,
        crop: opts.debug ? crop.toDataURL('image/png') : undefined });
      if (v !== null) {
        values[field.key] = v;
        if (low) lowConf.add(field.key);
      }
    }
    return { values, lowConf: [...lowConf], found: Object.keys(values).length, debug };
  } finally {
    await worker.terminate();
  }
}
