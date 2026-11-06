/* Focusday · life/journal.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { lid, lowShowAll, set_lowShowAll, touch } from '../life/quick.js';
import { award, checkAchievements } from '../progress.js';
import { renderAll, toast } from '../render.js';
import { data, persist } from '../state.js';

/* ── 4. Дневник мыслей ─────────────────────────────────────────── */
export function addThought(text, mood) {
  data.thoughts.unshift(touch({ id: lid('n'), text: String(text).slice(0, 1000), mood: Math.max(0, Math.min(5, Number(mood) || 0)), at: Date.now() }));
  award('thought'); persist(); renderAll(); checkAchievements(); toast('Мысль сохранена — голове стало легче');
}

/* ── 5. Бережный режим (Low-Energy Mode) ──────────────────────── */
export function setLowEnergy(on, silent) {
  data.lowEnergy = !!on; set_lowShowAll( false); persist(); renderAll();
  if (!silent) toast(on ? 'Бережный режим: только лёгкое и минимальные версии привычек' : 'Обычный режим');
}
export function lowFilter(list) {
  if (!data.lowEnergy || lowShowAll || !['today', 'inbox'].includes(data.view)) return list;
  return list.filter(t => t.status !== 'done').sort((a, b) => a.duration - b.duration).slice(0, 3);
}
