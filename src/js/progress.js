/* Focusday · progress.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { applyData, confirmImport, dailySnapshot, exportEncrypted, getSnaps, rebaseline, renderSnapshots, snapshot } from './backup.js';
import { $, LISTS, addDays, esc, fromISO, ic, mondayOf, toISO, todayISO } from './core.js';
import { habitStats } from './life/habits.js';
import { closeModals, showModal, toast } from './render.js';
import { playSound } from './sound.js';
import { data, persist } from './state.js';
import { Sync } from './sync.js';

/* ── 3. Gamification ─────────────────────────────────────────────── */
export const xpForLevel = (lvl) => Math.round(60 * Math.pow(lvl, 1.4));          // 60, 158, 280, 419, 573…
export const TITLES = [[1, 'Искра'], [3, 'Исследователь'], [5, 'Ученик ритма'], [8, 'Мастер микро-шагов'], [12, 'Хранитель фокуса'], [16, 'Архитектор дня'], [20, 'Легенда возвращений']];
export const RARITY = { common: { label: 'Обычное', xp: 15 }, rare: { label: 'Редкое', xp: 40 }, epic: { label: 'Эпическое', xp: 90 }, legendary: { label: 'Легендарное', xp: 200 } };
export function levelInfo(xp = data.xp || 0) {
  let lvl = 1, rest = xp; while (rest >= xpForLevel(lvl)) { rest -= xpForLevel(lvl); lvl++; }
  const title = TITLES.filter(([l]) => lvl >= l).pop()[1];
  return { lvl, rest, need: xpForLevel(lvl), title };
}
export function S() {
  if (!data.stats || typeof data.stats !== 'object') data.stats = {};
  const s = data.stats; s.activeDays = s.activeDays || {}; s.recentDone = Array.isArray(s.recentDone) ? s.recentDone : [];
  ['tasksDone', 'stepsDone', 'focusMin', 'captures', 'returns', 'softReturns', 'nightWins', 'lowEnergyWins', 'guiltFree', 'weekendWins', 'resumes', 'maxCombo', 'habitChecks', 'minChecks', 'thoughts', 'expensesLogged', 'released', 'lowModeWins', 'softMoves', 'catBreaks', 'paletteRuns'].forEach(k => { s[k] = Number(s[k]) || 0; });
  return s;
}
export const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);
export function bumpDay(n = 1) { const s = S(), d = todayISO(); s.activeDays[d] = (s.activeDays[d] || 0) + n; const keys = Object.keys(s.activeDays).sort(); while (keys.length > 400) delete s.activeDays[keys.shift()]; }
/* Возврат после паузы — главная награда для СДВГ. Никаких «потерянных стриков». */
export function registerVisit() {
  const s = S(), today = todayISO(), last = s.lastVisitDay;
  if (last && last < today) {
    const gap = daysBetween(last, today);
    if (gap >= 3) { s.returns++; s.comebackDay = today; gainXP(30, null, 'Бонус возвращения'); setTimeout(() => toast(`С возвращением! ${gap} дн. перерыва — не провал, а пауза. Первая задача сегодня даст ×2 XP ✦`), 900); }
    else if (gap >= 1) s.softReturns++;
  }
  s.lastVisitDay = today; if (!s.activeDays[today]) s.activeDays[today] = 0;
}
export function gainXP(amount, anchor, label) {
  if (!amount) return;
  const before = levelInfo().lvl; data.xp = (Number(data.xp) || 0) + amount;
  floatXP(amount, anchor, label);
  const after = levelInfo(); if (after.lvl > before) setTimeout(() => showLevelUp(after), 700);
  renderProgress();
}
/* Единая точка начисления опыта. Анти-фарм: XP за задачу/шаг — только один раз. */
export function award(event, p = {}) {
  const s = S(); let xp = 0; const now = Date.now();
  if (event === 'task') {
    const t = p.task; if (t.xp) return;   // повторное «выполнено» после отмены не даёт ни XP, ни статистики
    s.tasksDone++; bumpDay(2);
    const h = new Date().getHours(); if (h >= 22 || h < 5) s.nightWins++;
    if (data.energy <= 2) s.lowEnergyWins++;
    if (data.lowEnergy) s.lowModeWins++;
    if (t.date < todayISO()) s.guiltFree++;
    if ([0, 6].includes(new Date().getDay())) s.weekendWins++;
    s.recentDone = [...s.recentDone.filter(x => now - x < 3600e3), now]; s.maxCombo = Math.max(s.maxCombo, s.recentDone.length);
    if (!t.xp) {
      xp = 10 + (t.priority === 3 ? 5 : 0) + Math.min(10, Math.round(t.duration / 10)) + (t.steps?.length ? 3 : 0);
      if (s.comebackDay === todayISO()) { xp *= 2; s.comebackDay = null; }
      if (s.recentDone.length >= 3) xp += 5;   // комбо
      t.xp = xp;
    }
  } else if (event === 'step') { const st = p.step; s.stepsDone++; bumpDay(1); if (!st.x) { st.x = 1; xp = 3; } }
  else if (event === 'focus') { s.focusMin += p.minutes; bumpDay(2); xp = Math.round(p.minutes * 0.6); }
  else if (event === 'capture') { s.captures++; bumpDay(1); const today = todayISO(); s.capDay = s.capDay === today ? s.capDay : today; s.capToday = s.capDay === today ? (s.capToday || 0) + 1 : 1; if (s.capToday <= 10) xp = 1; }
  else if (event === 'resume') { s.resumes++; }
  else if (event === 'habit') { s.habitChecks++; if (p.min) s.minChecks++; bumpDay(1); xp = 4; }          // минимум = столько же XP
  else if (event === 'thought') { s.thoughts++; bumpDay(1); const d = todayISO(); s.thDay === d ? s.thToday++ : (s.thDay = d, s.thToday = 1); if (s.thToday <= 5) xp = 2; }
  else if (event === 'expense') { s.expensesLogged++; const d = todayISO(); s.exDay === d ? s.exToday++ : (s.exDay = d, s.exToday = 1); if (s.exToday <= 5) xp = 1; }
  else if (event === 'release') { s.released++; bumpDay(1); xp = 10; }
  else if (event === 'softmove') { s.softMoves++; const d = todayISO(); if (s.softDay !== d) { s.softDay = d; xp = 5; } }   // раз в день: бережность, а не фарм
  else if (event === 'catbreak') { s.catBreaks++; const d = todayISO(); s.cbDay === d ? s.cbToday++ : (s.cbDay = d, s.cbToday = 1); if (s.cbToday <= 3) xp = 3; }
  if (xp) gainXP(xp, p.anchor);
  renderHeatmap();
}
/* Достижения: награда за возвращение и микро-шаги, а не за идеальную дисциплину */
export const ACHIEVEMENTS = [
  // ── Возвращение (ядро СДВГ-дизайна)
  { id: 'comeback', icon: 'flame', rarity: 'epic', title: 'Возвращение легенды', desc: 'Вернись в Focusday после перерыва 3+ дня', test: s => s.returns >= 1 },
  { id: 'phoenix', icon: 'crown', rarity: 'legendary', title: 'Феникс', desc: 'Вернись после перерыва 5 раз. Каждое возвращение — сила', test: s => s.returns >= 5, progress: s => [s.returns, 5] },
  { id: 'again', icon: 'history', rarity: 'common', title: 'Снова здесь', desc: 'Открой приложение на следующий день или позже', test: s => s.softReturns + s.returns >= 1 },
  { id: 'rhythm', icon: 'wave', rarity: 'rare', title: 'Ритм, а не цепь', desc: '4 активных дня из любых 7 — без требований «подряд»', test: s => activeInLast(7) >= 4, progress: () => [activeInLast(7), 4] },
  // ── Микро-шаги
  { id: 'micro1', icon: 'dot', rarity: 'common', title: 'Микро-победа', desc: 'Отметь хотя бы 1 микро-шаг. Начало засчитано', test: s => s.stepsDone >= 1 },
  { id: 'split', icon: 'scissors', rarity: 'common', title: 'Дробитель', desc: 'Разбей задачу на 3+ микро-шага', test: () => data.tasks.some(t => t.steps.length >= 3) },
  { id: 'micro', icon: 'steps', rarity: 'rare', title: 'Мастер маленьких шагов', desc: 'Выполни 25 микро-шагов', test: s => s.stepsDone >= 25, progress: s => [s.stepsDone, 25] },
  { id: 'architect', icon: 'home', rarity: 'rare', title: 'Архитектор', desc: 'Заверши все микро-шаги одной задачи', test: () => data.tasks.some(t => t.status === 'done' && t.steps.length > 0 && t.steps.every(x => x.done)) },
  // ── Задачи без давления
  { id: 'first', icon: 'spark', rarity: 'common', title: 'Первая победа', desc: 'Заверши первую задачу', test: s => s.tasksDone >= 1 || data.tasks.some(t => t.status === 'done') },
  { id: 'ten', icon: 'star', rarity: 'common', title: 'Десять шагов', desc: 'Заверши 10 задач', test: () => doneCount() >= 10, progress: () => [doneCount(), 10] },
  { id: 'century', icon: 'hundred', rarity: 'epic', title: 'Сотня', desc: 'Заверши 100 задач — в любом темпе', test: () => doneCount() >= 100, progress: () => [doneCount(), 100] },
  { id: 'guilt', icon: 'feather', rarity: 'rare', title: 'Без чувства вины', desc: 'Закрой просроченную задачу. Поздно — лучше, чем никогда', test: s => s.guiltFree >= 1 },
  { id: 'lowbat', icon: 'battery', rarity: 'rare', title: 'Честный заряд', desc: 'Сделай задачу в день, когда энергия на минимуме', test: s => s.lowEnergyWins >= 1 },
  { id: 'combo', icon: 'bolt', rarity: 'rare', title: 'Комбо ×3', desc: '3 задачи в пределах одного часа', test: s => s.maxCombo >= 3 },
  { id: 'day', icon: 'sun', rarity: 'rare', title: 'Ритм дня', desc: 'Выполни все задачи на сегодня', test: () => { const a = data.tasks.filter(t => t.date === todayISO()); return a.length > 0 && a.every(t => t.status === 'done'); } },
  // ── Время суток
  { id: 'nightowl', icon: 'moon', rarity: 'common', title: 'Ночной дозор', desc: 'Заверши задачу после 22:00', test: s => s.nightWins >= 1 },
  { id: 'earlybird', icon: 'sun', rarity: 'common', title: 'Ранняя пташка', desc: 'Заверши задачу с 05:00 до 07:59', test: () => data.tasks.some(t => t.completedAt && new Date(t.completedAt).getHours() >= 5 && new Date(t.completedAt).getHours() < 8) },
  { id: 'weekend', icon: 'coffee', rarity: 'common', title: 'Мягкие выходные', desc: 'Сделай что-то маленькое в выходной', test: s => s.weekendWins >= 1 },
  // ── Фокус
  { id: 'flow', icon: 'target', rarity: 'common', title: 'В потоке', desc: 'Заверши 5 фокус-сессий (даже по 10 минут)', test: () => data.focusSessions >= 5, progress: () => [data.focusSessions, 5] },
  { id: 'master', icon: 'trophy', rarity: 'epic', title: 'Железный фокус', desc: 'Заверши 25 фокус-сессий', test: () => data.focusSessions >= 25, progress: () => [data.focusSessions, 25] },
  { id: 'resume', icon: 'play', rarity: 'common', title: 'Перезапуск', desc: 'Поставь задачу на паузу и вернись к ней', test: s => s.resumes >= 1 },
  // ── Организация
  { id: 'brain', icon: 'brain', rarity: 'common', title: 'Разгрузка головы', desc: '10 быстрых захватов мыслей (Q)', test: s => s.captures >= 10, progress: s => [s.captures, 10] },
  { id: 'routine', icon: 'repeat', rarity: 'common', title: 'Ритм без пауз', desc: 'Создай ежедневную рутину', test: () => data.tasks.some(t => t.recurrence === 'daily') },
  { id: 'organizer', icon: 'layout', rarity: 'rare', title: 'Архивариус', desc: 'Создай 5 своих списков', test: () => data.lists.filter(l => !LISTS.some(d => d.id === l.id)).length >= 5 },
  { id: 'safe', icon: 'shield', rarity: 'common', title: 'Подушка безопасности', desc: 'Сделай первый бэкап', test: () => !!data.lastBackupAt },
  // ── Секретные
  { id: 'secret_lvl10', icon: 'crown', rarity: 'legendary', hidden: true, title: 'Свой темп', desc: 'Достигни 10 уровня', test: () => levelInfo().lvl >= 10 }
];
export const doneCount = () => Math.max(S().tasksDone, data.tasks.filter(t => t.status === 'done').length);
export function activeInLast(n) { const s = S(); let c = 0; for (let i = 0; i < n; i++) { if ((s.activeDays[toISO(addDays(new Date(), -i))] || 0) > 0) c++; } return c; }
export const achQueue = []; export let achShowing = false;
export function checkAchievements() {
  if (!Array.isArray(data.achievements)) data.achievements = [];
  if (!data.achievementDates) data.achievementDates = {};
  const s = S(); let changed = false;
  ACHIEVEMENTS.forEach(a => {
    if (data.achievements.includes(a.id)) return;
    let ok = false; try { ok = a.test(s); } catch (_) {}
    if (!ok) return;
    data.achievements.push(a.id); data.achievementDates[a.id] = Date.now(); changed = true;
    achQueue.push(a); data.xp = (Number(data.xp) || 0) + RARITY[a.rarity].xp;
  });
  if (changed) { persist(); renderAchievements(); renderProgress(); pumpAch(); }
}
/* Карточка «Achievement unlocked» в стиле Steam/iOS: очередь, по одной */
export function pumpAch() {
  if (achShowing || !achQueue.length) return;
  const a = achQueue.shift(), r = RARITY[a.rarity], layer = $('#achLayer'); if (!layer) return;
  achShowing = true; playSound(a.rarity === 'legendary' || a.rarity === 'epic' ? 'levelup' : 'achievement');
  const card = document.createElement('div'); card.className = `ach-pop r-${a.rarity}`;
  card.innerHTML = `<div class="ach-pop-icon">${ic(a.icon)}</div><div class="ach-pop-body"><small>Достижение открыто · ${r.label}</small><strong>${esc(a.title)}</strong><p>${esc(a.desc)}</p></div><div class="ach-pop-xp">+${r.xp}<small>XP</small></div>`;
  card.addEventListener('click', () => { closeModals(); renderAchievements(); showModal('achievementsModal'); });
  layer.appendChild(card);
  setTimeout(() => { card.classList.add('leaving'); setTimeout(() => { card.remove(); achShowing = false; pumpAch(); }, 380); }, 4600);
}
export function renderAchievements() {
  const grid = $('#achievementGrid'); if (!grid) return;
  const earned = new Set(data.achievements || []), s = S(), li = levelInfo();
  const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const list = [...ACHIEVEMENTS].sort((a, b) => (earned.has(b.id) - earned.has(a.id)) || order[a.rarity] - order[b.rarity]);
  grid.innerHTML = list.map(a => {
    const got = earned.has(a.id), secret = a.hidden && !got;
    let prog = ''; if (!got && a.progress) { const [v, max] = a.progress(s); prog = `<span class="ach-prog"><i style="width:${Math.min(100, v / max * 100)}%"></i></span><em>${Math.min(v, max)}/${max}</em>`; }
    const date = got && data.achievementDates?.[a.id] ? new Date(data.achievementDates[a.id]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
    return `<article class="achievement-card r-${a.rarity} ${got ? 'earned' : 'locked'}"><span class="achievement-icon">${secret ? '?' : ic(a.icon)}</span><div><strong>${secret ? 'Секретное достижение' : esc(a.title)}</strong><p>${secret ? 'Продолжай в своём темпе — оно откроется само' : esc(a.desc)}</p>${prog}</div><span class="achievement-state"><b>${RARITY[a.rarity].label}</b>${got ? `<small>${date}</small>` : `<small>+${RARITY[a.rarity].xp} XP</small>`}</span></article>`;
  }).join('');
  const sum = $('#achSummary');
  if (sum) sum.innerHTML = `<div class="ach-lvl"><span class="level-ring big" style="--p:${li.rest / li.need}"><b>${li.lvl}</b></span><div><strong>${li.title}</strong><small>${li.rest} / ${li.need} XP до уровня ${li.lvl + 1} · всего ${data.xp || 0} XP</small></div></div><div class="ach-stats"><div><b>${earned.size}/${ACHIEVEMENTS.length}</b><span>достижений</span></div><div><b>${s.returns + s.softReturns}</b><span>возвращений</span></div><div><b>${s.stepsDone}</b><span>микро-шагов</span></div><div><b>${activeInLast(30)}</b><span>дней из 30</span></div></div>`;
  const count = $('#achievementCount'); if (count) count.textContent = earned.size;
}
export function renderProgress() {
  const li = levelInfo();
  const n = $('#levelNum'); if (!n) return;
  n.textContent = li.lvl; $('#levelTitle').textContent = li.title; $('#levelXp').textContent = `${li.rest} / ${li.need} XP`;
  $('#xpBar').style.width = `${li.rest / li.need * 100}%`; $('#levelRing').style.setProperty('--p', li.rest / li.need);
}
export function floatXP(amount, anchor, label) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('span'); el.className = 'xp-float'; el.textContent = `+${amount} XP${label ? ' · ' + label : ''}`;
  const r = (anchor && anchor.getBoundingClientRect?.()) || $('#levelCard')?.getBoundingClientRect() || { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  el.style.left = `${r.left + (r.width || 0) / 2}px`; el.style.top = `${r.top}px`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
  const card = $('#levelCard'); card?.classList.remove('gain'); void card?.offsetWidth; card?.classList.add('gain');
}
export function showLevelUp(li) {
  const box = $('#levelUp'); if (!box) return; playSound('levelup');
  box.innerHTML = `<div class="levelup-card"><div class="levelup-glow"></div><small>Новый уровень</small><div class="levelup-num">${li.lvl}</div><strong>${li.title}</strong><p>Не за идеальность — за то, что ты возвращаешься.</p></div>`;
  box.hidden = false; const close = () => { box.hidden = true; }; box.onclick = close; setTimeout(close, 3800);
  const card = box.querySelector('.levelup-card').getBoundingClientRect();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) for (let i = 0; i < 28; i++) { const b = document.createElement('i'); b.className = 'reward-particle'; b.style.left = `${innerWidth / 2}px`; b.style.top = `${innerHeight / 2}px`; b.style.setProperty('--dx', `${(Math.random() - .5) * 520}px`); b.style.setProperty('--dy', `${(Math.random() - .6) * 420}px`); b.style.setProperty('--turn', `${Math.random() * 600}deg`); b.style.background = ['var(--accent)', 'var(--mint)', 'var(--amber)', 'var(--rose)', 'var(--sky)'][i % 5]; document.body.appendChild(b); setTimeout(() => b.remove(), 900); }
}

/* ── 4. Heatmap (GitHub-style, 20 недель) ─────────────────────────── */
export function renderHeatmap() {
  const root = $('#heatmap'); if (!root) return;
  const s = S(), weeks = 52, end = mondayOf(new Date()), start = addDays(end, -(weeks - 1) * 7);
  // учитываем и старые данные: выполненные задачи по дате выполнения
  const counts = { ...s.activeDays }; data.tasks.forEach(t => { if (t.completedAt) { const d = toISO(new Date(t.completedAt)); counts[d] = Math.max(counts[d] || 0, 1); } });
  const vals = Object.values(counts).filter(v => v > 0).sort((a, b) => a - b);
  const q = (p) => vals[Math.floor(p * (vals.length - 1))] || 1;
  const lv = (v) => !v ? 0 : v <= q(.25) ? 1 : v <= q(.5) ? 2 : v <= q(.8) ? 3 : 4;
  const today = todayISO(); let html = '';
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
    const date = addDays(start, w * 7 + d), iso = toISO(date), v = counts[iso] || 0, future = iso > today;
    html += `<i class="l${future ? 'x' : lv(v)}${iso === today ? ' today' : ''}" style="grid-column:${w + 1};grid-row:${d + 1}" title="${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}: ${v} действий"></i>`;
  }
  root.innerHTML = html;
  const sum = $('#heatmapSummary'); if (sum) sum.textContent = `${activeInLast(30)} активных дней из 30 — без давления «подряд»`;
}

export function bindProgress() {
  $('#levelCard')?.addEventListener('click', () => { renderAchievements(); showModal('achievementsModal'); });
  $('#exportEncBtn')?.addEventListener('click', exportEncrypted);
  $('#importMergeBtn')?.addEventListener('click', () => confirmImport('merge'));
  $('#importReplaceBtn')?.addEventListener('click', () => { if (confirm('Заменить ВСЕ текущие данные содержимым файла? (точка восстановления будет создана)')) confirmImport('replace'); });
  $('#snapshotRestoreBtn')?.addEventListener('click', () => { const i = $('#snapshotSelect').value; const snap = getSnaps()[Number(i)]; if (i === '' || !snap) { toast('Выбери точку восстановления', 'error'); return; } if (!confirm('Откатить данные к выбранной точке? Текущее состояние тоже сохранится как точка.')) return; snapshot('Перед откатом'); applyData(snap.data, 'Данные восстановлены из точки'); });
}
export function initProgress() {
  S(); if (typeof data.xp !== 'number') data.xp = 0;
  // Миграция: начислить XP за уже выполненные задачи (один раз)
  if (!data.xpMigrated) { data.tasks.forEach(t => { if (t.status === 'done' && !t.xp) { t.xp = 10; data.xp += 10; } }); data.stats.tasksDone = Math.max(data.stats.tasksDone, data.tasks.filter(t => t.status === 'done').length); data.xpMigrated = true; }
  registerVisit(); rebaseline(); dailySnapshot(); renderSnapshots(); renderProgress(); renderHeatmap(); Sync.status();
}

ACHIEVEMENTS.push(
  { id: 'habit1', icon: 'leaf', rarity: 'common', title: 'Первое зерно', desc: 'Отметь привычку в первый раз', test: s => s.habitChecks >= 1 },
  { id: 'minwin', icon: 'battery', rarity: 'rare', title: 'Минимум засчитан', desc: 'Сделай минимальную версию привычки. Это полноценная победа', test: s => s.minChecks >= 1 },
  { id: 'habitweek', icon: 'repeat', rarity: 'rare', title: 'Ритм недели', desc: 'Достигни недельной цели привычки', test: () => (data.habits || []).some(h => h.log && habitStats(h).thisWeek >= h.target) },
  { id: 'garden', icon: 'leaf', rarity: 'epic', title: 'Сад привычек', desc: '50 отметок привычек в любом темпе', test: s => s.habitChecks >= 50, progress: s => [s.habitChecks, 50] },
  { id: 'coolhead', icon: 'hourglass', rarity: 'rare', title: 'Холодная голова', desc: 'Отпусти хотелку из карантина', test: s => s.released >= 1 },
  { id: 'mindful', icon: 'wallet', rarity: 'common', title: 'Осознанные деньги', desc: 'Запиши 7 трат или доходов', test: s => s.expensesLogged >= 7, progress: s => [s.expensesLogged, 7] },
  { id: 'dump', icon: 'pen', rarity: 'common', title: 'Выгрузка мыслей', desc: 'Запиши 10 мыслей в дневник', test: s => s.thoughts >= 10, progress: s => [s.thoughts, 10] },
  { id: 'gentleplan', icon: 'moon', rarity: 'rare', title: 'Бережный план', desc: 'Сделай «Мягкий перенос» — перенести тоже значит спланировать', test: s => s.softMoves >= 1 },
  { id: 'honestbreak', icon: 'coffee', rarity: 'common', title: 'Честный перерыв', desc: 'Возьми паузу по подсказке котика-напарника', test: s => s.catBreaks >= 1 },
  { id: 'commander', icon: 'bolt', rarity: 'rare', title: 'Командный центр', desc: 'Выполни 10 команд из палитры Ctrl+K', test: s => s.paletteRuns >= 10, progress: s => [Math.min(10, s.paletteRuns), 10] },
  { id: 'kind', icon: 'heart', rarity: 'rare', title: 'Бережность к себе', desc: 'Сделай задачу в бережном режиме', test: s => s.lowModeWins >= 1 }
);
