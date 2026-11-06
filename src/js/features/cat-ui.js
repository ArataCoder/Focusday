/* Focusday · cat-ui.js — векторный котик-напарник (SVG + CSS-анимации, без .gif).
   Общий для главного окна и десктопного окна-компаньона buddy.html. Без зависимостей. */
export const CAT_SVG = `<svg class="cat-svg" viewBox="0 0 160 150" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="catFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--cat-fur-1)"/><stop offset="1" style="stop-color:var(--cat-fur-2)"/></linearGradient>
    <radialGradient id="catEye" cx=".4" cy=".35" r=".7"><stop offset="0" style="stop-color:var(--cat-eye-1)"/><stop offset="1" style="stop-color:var(--cat-eye-2)"/></radialGradient>
  </defs>
  <ellipse class="cat-shadow" cx="80" cy="141" rx="46" ry="6"/>
  <g class="cat-tail"><path d="M106 131 C140 130 150 98 132 78 C125 71 116 76 121 84 C133 100 126 119 104 121 Z" fill="url(#catFur)"/><path class="cat-tail-tip" d="M132 78 C125 71 116 76 121 84 C123 87 126 86 128 83 Z"/></g>
  <path class="cat-body" d="M46 138 C36 110 46 82 80 80 C114 82 124 110 114 138 Z" fill="url(#catFur)"/>
  <ellipse class="cat-belly" cx="80" cy="116" rx="16" ry="21"/>
  <g class="cat-paws"><ellipse cx="65" cy="137" rx="12" ry="6.5"/><ellipse cx="95" cy="137" rx="12" ry="6.5"/>
    <path class="cat-line" d="M61 136v3M66 136v3M91 136v3M96 136v3"/></g>
  <g class="cat-cup"><path d="M108 124h18l-2.5 14h-13z"/><path class="cat-line" d="M126 127c5 0 5 7 0 7"/><path class="cat-steam" d="M113 119c-2-3 2-4 0-7M119 119c-2-3 2-4 0-7"/></g>
  <g class="cat-head">
    <g class="cat-ear cat-ear-l"><path d="M48 54 L50 17 L75 38 Z" fill="url(#catFur)"/><path class="cat-ear-in" d="M54 45 L55 27 L67 37 Z"/></g>
    <g class="cat-ear cat-ear-r"><path d="M112 54 L110 17 L85 38 Z" fill="url(#catFur)"/><path class="cat-ear-in" d="M106 45 L105 27 L93 37 Z"/></g>
    <ellipse class="cat-face" cx="80" cy="61" rx="35" ry="29"/>
    <ellipse class="cat-blush" cx="58" cy="72" rx="5.5" ry="3"/><ellipse class="cat-blush" cx="102" cy="72" rx="5.5" ry="3"/>
    <g class="cat-eyes">
      <g class="cat-eye"><ellipse cx="66" cy="58" rx="8.5" ry="9.5" fill="url(#catEye)"/><g class="cat-look"><ellipse class="cat-pupil" cx="66" cy="58.5" rx="3.2" ry="7"/><circle class="cat-glint" cx="68.5" cy="54.5" r="1.8"/></g></g>
      <g class="cat-eye"><ellipse cx="94" cy="58" rx="8.5" ry="9.5" fill="url(#catEye)"/><g class="cat-look"><ellipse class="cat-pupil" cx="94" cy="58.5" rx="3.2" ry="7"/><circle class="cat-glint" cx="96.5" cy="54.5" r="1.8"/></g></g>
    </g>
    <path class="cat-closed cat-line" d="M57 60q9 6 18 0M85 60q9 6 18 0"/>
    <path class="cat-nose" d="M76.5 69.5h7l-3.5 4z"/>
    <path class="cat-line" d="M80 73.5q-3 4.5 -7.5 2.2M80 73.5q3 4.5 7.5 2.2"/>
    <path class="cat-whisk" d="M58 71L36 66M58 75L37 76M102 71L124 66M102 75L123 76"/>
  </g>
  <g class="cat-z"><text x="116" y="34">z</text><text x="126" y="22">z</text><text x="136" y="12">z</text></g>
  <g class="cat-bang"><circle cx="128" cy="26" r="11"/><path d="M128 19v8M128 31v.5"/></g>
</svg>`;

export const CAT_TEXT = {
  idle: 'Ты всё ещё в потоке или сделаем паузу? 🐾',
  away: 'Тебя давно не было — я поставил фокус на паузу. Время простоя не сгорело, всё на месте.',
  break: 'Перерыв ☕ Встань, попей воды, посмотри в окно.',
  back: 'Перерыв окончен. Вернёмся к делу? 🐾'
};

const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** state: { mode:'hidden'|'idle'|'alert'|'away'|'break'|'back'|'purr', text?, breakEndsAt?, remainingText? } */
export function catActions(mode) {
  if (mode === 'alert') return [['snooze', 'Продолжаю 🐾', true], ['pause', 'Взял паузу ☕']];
  if (mode === 'away') return [['resume', 'Продолжить фокус', true], ['close', 'Позже']];
  if (mode === 'break') return [['resume', 'Вернуться раньше'], ['extend', '+5 минут']];
  if (mode === 'back') return [['resume', 'Продолжить фокус 🐾', true], ['extend', 'Ещё 5 минут']];
  return [];
}

export function mountCat(root, onAction) {
  root.innerHTML = `<div class="cat-bubble" hidden role="status" aria-live="polite"><p class="cat-text"></p><strong class="cat-count" hidden></strong><div class="cat-actions"></div><button type="button" class="cat-mute" data-cat="mute" hidden>Не беспокоить в эту сессию</button></div>
    <button type="button" class="cat" aria-label="Котик-напарник: нажми, чтобы погладить">${CAT_SVG}</button>`;
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) onAction(b.dataset.cat); else if (e.target.closest('.cat')) onAction('pet'); });
  // моргание в случайный момент (живость без суеты)
  const cat = root.querySelector('.cat');
  const blink = () => { cat.classList.add('blink'); setTimeout(() => cat.classList.remove('blink'), 140); setTimeout(blink, 2800 + Math.random() * 4200); };
  setTimeout(blink, 1800);
  return root;
}

export function paintCat(root, st) {
  const mode = st?.mode || 'hidden', cat = root.querySelector('.cat'), bub = root.querySelector('.cat-bubble');
  root.hidden = mode === 'hidden'; root.dataset.mode = mode;
  cat.classList.toggle('alert', ['alert', 'back', 'away'].includes(mode));
  cat.classList.toggle('sleep', mode === 'break');
  const speaking = mode !== 'idle' && mode !== 'hidden';
  bub.hidden = !speaking;
  if (!speaking) return;
  bub.querySelector('.cat-text').textContent = st.text || CAT_TEXT[mode === 'alert' ? 'idle' : mode] || '';
  const cnt = bub.querySelector('.cat-count');
  cnt.hidden = mode !== 'break'; if (mode === 'break') cnt.textContent = fmt((st.breakEndsAt || 0) - Date.now());
  const acts = catActions(mode), box = bub.querySelector('.cat-actions'), sig = acts.map(a => a[0]).join();
  if (box.dataset.sig !== sig) { box.dataset.sig = sig; box.innerHTML = acts.map(([id, label, primary]) => `<button type="button" data-cat="${id}" class="${primary ? 'primary' : ''}">${label}</button>`).join(''); }
  bub.querySelector('.cat-mute').hidden = mode !== 'alert';
}
