// ---------- Activity Log ----------
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

function ensureActivityLogView() {
  if (document.getElementById('view-activity-log')) return;
  const anchor = document.getElementById('view-settings');
  const parent = anchor?.parentElement;
  if (!parent) return;
  const section = document.createElement('section');
  section.id = 'view-activity-log';
  section.className = 'view-section hidden overflow-y-auto p-6';
  section.innerHTML = `
    <div class="max-w-7xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Activity Log</h2>
          <p class="text-sm text-gray-500 mt-1">Secure record of administrative and system changes.</p>
        </div>
        <button onclick="renderActivityLog()" class="btn-secondary"><i class="fas fa-rotate mr-2"></i>Refresh</button>
      </div>
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
              <tr>
                <th class="px-5 py-3">Time</th>
                <th class="px-5 py-3">User</th>
                <th class="px-5 py-3">Action</th>
                <th class="px-5 py-3">Item</th>
                <th class="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody id="activityLogBody" class="divide-y divide-gray-100 dark:divide-gray-800"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  parent.appendChild(section);
}

function formatActivityAction(action = '') {
  return String(action).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function renderActivityLog() {
  if (state.currentUser?.role !== 'admin') return;
  ensureActivityLogView();
  const tbody = document.getElementById('activityLogBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-sm text-gray-400">Loading activity…</td></tr>';
  const { data, error } = await supabaseClient
    .from('activity_log')
    .select('id,actor_email,action,entity_type,entity_id,details,created_at')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-sm text-red-500">${Utils.escapeHTML(error.message)}</td></tr>`;
    return;
  }
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-sm text-gray-400">No activity recorded yet.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  for (const row of data) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/60';
    const details = row.details && Object.keys(row.details).length ? JSON.stringify(row.details) : '—';
    tr.innerHTML = `
      <td class="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">${new Date(row.created_at).toLocaleString()}</td>
      <td class="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">${Utils.escapeHTML(row.actor_email || 'System')}</td>
      <td class="px-5 py-4"><span class="badge bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">${Utils.escapeHTML(formatActivityAction(row.action))}</span></td>
      <td class="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">${Utils.escapeHTML(row.entity_type || '—')}${row.entity_id ? `<div class="text-xs text-gray-400 font-mono mt-1">${Utils.escapeHTML(row.entity_id)}</div>` : ''}</td>
      <td class="px-5 py-4 text-xs text-gray-500 max-w-sm"><div class="truncate" title="${Utils.escapeHTML(details)}">${Utils.escapeHTML(details)}</div></td>`;
    tbody.appendChild(tr);
  }
}

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
  if (viewName !== 'activity-log') return _showViewBeforeActivity(viewName);
  if (state.currentUser?.role !== 'admin') return;
  ensureActivityLogView();
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-activity-log')?.classList.remove('hidden');
  document.getElementById('headerTitle').textContent = 'Activity Log';
  document.getElementById('headerSubtitle').textContent = 'Security & change history';
  renderActivityLog();
  renderSidebar();
  closeUserDropdown();
};

// Log important in-app administrative changes.
if (typeof saveBranding === 'function') {
  const _saveBranding = saveBranding;
  saveBranding = function() {
    _saveBranding();
    recordActivity('branding_updated', 'settings', 'branding', { orgName: state.settings.orgName, tagline: state.settings.tagline });
  };
}
if (typeof updatePerm === 'function') {
  const _updatePerm = updatePerm;
  updatePerm = function(role, moduleId, action, value) {
    _updatePerm(role, moduleId, action, value);
    recordActivity('permission_updated', 'permission', `${role}:${moduleId}`, { role, moduleId, permission: action, value });
  };
}
if (typeof deleteModule === 'function') {
  const _deleteModule = deleteModule;
  deleteModule = function(id) {
    const before = state.modules.find(m => m.id === id);
    _deleteModule(id);
    if (before && !state.modules.find(m => m.id === id)) recordActivity('module_deleted', 'module', id, { name: before.name });
  };
}
if (typeof applySystemAccent === 'function') {
  const _applySystemAccent = applySystemAccent;
  applySystemAccent = function(color, name) {
    _applySystemAccent(color, name);
    if (state.currentUser?.role === 'admin') recordActivity('system_accent_updated', 'settings', 'accent', { color: Utils.validColor(color), name });
  };
}

ensureActivityLogView();
