/* Focusday · vault.js — сквозное шифрование (E2E) для синхронизации.
   Пароль НИКОГДА не покидает устройство и не сохраняется. Из него PBKDF2-SHA256 (600 000 итераций)
   выводится AES-GCM-256 ключ; ключ хранится в IndexedDB как НЕизвлекаемый CryptoKey.
   Сервер / облачная папка видят только шифротекст: ни Supabase, ни владелец проекта прочитать данные не могут. */
export const KDF_ITER = 600000;
const enc = new TextEncoder(), dec = new TextDecoder();
export const b64 = (buf) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
export const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const randomSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

export async function deriveVaultKey(pass, saltB64, iter = KDF_ITER) {
  if (!pass || String(pass).length < 10) throw new Error('weak-pass');
  const base = await crypto.subtle.importKey('raw', enc.encode(String(pass).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Конверт: { app, v, kdf:{alg,iter,salt}, iv, ct, at, device } — JSON-строка, безопасно класть в облако. */
export async function sealVault(obj, key, salt, meta = {}) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode('focusday-vault-v2') }, key, enc.encode(JSON.stringify(obj)));
  return JSON.stringify({ app: 'focusday-vault', v: 2, kdf: { alg: 'PBKDF2-SHA256', iter: KDF_ITER, salt }, iv: b64(iv), ct: b64(ct), at: meta.at || Date.now(), device: meta.device || '' });
}
export function vaultHeader(str) { try { const o = JSON.parse(str); return o && o.app === 'focusday-vault' ? o : null; } catch (_) { return null; } }
export async function openVault(str, key) {
  const o = vaultHeader(str); if (!o) throw new Error('not-a-vault');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv), additionalData: enc.encode('focusday-vault-v2') }, key, unb64(o.ct));
  return JSON.parse(dec.decode(pt));
}

/* ── Хранилище ключа: IndexedDB (CryptoKey не извлекается даже из JS) ── */
const mem = new Map();
function idb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((res) => { const r = indexedDB.open('focusday-vault', 1); r.onupgradeneeded = () => r.result.createObjectStore('keys'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
}
async function tx(mode, fn) { const db = await idb(); if (!db) return fn(null); return new Promise((res, rej) => { const t = db.transaction('keys', mode), st = t.objectStore('keys'); const r = fn(st); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); }
export async function saveKey(rec) { mem.set('main', rec); try { await tx('readwrite', st => st?.put(rec, 'main')); } catch (_) {} }
export async function loadKey() { if (mem.has('main')) return mem.get('main'); try { const r = await tx('readonly', st => st?.get('main')); if (r) mem.set('main', r); return r || null; } catch (_) { return null; } }
export async function forgetKey() { mem.delete('main'); try { await tx('readwrite', st => st?.delete('main')); } catch (_) {} }
