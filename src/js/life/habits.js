/* Focusday · life/habits.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { addDays, fromISO, mondayOf, toISO, todayISO } from '../core.js';
import { HABIT_COLORS, lid, touch } from '../life/quick.js';
import { award, checkAchievements } from '../progress.js';
import { renderAll, toast } from '../render.js';
import { playSound } from '../sound.js';
import { data, persist } from '../state.js';

/* ── 2. Привычки: гибкий ритм вместо хрупкого стрика ────────────────
   • цель = N раз в неделю (не «каждый день»)          • «минимум» засчитывается как полноценный день
   • ритм = отметки за последние 7 дней / N             • стрик = недели подряд, где цель достигнута;
   • текущая неделя никогда не обнуляет стрик           • пауза (отпуск/болезнь) замораживает привычку */
export const findHabit = (name) => { const n = name.toLocaleLowerCase('ru'); return data.habits.find(h => h.name.toLocaleLowerCase('ru') === n) || data.habits.find(h => h.name.toLocaleLowerCase('ru').startsWith(n)); };
export function createHabit(name, minText = '', target = 4) {
  const h = touch({ id: lid('h'), name: (s => s.charAt(0).toLocaleUpperCase('ru') + s.slice(1))(String(name).trim().slice(0, 40)), minText: String(minText).slice(0, 60), target, color: HABIT_COLORS[data.habits.length % HABIT_COLORS.length], paused: false, createdAt: Date.now(), log: {} });
  data.habits.push(h); return h;
}
export function setHabitDay(h, iso, value) {
  const prev = h.log[iso] || 0;
  if (value) h.log[iso] = value; else delete h.log[iso];
  touch(h);
  if (iso === todayISO() && value && !prev && h.xpDay !== iso) { h.xpDay = iso; award('habit', { min: value === 1, anchor: document.querySelector(`[data-habit-today="${h.id}"]`) }); }
}
export function checkHabitByName(name, min) {
  let h = findHabit(name), created = false; if (!h) { h = createHabit(name); created = true; }
  setHabitDay(h, todayISO(), min ? 1 : 2);
  persist(); renderAll(); checkAchievements(); playSound('success');
  toast(created ? `Новая привычка «${h.name}» — и сразу первая отметка ✦` : `${h.name}: ${min ? 'минимум засчитан — это тоже победа' : 'отмечено'} ✦`);
}
// Границы недели — локальные календарные дни, а не фиксированные 168 часов:
// при переходе на летнее/зимнее время неделя может длиться 167 или 169 часов.
export function weekHasPause(mon, pauses) {
  const start = new Date(mon); start.setHours(0, 0, 0, 0);
  const end = addDays(start, 7);
  return pauses.some(([from, to]) => Number(from) < end.getTime() && Number(to) > start.getTime());
}
export function habitStats(h) {
  const today = fromISO(todayISO()); let last7 = 0;
  for (let i = 0; i < 7; i++) if (h.log[toISO(addDays(today, -i))]) last7++;
  const weekCount = (monday) => { let c = 0; for (let i = 0; i < 7; i++) if (h.log[toISO(addDays(monday, i))]) c++; return c; };
  const thisMon = mondayOf(today), thisWeek = weekCount(thisMon);
  let streak = thisWeek >= h.target ? 1 : 0;
  const pauses = [...(h.pauses || []), ...(h.paused && h.pausedAt ? [[h.pausedAt, Date.now()]] : [])];
  const pausedWeek = (mon) => weekHasPause(mon, pauses);
  for (let w = 1; w < 104; w++) { const mon = addDays(thisMon, -7 * w); if (weekCount(mon) >= h.target) streak++; else if (pausedWeek(mon)) continue; else break; }
  return { last7, thisWeek, streak, total: Object.keys(h.log).length, pct: Math.min(1, thisWeek / h.target) };
}
