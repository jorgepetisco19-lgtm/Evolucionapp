// Red: todas las peticiones a Supabase pasan por aquí para que ninguna se quede colgada para siempre.
// Si una petición no responde a tiempo se corta y la pantalla enseña el error con "Reintentar" (en vez de un círculo eterno).
// Las lecturas (GET) se reintentan solas una vez, porque repetirlas no tiene riesgo; las escrituras no, para no duplicar nada.
const limit = () => globalThis.__NET_TIMEOUT_MS || 12000;
const SLOW = /\/storage\/v1\//; // fotos: subirlas puede tardar bastante más

const msg = () => (document.documentElement.lang === 'en'
  ? 'The connection is too slow or has dropped. Check your internet and try again.'
  : 'La conexión va muy lenta o se ha cortado. Revisa tu internet y vuelve a intentarlo.');

async function once(input, init, ms) {
  const ctl = new AbortController();
  const outer = init.signal;
  const forward = () => ctl.abort();
  if (outer) { if (outer.aborted) ctl.abort(); else outer.addEventListener('abort', forward, { once: true }); }
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, ms);
  try {
    return await fetch(input, { ...init, signal: ctl.signal });
  } catch (e) {
    if (timedOut) { const err = new Error(msg()); err.code = 'timeout'; throw err; }
    throw e;
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener('abort', forward);
  }
}

export async function fetchWithTimeout(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  const method = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
  const ms = SLOW.test(url) ? limit() * 5 : limit();
  try {
    return await once(input, init, ms);
  } catch (e) {
    const retryable = (method === 'GET' || method === 'HEAD') && !(init.signal && init.signal.aborted) && (e.code === 'timeout' || e instanceof TypeError);
    if (!retryable) throw e;
    return once(input, init, ms);
  }
}
