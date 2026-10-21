// Fotos: galería por tipo (frontal / lateral / espalda) y comparador de dos fechas.
import { listAll, insert, uploadPhoto, signedUrls, thumbPath, deletePhoto } from '../db.js';
import {
  html, raw, setHtml, on, openModal, spinner, todayStr, dateShort, dateLong, fail, toast, navigate, refresh, confirmBox, compressImage,
} from '../util.js';
import { t } from '../i18n.js';
import { ICONS } from '../icons.js';

export const KINDS = ['front', 'side', 'back'];
let filter = 'all';

export async function render(el, params) {
  const tab = params.tab === 'compare' ? 'compare' : 'gallery';
  setHtml(el, html`
    <div class="seg" role="tablist">
      <button data-tab="gallery" class="${tab === 'gallery' ? 'on' : ''}">${t('photos.gallery')}</button>
      <button data-tab="compare" class="${tab === 'compare' ? 'on' : ''}">${t('photos.compare')}</button>
    </div>
    <div id="photos-content"></div>`);
  on(el, 'click', '.seg [data-tab]', (e, b) => navigate('photos', { tab: b.dataset.tab }));
  const box = el.querySelector('#photos-content');
  if (tab === 'compare') {
    const { renderCompare } = await import('./compare.js');
    await renderCompare(box);
  } else {
    await renderGallery(box, params);
  }
}

async function renderGallery(el, params) {
  const rows = await listAll('photos', { order: 'date', asc: false, limit: 600 });
  const dateFilter = params.date || '';
  const draw = async () => {
    let list = rows.filter((r) => (filter === 'all' || r.kind === filter) && (!dateFilter || r.date === dateFilter));
    list = list.slice(0, 120);
    const urls = list.length ? await signedUrls(list.map((r) => thumbPath(r.path))) : {};
    const groups = [];
    for (const r of list) {
      let g = groups[groups.length - 1];
      if (!g || g.date !== r.date) { g = { date: r.date, items: [] }; groups.push(g); }
      g.items.push(r);
    }
    setHtml(el, html`
      <div class="row-actions">
        <button class="btn primary" id="add-photo">${raw(ICONS.camera)}<span>${t('photos.add')}</span></button>
      </div>
      <div class="chips" role="group">
        ${['all', ...KINDS].map((k) => html`<button class="chip ${filter === k ? 'on' : ''}" data-filter="${k}">${t(k === 'all' ? 'photos.all' : 'photos.kind.' + k)}</button>`)}
        ${dateFilter ? html`<button class="chip on" data-clear-date>${dateShort(dateFilter)} ✕</button>` : ''}
      </div>
      ${groups.length === 0
        ? html`<div class="card empty"><p>${t('photos.empty')}</p></div>`
        : groups.map((g) => html`
          <div class="card">
            <h3>${dateLong(g.date)}</h3>
            <div class="thumbs">
              ${g.items.map((r) => html`<button class="thumb" data-id="${r.id}" aria-label="${t('photos.kind.' + r.kind)}">
                <img src="${urls[thumbPath(r.path)]}" alt="" loading="lazy"><span>${t('photos.kind.' + r.kind)}</span>
              </button>`)}
            </div>
          </div>`)}`);
  };
  on(el, 'click', '[data-filter]', (e, b) => { filter = b.dataset.filter; draw(); });
  on(el, 'click', '[data-clear-date]', () => navigate('photos', { tab: 'gallery' }));
  on(el, 'click', '#add-photo', () => openUpload(params.date || todayStr()));
  on(el, 'click', '.thumb', (e, b) => openViewer(rows.find((r) => r.id === b.dataset.id)));
  await draw();
  if (params.add) {
    history.replaceState({}, '', `#/photos?tab=gallery${params.date ? '&date=' + params.date : ''}`);
    openUpload(params.date || todayStr());
  }
}

// ---------- subir foto ----------
function openUpload(date) {
  let file = null;
  let kind = 'front';
  const m = openModal(html`
    <form id="up-form">
      <label class="field"><span>${t('common.date')}</span><input type="date" name="date" value="${date}" required></label>
      <div class="field"><span>${t('photos.type')}</span>
        <div class="chips" id="kinds">${KINDS.map((k) => html`<button type="button" class="chip ${k === kind ? 'on' : ''}" data-kind="${k}">${t('photos.kind.' + k)}</button>`)}</div>
      </div>
      <div class="field"><span>${t('photos.picture')}</span>
        <button type="button" class="btn" id="pick">${raw(ICONS.camera)}<span>${t('photos.choose')}</span></button>
        <input type="file" id="file" accept="image/*" hidden>
        <img id="prev" class="ocr-preview" alt="" hidden>
      </div>
      <p class="tiny muted">${t('photos.hint')}</p>
      <div class="form-actions"><button class="btn primary" type="submit" id="go" disabled>${t('common.save')}</button></div>
    </form>`, { title: t('photos.add') });
  const form = m.body.querySelector('#up-form');
  const input = m.body.querySelector('#file');
  const prev = m.body.querySelector('#prev');
  m.body.querySelector('#pick').onclick = () => input.click();
  input.onchange = () => {
    file = input.files[0] || null;
    if (file) { prev.src = URL.createObjectURL(file); prev.hidden = false; }
    form.querySelector('#go').disabled = !file;
  };
  on(m.body, 'click', '[data-kind]', (e, b) => {
    kind = b.dataset.kind;
    m.body.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b));
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    const btn = form.querySelector('#go');
    btn.disabled = true;
    btn.textContent = t('photos.uploading');
    let path = null;
    try {
      const [full, thumb] = [await compressImage(file, 1280, 0.82), await compressImage(file, 320, 0.7)];
      path = await uploadPhoto({ full, thumb }, form.date.value, kind);
      await insert('photos', { date: form.date.value, kind, path });
      m.close();
      toast(t('common.saved'));
      refresh();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = t('common.save');
      fail(err);
    }
  };
  m.onClose = () => { if (prev.src.startsWith('blob:')) URL.revokeObjectURL(prev.src); };
}

// ---------- ver foto ----------
async function openViewer(row) {
  if (!row) return;
  const m = openModal(spinner(), { title: `${t('photos.kind.' + row.kind)} · ${dateShort(row.date)}`, wide: true });
  try {
    const urls = await signedUrls([row.path]);
    setHtml(m.body, html`
      <img class="viewer-img" src="${urls[row.path]}" alt="${t('photos.kind.' + row.kind)}">
      <div class="form-actions"><button class="btn danger" id="del-photo">${raw(ICONS.trash)}<span>${t('common.delete')}</span></button></div>`);
    m.body.querySelector('#del-photo').onclick = async () => {
      if (!(await confirmBox(t('photos.confirmDelete')))) return;
      try { await deletePhoto(row); m.close(); toast(t('common.deleted')); refresh(); } catch (e) { fail(e); }
    };
  } catch (e) { m.close(); fail(e); }
}
