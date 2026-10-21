// Perfil guardado + último peso -> plan de kcal. Lo usan la pantalla de perfil y el diario de comidas.
import { listAll, sb, session } from './db.js';
import { plan } from './nutrition.js';

export async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*').limit(1);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

// Último pesaje registrado (peso, báscula y fecha), o null.
export async function latestWeighIn() {
  const rows = await listAll('weigh_ins', { order: 'date', asc: false, limit: 30 });
  const r = rows.find((x) => x.weight_kg != null);
  if (!r) return null;
  const withBmr = rows.find((x) => x.bmr_kcal != null);
  return { kg: Number(r.weight_kg), date: r.date, scaleBmr: withBmr ? Number(withBmr.bmr_kcal) : null };
}

export async function saveProfile(row) {
  const { data, error } = await sb.from('profiles').upsert({ ...row, user_id: session.user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select().single();
  if (error) throw error;
  return data;
}

// Para el diario de comidas: devuelve el plan o null (también si aún no existe la tabla o el perfil).
export async function currentPlan() {
  try {
    const [profile, w] = await Promise.all([loadProfile(), latestWeighIn()]);
    if (!profile) return null;
    const kg = w ? w.kg : Number(profile.weight_kg) || null;
    return plan(profile, kg);
  } catch {
    return null;
  }
}
