/* Focusday · sound.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { $ } from './core.js';
import { data, persist } from './state.js';

export let audioContext = null;
export function syncSoundButtons() {
  const enabled = data.soundEnabled !== false;
  const btn = $('#soundBtn');
  if (btn) { btn.title = enabled ? 'Отключить звуки' : 'Включить звуки'; btn.setAttribute('aria-pressed', String(enabled)); }
  const settingsBtn = $('#soundSettingsBtn');
  if (settingsBtn) { settingsBtn.textContent = enabled ? 'Звук включён' : 'Звук выключен'; settingsBtn.setAttribute('aria-pressed', String(enabled)); }
}
export function playSound(kind='click') {
  if (data.soundEnabled === false) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const notes = kind === 'achievement' ? [{f:783.99,t:0,d:.12},{f:987.77,t:.07,d:.12},{f:1174.66,t:.14,d:.16},{f:1567.98,t:.22,d:.32}]
      : kind === 'levelup' ? [{f:523.25,t:0,d:.14},{f:659.25,t:.1,d:.14},{f:783.99,t:.2,d:.14},{f:1046.5,t:.3,d:.45},{f:1318.5,t:.3,d:.45}]
      : kind === 'success' ? [{f:523.25,t:0,d:.13},{f:659.25,t:.09,d:.14},{f:783.99,t:.18,d:.2}]
      : kind === 'timer' ? [{f:440,t:0,d:.12},{f:659.25,t:.08,d:.18}]
      : [{f:740,t:0,d:.045}];
    notes.forEach(n => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = kind === 'click' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(n.f, now+n.t);
      gain.gain.setValueAtTime(.0001, now+n.t);
      gain.gain.exponentialRampToValueAtTime(kind === 'click' ? .025 : .045, now+n.t+.012);
      gain.gain.exponentialRampToValueAtTime(.0001, now+n.t+n.d);
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.start(now+n.t); osc.stop(now+n.t+n.d+.02);
    });
  } catch (_) { /* audio is optional; app functionality must not depend on it */ }
}
export function toggleSound() { data.soundEnabled = data.soundEnabled === false; persist(); syncSoundButtons(); if (data.soundEnabled) playSound('success'); }
