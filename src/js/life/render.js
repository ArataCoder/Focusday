/* Focusday · life/render.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { quickAddTask } from '../adhd.js';
import { $, $$, addDays, esc, fromISO, ic, mondayOf, plural, toISO, todayISO } from '../core.js';
import { createHabit, habitStats, setHabitDay } from '../life/habits.js';
import { addThought, setLowEnergy } from '../life/journal.js';
import { decideWish, hoursLeft, spentOn } from '../life/money.js';
import { MOODS, classifyQuick, describeQuick, ensureLife, lowShowAll, money, num, removeItem, set_lowShowAll, touch } from '../life/quick.js';
import { checkAchievements } from '../progress.js';
import { renderAll, switchView, toast } from '../render.js';
import { playSound } from '../sound.js';
import { data, persist, prettyDate } from '../state.js';

/* ── 6. Рендер ─────────────────────────────────────────────────── */
export const LIFE_VIEWS = { habits: ['Привычки', 'Ритм, а не цепь.', 'Цель — N раз в неделю. Пропуск — это пауза, а не провал. «Минимум» засчитывается полностью.'], money: ['Финансы', 'Деньги без тревоги.', 'Один взгляд: сколько осталось на сегодня. Импульсивные покупки сначала отдыхают в карантине.'], journal: ['Мысли', 'Выгрузи голову.', 'Пиши как есть. Без правил, без оценок. Любую мысль можно превратить в задачу.'] };
export function weekDots(h) {
  const mon = mondayOf(fromISO(todayISO())), today = todayISO(), wd = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return wd.map((n, i) => { const iso = toISO(addDays(mon, i)), v = h.log[iso] || 0; return `<button type="button" class="wd v${v}${iso === today ? ' today' : ''}" data-habit-day="${h.id}" data-iso="${iso}" ${iso > today ? 'disabled' : ''} title="${n}: ${v === 2 ? 'сделано' : v === 1 ? 'минимум' : 'нет отметки'}"><span>${n}</span><i></i></button>`; }).join('');
}
export function renderHabitsPage() {
  const list = data.habits.filter(h => !h.archived);
  const cards = list.map(h => {
    const st = habitStats(h), v = h.log[todayISO()] || 0;
    return `<article class="habit-card${h.paused ? ' paused' : ''}" style="--hc:${esc(h.color)}">
      <div class="habit-top"><span class="habit-ring" style="--p:${st.pct}"><b>${st.thisWeek}/${h.target}</b></span>
        <div class="habit-info"><strong>${esc(h.name)}</strong><small>${h.paused ? 'На паузе — ничего не сгорает' : h.minText ? 'Минимум: ' + esc(h.minText) : 'Цель: ' + h.target + ' раз в неделю'}</small></div>
        <div class="habit-meta"><span title="Недель подряд с достигнутой целью">${ic('repeat')} ${st.streak} нед.</span><span title="Всего отметок — никогда не уменьшается">${ic('spark')} ${st.total}</span></div></div>
      <div class="week-dots">${weekDots(h)}</div>
      <div class="habit-actions">
        <button type="button" class="hbtn full${v === 2 ? ' on' : ''}" data-habit-today="${h.id}" data-val="2" ${h.paused ? 'disabled' : ''}>${ic('check')} Сделано</button>
        <button type="button" class="hbtn min${v === 1 ? ' on' : ''}" data-habit-today="${h.id}" data-val="1" ${h.paused ? 'disabled' : ''}>${ic('battery')} Минимум</button>
        <button type="button" class="hbtn ghost" data-habit-pause="${h.id}">${h.paused ? ic('play') + ' Вернуть' : ic('pause') + ' Пауза'}</button>
        <button type="button" class="hbtn ghost danger" data-habit-del="${h.id}" aria-label="Удалить привычку">${ic('trash')}</button></div></article>`;
  }).join('');
  return `<div class="life-grid">${cards || `<div class="empty-state"><div class="empty-icon">${ic('leaf')}</div><h3>Начни с одной привычки</h3><p>Самой маленькой. «Стакан воды», «2 минуты растяжки». Или напиши в быстром вводе <b>@вода</b>.</p></div>`}</div>
    <form class="life-form glass-lite" id="habitForm" autocomplete="off"><strong>${ic('plus')} Новая привычка</strong>
      <input class="text-field" id="habitName" maxlength="40" placeholder="Что? Например, прогулка" required>
      <input class="text-field" id="habitMin" maxlength="60" placeholder="Минимальная версия: 5 минут у подъезда">
      <select class="text-field" id="habitTarget" aria-label="Раз в неделю">${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}"${n === 4 ? ' selected' : ''}>${n} раз в неделю</option>`).join('')}</select>
      <button class="primary-btn" type="submit">Добавить</button></form>`;
}
export function renderMoneyPage() {
  const m = data.money, today = todayISO(), spent = spentOn(today), left = m.dailyLimit - spent;
  const weekStart = mondayOf(fromISO(today)); let week = 0; const bars = [];
  for (let i = 6; i >= 0; i--) { const iso = toISO(addDays(fromISO(today), -i)), v = spentOn(iso); bars.push({ iso, v }); }
  for (let i = 0; i < 7; i++) week += spentOn(toISO(addDays(weekStart, i)));
  const maxBar = Math.max(m.dailyLimit, ...bars.map(b => b.v), 1);
  const waiting = data.chamber.filter(w => w.status === 'waiting').sort((a, b) => a.until - b.until);
  const recent = [...data.expenses].sort((a, b) => b.at - a.at).slice(0, 12);
  return `<div class="money-hero glass-lite"><div><span class="eyebrow">Осталось на сегодня</span><strong class="money-big ${left < 0 ? 'over' : ''}">${money(Math.max(0, left))}</strong>
      <small>${left < 0 ? `Сверх лимита на ${money(-left)}. Бывает — завтра новый день.` : `потрачено ${money(spent)} из ${money(m.dailyLimit)}`}</small>
      <div class="money-track"><i style="width:${Math.min(100, spent / Math.max(1, m.dailyLimit) * 100)}%"></i></div></div>
    <div class="money-bars">${bars.map(b => `<div title="${esc(prettyDate(b.iso))}: ${money(b.v)}"><span style="height:${Math.max(4, b.v / maxBar * 100)}%" class="${b.v > m.dailyLimit ? 'over' : ''}"></span><em>${fromISO(b.iso).toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '')}</em></div>`).join('')}<i class="limit-line" style="bottom:calc(18px + (100% - 18px) * ${(m.dailyLimit / maxBar).toFixed(3)})"></i></div></div>
    <div class="money-kpis"><div><b>${money(week)}</b><span>за неделю</span></div><div><b class="mint">${money(m.saved)}</b><span>сэкономлено карантином</span></div><div><b>${waiting.length}</b><span>в карантине</span></div></div>
    <section class="chamber glass-lite"><div class="life-sub">${ic('hourglass')}<strong>Cool-off Chamber</strong><small>Хотелка отдыхает ${m.coolHours} ч (дорогие — 72 ч). Потом решаешь спокойно.</small></div>
      ${waiting.map(w => { const h = hoursLeft(w), ready = h === 0, total = Math.max(1, (w.until - w.addedAt) / 3600e3); return `<div class="wish ${ready ? 'ready' : ''}"><div class="wish-ring" style="--p:${1 - h / total}">${ready ? ic('check') : `<b>${h}ч</b>`}</div><div class="wish-info"><strong>${esc(w.title)}</strong><small>${money(w.price)} · ${ready ? 'карантин окончен — всё ещё хочется?' : 'ещё ' + h + ' ч'}</small></div><button type="button" class="hbtn ghost" data-wish="${w.id}" data-decision="released">Отпустить</button><button type="button" class="hbtn ${ready ? 'full' : 'ghost subtle'}" data-wish="${w.id}" data-decision="bought">${ready ? 'Купить' : 'Купить всё равно'}</button></div>`; }).join('') || '<p class="life-empty">Пусто. Напиши в быстром вводе <b>?$80 наушники</b> — и хотелка подождёт.</p>'}
    </section>
    <section class="glass-lite"><div class="life-sub">${ic('wallet')}<strong>Последние записи</strong><small>Записывай как есть: <b>-$4,5 кофе #еда</b> · <b>+$500 зарплата</b></small></div>
      <div class="exp-list">${recent.map(e => `<div class="exp"><span class="exp-amt ${e.type}">${e.type === 'in' ? '+' : '−'}${money(e.amount)}</span><span class="exp-note">${esc(e.note)}${e.tag ? ` <i>#${esc(e.tag)}</i>` : ''}</span><small>${new Date(e.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small><button type="button" class="task-action delete" data-exp-del="${e.id}" aria-label="Удалить">${ic('trash')}</button></div>`).join('') || '<p class="life-empty">Пока ни одной записи.</p>'}</div></section>
    <form class="life-form glass-lite" id="moneyForm"><strong>${ic('gear')} Настройки</strong>
      <label>Дневной лимит<input class="text-field" id="mLimit" type="number" min="0" step="1" value="${m.dailyLimit}"></label>
      <label>Порог импульса<input class="text-field" id="mImpulse" type="number" min="1" step="1" value="${m.impulse}"></label>
      <label>Карантин<select class="text-field" id="mCool">${[12, 24, 48, 72].map(h => `<option value="${h}"${h === m.coolHours ? ' selected' : ''}>${h} ч</option>`).join('')}</select></label>
      <label>Валюта<input class="text-field" id="mCur" maxlength="4" value="${esc(m.currency)}"></label>
      <button class="primary-btn" type="submit">Сохранить</button></form>`;
}
export function renderJournalPage() {
  const groups = {}; data.thoughts.forEach(t => { const d = toISO(new Date(t.at)); (groups[d] = groups[d] || []).push(t); });
  const week = []; for (let i = 6; i >= 0; i--) { const iso = toISO(addDays(fromISO(todayISO()), -i)), ms = data.thoughts.filter(t => t.mood && toISO(new Date(t.at)) === iso).map(t => t.mood); week.push({ iso, mood: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0 }); }
  return `<form class="journal-compose glass-lite" id="thoughtForm"><textarea class="text-field" id="thoughtText" rows="3" maxlength="1000" placeholder="Что сейчас в голове? Можно одним словом."></textarea>
      <div class="compose-row"><div class="mood-pick" id="moodPick" role="radiogroup" aria-label="Настроение (необязательно)">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" class="mood m${n}" data-mood="${n}" title="${MOODS[n]}"><i></i><span>${MOODS[n]}</span></button>`).join('')}</div>
      <button class="primary-btn" type="submit">${ic('pen')} Сохранить</button></div></form>
    <div class="mood-week glass-lite"><span class="eyebrow">Настроение за неделю</span><div>${week.map(d => `<span class="mood-dot m${d.mood}" title="${esc(prettyDate(d.iso))}: ${d.mood ? MOODS[d.mood] : 'нет записи'}"><i></i><em>${fromISO(d.iso).toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '')}</em></span>`).join('')}</div></div>
    ${Object.keys(groups).sort().reverse().map(d => `<section class="thought-day"><h4>${d === todayISO() ? 'Сегодня' : esc(prettyDate(d, { day: 'numeric', month: 'long', weekday: 'short' }))}</h4>${groups[d].map(t => `<article class="thought m${t.mood}"><p>${esc(t.text)}</p><footer><small>${new Date(t.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${t.mood ? ' · ' + MOODS[t.mood] : ''}</small><button type="button" class="task-action" data-thought-task="${t.id}">${ic('check-circle')} В задачу</button><button type="button" class="task-action delete" data-thought-del="${t.id}" aria-label="Удалить">${ic('trash')}</button></footer></article>`).join('')}</section>`).join('') || `<div class="empty-state"><div class="empty-icon">${ic('pen')}</div><h3>Чистый лист</h3><p>Нажми <b>Q</b> и начни с <b>!</b> — мысль улетит сюда из любого места.</p></div>`}`;
}
export function renderLifeWidget() {
  const box = $('#lwHabits'); if (!box) return;
  const active = data.habits.filter(h => !h.paused && !h.archived).slice(0, 5), today = todayISO();
  box.innerHTML = active.length ? active.map(h => { const st = habitStats(h), v = h.log[today] || 0; return `<button type="button" class="lw-habit v${v}" style="--hc:${esc(h.color)};--p:${st.pct}" data-habit-today="${h.id}" data-val="${data.lowEnergy ? 1 : 2}" title="${esc(h.name)} · ${st.thisWeek}/${h.target} на неделе · клик = ${data.lowEnergy ? 'минимум' : 'сделано'}"><span class="lw-ring">${v ? ic('check') : esc(h.name.slice(0, 1).toUpperCase())}</span><small>${esc(h.name)}</small></button>`; }).join('') : `<button type="button" class="lw-empty" data-goto="habits">${ic('leaf')} Добавить первую привычку</button>`;
  const spent = spentOn(today), left = data.money.dailyLimit - spent, waiting = data.chamber.filter(w => w.status === 'waiting');
  const ready = waiting.filter(w => hoursLeft(w) === 0).length;
  $('#lwMoney').innerHTML = `${ic('wallet')}<span><strong>${money(Math.max(0, left))}</strong> осталось сегодня${waiting.length ? ` · ${ic('hourglass')} ${waiting.length}${ready ? ' (решить: ' + ready + ')' : ''}` : ''}</span><i class="lw-bar"><b style="width:${Math.min(100, spent / Math.max(1, data.money.dailyLimit) * 100)}%"></b></i>`;
  const todays = data.thoughts.filter(t => toISO(new Date(t.at)) === today);
  $('#lwJournal').innerHTML = `${ic('pen')}<span>${todays.length ? `<strong>${todays.length}</strong> ${plural(todays.length, ['мысль', 'мысли', 'мыслей'])} сегодня · «${esc(todays[0].text.slice(0, 38))}${todays[0].text.length > 38 ? '…' : ''}»` : 'Что в голове? <kbd>Q</kbd> → <b>!мысль</b>'}</span>`;
  $('#lifeCard')?.classList.toggle('collapsed', !!data.lifeCollapsed);
  $('#lifeCollapse')?.setAttribute('aria-expanded', String(!data.lifeCollapsed));
}
export function renderLife() {
  ensureLife();
  const view = data.view, isLife = !!LIFE_VIEWS[view];
  document.body.classList.toggle('life-view', isLife);
  document.body.classList.toggle('low-energy', !!data.lowEnergy);
  $('#lowEnergyBtn')?.setAttribute('aria-pressed', String(!!data.lowEnergy));
  const page = $('#lifePage');
  if (page) { page.hidden = !isLife; if (isLife) { page.dataset.page = view; page.innerHTML = view === 'habits' ? renderHabitsPage() : view === 'money' ? renderMoneyPage() : renderJournalPage(); } else page.innerHTML = ''; }
  if (isLife) { const [crumb, title, sub] = LIFE_VIEWS[view]; $('#viewBreadcrumb').textContent = crumb; $('#pageTitle').textContent = title; $('#pageSubtitle').textContent = sub; }
  else if (data.lowEnergy && view === 'today') { $('#pageTitle').textContent = 'Бережный режим.'; $('#pageSubtitle').textContent = 'Сегодня достаточно трёх маленьких дел. Остальное подождёт — и это нормально.'; }
  const banner = $('#lowBanner');
  if (banner) { banner.hidden = !(data.lowEnergy && !isLife && ['today', 'inbox'].includes(view)); $('#lowShowAll').textContent = lowShowAll ? 'Только лёгкие' : 'Показать все'; $('#lowBannerText').textContent = lowShowAll ? 'Бережный режим: показаны все задачи.' : 'Бережный режим: показаны 3 самые лёгкие задачи.'; }
  const today = todayISO();
  const hn = $('#habitNavCount'); if (hn) hn.textContent = `${data.habits.filter(h => !h.paused && h.log[today]).length}/${data.habits.filter(h => !h.paused).length}`;
  const mn = $('#moneyNavCount'); if (mn) mn.textContent = money(Math.max(0, data.money.dailyLimit - spentOn(today))).replace(' ', '\u00a0');
  const jn = $('#journalNavCount'); if (jn) jn.textContent = data.thoughts.filter(t => toISO(new Date(t.at)) === today).length;
  renderLifeWidget();
}

/* ── 7. События ────────────────────────────────────────────────── */
export function bindLife() {
  let selectedMood = 0;
  const qc = $('#quickCaptureInput'), pv = $('#qcPreview');
  qc?.addEventListener('input', () => { const c = classifyQuick(qc.value); pv.innerHTML = c ? describeQuick(c) : ''; pv.dataset.kind = c?.kind || ''; });
  $('#quickCapture')?.addEventListener('submit', () => setTimeout(() => { pv.innerHTML = ''; pv.dataset.kind = ''; }, 0));
  $('#lowEnergyBtn')?.addEventListener('click', () => setLowEnergy(!data.lowEnergy));
  $('#lowShowAll')?.addEventListener('click', () => { set_lowShowAll( !lowShowAll); renderAll(); });
  $('#lifeCollapse')?.addEventListener('click', () => { data.lifeCollapsed = !data.lifeCollapsed; persist(); renderLifeWidget(); });
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]'); if (go) { switchView(go.dataset.goto); return; }
    const ht = e.target.closest('[data-habit-today]');
    if (ht) { const h = data.habits.find(x => x.id === ht.dataset.habitToday); if (!h) return; const val = Number(ht.dataset.val) || 2, cur = h.log[todayISO()] || 0; setHabitDay(h, todayISO(), cur === val ? 0 : val); playSound(cur === val ? 'click' : 'success'); persist(); renderAll(); checkAchievements(); return; }
    const hd = e.target.closest('[data-habit-day]');
    if (hd) { const h = data.habits.find(x => x.id === hd.dataset.habitDay); if (!h) return; const cur = h.log[hd.dataset.iso] || 0; setHabitDay(h, hd.dataset.iso, cur === 0 ? 2 : cur === 2 ? 1 : 0); playSound('click'); persist(); renderAll(); checkAchievements(); return; }
    const hp = e.target.closest('[data-habit-pause]'); if (hp) { const h = data.habits.find(x => x.id === hp.dataset.habitPause); if (h) { h.paused = !h.paused; if (h.paused) h.pausedAt = Date.now(); else { if (h.pausedAt) h.pauses = [...(h.pauses || []), [h.pausedAt, Date.now()]].slice(-20); delete h.pausedAt; } touch(h); persist(); renderAll(); toast(h.paused ? 'Привычка на паузе. Ничего не сгорает.' : 'С возвращением к привычке ✦'); } return; }
    const hdl = e.target.closest('[data-habit-del]'); if (hdl) { const h = data.habits.find(x => x.id === hdl.dataset.habitDel); if (h && confirm(`Удалить привычку «${h.name}» и её историю? (Можно просто поставить на паузу)`)) { removeItem('habits', h.id); persist(); renderAll(); } return; }
    const w = e.target.closest('[data-wish]'); if (w) { decideWish(w.dataset.wish, w.dataset.decision); return; }
    const ed = e.target.closest('[data-exp-del]'); if (ed) { const ex = data.expenses.find(x => x.id === ed.dataset.expDel); if (!ex) return; removeItem('expenses', ex.id); persist(); renderAll(); toast('Запись удалена', 'success', { label: 'Отменить', onClick: () => { delete data.deleted[ex.id]; data.expenses.push(touch(ex)); persist(); renderAll(); } }); return; }
    const tt = e.target.closest('[data-thought-task]'); if (tt) { const t = data.thoughts.find(x => x.id === tt.dataset.thoughtTask); if (t) { quickAddTask(t.text.slice(0, 120)); t.converted = true; touch(t); persist(); } return; }
    const td = e.target.closest('[data-thought-del]'); if (td) { const t = data.thoughts.find(x => x.id === td.dataset.thoughtDel); if (!t) return; removeItem('thoughts', t.id); persist(); renderAll(); toast('Мысль удалена', 'success', { label: 'Отменить', onClick: () => { delete data.deleted[t.id]; data.thoughts.push(touch(t)); data.thoughts.sort((a, b) => b.at - a.at); persist(); renderAll(); } }); return; }
    const md = e.target.closest('[data-mood]'); if (md) { selectedMood = selectedMood === Number(md.dataset.mood) ? 0 : Number(md.dataset.mood); $$('#moodPick [data-mood]').forEach(b => { const on = Number(b.dataset.mood) === selectedMood; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'habitForm') { e.preventDefault(); const name = $('#habitName').value.trim(); if (!name) return; createHabit(name, $('#habitMin').value.trim(), Number($('#habitTarget').value) || 4); persist(); renderAll(); checkAchievements(); toast('Привычка добавлена. Начни с минимума ✦'); }
    else if (e.target.id === 'moneyForm') { e.preventDefault(); Object.assign(data.money, { dailyLimit: Math.max(0, num($('#mLimit').value) || 0), impulse: Math.max(1, num($('#mImpulse').value) || 30), coolHours: Number($('#mCool').value) || 24, currency: $('#mCur').value.trim().slice(0, 4) || '€' }); touch(data.money); persist(); renderAll(); toast('Настройки финансов сохранены'); }
    else if (e.target.id === 'thoughtForm') { e.preventDefault(); const text = $('#thoughtText').value.trim(); if (!text) { $('#thoughtText').focus(); return; } addThought(text, selectedMood); selectedMood = 0; }
  });
  setInterval(() => { if (data.view === 'money' && !document.hidden && !$('#lifePage')?.contains(document.activeElement)) renderLife(); else renderLifeWidget(); }, 60000);
}
