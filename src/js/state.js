/* Focusday · state.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { trackChanges } from './backup.js';
import { $, LEGACY_KEYS, LISTS, STORAGE_KEY, freshData, fromISO, normalizeTask, storage, todayISO, validDate } from './core.js';
import { toast } from './render.js';
import { Sync } from './sync.js';


export let data = freshData(); export let tickHandle = null; export let focusDeadline = null; export let stepDraft = []; export let lastTickSave = 0; export let lastRenderedSecond = -1; export let lastRoutineDay = todayISO();


export function loadData() {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        data = {...freshData(), ...parsed};
        // Deep-merge the known nested collections with safe defaults; backups may come from older releases.
        if (!Array.isArray(data.tasks)) data.tasks = [];
        if (!Array.isArray(data.lists)) data.lists = freshData().lists;
        if (!Array.isArray(data.achievements)) data.achievements = [];
        if (!Array.isArray(data.customQuotes)) data.customQuotes = [];
        data.tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask).filter(Boolean) : [];
        data.lists = Array.isArray(parsed.lists) && parsed.lists.length ? parsed.lists.filter(l=>l && l.id && l.name).map(l=>({id:String(l.id),name:String(l.name).slice(0,30),color:String(l.color||'#a78bfa')})) : LISTS.map(x=>({...x}));
        // Never orphan tasks when a backup contains a list that is missing from the lists array.
        const knownListIds = new Set(data.lists.map(l=>l.id));
        data.tasks.forEach(t=>{ if(!knownListIds.has(t.listId)){ data.lists.push({id:t.listId,name:`Восстановленный список`,color:'#a78bfa'}); knownListIds.add(t.listId); } });
      }
    } else {
      // One-time migration from the previous Task Journal version.
      for (const key of LEGACY_KEYS) {
        const legacy = storage.getItem(key);
        if (!legacy) continue;
        const tasks = JSON.parse(legacy);
        if (Array.isArray(tasks)) data.tasks = tasks.map(normalizeTask).filter(Boolean);
        const timers = JSON.parse(storage.getItem('ios_timers_2026') || '{}');
        data.tasks.forEach(t => { if (Number(timers[t.id]) > 0) t.elapsedMs = Number(timers[t.id]); });
        break;
      }
    }
  } catch (err) { console.warn('Не удалось прочитать старые данные:', err); toast('Не получилось прочитать часть старых данных. Можно импортировать резервную копию.', 'error'); data = freshData(); }
  if (typeof data.soundEnabled !== 'boolean') data.soundEnabled = true;
  if (!Array.isArray(data.tasks)) data.tasks = [];
  if (!Array.isArray(data.achievements)) data.achievements = [];
  if (!Array.isArray(data.customQuotes)) data.customQuotes = [];
  if (!Array.isArray(data.lists) || !data.lists.length) data.lists = LISTS.map(x=>({...x}));
  data.calendarOffset = Number.isFinite(Number(data.calendarOffset)) ? Math.max(-1200, Math.min(1200, Math.trunc(Number(data.calendarOffset)))) : 0;
  if (!validDate(data.selectedDate) || data.view === 'today') data.selectedDate = todayISO();
  if (!['today','inbox','upcoming','done','habits','money','journal'].includes(data.view) && !String(data.view).startsWith('list:')) data.view = 'today';
  if (String(data.view).startsWith('list:') && !data.lists.some(l=>l.id===String(data.view).slice(5))) data.view='today';
  if (!['all','todo','inprogress','done'].includes(data.filter)) data.filter = 'all';
  if (!['dark','light'].includes(data.theme)) data.theme = 'dark';
  data.energy = Math.max(1,Math.min(5,Number(data.energy)||3));
  data.focusMinutes = [10,25,45].includes(Number(data.focusMinutes)) ? Number(data.focusMinutes) : 10;
  data.focusRemainingMs = Math.max(0, Number(data.focusRemainingMs) || data.focusMinutes*60000);
  data.focusSessionMs = Math.max(0, Number(data.focusSessionMs)||0); data.focusSessions = Math.max(0, Number(data.focusSessions)||0);
  // Interrupted focus sessions pause on restart; elapsed task timers continue accurately without background intervals.
  data.focusRunning = false; data.focusStartedAt = null;
  data.tasks.forEach(t=>{ if(t.status==='inprogress' && t.timerStartedAt) { t.elapsedMs += Math.max(0, Date.now()-t.timerStartedAt); t.timerStartedAt = null; } });
  persist();
}
export function publishOverlayState() {
  try { const task=data.tasks.find(t=>t.id===data.focusTaskId) || data.tasks.find(t=>t.status==='inprogress'); const state={ title: task?.title || '', running: !!data.focusRunning, taskRunning: !!(task && task.status==='inprogress'), paused: !data.focusRunning, remainingMs: data.focusRemainingMs, totalMs: data.focusMinutes*60000, deadline: focusDeadline }; const key=JSON.stringify(state); if(key===lastOverlayState) return; lastOverlayState=key; window.focusdayDesktop?.publishState({...state, updatedAt: Date.now()}); } catch (_) {}
}
export let persistTimer = null, lastOverlayState = '';
export function persist() { if (persistTimer) return; persistTimer = setTimeout(persistNow, 120); }
export function persistNow() {
  clearTimeout(persistTimer); persistTimer = null;
  try { if (typeof trackChanges === 'function') trackChanges(); const durable = storage.setItem(STORAGE_KEY, JSON.stringify(data)); const status=$('#storageStatus'); if (durable) { if(status)status.textContent = 'Сохранено автоматически'; publishOverlayState(); if (typeof Sync !== 'undefined') Sync.schedule(); } else { if(status)status.textContent = 'Внимание: данные пока не сохранены на диск'; console.error('localStorage недоступен; изменения хранятся только до закрытия приложения'); toast('Не удалось сохранить данные на диск. Экспортируй резервную копию и проверь доступ к хранилищу.', 'error'); } }
  catch (err) { const st=$('#storageStatus'); if(st) st.textContent = 'Не удалось сохранить'; console.error(err); toast('Хранилище браузера переполнено. Экспортируй резервную копию.', 'error'); }
}
export function listById(id) { return data.lists.find(l=>l.id===id) || {id:'inbox',name:'Входящие',color:'#a78bfa'}; }
export function taskElapsed(task) { return Math.max(0, Number(task.elapsedMs)||0) + (task.timerStartedAt ? Math.max(0, Date.now()-task.timerStartedAt) : 0); }
export function fmtDuration(ms) { const s=Math.floor(Math.max(0,ms)/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60), sec=s%60; return h ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
export function prettyDate(iso, opts={day:'numeric',month:'short'}) { return fromISO(iso).toLocaleDateString('ru-RU',opts); }
export function set_stepDraft(v) { return (stepDraft = v); }
export function set_focusDeadline(v) { return (focusDeadline = v); }
export function set_lastRoutineDay(v) { return (lastRoutineDay = v); }
export function set_lastRenderedSecond(v) { return (lastRenderedSecond = v); }
export function set_lastTickSave(v) { return (lastTickSave = v); }
export function set_data(v) { return (data = v); }
export function set_tickHandle(v) { return (tickHandle = v); }
