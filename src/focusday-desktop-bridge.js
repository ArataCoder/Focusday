/* Focusday desktop bridge.
   Даёт единый API window.focusdayDesktop для Tauri v2 (и не мешает старому Electron-preload).
   Требует "withGlobalTauri": true в tauri.conf.json. В обычном браузере ничего не делает. */
(() => {
  'use strict';
  if (window.focusdayDesktop || !window.__TAURI__) return;
  // Mobile Tauri is not the desktop runtime: no overlay, system idle or folder bridge.
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    document.documentElement.classList.add('mobile-native');
    return;
  }
  const T = window.__TAURI__;
  const invoke = T.core.invoke;
  const { emit, listen } = T.event;
  // v1.3: убран навязчивый виджет «каждые 5 минут». Теперь будит котик — только при реальном простое.
  let lastState = null, lastBuddy = { mode: 'hidden' }, buddySize = 'hidden';
  let buddyQueue = Promise.resolve();
  const buddyVisibleListeners = new Set();
  const buddyStatusListeners = new Set();
  let buddyPhase = 'idle';
  const buddyStatus = (phase, error) => {
    buddyPhase = phase;
    for (const cb of buddyStatusListeners) cb({ phase, error });
  };
  const sizeOf = (mode) => mode === 'hidden' ? 'hidden' : (mode === 'idle' || mode === 'purr') ? 'small' : 'large';

  window.focusdayDesktop = {
    platform: 'tauri',
    openOverlay: () => invoke('open_overlay'),
    publishState: (state) => { lastState = state; emit('focusday://state', state); },
    // Системный простой (секунды без мыши/клавиатуры во ВСЕХ программах). null — платформа не умеет.
    idleSeconds: () => invoke('idle_seconds'),
    // Котик-компаньон в отдельном окне поверх всех программ. Окно меняет размер только при смене класса.
    buddy: (state) => {
      lastBuddy = state;
      // Сериализуем создание/изменение окна, чтобы быстрая пауза не обогнала запуск.
      const op = buddyQueue.then(async () => {
        const size = sizeOf(lastBuddy.mode);
        if (size !== buddySize) {
          if (size !== 'hidden') buddyStatus('creating');
          try { await invoke('buddy', { mode: size }); }
          catch (err) { buddyStatus('error', String(err)); throw err; }
          buddySize = size;
          if (size === 'hidden') buddyStatus('idle');
          else if (buddyPhase === 'creating') buddyStatus('created');
        }
        try { await emit('focusday://buddy-state', lastBuddy); }
        catch (err) { buddyStatus('error', String(err)); throw err; }
      });
      buddyQueue = op.catch(() => {}); // ошибка не блокирует следующую попытку
      return op;
    },
    onBuddyVisible: (cb) => { buddyVisibleListeners.add(cb); return () => buddyVisibleListeners.delete(cb); },
    onBuddyStatus: (cb) => { buddyStatusListeners.add(cb); return () => buddyStatusListeners.delete(cb); },
    onBuddyAction: (cb) => listen('focusday://buddy-action', (e) => cb(e.payload)),
    attention: () => invoke('attention').catch(() => {}),
    overlayAction: (action) => emit('focusday://overlay-action', action),
    onOverlayState: (cb) => listen('focusday://state', (e) => cb(e.payload)),
    onOverlayAction: (cb) => listen('focusday://overlay-action', (e) => cb(e.payload)),
    onQuickAdd: (cb) => listen('focusday://quick-add', (e) => cb(e.payload)),
    // Синхронизация через папку (облачный клиент делает остальное)
    pickFolder: async () => { const r = await T.dialog?.open({ directory: true, title: 'Папка синхронизации (OneDrive / Google Drive / Dropbox)' }); return Array.isArray(r) ? r[0] : r; },
    syncWrite: (dir, name, content) => invoke('sync_write', { dir, name, content }),
    syncRead: (dir, name) => invoke('sync_read', { dir, name })
  };

  // Оверлей открылся позже главного окна — отдать ему актуальное состояние.
  listen('focusday://overlay-ready', () => { if (lastState) emit('focusday://state', lastState); });
  listen('focusday://buddy-ready', () => { if (lastBuddy.mode !== 'hidden') buddyStatus('ready'); emit('focusday://buddy-state', lastBuddy); });
  listen('focusday://buddy-visible', (e) => { if (lastBuddy.mode !== 'hidden' && e.payload?.mode === lastBuddy.mode) buddyStatus('visible'); for (const cb of buddyVisibleListeners) cb(e.payload); });

  // Нативные Windows-уведомления (Action Center) вместо Web Notification API.
  const N = T.notification;
  if (N?.sendNotification) {
    function TauriNotification(title, opts = {}) { N.sendNotification({ title, body: opts.body || '' }); }
    TauriNotification.permission = 'granted';
    TauriNotification.requestPermission = async () => 'granted';
    N.isPermissionGranted?.().then((ok) => { if (!ok) N.requestPermission?.(); });
    window.Notification = TauriNotification;
  }
})();
