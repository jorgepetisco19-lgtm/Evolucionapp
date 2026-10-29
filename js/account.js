// Borrar la cuenta y todos sus datos (v17). Requisito de Google Play para las apps que crean cuentas, y un derecho tuyo en cualquier caso.
// Orden: 1) ensayo en el servidor (si falta el SQL 10 se avisa SIN tocar nada) · 2) borrar los archivos de las fotos · 3) borrar el usuario
// (la base de datos borra con él todas sus filas) · 4) cerrar sesión.
import { sb, listEvery, thumbPath } from './db.js';

export const CONFIRM_WORD = { es: 'BORRAR', en: 'DELETE' };
export const confirmMatches = (typed, lang) => String(typed || '').trim().toUpperCase() === (CONFIRM_WORD[lang] || CONFIRM_WORD.es);

/** ¿El error significa «la función no existe» (no se ha ejecutado supabase/10-borrar-cuenta.sql)? */
export const needsSql = (e) => !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|delete_my_account/i.test(e.message || ''));

/** Los archivos de fotos del usuario (la foto y su miniatura). */
async function photoFiles() {
  const rows = await listEvery('photos', 'id,path');
  return rows.flatMap((r) => (r.path ? [r.path, thumbPath(r.path)] : []));
}

export async function deleteAccount() {
  const dry = await sb.rpc('delete_my_account', { dry_run: true });
  if (dry.error) throw dry.error;
  const files = await photoFiles();
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await sb.storage.from('photos').remove(files.slice(i, i + 100));
    if (error) throw error;
  }
  const { error } = await sb.rpc('delete_my_account', { dry_run: false });
  if (error) throw error;
  try { localStorage.removeItem('evo.reminders'); } catch { /* sin almacenamiento */ }
  try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { console.warn(e); } // solo en este móvil (la cuenta ya no existe en el servidor)
  return { photos: files.length / 2 };
}
