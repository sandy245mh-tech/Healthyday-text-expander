/**
 * options.js — Cloud Text Expander Full Library & Dashboard
 * Implements interactive behavior matching the UI palette and modals
 */

import { api } from '../api/apiClient.js';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  user: { name: 'Agent', role: 'ADMIN' }, // default fallback
  personalCans: [],
  orgCans: [],
  allCans: [],
  notifications: [],
  activeFilter: 'all',     // 'all' | 'newest' | 'oldest' | 'updated'
  activeScope: null,       // null | 'personal' | 'org'
  searchQuery: '',
  editingCan: null,        // null = creating new, object = editing
  canToDelete: null,       // { id, title, isOrg }
  notifTab: 'new',         // 'new' | 'all'
};

// ── DOM Elements ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Initializer ──────────────────────────────────────────────────────────────
async function startApp() {
  initKeyboardBadges();
  bindEvents();
  await loadUserData();
  await syncData();

  // Check URL query param for direct can navigation (?canId=...)
  const urlParams = new URLSearchParams(window.location.search);
  const targetCanId = urlParams.get('canId');
  if (targetCanId) {
    setTimeout(() => {
      navigateToCannedMessage(targetCanId);
    }, 200);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

function initKeyboardBadges() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const searchKbd = $('search-kbd');
  if (searchKbd) {
    searchKbd.textContent = isMac ? '⌘ K' : 'Ctrl K';
  }
}

// ── Load & Sync Data ─────────────────────────────────────────────────────────
async function loadUserData() {
  await api.init();
  if (api.user) {
    state.user = api.user;
  } else {
    // Default default user if none set
    state.user = { name: 'Team Member', role: 'ADMIN' };
    api.setUser(state.user);
  }
  updateUserDisplay();
}

function updateUserDisplay() {
  const nameEl = $('user-display-name');
  const indEl = $('user-role-indicator');
  if (nameEl) nameEl.textContent = `${state.user.name} (${state.user.role})`;
  if (indEl) {
    indEl.style.backgroundColor = state.user.role === 'ADMIN' ? '#8b5cf6' : '#10b981';
  }

  // Settings modal user info
  const sName = $('settings-user-name');
  const sRole = $('settings-user-role');
  const sAvatar = $('settings-avatar');
  const sNameInput = $('settings-name-input');
  const sRoleSelect = $('settings-role-select');
  const sUrl = $('settings-server-url');

  if (sName) sName.textContent = state.user.name;
  if (sRole) sRole.textContent = state.user.role;
  if (sAvatar) sAvatar.textContent = (state.user.name || 'U').charAt(0).toUpperCase();
  if (sNameInput) sNameInput.value = state.user.name;
  if (sRoleSelect) sRoleSelect.value = state.user.role;
  if (sUrl) sUrl.value = api.getBaseUrl();

  // Sidebar profile section
  const spAvatar = $('sidebar-profile-avatar');
  const spName   = $('sidebar-profile-name');
  const spRole   = $('sidebar-profile-role');
  const displayName = state.user.name || 'User';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');
  if (spAvatar) spAvatar.textContent = initials;
  if (spName)   spName.textContent   = displayName;
  if (spRole)   spRole.textContent   = state.user.role
    ? state.user.role.charAt(0).toUpperCase() + state.user.role.slice(1).toLowerCase()
    : '—';

  // Show/hide org creation option in form
  const scopeGroup = $('scope-selector-group');
  if (scopeGroup) {
    scopeGroup.classList.toggle('hidden', state.user.role !== 'ADMIN');
  }
}

const storage = {
  get: (keys, cb) => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get(keys, cb);
    } else {
      try {
        const res = {};
        keys.forEach(k => {
          const v = localStorage.getItem(k);
          if (v) res[k] = JSON.parse(v);
        });
        cb(res);
      } catch (e) { cb({}); }
    }
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
    renderNotificationsUI();

    // If server was offline or unreachable, fall back to storage
    if (!personalRes || !orgRes) {
      storage.get(['personalCans', 'orgCans'], (stored) => {
        if (!personalRes && Array.isArray(stored.personalCans)) {
          state.personalCans = filterOutDummyCans(stored.personalCans);
        }
        if (!orgRes && Array.isArray(stored.orgCans)) {
          state.orgCans = filterOutDummyCans(stored.orgCans);
        }
        rebuildAllCans();
        render();
      });
      return;
    }

    // Save to storage
    storage.set({
      personalCans: state.personalCans,
      orgCans: state.orgCans
    });

    rebuildAllCans();
    render();
  } catch (err) {
    console.error('Failed to sync data:', err);
    showToast('Offline mode — loaded local shortcuts');
  }
}

function rebuildAllCans() {
  const p = state.personalCans.map(c => ({ ...c, scope: 'personal' }));
  const o = state.orgCans.map(c => ({ ...c, scope: 'org' }));
  state.allCans = [...p, ...o];
}

// ── Notifications UI ─────────────────────────────────────────────────────────
function renderNotificationsUI() {
  const badge = $('notif-badge');
  const pill = $('notif-unread-pill');
  const listEl = $('notif-dropdown-list');
  const emptyEl = $('notif-dropdown-empty');

  const unreadCount = state.notifications.filter(n => !n.read).length;

  if (badge) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.classList.toggle('hidden', unreadCount === 0);
  }

  if (pill) {
    pill.textContent = `${unreadCount} new`;
  }

  // Update tab counts and states
  const tabNewCount = $('notif-tab-new-count');
  const tabAllCount = $('notif-tab-all-count');
  if (tabNewCount) tabNewCount.textContent = unreadCount;
  if (tabAllCount) tabAllCount.textContent = state.notifications.length;

  $('btn-notif-tab-new')?.classList.toggle('active', state.notifTab === 'new');
  $('btn-notif-tab-all')?.classList.toggle('active', state.notifTab === 'all');

  if (!listEl) return;
  listEl.innerHTML = '';

  const displayedNotifs = state.notifTab === 'new'
    ? state.notifications.filter(n => !n.read)
    : state.notifications;

  if (displayedNotifs.length === 0) {
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      const emptyTitle = $('notif-empty-title');
      const emptyDesc = $('notif-empty-desc');
      if (emptyTitle) emptyTitle.textContent = state.notifTab === 'new' ? 'All caught up!' : 'No notifications';
      if (emptyDesc) emptyDesc.textContent = state.notifTab === 'new' ? 'No new notifications or updates' : 'No updates recorded yet';
    }
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  displayedNotifs.forEach(notif => {
    const item = document.createElement('div');
    item.className = `notif-item${notif.read ? '' : ' unread'}`;
    const targetCanId = notif.canId || notif.can_id;

    item.style.cursor = 'pointer';
    item.title = targetCanId ? 'Click to view this canned message' : 'Click to view update';

    const isOrg = notif.type === 'CAN_PUBLISHED' || notif.type === 'CAN_UPDATED' || notif.type === 'ORG_UPDATE' || notif.type === 'org';
    const typeBadge = isOrg ? '🏢 ORG UPDATE' : '⚡ UPDATE';
    const badgeClass = isOrg ? 'org' : '';
    const timeFormatted = formatTime(notif.createdAt);

    item.innerHTML = `
      <div class="notif-item-header">
        <span class="notif-item-badge ${badgeClass}">${typeBadge}</span>
        <span class="notif-item-time">${timeFormatted}</span>
      </div>
      <div class="notif-item-msg">${escapeHtml(notif.message)}</div>
      ${targetCanId ? '<div class="notif-item-cta">View Canned Message →</div>' : ''}
    `;

    item.addEventListener('click', async () => {
      // Mark as read
      if (!notif.read) {
        await api.markNotificationAsRead(notif.id).catch(() => {});
        notif.read = true;
        renderNotificationsUI();
      }
      // Close dropdown
      const dropdown = $('notifications-dropdown');
      if (dropdown) dropdown.classList.add('hidden');

      // Navigate directly to the canned message
      if (targetCanId) {
        navigateToCannedMessage(targetCanId);
      }
    });

    listEl.appendChild(item);
  });
}

function formatTime(dateStr) {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString();
  } catch (e) {
    return 'Recently';
  }
}

// ── Navigate to Canned Message ───────────────────────────────────────────────
function navigateToCannedMessage(canId) {
  if (!canId) return;

  const can = state.allCans.find(c => c.id === canId);
  if (!can) {
    showToast('This canned message has been deleted or is unavailable.');
    return;
  }

  // Adjust scope filter so the targeted card is visible
  state.activeScope = can.scope === 'org' ? 'org' : 'personal';
  state.activeFilter = 'all';
  state.searchQuery = '';

  // Update navigation active item
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
  const targetNav = can.scope === 'org' ? $('nav-org') : $('nav-personal');
  if (targetNav) targetNav.classList.add('active');

  // Clear search input
  const searchInput = $('global-search');
  if (searchInput) searchInput.value = '';
  const clearBtn = $('search-clear');
  if (clearBtn) clearBtn.classList.add('hidden');

  // Re-render
  render();

  // Scroll to, highlight, and open the modal for this canned message
  setTimeout(() => {
    const card = document.querySelector(`.message-card[data-id="${canId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('card-highlight-flash');
      setTimeout(() => card.classList.remove('card-highlight-flash'), 2500);
    }
    openViewMessageModal(can);
  }, 120);
}

function highlightFirstCard() {
  const firstCard = document.querySelector('.message-card');
  if (!firstCard) return;
  firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  firstCard.classList.add('card-highlight-flash');
  setTimeout(() => firstCard.classList.remove('card-highlight-flash'), 1500);
}

// ── View Modal ────────────────────────────────────────────────────────────────
function openViewMessageModal(can) {
  openEditMessageModal(can);
}

// ── Rendering & Filtering ────────────────────────────────────────────────────
function render() {
  updateCounts();

  let list = [...state.allCans];

  // 1. Scope filter
  if (state.activeScope === 'personal') {
    list = list.filter(c => c.scope === 'personal');
  } else if (state.activeScope === 'org') {
    list = list.filter(c => c.scope === 'org');
  }

  // 2. Search query filter
  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(c => 
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.shortcut && c.shortcut.toLowerCase().includes(q)) ||
      (c.content && c.content.toLowerCase().includes(q))
    );
  }

  // 3. Sorting filter (ALL, NEWEST, OLDEST, RECENTLY UPDATED)
  if (state.activeFilter === 'newest') {
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else if (state.activeFilter === 'oldest') {
    list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else if (state.activeFilter === 'updated') {
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  const grid = $('cards-grid');
  const empty = $('empty-state');

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    $('empty-title').textContent = q ? `No results for "${q}"` : 'No messages found';
    $('empty-description').textContent = q 
      ? 'Try checking for typos or clear your search query.' 
      : 'Create your first canned message snippet to expand text quickly on any site.';
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = '';

  list.forEach(can => {
    const card = document.createElement('div');
    card.className = 'message-card';
    card.dataset.id = can.id;

    const formattedShortcut = can.shortcut.startsWith('/') ? can.shortcut : `/${can.shortcut}`;

    const isOrg = can.scope === 'org';
    const isAdmin = state.user?.role === 'ADMIN';
    const canModify = !isOrg || isAdmin;

    card.innerHTML = `
      <div class="message-card-header">
        <h4 class="message-card-title" title="${escapeHtml(can.title)}">${escapeHtml(can.title)}</h4>
        <span class="shortcut-chip">${escapeHtml(formattedShortcut)}</span>
      </div>
      <div class="message-card-content" title="${escapeHtml(can.content)}">
        ${escapeHtml(can.content)}
      </div>
      <div class="message-card-footer">
        <span class="card-scope-badge ${isOrg ? 'org' : 'personal'}">
          ${isOrg ? '🏢 Org' : '👤 Personal'}
        </span>
        <div class="card-actions">
          <button class="card-action-btn copy-btn" title="Copy to clipboard" data-action="copy">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
              <rect x="7" y="7" width="10" height="10" rx="2"/>
              <path d="M4 13V5a2 2 0 0 1 2-2h8"/>
            </svg>
          </button>
          ${canModify ? `
          <button class="card-action-btn edit-btn" title="Edit message" data-action="edit">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
              <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </button>
          <button class="card-action-btn delete delete-btn" title="Delete message" data-action="delete">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
              <path d="M4 6h12M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M14 6v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/>
            </svg>
          </button>
          ` : `
          <button class="card-action-btn view-btn" title="View details" data-action="view">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
              <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
              <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>
            </svg>
          </button>
          `}
        </div>
      </div>
    `;

    // Click card body to open/view the message; action buttons handle their own actions
    card.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset?.action;
      if (action === 'copy') {
        copySnippet(can.content, card);
      } else if (action === 'edit') {
        openEditMessageModal(can);
      } else if (action === 'delete') {
        openDeleteModal(can);
      } else if (action === 'view') {
        openViewMessageModal(can);
      } else {
        if (canModify) {
          openEditMessageModal(can);
        } else {
          openViewMessageModal(can);
        }
      }
    });

    grid.appendChild(card);
  });
}

function updateCounts() {
  $('count-all').textContent = state.allCans.length;
  $('count-personal').textContent = state.personalCans.length;
  $('count-org').textContent = state.orgCans.length;
}

function copySnippet(text, cardEl) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!');
    if (cardEl) {
      cardEl.style.borderColor = 'var(--primary-blue)';
      cardEl.style.boxShadow = '0 0 0 2px var(--primary-blue-focus)';
      setTimeout(() => {
        cardEl.style.borderColor = '';
        cardEl.style.boxShadow = '';
      }, 500);
    }
  });
}

// ── Modals: Add / Edit Message (Screenshot 2) ────────────────────────────────
function openAddMessageModal() {
  state.editingCan = null;
  $('modal-message-title').textContent = 'Add Message';
  $('field-message-id').value = '';
  $('field-message-title').value = '';
  $('field-message-title').readOnly = false;
  $('field-message-shortcut').value = '/';
  $('field-message-shortcut').readOnly = false;
  $('field-message-content').value = '';
  $('field-message-content').readOnly = false;
  $('scope-personal').checked = true;
  $('scope-personal').disabled = false;
  $('scope-org').disabled = false;
  $('btn-save-message')?.classList.remove('hidden');
  $('options-org-readonly-notice')?.classList.add('hidden');
  $('btn-options-copy-content')?.classList.add('hidden');
  $('form-error-msg').classList.add('hidden');

  $('modal-overlay-message').classList.remove('hidden');
  setTimeout(() => $('field-message-title').focus(), 50);
}

function openEditMessageModal(can) {
  state.editingCan = can;
  const isOrg = can ? (can.scope === 'org') : false;
  const isAdmin = state.user?.role === 'ADMIN';
  const isReadOnly = isOrg && !isAdmin;

  $('field-message-id').value = can ? can.id : '';
  $('field-message-title').value = can ? (can.title || '') : '';
  
  const sc = can ? (can.shortcut || '') : '';
  $('field-message-shortcut').value = sc ? (sc.startsWith('/') ? sc : `/${sc}`) : '/';
  $('field-message-content').value = can ? (can.content || '') : '';
  
  if (isOrg) {
    $('scope-org').checked = true;
  } else {
    $('scope-personal').checked = true;
  }

  // Adjust modal for Read-only (agent viewing org can) vs Edit
  $('field-message-title').readOnly = isReadOnly;
  $('field-message-shortcut').readOnly = isReadOnly;
  $('field-message-content').readOnly = isReadOnly;
  $('scope-org').disabled = isReadOnly;
  $('scope-personal').disabled = isReadOnly;

  if (isReadOnly) {
    $('modal-message-title').textContent = 'View Organization Message';
    $('btn-save-message')?.classList.add('hidden');
    $('options-org-readonly-notice')?.classList.remove('hidden');
    $('btn-options-copy-content')?.classList.remove('hidden');
    const hintText = $('options-modal-hint-text');
    if (hintText) hintText.textContent = 'This organization message is shared by admins';
  } else {
    $('modal-message-title').textContent = can ? 'Edit Message' : 'Add Message';
    $('btn-save-message')?.classList.remove('hidden');
    $('options-org-readonly-notice')?.classList.add('hidden');
    $('btn-options-copy-content')?.classList.add('hidden');
    const hintText = $('options-modal-hint-text');
    if (hintText) hintText.innerHTML = 'Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to save';
  }

  $('form-error-msg').classList.add('hidden');
  $('modal-overlay-message').classList.remove('hidden');
  setTimeout(() => {
    if (isReadOnly) {
      $('field-message-content').focus();
    } else {
      $('field-message-title').focus();
    }
  }, 50);
}

function closeMessageModal() {
  $('modal-overlay-message').classList.add('hidden');
  state.editingCan = null;
}

async function handleMessageSubmit(e) {
  if (e) e.preventDefault();

  const title = $('field-message-title').value.trim();
  let shortcut = $('field-message-shortcut').value.trim().toLowerCase();
  const content = $('field-message-content').value.trim();
  const isOrg = $('scope-org')?.checked ?? false;

  if (isOrg && state.user?.role !== 'ADMIN') {
    showFormError('Only administrators can create or edit organization canned messages.');
    return;
  }

  if (!title) {
    showFormError('Please enter a message title');
    $('field-message-title').focus();
    return;
  }

  // Ensure shortcut begins with / and has no extra spaces
  if (!shortcut || shortcut === '/') {
    showFormError('Please specify a shortcut (e.g. /interview)');
    $('field-message-shortcut').focus();
    return;
  }

  if (!shortcut.startsWith('/')) {
    shortcut = `/${shortcut}`;
  }
  shortcut = shortcut.replace(/\s+/g, '');

  if (!content) {
    showFormError('Please enter the message content');
    $('field-message-content').focus();
    return;
  }

  const saveBtn = $('btn-save-message');
  saveBtn.disabled = true;
  saveBtn.style.opacity = '0.7';

  try {
    const payload = { title, shortcut, content };

    if (state.editingCan) {
      // Update
      const id = state.editingCan.id;
      if (state.editingCan.scope === 'org' || isOrg) {
        await api.updateOrgCan(id, payload);
      } else {
        await api.updatePersonalCan(id, payload).catch(() => updateLocalCan(id, payload, 'personal'));
      }
      showToast('Message updated!');
    } else {
      // Create
      if (isOrg && state.user.role === 'ADMIN') {
        try {
          await api.createOrgCan(payload);
        } catch (e) {
          throw new Error(`Could not save organization can to the server. Check your server connection and try again. (${e.message || 'Network error'})`);
        }
      } else {
        await api.createPersonalCan(payload).catch(() => createLocalCan(payload, 'personal'));
      }
      showToast('Message saved successfully!');
    }

    closeMessageModal();
    await syncData();
  } catch (err) {
    showFormError(err.message || 'Failed to save message');
  } finally {
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
  }
}

function showFormError(msg) {
  const errEl = $('form-error-msg');
  errEl.textContent = msg;
  errEl.classList.remove('hidden');
}

// ── Local Fallback Handlers ──────────────────────────────────────────────────
function createLocalCan(data, scope) {
  const newCan = {
    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    ...data,
    scope,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (scope === 'org') {
    state.orgCans.unshift(newCan);
  } else {
    state.personalCans.unshift(newCan);
  }
  persistLocal();
}

function updateLocalCan(id, data, scope) {
  const list = scope === 'org' ? state.orgCans : state.personalCans;
  const idx = list.findIndex(c => c.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
  }
  persistLocal();
}

function deleteLocalCan(id, isOrg) {
  if (isOrg) {
    state.orgCans = state.orgCans.filter(c => c.id !== id);
  } else {
    state.personalCans = state.personalCans.filter(c => c.id !== id);
  }
  persistLocal();
}

function persistLocal() {
  storage.set({
    personalCans: state.personalCans,
    orgCans: state.orgCans
  });
}

// ── Modals: Delete Confirmation (Screenshot 3) ───────────────────────────────
function openDeleteModal(can) {
  if (can.scope === 'org' && state.user?.role !== 'ADMIN') {
    alert('Permission denied: Only administrators can delete organization canned messages.');
    return;
  }
  state.canToDelete = can;
  $('delete-item-title').textContent = `"${can.title}"`;
  $('modal-overlay-delete').classList.remove('hidden');
  $('btn-confirm-delete').focus();
}

function closeDeleteModal() {
  $('modal-overlay-delete').classList.add('hidden');
  state.canToDelete = null;
}

async function handleConfirmDelete() {
  if (!state.canToDelete) return;
  const { id, scope } = state.canToDelete;
  const isOrg = scope === 'org';

  if (isOrg && state.user?.role !== 'ADMIN') {
    closeDeleteModal();
    alert('Permission denied: Only administrators can delete organization canned messages.');
    return;
  }

  const delBtn = $('btn-confirm-delete');
  delBtn.disabled = true;

  try {
    if (isOrg) {
      await api.deleteOrgCan(id);
    } else {
      await api.deletePersonalCan(id);
    }
    showToast('Message deleted');
    closeDeleteModal();
    await syncData();
  } catch (err) {
    alert(err.message || 'Failed to delete message');
  } finally {
    delBtn.disabled = false;
  }
}

// ── Event Bindings ────────────────────────────────────────────────────────────
function bindEvents() {
  // Sidebar navigation filters (Screenshot 1)
  const navItems = [
    { el: $('nav-all'), filter: 'all', scope: null },
    { el: $('nav-newest'), filter: 'newest', scope: null },
    { el: $('nav-oldest'), filter: 'oldest', scope: null },
    { el: $('nav-updated'), filter: 'updated', scope: null },
  ];

  navItems.forEach(({ el, filter, scope }) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      state.activeFilter = filter;
      state.activeScope = scope;
      render();
    });
  });

  // Collections (Personal / Org)
  $('nav-personal').addEventListener('click', () => {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
    $('nav-personal').classList.add('active');
    state.activeScope = 'personal';
    render();
  });

  $('nav-org').addEventListener('click', () => {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
    $('nav-org').classList.add('active');
    state.activeScope = 'org';
    render();
  });

  // Sidebar profile — clicking opens settings
  const sidebarProfile = $('sidebar-profile');
  if (sidebarProfile) {
    sidebarProfile.addEventListener('click', () => {
      updateUserDisplay();
      $('modal-overlay-settings').classList.remove('hidden');
    });
  }

  // Search input
  const searchInput = $('global-search');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    $('search-clear').classList.toggle('hidden', !state.searchQuery);
    render();
  });

  $('search-clear').addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    $('search-clear').classList.add('hidden');
    render();
    searchInput.focus();
  });

  // Add Message triggers
  $('btn-add-message').addEventListener('click', openAddMessageModal);
  $('btn-add-empty').addEventListener('click', openAddMessageModal);

  // Add/Edit Message Modal controls
  $('btn-close-message-modal').addEventListener('click', closeMessageModal);
  $('btn-cancel-message').addEventListener('click', closeMessageModal);
  $('form-message').addEventListener('submit', handleMessageSubmit);

  // Shortcut input auto prefix formatting
  $('field-message-shortcut').addEventListener('input', (e) => {
    let val = e.target.value.toLowerCase().replace(/\s+/g, '');
    if (!val.startsWith('/')) {
      val = '/' + val.replace(/^\/+/, '');
    }
    e.target.value = val;
  });

  // Delete Modal controls (Screenshot 3)
  $('btn-cancel-delete').addEventListener('click', closeDeleteModal);
  $('btn-confirm-delete').addEventListener('click', handleConfirmDelete);

  // Notifications Dropdown & Bell
  const btnNotif = $('btn-notifications');
  const notifDropdown = $('notifications-dropdown');
  if (btnNotif && notifDropdown) {
    btnNotif.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('hidden');
      if (!notifDropdown.classList.contains('hidden')) {
        const hasUnread = state.notifications.some(n => !n.read);
        state.notifTab = hasUnread ? 'new' : 'all';
        renderNotificationsUI();
      }
    });

    document.addEventListener('click', (e) => {
      if (!notifDropdown.classList.contains('hidden') && !notifDropdown.contains(e.target) && e.target !== btnNotif) {
        notifDropdown.classList.add('hidden');
      }
    });
  }

  // Notification Filter Tabs (New Updates vs All)
  $('btn-notif-tab-new')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.notifTab = 'new';
    renderNotificationsUI();
  });

  $('btn-notif-tab-all')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.notifTab = 'all';
    renderNotificationsUI();
  });

  // Modal Copy Content button (for view mode)
  $('btn-options-copy-content')?.addEventListener('click', () => {
    const text = $('field-message-content').value;
    if (text) copySnippet(text, null);
  });

  const markAllBtn = $('btn-mark-all-read');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      const unreadList = state.notifications.filter(n => !n.read);
      await Promise.all(unreadList.map(n => api.markNotificationAsRead(n.id).catch(() => {})));
      state.notifications.forEach(n => { n.read = true; });
      renderNotificationsUI();
      showToast('All notifications marked as read');
    });
  }

  // Settings Modal (accessible from sidebar profile or if settings button exists)
  const openSettingsBtn = $('btn-open-settings');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      updateUserDisplay();
      $('modal-overlay-settings').classList.remove('hidden');
    });
  }
  const closeSettingsBtn = $('btn-close-settings-modal');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => $('modal-overlay-settings').classList.add('hidden'));
  }

  $('btn-update-identity').addEventListener('click', () => {
    const name = $('settings-name-input').value.trim();
    const role = $('settings-role-select').value;
    if (name) {
      state.user = { name, role };
      api.setUser(state.user);
      updateUserDisplay();
      showToast('Identity updated');
      $('modal-overlay-settings').classList.add('hidden');
      render();
    }
  });

  $('btn-save-server-url').addEventListener('click', () => {
    const url = $('settings-server-url').value.trim();
    if (url) {
      api.setBaseUrl(url);
      showToast('Server URL saved');
    }
  });

  $('btn-sync-now').addEventListener('click', async () => {
    showToast('Syncing with cloud...');
    await syncData();
    showToast('Cloud sync complete!');
  });

  // Help Modal
  $('btn-open-help').addEventListener('click', () => $('modal-overlay-help').classList.remove('hidden'));
  $('btn-close-help-modal').addEventListener('click', () => $('modal-overlay-help').classList.add('hidden'));

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // ⌘ K or Ctrl K to focus search
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    // Ctrl + Enter or Cmd + Enter inside form to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const formOpen = !$('modal-overlay-message').classList.contains('hidden');
      if (formOpen) {
        e.preventDefault();
        handleMessageSubmit();
        return;
      }
    }

    // Escape closes active modal
    if (e.key === 'Escape') {
      if (notifDropdown && !notifDropdown.classList.contains('hidden')) notifDropdown.classList.add('hidden');
      if (!$('modal-overlay-message').classList.contains('hidden')) closeMessageModal();
      if (!$('modal-overlay-delete').classList.contains('hidden')) closeDeleteModal();
      if (!$('modal-overlay-settings').classList.contains('hidden')) $('modal-overlay-settings').classList.add('hidden');
      if (!$('modal-overlay-help').classList.contains('hidden')) $('modal-overlay-help').classList.add('hidden');
      if (!$('modal-overlay-pro').classList.contains('hidden')) $('modal-overlay-pro').classList.add('hidden');
    }
  });

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2400);
}
