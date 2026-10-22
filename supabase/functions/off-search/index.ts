// Evolucionapp · función "off-search": busca alimentos en Open Food Facts POR TI.
// Por qué existe: Open Food Facts no deja que una web llame directamente a su buscador (el navegador lo bloquea).
// Esta función lo llama desde el servidor, donde no hay ese bloqueo, y devuelve a la app solo lo necesario.
// Solo la pueden usar personas con sesión iniciada en la app (Supabase comprueba el token antes de ejecutar nada).
//
// Cómo ponerla (una sola vez): Supabase → Edge Functions → Deploy a new function → «Via Editor» → nombre: off-search
// → pega TODO este archivo → Deploy. Deja activada la opción «Verify JWT» (viene así por defecto).

const SITE = 'https://jorgepetisco19-lgtm.github.io'; // única web autorizada a usarla
const SEARCH = 'https://search.openfoodfacts.org/search';
const UA = `Evolucionapp/1.0 (+${SITE}/Evolucionapp/)`; // Open Food Facts pide identificar la app
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; products: unknown[] }>();

const cors = {
  'Access-Control-Allow-Origin': SITE,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

// Se quedan solo los campos que usa la app (y con el mismo formato que el buscador antiguo: { products: [...] }).
export function slim(hit: Record<string, unknown>) {
  const n = (hit.nutriments ?? {}) as Record<string, unknown>;
  const name = typeof hit.product_name === 'string' ? hit.product_name.trim().slice(0, 120) : '';
  if (!name) return null;
  return {
    code: String(hit.code ?? ''),
    product_name: name,
    brands: Array.isArray(hit.brands) ? hit.brands.slice(0, 1).map(String).join(',') : String(hit.brands ?? ''),
    nutriments: {
      'energy-kcal_100g': num(n['energy-kcal_100g']),
      'energy-kj_100g': num(n['energy-kj_100g']),
      proteins_100g: num(n['proteins_100g']),
      carbohydrates_100g: num(n['carbohydrates_100g']),
      fat_100g: num(n['fat_100g']),
    },
  };
}

export async function handle(req: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const origin = req.headers.get('origin');
  if (origin && origin !== SITE) return json({ error: 'forbidden_origin' }, 403);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let q = '';
  try { q = String(((await req.json()) as { q?: unknown }).q ?? '').replace(/\s+/g, ' ').trim(); } catch { /* cuerpo no válido */ }
  if (q.length < 2 || q.length > 80) return json({ error: 'bad_query' }, 400);

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return json({ products: hit.products, cached: true });

  const url = `${SEARCH}?${new URLSearchParams({ q, langs: 'es', page_size: '30', fields: 'code,product_name,brands,nutriments' })}`;
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return json({ error: `off_${res.status}` }, 502);
    const data = await res.json();
    const products = ((data.hits ?? []) as Record<string, unknown>[]).map(slim).filter(Boolean).slice(0, 30) as unknown[];
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), products });
    return json({ products });
  } catch {
    return json({ error: 'off_unreachable' }, 502);
  }
}

if (!Deno.env.get('OFF_TEST')) Deno.serve((req) => handle(req));
