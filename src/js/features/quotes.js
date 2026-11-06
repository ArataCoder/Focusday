/* Focusday · quotes.js — динамическая карточка цитат.
   Смена: раз в 5 минут и при возвращении в окно, только если тебя не было > 2,5 минуты
   (Alt+Tab туда-обратно цитату не трогает). Без повторов подряд, мягкий fade. */
import { $, $$, esc } from '../core.js';
import { data, persist } from '../state.js';
import { toast } from '../render.js';
import { QUOTE_CATS, QUOTE_LIBRARY } from './quotes-data.js';

export const ROTATE_MS = 5 * 60e3, AWAY_MS = 150e3;
const DEFAULT_CATS = { gentle: true, action: true, dc: true, anime: true, samurai: true, classic: true, custom: true };
let hiddenAt = 0, current = null;

export function ensureQuotes(d = data) {
  const q = d.quotes && typeof d.quotes === 'object' ? d.quotes : {};
  q.cats = { ...DEFAULT_CATS, ...(q.cats || {}) };
  q.showDeep = !!q.showDeep;
  q.hidden = Array.isArray(q.hidden) ? q.hidden.filter(x => typeof x === 'string') : [];
  q.recent = Array.isArray(q.recent) ? q.recent.slice(-12) : [];
  q.custom = Array.isArray(q.custom) ? q.custom.filter(x => x && typeof x.text === 'string') : [];
  // миграция v1.x: data.customQuotes = ['строка', …]
  if (Array.isArray(d.customQuotes) && d.customQuotes.length) {
    normalizeQuotes(d.customQuotes).forEach(x => { if (!q.custom.some(c => c.id === x.id)) q.custom.push(x); });
    d.customQuotes = [];
  }
  d.quotes = q; return q;
}

const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
/** Принимает массив строк/объектов или { quotes: [...] }. Возвращает валидные цитаты. */
export function normalizeQuotes(input) {
  const arr = Array.isArray(input) ? input : Array.isArray(input?.quotes) ? input.quotes : [];
  const out = [], seen = new Set();
  for (const raw of arr.slice(0, 2000)) {
    const o = typeof raw === 'string' ? { text: raw } : raw && typeof raw === 'object' ? raw : null;
    const text = String(o?.text ?? o?.quote ?? '').replace(/\s+/g, ' ').trim().replace(/^[«"“]|[»"”]$/g, '');
    if (text.length < 3 || text.length > 400) continue;
    const key = text.toLocaleLowerCase('ru'); if (seen.has(key)) continue; seen.add(key);
    const tone = ['gentle', 'drive', 'deep'].includes(o.tone) ? o.tone : 'gentle';
    out.push({ id: 'u' + hash(key), cat: 'custom', tone, text, author: String(o.author || 'Моя цитата').slice(0, 60), source: String(o.source || '').slice(0, 80) });
  }
  return out;
}

export function quotePool(q = ensureQuotes()) {
  return [...QUOTE_LIBRARY, ...q.custom].filter(x => q.cats[x.cat] !== false && (q.showDeep || x.tone !== 'deep') && !q.hidden.includes(x.id));
}

/** Выбор без повторов подряд: исключаем текущую и последние ~N показанных. */
export function pickQuote(q = ensureQuotes(), rnd = Math.random) {
  const pool = quotePool(q); if (!pool.length) return null;
  const avoid = new Set(q.recent.slice(-Math.min(8, pool.length - 1)));
  const fresh = pool.filter(x => !avoid.has(x.id));
  const list = fresh.length ? fresh : pool.filter(x => x.id !== q.recent.at(-1));
  const pick = (list.length ? list : pool)[Math.floor(rnd() * (list.length || pool.length))];
  q.recent = [...q.recent, pick.id].slice(-12); q.changedAt = Date.now(); q.currentId = pick.id;
  return pick;
}

function paint(x, animate) {
  const card = $('.quote-card'), p = $('#dailyQuote'), au = $('#quoteAuthor'); if (!card || !p) return;
  const apply = () => {
    if (!x) { p.textContent = 'Все цитаты скрыты фильтром — загляни в настройки.'; au.innerHTML = ''; }
    else { p.textContent = `«${x.text}»`; au.innerHTML = `<b>${esc(x.author)}</b>${x.source ? ' · ' + esc(x.source) : ''}`; }
    card.dataset.cat = x?.cat || ''; card.classList.remove('swap');
  };
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) { card.classList.add('swap'); setTimeout(apply, 320); } else apply();
}

export function showNextQuote(animate = true) { const q = ensureQuotes(); current = pickQuote(q); paint(current, animate); persist(); }
export function renderQuote() {
  const q = ensureQuotes(); const pool = quotePool(q);
  current = pool.find(x => x.id === q.currentId) || null;
  if (!current || Date.now() - (q.changedAt || 0) > ROTATE_MS) current = pickQuote(q);
  paint(current, false); renderQuoteSettings();
}
export function hideCurrentQuote() {
  if (!current) return; const q = ensureQuotes(), id = current.id, title = current.author;
  q.hidden.push(id); showNextQuote(true);
  toast(`Цитата «${title}» больше не появится`, 'success', { label: 'Вернуть', onClick: () => { q.hidden = q.hidden.filter(x => x !== id); persist(); renderQuoteSettings(); } });
  renderQuoteSettings();
}

export async function importQuotesFromJSON(file) {
  try {
    const list = normalizeQuotes(JSON.parse(await file.text()));
    if (!list.length) { toast('В файле не нашлось цитат. Формат: [{ "text": "…", "author": "…", "source": "…" }]', 'error'); return 0; }
    const q = ensureQuotes(); let added = 0;
    list.forEach(x => { if (!q.custom.some(c => c.id === x.id)) { q.custom.push(x); added++; } });
    q.cats.custom = true; persist(); renderQuoteSettings();
    toast(added ? `Добавлено цитат: ${added}` : 'Все цитаты из файла уже есть'); return added;
  } catch (_) { toast('Не удалось прочитать JSON с цитатами', 'error'); return 0; }
}

export function renderQuoteSettings() {
  const box = $('#quoteCats'); if (!box) return; const q = ensureQuotes();
  const cats = { ...QUOTE_CATS, ...(q.custom.length ? { custom: 'Мои' } : {}) };
  box.innerHTML = Object.entries(cats).map(([k, n]) => `<button type="button" class="chip-toggle" data-qcat="${k}" aria-pressed="${q.cats[k] !== false}">${esc(n)}</button>`).join('');
  const deep = $('#quoteDeep'); if (deep) deep.setAttribute('aria-pressed', String(q.showDeep));
  const info = $('#quoteInfo'); if (info) info.textContent = `${quotePool(q).length} в ротации · скрыто ${q.hidden.length}${q.custom.length ? ' · своих ' + q.custom.length : ''}`;
  const un = $('#quoteUnhide'); if (un) un.hidden = !q.hidden.length;
}

export function bindQuotes() {
  ensureQuotes();
  $('#quoteNext')?.addEventListener('click', () => showNextQuote(true));
  $('#quoteHide')?.addEventListener('click', hideCurrentQuote);
  $('#quoteCats')?.addEventListener('click', e => { const b = e.target.closest('[data-qcat]'); if (!b) return; const q = ensureQuotes(); q.cats[b.dataset.qcat] = q.cats[b.dataset.qcat] === false; persist(); renderQuoteSettings(); if (current && !quotePool(q).some(x => x.id === current.id)) showNextQuote(true); });
  $('#quoteDeep')?.addEventListener('click', () => { const q = ensureQuotes(); q.showDeep = !q.showDeep; persist(); renderQuoteSettings(); if (!q.showDeep && current?.tone === 'deep') showNextQuote(true); });
  $('#quoteUnhide')?.addEventListener('click', () => { const q = ensureQuotes(); q.hidden = []; persist(); renderQuoteSettings(); toast('Скрытые цитаты снова в ротации'); });
  $('#quoteImport')?.addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await importQuotesFromJSON(f); e.target.value = ''; });
  // смена по таймеру и при возвращении после отсутствия
  setInterval(() => { if (!document.hidden && Date.now() - (ensureQuotes().changedAt || 0) >= ROTATE_MS) showNextQuote(true); }, 20e3);
  const away = () => { if (!hiddenAt) hiddenAt = Date.now(); };
  const back = () => { if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) showNextQuote(true); hiddenAt = 0; };
  document.addEventListener('visibilitychange', () => document.hidden ? away() : back());
  window.addEventListener('blur', away); window.addEventListener('focus', back);
  renderQuote();
}
export const _test = { setAway: (t) => { hiddenAt = t; }, current: () => current };
