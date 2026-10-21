// Acceso a Supabase: sesión, tablas y fotos. Toda la app habla con la nube a través de este archivo.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (!window.supabase) throw new Error('Supabase no se ha cargado (vendor/supabase.js)');

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // PKCE devuelve el código en ?code=... y no en el #hash, que usamos para navegar entre pantallas.
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

export const session = { user: null };

// ---------- autenticación ----------
export function redirectUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}
export async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
  if (error) throw error;
}
export async function signOut() {
  await sb.auth.signOut();
}

// ---------- tablas ----------
const check = ({ data, error }) => { if (error) throw error; return data; };

export async function listRange(table, from, to, cols = '*', order = 'date') {
  return check(await sb.from(table).select(cols).gte('date', from).lte('date', to).order(order, { ascending: true }));
}
export async function listAll(table, { order = 'date', asc = false, cols = '*', limit = 1000 } = {}) {
  return check(await sb.from(table).select(cols).order(order, { ascending: asc }).limit(limit));
}
export async function getBy(table, col, val) {
  return check(await sb.from(table).select('*').eq(col, val));
}
export async function upsert(table, row, onConflict) {
  return check(await sb.from(table).upsert(row, { onConflict }).select().single());
}
export async function insert(table, row) {
  return check(await sb.from(table).insert(row).select().single());
}
export async function update(table, id, row) {
  return check(await sb.from(table).update(row).eq('id', id).select().single());
}
export async function remove(table, id) {
  check(await sb.from(table).delete().eq('id', id));
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
