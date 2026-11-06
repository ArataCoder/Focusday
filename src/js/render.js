/* Focusday · render.js — сгенерировано разбиением монолита v1.2, дальше правится руками */
import { updateDopamine } from './adhd.js';
import { $, $$, ENERGY, addDays, esc, fromISO, ic, mondayOf, normalizeTask, plural, toISO, todayISO, uid, validDate } from './core.js';
import { lowFilter } from './life/journal.js';
import { renderLife } from './life/render.js';
import { checkAchievements, renderAchievements, renderHeatmap, renderProgress } from './progress.js';
import { playSound } from './sound.js';
import { data, fmtDuration, focusDeadline, listById, persist, prettyDate, set_stepDraft, stepDraft, taskElapsed } from './state.js';

export function getViewTasks() {
  const q = ($('#searchInput')?.value || '').trim().toLocaleLowerCase('ru');
  let list = data.tasks.filter(t => {
    if (data.view === 'today') return t.date === data.selectedDate;
    if (data.view === 'inbox') return t.listId === 'inbox' && t.status !== 'done';
    if (data.view === 'upcoming') return t.status !== 'done' && t.date >= todayISO();
    if (data.view === 'done') return t.status === 'done';
    if (String(data.view).startsWith('list:')) return t.listId === data.view.slice(5) && t.status !== 'done';
    return true;
  });
  if (data.filter !== 'all' && data.view !== 'done') list = list.filter(t=>t.status===data.filter);
  // 'Done' is an explicit status view; don't let a stale status filter hide its contents.
  if (q) list = list.filter(t => `${t.title} ${t.description} ${listById(t.listId).name} ${t.steps.map(s=>s.text).join(' ')}`.toLocaleLowerCase('ru').includes(q));
  const sort = $('#sortSelect')?.value || data.sort;
  list.sort((a,b)=> {
    if (sort==='priority') return b.priority-a.priority || a.createdAt-b.createdAt;
    if (sort==='created') return b.createdAt-a.createdAt;
    if (sort==='duration') return a.duration-b.duration;
    if (a.status==='inprogress' && b.status!=='inprogress') return -1;
    if (b.status==='inprogress' && a.status!=='inprogress') return 1;
    if (a.status==='done' && b.status!=='done') return 1;
    if (b.status==='done' && a.status!=='done') return -1;
    return b.priority-a.priority || a.createdAt-b.createdAt;
  });
  return lowFilter(list);
}
export function renderCalendar() {
  const base = mondayOf(fromISO(todayISO())); const diffDays = Math.round((mondayOf(fromISO(data.selectedDate)) - base) / 864e5); data.calendarOffset = Math.floor(diffDays / 14); const start = addDays(base, data.calendarOffset*14);
  const grid = $('#calendarGrid'); if(!grid)return; grid.innerHTML='';
  const weekday=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  for(let i=0;i<14;i++) {
    const d=addDays(start,i), iso=toISO(d), has=data.tasks.some(t=>t.date===iso&&t.status!=='done'), b=document.createElement('button');
    b.type='button'; b.className='day-cell'+(iso===data.selectedDate?' selected':'')+(iso===todayISO()?' today':'');
    b.setAttribute('aria-label',d.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}));
    b.innerHTML=`<span class="day-name">${weekday[(d.getDay()+6)%7]}</span><span class="day-number">${d.getDate()}</span><i class="day-dot ${has?'has-tasks':''}"></i>`;
    b.addEventListener('click',()=>{data.selectedDate=iso;data.view='today';persist();renderAll();}); grid.appendChild(b);
  }
  $('#todayDateLabel').textContent=prettyDate(data.selectedDate,{day:'numeric',month:'long',year:'numeric'});
  $('#dateEyebrow').textContent=`ТВОЙ ДЕНЬ · ${fromISO(data.selectedDate).toLocaleDateString('ru-RU',{weekday:'long'}).toLocaleUpperCase('ru')}`;
}
export function renderLists() {
  const nav=$('#listNav'); if(!nav)return; nav.innerHTML='';
  data.lists.forEach(l=>{
    const btn=document.createElement('button');btn.type='button';btn.className='nav-item'+(data.view===`list:${l.id}`?' active':'');btn.dataset.view=`list:${l.id}`;btn.innerHTML=`<span class="list-swatch" style="background:${esc(l.color)}"></span><span class="nav-text">${esc(l.name)}</span><span class="nav-count">${data.tasks.filter(t=>t.listId===l.id&&t.status!=='done').length}</span>`;
    btn.addEventListener('click',()=>switchView(`list:${l.id}`));nav.appendChild(btn);
  });
  $('#inboxCount').textContent=data.tasks.filter(t=>t.listId==='inbox'&&t.status!=='done').length;
}
export function renderTask(task) {
  const list=listById(task.listId), elapsed=taskElapsed(task), isDone=task.status==='done';
  const statusText=task.status==='inprogress'?'В процессе':isDone?'Готово':'К выполнению';
  const steps=task.steps||[]; const stepDone=steps.filter(s=>s.done).length;
  return `<article class="task-card ${isDone?'is-done':''} ${task.status==='inprogress'?'is-running':''}" data-task-id="${esc(task.id)}"><div class="task-main"><button type="button" class="check-task" data-action="complete" data-id="${esc(task.id)}" aria-label="${isDone?'Вернуть задачу':'Завершить задачу'}" aria-pressed="${isDone}">${ic('check')}</button><div class="task-content"><div class="task-title">${esc(task.title)}</div>${task.description?`<div class="task-description">${esc(task.description)}</div>`:''}<div class="task-meta"><span class="meta-chip priority-chip p${task.priority}">${task.priority===3?ic('bolt')+' Важно':task.priority===2?'Обычно':'Без спешки'}</span><span class="meta-chip">${ic('clock')} ${task.duration} мин</span>${elapsed>0?`<span class="meta-chip">${ic('target')} ${fmtDuration(elapsed)}</span>`:''}<span class="meta-chip task-list-chip"><i class="list-swatch" style="background:${esc(list.color)}"></i>${esc(list.name)}</span>${task.date!==todayISO()?`<span class="meta-chip">${ic('calendar')} ${esc(prettyDate(task.date))}</span>`:''}${task.recurrence==='daily'?`<span class="meta-chip routine-chip">${ic('repeat')} Ежедневно</span>`:''}${steps.length?`<span class="meta-chip">${ic('steps')} ${stepDone}/${steps.length}</span>`:''}${task.status==='inprogress'?'<span class="meta-chip live-chip">Идёт</span>':''}</div></div></div><div class="task-actions">${!isDone?`<button type="button" class="task-action ${task.status==='inprogress'?'start':''}" data-action="start" data-id="${esc(task.id)}">${task.status==='inprogress'?ic('pause')+' Пауза':ic('play')+' Начать'}</button><button type="button" class="task-action finish" data-action="focus" data-id="${esc(task.id)}">${ic('target')} Фокус</button>`:''}<button type="button" class="task-action" data-action="steps" data-id="${esc(task.id)}">${ic('steps')} Шаги${steps.length?` (${stepDone}/${steps.length})`:''}</button><button type="button" class="task-action" data-action="edit" data-id="${esc(task.id)}" aria-label="Редактировать" title="Редактировать">${ic('edit')}</button><button type="button" class="task-action delete" data-action="delete" data-id="${esc(task.id)}" aria-label="Удалить" title="Удалить">${ic('trash')}</button></div>${steps.length?`<div class="task-expand"><div class="step-progress">Микро-шаги · ${stepDone} из ${steps.length}</div><div class="task-steps">${steps.map((s,i)=>`<label class="task-step ${s.done?'done':''}"><input type="checkbox" data-action="step" data-id="${esc(task.id)}" data-step="${i}" ${s.done?'checked':''}><span>${esc(s.text)}</span></label>`).join('')}</div></div>`:''}</article>`;
}
export function renderTasks() {
  const list=getViewTasks(), root=$('#taskList'); if(!root)return;
  $('#taskCountBadge').textContent=list.length; $('#filterAllCount').textContent=data.tasks.filter(t=>t.date===data.selectedDate&&t.status!=='done').length;
  $('#filterPills').hidden=['done','inbox','upcoming'].includes(data.view)||String(data.view).startsWith('list:');
  $$('#filterPills .filter-pill').forEach(b=>b.classList.toggle('active',b.dataset.filter===data.filter));
  if(!list.length) {
    const q=$('#searchInput').value.trim(); let title='Пока здесь тихо', text='Добавь одну небольшую задачу — и у дня появится направление.', icon='✳';
    if(q){title='Ничего не нашлось';text='Попробуй другое слово или очисти поиск.';icon='⌕';}
    else if(data.view==='done'){title='Всё впереди';text='Завершённые задачи появятся здесь. Не забудь замечать свои победы.';icon='✓';}
    else if(data.view==='upcoming'){title='План пока свободен';text='Добавь задачу на будущий день или запланируй то, что давно откладывал.';icon='▦';}
    root.innerHTML=`<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${text}</p>${!q&&data.view!=='done'?'<button type="button" data-action="new">＋ Добавить первую задачу</button>':''}</div>`;
  } else root.innerHTML=list.map(renderTask).join('');
  $('#inlineAddBtn').hidden=data.view==='done';
  const doneToday=data.tasks.filter(t=>t.status==='done'&&t.completedAt&&toISO(new Date(t.completedAt))===todayISO()).length;
  const todayTasks=data.tasks.filter(t=>t.date===data.selectedDate);const completed=todayTasks.filter(t=>t.status==='done').length;const pct=todayTasks.length?Math.round(completed/todayTasks.length*100):0;
  $('#progressPercent').innerHTML=`${pct}<span>%</span>`;$('#progressDone').textContent=`${completed}/${todayTasks.length}`;$('#progressCaption').textContent=todayTasks.length?(pct===100?'Ты сделал всё, что запланировал':`${todayTasks.length-completed} задач осталось на этот день`):'Начни с одной маленькой задачи';$('#progressBar').style.width=pct+'%';$('#progressRing').style.setProperty('--p',pct/100);updateDopamine(pct);
  const focusedMs=data.tasks.reduce((sum,t)=>sum+taskElapsed(t),0);$('#focusTotal').textContent=fmtDuration(focusedMs);$('#focusSessions').textContent=data.focusSessions?`${data.focusSessions} ${plural(data.focusSessions,['сессия','сессии','сессий'])} фокуса завершено`:'Начни первую сессию';
  renderActivityChart();
  $('#streakTitle').textContent=doneToday?`Сегодня уже ${doneToday} ${plural(doneToday,['победа','победы','побед'])}`:'Каждый шаг считается';$('#streakText').textContent=doneToday?'Не обесценивай то, что сделал':'Начни с одной маленькой задачи';
}
export function renderActivityChart(){
  const root = $('#activityChart');
  if (!root) return;

  // Resolve the current local date on every render; do not reuse a date captured at startup.
  const today = fromISO(todayISO());
  const tasks = Array.isArray(data && data.tasks) ? data.tasks : [];
  const days = [];
  // Exactly seven calendar days, oldest to newest, with today always last.
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const iso = toISO(date);
    // Variant B: count completed tasks on their planned date, not the timestamp
    // when the user marked them done. This keeps early/late completions attached
    // to the date the task was scheduled for.
    const count = tasks.filter(task => {
      if (!task || task.status !== 'done') return false;
      // Freeze the planned date at completion time so later rescheduling
      // doesn't rewrite historical activity. Older backups fall back to task.date.
      return (task.completedForDate || task.date) === iso;
    }).length;
    days.push({ iso, label: date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', ''), day: date.getDate(), count });
  }

  const max = Math.max(1, ...days.map(day => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  root.innerHTML = days.map(day => `<div class="activity-day" title="${esc(day.iso)}: ${day.count} задач"><div class="activity-bar-track"><div class="activity-bar" style="height:${Math.max(4, day.count / max * 100)}%" aria-label="${day.count} выполнено"></div></div><strong>${day.count}</strong><span>${esc(day.label)} <i>${day.day}</i></span></div>`).join('');
  root.setAttribute('aria-label', `Активность за 7 дней, включая сегодня (${todayISO()})`);
  const totalEl = $('#activityTotal');
  if (totalEl) totalEl.textContent = `${total} ${plural(total, ['задача', 'задачи', 'задач'])}`;
}
export function rollDailyRoutines(){
  if(!Array.isArray(data.tasks))data.tasks=[]; const today=todayISO();
  const routines=new Map();
  data.tasks.filter(t=>t.recurrence==='daily').forEach(t=>{const key=t.routineId||t.id; if(!routines.has(key)||String(t.date)>String(routines.get(key).date))routines.set(key,t);});
  let changed=false;
  routines.forEach((latest,routineId)=>{
    const todays=data.tasks.some(t=>t.recurrence==='daily'&&(t.routineId||t.id)===routineId&&t.date===today);
    if(!todays && latest.date<today){data.tasks.push(normalizeTask({...latest,id:uid(),routineId,recurrence:'daily',date:today,status:'todo',xp:0,completedAt:null,elapsedMs:0,timerStartedAt:null,createdAt:Date.now(),steps:(latest.steps||[]).map(s=>({text:s.text,done:false}))}));changed=true;}
  });
  if(changed)persist();
}
export function renderFocus() {
  if(!$('#timerDisplay'))return;
  const focused=data.tasks.find(t=>t.id===data.focusTaskId);const t=(focused&&focused.status!=='done'?focused:null)||data.tasks.find(t=>t.status==='inprogress')||null;if(focused&&focused.status==='done')data.focusTaskId=null;
  if(t&&t.id!==data.focusTaskId){data.focusTaskId=t.id;}
  $('#focusTaskTitle').textContent=t?t.title:'Выбери задачу и дай себе 10 минут.';
  $('#focusHeading').textContent=data.focusRunning?'Ты в потоке':t?'Готов начать?':'Время начать';
  $('#timerDisplay').textContent=fmtDuration(data.focusRemainingMs);
  $('#timerModeLabel').textContent=data.focusRunning?'ФОКУС ИДЁТ':`СПРИНТ ${data.focusMinutes} МИН`;
  $('#focusStartBtn').textContent=data.focusRunning?'Пауза':'Начать фокус';document.body.classList.toggle('focus-running',!!data.focusRunning);const ends=$('#timerEndsAt');if(ends)ends.textContent=data.focusRunning&&focusDeadline?`закончим в ${new Date(focusDeadline).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:'';const nx=$('#focusNextStep');if(nx){const st=t?.steps?.find(s=>!s.done);nx.hidden=!st;nx.textContent=st?st.text:'';}
  $$('#timerPresets button').forEach(b=>b.classList.toggle('selected',Number(b.dataset.minutes)===data.focusMinutes));
  const total=data.focusMinutes*60000, pct=Math.max(0,Math.min(1,1-data.focusRemainingMs/total));$('#timerProgress').style.setProperty('--p',pct);
}
export function renderHeader() {
  if(!$('#viewBreadcrumb')||!$('#taskSectionTitle'))return;
  const labels={today:'Сегодня',inbox:'Входящие',upcoming:'План',done:'Сделано'};
  const isList=String(data.view).startsWith('list:'); const title=isList?listById(data.view.slice(5)).name:labels[data.view]||'Сегодня';
  $('#viewBreadcrumb').textContent=title;$('#taskSectionTitle').textContent=(data.view==='today'?(data.selectedDate===todayISO()?'На сегодня':`На ${prettyDate(data.selectedDate,{day:'numeric',month:'short'})}`):data.view==='inbox'?'Входящие':data.view==='upcoming'?'В плане':data.view==='done'?'Завершённые':title);$('#taskSectionEyebrow').textContent=data.view==='done'?'ТВОИ ПОБЕДЫ':data.view==='inbox'?'БЫСТРАЯ ЗАПИСЬ':data.view==='upcoming'?'СЛЕДУЮЩИЕ ДНИ':'ТВОЙ СПИСОК';$('#pageTitle').textContent=data.view==='today'?(data.selectedDate===todayISO()?'Сегодня — твой темп.':`${prettyDate(data.selectedDate,{day:'numeric',month:'long'})} — твой план.`):data.view==='inbox'?'Всё, что пришло в голову.':data.view==='upcoming'?'Будущее начинается с малого.':data.view==='done'?'Посмотри, сколько уже сделано.':title;
  $('#pageSubtitle').textContent=data.view==='today'?'Не нужно делать всё. Достаточно начать с чего-то одного.':data.view==='inbox'?'Не сортируй прямо сейчас — просто выгрузи мысли из головы.':data.view==='upcoming'?'План — ориентир, а не обязательство перед идеальным собой.':data.view==='done'?'Здесь не отчёт о продуктивности, а доказательство твоих усилий.':'Собери задачи в одном спокойном месте.';
  $$('.main-nav .nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===data.view));
}
/** Плагины модулей (features/*) регистрируют здесь свой рендер: [имя, функция]. */
export const renderHooks = [];
export function renderAll(){
  document.body.classList.toggle('light-theme',data.theme==='light'||(data.theme==='auto'&&!!window.matchMedia?.('(prefers-color-scheme: light)').matches));
  // Независимые блоки: ошибка одного виджета не должна скрывать календарь или задачи.
  [['achievements',renderAchievements],['header',renderHeader],['lists',renderLists],['calendar',renderCalendar],['tasks',renderTasks],['focus',renderFocus],['heatmap',renderHeatmap],['level',renderProgress],['life',renderLife],...renderHooks].forEach(([name,fn])=>{try{fn();}catch(err){console.error(`Focusday: ошибка отрисовки блока «${name}»`,err);}});
  const energy=$('#energyLabel');if(energy)energy.textContent=ENERGY[data.energy]||ENERGY[3];
  $$('#energyPicks button').forEach(b=>b.classList.toggle('active',Number(b.dataset.energy)<=data.energy));
  const sort=$('#sortSelect');if(sort)sort.value=data.sort||'smart';
}
export function switchView(view){data.view=view;if(view==='today'&&!validDate(data.selectedDate))data.selectedDate=todayISO();data.filter=view==='done'?'done':'all';persist();renderAll();if(window.innerWidth<920)$('#sidebar').classList.remove('open');}
export function toast(message,type='success',action=null){const stack=$('#toastStack');if(!stack)return;while(stack.children.length>=4)stack.firstElementChild.remove();const box=document.createElement('div');box.className=`toast ${type}`;box.setAttribute('role',type==='error'?'alert':'status');const text=document.createElement('span');text.textContent=message;box.appendChild(text);const dismiss=()=>{if(!box.isConnected)return;box.classList.add('leaving');setTimeout(()=>box.remove(),220);};if(action){const b=document.createElement('button');b.type='button';b.className='toast-action';b.textContent=action.label;b.onclick=()=>{action.onClick();dismiss();};box.appendChild(b);}const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Закрыть уведомление');close.onclick=dismiss;box.appendChild(close);stack.appendChild(box);setTimeout(dismiss,action?6500:4200);}
export function openModal(task=null){if(!$('#taskForm'))return;set_stepDraft(task?(task.steps||[]).map(s=>({...s})):[]);$('#taskForm').reset();$('#editTaskId').value=task?task.id:'';$('#modalTitle').textContent=task?'Редактировать задачу':'Добавить задачу';$('#taskTitleInput').value=task?.title||'';$('#taskDescriptionInput').value=task?.description||'';$('#taskDateInput').value=task?.date||data.selectedDate||todayISO();$('#taskDurationInput').value=String(task?.duration||25);$('#taskPriorityInput').value=String(task?.priority||2);const recurrence=$('#taskRecurrenceInput');if(recurrence)recurrence.value=task?.recurrence==='daily'?'daily':'none';$('#taskListInput').innerHTML=data.lists.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');$('#taskListInput').value=task?.listId|| (String(data.view).startsWith('list:')?data.view.slice(5):'inbox');renderStepDraft();showModal('taskModal');setTimeout(()=>$('#taskTitleInput').focus(),80);}
export let lastFocus=null;
export function showModal(id){const el=$('#'+id);if(!el)return;if(!$$('.modal-backdrop:not([hidden])').length)lastFocus=document.activeElement;el.hidden=false;document.body.classList.add('modal-open');setTimeout(()=>{if(!el.contains(document.activeElement))el.querySelector('input:not([type=hidden]),select,textarea,button:not([data-close-modal])')?.focus();},60);}
export function closeModals(){ const wasOpen=$$('.modal-backdrop:not([hidden])').length; $$('.modal-backdrop').forEach(el=>el.hidden=true);document.body.classList.remove('modal-open'); if(wasOpen&&lastFocus?.isConnected)lastFocus.focus(); lastFocus=null; }
export function renderStepDraft(){const root=$('#stepEditor');root.innerHTML=stepDraft.map((s,i)=>`<div class="step-editor-item"><span>${i+1}. ${esc(s.text)}</span><button type="button" data-remove-step="${i}" aria-label="Удалить шаг">×</button></div>`).join('');}
export function addDraftStep(){const input=$('#newStepInput'),text=input.value.trim();if(!text)return;if(stepDraft.length>=30){toast('Максимум 30 микро-шагов','error');return;}stepDraft.push({text,done:false});input.value='';renderStepDraft();input.focus();}
export function saveTask(e){e.preventDefault();const title=$('#taskTitleInput').value.trim();if(!title){$('#taskTitleInput').focus();toast('Напиши название задачи','error');return;}const date=$('#taskDateInput').value||data.selectedDate||todayISO();if(!validDate(date)){toast('Выбери корректную дату','error');return;}const id=$('#editTaskId').value;const existing=data.tasks.find(t=>t.id===id);const task=normalizeTask({...(existing||{}),id:id||uid(),title,description:$('#taskDescriptionInput').value.trim(),date,duration:Number($('#taskDurationInput').value)||25,priority:Number($('#taskPriorityInput').value)||2,listId:$('#taskListInput').value||'inbox',energy:data.energy,status:existing?.status||'todo',createdAt:existing?.createdAt||Date.now(),completedAt:existing?.completedAt||null,elapsedMs:existing?.elapsedMs||0,timerStartedAt:existing?.timerStartedAt||null,steps:stepDraft,recurrence:$('#taskRecurrenceInput')?.value==='daily'?'daily':'none',routineId:($('#taskRecurrenceInput')?.value==='daily'?(existing?.routineId||existing?.id||id||uid()):'')});if(existing){Object.assign(existing,task);}else{data.tasks.push(task);}data.selectedDate=date;if(data.view==='done'&&!existing)data.view='today';if(String(data.view).startsWith('list:')&&task.listId!==data.view.slice(5))data.view='today';persist();closeModals();renderAll();toast(existing?'Задача обновлена':'Задача добавлена — уже хороший шаг');playSound(existing?'click':'success');checkAchievements();}
