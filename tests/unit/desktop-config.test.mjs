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

test('Tauri: окно котика создаётся асинхронной командой на Windows', async () => {
  const rust = await readFile('src-tauri/src/lib.rs', 'utf8');
  assert.match(rust, /#\[tauri::command\]\s*async\s+fn\s+buddy\s*\(/);
  assert.match(rust, /WebviewWindowBuilder::new\(&app,\s*"buddy"/);
  const cfg = JSON.parse(await readFile(configPath, 'utf8'));
  const cap = JSON.parse(await readFile('src-tauri/capabilities/default.json', 'utf8'));
  assert.ok(cap.windows.includes('buddy'), 'у отдельного окна должны быть права Tauri');
  assert.equal(cfg.app.withGlobalTauri, true);
  const root = resolve(dirname(configPath), cfg.build.frontendDist);
  for (const file of ['buddy.html', 'buddy.js', 'cat.css', 'js/features/cat-ui.js']) await access(resolve(root, file));
});

test('Версия патча едина в настройках, сборке и PWA', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const cfg = JSON.parse(await readFile(configPath, 'utf8'));
  const cargo = await readFile('src-tauri/Cargo.toml', 'utf8');
  const sw = await readFile('src/sw.js', 'utf8');
  const html = await readFile('src/focusday.html', 'utf8');
  assert.equal(pkg.version, '1.3.5'); assert.equal(cfg.version, pkg.version);
  assert.ok(cargo.includes(`version = "${pkg.version}"`));
  assert.ok(sw.includes(`focusday-${pkg.version}`));
  assert.ok(html.includes(`Focusday ${pkg.version} ·`));
});
