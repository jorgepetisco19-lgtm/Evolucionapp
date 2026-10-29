// Health Connect (solo en la APK de Android): lee los entrenos que tu reloj deja en el «buzón de salud» del móvil.
// Todo se lee en el propio móvil: no pasa por ningún servidor. La app solo LEE (entrenos, pulsaciones, calorías activas y distancia).
import { isNative } from './db.js';
import { fmtDate } from './util.js';

const READ = ['workouts', 'heartRate', 'distance', 'calories'];
const plugin = () => window.Capacitor.registerPlugin('Health');

/** ¿Está el plugin en esta APK? (en la web normal, y en APK antiguas, no: el botón no se muestra). */
export function healthSupported() {
  try {
    return isNative() && typeof window.Capacitor.isPluginAvailable === 'function' && window.Capacitor.isPluginAvailable('Health');
  } catch { return false; }
}

// Tipo de Health Connect → tipos de Evolucionapp. Los de raqueta se proponen como pádel (Health Connect no tiene pádel); se puede cambiar al editar.
const TYPE_MAP = {
  run: ['running', 'runningTreadmill', 'trackAndField'],
  walk: ['walking', 'hiking', 'stairs', 'stairClimbing', 'stairClimbingMachine', 'snowshoeing'],
  cycling: ['cycling', 'bikingStationary', 'handCycling'],
  swim: ['swimming', 'swimmingPool', 'swimmingOpenWater', 'waterFitness'],
  gym: ['strengthTraining', 'traditionalStrengthTraining', 'functionalStrengthTraining', 'weightlifting', 'crossTraining', 'highIntensityIntervalTraining',
    'bootCamp', 'calisthenics', 'elliptical', 'rowing', 'rowingMachine', 'coreTraining', 'exerciseClass', 'stepTraining', 'jumpRope', 'benchPress',
    'deadlift', 'latPullDown', 'lunge', 'plank', 'burpee', 'crunch', 'jumpingJack', 'backExtension', 'barbellShoulderPress', 'benchSitUp'],
  padel: ['tennis', 'squash', 'badminton', 'racquetball', 'tableTennis', 'pickleball'],
};
const BY_RAW = Object.fromEntries(Object.entries(TYPE_MAP).flatMap(([k, list]) => list.map((r) => [r, k])));
export const mapType = (raw) => BY_RAW[raw] || 'other';

const round = (n, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };

/** Convierte un entreno de Health Connect en lo que se ve en la lista de importar. */
export function toCandidate(w) {
  const start = new Date(w.startDate);
  const secs = Number(w.duration) || 0;
  return {
    id: w.platformId || `${w.startDate}|${w.workoutType}`,           // identificador para no importarlo dos veces
    raw: w.workoutType,
    type: mapType(w.workoutType),
    date: fmtDate(start),                                           // día en hora local
    time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    start: w.startDate,
    end: w.endDate,
    duration_min: secs > 0 ? Math.max(1, Math.round(secs / 60)) : null,
    calories_kcal: Number(w.totalEnergyBurned) > 0 ? Math.round(w.totalEnergyBurned) : null,
    distance_km: Number(w.totalDistance) > 0 ? round(w.totalDistance / 1000, 2) : null,
    source: w.sourceName || '',
  };
}

/**
 * Pide permiso (solo la primera vez Android muestra su pantalla) y devuelve el estado:
 * { ok:true, hr } · { ok:false, reason:'unavailable'|'denied', detail }
 */
export async function ensureAccess() {
  const H = plugin();
  const a = await H.isAvailable();
  if (!a || !a.available) return { ok: false, reason: 'unavailable', detail: (a && a.reason) || '' };
  const st = await H.requestAuthorization({ read: READ });
  const got = (st && st.readAuthorized) || [];
  if (!got.includes('workouts')) return { ok: false, reason: 'denied' };
  return { ok: true, hr: got.includes('heartRate') };
}

/** Entrenos de los últimos `days` días (Health Connect solo deja leer unos 30 sin un permiso extra), el más reciente primero. */
export async function recentWorkouts(days = 30) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const res = await plugin().queryWorkouts({ startDate: start.toISOString(), endDate: end.toISOString(), limit: 60, ascending: false });
  return ((res && res.workouts) || []).map(toCandidate);
}

/** Pulsaciones media y máxima durante un entreno (null si el reloj no dejó muestras o no hay permiso). */
export async function heartStats(c) {
  try {
    const res = await plugin().readSamples({ dataType: 'heartRate', startDate: c.start, endDate: c.end, limit: 20000, ascending: true });
    const v = ((res && res.samples) || []).map((s) => Number(s.value)).filter((x) => x >= 30 && x <= 250);
    if (!v.length) return { hr_avg: null, hr_max: null };
    return { hr_avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), hr_max: Math.round(Math.max(...v)) };
  } catch (e) {
    console.warn(e);
    return { hr_avg: null, hr_max: null };
  }
}

/** Fila lista para guardar en la tabla workouts. */
export function toRow(c, hr = {}) {
  const row = { date: c.date, type: c.type, name: null, duration_min: c.duration_min, notes: null, exercises: [], source: 'health_connect', external_id: c.id };
  if (c.calories_kcal != null && c.calories_kcal <= 20000) row.calories_kcal = c.calories_kcal;
  if (c.distance_km != null && c.distance_km <= 1000) row.distance_km = c.distance_km;
  if (hr.hr_avg != null) row.hr_avg = hr.hr_avg;
  if (hr.hr_max != null) row.hr_max = hr.hr_max;
  return row;
}

/**
 * Datos del reloj que se pueden AÑADIR a un entreno que ya existe: solo los campos que estén vacíos (nunca pisa lo tuyo).
 * Se le pone el identificador de Health Connect para que no se ofrezca otra vez.
 */
export function mergePatch(existing, row) {
  const patch = {};
  for (const k of ['duration_min', 'calories_kcal', 'distance_km', 'hr_avg', 'hr_max']) if (existing[k] == null && row[k] != null) patch[k] = row[k];
  const avg = patch.hr_avg ?? existing.hr_avg, max = patch.hr_max ?? existing.hr_max;
  if (avg != null && max != null && avg > max) { delete patch.hr_avg; delete patch.hr_max; } // evitaría media > máxima: no se tocan las pulsaciones
  patch.external_id = row.external_id;
  return patch;
}

export const openHealthSettings = () => plugin().openHealthConnectSettings();
