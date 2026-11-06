/* Focusday — собрано из src/js/*.js (npm run bundle). Не правьте этот файл руками. */
(() => {
  // src/js/core.js
  var $ = (s, root2 = document) => root2.querySelector(s);
  var $$ = (s, root2 = document) => [...root2.querySelectorAll(s)];
  var STORAGE_KEY = "focusday.data.v1";
  var memoryStore = /* @__PURE__ */ Object.create(null);
  var storage = {
    getItem(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (_) {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      }
    },
    setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
        delete memoryStore[key];
        return true;
      } catch (_) {
        memoryStore[key] = String(value);
        return false;
      }
    },
    removeItem(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (_) {
        delete memoryStore[key];
      }
    }
  };
  var LEGACY_KEYS = ["ios_tasks_2026", "tj_tasks_v2"];
  var LISTS = [
    { id: "inbox", name: "Входящие", color: "#a78bfa" },
    { id: "personal", name: "Личное", color: "#7fe0bd" },
    { id: "work", name: "Работа / учёба", color: "#f6bd79" },
    { id: "health", name: "Здоровье", color: "#ff8e9b" }
  ];
  var ENERGY = ["", "Мало сил", "Немного сил", "Спокойный режим", "Хороший заряд", "Полон энергии"];
  var todayISO = () => toISO(/* @__PURE__ */ new Date());
  function toISO(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function fromISO(value) {
    const [y, m, d] = String(value || todayISO()).split("-").map(Number);
    return new Date(y || 2e3, (m || 1) - 1, d || 1, 12);
  }
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function mondayOf(date) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
  }
  function uid() {
    return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  var ic = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
  function esc(v = "") {
    return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function validDate(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ""))) return false;
    const d = fromISO(v);
    return Number.isFinite(d.getTime()) && toISO(d) === v;
  }
  function normalizeTask(t) {
    if (!t || typeof t !== "object") return null;
    const title = String(t.title || t.name || "").trim().slice(0, 120);
    if (!title) return null;
    const status = ["todo", "inprogress", "done"].includes(t.status) ? t.status : t.completed ? "done" : "todo";
    const energy = Math.max(1, Math.min(5, Number(t.energy) || 2));
    return { id: String(t.id || uid()), routineId: String(t.routineId || (t.recurrence === "daily" ? t.id || uid() : "")), recurrence: t.recurrence === "daily" ? "daily" : "none", title, description: String(t.description || "").slice(0, 1e3), date: validDate(t.date) ? t.date : todayISO(), status, priority: Math.max(1, Math.min(3, Number(t.priority) || 2)), duration: Math.max(1, Math.min(600, Number(t.duration || t.estimate) || 25)), listId: String(t.listId || "inbox"), energy, createdAt: Number(t.createdAt) || Date.now(), completedAt: t.completedAt ? Number(t.completedAt) : null, completedForDate: typeof t.completedForDate === "string" && validDate(t.completedForDate) ? t.completedForDate : null, elapsedMs: Math.max(0, Number(t.elapsedMs) || 0), steps: Array.isArray(t.steps) ? t.steps.filter((s) => s && typeof s.text === "string").slice(0, 30).map((s) => ({ text: s.text.slice(0, 180), done: !!s.done, ...s.x ? { x: 1 } : {} })) : [], timerStartedAt: Number(t.timerStartedAt) || null, updatedAt: Number(t.updatedAt) || Math.max(Number(t.completedAt) || 0, Number(t.createdAt) || 0) || Date.now(), xp: Math.max(0, Number(t.xp) || 0) };
  }
  function freshData() {
    return { version: 2, tasks: [], lists: LISTS.map((x) => ({ ...x })), selectedDate: todayISO(), calendarOffset: 0, view: "today", filter: "all", sort: "smart", energy: 3, theme: "dark", focusMinutes: 10, focusTaskId: null, focusRemainingMs: 6e5, focusRunning: false, focusStartedAt: null, focusSessionMs: 0, focusSessions: 0, viewMode: "list", customQuotes: [], achievements: [], soundEnabled: true };
  }
  function plural(n, forms) {
    const n10 = n % 10, n100 = n % 100;
    return n10 === 1 && n100 !== 11 ? forms[0] : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? forms[1] : forms[2];
  }

  // src/js/life/merge.js
  function mergeById(a = [], b = [], deleted = {}, stats) {
    const map = new Map(a.map((x) => [x.id, x]));
    b.forEach((x) => {
      if (!x || !x.id) return;
      const mine = map.get(x.id);
      if (!mine) {
        if ((deleted[x.id] || 0) >= (x.updatedAt || 0)) return;
        map.set(x.id, x);
        stats.lifeAdded++;
      } else if ((x.updatedAt || 0) > (mine.updatedAt || 0)) {
        map.set(x.id, mine.log ? { ...x, log: { ...mine.log, ...x.log } } : x);
        stats.lifeUpdated++;
      } else if (mine.log && x.log) {
        Object.entries(x.log).forEach(([d, v]) => {
          if (!mine.log[d]) mine.log[d] = v;
        });
      }
    });
    map.forEach((x, id) => {
      if ((deleted[id] || 0) > (x.updatedAt || 0)) map.delete(id);
    });
    return [...map.values()];
  }
  function mergeLife(out, local, inc, deleted, stats) {
    stats.lifeAdded = 0;
    stats.lifeUpdated = 0;
    ["habits", "expenses", "chamber", "thoughts"].forEach((k) => {
      out[k] = mergeById(local[k], inc[k], deleted, stats);
    });
    out.thoughts.sort((a, b) => b.at - a.at);
    const lm = local.money || {}, im = inc.money || {};
    out.money = { ...(im.updatedAt || 0) > (lm.updatedAt || 0) ? im : lm, saved: Math.max(Number(lm.saved) || 0, Number(im.saved) || 0) };
    const lq = local.quotes || {}, iq = inc.quotes || {};
    if (lq.hidden || iq.hidden || lq.custom || iq.custom) {
      const custom = new Map([...iq.custom || [], ...lq.custom || []].filter((x) => x && x.id).map((x) => [x.id, x]));
      out.quotes = { ...iq, ...lq, hidden: [.../* @__PURE__ */ new Set([...lq.hidden || [], ...iq.hidden || []])], custom: [...custom.values()] };
    }
  }

  // src/js/life/journal.js
  function addThought(text, mood) {
    data.thoughts.unshift(touch({ id: lid("n"), text: String(text).slice(0, 1e3), mood: Math.max(0, Math.min(5, Number(mood) || 0)), at: Date.now() }));
    award("thought");
    persist();
    renderAll();
    checkAchievements();
    toast("Мысль сохранена — голове стало легче");
  }
  function setLowEnergy(on, silent) {
    data.lowEnergy = !!on;
    set_lowShowAll(false);
    persist();
    renderAll();
    if (!silent) toast(on ? "Бережный режим: только лёгкое и минимальные версии привычек" : "Обычный режим");
  }
  function lowFilter(list) {
    if (!data.lowEnergy || lowShowAll || !["today", "inbox"].includes(data.view)) return list;
    return list.filter((t) => t.status !== "done").sort((a, b) => a.duration - b.duration).slice(0, 3);
  }

  // src/js/life/money.js
  var spentOn = (iso) => data.expenses.filter((e) => e.type === "out" && e.date === iso).reduce((s, e) => s + e.amount, 0);
  function addExpense(c) {
    const e = touch({ id: lid("e"), type: c.kind === "income" ? "in" : "out", amount: c.amount, note: String(c.note).slice(0, 60), tag: c.tag || "", date: todayISO(), at: Date.now() });
    data.expenses.push(e);
    award("expense");
    persist();
    renderAll();
    checkAchievements();
    if (e.type === "out" && e.amount >= data.money.impulse && e.tag !== "нужно") {
      toast(`−${money(e.amount)} — больше порога импульса. Подержать в карантине ${data.money.coolHours} ч?`, "success", { label: "В карантин", onClick: () => {
        removeItem("expenses", e.id);
        addWish(e.note, e.amount);
      } });
    } else toast(e.type === "in" ? `+${money(e.amount)} записано` : `−${money(e.amount)} · осталось сегодня ${money(Math.max(0, data.money.dailyLimit - spentOn(todayISO())))}`);
  }
  function addWish(title, price) {
    const hours = price >= data.money.impulse * 3 ? Math.max(72, data.money.coolHours) : data.money.coolHours;
    data.chamber.push(touch({ id: lid("w"), title: String(title || "Хотелка").slice(0, 60), price, addedAt: Date.now(), until: Date.now() + hours * 36e5, status: "waiting" }));
    persist();
    renderAll();
    checkAchievements();
    toast(`«${title}» в карантине на ${hours} ч. Если через ${hours} ч всё ещё нужно — купишь без чувства вины.`);
  }
  function decideWish(id, decision) {
    const w = data.chamber.find((x) => x.id === id);
    if (!w || w.status !== "waiting") return;
    w.status = decision;
    w.decidedAt = Date.now();
    touch(w);
    if (decision === "released") {
      data.money.saved += w.price;
      touch(data.money);
      award("release", { amount: w.price });
      toast(`Отпущено. +${money(w.price)} в копилку осознанности ✦`);
    } else {
      data.expenses.push(touch({ id: lid("e"), type: "out", amount: w.price, note: w.title, tag: "обдуманно", date: todayISO(), at: Date.now() }));
      toast("Покупка обдумана — наслаждайся без вины");
    }
    persist();
    renderAll();
    checkAchievements();
  }
  var hoursLeft = (w) => Math.max(0, Math.ceil((w.until - Date.now()) / 36e5));

  // src/js/sound.js
  var audioContext = null;
  function syncSoundButtons() {
    const enabled = data.soundEnabled !== false;
    const btn = $("#soundBtn");
    if (btn) {
      btn.title = enabled ? "Отключить звуки" : "Включить звуки";
      btn.setAttribute("aria-pressed", String(enabled));
    }
    const settingsBtn = $("#soundSettingsBtn");
    if (settingsBtn) {
      settingsBtn.textContent = enabled ? "Звук включён" : "Звук выключен";
      settingsBtn.setAttribute("aria-pressed", String(enabled));
    }
  }
  function playSound(kind = "click") {
    if (data.soundEnabled === false) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === "suspended") audioContext.resume();
      const now = audioContext.currentTime;
      const notes = kind === "achievement" ? [{ f: 783.99, t: 0, d: 0.12 }, { f: 987.77, t: 0.07, d: 0.12 }, { f: 1174.66, t: 0.14, d: 0.16 }, { f: 1567.98, t: 0.22, d: 0.32 }] : kind === "levelup" ? [{ f: 523.25, t: 0, d: 0.14 }, { f: 659.25, t: 0.1, d: 0.14 }, { f: 783.99, t: 0.2, d: 0.14 }, { f: 1046.5, t: 0.3, d: 0.45 }, { f: 1318.5, t: 0.3, d: 0.45 }] : kind === "success" ? [{ f: 523.25, t: 0, d: 0.13 }, { f: 659.25, t: 0.09, d: 0.14 }, { f: 783.99, t: 0.18, d: 0.2 }] : kind === "timer" ? [{ f: 440, t: 0, d: 0.12 }, { f: 659.25, t: 0.08, d: 0.18 }] : [{ f: 740, t: 0, d: 0.045 }];
      notes.forEach((n) => {
        const osc = audioContext.createOscillator(), gain = audioContext.createGain();
        osc.type = kind === "click" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(n.f, now + n.t);
        gain.gain.setValueAtTime(1e-4, now + n.t);
        gain.gain.exponentialRampToValueAtTime(kind === "click" ? 0.025 : 0.045, now + n.t + 0.012);
        gain.gain.exponentialRampToValueAtTime(1e-4, now + n.t + n.d);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.02);
      });
    } catch (_) {
    }
  }
  function toggleSound() {
    data.soundEnabled = data.soundEnabled === false;
    persist();
    syncSoundButtons();
    if (data.soundEnabled) playSound("success");
  }

  // src/js/life/render.js
  var LIFE_VIEWS = { habits: ["Привычки", "Ритм, а не цепь.", "Цель — N раз в неделю. Пропуск — это пауза, а не провал. «Минимум» засчитывается полностью."], money: ["Финансы", "Деньги без тревоги.", "Один взгляд: сколько осталось на сегодня. Импульсивные покупки сначала отдыхают в карантине."], journal: ["Мысли", "Выгрузи голову.", "Пиши как есть. Без правил, без оценок. Любую мысль можно превратить в задачу."] };
  function weekDots(h) {
    const mon = mondayOf(fromISO(todayISO())), today = todayISO(), wd = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    return wd.map((n, i) => {
      const iso = toISO(addDays(mon, i)), v = h.log[iso] || 0;
      return `<button type="button" class="wd v${v}${iso === today ? " today" : ""}" data-habit-day="${h.id}" data-iso="${iso}" ${iso > today ? "disabled" : ""} title="${n}: ${v === 2 ? "сделано" : v === 1 ? "минимум" : "нет отметки"}"><span>${n}</span><i></i></button>`;
    }).join("");
  }
  function renderHabitsPage() {
    const list = data.habits.filter((h) => !h.archived);
    const cards = list.map((h) => {
      const st = habitStats(h), v = h.log[todayISO()] || 0;
      return `<article class="habit-card${h.paused ? " paused" : ""}" style="--hc:${esc(h.color)}">
      <div class="habit-top"><span class="habit-ring" style="--p:${st.pct}"><b>${st.thisWeek}/${h.target}</b></span>
        <div class="habit-info"><strong>${esc(h.name)}</strong><small>${h.paused ? "На паузе — ничего не сгорает" : h.minText ? "Минимум: " + esc(h.minText) : "Цель: " + h.target + " раз в неделю"}</small></div>
        <div class="habit-meta"><span title="Недель подряд с достигнутой целью">${ic("repeat")} ${st.streak} нед.</span><span title="Всего отметок — никогда не уменьшается">${ic("spark")} ${st.total}</span></div></div>
      <div class="week-dots">${weekDots(h)}</div>
      <div class="habit-actions">
        <button type="button" class="hbtn full${v === 2 ? " on" : ""}" data-habit-today="${h.id}" data-val="2" ${h.paused ? "disabled" : ""}>${ic("check")} Сделано</button>
        <button type="button" class="hbtn min${v === 1 ? " on" : ""}" data-habit-today="${h.id}" data-val="1" ${h.paused ? "disabled" : ""}>${ic("battery")} Минимум</button>
        <button type="button" class="hbtn ghost" data-habit-pause="${h.id}">${h.paused ? ic("play") + " Вернуть" : ic("pause") + " Пауза"}</button>
        <button type="button" class="hbtn ghost danger" data-habit-del="${h.id}" aria-label="Удалить привычку">${ic("trash")}</button></div></article>`;
    }).join("");
    return `<div class="life-grid">${cards || `<div class="empty-state"><div class="empty-icon">${ic("leaf")}</div><h3>Начни с одной привычки</h3><p>Самой маленькой. «Стакан воды», «2 минуты растяжки». Или напиши в быстром вводе <b>@вода</b>.</p></div>`}</div>
    <form class="life-form glass-lite" id="habitForm" autocomplete="off"><strong>${ic("plus")} Новая привычка</strong>
      <input class="text-field" id="habitName" maxlength="40" placeholder="Что? Например, прогулка" required>
      <input class="text-field" id="habitMin" maxlength="60" placeholder="Минимальная версия: 5 минут у подъезда">
      <select class="text-field" id="habitTarget" aria-label="Раз в неделю">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}"${n === 4 ? " selected" : ""}>${n} раз в неделю</option>`).join("")}</select>
      <button class="primary-btn" type="submit">Добавить</button></form>`;
  }
  function renderMoneyPage() {
    const m = data.money, today = todayISO(), spent = spentOn(today), left = m.dailyLimit - spent;
    const weekStart = mondayOf(fromISO(today));
    let week = 0;
    const bars = [];
    for (let i = 6; i >= 0; i--) {
      const iso = toISO(addDays(fromISO(today), -i)), v = spentOn(iso);
      bars.push({ iso, v });
    }
    for (let i = 0; i < 7; i++) week += spentOn(toISO(addDays(weekStart, i)));
    const maxBar = Math.max(m.dailyLimit, ...bars.map((b) => b.v), 1);
    const waiting = data.chamber.filter((w) => w.status === "waiting").sort((a, b) => a.until - b.until);
    const recent = [...data.expenses].sort((a, b) => b.at - a.at).slice(0, 12);
    return `<div class="money-hero glass-lite"><div><span class="eyebrow">Осталось на сегодня</span><strong class="money-big ${left < 0 ? "over" : ""}">${money(Math.max(0, left))}</strong>
      <small>${left < 0 ? `Сверх лимита на ${money(-left)}. Бывает — завтра новый день.` : `потрачено ${money(spent)} из ${money(m.dailyLimit)}`}</small>
      <div class="money-track"><i style="width:${Math.min(100, spent / Math.max(1, m.dailyLimit) * 100)}%"></i></div></div>
    <div class="money-bars">${bars.map((b) => `<div title="${esc(prettyDate(b.iso))}: ${money(b.v)}"><span style="height:${Math.max(4, b.v / maxBar * 100)}%" class="${b.v > m.dailyLimit ? "over" : ""}"></span><em>${fromISO(b.iso).toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "")}</em></div>`).join("")}<i class="limit-line" style="bottom:calc(18px + (100% - 18px) * ${(m.dailyLimit / maxBar).toFixed(3)})"></i></div></div>
    <div class="money-kpis"><div><b>${money(week)}</b><span>за неделю</span></div><div><b class="mint">${money(m.saved)}</b><span>сэкономлено карантином</span></div><div><b>${waiting.length}</b><span>в карантине</span></div></div>
    <section class="chamber glass-lite"><div class="life-sub">${ic("hourglass")}<strong>Cool-off Chamber</strong><small>Хотелка отдыхает ${m.coolHours} ч (дорогие — 72 ч). Потом решаешь спокойно.</small></div>
      ${waiting.map((w) => {
      const h = hoursLeft(w), ready = h === 0, total = Math.max(1, (w.until - w.addedAt) / 36e5);
      return `<div class="wish ${ready ? "ready" : ""}"><div class="wish-ring" style="--p:${1 - h / total}">${ready ? ic("check") : `<b>${h}ч</b>`}</div><div class="wish-info"><strong>${esc(w.title)}</strong><small>${money(w.price)} · ${ready ? "карантин окончен — всё ещё хочется?" : "ещё " + h + " ч"}</small></div><button type="button" class="hbtn ghost" data-wish="${w.id}" data-decision="released">Отпустить</button><button type="button" class="hbtn ${ready ? "full" : "ghost subtle"}" data-wish="${w.id}" data-decision="bought">${ready ? "Купить" : "Купить всё равно"}</button></div>`;
    }).join("") || '<p class="life-empty">Пусто. Напиши в быстром вводе <b>?$80 наушники</b> — и хотелка подождёт.</p>'}
    </section>
    <section class="glass-lite"><div class="life-sub">${ic("wallet")}<strong>Последние записи</strong><small>Записывай как есть: <b>-$4,5 кофе #еда</b> · <b>+$500 зарплата</b></small></div>
      <div class="exp-list">${recent.map((e) => `<div class="exp"><span class="exp-amt ${e.type}">${e.type === "in" ? "+" : "−"}${money(e.amount)}</span><span class="exp-note">${esc(e.note)}${e.tag ? ` <i>#${esc(e.tag)}</i>` : ""}</span><small>${new Date(e.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small><button type="button" class="task-action delete" data-exp-del="${e.id}" aria-label="Удалить">${ic("trash")}</button></div>`).join("") || '<p class="life-empty">Пока ни одной записи.</p>'}</div></section>
    <form class="life-form glass-lite" id="moneyForm"><strong>${ic("gear")} Настройки</strong>
      <label>Дневной лимит<input class="text-field" id="mLimit" type="number" min="0" step="1" value="${m.dailyLimit}"></label>
      <label>Порог импульса<input class="text-field" id="mImpulse" type="number" min="1" step="1" value="${m.impulse}"></label>
      <label>Карантин<select class="text-field" id="mCool">${[12, 24, 48, 72].map((h) => `<option value="${h}"${h === m.coolHours ? " selected" : ""}>${h} ч</option>`).join("")}</select></label>
      <label>Валюта<input class="text-field" id="mCur" maxlength="4" value="${esc(m.currency)}"></label>
      <button class="primary-btn" type="submit">Сохранить</button></form>`;
  }
  function renderJournalPage() {
    const groups = {};
    data.thoughts.forEach((t) => {
      const d = toISO(new Date(t.at));
      (groups[d] = groups[d] || []).push(t);
    });
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const iso = toISO(addDays(fromISO(todayISO()), -i)), ms = data.thoughts.filter((t) => t.mood && toISO(new Date(t.at)) === iso).map((t) => t.mood);
      week.push({ iso, mood: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0 });
    }
    return `<form class="journal-compose glass-lite" id="thoughtForm"><textarea class="text-field" id="thoughtText" rows="3" maxlength="1000" placeholder="Что сейчас в голове? Можно одним словом."></textarea>
      <div class="compose-row"><div class="mood-pick" id="moodPick" role="radiogroup" aria-label="Настроение (необязательно)">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" class="mood m${n}" data-mood="${n}" title="${MOODS[n]}"><i></i><span>${MOODS[n]}</span></button>`).join("")}</div>
      <button class="primary-btn" type="submit">${ic("pen")} Сохранить</button></div></form>
    <div class="mood-week glass-lite"><span class="eyebrow">Настроение за неделю</span><div>${week.map((d) => `<span class="mood-dot m${d.mood}" title="${esc(prettyDate(d.iso))}: ${d.mood ? MOODS[d.mood] : "нет записи"}"><i></i><em>${fromISO(d.iso).toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "")}</em></span>`).join("")}</div></div>
    ${Object.keys(groups).sort().reverse().map((d) => `<section class="thought-day"><h4>${d === todayISO() ? "Сегодня" : esc(prettyDate(d, { day: "numeric", month: "long", weekday: "short" }))}</h4>${groups[d].map((t) => `<article class="thought m${t.mood}"><p>${esc(t.text)}</p><footer><small>${new Date(t.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}${t.mood ? " · " + MOODS[t.mood] : ""}</small><button type="button" class="task-action" data-thought-task="${t.id}">${ic("check-circle")} В задачу</button><button type="button" class="task-action delete" data-thought-del="${t.id}" aria-label="Удалить">${ic("trash")}</button></footer></article>`).join("")}</section>`).join("") || `<div class="empty-state"><div class="empty-icon">${ic("pen")}</div><h3>Чистый лист</h3><p>Нажми <b>Q</b> и начни с <b>!</b> — мысль улетит сюда из любого места.</p></div>`}`;
  }
  function renderLifeWidget() {
    const box = $("#lwHabits");
    if (!box) return;
    const active2 = data.habits.filter((h) => !h.paused && !h.archived).slice(0, 5), today = todayISO();
    box.innerHTML = active2.length ? active2.map((h) => {
      const st = habitStats(h), v = h.log[today] || 0;
      return `<button type="button" class="lw-habit v${v}" style="--hc:${esc(h.color)};--p:${st.pct}" data-habit-today="${h.id}" data-val="${data.lowEnergy ? 1 : 2}" title="${esc(h.name)} · ${st.thisWeek}/${h.target} на неделе · клик = ${data.lowEnergy ? "минимум" : "сделано"}"><span class="lw-ring">${v ? ic("check") : esc(h.name.slice(0, 1).toUpperCase())}</span><small>${esc(h.name)}</small></button>`;
    }).join("") : `<button type="button" class="lw-empty" data-goto="habits">${ic("leaf")} Добавить первую привычку</button>`;
    const spent = spentOn(today), left = data.money.dailyLimit - spent, waiting = data.chamber.filter((w) => w.status === "waiting");
    const ready = waiting.filter((w) => hoursLeft(w) === 0).length;
    $("#lwMoney").innerHTML = `${ic("wallet")}<span><strong>${money(Math.max(0, left))}</strong> осталось сегодня${waiting.length ? ` · ${ic("hourglass")} ${waiting.length}${ready ? " (решить: " + ready + ")" : ""}` : ""}</span><i class="lw-bar"><b style="width:${Math.min(100, spent / Math.max(1, data.money.dailyLimit) * 100)}%"></b></i>`;
    const todays = data.thoughts.filter((t) => toISO(new Date(t.at)) === today);
    $("#lwJournal").innerHTML = `${ic("pen")}<span>${todays.length ? `<strong>${todays.length}</strong> ${plural(todays.length, ["мысль", "мысли", "мыслей"])} сегодня · «${esc(todays[0].text.slice(0, 38))}${todays[0].text.length > 38 ? "…" : ""}»` : "Что в голове? <kbd>Q</kbd> → <b>!мысль</b>"}</span>`;
    $("#lifeCard")?.classList.toggle("collapsed", !!data.lifeCollapsed);
    $("#lifeCollapse")?.setAttribute("aria-expanded", String(!data.lifeCollapsed));
  }
  function renderLife() {
    ensureLife();
    const view = data.view, isLife = !!LIFE_VIEWS[view];
    document.body.classList.toggle("life-view", isLife);
    document.body.classList.toggle("low-energy", !!data.lowEnergy);
    $("#lowEnergyBtn")?.setAttribute("aria-pressed", String(!!data.lowEnergy));
    const page = $("#lifePage");
    if (page) {
      page.hidden = !isLife;
      if (isLife) {
        page.dataset.page = view;
        page.innerHTML = view === "habits" ? renderHabitsPage() : view === "money" ? renderMoneyPage() : renderJournalPage();
      } else page.innerHTML = "";
    }
    if (isLife) {
      const [crumb, title, sub] = LIFE_VIEWS[view];
      $("#viewBreadcrumb").textContent = crumb;
      $("#pageTitle").textContent = title;
      $("#pageSubtitle").textContent = sub;
    } else if (data.lowEnergy && view === "today") {
      $("#pageTitle").textContent = "Бережный режим.";
      $("#pageSubtitle").textContent = "Сегодня достаточно трёх маленьких дел. Остальное подождёт — и это нормально.";
    }
    const banner = $("#lowBanner");
    if (banner) {
      banner.hidden = !(data.lowEnergy && !isLife && ["today", "inbox"].includes(view));
      $("#lowShowAll").textContent = lowShowAll ? "Только лёгкие" : "Показать все";
      $("#lowBannerText").textContent = lowShowAll ? "Бережный режим: показаны все задачи." : "Бережный режим: показаны 3 самые лёгкие задачи.";
    }
    const today = todayISO();
    const hn = $("#habitNavCount");
    if (hn) hn.textContent = `${data.habits.filter((h) => !h.paused && h.log[today]).length}/${data.habits.filter((h) => !h.paused).length}`;
    const mn = $("#moneyNavCount");
    if (mn) mn.textContent = money(Math.max(0, data.money.dailyLimit - spentOn(today))).replace(" ", " ");
    const jn = $("#journalNavCount");
    if (jn) jn.textContent = data.thoughts.filter((t) => toISO(new Date(t.at)) === today).length;
    renderLifeWidget();
  }
  function bindLife() {
    let selectedMood = 0;
    const qc = $("#quickCaptureInput"), pv = $("#qcPreview");
    qc?.addEventListener("input", () => {
      const c = classifyQuick(qc.value);
      pv.innerHTML = c ? describeQuick(c) : "";
      pv.dataset.kind = c?.kind || "";
    });
    $("#quickCapture")?.addEventListener("submit", () => setTimeout(() => {
      pv.innerHTML = "";
      pv.dataset.kind = "";
    }, 0));
    $("#lowEnergyBtn")?.addEventListener("click", () => setLowEnergy(!data.lowEnergy));
    $("#lowShowAll")?.addEventListener("click", () => {
      set_lowShowAll(!lowShowAll);
      renderAll();
    });
    $("#lifeCollapse")?.addEventListener("click", () => {
      data.lifeCollapsed = !data.lifeCollapsed;
      persist();
      renderLifeWidget();
    });
    document.addEventListener("click", (e) => {
      const go = e.target.closest("[data-goto]");
      if (go) {
        switchView(go.dataset.goto);
        return;
      }
      const ht = e.target.closest("[data-habit-today]");
      if (ht) {
        const h = data.habits.find((x) => x.id === ht.dataset.habitToday);
        if (!h) return;
        const val = Number(ht.dataset.val) || 2, cur = h.log[todayISO()] || 0;
        setHabitDay(h, todayISO(), cur === val ? 0 : val);
        playSound(cur === val ? "click" : "success");
        persist();
        renderAll();
        checkAchievements();
        return;
      }
      const hd = e.target.closest("[data-habit-day]");
      if (hd) {
        const h = data.habits.find((x) => x.id === hd.dataset.habitDay);
        if (!h) return;
        const cur = h.log[hd.dataset.iso] || 0;
        setHabitDay(h, hd.dataset.iso, cur === 0 ? 2 : cur === 2 ? 1 : 0);
        playSound("click");
        persist();
        renderAll();
        checkAchievements();
        return;
      }
      const hp = e.target.closest("[data-habit-pause]");
      if (hp) {
        const h = data.habits.find((x) => x.id === hp.dataset.habitPause);
        if (h) {
          h.paused = !h.paused;
          if (h.paused) h.pausedAt = Date.now();
          else {
            if (h.pausedAt) h.pauses = [...h.pauses || [], [h.pausedAt, Date.now()]].slice(-20);
            delete h.pausedAt;
          }
          touch(h);
          persist();
          renderAll();
          toast(h.paused ? "Привычка на паузе. Ничего не сгорает." : "С возвращением к привычке ✦");
        }
        return;
      }
      const hdl = e.target.closest("[data-habit-del]");
      if (hdl) {
        const h = data.habits.find((x) => x.id === hdl.dataset.habitDel);
        if (h && confirm(`Удалить привычку «${h.name}» и её историю? (Можно просто поставить на паузу)`)) {
          removeItem("habits", h.id);
          persist();
          renderAll();
        }
        return;
      }
      const w = e.target.closest("[data-wish]");
      if (w) {
        decideWish(w.dataset.wish, w.dataset.decision);
        return;
      }
      const ed = e.target.closest("[data-exp-del]");
      if (ed) {
        const ex = data.expenses.find((x) => x.id === ed.dataset.expDel);
        if (!ex) return;
        removeItem("expenses", ex.id);
        persist();
        renderAll();
        toast("Запись удалена", "success", { label: "Отменить", onClick: () => {
          delete data.deleted[ex.id];
          data.expenses.push(touch(ex));
          persist();
          renderAll();
        } });
        return;
      }
      const tt = e.target.closest("[data-thought-task]");
      if (tt) {
        const t = data.thoughts.find((x) => x.id === tt.dataset.thoughtTask);
        if (t) {
          quickAddTask(t.text.slice(0, 120));
          t.converted = true;
          touch(t);
          persist();
        }
        return;
      }
      const td = e.target.closest("[data-thought-del]");
      if (td) {
        const t = data.thoughts.find((x) => x.id === td.dataset.thoughtDel);
        if (!t) return;
        removeItem("thoughts", t.id);
        persist();
        renderAll();
        toast("Мысль удалена", "success", { label: "Отменить", onClick: () => {
          delete data.deleted[t.id];
          data.thoughts.push(touch(t));
          data.thoughts.sort((a, b) => b.at - a.at);
          persist();
          renderAll();
        } });
        return;
      }
      const md = e.target.closest("[data-mood]");
      if (md) {
        selectedMood = selectedMood === Number(md.dataset.mood) ? 0 : Number(md.dataset.mood);
        $$("#moodPick [data-mood]").forEach((b) => {
          const on = Number(b.dataset.mood) === selectedMood;
          b.classList.toggle("on", on);
          b.setAttribute("aria-checked", String(on));
        });
      }
    });
    document.addEventListener("submit", (e) => {
      if (e.target.id === "habitForm") {
        e.preventDefault();
        const name = $("#habitName").value.trim();
        if (!name) return;
        createHabit(name, $("#habitMin").value.trim(), Number($("#habitTarget").value) || 4);
        persist();
        renderAll();
        checkAchievements();
        toast("Привычка добавлена. Начни с минимума ✦");
      } else if (e.target.id === "moneyForm") {
        e.preventDefault();
        Object.assign(data.money, { dailyLimit: Math.max(0, num($("#mLimit").value) || 0), impulse: Math.max(1, num($("#mImpulse").value) || 30), coolHours: Number($("#mCool").value) || 24, currency: $("#mCur").value.trim().slice(0, 4) || "€" });
        touch(data.money);
        persist();
        renderAll();
        toast("Настройки финансов сохранены");
      } else if (e.target.id === "thoughtForm") {
        e.preventDefault();
        const text = $("#thoughtText").value.trim();
        if (!text) {
          $("#thoughtText").focus();
          return;
        }
        addThought(text, selectedMood);
        selectedMood = 0;
      }
    });
    setInterval(() => {
      if (data.view === "money" && !document.hidden && !$("#lifePage")?.contains(document.activeElement)) renderLife();
      else renderLifeWidget();
    }, 6e4);
  }

  // src/js/render.js
  function getViewTasks() {
    const q = ($("#searchInput")?.value || "").trim().toLocaleLowerCase("ru");
    let list = data.tasks.filter((t) => {
      if (data.view === "today") return t.date === data.selectedDate;
      if (data.view === "inbox") return t.listId === "inbox" && t.status !== "done";
      if (data.view === "upcoming") return t.status !== "done" && t.date >= todayISO();
      if (data.view === "done") return t.status === "done";
      if (String(data.view).startsWith("list:")) return t.listId === data.view.slice(5) && t.status !== "done";
      return true;
    });
    if (data.filter !== "all" && data.view !== "done") list = list.filter((t) => t.status === data.filter);
    if (q) list = list.filter((t) => `${t.title} ${t.description} ${listById(t.listId).name} ${t.steps.map((s) => s.text).join(" ")}`.toLocaleLowerCase("ru").includes(q));
    const sort = $("#sortSelect")?.value || data.sort;
    list.sort((a, b) => {
      if (sort === "priority") return b.priority - a.priority || a.createdAt - b.createdAt;
      if (sort === "created") return b.createdAt - a.createdAt;
      if (sort === "duration") return a.duration - b.duration;
      if (a.status === "inprogress" && b.status !== "inprogress") return -1;
      if (b.status === "inprogress" && a.status !== "inprogress") return 1;
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return b.priority - a.priority || a.createdAt - b.createdAt;
    });
    return lowFilter(list);
  }
  function renderCalendar() {
    const base = mondayOf(fromISO(todayISO()));
    const diffDays = Math.round((mondayOf(fromISO(data.selectedDate)) - base) / 864e5);
    data.calendarOffset = Math.floor(diffDays / 14);
    const start = addDays(base, data.calendarOffset * 14);
    const grid = $("#calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const weekday = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    for (let i = 0; i < 14; i++) {
      const d = addDays(start, i), iso = toISO(d), has = data.tasks.some((t) => t.date === iso && t.status !== "done"), b = document.createElement("button");
      b.type = "button";
      b.className = "day-cell" + (iso === data.selectedDate ? " selected" : "") + (iso === todayISO() ? " today" : "");
      b.setAttribute("aria-label", d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }));
      b.innerHTML = `<span class="day-name">${weekday[(d.getDay() + 6) % 7]}</span><span class="day-number">${d.getDate()}</span><i class="day-dot ${has ? "has-tasks" : ""}"></i>`;
      b.addEventListener("click", () => {
        data.selectedDate = iso;
        data.view = "today";
        persist();
        renderAll();
      });
      grid.appendChild(b);
    }
    $("#todayDateLabel").textContent = prettyDate(data.selectedDate, { day: "numeric", month: "long", year: "numeric" });
    $("#dateEyebrow").textContent = `ТВОЙ ДЕНЬ · ${fromISO(data.selectedDate).toLocaleDateString("ru-RU", { weekday: "long" }).toLocaleUpperCase("ru")}`;
  }
  function renderLists() {
    const nav = $("#listNav");
    if (!nav) return;
    nav.innerHTML = "";
    data.lists.forEach((l) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-item" + (data.view === `list:${l.id}` ? " active" : "");
      btn.dataset.view = `list:${l.id}`;
      btn.innerHTML = `<span class="list-swatch" style="background:${esc(l.color)}"></span><span class="nav-text">${esc(l.name)}</span><span class="nav-count">${data.tasks.filter((t) => t.listId === l.id && t.status !== "done").length}</span>`;
      btn.addEventListener("click", () => switchView(`list:${l.id}`));
      nav.appendChild(btn);
    });
    $("#inboxCount").textContent = data.tasks.filter((t) => t.listId === "inbox" && t.status !== "done").length;
  }
  function renderTask(task) {
    const list = listById(task.listId), elapsed = taskElapsed(task), isDone = task.status === "done";
    const statusText = task.status === "inprogress" ? "В процессе" : isDone ? "Готово" : "К выполнению";
    const steps = task.steps || [];
    const stepDone = steps.filter((s) => s.done).length;
    return `<article class="task-card ${isDone ? "is-done" : ""} ${task.status === "inprogress" ? "is-running" : ""}" data-task-id="${esc(task.id)}"><div class="task-main"><button type="button" class="check-task" data-action="complete" data-id="${esc(task.id)}" aria-label="${isDone ? "Вернуть задачу" : "Завершить задачу"}" aria-pressed="${isDone}">${ic("check")}</button><div class="task-content"><div class="task-title">${esc(task.title)}</div>${task.description ? `<div class="task-description">${esc(task.description)}</div>` : ""}<div class="task-meta"><span class="meta-chip priority-chip p${task.priority}">${task.priority === 3 ? ic("bolt") + " Важно" : task.priority === 2 ? "Обычно" : "Без спешки"}</span><span class="meta-chip">${ic("clock")} ${task.duration} мин</span>${elapsed > 0 ? `<span class="meta-chip">${ic("target")} ${fmtDuration(elapsed)}</span>` : ""}<span class="meta-chip task-list-chip"><i class="list-swatch" style="background:${esc(list.color)}"></i>${esc(list.name)}</span>${task.date !== todayISO() ? `<span class="meta-chip">${ic("calendar")} ${esc(prettyDate(task.date))}</span>` : ""}${task.recurrence === "daily" ? `<span class="meta-chip routine-chip">${ic("repeat")} Ежедневно</span>` : ""}${steps.length ? `<span class="meta-chip">${ic("steps")} ${stepDone}/${steps.length}</span>` : ""}${task.status === "inprogress" ? '<span class="meta-chip live-chip">Идёт</span>' : ""}</div></div></div><div class="task-actions">${!isDone ? `<button type="button" class="task-action ${task.status === "inprogress" ? "start" : ""}" data-action="start" data-id="${esc(task.id)}">${task.status === "inprogress" ? ic("pause") + " Пауза" : ic("play") + " Начать"}</button><button type="button" class="task-action finish" data-action="focus" data-id="${esc(task.id)}">${ic("target")} Фокус</button>` : ""}<button type="button" class="task-action" data-action="steps" data-id="${esc(task.id)}">${ic("steps")} Шаги${steps.length ? ` (${stepDone}/${steps.length})` : ""}</button><button type="button" class="task-action" data-action="edit" data-id="${esc(task.id)}" aria-label="Редактировать" title="Редактировать">${ic("edit")}</button><button type="button" class="task-action delete" data-action="delete" data-id="${esc(task.id)}" aria-label="Удалить" title="Удалить">${ic("trash")}</button></div>${steps.length ? `<div class="task-expand"><div class="step-progress">Микро-шаги · ${stepDone} из ${steps.length}</div><div class="task-steps">${steps.map((s, i) => `<label class="task-step ${s.done ? "done" : ""}"><input type="checkbox" data-action="step" data-id="${esc(task.id)}" data-step="${i}" ${s.done ? "checked" : ""}><span>${esc(s.text)}</span></label>`).join("")}</div></div>` : ""}</article>`;
  }
  function renderTasks() {
    const list = getViewTasks(), root2 = $("#taskList");
    if (!root2) return;
    $("#taskCountBadge").textContent = list.length;
    $("#filterAllCount").textContent = data.tasks.filter((t) => t.date === data.selectedDate && t.status !== "done").length;
    $("#filterPills").hidden = ["done", "inbox", "upcoming"].includes(data.view) || String(data.view).startsWith("list:");
    $$("#filterPills .filter-pill").forEach((b) => b.classList.toggle("active", b.dataset.filter === data.filter));
    if (!list.length) {
      const q = $("#searchInput").value.trim();
      let title = "Пока здесь тихо", text = "Добавь одну небольшую задачу — и у дня появится направление.", icon = "✳";
      if (q) {
        title = "Ничего не нашлось";
        text = "Попробуй другое слово или очисти поиск.";
        icon = "⌕";
      } else if (data.view === "done") {
        title = "Всё впереди";
        text = "Завершённые задачи появятся здесь. Не забудь замечать свои победы.";
        icon = "✓";
      } else if (data.view === "upcoming") {
        title = "План пока свободен";
        text = "Добавь задачу на будущий день или запланируй то, что давно откладывал.";
        icon = "▦";
      }
      root2.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${text}</p>${!q && data.view !== "done" ? '<button type="button" data-action="new">＋ Добавить первую задачу</button>' : ""}</div>`;
    } else root2.innerHTML = list.map(renderTask).join("");
    $("#inlineAddBtn").hidden = data.view === "done";
    const doneToday = data.tasks.filter((t) => t.status === "done" && t.completedAt && toISO(new Date(t.completedAt)) === todayISO()).length;
    const todayTasks = data.tasks.filter((t) => t.date === data.selectedDate);
    const completed = todayTasks.filter((t) => t.status === "done").length;
    const pct = todayTasks.length ? Math.round(completed / todayTasks.length * 100) : 0;
    $("#progressPercent").innerHTML = `${pct}<span>%</span>`;
    $("#progressDone").textContent = `${completed}/${todayTasks.length}`;
    $("#progressCaption").textContent = todayTasks.length ? pct === 100 ? "Ты сделал всё, что запланировал" : `${todayTasks.length - completed} задач осталось на этот день` : "Начни с одной маленькой задачи";
    $("#progressBar").style.width = pct + "%";
    $("#progressRing").style.setProperty("--p", pct / 100);
    updateDopamine(pct);
    const focusedMs = data.tasks.reduce((sum, t) => sum + taskElapsed(t), 0);
    $("#focusTotal").textContent = fmtDuration(focusedMs);
    $("#focusSessions").textContent = data.focusSessions ? `${data.focusSessions} ${plural(data.focusSessions, ["сессия", "сессии", "сессий"])} фокуса завершено` : "Начни первую сессию";
    renderActivityChart();
    $("#streakTitle").textContent = doneToday ? `Сегодня уже ${doneToday} ${plural(doneToday, ["победа", "победы", "побед"])}` : "Каждый шаг считается";
    $("#streakText").textContent = doneToday ? "Не обесценивай то, что сделал" : "Начни с одной маленькой задачи";
  }
  function renderActivityChart() {
    const root2 = $("#activityChart");
    if (!root2) return;
    const today = fromISO(todayISO());
    const tasks = Array.isArray(data && data.tasks) ? data.tasks : [];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDays(today, -i);
      const iso = toISO(date);
      const count = tasks.filter((task) => {
        if (!task || task.status !== "done") return false;
        return (task.completedForDate || task.date) === iso;
      }).length;
      days.push({ iso, label: date.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", ""), day: date.getDate(), count });
    }
    const max = Math.max(1, ...days.map((day) => day.count));
    const total = days.reduce((sum, day) => sum + day.count, 0);
    root2.innerHTML = days.map((day) => `<div class="activity-day" title="${esc(day.iso)}: ${day.count} задач"><div class="activity-bar-track"><div class="activity-bar" style="height:${Math.max(4, day.count / max * 100)}%" aria-label="${day.count} выполнено"></div></div><strong>${day.count}</strong><span>${esc(day.label)} <i>${day.day}</i></span></div>`).join("");
    root2.setAttribute("aria-label", `Активность за 7 дней, включая сегодня (${todayISO()})`);
    const totalEl = $("#activityTotal");
    if (totalEl) totalEl.textContent = `${total} ${plural(total, ["задача", "задачи", "задач"])}`;
  }
  function rollDailyRoutines() {
    if (!Array.isArray(data.tasks)) data.tasks = [];
    const today = todayISO();
    const routines = /* @__PURE__ */ new Map();
    data.tasks.filter((t) => t.recurrence === "daily").forEach((t) => {
      const key = t.routineId || t.id;
      if (!routines.has(key) || String(t.date) > String(routines.get(key).date)) routines.set(key, t);
    });
    let changed = false;
    routines.forEach((latest, routineId) => {
      const todays = data.tasks.some((t) => t.recurrence === "daily" && (t.routineId || t.id) === routineId && t.date === today);
      if (!todays && latest.date < today) {
        data.tasks.push(normalizeTask({ ...latest, id: uid(), routineId, recurrence: "daily", date: today, status: "todo", xp: 0, completedAt: null, elapsedMs: 0, timerStartedAt: null, createdAt: Date.now(), steps: (latest.steps || []).map((s) => ({ text: s.text, done: false })) }));
        changed = true;
      }
    });
    if (changed) persist();
  }
  function renderFocus() {
    if (!$("#timerDisplay")) return;
    const focused = data.tasks.find((t2) => t2.id === data.focusTaskId);
    const t = (focused && focused.status !== "done" ? focused : null) || data.tasks.find((t2) => t2.status === "inprogress") || null;
    if (focused && focused.status === "done") data.focusTaskId = null;
    if (t && t.id !== data.focusTaskId) {
      data.focusTaskId = t.id;
    }
    $("#focusTaskTitle").textContent = t ? t.title : "Выбери задачу и дай себе 10 минут.";
    $("#focusHeading").textContent = data.focusRunning ? "Ты в потоке" : t ? "Готов начать?" : "Время начать";
    $("#timerDisplay").textContent = fmtDuration(data.focusRemainingMs);
    $("#timerModeLabel").textContent = data.focusRunning ? "ФОКУС ИДЁТ" : `СПРИНТ ${data.focusMinutes} МИН`;
    $("#focusStartBtn").textContent = data.focusRunning ? "Пауза" : "Начать фокус";
    document.body.classList.toggle("focus-running", !!data.focusRunning);
    const ends = $("#timerEndsAt");
    if (ends) ends.textContent = data.focusRunning && focusDeadline ? `закончим в ${new Date(focusDeadline).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "";
    const nx = $("#focusNextStep");
    if (nx) {
      const st = t?.steps?.find((s) => !s.done);
      nx.hidden = !st;
      nx.textContent = st ? st.text : "";
    }
    $$("#timerPresets button").forEach((b) => b.classList.toggle("selected", Number(b.dataset.minutes) === data.focusMinutes));
    const total = data.focusMinutes * 6e4, pct = Math.max(0, Math.min(1, 1 - data.focusRemainingMs / total));
    $("#timerProgress").style.setProperty("--p", pct);
  }
  function renderHeader() {
    if (!$("#viewBreadcrumb") || !$("#taskSectionTitle")) return;
    const labels = { today: "Сегодня", inbox: "Входящие", upcoming: "План", done: "Сделано" };
    const isList = String(data.view).startsWith("list:");
    const title = isList ? listById(data.view.slice(5)).name : labels[data.view] || "Сегодня";
    $("#viewBreadcrumb").textContent = title;
    $("#taskSectionTitle").textContent = data.view === "today" ? data.selectedDate === todayISO() ? "На сегодня" : `На ${prettyDate(data.selectedDate, { day: "numeric", month: "short" })}` : data.view === "inbox" ? "Входящие" : data.view === "upcoming" ? "В плане" : data.view === "done" ? "Завершённые" : title;
    $("#taskSectionEyebrow").textContent = data.view === "done" ? "ТВОИ ПОБЕДЫ" : data.view === "inbox" ? "БЫСТРАЯ ЗАПИСЬ" : data.view === "upcoming" ? "СЛЕДУЮЩИЕ ДНИ" : "ТВОЙ СПИСОК";
    $("#pageTitle").textContent = data.view === "today" ? data.selectedDate === todayISO() ? "Сегодня — твой темп." : `${prettyDate(data.selectedDate, { day: "numeric", month: "long" })} — твой план.` : data.view === "inbox" ? "Всё, что пришло в голову." : data.view === "upcoming" ? "Будущее начинается с малого." : data.view === "done" ? "Посмотри, сколько уже сделано." : title;
    $("#pageSubtitle").textContent = data.view === "today" ? "Не нужно делать всё. Достаточно начать с чего-то одного." : data.view === "inbox" ? "Не сортируй прямо сейчас — просто выгрузи мысли из головы." : data.view === "upcoming" ? "План — ориентир, а не обязательство перед идеальным собой." : data.view === "done" ? "Здесь не отчёт о продуктивности, а доказательство твоих усилий." : "Собери задачи в одном спокойном месте.";
    $$(".main-nav .nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === data.view));
  }
  var renderHooks = [];
  function renderAll() {
    document.body.classList.toggle("light-theme", data.theme === "light");
    [["achievements", renderAchievements], ["header", renderHeader], ["lists", renderLists], ["calendar", renderCalendar], ["tasks", renderTasks], ["focus", renderFocus], ["heatmap", renderHeatmap], ["level", renderProgress], ["life", renderLife], ...renderHooks].forEach(([name, fn]) => {
      try {
        fn();
      } catch (err) {
        console.error(`Focusday: ошибка отрисовки блока «${name}»`, err);
      }
    });
    const energy = $("#energyLabel");
    if (energy) energy.textContent = ENERGY[data.energy] || ENERGY[3];
    $$("#energyPicks button").forEach((b) => b.classList.toggle("active", Number(b.dataset.energy) <= data.energy));
    const sort = $("#sortSelect");
    if (sort) sort.value = data.sort || "smart";
  }
  function switchView(view) {
    data.view = view;
    if (view === "today" && !validDate(data.selectedDate)) data.selectedDate = todayISO();
    data.filter = view === "done" ? "done" : "all";
    persist();
    renderAll();
    if (window.innerWidth < 920) $("#sidebar").classList.remove("open");
  }
  function toast(message, type = "success", action = null) {
    const stack = $("#toastStack");
    if (!stack) return;
    while (stack.children.length >= 4) stack.firstElementChild.remove();
    const box = document.createElement("div");
    box.className = `toast ${type}`;
    box.setAttribute("role", type === "error" ? "alert" : "status");
    const text = document.createElement("span");
    text.textContent = message;
    box.appendChild(text);
    const dismiss = () => {
      if (!box.isConnected) return;
      box.classList.add("leaving");
      setTimeout(() => box.remove(), 220);
    };
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "toast-action";
      b.textContent = action.label;
      b.onclick = () => {
        action.onClick();
        dismiss();
      };
      box.appendChild(b);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Закрыть уведомление");
    close.onclick = dismiss;
    box.appendChild(close);
    stack.appendChild(box);
    setTimeout(dismiss, action ? 6500 : 4200);
  }
  function openModal(task = null) {
    if (!$("#taskForm")) return;
    set_stepDraft(task ? (task.steps || []).map((s) => ({ ...s })) : []);
    $("#taskForm").reset();
    $("#editTaskId").value = task ? task.id : "";
    $("#modalTitle").textContent = task ? "Редактировать задачу" : "Добавить задачу";
    $("#taskTitleInput").value = task?.title || "";
    $("#taskDescriptionInput").value = task?.description || "";
    $("#taskDateInput").value = task?.date || data.selectedDate || todayISO();
    $("#taskDurationInput").value = String(task?.duration || 25);
    $("#taskPriorityInput").value = String(task?.priority || 2);
    const recurrence = $("#taskRecurrenceInput");
    if (recurrence) recurrence.value = task?.recurrence === "daily" ? "daily" : "none";
    $("#taskListInput").innerHTML = data.lists.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
    $("#taskListInput").value = task?.listId || (String(data.view).startsWith("list:") ? data.view.slice(5) : "inbox");
    renderStepDraft();
    showModal("taskModal");
    setTimeout(() => $("#taskTitleInput").focus(), 80);
  }
  var lastFocus = null;
  function showModal(id) {
    const el = $("#" + id);
    if (!el) return;
    if (!$$(".modal-backdrop:not([hidden])").length) lastFocus = document.activeElement;
    el.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(() => {
      if (!el.contains(document.activeElement)) el.querySelector("input:not([type=hidden]),select,textarea,button:not([data-close-modal])")?.focus();
    }, 60);
  }
  function closeModals() {
    const wasOpen = $$(".modal-backdrop:not([hidden])").length;
    $$(".modal-backdrop").forEach((el) => el.hidden = true);
    document.body.classList.remove("modal-open");
    if (wasOpen && lastFocus?.isConnected) lastFocus.focus();
    lastFocus = null;
  }
  function renderStepDraft() {
    const root2 = $("#stepEditor");
    root2.innerHTML = stepDraft.map((s, i) => `<div class="step-editor-item"><span>${i + 1}. ${esc(s.text)}</span><button type="button" data-remove-step="${i}" aria-label="Удалить шаг">×</button></div>`).join("");
  }
  function addDraftStep() {
    const input = $("#newStepInput"), text = input.value.trim();
    if (!text) return;
    if (stepDraft.length >= 30) {
      toast("Максимум 30 микро-шагов", "error");
      return;
    }
    stepDraft.push({ text, done: false });
    input.value = "";
    renderStepDraft();
    input.focus();
  }
  function saveTask(e) {
    e.preventDefault();
    const title = $("#taskTitleInput").value.trim();
    if (!title) {
      $("#taskTitleInput").focus();
      toast("Напиши название задачи", "error");
      return;
    }
    const date = $("#taskDateInput").value || data.selectedDate || todayISO();
    if (!validDate(date)) {
      toast("Выбери корректную дату", "error");
      return;
    }
    const id = $("#editTaskId").value;
    const existing = data.tasks.find((t) => t.id === id);
    const task = normalizeTask({ ...existing || {}, id: id || uid(), title, description: $("#taskDescriptionInput").value.trim(), date, duration: Number($("#taskDurationInput").value) || 25, priority: Number($("#taskPriorityInput").value) || 2, listId: $("#taskListInput").value || "inbox", energy: data.energy, status: existing?.status || "todo", createdAt: existing?.createdAt || Date.now(), completedAt: existing?.completedAt || null, elapsedMs: existing?.elapsedMs || 0, timerStartedAt: existing?.timerStartedAt || null, steps: stepDraft, recurrence: $("#taskRecurrenceInput")?.value === "daily" ? "daily" : "none", routineId: $("#taskRecurrenceInput")?.value === "daily" ? existing?.routineId || existing?.id || id || uid() : "" });
    if (existing) {
      Object.assign(existing, task);
    } else {
      data.tasks.push(task);
    }
    data.selectedDate = date;
    if (data.view === "done" && !existing) data.view = "today";
    if (String(data.view).startsWith("list:") && task.listId !== data.view.slice(5)) data.view = "today";
    persist();
    closeModals();
    renderAll();
    toast(existing ? "Задача обновлена" : "Задача добавлена — уже хороший шаг");
    playSound(existing ? "click" : "success");
    checkAchievements();
  }

  // src/js/adhd.js
  var lastPct = -1;
  function updateDopamine(pct) {
    const bar = $("#dopamineBar");
    if (!bar) return;
    bar.style.setProperty("--p", pct / 100);
    bar.setAttribute("aria-valuenow", pct);
    bar.classList.toggle("full", pct === 100);
    if (lastPct >= 0 && pct > lastPct) pulseDopamine();
    lastPct = pct;
  }
  function pulseDopamine() {
    const bar = $("#dopamineBar");
    if (!bar) return;
    bar.classList.remove("pulse");
    void bar.offsetWidth;
    bar.classList.add("pulse");
  }
  function setCompress(on) {
    data.compress = !!on;
    document.body.classList.toggle("compress-mode", data.compress);
    $("#compressBtn")?.setAttribute("aria-pressed", String(data.compress));
    persist();
    toast(data.compress ? "Сжатый режим: только главное и следующий шаг" : "Обычный режим");
  }
  function setFocusMode(on) {
    document.body.classList.toggle("focus-mode", !!on);
    $("#focusModeBtn")?.setAttribute("aria-pressed", String(!!on));
    $("#focusExitBtn").hidden = !on;
    if (on) {
      if (!data.focusTaskId) {
        const first = data.tasks.find((t) => t.status !== "done" && t.date === data.selectedDate) || data.tasks.find((t) => t.status !== "done");
        if (first) data.focusTaskId = first.id;
      }
      renderFocus();
      window.scrollTo({ top: 0 });
    }
  }
  function focusQuickCapture() {
    const i = $("#quickCaptureInput");
    if (!i) return;
    i.scrollIntoView({ block: "center", behavior: "smooth" });
    i.focus();
  }
  function parseQuick(raw) {
    let text = ` ${raw} `, date = data.view === "today" ? data.selectedDate : todayISO(), duration = 25, priority = 2, listId = String(data.view).startsWith("list:") ? data.view.slice(5) : "inbox";
    const days = { "сегодня": 0, "today": 0, "завтра": 1, "tomorrow": 1, "послезавтра": 2 };
    text = text.replace(/\s(сегодня|today|послезавтра|завтра|tomorrow)(?=\s)/i, (_, w) => {
      date = toISO(addDays(fromISO(todayISO()), days[w.toLowerCase()]));
      return " ";
    });
    text = text.replace(/\s(\d{1,3})\s?(м|мин|m|min)(?=\s)/i, (_, n) => {
      duration = Math.max(1, Math.min(600, Number(n)));
      return " ";
    });
    text = text.replace(/\s(\d{1,2})\s?(ч|h)(?=\s)/i, (_, n) => {
      duration = Math.min(600, Number(n) * 60);
      return " ";
    });
    text = text.replace(/\s(!{1,3})(?=\s)/, () => {
      priority = 3;
      return " ";
    });
    text = text.replace(/\s#([\p{L}\d_/-]+)(?=\s)/u, (_, tag) => {
      const l = data.lists.find((l2) => l2.name.toLocaleLowerCase("ru").replace(/\s/g, "").startsWith(tag.toLocaleLowerCase("ru")));
      if (l) listId = l.id;
      return " ";
    });
    return { title: text.replace(/\s+/g, " ").trim(), date, duration, priority, listId };
  }
  function quickAdd(raw) {
    return routeQuick(raw);
  }
  function quickAddTask(raw) {
    const p = parseQuick(raw);
    if (!p.title) return false;
    data.tasks.push(normalizeTask({ id: uid(), title: p.title, description: "", date: p.date, duration: p.duration, priority: p.priority, listId: p.listId, energy: data.energy, status: "todo", createdAt: Date.now(), steps: [] }));
    award("capture", { anchor: $("#quickCaptureInput") });
    persist();
    renderAll();
    playSound("success");
    toast(`Записано${p.date !== todayISO() ? " на " + prettyDate(p.date) : ""} — голова свободна ✦`);
    checkAchievements();
    return true;
  }
  function bindAdhd() {
    $("#compressBtn")?.addEventListener("click", () => setCompress(!data.compress));
    $("#focusModeBtn")?.addEventListener("click", () => setFocusMode(!document.body.classList.contains("focus-mode")));
    $("#focusExitBtn")?.addEventListener("click", () => setFocusMode(false));
    $("#quickCapture")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const i = $("#quickCaptureInput");
      if (quickAdd(i.value)) {
        i.value = "";
        const f = $("#quickCapture");
        f.classList.remove("bump");
        void f.offsetWidth;
        f.classList.add("bump");
      }
    });
    $(".brand")?.addEventListener("click", () => switchView("today"));
    const scrim = $("#sidebarScrim");
    const sb = $("#sidebar");
    new MutationObserver(() => {
      if (scrim) scrim.hidden = !sb.classList.contains("open");
    }).observe(sb, { attributes: true, attributeFilter: ["class"] });
    scrim?.addEventListener("click", () => sb.classList.remove("open"));
    window.focusdayDesktop?.onOverlayAction?.((action) => {
      if (action === "pause" || action === "toggle") $("#focusStartBtn").click();
      else if (action === "done") {
        const t = data.tasks.find((t2) => t2.id === data.focusTaskId);
        if (t) toggleTaskStatus(t);
      } else if (action === "quick-add") focusQuickCapture();
    });
    window.focusdayDesktop?.onQuickAdd?.((text) => {
      if (text) quickAdd(text);
      else focusQuickCapture();
    });
  }

  // src/js/life/quick.js
  var MOODS = ["", "Пусто", "Тяжело", "Ровно", "Хорошо", "Ярко"];
  var HABIT_COLORS = ["#5ef0c0", "#8f7dff", "#6cc8ff", "#ffc46b", "#ff7d96", "#e7a7e8"];
  var lowShowAll = false;
  function ensureLife() {
    if (!Array.isArray(data.habits)) data.habits = [];
    if (!Array.isArray(data.expenses)) data.expenses = [];
    if (!Array.isArray(data.chamber)) data.chamber = [];
    if (!Array.isArray(data.thoughts)) data.thoughts = [];
    const m = data.money && typeof data.money === "object" ? data.money : {};
    data.money = { currency: String(m.currency || "€").slice(0, 4), dailyLimit: Math.max(0, Number(m.dailyLimit) || 25), impulse: Math.max(1, Number(m.impulse) || 30), coolHours: [12, 24, 48, 72].includes(Number(m.coolHours)) ? Number(m.coolHours) : 24, saved: Math.max(0, Number(m.saved) || 0), updatedAt: Number(m.updatedAt) || 0 };
    data.habits.forEach((h) => {
      h.log = h.log && typeof h.log === "object" ? h.log : {};
      h.target = Math.max(1, Math.min(7, Number(h.target) || 4));
    });
  }
  var touch = (o) => {
    o.updatedAt = Date.now();
    return o;
  };
  var lid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  var money = (n) => `${(Math.round(n * 100) / 100).toLocaleString("ru-RU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${data.money.currency}`;
  var num = (s) => Math.round(parseFloat(String(s).replace(/\s/g, "").replace(",", ".")) * 100) / 100;
  function removeItem(coll, id) {
    data[coll] = data[coll].filter((x) => x.id !== id);
    data.deleted = data.deleted || {};
    data.deleted[id] = Date.now();
  }
  var MONEY_RE = /^([+\-?])\s?(?:\$|€|₽|₴)?\s?(\d+(?:[.,]\d{1,2})?)\s?(?:\$|€|₽|₴|р|грн|eur)?\s*(.*)$/i;
  function classifyQuick(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;
    if (text.startsWith("!")) return { kind: "thought", text: text.slice(1).trim() };
    if (text.startsWith("@")) {
      let body = text.slice(1).trim(), min = false;
      body = body.replace(/\s+(мин|min|минимум)$/i, () => {
        min = true;
        return "";
      }).trim();
      return body ? { kind: "habit", name: body, min } : null;
    }
    const m = text.match(MONEY_RE);
    if (m && (m[1] !== "-" || /^-\s?[$€₽₴]|^-\s?\d/.test(text))) {
      const amount = num(m[2]);
      if (!(amount > 0)) return null;
      let note = m[3].trim(), tag = "";
      note = note.replace(/(?:^|\s)#([\p{L}\d_-]+)/u, (_, t) => {
        tag = t.toLowerCase();
        return "";
      }).trim();
      const kind = m[1] === "?" ? "wish" : m[1] === "+" ? "income" : "expense";
      return { kind, amount, note: note || (kind === "income" ? "Доход" : tag || "Без описания"), tag };
    }
    return { kind: "task", ...parseQuick(text) };
  }
  function describeQuick(c) {
    if (!c) return "";
    if (c.kind === "thought") return `${ic("pen")} Мысль`;
    if (c.kind === "habit") {
      const h = findHabit(c.name);
      return `${ic("leaf")} ${h ? esc(h.name) : "Новая привычка"}${c.min ? " · минимум" : ""}`;
    }
    if (c.kind === "expense") return `${ic("wallet")} −${money(c.amount)}${c.tag ? " · #" + esc(c.tag) : ""}`;
    if (c.kind === "income") return `${ic("wallet")} +${money(c.amount)}`;
    if (c.kind === "wish") return `${ic("hourglass")} В карантин · ${money(c.amount)}`;
    const bits = [`${ic("check-circle")} Задача`];
    if (c.date !== todayISO()) bits.push(esc(prettyDate(c.date)));
    if (c.duration !== 25) bits.push(c.duration + "м");
    if (c.priority === 3) bits.push("важно");
    return bits.join(" · ");
  }
  function routeQuick(raw) {
    const c = classifyQuick(raw);
    if (!c) return false;
    if (c.kind === "task") return quickAddTask(raw);
    if (c.kind === "thought") {
      if (!c.text) return false;
      addThought(c.text, 0);
    } else if (c.kind === "habit") checkHabitByName(c.name, c.min);
    else if (c.kind === "expense" || c.kind === "income") addExpense(c);
    else if (c.kind === "wish") addWish(c.note, c.amount);
    return true;
  }
  function set_lowShowAll(v) {
    return lowShowAll = v;
  }

  // src/js/life/habits.js
  var findHabit = (name) => {
    const n = name.toLocaleLowerCase("ru");
    return data.habits.find((h) => h.name.toLocaleLowerCase("ru") === n) || data.habits.find((h) => h.name.toLocaleLowerCase("ru").startsWith(n));
  };
  function createHabit(name, minText = "", target = 4) {
    const h = touch({ id: lid("h"), name: ((s) => s.charAt(0).toLocaleUpperCase("ru") + s.slice(1))(String(name).trim().slice(0, 40)), minText: String(minText).slice(0, 60), target, color: HABIT_COLORS[data.habits.length % HABIT_COLORS.length], paused: false, createdAt: Date.now(), log: {} });
    data.habits.push(h);
    return h;
  }
  function setHabitDay(h, iso, value) {
    const prev = h.log[iso] || 0;
    if (value) h.log[iso] = value;
    else delete h.log[iso];
    touch(h);
    if (iso === todayISO() && value && !prev && h.xpDay !== iso) {
      h.xpDay = iso;
      award("habit", { min: value === 1, anchor: document.querySelector(`[data-habit-today="${h.id}"]`) });
    }
  }
  function checkHabitByName(name, min) {
    let h = findHabit(name), created = false;
    if (!h) {
      h = createHabit(name);
      created = true;
    }
    setHabitDay(h, todayISO(), min ? 1 : 2);
    persist();
    renderAll();
    checkAchievements();
    playSound("success");
    toast(created ? `Новая привычка «${h.name}» — и сразу первая отметка ✦` : `${h.name}: ${min ? "минимум засчитан — это тоже победа" : "отмечено"} ✦`);
  }
  function habitStats(h) {
    const today = fromISO(todayISO());
    let last7 = 0;
    for (let i = 0; i < 7; i++) if (h.log[toISO(addDays(today, -i))]) last7++;
    const weekCount = (monday) => {
      let c = 0;
      for (let i = 0; i < 7; i++) if (h.log[toISO(addDays(monday, i))]) c++;
      return c;
    };
    const thisMon = mondayOf(today), thisWeek = weekCount(thisMon);
    let streak = thisWeek >= h.target ? 1 : 0;
    const pauses = [...h.pauses || [], ...h.paused && h.pausedAt ? [[h.pausedAt, Date.now()]] : []];
    const pausedWeek = (mon) => {
      const a = mon.getTime() - 432e5, z = a + 7 * 864e5;
      return pauses.some(([f, t]) => f < z && t >= a);
    };
    for (let w = 1; w < 104; w++) {
      const mon = addDays(thisMon, -7 * w);
      if (weekCount(mon) >= h.target) streak++;
      else if (pausedWeek(mon)) continue;
      else break;
    }
    return { last7, thisWeek, streak, total: Object.keys(h.log).length, pct: Math.min(1, thisWeek / h.target) };
  }

  // src/js/features/vault.js
  var KDF_ITER = 6e5;
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var b64 = (buf) => {
    const a = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
    return btoa(s);
  };
  var unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  var randomSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
  async function deriveVaultKey(pass, saltB64, iter = KDF_ITER) {
    if (!pass || String(pass).length < 10) throw new Error("weak-pass");
    const base = await crypto.subtle.importKey("raw", enc.encode(String(pass).normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function sealVault(obj, key, salt, meta = {}) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode("focusday-vault-v2") }, key, enc.encode(JSON.stringify(obj)));
    return JSON.stringify({ app: "focusday-vault", v: 2, kdf: { alg: "PBKDF2-SHA256", iter: KDF_ITER, salt }, iv: b64(iv), ct: b64(ct), at: meta.at || Date.now(), device: meta.device || "" });
  }
  function vaultHeader(str) {
    try {
      const o = JSON.parse(str);
      return o && o.app === "focusday-vault" ? o : null;
    } catch (_) {
      return null;
    }
  }
  async function openVault(str, key) {
    const o = vaultHeader(str);
    if (!o) throw new Error("not-a-vault");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv), additionalData: enc.encode("focusday-vault-v2") }, key, unb64(o.ct));
    return JSON.parse(dec.decode(pt));
  }
  var mem = /* @__PURE__ */ new Map();
  function idb() {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    return new Promise((res) => {
      const r = indexedDB.open("focusday-vault", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("keys");
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
  }
  async function tx(mode2, fn) {
    const db = await idb();
    if (!db) return fn(null);
    return new Promise((res, rej) => {
      const t = db.transaction("keys", mode2), st = t.objectStore("keys");
      const r = fn(st);
      t.oncomplete = () => res(r?.result);
      t.onerror = () => rej(t.error);
    });
  }
  async function saveKey(rec) {
    mem.set("main", rec);
    try {
      await tx("readwrite", (st) => st?.put(rec, "main"));
    } catch (_) {
    }
  }
  async function loadKey() {
    if (mem.has("main")) return mem.get("main");
    try {
      const r = await tx("readonly", (st) => st?.get("main"));
      if (r) mem.set("main", r);
      return r || null;
    } catch (_) {
      return null;
    }
  }
  async function forgetKey() {
    mem.delete("main");
    try {
      await tx("readwrite", (st) => st?.delete("main"));
    } catch (_) {
    }
  }

  // src/js/sync.js
  var SYNC_FILE = "focusday_data.json";
  var CFG_KEY = "focusday.sync.v2";
  var PULL_EVERY = 3 * 6e4;
  var PUSH_DEBOUNCE = 2e4;
  function syncCfg() {
    let c;
    try {
      c = JSON.parse(storage.getItem(CFG_KEY) || "{}");
    } catch (_) {
      c = {};
    }
    c.folder = c.folder || {};
    c.cloud = c.cloud || {};
    c.seen = c.seen || {};
    return c;
  }
  function saveSyncCfg(c) {
    storage.setItem(CFG_KEY, JSON.stringify(c));
  }
  var Cloud = {
    fetch: (...a) => fetch(...a),
    base(c) {
      return String(c.cloud.url || "").replace(/\/+$/, "");
    },
    hdr(c, token) {
      return { apikey: c.cloud.anon, Authorization: `Bearer ${token || c.cloud.anon}`, "Content-Type": "application/json" };
    },
    async auth(kind, email, password) {
      const c = syncCfg();
      const url = `${this.base(c)}/auth/v1/${kind === "signup" ? "signup" : "token?grant_type=password"}`;
      const r = await this.fetch(url, { method: "POST", headers: this.hdr(c), body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error_description || j.msg || j.message || `HTTP ${r.status}`);
      if (!j.access_token) return { needConfirm: true };
      c.cloud.session = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1e3, uid: j.user?.id, email: j.user?.email || email };
      c.cloud.enabled = true;
      saveSyncCfg(c);
      return { ok: true };
    },
    async token(c) {
      const s = c.cloud.session;
      if (!s) throw new Error("no-session");
      if (Date.now() < s.exp - 6e4) return s.access;
      const r = await this.fetch(`${this.base(c)}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: this.hdr(c), body: JSON.stringify({ refresh_token: s.refresh }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) throw new Error("session-expired");
      Object.assign(s, { access: j.access_token, refresh: j.refresh_token || s.refresh, exp: Date.now() + (j.expires_in || 3600) * 1e3 });
      saveSyncCfg(c);
      return s.access;
    },
    async read(c) {
      const t = await this.token(c);
      const r = await this.fetch(`${this.base(c)}/rest/v1/vaults?select=blob,rev,updated_at&user_id=eq.${c.cloud.session.uid}`, { headers: this.hdr(c, t) });
      if (!r.ok) throw new Error(`read HTTP ${r.status}`);
      const rows = await r.json();
      return rows[0] ? { blob: rows[0].blob, rev: Number(rows[0].rev) } : null;
    },
    /** Оптимистичная блокировка: пишем только если rev не изменился. false = конфликт (кто-то успел раньше). */
    async write(c, blob, rev) {
      const t = await this.token(c), h = { ...this.hdr(c, t), Prefer: "return=representation" };
      const r = rev == null ? await this.fetch(`${this.base(c)}/rest/v1/vaults`, { method: "POST", headers: h, body: JSON.stringify({ user_id: c.cloud.session.uid, blob, rev: 1 }) }) : await this.fetch(`${this.base(c)}/rest/v1/vaults?user_id=eq.${c.cloud.session.uid}&rev=eq.${rev}`, { method: "PATCH", headers: h, body: JSON.stringify({ blob, rev: rev + 1, updated_at: (/* @__PURE__ */ new Date()).toISOString() }) });
      if (r.status === 409) return false;
      if (!r.ok) throw new Error(`write HTTP ${r.status}`);
      const rows = await r.json();
      return Array.isArray(rows) && rows.length ? Number(rows[0].rev) : false;
    }
  };
  var Folder = {
    available: () => !!window.focusdayDesktop?.syncWrite,
    read: (c) => window.focusdayDesktop.syncRead(c.folder.dir, SYNC_FILE).then((s) => s ? { blob: s } : null),
    write: (c, blob) => window.focusdayDesktop.syncWrite(c.folder.dir, SYNC_FILE, blob).then(() => true)
  };
  function cleanPayload() {
    const clean = { ...data, focusRunning: false, focusStartedAt: null };
    delete clean.sync;
    return { app: "Focusday", schema: 5, at: Date.now(), device: deviceId, data: clean };
  }
  var pendingPass = "";
  var running = false;
  var dirty = false;
  var pushTimer = null;
  var SyncEngine = {
    enabled() {
      const c = syncCfg();
      return !!(c.folder.enabled && c.folder.dir || c.cloud.enabled && c.cloud.session);
    },
    setPassphrase(p) {
      pendingPass = String(p || "");
    },
    async key(salt) {
      const k = await loadKey();
      if (k && (!salt || k.salt === salt)) return k;
      if (!pendingPass) return null;
      const rec = { salt: salt || randomSalt(), key: null };
      rec.key = await deriveVaultKey(pendingPass, rec.salt);
      return { ...rec, fresh: true };
    },
    status(text, kind = "") {
      const el = $("#syncStatus");
      if (el) {
        el.textContent = text;
        el.dataset.kind = kind;
      }
      const c = syncCfg();
      c.lastStatus = text;
      saveSyncCfg(c);
    },
    mark() {
      dirty = true;
      if (!this.enabled()) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => this.syncNow("change").catch(console.error), PUSH_DEBOUNCE);
    },
    /** Полный цикл: pull → расшифровать → слить → push (если есть что отдать). */
    async syncNow(reason = "auto") {
      if (running || !this.enabled()) return { skipped: true };
      running = true;
      const c = syncCfg();
      const result = { merged: 0, pushed: [] };
      try {
        const providers = [];
        if (c.folder.enabled && c.folder.dir && Folder.available()) providers.push(["folder", Folder]);
        if (c.cloud.enabled && c.cloud.session) providers.push(["cloud", Cloud]);
        for (const [name, p] of providers) {
          for (let attempt = 0; attempt < 3; attempt++) {
            const remote = await p.read(c);
            const head = remote ? vaultHeader(remote.blob) : null;
            const k = await this.key(head?.kdf?.salt);
            if (!k) {
              this.status("Нужен пароль синхронизации — введи его в настройках", "warn");
              return { needPass: true };
            }
            let changed = false;
            if (head) {
              let payload;
              try {
                payload = await openVault(remote.blob, k.key);
              } catch (_) {
                if (k.fresh) {
                  pendingPass = "";
                  this.status("Неверный пароль синхронизации", "error");
                  toast("Неверный пароль синхронизации", "error");
                  return { badPass: true };
                }
                await forgetKey();
                this.status("Ключ устарел — введи пароль ещё раз", "warn");
                return { needPass: true };
              }
              if (k.fresh) {
                await saveKey({ salt: k.salt, key: k.key });
                pendingPass = "";
              }
              if (payload.device !== deviceId || (payload.at || 0) > (c.seen[name] || 0)) {
                const { merged, stats } = mergeData(data, payload.data);
                const n = stats.added + stats.updated + stats.removed + (stats.lifeAdded || 0) + (stats.lifeUpdated || 0);
                if (n) {
                  set_data(merged);
                  rebaseline();
                  persistNow(true);
                  renderAll();
                  renderProgress();
                  result.merged += n;
                  changed = true;
                }
              }
              c.seen[name] = payload.at || Date.now();
            } else if (k.fresh) {
              await saveKey({ salt: k.salt, key: k.key });
              pendingPass = "";
            }
            if (!head || dirty || changed || reason === "manual") {
              const pl = cleanPayload();
              const blob = await sealVault(pl, k.key, k.salt, { at: pl.at, device: deviceId });
              const ok = await p.write(c, blob, remote?.rev ?? null);
              if (ok === false) continue;
              c.seen[name] = pl.at;
              result.pushed.push(name);
            }
            break;
          }
        }
        dirty = false;
        c.lastSyncAt = Date.now();
        saveSyncCfg(c);
        const where = providers.map(([n]) => n === "folder" ? "папка" : "облако").join(" + ");
        this.status(`${where} · ${(/* @__PURE__ */ new Date()).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}${result.merged ? ` · получено изменений: ${result.merged}` : ""} · 🔒 E2E`, "ok");
        if (result.merged && reason !== "manual") toast(`Синхронизировано: ${result.merged} изменений с другого устройства`);
        return result;
      } catch (e) {
        this.status(`Синхронизация не удалась: ${e.message === "session-expired" ? "войди в облако заново" : e.message}`, "error");
        return { error: e.message };
      } finally {
        running = false;
      }
    },
    disconnect() {
      const c = syncCfg();
      c.folder = {};
      c.cloud = {};
      c.seen = {};
      saveSyncCfg(c);
      forgetKey();
      this.status("Синхронизация выключена");
    },
    start() {
      if (data.sync?.dir) {
        const c = syncCfg();
        if (!c.folder.dir) {
          c.folder = { enabled: true, dir: data.sync.dir };
          saveSyncCfg(c);
        }
        delete data.sync;
      }
      if (!this.enabled()) return;
      setTimeout(() => this.syncNow("start").catch(console.error), 1500);
      setInterval(() => {
        if (!document.hidden) this.syncNow("timer").catch(console.error);
      }, PULL_EVERY);
      window.addEventListener("focus", () => {
        if (Date.now() - (syncCfg().lastSyncAt || 0) > 6e4) this.syncNow("focus").catch(console.error);
      });
    }
  };
  var Sync = {
    available: () => true,
    setup: () => {
      $("#syncGroup")?.setAttribute("open", "");
      $("#vaultPass")?.focus();
    },
    pull: () => SyncEngine.syncNow("focus"),
    push: () => SyncEngine.syncNow("manual"),
    schedule: () => SyncEngine.mark(),
    status: () => {
      const c = syncCfg();
      if (c.lastStatus) SyncEngine.status(c.lastStatus);
    }
  };
  function bindSyncUI() {
    const c = syncCfg();
    if ($("#cloudUrl")) {
      $("#cloudUrl").value = c.cloud.url || "";
      $("#cloudAnon").value = c.cloud.anon || "";
      $("#cloudEmail").value = c.cloud.session?.email || "";
    }
    const fb = $("#folderPickBtn");
    if (fb) {
      fb.disabled = !Folder.available();
      fb.title = Folder.available() ? "" : "Папка доступна в EXE-версии. В браузере и на телефоне — облако.";
    }
    const paint4 = () => {
      const c2 = syncCfg();
      const f = $("#folderInfo");
      if (f) f.textContent = c2.folder.dir ? c2.folder.dir : Folder.available() ? "не выбрана" : "только в EXE-версии";
      const ci = $("#cloudInfo");
      if (ci) ci.textContent = c2.cloud.session ? `вошли как ${c2.cloud.session.email}` : "не подключено";
      if (c2.lastStatus) SyncEngine.status(c2.lastStatus);
    };
    const takePass = () => {
      const p = $("#vaultPass")?.value || "";
      if (p) {
        if (p.length < 10) {
          toast("Пароль синхронизации — минимум 10 символов", "error");
          return false;
        }
        SyncEngine.setPassphrase(p);
        $("#vaultPass").value = "";
      }
      return true;
    };
    $("#folderPickBtn")?.addEventListener("click", async () => {
      if (!takePass()) return;
      const dir = await window.focusdayDesktop?.pickFolder?.();
      if (!dir) return;
      const c2 = syncCfg();
      c2.folder = { enabled: true, dir };
      saveSyncCfg(c2);
      paint4();
      await SyncEngine.syncNow("manual");
      paint4();
    });
    const login = async (kind) => {
      if (!takePass()) return;
      const c2 = syncCfg();
      c2.cloud.url = $("#cloudUrl").value.trim();
      c2.cloud.anon = $("#cloudAnon").value.trim();
      saveSyncCfg(c2);
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c2.cloud.url.replace(/\/+$/, "")) && !/^https?:\/\/localhost/.test(c2.cloud.url)) {
        toast("Адрес вида https://xxxx.supabase.co", "error");
        return;
      }
      try {
        const r = await Cloud.auth(kind, $("#cloudEmail").value.trim(), $("#cloudPassword").value);
        $("#cloudPassword").value = "";
        if (r.needConfirm) {
          toast("Подтверди почту по ссылке из письма и нажми «Войти»");
          return;
        }
        paint4();
        await SyncEngine.syncNow("manual");
        paint4();
        toast("Облако подключено · данные шифруются на устройстве");
      } catch (e) {
        toast(`Облако: ${e.message}`, "error");
      }
    };
    $("#cloudLoginBtn")?.addEventListener("click", () => login("login"));
    $("#cloudSignupBtn")?.addEventListener("click", () => login("signup"));
    $("#syncNowBtn")?.addEventListener("click", async () => {
      if (!takePass()) return;
      if (!SyncEngine.enabled()) {
        toast("Сначала выбери папку или подключи облако", "error");
        return;
      }
      await SyncEngine.syncNow("manual");
      paint4();
    });
    $("#syncOffBtn")?.addEventListener("click", () => {
      if (confirm("Отключить синхронизацию на этом устройстве? Локальные данные останутся.")) {
        SyncEngine.disconnect();
        paint4();
      }
    });
    paint4();
  }

  // src/js/progress.js
  var xpForLevel = (lvl) => Math.round(60 * Math.pow(lvl, 1.4));
  var TITLES = [[1, "Искра"], [3, "Исследователь"], [5, "Ученик ритма"], [8, "Мастер микро-шагов"], [12, "Хранитель фокуса"], [16, "Архитектор дня"], [20, "Легенда возвращений"]];
  var RARITY = { common: { label: "Обычное", xp: 15 }, rare: { label: "Редкое", xp: 40 }, epic: { label: "Эпическое", xp: 90 }, legendary: { label: "Легендарное", xp: 200 } };
  function levelInfo(xp = data.xp || 0) {
    let lvl = 1, rest = xp;
    while (rest >= xpForLevel(lvl)) {
      rest -= xpForLevel(lvl);
      lvl++;
    }
    const title = TITLES.filter(([l]) => lvl >= l).pop()[1];
    return { lvl, rest, need: xpForLevel(lvl), title };
  }
  function S() {
    if (!data.stats || typeof data.stats !== "object") data.stats = {};
    const s = data.stats;
    s.activeDays = s.activeDays || {};
    s.recentDone = Array.isArray(s.recentDone) ? s.recentDone : [];
    ["tasksDone", "stepsDone", "focusMin", "captures", "returns", "softReturns", "nightWins", "lowEnergyWins", "guiltFree", "weekendWins", "resumes", "maxCombo", "habitChecks", "minChecks", "thoughts", "expensesLogged", "released", "lowModeWins", "softMoves", "catBreaks", "paletteRuns"].forEach((k) => {
      s[k] = Number(s[k]) || 0;
    });
    return s;
  }
  var daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);
  function bumpDay(n = 1) {
    const s = S(), d = todayISO();
    s.activeDays[d] = (s.activeDays[d] || 0) + n;
    const keys = Object.keys(s.activeDays).sort();
    while (keys.length > 400) delete s.activeDays[keys.shift()];
  }
  function registerVisit() {
    const s = S(), today = todayISO(), last = s.lastVisitDay;
    if (last && last < today) {
      const gap = daysBetween(last, today);
      if (gap >= 3) {
        s.returns++;
        s.comebackDay = today;
        gainXP(30, null, "Бонус возвращения");
        setTimeout(() => toast(`С возвращением! ${gap} дн. перерыва — не провал, а пауза. Первая задача сегодня даст ×2 XP ✦`), 900);
      } else if (gap >= 1) s.softReturns++;
    }
    s.lastVisitDay = today;
    if (!s.activeDays[today]) s.activeDays[today] = 0;
  }
  function gainXP(amount, anchor, label) {
    if (!amount) return;
    const before = levelInfo().lvl;
    data.xp = (Number(data.xp) || 0) + amount;
    floatXP(amount, anchor, label);
    const after = levelInfo();
    if (after.lvl > before) setTimeout(() => showLevelUp(after), 700);
    renderProgress();
  }
  function award(event, p = {}) {
    const s = S();
    let xp = 0;
    const now = Date.now();
    if (event === "task") {
      const t = p.task;
      if (t.xp) return;
      s.tasksDone++;
      bumpDay(2);
      const h = (/* @__PURE__ */ new Date()).getHours();
      if (h >= 22 || h < 5) s.nightWins++;
      if (data.energy <= 2) s.lowEnergyWins++;
      if (data.lowEnergy) s.lowModeWins++;
      if (t.date < todayISO()) s.guiltFree++;
      if ([0, 6].includes((/* @__PURE__ */ new Date()).getDay())) s.weekendWins++;
      s.recentDone = [...s.recentDone.filter((x) => now - x < 36e5), now];
      s.maxCombo = Math.max(s.maxCombo, s.recentDone.length);
      if (!t.xp) {
        xp = 10 + (t.priority === 3 ? 5 : 0) + Math.min(10, Math.round(t.duration / 10)) + (t.steps?.length ? 3 : 0);
        if (s.comebackDay === todayISO()) {
          xp *= 2;
          s.comebackDay = null;
        }
        if (s.recentDone.length >= 3) xp += 5;
        t.xp = xp;
      }
    } else if (event === "step") {
      const st = p.step;
      s.stepsDone++;
      bumpDay(1);
      if (!st.x) {
        st.x = 1;
        xp = 3;
      }
    } else if (event === "focus") {
      s.focusMin += p.minutes;
      bumpDay(2);
      xp = Math.round(p.minutes * 0.6);
    } else if (event === "capture") {
      s.captures++;
      bumpDay(1);
      const today = todayISO();
      s.capDay = s.capDay === today ? s.capDay : today;
      s.capToday = s.capDay === today ? (s.capToday || 0) + 1 : 1;
      if (s.capToday <= 10) xp = 1;
    } else if (event === "resume") {
      s.resumes++;
    } else if (event === "habit") {
      s.habitChecks++;
      if (p.min) s.minChecks++;
      bumpDay(1);
      xp = 4;
    } else if (event === "thought") {
      s.thoughts++;
      bumpDay(1);
      const d = todayISO();
      s.thDay === d ? s.thToday++ : (s.thDay = d, s.thToday = 1);
      if (s.thToday <= 5) xp = 2;
    } else if (event === "expense") {
      s.expensesLogged++;
      const d = todayISO();
      s.exDay === d ? s.exToday++ : (s.exDay = d, s.exToday = 1);
      if (s.exToday <= 5) xp = 1;
    } else if (event === "release") {
      s.released++;
      bumpDay(1);
      xp = 10;
    } else if (event === "softmove") {
      s.softMoves++;
      const d = todayISO();
      if (s.softDay !== d) {
        s.softDay = d;
        xp = 5;
      }
    } else if (event === "catbreak") {
      s.catBreaks++;
      const d = todayISO();
      s.cbDay === d ? s.cbToday++ : (s.cbDay = d, s.cbToday = 1);
      if (s.cbToday <= 3) xp = 3;
    }
    if (xp) gainXP(xp, p.anchor);
    renderHeatmap();
  }
  var ACHIEVEMENTS = [
    // ── Возвращение (ядро СДВГ-дизайна)
    { id: "comeback", icon: "flame", rarity: "epic", title: "Возвращение легенды", desc: "Вернись в Focusday после перерыва 3+ дня", test: (s) => s.returns >= 1 },
    { id: "phoenix", icon: "crown", rarity: "legendary", title: "Феникс", desc: "Вернись после перерыва 5 раз. Каждое возвращение — сила", test: (s) => s.returns >= 5, progress: (s) => [s.returns, 5] },
    { id: "again", icon: "history", rarity: "common", title: "Снова здесь", desc: "Открой приложение на следующий день или позже", test: (s) => s.softReturns + s.returns >= 1 },
    { id: "rhythm", icon: "wave", rarity: "rare", title: "Ритм, а не цепь", desc: "4 активных дня из любых 7 — без требований «подряд»", test: (s) => activeInLast(7) >= 4, progress: () => [activeInLast(7), 4] },
    // ── Микро-шаги
    { id: "micro1", icon: "dot", rarity: "common", title: "Микро-победа", desc: "Отметь хотя бы 1 микро-шаг. Начало засчитано", test: (s) => s.stepsDone >= 1 },
    { id: "split", icon: "scissors", rarity: "common", title: "Дробитель", desc: "Разбей задачу на 3+ микро-шага", test: () => data.tasks.some((t) => t.steps.length >= 3) },
    { id: "micro", icon: "steps", rarity: "rare", title: "Мастер маленьких шагов", desc: "Выполни 25 микро-шагов", test: (s) => s.stepsDone >= 25, progress: (s) => [s.stepsDone, 25] },
    { id: "architect", icon: "home", rarity: "rare", title: "Архитектор", desc: "Заверши все микро-шаги одной задачи", test: () => data.tasks.some((t) => t.status === "done" && t.steps.length > 0 && t.steps.every((x) => x.done)) },
    // ── Задачи без давления
    { id: "first", icon: "spark", rarity: "common", title: "Первая победа", desc: "Заверши первую задачу", test: (s) => s.tasksDone >= 1 || data.tasks.some((t) => t.status === "done") },
    { id: "ten", icon: "star", rarity: "common", title: "Десять шагов", desc: "Заверши 10 задач", test: () => doneCount() >= 10, progress: () => [doneCount(), 10] },
    { id: "century", icon: "hundred", rarity: "epic", title: "Сотня", desc: "Заверши 100 задач — в любом темпе", test: () => doneCount() >= 100, progress: () => [doneCount(), 100] },
    { id: "guilt", icon: "feather", rarity: "rare", title: "Без чувства вины", desc: "Закрой просроченную задачу. Поздно — лучше, чем никогда", test: (s) => s.guiltFree >= 1 },
    { id: "lowbat", icon: "battery", rarity: "rare", title: "Честный заряд", desc: "Сделай задачу в день, когда энергия на минимуме", test: (s) => s.lowEnergyWins >= 1 },
    { id: "combo", icon: "bolt", rarity: "rare", title: "Комбо ×3", desc: "3 задачи в пределах одного часа", test: (s) => s.maxCombo >= 3 },
    { id: "day", icon: "sun", rarity: "rare", title: "Ритм дня", desc: "Выполни все задачи на сегодня", test: () => {
      const a = data.tasks.filter((t) => t.date === todayISO());
      return a.length > 0 && a.every((t) => t.status === "done");
    } },
    // ── Время суток
    { id: "nightowl", icon: "moon", rarity: "common", title: "Ночной дозор", desc: "Заверши задачу после 22:00", test: (s) => s.nightWins >= 1 },
    { id: "earlybird", icon: "sun", rarity: "common", title: "Ранняя пташка", desc: "Заверши задачу с 05:00 до 07:59", test: () => data.tasks.some((t) => t.completedAt && new Date(t.completedAt).getHours() >= 5 && new Date(t.completedAt).getHours() < 8) },
    { id: "weekend", icon: "coffee", rarity: "common", title: "Мягкие выходные", desc: "Сделай что-то маленькое в выходной", test: (s) => s.weekendWins >= 1 },
    // ── Фокус
    { id: "flow", icon: "target", rarity: "common", title: "В потоке", desc: "Заверши 5 фокус-сессий (даже по 10 минут)", test: () => data.focusSessions >= 5, progress: () => [data.focusSessions, 5] },
    { id: "master", icon: "trophy", rarity: "epic", title: "Железный фокус", desc: "Заверши 25 фокус-сессий", test: () => data.focusSessions >= 25, progress: () => [data.focusSessions, 25] },
    { id: "resume", icon: "play", rarity: "common", title: "Перезапуск", desc: "Поставь задачу на паузу и вернись к ней", test: (s) => s.resumes >= 1 },
    // ── Организация
    { id: "brain", icon: "brain", rarity: "common", title: "Разгрузка головы", desc: "10 быстрых захватов мыслей (Q)", test: (s) => s.captures >= 10, progress: (s) => [s.captures, 10] },
    { id: "routine", icon: "repeat", rarity: "common", title: "Ритм без пауз", desc: "Создай ежедневную рутину", test: () => data.tasks.some((t) => t.recurrence === "daily") },
    { id: "organizer", icon: "layout", rarity: "rare", title: "Архивариус", desc: "Создай 5 своих списков", test: () => data.lists.filter((l) => !LISTS.some((d) => d.id === l.id)).length >= 5 },
    { id: "safe", icon: "shield", rarity: "common", title: "Подушка безопасности", desc: "Сделай первый бэкап", test: () => !!data.lastBackupAt },
    // ── Секретные
    { id: "secret_lvl10", icon: "crown", rarity: "legendary", hidden: true, title: "Свой темп", desc: "Достигни 10 уровня", test: () => levelInfo().lvl >= 10 }
  ];
  var doneCount = () => Math.max(S().tasksDone, data.tasks.filter((t) => t.status === "done").length);
  function activeInLast(n) {
    const s = S();
    let c = 0;
    for (let i = 0; i < n; i++) {
      if ((s.activeDays[toISO(addDays(/* @__PURE__ */ new Date(), -i))] || 0) > 0) c++;
    }
    return c;
  }
  var achQueue = [];
  var achShowing = false;
  function checkAchievements() {
    if (!Array.isArray(data.achievements)) data.achievements = [];
    if (!data.achievementDates) data.achievementDates = {};
    const s = S();
    let changed = false;
    ACHIEVEMENTS.forEach((a) => {
      if (data.achievements.includes(a.id)) return;
      let ok = false;
      try {
        ok = a.test(s);
      } catch (_) {
      }
      if (!ok) return;
      data.achievements.push(a.id);
      data.achievementDates[a.id] = Date.now();
      changed = true;
      achQueue.push(a);
      data.xp = (Number(data.xp) || 0) + RARITY[a.rarity].xp;
    });
    if (changed) {
      persist();
      renderAchievements();
      renderProgress();
      pumpAch();
    }
  }
  function pumpAch() {
    if (achShowing || !achQueue.length) return;
    const a = achQueue.shift(), r = RARITY[a.rarity], layer = $("#achLayer");
    if (!layer) return;
    achShowing = true;
    playSound(a.rarity === "legendary" || a.rarity === "epic" ? "levelup" : "achievement");
    const card = document.createElement("div");
    card.className = `ach-pop r-${a.rarity}`;
    card.innerHTML = `<div class="ach-pop-icon">${ic(a.icon)}</div><div class="ach-pop-body"><small>Достижение открыто · ${r.label}</small><strong>${esc(a.title)}</strong><p>${esc(a.desc)}</p></div><div class="ach-pop-xp">+${r.xp}<small>XP</small></div>`;
    card.addEventListener("click", () => {
      closeModals();
      renderAchievements();
      showModal("achievementsModal");
    });
    layer.appendChild(card);
    setTimeout(() => {
      card.classList.add("leaving");
      setTimeout(() => {
        card.remove();
        achShowing = false;
        pumpAch();
      }, 380);
    }, 4600);
  }
  function renderAchievements() {
    const grid = $("#achievementGrid");
    if (!grid) return;
    const earned = new Set(data.achievements || []), s = S(), li = levelInfo();
    const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
    const list = [...ACHIEVEMENTS].sort((a, b) => earned.has(b.id) - earned.has(a.id) || order[a.rarity] - order[b.rarity]);
    grid.innerHTML = list.map((a) => {
      const got = earned.has(a.id), secret = a.hidden && !got;
      let prog = "";
      if (!got && a.progress) {
        const [v, max] = a.progress(s);
        prog = `<span class="ach-prog"><i style="width:${Math.min(100, v / max * 100)}%"></i></span><em>${Math.min(v, max)}/${max}</em>`;
      }
      const date = got && data.achievementDates?.[a.id] ? new Date(data.achievementDates[a.id]).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";
      return `<article class="achievement-card r-${a.rarity} ${got ? "earned" : "locked"}"><span class="achievement-icon">${secret ? "?" : ic(a.icon)}</span><div><strong>${secret ? "Секретное достижение" : esc(a.title)}</strong><p>${secret ? "Продолжай в своём темпе — оно откроется само" : esc(a.desc)}</p>${prog}</div><span class="achievement-state"><b>${RARITY[a.rarity].label}</b>${got ? `<small>${date}</small>` : `<small>+${RARITY[a.rarity].xp} XP</small>`}</span></article>`;
    }).join("");
    const sum = $("#achSummary");
    if (sum) sum.innerHTML = `<div class="ach-lvl"><span class="level-ring big" style="--p:${li.rest / li.need}"><b>${li.lvl}</b></span><div><strong>${li.title}</strong><small>${li.rest} / ${li.need} XP до уровня ${li.lvl + 1} · всего ${data.xp || 0} XP</small></div></div><div class="ach-stats"><div><b>${earned.size}/${ACHIEVEMENTS.length}</b><span>достижений</span></div><div><b>${s.returns + s.softReturns}</b><span>возвращений</span></div><div><b>${s.stepsDone}</b><span>микро-шагов</span></div><div><b>${activeInLast(30)}</b><span>дней из 30</span></div></div>`;
    const count = $("#achievementCount");
    if (count) count.textContent = earned.size;
  }
  function renderProgress() {
    const li = levelInfo();
    const n = $("#levelNum");
    if (!n) return;
    n.textContent = li.lvl;
    $("#levelTitle").textContent = li.title;
    $("#levelXp").textContent = `${li.rest} / ${li.need} XP`;
    $("#xpBar").style.width = `${li.rest / li.need * 100}%`;
    $("#levelRing").style.setProperty("--p", li.rest / li.need);
  }
  function floatXP(amount, anchor, label) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = document.createElement("span");
    el.className = "xp-float";
    el.textContent = `+${amount} XP${label ? " · " + label : ""}`;
    const r = anchor && anchor.getBoundingClientRect?.() || $("#levelCard")?.getBoundingClientRect() || { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    el.style.left = `${r.left + (r.width || 0) / 2}px`;
    el.style.top = `${r.top}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
    const card = $("#levelCard");
    card?.classList.remove("gain");
    void card?.offsetWidth;
    card?.classList.add("gain");
  }
  function showLevelUp(li) {
    const box = $("#levelUp");
    if (!box) return;
    playSound("levelup");
    box.innerHTML = `<div class="levelup-card"><div class="levelup-glow"></div><small>Новый уровень</small><div class="levelup-num">${li.lvl}</div><strong>${li.title}</strong><p>Не за идеальность — за то, что ты возвращаешься.</p></div>`;
    box.hidden = false;
    const close = () => {
      box.hidden = true;
    };
    box.onclick = close;
    setTimeout(close, 3800);
    const card = box.querySelector(".levelup-card").getBoundingClientRect();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) for (let i = 0; i < 28; i++) {
      const b = document.createElement("i");
      b.className = "reward-particle";
      b.style.left = `${innerWidth / 2}px`;
      b.style.top = `${innerHeight / 2}px`;
      b.style.setProperty("--dx", `${(Math.random() - 0.5) * 520}px`);
      b.style.setProperty("--dy", `${(Math.random() - 0.6) * 420}px`);
      b.style.setProperty("--turn", `${Math.random() * 600}deg`);
      b.style.background = ["var(--accent)", "var(--mint)", "var(--amber)", "var(--rose)", "var(--sky)"][i % 5];
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 900);
    }
  }
  function renderHeatmap() {
    const root2 = $("#heatmap");
    if (!root2) return;
    const s = S(), weeks = 52, end = mondayOf(/* @__PURE__ */ new Date()), start = addDays(end, -(weeks - 1) * 7);
    const counts = { ...s.activeDays };
    data.tasks.forEach((t) => {
      if (t.completedAt) {
        const d = toISO(new Date(t.completedAt));
        counts[d] = Math.max(counts[d] || 0, 1);
      }
    });
    const vals = Object.values(counts).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p) => vals[Math.floor(p * (vals.length - 1))] || 1;
    const lv = (v) => !v ? 0 : v <= q(0.25) ? 1 : v <= q(0.5) ? 2 : v <= q(0.8) ? 3 : 4;
    const today = todayISO();
    let html = "";
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d), iso = toISO(date), v = counts[iso] || 0, future = iso > today;
      html += `<i class="l${future ? "x" : lv(v)}${iso === today ? " today" : ""}" style="grid-column:${w + 1};grid-row:${d + 1}" title="${date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}: ${v} действий"></i>`;
    }
    root2.innerHTML = html;
    const sum = $("#heatmapSummary");
    if (sum) sum.textContent = `${activeInLast(30)} активных дней из 30 — без давления «подряд»`;
  }
  function bindProgress() {
    $("#levelCard")?.addEventListener("click", () => {
      renderAchievements();
      showModal("achievementsModal");
    });
    $("#exportEncBtn")?.addEventListener("click", exportEncrypted);
    $("#importMergeBtn")?.addEventListener("click", () => confirmImport("merge"));
    $("#importReplaceBtn")?.addEventListener("click", () => {
      if (confirm("Заменить ВСЕ текущие данные содержимым файла? (точка восстановления будет создана)")) confirmImport("replace");
    });
    $("#snapshotRestoreBtn")?.addEventListener("click", () => {
      const i = $("#snapshotSelect").value;
      const snap = getSnaps()[Number(i)];
      if (i === "" || !snap) {
        toast("Выбери точку восстановления", "error");
        return;
      }
      if (!confirm("Откатить данные к выбранной точке? Текущее состояние тоже сохранится как точка.")) return;
      snapshot("Перед откатом");
      applyData(snap.data, "Данные восстановлены из точки");
    });
  }
  function initProgress() {
    S();
    if (typeof data.xp !== "number") data.xp = 0;
    if (!data.xpMigrated) {
      data.tasks.forEach((t) => {
        if (t.status === "done" && !t.xp) {
          t.xp = 10;
          data.xp += 10;
        }
      });
      data.stats.tasksDone = Math.max(data.stats.tasksDone, data.tasks.filter((t) => t.status === "done").length);
      data.xpMigrated = true;
    }
    registerVisit();
    rebaseline();
    dailySnapshot();
    renderSnapshots();
    renderProgress();
    renderHeatmap();
    Sync.status();
  }
  ACHIEVEMENTS.push(
    { id: "habit1", icon: "leaf", rarity: "common", title: "Первое зерно", desc: "Отметь привычку в первый раз", test: (s) => s.habitChecks >= 1 },
    { id: "minwin", icon: "battery", rarity: "rare", title: "Минимум засчитан", desc: "Сделай минимальную версию привычки. Это полноценная победа", test: (s) => s.minChecks >= 1 },
    { id: "habitweek", icon: "repeat", rarity: "rare", title: "Ритм недели", desc: "Достигни недельной цели привычки", test: () => (data.habits || []).some((h) => h.log && habitStats(h).thisWeek >= h.target) },
    { id: "garden", icon: "leaf", rarity: "epic", title: "Сад привычек", desc: "50 отметок привычек в любом темпе", test: (s) => s.habitChecks >= 50, progress: (s) => [s.habitChecks, 50] },
    { id: "coolhead", icon: "hourglass", rarity: "rare", title: "Холодная голова", desc: "Отпусти хотелку из карантина", test: (s) => s.released >= 1 },
    { id: "mindful", icon: "wallet", rarity: "common", title: "Осознанные деньги", desc: "Запиши 7 трат или доходов", test: (s) => s.expensesLogged >= 7, progress: (s) => [s.expensesLogged, 7] },
    { id: "dump", icon: "pen", rarity: "common", title: "Выгрузка мыслей", desc: "Запиши 10 мыслей в дневник", test: (s) => s.thoughts >= 10, progress: (s) => [s.thoughts, 10] },
    { id: "gentleplan", icon: "moon", rarity: "rare", title: "Бережный план", desc: "Сделай «Мягкий перенос» — перенести тоже значит спланировать", test: (s) => s.softMoves >= 1 },
    { id: "honestbreak", icon: "coffee", rarity: "common", title: "Честный перерыв", desc: "Возьми паузу по подсказке котика-напарника", test: (s) => s.catBreaks >= 1 },
    { id: "commander", icon: "bolt", rarity: "rare", title: "Командный центр", desc: "Выполни 10 команд из палитры Ctrl+K", test: (s) => s.paletteRuns >= 10, progress: (s) => [Math.min(10, s.paletteRuns), 10] },
    { id: "kind", icon: "heart", rarity: "rare", title: "Бережность к себе", desc: "Сделай задачу в бережном режиме", test: (s) => s.lowModeWins >= 1 }
  );

  // src/js/backup.js
  var SCHEMA = 5;
  var SNAP_KEY = "focusday.snapshots.v1";
  var DEVICE_KEY = "focusday.device";
  var deviceId = storage.getItem(DEVICE_KEY) || (() => {
    const id = "dev_" + uid().slice(2);
    storage.setItem(DEVICE_KEY, id);
    return id;
  })();
  var taskHashes = /* @__PURE__ */ new Map();
  var taskKey = (t) => {
    const { updatedAt, timerStartedAt, ...rest } = t;
    return JSON.stringify(rest);
  };
  var tracking = false;
  function rebaseline() {
    tracking = true;
    taskHashes = new Map(data.tasks.map((t) => [t.id, taskKey(t)]));
  }
  function trackChanges() {
    if (!tracking) return;
    const now = Date.now(), seen = /* @__PURE__ */ new Set();
    if (!data.deleted || typeof data.deleted !== "object") data.deleted = {};
    data.tasks.forEach((t) => {
      seen.add(t.id);
      const k = taskKey(t);
      if (taskHashes.get(t.id) !== k) {
        t.updatedAt = now;
        taskHashes.set(t.id, k);
      }
    });
    taskHashes.forEach((_, id) => {
      if (!seen.has(id)) {
        data.deleted[id] = now;
        taskHashes.delete(id);
      }
    });
    const cutoff = now - 120 * 864e5;
    Object.keys(data.deleted).forEach((id) => {
      if (data.deleted[id] < cutoff) delete data.deleted[id];
    });
  }
  async function sha256(text) {
    if (!crypto?.subtle) return "";
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function buildPayload() {
    const clean = { ...data, focusRunning: false, focusStartedAt: null };
    delete clean.sync;
    const body = JSON.stringify(clean);
    return {
      app: "Focusday",
      schema: SCHEMA,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      device: deviceId,
      counts: { tasks: data.tasks.length, lists: data.lists.length, achievements: (data.achievements || []).length, habits: (data.habits || []).length, expenses: (data.expenses || []).length, wishes: (data.chamber || []).length, thoughts: (data.thoughts || []).length },
      checksum: await sha256(body),
      data: clean
    };
  }
  var stamp = () => {
    const d = /* @__PURE__ */ new Date();
    return `${todayISO()}_${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}`;
  };
  function download(name, text, type = "application/json") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function exportData() {
    persistNow();
    download(`focusday-backup-${stamp()}.json`, JSON.stringify(await buildPayload(), null, 2));
    data.lastBackupAt = Date.now();
    persist();
    toast("Бэкап скачан — данные в безопасности");
  }
  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 31e4, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  var b642 = (u8) => btoa(String.fromCharCode(...u8));
  var unb642 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function encryptText(text, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deriveKey(pass, salt), new TextEncoder().encode(text)));
    return JSON.stringify({ app: "Focusday", enc: "AES-GCM-256", kdf: "PBKDF2-SHA256-310k", salt: b642(salt), iv: b642(iv), ct: b642(ct) });
  }
  async function decryptText(env, pass) {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb642(env.iv) }, await deriveKey(pass, unb642(env.salt)), unb642(env.ct));
    return new TextDecoder().decode(pt);
  }
  async function exportEncrypted() {
    const pass = prompt("Придумай пароль для бэкапа (мин. 6 символов). Без него файл не открыть — сохрани его!");
    if (!pass) return;
    if (pass.length < 6) {
      toast("Пароль слишком короткий", "error");
      return;
    }
    persistNow();
    download(`focusday-backup-${stamp()}.fdbak`, await encryptText(JSON.stringify(await buildPayload()), pass), "application/octet-stream");
    data.lastBackupAt = Date.now();
    persist();
    toast("Зашифрованный бэкап скачан");
  }
  async function readBackup(text) {
    let parsed = JSON.parse(text);
    if (parsed?.enc) {
      const pass = prompt("Файл зашифрован. Введи пароль:");
      if (!pass) throw new Error("Импорт отменён");
      try {
        parsed = JSON.parse(await decryptText(parsed, pass));
      } catch (_) {
        throw new Error("Неверный пароль или файл повреждён");
      }
    }
    const incoming = parsed?.data || parsed;
    if (!incoming || !Array.isArray(incoming.tasks)) throw new Error("Файл не похож на бэкап Focusday");
    let integrity = "none";
    if (parsed.checksum) integrity = await sha256(JSON.stringify(parsed.data)) === parsed.checksum ? "ok" : "mismatch";
    return { meta: parsed, incoming, integrity };
  }
  var tTime = (t) => Number(t.updatedAt) || Math.max(Number(t.completedAt) || 0, Number(t.createdAt) || 0);
  function sanitizeLists(lists) {
    return (Array.isArray(lists) ? lists : []).filter((l) => l && l.id && l.name).map((l) => ({ id: String(l.id), name: String(l.name).slice(0, 30), color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : "#a78bfa" }));
  }
  function mergeData(local, inc) {
    const out = { ...local }, stats = { added: 0, updated: 0, same: 0, skippedDeleted: 0, removed: 0 };
    const deleted = { ...local.deleted || {} };
    Object.entries(inc.deleted || {}).forEach(([id, ts]) => {
      deleted[id] = Math.max(deleted[id] || 0, Number(ts) || 0);
    });
    const byId = new Map(local.tasks.map((t) => [t.id, t]));
    const incTasks = /* @__PURE__ */ new Map();
    inc.tasks.map(normalizeTask).filter(Boolean).forEach((t) => {
      const prev = incTasks.get(t.id);
      if (!prev || tTime(t) > tTime(prev)) incTasks.set(t.id, t);
    });
    incTasks.forEach((t, id) => {
      const mine = byId.get(id);
      if (!mine) {
        if (deleted[id] && deleted[id] >= tTime(t)) stats.skippedDeleted++;
        else {
          byId.set(id, t);
          delete deleted[id];
          stats.added++;
        }
      } else if (tTime(t) > tTime(mine)) {
        byId.set(id, { ...t, xp: Math.max(t.xp || 0, mine.xp || 0) });
        stats.updated++;
      } else stats.same++;
    });
    byId.forEach((t, id) => {
      if (deleted[id] && deleted[id] > tTime(t)) {
        byId.delete(id);
        stats.removed++;
      }
    });
    out.tasks = [...byId.values()];
    const lists = new Map(sanitizeLists(local.lists).map((l) => [l.id, l]));
    sanitizeLists(inc.lists).forEach((l) => {
      if (!lists.has(l.id)) lists.set(l.id, l);
    });
    out.lists = [...lists.values()];
    out.achievements = [.../* @__PURE__ */ new Set([...local.achievements || [], ...inc.achievements || []])];
    out.achievementDates = { ...inc.achievementDates || {}, ...local.achievementDates || {} };
    out.deleted = deleted;
    out.xp = Math.max(Number(local.xp) || 0, Number(inc.xp) || 0);
    out.focusSessions = Math.max(local.focusSessions || 0, inc.focusSessions || 0);
    const a = local.stats || {}, b = inc.stats || {}, s = { ...b, ...a };
    Object.keys({ ...a, ...b }).forEach((k) => {
      if (typeof a[k] === "number" || typeof b[k] === "number") s[k] = Math.max(Number(a[k]) || 0, Number(b[k]) || 0);
    });
    s.activeDays = { ...b.activeDays || {} };
    Object.entries(a.activeDays || {}).forEach(([d, n]) => {
      s.activeDays[d] = Math.max(s.activeDays[d] || 0, n);
    });
    s.lastVisitDay = [a.lastVisitDay, b.lastVisitDay].filter(Boolean).sort().pop() || todayISO();
    out.stats = s;
    mergeLife(out, local, inc, deleted, stats);
    const known = new Set(out.lists.map((l) => l.id));
    out.tasks.forEach((t) => {
      if (!known.has(t.listId)) {
        out.lists.push({ id: t.listId, name: "Восстановленный список", color: "#a78bfa" });
        known.add(t.listId);
      }
    });
    return { merged: out, stats };
  }
  function getSnaps() {
    try {
      return JSON.parse(storage.getItem(SNAP_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }
  function snapshot(reason) {
    const snaps = getSnaps();
    snaps.unshift({ at: Date.now(), reason, data: { ...data, focusRunning: false } });
    while (snaps.length > 8) snaps.pop();
    if (!storage.setItem(SNAP_KEY, JSON.stringify(snaps))) {
      snaps.length = 3;
      storage.setItem(SNAP_KEY, JSON.stringify(snaps));
    }
    renderSnapshots();
  }
  function dailySnapshot() {
    const last = getSnaps()[0];
    if (!last || toISO(new Date(last.at)) !== todayISO()) snapshot("Ежедневная авто-копия");
  }
  function renderSnapshots() {
    const sel = $("#snapshotSelect");
    if (!sel) return;
    sel.innerHTML = '<option value="">Точки восстановления…</option>' + getSnaps().map((s, i) => `<option value="${i}">${new Date(s.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${esc(s.reason)} · ${s.data.tasks?.length || 0} задач</option>`).join("");
  }
  function applyData(next, message) {
    set_data({ ...freshData(), ...next, focusRunning: false, focusStartedAt: null });
    data.tasks = data.tasks.map(normalizeTask).filter(Boolean);
    data.tasks.forEach((t) => {
      if (t.status === "inprogress") {
        t.elapsedMs = taskElapsed(t);
        t.timerStartedAt = null;
        t.status = "todo";
      }
    });
    rebaseline();
    persistNow();
    renderAll();
    renderProgress();
    updateSettingsCount();
    closeModals();
    toast(message);
  }
  var pendingImport = null;
  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await readBackup(reader.result);
        const preview = mergeData(data, res.incoming).stats;
        pendingImport = res;
        const when = res.meta.exportedAt ? new Date(res.meta.exportedAt).toLocaleString("ru-RU") : "неизвестно";
        $("#importMeta").innerHTML = `<div><span>Файл</span><strong>${esc(file.name)}</strong></div><div><span>Создан</span><strong>${esc(when)}</strong></div><div><span>Целостность</span><strong class="${res.integrity === "mismatch" ? "bad" : "good"}">${res.integrity === "ok" ? "SHA-256 совпадает ✓" : res.integrity === "mismatch" ? "Контрольная сумма не совпала!" : "старый формат, без подписи"}</strong></div>`;
        $("#importMeta").insertAdjacentHTML("beforeend", `<div><span>Привычки · финансы · мысли</span><strong>+${preview.lifeAdded || 0} новых · ${preview.lifeUpdated || 0} обновится</strong></div><div><span>В файле</span><strong>${(res.incoming.habits || []).length} привычек · ${(res.incoming.expenses || []).length} фин. записей · ${(res.incoming.thoughts || []).length} мыслей</strong></div>`);
        $("#importStats").innerHTML = [["Новых", preview.added, "mint"], ["Обновится", preview.updated, "sky"], ["Без изменений", preview.same, ""], ["Удалены ранее", preview.skippedDeleted + preview.removed, "rose"]].map(([l, n, c]) => `<div class="${c}"><strong>${n}</strong><span>${l}</span></div>`).join("");
        showModal("importModal");
      } catch (err) {
        toast(err.message || "Не удалось прочитать файл", "error");
      }
    };
    reader.readAsText(file);
  }
  function confirmImport(mode2) {
    if (!pendingImport) return;
    snapshot("Перед импортом");
    const before = getSnaps()[0];
    if (mode2 === "replace") applyData({ ...pendingImport.incoming, deleted: {} }, "Данные заменены из бэкапа");
    else {
      const { merged, stats } = mergeData(data, pendingImport.incoming);
      applyData(merged, `Объединено: +${stats.added} новых, ${stats.updated} обновлено`);
    }
    pendingImport = null;
    toast("Что-то не так? Можно откатить", "success", { label: "Откатить", onClick: () => applyData(before.data, "Импорт отменён") });
    checkAchievements();
  }

  // src/js/state.js
  var data = freshData();
  var tickHandle = null;
  var focusDeadline = null;
  var stepDraft = [];
  var lastTickSave = 0;
  var lastRenderedSecond = -1;
  var lastRoutineDay = todayISO();
  function loadData() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          data = { ...freshData(), ...parsed };
          if (!Array.isArray(data.tasks)) data.tasks = [];
          if (!Array.isArray(data.lists)) data.lists = freshData().lists;
          if (!Array.isArray(data.achievements)) data.achievements = [];
          if (!Array.isArray(data.customQuotes)) data.customQuotes = [];
          data.tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask).filter(Boolean) : [];
          data.lists = Array.isArray(parsed.lists) && parsed.lists.length ? parsed.lists.filter((l) => l && l.id && l.name).map((l) => ({ id: String(l.id), name: String(l.name).slice(0, 30), color: String(l.color || "#a78bfa") })) : LISTS.map((x) => ({ ...x }));
          const knownListIds = new Set(data.lists.map((l) => l.id));
          data.tasks.forEach((t) => {
            if (!knownListIds.has(t.listId)) {
              data.lists.push({ id: t.listId, name: `Восстановленный список`, color: "#a78bfa" });
              knownListIds.add(t.listId);
            }
          });
        }
      } else {
        for (const key of LEGACY_KEYS) {
          const legacy = storage.getItem(key);
          if (!legacy) continue;
          const tasks = JSON.parse(legacy);
          if (Array.isArray(tasks)) data.tasks = tasks.map(normalizeTask).filter(Boolean);
          const timers = JSON.parse(storage.getItem("ios_timers_2026") || "{}");
          data.tasks.forEach((t) => {
            if (Number(timers[t.id]) > 0) t.elapsedMs = Number(timers[t.id]);
          });
          break;
        }
      }
    } catch (err) {
      console.warn("Не удалось прочитать старые данные:", err);
      toast("Не получилось прочитать часть старых данных. Можно импортировать резервную копию.", "error");
      data = freshData();
    }
    if (typeof data.soundEnabled !== "boolean") data.soundEnabled = true;
    if (!Array.isArray(data.tasks)) data.tasks = [];
    if (!Array.isArray(data.achievements)) data.achievements = [];
    if (!Array.isArray(data.customQuotes)) data.customQuotes = [];
    if (!Array.isArray(data.lists) || !data.lists.length) data.lists = LISTS.map((x) => ({ ...x }));
    data.calendarOffset = Number.isFinite(Number(data.calendarOffset)) ? Math.max(-1200, Math.min(1200, Math.trunc(Number(data.calendarOffset)))) : 0;
    if (!validDate(data.selectedDate) || data.view === "today") data.selectedDate = todayISO();
    if (!["today", "inbox", "upcoming", "done", "habits", "money", "journal"].includes(data.view) && !String(data.view).startsWith("list:")) data.view = "today";
    if (String(data.view).startsWith("list:") && !data.lists.some((l) => l.id === String(data.view).slice(5))) data.view = "today";
    if (!["all", "todo", "inprogress", "done"].includes(data.filter)) data.filter = "all";
    if (!["dark", "light"].includes(data.theme)) data.theme = "dark";
    data.energy = Math.max(1, Math.min(5, Number(data.energy) || 3));
    data.focusMinutes = [10, 25, 45].includes(Number(data.focusMinutes)) ? Number(data.focusMinutes) : 10;
    data.focusRemainingMs = Math.max(0, Number(data.focusRemainingMs) || data.focusMinutes * 6e4);
    data.focusSessionMs = Math.max(0, Number(data.focusSessionMs) || 0);
    data.focusSessions = Math.max(0, Number(data.focusSessions) || 0);
    data.focusRunning = false;
    data.focusStartedAt = null;
    data.tasks.forEach((t) => {
      if (t.status === "inprogress" && t.timerStartedAt) {
        t.elapsedMs += Math.max(0, Date.now() - t.timerStartedAt);
        t.timerStartedAt = null;
      }
    });
    persist();
  }
  function publishOverlayState() {
    try {
      const task = data.tasks.find((t) => t.id === data.focusTaskId) || data.tasks.find((t) => t.status === "inprogress");
      const state2 = { title: task?.title || "", running: !!data.focusRunning, taskRunning: !!(task && task.status === "inprogress"), paused: !data.focusRunning, remainingMs: data.focusRemainingMs, totalMs: data.focusMinutes * 6e4, deadline: focusDeadline };
      const key = JSON.stringify(state2);
      if (key === lastOverlayState) return;
      lastOverlayState = key;
      window.focusdayDesktop?.publishState({ ...state2, updatedAt: Date.now() });
    } catch (_) {
    }
  }
  var persistTimer = null;
  var lastOverlayState = "";
  function persist() {
    if (persistTimer) return;
    persistTimer = setTimeout(persistNow, 120);
  }
  function persistNow() {
    clearTimeout(persistTimer);
    persistTimer = null;
    try {
      if (typeof trackChanges === "function") trackChanges();
      const durable = storage.setItem(STORAGE_KEY, JSON.stringify(data));
      const status = $("#storageStatus");
      if (durable) {
        if (status) status.textContent = "Сохранено автоматически";
        publishOverlayState();
        if (typeof Sync !== "undefined") Sync.schedule();
      } else {
        if (status) status.textContent = "Внимание: данные пока не сохранены на диск";
        console.error("localStorage недоступен; изменения хранятся только до закрытия приложения");
        toast("Не удалось сохранить данные на диск. Экспортируй резервную копию и проверь доступ к хранилищу.", "error");
      }
    } catch (err) {
      const st = $("#storageStatus");
      if (st) st.textContent = "Не удалось сохранить";
      console.error(err);
      toast("Хранилище браузера переполнено. Экспортируй резервную копию.", "error");
    }
  }
  function listById(id) {
    return data.lists.find((l) => l.id === id) || { id: "inbox", name: "Входящие", color: "#a78bfa" };
  }
  function taskElapsed(task) {
    return Math.max(0, Number(task.elapsedMs) || 0) + (task.timerStartedAt ? Math.max(0, Date.now() - task.timerStartedAt) : 0);
  }
  function fmtDuration(ms) {
    const s = Math.floor(Math.max(0, ms) / 1e3), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return h ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  function prettyDate(iso, opts = { day: "numeric", month: "short" }) {
    return fromISO(iso).toLocaleDateString("ru-RU", opts);
  }
  function set_stepDraft(v) {
    return stepDraft = v;
  }
  function set_focusDeadline(v) {
    return focusDeadline = v;
  }
  function set_lastRoutineDay(v) {
    return lastRoutineDay = v;
  }
  function set_lastRenderedSecond(v) {
    return lastRenderedSecond = v;
  }
  function set_lastTickSave(v) {
    return lastTickSave = v;
  }
  function set_data(v) {
    return data = v;
  }
  function set_tickHandle(v) {
    return tickHandle = v;
  }

  // src/js/features/quotes-data.js
  var QUOTE_CATS = {
    gentle: "Поддержка",
    action: "Дисциплина и дело",
    dc: "Бэтмен и DC",
    anime: "Аниме",
    samurai: "Самураи",
    classic: "Классика"
  };
  var QUOTE_LIBRARY = [
    // ── Поддержка (собственные, бережные) ──
    { id: "fd1", cat: "gentle", tone: "gentle", text: "Прогресс — это не идеальный день. Это возвращение к тому, что важно.", author: "Focusday", source: "Напоминание себе" },
    { id: "fd2", cat: "gentle", tone: "gentle", text: "Сделай версию на 20%. Начать важнее, чем сделать идеально.", author: "Focusday", source: "Напоминание себе" },
    { id: "fd3", cat: "gentle", tone: "gentle", text: "Тебе не нужно хотеть делать задачу. Нужно только начать с маленького шага.", author: "Focusday", source: "Напоминание себе" },
    { id: "fd4", cat: "gentle", tone: "gentle", text: "Отдых — часть плана, а не награда за истощение.", author: "Focusday", source: "Напоминание себе" },
    { id: "fd5", cat: "gentle", tone: "gentle", text: "Одна законченная мелочь лучше десяти идеальных планов.", author: "Focusday", source: "Напоминание себе" },
    { id: "fd6", cat: "gentle", tone: "gentle", text: "Пропущенный день — это пауза, а не приговор.", author: "Focusday", source: "Напоминание себе" },
    { id: "g1", cat: "gentle", tone: "gentle", text: "Почти всё снова заработает, если отключить это на пару минут. Даже ты.", author: "Энн Ламотт", source: "TED, 2017" },
    { id: "g2", cat: "gentle", tone: "gentle", text: "Начни там, где ты есть. Используй то, что у тебя есть. Делай то, что можешь.", author: "Артур Эш", source: "приписывается" },
    { id: "g3", cat: "gentle", tone: "gentle", text: "Просто продолжай плыть.", author: "Дори", source: "В поисках Немо" },
    { id: "g4", cat: "gentle", tone: "gentle", text: "Нам остаётся решить лишь одно: что делать со временем, которое нам дано.", author: "Гэндальф", source: "Властелин колец: Братство кольца" },
    // ── Дисциплина и дело ──
    { id: "a1", cat: "action", tone: "drive", text: "Самый действенный способ сделать что-то — просто сделать это.", author: "Амелия Эрхарт", source: "приписывается" },
    { id: "a2", cat: "action", tone: "gentle", text: "Если не можешь лететь — беги. Не можешь бежать — иди. Не можешь идти — ползи. Но продолжай двигаться вперёд.", author: "Мартин Лютер Кинг", source: "речь в Спелмане, 1960" },
    { id: "a3", cat: "action", tone: "gentle", text: "Вера — это сделать первый шаг, даже когда не видишь всей лестницы.", author: "Мартин Лютер Кинг", source: "приписывается" },
    { id: "a4", cat: "action", tone: "drive", text: "Мотивация помогает начать. Привычка помогает продолжать.", author: "Джим Рюн", source: "приписывается" },
    { id: "a5", cat: "action", tone: "drive", text: "Мотивация приходит после того, как ты начал, а не до.", author: "Марк Мэнсон", source: "принцип «Делай что-нибудь»" },
    { id: "a6", cat: "action", tone: "drive", text: "Желание — это договор с собой быть несчастным, пока не получишь желаемое. Выбирай желания осознанно.", author: "Наваль Равикант", source: "The Almanack of Naval Ravikant" },
    { id: "a7", cat: "action", tone: "drive", text: "Секрет движения вперёд — начать.", author: "Марк Твен", source: "приписывается" },
    // ── Бэтмен и DC ──
    { id: "b1", cat: "dc", tone: "drive", text: "Не то, кто я внутри, а то, что я делаю, определяет меня.", author: "Брюс Уэйн", source: "Batman Begins" },
    { id: "b2", cat: "dc", tone: "gentle", text: "Зачем мы падаем, Брюс? Чтобы научиться подниматься.", author: "Томас Уэйн", source: "Batman Begins" },
    { id: "b3", cat: "dc", tone: "gentle", text: "Ночь темнее всего перед рассветом.", author: "Харви Дент", source: "The Dark Knight" },
    { id: "b4", cat: "dc", tone: "deep", text: "Ты либо умираешь героем, либо живёшь достаточно долго, чтобы стать злодеем.", author: "Харви Дент", source: "The Dark Knight" },
    // ── Аниме ──
    { id: "n1", cat: "anime", tone: "gentle", text: "У тебя нет врагов. Ни у кого в этом мире нет врагов. Нет никого, кому стоило бы причинять боль.", author: "Торс", source: "Vinland Saga" },
    { id: "n2", cat: "anime", tone: "gentle", text: "У меня нет врагов.", author: "Торфинн", source: "Vinland Saga" },
    { id: "n3", cat: "anime", tone: "drive", text: "Борись. Даже когда кажется, что сил не осталось, — сделай ещё один шаг.", author: "Гатс", source: "Berserk · по мотивам" },
    { id: "n4", cat: "anime", tone: "deep", text: "Я ненавижу дождь. В этом пустом мире, где идёт дождь, я остаюсь совсем один.", author: "Куросаки Ичиго", source: "Bleach · по мотивам" },
    { id: "n5", cat: "anime", tone: "drive", text: "Если не будешь рисковать, не сможешь создать будущее.", author: "Монки Д. Луффи", source: "One Piece · приписывается" },
    { id: "n6", cat: "anime", tone: "gentle", text: "Неважно, насколько ты слаб. Важно, что ты встал.", author: "Всемогущий", source: "Моя геройская академия · по мотивам" },
    { id: "n7", cat: "anime", tone: "gentle", text: "Иногда жизнь — тёмный тоннель. Но если продолжать идти, обязательно выйдешь к свету.", author: "Дядюшка Айро", source: "Аватар: Легенда об Аанге" },
    // ── Самураи ──
    { id: "s1", cat: "samurai", tone: "drive", text: "Сегодня — победа над собой вчерашним.", author: "Миямото Мусаси", source: "Книга пяти колец" },
    { id: "s2", cat: "samurai", tone: "drive", text: "Не делай ничего бесполезного.", author: "Миямото Мусаси", source: "Книга пяти колец" },
    { id: "s3", cat: "samurai", tone: "gentle", text: "Нет ничего, кроме единственной цели настоящего момента.", author: "Ямамото Цунэтомо", source: "Хагакурэ" },
    { id: "s4", cat: "samurai", tone: "gentle", text: "К важным делам относись легко. К лёгким — серьёзно.", author: "Ямамото Цунэтомо", source: "Хагакурэ" },
    { id: "s5", cat: "samurai", tone: "drive", text: "Путь — в ежедневной тренировке.", author: "Миямото Мусаси", source: "Книга пяти колец · по мотивам" },
    // ── Классика ──
    { id: "c1", cat: "classic", tone: "gentle", text: "Путь в тысячу ли начинается с первого шага.", author: "Лао-цзы", source: "Дао дэ цзин" },
    { id: "c2", cat: "classic", tone: "drive", text: "Пока мы откладываем жизнь, она проходит.", author: "Сенека", source: "Письма к Луцилию" },
    { id: "c3", cat: "classic", tone: "gentle", text: "У тебя есть власть над своим умом, а не над внешними событиями. Осознай это — и обретёшь силу.", author: "Марк Аврелий", source: "Размышления · по мотивам" },
    { id: "c4", cat: "classic", tone: "gentle", text: "Не так важно, как медленно ты идёшь, если ты не останавливаешься.", author: "Конфуций", source: "приписывается" }
  ];

  // src/js/features/quotes.js
  var ROTATE_MS = 5 * 6e4;
  var AWAY_MS = 15e4;
  var DEFAULT_CATS = { gentle: true, action: true, dc: true, anime: true, samurai: true, classic: true, custom: true };
  var hiddenAt = 0;
  var current = null;
  function ensureQuotes(d = data) {
    const q = d.quotes && typeof d.quotes === "object" ? d.quotes : {};
    q.cats = { ...DEFAULT_CATS, ...q.cats || {} };
    q.showDeep = !!q.showDeep;
    q.hidden = Array.isArray(q.hidden) ? q.hidden.filter((x) => typeof x === "string") : [];
    q.recent = Array.isArray(q.recent) ? q.recent.slice(-12) : [];
    q.custom = Array.isArray(q.custom) ? q.custom.filter((x) => x && typeof x.text === "string") : [];
    if (Array.isArray(d.customQuotes) && d.customQuotes.length) {
      normalizeQuotes(d.customQuotes).forEach((x) => {
        if (!q.custom.some((c) => c.id === x.id)) q.custom.push(x);
      });
      d.customQuotes = [];
    }
    d.quotes = q;
    return q;
  }
  var hash = (s) => {
    let h = 2166136261;
    for (const ch of s) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };
  function normalizeQuotes(input) {
    const arr = Array.isArray(input) ? input : Array.isArray(input?.quotes) ? input.quotes : [];
    const out = [], seen = /* @__PURE__ */ new Set();
    for (const raw of arr.slice(0, 2e3)) {
      const o = typeof raw === "string" ? { text: raw } : raw && typeof raw === "object" ? raw : null;
      const text = String(o?.text ?? o?.quote ?? "").replace(/\s+/g, " ").trim().replace(/^[«"“]|[»"”]$/g, "");
      if (text.length < 3 || text.length > 400) continue;
      const key = text.toLocaleLowerCase("ru");
      if (seen.has(key)) continue;
      seen.add(key);
      const tone = ["gentle", "drive", "deep"].includes(o.tone) ? o.tone : "gentle";
      out.push({ id: "u" + hash(key), cat: "custom", tone, text, author: String(o.author || "Моя цитата").slice(0, 60), source: String(o.source || "").slice(0, 80) });
    }
    return out;
  }
  function quotePool(q = ensureQuotes()) {
    return [...QUOTE_LIBRARY, ...q.custom].filter((x) => q.cats[x.cat] !== false && (q.showDeep || x.tone !== "deep") && !q.hidden.includes(x.id));
  }
  function pickQuote(q = ensureQuotes(), rnd = Math.random) {
    const pool = quotePool(q);
    if (!pool.length) return null;
    const avoid = new Set(q.recent.slice(-Math.min(8, pool.length - 1)));
    const fresh = pool.filter((x) => !avoid.has(x.id));
    const list = fresh.length ? fresh : pool.filter((x) => x.id !== q.recent.at(-1));
    const pick = (list.length ? list : pool)[Math.floor(rnd() * (list.length || pool.length))];
    q.recent = [...q.recent, pick.id].slice(-12);
    q.changedAt = Date.now();
    q.currentId = pick.id;
    return pick;
  }
  function paint(x, animate) {
    const card = $(".quote-card"), p = $("#dailyQuote"), au = $("#quoteAuthor");
    if (!card || !p) return;
    const apply = () => {
      if (!x) {
        p.textContent = "Все цитаты скрыты фильтром — загляни в настройки.";
        au.innerHTML = "";
      } else {
        p.textContent = `«${x.text}»`;
        au.innerHTML = `<b>${esc(x.author)}</b>${x.source ? " · " + esc(x.source) : ""}`;
      }
      card.dataset.cat = x?.cat || "";
      card.classList.remove("swap");
    };
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      card.classList.add("swap");
      setTimeout(apply, 320);
    } else apply();
  }
  function showNextQuote(animate = true) {
    const q = ensureQuotes();
    current = pickQuote(q);
    paint(current, animate);
    persist();
  }
  function renderQuote() {
    const q = ensureQuotes();
    const pool = quotePool(q);
    current = pool.find((x) => x.id === q.currentId) || null;
    if (!current || Date.now() - (q.changedAt || 0) > ROTATE_MS) current = pickQuote(q);
    paint(current, false);
    renderQuoteSettings();
  }
  function hideCurrentQuote() {
    if (!current) return;
    const q = ensureQuotes(), id = current.id, title = current.author;
    q.hidden.push(id);
    showNextQuote(true);
    toast(`Цитата «${title}» больше не появится`, "success", { label: "Вернуть", onClick: () => {
      q.hidden = q.hidden.filter((x) => x !== id);
      persist();
      renderQuoteSettings();
    } });
    renderQuoteSettings();
  }
  async function importQuotesFromJSON(file) {
    try {
      const list = normalizeQuotes(JSON.parse(await file.text()));
      if (!list.length) {
        toast('В файле не нашлось цитат. Формат: [{ "text": "…", "author": "…", "source": "…" }]', "error");
        return 0;
      }
      const q = ensureQuotes();
      let added = 0;
      list.forEach((x) => {
        if (!q.custom.some((c) => c.id === x.id)) {
          q.custom.push(x);
          added++;
        }
      });
      q.cats.custom = true;
      persist();
      renderQuoteSettings();
      toast(added ? `Добавлено цитат: ${added}` : "Все цитаты из файла уже есть");
      return added;
    } catch (_) {
      toast("Не удалось прочитать JSON с цитатами", "error");
      return 0;
    }
  }
  function renderQuoteSettings() {
    const box = $("#quoteCats");
    if (!box) return;
    const q = ensureQuotes();
    const cats = { ...QUOTE_CATS, ...q.custom.length ? { custom: "Мои" } : {} };
    box.innerHTML = Object.entries(cats).map(([k, n]) => `<button type="button" class="chip-toggle" data-qcat="${k}" aria-pressed="${q.cats[k] !== false}">${esc(n)}</button>`).join("");
    const deep = $("#quoteDeep");
    if (deep) deep.setAttribute("aria-pressed", String(q.showDeep));
    const info = $("#quoteInfo");
    if (info) info.textContent = `${quotePool(q).length} в ротации · скрыто ${q.hidden.length}${q.custom.length ? " · своих " + q.custom.length : ""}`;
    const un = $("#quoteUnhide");
    if (un) un.hidden = !q.hidden.length;
  }
  function bindQuotes() {
    ensureQuotes();
    $("#quoteNext")?.addEventListener("click", () => showNextQuote(true));
    $("#quoteHide")?.addEventListener("click", hideCurrentQuote);
    $("#quoteCats")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-qcat]");
      if (!b) return;
      const q = ensureQuotes();
      q.cats[b.dataset.qcat] = q.cats[b.dataset.qcat] === false;
      persist();
      renderQuoteSettings();
      if (current && !quotePool(q).some((x) => x.id === current.id)) showNextQuote(true);
    });
    $("#quoteDeep")?.addEventListener("click", () => {
      const q = ensureQuotes();
      q.showDeep = !q.showDeep;
      persist();
      renderQuoteSettings();
      if (!q.showDeep && current?.tone === "deep") showNextQuote(true);
    });
    $("#quoteUnhide")?.addEventListener("click", () => {
      const q = ensureQuotes();
      q.hidden = [];
      persist();
      renderQuoteSettings();
      toast("Скрытые цитаты снова в ротации");
    });
    $("#quoteImport")?.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (f) await importQuotesFromJSON(f);
      e.target.value = "";
    });
    setInterval(() => {
      if (!document.hidden && Date.now() - (ensureQuotes().changedAt || 0) >= ROTATE_MS) showNextQuote(true);
    }, 2e4);
    const away = () => {
      if (!hiddenAt) hiddenAt = Date.now();
    };
    const back = () => {
      if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) showNextQuote(true);
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", () => document.hidden ? away() : back());
    window.addEventListener("blur", away);
    window.addEventListener("focus", back);
    renderQuote();
  }

  // src/js/features/softplan.js
  var EVENING_HOUR = 18;
  var isEvening = (d = /* @__PURE__ */ new Date()) => d.getHours() >= EVENING_HOUR;
  function softCandidates(now = /* @__PURE__ */ new Date()) {
    const today = toISO(now), evening = isEvening(now);
    return data.tasks.filter((t) => t.status !== "done" && (!t.recurrence || t.recurrence === "none") && t.date && (evening ? t.date <= today : t.date < today));
  }
  function softTarget(now = /* @__PURE__ */ new Date()) {
    return isEvening(now) ? toISO(addDays(now, 1)) : toISO(now);
  }
  function softReschedule(now = /* @__PURE__ */ new Date()) {
    const list = softCandidates(now);
    if (!list.length) {
      toast("Переносить нечего — план уже бережный ✦");
      return 0;
    }
    const target = softTarget(now), before = list.map((t) => ({ t, date: t.date, status: t.status, timerStartedAt: t.timerStartedAt, elapsedMs: t.elapsedMs }));
    list.forEach((t) => {
      if (t.status === "inprogress") {
        t.elapsedMs = taskElapsed(t);
        t.timerStartedAt = null;
        t.status = "todo";
      }
      t.date = target;
      t.softMoves = (t.softMoves || 0) + 1;
      t.updatedAt = Date.now();
    });
    award("softmove", { count: list.length });
    persist();
    renderAll();
    checkAchievements();
    const when = target === todayISO() ? "на сегодня" : "на завтра";
    toast(`${list.length} ${plural(list.length, ["задача", "задачи", "задач"])} ${when}. Это план, а не провал 🌙`, "success", {
      label: "Отменить",
      onClick: () => {
        before.forEach((b) => {
          Object.assign(b.t, { date: b.date, status: b.status, timerStartedAt: b.timerStartedAt, elapsedMs: b.elapsedMs, updatedAt: Date.now() });
          b.t.softMoves = Math.max(0, (b.t.softMoves || 1) - 1);
        });
        persist();
        renderAll();
      }
    });
    return list.length;
  }
  function renderSoftPlan() {
    const box = $("#softPlan");
    if (!box) return;
    const list = ["today", "inbox"].includes(data.view) ? softCandidates() : [];
    box.hidden = !list.length;
    if (!list.length) return;
    const ev = isEvening(), n = list.length, word = plural(n, ["задача", "задачи", "задач"]);
    $("#softPlanText").innerHTML = ev ? `<strong>Вечер — время закрывать день.</strong> ${n} ${word} можно спокойно перенести на завтра.` : `<strong>С прошлых дней осталось ${n} ${word}.</strong> Перенести на сегодня — без чувства долга.`;
    $("#softPlanBtn").textContent = ev ? "Мягкий перенос на завтра" : "Перенести на сегодня";
  }
  function bindSoftPlan() {
    $("#softPlanBtn")?.addEventListener("click", () => softReschedule());
    renderHooks.push(["softplan", renderSoftPlan]);
  }

  // src/js/features/ambient-engine.js
  var SOUNDS = [
    { id: "rain", name: "Дождь", emoji: "🌧️", level: 0.8 },
    { id: "cafe", name: "Кафе", emoji: "☕", level: 1.3 },
    { id: "library", name: "Библиотека", emoji: "📚", level: 0.6 },
    { id: "brown", name: "Коричневый шум", emoji: "🟤", level: 0.48 },
    { id: "pink", name: "Розовый шум", emoji: "🌸", level: 1 },
    { id: "ocean", name: "Океан", emoji: "🌊", level: 0.54 },
    { id: "fire", name: "Камин", emoji: "🔥", level: 0.9 },
    { id: "wind", name: "Ветер", emoji: "🍃", level: 1.5 }
  ];
  var buffers = /* @__PURE__ */ new WeakMap();
  function makeNoise(ctx, kind, seconds = 8) {
    const sr = ctx.sampleRate, n = Math.floor(sr * seconds), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w * 0.5;
      else if (kind === "pink") {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    const x = Math.floor(sr * 0.25);
    for (let i = 0; i < x; i++) {
      const k = i / x;
      d[n - x + i] = d[n - x + i] * (1 - k) + d[i] * k;
    }
    return buf;
  }
  function noiseBuf(ctx, kind) {
    let m = buffers.get(ctx);
    if (!m) {
      m = {};
      buffers.set(ctx, m);
    }
    return m[kind] || (m[kind] = makeNoise(ctx, kind, kind === "white" ? 2 : 8));
  }
  var G = (ctx, v) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  var F = (ctx, type, f, Q = 0.7) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = Q;
    return b;
  };
  function chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
  }
  function buildSound(ctx, id, dest) {
    const nodes = [], timers = [];
    const src = (kind, offset = Math.random() * 4) => {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf(ctx, kind);
      s.loop = true;
      s.start(ctx.currentTime, offset);
      nodes.push(s);
      return s;
    };
    const lfo = (freq, depth, param) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      o.connect(G(ctx, depth)).connect(param);
      o.start();
      nodes.push(o);
      return o;
    };
    const out = G(ctx, 1);
    out.connect(dest);
    const burst = (t, { f = 3e3, q = 1, type = "bandpass", dur = 0.02, amp = 0.1, attack = 2e-3 }) => {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf(ctx, "white");
      const flt = F(ctx, type, f, q), g = G(ctx, 0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + attack);
      g.gain.exponentialRampToValueAtTime(1e-4, t + attack + dur);
      chain(s, flt, g, out);
      s.start(t, Math.random() * 1.5);
      s.stop(t + attack + dur + 0.05);
    };
    const clink = (t) => {
      const f0 = 2100 + Math.random() * 1400, amp = 0.012 + Math.random() * 0.02;
      [1, 2.76, 5.4].forEach((r, i) => {
        const o = ctx.createOscillator(), g = G(ctx, 0);
        o.frequency.value = f0 * r;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp / (i + 1), t + 3e-3);
        g.gain.exponentialRampToValueAtTime(1e-4, t + 0.35 + Math.random() * 0.4);
        chain(o, g, out);
        o.start(t);
        o.stop(t + 0.9);
      });
    };
    const EVENTS = {
      rain: [{ rate: 22, fn: (t) => burst(t, { f: 2200 + Math.random() * 4200, q: 1.4, dur: 0.012 + Math.random() * 0.03, amp: 0.02 + Math.random() * 0.07 }) }],
      cafe: [{ rate: 0.28, fn: clink }, { rate: 0.6, fn: (t) => burst(t, { f: 900, q: 0.6, dur: 0.12, amp: 0.025, attack: 0.03 }) }],
      library: [{ rate: 0.09, fn: (t) => {
        for (let k = 0; k < 3; k++) burst(t + k * 0.09, { f: 1600 + Math.random() * 1200, q: 0.7, dur: 0.18, amp: 0.035, attack: 0.04 });
      } }],
      fire: [
        { rate: 7, fn: (t) => burst(t, { type: "highpass", f: 1500 + Math.random() * 2500, q: 0.5, dur: 4e-3 + Math.random() * 0.01, amp: 0.05 + Math.random() * 0.3 }) },
        { rate: 0.5, fn: (t) => burst(t, { type: "lowpass", f: 300, q: 0.7, dur: 0.06, amp: 0.4 }) }
      ]
    }[id] || [];
    switch (id) {
      case "rain":
        chain(src("pink"), F(ctx, "highpass", 450), F(ctx, "lowpass", 7500), G(ctx, 0.55), out);
        chain(src("brown"), F(ctx, "lowpass", 380), G(ctx, 0.35), out);
        break;
      case "cafe": {
        const m1 = G(ctx, 0.5), m2 = G(ctx, 0.3);
        chain(src("brown"), F(ctx, "bandpass", 480, 0.6), m1, out);
        lfo(0.17, 0.18, m1.gain);
        chain(src("pink"), F(ctx, "bandpass", 1150, 0.9), m2, out);
        lfo(0.23, 0.12, m2.gain);
        chain(src("pink"), F(ctx, "lowpass", 3200), G(ctx, 0.05), out);
        break;
      }
      case "library":
        chain(src("brown"), F(ctx, "lowpass", 260), G(ctx, 0.5), out);
        chain(src("pink"), F(ctx, "bandpass", 850, 0.5), G(ctx, 0.05), out);
        break;
      case "brown":
        chain(src("brown"), F(ctx, "lowpass", 1100), G(ctx, 0.85), out);
        break;
      case "pink":
        chain(src("pink"), F(ctx, "lowpass", 9e3), G(ctx, 0.42), out);
        break;
      case "ocean": {
        const lp = F(ctx, "lowpass", 520), g = G(ctx, 0.5), foamG = G(ctx, 0.05);
        chain(src("brown"), lp, g, out);
        lfo(0.075, 380, lp.frequency);
        lfo(0.075, 0.32, g.gain);
        chain(src("pink"), F(ctx, "highpass", 1800), foamG, out);
        lfo(0.075, 0.045, foamG.gain);
        break;
      }
      case "fire":
        chain(src("brown"), F(ctx, "lowpass", 600), G(ctx, 0.45), out);
        break;
      case "wind": {
        const bp = F(ctx, "bandpass", 520, 1.1), g = G(ctx, 0.6);
        chain(src("pink"), bp, g, out);
        lfo(0.05, 260, bp.frequency);
        lfo(0.13, 110, bp.frequency);
        lfo(0.07, 0.22, g.gain);
        break;
      }
      default:
        chain(src("brown"), G(ctx, 0.6), out);
    }
    let horizon = ctx.currentTime;
    const plan = (until) => {
      for (const ev of EVENTS) {
        let t = Math.max(horizon, ctx.currentTime);
        while ((t += -Math.log(1 - Math.random()) / ev.rate) < until) ev.fn(t);
      }
      horizon = until;
    };
    if (EVENTS.length) {
      if (typeof ctx.startRendering === "function") plan(ctx.length / ctx.sampleRate);
      else {
        plan(ctx.currentTime + 0.6);
        timers.push(setInterval(() => plan(ctx.currentTime + 0.6), 250));
      }
    }
    return { output: out, stop(at = ctx.currentTime) {
      timers.forEach(clearInterval);
      nodes.forEach((n) => {
        try {
          n.stop(at);
        } catch (_) {
        }
      });
      setTimeout(() => {
        try {
          out.disconnect();
        } catch (_) {
        }
      }, Math.max(0, (at - ctx.currentTime) * 1e3) + 200);
    } };
  }
  function createAmbientPlayer(getCtx) {
    let ctx = null, master = null, cur = null, curId = null, vol = 0.5, fadeTimer = null;
    const ensure = () => {
      if (!ctx) {
        ctx = getCtx();
        master = ctx.createGain();
        master.gain.value = 0;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -10;
        master.connect(comp).connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume?.();
      return ctx;
    };
    const level = (id) => SOUNDS.find((s) => s.id === id)?.level || 1;
    return {
      get playing() {
        return !!cur;
      },
      get id() {
        return curId;
      },
      play(id, fadeIn = 1.6) {
        ensure();
        clearTimeout(fadeTimer);
        if (cur && curId === id) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setTargetAtTime(vol * level(id), ctx.currentTime, fadeIn / 3);
          return;
        }
        if (cur) {
          const old = cur, g = old.output;
          g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
          old.stop(ctx.currentTime + 1.6);
        }
        cur = buildSound(ctx, id, master);
        curId = id;
        cur.output.gain.setValueAtTime(0, ctx.currentTime);
        cur.output.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(vol * level(id), ctx.currentTime, fadeIn / 3);
      },
      stop(fadeOut = 1.5) {
        if (!cur || !ctx) return;
        const s = cur;
        cur = null;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
        s.stop(ctx.currentTime + fadeOut + 0.1);
        fadeTimer = setTimeout(() => {
          if (!cur) curId = null;
        }, fadeOut * 1e3 + 150);
      },
      setVolume(v) {
        vol = Math.max(0, Math.min(1, Number(v) || 0));
        if (cur && ctx) master.gain.setTargetAtTime(vol * level(curId), ctx.currentTime, 0.08);
      }
    };
  }

  // src/js/features/ambient.js
  var player = createAmbientPlayer(() => new (window.AudioContext || window.webkitAudioContext)());
  var auto = false;
  var lastRunning = null;
  var endingFade = false;
  function ensureAmbient(d = data) {
    const a = d.ambient && typeof d.ambient === "object" ? d.ambient : {};
    if (!SOUNDS.some((s) => s.id === a.id)) a.id = "rain";
    a.volume = Math.max(0, Math.min(1, Number.isFinite(+a.volume) ? +a.volume : 0.45));
    a.withFocus = a.withFocus === void 0 ? true : !!a.withFocus;
    d.ambient = a;
    return a;
  }
  var sound = () => SOUNDS.find((s) => s.id === ensureAmbient().id);
  function renderAmbient() {
    const a = ensureAmbient(), s = sound(), btn = $("#ambToggle");
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(player.playing));
    btn.classList.toggle("on", player.playing);
    $("#ambName").textContent = player.playing ? `${s.name} · играет` : `Фон: ${s.name}`;
    $("#ambEmoji").textContent = s.emoji;
    $$("#ambGrid [data-amb]").forEach((b) => {
      const on = b.dataset.amb === a.id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    const v = $("#ambVol");
    if (v && document.activeElement !== v) v.value = String(Math.round(a.volume * 100));
    const wf = $("#ambWithFocus");
    if (wf) wf.setAttribute("aria-pressed", String(a.withFocus));
  }
  function playAmbient(id = ensureAmbient().id) {
    const a = ensureAmbient();
    a.id = id;
    player.setVolume(a.volume);
    player.play(id);
    endingFade = false;
    persist();
    renderAmbient();
  }
  function stopAmbient(fade = 1.5) {
    auto = false;
    player.stop(fade);
    renderAmbient();
    setTimeout(renderAmbient, fade * 1e3 + 250);
  }
  function followFocus() {
    const a = ensureAmbient(), running2 = !!data.focusRunning;
    if (lastRunning === null) {
      lastRunning = running2;
      return;
    }
    if (running2 !== lastRunning) {
      lastRunning = running2;
      if (running2 && a.withFocus && !player.playing) {
        auto = true;
        playAmbient();
      } else if (!running2 && auto && player.playing) stopAmbient(endingFade ? 0.4 : 1.5);
      return;
    }
    if (running2 && auto && player.playing && !endingFade && data.focusRemainingMs > 0 && data.focusRemainingMs <= 10500) {
      endingFade = true;
      player.stop(Math.max(1, data.focusRemainingMs / 1e3));
      setTimeout(renderAmbient, data.focusRemainingMs + 300);
    }
  }
  function bindAmbient() {
    const box = $("#ambientBox");
    if (!box) return;
    ensureAmbient();
    $("#ambGrid").innerHTML = SOUNDS.map((s) => `<button type="button" class="amb-tile" data-amb="${s.id}" aria-pressed="false"><span aria-hidden="true">${s.emoji}</span>${esc(s.name)}</button>`).join("");
    $("#ambToggle").addEventListener("click", () => {
      if (player.playing) stopAmbient();
      else {
        auto = !!data.focusRunning && ensureAmbient().withFocus;
        playAmbient();
      }
    });
    $("#ambMore").addEventListener("click", () => {
      const p = $("#ambPanel");
      p.hidden = !p.hidden;
      $("#ambMore").setAttribute("aria-expanded", String(!p.hidden));
    });
    $("#ambGrid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-amb]");
      if (b) playAmbient(b.dataset.amb);
    });
    $("#ambVol").addEventListener("input", (e) => {
      const a = ensureAmbient();
      a.volume = Number(e.target.value) / 100;
      player.setVolume(a.volume);
      persist();
    });
    $("#ambWithFocus").addEventListener("click", () => {
      const a = ensureAmbient();
      a.withFocus = !a.withFocus;
      persist();
      renderAmbient();
    });
    setInterval(followFocus, 1e3);
    renderAmbient();
  }
  var _ambientPlayer = player;

  // src/js/features/palette.js
  var items = [];
  var active = 0;
  var norm = (s) => String(s || "").toLocaleLowerCase("ru").replace(/ё/g, "е");
  function fuzzyScore(text, q) {
    const t = norm(text), s = norm(q).trim();
    if (!s) return 1;
    const i = t.indexOf(s);
    if (i >= 0) return 100 - Math.min(i, 50) + (i === 0 || t[i - 1] === " " ? 20 : 0);
    let k = 0, gaps = 0;
    for (let j = 0; j < t.length && k < s.length; j++) {
      if (t[j] === s[k]) k++;
      else if (k) gaps++;
    }
    return k === s.length ? Math.max(1, 40 - gaps) : 0;
  }
  function commands() {
    const soft = softCandidates().length, playing = _ambientPlayer.playing;
    const go = (v) => () => switchView(v);
    const list = [
      { t: "Новая задача", k: "N", icon: "plus", run: () => openModal() },
      { t: "Быстрый ввод: задача · @привычка · -$трата · !мысль", k: "Q", icon: "bolt", run: focusQuickCapture },
      { t: data.focusRunning ? "Пауза фокуса" : "Начать фокус", k: "Space", icon: data.focusRunning ? "pause" : "play", run: startFocus },
      { t: "Режим фокуса (только таймер)", k: "F", icon: "focus", run: () => setFocusMode(!document.body.classList.contains("focus-mode")) },
      { t: data.compress ? "Обычный вид" : "Сжатый вид", k: "C", icon: "compress", run: () => setCompress(!data.compress) },
      { t: data.lowEnergy ? "Выключить бережный режим" : "Бережный режим (мало сил)", k: "L", icon: "battery", run: () => setLowEnergy(!data.lowEnergy) },
      soft && { t: `Мягкий перенос (${soft})`, hint: "невыполненное — на завтра, без вины", icon: "moon", run: () => softReschedule() },
      { t: "Сегодня", k: "1", icon: "sun", run: go("today"), group: "Разделы" },
      { t: "Входящие", k: "2", icon: "inbox", run: go("inbox"), group: "Разделы" },
      { t: "План", k: "3", icon: "calendar", run: go("upcoming"), group: "Разделы" },
      { t: "Сделано", k: "4", icon: "check-circle", run: go("done"), group: "Разделы" },
      { t: "Привычки", k: "5", icon: "leaf", run: go("habits"), group: "Разделы" },
      { t: "Финансы", k: "6", icon: "wallet", run: go("money"), group: "Разделы" },
      { t: "Мысли", k: "7", icon: "pen", run: go("journal"), group: "Разделы" },
      { t: "Достижения", icon: "trophy", run: () => $("#achievementsBtn")?.click(), group: "Разделы" },
      { t: "Настройки и данные", icon: "gear", run: () => $("#settingsBtn")?.click(), group: "Разделы" },
      { t: playing ? "Выключить фоновый звук" : "Включить фоновый звук", icon: "wave", run: () => playing ? stopAmbient() : playAmbient(), group: "Звук" },
      ...SOUNDS.map((s) => ({ t: `Фон: ${s.name}`, hint: s.emoji, icon: "wave", run: () => playAmbient(s.id), group: "Звук" })),
      { t: "Другая цитата", icon: "feather", run: () => showNextQuote(true) },
      { t: "Сменить тему", icon: data.theme === "light" ? "moon" : "sun", run: () => $("#themeBtn")?.click() },
      { t: "Экспорт бэкапа (.json)", icon: "download", run: exportData, group: "Данные" },
      SyncEngine.enabled() && { t: "Синхронизировать сейчас", icon: "sync", run: () => SyncEngine.syncNow("manual"), group: "Данные" },
      window.focusdayDesktop && { t: "Плавающий виджет", k: "Ctrl Alt F", icon: "widget", run: () => window.focusdayDesktop.openOverlay(), group: "Данные" }
    ];
    return list.filter(Boolean).map((c) => ({ group: "Действия", ...c }));
  }
  function buildItems(q) {
    q = String(q || "").trim();
    const out = [];
    const c = q ? classifyQuick(q) : null;
    if (c && c.kind !== "task") out.push({ t: `Добавить: ${q}`, html: describeQuick(c), icon: "bolt", group: "Быстрый ввод", run: () => routeQuick(q), score: 999 });
    commands().forEach((x) => {
      const s = fuzzyScore(x.t + " " + (x.hint || ""), q);
      if (s) out.push({ ...x, score: s + (x.group === "Действия" ? 5 : 0) });
    });
    if (q) {
      data.tasks.forEach((t) => {
        const s = fuzzyScore(t.title + " " + (t.description || ""), q);
        if (s) out.push({ t: t.title, hint: t.status === "done" ? "сделано" : t.date, icon: t.status === "done" ? "check-circle" : "target", group: "Задачи", score: s + (t.status === "done" ? 0 : 10), run: () => {
          openModal(t);
        }, alt: () => setFocusTask(t.id) });
      });
      (data.habits || []).forEach((h) => {
        const s = fuzzyScore(h.name, q);
        if (s) out.push({ t: `Отметить привычку: ${h.name}`, icon: "leaf", group: "Привычки", score: s, run: () => checkHabitByName(h.name, data.lowEnergy) });
      });
      (data.thoughts || []).forEach((n) => {
        const s = fuzzyScore(n.text, q);
        if (s > 20) out.push({ t: n.text.slice(0, 80), icon: "pen", group: "Мысли", score: s - 10, run: () => switchView("journal") });
      });
      if (!c || c.kind === "task") out.push({ t: `Создать задачу «${q}»`, icon: "plus", group: "Быстрый ввод", score: 0.5, run: () => routeQuick(q) });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 40);
  }
  function paint2() {
    const ul = $("#paletteList");
    let html = "", last = "";
    items.forEach((x, i) => {
      if (x.group !== last && !$("#paletteInput").value.trim()) {
        html += `<li class="pal-group" role="presentation">${esc(x.group)}</li>`;
        last = x.group;
      }
      html += `<li role="option" id="pal-${i}" class="pal-item${i === active ? " active" : ""}" aria-selected="${i === active}" data-i="${i}">${ic(x.icon || "dot")}<span>${x.html || esc(x.t)}</span>${x.hint ? `<small>${esc(x.hint)}</small>` : ""}${x.k ? `<kbd>${esc(x.k)}</kbd>` : ""}</li>`;
    });
    ul.innerHTML = html || '<li class="pal-empty">Ничего не нашлось. Enter — создать задачу.</li>';
    $("#paletteInput").setAttribute("aria-activedescendant", items.length ? `pal-${active}` : "");
    $(`#pal-${active}`)?.scrollIntoView({ block: "nearest" });
  }
  function refresh() {
    items = buildItems($("#paletteInput").value);
    active = 0;
    paint2();
  }
  function run(i, alt) {
    const x = items[i];
    if (!x) return;
    closeModals();
    setTimeout(() => (alt && x.alt ? x.alt : x.run)(), 30);
    data.stats && (data.stats.paletteRuns = (Number(data.stats.paletteRuns) || 0) + 1);
  }
  function openPalette(prefill = "") {
    if (!$("#paletteModal")) return;
    $("#paletteInput").value = prefill;
    refresh();
    showModal("paletteModal");
    setTimeout(() => $("#paletteInput").focus(), 70);
  }
  function bindPalette() {
    const input = $("#paletteInput");
    if (!input) return;
    input.addEventListener("input", refresh);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        active = Math.min(items.length - 1, active + 1);
        paint2();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        active = Math.max(0, active - 1);
        paint2();
      } else if (e.key === "Enter") {
        e.preventDefault();
        run(active, e.shiftKey);
      }
    });
    $("#paletteList").addEventListener("click", (e) => {
      const li = e.target.closest("[data-i]");
      if (li) run(+li.dataset.i, e.shiftKey);
    });
    $("#paletteList").addEventListener("mousemove", (e) => {
      const li = e.target.closest("[data-i]");
      if (li && +li.dataset.i !== active) {
        active = +li.dataset.i;
        $$active();
      }
    });
    $("#paletteBtn")?.addEventListener("click", () => openPalette());
    document.addEventListener("keydown", (e) => {
      const a = document.activeElement, typing = a && (["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) || a.isContentEditable);
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !document.querySelector(".modal-backdrop:not([hidden])")) {
        e.preventDefault();
        $("#searchInput")?.focus();
      }
    });
  }
  function $$active() {
    document.querySelectorAll("#paletteList .pal-item").forEach((li) => {
      const on = +li.dataset.i === active;
      li.classList.toggle("active", on);
      li.setAttribute("aria-selected", String(on));
    });
  }

  // src/js/actions.js
  function celebrateTask(id) {
    const card = [...$$(".task-card")].find((el) => el.dataset.taskId === id);
    if (card) {
      card.classList.add("just-done");
      pulseDopamine();
    }
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = card.getBoundingClientRect();
    const originX = rect.left + Math.min(rect.width * 0.18, 56), originY = rect.top + rect.height * 0.35;
    const cs = getComputedStyle(document.body);
    const colors = ["--accent", "--mint", "--amber", "--rose", "--sky"].map((v) => cs.getPropertyValue(v).trim() || "#fff");
    for (let i = 0; i < 18; i++) {
      const bit = document.createElement("i");
      bit.className = "reward-particle";
      bit.style.left = `${originX}px`;
      bit.style.top = `${originY}px`;
      bit.style.setProperty("--dx", `${(Math.random() - 0.35) * 180}px`);
      bit.style.setProperty("--dy", `${-30 - Math.random() * 115}px`);
      bit.style.setProperty("--turn", `${Math.random() * 420 - 210}deg`);
      bit.style.background = colors[i % colors.length];
      document.body.appendChild(bit);
      setTimeout(() => bit.remove(), 850);
    }
  }
  function toggleTaskStatus(task) {
    if (!task) return;
    if (task.status === "done") {
      task.status = "todo";
      task.completedAt = null;
      task.completedForDate = null;
      toast("Задача снова в списке");
    } else {
      task.status = "done";
      task.completedAt = Date.now();
      award("task", { task, anchor: [...$$(".task-card")].find((el) => el.dataset.taskId === task.id)?.querySelector(".check-task") });
      task.completedForDate = task.date;
      task.elapsedMs = taskElapsed(task);
      task.timerStartedAt = null;
      if (data.focusTaskId === task.id) pauseFocus(false);
      toast("Готово! Заметь этот момент ✦");
      playSound("success");
      requestAnimationFrame(() => celebrateTask(task.id));
      if (task.recurrence === "daily") {
        const routineId = task.routineId || task.id;
        const nextDate = toISO(addDays(fromISO(task.date), 1));
        if (!data.tasks.some((t) => t.recurrence === "daily" && (t.routineId || t.id) === routineId && t.date === nextDate)) {
          data.tasks.push(normalizeTask({ ...task, id: uid(), routineId, recurrence: "daily", date: nextDate, status: "todo", xp: 0, completedAt: null, completedForDate: null, elapsedMs: 0, timerStartedAt: null, createdAt: Date.now(), steps: (task.steps || []).map((s) => ({ text: s.text, done: false })) }));
        }
      }
    }
    persist();
    renderAll();
    checkAchievements();
  }
  function startTask(id) {
    const t = data.tasks.find((t2) => t2.id === id);
    if (!t) return;
    if (t.status === "inprogress") {
      t.elapsedMs = taskElapsed(t);
      t.timerStartedAt = null;
      t.status = "todo";
      if (data.focusTaskId === id) pauseFocus(false);
      toast("Таймер задачи на паузе");
    } else {
      data.tasks.forEach((other) => {
        if (other.status === "inprogress") {
          other.elapsedMs = taskElapsed(other);
          other.timerStartedAt = null;
          other.status = "todo";
        }
      });
      if (t.elapsedMs > 0) award("resume");
      t.status = "inprogress";
      t.timerStartedAt = Date.now();
      data.focusTaskId = id;
      data.focusRemainingMs = data.focusMinutes * 6e4;
      toast("Один шаг за раз. Ты начал.");
    }
    persist();
    renderAll();
  }
  function deleteTask(id) {
    const t = data.tasks.find((t2) => t2.id === id);
    if (!t) return;
    const card = [...$$(".task-card")].find((el) => el.dataset.taskId === id);
    if (card) {
      card.classList.add("removing");
      playSound("click");
      setTimeout(() => finishDeleteTask(id), 220);
    } else finishDeleteTask(id);
  }
  function finishDeleteTask(id) {
    const t = data.tasks.find((t2) => t2.id === id);
    if (!t) return;
    if (t.status === "inprogress") {
      t.elapsedMs = taskElapsed(t);
      t.timerStartedAt = null;
    }
    data.tasks = data.tasks.filter((t2) => t2.id !== id);
    if (data.focusTaskId === id) {
      data.focusTaskId = null;
      pauseFocus(false);
    }
    persist();
    renderAll();
    const snapshot2 = JSON.parse(JSON.stringify(t));
    toast("Задача удалена", "success", { label: "Отменить", onClick: () => {
      if (data.tasks.some((x) => x.id === snapshot2.id)) return;
      data.tasks.push(normalizeTask(snapshot2));
      persist();
      renderAll();
      toast("Задача восстановлена");
    } });
  }
  function setFocusTask(id) {
    const t = data.tasks.find((t2) => t2.id === id);
    if (!t) return;
    data.focusTaskId = id;
    data.focusMinutes = 10;
    data.focusRemainingMs = 6e5;
    data.focusRunning = false;
    data.focusStartedAt = null;
    persist();
    renderFocus();
    $("#focusCard").scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Задача выбрана для фокус-сессии");
  }
  function startFocus() {
    if (data.focusRunning) {
      playSound("click");
      pauseFocus(true);
      return;
    }
    playSound("timer");
    if (data.focusRemainingMs <= 0) data.focusRemainingMs = data.focusMinutes * 6e4;
    data.focusRunning = true;
    data.focusStartedAt = Date.now();
    set_focusDeadline(Date.now() + data.focusRemainingMs);
    persist();
    renderFocus();
  }
  function pauseFocus(save = true) {
    if (data.focusRunning && focusDeadline) data.focusRemainingMs = Math.max(0, focusDeadline - Date.now());
    data.focusRunning = false;
    data.focusStartedAt = null;
    set_focusDeadline(null);
    if (save) persist();
    renderFocus();
  }
  function resetFocus() {
    pauseFocus(false);
    data.focusRemainingMs = data.focusMinutes * 6e4;
    persist();
    renderFocus();
  }
  function timerTick() {
    const dayNow = todayISO();
    if (dayNow !== lastRoutineDay) {
      set_lastRoutineDay(dayNow);
      rollDailyRoutines();
      if (data.view === "today") {
        data.selectedDate = dayNow;
        data.calendarOffset = 0;
      }
      persist();
      renderAll();
    }
    if (data.focusRunning) {
      data.focusRemainingMs = Math.max(0, focusDeadline - Date.now());
      if (data.focusRemainingMs === 0) {
        data.focusRunning = false;
        data.focusStartedAt = null;
        set_focusDeadline(null);
        data.focusSessions++;
        award("focus", { minutes: data.focusMinutes });
        const t = data.tasks.find((t2) => t2.id === data.focusTaskId);
        if (t && t.status === "inprogress") {
          t.elapsedMs = taskElapsed(t);
          t.timerStartedAt = null;
          t.status = "todo";
        }
        persist();
        renderAll();
        toast("Фокус-сессия завершена. Встань, потянись, выдохни ✦");
        checkAchievements();
        try {
          if ("Notification" in window && Notification.permission === "granted") new Notification("Focusday", { body: "Фокус-сессия завершена. Хорошая работа!" });
        } catch (_) {
        }
      } else {
        const sec = Math.ceil(data.focusRemainingMs / 1e3);
        if (sec !== lastRenderedSecond) {
          set_lastRenderedSecond(sec);
          renderFocus();
        }
      }
    }
    if (Date.now() - lastTickSave >= 5e3) {
      set_lastTickSave(Date.now());
      if (data.focusRunning) persist();
      if (data.tasks.some((t) => t.status === "inprogress")) renderTasks();
    }
  }
  function renderQuickChoices() {
    const tasks = data.tasks.filter((t) => t.status !== "done").sort((a, b) => b.priority - a.priority).slice(0, 4);
    const root2 = $("#quickTaskChoices");
    if (!tasks.length) {
      root2.innerHTML = '<div class="empty-state"><div class="empty-icon">✧</div><h3>Нечего уменьшать</h3><p>Добавь задачу, которая сейчас кажется большой. Мы найдём самый первый шаг.</p><button data-action="new">＋ Добавить задачу</button></div>';
      return;
    }
    root2.innerHTML = tasks.map((t, i) => `<button class="quick-choice" data-quick-task="${esc(t.id)}"><span class="choice-number">${i + 1}</span><span><strong>${esc(t.title)}</strong><small>${t.steps.length ? `Первый шаг: ${esc(t.steps[0].text)}` : "Начни с открытия нужного файла, сайта или предмета."}</small></span></button>`).join("");
  }
  function suggestSteps() {
    const title = $("#taskTitleInput").value.trim();
    const steps = title ? [
      `Открой всё, что понадобится для «${title}».`,
      "Потрать 2 минуты на самый простой первый шаг.",
      "Продолжай ещё 5 минут, не требуя от себя идеального результата."
    ] : ["Открой нужный файл, сайт или подготовь рабочее место.", "Сделай самое маленькое действие, которое продвигает задачу.", "Поставь таймер на 5 минут и просто продолжай."];
    set_stepDraft(steps.map((text) => ({ text, done: false })));
    renderStepDraft();
    toast("Добавил шаблон микро-шагов — отредактируй под себя");
  }
  function handleAction(action, id, el) {
    const t = data.tasks.find((t2) => t2.id === id);
    switch (action) {
      case "new":
        openModal();
        break;
      case "complete":
        if (t) toggleTaskStatus(t);
        break;
      case "start":
        if (t) startTask(id);
        break;
      case "focus":
        if (t) setFocusTask(id);
        break;
      case "edit":
        if (t) openModal(t);
        break;
      case "delete":
        deleteTask(id);
        break;
      case "steps":
        if (t) {
          if (!t.steps.length) {
            data.focusTaskId = t.id;
            openModal(t);
            $("#newStepInput").focus();
          } else {
            el.closest(".task-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
            const exp = $(".task-expand", el.closest(".task-card"));
            if (exp) exp.classList.toggle("steps-highlight");
          }
        }
        break;
    }
  }
  function bindEvents() {
    $("#overlayBtn")?.addEventListener("click", () => {
      playSound("click");
      window.focusdayDesktop?.openOverlay();
    });
    $("#topAddBtn").addEventListener("click", () => {
      playSound("click");
      openModal();
    });
    $("#inlineAddBtn").addEventListener("click", () => {
      playSound("click");
      openModal();
    });
    $("#fabAddBtn")?.addEventListener("click", () => {
      playSound("click");
      openModal();
    });
    $("#taskForm").addEventListener("submit", saveTask);
    $$("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModals));
    $$(".modal-backdrop").forEach((m) => m.addEventListener("mousedown", (e) => {
      if (e.target === m) closeModals();
    }));
    $("#addStepBtn").addEventListener("click", addDraftStep);
    $("#newStepInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addDraftStep();
      }
    });
    $("#suggestStepsBtn").addEventListener("click", suggestSteps);
    $("#prevWeek").addEventListener("click", () => {
      data.selectedDate = toISO(addDays(fromISO(data.selectedDate), -14));
      data.view = "today";
      persist();
      renderAll();
    });
    $("#nextWeek").addEventListener("click", () => {
      data.selectedDate = toISO(addDays(fromISO(data.selectedDate), 14));
      data.view = "today";
      persist();
      renderAll();
    });
    $("#goToday").addEventListener("click", () => {
      data.selectedDate = todayISO();
      data.calendarOffset = 0;
      data.view = "today";
      persist();
      renderAll();
    });
    $$(".main-nav .nav-item").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
    $("#listNav").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-view]");
      if (b) switchView(b.dataset.view);
    });
    $("#filterPills").addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      data.filter = b.dataset.filter;
      persist();
      renderTasks();
    });
    $("#sortSelect").addEventListener("change", (e) => {
      data.sort = e.target.value;
      persist();
      renderTasks();
    });
    let searchT = null;
    $("#searchInput").addEventListener("input", () => {
      clearTimeout(searchT);
      searchT = setTimeout(renderTasks, 120);
    });
    $("#taskList").addEventListener("click", (e) => {
      const b = e.target.closest("[data-action]");
      if (!b) return;
      handleAction(b.dataset.action, b.dataset.id, b);
    });
    $("#taskList").addEventListener("change", (e) => {
      const cb = e.target.closest('input[data-action="step"]');
      if (!cb) return;
      const t = data.tasks.find((t2) => t2.id === cb.dataset.id), s = t?.steps[Number(cb.dataset.step)];
      if (!s) return;
      s.done = cb.checked;
      if (cb.checked) award("step", { step: s, anchor: cb });
      persist();
      renderTasks();
      playSound(cb.checked ? "success" : "click");
      checkAchievements();
    });
    $("#energyPicks").addEventListener("click", (e) => {
      const b = e.target.closest("[data-energy]");
      if (!b) return;
      data.energy = Number(b.dataset.energy);
      persist();
      renderAll();
      if (data.energy <= 1 && !data.lowEnergy) toast("Сил совсем мало? Можно включить бережный режим — только лёгкое.", "success", { label: "Включить", onClick: () => setLowEnergy(true) });
    });
    $("#soundBtn").addEventListener("click", toggleSound);
    $("#soundSettingsBtn").addEventListener("click", toggleSound);
    $("#themeBtn").addEventListener("click", () => {
      playSound("click");
      data.theme = data.theme === "dark" ? "light" : "dark";
      persist();
      renderAll();
    });
    $("#viewToggle").addEventListener("click", () => {
      data.viewMode = data.viewMode === "list" ? "compact" : "list";
      document.body.classList.toggle("compact-tasks", data.viewMode === "compact");
      $("#viewToggle").setAttribute("aria-pressed", String(data.viewMode === "compact"));
      persist();
      toast(data.viewMode === "compact" ? "Компактный вид включён" : "Обычный вид включён");
    });
    $("#focusStartBtn").addEventListener("click", () => {
      playSound(data.focusRunning ? "click" : "timer");
      if (!data.focusTaskId) {
        const first = data.tasks.find((t) => t.status !== "done" && t.date === data.selectedDate) || data.tasks.find((t) => t.status !== "done");
        if (first) data.focusTaskId = first.id;
      }
      startFocus();
    });
    $("#focusResetBtn").addEventListener("click", resetFocus);
    $("#focusMoreBtn").addEventListener("click", () => {
      if (confirm("Сбросить таймер фокуса?")) resetFocus();
    });
    $("#timerPresets").addEventListener("click", (e) => {
      const b = e.target.closest("[data-minutes]");
      if (!b || data.focusRunning) return;
      playSound("click");
      data.focusMinutes = Number(b.dataset.minutes);
      data.focusRemainingMs = data.focusMinutes * 6e4;
      persist();
      renderFocus();
    });
    $("#tinyStepBtn").addEventListener("click", () => {
      renderQuickChoices();
      showModal("quickModal");
    });
    $("#quickTaskChoices").addEventListener("click", (e) => {
      const b = e.target.closest("[data-quick-task]");
      if (b) {
        const t = data.tasks.find((t2) => t2.id === b.dataset.quickTask);
        if (t) {
          closeModals();
          openModal(t);
          if (!t.steps.length) suggestSteps();
        }
      } else if (e.target.closest('[data-action="new"]')) {
        closeModals();
        openModal();
      }
    });
    $("#settingsBtn").addEventListener("click", () => {
      updateSettingsCount();
      showModal("settingsModal");
    });
    $("#exportBtn").addEventListener("click", exportData);
    $("#exportQuickBtn").addEventListener("click", exportData);
    $("#importInput").addEventListener("change", (e) => {
      importData(e.target.files[0]);
      e.target.value = "";
    });
    $("#clearDoneBtn").addEventListener("click", () => {
      const n = data.tasks.filter((t) => t.status === "done").length;
      if (!n) {
        toast("Завершённых задач пока нет");
        return;
      }
      if (confirm(`Удалить ${n} завершённых задач?`)) {
        data.tasks = data.tasks.filter((t) => t.status !== "done");
        persist();
        renderAll();
        updateSettingsCount();
        toast("Завершённые задачи очищены");
      }
    });
    $("#resetAllBtn").addEventListener("click", () => {
      if (confirm("Удалить ВСЕ задачи, списки и статистику? Сначала скачай резервную копию, если данные важны.")) {
        set_data(freshData());
        persist();
        renderAll();
        updateSettingsCount();
        toast("Дневник очищен");
      }
    });
    $("#addListBtn").addEventListener("click", () => {
      $("#listForm").reset();
      $("#listColorInput").value = "#a78bfa";
      showModal("listModal");
      $("#listNameInput").focus();
    });
    $("#listModal").addEventListener("click", (e) => {
      const b = e.target.closest("[data-color]");
      if (b) {
        $("#listColorInput").value = b.dataset.color;
        $$("[data-color]").forEach((x) => x.classList.toggle("selected", x === b));
      }
    });
    $("#listForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#listNameInput").value.trim();
      if (!name) return;
      if (data.lists.some((l) => l.name.toLocaleLowerCase("ru") === name.toLocaleLowerCase("ru"))) {
        toast("Такой список уже есть", "error");
        return;
      }
      data.lists.push({ id: "list_" + uid(), name, color: /^#[0-9a-f]{6}$/i.test($("#listColorInput").value) ? $("#listColorInput").value : "#a78bfa" });
      persist();
      closeModals();
      $("#listForm").reset();
      $$("[data-color]").forEach((x) => x.classList.toggle("selected", x.dataset.color === "#a78bfa"));
      renderAll();
      updateSettingsCount();
      toast("Новый список создан");
    });
    $("#achievementsBtn").addEventListener("click", () => {
      renderAchievements();
      showModal("achievementsModal");
    });
    $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    document.addEventListener("keydown", (e) => {
      const active2 = document.activeElement;
      const typing = !!active2 && (["INPUT", "TEXTAREA", "SELECT"].includes(active2.tagName) || active2.isContentEditable);
      const modalOpen = $$(".modal-backdrop:not([hidden])").length > 0;
      if (e.key === "Escape") {
        if (modalOpen) closeModals();
        else if (document.body.classList.contains("focus-mode")) setFocusMode(false);
        else if (typing) active2.blur();
        return;
      }
      if (!typing && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        const views = { "1": "today", "2": "inbox", "3": "upcoming", "4": "done", "5": "habits", "6": "money", "7": "journal" };
        if (k === "l" || k === "д") {
          e.preventDefault();
          setLowEnergy(!data.lowEnergy);
          return;
        }
        if (views[k]) {
          e.preventDefault();
          switchView(views[k]);
          return;
        }
        if (k === "f" || k === "а") {
          e.preventDefault();
          setFocusMode(!document.body.classList.contains("focus-mode"));
          return;
        }
        if (k === "c" || k === "с") {
          e.preventDefault();
          setCompress(!data.compress);
          return;
        }
        if (k === "q" || k === "й") {
          e.preventDefault();
          focusQuickCapture();
          return;
        }
        if (e.code === "Space" && !(active2 && active2.closest("button,a,label,[role=button]"))) {
          e.preventDefault();
          $("#focusStartBtn").click();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === "?" && $$(".modal-backdrop:not([hidden])").length === 0) {
        e.preventDefault();
        showModal("shortcutsModal");
        return;
      }
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key.toLowerCase() === "n" || e.key.toLowerCase() === "т") && $$(".modal-backdrop:not([hidden])").length === 0) {
        e.preventDefault();
        openModal();
      }
    });
  }

  // src/js/features/cat-ui.js
  var CAT_SVG = `<svg class="cat-svg" viewBox="0 0 160 150" aria-hidden="true" focusable="false">
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
  var CAT_TEXT = {
    idle: "Ты всё ещё в потоке или сделаем паузу? 🐾",
    away: "Тебя давно не было — я поставил фокус на паузу. Время простоя не сгорело, всё на месте.",
    break: "Перерыв ☕ Встань, попей воды, посмотри в окно.",
    back: "Перерыв окончен. Вернёмся к делу? 🐾"
  };
  var fmt = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1e3));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  function catActions(mode2) {
    if (mode2 === "alert") return [["snooze", "Продолжаю 🐾", true], ["pause", "Взял паузу ☕"]];
    if (mode2 === "away") return [["resume", "Продолжить фокус", true], ["close", "Позже"]];
    if (mode2 === "break") return [["resume", "Вернуться раньше"], ["extend", "+5 минут"]];
    if (mode2 === "back") return [["resume", "Продолжить фокус 🐾", true], ["extend", "Ещё 5 минут"]];
    return [];
  }
  function mountCat(root2, onAction) {
    root2.innerHTML = `<div class="cat-bubble" hidden role="status" aria-live="polite"><p class="cat-text"></p><strong class="cat-count" hidden></strong><div class="cat-actions"></div><button type="button" class="cat-mute" data-cat="mute" hidden>Не беспокоить в эту сессию</button></div>
    <button type="button" class="cat" aria-label="Котик-напарник: нажми, чтобы погладить">${CAT_SVG}</button>`;
    root2.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (b) onAction(b.dataset.cat);
      else if (e.target.closest(".cat")) onAction("pet");
    });
    const cat = root2.querySelector(".cat");
    const blink = () => {
      cat.classList.add("blink");
      setTimeout(() => cat.classList.remove("blink"), 140);
      setTimeout(blink, 2800 + Math.random() * 4200);
    };
    setTimeout(blink, 1800);
    return root2;
  }
  function paintCat(root2, st) {
    const mode2 = st?.mode || "hidden", cat = root2.querySelector(".cat"), bub = root2.querySelector(".cat-bubble");
    root2.hidden = mode2 === "hidden";
    root2.dataset.mode = mode2;
    cat.classList.toggle("alert", ["alert", "back", "away"].includes(mode2));
    cat.classList.toggle("sleep", mode2 === "break");
    const speaking = mode2 !== "idle" && mode2 !== "hidden";
    bub.hidden = !speaking;
    if (!speaking) return;
    bub.querySelector(".cat-text").textContent = st.text || CAT_TEXT[mode2 === "alert" ? "idle" : mode2] || "";
    const cnt = bub.querySelector(".cat-count");
    cnt.hidden = mode2 !== "break";
    if (mode2 === "break") cnt.textContent = fmt((st.breakEndsAt || 0) - Date.now());
    const acts = catActions(mode2), box = bub.querySelector(".cat-actions"), sig = acts.map((a) => a[0]).join();
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.innerHTML = acts.map(([id, label, primary]) => `<button type="button" data-cat="${id}" class="${primary ? "primary" : ""}">${label}</button>`).join("");
    }
    bub.querySelector(".cat-mute").hidden = mode2 !== "alert";
  }

  // src/js/features/companion.js
  var AWAY_AUTO_PAUSE_MS = 10 * 6e4;
  var root = null;
  var mode = "hidden";
  var alertAt = 0;
  var lastNudgeAt = 0;
  var sessionMuted = false;
  var purrUntil = 0;
  var wasRunning = false;
  var webIdle = { detector: null, state: "active", abort: null };
  var desktop = () => window.focusdayDesktop;
  function ensureBuddy(d = data) {
    const b = d.buddy && typeof d.buddy === "object" ? d.buddy : {};
    b.enabled = b.enabled !== false;
    b.idleNudge = b.idleNudge !== false;
    b.idleMin = [10, 15, 20, 30].includes(+b.idleMin) ? +b.idleMin : 15;
    b.breakMin = Math.max(1, Math.min(30, +b.breakMin || 5));
    b.breakUntil = Number(b.breakUntil) || 0;
    d.buddy = b;
    return b;
  }
  function idleSource() {
    if (window.__FD_TEST_IDLE__ !== void 0) return "test";
    if (desktop()?.idleSeconds) return "system";
    if (webIdle.detector) return "web";
    return null;
  }
  async function idleSeconds() {
    const src = idleSource(), b = ensureBuddy();
    if (src === "test") return Number(window.__FD_TEST_IDLE__) || 0;
    if (src === "system") {
      try {
        const s = await desktop().idleSeconds();
        if (s !== null && s !== void 0) return Number(s);
      } catch (_) {
      }
      return null;
    }
    if (src === "web") return webIdle.state === "idle" ? b.idleMin * 60 : 0;
    return null;
  }
  async function enableWebIdle(ask = true) {
    if (!("IdleDetector" in window)) {
      toast("Этот браузер не умеет определять простой. Работает в Chrome/Edge и в EXE-версии.", "error");
      return false;
    }
    try {
      if (ask && await window.IdleDetector.requestPermission() !== "granted") {
        toast("Разрешение не выдано — котик просто будет рядом", "error");
        return false;
      }
      webIdle.abort?.abort();
      webIdle.abort = new AbortController();
      const det = new window.IdleDetector();
      det.addEventListener("change", () => {
        webIdle.state = det.userState;
      });
      await det.start({ threshold: Math.max(6e4, ensureBuddy().idleMin * 6e4), signal: webIdle.abort.signal });
      webIdle.detector = det;
      ensureBuddy().webIdle = true;
      persist();
      renderBuddySettings();
      return true;
    } catch (e) {
      webIdle.detector = null;
      renderBuddySettings();
      return false;
    }
  }
  function state() {
    const b = ensureBuddy(), left = Math.max(0, data.focusRemainingMs || 0);
    const st = { mode, breakEndsAt: b.breakUntil };
    if (mode === "purr") st.text = `Мур. Я рядом. Осталось ${Math.ceil(left / 6e4)} мин — работаем 🐾`;
    return st;
  }
  function paint3() {
    const st = state();
    const useWindow = !!desktop()?.buddy;
    document.body.classList.toggle("desktop-buddy", useWindow);
    if (root) paintCat(root, useWindow ? { mode: "hidden" } : st);
    if (useWindow) desktop().buddy(st).catch?.(() => {
    });
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    paint3();
  }
  function buddyAction(a) {
    const b = ensureBuddy();
    if (a === "pet") {
      if (mode === "idle") {
        purrUntil = Date.now() + 4e3;
        setMode("purr");
        playSound("click");
      }
      return;
    }
    if (a === "snooze") {
      lastNudgeAt = Date.now();
      alertAt = 0;
      setMode("idle");
      toast("Отлично, продолжаем 🐾");
      return;
    }
    if (a === "mute") {
      sessionMuted = true;
      alertAt = 0;
      setMode("idle");
      toast("До конца сессии котик не будет будить");
      return;
    }
    if (a === "pause") {
      pauseFocus();
      b.breakUntil = Date.now() + b.breakMin * 6e4;
      alertAt = 0;
      persist();
      award("catbreak");
      checkAchievements();
      setMode("break");
      return;
    }
    if (a === "extend") {
      b.breakUntil = Math.max(Date.now(), b.breakUntil) + 5 * 6e4;
      persist();
      setMode("break");
      paint3();
      return;
    }
    if (a === "resume") {
      b.breakUntil = 0;
      alertAt = 0;
      lastNudgeAt = Date.now();
      persist();
      if (!data.focusRunning) startFocus();
      setMode("idle");
      return;
    }
    if (a === "close") {
      b.breakUntil = 0;
      persist();
      setMode(data.focusRunning ? "idle" : "hidden");
    }
  }
  var busy = false;
  async function buddyTick(now = Date.now()) {
    if (busy) return;
    busy = true;
    try {
      const b = ensureBuddy(), running2 = !!data.focusRunning;
      if (running2 && !wasRunning) {
        sessionMuted = false;
        lastNudgeAt = now;
      }
      wasRunning = running2;
      if (b.breakUntil) {
        if (running2) {
          b.breakUntil = 0;
          persist();
        } else if (now >= b.breakUntil) {
          if (mode !== "back") {
            setMode("back");
            playSound("timer");
            try {
              if ("Notification" in window && Notification.permission === "granted") new Notification("Focusday", { body: CAT_TEXT.back });
            } catch (_) {
            }
          }
          return;
        } else {
          setMode("break");
          paint3();
          return;
        }
      }
      if (mode === "back" || mode === "away") {
        if (running2) setMode("idle");
        return;
      }
      if (!running2 || !b.enabled) {
        setMode("hidden");
        return;
      }
      if (mode === "purr" && now > purrUntil) setMode("idle");
      if (mode === "alert") {
        if (now - alertAt >= AWAY_AUTO_PAUSE_MS) {
          pauseFocus();
          alertAt = 0;
          setMode("away");
        }
        return;
      }
      if (mode === "hidden") setMode("idle");
      if (!b.idleNudge || sessionMuted) return;
      const idle = await idleSeconds();
      if (idle === null) return;
      if (idle >= b.idleMin * 60 && now - lastNudgeAt >= b.idleMin * 6e4) {
        alertAt = now;
        lastNudgeAt = now;
        setMode("alert");
        playSound("timer");
        desktop()?.attention?.();
      }
    } finally {
      busy = false;
    }
  }
  function renderBuddySettings() {
    const b = ensureBuddy();
    $("#buddyEnabled")?.setAttribute("aria-pressed", String(b.enabled));
    $("#buddyNudge")?.setAttribute("aria-pressed", String(b.idleNudge));
    const sel = $("#buddyIdleMin");
    if (sel) sel.value = String(b.idleMin);
    const st = $("#buddyStatus"), src = idleSource();
    if (st) st.textContent = src === "system" ? "Детектор: системный ввод Windows (мышь и клавиатура в любом приложении)" : src === "web" ? "Детектор: Idle Detection API браузера (весь компьютер)" : src === "test" ? "Детектор: тестовый режим" : "Детектор недоступен в этом браузере — котик просто сидит рядом. В EXE-версии работает всегда.";
    const allow = $("#buddyAllowWeb");
    if (allow) allow.hidden = !!src || !("IdleDetector" in window);
  }
  function bindBuddy() {
    ensureBuddy();
    root = $("#catBuddy");
    if (root) mountCat(root, buddyAction);
    desktop()?.onBuddyAction?.(buddyAction);
    $("#buddyEnabled")?.addEventListener("click", () => {
      const b = ensureBuddy();
      b.enabled = !b.enabled;
      persist();
      renderBuddySettings();
      buddyTick();
    });
    $("#buddyNudge")?.addEventListener("click", () => {
      const b = ensureBuddy();
      b.idleNudge = !b.idleNudge;
      persist();
      renderBuddySettings();
    });
    $("#buddyIdleMin")?.addEventListener("change", (e) => {
      ensureBuddy().idleMin = +e.target.value;
      persist();
      if (webIdle.detector) enableWebIdle(false);
      renderBuddySettings();
    });
    $("#buddyAllowWeb")?.addEventListener("click", () => enableWebIdle(true));
    if (ensureBuddy().webIdle && "IdleDetector" in window) enableWebIdle(false);
    setInterval(() => buddyTick(), 5e3);
    setInterval(() => {
      if (mode === "break") paint3();
    }, 1e3);
    buddyTick();
    renderBuddySettings();
  }

  // src/js/main.js
  function updateSettingsCount() {
    $("#taskDataCount").textContent = `${data.tasks.length} ${plural(data.tasks.length, ["задача", "задачи", "задач"])} · ${data.lists.length} ${plural(data.lists.length, ["список", "списка", "списков"])}`;
  }
  function safe(name, fn) {
    try {
      fn();
    } catch (err) {
      console.error(`Focusday: модуль «${name}» не запустился`, err);
    }
  }
  function init() {
    loadData();
    rollDailyRoutines();
    const systemToday = todayISO();
    if (!validDate(data.selectedDate)) data.selectedDate = systemToday;
    if (data.view === "today" && data.selectedDate !== systemToday) {
      data.selectedDate = systemToday;
      data.calendarOffset = 0;
    }
    if (data.focusRunning) {
      data.focusRunning = false;
      data.focusStartedAt = null;
    }
    ensureLife();
    ensureQuotes();
    ensureAmbient();
    ensureBuddy();
    bindEvents();
    bindAdhd();
    bindProgress();
    bindLife();
    safe("quotes", bindQuotes);
    safe("ambient", bindAmbient);
    safe("companion", bindBuddy);
    safe("palette", bindPalette);
    safe("softplan", bindSoftPlan);
    safe("sync-ui", bindSyncUI);
    initProgress();
    document.body.classList.toggle("compress-mode", !!data.compress);
    $("#compressBtn")?.setAttribute("aria-pressed", String(!!data.compress));
    $("#viewToggle")?.setAttribute("aria-pressed", String(data.viewMode === "compact"));
    renderAll();
    checkAchievements();
    syncSoundButtons();
    updateSettingsCount();
    document.body.classList.toggle("compact-tasks", data.viewMode === "compact");
    set_tickHandle(setInterval(timerTick, 250));
    safe("sync", () => SyncEngine.start());
    window.addEventListener("beforeunload", persistNow);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) persistNow();
    });
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.__TAURI__) navigator.serviceWorker.register("sw.js").catch(() => {
    });
    if (window.__FD_TEST_IDLE__ !== void 0) window.__FD_TEST__ = { buddyTick, buddyAction, get data() {
      return data;
    } };
  }
  if (typeof document !== "undefined" && document.getElementById("taskList")) init();
})();
