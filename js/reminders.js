// Avisos (v15, solo en la APK): dos recordatorios opcionales («pésate» y «registra tu entreno») que el propio móvil lanza a la hora que elijas.
// No hay servidor ni cuenta: los ajustes viven en este móvil (localStorage) y las notificaciones las programa Android.
// Se programan los PRÓXIMOS 14 DÍAS, uno a uno, y se vuelven a programar cada vez que abres la app o guardas un peso/entreno:
// así, si ese día ya lo has registrado, ese aviso no se manda; y si dejas de usar la app unas dos semanas, los avisos se acaban solos.
import { isNative, sb, session } from './db.js';
import { addDays, daysBetween, fmtDate, parseDate, todayStr } from './util.js';
import { getLang, onLangChange } from './i18n.js';

export const KINDS = ['weigh', 'workout'];
export const HORIZON = 14;
const KEY = 'evo.reminders';
const CHANNEL = 'recordatorios';
const BASE_ID = { weigh: 100, workout: 200 };   // el aviso del día +n tiene id base+n
const TEST_ID = 999;
const ICON = 'ic_stat_evolucionapp';
const ROUTE = { weigh: '#/body', workout: '#/sport' }; // a dónde lleva tocar el aviso
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // 0 = lunes
const DEFAULTS = {
  weigh: { on: false, time: '09:00', days: ALL_DAYS },
  workout: { on: false, time: '21:00', days: ALL_DAYS },
};

// Textos cortos y sin culpa. Se alternan según el día para que no sea siempre la misma frase.
const TEXT = {
  es: {
    weigh: ['¿Te has pesado hoy? Un minuto y listo.', 'Buen momento para anotar tu peso de hoy.', 'Apunta tu peso de hoy y sigue viendo tu evolución.'],
    workout: ['¿Has entrenado hoy? Apúntalo, aunque haya sido poco.', 'Si hoy te has movido, apúntalo en Deporte.', 'Registra tu entreno de hoy. Si tocaba descansar, ¡sin problema!'],
  },
  en: {
    weigh: ['Have you weighed in today? One minute and done.', 'Good time to log today’s weight.', 'Log today’s weight and keep seeing your progress.'],
    workout: ['Did you train today? Log it, even if it was short.', 'If you moved today, log it in Sport.', 'Log today’s workout. If it was a rest day, no worries!'],
  },
};

// ---------- ajustes (en este móvil) ----------
const validTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Deja los ajustes en una forma segura aunque el valor guardado esté a medias o estropeado. */
export function normalize(raw) {
  const out = {};
  for (const k of KINDS) {
    const r = (raw && typeof raw === 'object' && raw[k]) || {};
    const days = Array.isArray(r.days) ? [...new Set(r.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
    out[k] = { on: r.on === true, time: validTime(r.time) ? r.time : DEFAULTS[k].time, days: days.length ? days : [...ALL_DAYS] };
  }
  return out;
}
export function loadSettings() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch { return normalize(null); }
}
export function saveSettings(s) {
  const v = normalize(s);
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* sin almacenamiento: los ajustes valdrán hasta cerrar la app */ }
  return v;
}

// ---------- qué avisos tocan (función pura) ----------
/**
 * Lista de avisos a programar. `done` = { weigh, workout } indica si HOY ya está registrado (solo afecta al día de hoy).
 * No se programa nada que ya haya pasado (o que falte menos de un minuto).
 */
export function buildPlan({ settings, now = new Date(), done = {}, lang = 'es' }) {
  const s = normalize(settings);
  const texts = TEXT[lang] || TEXT.es;
  const today = fmtDate(now);
  const out = [];
  for (const kind of KINDS) {
    const cfg = s[kind];
    if (!cfg.on) continue;
    const [h, m] = cfg.time.split(':').map(Number);
    for (let off = 0; off < HORIZON; off++) {
      const day = addDays(today, off);
      const wd = (parseDate(day).getDay() + 6) % 7;
      if (!cfg.days.includes(wd)) continue;
      if (off === 0 && done[kind]) continue;
      const at = parseDate(day);
      at.setHours(h, m, 0, 0);
      if (at.getTime() <= now.getTime() + 60000) continue;
      const variants = texts[kind];
      out.push({ id: BASE_ID[kind] + off, kind, day, at, body: variants[Math.abs(daysBetween('2024-01-01', day)) % variants.length], route: ROUTE[kind] });
    }
  }
  return out;
}

const allIds = () => KINDS.flatMap((k) => Array.from({ length: HORIZON }, (_, i) => ({ id: BASE_ID[k] + i })));

// ---------- plugin de Android ----------
const plugin = () => window.Capacitor.registerPlugin('LocalNotifications');

/** ¿Esta APK trae el plugin de avisos? (en la web normal, y en APK antiguas, no: la pantalla lo explica). */
export function remindersSupported() {
  try {
    return isNative() && typeof window.Capacitor.isPluginAvailable === 'function' && window.Capacitor.isPluginAvailable('LocalNotifications');
  } catch { return false; }
}

/** 'granted' | 'denied' | 'prompt' (sin preguntar nada al usuario). */
export async function permission() {
  const r = await plugin().checkPermissions();
  const d = r && r.display;
  return d === 'granted' ? 'granted' : d === 'denied' ? 'denied' : 'prompt';
}
/** Pide el permiso de notificaciones si hace falta (en Android 13+ sale el cuadro del sistema). true = se puede avisar. */
export async function askPermission() {
  if ((await permission()) === 'granted') return true;
  const r = await plugin().requestPermissions();
  return !!r && r.display === 'granted';
}

async function ensureChannel() {
  try {
    await plugin().createChannel({ id: CHANNEL, name: 'Recordatorios / Reminders', description: 'Pesarte · Registrar tu entreno', importance: 3, visibility: 1 });
  } catch (e) { console.warn(e); } // si ya existe o falla, se usa el canal por defecto
}

const toNotification = (p, title = 'Evolucionapp') => ({
  id: p.id, title, body: p.body,
  schedule: { at: p.at, allowWhileIdle: true }, // allowWhileIdle: que llegue aunque el móvil esté en reposo
  isExactNotification: false,                    // «sobre las 21:00», no al segundo: así no hace falta el permiso especial de alarmas exactas
  channelId: CHANNEL, smallIcon: ICON, iconColor: '#2F6FED', autoCancel: true,
  extra: { route: p.route },
});

async function hasRow(table, date) {
  try {
    const { data, error } = await sb.from(table).select('id').eq('date', date).limit(1);
    if (error) throw error;
    return !!(data && data.length);
  } catch (e) { console.warn(e); return false; } // sin conexión: se programa igual (mejor un aviso de más que ninguno)
}
const doneToday = async () => {
  const d = todayStr();
  const [weigh, workout] = await Promise.all([hasRow('weigh_ins', d), hasRow('workouts', d)]);
  return { weigh, workout };
};

async function applySchedule() {
  if (!remindersSupported() || !session.user) return;
  const s = loadSettings();
  const P = plugin();
  await P.cancel({ notifications: allIds() });
  if (!KINDS.some((k) => s[k].on)) return;
  if ((await permission()) !== 'granted') return; // sin permiso no se programa nada; la pantalla de Ajustes lo avisa
  await ensureChannel();
  const plan = buildPlan({ settings: s, now: new Date(), done: await doneToday(), lang: getLang() });
  if (plan.length) await P.schedule({ notifications: plan.map((p) => toNotification(p)) });
}

// Las programaciones van de una en una; si piden otra mientras se hace una, se repite una sola vez al terminar.
let running = null, again = false;
/** Borra y vuelve a programar los avisos con los ajustes y los datos de ahora. */
export function reschedule() {
  if (running) { again = true; return running; }
  running = (async () => {
    try { do { again = false; await applySchedule(); } while (again); } catch (e) { console.warn(e); } finally { running = null; }
  })();
  return running;
}

/** Quita todos los avisos (al cerrar sesión). */
export async function cancelAll() {
  try { if (remindersSupported()) await plugin().cancel({ notifications: [...allIds(), { id: TEST_ID }] }); } catch (e) { console.warn(e); }
}

/** Aviso de prueba dentro de 5 segundos: sirve para comprobar el permiso y los ajustes de batería del móvil. */
export async function sendTest() {
  if (!(await askPermission())) return { ok: false, reason: 'denied' };
  await ensureChannel();
  const body = (getLang() === 'en' ? 'This is a test reminder. It works!' : 'Este es un aviso de prueba. ¡Funciona!');
  await plugin().schedule({ notifications: [toNotification({ id: TEST_ID, at: new Date(Date.now() + 5000), body, route: ROUTE.weigh })] });
  return { ok: true };
}

// ---------- arranque ----------
let started = false;
const SAFE_ROUTES = new Set(Object.values(ROUTE));
/**
 * Se llama cada vez que se entra en la app con sesión. La primera vez engancha los oyentes (tocar un aviso abre la pantalla que toca;
 * reprogramar cuando cambian los datos, al volver a la app o al cambiar de idioma); siempre reprograma.
 */
export function initReminders() {
  if (!remindersSupported()) return;
  if (!started) {
    started = true;
    try {
      Promise.resolve(plugin().addListener('localNotificationActionPerformed', (a) => {
        const r = a && a.notification && a.notification.extra && a.notification.extra.route;
        if (SAFE_ROUTES.has(r)) location.hash = r;
      })).catch((e) => console.warn(e));
    } catch (e) { console.warn(e); }
    let timer = null;
    const later = () => { clearTimeout(timer); timer = setTimeout(reschedule, 600); };
    window.addEventListener('evo:data', later);                                                                  // se guarda un peso o un entreno
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later(); }); // vuelves a la app
    onLangChange(later);                                                                                         // los textos cambian de idioma
    window.addEventListener('evo:logout', () => { cancelAll(); });                                               // otra persona podría entrar en este móvil
  }
  reschedule();
}
