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

document.addEventListener('DOMContentLoaded',()=>{
  const script=document.createElement('script');
  script.src='js/notifications-v2.js';
  script.onload=boot;
  script.onerror=boot;
  document.head.appendChild(script);
});
