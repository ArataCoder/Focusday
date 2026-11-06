(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const api = window.focusdayDesktop;
  const win = window.__TAURI__?.window?.getCurrentWindow?.();
  let state = {}, tick = null;

  const fmt = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  function paint() {
    const left = state.running && state.deadline ? state.deadline - Date.now() : state.remainingMs || 0;
    $('time').textContent = state.title ? fmt(left) : '';
    const total = state.totalMs || (left > 0 ? Math.max(left, 600000) : 1);
    $('bar').style.width = `${Math.min(100, Math.max(0, 100 - (left / total) * 100))}%`;
  }
  function render(s) {
    state = s || {};
    $('task').textContent = state.title || 'Выбери задачу в Focusday';
    $('hint').textContent = state.title ? (state.running ? 'Ты всё ещё делаешь эту задачу?' : 'Фокус на паузе — вернёмся?') : 'Добавь задачу и начни маленький шаг';
    $('pause').textContent = state.running ? 'Пауза' : 'Продолжить';
    document.body.classList.toggle('paused', !state.running);
    clearInterval(tick); paint(); if (state.running) tick = setInterval(paint, 1000);
  }
  async function hide() {
    $('panel').classList.add('out');
    setTimeout(async () => { try { await win?.hide(); } catch (_) {} $('panel').classList.remove('out'); }, 280);
  }

  api?.onOverlayState(render);
  window.__TAURI__?.event?.emit('focusday://overlay-ready');
  // При каждом новом показе — проиграть въезд заново
  win?.listen?.('tauri://focus', () => { const p = $('panel'); p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; });

  $('confirm').addEventListener('click', () => { api?.overlayAction('snooze'); hide(); });
  $('pause').addEventListener('click', () => api?.overlayAction('toggle'));
  $('done').addEventListener('click', () => { api?.overlayAction('done'); hide(); });
  $('close').addEventListener('click', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
})();
