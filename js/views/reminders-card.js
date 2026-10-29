// Tarjeta «Avisos» de Ajustes (v15): dos recordatorios opcionales, cada uno con interruptor, hora y días de la semana.
import { html, setHtml, on, toast, fail } from '../util.js';
import { t, getLang, locale } from '../i18n.js';
import { KINDS, loadSettings, saveSettings, remindersSupported, permission, askPermission, reschedule, sendTest } from '../reminders.js';

const LETTERS = { es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] };
// 1 de enero de 2024 fue lunes: sirve de referencia para sacar el nombre completo de cada día.
const dayName = (i) => new Intl.DateTimeFormat(locale(), { weekday: 'long' }).format(new Date(2024, 0, 1 + i));

export function mountReminders(box) {
  if (!remindersSupported()) {
    setHtml(box, html`<div class="card"><h3>${t('rem.title')}</h3><p class="muted small">${t('rem.webOnly')}</p></div>`);
    return;
  }
  let s = loadSettings();
  let note = '';   // aviso de permiso: 'denied' (acabas de rechazarlo) o 'blocked' (lo tenías activado y el móvil las bloquea)

  const draw = () => {
    const letters = LETTERS[getLang()] || LETTERS.es;
    setHtml(box, html`
      <div class="card" id="rem">
        <h3>${t('rem.title')}</h3>
        <p class="muted small">${t('rem.intro')}</p>
        ${KINDS.map((k) => html`
          <div class="rem-item">
            <label class="rem-head">
              <span class="grow"><strong>${t('rem.' + k)}</strong><br><small class="muted">${t('rem.' + k + '.help')}</small></span>
              <input type="checkbox" class="switch" data-on="${k}" ${s[k].on ? 'checked' : ''} aria-label="${t('rem.' + k)}">
            </label>
            ${s[k].on ? html`
              <div class="rem-body">
                <label class="rem-time"><span>${t('rem.time')}</span><input type="time" data-time="${k}" value="${s[k].time}" required></label>
                <div class="chips rem-days" role="group" aria-label="${t('rem.days')}">
                  ${letters.map((l, i) => html`<button type="button" class="chip ${s[k].days.includes(i) ? 'on' : ''}" data-day="${k}:${i}" aria-pressed="${s[k].days.includes(i) ? 'true' : 'false'}" aria-label="${dayName(i)}">${l}</button>`)}
                </div>
              </div>` : ''}
          </div>`)}
        ${note ? html`<p class="error-text small" id="rem-note">${t('rem.' + note)}</p>` : ''}
        <p class="tiny muted">${t('rem.how')}</p>
        <button class="btn" id="rem-test" type="button">${t('rem.test')}</button>
        <details class="rem-help"><summary>${t('rem.noArrive')}</summary><p class="small muted">${t('rem.battery')}</p></details>
      </div>`);
  };

  const save = () => { s = saveSettings(s); reschedule(); };

  on(box, 'change', '[data-on]', async (e, inp) => {
    const k = inp.dataset.on;
    if (inp.checked) {
      inp.disabled = true;
      let ok = false;
      try { ok = await askPermission(); } catch (err) { fail(err); }
      if (!ok) { note = 'denied'; draw(); return; } // se queda apagado y se explica cómo darle permiso
      note = '';
    }
    s[k].on = inp.checked;
    draw();
    save();
    toast(t(inp.checked ? 'rem.turnedOn' : 'rem.turnedOff'));
  });
  on(box, 'change', '[data-time]', (e, inp) => {
    const k = inp.dataset.time;
    if (!inp.value) { inp.value = s[k].time; return; } // vaciar la hora no vale: se queda la anterior
    s[k].time = inp.value;
    save();
  });
  on(box, 'click', '[data-day]', (e, b) => {
    const [k, i] = b.dataset.day.split(':'); const d = Number(i);
    const days = s[k].days.includes(d) ? s[k].days.filter((x) => x !== d) : [...s[k].days, d].sort();
    if (!days.length) { toast(t('rem.oneDay'), 'error'); return; }
    s[k].days = days;
    draw();
    save();
  });
  on(box, 'click', '#rem-test', async (e, b) => {
    b.disabled = true;
    try {
      const r = await sendTest();
      if (r.ok) toast(t('rem.testSent')); else { note = 'denied'; draw(); }
    } catch (err) { fail(err); } finally { b.disabled = false; }
  });

  draw();
  // Si tienes avisos activados pero el móvil los tiene bloqueados (permiso retirado desde los ajustes del sistema), se avisa.
  if (KINDS.some((k) => s[k].on)) permission().then((p) => { if (p !== 'granted') { note = 'blocked'; draw(); } }).catch((e) => console.warn(e));
}
