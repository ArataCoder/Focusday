/* Focusday · life/money.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { todayISO } from '../core.js';
import { lid, money, removeItem, touch } from '../life/quick.js';
import { award, checkAchievements } from '../progress.js';
import { renderAll, toast } from '../render.js';
import { data, persist } from '../state.js';

/* ── 3. Микро-финансы: дневной лимит + Cool-off Chamber ─────────── */
export const spentOn = (iso) => data.expenses.filter(e => e.type === 'out' && e.date === iso).reduce((s, e) => s + e.amount, 0);
export function addExpense(c) {
  const e = touch({ id: lid('e'), type: c.kind === 'income' ? 'in' : 'out', amount: c.amount, note: String(c.note).slice(0, 60), tag: c.tag || '', date: todayISO(), at: Date.now() });
  data.expenses.push(e); award('expense'); persist(); renderAll(); checkAchievements();
  if (e.type === 'out' && e.amount >= data.money.impulse && e.tag !== 'нужно') {
    toast(`−${money(e.amount)} — больше порога импульса. Подержать в карантине ${data.money.coolHours} ч?`, 'success', { label: 'В карантин', onClick: () => { removeItem('expenses', e.id); addWish(e.note, e.amount); } });
  } else toast(e.type === 'in' ? `+${money(e.amount)} записано` : `−${money(e.amount)} · осталось сегодня ${money(Math.max(0, data.money.dailyLimit - spentOn(todayISO())))}`);
}
export function addWish(title, price) {
  const hours = price >= data.money.impulse * 3 ? Math.max(72, data.money.coolHours) : data.money.coolHours;
  data.chamber.push(touch({ id: lid('w'), title: String(title || 'Хотелка').slice(0, 60), price, addedAt: Date.now(), until: Date.now() + hours * 3600e3, status: 'waiting' }));
  persist(); renderAll(); checkAchievements();
  toast(`«${title}» в карантине на ${hours} ч. Если через ${hours} ч всё ещё нужно — купишь без чувства вины.`);
}
export function decideWish(id, decision) {
  const w = data.chamber.find(x => x.id === id); if (!w || w.status !== 'waiting') return;
  w.status = decision; w.decidedAt = Date.now(); touch(w);
  if (decision === 'released') { data.money.saved += w.price; touch(data.money); award('release', { amount: w.price }); toast(`Отпущено. +${money(w.price)} в копилку осознанности ✦`); }
  else { data.expenses.push(touch({ id: lid('e'), type: 'out', amount: w.price, note: w.title, tag: 'обдуманно', date: todayISO(), at: Date.now() })); toast('Покупка обдумана — наслаждайся без вины'); }
  persist(); renderAll(); checkAchievements();
}
export const hoursLeft = (w) => Math.max(0, Math.ceil((w.until - Date.now()) / 3600e3));
