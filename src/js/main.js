/* Focusday · main.js — точка входа. Порядок: данные → привязка событий → модули → первый рендер → таймеры. */
import { bindEvents, timerTick } from './actions.js';
import { bindAdhd } from './adhd.js';
import { $, LEGACY_KEYS, STORAGE_KEY, storage, plural, todayISO, validDate } from './core.js';
import { bindWelcome } from './features/welcome.js';
import { ensureLife } from './life/quick.js';
import { bindLife } from './life/render.js';
import { bindProgress, checkAchievements, initProgress } from './progress.js';
import { renderAll, rollDailyRoutines } from './render.js';
import { syncSoundButtons } from './sound.js';
import { data, loadData, persistNow, set_tickHandle } from './state.js';
import { SyncEngine, bindSyncUI } from './sync.js';
import { bindQuotes, ensureQuotes } from './features/quotes.js';
import { bindAmbient, ensureAmbient } from './features/ambient.js';
import { bindBuddy, ensureBuddy, buddyTick, buddyAction } from './features/companion.js';
import { bindPalette } from './features/palette.js';
import { bindSoftPlan } from './features/softplan.js';
import { bindSettings } from './features/settings.js';

export function updateSettingsCount() {
  $('#taskDataCount').textContent = `${data.tasks.length} ${plural(data.tasks.length, ['задача', 'задачи', 'задач'])} · ${data.lists.length} ${plural(data.lists.length, ['список', 'списка', 'списков'])}`;
}

/** Каждый модуль стартует изолированно: ошибка одного не роняет приложение. */
function safe(name, fn) { try { fn(); } catch (err) { console.error(`Focusday: модуль «${name}» не запустился`, err); } }

export function init() {
  const hasExistingData = !!storage.getItem(STORAGE_KEY) || LEGACY_KEYS.some(key => !!storage.getItem(key));
  loadData(); rollDailyRoutines();
  const systemToday = todayISO();
  if (!validDate(data.selectedDate)) data.selectedDate = systemToday;
  if (data.view === 'today' && data.selectedDate !== systemToday) { data.selectedDate = systemToday; data.calendarOffset = 0; }
  if (data.focusRunning) { data.focusRunning = false; data.focusStartedAt = null; }
  ensureLife(); ensureQuotes(); ensureAmbient(); ensureBuddy();
  // New mobile users start quietly; existing choices are preserved.
  if (!hasExistingData && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) data.ambient.withFocus = false;
  bindEvents(); bindAdhd(); bindProgress(); bindLife();
  safe('quotes', bindQuotes); safe('ambient', bindAmbient); safe('companion', bindBuddy);
  safe('palette', bindPalette); safe('softplan', bindSoftPlan); safe('sync-ui', bindSyncUI); safe('settings', bindSettings);
  initProgress();
  document.body.classList.toggle('compress-mode', !!data.compress);
  $('#compressBtn')?.setAttribute('aria-pressed', String(!!data.compress));
  $('#viewToggle')?.setAttribute('aria-pressed', String(data.viewMode === 'compact'));
  renderAll(); checkAchievements(); syncSoundButtons(); updateSettingsCount();
  document.body.classList.toggle('compact-tasks', data.viewMode === 'compact');
  set_tickHandle(setInterval(timerTick, 250));
  safe('sync', () => SyncEngine.start());
  safe('welcome', () => bindWelcome(hasExistingData));
  window.addEventListener('beforeunload', persistNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistNow(); });
  // PWA: офлайн-кэш только на http(s) (в EXE и при открытии файла — не нужен).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.__TAURI__) navigator.serviceWorker.register('sw.js').catch(() => {});
  // Хук для автотестов (только когда тест сам выставил __FD_TEST_IDLE__)
  if (window.__FD_TEST_IDLE__ !== undefined) window.__FD_TEST__ = { buddyTick, buddyAction, get data() { return data; } };
}

if (typeof document !== 'undefined' && document.getElementById('taskList')) init();
