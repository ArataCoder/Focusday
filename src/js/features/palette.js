/* Focusday · palette.js — палитра команд Ctrl+K: поиск по задачам/привычкам/мыслям + быстрые действия.
   Понимает синтаксис Q: «@вода», «-$5 кофе», «!мысль» прямо из палитры. «/» — обычный поиск по задачам. */
import { $, esc, ic } from '../core.js';
import { data } from '../state.js';
import { closeModals, openModal, showModal, switchView } from '../render.js';
import { setFocusTask, startFocus } from '../actions.js';
import { focusQuickCapture, setCompress, setFocusMode } from '../adhd.js';
import { setLowEnergy } from '../life/journal.js';
import { checkHabitByName } from '../life/habits.js';
import { classifyQuick, describeQuick, routeQuick } from '../life/quick.js';
import { exportData } from '../backup.js';
import { SyncEngine } from '../sync.js';
import { showNextQuote } from './quotes.js';
import { softCandidates, softReschedule } from './softplan.js';
import { playAmbient, stopAmbient, _ambientPlayer } from './ambient.js';
import { SOUNDS } from './ambient-engine.js';

let items = [], active = 0;
const norm = (s) => String(s || '').toLocaleLowerCase('ru').replace(/ё/g, 'е');
/** Нечёткое совпадение: подстрока (лучше) или подпоследовательность. 0 = нет совпадения. */
export function fuzzyScore(text, q) {
  const t = norm(text), s = norm(q).trim(); if (!s) return 1;
  const i = t.indexOf(s); if (i >= 0) return 100 - Math.min(i, 50) + (i === 0 || t[i - 1] === ' ' ? 20 : 0);
  let k = 0, gaps = 0; for (let j = 0; j < t.length && k < s.length; j++) { if (t[j] === s[k]) k++; else if (k) gaps++; }
  return k === s.length ? Math.max(1, 40 - gaps) : 0;
}

export function commands() {
  const soft = softCandidates().length, playing = _ambientPlayer.playing;
  const go = (v) => () => switchView(v);
  const list = [
    { t: 'Новая задача', k: 'N', icon: 'plus', run: () => openModal() },
    { t: 'Быстрый ввод: задача · @привычка · -$трата · !мысль', k: 'Q', icon: 'bolt', run: focusQuickCapture },
    { t: data.focusRunning ? 'Пауза фокуса' : 'Начать фокус', k: 'Space', icon: data.focusRunning ? 'pause' : 'play', run: startFocus },
    { t: 'Режим фокуса (только таймер)', k: 'F', icon: 'focus', run: () => setFocusMode(!document.body.classList.contains('focus-mode')) },
    { t: data.compress ? 'Обычный вид' : 'Сжатый вид', k: 'C', icon: 'compress', run: () => setCompress(!data.compress) },
    { t: data.lowEnergy ? 'Выключить бережный режим' : 'Бережный режим (мало сил)', k: 'L', icon: 'battery', run: () => setLowEnergy(!data.lowEnergy) },
    soft && { t: `Мягкий перенос (${soft})`, hint: 'невыполненное — на завтра, без вины', icon: 'moon', run: () => softReschedule() },
    { t: 'Сегодня', k: '1', icon: 'sun', run: go('today'), group: 'Разделы' }, { t: 'Входящие', k: '2', icon: 'inbox', run: go('inbox'), group: 'Разделы' },
    { t: 'План', k: '3', icon: 'calendar', run: go('upcoming'), group: 'Разделы' }, { t: 'Сделано', k: '4', icon: 'check-circle', run: go('done'), group: 'Разделы' },
    { t: 'Привычки', k: '5', icon: 'leaf', run: go('habits'), group: 'Разделы' }, { t: 'Финансы', k: '6', icon: 'wallet', run: go('money'), group: 'Разделы' },
    { t: 'Мысли', k: '7', icon: 'pen', run: go('journal'), group: 'Разделы' },
    { t: 'Достижения', icon: 'trophy', run: () => $('#achievementsBtn')?.click(), group: 'Разделы' },
    { t: 'Настройки и данные', icon: 'gear', run: () => $('#settingsBtn')?.click(), group: 'Разделы' },
    { t: playing ? 'Выключить фоновый звук' : 'Включить фоновый звук', icon: 'wave', run: () => playing ? stopAmbient() : playAmbient(), group: 'Звук' },
    ...SOUNDS.map(s => ({ t: `Фон: ${s.name}`, hint: s.emoji, icon: 'wave', run: () => playAmbient(s.id), group: 'Звук' })),
    { t: 'Другая цитата', icon: 'feather', run: () => showNextQuote(true) },
    { t: 'Сменить тему', icon: data.theme === 'light' ? 'moon' : 'sun', run: () => $('#themeBtn')?.click() },
    { t: 'Экспорт бэкапа (.json)', icon: 'download', run: exportData, group: 'Данные' },
    SyncEngine.enabled() && { t: 'Синхронизировать сейчас', icon: 'sync', run: () => SyncEngine.syncNow('manual'), group: 'Данные' },
    window.focusdayDesktop && { t: 'Плавающий виджет', k: 'Ctrl Alt F', icon: 'widget', run: () => window.focusdayDesktop.openOverlay(), group: 'Данные' }
  ];
  return list.filter(Boolean).map(c => ({ group: 'Действия', ...c }));
}

export function buildItems(q) {
  q = String(q || '').trim(); const out = [];
  const c = q ? classifyQuick(q) : null;
  if (c && c.kind !== 'task') out.push({ t: `Добавить: ${q}`, html: describeQuick(c), icon: 'bolt', group: 'Быстрый ввод', run: () => routeQuick(q), score: 999 });
  commands().forEach(x => { const s = fuzzyScore(x.t + ' ' + (x.hint || ''), q); if (s) out.push({ ...x, score: s + (x.group === 'Действия' ? 5 : 0) }); });
  if (q) {
    data.tasks.forEach(t => { const s = fuzzyScore(t.title + ' ' + (t.description || ''), q); if (s) out.push({ t: t.title, hint: t.status === 'done' ? 'сделано' : t.date, icon: t.status === 'done' ? 'check-circle' : 'target', group: 'Задачи', score: s + (t.status === 'done' ? 0 : 10), run: () => { openModal(t); } , alt: () => setFocusTask(t.id) }); });
    (data.habits || []).forEach(h => { const s = fuzzyScore(h.name, q); if (s) out.push({ t: `Отметить привычку: ${h.name}`, icon: 'leaf', group: 'Привычки', score: s, run: () => checkHabitByName(h.name, data.lowEnergy) }); });
    (data.thoughts || []).forEach(n => { const s = fuzzyScore(n.text, q); if (s > 20) out.push({ t: n.text.slice(0, 80), icon: 'pen', group: 'Мысли', score: s - 10, run: () => switchView('journal') }); });
    if (!c || c.kind === 'task') out.push({ t: `Создать задачу «${q}»`, icon: 'plus', group: 'Быстрый ввод', score: 0.5, run: () => routeQuick(q) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 40);
}

function paint() {
  const ul = $('#paletteList'); let html = '', last = '';
  items.forEach((x, i) => {
    if (x.group !== last && !$('#paletteInput').value.trim()) { html += `<li class="pal-group" role="presentation">${esc(x.group)}</li>`; last = x.group; }
    html += `<li role="option" id="pal-${i}" class="pal-item${i === active ? ' active' : ''}" aria-selected="${i === active}" data-i="${i}">${ic(x.icon || 'dot')}<span>${x.html || esc(x.t)}</span>${x.hint ? `<small>${esc(x.hint)}</small>` : ''}${x.k ? `<kbd>${esc(x.k)}</kbd>` : ''}</li>`;
  });
  ul.innerHTML = html || '<li class="pal-empty">Ничего не нашлось. Enter — создать задачу.</li>';
  $('#paletteInput').setAttribute('aria-activedescendant', items.length ? `pal-${active}` : '');
  $(`#pal-${active}`)?.scrollIntoView({ block: 'nearest' });
}
function refresh() { items = buildItems($('#paletteInput').value); active = 0; paint(); }
function run(i, alt) { const x = items[i]; if (!x) return; closeModals(); setTimeout(() => (alt && x.alt ? x.alt : x.run)(), 30); data.stats && (data.stats.paletteRuns = (Number(data.stats.paletteRuns) || 0) + 1); }

export function openPalette(prefill = '') {
  if (!$('#paletteModal')) return;
  $('#paletteInput').value = prefill; refresh(); showModal('paletteModal');
  setTimeout(() => $('#paletteInput').focus(), 70);
}
export function bindPalette() {
  const input = $('#paletteInput'); if (!input) return;
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(active, e.shiftKey); }
  });
  $('#paletteList').addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) run(+li.dataset.i, e.shiftKey); });
  $('#paletteList').addEventListener('mousemove', (e) => { const li = e.target.closest('[data-i]'); if (li && +li.dataset.i !== active) { active = +li.dataset.i; $$active(); } });
  $('#paletteBtn')?.addEventListener('click', () => openPalette());
  // «/» — классический поиск по задачам (Ctrl+K теперь — палитра)
  document.addEventListener('keydown', (e) => {
    const a = document.activeElement, typing = a && (['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) || a.isContentEditable);
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !document.querySelector('.modal-backdrop:not([hidden])')) { e.preventDefault(); $('#searchInput')?.focus(); }
  });
}
function $$active() { document.querySelectorAll('#paletteList .pal-item').forEach(li => { const on = +li.dataset.i === active; li.classList.toggle('active', on); li.setAttribute('aria-selected', String(on)); }); }
