/* Focusday · adhd.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { toggleTaskStatus } from './actions.js';
import { $, addDays, fromISO, normalizeTask, toISO, todayISO, uid } from './core.js';
import { routeQuick } from './life/quick.js';
import { award, checkAchievements } from './progress.js';
import { renderAll, renderFocus, switchView, toast } from './render.js';
import { playSound } from './sound.js';
import { data, persist, prettyDate } from './state.js';

/* ═════ ADHD-модуль: дофамин, сжатие, режим фокуса, быстрый захват ═════ */
export let lastPct = -1;
export function updateDopamine(pct){const bar=$('#dopamineBar');if(!bar)return;bar.style.setProperty('--p',pct/100);bar.setAttribute('aria-valuenow',pct);bar.classList.toggle('full',pct===100);if(lastPct>=0&&pct>lastPct)pulseDopamine();lastPct=pct;}
export function pulseDopamine(){const bar=$('#dopamineBar');if(!bar)return;bar.classList.remove('pulse');void bar.offsetWidth;bar.classList.add('pulse');}
export function setCompress(on){data.compress=!!on;document.body.classList.toggle('compress-mode',data.compress);$('#compressBtn')?.setAttribute('aria-pressed',String(data.compress));persist();toast(data.compress?'Сжатый режим: только главное и следующий шаг':'Обычный режим');}
export function setFocusMode(on){
  document.body.classList.toggle('focus-mode',!!on);$('#focusModeBtn')?.setAttribute('aria-pressed',String(!!on));$('#focusExitBtn').hidden=!on;
  if(on){if(!data.focusTaskId){const first=data.tasks.find(t=>t.status!=='done'&&t.date===data.selectedDate)||data.tasks.find(t=>t.status!=='done');if(first)data.focusTaskId=first.id;}renderFocus();window.scrollTo({top:0});}
}
export function focusQuickCapture(){const i=$('#quickCaptureInput');if(!i)return;i.scrollIntoView({block:'center',behavior:'smooth'});i.focus();}
/* Парсер естественного ввода: «отчёт завтра 15м !! #работа» */
export function parseQuick(raw){
  let text=` ${raw} `,date=data.view==='today'?data.selectedDate:todayISO(),duration=25,priority=2,listId=String(data.view).startsWith('list:')?data.view.slice(5):'inbox';
  const days={'сегодня':0,'today':0,'завтра':1,'tomorrow':1,'послезавтра':2};
  text=text.replace(/\s(сегодня|today|послезавтра|завтра|tomorrow)(?=\s)/i,(_,w)=>{date=toISO(addDays(fromISO(todayISO()),days[w.toLowerCase()]));return ' ';});
  text=text.replace(/\s(\d{1,3})\s?(м|мин|m|min)(?=\s)/i,(_,n)=>{duration=Math.max(1,Math.min(600,Number(n)));return ' ';});
  text=text.replace(/\s(\d{1,2})\s?(ч|h)(?=\s)/i,(_,n)=>{duration=Math.min(600,Number(n)*60);return ' ';});
  text=text.replace(/\s(!{1,3})(?=\s)/,()=>{priority=3;return ' ';});
  text=text.replace(/\s#([\p{L}\d_/-]+)(?=\s)/u,(_,tag)=>{const l=data.lists.find(l=>l.name.toLocaleLowerCase('ru').replace(/\s/g,'').startsWith(tag.toLocaleLowerCase('ru')));if(l)listId=l.id;return ' ';});
  return {title:text.replace(/\s+/g,' ').trim(),date,duration,priority,listId};
}
export function quickAdd(raw){ return routeQuick(raw); }
export function quickAddTask(raw){
  const p=parseQuick(raw);if(!p.title)return false;
  data.tasks.push(normalizeTask({id:uid(),title:p.title,description:'',date:p.date,duration:p.duration,priority:p.priority,listId:p.listId,energy:data.energy,status:'todo',createdAt:Date.now(),steps:[]}));
  award('capture',{anchor:$('#quickCaptureInput')});persist();renderAll();playSound('success');toast(`Записано${p.date!==todayISO()?' на '+prettyDate(p.date):''} — голова свободна ✦`);checkAchievements();return true;
}
export function bindAdhd(){
  $('#compressBtn')?.addEventListener('click',()=>setCompress(!data.compress));
  $('#focusModeBtn')?.addEventListener('click',()=>setFocusMode(!document.body.classList.contains('focus-mode')));
  $('#focusExitBtn')?.addEventListener('click',()=>setFocusMode(false));
  $('#quickCapture')?.addEventListener('submit',e=>{e.preventDefault();const i=$('#quickCaptureInput');if(quickAdd(i.value)){i.value='';const f=$('#quickCapture');f.classList.remove('bump');void f.offsetWidth;f.classList.add('bump');}});
  $('.brand')?.addEventListener('click',()=>switchView('today'));
  const scrim=$('#sidebarScrim');const sb=$('#sidebar');
  new MutationObserver(()=>{if(scrim)scrim.hidden=!sb.classList.contains('open');}).observe(sb,{attributes:true,attributeFilter:['class']});
  scrim?.addEventListener('click',()=>sb.classList.remove('open'));
  /* Команды из плавающего окна (Tauri/Electron) — через событие, без executeJavaScript */
  window.focusdayDesktop?.onOverlayAction?.(action=>{if(action==='pause'||action==='toggle')$('#focusStartBtn').click();else if(action==='done'){const t=data.tasks.find(t=>t.id===data.focusTaskId);if(t)toggleTaskStatus(t);}else if(action==='quick-add')focusQuickCapture();});
  window.focusdayDesktop?.onQuickAdd?.(text=>{if(text)quickAdd(text);else focusQuickCapture();});
}
