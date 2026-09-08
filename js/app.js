// ---------- Startup ----------
function ensureTaameerFavicon(){
  let link=document.querySelector('link[rel="icon"]');
  if(!link){
    link=document.createElement('link');
    link.rel='icon';
    link.type='image/svg+xml';
    document.head.appendChild(link);
  }
  link.href='assets/favicon.svg?v=3';
}

async function boot(){
  ensureTaameerFavicon();
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
