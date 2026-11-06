/* Focusday · встроенная база цитат (1000+). Тексты — в паках ./quotes/*.js (компактный формат, см. gentle.js).
   tone: 'gentle' — поддержка, 'drive' — дисциплина/действие, 'deep' — грустные/мрачные (по умолчанию скрыты).
   Атрибуции: «Автор · Источник»; пересказ мысли — «по мотивам», спорное авторство — «приписывается».
   Переводы смысловые, не дословные. id стабилен: хэш автора и текста (скрытые и избранные переживают обновления). */
import gentle from './quotes/gentle.js';
import action from './quotes/action.js';
import dc from './quotes/dc.js';
import anime from './quotes/anime.js';
import samurai from './quotes/samurai.js';
import classic from './quotes/classic.js';

export const QUOTE_CATS = {
  gentle: 'Поддержка', action: 'Дисциплина и дело', dc: 'Бэтмен и DC', anime: 'Аниме', samurai: 'Самураи', classic: 'Классика'
};
const TONE = { g: 'gentle', d: 'drive', x: 'deep' };

export function quoteId(cat, author, text) {
  let h = 2166136261; for (const ch of `${author}\u0001${text}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return cat[0] + (h >>> 0).toString(36);
}

/** «@Автор|Источник» — заголовок группы; «g|d|x текст» — цитата. Пустые строки и «#…» пропускаются. */
export function parsePack(cat, src) {
  let author = 'Focusday', source = 'Напоминание себе'; const out = [];
  for (const raw of String(src).split('\n')) {
    const l = raw.trim(); if (!l || l.startsWith('#')) continue;
    if (l[0] === '@') { const [a, s = ''] = l.slice(1).split('|'); author = a.trim(); source = s.trim(); continue; }
    const tone = TONE[l[0]]; if (!tone || l[1] !== ' ') continue;
    const text = l.slice(2).trim(); if (!text) continue;
    out.push({ id: quoteId(cat, author, text), cat, tone, text, author, source });
  }
  return out;
}

export const QUOTE_LIBRARY = [
  ...parsePack('gentle', gentle), ...parsePack('action', action), ...parsePack('dc', dc),
  ...parsePack('anime', anime), ...parsePack('samurai', samurai), ...parsePack('classic', classic)
];
