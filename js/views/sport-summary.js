// Deporte › Resumen (v14): racha de semanas, medallas, cifras del mes, reparto por tipo y gráficos.
// Todo sale de los entrenos que ya hay guardados; solo el objetivo semanal se guarda aparte (en el perfil).
import { listAll } from '../db.js';
import { loadProfile, saveProfile } from '../plan.js';
import { barChart } from '../charts.js';
import { html, setHtml, on, num, todayStr, parseDate, toast, fail, cap } from '../util.js';
import { t, locale } from '../i18n.js';
import {
  DEFAULT_GOAL, MAX_GOAL, streaks, medals, monthTotals, byType, weeksOfMonth, lastMonths, prevMonth, nextMonth, monthOf,
} from '../sport-stats.js';

// Lo que estás mirando se recuerda mientras la app siga abierta (al salir del Resumen y volver, sigues donde estabas).
const S = { y: null, m: null, metric: 'count', type: null };
const UNIT = { count: '', minutes: 'min', km: 'km', kcal: 'kcal' };
const DEC = { count: 0, minutes: 0, km: 1, kcal: 0 };
const sqlMissing = (e) => !!e && (['PGRST204', '42703'].includes(e.code) || /weekly_workout_goal/.test(e.message || ''));

const monthName = (y, m) => cap(new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(y, m, 1)));
const monthShort = (y, m) => new Intl.DateTimeFormat(locale(), { month: 'short' }).format(new Date(y, m, 1)).replace('.', '');
const fmtMin = (v) => (v >= 60 ? `${Math.floor(v / 60)} h ${Math.round(v % 60)} min` : `${num(v, 0)} min`);
const tileValue = (metric, v) => (metric === 'minutes' ? fmtMin(v) : metric === 'km' ? `${num(v, 1)} km` : metric === 'kcal' ? `${num(v, 0)} kcal` : num(v, 0));
const delta = (metric, cur, prev) => {
  const d = Math.round((cur - prev) * 10) / 10;
  if (cur === 0 && prev === 0) return '';
  const txt = d === 0 ? '=' : `${d > 0 ? '+' : '−'}${metric === 'minutes' ? fmtMin(Math.abs(d)) : num(Math.abs(d), DEC[metric])}`;
  return html`<small class="tile-d ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${txt}</small>`;
};

export async function renderSummary(el) {
  let workouts = [], goal = DEFAULT_GOAL, goalSaved = true;
  workouts = await listAll('workouts', { order: 'date', asc: false, cols: 'date,type,duration_min,calories_kcal,distance_km', limit: 1000 });
  try {
    const p = await loadProfile();
    if (p && p.weekly_workout_goal) goal = Number(p.weekly_workout_goal);
  } catch (e) { console.warn(e); goalSaved = false; } // sin perfil o sin SQL 09: se usa el valor por defecto
  const today = todayStr();
  if (S.y === null) Object.assign(S, monthOf(today));
  const cur = monthOf(today);

  if (!workouts.length) {
    setHtml(el, html`<div class="card empty"><p>${t('sum.empty')}</p></div>`);
    return;
  }

  setHtml(el, html`<div id="sum-box"></div>`);
  const box = el.querySelector('#sum-box');

  const draw = () => {
    const st = streaks(workouts, goal, today);
    const md = medals(workouts, goal, today);
    const pm = prevMonth(S.y, S.m);
    const now = monthTotals(workouts, S.y, S.m, S.type);
    const prev = monthTotals(workouts, pm.y, pm.m, S.type);
    const types = byType(workouts, S.y, S.m);
    const maxCount = Math.max(1, ...types.map((x) => x.count));
    const weeks = weeksOfMonth(workouts, S.y, S.m, S.metric, S.type);
    const months = lastMonths(workouts, S.y, S.m, 6, S.metric, S.type);
    const isNow = S.y === cur.y && S.m === cur.m;
    const pct = Math.min(100, Math.round((st.thisWeek.count / st.thisWeek.goal) * 100));
    const metricLabel = t('sum.m.' + S.metric);
    setHtml(box, html`
      <section class="card streak">
        <div class="streak-head">
          <span class="streak-num ${st.current ? 'on' : ''}">${st.current}</span>
          <div><strong>${t(st.current === 1 ? 'sum.streak1' : 'sum.streakN', { n: st.current })}</strong><br>
            <span class="tiny muted">${st.best ? t('sum.best', { n: st.best }) : t('sum.streakHint')}</span></div>
        </div>
        <p class="small">${t('sum.thisWeek', { n: st.thisWeek.count, g: st.thisWeek.goal })}${st.thisWeek.met ? ' ✅' : ''}</p>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="goal-row">
          <span class="grow">${t('sum.goal')}</span>
          <button class="icon-btn" data-goal="-1" aria-label="${t('sum.less')}" ${goal <= 1 ? 'disabled' : ''}>−</button>
          <strong class="goal-n">${goal}</strong>
          <button class="icon-btn" data-goal="1" aria-label="${t('sum.more')}" ${goal >= MAX_GOAL ? 'disabled' : ''}>+</button>
        </div>
        <p class="tiny muted">${t('sum.goalHint')}${goalSaved ? '' : ' ' + t('sum.goalNoSave')}</p>
      </section>

      <section class="card">
        <h3>${t('sum.medals')}</h3>
        <div class="medals">${md.map((m) => html`
          <div class="medal ${m.earned ? 'earned' : 'locked'}" title="${t('sum.medal.' + m.id + '.d')}">
            <span class="medal-ic">${m.icon}</span>
            <b>${t('sum.medal.' + m.id)}</b>
            <small>${m.earned ? '✓' : `${m.cur}/${m.target}`}</small>
          </div>`)}</div>
      </section>

      <div class="date-nav">
        <button class="icon-btn" data-m="-1" aria-label="${t('cal.prev')}">‹</button>
        <strong>${monthName(S.y, S.m)}</strong>
        <button class="icon-btn" data-m="1" aria-label="${t('cal.next')}" ${isNow ? 'disabled' : ''}>›</button>
      </div>
      ${S.type ? html`<p class="filter-chip"><button class="chip on" data-type="${S.type}">${t('sport.type.' + S.type)} ✕</button></p>` : ''}

      <div class="tiles">${['count', 'minutes', 'km', 'kcal'].map((k) => html`
        <button class="tile ${S.metric === k ? 'on' : ''}" data-metric="${k}">
          <strong>${tileValue(k, now[k])}</strong>
          <small>${t('sum.m.' + k)}</small>
          ${delta(k, now[k], prev[k])}
        </button>`)}</div>
      ${S.metric !== 'count' && now.missing[S.metric] > 0 ? html`<p class="tiny muted">${t('sum.missing', { n: now.missing[S.metric], total: now.count })}</p>` : ''}

      <section class="card">
        <h3>${t('sum.byType')}</h3>
        ${types.length ? html`<div class="types">${types.map((x) => html`
          <button class="type-row ${S.type === x.type ? 'on' : S.type ? 'dim' : ''}" data-type="${x.type}">
            <span class="type-name">${t('sport.type.' + x.type)}</span>
            <span class="bar"><i style="width:${Math.round((x.count / maxCount) * 100)}%"></i></span>
            <span class="type-n">${x.count}${x.minutes ? html` · <span class="muted">${fmtMin(x.minutes)}</span>` : ''}</span>
          </button>`)}</div><p class="tiny muted">${t('sum.filterHint')}</p>`
        : html`<p class="muted small">${t('sum.noMonth')}</p>`}
      </section>

      <section class="card">
        <h3>${t('sum.byWeek')} · ${metricLabel}</h3>
        ${barChart(weeks.map((w) => ({
          label: `${parseDate(w.start).getDate()}–${parseDate(w.end).getDate()}`,
          title: `${parseDate(w.start).getDate()}–${parseDate(w.end).getDate()} ${monthShort(S.y, S.m)}`,
          value: w.value,
          current: isNow && today >= w.start && today <= w.end,
        })), { unit: UNIT[S.metric], decimals: DEC[S.metric] })}
      </section>

      <section class="card">
        <h3>${t('sum.byMonth')} · ${metricLabel}</h3>
        ${barChart(months.map((x, i) => ({
          label: monthShort(x.y, x.m),
          title: monthName(x.y, x.m),
          value: x.value,
          current: i === months.length - 1,
        })), { unit: UNIT[S.metric], decimals: DEC[S.metric] })}
      </section>`);
  };

  let saving = Promise.resolve();
  on(box, 'click', '[data-goal]', (e, b) => {
    const g = Math.min(MAX_GOAL, Math.max(1, goal + Number(b.dataset.goal)));
    if (g === goal) return;
    goal = g;
    draw();
    saving = saving.then(() => saveProfile({ weekly_workout_goal: g })).then(() => { goalSaved = true; }).catch((err) => {
      if (sqlMissing(err)) { console.warn(err); toast(t('sum.needSql'), 'error'); } else fail(err);
    });
  });
  on(box, 'click', '[data-m]', (e, b) => { Object.assign(S, Number(b.dataset.m) < 0 ? prevMonth(S.y, S.m) : nextMonth(S.y, S.m)); draw(); });
  on(box, 'click', '[data-metric]', (e, b) => { S.metric = b.dataset.metric; draw(); });
  on(box, 'click', '[data-type]', (e, b) => { S.type = S.type === b.dataset.type ? null : b.dataset.type; draw(); });
  draw();
}
