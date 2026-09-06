// ---------- Startup ----------
async function boot(){
  updateClock();
  setInterval(updateClock,1000);
  loadTheme();
  Store.normalize();
  const restored = await checkAuth();
  if (!restored) {
    loadSystemAccent();
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
  }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
