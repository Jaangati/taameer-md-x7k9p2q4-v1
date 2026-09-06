// ---------- Startup ----------
async function boot(){
  updateClock(); setInterval(updateClock,1000); loadTheme(); Store.normalize();
  await loadFromCloud();
  Store.normalize(); loadSystemAccent(); ModuleRegistry.ensureAll(); checkAuth();
}
document.addEventListener('DOMContentLoaded', boot);
