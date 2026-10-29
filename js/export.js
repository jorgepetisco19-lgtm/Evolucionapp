// Descargar mis datos (v17): un ZIP con un CSV por tabla (pesos, medidas, entrenos, rutinas, comidas, recetas, ingredientes, fotos y perfil) y un LEEME.
// Sin librerías: el CSV y el ZIP (sin comprimir) se generan aquí. Las FOTOS no se incluyen (solo la lista de fechas y tipos).
// En el navegador se descarga el archivo; dentro de la APK se guarda en la caché y se abre el menú de «Compartir» de Android (Drive, correo, etc.).
import { listEvery, isNative } from './db.js';
import { loadProfile } from './plan.js';
import { todayStr } from './util.js';
import { getLang } from './i18n.js';

export const TABLES = ['profiles', 'weigh_ins', 'measurements', 'workouts', 'routines', 'meals', 'recipes', 'ingredients', 'photos'];

// ---------- CSV ----------
const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v); // listas y objetos (ejercicios, ingredientes) van como JSON dentro de la celda
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV estándar: comas, comillas dobles, saltos de línea CRLF y BOM UTF-8 (para que Excel respete las tildes). Sin la columna user_id. */
export function toCsv(rows) {
  const cols = [];
  for (const r of rows) for (const k of Object.keys(r)) if (k !== 'user_id' && !cols.includes(k)) cols.push(k);
  if (!cols.length) return '';
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

// ---------- ZIP (sin comprimir) ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
/** files: [{ name, data: Uint8Array }] → Uint8Array con un .zip válido (nombres en UTF-8, método «stored»). */
export function zip(files, when = new Date()) {
  const enc = new TextEncoder();
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const dosDate = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const parts = [], central = [];
  let offset = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255];
  const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const common = [...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)];
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...common, ...name]);
    parts.push(local, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + size;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}

// ---------- recoger los datos ----------
const missingTable = (e) => !!e && (['PGRST205', '42P01'].includes(e.code) || /does not exist|schema cache/i.test(e.message || ''));
async function fetchTable(name) {
  if (name === 'profiles') { const p = await loadProfile(); return p ? [p] : []; }
  return listEvery(name);
}
const README = {
  es: (list, version) => `Evolucionapp · copia de tus datos (${todayStr()}, ${version})\r\n\r\nCada archivo .csv es una tabla. Se abren con Excel (Datos → Desde texto/CSV), Google Sheets o LibreOffice.\r\nLas listas (ejercicios de un entreno, ingredientes de una receta) van como JSON dentro de la celda.\r\nLas fotos NO están incluidas: solo su lista (fecha, tipo y ruta).\r\n\r\n${list}\r\n`,
  en: (list, version) => `Evolucionapp · copy of your data (${todayStr()}, ${version})\r\n\r\nEach .csv file is a table. Open them with Excel (Data → From Text/CSV), Google Sheets or LibreOffice.\r\nLists (a workout's exercises, a recipe's ingredients) are stored as JSON inside the cell.\r\nPhotos are NOT included: only their list (date, type and path).\r\n\r\n${list}\r\n`,
};

/** Pide todas las tablas y devuelve { name, bytes, counts } con el .zip listo. */
export async function buildExport() {
  const enc = new TextEncoder();
  const files = [], counts = {};
  for (const t of TABLES) {
    try {
      const rows = await fetchTable(t);
      counts[t] = rows.length;
      files.push({ name: `${t}.csv`, data: enc.encode(toCsv(rows)) });
    } catch (e) {
      if (!missingTable(e)) throw e;
      counts[t] = null; // esa tabla aún no existe en tu Supabase (falta ejecutar su SQL): se salta
    }
  }
  const list = Object.entries(counts).map(([t, n]) => `${t}.csv — ${n === null ? '(n/a)' : n}`).join('\r\n');
  files.unshift({ name: 'LEEME.txt', data: enc.encode(README[getLang()] ? README[getLang()](list, window.APP_VERSION || '') : README.es(list, window.APP_VERSION || '')) });
  return { name: `evolucionapp-datos-${todayStr()}.zip`, bytes: zip(files), counts };
}

// ---------- entregar el archivo ----------
const plugin = (n) => window.Capacitor.registerPlugin(n);
const hasPlugins = () => {
  try { return typeof window.Capacitor.isPluginAvailable === 'function' && window.Capacitor.isPluginAvailable('Filesystem') && window.Capacitor.isPluginAvailable('Share'); } catch { return false; }
};
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };

/** Devuelve 'shared' (APK: se abrió «Compartir»), 'downloaded' (navegador) o lanza Error('NEEDS_UPDATE') si la APK es antigua y no trae los plugins. */
export async function saveFile(name, bytes) {
  if (isNative()) {
    if (!hasPlugins()) throw new Error('NEEDS_UPDATE');
    const { uri } = await plugin('Filesystem').writeFile({ path: name, data: b64(bytes), directory: 'CACHE' });
    try {
      await plugin('Share').share({ title: name, files: [uri], dialogTitle: name });
    } catch (e) {
      if (!/cancel/i.test((e && e.message) || '')) throw e; // cerrar el menú de compartir no es un error
    }
    return 'shared';
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export async function exportAndSave() {
  const { name, bytes, counts } = await buildExport();
  return { kind: await saveFile(name, bytes), name, counts };
}
