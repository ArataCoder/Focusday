import './_env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { deriveVaultKey, sealVault, openVault, vaultHeader, randomSalt } = await import('../../src/js/features/vault.js');
const { mergeData } = await import('../../src/js/backup.js');
const { Cloud, saveSyncCfg, syncCfg } = await import('../../src/js/sync.js');

const ITER = 2000; // быстрый KDF для тестов (в приложении — 600 000)

test('Сейф: шифрует, расшифровывает, не раскрывает текст', async () => {
  const salt = randomSalt(), key = await deriveVaultKey('очень-длинный-пароль', salt, ITER);
  const blob = await sealVault({ tasks: [{ title: 'Секретная задача' }] }, key, salt, { device: 'pc' });
  assert.ok(!blob.includes('Секретная'), 'в шифротексте нет открытого текста');
  assert.equal(vaultHeader(blob).kdf.alg, 'PBKDF2-SHA256');
  assert.equal((await openVault(blob, key)).tasks[0].title, 'Секретная задача');
});

test('Сейф: чужой пароль и подмена шифротекста — отказ', async () => {
  const salt = randomSalt();
  const key = await deriveVaultKey('правильный-пароль-1', salt, ITER), bad = await deriveVaultKey('неправильный-пароль', salt, ITER);
  const blob = await sealVault({ a: 1 }, key, salt);
  await assert.rejects(openVault(blob, bad));
  const o = JSON.parse(blob); const ct = Buffer.from(o.ct, 'base64'); ct[3] ^= 1; o.ct = ct.toString('base64');
  await assert.rejects(openVault(JSON.stringify(o), key), 'AES-GCM ловит подмену');
  await assert.rejects(deriveVaultKey('short', salt, ITER), /weak-pass/);
});

test('Слияние: новые задачи с телефона + свежая правка побеждает + цитаты объединяются', () => {
  const base = { tasks: [], lists: [{ id: 'inbox', name: 'Входящие' }], deleted: {} };
  const pc = { ...base, tasks: [{ id: 't1', title: 'ПК', date: '2026-11-06', status: 'todo', updatedAt: 100, createdAt: 1 }], quotes: { hidden: ['q1'], custom: [] } };
  const phone = { ...base, tasks: [{ id: 't1', title: 'ПК (правка с телефона)', date: '2026-11-06', status: 'todo', updatedAt: 200, createdAt: 1 }, { id: 't2', title: 'С телефона', date: '2026-11-06', status: 'todo', updatedAt: 150, createdAt: 2 }], quotes: { hidden: ['q2'], custom: [{ id: 'u1', text: 'моя' }] } };
  const { merged, stats } = mergeData(pc, phone);
  assert.equal(merged.tasks.length, 2); assert.equal(stats.added, 1);
  assert.equal(merged.tasks.find(t => t.id === 't1').title, 'ПК (правка с телефона)');
  assert.deepEqual([...merged.quotes.hidden].sort(), ['q1', 'q2']);
  assert.equal(merged.quotes.custom.length, 1);
});

for (const updatedAt of [100, 200]) {
  test(`Backup preview does not mutate habit logs (incoming timestamp ${updatedAt})`, () => {
    const base = { tasks: [], lists: [], deleted: {} };
    const local = { ...base, habits: [{ id: 'h1', name: 'Local habit', updatedAt: 200, log: { '2026-11-08': 2 } }] };
    const incoming = { ...base, habits: [{ id: 'h1', name: 'Backup habit', updatedAt, log: { '2026-11-08': 1, '2026-11-09': 2 } }] };
    const localBefore = structuredClone(local), incomingBefore = structuredClone(incoming);

    const { merged } = mergeData(local, incoming);

    assert.deepEqual(local, localBefore, 'preview must not change live data before confirmation');
    assert.deepEqual(incoming, incomingBefore, 'backup data must remain unchanged');
    assert.equal(merged.habits[0].name, 'Local habit');
    assert.deepEqual(merged.habits[0].log, { '2026-11-08': 2, '2026-11-09': 2 });
    assert.notStrictEqual(merged.habits[0].log, local.habits[0].log);
  });
}

test('Supabase-коннектор: вход, чтение, запись с оптимистичной блокировкой (mock)', async () => {
  const calls = []; let row = null;
  Cloud.fetch = async (url, opt = {}) => {
    calls.push([opt.method || 'GET', url.replace('https://demo.supabase.co', '')]);
    const res = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (url.includes('/auth/v1/token?grant_type=password')) return res(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'U1', email: 'a@b.c' } });
    if (opt.method === 'POST' && url.endsWith('/rest/v1/vaults')) { row = { ...JSON.parse(opt.body) }; return res(201, [row]); }
    if (opt.method === 'PATCH') { const rev = +url.match(/rev=eq\.(\d+)/)[1]; if (rev !== row.rev) return res(200, []); Object.assign(row, JSON.parse(opt.body)); return res(200, [row]); }
    if (url.includes('/rest/v1/vaults?select')) return res(200, row ? [row] : []);
    return res(404, {});
  };
  saveSyncCfg({ cloud: { url: 'https://demo.supabase.co', anon: 'ANON' } });
  assert.deepEqual(await Cloud.auth('login', 'a@b.c', 'pw'), { ok: true });
  const c = syncCfg(); assert.equal(c.cloud.session.uid, 'U1');
  assert.equal(await Cloud.read(c), null);
  assert.equal(await Cloud.write(c, 'CIPHERTEXT-1', null), 1);
  assert.deepEqual(await Cloud.read(c), { blob: 'CIPHERTEXT-1', rev: 1 });
  assert.equal(await Cloud.write(c, 'CIPHERTEXT-2', 1), 2);
  assert.equal(await Cloud.write(c, 'STALE', 1), false, 'устаревшая ревизия → конфликт, без перезаписи');
  assert.equal(row.blob, 'CIPHERTEXT-2');
  assert.ok(calls.every(([, u]) => !u.includes('pw')), 'пароль аккаунта не уходит в URL');
});
