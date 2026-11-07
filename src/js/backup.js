/* Focusday · backup.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { $, esc, freshData, normalizeTask, storage, toISO, todayISO, uid } from './core.js';
import { mergeLife } from './life/merge.js';
import { updateSettingsCount } from './main.js';
import { checkAchievements, renderProgress } from './progress.js';
import { closeModals, renderAll, showModal, toast } from './render.js';
import { data, persist, persistNow, set_data, taskElapsed } from './state.js';

/* ═══════════════════════════════════════════════════════════════════
   PROGRESS & BACKUP ENGINE v3
   1) Change tracking: updatedAt + tombstones (основа merge/sync)
   2) Backup: export / encrypted export / merge-import / snapshots
   3) Gamification: XP, уровни, ADHD-достижения, Steam/iOS-карточки
   4) Heatmap активности (GitHub-style)
   ═══════════════════════════════════════════════════════════════════ */
export const SCHEMA = 5;   // v4: + привычки, финансы, хотелки, мысли; v5: + цитаты, котик, звуки
export const SNAP_KEY = 'focusday.snapshots.v1';
export const DEVICE_KEY = 'focusday.device';
export const deviceId = storage.getItem(DEVICE_KEY) || (() => { const id = 'dev_' + uid().slice(2); storage.setItem(DEVICE_KEY, id); return id; })();

/* ── 1. Change tracking ──────────────────────────────────────────── */
export let taskHashes = new Map();
export const taskKey = (t) => { const { updatedAt, timerStartedAt, ...rest } = t; return JSON.stringify(rest); };
export let tracking = false;
export function rebaseline() { tracking = true; taskHashes = new Map(data.tasks.map(t => [t.id, taskKey(t)])); }
export function trackChanges() {
  if (!tracking) return;
  const now = Date.now(), seen = new Set();
  if (!data.deleted || typeof data.deleted !== 'object') data.deleted = {};
  data.tasks.forEach(t => { seen.add(t.id); const k = taskKey(t); if (taskHashes.get(t.id) !== k) { t.updatedAt = now; taskHashes.set(t.id, k); } });
  taskHashes.forEach((_, id) => { if (!seen.has(id)) { data.deleted[id] = now; taskHashes.delete(id); } });
  // tombstones старше 120 дней больше не нужны для синхронизации
  const cutoff = now - 120 * 864e5; Object.keys(data.deleted).forEach(id => { if (data.deleted[id] < cutoff) delete data.deleted[id]; });
}

/* ── 2. Backup ───────────────────────────────────────────────────── */
export async function sha256(text) {
  if (!crypto?.subtle) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function buildPayload() {
  const clean = { ...data, focusRunning: false, focusStartedAt: null }; delete clean.sync;   // путь к папке — настройка устройства
  const body = JSON.stringify(clean);
  return { app: 'Focusday', schema: SCHEMA, exportedAt: new Date().toISOString(), device: deviceId,
    counts: { tasks: data.tasks.length, lists: data.lists.length, achievements: (data.achievements || []).length, habits: (data.habits || []).length, expenses: (data.expenses || []).length, wishes: (data.chamber || []).length, thoughts: (data.thoughts || []).length },
    checksum: await sha256(body), data: clean };
}
export const stamp = () => { const d = new Date(); return `${todayISO()}_${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}`; };
export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export async function exportData() {
  persistNow();
  download(`focusday-backup-${stamp()}.json`, JSON.stringify(await buildPayload(), null, 2));
  data.lastBackupAt = Date.now(); persist(); toast('Бэкап скачан — данные в безопасности');
}
/* AES-GCM 256 + PBKDF2-SHA256 (310 000 итераций) — всё в браузере, без сервера */
export async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export const b64 = (u8) => { let text = ''; for (let i = 0; i < u8.length; i += 0x8000) text += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(text); };
export const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export async function encryptText(text, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt), new TextEncoder().encode(text)));
  return JSON.stringify({ app: 'Focusday', enc: 'AES-GCM-256', kdf: 'PBKDF2-SHA256-310k', salt: b64(salt), iv: b64(iv), ct: b64(ct) });
}
export async function decryptText(env, pass) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, await deriveKey(pass, unb64(env.salt)), unb64(env.ct));
  return new TextDecoder().decode(pt);
}
export async function exportEncrypted() {
  const pass = prompt('Придумай пароль для бэкапа (мин. 6 символов). Без него файл не открыть — сохрани его!');
  if (!pass) return; if (pass.length < 6) { toast('Пароль слишком короткий', 'error'); return; }
  persistNow();
  download(`focusday-backup-${stamp()}.fdbak`, await encryptText(JSON.stringify(await buildPayload()), pass), 'application/octet-stream');
  data.lastBackupAt = Date.now(); persist(); toast('Зашифрованный бэкап скачан');
}
/* Чтение любого формата: v1 (старый экспорт), v3, голый data, .fdbak */
export async function readBackup(text) {
  let parsed = JSON.parse(text);
  if (parsed?.enc) {
    const pass = prompt('Файл зашифрован. Введи пароль:'); if (!pass) throw new Error('Импорт отменён');
    try { parsed = JSON.parse(await decryptText(parsed, pass)); } catch (_) { throw new Error('Неверный пароль или файл повреждён'); }
  }
  const incoming = parsed?.data || parsed;
  if (!incoming || !Array.isArray(incoming.tasks)) throw new Error('Файл не похож на бэкап Focusday');
  let integrity = 'none';
  if (parsed.checksum) integrity = (await sha256(JSON.stringify(parsed.data))) === parsed.checksum ? 'ok' : 'mismatch';
  return { meta: parsed, incoming, integrity };
}
export const tTime = (t) => Number(t.updatedAt) || Math.max(Number(t.completedAt) || 0, Number(t.createdAt) || 0);
export function sanitizeLists(lists) { return (Array.isArray(lists) ? lists : []).filter(l => l && l.id && l.name).map(l => ({ id: String(l.id), name: String(l.name).slice(0, 30), color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : '#a78bfa' })); }
/* Ядро синхронизации: last-write-wins по updatedAt + tombstones. ID НИКОГДА не переписываются. */
export function mergeData(local, inc) {
  const out = { ...local }, stats = { added: 0, updated: 0, same: 0, skippedDeleted: 0, removed: 0 };
  const deleted = { ...(local.deleted || {}) };
  Object.entries(inc.deleted || {}).forEach(([id, ts]) => { deleted[id] = Math.max(deleted[id] || 0, Number(ts) || 0); });
  const byId = new Map(local.tasks.map(t => [t.id, t]));
  const incTasks = new Map();   // дедупликация внутри файла: остаётся самая свежая версия
  inc.tasks.map(normalizeTask).filter(Boolean).forEach(t => { const prev = incTasks.get(t.id); if (!prev || tTime(t) > tTime(prev)) incTasks.set(t.id, t); });
  incTasks.forEach((t, id) => {
    const mine = byId.get(id);
    if (!mine) { if (deleted[id] && deleted[id] >= tTime(t)) stats.skippedDeleted++; else { byId.set(id, t); delete deleted[id]; stats.added++; } }
    else if (tTime(t) > tTime(mine)) { byId.set(id, { ...t, xp: Math.max(t.xp || 0, mine.xp || 0) }); stats.updated++; }
    else stats.same++;
  });
  byId.forEach((t, id) => { if (deleted[id] && deleted[id] > tTime(t)) { byId.delete(id); stats.removed++; } });
  out.tasks = [...byId.values()];
  const lists = new Map(sanitizeLists(local.lists).map(l => [l.id, l])); sanitizeLists(inc.lists).forEach(l => { if (!lists.has(l.id)) lists.set(l.id, l); });
  out.lists = [...lists.values()];
  out.achievements = [...new Set([...(local.achievements || []), ...(inc.achievements || [])])];
  out.achievementDates = { ...(inc.achievementDates || {}), ...(local.achievementDates || {}) };
  out.deleted = deleted;
  out.xp = Math.max(Number(local.xp) || 0, Number(inc.xp) || 0);
  out.focusSessions = Math.max(local.focusSessions || 0, inc.focusSessions || 0);
  const a = local.stats || {}, b = inc.stats || {}, s = { ...b, ...a };
  Object.keys({ ...a, ...b }).forEach(k => { if (typeof a[k] === 'number' || typeof b[k] === 'number') s[k] = Math.max(Number(a[k]) || 0, Number(b[k]) || 0); });
  s.activeDays = { ...(b.activeDays || {}) }; Object.entries(a.activeDays || {}).forEach(([d, n]) => { s.activeDays[d] = Math.max(s.activeDays[d] || 0, n); });
  s.lastVisitDay = [a.lastVisitDay, b.lastVisitDay].filter(Boolean).sort().pop() || todayISO();
  out.stats = s;
  mergeLife(out, local, inc, deleted, stats);
  const known = new Set(out.lists.map(l => l.id));
  out.tasks.forEach(t => { if (!known.has(t.listId)) { out.lists.push({ id: t.listId, name: 'Восстановленный список', color: '#a78bfa' }); known.add(t.listId); } });
  return { merged: out, stats };
}
/* Снимки: до 8 точек восстановления (авто раз в день + перед каждым импортом) */
export function getSnaps() { try { return JSON.parse(storage.getItem(SNAP_KEY) || '[]'); } catch (_) { return []; } }
export function snapshot(reason) {
  const snaps = getSnaps(); snaps.unshift({ at: Date.now(), reason, data: { ...data, focusRunning: false } });
  while (snaps.length > 8) snaps.pop();
  if (!storage.setItem(SNAP_KEY, JSON.stringify(snaps))) { snaps.length = 3; storage.setItem(SNAP_KEY, JSON.stringify(snaps)); }
  renderSnapshots();
}
export function dailySnapshot() { const last = getSnaps()[0]; if (!last || toISO(new Date(last.at)) !== todayISO()) snapshot('Ежедневная авто-копия'); }
export function renderSnapshots() {
  const sel = $('#snapshotSelect'); if (!sel) return;
  sel.innerHTML = '<option value="">Точки восстановления…</option>' + getSnaps().map((s, i) => `<option value="${i}">${new Date(s.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${esc(s.reason)} · ${s.data.tasks?.length || 0} задач</option>`).join('');
}
export function applyData(next, message) {
  set_data( { ...freshData(), ...next, focusRunning: false, focusStartedAt: null });
  data.tasks = data.tasks.map(normalizeTask).filter(Boolean);
  data.tasks.forEach(t => { if (t.status === 'inprogress') { t.elapsedMs = taskElapsed(t); t.timerStartedAt = null; t.status = 'todo'; } });
  rebaseline(); persistNow(); renderAll(); renderProgress(); updateSettingsCount(); closeModals(); toast(message);
}
export let pendingImport = null;
export function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await readBackup(reader.result);
      const preview = mergeData(data, res.incoming).stats;
      pendingImport = res;
      const when = res.meta.exportedAt ? new Date(res.meta.exportedAt).toLocaleString('ru-RU') : 'неизвестно';
      $('#importMeta').innerHTML = `<div><span>Файл</span><strong>${esc(file.name)}</strong></div><div><span>Создан</span><strong>${esc(when)}</strong></div><div><span>Целостность</span><strong class="${res.integrity === 'mismatch' ? 'bad' : 'good'}">${res.integrity === 'ok' ? 'SHA-256 совпадает ✓' : res.integrity === 'mismatch' ? 'Контрольная сумма не совпала!' : 'старый формат, без подписи'}</strong></div>`;
      $('#importMeta').insertAdjacentHTML('beforeend', `<div><span>Привычки · финансы · мысли</span><strong>+${preview.lifeAdded || 0} новых · ${preview.lifeUpdated || 0} обновится</strong></div><div><span>В файле</span><strong>${(res.incoming.habits || []).length} привычек · ${(res.incoming.expenses || []).length} фин. записей · ${(res.incoming.thoughts || []).length} мыслей</strong></div>`);
      $('#importStats').innerHTML = [['Новых', preview.added, 'mint'], ['Обновится', preview.updated, 'sky'], ['Без изменений', preview.same, ''], ['Удалены ранее', preview.skippedDeleted + preview.removed, 'rose']].map(([l, n, c]) => `<div class="${c}"><strong>${n}</strong><span>${l}</span></div>`).join('');
      // Импорт открывается из настроек: иначе их окно перекроет подтверждение.
      closeModals(); showModal('importModal');
    } catch (err) { toast(err.message || 'Не удалось прочитать файл', 'error'); }
  };
  reader.readAsText(file);
}
export function confirmImport(mode) {
  if (!pendingImport) return;
  snapshot('Перед импортом');
  const before = getSnaps()[0];
  if (mode === 'replace') applyData({ ...pendingImport.incoming, deleted: {} }, 'Данные заменены из бэкапа');
  else { const { merged, stats } = mergeData(data, pendingImport.incoming); applyData(merged, `Объединено: +${stats.added} новых, ${stats.updated} обновлено`); }
  pendingImport = null;
  toast('Что-то не так? Можно откатить', 'success', { label: 'Откатить', onClick: () => applyData(before.data, 'Импорт отменён') });
  checkAchievements();
}
