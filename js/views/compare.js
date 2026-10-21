// Comparador: eliges dos fechas en el calendario y ves las fotos del mismo tipo una al lado de otra,
// junto con la diferencia de peso, composición corporal y medidas entre esas dos fechas.
import { listAll, signedUrls } from '../db.js';
import { renderCalendar, buildMarkers } from '../calendar.js';
import { FIELDS, MEASURES } from '../fields.js';
import { html, setHtml, on, num, signed, dateShort, dateTiny, daysBetween, parseDate, todayStr, refresh } from '../util.js';
import { t } from '../i18n.js';

const KINDS = ['front', 'side', 'back'];
const st = { kind: 'front', A: null, B: null, picking: 'A', y: null, m: null, init: false };
const MEASURE_FIELDS = MEASURES.map((key) => ({ key, unit: 'cm', step: 0.1 }));
const decOf = (f) => (f.step >= 1 ? 0 : f.step >= 0.1 ? 1 : 2);

// Valor de un campo en una fecha: el de ese día o, si no hay, el último anterior (máx. 30 días atrás).
export function valueAt(rows, date, key) {
  let best = null;
  for (const r of rows) {
    if (r[key] == null || r.date > date) continue;
    if (!best || r.date > best.date) best = r;
  }
  if (!best) return null;
  if (daysBetween(best.date, date) > 30) return null;
  return { v: Number(best[key]), date: best.date, exact: best.date === date };
}

export async function renderCompare(el) {
  const [photos, weigh, meas] = await Promise.all([
    listAll('photos', { order: 'date', asc: true, limit: 1000 }),
    listAll('weigh_ins', { asc: true }),
    listAll('measurements', { asc: true }),
  ]);
  const photoDates = (kind) => [...new Set(photos.filter((p) => p.kind === kind).map((p) => p.date))].sort();
  const preselect = () => {
    const ds = photoDates(st.kind);
    st.A = ds.length > 1 ? ds[0] : null;
    st.B = ds.length > 1 ? ds[ds.length - 1] : ds.length === 1 ? ds[0] : null;
    st.picking = 'A';
    const ref = st.B || todayStr();
    const d = parseDate(ref);
    st.y = d.getFullYear(); st.m = d.getMonth();
  };
  // Se preselecciona la primera vez, al cambiar de tipo, y también si antes no había fotos y ahora sí.
  if (!st.init || (st.A === null && st.B === null)) { preselect(); st.init = true; }
  if (st.y === null) { const n = new Date(); st.y = n.getFullYear(); st.m = n.getMonth(); }

  setHtml(el, html`
    <div class="card">
      <div class="chips" id="cmp-kinds">${KINDS.map((k) => html`<button class="chip ${st.kind === k ? 'on' : ''}" data-kind="${k}">${t('photos.kind.' + k)}</button>`)}</div>
      <p class="muted small">${t('cmp.help')}</p>
      <div class="pick-chips">
        <button class="pick ${st.picking === 'A' ? 'on' : ''}" data-pick="A"><b>A</b><span>${st.A ? dateShort(st.A) : t('cmp.choose')}</span></button>
        <button class="pick ${st.picking === 'B' ? 'on' : ''}" data-pick="B"><b>B</b><span>${st.B ? dateShort(st.B) : t('cmp.choose')}</span></button>
      </div>
      <div id="cmp-cal"></div>
    </div>
    <div id="cmp-result"></div>`);

  const calEl = el.querySelector('#cmp-cal');
  const paint = () => {
    const markers = buildMarkers({
      weight: weigh, measures: meas, photos: photos.filter((p) => p.kind === st.kind),
    });
    const selected = {};
    if (st.A) selected[st.A] = 'A';
    if (st.B) selected[st.B] = st.B === st.A ? 'A·B' : 'B';
    renderCalendar(calEl, {
      year: st.y, month: st.m, markers, selected, legendKinds: ['weight', 'measures', 'photos'],
      onPick: (d) => {
        st[st.picking] = d;
        st.picking = st.picking === 'A' ? 'B' : 'A';
        redrawAll();
      },
      onMonth: (y, m) => { st.y = y; st.m = m; paint(); },
    });
  };
  const redrawAll = () => { updateChips(); paint(); result(); };
  const updateChips = () => {
    el.querySelectorAll('[data-pick]').forEach((b) => {
      b.classList.toggle('on', b.dataset.pick === st.picking);
      b.querySelector('span').textContent = st[b.dataset.pick] ? dateShort(st[b.dataset.pick]) : t('cmp.choose');
    });
  };
  const result = async () => {
    const box = el.querySelector('#cmp-result');
    if (!st.A || !st.B) { setHtml(box, html`<div class="card empty"><p>${t('cmp.pickBoth')}</p></div>`); return; }
    const [d1, d2] = st.A <= st.B ? [st.A, st.B] : [st.B, st.A];
    const latest = (d) => photos.filter((p) => p.kind === st.kind && p.date === d).sort((a, b) => (a.created_at > b.created_at ? 1 : -1)).pop();
    const p1 = latest(d1), p2 = latest(d2);
    const urls = await signedUrls([p1, p2].filter(Boolean).map((p) => p.path));
    const fig = (p, d, label) => html`<figure>
      ${p ? html`<img src="${urls[p.path]}" alt="${label}">` : html`<div class="no-photo">${t('cmp.noPhoto')}</div>`}
      <figcaption><b>${label}</b> ${dateShort(d)}</figcaption>
    </figure>`;
    const mk = (rows, fields) => fields.map((f) => {
      const a = valueAt(rows, d1, f.key), b = valueAt(rows, d2, f.key);
      return { f, a, b };
    }).filter((x) => x.a || x.b);
    const lines = [...mk(weigh, FIELDS), ...mk(meas, MEASURE_FIELDS)];
    const cell = (x) => (x ? html`${num(x.v, 2)}${x.exact ? '' : html`<small class="muted"> (${dateTiny(x.date)})</small>`}` : '—');
    setHtml(box, html`
      <div class="card">
        <div class="pair">${fig(p1, d1, t('cmp.before'))}${fig(p2, d2, t('cmp.after'))}</div>
        <p class="muted small center">${t('cmp.days', { n: daysBetween(d1, d2) })}</p>
      </div>
      <div class="card">
        <h3>${t('cmp.differences')}</h3>
        ${lines.length === 0 ? html`<p class="muted">${t('cmp.noData')}</p>` : html`
        <table class="diff">
          <thead><tr><th></th><th>${dateTiny(d1)}</th><th>${dateTiny(d2)}</th><th>Δ</th></tr></thead>
          <tbody>${lines.map(({ f, a, b }) => {
            const dec = decOf(f);
            const delta = a && b ? b.v - a.v : null;
            return html`<tr>
              <th scope="row">${t('f.' + f.key)}${f.unit ? html` <small class="muted">${f.unit}</small>` : ''}</th>
              <td>${cell(a)}</td><td>${cell(b)}</td>
              <td class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}"><b>${delta === null ? '—' : signed(delta, dec)}</b></td>
            </tr>`;
          })}</tbody>
        </table>`}
      </div>`);
  };

  on(el, 'click', '#cmp-kinds [data-kind]', (e, b) => { st.kind = b.dataset.kind; st.init = false; refresh(); });
  on(el, 'click', '[data-pick]', (e, b) => { st.picking = b.dataset.pick; updateChips(); });
  paint();
  await result();
}
