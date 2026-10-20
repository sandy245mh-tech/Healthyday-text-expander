/**
 * popup.js — Cloud Text Expander Popup
 * Matches new UI palette and interactions
 */

import { api } from '../api/apiClient.js';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  user: null,
  personalCans: [],
  orgCans: [],
  notifications: [],
  activeFilter: 'all', // 'all' | 'newest' | 'personal' | 'org'
  searchQuery: '',
  editingCanId: null,
  isEditingOrgCan: false,
  canToDelete: null,
  notifTab: 'new', // 'new' | 'all'
};

// ── DOM Helpers ──────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  const target = $(id);
  if (target) target.classList.remove('hidden');
}

function showModal() {
  $('can-modal-overlay').classList.remove('hidden');
}

function hideModal() {
  $('can-modal-overlay').classList.add('hidden');
  resetCanForm();
}

function showDeleteModal(can, isOrg) {
  if (isOrg && state.user?.role !== 'ADMIN') {
    alert('Permission denied: Only administrators can delete organization canned messages.');
    return;
  }
  state.canToDelete = { ...can, isOrg };
  $('popup-delete-item-title').textContent = `"${can.title}"`;
  $('delete-modal-overlay').classList.remove('hidden');
}

function hideDeleteModal() {
  $('delete-modal-overlay').classList.add('hidden');
  state.canToDelete = null;
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function startPopup() {
  initKeyboardBadge();
  showScreen('screen-loading');
  document.addEventListener('auth:unauthorized', handleLogout);

  await initApp();
  bindEvents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startPopup);
} else {
  startPopup();
}

function initKeyboardBadge() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const kbd = $('popup-search-kbd');
  if (kbd) kbd.textContent = isMac ? '⌘ K' : 'Ctrl K';
}

async function initApp() {
  await api.init();

  if (api.user) {
    state.user = api.user;
    try {
      await syncData();
      showScreen('screen-dashboard');
    } catch (err) {
      console.error('Failed to sync on init', err);
      showScreen('screen-dashboard');
    }
  } else {
    try {
      await syncData();
    } catch (err) {}
    showScreen('screen-login');
  }
}

const storage = {
  get: (keys) => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.get(keys, resolve);
      } else {
        try {
          const res = {};
          keys.forEach(k => {
            const v = localStorage.getItem(k);
            if (v) res[k] = JSON.parse(v);
          });
          resolve(res);
        } catch (e) { resolve({}); }
      }
    });
  },
  set: (obj) => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set(obj);
    } else {
      try {
        Object.entries(obj).forEach(([k, v]) => {
          localStorage.setItem(k, JSON.stringify(v));
        });
      } catch (e) {}
    }
  }
};

const DUMMY_CAN_IDS = new Set(['can-welcome', 'can-hi', 'can-alex', 'sample-1', 'sample-2', 'sample-3']);

function filterOutDummyCans(cans) {
  if (!Array.isArray(cans)) return [];
  return cans.filter(c => c && !DUMMY_CAN_IDS.has(c.id));
}

async function syncData() {
  try {
    const stored = await storage.get(['personalCans', 'orgCans']);
    if (stored.personalCans && Array.isArray(stored.personalCans)) {
      state.personalCans = filterOutDummyCans(stored.personalCans);
    }
    if (stored.orgCans && Array.isArray(stored.orgCans)) {
      state.orgCans = filterOutDummyCans(stored.orgCans);
    }

    const [personalRes, orgRes, notifRes] = await Promise.all([
      api.getPersonalCans().catch(() => null),
      api.getOrgCans().catch(() => null),
      api.getNotifications().catch(() => null)
    ]);

    if (personalRes?.data?.cans && Array.isArray(personalRes.data.cans)) {
      state.personalCans = filterOutDummyCans(personalRes.data.cans);
    }
    if (orgRes?.data?.cans && Array.isArray(orgRes.data.cans)) {
      state.orgCans = filterOutDummyCans(orgRes.data.cans);
    }
    if (notifRes?.data?.notifications && Array.isArray(notifRes.data.notifications)) {
      state.notifications = notifRes.data.notifications;
    }

    storage.set({
      personalCans: state.personalCans,
      orgCans: state.orgCans
    });

    renderDashboard();
    renderNotifications();
  } catch (err) {
    console.error('Sync failed', err);
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function handleLoginSubmit(e) {
  e.preventDefault();
  const name = $('setup-name').value.trim();
  const role = $('setup-role').value;

  if (!name) {
    showFormError('login-error', 'Please enter your name');
    return;
  }

  const user = { name, role };
  api.setUser(user);
  state.user = user;

  try {
    await syncData();
    showScreen('screen-dashboard');
  } catch (err) {
    showScreen('screen-dashboard');
  }
}

// ── Render Dashboard ─────────────────────────────────────────────────────────
function renderDashboard() {
  const query = state.searchQuery.toLowerCase().trim();

  let list = [];
  const pList = state.personalCans.map(c => ({ ...c, scope: 'personal' }));
  const oList = state.orgCans.map(c => ({ ...c, scope: 'org' }));

  if (state.activeFilter === 'personal') {
    list = pList;
  } else if (state.activeFilter === 'org') {
    list = oList;
  } else {
    list = [...pList, ...oList];
  }

  if (query) {
    list = list.filter(c =>
      (c.title && c.title.toLowerCase().includes(query)) ||
      (c.shortcut && c.shortcut.toLowerCase().includes(query)) ||
      (c.content && c.content.toLowerCase().includes(query))
    );
  }

  if (state.activeFilter === 'newest') {
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  const container = $('can-list');
  const empty = $('cans-empty');

  if (list.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    container.innerHTML = '';
    list.forEach(can => {
      container.appendChild(buildCanCard(can));
    });
  }

  // Update notification count badge
  const unread = state.notifications.filter(n => !n.read).length;
  const badge = $('notif-badge');
  if (badge) {
    badge.textContent = unread;
    badge.classList.toggle('hidden', unread === 0);
  }
}

function buildCanCard(can) {
  const card = document.createElement('div');
  card.className = 'popup-card';
  card.dataset.id = can.id;

  const sc = can.shortcut || '';
  const formattedShortcut = sc.startsWith('/') ? sc : `/${sc}`;
  const isOrg = can.scope === 'org';
  const isAdmin = state.user?.role === 'ADMIN';
  const canModify = !isOrg || isAdmin;

  const scopeBadgeHtml = isOrg
    ? `<span class="popup-scope-tag org">
        <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/>
        </svg>
        <span>Org</span>
      </span>`
    : `<span class="popup-scope-tag personal">
        <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
          <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
        </svg>
        <span>Personal</span>
      </span>`;

  card.innerHTML = `
    <div class="popup-card-header">
      <h4 class="popup-card-title">${escapeHtml(can.title)}</h4>
      <span class="popup-shortcut-chip">${escapeHtml(formattedShortcut)}</span>
    </div>
    <div class="popup-card-snippet">${escapeHtml(can.content)}</div>
    <div class="popup-card-footer">
      ${scopeBadgeHtml}
      <div class="popup-card-actions">
        ${canModify ? `
        <button class="popup-action-btn edit-btn" title="Edit message" aria-label="Edit message">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
          </svg>
        </button>
        <button class="popup-action-btn delete delete-btn" title="Delete message" aria-label="Delete message">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
            <path d="M4 6h12M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2M14 6v10a2 2 0 01-2 2H8a2 2 0 01-2-2V6"/>
          </svg>
        </button>
        ` : `
        <button class="popup-action-btn view-btn" title="View details" aria-label="View details">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
            <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
            <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>
          </svg>
        </button>
        `}
      </div>
    </div>
  `;

  // Click card to copy
  card.addEventListener('click', (e) => {
    if (e.target.closest('.popup-card-actions')) return;
    navigator.clipboard.writeText(can.content).then(() => {
      card.style.borderColor = 'var(--primary-blue)';
      setTimeout(() => { card.style.borderColor = ''; }, 400);
    });
  });

  const editBtn = card.querySelector('.edit-btn') || card.querySelector('.view-btn');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditCanModal(can, isOrg);
    });
  }

  const deleteBtn = card.querySelector('.delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteModal(can, isOrg);
    });
  }

  return card;
}

// ── Can Modal (Screenshot 2) ─────────────────────────────────────────────────
function openNewCanModal(isOrg = false) {
  state.editingCanId = null;
  state.isEditingOrgCan = isOrg;
  $('modal-title').textContent = 'Add Message';
  $('can-id').value = '';
  $('can-title').value = '';
  $('can-title').readOnly = false;
  $('can-shortcut').value = '/';
  $('can-shortcut').readOnly = false;
  $('can-content').value = '';
  $('can-content').readOnly = false;
  $('popup-scope-personal').checked = true;
  $('popup-scope-personal').disabled = false;
  $('popup-scope-org').disabled = false;
  $('btn-save-can')?.classList.remove('hidden');
  $('popup-org-readonly-notice')?.classList.add('hidden');
  $('btn-popup-copy-can')?.classList.add('hidden');
  const hint = $('popup-modal-hint-text');
  if (hint) hint.innerHTML = 'Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save';
  $('can-form-error').classList.add('hidden');

  const scopeGroup = $('popup-scope-group');
  if (scopeGroup) {
    scopeGroup.classList.toggle('hidden', state.user?.role !== 'ADMIN');
  }

  showModal();
  setTimeout(() => $('can-title').focus(), 50);
}

function openEditCanModal(can, isOrg = false) {
  state.editingCanId = can.id;
  state.isEditingOrgCan = isOrg;
  const isAdmin = state.user?.role === 'ADMIN';
  const isReadOnly = isOrg && !isAdmin;

  $('can-id').value = can.id;
  $('can-title').value = can.title || '';
  
  const sc = can.shortcut || '';
  $('can-shortcut').value = sc.startsWith('/') ? sc : `/${sc}`;
  $('can-content').value = can.content || '';

  if (isOrg) {
    $('popup-scope-org').checked = true;
  } else {
    $('popup-scope-personal').checked = true;
  }

  $('can-title').readOnly = isReadOnly;
  $('can-shortcut').readOnly = isReadOnly;
  $('can-content').readOnly = isReadOnly;
  $('popup-scope-org').disabled = isReadOnly;
  $('popup-scope-personal').disabled = isReadOnly;

  if (isReadOnly) {
    $('modal-title').textContent = 'View Organization Message';
    $('btn-save-can')?.classList.add('hidden');
    $('popup-org-readonly-notice')?.classList.remove('hidden');
    $('btn-popup-copy-can')?.classList.remove('hidden');
    const hint = $('popup-modal-hint-text');
    if (hint) hint.textContent = 'This organization message is shared by admins';
  } else {
    $('modal-title').textContent = 'Edit Message';
    $('btn-save-can')?.classList.remove('hidden');
    $('popup-org-readonly-notice')?.classList.add('hidden');
    $('btn-popup-copy-can')?.classList.add('hidden');
    const hint = $('popup-modal-hint-text');
    if (hint) hint.innerHTML = 'Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save';
  }

  const scopeGroup = $('popup-scope-group');
  if (scopeGroup) {
    scopeGroup.classList.toggle('hidden', state.user?.role !== 'ADMIN');
  }

  $('can-form-error').classList.add('hidden');
  showModal();
  setTimeout(() => {
    if (isReadOnly) {
      $('can-content').focus();
    } else {
      $('can-title').focus();
    }
  }, 50);
}

function resetCanForm() {
  $('can-form').reset();
  $('can-id').value = '';
  $('can-form-error').textContent = '';
  $('can-form-error').classList.add('hidden');
}

async function handleCanFormSubmit(e) {
  if (e) e.preventDefault();

  const title = $('can-title').value.trim();
  let shortcut = $('can-shortcut').value.trim().toLowerCase();
  const content = $('can-content').value.trim();
  const isOrg = $('popup-scope-org')?.checked ?? false;

  if (!title) {
    showFormError('can-form-error', 'Please enter a message title');
    $('can-title').focus();
    return;
  }

  if (!shortcut || shortcut === '/') {
    showFormError('can-form-error', 'Please enter a shortcut (e.g. /interview)');
    $('can-shortcut').focus();
    return;
  }

  if (!shortcut.startsWith('/')) {
    shortcut = `/${shortcut}`;
  }
  shortcut = shortcut.replace(/\s+/g, '');

  if (!content) {
    showFormError('can-form-error', 'Please enter the message content');
    $('can-content').focus();
    return;
  }

  const saveBtn = $('btn-save-can');
  saveBtn.disabled = true;

  try {
    const canId = state.editingCanId || `can-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
      id: canId,
      title,
      shortcut,
      content,
      scope: isOrg ? 'org' : 'personal',
      updatedAt: new Date().toISOString()
    };

    if (state.editingCanId) {
      if (state.isEditingOrgCan || isOrg) {
        api.updateOrgCan(state.editingCanId, payload).catch(e => console.warn('Backend updateOrgCan notice:', e));
        const idx = state.orgCans.findIndex(c => c.id === state.editingCanId);
        if (idx !== -1) state.orgCans[idx] = { ...state.orgCans[idx], ...payload };
      } else {
        api.updatePersonalCan(state.editingCanId, payload).catch(e => console.warn('Backend updatePersonalCan notice:', e));
        const idx = state.personalCans.findIndex(c => c.id === state.editingCanId);
        if (idx !== -1) state.personalCans[idx] = { ...state.personalCans[idx], ...payload };
      }
    } else {
      payload.createdAt = new Date().toISOString();
      if (isOrg && state.user?.role === 'ADMIN') {
        try {
          const res = await api.createOrgCan(payload);
          if (res?.data?.can?.id) payload.id = res.data.can.id;
        } catch (e) {
          console.warn('Backend createOrgCan notice:', e);
        }
        state.orgCans.unshift(payload);
      } else {
        api.createPersonalCan(payload).then(res => {
          if (res?.data?.can?.id) {
            payload.id = res.data.can.id;
            storage.set({ personalCans: state.personalCans, orgCans: state.orgCans });
          }
        }).catch(e => console.warn('Saved personal can locally'));
        state.personalCans.unshift(payload);
      }
    }

    // Always immediately persist to local storage so expansion works instantly!
    storage.set({
      personalCans: state.personalCans,
      orgCans: state.orgCans
    });

    renderDashboard();
    hideModal();
  } catch (err) {
    showFormError('can-form-error', err.message || 'Failed to save');
  } finally {
    saveBtn.disabled = false;
  }
}

// ── Delete Action (Screenshot 3) ─────────────────────────────────────────────
async function handleConfirmDelete() {
  if (!state.canToDelete) return;
  const { id, isOrg } = state.canToDelete;

  if (isOrg && state.user?.role !== 'ADMIN') {
    hideDeleteModal();
    alert('Permission denied: Only administrators can delete organization canned messages.');
    return;
  }

  const btn = $('btn-popup-confirm-delete');
  btn.disabled = true;

  try {
    if (isOrg) {
      await api.deleteOrgCan(id);
      state.orgCans = state.orgCans.filter(c => c.id !== id);
    } else {
      await api.deletePersonalCan(id);
      state.personalCans = state.personalCans.filter(c => c.id !== id);
    }
    storage.set({
      personalCans: state.personalCans,
      orgCans: state.orgCans
    });
    hideDeleteModal();
    renderDashboard();
  } catch (err) {
    alert(err.message || 'Failed to delete');
  } finally {
    btn.disabled = false;
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  if (!state.user) return;
  const initial = (state.user.name || 'U').charAt(0).toUpperCase();
  $('user-avatar').textContent = initial;
  $('user-name').textContent = state.user.name;
  $('user-role-badge').textContent = state.user.role;
  const serverInput = $('setting-server-url');
  if (serverInput) serverInput.value = api.getBaseUrl();
}

function handleLogout() {
  api.clearUser();
  state.user = null;
  state.personalCans = [];
  state.orgCans = [];
  showScreen('screen-login');
}

// ── Notifications ─────────────────────────────────────────────────────────────
function renderNotifications() {
  const list = $('notification-list');
  if (!list) return;
  list.innerHTML = '';

  const unreadCount = state.notifications.filter(n => !n.read).length;

  const tabNewCount = $('popup-tab-new-count');
  const tabAllCount = $('popup-tab-all-count');
  if (tabNewCount) tabNewCount.textContent = unreadCount;
  if (tabAllCount) tabAllCount.textContent = state.notifications.length;

  const btnTabNew = $('popup-tab-notif-new');
  const btnTabAll = $('popup-tab-notif-all');
  if (btnTabNew) {
    btnTabNew.style.background = state.notifTab === 'new' ? '#ffffff' : 'transparent';
    btnTabNew.style.fontWeight = state.notifTab === 'new' ? '700' : '600';
    btnTabNew.style.color = state.notifTab === 'new' ? 'var(--brand-navy)' : 'var(--text-secondary)';
  }
  if (btnTabAll) {
    btnTabAll.style.background = state.notifTab === 'all' ? '#ffffff' : 'transparent';
    btnTabAll.style.fontWeight = state.notifTab === 'all' ? '700' : '600';
    btnTabAll.style.color = state.notifTab === 'all' ? 'var(--brand-navy)' : 'var(--text-secondary)';
  }

  const displayedNotifs = state.notifTab === 'new'
    ? state.notifications.filter(n => !n.read)
    : state.notifications;

  if (displayedNotifs.length === 0) {
    const empty = $('notifications-empty');
    if (empty) {
      empty.classList.remove('hidden');
      const emptyTitle = $('popup-notif-empty-title');
      const emptyDesc = $('popup-notif-empty-desc');
      if (emptyTitle) emptyTitle.textContent = state.notifTab === 'new' ? 'No new updates' : 'No notifications';
      if (emptyDesc) emptyDesc.textContent = state.notifTab === 'new' ? 'You are completely up to date!' : 'No updates recorded yet';
    }
    return;
  }

  $('notifications-empty')?.classList.add('hidden');

  displayedNotifs.forEach(notif => {
    const item = document.createElement('div');
    item.className = `notification-item${notif.read ? '' : ' unread'}`;
    const targetCanId = notif.canId || notif.can_id;

    item.title = targetCanId ? 'Click to view this canned message' : 'Click to view update';
    item.innerHTML = `
      <div class="notification-item__msg">🔔 ${escapeHtml(notif.message)}</div>
      <div class="notification-item__time">${formatTime(notif.createdAt)}</div>
      ${targetCanId ? '<div class="notif-item-cta" style="font-size:11px; font-weight:600; color:var(--brand-amber); margin-top:4px; text-decoration:underline;">View Canned Message →</div>' : ''}
    `;

    item.addEventListener('click', async () => {
      if (!notif.read) {
        await api.markNotificationAsRead(notif.id).catch(() => {});
        notif.read = true;
        renderNotifications();
      }

      if (targetCanId) {
        const localCan = [...state.orgCans, ...state.personalCans].find(c => c.id === targetCanId);
        if (localCan) {
          showScreen('screen-dashboard');
          state.searchQuery = '';
          const sIn = $('search-input');
          if (sIn) sIn.value = '';
          renderDashboard();
          setTimeout(() => {
            const card = document.querySelector(`.popup-card[data-id="${targetCanId}"]`);
            if (card) {
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              card.style.borderColor = 'var(--brand-amber)';
              setTimeout(() => { card.style.borderColor = ''; }, 2000);
            }
            openEditCanModal(localCan, localCan.scope === 'org');
          }, 100);
          return;
        }
      }

      openDashboardPage(targetCanId);
    });

    list.appendChild(item);
  });
}

function openDashboardPage(canId = null) {
  const url = canId ? `options/options.html?canId=${encodeURIComponent(canId)}` : 'options/options.html';
  if (chrome.runtime.openOptionsPage && !canId) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL(url));
  }
}

// ── Event Bindings ────────────────────────────────────────────────────────────
function bindEvents() {
  $('login-form').addEventListener('submit', handleLoginSubmit);

  // Open Full Library tab
  $('btn-open-dashboard').addEventListener('click', () => openDashboardPage());
  $('btn-footer-open-library').addEventListener('click', () => openDashboardPage());

  // Add Message triggers
  $('btn-quick-add').addEventListener('click', () => openNewCanModal(false));
  $('btn-new-can-empty').addEventListener('click', () => openNewCanModal(false));

  // Modals close / cancel
  $('btn-cancel-can').addEventListener('click', hideModal);
  $('btn-modal-close').addEventListener('click', hideModal);
  $('can-modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('can-modal-overlay')) hideModal();
  });

  $('btn-popup-cancel-delete').addEventListener('click', hideDeleteModal);
  $('btn-popup-confirm-delete').addEventListener('click', handleConfirmDelete);
  $('delete-modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('delete-modal-overlay')) hideDeleteModal();
  });

  // Copy button inside read-only can modal
  $('btn-popup-copy-can')?.addEventListener('click', () => {
    const text = $('can-content').value;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = $('btn-popup-copy-can');
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = 'Copy Content'; }, 1500);
      });
    }
  });

  // Shortcut input auto /
  $('can-shortcut').addEventListener('input', (e) => {
    let val = e.target.value.toLowerCase().replace(/\s+/g, '');
    if (!val.startsWith('/')) {
      val = '/' + val.replace(/^\/+/, '');
    }
    e.target.value = val;
  });

  $('can-form').addEventListener('submit', handleCanFormSubmit);

  // Search
  $('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    $('search-clear').classList.toggle('hidden', !state.searchQuery);
    renderDashboard();
  });

  $('search-clear').addEventListener('click', () => {
    $('search-input').value = '';
    state.searchQuery = '';
    $('search-clear').classList.add('hidden');
    renderDashboard();
    $('search-input').focus();
  });

  // Filter Pills (Mint Green Active Pill)
  const pills = [
    { el: $('pill-all'), filter: 'all' },
    { el: $('pill-newest'), filter: 'newest' },
    { el: $('pill-personal'), filter: 'personal' },
    { el: $('pill-org'), filter: 'org' }
  ];

  pills.forEach(({ el, filter }) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      state.activeFilter = filter;
      renderDashboard();
    });
  });

  // Notification Filter Tabs (New Updates vs All)
  $('popup-tab-notif-new')?.addEventListener('click', () => {
    state.notifTab = 'new';
    renderNotifications();
  });

  $('popup-tab-notif-all')?.addEventListener('click', () => {
    state.notifTab = 'all';
    renderNotifications();
  });

  // Navigation screens
  $('btn-notifications').addEventListener('click', () => {
    const hasUnread = state.notifications.some(n => !n.read);
    state.notifTab = hasUnread ? 'new' : 'all';
    renderNotifications();
    showScreen('screen-notifications');
  });

  $('btn-settings').addEventListener('click', () => {
    renderSettings();
    showScreen('screen-settings');
  });

  $('btn-back-notifications').addEventListener('click', () => showScreen('screen-dashboard'));
  $('btn-back-settings').addEventListener('click', () => showScreen('screen-dashboard'));

  // Settings screen actions
  $('btn-save-server').addEventListener('click', async () => {
    const url = $('setting-server-url').value.trim();
    if (url) {
      api.setBaseUrl(url);
      $('btn-save-server').textContent = '✅ Saved';
      setTimeout(() => { $('btn-save-server').textContent = 'Save Server URL'; }, 1500);
      await syncData();
    }
  });

  $('btn-sync-now').addEventListener('click', async () => {
    const btn = $('btn-sync-now');
    btn.textContent = '⏳ Syncing...';
    await syncData();
    btn.textContent = '✅ Synced';
    setTimeout(() => { btn.textContent = '🔄 Sync Data Now'; }, 1500);
  });

  $('btn-logout').addEventListener('click', handleLogout);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // ⌘ K or Ctrl K focuses search
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const s = $('search-input');
      if (s) {
        s.focus();
        s.select();
      }
      return;
    }

    // Ctrl + Enter inside Add Message modal to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const modalOpen = !$('can-modal-overlay').classList.contains('hidden');
      if (modalOpen) {
        e.preventDefault();
        handleCanFormSubmit();
        return;
      }
    }

    // Escape closes modal
    if (e.key === 'Escape') {
      if (!$('can-modal-overlay').classList.contains('hidden')) hideModal();
      if (!$('delete-modal-overlay').classList.contains('hidden')) hideDeleteModal();
    }
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showFormError(elId, msg) {
  const el = $(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
