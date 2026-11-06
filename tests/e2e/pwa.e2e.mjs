// Проверяем установку и автономный запуск на хостинге, где / возвращает 404.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('src');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webmanifest':'application/manifest+json', '.png':'image/png'};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path === '/') { res.writeHead(404); res.end('No index'); return; }
  const file = resolve(root, '.' + path);
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { const data=await readFile(file); res.writeHead(200, {'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); res.end(data); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
const url = `http://127.0.0.1:${server.address().port}/focusday.html`;
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox']});
try {
  const ctx = await browser.newContext(), page = await ctx.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => { window.__FD_TEST_IDLE__ = 0; });
  await page.goto(url); await page.waitForFunction(() => window.__FD_TEST__);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller && window.__FD_TEST__);
  assert.equal(await page.evaluate(async () => (await fetch('/')).status),404);
  const cached = await page.evaluate(async version => { const c = await caches.open('focusday-' + version); return Promise.all(['focusday.html','focusday.css','focusday.js','manifest.webmanifest','icons/maskable-512.png'].map(async x=>!!(await c.match(x)))); }, version);
  assert.deepEqual(cached, [true,true,true,true,true]);
  await ctx.setOffline(true); await page.reload(); await page.waitForFunction(() => window.__FD_TEST__);
  assert.equal(await page.title(), 'Focusday — дневник задач');
  assert.ok(await page.evaluate(() => [...document.styleSheets].some(s=>s.href?.endsWith('focusday.css') && s.cssRules.length > 100)));
  assert.deepEqual(errors, []);
  console.log('✔ PWA: установка при 404 в корне и перезапуск без сети');
  await ctx.close();
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
