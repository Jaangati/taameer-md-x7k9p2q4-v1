// ---------- Activity & Adoption Center ----------
let _presenceTimer = null;
let _presenceSessionId = null;
let _presenceStartedAt = null;
let _activitySelectedUser = 'all';
let _activityRange = '7d';

async function recordActivity(action, entityType = null, entityId = null, details = {}) {
  if (!supabaseClient || !state.currentUser) return;
  try {
    await supabaseClient.rpc('log_activity', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId == null ? null : String(entityId),
      p_details: details || {}
    });
  } catch (error) {
    console.warn('Activity log failed', error);
  }
}

function activityEsc(v) { return Utils.escapeHTML(String(v ?? '')); }
function formatActivityAction(action = '') { return String(action).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function formatDuration(seconds = 0) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return '<1m';
}
function timeAgo(iso) {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'Just now';
  const m = Math.floor(ms / 60000); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function isOnlineSession(s) { return !!s?.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < 150000; }
function rangeStart() {
  const d = new Date();
  if (_activityRange === 'today') { d.setHours(0,0,0,0); return d; }
  if (_activityRange === '7d') { d.setDate(d.getDate()-7); return d; }
  if (_activityRange === '30d') { d.setDate(d.getDate()-30); return d; }
  return null;
}
function currentViewName() {
  const visible = [...document.querySelectorAll('.view-section')].find(el => !el.classList.contains('hidden'));
  return visible?.id?.replace(/^view-/, '') || 'dashboard';
}

async function touchPresence(viewName = currentViewName()) {
  if (!supabaseClient || !state.currentUser?.id) return;
  try {
    const now = new Date();
    if (!_presenceStartedAt) {
      const storedStart = sessionStorage.getItem('taameer_presence_started');
      _presenceStartedAt = storedStart ? new Date(storedStart) : now;
      sessionStorage.setItem('taameer_presence_started', _presenceStartedAt.toISOString());
    }
    const duration = Math.max(0, Math.floor((now.getTime() - _presenceStartedAt.getTime()) / 1000));
    if (!_presenceSessionId) _presenceSessionId = sessionStorage.getItem('taameer_presence_session');

    if (_presenceSessionId) {
      const { data, error } = await supabaseClient.from('dashboard_sessions')
        .update({ last_seen_at: now.toISOString(), current_view: viewName, duration_seconds: duration, ended_at: null })
        .eq('id', _presenceSessionId).eq('user_id', state.currentUser.id).select('id');
      if (!error && data?.length) return;
      _presenceSessionId = null;
      sessionStorage.removeItem('taameer_presence_session');
    }

    const { data, error } = await supabaseClient.from('dashboard_sessions').insert({
      user_id: state.currentUser.id,
      started_at: _presenceStartedAt.toISOString(),
      last_seen_at: now.toISOString(),
      current_view: viewName,
      user_agent: navigator.userAgent,
      duration_seconds: duration
    }).select('id').single();
    if (!error && data?.id) {
      _presenceSessionId = data.id;
      sessionStorage.setItem('taameer_presence_session', data.id);
    }
  } catch (e) { console.warn('Presence update failed', e); }
}

async function endPresence() {
  if (!_presenceSessionId || !supabaseClient || !state.currentUser?.id) return;
  try {
    const now = new Date();
    const duration = _presenceStartedAt ? Math.max(0, Math.floor((now - _presenceStartedAt) / 1000)) : 0;
    await supabaseClient.from('dashboard_sessions').update({ last_seen_at: now.toISOString(), ended_at: now.toISOString(), duration_seconds: duration }).eq('id', _presenceSessionId).eq('user_id', state.currentUser.id);
  } catch (_) {}
}

function startPresenceTracking() {
  if (!state.currentUser?.id) return;
  touchPresence();
  clearInterval(_presenceTimer);
  _presenceTimer = setInterval(() => touchPresence(), 60000);
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') touchPresence(); else touchPresence(); });
window.addEventListener('pagehide', () => { touchPresence(); });

function ensureActivityLogView() {
  if (document.getElementById('view-activity-log')) return;
  const anchor = document.getElementById('view-settings');
  const parent = anchor?.parentElement;
  if (!parent) return;
  const section = document.createElement('section');
  section.id = 'view-activity-log';
  section.className = 'view-section hidden overflow-y-auto p-6';
  section.innerHTML = `<div id="activityCenterRoot" class="max-w-7xl mx-auto"></div>`;
  parent.appendChild(section);

  if (!document.getElementById('activityCenterStyles')) {
    const st = document.createElement('style');
    st.id = 'activityCenterStyles';
    st.textContent = `
      .ac-hero{background:linear-gradient(110deg,#030712 0%,#111827 62%,color-mix(in srgb,var(--accent) 64%,#111827));color:white;border-radius:26px;padding:24px 26px;display:flex;justify-content:space-between;gap:18px;align-items:center;box-shadow:0 18px 50px rgba(15,23,42,.12)}
      .ac-hero h2{font-size:28px;font-weight:800;line-height:1.1}.ac-hero p{font-size:12px;color:#a8b2c1;margin-top:7px}.ac-live{display:flex;gap:8px;flex-wrap:wrap}.ac-live-chip{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.13);border-radius:14px;padding:10px 13px;min-width:105px}.ac-live-chip b{font-size:20px;display:block}.ac-live-chip span{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1}
      .ac-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 12px}.ac-range{display:flex;gap:5px;background:#f1f5f9;padding:4px;border-radius:12px}.dark .ac-range{background:#111827}.ac-range button{border:0;background:transparent;padding:7px 11px;border-radius:9px;font-size:11px;font-weight:700;color:#64748b}.ac-range button.active{background:white;color:#111827;box-shadow:0 1px 4px rgba(15,23,42,.08)}.dark .ac-range button.active{background:#1f2937;color:white}
      .ac-users{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:16px}.ac-user{border:1px solid #e5e7eb;background:white;border-radius:18px;padding:14px;cursor:pointer;text-align:left;transition:.15s}.dark .ac-user{background:#0b1018;border-color:#202938}.ac-user:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(15,23,42,.06)}.ac-user.active{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 14%,transparent)}.ac-user-top{display:flex;align-items:center;gap:10px}.ac-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#111827;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}.ac-dot{width:8px;height:8px;border-radius:50%;background:#94a3b8;margin-left:auto}.ac-dot.online{background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.12)}.ac-name{font-size:12px;font-weight:800}.ac-role{font-size:10px;color:#94a3b8;margin-top:2px}.ac-metrics{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.ac-metric{background:#f8fafc;border-radius:11px;padding:8px}.dark .ac-metric{background:#111827}.ac-metric b{font-size:13px}.ac-metric span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-top:2px}
      .ac-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:14px}.ac-card{background:white;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden}.dark .ac-card{background:#0b1018;border-color:#202938}.ac-card-head{padding:14px 16px;border-bottom:1px solid #eef0f3;display:flex;justify-content:space-between;align-items:center;gap:10px}.dark .ac-card-head{border-color:#1e2633}.ac-card-head h3{font-size:13px;font-weight:800}.ac-table-wrap{overflow:auto;max-height:540px}.ac-table{width:100%;border-collapse:collapse}.ac-table th{position:sticky;top:0;background:#f8fafc;padding:10px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;z-index:1}.dark .ac-table th{background:#111827}.ac-table td{padding:11px 12px;border-top:1px solid #f1f5f9;font-size:11px;vertical-align:top}.dark .ac-table td{border-color:#1e2633}.ac-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#f1f5f9;font-size:9px;font-weight:700;color:#475569}.dark .ac-badge{background:#182131;color:#cbd5e1}.ac-session{padding:12px 14px;border-bottom:1px solid #eef0f3}.dark .ac-session{border-color:#1e2633}.ac-session:last-child{border:0}.ac-session-top{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:700}.ac-session-sub{font-size:9px;color:#94a3b8;margin-top:4px}.ac-online{color:#16a34a}.ac-empty{padding:32px;text-align:center;color:#94a3b8;font-size:11px}
      @media(max-width:900px){.ac-grid{grid-template-columns:1fr}.ac-hero{align-items:flex-start;flex-direction:column}.ac-users{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.ac-users{grid-template-columns:1fr}.ac-toolbar{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(st);
  }
}

async function renderActivityLog() {
  if (state.currentUser?.role !== 'admin') return;
  ensureActivityLogView();
  const root = document.getElementById('activityCenterRoot');
  if (!root) return;
  root.innerHTML = '<div class="ac-empty">Loading dashboard usage…</div>';

  const start = rangeStart();
  let sessionsQ = supabaseClient.from('dashboard_sessions').select('id,user_id,started_at,last_seen_at,ended_at,current_view,duration_seconds').order('last_seen_at',{ascending:false}).limit(1500);
  let activityQ = supabaseClient.from('activity_log').select('id,actor_email,action,entity_type,entity_id,details,created_at').order('created_at',{ascending:false}).limit(750);
  if (start) { sessionsQ = sessionsQ.gte('started_at', start.toISOString()); activityQ = activityQ.gte('created_at', start.toISOString()); }
  const [profilesRes,sessionsRes,activityRes] = await Promise.all([
    supabaseClient.from('profiles').select('id,full_name,email,job_title,avatar,status').order('full_name'),
    sessionsQ,
    activityQ
  ]);
  if (profilesRes.error || sessionsRes.error || activityRes.error) {
    root.innerHTML = `<div class="ac-empty text-red-500">${activityEsc(profilesRes.error?.message || sessionsRes.error?.message || activityRes.error?.message)}</div>`;
    return;
  }

  const profiles = profilesRes.data || [], sessions = sessionsRes.data || [], activities = activityRes.data || [];
  const byEmail = new Map(profiles.map(p => [String(p.email||'').toLowerCase(), p]));
  const stats = profiles.map(p => {
    const ss = sessions.filter(s => String(s.user_id) === String(p.id));
    const online = ss.some(isOnlineSession);
    const last = ss.reduce((best,s)=>!best||new Date(s.last_seen_at)>new Date(best)?s.last_seen_at:best,null);
    const total = ss.reduce((n,s)=>n+(Number(s.duration_seconds)||0),0);
    const acts = activities.filter(a=>String(a.actor_email||'').toLowerCase()===String(p.email||'').toLowerCase());
    return { p, ss, online, last, total, acts, avg:ss.length?Math.round(total/ss.length):0 };
  });
  const onlineCount = stats.filter(x=>x.online).length;
  const activeCount = stats.filter(x=>x.ss.length).length;
  const totalHours = stats.reduce((n,x)=>n+x.total,0);
  const selected = _activitySelectedUser === 'all' ? null : stats.find(x=>String(x.p.id)===String(_activitySelectedUser));
  const visibleActivities = selected ? selected.acts : activities;
  const visibleSessions = selected ? selected.ss : sessions;

  root.innerHTML = `
    <section class="ac-hero">
      <div><div class="text-[10px] tracking-[.22em] uppercase text-slate-400 font-bold mb-2">TAAMEER SYSTEM ADOPTION</div><h2>Activity & Usage Center</h2><p>See who is using the dashboard, when they were active and how consistently the system is being adopted.</p></div>
      <div class="ac-live"><div class="ac-live-chip"><b class="text-green-400">${onlineCount}</b><span>Online now</span></div><div class="ac-live-chip"><b>${activeCount}/${profiles.length}</b><span>Active users</span></div><div class="ac-live-chip"><b>${formatDuration(totalHours)}</b><span>Tracked time</span></div></div>
    </section>
    <div class="ac-toolbar"><div><div class="text-sm font-bold text-gray-900 dark:text-white">Team adoption</div><div class="text-[10px] text-gray-400 mt-1">Presence tracking starts from this upgrade onward.</div></div><div class="flex gap-2 items-center"><div class="ac-range">${[['today','Today'],['7d','7 days'],['30d','30 days'],['all','All']].map(x=>`<button class="${_activityRange===x[0]?'active':''}" onclick="setActivityRange('${x[0]}')">${x[1]}</button>`).join('')}</div><button onclick="renderActivityLog()" class="btn-secondary"><i class="fas fa-rotate mr-2"></i>Refresh</button></div></div>
    <div class="ac-users">
      <button class="ac-user ${_activitySelectedUser==='all'?'active':''}" onclick="selectActivityUser('all')"><div class="ac-user-top"><div class="ac-avatar"><i class="fas fa-users"></i></div><div><div class="ac-name">Whole team</div><div class="ac-role">Department overview</div></div><span class="ac-dot ${onlineCount?'online':''}"></span></div><div class="ac-metrics"><div class="ac-metric"><b>${sessions.length}</b><span>Sessions</span></div><div class="ac-metric"><b>${activities.length}</b><span>Actions</span></div></div></button>
      ${stats.map(x=>`<button class="ac-user ${String(_activitySelectedUser)===String(x.p.id)?'active':''}" onclick="selectActivityUser('${activityEsc(x.p.id)}')"><div class="ac-user-top">${x.p.avatar?`<img class="ac-avatar" src="${activityEsc(x.p.avatar)}" alt="">`:`<div class="ac-avatar">${activityEsc((x.p.full_name||'?').split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase())}</div>`}<div class="min-w-0"><div class="ac-name truncate">${activityEsc(x.p.full_name||x.p.email)}</div><div class="ac-role truncate">${activityEsc(x.online?'Online now':`Last active ${timeAgo(x.last)}`)}</div></div><span class="ac-dot ${x.online?'online':''}"></span></div><div class="ac-metrics"><div class="ac-metric"><b>${formatDuration(x.total)}</b><span>Total time</span></div><div class="ac-metric"><b>${x.ss.length}</b><span>Sessions</span></div></div></button>`).join('')}
    </div>
    <div class="ac-grid">
      <section class="ac-card"><div class="ac-card-head"><h3>${selected?activityEsc(selected.p.full_name):'Full activity stream'}</h3><span class="text-[10px] text-gray-400">${visibleActivities.length} recorded actions</span></div><div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Item</th></tr></thead><tbody>${visibleActivities.length?visibleActivities.map(row=>`<tr><td class="whitespace-nowrap">${activityEsc(new Date(row.created_at).toLocaleString())}</td><td>${activityEsc(row.actor_email||'System')}</td><td><span class="ac-badge">${activityEsc(formatActivityAction(row.action))}</span></td><td>${activityEsc(row.entity_type||'—')}${row.entity_id?`<div class="text-[9px] text-gray-400 mt-1 truncate max-w-[180px]">${activityEsc(row.entity_id)}</div>`:''}</td></tr>`).join(''):`<tr><td colspan="4"><div class="ac-empty">No activity in this period.</div></td></tr>`}</tbody></table></div></section>
      <section class="ac-card"><div class="ac-card-head"><h3>Sessions & presence</h3><span class="text-[10px] text-gray-400">${visibleSessions.length} sessions</span></div><div class="max-h-[540px] overflow-auto">${visibleSessions.length?visibleSessions.map(s=>{const p=profiles.find(p=>String(p.id)===String(s.user_id));return `<div class="ac-session"><div class="ac-session-top"><span>${activityEsc(p?.full_name||p?.email||'User')}</span><span class="${isOnlineSession(s)?'ac-online':''}">${isOnlineSession(s)?'● Online':formatDuration(s.duration_seconds)}</span></div><div class="ac-session-sub">Started ${activityEsc(new Date(s.started_at).toLocaleString())} · Last seen ${activityEsc(timeAgo(s.last_seen_at))}${s.current_view?` · ${activityEsc(formatActivityAction(s.current_view))}`:''}</div></div>`}).join(''):`<div class="ac-empty">No tracked sessions yet.</div>`}</div></section>
    </div>`;
}

function setActivityRange(range) { _activityRange = range; renderActivityLog(); }
function selectActivityUser(id) { _activitySelectedUser = id; renderActivityLog(); }

// Add Activity Log to the existing admin navigation without redesigning the sidebar.
const _renderSidebarBeforeActivity = renderSidebar;
renderSidebar = function() {
  _renderSidebarBeforeActivity();
  if (state.currentUser?.role !== 'admin') return;
  const nav = document.getElementById('sidebarNav');
  if (!nav || nav.querySelector('[data-activity-log-nav]')) return;
  const item = document.createElement('div');
  item.dataset.activityLogNav = '1';
  item.className = `nav-item ${isActive('activity-log') ? 'active' : ''}`;
  item.onclick = () => showView('activity-log');
  item.innerHTML = '<span class="nav-icon"><i class="fas fa-clock-rotate-left"></i></span><span class="nav-label sidebar-label">Activity Log</span>';
  nav.appendChild(item);
};

const _showViewBeforeActivity = showView;
showView = function(viewName) {
  if (viewName !== 'activity-log') {
    const result = _showViewBeforeActivity(viewName);
    touchPresence(viewName);
    return result;
  }
  if (state.currentUser?.role !== 'admin') return;
  ensureActivityLogView();
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-activity-log')?.classList.remove('hidden');
  document.getElementById('headerTitle').textContent = 'Activity Log';
  document.getElementById('headerSubtitle').textContent = 'Live usage, adoption & system history';
  touchPresence('activity-log');
  renderActivityLog();
  renderSidebar();
  closeUserDropdown();
};

const _showDashboardBeforePresence = showDashboard;
showDashboard = function() {
  const result = _showDashboardBeforePresence();
  setTimeout(startPresenceTracking, 350);
  return result;
};

if (typeof logout === 'function') {
  const _logoutBeforePresence = logout;
  logout = async function() { await endPresence(); clearInterval(_presenceTimer); sessionStorage.removeItem('taameer_presence_session'); sessionStorage.removeItem('taameer_presence_started'); return _logoutBeforePresence(); };
}

// Log important in-app administrative changes.
if (typeof saveBranding === 'function') {
  const _saveBranding = saveBranding;
  saveBranding = function() { _saveBranding(); recordActivity('branding_updated', 'settings', 'branding', { orgName: state.settings.orgName, tagline: state.settings.tagline }); };
}
if (typeof updatePerm === 'function') {
  const _updatePerm = updatePerm;
  updatePerm = function(role, moduleId, action, value) { _updatePerm(role, moduleId, action, value); recordActivity('permission_updated', 'permission', `${role}:${moduleId}`, { role, moduleId, permission: action, value }); };
}
if (typeof deleteModule === 'function') {
  const _deleteModule = deleteModule;
  deleteModule = function(id) { const before = state.modules.find(m => m.id === id); _deleteModule(id); if (before && !state.modules.find(m => m.id === id)) recordActivity('module_deleted', 'module', id, { name: before.name }); };
}
if (typeof applySystemAccent === 'function') {
  const _applySystemAccent = applySystemAccent;
  applySystemAccent = function(color, name) { _applySystemAccent(color, name); if (state.currentUser?.role === 'admin') recordActivity('system_accent_updated', 'settings', 'accent', { color: Utils.validColor(color), name }); };
}

ensureActivityLogView();
