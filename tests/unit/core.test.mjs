// Юнит-тесты Focusday: node --test tests/unit
import './_env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { classifyQuick } = await import('../../src/js/life/quick.js');
const { fuzzyScore } = await import('../../src/js/features/palette.js');
const { normalizeQuotes, pickQuote, quotePool, ensureQuotes } = await import('../../src/js/features/quotes.js');
const { QUOTE_LIBRARY } = await import('../../src/js/features/quotes-data.js');
const { softCandidates, softTarget } = await import('../../src/js/features/softplan.js');
const { data } = await import('../../src/js/state.js');

test('Q-строка: задача, привычка, расход, хотелка, мысль', () => {
  assert.equal(classifyQuick('!идея для поста').kind, 'thought');
  assert.deepEqual(classifyQuick('@вода мин'), { kind: 'habit', name: 'вода', min: true });
  const e = classifyQuick('-$5 кофе #еда'); assert.equal(e.kind, 'expense'); assert.equal(e.amount, 5); assert.equal(e.tag, 'еда');
  assert.equal(classifyQuick('?$80 наушники').kind, 'wish');
  assert.equal(classifyQuick('+1200 зарплата').kind, 'income');
  assert.equal(classifyQuick('Позвонить маме').kind, 'task');
  assert.equal(classifyQuick('   '), null);
});

test('Палитра: нечёткий поиск ранжирует точное совпадение выше', () => {
  assert.ok(fuzzyScore('Начать фокус', 'фокус') > fuzzyScore('Фон: Кафе', 'фокус'));
  assert.ok(fuzzyScore('Экспорт бэкапа', 'эксп') > 0);
  assert.equal(fuzzyScore('Привычки', 'zzz'), 0);
  assert.ok(fuzzyScore('Начать фокус', 'нф') > 0, 'буквы по порядку тоже находятся');
});

test('Цитаты: у всех есть автор, id уникальны, «по мотивам» помечены', () => {
  const ids = new Set();
  for (const q of QUOTE_LIBRARY) {
    assert.ok(q.text && q.author, `пустая цитата ${q.id}`);
    assert.ok(!ids.has(q.id), `дубль id ${q.id}`); ids.add(q.id);
    assert.ok(['gentle', 'drive', 'deep'].includes(q.tone));
  }
  const thorfinn = QUOTE_LIBRARY.filter(q => /Торфинн|Торс/.test(q.author));
  assert.ok(thorfinn.every(q => /Vinland Saga/.test(q.source)), 'Vinland Saga указан как источник');
});

test('Цитаты: импорт JSON — чистка, дедупликация, лимиты', () => {
  const out = normalizeQuotes([' «Привет»  ', 'привет', { text: 'Делай', author: 'Я', tone: 'drive' }, { text: 'x' }, 42]);
  assert.equal(out.length, 2); assert.equal(out[0].text, 'Привет'); assert.equal(out[1].tone, 'drive');
  assert.deepEqual(normalizeQuotes({ quotes: ['abc'] }).map(x => x.text), ['abc']);
});

test('Цитаты: грустные скрыты по умолчанию, без повторов подряд, «не показывать» работает', () => {
  const q = ensureQuotes({});
  assert.ok(quotePool(q).every(x => x.tone !== 'deep'));
  let prev = null;
  for (let i = 0; i < 200; i++) { const p = pickQuote(q); assert.notEqual(p.id, prev); prev = p.id; }
  const last8 = q.recent.slice(-8); assert.equal(new Set(last8).size, last8.length, 'последние 8 — без повторов');
  q.hidden.push(prev); assert.ok(!quotePool(q).some(x => x.id === prev));
});

test('Мягкий перенос: днём — хвосты на сегодня, вечером — всё на завтра, рутины не трогаем', () => {
  const day = new Date(2026, 10, 6, 12, 0), eve = new Date(2026, 10, 6, 20, 0);
  data.tasks = [
    { id: 'old', status: 'todo', date: '2026-11-04', recurrence: 'none' },
    { id: 'today', status: 'todo', date: '2026-11-06' },
    { id: 'done', status: 'done', date: '2026-11-04' },
    { id: 'routine', status: 'todo', date: '2026-11-05', recurrence: 'daily' },
    { id: 'future', status: 'todo', date: '2026-11-09' }
  ];
  assert.deepEqual(softCandidates(day).map(t => t.id), ['old']);
  assert.equal(softTarget(day), '2026-11-06');
  assert.deepEqual(softCandidates(eve).map(t => t.id), ['old', 'today']);
  assert.equal(softTarget(eve), '2026-11-07');
});
