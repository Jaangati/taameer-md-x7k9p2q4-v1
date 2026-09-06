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

function loadScript(src){
  return new Promise(resolve=>{
    const script=document.createElement('script');
    script.src=src;
    script.onload=resolve;
    script.onerror=resolve;
    document.head.appendChild(script);
  });
}

document.addEventListener('DOMContentLoaded',async()=>{
  await loadScript('js/notifications-v2.js?v=4');
  await loadScript('js/notifications-runtime-v4.js?v=4');
  boot();
});
