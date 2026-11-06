/* Focusday · settings.js — вкладки настроек, тема «как в системе», спокойный режим. */
import { $, $$ } from '../core.js';
import { data, persist } from '../state.js';
import { renderAll, renderHooks, showModal } from '../render.js';

const TABS = ['look', 'buddy', 'quotes', 'sync', 'data'];
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

export function resolvedTheme(theme = data.theme) {
  if (theme === 'auto') return mq && mq.matches ? 'light' : 'dark';
  return theme === 'light' ? 'light' : 'dark';
}
export function applyTheme() {
  const light = resolvedTheme() === 'light';
  document.body.classList.toggle('light-theme', light);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', light ? '#f4f2fb' : '#0b0b14');
}
export function setTab(tab, focus = false) {
  if (!TABS.includes(tab)) tab = 'look';
  $$('.set-tab').forEach(b => { const on = b.dataset.setTab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); if (on) b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); });
  $$('.set-pane').forEach(p => { p.hidden = p.dataset.setPane !== tab; });
  const panes = $('.set-panes'); if (panes) panes.scrollTop = 0;
  try { sessionStorage.setItem('fd-set-tab', tab); } catch (_) {}
}
export function openSettings(tab) {
  const btn = $('#settingsBtn');
  if (btn) btn.click(); else showModal('settingsModal');
  if (tab) setTab(tab);
}
function renderSettings() {
  applyTheme();
  $$('#themeSeg [data-theme-set]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeSet === (data.theme || 'dark'))));
  document.body.classList.toggle('calm-motion', !!data.calmMotion);
  $('#calmMotion')?.setAttribute('aria-pressed', String(!!data.calmMotion));
}
export function bindSettings() {
  const nav = $('.set-tabs'); if (!nav) return;
  nav.addEventListener('click', e => { const b = e.target.closest('[data-set-tab]'); if (b) setTab(b.dataset.setTab); });
  nav.addEventListener('keydown', e => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const cur = TABS.indexOf($('.set-tab[aria-selected=true]')?.dataset.setTab);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (cur + keys[e.key] + TABS.length) % TABS.length;
    setTab(TABS[next], true);
  });
  $('#themeSeg')?.addEventListener('click', e => { const b = e.target.closest('[data-theme-set]'); if (!b) return; data.theme = b.dataset.themeSet; persist(); renderAll(); });
  $('#calmMotion')?.addEventListener('click', () => { data.calmMotion = !data.calmMotion; persist(); renderSettings(); });
  mq?.addEventListener?.('change', () => { if (data.theme === 'auto') applyTheme(); });
  let saved = null; try { saved = sessionStorage.getItem('fd-set-tab'); } catch (_) {}
  setTab(saved || 'look');
  renderHooks.push(['settings', renderSettings]);
  renderSettings();
}
