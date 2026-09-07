'use strict';

// ============================================================
// TAAMEER MARKETING DASHBOARD — APPLICATION CORE
// ============================================================

const CONFIG = Object.freeze({
  supabaseUrl: 'https://owuchwubosdooiburvfr.supabase.co',
  supabaseKey: 'sb_publishable_uRv7o_myC7KfGsBc-ftrYQ_ZLrM7R6w',
  table: 'app_data',
  storagePrefix: 'taameer_',
  syncDebounceMs: 350
});

const supabaseClient = window.supabase?.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) || null;

const DEFAULT_MODULES = [
  { id: 'calendar', name: 'Calendar', icon: 'fa-calendar-alt', desc: 'Team schedule and department calendar', color: '#757575', roles: ['admin','user'], status: 'active' }
];

const DEFAULT_USERS = [
  { id: 1, username: 'admin', password: 'admin123', fullName: 'Admin User', jobTitle: 'System Administrator', email: 'admin@taameer.com', phone: '+974 0000 0001', role: 'admin', status: 'active', avatar: null, lastLogin: null, modules: ['calendar'], accentColor: null },
  { id: 2, username: 'user', password: '', fullName: 'Test User', jobTitle: 'Marketing Specialist', email: 'user@taameer.com', phone: '+974 0000 0002', role: 'user', status: 'active', avatar: null, lastLogin: null, modules: ['calendar'], accentColor: null }
];

const DEFAULT_PERMISSIONS = {
  user: { calendar: { view: true, edit: true, delete: true } },
  admin: { calendar: { view: true, edit: true, delete: true } }
};

const DEFAULT_SETTINGS = { orgName: 'TAAMEER Group', tagline: 'Marketing Dashboard', accent: '#757575', accentName: 'Gray' };

const Utils = {
  clone(value) { return JSON.parse(JSON.stringify(value)); },
  parseJSON(value, fallback) { try { return value ? JSON.parse(value) : Utils.clone(fallback); } catch { return Utils.clone(fallback); } },
  escapeHTML(value = '') { return String(value).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])); },
  validColor(value) { return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#757575'; },
  validIcon(value) { return /^fa-[a-z0-9-]+$/i.test(value || '') ? value : 'fa-cube'; },
  slug(value) { return String(value).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'); },
  async hashPassword(password) {
    if (!password) return '';
    if (password.startsWith('sha256:')) return password;
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return 'sha256:' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
  },
  async verifyPassword(input, stored) {
    if (!stored) return input === '';
    if (stored.startsWith('sha256:')) return (await Utils.hashPassword(input)) === stored;
    return input === stored;
  }
};

let state = {
  users: Utils.parseJSON(localStorage.getItem('taameer_users'), DEFAULT_USERS),
  modules: Utils.parseJSON(localStorage.getItem('taameer_modules'), DEFAULT_MODULES),
  permissions: Utils.parseJSON(localStorage.getItem('taameer_permissions'), DEFAULT_PERMISSIONS),
  settings: Utils.parseJSON(localStorage.getItem('taameer_settings'), DEFAULT_SETTINGS),
  currentUser: null,
  pendingUser: null
};

let currentMonth = new Date();
let selectedDay = new Date().getDate();
let sidebarExpanded = false;
let cloudReady = false;
let syncTimer = null;
let realtimeChannel = null;

const Store = {
  persistentSnapshot() {
    return { users: state.users, modules: state.modules, permissions: state.permissions, settings: state.settings };
  },
  saveLocal() {
    localStorage.setItem('taameer_users', JSON.stringify(state.users));
    localStorage.setItem('taameer_modules', JSON.stringify(state.modules));
    localStorage.setItem('taameer_permissions', JSON.stringify(state.permissions));
    localStorage.setItem('taameer_settings', JSON.stringify(state.settings));
  },
  applyCloudRows(rows = []) {
    const byId = Object.fromEntries(rows.map(r => [r.id, r.data]));
    if (Array.isArray(byId.users)) state.users = byId.users;
    if (Array.isArray(byId.modules)) state.modules = byId.modules;
    if (byId.permissions && typeof byId.permissions === 'object') state.permissions = byId.permissions;
    if (byId.settings && typeof byId.settings === 'object') state.settings = { ...DEFAULT_SETTINGS, ...byId.settings };
    Store.normalize();
    Store.saveLocal();
  },
  normalize() {
    if (!Array.isArray(state.users)) state.users = Utils.clone(DEFAULT_USERS);
    if (!Array.isArray(state.modules)) state.modules = Utils.clone(DEFAULT_MODULES);
    state.modules = state.modules.map(m => ({
      id: String(m.id || 'module-' + Date.now()),
      name: String(m.name || 'Module'),
      icon: Utils.validIcon(m.icon),
      desc: String(m.desc || ''),
      color: '#757575',
      roles: Array.isArray(m.roles) ? m.roles : ['admin','user'],
      status: ['active','soon','disabled'].includes(m.status) ? m.status : 'active'
    }));
    state.users = state.users.map(u => ({
      ...u,
      modules: Array.isArray(u.modules) ? u.modules : [],
      role: u.role === 'admin' ? 'admin' : 'user',
      status: ['active','inactive','suspended'].includes(u.status) ? u.status : 'active'
    }));
    state.permissions = state.permissions && typeof state.permissions === 'object' ? state.permissions : Utils.clone(DEFAULT_PERMISSIONS);
    state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  }
};

const Cloud = {
  async load() {
    if (!supabaseClient) return false;
    try {
      const { data, error } = await supabaseClient.from(CONFIG.table).select('id,data').in('id', ['users','modules','permissions','settings']);
      if (error) throw error;
      if (data?.length) Store.applyCloudRows(data); else await Cloud.syncNow();
      cloudReady = true;
      console.info('TAAMEER: Supabase connected');
      Cloud.subscribe();
      return true;
    } catch (error) {
      cloudReady = false;
      console.error('TAAMEER: Supabase load failed', error);
      return false;
    }
  },
  queueSync() {
    Store.saveLocal();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => Cloud.syncNow(), CONFIG.syncDebounceMs);
  },
  async syncNow() {
    if (!supabaseClient) return false;
    const snapshot = Store.persistentSnapshot();
    const rows = Object.entries(snapshot).map(([id, data]) => ({ id, data }));
    try {
      const { error } = await supabaseClient.from(CONFIG.table).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      cloudReady = true;
      return true;
    } catch (error) {
      cloudReady = false;
      console.error('TAAMEER: Supabase sync failed', error);
      return false;
    }
  },
  subscribe() {
    if (!supabaseClient || realtimeChannel) return;
    try {
      realtimeChannel = supabaseClient.channel('taameer-app-data')
        .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.table }, async () => {
          const { data, error } = await supabaseClient.from(CONFIG.table).select('id,data').in('id', ['users','modules','permissions','settings']);
          if (!error && data?.length) {
            const currentId = state.currentUser?.id;
            Store.applyCloudRows(data);
            if (currentId) state.currentUser = state.users.find(u => u.id === currentId) || null;
            applyActiveAccent();
            if (state.currentUser) refreshUI();
          }
        })
        .subscribe();
    } catch (error) {
      console.warn('TAAMEER: realtime unavailable', error);
    }
  }
};

function save() { Cloud.queueSync(); }
async function syncToCloud() { return Cloud.syncNow(); }
async function loadFromCloud() { return Cloud.load(); }
