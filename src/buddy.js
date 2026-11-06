// Окно котика: слушатель регистрируем ДО сообщения о готовности.
import { mountCat, paintCat } from './js/features/cat-ui.js';
const T = window.__TAURI__, root = document.getElementById('catBuddy');
let last = { mode: 'hidden' };
const send = (a) => T?.event.emit('focusday://buddy-action', a);
mountCat(root, send);
const paint = (st) => {
  last = st || { mode: 'hidden' }; paintCat(root, last);
  // Подтверждаем отрисовку: главное окно не скроет запасного котика до ответа.
  if (last.mode !== 'hidden' && !root.hidden && root.getBoundingClientRect().width > 0)
    T?.event.emit('focusday://buddy-visible', { mode: last.mode }).catch(console.error);
};
setInterval(() => { if (last.mode === 'break') paintCat(root, last); }, 1000);
if (T) {
  try {
    await T.event.listen('focusday://buddy-state', (e) => paint(e.payload));
    await T.event.emit('focusday://buddy-ready');
  } catch (err) { console.error('Focusday: окно котика не подключилось', err); }
} else paint({ mode: 'idle' });
