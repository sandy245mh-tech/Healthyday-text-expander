const DEFAULT_API_BASE = 'http://localhost:3001';

class ApiClient {
  constructor() {
    this.user = null; // { name, role }
    this.baseUrl = DEFAULT_API_BASE;
  }

  async init() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.get(['user', 'apiBaseUrl'], (result) => {
          this.user = result?.user || null;
          this.baseUrl = result?.apiBaseUrl || DEFAULT_API_BASE;
          resolve();
        });
      } else {
        try {
          const u = localStorage.getItem('user');
          this.user = u ? JSON.parse(u) : null;
          this.baseUrl = localStorage.getItem('apiBaseUrl') || DEFAULT_API_BASE;
        } catch (e) {}
        resolve();
      }
    });
  }

  setBaseUrl(url) {
    this.baseUrl = (url || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ apiBaseUrl: this.baseUrl });
    } else {
      try { localStorage.setItem('apiBaseUrl', this.baseUrl); } catch (e) {}
    }
  }

  getBaseUrl() {
    return this.baseUrl || DEFAULT_API_BASE;
  }

  setUser(user) {
    this.user = user;
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ user });
    } else {
      try { localStorage.setItem('user', JSON.stringify(user)); } catch (e) {}
    }
  }

  clearUser() {
    this.user = null;
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.remove(['user']);
    } else {
      try { localStorage.removeItem('user'); } catch (e) {}
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.user) {
      headers['x-user-name'] = this.user.name;
      headers['x-user-role'] = this.user.role;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.clearUser();
          document.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  // Cans
  getPersonalCans() {
    return this.request('/cans');
  }

  createPersonalCan(can) {
    return this.request('/cans', {
      method: 'POST',
      body: JSON.stringify(can),
    });
  }

  updatePersonalCan(id, can) {
    return this.request(`/cans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(can),
    });
  }

  deletePersonalCan(id) {
    return this.request(`/cans/${id}`, { method: 'DELETE' });
  }

  // Organization
  getOrgCans() {
    return this.request('/organization/cans');
  }

  publishOrgCan(id) {
    return this.request(`/organization/cans/${id}/publish`, { method: 'POST' });
  }

  createOrgCan(can) {
    return this.request('/organization/cans', {
      method: 'POST',
      body: JSON.stringify(can),
    });
  }

  updateOrgCan(id, can) {
    return this.request(`/organization/cans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(can),
    });
  }
  
  deleteOrgCan(id) {
    return this.request(`/organization/cans/${id}`, { method: 'DELETE' });
  }

  // Notifications
  getNotifications() {
    return this.request('/notifications');
  }

  markNotificationAsRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }
}

export const api = new ApiClient();
