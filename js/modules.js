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
