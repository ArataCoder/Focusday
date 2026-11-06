/* Focusday · ambient.js — «звуковой напарник» в карточке фокуса.
   Звук может идти сам по себе или вместе с фокусом: старт фокуса → плавный вход,
   пауза → мягкий выход за 1,5 с, конец сессии → затухание за последние 10 секунд. */
import { $, $$, esc } from '../core.js';
import { data, persist } from '../state.js';
import { SOUNDS, createAmbientPlayer } from './ambient-engine.js';

const player = createAmbientPlayer(() => new (window.AudioContext || window.webkitAudioContext)());
let auto = false, lastRunning = null, endingFade = false;

export function ensureAmbient(d = data) {
  const a = d.ambient && typeof d.ambient === 'object' ? d.ambient : {};
  if (!SOUNDS.some(s => s.id === a.id)) a.id = 'rain';
  a.volume = Math.max(0, Math.min(1, Number.isFinite(+a.volume) ? +a.volume : 0.45));
  a.withFocus = a.withFocus === undefined ? true : !!a.withFocus;
  d.ambient = a; return a;
}
const sound = () => SOUNDS.find(s => s.id === ensureAmbient().id);

export function renderAmbient() {
  const a = ensureAmbient(), s = sound(), btn = $('#ambToggle'); if (!btn) return;
  btn.setAttribute('aria-pressed', String(player.playing));
  btn.classList.toggle('on', player.playing);
  $('#ambName').textContent = player.playing ? `${s.name} · играет` : `Фон: ${s.name}`;
  $('#ambEmoji').textContent = s.emoji;
  $$('#ambGrid [data-amb]').forEach(b => { const on = b.dataset.amb === a.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  const v = $('#ambVol'); if (v && document.activeElement !== v) v.value = String(Math.round(a.volume * 100));
  const wf = $('#ambWithFocus'); if (wf) wf.setAttribute('aria-pressed', String(a.withFocus));
  // Зеркало в «Настройки → Вид и звуки»
  const sid = $('#setAmbId'); if (sid && document.activeElement !== sid) sid.value = a.id;
  const sv = $('#setAmbVol'); if (sv && document.activeElement !== sv) sv.value = String(Math.round(a.volume * 100));
  $('#setAmbWithFocus')?.setAttribute('aria-pressed', String(a.withFocus));
  const pv = $('#setAmbPreview'); if (pv) { pv.querySelector('span').textContent = player.playing ? 'Остановить' : 'Послушать'; pv.querySelector('use')?.setAttribute('href', player.playing ? '#i-pause' : '#i-play'); }
}
export function playAmbient(id = ensureAmbient().id) { const a = ensureAmbient(); a.id = id; player.setVolume(a.volume); player.play(id); endingFade = false; persist(); renderAmbient(); }
export function stopAmbient(fade = 1.5) { auto = false; player.stop(fade); renderAmbient(); setTimeout(renderAmbient, fade * 1000 + 250); }

/* Следим за фокусом раз в секунду (без правок в таймере). */
function followFocus() {
  const a = ensureAmbient(), running = !!data.focusRunning;
  if (lastRunning === null) { lastRunning = running; return; }
  if (running !== lastRunning) {
    lastRunning = running;
    if (running && a.withFocus && !player.playing) { auto = true; playAmbient(); }
    else if (!running && auto && player.playing) stopAmbient(endingFade ? 0.4 : 1.5);
    return;
  }
  if (running && auto && player.playing && !endingFade && data.focusRemainingMs > 0 && data.focusRemainingMs <= 10500) {
    endingFade = true; player.stop(Math.max(1, data.focusRemainingMs / 1000)); setTimeout(renderAmbient, data.focusRemainingMs + 300);
  }
}

export function bindAmbient() {
  const box = $('#ambientBox'); if (!box) return;
  ensureAmbient();
  $('#ambGrid').innerHTML = SOUNDS.map(s => `<button type="button" class="amb-tile" data-amb="${s.id}" aria-pressed="false"><span aria-hidden="true">${s.emoji}</span>${esc(s.name)}</button>`).join('');
  $('#ambToggle').addEventListener('click', () => { if (player.playing) stopAmbient(); else { auto = !!data.focusRunning && ensureAmbient().withFocus; playAmbient(); } });
  $('#ambMore').addEventListener('click', () => { const p = $('#ambPanel'); p.hidden = !p.hidden; $('#ambMore').setAttribute('aria-expanded', String(!p.hidden)); });
  $('#ambGrid').addEventListener('click', e => { const b = e.target.closest('[data-amb]'); if (b) playAmbient(b.dataset.amb); });
  $('#ambVol').addEventListener('input', e => { const a = ensureAmbient(); a.volume = Number(e.target.value) / 100; player.setVolume(a.volume); persist(); });
  $('#ambWithFocus').addEventListener('click', () => { const a = ensureAmbient(); a.withFocus = !a.withFocus; persist(); renderAmbient(); });
  const sid = $('#setAmbId');
  if (sid) {
    sid.innerHTML = SOUNDS.map(s => `<option value="${s.id}">${s.emoji} ${esc(s.name)}</option>`).join('');
    sid.addEventListener('change', () => { if (player.playing) playAmbient(sid.value); else { ensureAmbient().id = sid.value; persist(); renderAmbient(); } });
    $('#setAmbVol')?.addEventListener('input', e => { const a = ensureAmbient(); a.volume = Number(e.target.value) / 100; player.setVolume(a.volume); persist(); renderAmbient(); });
    $('#setAmbWithFocus')?.addEventListener('click', () => { const a = ensureAmbient(); a.withFocus = !a.withFocus; persist(); renderAmbient(); });
    $('#setAmbPreview')?.addEventListener('click', () => { if (player.playing) stopAmbient(0.6); else { auto = false; playAmbient(); } });
  }
  setInterval(followFocus, 1000);
  renderAmbient();
}
export const _ambientPlayer = player;
