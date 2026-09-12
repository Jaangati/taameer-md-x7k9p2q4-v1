// ---------- Startup ----------
// Compatibility initializer used by RequestsApp.open(). The Requests module called
// ensureView() as a global helper, but no such function existed in the dashboard.
// Keep this small adapter here so the module always gets a real root container.
window.ensureView = window.ensureView || function(){
  const module = state.modules?.find(m => m.id === 'requests') || {
    id: 'requests',
    name: 'Requests',
    desc: 'Team requests, deadlines and accountability',
    icon: 'fa-list-check',
    status: 'active',
    roles: ['admin','user']
  };
  const viewId = ModuleRegistry.ensureView(module);
  const view = document.getElementById(`view-${viewId}`);
  if (!view) throw new Error('Requests view container could not be created');
  return viewId;
};

async function loadRequestsModuleScript(){
  try {
    if (window.RequestsApp?.open) return;
    if (typeof RequestsApp !== 'undefined' && RequestsApp?.open) {
      window.RequestsApp = RequestsApp;
      return;
    }
  } catch (_) {}
  await new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-requests-module]');
    if(existing){
      if(existing.dataset.loaded==='true') return resolve();
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='js/requests.js?v=20260912-v6';
    script.dataset.requestsModule='true';
    script.onload=()=>{script.dataset.loaded='true';resolve();};
    script.onerror=reject;
    document.head.appendChild(script);
  });
  try { if(typeof RequestsApp !== 'undefined') window.RequestsApp=RequestsApp; } catch (_) {}
}

async function loadRequestsBridge(){
  if(window.openRequestsSafely) return;
  await new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-requests-bridge]');
    if(existing){
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='js/requests-bridge.js?v=20260912-v2';
    script.dataset.requestsBridge='true';
    script.onload=resolve;
    script.onerror=reject;
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
  try {
    await loadRequestsModuleScript();
    await loadRequestsBridge();
  } catch (err) {
    console.error('Requests runtime failed to load', err);
  }
  const restored = await checkAuth();
  if (restored && window.openRequestsSafely) window.openRequestsSafely().catch(err=>console.warn('Requests background init failed',err));
  if (!restored) {
    loadSystemAccent();
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
  }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
