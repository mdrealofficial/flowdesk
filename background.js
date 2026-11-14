/**
 * FlowDesk service worker.
 * Keeps the toolbar badge in sync with the number of open tasks.
 */
const STORAGE_KEY = 'flowdesk:state:v1';
const BADGE_COLOR = '#7c8cff';

async function refreshBadge() {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const state = res[STORAGE_KEY];
    const tasks = Array.isArray(state && state.tasks) ? state.tasks : [];
    const open = tasks.filter((task) => task.status !== 'done').length;

    await chrome.action.setBadgeText({ text: open > 0 ? String(open) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: '#ffffff' });
    }
  } catch (err) {
    console.warn('[FlowDesk] badge update failed', err);
  }
}

chrome.runtime.onInstalled.addListener(refreshBadge);
chrome.runtime.onStartup.addListener(refreshBadge);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) refreshBadge();
});
