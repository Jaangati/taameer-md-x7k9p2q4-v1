// ---------- Backup & Recovery ----------
function ensureBackupsView() {
  if (document.getElementById('view-backups')) return;
  const anchor = document.getElementById('view-settings');
  const parent = anchor?.parentElement;
  if (!parent) return;
  const section = document.createElement('section');
  section.id = 'view-backups';
  section.className = 'view-section hidden overflow-y-auto p-6';
  section.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Backup & Recovery</h2>
          <p class="text-sm text-gray-500 mt-1">Protected snapshots of system settings and user profiles.</p>
        </div>
        <div class="flex gap-2">
          <button onclick="renderBackups()" class="btn-secondary"><i class="fas fa-rotate mr-2"></i>Refresh</button>
          <button onclick="createBackup()" class="btn-primary"><i class="fas fa-shield-halved mr-2"></i>Create Backup</button>
        </div>
      </div>
      <div class="mb-5 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/10 dark:border-amber-900/40 dark:text-amber-300 text-sm">
        Backups restore dashboard data and existing user profiles. Deleted Supabase Auth accounts are not recreated automatically.
      </div>
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
              <tr><th class="px-5 py-3">Backup</th><th class="px-5 py-3">Created</th><th class="px-5 py-3">By</th><th class="px-5 py-3 text-right">Action</th></tr>
            </thead>
            <tbody id="backupsBody" class="divide-y divide-gray-100 dark:divide-gray-800"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  parent.appendChild(section);
}

async function renderBackups() {
  if (state.currentUser?.role !== 'admin') return;
  ensureBackupsView();
  const tbody = document.getElementById('backupsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-sm text-gray-400">Loading backups…</td></tr>';
  const { data, error } = await supabaseClient
    .from('system_backups')
    .select('id,label,created_by,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-8 text-center text-sm text-red-500">${Utils.escapeHTML(error.message)}</td></tr>`;
    return;
  }
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-sm text-gray-400">No backups yet.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  for (const row of data) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/60';
    const creator = state.users?.find(u => String(u.id) === String(row.created_by));
    tr.innerHTML = `
      <td class="px-5 py-4"><div class="font-medium text-gray-900 dark:text-white">${Utils.escapeHTML(row.label)}</div><div class="text-xs text-gray-400 font-mono mt-1">#${row.id}</div></td>
      <td class="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">${new Date(row.created_at).toLocaleString()}</td>
      <td class="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">${Utils.escapeHTML(creator?.email || (row.created_by ? 'Admin' : 'System'))}</td>
      <td class="px-5 py-4 text-right"><button onclick="restoreBackup(${Number(row.id)})" class="btn-secondary text-xs"><i class="fas fa-rotate-left mr-1"></i>Restore</button></td>`;
    tbody.appendChild(tr);
  }
}

async function createBackup() {
  if (state.currentUser?.role !== 'admin') return;
  const label = prompt('Backup name:', `Manual backup — ${new Date().toLocaleString()}`);
  if (label === null) return;
  const { data, error } = await supabaseClient.rpc('create_system_backup', { p_label: label || 'Manual backup' });
  if (error) return alert(error.message || 'Could not create backup.');
  if (typeof recordActivity === 'function') await recordActivity('backup_created', 'system_backup', String(data), { label: label || 'Manual backup' });
  await renderBackups();
  alert('Backup created.');
}

async function restoreBackup(id) {
  if (state.currentUser?.role !== 'admin') return;
  const ok = confirm('Restore this backup? Current dashboard settings and existing profile data will be replaced.');
  if (!ok) return;
  const { error } = await supabaseClient.rpc('restore_system_backup', { p_backup_id: Number(id) });
  if (error) return alert(error.message || 'Could not restore backup.');
  alert('Backup restored. The dashboard will reload now.');
  location.reload();
}

const _renderSidebarBeforeBackups = renderSidebar;
renderSidebar = function() {
  _renderSidebarBeforeBackups();
  if (state.currentUser?.role !== 'admin') return;
  const nav = document.getElementById('sidebarNav');
  if (!nav || nav.querySelector('[data-backups-nav]')) return;
  const item = document.createElement('div');
  item.dataset.backupsNav = '1';
  item.className = `nav-item ${isActive('backups') ? 'active' : ''}`;
  item.onclick = () => showView('backups');
  item.innerHTML = '<span class="nav-icon"><i class="fas fa-database"></i></span><span class="nav-label sidebar-label">Backup & Recovery</span>';
  nav.appendChild(item);
};

const _showViewBeforeBackups = showView;
showView = function(viewName) {
  if (viewName !== 'backups') return _showViewBeforeBackups(viewName);
  if (state.currentUser?.role !== 'admin') return;
  ensureBackupsView();
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-backups')?.classList.remove('hidden');
  document.getElementById('headerTitle').textContent = 'Backup & Recovery';
  document.getElementById('headerSubtitle').textContent = 'System snapshots & restore';
  renderBackups();
  renderSidebar();
  closeUserDropdown();
};

ensureBackupsView();
