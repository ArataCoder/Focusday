// Защита от «asset not found: index.html» в нативной сборке.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const configPath = resolve('src-tauri/tauri.conf.json');
test('Tauri: главное окно и локальные ресурсы существуют во frontendDist', async () => {
  const cfg = JSON.parse(await readFile(configPath, 'utf8'));
  const root = resolve(dirname(configPath), cfg.build.frontendDist);
  const main = cfg.app.windows.find(w => w.label === 'main');
  assert.equal(main?.url, 'focusday.html', 'не полагаться на index.html по умолчанию');
  const html = await readFile(resolve(root, main.url), 'utf8');
  for (const file of ['focusday.css', 'cat.css', 'focusday-desktop-bridge.js', 'focusday.js']) {
    assert.ok(html.includes(`"${file}"`), `главная страница ссылается на ${file}`);
    await access(resolve(root, file));
  }
  for (const file of ['overlay.html', 'quick.html', 'buddy.html', 'buddy.js']) await access(resolve(root, file));
});
