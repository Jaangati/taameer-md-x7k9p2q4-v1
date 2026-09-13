// TAAMEER Control Center v5 — Live / New / Maintenance / Hidden
(() => {
  const esc=v=>Utils.escapeHTML(String(v??''));
  const isAdmin=()=>state.currentUser?.role==='admin';
  const stateOf=m=>{
    const s=m?.controlStatus || (m?.status==='disabled'?'hidden':m?.status==='soon'?'maintenance':'live');
    return s==='testing'?'new':s;
  };
  const visitKey=m=>`taameer_new_module_visits:${state.currentUser?.id||'anon'}:${m.id}`;
  const visitCount=m=>Math.max(0,Number(localStorage.getItem(visitKey(m)))||0);
  const needsNewBadge=m=>stateOf(m)==='new'&&visitCount(m)<3;

  function ensureStyles(){
    if(document.getElementById('cc5Styles'))return;
    const s=document.createElement('style');s.id='cc5Styles';s.textContent=`
      .cc5-state-badge{margin-left:auto;padding:3px 7px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.06em;line-height:1.1;white-space:nowrap}
      .cc5-state-badge.new{background:#dcfce7;color:#15803d}.cc5-state-badge.maintenance{background:#ffedd5;color:#c2410c}.cc5-state-badge.hidden{background:#e5e7eb;color:#64748b}
      .cc5-maintenance-view{position:relative!important;overflow:hidden!important;min-height:100%!important}
      .cc5-maintenance-view>:not(.cc5-maintenance-overlay){filter:blur(8px)!important;pointer-events:none!important;user-select:none!important;opacity:.55!important}
      .cc5-maintenance-overlay{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(248,250,252,.5);backdrop-filter:blur(2px)}
      .dark .cc5-maintenance-overlay{background:rgba(3,7,18,.52)}
      .cc5-maintenance-box{width:min(460px,92%);background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:28px;text-align:center;box-shadow:0 24px 70px rgba(15,23,42,.18)}
      .dark .cc5-maintenance-box{background:#0b1018;border-color:#293244;color:#fff}
      .cc5-maintenance-icon{width:56px;height:56px;border-radius:17px;background:#fff7ed;color:#c2410c;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:20px}
      .cc-status.new{background:#dcfce7!important;color:#15803d!important}
    `;document.head.appendChild(s);
  }

  function normalizeLegacy(){
    let changed=false;
    (state.modules||[]).forEach(m=>{if(m.controlStatus==='testing'){m.controlStatus='new';m.status='active';changed=true;}});
    return changed;
  }

  window.canAccessModule=function(m){
    if(!m||!state.currentUser)return false;
    if(isAdmin())return true;
    if(!(state.currentUser.modules||[]).includes(m.id))return false;
    const st=stateOf(m);
    if(st==='hidden'||st==='maintenance')return false;
    return state.permissions?.user?.[m.id]?.view!==false;
  };

  window.setModuleControlStatus=async function(id,st){
    const m=state.modules.find(x=>x.id===id);if(!m)return;
    if(st==='testing')st='new';
    if(!['live','new','maintenance','hidden'].includes(st))st='live';
    m.controlStatus=st;
    m.status=st==='hidden'?'disabled':st==='maintenance'?'soon':'active';
    delete m.testers;
    if(st==='live') localStorage.removeItem(visitKey(m));
    if(st==='new') localStorage.setItem(visitKey(m),'0');
    if(st==='maintenance'&&!m.maintenanceMessage)m.maintenanceMessage='This module is currently under maintenance. We will be back soon.';
    try{Store.saveLocal?.();await Cloud.syncNow?.();}catch(e){console.error('Module state sync failed',e);}
    try{await renderAdminModules?.();}catch(_){}
    try{renderSidebar?.();}catch(_){}
    try{if(!document.getElementById('view-home')?.classList.contains('hidden'))await renderHomeModules?.();}catch(_){}
  };

  const baseSidebar=window.renderSidebar;
  window.renderSidebar=function(){
    ensureStyles();normalizeLegacy();
    const restore=[];
    if(isAdmin()){
      (state.modules||[]).forEach(m=>{if(m.status!=='active'){restore.push([m,m.status]);m.status='active';}});
    }else{
      (state.modules||[]).forEach(m=>{if(stateOf(m)==='maintenance'){restore.push([m,m.status]);m.status='active';}});
    }
    try{baseSidebar?.();}finally{restore.forEach(([m,s])=>m.status=s);}
    const nav=document.getElementById('sidebarNav');if(!nav||!state.currentUser)return;
    [...nav.querySelectorAll('.nav-item')].filter(x=>x.textContent.trim()==='Permissions').forEach(x=>x.remove());

    // Admin must always see every module, even when hidden.
    if(isAdmin()){
      const adminTitle=[...nav.querySelectorAll('.section-title')].find(x=>x.textContent.trim()==='Administration');
      state.modules.forEach(m=>{
        const exists=[...nav.querySelectorAll('.nav-item')].some(x=>x.querySelector('.nav-label')?.textContent.trim()===m.name);
        if(exists)return;
        const viewId=ModuleRegistry.ensureView(m);const el=document.createElement('div');el.className='nav-item';el.setAttribute('onclick',`showView('${esc(viewId)}')`);el.innerHTML=`<span class="nav-icon"><i class="fas ${Utils.validIcon(m.icon)} text-white"></i></span><span class="nav-label sidebar-label">${esc(m.name)}</span>`;
        if(adminTitle)nav.insertBefore(el,adminTitle);else nav.appendChild(el);
      });
    }

    const items=[...nav.querySelectorAll('.nav-item')];
    state.modules.forEach(m=>{
      const item=items.find(x=>x.querySelector('.nav-label')?.textContent.trim()===m.name);if(!item)return;
      item.querySelectorAll('.cc3-nav-tag,.cc4-state-badge,.cc5-state-badge').forEach(x=>x.remove());
      const st=stateOf(m);
      if(!isAdmin()){
        if(st==='hidden'){item.remove();return;}
        if(st==='maintenance'){
          item.classList.add('opacity-80');
          item.onclick=e=>{e.preventDefault();e.stopPropagation();showMaintenanceView(m.id);};
          item.setAttribute('onclick',`showMaintenanceView('${esc(m.id)}')`);
        }
      }
      let badge='';
      if(st==='maintenance')badge='MAINTENANCE';
      else if(st==='hidden'&&isAdmin())badge='HIDDEN';
      else if(needsNewBadge(m))badge='NEW';
      if(badge){const b=document.createElement('span');b.className=`cc5-state-badge sidebar-label ${st}`;b.textContent=badge;item.appendChild(b);}
    });
  };

  window.showMaintenanceView=function(id){
    const m=state.modules.find(x=>x.id===id);if(!m||isAdmin())return;
    const viewId=ModuleRegistry.ensureView(m);
    document.querySelectorAll('.view-section').forEach(el=>el.classList.add('hidden'));
    const target=document.getElementById(`view-${viewId}`);if(!target)return;
    target.classList.remove('hidden');target.classList.add('cc5-maintenance-view','fade-in');
    target.querySelector('.cc5-maintenance-overlay')?.remove();
    if(!target.children.length){const ph=document.createElement('div');ph.className='p-8 space-y-4';ph.innerHTML='<div class="h-24 rounded-3xl bg-gray-200 dark:bg-gray-800"></div><div class="grid grid-cols-3 gap-4"><div class="h-40 rounded-2xl bg-gray-200 dark:bg-gray-800"></div><div class="h-40 rounded-2xl bg-gray-200 dark:bg-gray-800"></div><div class="h-40 rounded-2xl bg-gray-200 dark:bg-gray-800"></div></div>';target.appendChild(ph);}
    const ov=document.createElement('div');ov.className='cc5-maintenance-overlay';ov.innerHTML=`<div class="cc5-maintenance-box"><div class="cc5-maintenance-icon"><i class="fas fa-screwdriver-wrench"></i></div><h3 class="text-xl font-extrabold">${esc(m.name)} is under maintenance</h3><p class="text-sm text-gray-500 mt-2">${esc(m.maintenanceMessage||'We are updating this module. It will be back soon.')}</p><div class="mt-5 text-xs font-bold text-orange-600"><i class="fas fa-lock mr-1"></i>Access temporarily paused</div></div>`;target.appendChild(ov);
    document.getElementById('headerTitle').textContent=m.name;document.getElementById('headerSubtitle').textContent='Temporarily under maintenance';
    renderSidebar?.();closeUserDropdown?.();
  };

  const baseShowView=window.showView;
  window.showView=function(name){
    const m=state.modules?.find(x=>x.id===name||x.viewId===name);
    if(m){
      const st=stateOf(m);
      if(!isAdmin()){
        if(!(state.currentUser.modules||[]).includes(m.id)||st==='hidden')return;
        if(st==='maintenance')return showMaintenanceView(m.id);
      }
      const target=document.getElementById(`view-${ModuleRegistry.ensureView(m)}`);if(target){target.classList.remove('cc5-maintenance-view');target.querySelector('.cc5-maintenance-overlay')?.remove();}
      let old=null;
      if(isAdmin()&&m.status!=='active'){old=m.status;m.status='active';}
      let out;try{out=baseShowView?.(name);}finally{if(old!==null)m.status=old;}
      if(st==='new'&&needsNewBadge(m)){
        const n=Math.min(3,visitCount(m)+1);localStorage.setItem(visitKey(m),String(n));if(n>=3)setTimeout(()=>renderSidebar?.(),50);
      }
      return out;
    }
    return baseShowView?.(name);
  };

  function patchAdminLabels(root=document){
    root.querySelectorAll('.cc-status.testing').forEach(x=>{x.classList.remove('testing');x.classList.add('new');x.textContent='NEW';});
    root.querySelectorAll('.cc-stat .l').forEach(x=>{if(x.textContent.trim()==='Testing')x.textContent='New';});
    root.querySelectorAll('#ccOverlay button').forEach(b=>{
      if((b.textContent||'').trim().toLowerCase()==='testing'){
        b.textContent='New';b.classList.remove('testing');b.classList.add('new');
        const mid=document.querySelector('#ccOverlay .cc-drawer-head h3')?.textContent?.trim();const m=state.modules.find(x=>x.name===mid);if(m)b.onclick=()=>{setModuleControlStatus(m.id,'new');openModuleControl(m.id,'overview');};
      }
    });
  }

  const baseRenderAdmin=window.renderAdminModules;
  if(baseRenderAdmin)window.renderAdminModules=async function(){
    const changed=[];state.modules.forEach(m=>{if(stateOf(m)==='new'){changed.push(m);m.controlStatus='testing';}});
    try{await baseRenderAdmin();}finally{changed.forEach(m=>m.controlStatus='new');}
    patchAdminLabels(document);
  };

  const baseOpenControl=window.openModuleControl;
  if(baseOpenControl)window.openModuleControl=async function(id,tab='overview'){
    const m=state.modules.find(x=>x.id===id);const wasNew=m&&stateOf(m)==='new';if(wasNew)m.controlStatus='testing';
    try{await baseOpenControl(id,tab);}finally{if(wasNew)m.controlStatus='new';}
    patchAdminLabels(document);
  };

  ensureStyles();setTimeout(()=>{normalizeLegacy();renderSidebar?.();},120);
})();