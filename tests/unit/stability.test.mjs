import './_env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptText, decryptText, mergeData } from '../../src/js/backup.js';
import { Cloud, SyncEngine, saveSyncCfg, syncCfg } from '../../src/js/sync.js';
import { forgetKey } from '../../src/js/features/vault.js';

const configured = () => saveSyncCfg({ cloud: { enabled: true, url: 'https://demo.supabase.co', anon: 'test', session: { uid: 'test', access: 'x', exp: Date.now()+3600000 } }, folder: {}, seen: {} });

test('Зашифрованный бэкап: большой файл можно зашифровать и восстановить', async () => {
  const text = JSON.stringify({tasks:[{title:'🐈'.repeat(70000)}]});
  const env = JSON.parse(await encryptText(text, 'test-password'));
  assert.equal(await decryptText(env, 'test-password'), text);
});

test('Синхронизация: повреждённый удалённый файл не перезаписывается', async () => {
  configured(); await forgetKey(); SyncEngine.setPassphrase('long-test-password');
  const originalRead = Cloud.read, originalWrite = Cloud.write;
  let writes = 0; Cloud.read = async () => ({blob: 'not-a-vault', rev: 1}); Cloud.write = async () => { writes++; return 2; };
  try {
    const result = await SyncEngine.syncNow('manual');
    assert.match(result.error, /повреждён|неизвестный формат/);
    assert.equal(writes, 0); assert.match(syncCfg().lastStatus, /не удалась/);
  } finally { Cloud.read = originalRead; Cloud.write = originalWrite; await forgetKey(); }
});

test('Синхронизация: три конфликта не выдаются за успех', async () => {
  configured(); await forgetKey(); SyncEngine.setPassphrase('long-test-password');
  const originalRead = Cloud.read, originalWrite = Cloud.write;
  let attempts = 0; Cloud.read = async () => null; Cloud.write = async () => { attempts++; return false; };
  try {
    const result = await SyncEngine.syncNow('manual');
    assert.equal(attempts, 3); assert.match(result.error, /Конфликт синхронизации/);
    assert.match(syncCfg().lastStatus, /не удалась/); assert.equal(syncCfg().lastSyncAt, undefined);
  } finally { Cloud.read = originalRead; Cloud.write = originalWrite; await forgetKey(); }
});

test('Слияние привычек сохраняет отметки, не изменяя исходные данные', () => {
  const habit={id:'h',updatedAt:200,log:{'2026-01-01':1}};
  const local={tasks:[],lists:[],habits:[habit]}, remote={tasks:[],lists:[],habits:[{id:'h',updatedAt:100,log:{'2026-01-02':1}}]};
  const {merged,stats}=mergeData(local,remote);
  assert.deepEqual(merged.habits[0].log,{'2026-01-01':1,'2026-01-02':1});
  assert.deepEqual(habit.log,{'2026-01-01':1}); assert.equal(stats.lifeUpdated,1);
});

test('Синхронизация: изменение во время отправки не теряется', async () => {
  const { data, set_data } = await import('../../src/js/state.js');
  const { loadKey, openVault } = await import('../../src/js/features/vault.js');
  configured(); await forgetKey(); SyncEngine.setPassphrase('long-test-password');
  const originalRead = Cloud.read, originalWrite = Cloud.write; let row = null, calls = 0;
  let entered, release; const waiting = new Promise(r=>entered=r), held = new Promise(r=>release=r);
  Cloud.read = async () => row;
  Cloud.write = async (_c, blob) => { calls++; if (calls === 1) { entered(); await held; } row = {blob, rev: calls}; return calls; };
  try {
    const first = SyncEngine.syncNow('manual'); await waiting;
    set_data({...data, tasks:[...data.tasks, {id:'during-send',title:'Создана во время отправки',date:'2026-01-01',status:'todo',listId:'inbox',updatedAt:Date.now(),createdAt:Date.now()}]});
    SyncEngine.mark(); release(); assert.equal((await first).error, undefined);
    assert.equal((await SyncEngine.syncNow('timer')).error, undefined);
    assert.equal(calls, 2, 'изменение должно быть отправлено при следующем цикле');
    const payload = await openVault(row.blob,(await loadKey()).key);
    assert.ok(payload.data.tasks.some(t=>t.id==='during-send'));
  } finally { release?.(); Cloud.read=originalRead; Cloud.write=originalWrite; SyncEngine.disconnect(); }
});
