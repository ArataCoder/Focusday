/* Focusday · sw.js — офлайн-кэш оболочки приложения для PWA (телефон / «Установить приложение»).
   Данные пользователя здесь НЕ хранятся (они в localStorage/IndexedDB). Запросы к Supabase не кэшируются. */
const VERSION = 'focusday-1.3.3';
const SHELL = ['./focusday.html', './focusday.css', './cat.css', './focusday.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Свои файлы: сначала сеть (свежая версия), при офлайне — кэш. Чужие домены не трогаем.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match('./focusday.html'))));
});
