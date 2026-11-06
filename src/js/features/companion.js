/* Focusday · companion.js — котик-напарник + строгий детектор простоя.
   Котик сидит в углу ТОЛЬКО во время фокус-сессии (body doubling), моргает и машет хвостом.
   Просыпается, когда одновременно: 1) идёт фокус, 2) нет системного ввода ≥ N минут.
   Источник простоя: EXE (Tauri) — GetLastInputInfo Windows (любое приложение);
   браузер — Idle Detection API (Chrome/Edge, по разрешению). Нет источника — котик просто сидит рядом. */
import { $ } from '../core.js';
import { data, persist } from '../state.js';
import { toast } from '../render.js';
import { pauseFocus, startFocus } from '../actions.js';
import { award, checkAchievements } from '../progress.js';
import { playSound } from '../sound.js';
import { CAT_TEXT, mountCat, paintCat } from './cat-ui.js';

const AWAY_AUTO_PAUSE_MS = 10 * 60e3;   // не ответил на «Ты ещё тут?» 10 минут → пауза
let root = null, mode = 'hidden', alertAt = 0, lastNudgeAt = 0, sessionMuted = false, purrUntil = 0, wasRunning = false;
let webIdle = { detector: null, state: 'active', abort: null };
const desktop = () => window.focusdayDesktop;

export function ensureBuddy(d = data) {
  const b = d.buddy && typeof d.buddy === 'object' ? d.buddy : {};
  b.enabled = b.enabled !== false; b.idleNudge = b.idleNudge !== false;
  b.idleMin = [10, 15, 20, 30].includes(+b.idleMin) ? +b.idleMin : 15;
  b.breakMin = Math.max(1, Math.min(30, +b.breakMin || 5));
  b.breakUntil = Number(b.breakUntil) || 0;
  d.buddy = b; return b;
}

/* ── Источник простоя ───────────────────────────────────────────── */
export function idleSource() {
  if (window.__FD_TEST_IDLE__ !== undefined) return 'test';
  if (desktop()?.idleSeconds) return 'system';
  if (webIdle.detector) return 'web';
  return null;
}
async function idleSeconds() {
  const src = idleSource(), b = ensureBuddy();
  if (src === 'test') return Number(window.__FD_TEST_IDLE__) || 0;
  if (src === 'system') { try { const s = await desktop().idleSeconds(); if (s !== null && s !== undefined) return Number(s); } catch (_) {} return null; }
  if (src === 'web') return webIdle.state === 'idle' ? b.idleMin * 60 : 0;
  return null;
}
export async function enableWebIdle(ask = true) {
  if (!('IdleDetector' in window)) { toast('Этот браузер не умеет определять простой. Работает в Chrome/Edge и в EXE-версии.', 'error'); return false; }
  try {
    if (ask && (await window.IdleDetector.requestPermission()) !== 'granted') { toast('Разрешение не выдано — котик просто будет рядом', 'error'); return false; }
    webIdle.abort?.abort(); webIdle.abort = new AbortController();
    const det = new window.IdleDetector();
    det.addEventListener('change', () => { webIdle.state = det.userState; });
    await det.start({ threshold: Math.max(60e3, ensureBuddy().idleMin * 60e3), signal: webIdle.abort.signal });
    webIdle.detector = det; ensureBuddy().webIdle = true; persist(); renderBuddySettings(); return true;
  } catch (e) { webIdle.detector = null; renderBuddySettings(); return false; }
}

/* ── Состояние → экран ──────────────────────────────────────────── */
function state() {
  const b = ensureBuddy(), left = Math.max(0, data.focusRemainingMs || 0);
  const st = { mode, breakEndsAt: b.breakUntil };
  if (mode === 'purr') st.text = `Мур. Я рядом. Осталось ${Math.ceil(left / 60000)} мин — работаем 🐾`;
  return st;
}
function paint() {
  const st = state();
  const useWindow = !!desktop()?.buddy;
  document.body.classList.toggle('desktop-buddy', useWindow);
  if (root) paintCat(root, useWindow ? { mode: 'hidden' } : st);
  if (useWindow) desktop().buddy(st).catch?.(() => {});
}
function setMode(m) { if (m === mode) return; mode = m; paint(); }

/* ── Действия (из пузыря в окне или из окна-компаньона) ─────────── */
export function buddyAction(a) {
  const b = ensureBuddy();
  if (a === 'pet') { if (mode === 'idle') { purrUntil = Date.now() + 4000; setMode('purr'); playSound('click'); } return; }
  if (a === 'snooze') { lastNudgeAt = Date.now(); alertAt = 0; setMode('idle'); toast('Отлично, продолжаем 🐾'); return; }
  if (a === 'mute') { sessionMuted = true; alertAt = 0; setMode('idle'); toast('До конца сессии котик не будет будить'); return; }
  if (a === 'pause') {
    pauseFocus(); b.breakUntil = Date.now() + b.breakMin * 60e3; alertAt = 0; persist();
    award('catbreak'); checkAchievements(); setMode('break'); return;
  }
  if (a === 'extend') { b.breakUntil = Math.max(Date.now(), b.breakUntil) + 5 * 60e3; persist(); setMode('break'); paint(); return; }
  if (a === 'resume') { b.breakUntil = 0; alertAt = 0; lastNudgeAt = Date.now(); persist(); if (!data.focusRunning) startFocus(); setMode('idle'); return; }
  if (a === 'close') { b.breakUntil = 0; persist(); setMode(data.focusRunning ? 'idle' : 'hidden'); }
}

/* ── Главный цикл (каждые 5 с; обратный отсчёт перерыва — каждую секунду) ── */
let busy = false;
export async function buddyTick(now = Date.now()) {
  if (busy) return; busy = true;
  try {
    const b = ensureBuddy(), running = !!data.focusRunning;
    if (running && !wasRunning) { sessionMuted = false; lastNudgeAt = now; }
    wasRunning = running;
    if (b.breakUntil) {
      if (running) { b.breakUntil = 0; persist(); }
      else if (now >= b.breakUntil) {
        if (mode !== 'back') { setMode('back'); playSound('timer'); try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Focusday', { body: CAT_TEXT.back }); } catch (_) {} }
        return;
      } else { setMode('break'); paint(); return; }
    }
    if (mode === 'back' || mode === 'away') { if (running) setMode('idle'); return; }
    if (!running || !b.enabled) { setMode('hidden'); return; }
    if (mode === 'purr' && now > purrUntil) setMode('idle');
    if (mode === 'alert') {
      if (now - alertAt >= AWAY_AUTO_PAUSE_MS) { pauseFocus(); alertAt = 0; setMode('away'); }
      return;
    }
    if (mode === 'hidden') setMode('idle');
    if (!b.idleNudge || sessionMuted) return;
    const idle = await idleSeconds();
    if (idle === null) return;
    if (idle >= b.idleMin * 60 && now - lastNudgeAt >= b.idleMin * 60e3) {
      alertAt = now; lastNudgeAt = now; setMode('alert'); playSound('timer');
      desktop()?.attention?.();
    }
  } finally { busy = false; }
}

export function renderBuddySettings() {
  const b = ensureBuddy();
  $('#buddyEnabled')?.setAttribute('aria-pressed', String(b.enabled));
  $('#buddyNudge')?.setAttribute('aria-pressed', String(b.idleNudge));
  const sel = $('#buddyIdleMin'); if (sel) sel.value = String(b.idleMin);
  const st = $('#buddyStatus'), src = idleSource();
  if (st) st.textContent = src === 'system' ? 'Детектор: системный ввод Windows (мышь и клавиатура в любом приложении)'
    : src === 'web' ? 'Детектор: Idle Detection API браузера (весь компьютер)'
    : src === 'test' ? 'Детектор: тестовый режим'
    : 'Детектор недоступен в этом браузере — котик просто сидит рядом. В EXE-версии работает всегда.';
  const allow = $('#buddyAllowWeb'); if (allow) allow.hidden = !!src || !('IdleDetector' in window);
}

export function bindBuddy() {
  ensureBuddy();
  root = $('#catBuddy'); if (root) mountCat(root, buddyAction);
  desktop()?.onBuddyAction?.(buddyAction);
  $('#buddyEnabled')?.addEventListener('click', () => { const b = ensureBuddy(); b.enabled = !b.enabled; persist(); renderBuddySettings(); buddyTick(); });
  $('#buddyNudge')?.addEventListener('click', () => { const b = ensureBuddy(); b.idleNudge = !b.idleNudge; persist(); renderBuddySettings(); });
  $('#buddyIdleMin')?.addEventListener('change', (e) => { ensureBuddy().idleMin = +e.target.value; persist(); if (webIdle.detector) enableWebIdle(false); renderBuddySettings(); });
  $('#buddyAllowWeb')?.addEventListener('click', () => enableWebIdle(true));
  if (ensureBuddy().webIdle && 'IdleDetector' in window) enableWebIdle(false);
  setInterval(() => buddyTick(), 5000);
  setInterval(() => { if (mode === 'break') paint(); }, 1000);
  buddyTick(); renderBuddySettings();
}
export const _buddy = { mode: () => mode, setLastNudge: (t) => { lastNudgeAt = t; }, setAlertAt: (t) => { alertAt = t; } };
