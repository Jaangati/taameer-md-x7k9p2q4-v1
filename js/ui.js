// ---------- Dashboard / navigation ----------
function showDashboard() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('setPasswordView').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');
  ModuleRegistry.ensureAll();
  applyActiveAccent();
  refreshUI();
  prepareCalendarPlaceholder();
  resizeLoginBrandLogo();
  renderSidebar();
  showView('home');
}

function refreshUI() {
  const u = state.currentUser; if (!u) return;
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText('userName', u.fullName); setText('ddName', u.fullName); setText('welcomeName', u.fullName.split(' ')[0]);
  setText('userRole', u.role === 'admin' ? 'Administrator' : u.jobTitle || 'User'); setText('homeRoleLabel', u.role === 'admin' ? 'Administrator' : (u.jobTitle || 'Team Member')); setText('ddRole', u.role); setText('ddEmail', u.email || '—');
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

function resizeLoginBrandLogo() {
  const logo = document.querySelector('#loginView img[src="assets/taameer-logo-white.svg"]');
  if (!logo) return;
  logo.className = 'h-12 w-36 object-contain object-left flex-shrink-0';
}

function prepareCalendarPlaceholder() {
  const view = document.getElementById('view-calendar');
  if (!view || view.dataset.placeholderReady === 'true') return;
  view.className = 'view-section hidden fade-in h-full';
  view.innerHTML = `<div class="h-full flex items-center justify-center"><div class="text-center px-6"><div class="w-16 h-16 rounded-2xl bg-gray-600 text-white flex items-center justify-center mx-auto mb-4 shadow-sm"><i class="fas fa-calendar-alt text-2xl"></i></div><h2 class="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h2><p class="text-sm text-gray-500 mt-2">Coming soon.</p></div></div>`;
  view.dataset.placeholderReady = 'true';
  document.getElementById('view-module-test')?.remove();
}

function renderSidebar() {
  const nav = document.getElementById('sidebarNav'); const u = state.currentUser; if (!u) return;
  const isAdmin = u.role === 'admin';
  let html = `<div class="section-title sidebar-label">Main</div><div class="nav-item ${isActive('home') ? 'active' : ''}" onclick="showView('home')"><span class="nav-icon"><i class="fas fa-home"></i></span><span class="nav-label sidebar-label">Home</span></div>`;
  const userModules = state.modules.filter(m => u.modules?.includes(m.id) && m.status !== 'disabled');
  if (userModules.length) {
    html += `<div class="section-title sidebar-label mt-2">Modules</div>`;
    for (const m of userModules) {
      const viewId = ModuleRegistry.ensureView(m);
      const inactive = m.status !== 'active';
      html += `<div class="nav-item ${isActive(viewId) ? 'active' : ''} ${inactive ? 'opacity-60 cursor-default' : ''}" ${inactive ? '' : `onclick="showView('${Utils.escapeHTML(viewId)}')"`}><span class="nav-icon"><i class="fas ${Utils.validIcon(m.icon)} text-white"></i></span><span class="nav-label sidebar-label">${Utils.escapeHTML(m.name)}</span></div>`;
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

const VIEW_TITLES = { home: ['Home','TAAMEER Marketing Dashboard'], calendar: ['Calendar','My schedule & department activity'], thinkspace: ['Thinkspace','Visual brainstorming, diagrams and collaborative boards'], requests: ['Requests','Team requests, deadlines and accountability'], profile: ['My Profile','Your public profile'], account: ['Account Settings','Personal settings'], users: ['User Management','Admin controls'], 'modules-admin': ['Module Management','Create & assign modules'], permissions: ['Permissions','Role access matrix'], settings: ['System Settings','Full admin configuration'] };
function showView(viewName) {
  if (!state.currentUser) return;
  if (['users','permissions','settings','modules-admin'].includes(viewName) && state.currentUser.role !== 'admin') return;
  const module = getModuleByView(viewName);
  if (module && module.status !== 'active') return;
  if (module && !canAccessModule(module)) return;
  if (module) ModuleRegistry.ensureView(module);
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`view-${viewName}`); if (!target) return;
  target.classList.remove('hidden'); target.classList.add('fade-in');
  const titles = VIEW_TITLES[viewName] || (module ? [module.name, module.desc || 'Module'] : ['TAAMEER','']);
  document.getElementById('headerTitle').textContent = titles[0]; document.getElementById('headerSubtitle').textContent = titles[1];
  if (viewName === 'calendar' && typeof CalendarApp !== 'undefined' && CalendarApp?.open) CalendarApp.open();
  if (viewName === 'thinkspace' && typeof ThinkspaceApp !== 'undefined' && ThinkspaceApp?.open) ThinkspaceApp.open();
  if (viewName === 'vault' && typeof VaultApp !== 'undefined' && VaultApp?.open) VaultApp.open();
  if (viewName === 'requests' && typeof RequestsApp !== 'undefined' && RequestsApp?.open) RequestsApp.open();
  if (viewName === 'home') renderHomeModules(); if (viewName === 'users') loadUsers(); if (viewName === 'modules-admin') renderAdminModules(); if (viewName === 'permissions') renderPermissions();
  renderSidebar(); closeUserDropdown();
}

// ---------- Clock / dropdown / profile ----------
function updateClock() { const now = new Date(); const clock=document.getElementById('clock'); if(clock) clock.textContent=now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); const date=document.getElementById('date'); if(date) date.textContent=now.toLocaleDateString('en-US',{month:'short',day:'numeric'}); const full=document.getElementById('todayFullDate'); if(full) full.textContent=now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); const h=now.getHours(); const greeting=document.getElementById('greetingText'); if(greeting) greeting.textContent=h>=17?'Good evening':h>=12?'Good afternoon':'Good morning'; }
function toggleUserDropdown() { document.getElementById('userDropdown').classList.toggle('show'); }
function closeUserDropdown() { document.getElementById('userDropdown').classList.remove('show'); }
document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) closeUserDropdown(); });
function handleAvatarUpload(e) { const file = e.target.files[0]; if (!file) return; if (file.size > 2*1024*1024) return alert('Image too large (max 2MB)'); const reader = new FileReader(); reader.onload = async ev => { const avatar = ev.target.result; const { error } = await supabaseClient.from('profiles').update({ avatar }).eq('id', state.currentUser.id); if (error) return alert('Could not update profile image.'); state.currentUser.avatar = avatar; refreshUI(); }; reader.readAsDataURL(file); }
async function saveMyProfile() { const email = document.getElementById('myEmail').value.trim(); const phone = document.getElementById('myPhone').value.trim(); if (email && email !== state.currentUser.email) { const { error: authError } = await supabaseClient.auth.updateUser({ email }); if (authError) return alert(authError.message); } const { error } = await supabaseClient.from('profiles').update({ email, phone }).eq('id', state.currentUser.id); if (error) return alert('Could not update contact information.'); state.currentUser.email = email; state.currentUser.phone = phone; refreshUI(); alert(email ? 'Contact information updated. Email changes may require confirmation.' : 'Contact information updated!'); }
async function changePassword() { const np = document.getElementById('newPass').value; const cp = document.getElementById('confPass').value; if (np.length < 8) return alert('Password must be at least 8 characters'); if (np !== cp) return alert('Passwords do not match'); const { error } = await supabaseClient.auth.updateUser({ password: np }); if (error) return alert(error.message); ['curPass','newPass','confPass'].forEach(id => document.getElementById(id).value = ''); alert('Password updated securely.'); }

// ---------- Legacy calendar helpers retained until Calendar module build ----------
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function renderMonthTabs() {}
function renderDayStrip() {}
function renderCalendar() {}
function changeMonth() {}
function goToday() {}

// ---------- Home modules ----------
function renderHomeModules() {
  const grid=document.getElementById('homeModulesGrid'); if(!grid)return; grid.innerHTML='';
  const u=state.currentUser; const myModules=state.modules.filter(m=>u.modules?.includes(m.id));
  if(!myModules.length){grid.innerHTML='<div class="col-span-full p-7 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center text-sm text-gray-500">No modules yet.</div>';return;}
  myModules.forEach(m=>{
    const allowed=canAccessModule(m), card=document.createElement('button');
    const soon=false;
    card.className=`group text-left rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 transition-all ${allowed?'hover:-translate-y-0.5 hover:shadow-md cursor-pointer':'opacity-70 cursor-default'}`;
    card.innerHTML=`<div class="flex items-start justify-between gap-4"><div class="w-11 h-11 rounded-xl flex items-center justify-center bg-gray-600 text-white"><i class="fas ${Utils.validIcon(m.icon)}"></i></div><span class="text-[10px] font-semibold px-2.5 py-1 rounded-full ${soon?'bg-amber-50 text-amber-600 dark:bg-amber-900/20':allowed?'bg-green-50 text-green-600 dark:bg-green-900/20':'bg-gray-100 text-gray-500 dark:bg-gray-800'}">${soon?'COMING SOON':allowed?'ACTIVE':'LOCKED'}</span></div><div class="mt-4"><h4 class="font-bold text-gray-900 dark:text-white">${Utils.escapeHTML(m.name)}</h4><p class="text-xs text-gray-500 mt-1 line-clamp-2">${Utils.escapeHTML(m.desc||'')}</p></div><div class="mt-4 flex items-center justify-between text-xs"><span class="text-gray-400">${soon?'Coming soon':allowed?'Open module':'Unavailable'}</span><i class="fas fa-arrow-right ${allowed?'text-accent':'text-gray-300'} transition-transform group-hover:translate-x-1"></i></div>`;
    if(allowed)card.onclick=()=>showView(ModuleRegistry.ensureView(m)); grid.appendChild(card);
  });
}

resizeLoginBrandLogo();