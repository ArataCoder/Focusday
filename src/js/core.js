/* Focusday · core.js — сгенерировано разбиением монолита v1.2, дальше правится руками */


export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const STORAGE_KEY = 'focusday.data.v1';
export const memoryStore = Object.create(null);
export const storage = {
  getItem(key) { try { return window.localStorage.getItem(key); } catch (_) { return Object.prototype.hasOwnProperty.call(memoryStore,key) ? memoryStore[key] : null; } },
  setItem(key,value) { try { window.localStorage.setItem(key,value); delete memoryStore[key]; return true; } catch (_) { memoryStore[key]=String(value); return false; } },
  removeItem(key) { try { window.localStorage.removeItem(key); } catch (_) { delete memoryStore[key]; } }
};
export const LEGACY_KEYS = ['ios_tasks_2026', 'tj_tasks_v2'];
export const LISTS = [
  { id: 'inbox', name: 'Входящие', color: '#a78bfa' },
  { id: 'personal', name: 'Личное', color: '#7fe0bd' },
  { id: 'work', name: 'Работа / учёба', color: '#f6bd79' },
  { id: 'health', name: 'Здоровье', color: '#ff8e9b' }
];
export const ENERGY = ['', 'Мало сил', 'Немного сил', 'Спокойный режим', 'Хороший заряд', 'Полон энергии'];
export const QUOTES = [
  'Прогресс — это не идеальный день. Это возвращение к тому, что важно.',
  'Сделай версию на 20%. Начать важнее, чем сделать идеально.',
  'Тебе не нужно хотеть делать задачу. Нужно только начать с маленького шага.',
  'Отдых — часть плана, а не награда за истощение.',
  'Одна законченная мелочь лучше десяти идеальных планов.'
];
export const todayISO = () => toISO(new Date());
export function toISO(date) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function fromISO(value) { const [y,m,d] = String(value || todayISO()).split('-').map(Number); return new Date(y || 2000, (m || 1)-1, d || 1, 12); }
export function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
export function mondayOf(date) { const d = new Date(date); d.setHours(12,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d; }
export function uid() { return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
export const ic = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
export function esc(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function validDate(v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false; const d=fromISO(v); return Number.isFinite(d.getTime()) && toISO(d)===v; }
export function normalizeTask(t) {
  if (!t || typeof t !== 'object') return null;
  const title = String(t.title || t.name || '').trim().slice(0,120); if (!title) return null;
  const status = ['todo','inprogress','done'].includes(t.status) ? t.status : (t.completed ? 'done' : 'todo');
  const energy = Math.max(1, Math.min(5, Number(t.energy) || 2));
  return { id: String(t.id || uid()), routineId: String(t.routineId || (t.recurrence === 'daily' ? (t.id || uid()) : '')), recurrence: t.recurrence === 'daily' ? 'daily' : 'none', title, description: String(t.description || '').slice(0,1000), date: validDate(t.date) ? t.date : todayISO(), status, priority: Math.max(1,Math.min(3,Number(t.priority) || 2)), duration: Math.max(1,Math.min(600,Number(t.duration || t.estimate) || 25)), listId: String(t.listId || 'inbox'), energy, createdAt: Number(t.createdAt) || Date.now(), completedAt: t.completedAt ? Number(t.completedAt) : null, completedForDate: (typeof t.completedForDate === 'string' && validDate(t.completedForDate)) ? t.completedForDate : null, elapsedMs: Math.max(0, Number(t.elapsedMs) || 0), steps: Array.isArray(t.steps) ? t.steps.filter(s => s && typeof s.text === 'string').slice(0,30).map(s=>({text:s.text.slice(0,180),done:!!s.done,...(s.x?{x:1}:{})})) : [], timerStartedAt: Number(t.timerStartedAt) || null, updatedAt: Number(t.updatedAt) || Math.max(Number(t.completedAt)||0, Number(t.createdAt)||0) || Date.now(), xp: Math.max(0, Number(t.xp) || 0) };
}
export function freshData() { return { version:2, tasks:[], lists:LISTS.map(x=>({...x})), selectedDate:todayISO(), calendarOffset:0, view:'today', filter:'all', sort:'smart', energy:3, theme:'dark', focusMinutes:10, focusTaskId:null, focusRemainingMs:600000, focusRunning:false, focusStartedAt:null, focusSessionMs:0, focusSessions:0, viewMode:'list', customQuotes:[], achievements:[], soundEnabled:true }; }
export function plural(n,forms){const n10=n%10,n100=n%100;return n10===1&&n100!==11?forms[0]:n10>=2&&n10<=4&&(n100<12||n100>14)?forms[1]:forms[2];}
