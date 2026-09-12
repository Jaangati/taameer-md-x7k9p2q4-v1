// ---------- Requests view compatibility ----------
function ensureView(){
  const module = state.modules.find(m => m.id === 'requests') || {
    id:'requests', name:'Requests', desc:'Team requests, deadlines and accountability',
    icon:'fa-list-check', status:'active', roles:['admin','user']
  };
  ModuleRegistry.ensureView(module);
  return document.getElementById('view-requests');
}

function installRequestsNavigationHook(){
  try{
    if(typeof showView!=='function' || showView.__requestsForced) return;
    const original=showView;
    const wrapped=function(viewName){
      const result=original.apply(this,arguments);
      if(viewName==='requests'){
        setTimeout(async()=>{
          const target=document.getElementById('view-requests');
          try{
            if(!window.RequestsApp?.open) await loadRequestsModuleScript();
            if(!window.RequestsApp?.open) throw new Error('RequestsApp is not available');
            await window.RequestsApp.open();
          }catch(err){
            console.error('Forced Requests render failed',err);
            if(target) target.innerHTML=`<div class="h-full flex items-center justify-center p-8"><div class="max-w-lg rounded-2xl bg-white border border-red-200 shadow-sm p-6 text-center"><div class="text-red-600 font-bold">Requests could not load</div><div class="text-xs text-gray-500 mt-2">${Utils.escapeHTML(err?.message||'Unknown error')}</div></div></div>`;
          }
        },0);
      }
      return result;
    };
    wrapped.__requestsForced=true;
    window.showView=wrapped;
  }catch(err){console.error('Requests navigation hook failed',err);}
}

// ---------- Startup ----------
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
    script.src='js/requests.js?v=20260912-v10';
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
    script.src='js/requests-bridge.js?v=20260912-v3';
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
  installRequestsNavigationHook();
  const restored = await checkAuth();
  if (restored && window.RequestsApp?.open) {
    try { await window.RequestsApp.open(); } catch(err){ console.warn('Requests background init failed',err); }
  }
  if (!restored) {
    loadSystemAccent();
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
  }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
