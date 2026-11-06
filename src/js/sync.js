/* Focusday · sync.js — автономная E2E-синхронизация ПК ⇄ телефон ⇄ планшет.
   Провайдеры (можно оба сразу):
   • folder — файл focusday_data.json в облачной папке (Google Drive / OneDrive / iCloud Drive / Dropbox / Syncthing), EXE-версия;
   • cloud  — лёгкий коннектор Supabase (REST, без SDK): одна строка-«сейф» на пользователя, защищена RLS.
   В обоих случаях лежит только шифротекст (features/vault.js). Слияние — mergeData (по id + updatedAt + надгробия). */
import { deviceId, mergeData, rebaseline } from './backup.js';
import { $, storage } from './core.js';
import { renderProgress } from './progress.js';
import { renderAll, toast } from './render.js';
import { data, persistNow, set_data } from './state.js';
import { deriveVaultKey, forgetKey, loadKey, openVault, randomSalt, saveKey, sealVault, vaultHeader } from './features/vault.js';

export const SYNC_FILE = 'focusday_data.json';
const CFG_KEY = 'focusday.sync.v2';           // настройки устройства: НЕ экспортируются и не синхронизируются
const PULL_EVERY = 3 * 60e3, PUSH_DEBOUNCE = 20e3;

export function syncCfg() {
  let c; try { c = JSON.parse(storage.getItem(CFG_KEY) || '{}'); } catch (_) { c = {}; }
  c.folder = c.folder || {}; c.cloud = c.cloud || {}; c.seen = c.seen || {};
  return c;
}
export function saveSyncCfg(c) { storage.setItem(CFG_KEY, JSON.stringify(c)); }

/* ── Supabase (PostgREST + GoTrue по HTTPS, без SDK) ─────────────── */
export const Cloud = {
  fetch: (...a) => fetch(...a),
  base(c) { return String(c.cloud.url || '').replace(/\/+$/, ''); },
  hdr(c, token) { return { apikey: c.cloud.anon, Authorization: `Bearer ${token || c.cloud.anon}`, 'Content-Type': 'application/json' }; },
  async auth(kind, email, password) {
    const c = syncCfg(); const url = `${this.base(c)}/auth/v1/${kind === 'signup' ? 'signup' : 'token?grant_type=password'}`;
    const r = await this.fetch(url, { method: 'POST', headers: this.hdr(c), body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || `HTTP ${r.status}`);
    if (!j.access_token) return { needConfirm: true };
    c.cloud.session = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, uid: j.user?.id, email: j.user?.email || email };
    c.cloud.enabled = true; saveSyncCfg(c); return { ok: true };
  },
  async token(c) {
    const s = c.cloud.session; if (!s) throw new Error('no-session');
    if (Date.now() < s.exp - 60e3) return s.access;
    const r = await this.fetch(`${this.base(c)}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: this.hdr(c), body: JSON.stringify({ refresh_token: s.refresh }) });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.access_token) throw new Error('session-expired');
    Object.assign(s, { access: j.access_token, refresh: j.refresh_token || s.refresh, exp: Date.now() + (j.expires_in || 3600) * 1000 }); saveSyncCfg(c); return s.access;
  },
  async read(c) {
    const t = await this.token(c);
    const r = await this.fetch(`${this.base(c)}/rest/v1/vaults?select=blob,rev,updated_at&user_id=eq.${c.cloud.session.uid}`, { headers: this.hdr(c, t) });
    if (!r.ok) throw new Error(`read HTTP ${r.status}`);
    const rows = await r.json(); return rows[0] ? { blob: rows[0].blob, rev: Number(rows[0].rev) } : null;
  },
  /** Оптимистичная блокировка: пишем только если rev не изменился. false = конфликт (кто-то успел раньше). */
  async write(c, blob, rev) {
    const t = await this.token(c), h = { ...this.hdr(c, t), Prefer: 'return=representation' };
    const r = rev == null
      ? await this.fetch(`${this.base(c)}/rest/v1/vaults`, { method: 'POST', headers: h, body: JSON.stringify({ user_id: c.cloud.session.uid, blob, rev: 1 }) })
      : await this.fetch(`${this.base(c)}/rest/v1/vaults?user_id=eq.${c.cloud.session.uid}&rev=eq.${rev}`, { method: 'PATCH', headers: h, body: JSON.stringify({ blob, rev: rev + 1, updated_at: new Date().toISOString() }) });
    if (r.status === 409) return false;
    if (!r.ok) throw new Error(`write HTTP ${r.status}`);
    const rows = await r.json(); return Array.isArray(rows) && rows.length ? Number(rows[0].rev) : false;
  }
};

/* ── Провайдер «папка» (Tauri: sync_read / sync_write, атомарная запись) ── */
const Folder = {
  available: () => !!window.focusdayDesktop?.syncWrite,
  read: (c) => window.focusdayDesktop.syncRead(c.folder.dir, SYNC_FILE).then(s => s ? { blob: s } : null),
  write: (c, blob) => window.focusdayDesktop.syncWrite(c.folder.dir, SYNC_FILE, blob).then(() => true)
};

function cleanPayload() {
  const clean = { ...data, focusRunning: false, focusStartedAt: null }; delete clean.sync;
  return { app: 'Focusday', schema: 5, at: Date.now(), device: deviceId, data: clean };
}

let pendingPass = '', running = false, dirty = false, pushTimer = null;
export const SyncEngine = {
  enabled() { const c = syncCfg(); return !!((c.folder.enabled && c.folder.dir) || (c.cloud.enabled && c.cloud.session)); },
  setPassphrase(p) { pendingPass = String(p || ''); },
  async key(salt) {
    const k = await loadKey();
    if (k && (!salt || k.salt === salt)) return k;
    if (!pendingPass) return null;
    const rec = { salt: salt || randomSalt(), key: null }; rec.key = await deriveVaultKey(pendingPass, rec.salt);
    return { ...rec, fresh: true };
  },
  status(text, kind = '') { const el = $('#syncStatus'); if (el) { el.textContent = text; el.dataset.kind = kind; } const c = syncCfg(); c.lastStatus = text; saveSyncCfg(c); },
  mark() { dirty = true; if (!this.enabled()) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => this.syncNow('change').catch(console.error), PUSH_DEBOUNCE); },

  /** Полный цикл: pull → расшифровать → слить → push (если есть что отдать). */
  async syncNow(reason = 'auto') {
    if (running || !this.enabled()) return { skipped: true };
    running = true; const c = syncCfg(); const result = { merged: 0, pushed: [] };
    try {
      const providers = [];
      if (c.folder.enabled && c.folder.dir && Folder.available()) providers.push(['folder', Folder]);
      if (c.cloud.enabled && c.cloud.session) providers.push(['cloud', Cloud]);
      for (const [name, p] of providers) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const remote = await p.read(c);
          const head = remote ? vaultHeader(remote.blob) : null;
          const k = await this.key(head?.kdf?.salt);
          if (!k) { this.status('Нужен пароль синхронизации — введи его в настройках', 'warn'); return { needPass: true }; }
          let changed = false;
          if (head) {
            let payload;
            try { payload = await openVault(remote.blob, k.key); }
            catch (_) { if (k.fresh) { pendingPass = ''; this.status('Неверный пароль синхронизации', 'error'); toast('Неверный пароль синхронизации', 'error'); return { badPass: true }; } await forgetKey(); this.status('Ключ устарел — введи пароль ещё раз', 'warn'); return { needPass: true }; }
            if (k.fresh) { await saveKey({ salt: k.salt, key: k.key }); pendingPass = ''; }
            if (payload.device !== deviceId || (payload.at || 0) > (c.seen[name] || 0)) {
              const { merged, stats } = mergeData(data, payload.data);
              const n = stats.added + stats.updated + stats.removed + (stats.lifeAdded || 0) + (stats.lifeUpdated || 0);
              if (n) { set_data(merged); rebaseline(); persistNow(true); renderAll(); renderProgress(); result.merged += n; changed = true; }
            }
            c.seen[name] = payload.at || Date.now();
          } else if (k.fresh) { await saveKey({ salt: k.salt, key: k.key }); pendingPass = ''; }
          if (!head || dirty || changed || reason === 'manual') {
            const pl = cleanPayload(); const blob = await sealVault(pl, k.key, k.salt, { at: pl.at, device: deviceId });
            const ok = await p.write(c, blob, remote?.rev ?? null);
            if (ok === false) continue;                       // конфликт ревизий → перечитать и слить ещё раз
            c.seen[name] = pl.at; result.pushed.push(name);
          }
          break;
        }
      }
      dirty = false; c.lastSyncAt = Date.now(); saveSyncCfg(c);
      const where = providers.map(([n]) => n === 'folder' ? 'папка' : 'облако').join(' + ');
      this.status(`${where} · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${result.merged ? ` · получено изменений: ${result.merged}` : ''} · 🔒 E2E`, 'ok');
      if (result.merged && reason !== 'manual') toast(`Синхронизировано: ${result.merged} изменений с другого устройства`);
      return result;
    } catch (e) {
      this.status(`Синхронизация не удалась: ${e.message === 'session-expired' ? 'войди в облако заново' : e.message}`, 'error'); return { error: e.message };
    } finally { running = false; }
  },
  disconnect() { const c = syncCfg(); c.folder = {}; c.cloud = {}; c.seen = {}; saveSyncCfg(c); forgetKey(); this.status('Синхронизация выключена'); },
  start() {
    // миграция v1.1–1.2: data.sync {dir} → настройки устройства (нужно один раз ввести новый пароль)
    if (data.sync?.dir) { const c = syncCfg(); if (!c.folder.dir) { c.folder = { enabled: true, dir: data.sync.dir }; saveSyncCfg(c); } delete data.sync; }
    if (!this.enabled()) return;
    setTimeout(() => this.syncNow('start').catch(console.error), 1500);
    setInterval(() => { if (!document.hidden) this.syncNow('timer').catch(console.error); }, PULL_EVERY);
    window.addEventListener('focus', () => { if (Date.now() - (syncCfg().lastSyncAt || 0) > 60e3) this.syncNow('focus').catch(console.error); });
  }
};

/* Совместимость со старыми вызовами (state.persistNow → Sync.schedule, кнопка #syncSetupBtn). */
export const Sync = {
  available: () => true,
  setup: () => { $('#syncGroup')?.setAttribute('open', ''); $('#vaultPass')?.focus(); },
  pull: () => SyncEngine.syncNow('focus'),
  push: () => SyncEngine.syncNow('manual'),
  schedule: () => SyncEngine.mark(),
  status: () => { const c = syncCfg(); if (c.lastStatus) SyncEngine.status(c.lastStatus); }
};

export function bindSyncUI() {
  const c = syncCfg();
  if ($('#cloudUrl')) { $('#cloudUrl').value = c.cloud.url || ''; $('#cloudAnon').value = c.cloud.anon || ''; $('#cloudEmail').value = c.cloud.session?.email || ''; }
  const fb = $('#folderPickBtn'); if (fb) { fb.disabled = !Folder.available(); fb.title = Folder.available() ? '' : 'Папка доступна в EXE-версии. В браузере и на телефоне — облако.'; }
  const paint = () => { const c2 = syncCfg(); const f = $('#folderInfo'); if (f) f.textContent = c2.folder.dir ? c2.folder.dir : Folder.available() ? 'не выбрана' : 'только в EXE-версии'; const ci = $('#cloudInfo'); if (ci) ci.textContent = c2.cloud.session ? `вошли как ${c2.cloud.session.email}` : 'не подключено'; if (c2.lastStatus) SyncEngine.status(c2.lastStatus); };
  const takePass = () => { const p = $('#vaultPass')?.value || ''; if (p) { if (p.length < 10) { toast('Пароль синхронизации — минимум 10 символов', 'error'); return false; } SyncEngine.setPassphrase(p); $('#vaultPass').value = ''; } return true; };
  $('#folderPickBtn')?.addEventListener('click', async () => {
    if (!takePass()) return; const dir = await window.focusdayDesktop?.pickFolder?.(); if (!dir) return;
    const c2 = syncCfg(); c2.folder = { enabled: true, dir }; saveSyncCfg(c2); paint(); await SyncEngine.syncNow('manual'); paint();
  });
  const login = async (kind) => {
    if (!takePass()) return; const c2 = syncCfg(); c2.cloud.url = $('#cloudUrl').value.trim(); c2.cloud.anon = $('#cloudAnon').value.trim(); saveSyncCfg(c2);
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c2.cloud.url.replace(/\/+$/, '')) && !/^https?:\/\/localhost/.test(c2.cloud.url)) { toast('Адрес вида https://xxxx.supabase.co', 'error'); return; }
    try { const r = await Cloud.auth(kind, $('#cloudEmail').value.trim(), $('#cloudPassword').value); $('#cloudPassword').value = '';
      if (r.needConfirm) { toast('Подтверди почту по ссылке из письма и нажми «Войти»'); return; }
      paint(); await SyncEngine.syncNow('manual'); paint(); toast('Облако подключено · данные шифруются на устройстве');
    } catch (e) { toast(`Облако: ${e.message}`, 'error'); }
  };
  $('#cloudLoginBtn')?.addEventListener('click', () => login('login'));
  $('#cloudSignupBtn')?.addEventListener('click', () => login('signup'));
  $('#syncNowBtn')?.addEventListener('click', async () => { if (!takePass()) return; if (!SyncEngine.enabled()) { toast('Сначала выбери папку или подключи облако', 'error'); return; } await SyncEngine.syncNow('manual'); paint(); });
  $('#syncOffBtn')?.addEventListener('click', () => { if (confirm('Отключить синхронизацию на этом устройстве? Локальные данные останутся.')) { SyncEngine.disconnect(); paint(); } });
  paint();
}
