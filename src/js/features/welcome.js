/* First-run guide, kept separate from user data and available again from the menu. */
import { $, storage } from '../core.js';
import { closeModals, showModal } from '../render.js';
const GUIDE_KEY = 'focusday.welcome.v1';
export function bindWelcome(hasExistingData) {
  $('#jumpFocus')?.addEventListener('click', () => $('#focusCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('#helpBtn')?.addEventListener('click', () => {
    $('#sidebar')?.classList.remove('open');
    showModal('welcomeModal');
  });
  $('#shortcutsHelpBtn')?.addEventListener('click', () => { $('#sidebar')?.classList.remove('open'); showModal('shortcutsModal'); });
  $('#welcomeShortcuts')?.addEventListener('click', () => { closeModals(); showModal('shortcutsModal'); });
  if (!hasExistingData && !storage.getItem(GUIDE_KEY)) {
    storage.setItem(GUIDE_KEY, 'shown');
    showModal('welcomeModal');
  }
}
