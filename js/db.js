// Acceso a Supabase: sesión, tablas y fotos. Toda la app habla con la nube a través de este archivo.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { fetchWithTimeout } from './net.js';

if (!window.supabase) throw new Error('Supabase no se ha cargado (vendor/supabase.js)');

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // PKCE devuelve el código en ?code=... y no en el #hash, que usamos para navegar entre pantallas.
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
  global: { fetch: fetchWithTimeout }, // ninguna petición se queda colgada para siempre (ver net.js)
});

export const session = { user: null };

// ---------- autenticación ----------
export function redirectUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

// ---------- versión APK (Capacitor) ----------
// Dentro de la APK, Google NO deja iniciar sesión en una web embebida: se abre el navegador del sistema y, al terminar,
// Android devuelve a la app con un enlace especial (com.evolucionapp.app://auth?code=...). En la web normal nada de esto se usa.
export const NATIVE_REDIRECT = 'com.evolucionapp.app://auth';
export const isNative = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
const nativePlugin = (name) => {
  // registerPlugin lo aporta vendor/capacitor.js (@capacitor/core), que solo se añade a la copia que va dentro de la APK.
  if (typeof window.Capacitor.registerPlugin !== 'function') throw new Error('Falta vendor/capacitor.js en la APK');
  return window.Capacitor.registerPlugin(name);
};

/** Devuelve true si el login sigue en el navegador del sistema (versión APK) y false si la propia página se redirige (web). */
export async function signInWithGoogle() {
  if (!isNative()) {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
    if (error) throw error;
    return false;
  }
  const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true } });
  if (error) throw error;
  await nativePlugin('Browser').open({ url: data.url });
  return true;
}

let nativeListening = false;
/** Escucha el enlace de vuelta del login (solo en la APK). onError recibe un texto si Google o Supabase devuelven un fallo. */
export function listenNativeLogin(onError) {
  if (!isNative() || nativeListening) return;
  nativeListening = true;
  const app = nativePlugin('App');
  app.addListener('appUrlOpen', async (ev) => {
    const url = (ev && ev.url) || '';
    if (!url.startsWith(NATIVE_REDIRECT)) return;
    try { await nativePlugin('Browser').close(); } catch { /* en Android se cierra solo */ }
    const q = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '');
    const h = new URLSearchParams(url.includes('#') ? url.slice(url.indexOf('#') + 1) : '');
    const err = q.get('error_description') || q.get('error') || h.get('error_description') || h.get('error');
    if (err) { onError(err); return; }
    const code = q.get('code');
    if (!code) { onError('El inicio de sesión no devolvió ningún código. Inténtalo de nuevo.'); return; }
    try {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) onError(error.message);
    } catch (e) { onError((e && e.message) || String(e)); }
  }).catch((e) => onError((e && e.message) || String(e)));
}
export async function signOut() {
  await sb.auth.signOut();
}

// ---------- tablas ----------
const check = ({ data, error }) => { if (error) throw error; return data; };

// Avisa (js/reminders.js) de que cambió un peso o un entreno, para reprogramar los recordatorios («hoy ya lo has registrado»).
const WATCHED = new Set(['weigh_ins', 'workouts']);
const changed = (table, data) => { if (WATCHED.has(table)) window.dispatchEvent(new Event('evo:data')); return data; };

export async function listRange(table, from, to, cols = '*', order = 'date') {
  return check(await sb.from(table).select(cols).gte('date', from).lte('date', to).order(order, { ascending: true }));
}
export async function listAll(table, { order = 'date', asc = false, cols = '*', limit = 1000 } = {}) {
  return check(await sb.from(table).select(cols).order(order, { ascending: asc }).limit(limit));
}
// Todas las filas de una tabla, de 1000 en 1000 (el servidor no devuelve más de 1000 por petición). Orden por id para que las páginas no se mezclen.
export async function listEvery(table, cols = '*') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const data = check(await sb.from(table).select(cols).order('id', { ascending: true }).range(from, from + 999));
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
export async function getBy(table, col, val) {
  return check(await sb.from(table).select('*').eq(col, val));
}
export async function upsert(table, row, onConflict) {
  return changed(table, check(await sb.from(table).upsert(row, { onConflict }).select().single()));
}
// Guarda varias filas a la vez; si ya existe una con la misma clave (onConflict), la actualiza.
export async function upsertMany(table, rows, onConflict) {
  return changed(table, check(await sb.from(table).upsert(rows, { onConflict }).select()));
}
export async function insert(table, row) {
  return changed(table, check(await sb.from(table).insert(row).select().single()));
}
export async function insertMany(table, rows) {
  return changed(table, check(await sb.from(table).insert(rows).select()));
}
export async function update(table, id, row) {
  return changed(table, check(await sb.from(table).update(row).eq('id', id).select().single()));
}
// Cambia lo mismo en varias filas a la vez (una sola petición).
export async function updateMany(table, ids, row) {
  return changed(table, check(await sb.from(table).update(row).in('id', ids).select()));
}
export async function remove(table, id) {
  check(await sb.from(table).delete().eq('id', id));
  changed(table);
}

// ---------- fotos (Storage privado + URLs firmadas) ----------
const urlCache = new Map(); // path -> { url, exp }
const TTL = 50 * 60 * 1000;

export async function uploadPhoto({ full, thumb }, date, kind) {
  const uid = session.user.id;
  const base = `${uid}/${date}/${kind}-${Date.now()}`;
  const path = `${base}.jpg`;
  const up = (p, blob) => sb.storage.from('photos').upload(p, blob, { contentType: 'image/jpeg', upsert: false });
  const r1 = await up(path, full);
  if (r1.error) throw r1.error;
  const r2 = await up(`${base}_t.jpg`, thumb);
  if (r2.error) { await sb.storage.from('photos').remove([path]); throw r2.error; }
  return path;
}
export const thumbPath = (path) => path.replace(/\.jpg$/, '_t.jpg');

export async function signedUrls(paths) {
  const now = Date.now();
  const need = [...new Set(paths)].filter((p) => !(urlCache.get(p) && urlCache.get(p).exp > now));
  if (need.length) {
    const { data, error } = await sb.storage.from('photos').createSignedUrls(need, 3600);
    if (error) throw error;
    for (const d of data) if (d.signedUrl) urlCache.set(d.path, { url: d.signedUrl, exp: now + TTL });
  }
  return Object.fromEntries(paths.map((p) => [p, urlCache.get(p)?.url || '']));
}

export async function deletePhoto(row) {
  const { error } = await sb.storage.from('photos').remove([row.path, thumbPath(row.path)]);
  if (error) throw error;
  await remove('photos', row.id);
  urlCache.delete(row.path);
  urlCache.delete(thumbPath(row.path));
}
