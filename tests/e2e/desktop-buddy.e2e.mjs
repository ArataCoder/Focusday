// Тесты протокола окна котика с имитацией Tauri; это НЕ запуск реального Windows EXE.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('src'), mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{const p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname)); if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}try{const data=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try {
  // Регистрация слушателя намеренно медленная: ответ на ready приходит сразу.
  const child=await browser.newPage(); const errors=[]; child.on('pageerror', e=>errors.push(e.message));
  await child.addInitScript(()=>{
    const handlers={}; window.order=[];
    window.__TAURI__={event:{listen:(name,cb)=>new Promise(r=>setTimeout(()=>{handlers[name]=cb;order.push('registered');r(()=>{});},200)), emit:async(name,data)=>{order.push(name);if(name==='focusday://buddy-ready')handlers['focusday://buddy-state']?.({payload:{mode:'idle'}});}}};
  });
  await child.goto(base+'/buddy.html');
  await child.waitForFunction(()=>window.order.includes('focusday://buddy-visible'));
  assert.equal(await child.locator('#catBuddy').isVisible(),true);
  const order=await child.evaluate(()=>window.order);
  assert.ok(order.indexOf('registered')<order.indexOf('focusday://buddy-ready'));
  assert.deepEqual(errors,[]); await child.close();
  console.log('✔ Окно котика: задержанная подписка, ответ о готовности и отображении');

  // Отдельное окно не создаётся: в главном должен остаться запасной котик.
  const main=await browser.newPage();const mainErrors=[];main.on('pageerror',e=>mainErrors.push(e.message));
  await main.addInitScript(()=>{
    localStorage.setItem('focusday.welcome.v1','shown'); window.__FD_TEST_IDLE__=0; const handlers={};window.__handlers=handlers;window.__buddyCalls=0;
    window.__TAURI__={core:{invoke:async(name)=>{if(name==='buddy'){window.__buddyCalls++; throw new Error('mock window unavailable');}return null;}},event:{listen:async(name,cb)=>{handlers[name]=cb;return()=>{};},emit:async()=>{} }};
  });
  await main.goto(base+'/focusday.html');await main.waitForFunction(()=>window.__FD_TEST__);
  await main.click('#focusStartBtn');await main.evaluate(()=>window.__FD_TEST__.buddyTick());
  await main.waitForFunction(()=>window.__buddyCalls>0);
  await main.waitForFunction(()=>document.querySelector('#buddyWindowStatus').textContent.includes('ошибка'));
  assert.match(await main.locator('#buddyWindowStatus').textContent(), /mock window unavailable/);
  assert.equal(await main.locator('#catBuddy').isVisible(),true,'котик остаётся в главном окне');
  await main.evaluate(()=>window.__handlers['focusday://buddy-visible']({payload:{mode:'idle'}}));
  assert.equal(await main.locator('#catBuddy').isHidden(),true,'после подтверждения отдельного окна запасной скрывается');
  await main.click('#focusStartBtn');await main.evaluate(()=>window.__FD_TEST__.buddyTick());
  assert.equal(await main.locator('#catBuddy').isHidden(),true,'на паузе котик скрывается');
  assert.deepEqual(mainErrors,[]); await main.close();
  console.log('✔ Ошибка отдельного окна: запасной котик в главном окне');

  // Сообщение ready и подтверждение отрисовки могут прийти до завершения команды.
  const race=await browser.newPage(); const raceErrors=[]; race.on('pageerror',e=>raceErrors.push(e.message));
  await race.addInitScript(()=>{
    localStorage.setItem('focusday.welcome.v1','shown'); window.__FD_TEST_IDLE__=0; const handlers={}; window.__handlers=handlers;
    window.__TAURI__={core:{invoke:(name,args)=>{if(name==='buddy' && args.mode!=='hidden') return new Promise(r=>window.__resolveBuddy=r); return Promise.resolve(null);}},event:{listen:async(name,cb)=>{handlers[name]=cb;return()=>{};},emit:async()=>{}}};
  });
  await race.goto(base+'/focusday.html'); await race.waitForFunction(()=>window.__FD_TEST__);
  await race.click('#focusStartBtn'); await race.evaluate(()=>window.__FD_TEST__.buddyTick());
  await race.waitForFunction(()=>window.__resolveBuddy);
  assert.match(await race.locator('#buddyWindowStatus').textContent(), /создаётся/);
  await race.evaluate(()=>window.__handlers['focusday://buddy-ready']({}));
  assert.match(await race.locator('#buddyWindowStatus').textContent(), /подключено/);
  await race.evaluate(()=>window.__handlers['focusday://buddy-visible']({payload:{mode:'idle'}}));
  assert.match(await race.locator('#buddyWindowStatus').textContent(), /подтвердило отрисовку/);
  await race.evaluate(()=>window.__resolveBuddy());
  await race.waitForTimeout(100);
  assert.match(await race.locator('#buddyWindowStatus').textContent(), /подтвердило отрисовку/);
  assert.equal(await race.locator('#catBuddy').isHidden(),true);
  await race.click('#focusStartBtn'); await race.evaluate(()=>window.__FD_TEST__.buddyTick());
  assert.match(await race.locator('#buddyWindowStatus').textContent(), /запусти фокус/);
  assert.deepEqual(raceErrors,[]); await race.close();
  console.log('✔ Состояние диагностики при раннем подтверждении и паузе');

  // Зависшая нативная команда не должна скрывать запасного котика.
  const hung=await browser.newPage(); const hungErrors=[]; hung.on('pageerror',e=>hungErrors.push(e.message));
  await hung.addInitScript(()=>{
    localStorage.setItem('focusday.welcome.v1','shown'); window.__FD_TEST_IDLE__=0;
    window.__TAURI__={core:{invoke:(name,args)=>name==='buddy'&&args.mode!=='hidden'?new Promise(()=>{}):Promise.resolve(null)},event:{listen:async()=>()=>{},emit:async()=>{}}};
  });
  await hung.goto(base+'/focusday.html'); await hung.waitForFunction(()=>window.__FD_TEST__);
  await hung.click('#focusStartBtn'); await hung.evaluate(()=>window.__FD_TEST__.buddyTick());
  await hung.waitForFunction(()=>document.querySelector('#buddyWindowStatus').textContent.includes('Нет ответа'),null,{timeout:10000});
  assert.match(await hung.locator('#buddyWindowStatus').textContent(), /создаётся/);
  assert.equal(await hung.locator('#catBuddy').isVisible(),true);
  assert.deepEqual(hungErrors,[]); await hung.close();
  console.log('✔ Таймаут не скрывает котика и показывает этап сбоя');
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
