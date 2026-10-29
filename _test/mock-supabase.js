// SOLO PARA PRUEBAS: imita lo mínimo de supabase-js (auth, tablas y storage) en memoria.
(function () {
  const UID = '11111111-1111-1111-1111-111111111111';
  const db = {};
  const blobs = new Map();
  let idn = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++idn).padStart(12, '0')}`;
  const listeners = [];
  const loggedIn = () => sessionStorage.getItem('mockUser') === '1';
  const user = { id: sessionStorage.getItem('mockUid') || UID, email: 'test@example.com' };
  const UNIQUE = { weigh_ins: ['date'], measurements: ['date'], profiles: ['user_id'], ingredients: ['key'] };
  window.__mockDb = db;
  window.__mockLog = [];

  class Q {
    constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.ord = null; this.lim = null; this.ret = false; this.one = false; }
    select() { if (this.op !== 'select') this.ret = true; return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    upsert(row, opts) { this.op = 'upsert'; this.row = row; this.conflict = opts && opts.onConflict; return this; }
    update(row) { this.op = 'update'; this.row = row; return this; }
    delete() { this.op = 'delete'; return this; }
    gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
    lte(c, v) { this.filters.push((r) => r[c] <= v); return this; }
    in(c, vs) { this.filters.push((r) => vs.includes(r[c])); return this; }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    order(c, o) { this.ord = [c, !(o && o.ascending === false)]; return this; }
    limit(n) { this.lim = n; return this; }
    range(a, b) { this.rng = [a, b]; return this; }
    single() { this.one = true; return this; }
    then(res, rej) { return Promise.resolve().then(() => (window.__mockDelay ? new Promise((r) => setTimeout(r, window.__mockDelay)) : null)).then(() => this.run()).then(res, rej); }
    run() {
      const rows = (db[this.table] ||= []);
      window.__mockLog.push([this.op, this.table]);
      if (window.__mockError) { const err = window.__mockError(this.op, this.table, this.row); if (err) return { data: null, error: err }; }
      if (window.__mockMissing && window.__mockMissing.includes(this.table)) return { data: null, error: { message: `relation "public.${this.table}" does not exist` } };
      try {
        if (this.op === 'select') {
          let out = rows.filter((r) => this.filters.every((f) => f(r)));
          if (this.ord) { const [c, asc] = this.ord; out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
          if (this.rng) out = out.slice(this.rng[0], this.rng[1] + 1);
          if (this.lim) out = out.slice(0, this.lim);
          return { data: out.map((r) => ({ ...r })), error: null };
        }
        if (this.op === 'insert' && Array.isArray(this.row)) {
          const made = this.row.map((r) => ({ id: uuid(), user_id: UID, created_at: new Date(Date.now() + idn).toISOString(), ...r }));
          rows.push(...made);
          return { data: made.map((r) => ({ ...r })), error: null };
        }
        if (this.op === 'upsert' && Array.isArray(this.row)) {
          const keys = UNIQUE[this.table] || [];
          const out = this.row.map((r0) => {
            const ex = keys.length && rows.find((r) => r.user_id === UID && keys.every((k) => r[k] === r0[k]));
            if (ex) { Object.assign(ex, r0); return { ...ex }; }
            const row = { id: uuid(), user_id: UID, created_at: new Date(Date.now() + idn).toISOString(), ...r0 };
            rows.push(row); return { ...row };
          });
          return { data: out, error: null };
        }
        if (this.op === 'insert' || this.op === 'upsert') {
          const row = { id: uuid(), user_id: UID, created_at: new Date(Date.now() + idn).toISOString(), ...this.row };
          const keys = UNIQUE[this.table];
          if (keys) {
            const ex = rows.find((r) => r.user_id === UID && keys.every((k) => r[k] === row[k]));
            if (ex) {
              if (this.op === 'insert') return { data: null, error: { message: 'duplicate key' } };
              Object.assign(ex, this.row); return { data: this.one ? { ...ex } : [{ ...ex }], error: null };
            }
          }
          rows.push(row);
          return { data: this.one ? { ...row } : [{ ...row }], error: null };
        }
        if (this.op === 'update') {
          const hit = rows.filter((r) => this.filters.every((f) => f(r)));
          hit.forEach((r) => Object.assign(r, this.row));
          return { data: this.one ? (hit[0] ? { ...hit[0] } : null) : hit.map((r) => ({ ...r })), error: null };
        }
        if (this.op === 'delete') {
          db[this.table] = rows.filter((r) => !this.filters.every((f) => f(r)));
          return { data: null, error: null };
        }
      } catch (e) { return { data: null, error: { message: String(e) } }; }
      return { data: null, error: { message: 'op?' } };
    }
  }

  window.supabase = {
    createClient() {
      return {
        auth: {
          getSession: async () => ({ data: { session: loggedIn() ? { user } : null } }),
          onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
          signInWithOAuth: async (args) => { window.__oauthCalled = true; window.__oauthArgs = args; return { data: { url: 'https://accounts.example/login?provider=google' }, error: null }; },
          // Login de la APK: al volver con ?code=..., se "inicia sesión" (en pruebas, window.__exchangeError fuerza un fallo).
          exchangeCodeForSession: async (code) => {
            window.__exchanged = code;
            if (window.__exchangeError) return { data: null, error: { message: window.__exchangeError } };
            sessionStorage.setItem('mockUser', '1');
            listeners.forEach((f) => f('SIGNED_IN', { user }));
            return { data: { session: { user } }, error: null };
          },
          signOut: async () => { sessionStorage.removeItem('mockUser'); listeners.forEach((f) => f('SIGNED_OUT', null)); return { error: null }; },
        },
        // Funciones de Supabase (Edge Functions): en pruebas, window.__mockFunctions = { 'off-search': (body) => ({ products: [...] }) } o lanza error.
        functions: {
          invoke: async (name, opts) => {
            window.__mockLog.push(['invoke', name]);
            const fn = window.__mockFunctions && window.__mockFunctions[name];
            if (!fn) return { data: null, error: { name: 'FunctionsHttpError', message: 'Requested function was not found', context: { status: 404 } } };
            try { return { data: await fn(opts && opts.body), error: null }; } catch (e) { return { data: null, error: { name: 'FunctionsHttpError', message: String(e) } }; }
          },
        },
        // Funciones SQL (rpc): delete_my_account(dry_run). En pruebas, window.__rpcError fuerza un fallo; window.__rpcMissing simula que falta el SQL.
        rpc: async (name, args) => {
          window.__mockLog.push(['rpc', name, args && args.dry_run ? 'dry' : '']);
          if (window.__rpcMissing) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + name + ' in the schema cache' } };
          if (window.__rpcError && !(args && args.dry_run)) return { data: null, error: window.__rpcError };
          if (name !== 'delete_my_account') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
          if (!(args && args.dry_run)) { for (const k of Object.keys(db)) db[k] = db[k].filter((r) => r.user_id !== user.id); window.__accountDeleted = true; }
          return { data: null, error: null };
        },
        from: (table) => new Q(table),
        storage: {
          from: () => ({
            upload: async (path, blob) => { blobs.set(path, blob); return { data: { path }, error: null }; },
            remove: async (paths) => { (window.__removedPaths ||= []).push(...paths); if (window.__storageError) return { data: null, error: { message: window.__storageError } }; paths.forEach((p) => blobs.delete(p)); return { data: null, error: null }; },
            createSignedUrls: async (paths) => ({
              data: paths.map((p) => ({ path: p, signedUrl: blobs.has(p) ? URL.createObjectURL(blobs.get(p)) : '' })), error: null,
            }),
          }),
        },
      };
    },
  };
})();
