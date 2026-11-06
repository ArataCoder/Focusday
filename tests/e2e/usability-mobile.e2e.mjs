// Browser emulation only; not a substitute for Android WebView or Windows EXE testing.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const app=pathToFileURL(resolve('src/focusday.html')).href;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try {
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});
  const page=await ctx.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{ window.__FD_TEST_IDLE__=0; window.__TAURI__={core:{invoke:async()=>{throw Error('desktop command invoked on mobile')}},event:{listen:async()=>()=>{},emit:async()=>{}}}; });
  await page.goto(app); await page.waitForFunction(()=>window.__FD_TEST__);
  assert.equal(await page.locator('#welcomeModal').isVisible(),true);
  assert.equal(await page.evaluate(()=>Boolean(window.focusdayDesktop)),false);
  assert.equal(await page.evaluate(()=>window.__FD_TEST__.data.ambient.withFocus),false);
  await page.locator('#welcomeModal [data-close-modal]').last().click();
  assert.equal(await page.locator('#jumpFocus').isVisible(),true);
  await page.fill('#quickCaptureInput','Тестовая задача'); await page.click('.qc-submit');
  await page.waitForFunction(()=>window.__FD_TEST__.data.tasks.some(t=>t.title==='Тестовая задача'));
  await page.click('#jumpFocus'); await page.click('#focusStartBtn');
  assert.equal(await page.evaluate(()=>window.__FD_TEST__.data.focusRunning),true);
  await page.click('#focusStartBtn'); await page.reload(); await page.waitForFunction(()=>window.__FD_TEST__);
  assert.equal(await page.locator('#welcomeModal').isHidden(),true);
  assert.equal(await page.evaluate(()=>window.__FD_TEST__.data.tasks.some(t=>t.title==='Тестовая задача')),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.click('#mobileMenu'); await page.click('#helpBtn'); assert.equal(await page.locator('#welcomeModal').isVisible(),true);
  assert.deepEqual(errors,[]); await ctx.close();
  console.log('✔ Мобильный интерфейс: знакомство, ввод, фокус, перезапуск, меню и имитация Tauri');
  const desktop=await browser.newContext({viewport:{width:1440,height:900}}), p=await desktop.newPage();
  await p.addInitScript(()=>{localStorage.setItem('focusday.data.v1',JSON.stringify({tasks:[],lists:[]}));window.__FD_TEST_IDLE__=0;});
  await p.goto(app);await p.waitForFunction(()=>window.__FD_TEST__);
  assert.equal(await p.locator('#welcomeModal').isHidden(),true,'приветствие не навязывается существующим пользователям');
  await p.keyboard.press('n'); assert.equal(await p.locator('#taskModal').isVisible(),true);
  await p.fill('#taskTitleInput','тест n'); await p.keyboard.press('n'); assert.equal(await p.locator('#taskTitleInput').inputValue(),'тест nn');
  await p.keyboard.press('Escape'); await p.locator('#shortcutsHelpBtn').click(); assert.equal(await p.locator('#shortcutsModal').isVisible(),true);
  await desktop.close(); console.log('✔ Существующие пользователи и горячие клавиши');
} finally {await browser.close();}
