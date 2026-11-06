(() => {
  const T = window.__TAURI__, win = T?.window?.getCurrentWindow?.();
  const q = document.getElementById('q');
  const hide = () => { q.value = ''; win?.hide(); };
  document.getElementById('f').addEventListener('submit', (e) => {
    e.preventDefault(); const text = q.value.trim(); if (!text) return hide();
    T?.event?.emit('focusday://quick-add', text); hide();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('blur', hide);                    // кликнул мимо — окно исчезает
  win?.listen?.('tauri://focus', () => setTimeout(() => q.focus(), 30));
})();
