// ---------- Startup ----------
async function loadRequestsModuleScript(){
  if(typeof RequestsApp !== 'undefined') return;
  await new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-requests-module]');
    if(existing){ existing.addEventListener('load',resolve,{once:true}); existing.addEventListener('error',reject,{once:true}); return; }
    const script=document.createElement('script');
    script.src='js/requests.js?v=20260912-v1';
    script.dataset.requestsModule='true';
    script.onload=resolve; script.onerror=reject;
    document.head.appendChild(script);
  });
}

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
  try { await loadRequestsModuleScript(); } catch (err) { console.error('Requests module failed to load', err); }
  const restored = await checkAuth();
  if (restored && typeof RequestsApp !== 'undefined') RequestsApp.open().catch(err=>console.warn('Requests background init failed',err));
  if (!restored) {
    loadSystemAccent();
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
  }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
