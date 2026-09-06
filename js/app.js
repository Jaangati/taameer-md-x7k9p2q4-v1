'use strict';

// ============================================================
// TAAMEER MARKETING DASHBOARD — APPLICATION CORE
// Design markup above is intentionally kept separate from logic.
// ============================================================

// ---------- Configuration ----------
const CONFIG = Object.freeze({
  supabaseUrl: 'https://owuchwubosdooiburvfr.supabase.co',
  supabaseKey: 'sb_publishable_uRv7o_myC7KfGsBc-ftrYQ_ZLrM7R6w',
  table: 'app_data',
  storagePrefix: 'taameer_',
  syncDebounceMs: 350
});

const supabaseClient = window.supabase?.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) || null;

// ---------- Defaults ----------
const DEFAULT_MODULES = [
  { id: 'calendar', name: 'Calendar', icon: 'fa-calendar-alt', desc: 'Schedule management and event tracking', color: '#757575', roles: ['admin','user'], status: 'active' },
  { id: 'module-test', name: 'Module Test', icon: 'fa-flask', desc: 'Placeholder test module', color: '#757575', roles: ['admin','user'], status: 'active' }
];

const DEFAULT_USERS = [
  { id: 1, username: 'admin', password: 'admin123', fullName: 'Admin User', jobTitle: 'System Administrator', email: 'admin@taameer.com', phone: '+974 0000 0001', role: 'admin', status: 'active', avatar: null, lastLogin: null, modules: ['calendar','module-test'], accentColor: null },
  { id: 2, username: 'user', password: '', fullName: 'Test User', jobTitle: 'Marketing Specialist', email: 'user@taameer.com', phone: '+974 0000 0002', role: 'user', status: 'active', avatar: null, lastLogin: null, modules: ['calendar','module-test'], accentColor: null }
];

const DEFAULT_PERMISSIONS = {
  user: { calendar: { view: true, edit: true, delete: false }, 'module-test': { view: true, edit: false, delete: false } },
  admin: { calendar: { view: true, edit: true, delete: true }, 'module-test': { view: true, edit: true, delete: true } }
};

const DEFAULT_SETTINGS = { orgName: 'TAAMEER Group', tagline: 'Marketing Dashboard', accent: '#757575', accentName: 'Gray' };

// ---------- Utilities ----------
const Utils = {
  clone(value) { return JSON.parse(JSON.stringify(value)); },
  parseJSON(value, fallback) { try { return value ? JSON.parse(value) : Utils.clone(fallback); } catch { return Utils.clone(fallback); } },
  escapeHTML(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); },
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
    return input === stored; // legacy plaintext migration path
  }
};

// ---------- State + persistence ----------
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
    return {
      users: state.users,
      modules: state.modules,
      permissions: state.permissions,
      settings: state.settings
    };
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
      color: Utils.validColor(m.color),
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

// ---------- Supabase sync ----------
const Cloud = {
  async load() {
    if (!supabaseClient) return false;
    try {
      const { data, error } = await supabaseClient.from(CONFIG.table).select('id,data').in('id', ['users','modules','permissions','settings']);
      if (error) throw error;
      if (data?.length) {
        Store.applyCloudRows(data);
      } else {
        await Cloud.syncNow(); // first run: seed cloud from current local data
      }
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
          // Pull fresh canonical state after a remote change.
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

// ---------- Module registry ----------
const ModuleRegistry = {
  renderers: new Map(),
  register(moduleId, renderer) { if (typeof renderer === 'function') this.renderers.set(moduleId, renderer); },
  viewName(module) {
    if (document.getElementById(`view-${module.id}`)) return module.id;
    return module.id;
  },
  ensureView(module) {
    const viewId = `view-${module.id}`;
    let view = document.getElementById(viewId);
    if (!view) {
      view = document.createElement('div');
      view.id = viewId;
      view.className = 'view-section hidden fade-in';
      document.getElementById('mainContent').appendChild(view);
    }
    const renderer = this.renderers.get(module.id);
    if (renderer) {
      renderer(view, module);
    } else if (!view.dataset.generated) {
      view.innerHTML = `<div class="stat-card bg-white dark:bg-gray-900 p-6"><div class="flex items-center space-x-4 mb-6"><div class="w-14 h-14 rounded-2xl flex items-center justify-center shadow-accent" style="background:${Utils.validColor(module.color)}"><i class="fas ${Utils.validIcon(module.icon)} text-white text-2xl"></i></div><div><h2 class="text-2xl font-bold text-gray-900 dark:text-white">${Utils.escapeHTML(module.name)}</h2><p class="text-sm text-gray-500">${Utils.escapeHTML(module.desc || 'Module workspace')}</p></div></div><div class="p-6 bg-accent-soft border border-accent/20 rounded-xl"><h4 class="font-semibold text-gray-900 dark:text-white mb-2">Module ready</h4><p class="text-sm text-gray-600 dark:text-gray-400">This section is connected to the dashboard structure and can be developed independently without changing the rest of the system.</p></div></div>`;
      view.dataset.generated = 'true';
    }
    return module.id;
  },
  ensureAll() { state.modules.forEach(m => this.ensureView(m)); }
};

function getModuleByView(viewName) { return state.modules.find(m => m.id === viewName) || null; }
function canAccessModule(module) {
  if (!module || !state.currentUser) return false;
  if (state.currentUser.role === 'admin') return true;
  const assigned = state.currentUser.modules?.includes(module.id);
  const permission = state.permissions?.[state.currentUser.role]?.[module.id]?.view === true;
  return assigned && permission && module.status !== 'disabled';
}

// ---------- Accent / theme ----------
function applyAccentCSS(color) {
  const c = Utils.validColor(color);
  document.documentElement.style.setProperty('--accent', c);
  document.documentElement.style.setProperty('--accent-soft', c + '1F');
  document.documentElement.style.setProperty('--accent-hover', c + '38');
}
function applyActiveAccent() { applyAccentCSS(state.currentUser?.accentColor || state.settings.accent); }
function setAccent(el) { applySystemAccent(el.dataset.color, el.dataset.name); document.querySelectorAll('#colorPicker .color-swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); document.getElementById('customColor').value = el.dataset.color; document.getElementById('customColorHex').textContent = el.dataset.color; }
function setCustomAccent(color) { applySystemAccent(color, 'Custom'); document.querySelectorAll('#colorPicker .color-swatch').forEach(s => s.classList.remove('active')); document.getElementById('customColorHex').textContent = color; }
function applySystemAccent(color, name) { state.settings.accent = Utils.validColor(color); state.settings.accentName = name; if (!state.currentUser?.accentColor) applyAccentCSS(color); save(); }
function loadSystemAccent() { const s = state.settings; applyAccentCSS(s.accent || '#757575'); document.getElementById('customColor').value = Utils.validColor(s.accent); document.getElementById('customColorHex').textContent = Utils.validColor(s.accent); const swatch = document.querySelector(`#colorPicker .color-swatch[data-color="${s.accent}"]`); if (swatch) { document.querySelectorAll('#colorPicker .color-swatch').forEach(x => x.classList.remove('active')); swatch.classList.add('active'); } }
function setPersonalAccent(el) { applyPersonalAccent(el.dataset.color); document.querySelectorAll('#personalColorPicker .color-swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); document.getElementById('personalCustomColor').value = el.dataset.color; document.getElementById('personalCustomColorHex').textContent = el.dataset.color; }
function setPersonalCustomAccent(color) { applyPersonalAccent(color); document.querySelectorAll('#personalColorPicker .color-swatch').forEach(s => s.classList.remove('active')); document.getElementById('personalCustomColorHex').textContent = color; }
function applyPersonalAccent(color) { if (!state.currentUser) return; const c = Utils.validColor(color); state.currentUser.accentColor = c; const idx = state.users.findIndex(u => u.id === state.currentUser.id); if (idx !== -1) state.users[idx].accentColor = c; localStorage.setItem('taameer_currentUser', JSON.stringify({ id: state.currentUser.id })); applyAccentCSS(c); save(); }
function resetPersonalAccent() { if (!state.currentUser) return; state.currentUser.accentColor = null; const idx = state.users.findIndex(u => u.id === state.currentUser.id); if (idx !== -1) state.users[idx].accentColor = null; applyAccentCSS(state.settings.accent); refreshPersonalColorPicker(null); save(); }
function refreshPersonalColorPicker(color) { document.querySelectorAll('#personalColorPicker .color-swatch').forEach(s => s.classList.remove('active')); if (color) { const swatch = document.querySelector(`#personalColorPicker .color-swatch[data-color="${color}"]`); if (swatch) swatch.classList.add('active'); document.getElementById('personalCustomColor').value = color; document.getElementById('personalCustomColorHex').textContent = color; } else { document.getElementById('personalCustomColor').value = state.settings.accent; document.getElementById('personalCustomColorHex').textContent = state.settings.accent; } }
function toggleTheme() { const html = document.documentElement; html.classList.toggle('dark'); localStorage.setItem('taameer_theme', html.classList.contains('dark') ? 'dark' : 'light'); document.getElementById('darkToggle')?.classList.toggle('on', html.classList.contains('dark')); }
function loadTheme() { if (localStorage.getItem('taameer_theme') === 'dark') document.documentElement.classList.add('dark'); }

// ---------- Authentication ----------
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const user = state.users.find(u => u.username === username);
  if (!user) return alert('Invalid credentials!');
  if (user.status !== 'active') return alert('Account is ' + user.status + '. Contact admin.');

  if (!user.password) {
    state.pendingUser = user;
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('setPasswordView').classList.remove('hidden');
    document.getElementById('spName').textContent = user.fullName.split(' ')[0];
    return;
  }

  if (!(await Utils.verifyPassword(password, user.password))) return alert('Invalid credentials!');

  // Transparently upgrade legacy plaintext passwords.
  if (!user.password.startsWith('sha256:')) user.password = await Utils.hashPassword(password);
  user.lastLogin = new Date().toISOString();
  state.currentUser = user;
  localStorage.setItem('taameer_currentUser', JSON.stringify({ id: user.id }));
  save();
  showDashboard();
});

document.getElementById('setPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = document.getElementById('spPassword').value;
  const conf = document.getElementById('spConfirm').value;
  if (pw.length < 6) return alert('Password must be at least 6 characters');
  if (pw !== conf) return alert('Passwords do not match');
  if (!state.pendingUser) return alert('Session expired. Please login again.');
  const idx = state.users.findIndex(u => u.id === state.pendingUser.id);
  if (idx === -1) return alert('User not found.');
  state.users[idx].password = await Utils.hashPassword(pw);
  state.users[idx].lastLogin = new Date().toISOString();
  state.currentUser = state.users[idx];
  state.pendingUser = null;
  localStorage.setItem('taameer_currentUser', JSON.stringify({ id: state.currentUser.id }));
  save();
  document.getElementById('setPasswordView').classList.add('hidden');
  document.getElementById('loginForm').reset();
  showDashboard();
});

function checkAuth() {
  const saved = Utils.parseJSON(localStorage.getItem('taameer_currentUser'), null);
  if (!saved?.id) return;
  const fresh = state.users.find(x => x.id === saved.id && x.status === 'active');
  if (!fresh) { localStorage.removeItem('taameer_currentUser'); return; }
  if (!fresh.password) {
    state.pendingUser = fresh;
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('setPasswordView').classList.remove('hidden');
    document.getElementById('spName').textContent = fresh.fullName.split(' ')[0];
    return;
  }
  state.currentUser = fresh;
  showDashboard();
}
function logout() { state.currentUser = null; localStorage.removeItem('taameer_currentUser'); closeUserDropdown(); document.getElementById('loginView').classList.remove('hidden'); document.getElementById('dashboardView').classList.add('hidden'); document.getElementById('setPasswordView').classList.add('hidden'); document.getElementById('loginForm').reset(); }

// ---------- Dashboard / navigation ----------
function showDashboard() { document.getElementById('loginView').classList.add('hidden'); document.getElementById('setPasswordView').classList.add('hidden'); document.getElementById('dashboardView').classList.remove('hidden'); ModuleRegistry.ensureAll(); applyActiveAccent(); refreshUI(); renderSidebar(); showView('home'); }

function refreshUI() {
  const u = state.currentUser; if (!u) return;
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText('userName', u.fullName); setText('ddName', u.fullName); setText('welcomeName', u.fullName.split(' ')[0]);
  setText('userRole', u.role === 'admin' ? 'Administrator' : u.jobTitle || 'User'); setText('ddRole', u.role); setText('ddEmail', u.email || '—');
  setText('userAvatarText', u.fullName.charAt(0).toUpperCase()); setText('profileAvatarText', u.fullName.charAt(0).toUpperCase());
  setText('profileFullName', u.fullName); setText('profileUsername', u.username); setText('profileJobTitle', u.jobTitle || '—');
  setText('profileEmailDisplay', u.email || '—'); setText('profilePhoneDisplay', u.phone || '—');
  setText('profileLastLogin', u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '—'); setText('profileTz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  setText('myJobTitle', u.jobTitle || '—'); setText('myRoleDisplay', u.role); setText('accNameDisplay', u.fullName); setText('accJobDisplay', u.jobTitle || '—');
  document.getElementById('myEmail').value = u.email || ''; document.getElementById('myPhone').value = u.phone || '';
  const setAvatar = (imgId, textId, value) => { const img = document.getElementById(imgId), txt = document.getElementById(textId); if (!img || !txt) return; if (value) { img.src = value; img.classList.remove('hidden'); txt.classList.add('hidden'); } else { img.classList.add('hidden'); txt.classList.remove('hidden'); } };
  setAvatar('userAvatarImg','userAvatarText',u.avatar); setAvatar('profileAvatarImg','profileAvatarText',u.avatar);
  const myModules = state.modules.filter(m => u.modules?.includes(m.id)); setText('myModulesCount', myModules.length); setText('sysTotalUsers', state.users.length);
  setText('sysOrgDisplay', state.settings.orgName); document.getElementById('sysOrgName').value = state.settings.orgName; document.getElementById('sysTagline').value = state.settings.tagline;
  setText('moduleTestDate', new Date().toLocaleDateString()); document.getElementById('darkToggle').classList.toggle('on', document.documentElement.classList.contains('dark'));
  refreshPersonalColorPicker(u.accentColor); applyActiveAccent();
}

function renderSidebar() {
  const nav = document.getElementById('sidebarNav'); const u = state.currentUser; if (!u) return;
  const isAdmin = u.role === 'admin';
  let html = `<div class="section-title sidebar-label">Main</div><div class="nav-item ${isActive('home') ? 'active' : ''}" onclick="showView('home')"><span class="nav-icon"><i class="fas fa-home"></i></span><span class="nav-label sidebar-label">Home</span></div><div class="nav-item ${isActive('calendar') ? 'active' : ''}" onclick="showView('calendar')"><span class="nav-icon"><i class="fas fa-calendar-alt"></i></span><span class="nav-label sidebar-label">Calendar</span></div>`;
  const userModules = state.modules.filter(m => u.modules?.includes(m.id) && m.id !== 'calendar' && m.status !== 'disabled' && (isAdmin || canAccessModule(m)));
  if (userModules.length) {
    html += `<div class="section-title sidebar-label mt-2">Modules</div>`;
    for (const m of userModules) {
      const viewId = ModuleRegistry.ensureView(m);
      html += `<div class="nav-item ${isActive(viewId) ? 'active' : ''}" onclick="showView('${Utils.escapeHTML(viewId)}')"><span class="nav-icon"><i class="fas ${Utils.validIcon(m.icon)}" style="color:${Utils.validColor(m.color)}"></i></span><span class="nav-label sidebar-label">${Utils.escapeHTML(m.name)}</span></div>`;
    }
  }
  if (isAdmin) html += `<div class="section-title sidebar-label mt-2">Administration</div><div class="nav-item ${isActive('users') ? 'active' : ''}" onclick="showView('users')"><span class="nav-icon"><i class="fas fa-users"></i></span><span class="nav-label sidebar-label">Users</span></div><div class="nav-item ${isActive('modules-admin') ? 'active' : ''}" onclick="showView('modules-admin')"><span class="nav-icon"><i class="fas fa-cubes"></i></span><span class="nav-label sidebar-label">Modules</span></div><div class="nav-item ${isActive('permissions') ? 'active' : ''}" onclick="showView('permissions')"><span class="nav-icon"><i class="fas fa-shield-alt"></i></span><span class="nav-label sidebar-label">Permissions</span></div><div class="nav-item ${isActive('settings') ? 'active' : ''}" onclick="showView('settings')"><span class="nav-icon"><i class="fas fa-cog"></i></span><span class="nav-label sidebar-label">Settings</span></div>`;
  nav.innerHTML = html;
}
function isActive(view) { const el = document.getElementById(`view-${view}`); return !!el && !el.classList.contains('hidden'); }
function toggleSidebar() {
  sidebarExpanded = !sidebarExpanded;
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('sidebar-expanded', sidebarExpanded);
  sb.classList.toggle('sidebar-collapsed', !sidebarExpanded);
  const icon = document.getElementById('toggleIcon');
  if (icon) icon.style.transform = sidebarExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
}

const sidebarHeader = document.querySelector('.sidebar-header');
if (sidebarHeader) {
  sidebarHeader.addEventListener('click', (e) => {
    if (e.target.closest('.sidebar-toggle-btn')) return;
    if (!sidebarExpanded) toggleSidebar();
  });
}

const VIEW_TITLES = { home: ['Home','TAAMEER Marketing Dashboard'], calendar: ['Calendar','Schedule & events'], 'module-test': ['Module Test','Test module'], profile: ['My Profile','Your public profile'], account: ['Account Settings','Personal settings'], users: ['User Management','Admin controls'], 'modules-admin': ['Module Management','Create & assign modules'], permissions: ['Permissions','Role access matrix'], settings: ['System Settings','Full admin configuration'] };
function showView(viewName) {
  if (!state.currentUser) return;
  if (['users','permissions','settings','modules-admin'].includes(viewName) && state.currentUser.role !== 'admin') return;
  const module = getModuleByView(viewName);
  if (module && !canAccessModule(module)) return;
  if (module) ModuleRegistry.ensureView(module);
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`view-${viewName}`); if (!target) return;
  target.classList.remove('hidden'); target.classList.add('fade-in');
  const titles = VIEW_TITLES[viewName] || (module ? [module.name, module.desc || 'Module'] : ['TAAMEER','']);
  document.getElementById('headerTitle').textContent = titles[0]; document.getElementById('headerSubtitle').textContent = titles[1];
  if (viewName === 'calendar') renderCalendar(); if (viewName === 'home') renderHomeModules(); if (viewName === 'users') loadUsers(); if (viewName === 'modules-admin') renderAdminModules(); if (viewName === 'permissions') renderPermissions();
  renderSidebar(); closeUserDropdown();
}

// ---------- Clock / dropdown / profile ----------
function updateClock() { const now = new Date(); const time = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); document.getElementById('clock').textContent = time; document.getElementById('bigClock').textContent = time; document.getElementById('date').textContent = now.toLocaleDateString('en-US',{month:'short',day:'numeric'}); document.getElementById('todayFullDate').textContent = now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); document.getElementById('tzSmall').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone; const h = now.getHours(); document.getElementById('greetingText').textContent = h >= 17 ? 'Good evening' : h >= 12 ? 'Good afternoon' : 'Good morning'; }
function toggleUserDropdown() { document.getElementById('userDropdown').classList.toggle('show'); }
function closeUserDropdown() { document.getElementById('userDropdown').classList.remove('show'); }
document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) closeUserDropdown(); });
function handleAvatarUpload(e) { const file = e.target.files[0]; if (!file) return; if (file.size > 2*1024*1024) return alert('Image too large (max 2MB)'); const reader = new FileReader(); reader.onload = ev => { state.currentUser.avatar = ev.target.result; const idx = state.users.findIndex(u => u.id === state.currentUser.id); if (idx !== -1) state.users[idx].avatar = ev.target.result; save(); refreshUI(); }; reader.readAsDataURL(file); }
function saveMyProfile() { const email = document.getElementById('myEmail').value.trim(); const phone = document.getElementById('myPhone').value.trim(); state.currentUser.email = email; state.currentUser.phone = phone; const idx = state.users.findIndex(u => u.id === state.currentUser.id); if (idx !== -1) state.users[idx] = { ...state.currentUser }; save(); refreshUI(); alert('Contact information updated!'); }
async function changePassword() { const cur = document.getElementById('curPass').value; const np = document.getElementById('newPass').value; const cp = document.getElementById('confPass').value; if (!(await Utils.verifyPassword(cur, state.currentUser.password))) return alert('Current password incorrect'); if (np.length < 6) return alert('Password must be at least 6 characters'); if (np !== cp) return alert('Passwords do not match'); const hash = await Utils.hashPassword(np); state.currentUser.password = hash; const idx = state.users.findIndex(u => u.id === state.currentUser.id); if (idx !== -1) state.users[idx].password = hash; save(); ['curPass','newPass','confPass'].forEach(id => document.getElementById(id).value = ''); alert('Password updated!'); }

// ---------- Calendar ----------
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function renderMonthTabs() { const c = document.getElementById('monthTabs'); c.innerHTML=''; monthShort.forEach((m,i)=>{ const t=document.createElement('button'); t.className=`month-tab flex-shrink-0 ${i===currentMonth.getMonth()?'active':''}`; t.textContent=m; t.onclick=()=>{ currentMonth.setMonth(i); renderCalendar(); }; c.appendChild(t); }); }
function renderDayStrip() { const c=document.getElementById('dayStrip'); c.innerHTML=''; const y=currentMonth.getFullYear(), mo=currentMonth.getMonth(), dim=new Date(y,mo+1,0).getDate(); for(let d=1;d<=dim;d++){ const dt=new Date(y,mo,d), el=document.createElement('div'); el.className=`day-circle flex-shrink-0 ${selectedDay===d?'active':''}`; const a=document.createElement('span'); a.className='text-[10px] opacity-70'; a.textContent=dayNames[dt.getDay()]; const b=document.createElement('span'); b.className='text-lg font-bold'; b.textContent=d; el.append(a,b); el.onclick=()=>{selectedDay=d;renderDayStrip();}; c.appendChild(el);} }
function renderCalendar() { const y=currentMonth.getFullYear(), mo=currentMonth.getMonth(); document.getElementById('calTitle').textContent=`${monthNames[mo]} ${y}`; renderMonthTabs(); renderDayStrip(); const firstDay=new Date(y,mo,1).getDay(), dim=new Date(y,mo+1,0).getDate(), grid=document.getElementById('calendarGrid'), today=new Date(); grid.innerHTML=''; for(let i=0;i<firstDay;i++){const e=document.createElement('div');e.className='h-20';grid.appendChild(e);} for(let d=1;d<=dim;d++){ const isToday=today.getDate()===d&&today.getMonth()===mo&&today.getFullYear()===y; const cell=document.createElement('div'); cell.className=`h-20 rounded-xl border border-gray-200 dark:border-gray-700 p-2 cursor-pointer hover:border-accent transition-all ${isToday?'bg-accent text-white border-accent':'bg-white dark:bg-gray-900 text-gray-900 dark:text-white'}`; const num=document.createElement('div'); num.className='font-semibold text-sm'; num.textContent=d; cell.appendChild(num); cell.onclick=()=>alert(`Selected: ${d} ${monthNames[mo]} ${y}`); grid.appendChild(cell);} }
function changeMonth(d) { currentMonth.setMonth(currentMonth.getMonth()+d); selectedDay=Math.min(selectedDay,new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,0).getDate()); renderCalendar(); }
function goToday() { currentMonth=new Date(); selectedDay=currentMonth.getDate(); renderCalendar(); }

// ---------- Home modules ----------
function renderHomeModules() { const grid=document.getElementById('homeModulesGrid'); grid.innerHTML=''; const u=state.currentUser; const myModules=state.modules.filter(m=>u.modules?.includes(m.id)); if(!myModules.length){grid.innerHTML='<div class="col-span-full p-6 bg-gray-50 dark:bg-gray-800 rounded-xl text-center text-gray-500">No modules assigned to you yet. Contact your administrator.</div>';return;} myModules.forEach(m=>{ const allowed=canAccessModule(m); const card=document.createElement('div'); card.className=`stat-card bg-white dark:bg-gray-900 p-5 ${!allowed?'opacity-60 cursor-not-allowed':'cursor-pointer'}`; const top=document.createElement('div'); top.className='flex items-start justify-between mb-3'; const icon=document.createElement('div'); icon.className='w-12 h-12 rounded-xl flex items-center justify-center shadow-accent'; icon.style.background=Utils.validColor(m.color); icon.innerHTML=`<i class="fas ${Utils.validIcon(m.icon)} text-white text-xl"></i>`; const badge=document.createElement('span'); badge.className=`badge ${allowed?'text-green-600 bg-green-50 dark:bg-green-900/20':'text-gray-500 bg-gray-100 dark:bg-gray-800'}`; badge.textContent=allowed?'Active':m.status==='soon'?'Coming Soon':'Unavailable'; top.append(icon,badge); const title=document.createElement('h4'); title.className='font-bold text-gray-900 dark:text-white mb-1'; title.textContent=m.name; const desc=document.createElement('p'); desc.className='text-sm text-gray-500 mb-4'; desc.textContent=m.desc; const footer=document.createElement('div'); footer.className='flex items-center justify-between'; footer.innerHTML=`<span class="text-xs text-gray-400">${allowed?'Click to open':'Unavailable'}</span><i class="fas fa-arrow-right text-accent"></i>`; card.append(top,title,desc,footer); if(allowed) card.onclick=()=>showView(ModuleRegistry.ensureView(m)); grid.appendChild(card); }); }

// ---------- User administration ----------
function loadUsers() { if(state.currentUser?.role!=='admin')return; const tbody=document.getElementById('usersTableBody'); tbody.innerHTML=''; state.users.forEach(user=>{ const tr=document.createElement('tr'); tr.className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'; const avatar=user.avatar?`<img src="${Utils.escapeHTML(user.avatar)}" class="w-full h-full object-cover">`:Utils.escapeHTML(user.fullName.charAt(0).toUpperCase()); const protectedPw=user.password?'<span class="text-green-600 text-xs font-medium">Protected</span>':'<span class="text-amber-600 text-xs font-medium">Not set</span>'; tr.innerHTML=`<td class="px-6 py-4"><div class="flex items-center space-x-3"><div class="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm overflow-hidden">${avatar}</div><div><div class="font-medium text-gray-900 dark:text-white">${Utils.escapeHTML(user.fullName)}</div><div class="text-xs text-gray-500">@${Utils.escapeHTML(user.username)}</div></div></div></td><td class="px-6 py-4"><span class="badge ${user.role==='admin'?'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200':'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'} capitalize">${Utils.escapeHTML(user.role)}</span></td><td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">${Utils.escapeHTML(user.jobTitle||'—')}</td><td class="px-6 py-4 text-xs"><div class="text-gray-700 dark:text-gray-300"><i class="fas fa-envelope mr-1 text-gray-400"></i>${Utils.escapeHTML(user.email||'—')}</div><div class="text-gray-700 dark:text-gray-300 mt-1"><i class="fas fa-phone mr-1 text-gray-400"></i>${Utils.escapeHTML(user.phone||'—')}</div></td><td class="px-6 py-4">${protectedPw}</td><td class="px-6 py-4"><span class="badge ${user.status==='active'?'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400':user.status==='suspended'?'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400':'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}">${Utils.escapeHTML(user.status)}</span></td><td class="px-6 py-4 text-sm text-gray-500">${user.lastLogin?new Date(user.lastLogin).toLocaleString():'—'}</td><td class="px-6 py-4 text-right">${user.username!=='admin'?`<button onclick="editUser(${Number(user.id)})" class="text-accent hover:opacity-70 text-sm font-medium mr-2"><i class="fas fa-edit"></i></button><button onclick="deleteUser(${Number(user.id)})" class="text-red-500 hover:text-red-700 text-sm font-medium"><i class="fas fa-trash"></i></button>`:'<span class="text-xs text-gray-400">System</span>'}</td>`; tbody.appendChild(tr); }); }
function toggleUserPassword(){ alert('Passwords are protected and cannot be displayed.'); }
function openUserModal(userId=null){ document.getElementById('userModal').classList.add('show'); document.getElementById('userForm').reset(); document.getElementById('editUserId').value=''; document.getElementById('userModalTitle').textContent='Add New User'; document.getElementById('passHint').textContent='(leave blank — user sets on first login)'; document.getElementById('uPassword').value=''; document.getElementById('uPassword').placeholder='Leave blank for new users'; document.getElementById('modalPwEye').className='fas fa-eye'; const cb=document.getElementById('userModuleCheckboxes'); cb.innerHTML=''; state.modules.forEach(m=>{ const label=document.createElement('label'); label.className='flex items-center space-x-2 p-2 bg-white dark:bg-gray-900 rounded-lg cursor-pointer'; const input=document.createElement('input'); input.type='checkbox'; input.value=m.id; input.className='user-module-cb rounded border-gray-300 text-accent focus:ring-accent'; const icon=document.createElement('i'); icon.className=`fas ${Utils.validIcon(m.icon)}`; icon.style.color=Utils.validColor(m.color); const span=document.createElement('span'); span.className='text-sm text-gray-700 dark:text-gray-300'; span.textContent=m.name; label.append(input,icon,span); cb.appendChild(label); }); if(userId){ const u=state.users.find(x=>x.id===userId); if(!u)return; document.getElementById('userModalTitle').textContent='Edit User'; document.getElementById('editUserId').value=u.id; document.getElementById('uUsername').value=u.username; document.getElementById('uFullName').value=u.fullName; document.getElementById('uJobTitle').value=u.jobTitle||''; document.getElementById('uEmail').value=u.email||''; document.getElementById('uPhone').value=u.phone||''; document.getElementById('uRole').value=u.role; document.getElementById('uStatus').value=u.status; document.getElementById('uPassword').value=''; document.getElementById('uPassword').placeholder='Enter only to reset password'; document.getElementById('passHint').textContent='(leave blank to keep current password)'; document.querySelectorAll('.user-module-cb').forEach(x=>x.checked=u.modules?.includes(x.value)); } }
function closeUserModal(){document.getElementById('userModal').classList.remove('show');}
function toggleModalPasswordVisibility(){const input=document.getElementById('uPassword'),eye=document.getElementById('modalPwEye');input.type=input.type==='password'?'text':'password';eye.classList.toggle('fa-eye');eye.classList.toggle('fa-eye-slash');}
function editUser(id){openUserModal(id);}
document.getElementById('userForm').addEventListener('submit',async e=>{ e.preventDefault(); const editId=document.getElementById('editUserId').value; const modules=Array.from(document.querySelectorAll('.user-module-cb:checked')).map(cb=>cb.value); const rawPassword=document.getElementById('uPassword').value; const username=document.getElementById('uUsername').value.trim(); if(state.users.some(u=>u.username.toLowerCase()===username.toLowerCase()&&String(u.id)!==String(editId))){return alert('Username already exists');} const base={username,fullName:document.getElementById('uFullName').value.trim(),jobTitle:document.getElementById('uJobTitle').value.trim(),email:document.getElementById('uEmail').value.trim(),phone:document.getElementById('uPhone').value.trim(),role:document.getElementById('uRole').value,status:document.getElementById('uStatus').value,modules}; if(editId){const idx=state.users.findIndex(u=>String(u.id)===String(editId));if(idx!==-1){state.users[idx]={...state.users[idx],...base};if(rawPassword)state.users[idx].password=await Utils.hashPassword(rawPassword);}}else{state.users.push({id:Date.now(),...base,password:rawPassword?await Utils.hashPassword(rawPassword):'',avatar:null,lastLogin:null,accentColor:null});} save();closeUserModal();loadUsers();refreshUI();});
function deleteUser(id){if(!confirm('Delete this user? This cannot be undone.'))return;state.users=state.users.filter(u=>u.id!==id);save();loadUsers();refreshUI();}

// ---------- Module administration ----------
function renderAdminModules(){const grid=document.getElementById('adminModulesGrid');grid.innerHTML='';state.modules.forEach(m=>{const card=document.createElement('div');card.className='stat-card bg-white dark:bg-gray-900 p-5';const assignedUsers=state.users.filter(u=>u.modules?.includes(m.id)).length;card.innerHTML=`<div class="flex items-start justify-between mb-3"><div class="w-12 h-12 rounded-xl flex items-center justify-center shadow-accent" style="background:${Utils.validColor(m.color)}"><i class="fas ${Utils.validIcon(m.icon)} text-white text-xl"></i></div><span class="badge ${m.status==='active'?'text-green-600 bg-green-50 dark:bg-green-900/20':m.status==='soon'?'text-amber-600 bg-amber-50 dark:bg-amber-900/20':'text-gray-500 bg-gray-100 dark:bg-gray-800'}">${m.status==='active'?'Active':m.status==='soon'?'Coming Soon':'Disabled'}</span></div><h4 class="font-bold text-gray-900 dark:text-white mb-1">${Utils.escapeHTML(m.name)}</h4><p class="text-sm text-gray-500 mb-3">${Utils.escapeHTML(m.desc)}</p><div class="flex items-center justify-between text-xs text-gray-500 mb-4"><span><i class="fas fa-users mr-1"></i>${assignedUsers} users</span><span class="font-mono">${Utils.escapeHTML(m.id)}</span></div><div class="flex space-x-2"><button onclick="editModule('${Utils.escapeHTML(m.id)}')" class="btn-secondary flex-1 text-xs"><i class="fas fa-edit mr-1"></i>Edit</button>${!['calendar','module-test'].includes(m.id)?`<button onclick="deleteModule('${Utils.escapeHTML(m.id)}')" class="btn-secondary flex-1 text-xs" style="color:#EF4444;"><i class="fas fa-trash mr-1"></i>Delete</button>`:''}</div>`;grid.appendChild(card);});}
function openModuleModal(moduleId=null){document.getElementById('moduleModal').classList.add('show');document.getElementById('moduleForm').reset();document.getElementById('editModuleId').value='';document.getElementById('moduleModalTitle').textContent='New Module';document.getElementById('mIcon').value='fa-cube';document.getElementById('mColor').value='#757575';if(moduleId){const m=state.modules.find(x=>x.id===moduleId);if(!m)return;document.getElementById('moduleModalTitle').textContent='Edit Module';document.getElementById('editModuleId').value=m.id;document.getElementById('mName').value=m.name;document.getElementById('mDesc').value=m.desc;document.getElementById('mIcon').value=m.icon;document.getElementById('mColor').value=m.color;document.getElementById('mStatus').value=m.status;}}
function closeModuleModal(){document.getElementById('moduleModal').classList.remove('show');}
function editModule(id){openModuleModal(id);}
document.getElementById('moduleForm').addEventListener('submit',e=>{e.preventDefault();const editId=document.getElementById('editModuleId').value,name=document.getElementById('mName').value.trim();if(!name)return;const id=editId||'module-'+Utils.slug(name);if(!id||id==='module-')return alert('Please use a valid module name');const moduleData={id,name,desc:document.getElementById('mDesc').value.trim(),icon:Utils.validIcon(document.getElementById('mIcon').value.trim()),color:Utils.validColor(document.getElementById('mColor').value),status:document.getElementById('mStatus').value,roles:['admin','user']};if(editId){const idx=state.modules.findIndex(m=>m.id===editId);if(idx!==-1)state.modules[idx]={...state.modules[idx],...moduleData};}else{if(state.modules.some(m=>m.id===id))return alert('Module ID already exists');state.modules.push(moduleData);['user','admin'].forEach(role=>{state.permissions[role] ||= {};state.permissions[role][id]={view:role==='admin',edit:role==='admin',delete:role==='admin'};});}ModuleRegistry.ensureView(moduleData);save();closeModuleModal();renderAdminModules();refreshUI();renderSidebar();});
function deleteModule(id){if(['calendar','module-test'].includes(id))return alert('System modules cannot be deleted');if(!confirm('Delete this module? Users will lose access.'))return;state.modules=state.modules.filter(m=>m.id!==id);state.users.forEach(u=>{u.modules=(u.modules||[]).filter(x=>x!==id);});Object.values(state.permissions).forEach(rolePerms=>{if(rolePerms)delete rolePerms[id];});document.getElementById(`view-${id}`)?.remove();save();renderAdminModules();refreshUI();renderSidebar();}

// ---------- Permissions / settings ----------
function renderPermissions(){const role=document.getElementById('permRoleSelect').value,list=document.getElementById('permissionsList');list.innerHTML='';state.permissions[role] ||= {};state.modules.forEach(m=>{const perm=state.permissions[role][m.id]||{view:false,edit:false,delete:false},row=document.createElement('div');row.className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl flex-wrap gap-3';row.innerHTML=`<div class="flex items-center space-x-4"><div class="w-11 h-11 rounded-xl flex items-center justify-center" style="background:${Utils.validColor(m.color)}20"><i class="fas ${Utils.validIcon(m.icon)}" style="color:${Utils.validColor(m.color)}"></i></div><div><p class="font-semibold text-gray-900 dark:text-white">${Utils.escapeHTML(m.name)}</p><p class="text-sm text-gray-500">${Utils.escapeHTML(m.desc)}</p></div></div><div class="flex items-center space-x-4"><label class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer"><input type="checkbox" ${perm.view?'checked':''} onchange="updatePerm('${role}','${Utils.escapeHTML(m.id)}','view',this.checked)" class="rounded border-gray-300 text-accent focus:ring-accent"><span>View</span></label><label class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer"><input type="checkbox" ${perm.edit?'checked':''} onchange="updatePerm('${role}','${Utils.escapeHTML(m.id)}','edit',this.checked)" class="rounded border-gray-300 text-accent focus:ring-accent"><span>Edit</span></label><label class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer"><input type="checkbox" ${perm.delete?'checked':''} onchange="updatePerm('${role}','${Utils.escapeHTML(m.id)}','delete',this.checked)" class="rounded border-gray-300 text-accent focus:ring-accent"><span>Delete</span></label></div>`;list.appendChild(row);});}
function updatePerm(role,moduleId,action,value){state.permissions[role] ||= {};state.permissions[role][moduleId] ||= {view:false,edit:false,delete:false};state.permissions[role][moduleId][action]=value;save();renderSidebar();}
function saveBranding(){state.settings.orgName=document.getElementById('sysOrgName').value.trim()||'TAAMEER Group';state.settings.tagline=document.getElementById('sysTagline').value.trim()||'Marketing Dashboard';save();document.getElementById('sysOrgDisplay').textContent=state.settings.orgName;document.getElementById('headerSubtitle').textContent=state.settings.tagline;alert('Branding updated!');}

// ---------- Startup ----------
async function boot(){
  updateClock(); setInterval(updateClock,1000); loadTheme(); Store.normalize();
  await loadFromCloud();
  Store.normalize(); loadSystemAccent(); ModuleRegistry.ensureAll(); checkAuth();
}
document.addEventListener('DOMContentLoaded', boot);
