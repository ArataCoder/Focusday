// Окно котика: слушатель регистрируем ДО сообщения о готовности.
import { mountCat, paintCat } from './js/features/cat-ui.js';
const T = window.__TAURI__, root = document.getElementById('catBuddy');
let last = { mode: 'hidden' };
const send = (a) => T?.event.emit('focusday://buddy-action', a);
mountCat(root, send);
// В отдельном окне котика можно перетащить, но обычный клик по-прежнему гладит его.
const cat = root.querySelector('.cat');
cat.setAttribute('aria-label', 'Котик-напарник: нажми, чтобы погладить, или перетащи');
cat.title = 'Нажми, чтобы погладить, или перетащи';
let drag = null, suppressClick = false, clearSuppression;
cat.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !T?.window?.getCurrentWindow) return;
  clearTimeout(clearSuppression); suppressClick = false;
  drag = { x: e.clientX, y: e.clientY, started: false };
});
document.addEventListener('pointermove', (e) => {
  if (!drag || drag.started || !(e.buttons & 1)) return;
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  drag.started = true; suppressClick = true;
  try { Promise.resolve(T.window.getCurrentWindow().startDragging()).catch(console.error); }
  catch (err) { console.error('Focusday: не удалось перетащить котика', err); }
});
const endDrag = () => {
  if (drag?.started) clearSuppression = setTimeout(() => { suppressClick = false; }, 300);
  drag = null;
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
root.addEventListener('click', (e) => {
  if (suppressClick && e.target.closest('.cat')) {
    e.stopImmediatePropagation(); e.preventDefault(); suppressClick = false;
  }
}, true);
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
