/* Focusday · life/quick.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { parseQuick, quickAddTask } from '../adhd.js';
import { esc, ic, todayISO } from '../core.js';
import { checkHabitByName, findHabit } from '../life/habits.js';
import { addThought } from '../life/journal.js';
import { addExpense, addWish } from '../life/money.js';
import { data, prettyDate } from '../state.js';

/* ═══════════════════════════════════════════════════════════════════
   LIFE MODULE · привычки · микро-финансы · дневник мыслей · бережный режим
   Принцип Zero-Friction & No-Guilt: 1 нажатие на действие, ничего не «сгорает».
   ═══════════════════════════════════════════════════════════════════ */
export const MOODS = ['', 'Пусто', 'Тяжело', 'Ровно', 'Хорошо', 'Ярко'];
export const HABIT_COLORS = ['#5ef0c0', '#8f7dff', '#6cc8ff', '#ffc46b', '#ff7d96', '#e7a7e8'];
export let lowShowAll = false;

export function ensureLife() {
  if (!Array.isArray(data.habits)) data.habits = [];
  if (!Array.isArray(data.expenses)) data.expenses = [];
  if (!Array.isArray(data.chamber)) data.chamber = [];
  if (!Array.isArray(data.thoughts)) data.thoughts = [];
  const m = data.money && typeof data.money === 'object' ? data.money : {};
  data.money = { currency: String(m.currency || '€').slice(0, 4), dailyLimit: Math.max(0, Number(m.dailyLimit) || 25), impulse: Math.max(1, Number(m.impulse) || 30), coolHours: [12, 24, 48, 72].includes(Number(m.coolHours)) ? Number(m.coolHours) : 24, saved: Math.max(0, Number(m.saved) || 0), updatedAt: Number(m.updatedAt) || 0 };
  data.habits.forEach(h => { h.log = h.log && typeof h.log === 'object' ? h.log : {}; h.target = Math.max(1, Math.min(7, Number(h.target) || 4)); });
}
export const touch = (o) => { o.updatedAt = Date.now(); return o; };
export const lid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
export const money = (n) => `${(Math.round(n * 100) / 100).toLocaleString('ru-RU', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${data.money.currency}`;
export const num = (s) => Math.round(parseFloat(String(s).replace(/\s/g, '').replace(',', '.')) * 100) / 100;
export function removeItem(coll, id) { data[coll] = data[coll].filter(x => x.id !== id); data.deleted = data.deleted || {}; data.deleted[id] = Date.now(); }

/* ── 1. Универсальный быстрый ввод (Q) ───────────────────────────────
   !мысль           → дневник            @вода  / @вода мин  → привычка (мин = минимальная версия)
   -$12,5 кофе #еда → расход             +$500 зарплата     → доход
   ?$80 наушники    → Cool-off Chamber   всё остальное      → задача (завтра · 15м · ! · #список) */
export const MONEY_RE = /^([+\-?])\s?(?:\$|€|₽|₴)?\s?(\d+(?:[.,]\d{1,2})?)\s?(?:\$|€|₽|₴|р|грн|eur)?\s*(.*)$/i;
export function classifyQuick(raw) {
  const text = String(raw || '').trim(); if (!text) return null;
  if (text.startsWith('!')) return { kind: 'thought', text: text.slice(1).trim() };
  if (text.startsWith('@')) {
    let body = text.slice(1).trim(), min = false;
    body = body.replace(/\s+(мин|min|минимум)$/i, () => { min = true; return ''; }).trim();
    return body ? { kind: 'habit', name: body, min } : null;
  }
  const m = text.match(MONEY_RE);
  if (m && (m[1] !== '-' || /^-\s?[$€₽₴]|^-\s?\d/.test(text))) {
    const amount = num(m[2]); if (!(amount > 0)) return null;
    let note = m[3].trim(), tag = '';
    note = note.replace(/(?:^|\s)#([\p{L}\d_-]+)/u, (_, t) => { tag = t.toLowerCase(); return ''; }).trim();
    const kind = m[1] === '?' ? 'wish' : m[1] === '+' ? 'income' : 'expense';
    return { kind, amount, note: note || (kind === 'income' ? 'Доход' : tag || 'Без описания'), tag };
  }
  return { kind: 'task', ...parseQuick(text) };
}
export function describeQuick(c) {
  if (!c) return '';
  if (c.kind === 'thought') return `${ic('pen')} Мысль`;
  if (c.kind === 'habit') { const h = findHabit(c.name); return `${ic('leaf')} ${h ? esc(h.name) : 'Новая привычка'}${c.min ? ' · минимум' : ''}`; }
  if (c.kind === 'expense') return `${ic('wallet')} −${money(c.amount)}${c.tag ? ' · #' + esc(c.tag) : ''}`;
  if (c.kind === 'income') return `${ic('wallet')} +${money(c.amount)}`;
  if (c.kind === 'wish') return `${ic('hourglass')} В карантин · ${money(c.amount)}`;
  const bits = [`${ic('check-circle')} Задача`]; if (c.date !== todayISO()) bits.push(esc(prettyDate(c.date))); if (c.duration !== 25) bits.push(c.duration + 'м'); if (c.priority === 3) bits.push('важно');
  return bits.join(' · ');
}
export function routeQuick(raw) {
  const c = classifyQuick(raw); if (!c) return false;
  if (c.kind === 'task') return quickAddTask(raw);
  if (c.kind === 'thought') { if (!c.text) return false; addThought(c.text, 0); }
  else if (c.kind === 'habit') checkHabitByName(c.name, c.min);
  else if (c.kind === 'expense' || c.kind === 'income') addExpense(c);
  else if (c.kind === 'wish') addWish(c.note, c.amount);
  return true;
}
export function set_lowShowAll(v) { return (lowShowAll = v); }
