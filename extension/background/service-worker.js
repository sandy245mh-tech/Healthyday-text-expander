/**
 * Background Service Worker — Cloud Text Expander (MV3)
 *
 * Responsibilities:
 * - Ensure default canned responses exist on install / startup
 * - Synchronize organization and personal cans with the backend
 * - Periodic background sync via chrome.alarms
 * - Handle onMessage bus for immediate sync requests
 */

const DEFAULT_API_BASE = 'http://localhost:3001';
const DUMMY_CAN_IDS = new Set(['can-welcome', 'can-hi', 'can-alex', 'sample-1', 'sample-2', 'sample-3']);

function filterDummyCans(cans) {
  if (!Array.isArray(cans)) return [];
  return cans.filter(c => c && !DUMMY_CAN_IDS.has(c.id));
}

// Initialize storage on install or startup
async function ensureInitialData() {
  chrome.storage.local.get(['personalCans', 'orgCans', 'apiBaseUrl'], async (res) => {
    let updateNeeded = false;
    const updates = {};

    if (!res.personalCans || !Array.isArray(res.personalCans)) {
      updates.personalCans = [];
      updateNeeded = true;
    } else {
      const cleaned = filterDummyCans(res.personalCans);
      if (cleaned.length !== res.personalCans.length) {
        updates.personalCans = cleaned;
        updateNeeded = true;
      }
    }

    if (!res.orgCans || !Array.isArray(res.orgCans)) {
      updates.orgCans = [];
      updateNeeded = true;
    } else {
      const cleaned = filterDummyCans(res.orgCans);
      if (cleaned.length !== res.orgCans.length) {
        updates.orgCans = cleaned;
        updateNeeded = true;
      }
    }

    if (!res.apiBaseUrl) {
      updates.apiBaseUrl = DEFAULT_API_BASE;
      updateNeeded = true;
    }

    if (updateNeeded) {
      chrome.storage.local.set(updates, () => {
        console.log('[Background] Storage initialized (no dummy data)');
        syncFromBackend();
      });
    } else {
      syncFromBackend();
    }
  });
}

// Background sync from backend API
async function syncFromBackend() {
  chrome.storage.local.get(['user', 'apiBaseUrl', 'personalCans', 'orgCans'], async (stored) => {
    const baseUrl = (stored.apiBaseUrl || DEFAULT_API_BASE).replace(/\/+$/, '');
    const user = stored.user;

    // 1. Fetch Organization Cans (publicly accessible / accessible to all users)
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user) {
        headers['x-user-name'] = user.name;
        headers['x-user-role'] = user.role;
      }
      const orgRes = await fetch(`${baseUrl}/organization/cans`, { headers });
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        if (orgData?.data?.cans && Array.isArray(orgData.data.cans)) {
          const cleaned = filterDummyCans(orgData.data.cans);
          chrome.storage.local.set({ orgCans: cleaned });
          console.log('[Background] Synced org cans count:', cleaned.length);
        }
      }
    } catch (err) {
      console.log('[Background] Org cans sync failed (server offline or unreachable)');
    }

    // 2. Fetch Personal Cans if user is logged in
    if (user && user.name) {
      try {
        const pRes = await fetch(`${baseUrl}/cans`, {
          headers: {
            'Content-Type': 'application/json',
            'x-user-name': user.name,
            'x-user-role': user.role || 'AGENT'
          }
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData?.data?.cans && Array.isArray(pData.data.cans)) {
            const cleaned = filterDummyCans(pData.data.cans);
            chrome.storage.local.set({ personalCans: cleaned });
            console.log('[Background] Synced personal cans count:', cleaned.length);
          }
        }
      } catch (err) {
        console.log('[Background] Personal cans sync failed');
      }
    }
  });
}

// Extension installed or updated
chrome.runtime.onInstalled.addListener(({ reason }) => {
  console.log('[Background] Extension installed/updated. Reason:', reason);
  ensureInitialData();

  // Setup periodic sync alarm (every 2 minutes)
  chrome.alarms.create('sync_cans_alarm', { periodInMinutes: 2 });
});

// Extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Browser startup, checking cans sync');
  ensureInitialData();
});

// Periodic alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync_cans_alarm') {
    syncFromBackend();
  }
});

// Message bus — responds to messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SYNC_NOW') {
    syncFromBackend().then(() => sendResponse({ success: true }));
    return true; // Keep channel open
  }

  if (message.action === 'GET_ALL_CANS') {
    chrome.storage.local.get(['personalCans', 'orgCans'], (res) => {
      sendResponse({
        personalCans: filterDummyCans(res.personalCans || []),
        orgCans: filterDummyCans(res.orgCans || [])
      });
    });
    return true;
  }

  return true;
});
