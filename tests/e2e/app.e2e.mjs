// E2E-тесты Focusday (Playwright + Chromium). Запуск: npm run test:e2e
// CHROMIUM_PATH=/path/to/chrome — если браузер Playwright не установлен (npx playwright install chromium).
import { chromium } from 'playwright';
import { buildSync } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const APP = pathToFileURL(fileURLToPath(new URL('../../src/focusday.html', import.meta.url))).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const task = (id, title, date) => ({ id, title, date, status: 'todo', priority: 2, duration: 15, listId: 'inbox', createdAt: Date.now(), updatedAt: Date.now(), steps: [] });
const seed = (tasks) => ({ version: 2, view: 'today', theme: 'dark', tasks, lists: [{ id: 'inbox', name: 'Входящие', color: '#a78bfa' }], soundEnabled: false });

let failed = 0;
async function step(name, fn) {
  try { await fn(); console.log('✔', name); } catch (e) { failed++; console.log('✖', name, '\n   ', e.message.split('\n').slice(0, 4).join('\n    ')); }
}
async function open(ctx, d) {
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript((d) => { window.__FD_TEST_IDLE__ = 0; if (!sessionStorage.getItem('seeded')) { localStorage.setItem('focusday.data.v1', JSON.stringify(d)); sessionStorage.setItem('seeded', '1'); } }, d);
  await p.goto(APP); await p.waitForFunction(() => window.__FD_TEST__);
  p.errors = errors; p.D = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__FD_TEST__.data)));
  return p;
}

await step('Палитра Ctrl+K: поиск задачи и команда', async () => {
  const p = await open(await browser.newContext(), seed([task('a', 'Отправить отклик KYC', iso(0))]));
  await p.keyboard.press('Control+k'); await p.fill('#paletteInput', 'отклик');
  assert.match(await p.textContent('#paletteList'), /Отправить отклик KYC/);
  await p.fill('#paletteInput', 'Добавить: купить хлеб'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  assert.ok((await p.D()).tasks.some((t) => /купить хлеб/i.test(t.title)), 'задача создана из палитры');
  assert.deepEqual(p.errors, []);
});

await step('Мягкий перенос: хвосты прошлых дней → сегодня, с отменой', async () => {
  const p = await open(await browser.newContext(), seed([task('o', 'Хвост', iso(-2)), task('n', 'Сегодня', iso(0))]));
  assert.equal(await p.isHidden('#softPlan'), false);
  await p.click('#softPlanBtn'); await p.waitForTimeout(150);
  const want = new Date().getHours() >= 18 ? iso(1) : iso(0);
  assert.equal((await p.D()).tasks.find((t) => t.id === 'o').date, want);
  assert.ok((await p.D()).stats.softMoves >= 1);
});

await step('Котик: простой → «Ты всё ещё в потоке?» → «Взял паузу ☕» = перерыв 5 мин', async () => {
  const p = await open(await browser.newContext(), seed([task('a', 'Фокус-задача', iso(0))]));
  await p.click('#focusStartBtn');
  await p.evaluate(async () => { const T = window.__FD_TEST__; await T.buddyTick(Date.now()); window.__FD_TEST_IDLE__ = 3600; await T.buddyTick(Date.now() + 16 * 60e3); });
  assert.match(await p.textContent('#catBuddy'), /Ты всё ещё в потоке или сделаем паузу\? 🐾/);
  await p.click('#catBuddy [data-cat="pause"]');
  const d = await p.D();
  assert.equal(d.focusRunning, false, 'фокус на паузе');
  assert.ok(d.buddy.breakUntil - Date.now() > 4 * 60e3, 'перерыв ~5 минут');
  assert.match(await p.textContent('#catBuddy'), /Перерыв/);
  await p.click('#catBuddy [data-cat="resume"]');
  assert.equal((await p.D()).focusRunning, true, '«Вернуться раньше» снова запускает фокус');
});

await step('Котик не будит, если человек активен', async () => {
  const p = await open(await browser.newContext(), seed([task('a', 'Задача', iso(0))]));
  await p.click('#focusStartBtn');
  await p.evaluate(async () => { const T = window.__FD_TEST__; await T.buddyTick(Date.now()); window.__FD_TEST_IDLE__ = 30; await T.buddyTick(Date.now() + 40 * 60e3); });
  assert.doesNotMatch(await p.textContent('#catBuddy'), /в потоке/);
});

await step('Цитаты: «Больше не показывать эту» прячет навсегда', async () => {
  const p = await open(await browser.newContext(), seed([]));
  const before = await p.textContent('#dailyQuote');
  await p.click('#quoteHide'); await p.waitForTimeout(500);
  const d = await p.D();
  assert.equal(d.quotes.hidden.length, 1);
  assert.notEqual(await p.textContent('#dailyQuote'), before);
});

await step('Настройки: 5 вкладок, тема «как в системе», спокойный режим', async () => {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const p = await open(ctx, seed([]));
  await p.click('#settingsBtn');
  assert.equal(await p.locator('.set-tab').count(), 5);
  for (const t of ['buddy', 'quotes', 'sync', 'data', 'look']) {
    await p.click(`[data-set-tab="${t}"]`);
    assert.equal(await p.isVisible(`#setPane-${t}`), true, `вкладка ${t}`);
    assert.equal(await p.locator('.set-pane:not([hidden])').count(), 1);
  }
  await p.keyboard.press('Escape'); await p.click('#settingsBtn'); await p.focus('#setTab-look'); await p.keyboard.press('ArrowDown');
  assert.equal(await p.getAttribute('#setTab-buddy', 'aria-selected'), 'true', 'стрелки переключают вкладки');
  await p.click('[data-set-tab="look"]'); await p.click('[data-theme-set="auto"]');
  assert.equal((await p.D()).theme, 'auto');
  assert.equal(await p.evaluate(() => document.body.classList.contains('light-theme')), true, 'системная светлая тема применена');
  await p.click('#calmMotion'); assert.equal(await p.evaluate(() => document.body.classList.contains('calm-motion')), true);
  const snd = await p.textContent('#soundSettingsBtn'); await p.click('#soundSettingsBtn');
  assert.equal(await p.textContent('#soundSettingsBtn'), snd, 'переключатель звука не теряет подпись');
  await p.selectOption('#setAmbId', 'ocean'); assert.equal((await p.D()).ambient.id, 'ocean');
  assert.deepEqual(p.errors, []);
});

await step('Цитаты: ❤ в избранное, категории показывают счётчики', async () => {
  const p = await open(await browser.newContext(), seed([]));
  await p.click('#quoteFav'); await p.waitForTimeout(100);
  assert.equal((await p.D()).quotes.fav.length, 1);
  assert.equal(await p.evaluate(() => document.querySelector('#quoteFav').classList.contains('on')), true);
  await p.click('#settingsBtn'); await p.click('[data-set-tab="quotes"]');
  assert.match(await p.textContent('#quoteInfo'), /из 1\s?\d{3}/);
  assert.ok(await p.locator('#quoteCats small').count() >= 6);
});

await step('Котик: пауза возвращает время простоя в таймер', async () => {
  const p = await open(await browser.newContext(), seed([task('a', 'Задача', iso(0))]));
  await p.click('#focusStartBtn');
  const left = await p.evaluate(async () => { const T = window.__FD_TEST__; await T.buddyTick(Date.now()); window.__FD_TEST_IDLE__ = 16 * 60; await T.buddyTick(Date.now() + 16 * 60e3); return T.data.focusRemainingMs; });
  assert.match(await p.textContent('#catBuddy'), /в потоке/);
  await p.evaluate(() => window.__FD_TEST__.buddyAction('pause'));
  const d = await p.D();
  assert.equal(d.focusRunning, false);
  assert.ok(d.focusRemainingMs >= Math.min(d.focusMinutes * 60000, left + 15 * 60e3) - 2000, `вернули время: ${d.focusRemainingMs}`);
});

await step('Звуки: каждый фон реально звучит и не клиппует (офлайн-рендер)', async () => {
  const code = buildSync({ entryPoints: [fileURLToPath(new URL('../../src/js/features/ambient-engine.js', import.meta.url))], bundle: true, format: 'iife', globalName: 'AE', write: false }).outputFiles[0].text;
  const p = await (await browser.newContext()).newPage(); await p.setContent('<html></html>'); await p.addScriptTag({ content: code });
  const r = await p.evaluate(async () => { const out = {}; for (const s of AE.SOUNDS) { const ctx = new OfflineAudioContext(1, 44100 * 4, 44100); AE.buildSound(ctx, s.id, ctx.destination); const d = (await ctx.startRendering()).getChannelData(0); let sum = 0, peak = 0; for (let i = 44100; i < d.length; i++) { sum += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); } out[s.id] = { db: 20 * Math.log10(Math.sqrt(sum / (d.length - 44100))), peak }; } return out; });
  for (const [id, v] of Object.entries(r)) { assert.ok(v.db > -40 && v.db < -14, `${id}: ${v.db.toFixed(1)} dB`); assert.ok(v.peak < 1, `${id} clipping`); }
});

await step('Синхронизация ПК ⇄ телефон через Supabase (mock): E2E-шифр, обе стороны получают данные', async () => {
  let row = null; const seen = [];
  const fake = async (route) => {
    const req = route.request(), url = req.url(), m = req.method();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    const send = (status, body) => route.fulfill({ status, headers: cors, body: JSON.stringify(body) });
    if (m === 'OPTIONS') return send(204, {});
    if (req.postData()) seen.push(req.postData());
    if (url.includes('/auth/v1/token')) return send(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'U1', email: 'me@x.y' } });
    if (url.includes('/rest/v1/vaults?select')) return send(200, row ? [row] : []);
    if (m === 'POST') { row = { ...JSON.parse(req.postData()), updated_at: '' }; return send(201, [row]); }
    if (m === 'PATCH') { const rev = +url.match(/rev=eq\.(\d+)/)[1]; if (!row || rev !== row.rev) return send(200, []); Object.assign(row, JSON.parse(req.postData())); return send(200, [row]); }
    return send(404, {});
  };
  const login = async (p) => {
    await p.evaluate(() => document.querySelector('#settingsBtn').click());
    await p.click('[data-set-tab="sync"]');
    await p.fill('#vaultPass', 'общий-пароль-синхры-42'); await p.fill('#cloudUrl', 'https://demo.supabase.co');
    await p.fill('#cloudAnon', 'anon'); await p.fill('#cloudEmail', 'me@x.y'); await p.fill('#cloudPassword', 'account-pass');
    await p.click('#cloudLoginBtn'); await p.waitForFunction(() => /E2E/.test(document.querySelector('#syncStatus')?.textContent || ''), null, { timeout: 20000 });
  };
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  await ctxA.route('https://demo.supabase.co/**', fake); await ctxB.route('https://demo.supabase.co/**', fake);
  const pc = await open(ctxA, seed([task('pc1', 'Задача с ПК', iso(0))]));
  const phone = await open(ctxB, seed([task('ph1', 'Мысль с телефона', iso(0))]));
  await login(pc); await login(phone);
  await pc.click('#syncNowBtn'); await pc.waitForTimeout(1500);
  const titles = async (p) => (await p.D()).tasks.map((t) => t.title).sort();
  assert.deepEqual(await titles(phone), ['Задача с ПК', 'Мысль с телефона']);
  assert.deepEqual(await titles(pc), ['Задача с ПК', 'Мысль с телефона']);
  assert.ok(row && !/Задача с ПК|Мысль с телефона/.test(row.blob), 'на сервере только шифротекст');
  assert.ok(!seen.some((b) => b.includes('общий-пароль')), 'пароль синхронизации не уходит в сеть');
});

await step('Регрессия: палитра мышью и стрелками, ARIA, отсутствие исключений', async () => {
  const p = await open(await browser.newContext(), seed([]));
  await p.keyboard.press('Control+k'); await p.waitForTimeout(100);
  await p.locator('#pal-1').hover();
  assert.equal(await p.getAttribute('#paletteInput', 'aria-activedescendant'), 'pal-1');
  assert.equal(await p.getAttribute('#pal-1', 'aria-selected'), 'true');
  await p.focus('#paletteInput'); await p.keyboard.press('ArrowDown');
  assert.equal(await p.getAttribute('#paletteInput', 'aria-activedescendant'), 'pal-2');
  assert.equal(await p.getAttribute('#pal-2', 'aria-selected'), 'true');
  assert.deepEqual(p.errors, []);
});

await step('Регрессия: разметка и настройки, ARIA и CSS', async () => {
  const p = await open(await browser.newContext(), seed([]));
  assert.deepEqual(await p.evaluate(() => { const ids=[...document.querySelectorAll('[id]')].map(x=>x.id); return ids.filter((x,i)=>ids.indexOf(x)!==i); }), []);
  assert.ok(await p.evaluate(() => [...document.styleSheets].some(s => s.href?.endsWith('/focusday.css')) && getComputedStyle(document.querySelector('#timerDisplay')).fontSize !== '16px')); 
  await p.click('#settingsBtn'); await p.focus('#setTab-look');
  for (let i=0; i<9; i++) {
    await p.keyboard.press('ArrowDown');
    assert.equal(await p.locator('.set-tab[aria-selected="true"]').count(), 1);
    assert.equal(await p.locator('.set-pane:not([hidden])').count(), 1);
    assert.equal(await p.evaluate(() => {const t=document.querySelector('.set-tab[aria-selected="true"]');return document.activeElement===t && t.getAttribute('aria-controls')===document.querySelector('.set-pane:not([hidden])').id;}), true);
  }
  assert.deepEqual(p.errors, []);
});

await step('Регрессия: пауза таймера сохраняется после тика и перезагрузки', async () => {
  const p = await open(await browser.newContext(), seed([]));
  await p.click('#focusStartBtn'); await p.waitForTimeout(300); await p.click('#focusStartBtn');
  const stopped = await p.D(); assert.equal(stopped.focusRunning, false);
  await p.waitForTimeout(1100);
  const persisted = await p.evaluate(() => JSON.parse(localStorage.getItem('focusday.data.v1')));
  assert.equal(persisted.focusRunning, false); assert.equal(persisted.focusRemainingMs, stopped.focusRemainingMs);
  await p.reload(); await p.waitForFunction(() => window.__FD_TEST__); const after = await p.D();
  assert.equal(after.focusRunning, false); assert.equal(after.focusRemainingMs, stopped.focusRemainingMs);
  assert.deepEqual(p.errors, []);
});

await step('Регрессия: XP при переносе и сбросе без кэша уровня', async () => {
  const p = await open(await browser.newContext(), seed([task('o','Хвост',iso(-2))]));
  await p.click('#softPlanBtn'); await p.waitForTimeout(150);
  assert.ok((await p.D()).xp > 0);
  const pos = await p.locator('.xp-float').first().evaluate(el => ({ text:el.textContent, left:parseFloat(el.style.left), top:parseFloat(el.style.top) }));
  assert.match(pos.text, /\+\d+ XP/); assert.ok(Number.isFinite(pos.left) && Number.isFinite(pos.top) && pos.left > 0);
  await p.click('#settingsBtn'); await p.click('#setTab-data'); p.once('dialog', d => d.accept()); await p.click('#resetAllBtn');
  assert.equal((await p.D()).xp || 0, 0); assert.equal(await p.textContent('#levelNum'), '1');
  assert.equal(await p.evaluate(() => document.querySelector('#levelRing').style.getPropertyValue('--p')), '0');
  assert.deepEqual(p.errors, []);
});

await browser.close();
console.log(failed ? `\n${failed} тест(ов) упало` : '\nВсе E2E-тесты прошли');
process.exit(failed ? 1 : 0);
