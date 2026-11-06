/* Focusday · softplan.js — «Мягкий перенос».
   Вечером (с 18:00) — невыполненное за сегодня и прошлые дни уезжает на завтра одной кнопкой.
   Днём — только «хвосты» прошлых дней переезжают на сегодня. Без красных «просрочено», с отменой. */
import { $, addDays, plural, toISO, todayISO } from '../core.js';
import { data, persist, taskElapsed } from '../state.js';
import { renderAll, renderHooks, toast } from '../render.js';
import { award, checkAchievements } from '../progress.js';

export const EVENING_HOUR = 18;
export const isEvening = (d = new Date()) => d.getHours() >= EVENING_HOUR;

/** Что можно перенести сейчас. Рутины (recurrence) не трогаем — они сами появятся завтра. */
export function softCandidates(now = new Date()) {
  const today = toISO(now), evening = isEvening(now);
  return data.tasks.filter(t => t.status !== 'done' && (!t.recurrence || t.recurrence === 'none') && t.date && (evening ? t.date <= today : t.date < today));
}
export function softTarget(now = new Date()) { return isEvening(now) ? toISO(addDays(now, 1)) : toISO(now); }

export function softReschedule(now = new Date()) {
  const list = softCandidates(now); if (!list.length) { toast('Переносить нечего — план уже бережный ✦'); return 0; }
  const target = softTarget(now), before = list.map(t => ({ t, date: t.date, status: t.status, timerStartedAt: t.timerStartedAt, elapsedMs: t.elapsedMs }));
  list.forEach(t => {
    if (t.status === 'inprogress') { t.elapsedMs = taskElapsed(t); t.timerStartedAt = null; t.status = 'todo'; }
    t.date = target; t.softMoves = (t.softMoves || 0) + 1; t.updatedAt = Date.now();
  });
  award('softmove', { count: list.length }); persist(); renderAll(); checkAchievements();
  const when = target === todayISO() ? 'на сегодня' : 'на завтра';
  toast(`${list.length} ${plural(list.length, ['задача', 'задачи', 'задач'])} ${when}. Это план, а не провал 🌙`, 'success', {
    label: 'Отменить', onClick: () => { before.forEach(b => { Object.assign(b.t, { date: b.date, status: b.status, timerStartedAt: b.timerStartedAt, elapsedMs: b.elapsedMs, updatedAt: Date.now() }); b.t.softMoves = Math.max(0, (b.t.softMoves || 1) - 1); }); persist(); renderAll(); }
  });
  return list.length;
}

export function renderSoftPlan() {
  const box = $('#softPlan'); if (!box) return;
  const list = ['today', 'inbox'].includes(data.view) ? softCandidates() : [];
  box.hidden = !list.length; if (!list.length) return;
  const ev = isEvening(), n = list.length, word = plural(n, ['задача', 'задачи', 'задач']);
  $('#softPlanText').innerHTML = ev
    ? `<strong>Вечер — время закрывать день.</strong> ${n} ${word} можно спокойно перенести на завтра.`
    : `<strong>С прошлых дней осталось ${n} ${word}.</strong> Перенести на сегодня — без чувства долга.`;
  $('#softPlanBtn').textContent = ev ? 'Мягкий перенос на завтра' : 'Перенести на сегодня';
}
export function bindSoftPlan() {
  $('#softPlanBtn')?.addEventListener('click', () => softReschedule());
  renderHooks.push(['softplan', renderSoftPlan]);
}
