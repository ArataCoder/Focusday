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
      out.quotes = { ...iq, ...lq, hidden: [.../* @__PURE__ */ new Set([...lq.hidden || [], ...iq.hidden || []])], custom: [...custom.values()], fav: [.../* @__PURE__ */ new Set([...lq.fav || [], ...iq.fav || []])] };
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
    document.body.classList.toggle("light-theme", data.theme === "light" || data.theme === "auto" && !!window.matchMedia?.("(prefers-color-scheme: light)").matches);
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
  function weekHasPause(mon, pauses) {
    const start = new Date(mon);
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, 7);
    return pauses.some(([from, to]) => Number(from) < end.getTime() && Number(to) > start.getTime());
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
    const pausedWeek = (mon) => weekHasPause(mon, pauses);
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
      openSettings("sync");
      setTimeout(() => $("#vaultPass")?.focus(), 60);
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
    if (!["dark", "light", "auto"].includes(data.theme)) data.theme = "dark";
    data.calmMotion = !!data.calmMotion;
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

  // src/js/features/settings.js
  var TABS = ["look", "buddy", "quotes", "sync", "data"];
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  function resolvedTheme(theme = data.theme) {
    if (theme === "auto") return mq && mq.matches ? "light" : "dark";
    return theme === "light" ? "light" : "dark";
  }
  function applyTheme() {
    const light = resolvedTheme() === "light";
    document.body.classList.toggle("light-theme", light);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#f4f2fb" : "#0b0b14");
  }
  function setTab(tab, focus = false) {
    if (!TABS.includes(tab)) tab = "look";
    $$(".set-tab").forEach((b) => {
      const on = b.dataset.setTab === tab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
      if (on) b.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });
    $$(".set-pane").forEach((p) => {
      p.hidden = p.dataset.setPane !== tab;
    });
    const panes = $(".set-panes");
    if (panes) panes.scrollTop = 0;
    try {
      sessionStorage.setItem("fd-set-tab", tab);
    } catch (_) {
    }
  }
  function openSettings(tab) {
    const btn = $("#settingsBtn");
    if (btn) btn.click();
    else showModal("settingsModal");
    if (tab) setTab(tab);
  }
  function renderSettings() {
    applyTheme();
    $$("#themeSeg [data-theme-set]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themeSet === (data.theme || "dark"))));
    document.body.classList.toggle("calm-motion", !!data.calmMotion);
    $("#calmMotion")?.setAttribute("aria-pressed", String(!!data.calmMotion));
  }
  function bindSettings() {
    const nav = $(".set-tabs");
    if (!nav) return;
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-set-tab]");
      if (b) setTab(b.dataset.setTab);
    });
    nav.addEventListener("keydown", (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!(e.key in keys) && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const cur = TABS.indexOf($(".set-tab[aria-selected=true]")?.dataset.setTab);
      const next = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (cur + keys[e.key] + TABS.length) % TABS.length;
      setTab(TABS[next], true);
    });
    $("#themeSeg")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-theme-set]");
      if (!b) return;
      data.theme = b.dataset.themeSet;
      persist();
      renderAll();
    });
    $("#calmMotion")?.addEventListener("click", () => {
      data.calmMotion = !data.calmMotion;
      persist();
      renderSettings();
    });
    mq?.addEventListener?.("change", () => {
      if (data.theme === "auto") applyTheme();
    });
    let saved = null;
    try {
      saved = sessionStorage.getItem("fd-set-tab");
    } catch (_) {
    }
    setTab(saved || "look");
    renderHooks.push(["settings", renderSettings]);
    renderSettings();
  }

  // src/js/features/quotes/gentle.js
  var gentle_default = String.raw`
@Focusday|Фокус-напоминание
g Одна задача. Одно окно. Один следующий шаг.
g Сейчас не нужно делать всё. Нужно сделать вот это.
g Закрой лишнюю вкладку — она подождёт.
g Если сложно начать, начни с самой скучной и простой части.
g Пять минут работы лучше часа сборов.
g Не ищи идеальное время. Это и есть время.
g Поставь таймер и разреши себе сделать плохо.
g Сделай первый шаг таким маленьким, чтобы было смешно не сделать.
g Ты уже здесь. Это половина дела.
g Проверь: ты сейчас делаешь то, что собирался?
g Если отвлёкся — просто вернись. Без разборов.
g Возвращение к задаче — тоже навык. И ты его тренируешь.
g Сначала — одна строчка. Дальше станет легче.
g Мозг разгоняется в процессе, а не до него.
g Запиши мешающую мысль и вернись к делу.
g Сделай глоток воды и продолжай.
g Телефон экраном вниз — и ещё десять минут.
g Не держи всё в голове. Для этого есть список.
g Ты не обязан закончить сегодня. Ты можешь продвинуться.
g Двигаться медленно — всё равно двигаться.
g Сфокусируйся на ближайших 10 минутах.
g Сложное становится простым, когда разбито на шаги.
g Не знаешь, что делать дальше? Сделай самое очевидное.
g Пусть будет черновик. Черновик можно улучшить, пустоту — нет.
g Проще начать, чем думать о начале.
g Выдохни. Плечи вниз. Теперь — одно дело.
g Самая важная задача — та, что перед тобой.
g Отложи «идеально» на потом. Сейчас — «готово».
g Ты можешь сделать это криво. Главное — сделать.
g Если задача пугает — уменьши её ещё вдвое.
g Сейчас ты в потоке. Береги его.
g Не нужно мотивации. Нужно две минуты.
g Сначала сделай, потом оценивай.
g Каждая галочка — маленькая победа. Собери ещё одну.
g Хватит одного шага, чтобы день стал не пустым.
g Тихий час работы стоит больше громкого плана.
g Любая задача начинается с того, что ты её открываешь.
g Открой файл. Это всё, что нужно прямо сейчас.
g Одно маленькое «сделано» меняет настроение дня.
g Фокус — это не сила воли, а меньше отвлекающего вокруг.
g Музыка без слов, вода рядом, телефон подальше. Поехали.
g Если устал — сделай паузу, а не стыд.
g Сделай ровно столько, сколько получится. Это засчитывается.
g Разреши себе работать короткими забегами.
g Задача не обязана нравиться, чтобы быть сделанной.
g Ты не ленивый. Тебе просто нужен понятный первый шаг.
g Сформулируй следующее действие глаголом — и сделай его.
g Не думай о всей горе. Посмотри на следующий камень.
g Сегодня достаточно сдвинуть одну вещь с места.
g Когда трудно — сделай легче, а не бросай.
g Фокус приходит к тем, кто начинает без него.
g Начинай некрасиво. Красиво получится потом.
g Если не можешь сосредоточиться — сделай что-то руками пять минут.
g Встань, потянись, вернись. Задача никуда не ушла.
g Прогресс любит регулярность, а не героизм.
g Достаточно хорошо — значит достаточно.
g Большие дела делаются из скучных маленьких.
g Каждый раз, когда ты возвращаешься, ты становишься сильнее.
g Ты справлялся раньше. Справишься и с этим шагом.
@Focusday|Бережность к себе
g Пропущенный день — это пауза, а не приговор.
g Отдых — часть плана, а не награда за истощение.
g Ты не отстаёшь. Ты идёшь своим темпом.
g Говори с собой так, как говорил бы с лучшим другом.
g Ошибка — это информация, а не оценка тебя.
g Не сравнивай свой черновик с чужим финалом.
g Сегодня можно меньше. Завтра снова можно больше.
g Ты имеешь право на медленные дни.
g Хорошие дни бывают разные. Тихие — тоже хорошие.
g Сделанное наполовину лучше несделанного полностью.
g Будь терпелив к себе. Ты растёшь.
g Усталость — это сигнал, а не слабость.
g Твоя ценность не измеряется списком дел.
g Ты не обязан быть продуктивным, чтобы быть достойным.
g Иногда лучшая задача на сегодня — выспаться.
g Мягкость к себе — не слабость. Это топливо.
g Неудачный час не делает неудачным весь день.
g Можно начать заново в любую минуту, не дожидаясь понедельника.
g Ты сделал больше, чем замечаешь.
g Перенести задачу — это решение, а не провал.
g Не нужно заслуживать отдых.
g Ты не опоздал. Ты начинаешь сейчас.
g Сначала позаботься о себе, потом о списке.
g Любой прогресс — прогресс.
g Если сегодня тяжело, сделай одну заботливую вещь для себя.
g Ты можешь быть в процессе и при этом быть в порядке.
g Не всё нужно чинить сегодня.
g Ты учишься, а не сдаёшь экзамен.
g Твой темп — правильный темп.
g Ты можешь гордиться маленьким.
g Сегодня ты уже сделал главное — не сдался.
g Ничего страшного, если план изменился. Планы для этого и существуют.
g Ты больше, чем твоя продуктивность.
g Поешь, попей воды, подыши. Потом решим остальное.
g Хорошо — это уже хорошо.
g Ты можешь отдыхать без чувства вины.
g Никто не делает всё. Все делают что-то.
g Даже если сегодня ты сделал мало, ты всё ещё на пути.
g Позволь себе быть новичком.
g Тебе не нужно чувствовать себя готовым, чтобы начать.
g Сегодняшний ты делает лучшее из возможного сегодня.
g Береги энергию для того, что действительно важно.
g Скажи себе спасибо за то, что пытаешься.
g Если не получается, значит, нужно другое время или другой шаг.
g Не ругай себя за отвлечения — мягко возвращайся.
g Ты имеешь право на ошибки. Все имеют.
g Важно не то, как часто ты сбивался, а то, что ты возвращаешься.
g Небольшой шаг сегодня — подарок себе завтрашнему.
g Ты не один в этом. Многим так же сложно начать.
g Пусть сегодня будет достаточно того, что есть.
g Можно не спешить. Можно просто идти.
g Слабый день — тоже день. Он считается.
g Остановиться — не значит сдаться.
g Твоя дорога не обязана быть прямой.
g Ты достаточно хорош уже сейчас.
@Focusday|Про СДВГ
g Твой мозг не сломан. Ему просто нужны другие инструменты.
g Интерес — твоё топливо. Найди в задаче что-то интересное.
g Таймер — не надзиратель, а напарник.
g Внешняя структура — не костыль, а умная настройка.
g Если не помнишь — запиши. Это не слабость, а система.
g Новизна помогает: смени место, музыку или порядок шагов.
g Скучную задачу можно превратить в игру на время.
g Сделай задачу видимой — то, чего не видно, исчезает из головы.
g Срочность — двигатель. Создай маленький дедлайн сам.
g Работай рядом с кем-то — даже виртуальный напарник помогает.
g Гиперфокус — суперсила. Поставь будильник, чтобы не забыть поесть.
g Слепота ко времени реальна. Пусть время будет видно.
g Ты не ленишься. Тебе трудно начать — это разные вещи.
g Награди себя сразу, а не когда-нибудь потом.
g Начни с того, что ближе всего лежит.
g Разбей задачу на шаги, которые занимают минуту.
g Убери с глаз всё, что тянет внимание.
g Правило двух минут: если дело на две минуты — сделай сейчас.
g Если мысли разбегаются — выпиши их все на бумагу.
g Сначала тело: движение помогает мозгу включиться.
g Ты можешь иметь систему, которая работает на тебя, а не против.
g Ничего страшного, что ты забыл. Важно, что вспомнил.
g Если задача висит неделю — ей нужен первый шаг поменьше.
g Сделай день проще: три главных дела, не больше.
g Белый шум, дождь или кафе — подбери звук, в котором тебе легче.
g Хаос в голове — повод записать, а не повод винить себя.
g Энергия скачет — и это нормально. Подстрой план под заряд.
g Добрый план учитывает, что ты человек.
g Когда всё срочно — ничего не срочно. Выбери одно.
g Ты можешь начать с середины. Это тоже начало.
@Focusday|Про отдых
g Отдохнуть — тоже продуктивно.
g Пять минут у окна перезагружают лучше, чем лента.
g Перерыв без телефона отдыхает в два раза лучше.
g Встань и пройдись — мысли догонят.
g Сон — лучший инструмент концентрации.
g Пауза каждые полчаса — это забота, а не лень.
g Отдых не нужно заслуживать — его нужно планировать.
g Иногда лучшая идея приходит в душе. Отойди от экрана.
g Медленный вдох, медленный выдох. Повтори три раза.
g Разомни шею и плечи. Тело тоже работало.
g Прогулка — бесплатная перезагрузка для мозга.
g Если всё раздражает — пора поесть и отдохнуть.
g Перерыв окончен — мягко возвращаемся к одному делу.
g Отдыхай до того, как выгоришь, а не после.
g Посмотри вдаль двадцать секунд — глаза скажут спасибо.
@Focusday|Тёплые слова
g Ты стараешься. Это видно.
g Сегодня ты ближе к цели, чем вчера.
g Маленькие шаги тоже ведут далеко.
g У тебя получится. Не сразу — но получится.
g Каждый день — новая попытка.
g Ты умеешь больше, чем думаешь.
g Не бойся медленного прогресса. Бойся стоять на месте.
g Ты строишь свою жизнь кирпичик за кирпичиком.
g Однажды ты оглянешься и удивишься, как далеко зашёл.
g Сделай сегодня что-то, за что завтрашний ты скажет спасибо.
g Хорошие привычки растут тихо.
g Ты на правильном пути, даже если он извилистый.
g Иногда «продолжать» — уже подвиг.
g Свет в конце дня — это твоя закрытая задача.
g Ты можешь гордиться тем, что не сдаёшься.
g Твоё усилие имеет значение.
g Начни там, где стоишь. Этого достаточно.
g Сегодня хороший день, чтобы сделать что-то маленькое.
g Верь процессу, даже когда не видно результата.
g Шаг за шагом — и дорога сама ляжет под ноги.
g Ты сильнее своей прокрастинации.
g Твой будущий ты уже благодарен.
g Ничего не делается сразу. Всё делается постепенно.
g Пусть сегодня будет на один шаг лучше вчера.
g Секрет простой: возвращаться снова и снова.
g Ты уже знаешь, с чего начать.
g Небольшой порядок вокруг — небольшой порядок в голове.
g Делай для себя, а не для галочки.
g Ты можешь гордиться прожитым днём.
@Focusday|Утро и вечер
g Утро не обязано быть идеальным. Пусть просто начнётся.
g Выбери одно главное дело на сегодня.
g Начни утро с самого лёгкого — и разгонись.
g Что сделает сегодняшний день хорошим? Сделай это первым.
g Вечер — время закрывать день, а не начинать новые дела.
g Запиши три вещи, которые получились сегодня.
g Перенеси несделанное на завтра — и отпусти.
g Хороший вечер — подготовка хорошего утра.
g Сегодня закончилось. Ты сделал, что мог.
g Подготовь на завтра одну простую задачу-разгонку.
g Утром — план на день. Вечером — спасибо себе.
g Завтра будет новая попытка. А сейчас — отдых.
@Энн Ламотт|TED, 2017
g Почти всё снова заработает, если отключить это на пару минут. Даже ты.
@Энн Ламотт|«Птица за птицей»
g Птица за птицей, дружок. Просто разбирай их по одной.
g Перфекционизм — голос угнетателя, злейший враг.
@Рассел Баркли|исследователь СДВГ
g СДВГ — это не расстройство знания, что делать. Это трудность с тем, чтобы делать то, что знаешь.
g Помогайте там, где действие должно случиться — в точке выполнения.
@Эдвард Хэллоуэлл|«Driven to Distraction» · по мотивам
g Мозг с СДВГ — как двигатель гоночной машины с тормозами от велосипеда. Тормоза можно укрепить.
@Фред Роджерс|«Mister Rogers' Neighborhood»
g Ты сделал этот день особенным просто тем, что был собой.
g Когда я был мальчиком и видел страшное, мама говорила: «Ищи помогающих. Они всегда есть».
@Тит Нат Хан|«Мир в каждом шаге»
g Улыбайся, дыши и иди медленно.
g Чувства приходят и уходят, как облака в ветреном небе. Сознательное дыхание — мой якорь.
@Мэри Энн Радмахер|
g Смелость не всегда ревёт. Иногда смелость — тихий голос в конце дня: «Я попробую снова завтра».
@Майя Энджелоу|приписывается
g Ты можешь столкнуться со многими поражениями, но ты не должен быть побеждён.
@Кристофер Робин|«Большое путешествие Пуха», 1997
g Ты храбрее, чем думаешь, сильнее, чем кажешься, и умнее, чем считаешь.
@Дори|«В поисках Немо»
g Просто продолжай плыть.
@Гэндальф|«Властелин колец: Братство кольца»
g Нам остаётся решить лишь одно: что делать со временем, которое нам дано.
@Сэмуайз Гэмджи|«Властелин колец: Две крепости»
g В этом мире есть добро, и за него стоит бороться.
@Альбус Дамблдор|«Гарри Поттер и узник Азкабана»
g Счастье можно найти даже в самые тёмные времена, если не забывать обращаться к свету.
@Альберт Эйнштейн|письмо сыну Эдуарду, 1930
g Жизнь как езда на велосипеде: чтобы сохранить равновесие, нужно двигаться.
@Дядюшка Айро|«Аватар: Легенда об Аанге»
g Иногда жизнь похожа на тёмный туннель. Но если продолжать идти, ты обязательно придёшь в лучшее место.
g Нет ничего плохого в том, чтобы позволить другим помочь тебе.
g Гордость — не противоположность стыда, а его источник.
g Чашка хорошего чая — повод остановиться и выдохнуть.
@Тед Лассо|«Тед Лассо»
g Будь любопытным, а не осуждающим.
g Я верю в надежду. Я верю в веру.
g Знаешь, какое животное самое счастливое на свете? Золотая рыбка. У неё память десять секунд. Будь золотой рыбкой.
@Мэри Оливер|«Летний день»
g Скажи, что ты собираешься сделать со своей единственной, дикой и драгоценной жизнью?
@Брене Браун|«Дары несовершенства» · по мотивам
g Несовершенство — не недостаток. Это то, что делает нас людьми.
@Пятачок и Пух|А. А. Милн · по мотивам
g Иногда самые маленькие вещи занимают больше всего места в твоём сердце.
@Хаяо Миядзаки|интервью · по мотивам
g Многие важные вещи делаются медленно и вручную.
@Focusday|Маленькие шаги
g Достаточно открыть документ. Остальное — потом.
g Сделай одну строку, один звонок, одно письмо.
g Мелкий шаг тоже двигает гору.
g Один шаг в день — 365 шагов в год.
g Закончи одно маленькое дело — и почувствуй, как стало легче.
g Задача на пять минут? Сделай сейчас и выдохни.
g Ещё один маленький кусочек — и перерыв.
g Пусть первый шаг будет настолько простым, что его нельзя испортить.
g Начни с того, что займёт меньше минуты.
g Разложи на столе всё нужное — это уже начало.
g Назови задачу вслух — так она становится реальнее.
g Не «сделать отчёт», а «открыть таблицу». Начни с глагола поменьше.
g Сначала просто посмотри на задачу. Без обязательств.
g Сделай одну вещь лучше, чем вчера.
g Если получилось хоть немного — это уже получилось.
g Маленькая победа утром задаёт тон всему дню.
g Каждая выполненная мелочь — разгрузка для головы.
g Нет слишком маленьких шагов. Есть только шаги.
g Чуть-чуть каждый день — и однажды окажется очень много.
g Сегодня одна страница — через месяц книга.
@Focusday|Тревога и шум в голове
g Мысли — не факты. Их можно записать и отложить.
g Если тревожно — назови пять вещей, которые видишь вокруг.
g Тревога любит будущее. Вернись в эту минуту.
g Ты не обязан решать всё сразу. Реши следующую мелочь.
g Запиши всё, что крутится в голове, — и выбери одно.
g Когда шумно внутри, помогает простое действие руками.
g Неопределённость пугает. Маленький план её уменьшает.
g Ты справляешься лучше, чем говорит тебе тревога.
g Дыши медленно: вдох на четыре, выдох на шесть.
g Беспокойство не сделает работу. Пять минут работы — сделают.
g Худший сценарий редко сбывается. Сделай то, что зависит от тебя.
g Перегруз — сигнал отложить половину, а не ускориться.
g Сделай паузу и спроси себя: что мне сейчас нужно?
g Хаос снаружи не обязан становиться хаосом внутри.
g Ни одна мысль не требует ответа немедленно.
@Focusday|Привычки
g Привычка растёт из повторения, а не из идеальности.
g Минимальная версия привычки тоже считается.
g Не идеально, зато регулярно.
g Пропустил — не страшно. Главное — не пропускать два раза подряд.
g Привяжи новую привычку к той, что уже есть.
g Лучше пять минут каждый день, чем час раз в месяц.
g Хорошая привычка — подарок будущему себе.
g Отметь сделанное — мозг любит видеть прогресс.
g Начни с такой маленькой привычки, что её невозможно не сделать.
g Цепочка дней — не цепь. Порвалась — свяжи снова.
g Привычки делают за тебя то, на что не хватает силы воли.
g Если привычка не приживается — сделай её проще, а не строже.
g Сегодняшняя галочка важнее идеального графика.
g Стакан воды — тоже забота о себе. Отметь его.
g Медленные привычки — самые прочные.
@Focusday|Деньги и спокойствие
g Пауза перед покупкой — подарок своему бюджету.
g Хотелка подождёт три дня. Если всё ещё нужна — значит, нужна.
g Деньги, которые ты не потратил импульсивно, — твоя маленькая победа.
g Записать трату — значит взять деньги под контроль, а не ругать себя.
g Небольшой запас — большое спокойствие.
g Лучше маленький лимит, который соблюдаешь, чем большой план, который бросишь.
@Focusday|Мысли и дневник
g Записанная мысль перестаёт крутиться в голове.
g Дневник — место, где можно быть честным без оценок.
g Две строки о дне лучше, чем ни одной.
g Что сегодня было хорошего? Даже маленькое считается.
g Запиши идею сейчас — потом ты её забудешь, и это нормально.
g Пиши, как думаешь. Красота не нужна.
g Мысли на бумаге легче, чем мысли в голове.
@Focusday|Фокус-напоминание
g Ты в потоке? Отлично. Не трогай телефон.
g Ещё немного — и можно будет потянуться.
g Один экран, одна задача, один таймер.
g Если внимание ускользнуло — мягко поймай его и верни.
g Сосредоточься на том, что можно сделать за этот спринт.
g Оставь сообщения на перерыв. Сейчас — дело.
g Не открывай новую вкладку. Закончи эту мысль.
g Сделай текущий шаг до конца — потом выбирай следующий.
g Рабочее место — для работы. Лента — для перерыва.
g Тишина, вода, таймер. Ты готов.
g Чем меньше переключений, тем меньше усталость.
g Вопрос дня: что самое важное прямо сейчас?
g Твоя задача ждёт всего одного действия.
g Ты почти закончил — дотяни до конца.
g Если мешает мысль — запиши её в «Мысли» и продолжай.
g Короткий спринт — честная сделка с мозгом.
g Хороший фокус начинается с выключенных уведомлений.
g Пусть кот сторожит, а ты работаешь.
g Продолжай. У тебя хорошо получается.
g Двигайся в своём ритме — главное, двигайся.
@Мастер Угвэй|«Кунг-фу панда»
g Вчера — это история, завтра — загадка, а сегодня — подарок. Поэтому его и называют настоящим.
g Нет ничего случайного.
@Мистер Роджерс|приписывается
g Важно не то, сколько ты делаешь, а то, с какой любовью.
@Шеф Гюсто|«Рататуй»
d Готовить может каждый.
@Винни-Пух|Дисней · по мотивам
g Иногда, если стоять на нижней ступеньке лестницы, всё равно чувствуешь, что поднимаешься.
@Мулан|«Мулан», 1998 · по мотивам
d Цветок, который распускается в беде, — самый редкий и прекрасный.
@Рафики|«Король Лев»
d Прошлое может ранить. Но от него можно либо бежать, либо учиться у него.
@Бэймакс|«Город героев»
g Ты в порядке? По шкале от одного до десяти — как твоя боль?
@Focusday|Тёплые слова
g Ты делаешь достаточно. Правда.
g Сегодня можно гордиться тем, что ты пришёл.
g Твоё «немного» — это намного больше, чем ничего.
g Ты становишься лучше даже в дни, когда этого не видно.
g Не обязательно сиять. Достаточно светиться чуть-чуть.
g Ты имеешь право начинать столько раз, сколько нужно.
g Твоя история ещё пишется. Сегодня — просто одна страница.
g Каждый новый час — новая возможность.
g Ты не обязан чувствовать уверенность, чтобы действовать уверенно.
g Хороший день складывается из нескольких хороших минут.
g Возьми паузу, если нужно. Мир подождёт пять минут.
g Улыбнись своей маленькой победе.
g Даже облачный день — день, который можно прожить хорошо.
g Ты молодец, что не бросил.
g Иногда самое смелое — попросить помощи.
g Не нужно быть сильным всё время.
g Ты вправе гордиться тем, как далеко ты уже зашёл.
g Посмотри, сколько ты уже умеешь.
g Сегодняшние усилия — семена завтрашних результатов.
g Ты можешь всё начать заново — даже посреди дня.
@Focusday|Бережность к себе
g Если не можешь делать всё — делай самое бережное.
g Ты не машина. Тебе можно уставать.
g Сравнивай себя только с собой вчерашним.
g Иногда выключить уведомления — лучшая забота о себе.
g Хорошо поставленная граница — тоже продуктивность.
g Нет — это полное предложение.
g Ты не обязан отвечать сразу.
g Спокойный темп тоже приводит к цели.
g Можно делать дела и не спешить.
g Сначала кислородная маска себе.
g Ты заслуживаешь доброты — особенно от себя.
g Медленный прогресс лучше быстрого выгорания.
g Можно отдохнуть и продолжить. Можно.
g Ты не опаздываешь на свою собственную жизнь.
g Сегодня ты достаточно хорош таким, какой есть.
@Focusday|Про СДВГ
g Забыть — нормально. Вспомнить и вернуться — суперсила.
g Мозгу с СДВГ нужен интерес, срочность, новизна или вызов. Добавь в задачу хотя бы одно.
g Не борись с собой — договорись с собой.
g Твой ритм может отличаться от чужого. Это не ошибка.
g Поставь напоминание — и освободи голову.
g Работай короткими забегами, отдыхай честно.
g Задача стала скучной? Смени место или формат.
g Начни с того, что нравится, — разгон перенесётся на остальное.
`;

  // src/js/features/quotes/action.js
  var action_default = String.raw`
@Джеймс Клир|«Атомные привычки»
d Мы не поднимаемся до уровня своих целей. Мы опускаемся до уровня своих систем.
d Каждое действие — это голос за того, кем ты хочешь стать.
d Привычки — это сложные проценты самосовершенствования.
d Стань на один процент лучше сегодня. Через год это будет в 37 раз больше.
d Никогда не пропускай дважды.
d Сделай это очевидным, привлекательным, простым и приносящим удовольствие.
g Цель — выиграть игру. Система — продолжать играть.
d Сначала ты делаешь привычки, потом привычки делают тебя.
g Начни с версии привычки на две минуты.
d Окружение важнее мотивации. Сделай нужное лёгким, а лишнее — трудным.
@Джоко Виллинк|«Дисциплина равна свободе»
d Дисциплина равна свободе.
d Не жди мотивации. Мотивация непостоянна. Опирайся на дисциплину.
d Плохо получилось? Хорошо. Теперь есть чему научиться.
d Не думай о том, хочется ли. Просто делай.
@Дэвид Гоггинс|«Меня не сломить»
d Когда тебе кажется, что ты выдохся, ты израсходовал только сорок процентов.
d Мотивация — это ерунда. Нужна привычка делать то, что не хочется.
d Каждый день делай что-то, что тебе не нравится, — и становись крепче.
@Брюс Ли|приписывается
d Я не боюсь того, кто изучил 10 000 ударов. Я боюсь того, кто повторил один удар 10 000 раз.
g Будь водой, мой друг.
d Не молись о лёгкой жизни. Молись о силе выдержать трудную.
d Долгие размышления о сделанном мешают сделать следующее.
@Майкл Джордан|реклама Nike, 1997
d Я промахнулся больше 9000 раз. Проиграл почти 300 игр. Я ошибался снова и снова — и поэтому я добился успеха.
@Кобе Брайант|приписывается
d Отдыхай в конце, а не в середине.
d Каждый день я стараюсь стать лучше, чем был вчера.
@Мухаммед Али|приписывается
d Я ненавидел каждую минуту тренировок, но говорил себе: не сдавайся. Потерпи сейчас — и проживи остаток жизни чемпионом.
d Не считай дни. Сделай так, чтобы дни считались.
@Рокки Бальбоа|«Рокки Бальбоа», 2006
d Важно не то, как сильно ты бьёшь. Важно, какой удар ты можешь выдержать и продолжать идти вперёд.
@Магистр Йода|«Звёздные войны: Империя наносит ответный удар»
d Делай или не делай. Не надо пытаться.
@Стив Мартин|автобиография «Born Standing Up»
d Будь настолько хорош, чтобы тебя не могли проигнорировать.
@Стив Джобс|выступление в Стэнфорде, 2005
d Оставайтесь голодными. Оставайтесь безрассудными.
d Нельзя соединить точки, глядя вперёд. Их соединяешь, только оглядываясь назад.
@Стив Джобс|девиз команды Macintosh
d Настоящие художники выпускают продукт.
@Чак Клоуз|интервью
d Вдохновение — для любителей. Остальные просто приходят и берутся за работу.
@Пабло Пикассо|приписывается
d Вдохновение существует, но оно должно застать тебя за работой.
@Уилл Дюрант|«История философии», о мысли Аристотеля
d Мы — то, что мы делаем постоянно. Совершенство — не действие, а привычка.
@Бенджамин Франклин|«Альманах бедного Ричарда»
d Хорошо сделанное лучше хорошо сказанного.
d Потерянное время уже никогда не найдёшь.
d Ты можешь отложить дело, но время не отложит.
@Томас Эдисон|приписывается
d Я не потерпел неудачу. Я просто нашёл 10 000 способов, которые не работают.
d Гений — это один процент вдохновения и девяносто девять процентов пота.
@Генри Форд|приписывается
d Думаете ли вы, что можете, или думаете, что не можете, — вы правы.
@Мел Роббинс|«Правило 5 секунд»
d 5-4-3-2-1 — и двигайся, пока мозг не начал отговаривать.
d Ты никогда не будешь «чувствовать готовность». Решайся раньше чувства.
@Брайан Трейси|«Съешьте лягушку»
d Если тебе нужно съесть лягушку — сделай это первым делом утром.
@Кэл Ньюпорт|«В работу с головой»
d Глубокая работа — суперсила в мире, где всех отвлекают.
d Ясность в том, что важно, даёт ясность в том, что неважно.
@Сет Годин|блог
d Выпусти. Готовое несовершенное лучше идеального в столе.
@Нил Гейман|речь «Make Good Art», 2012
d Создавай хорошее искусство.
@Арнольд Шварценеггер|приписывается
d Сила приходит не из побед. Твоя борьба развивает силу.
@Теодор Рузвельт|«Человек на арене»
d Честь принадлежит тому, кто на арене, чьё лицо в пыли, поту и крови, кто дерзает.
@Эпиктет|«Беседы»
d Сначала скажи себе, кем ты хочешь быть. Затем делай то, что должен.
@А. В. Суворов|приписывается
d Тяжело в учении — легко в бою.
@Конфуций|приписывается
g Неважно, как медленно ты идёшь, главное — не останавливаться.
d Человек, который передвигает горы, начинает с того, что переносит маленькие камни.
@Марк Твен|приписывается
d Секрет движения вперёд — начать.
d Через двадцать лет ты больше будешь жалеть о том, чего не сделал, чем о том, что сделал.
@Амелия Эрхарт|приписывается
d Самый действенный способ сделать что-то — просто сделать это.
@Мартин Лютер Кинг|речь в Спелмане, 1960
g Если не можешь лететь — беги. Не можешь бежать — иди. Не можешь идти — ползи. Но продолжай двигаться вперёд.
@Мартин Лютер Кинг|приписывается
g Вера — это сделать первый шаг, даже когда не видишь всей лестницы.
@Джим Рюн|приписывается
d Мотивация помогает начать. Привычка помогает продолжать.
@Марк Мэнсон|принцип «Делай что-нибудь»
d Мотивация приходит после того, как ты начал, а не до.
@Наваль Равикант|«Альманах Наваля Равиканта»
d Желание — это договор с собой быть несчастным, пока не получишь желаемое. Выбирай желания осознанно.
d Ты не станешь богаче, продавая своё время. Учись создавать.
@Русская пословица|
d Глаза боятся, а руки делают.
d Терпение и труд всё перетрут.
d Дорогу осилит идущий.
d Без труда не выловишь и рыбку из пруда.
d Делу время — потехе час.
d Лиха беда начало.
d Под лежачий камень вода не течёт.
g Тише едешь — дальше будешь.
g Утро вечера мудренее.
d Капля камень точит.
d Семь раз отмерь — один раз отрежь.
d Не откладывай на завтра то, что можно сделать сегодня.
d Сделал дело — гуляй смело.
d Труд человека кормит, а лень портит.
d Взялся за гуж — не говори, что не дюж.
d Не боги горшки обжигают.
g Москва не сразу строилась.
d Кто рано встаёт, тому бог подаёт.
d Хорошее начало — половина дела.
d Умелые руки не знают скуки.
@Focusday|Дисциплина
d Делай, даже когда не хочется. Особенно когда не хочется.
d Сначала действие, потом настроение.
d Дисциплина — это помнить, чего ты хочешь больше всего, а не прямо сейчас.
d Двадцать пять минут. Одна задача. Никаких «только гляну».
d Не обсуждай с собой — просто начни таймер.
d Великое — это мелкое, сделанное тысячу раз.
d Ты не обязан хотеть. Ты обязан начать.
d Сначала самое трудное, потом самое приятное.
d Сделай сегодня то, что другие откладывают, — и завтра у тебя будет то, чего нет у других.
d Каждый подход к задаче делает следующий проще.
d Решение принято — дальше только действие.
d Регулярность бьёт интенсивность.
d Раз — и начали. Думать будем в процессе.
d Не жди вдохновения. Назначь ему встречу.
d Дедлайн — твой друг. Поставь маленький прямо сейчас.
d Конец задачи начинается с её первой минуты.
d Каждый день — одна кирпичная кладка. Не стена — кирпич.
d Лучше сделать сегодня на тройку, чем завтра на пятёрку.
d Не так важно, как быстро. Важно, что каждый день.
d Сфокусируйся на процессе — результат догонит.
d Отвлёкся? Счёт не обнулён. Продолжай с того же места.
d Твоё время — самая честная валюта. Потрать его на главное.
d Хорошая привычка начинается с плохо выполненного первого раза.
d Сила — это ещё один повтор после «не могу».
d Делай главное, пока другие делают срочное.
d Скучная задача, сделанная сейчас, — свобода через час.
d Неделя по полчаса — это три с половиной часа настоящей работы.
d Пусть сегодня будет днём, когда ты не сдался.
d Сначала сделай, потом проверь почту.
d Один фокус-спринт может изменить весь день.
d Чем меньше решаешь, тем больше делаешь: составь план с вечера.
d Не умножай задачи. Закрывай их.
d Запланированное время — уже половина сделанного.
d Будь человеком, который доводит до конца.
d Всё великое когда-то было черновиком.
d Ты сильнее, чем желание отложить.
d Тренируй начинать — заканчивать научишься по дороге.
d Сегодня — повтор. Завтра — навык. Через месяц — характер.
d Помни, ради чего ты это делаешь.
d Твоя система важнее твоего настроения.
d Сделать — значит сделать. Остальное — разговоры.
d Пусть задача боится тебя, а не ты её.
d Удобство — враг роста. Шаг из зоны комфорта — шаг вперёд.
d Каждое «сделаю сейчас» экономит десять «надо бы».
d Без разгона: открыл, сделал, закрыл.
d Сначала качество внимания, потом количество часов.
d Отложенное дело весит больше, чем сделанное.
d Если не сейчас, то когда? Если не ты, то кто?
d Финишная прямая начинается с первого шага.
d Мастерство — это скука, которую ты пережил.
d Ты не ищешь время. Ты его выделяешь.
d Каждый законченный спринт — инвестиция в себя.
d Дело любит тишину и таймер.
d Главное — не скорость. Главное — направление и постоянство.
d Не сравнивай. Делай свой следующий повтор.
d Тот, кто делает понемногу каждый день, обгоняет того, кто ждёт идеального дня.
d План без действия — мечта. Действие без плана — суета. Нужны оба.
d Начни с самой важной задачи, а не с самой громкой.
d Чем раньше начнёшь, тем раньше будешь свободен.
d Закончи то, что начал, — даже если хочется новое.
d Сегодняшнее усилие — завтрашняя лёгкость.
d Привычка — это решение, принятое один раз и повторённое тысячу раз.
d Делай меньше, но доводи до конца.
d Отвечай делом, а не обещанием.
d Ты строишь репутацию перед самим собой. Сдержи слово.
d Каждый раз, когда ты выбираешь задачу вместо ленты, ты побеждаешь.
d Не бойся медленного начала. Бойся не начать.
d Работа — это тренировка. Сегодня ещё один подход.
d Ты сам решаешь, каким будет следующий час.
d Сделай невыносимо скучное за десять минут — и забудь о нём.
d Хочешь результат — защищай время для него.
d Не надо больше информации. Надо первый шаг.
d Задача на неделю делается по одному дню.
d Лень — это просьба о понятном первом шаге. Дай его себе.
d Победа — это сделать сегодня то, что обещал себе вчера.
d Цели задают направление. Ежедневные действия двигают вперёд.
d Завтра не наступает. Наступает только сегодня.
d Сосредоточение — это умение говорить «нет» сотне хороших идей.
d Не пытайся сделать всё. Сделай следующее.
d Делай, как будто от этого зависит твой день. Потому что зависит.
d Больше дела — меньше тревоги.
d Сначала порядок на столе, потом порядок в работе.
d Пиши, даже если плохо. Шлифуй потом.
d Иди. Даже если медленно. Даже если страшно.
d Один настоящий час работы ценнее трёх рассеянных.
d Дисциплина — это доброта к будущему себе.
d Сложно — не значит невозможно. Это значит: по шагам.
d Не трать силы на тревогу о деле. Потрать их на дело.
d Результат — это сумма маленьких «не сдался».
d Ещё один спринт. Потом — честный отдых.
d Любая гора состоит из камешков. Подними следующий.
@Питер Друкер|«Эффективный руководитель» · по мотивам
d Нет ничего бесполезнее, чем эффективно делать то, что вообще не нужно делать.
@Питер Друкер|приписывается
d Что измеряется, тем можно управлять.
@Дуайт Эйзенхауэр|речь, 1954 · по мотивам
d Важное редко бывает срочным, а срочное — редко важным.
@Сирил Паркинсон|«Закон Паркинсона»
d Работа заполняет всё время, отведённое на неё.
@Дуглас Хофштадтер|«Гёдель, Эшер, Бах»
g Всё занимает больше времени, чем ожидаешь, даже если учесть закон Хофштадтера.
@Дэвид Аллен|«Как привести дела в порядок»
d Голова — чтобы рождать идеи, а не чтобы их хранить.
d Если дело занимает меньше двух минут — сделай его сразу.
g Ты можешь сделать что угодно, но не всё сразу.
@Грег Маккеон|«Эссенциализм»
d Если ты не расставишь приоритеты в своей жизни, это сделает кто-то другой.
d Меньше, но лучше.
@Энтони Троллоп|«Автобиография»
d Небольшая ежедневная работа, если она действительно ежедневна, победит усилия эпизодического Геракла.
@Стивен Кинг|приписывается
d Талант дешевле поваренной соли. Отличает талантливого человека от успешного только тяжёлый труд.
@Стивен Кинг|«Как писать книги»
d Любители сидят и ждут вдохновения. Остальные просто встают и идут работать.
@Ира Гласс|интервью
d Разрыв между вкусом и умением закрывается только большим объёмом работы.
@Остин Клеон|«Покажи свою работу!»
d Показывай свою работу. Процесс — тоже результат.
@Тим Урбан|TED, 2016 · по мотивам
g У каждого внутри есть обезьянка мгновенного удовольствия. Её не победить — с ней можно договориться.
@Анджела Дакворт|«Твёрдость характера»
d Энтузиазм — обычное дело. Выносливость — редкость.
@Кэрол Дуэк|«Гибкое сознание»
g Сила слова «пока»: я этого пока не умею.
@Тим Феррисс|приписывается
d То, чего мы больше всего боимся делать, обычно и есть то, что нам нужнее всего сделать.
@Билл Гейтс|приписывается
d Мы переоцениваем то, что можем сделать за год, и недооцениваем то, что можем сделать за десять лет.
@Харуки Мураками|«О чём я говорю, когда говорю о беге»
d Боль неизбежна. Страдание — выбор.
d Каждый день понемногу — и однажды пробежишь марафон.
@Дитер Рамс|принципы хорошего дизайна
d Хороший дизайн — это как можно меньше дизайна.
@Франческо Чирилло|«Метод помидора» · по мотивам
d Один помидор — одна задача. Звонок таймера — честный отдых.
@Focusday|Дело и ясность
d Ясная задача наполовину решена.
d Запиши, что значит «готово». Тогда будет понятно, когда остановиться.
d Сначала главное. Потом важное. Потом всё остальное.
d Три задачи на день — это план. Двадцать — это тревога.
d Срочно и важно — сейчас. Важно — по плану. Срочно — делегируй. Остальное — вычеркни.
d Сделай работу видимой — и ей станет сложнее прятаться.
d Не путай занятость с прогрессом.
d Сначала результат, потом шлифовка.
d Готово лучше, чем идеально.
d Решение «не делать» — тоже решение. Вычеркни лишнее.
d Не начинай новое, пока не закрыл старое.
d Когда непонятно — спроси. Вопрос экономит часы.
d Одно письмо — одно действие. Ответил или запланировал.
d Не держи задачи в голове — держи их в списке.
d Самая трудная задача становится лёгкой, когда она запланирована на конкретное время.
d План на завтра пиши сегодня вечером.
d Каждое утро выбирай одну главную задачу дня.
d Время, которое ты не планируешь, планирует кто-то другой.
d Задача без даты — просто желание.
d Большие проекты двигаются маленькими шагами с датами.
d Не жди ясности, чтобы начать. Ясность приходит в работе.
d Ограничь задачу по времени — и она станет конечной.
d Устал выбирать? Начни с первой в списке.
d Не обещай — запланируй.
d Хороший план умещается на стикере.
d Проверка в конце дня: что сделано, что переносится, что вычёркиваем.
d Если задача всё время откладывается — она слишком большая.
d Сделай первую версию за час. Улучшить можно потом.
d Четыре часа глубокой работы стоят целого дня суеты.
d Сначала самое неприятное. Остальное покажется лёгким.
@Focusday|Упорство
d Ты не обязан быть лучшим. Ты обязан не бросать.
d Не получилось — попробуй по-другому. Опять не получилось — попробуй ещё.
d Повторение — мать мастерства.
d Падать — нормально. Не подниматься — вот это выбор.
d Сила не в том, чтобы никогда не падать, а в том, чтобы вставать каждый раз.
d Упорство превращает невозможное в сделанное.
d Сегодня трудно. Завтра будет чуть легче, если сегодня ты не сдашься.
d Каждый день, когда ты продолжаешь, — победа.
d Неважно, как медленно. Важно, что вперёд.
d Терпение — это не ожидание. Это продолжение работы, пока ждёшь.
d Самая длинная дорога проходится по одному шагу.
d Будь упрямым в цели и гибким в способах.
d Трудности — это тренажёр. Ты становишься сильнее.
d Сомневаешься? Сделай ещё один шаг и посмотри снова.
d Если хочется бросить — вспомни, зачем начинал.
d Никто не видит твоих тренировок. Все видят результат.
d Результаты приходят к тем, кто остаётся.
d Ты уже прошёл трудную часть — ты начал.
d Не сдавайся на первой трудности. И на второй тоже.
d Делай, пока не станет привычкой. Потом делай, потому что это ты.
@Focusday|Энергия
d Работай с энергией, а не против неё: трудное — на пике, простое — на спаде.
d Двигайся — и энергия придёт.
d Нет сил на большое? Сделай маленькое. Это тоже вклад.
d Хороший сон — лучший тренер продуктивности.
d Твоя энергия — ресурс. Трать её на то, что важно.
d Начни с пятиминутной разминки — мозг проснётся вместе с телом.
d Еда, вода, воздух. Потом — дела.
d Если день начался плохо — начни его снова после обеда.
d Энергия любит ритм: работа, пауза, работа.
d Скачок энергии? Используй его для самой сложной задачи.
`;

  // src/js/features/quotes/dc.js
  var dc_default = String.raw`
@Томас Уэйн|Batman Begins
g Зачем мы падаем, Брюс? Чтобы научиться подниматься.
@Брюс Уэйн|Batman Begins
d Не то, кто я внутри, а то, что я делаю, определяет меня.
@Альфред Пенниуорт|Batman Begins
g — Вы всё ещё не разочаровались во мне? — Никогда.
@Рэйчел Доуз|Batman Begins
g Справедливость — это гармония. Месть — это попытка самому стать лучше за чужой счёт.
@Анри Дюкар|Batman Begins
d Тренировка — ничто. Воля — всё.
x Чтобы победить страх, нужно самому стать страхом.
@Харви Дент|The Dark Knight
g Ночь темнее всего перед рассветом.
x Либо умираешь героем, либо живёшь так долго, что становишься злодеем.
@Альфред Пенниуорт|The Dark Knight
d Терпите, мастер Уэйн. Принимайте удар. Вы можете быть тем, кем не может быть никто другой.
x Некоторые люди просто хотят видеть, как горит мир.
@Бэтмен|The Dark Knight
d Бэтмен может быть тем, кем никто больше быть не может.
@Брюс Уэйн|The Dark Knight Rises
g Героем может быть кто угодно. Даже человек, который просто накинул пальто на плечи мальчика, чтобы сказать: мир не кончился.
@Заключённый|The Dark Knight Rises
d Поднимайся так, как сделал ребёнок. Без верёвки.
@Бэтмен|The Batman, 2022
g Месть не изменит прошлого. Людям нужна надежда.
x Я — месть.
@Джор-Эл|Man of Steel
g Ты дашь людям Земли идеал, к которому можно стремиться.
@Джонатан Кент|Man of Steel
d Тебе просто нужно решить, каким человеком ты хочешь вырасти.
@Марта Кент|Man of Steel · по мотивам
g Если мир кажется слишком большим — сделай его маленьким. Сосредоточься на моём голосе.
@Супермен|All-Star Superman
g Ты гораздо сильнее, чем думаешь. Поверь мне.
@Чудо-женщина|Wonder Woman, 2017
g Только любовь может по-настоящему спасти мир.
g Дело не в том, кто чего заслуживает. Дело в том, во что ты веришь.
@Чудо-женщина|Wonder Woman · по мотивам
d Я не буду стоять в стороне.
@Джо Уэст|The Flash (CW)
d Беги, Барри, беги!
@Клятва Зелёного Фонаря|DC Comics
d В ярчайший день, в чернейшую ночь ни одно зло не скроется от моего взора.
@Бэтмен|Batman: The Animated Series · по мотивам
d Я не могу спасти всех. Но я могу попытаться спасти того, кто передо мной.
@Бэтмен|DC Comics
d Я — Бэтмен.
@Бэтмен|The LEGO Batman Movie · по мотивам
g Даже Бэтмену нужна команда. Не обязательно всё делать одному.
@Альфред Пенниуорт|DC Comics · по мотивам
g Отдыхать — не значит сдаваться, сэр. Это значит вернуться в форме.
g Даже рыцарю нужен чай и сон.
@Найтвинг|DC Comics · по мотивам
d Падать — часть полёта.
@Супермен|DC Comics · по мотивам
g Надежда — это не чувство. Это выбор, который делаешь каждое утро.
@Бэтгёрл|DC Comics · по мотивам
d Мне не нужен разрешающий жест. Я начинаю сама.
@Шазам|Shazam!, 2019 · по мотивам
g Сила — не в том, кто ты, а в том, кого ты защищаешь.
@Аквамен|Aquaman · по мотивам
d Иногда, чтобы стать королём, нужно сначала признать, что ты не готов.
@Джокер|The Killing Joke
x Хватит одного плохого дня.
@Бэйн|The Dark Knight Rises
x Ты лишь принял тьму. Я в ней родился.
@Комиссар Гордон|The Dark Knight Rises
d Бывает момент, когда структура подводит. Тогда правила становятся кандалами.
@Люциус Фокс|Batman Begins · по мотивам
g Никогда не стыдно попросить нужный инструмент.
@Ра'с аль Гул|Batman Begins
d Твой гнев даёт тебе огромную силу. Но если позволишь, он тебя уничтожит.
d Если ты станешь больше, чем просто человеком, если посвятишь себя идеалу — ты станешь легендой.
@Альфред Пенниуорт|Batman Begins
g Какой смысл во всех этих отжиманиях, если вы даже бревно поднять не можете?
@Альфред Пенниуорт|The Dark Knight
g — Знайте свои пределы, мастер Уэйн. — У Бэтмена нет пределов. — Зато у вас есть, сэр.
@Комиссар Гордон|The Dark Knight
d Он герой, которого Готэм заслуживает, но не тот, который нужен ему сейчас.
@Селина Кайл|The Dark Knight Rises · по мотивам
g Всем иногда хочется начать с чистого листа. И это можно.
@Джор-Эл|Superman, 1978
g Они могут стать великим народом, Кал-Эл. Им не хватает лишь света, который укажет путь.
@Чудо-женщина|Wonder Woman 1984
d Ничего хорошего не рождается из лжи.
@Барри Аллен|The Flash (CW)
d Меня зовут Барри Аллен, и я самый быстрый человек на свете.
@Брюс Уэйн|Justice League, 2017
g — Какая у тебя суперсила? — Я богатый.
@Супермен|DC Comics · приписывается
d Во вселенной есть правильное и неправильное, и отличить одно от другого не так уж сложно.
@Джокер|Batman, 1989
x Ты когда-нибудь танцевал с дьяволом при бледном свете луны?
`;

  // src/js/features/quotes/anime.js
  var anime_default = String.raw`
@Торфинн|Vinland Saga
g У меня нет врагов.
d Я построю страну, где не будет ни войны, ни рабства.
@Торфинн|Vinland Saga · по мотивам
d Я начну всё сначала. На этот раз — правильно.
g Я хочу жить так, чтобы никому не причинять боль.
d Настоящая сила — не в мече, а в том, чтобы не поднимать его без нужды.
d Прошлое не изменить. Но можно решить, кем быть с этого дня.
g Земля, которую возделываешь своими руками, учит терпению.
x Я убил слишком многих. Теперь я должен прожить жизнь, которая этого стоит.
@Торс|Vinland Saga
g У тебя нет врагов. Ни у кого в этом мире нет врагов. Нет никого, кому стоило бы причинять боль.
d Настоящему воину не нужен меч.
@Аскеладд|Vinland Saga · по мотивам
d Найди свою настоящую битву, Торфинн.
d Настоящий воин тот, кто сражается за что-то большее, чем месть.
x Люди — рабы любви и ненависти. Таков этот мир.
@Леиф Эриксон|Vinland Saga · по мотивам
g Где-то есть земля, где люди живут без войны. Её стоит искать.
@Куросаки Ичиго|Bleach
d Я сражаюсь не потому, что хочу победить. Я сражаюсь, потому что должен.
d Если я не могу защитить тех, кто рядом, какой смысл в моей силе?
@Куросаки Ичиго|Bleach · по мотивам
d Я не отступлю. Ни на шаг.
x Если бы мне пришлось стать никем, чтобы их защитить, я бы стал.
d Неважно, насколько сильный противник. Я иду вперёд.
@Кайэн Сиба|Bleach
g Сердце — не в груди. Оно там, где связь между нами.
@Зангецу|Bleach · по мотивам
d Не колеблись. Колебание притупляет клинок.
@Урахара Кисукэ|Bleach · по мотивам
d Тот, кто боится быть раненым, не сможет защитить никого.
@Кэмпати Дзараки|Bleach · по мотивам
d Чем сильнее противник, тем интереснее бой.
@Гатс|Berserk
d Тот, кто бежит, не найдёт рая.
@Гатс|Berserk · по мотивам
d Сражайся. Борись до самого конца.
d Я не стану молиться. Я пойду вперёд своими ногами.
x Если меня собьют с ног — я встану. Сколько бы раз ни пришлось.
d Нельзя ждать, пока путь станет лёгким. Иди по тому, что есть.
d Мечта, ради которой ты не рискуешь, — просто сон.
@Рыцарь-Череп|Berserk
d Борись в потоке судьбы.
@Гриффит|Berserk
x Ради своей мечты я готов пожертвовать всем.
x Друг — это тот, кто следует собственной мечте и никому не подчиняется.
@Каска|Berserk · по мотивам
g Уйти — не всегда поражение. Иногда это начало своего пути.
@Тренер Андзай|Slam Dunk
d Если сдашься — матч окончен.
g Ты станешь лучше, если будешь практиковаться каждый день.
@Хисаси Мицуи|Slam Dunk
d Тренер… я хочу играть в баскетбол.
@Ханамити Сакураги|Slam Dunk
d Мои славные дни — сейчас!
d Ведь я — гений!
d Двадцать тысяч бросков за неделю? Сделаю!
@Такэнори Акаги|Slam Dunk · по мотивам
d Пока не прозвучал финальный свисток — мы не проиграли.
@Кадэ Рукава|Slam Dunk · по мотивам
d Говорить не нужно. Нужно забивать.
@Наруто Узумаки|Naruto
d Я никогда не отступаю от своего слова. Это мой путь ниндзя.
d Упорный труд ничего не стоит, если ты не веришь в себя.
d Я не сдамся. Сдаться — это не мой путь.
@Наруто Узумаки|Naruto · по мотивам
g Одиночество проходит, когда находишь людей, которые тебя признают.
@Рок Ли|Naruto
d Неудачник может превзойти гения упорным трудом.
d Если я не смогу сделать это пятьсот раз — сделаю тысячу.
@Майто Гай|Naruto
d Сила юности горит в нас!
@Майто Гай|Naruto · по мотивам
d Когда говоришь «невозможно» — ты уже проиграл.
@Джирайя|Naruto
d Ниндзя — это тот, кто терпит.
@Джирайя|Naruto · по мотивам
g Отказ от мечты — единственное настоящее поражение.
@Итачи Учиха|Naruto
d Не тот, кто стал Хокаге, признан всеми. Тот, кого признают все, становится Хокаге.
x Люди живут, опираясь на то, что считают правдой. Это и есть их реальность.
@Какаши Хатакэ|Naruto
d Те, кто нарушает правила, — мусор. Но те, кто бросает друзей, хуже мусора.
@Шикамару Нара|Naruto · по мотивам
g Какая морока… но ладно, сделаем.
@Хината Хьюга|Naruto · по мотивам
g Я всегда смотрела на тебя — и становилась смелее.
@Монки Д. Луффи|One Piece
d Я стану Королём пиратов!
d Я не хочу всё завоевать. Просто самый свободный человек — Король пиратов!
d Если не рисковать, не создашь будущее!
@Монки Д. Луффи|One Piece · приписывается
g Неважно, насколько ты силён. Важно, что ты не сдаёшься.
@Ророноа Зоро|One Piece
d Я больше никогда не проиграю. Пока не стану величайшим мечником.
d Ничего… не случилось.
d Если я умру здесь — значит, я был всего лишь таким человеком.
@Нико Робин|One Piece
d Я хочу жить!
@Доктор Хирулук|One Piece
x Когда человек умирает? Когда его забывают.
@Шанкс|One Piece · по мотивам
g Я ставлю на новое поколение.
@Эдвард Элрик|Fullmetal Alchemist: Brotherhood
d Урок без боли бессмыслен. Ничего не получишь, не отдав что-то взамен.
d Встань и иди. Иди вперёд. У тебя есть крепкие ноги.
@Альфонс Элрик|Fullmetal Alchemist: Brotherhood
d Чтобы что-то получить, нужно отдать что-то равноценное.
@Идзуми Кёртис|Fullmetal Alchemist
g Один — это всё, а всё — это один.
@Рой Мустанг|Fullmetal Alchemist · по мотивам
d Тот, кто хочет защищать, должен сначала стать сильным.
@Сёё Хината|Haikyuu!!
d Пока я на площадке, ты непобедим!
d Я хочу стоять на этой площадке как можно дольше.
@Тоору Оикава|Haikyuu!!
d Талант — то, что раскрываешь. Чутьё — то, что оттачиваешь.
@Кэйдзи Укай|Haikyuu!! · по мотивам
d Сыграйте так, чтобы не жалеть, когда свисток прозвучит.
@Тобио Кагэяма|Haikyuu!! · по мотивам
d Чтобы стать сильнее, нужно играть с теми, кто сильнее.
@Эрвин Смит|Attack on Titan
d Отдайте свои сердца!
@Армин Арлерт|Attack on Titan
d Тот, кто не может ничем пожертвовать, ничего не изменит.
@Леви Аккерман|Attack on Titan
d Выбирай так, чтобы не жалеть. Никто не знает, каким будет результат.
@Ханджи Зоэ|Attack on Titan · по мотивам
g Интересно! Если не понимаешь — изучай дальше.
@Всемогущий|Моя геройская академия
g Ты можешь стать героем.
d Всё в порядке. Почему? Потому что я здесь!
d Plus Ultra! За пределы!
@Всемогущий|Моя геройская академия · по мотивам
g Герой делает больше, чем от него ждут.
@Изуку Мидория|Моя геройская академия · по мотивам
d Спасать — значит действовать раньше, чем подумаешь.
@Кёдзюро Ренгоку|Клинок, рассекающий демонов
d Сожги своё сердце! Иди вперёд с поднятой головой.
d Не останавливайся, даже если ты слаб. Скорби, но иди вперёд.
@Танджиро Камадо|Клинок, рассекающий демонов
d Я старший брат. Я выдержу.
x Сколько бы людей ты ни потерял, у тебя нет выбора — нужно жить дальше.
@Гию Томиока|Клинок, рассекающий демонов
d Никогда не отдавай другим власть над своей жизнью!
@Джин Фрикс|Hunter × Hunter
g Наслаждайся маленькими отступлениями от пути. Там можно найти больше, чем то, к чему ты идёшь.
@Гон Фрикс|Hunter × Hunter · по мотивам
d Я хочу увидеть, кем станет мой отец, — и кем стану я.
@Киллуа Золдик|Hunter × Hunter · по мотивам
g Друг — это когда не нужно ничего объяснять.
@Аратака Рэйген|Mob Psycho 100
g Убегать от того, что тебе не нравится, — нормально.
g Ты хороший парень, Моб.
@Сигэо Кагэяма (Моб)|Mob Psycho 100 · по мотивам
d Стать сильнее — значит не сдаваться, даже когда не получается.
@Камина|Tengen Toppa Gurren Lagann
d Верь не в себя. Верь в меня, который верит в тебя!
d Пробей небеса своим буром!
d Кем, по-твоему, ты себя возомнил?!
@Симон|Tengen Toppa Gurren Lagann
d Мой бур — тот, что пронзит небеса!
@Спайк Шпигель|Cowboy Bebop
g Что бы ни случилось — случится.
@Финальный титр|Cowboy Bebop
g Увидимся, космический ковбой.
@Дзэниба|Унесённые призраками
g Однажды встреченного человека невозможно забыть по-настоящему.
@Камадзи|Унесённые призраками
d Начала — так доведи до конца!
@Урсула|Ведьмина служба доставки · по мотивам
g Когда я не могла рисовать, я переставала пытаться. Гуляла, спала — и вдохновение возвращалось само.
@Аситака|Принцесса Мононоке
g Смотреть на мир глазами, не затуманенными ненавистью.
@Софи|Ходячий замок · по мотивам
g Хорошо в старости то, что больше нечего терять.
@Тренер Камогава|Hajime no Ippo
d Упорный труд никогда не предаёт.
@Иппо Макуноути|Hajime no Ippo
d Я хочу знать, что значит быть сильным.
@Сайтама|One Punch Man
d Сто отжиманий, сто приседаний, сто скручиваний и десять километров бега. Каждый день.
@Сайтама|One Punch Man · по мотивам
g Я герой, потому что мне это нравится. Признание — не главное.
@Сон Гоку|Dragon Ball Z
d Сила приходит в ответ на нужду, а не на желание.
@Сон Гоку|Dragon Ball Z · по мотивам
d Я всегда буду становиться сильнее.
@Веджита|Dragon Ball Z · по мотивам
d Гордость — не повод сдаться. Гордость — повод встать.
@Химмель|Frieren: Beyond Journey's End
g Так поступил бы герой Химмель.
@Химмель|Frieren: Beyond Journey's End · по мотивам
g Даже если о тебе забудут, сделанное добро останется.
@Фрирен|Frieren: Beyond Journey's End · по мотивам
g Мне нравятся бесполезные заклинания. Радость тоже бывает маленькой.
g Время не уходит зря, если ты учился замечать людей рядом.
@Вайолет Эвергарден|Violet Evergarden
g Я хочу узнать, что значит «люблю».
@Тору Хонда|Fruits Basket
g У каждого на спине есть что-то хорошее — как слива в онигири. Просто сам ты её не видишь.
@Каори Миядзоно|Твоя апрельская ложь · по мотивам
g Играй так, будто тебя слышат те, кого ты любишь.
@Ринтаро Окабэ|Steins;Gate · по мотивам
d Нет бесполезных экспериментов. Есть данные.
@Лелуш Ламперуж|Code Geass
x Стрелять имеют право лишь те, кто готов, что выстрелят в них.
@Сатору Годзё|Магическая битва
d Не волнуйся. Я сильнейший.
@Кэнто Нанами|Магическая битва · по мотивам
g Рабочий день окончен. Сверхурочно — не работаю.
@Тэцуя Куроко|Kuroko's Basketball · по мотивам
d Я — тень. Но тень становится темнее, когда свет ярче.
@Кэнсин Химура|Rurouni Kenshin · по мотивам
g Меч, который защищает, сильнее меча, который убивает.
@Мусаси|Vagabond · по мотивам
d Я хочу стать сильным. Сильнее, чем кто-либо под этим небом.
@Анья Форджер|Spy × Family
g Ваку-ваку!
@Сакамити Онода|Yowamushi Pedal · по мотивам
d Крути педали. Даже в гору — особенно в гору.
@Ёити Исаги|Blue Lock · по мотивам
d Чтобы стать лучшим, нужно сначала поверить, что ты можешь.
@Сэйбер|Fate/Zero · по мотивам
d Король не оглядывается назад.
@Савако Куронума|Kimi ni Todoke · по мотивам
g Сказать «спасибо» — уже маленькая смелость.
@Сэнку Исигами|Dr. Stone
d Это наука! Шаг за шагом мы вернём цивилизацию.
d Десять миллиардов процентов!
@Сэнку Исигами|Dr. Stone · по мотивам
d У науки нет волшебства. Только попытки, ошибки и упорство.
@Тихиро Огино|Унесённые призраками · по мотивам
g Даже если страшно, можно сделать шаг. Потом ещё один.
@Такуми Фудзивара|Initial D · по мотивам
d Скорость — это не риск. Это контроль.
@Рю|Street Fighter II V · по мотивам
d Ответ — в следующем бою.
@Синдзи Икари|Евангелион
d Я не должен убегать. Не должен убегать.
@Мисато Кацураги|Евангелион · по мотивам
g Сделай то, что можешь, и не жалей потом.
@Юдзи Итадори|Магическая битва · по мотивам
d Я не знаю, как умру. Но знаю, как хочу жить.
@Кацуки Бакуго|Моя геройская академия · по мотивам
d Я выиграю. Не потому что должен, а потому что решил.
@Кота Идзуми|Моя геройская академия · по мотивам
g Иногда героем становится тот, кто просто протянул руку.
@Юи Хирасава|K-On! · по мотивам
g Делать что-то вместе с друзьями — уже весело.
@Хаку|Унесённые призраками · по мотивам
g Помни своё имя.
@Тэнма Цукамото|School Rumble · по мотивам
g Не получилось сегодня — получится завтра!
@Мэй|Мой сосед Тоторо · по мотивам
g Чудеса прячутся совсем рядом — надо только посмотреть.
@Эрен Йегер|Attack on Titan
d Победишь — будешь жить. Проиграешь — умрёшь. Не будешь сражаться — не победишь!
@Микаса Аккерман|Attack on Titan
g Этот мир жесток. Но он и прекрасен.
@Гинтоки Саката|Gintama
d Если у тебя есть время думать о красивой смерти, лучше живи красиво до самого конца.
@Гинтоки Саката|Gintama · по мотивам
g Защищай то, что у тебя в руках, — этого достаточно.
@Рудеус Грейрат|Mushoku Tensei
d На этот раз я буду жить всерьёз.
@Субару Нацуки|Re:Zero
g Начнём с нуля. Отсюда, с самого начала.
@Дедушка Юдзи|Магическая битва
d Ты сильный — так помогай людям.
@Нисимура|Шёпот сердца · по мотивам
g Ты как необработанный камень. Не спеши — шлифуй себя медленно и тщательно.
@Сита|Небесный замок Лапута
g Человеку нужны корни: жить на земле, вместе с землёй.
@Гаара|Naruto · по мотивам
g Я хочу стать тем, кто нужен другим.
@Пейн|Naruto
x Тот, кто не знает боли, не может понять мир.
@Санджи|One Piece · по мотивам
g Я не позволю никому остаться голодным.
@Портгас Д. Эйс|One Piece
x Спасибо, что любили меня.
@Эдвард Ньюгейт (Белоус)|One Piece
d Ван Пис существует!
@Усопп|One Piece · по мотивам
d Мне страшно. Но я всё равно пойду.
@Рукия Кучики|Bleach · по мотивам
d Иди вперёд, Ичиго. Не оглядывайся.
@Дзэницу Агацума|Клинок, рассекающий демонов · по мотивам
d Я умею только одно движение. Значит, доведу его до совершенства.
@Иноскэ Хасибира|Клинок, рассекающий демонов
d Кабан идёт в атаку!
@Кэнма Кодзумэ|Haikyuu!! · по мотивам
g Мне просто интересно, что будет дальше.
@Дайти Савамура|Haikyuu!! · по мотивам
d Падшие вороны снова взлетят.
@Моритака Масиро|Bakuman · по мотивам
d Мечта — это работа, которую делаешь каждый день.
@Пэко (Ютака Хосино)|Ping Pong the Animation
d Герой появляется!
@Хината Кавамото|Мартовский лев · по мотивам
d Я не жалею о том, что поступила правильно.
@Сэйсю Хандо|Barakamon · по мотивам
g Пиши так, как хочешь ты, а не так, как правильно.
@Хитори Гото|Bocchi the Rock! · по мотивам
g Даже если страшно выходить на сцену, можно играть, глядя в пол. Главное — играть.
@Сон Джину|Solo Leveling
d Ежедневное задание выполнено.
@Сон Джину|Solo Leveling · по мотивам
d Я буду становиться сильнее каждый день.
@Боджи|Ranking of Kings · по мотивам
g Сила — не только в мышцах. Доброта тоже сила.
@Сёко Нисимия|Форма голоса · по мотивам
g Помоги мне жить. Давай жить вместе.
@Сэнку Исигами|Dr. Stone · по мотивам
d Задача на сто шагов? Начинаем с первого.
`;

  // src/js/features/quotes/samurai.js
  var samurai_default = String.raw`
@Миямото Мусаси|«Книга пяти колец» · девять правил
d Не думай нечестно.
d Путь — в тренировке.
d Познакомься со всеми искусствами.
d Изучи пути всех ремёсел.
d Различай выгоду и потерю в мирских делах.
d Развивай интуитивное суждение и понимание всего.
d Замечай то, что не видно глазу.
d Будь внимателен даже к мелочам.
d Не делай ничего бесполезного.
@Миямото Мусаси|«Книга пяти колец»
d Тысяча дней тренировок, чтобы выковать. Десять тысяч дней, чтобы отполировать.
d Познав одно, познаешь десять тысяч вещей.
d Сегодняшняя победа — над собой вчерашним.
g Нет ничего вне тебя, что даст тебе стать лучше, сильнее или мудрее. Всё — внутри.
d Воспринимай далёкое как близкое, а близкое — как далёкое.
d Ум должен быть широким и прямым, ни натянутым, ни расслабленным.
d Ритм есть во всём. Найди его в своём деле.
g Будь спокоен в обычные дни и в дни сражения.
d Изучай свой путь день и ночь.
@Миямото Мусаси|«Путь одиночества» (Дококудо)
g Принимай всё таким, как оно есть.
g Не ищи удовольствия ради удовольствия.
g Ни о чём не сожалей.
g Не завидуй ни добру, ни злу в других.
d Не будь пристрастен к вещам.
d Не держись за вещи, которые больше не нужны.
g Не позволяй себе зависеть от мимолётных чувств.
d Думай о себе легко, а о мире — глубоко.
d Никогда не сходи с Пути.
@Миямото Мусаси|по мотивам «Книги пяти колец»
g Делай одно дело в одно время — и делай его полностью.
d Сила — в постоянстве, а не во вспышке.
@Мусаси|Vagabond · по мотивам
d Я хочу стать непобедимым. Но что такое «непобедимый»?
g Небо безгранично. Почему же я так тесен?
d Меч не для того, чтобы побеждать других. Он для того, чтобы стать собой.
g Когда отпускаешь желание победить — тело движется само.
d Сегодня — ещё одна тренировка. Завтра — тоже.
@Ягю Сэкисюсай|Vagabond · по мотивам
g «Непобедимый» — это всего лишь слово.
@Такуан Сохо|«Фудотисинмёроку» (известна по Vagabond)
g Если смотреть на один лист, не увидишь всего дерева.
d Не останавливай ум ни на чём — тогда он везде.
@Такуан Сохо|Vagabond · по мотивам
g Ты сражаешься с собой больше, чем с противником.
@Иннэй|Vagabond · по мотивам
d Сильнейший — тот, кто не нуждается в победе.
@Ямамото Цунэтомо|«Хагакурэ»
d Принимай решение за время семи вдохов.
d Нет ничего, кроме единственной цели этого мгновения.
g Жизнь человека длится лишь мгновение. Живи и делай то, что любишь.
d Совершенствованию нет конца. Не думай, что сделал достаточно.
d Человек, никогда не ошибавшийся, опасен.
d Большие дела делаются с лёгким сердцем, а малые — с серьёзностью.
x Путь самурая обретается в смерти.
x Каждое утро представляй свою смерть — и живи без страха.
@Ямамото Цунэтомо|«Хагакурэ» · по мотивам
d Не откладывай. Самурай делает сейчас.
g Медленно и правильно — уже быстро.
d Бусидо — это решимость, которая не колеблется.
d Дело, сделанное сегодня, лучше обещанного на завтра.
g Каждое утро приводи ум в порядок.
d Сосредоточься на одном деле — так достигают мастерства.
@Токугава Иэясу|завещание
g Жизнь человека — как долгий путь с тяжёлой ношей. Не спеши.
g Терпение — основа долгой жизни.
d Кто знает только победы и не знает поражений — тому плохо придётся.
d Вини себя, а не других.
@Уэсуги Кэнсин|приписывается
d Тот, кто цепляется за жизнь, погибает. Тот, кто не боится смерти, живёт.
@Морихэй Уэсиба|основатель айкидо
d Истинная победа — победа над собой.
g Не ищи ошибок в других. Ищи путь в себе.
d Практикуй каждый день — и поймёшь.
@Сюнрю Судзуки|«Ум дзэн, ум новичка»
g В уме новичка много возможностей. В уме эксперта — мало.
@Дзэнская притча|
g До просветления — руби дрова, носи воду. После просветления — руби дрова, носи воду.
g Когда ешь — ешь. Когда идёшь — иди.
g Чашка полезна, потому что пуста.
@Японская пословица|
d Упади семь раз — поднимись восемь.
g Даже обезьяна падает с дерева.
d Три года сиди на камне — и он нагреется.
@Японская пословица|приписывается
d Видение без действия — сон. Действие без видения — кошмар.
g Даже пылинки, собранные вместе, становятся горой.
@Японское понятие|кайдзен
d Понемногу, но каждый день.
@Японское понятие|ити-го ити-э
g Одна встреча — один шанс. Этот момент больше не повторится.
@Японское понятие|ваби-саби
g Несовершенство — тоже красота.
@Японское понятие|сёсин
g Смотри на привычное как в первый раз.
@Нитобэ Инадзо|«Бусидо: душа Японии»
d Храбрость — это делать то, что правильно.
g Вежливость — проявление уважения к чувствам других.
@Сунь-цзы|«Искусство войны»
d Победоносный воин сначала побеждает, а потом идёт на войну.
d Возможность победить создаёт сам противник. Не дать себя победить — в твоих руках.
d Посреди хаоса есть и возможность.
`;

  // src/js/features/quotes/classic.js
  var classic_default = String.raw`
@Сенека|«Нравственные письма к Луцилию»
d Пока мы откладываем, жизнь проходит.
d Не потому мы не решаемся, что трудно. Потому трудно, что не решаемся.
g Мы чаще страдаем в воображении, чем в действительности.
d Кто везде — тот нигде.
d Начни жить сразу и считай каждый день отдельной жизнью.
d Учиться никогда не поздно.
g Пока живёшь — учись жить.
d Ни один ветер не попутен тому, кто не знает, в какую гавань плывёт.
g Часть времени у нас отнимают, часть похищают, часть утекает сама. Береги время.
d Трудности укрепляют ум, как труд — тело.
@Сенека|приписывается
d Удача — это когда подготовка встречается с возможностью.
@Марк Аврелий|«Размышления»
d Препятствие на пути становится путём.
d Делай каждое дело так, будто оно последнее в твоей жизни.
d Если тебе что-то трудно, не думай, что это невозможно для человека.
g Ты властен над своим умом, а не над внешними событиями. Пойми это — и обретёшь силу.
d Не трать больше времени на споры о том, каким должен быть хороший человек. Будь им.
g Утром, когда не хочется вставать, напомни себе: я встаю, чтобы делать дело человека.
g Очень мало нужно для счастливой жизни: всё это — внутри тебя, в твоём образе мыслей.
d Что не полезно рою, то не полезно и пчеле.
@Марк Аврелий|«Размышления» · по мотивам
g Счастье твоей жизни зависит от качества твоих мыслей.
@Эпиктет|«Энхиридион»
g Есть вещи, которые зависят от нас, и вещи, которые от нас не зависят.
g Людей беспокоят не события, а их мнения о событиях.
d Не требуй, чтобы всё шло как хочешь. Желай, чтобы шло как идёт, — и будешь спокоен.
@Эпиктет|«Беседы»
d Ничто великое не возникает вдруг.
d Никто не свободен, кто не владеет собой.
@Сократ|приписывается
g Я знаю, что ничего не знаю.
d Неисследованная жизнь не стоит того, чтобы её жить.
@Гераклит|фрагменты
g В одну и ту же реку нельзя войти дважды.
g Всё течёт, всё меняется.
@Аристотель|«Никомахова этика» · по мотивам
d Мы становимся справедливыми, совершая справедливые поступки, и мужественными — совершая мужественные.
@Аристотель|приписывается
d Начало — больше половины всего дела.
@Лао-цзы|«Дао дэ цзин»
d Путь в тысячу ли начинается с первого шага.
g Природа не торопится, но всё успевает.
g Знающий людей — умён. Знающий себя — просветлён.
d Побеждающий других — силён. Побеждающий себя — могуществен.
g Мягкое и слабое побеждает твёрдое и сильное.
g Великое начинается с малого.
@Конфуций|«Беседы и суждения»
d Ошибиться и не исправиться — вот это и есть ошибка.
d Учиться и время от времени повторять — разве это не приятно?
g Благородный муж требует с себя, низкий человек — с других.
@Чжуан-цзы|приписывается
g Счастье — это отсутствие стремления к счастью.
@Будда|«Дхаммапада» · по мотивам
g Ум — всё. Чем ты думаешь, тем ты и становишься.
g Капля за каплей наполняется кувшин.
@Руми|приписывается
g Ты не капля в океане. Ты — весь океан в капле.
@Гёте|«Фауст» · по мотивам
d Что бы ты ни мог сделать или о чём мечтаешь — начни. В смелости есть гений, сила и магия.
@Гёте|приписывается
g Без спешки, но и без отдыха.
d Знать недостаточно, нужно применять. Хотеть недостаточно, нужно делать.
@Фридрих Ницше|«Сумерки идолов»
d У кого есть «зачем» жить, тот выдержит почти любое «как».
d Что не убивает меня, делает меня сильнее.
@Виктор Франкл|«Человек в поисках смысла»
d Когда мы больше не можем изменить ситуацию, перед нами стоит задача изменить себя.
g У человека можно отнять всё, кроме одного: свободы выбрать своё отношение к обстоятельствам.
@Лев Толстой|приписывается
d Все думают о том, чтобы изменить мир, но никто — о том, чтобы изменить себя.
@Лев Толстой|«Война и мир»
g Самые сильные воины — это терпение и время.
@Фёдор Достоевский|«Братья Карамазовы»
d Главное — не лгите себе.
@Фёдор Достоевский|приписывается
d Делай то, что ты должен, и будь что будет.
@Антон Чехов|письмо брату Николаю, 1886
d Тут нужны беспрерывный дневной и ночной труд, вечное чтение, штудировка, воля… Тут дорог каждый час.
@Антон Чехов|приписывается
d Если хочешь иметь то, что никогда не имел, придётся делать то, что никогда не делал.
@А. С. Пушкин|«Евгений Онегин»
g Привычка свыше нам дана: замена счастию она.
@Антуан де Сент-Экзюпери|«Маленький принц»
g Зорко одно лишь сердце. Самого главного глазами не увидишь.
g Ты навсегда в ответе за всех, кого приручил.
d Встал поутру, умылся, привёл себя в порядок — и сразу же приведи в порядок свою планету.
@Антуан де Сент-Экзюпери|приписывается
d Цель без плана — просто желание.
@Вольтер|«Философский словарь»
d Лучшее — враг хорошего.
@Леонардо да Винчи|приписывается
d Простота — высшая степень изысканности.
@Мишель Монтень|приписывается
g В моей жизни было много ужасных несчастий, и большинство из них так и не случилось.
@Ральф Уолдо Эмерсон|приписывается
d Делай то, чего боишься, — и страх непременно исчезнет.
g Цель жизни — не быть счастливым, а быть полезным, достойным и сострадательным.
@Генри Дэвид Торо|«Уолден»
g Я ушёл в лес, потому что хотел жить осмысленно.
d Если ты построил воздушные замки — твой труд не пропал. Теперь подведи под них фундамент.
@Уильям Джеймс|приписывается
d Действуй так, будто то, что ты делаешь, имеет значение. Это так и есть.
@Ричард Фейнман|лекция «Наука карго-культа», 1974
d Главный принцип — не обманывать себя. А себя обмануть легче всего.
@Ричард Фейнман|приписывается
g Изучай то, что тебе интересно, самым недисциплинированным и непочтительным способом.
@Мария Кюри|приписывается
d В жизни нечего бояться — есть только то, что нужно понять.
@Исаак Ньютон|письмо Роберту Гуку, 1675
g Если я видел дальше других, то потому, что стоял на плечах гигантов.
@Альберт Эйнштейн|приписывается
d Дело не в том, что я очень умный. Я просто дольше остаюсь с задачей.
g Воображение важнее знания.
@Никола Тесла|приписывается
d Будущее покажет, а настоящее — моё.
@Уинстон Черчилль|приписывается
d Если вы идёте через ад — продолжайте идти.
@Эрнест Хемингуэй|«Старик и море»
d Человек создан не для поражения. Человека можно уничтожить, но нельзя победить.
@Эрнест Хемингуэй|«Праздник, который всегда с тобой» · по мотивам
d Напиши одно правдивое предложение. Потом ещё одно.
@Рэй Брэдбери|«Дзен в искусстве написания книг» · по мотивам
d Работай. Не думай. Думание — враг творчества.
@Майя Энджелоу|интервью
d Нельзя израсходовать творчество. Чем больше используешь, тем больше его становится.
@Джон Леннон|«Beautiful Boy»
g Жизнь — это то, что происходит, пока ты строишь другие планы.
@Дж. Р. Р. Толкин|«Братство кольца»
g Не все, кто странствует, потеряны.
g Даже самый маленький человек может изменить ход будущего.
@Льюис Кэрролл|«Алиса в Зазеркалье» · по мотивам
d Нужно бежать со всех ног, чтобы только оставаться на месте. А чтобы куда-то попасть — бежать вдвое быстрее.
@Льюис Кэрролл|«Алиса в Стране чудес»
g Начни с начала и продолжай, пока не дойдёшь до конца. Тогда остановись.
@Виктор Гюго|приписывается
d Нельзя остановить идею, время которой пришло.
@Платон|приписывается
d Начало — самая важная часть работы.
@Плутарх|приписывается
g Ум — не сосуд, который нужно наполнить, а огонь, который нужно зажечь.
@Овидий|«Наука любви»
d Капля долбит камень не силой, а частым падением.
@Публилий Сир|«Сентенции»
d Любое дело кажется трудным, пока не начнёшь.
@Гораций|«Послания»
d Начать — значит наполовину сделать. Решись быть мудрым — начни.
@Цицерон|приписывается
g Пока дышу — надеюсь.
@Фрэнсис Бэкон|«Опыты»
d Знание — сила.
@Блез Паскаль|«Мысли» · по мотивам
g Все беды человека от того, что он не умеет спокойно посидеть в комнате.
@Иммануил Кант|приписывается
g Три вещи нужны для счастья: что-то делать, кого-то любить, на что-то надеяться.
@Серен Кьеркегор|дневники
g Жизнь можно понять только оглядываясь назад, но прожить — только глядя вперёд.
@Альбер Камю|«Возвращение в Типасу»
g Посреди зимы я обнаружил в себе непобедимое лето.
@Альбер Камю|«Миф о Сизифе»
x Нужно представлять Сизифа счастливым.
@Карл Юнг|приписывается
d Ты — то, что ты делаешь, а не то, что говоришь, что сделаешь.
@Рабиндранат Тагор|«Блуждающие птицы»
g Нельзя перейти море, просто стоя и глядя на воду.
@Халиль Джебран|«Пророк» · по мотивам
g Работа — это любовь, ставшая видимой.
@Джордж Элиот|приписывается
g Никогда не поздно стать тем, кем ты мог бы быть.
@Дейл Карнеги|приписывается
d Бездействие порождает сомнения и страх. Действие порождает уверенность и смелость.
@Анна Франк|«Дневник»
g Как замечательно, что никому не нужно ждать ни минуты, чтобы начать улучшать мир.
@Хелен Келлер|приписывается
g Один мало что может сделать. Вместе мы можем сделать так много.
@Мать Тереза|приписывается
g Не ждите вождей. Делайте это сами, человек за человеком.
@Нельсон Мандела|приписывается
d Всё кажется невозможным, пока не будет сделано.
@Махатма Ганди|приписывается
d Будущее зависит от того, что ты делаешь сегодня.
@Сунь-цзы|«Искусство войны»
d Знай врага и знай себя — и в ста битвах не будешь в опасности.
@Сократ|у Платона, «Апология»
d Лучше терпеть несправедливость, чем совершать её.
@Диоген|приписывается
g Отойди, ты заслоняешь мне солнце.
@Эпикур|«Письмо к Менекею» · по мотивам
g Не порти то, что имеешь, желанием того, чего нет.
`;

  // src/js/features/quotes-data.js
  var QUOTE_CATS = {
    gentle: "Поддержка",
    action: "Дисциплина и дело",
    dc: "Бэтмен и DC",
    anime: "Аниме",
    samurai: "Самураи",
    classic: "Классика"
  };
  var TONE = { g: "gentle", d: "drive", x: "deep" };
  function quoteId(cat, author, text) {
    let h = 2166136261;
    for (const ch of `${author}${text}`) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return cat[0] + (h >>> 0).toString(36);
  }
  function parsePack(cat, src) {
    let author = "Focusday", source = "Напоминание себе";
    const out = [];
    for (const raw of String(src).split("\n")) {
      const l = raw.trim();
      if (!l || l.startsWith("#")) continue;
      if (l[0] === "@") {
        const [a, s = ""] = l.slice(1).split("|");
        author = a.trim();
        source = s.trim();
        continue;
      }
      const tone = TONE[l[0]];
      if (!tone || l[1] !== " ") continue;
      const text = l.slice(2).trim();
      if (!text) continue;
      out.push({ id: quoteId(cat, author, text), cat, tone, text, author, source });
    }
    return out;
  }
  var QUOTE_LIBRARY = [
    ...parsePack("gentle", gentle_default),
    ...parsePack("action", action_default),
    ...parsePack("dc", dc_default),
    ...parsePack("anime", anime_default),
    ...parsePack("samurai", samurai_default),
    ...parsePack("classic", classic_default)
  ];

  // src/js/features/quotes.js
  var ROTATE_MS = 5 * 6e4;
  var AWAY_MS = 15e4;
  var RECENT_MAX = 150;
  var FAV_SHARE = 0.25;
  var DEFAULT_CATS = { gentle: true, action: true, dc: true, anime: true, samurai: true, classic: true, custom: true };
  var hiddenAt = 0;
  var current = null;
  function ensureQuotes(d = data) {
    const q = d.quotes && typeof d.quotes === "object" ? d.quotes : {};
    q.cats = { ...DEFAULT_CATS, ...q.cats || {} };
    q.showDeep = !!q.showDeep;
    q.hidden = Array.isArray(q.hidden) ? q.hidden.filter((x) => typeof x === "string") : [];
    q.recent = Array.isArray(q.recent) ? q.recent.filter((x) => typeof x === "string").slice(-RECENT_MAX) : [];
    q.fav = Array.isArray(q.fav) ? q.fav.filter((x) => typeof x === "string") : [];
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
    const avoid = new Set(q.recent.slice(-Math.min(RECENT_MAX, pool.length - 1)));
    let list = pool.filter((x) => !avoid.has(x.id));
    if (!list.length) list = pool.filter((x) => x.id !== q.recent.at(-1));
    if (!list.length) list = pool;
    const favs = list.filter((x) => q.fav.includes(x.id));
    let pick;
    if (favs.length && rnd() < FAV_SHARE) pick = favs[Math.floor(rnd() * favs.length)];
    else {
      const by = /* @__PURE__ */ new Map();
      for (const x of list) {
        if (!by.has(x.cat)) by.set(x.cat, []);
        by.get(x.cat).push(x);
      }
      const groups = [...by.values()], w = groups.map((g) => Math.sqrt(g.length));
      let r = rnd() * w.reduce((a, b) => a + b, 0), i = 0;
      while (i < groups.length - 1 && (r -= w[i]) >= 0) i++;
      pick = groups[i][Math.floor(rnd() * groups[i].length)];
    }
    q.recent = [...q.recent, pick.id].slice(-RECENT_MAX);
    q.changedAt = Date.now();
    q.currentId = pick.id;
    return pick;
  }
  function toggleFavQuote() {
    if (!current) return;
    const q = ensureQuotes(), on = !q.fav.includes(current.id);
    q.fav = on ? [...q.fav, current.id] : q.fav.filter((x) => x !== current.id);
    persist();
    paintFav();
    renderQuoteSettings();
    toast(on ? "В избранном — будет попадаться чаще ❤" : "Убрано из избранного");
  }
  function paintFav() {
    const b = $("#quoteFav");
    if (!b) return;
    const on = !!current && ensureQuotes().fav.includes(current.id);
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("on", on);
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
      paintFav();
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
    const count = (k) => (k === "custom" ? q.custom : QUOTE_LIBRARY).filter((x) => x.cat === k && (q.showDeep || x.tone !== "deep")).length;
    box.innerHTML = Object.entries(cats).map(([k, n]) => `<button type="button" class="chip-toggle" data-qcat="${k}" aria-pressed="${q.cats[k] !== false}">${esc(n)} <small>${count(k)}</small></button>`).join("");
    const deep = $("#quoteDeep");
    if (deep) deep.setAttribute("aria-pressed", String(q.showDeep));
    const info = $("#quoteInfo");
    if (info) info.textContent = `${quotePool(q).length} из ${QUOTE_LIBRARY.length + q.custom.length} в ротации · избранных ${q.fav.length} · скрыто ${q.hidden.length}${q.custom.length ? " · своих " + q.custom.length : ""}`;
    const cc = $("#quoteCustomClear");
    if (cc) cc.hidden = !q.custom.length;
    const un = $("#quoteUnhide");
    if (un) un.hidden = !q.hidden.length;
  }
  function bindQuotes() {
    ensureQuotes();
    $("#quoteNext")?.addEventListener("click", () => showNextQuote(true));
    $("#quoteHide")?.addEventListener("click", hideCurrentQuote);
    $("#quoteFav")?.addEventListener("click", toggleFavQuote);
    $("#quoteCustomClear")?.addEventListener("click", () => {
      const q = ensureQuotes(), n = q.custom.length, keep = q.custom;
      q.custom = [];
      persist();
      renderQuoteSettings();
      if (current?.cat === "custom") showNextQuote(true);
      toast(`Удалено своих цитат: ${n}`, "success", { label: "Вернуть", onClick: () => {
        ensureQuotes().custom = keep;
        persist();
        renderQuoteSettings();
      } });
    });
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
    const sid = $("#setAmbId");
    if (sid && document.activeElement !== sid) sid.value = a.id;
    const sv = $("#setAmbVol");
    if (sv && document.activeElement !== sv) sv.value = String(Math.round(a.volume * 100));
    $("#setAmbWithFocus")?.setAttribute("aria-pressed", String(a.withFocus));
    const pv = $("#setAmbPreview");
    if (pv) {
      pv.querySelector("span").textContent = player.playing ? "Остановить" : "Послушать";
      pv.querySelector("use")?.setAttribute("href", player.playing ? "#i-pause" : "#i-play");
    }
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
    const sid = $("#setAmbId");
    if (sid) {
      sid.innerHTML = SOUNDS.map((s) => `<option value="${s.id}">${s.emoji} ${esc(s.name)}</option>`).join("");
      sid.addEventListener("change", () => {
        if (player.playing) playAmbient(sid.value);
        else {
          ensureAmbient().id = sid.value;
          persist();
          renderAmbient();
        }
      });
      $("#setAmbVol")?.addEventListener("input", (e) => {
        const a = ensureAmbient();
        a.volume = Number(e.target.value) / 100;
        player.setVolume(a.volume);
        persist();
        renderAmbient();
      });
      $("#setAmbWithFocus")?.addEventListener("click", () => {
        const a = ensureAmbient();
        a.withFocus = !a.withFocus;
        persist();
        renderAmbient();
      });
      $("#setAmbPreview")?.addEventListener("click", () => {
        if (player.playing) stopAmbient(0.6);
        else {
          auto = false;
          playAmbient();
        }
      });
    }
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
      { t: "Настройки: вид и звуки", icon: "gear", run: () => openSettings("look"), group: "Настройки" },
      { t: "Настройки: котик-напарник", hint: "🐾", icon: "gear", run: () => openSettings("buddy"), group: "Настройки" },
      { t: "Настройки: цитаты", icon: "feather", run: () => openSettings("quotes"), group: "Настройки" },
      { t: "Настройки: синхронизация", icon: "sync", run: () => openSettings("sync"), group: "Настройки" },
      { t: "Настройки: данные и бэкапы", icon: "download", run: () => openSettings("data"), group: "Настройки" },
      { t: playing ? "Выключить фоновый звук" : "Включить фоновый звук", icon: "wave", run: () => playing ? stopAmbient() : playAmbient(), group: "Звук" },
      ...SOUNDS.map((s) => ({ t: `Фон: ${s.name}`, hint: s.emoji, icon: "wave", run: () => playAmbient(s.id), group: "Звук" })),
      { t: "Другая цитата", icon: "feather", run: () => showNextQuote(true) },
      { t: "Сменить тему", icon: document.body.classList.contains("light-theme") ? "moon" : "sun", run: () => $("#themeBtn")?.click() },
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
    $("#paletteInput").setAttribute("aria-activedescendant", items.length ? `pal-${active}` : "");
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
      data.theme = document.body.classList.contains("light-theme") ? "dark" : "light";
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
  var alertIdleSec = 0;
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
  function pauseWithRefund(now = Date.now()) {
    const wasAlert = alertAt > 0;
    pauseFocus(false);
    if (wasAlert) {
      const idleMs = Math.max(0, alertIdleSec * 1e3 + (now - alertAt));
      const cap = (data.focusMinutes || 25) * 6e4;
      const before = data.focusRemainingMs;
      data.focusRemainingMs = Math.min(cap, before + idleMs);
      if (data.focusRemainingMs - before >= 3e4) toast(`Время простоя (${Math.round((data.focusRemainingMs - before) / 6e4) || 1} мин) вернул в таймер 🐾`);
    }
    alertAt = 0;
    alertIdleSec = 0;
    persist();
    renderFocus();
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
      pauseWithRefund();
      b.breakUntil = Date.now() + b.breakMin * 6e4;
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
        if (now - alertAt >= AWAY_AUTO_PAUSE_MS || data.focusRemainingMs > 0 && data.focusRemainingMs <= 15e3) {
          pauseWithRefund(now);
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
        alertIdleSec = idle;
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
    const br = $("#buddyBreakMin");
    if (br) br.value = String([5, 10, 15].includes(b.breakMin) ? b.breakMin : 5);
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
    $("#buddyBreakMin")?.addEventListener("change", (e) => {
      ensureBuddy().breakMin = +e.target.value;
      persist();
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
    safe("settings", bindSettings);
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
