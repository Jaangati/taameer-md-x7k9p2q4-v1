// TAAMEER Control Center v4 — authoritative module states
(() => {
  const esc = v => Utils.escapeHTML(String(v ?? ''));
  const statusOf = m => m?.controlStatus || (m?.status === 'active' ? 'live' : m?.status === 'disabled' ? 'hidden' : 'maintenance');
  const isAdmin = () => state.currentUser?.role === 'admin';

  function ensureStyles(){
    if(document.getElementById('cc4Styles')) return;
    const s=document.createElement('style');s.id='cc4Styles';s.textContent=`
      .cc4-state-badge{margin-left:auto;padding:3px 7px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.06em;line-height:1.1;white-space:nowrap}
      .cc4-state-badge.testing{background:#dbeafe;color:#1d4ed8}
      .cc4-state-badge.maintenance{background:#ffedd5;color:#c2410c}
      .cc4-state-badge.hidden{background:#e5e7eb;color:#64748b}
      .cc4-held{opacity:.72!important;cursor:not-allowed!important}
      .cc4-held:hover{transform:none!important;box-shadow:none!important}
      .cc4-home-hold{border-color:#fed7aa!important;background:linear-gradient(135deg,#fff7ed,#fff)!important;cursor:not-allowed!important}
      .dark .cc4-home-hold{background:linear-gradient(135deg,#26170d,#0b1018)!important;border-color:#7c2d12!important}
      .cc4-testing-note{font-size:9px;font-weight:900;color:#1d4ed8;background:#dbeafe;border-radius:999px;padding:4px 7px}
    `;document.head.appendChild(s);
  }

  // No tester selection anymore. Testing is a simple visible state for assigned users.
  window.canAccessModule = function(m){
    if(!m || !state.currentUser) return false;
    if(isAdmin()) return true;
    const assigned=(state.currentUser.modules||[]).includes(m.id);
    if(!assigned) return false;
    const st=statusOf(m);
    if(st==='hidden' || st==='maintenance') return false;
    return state.permissions?.user?.[m.id]?.view !== false;
  };

  // Persist both the new control state and legacy status so old/base UI cannot contradict it.
  window.setModuleControlStatus = async function(id, st){
    const m=state.modules.find(x=>x.id===id); if(!m)return;
    if(!['live','testing','maintenance','hidden'].includes(st)) st='live';
    m.controlStatus=st;
    m.status = st==='hidden' ? 'disabled' : st==='maintenance' ? 'soon' : 'active';
    delete m.testers;
    if(st==='maintenance' && !m.maintenanceMessage) m.maintenanceMessage='This module is currently on hold for an update.';
    Store.saveLocal?.();
    await Cloud.syncNow?.();
    try{renderAdminModules?.();}catch(_){}
    try{renderSidebar?.();}catch(_){}
    try{if(!document.getElementById('view-home')?.classList.contains('hidden')) await renderHomeModules?.();}catch(_){}
  };

  const baseSidebar=window.renderSidebar;
  window.renderSidebar=function(){
    ensureStyles();
    baseSidebar?.();
    const nav=document.getElementById('sidebarNav'); if(!nav||!state.currentUser)return;

    // Permissions lives only inside Modules.
    [...nav.querySelectorAll('.nav-item')].filter(x=>x.textContent.trim()==='Permissions').forEach(x=>x.remove());

    const items=[...nav.querySelectorAll('.nav-item')];
    state.modules.forEach(m=>{
      const item=items.find(x=>x.querySelector('.nav-label')?.textContent.trim()===m.name); if(!item)return;
      item.querySelectorAll('.cc3-nav-tag,.cc4-state-badge').forEach(x=>x.remove());
      const st=statusOf(m);

      if(!isAdmin()){
        const assigned=(state.currentUser.modules||[]).includes(m.id);
        if(!assigned || st==='hidden') { item.remove(); return; }
        if(st==='maintenance'){
          item.removeAttribute('onclick');
          item.onclick=e=>{e.preventDefault();e.stopPropagation();};
          item.classList.add('cc4-held');
        }
      }

      if(st==='testing' || st==='maintenance' || (isAdmin()&&st==='hidden')){
        const tag=document.createElement('span');
        tag.className=`cc4-state-badge sidebar-label ${st}`;
        tag.textContent=st==='testing'?'TESTING':st==='maintenance'?'ON HOLD':'HIDDEN';
        item.appendChild(tag);
      }
    });
  };

  const baseShowView=window.showView;
  window.showView=function(name){
    const m=state.modules?.find(x=>x.id===name);
    if(m){
      const st=statusOf(m);
      if(!isAdmin()){
        if(!(state.currentUser.modules||[]).includes(m.id)) return;
        if(st==='hidden' || st==='maintenance') return;
      }
      // Admin always keeps access, including maintenance/hidden modules.
      if(isAdmin() && m.status!=='active'){
        const old=m.status;m.status='active';
        try{return baseShowView?.(name);}finally{m.status=old;}
      }
    }
    return baseShowView?.(name);
  };

  // Home must obey the same rules and show maintenance as a persistent on-hold card, not a popup.
  const baseHome=window.renderHomeModules;
  window.renderHomeModules=async function(){
    await baseHome?.(); ensureStyles();
    if(!state.currentUser || isAdmin()) return;
    const host=document.querySelector('#view-home .cc-module-grid') || document.getElementById('homeModulesGrid'); if(!host)return;

    // Remove anything that should be hidden, even if an older renderer inserted it.
    [...host.querySelectorAll('.cc-home-module,button')].forEach(card=>{
      const title=card.querySelector('h4')?.textContent?.trim();
      const m=state.modules.find(x=>x.name===title); if(m&&statusOf(m)==='hidden')card.remove();
    });

    state.modules.filter(m=>(state.currentUser.modules||[]).includes(m.id)&&statusOf(m)==='maintenance').forEach(m=>{
      if([...host.querySelectorAll('h4')].some(x=>x.textContent.trim()===m.name)){
        const existing=[...host.querySelectorAll('.cc-home-module,button')].find(x=>x.querySelector('h4')?.textContent.trim()===m.name);
        if(existing){existing.onclick=null;existing.classList.add('cc4-home-hold','cc4-held');const badge=existing.querySelector('.cc-status');if(badge){badge.className='cc-status maintenance';badge.textContent='ON HOLD';}}
        return;
      }
      const card=document.createElement('div');card.className='cc-card cc-home-module cc4-home-hold cc4-held';
      card.innerHTML=`<div class="flex justify-between items-start"><div class="cc-icon"><i class="fas ${Utils.validIcon(m.icon)}"></i></div><span class="cc-status maintenance">ON HOLD</span></div><div><h4 class="font-bold text-base">${esc(m.name)}</h4><div class="text-lg font-extrabold mt-2 text-orange-600">Temporarily unavailable</div><p class="text-xs text-gray-500 mt-1">${esc(m.maintenanceMessage||'This module is currently being updated.')}</p></div><div class="text-xs font-bold mt-4 text-orange-600"><i class="fas fa-lock mr-1"></i>Access paused by administrator</div>`;
      host.appendChild(card);
    });

    // Add a persistent testing badge to visible testing modules.
    [...host.querySelectorAll('.cc-home-module,button')].forEach(card=>{
      const title=card.querySelector('h4')?.textContent?.trim();const m=state.modules.find(x=>x.name===title);if(!m||statusOf(m)!=='testing')return;
      const badge=card.querySelector('.cc-status');if(badge){badge.className='cc-status testing';badge.textContent='TESTING';}
    });
  };

  // Remove the tester controls from the module management drawer.
  const baseOpenModuleControl=window.openModuleControl;
  if(baseOpenModuleControl)window.openModuleControl=async function(...args){
    const r=await baseOpenModuleControl(...args);
    setTimeout(()=>{
      document.querySelectorAll('#ccOverlay .cc-user-row').forEach(row=>{
        [...row.querySelectorAll('div')].forEach(d=>{if(d.textContent.trim()==='Tester'){const box=d.parentElement;if(box)box.style.display='none';}});
      });
      document.querySelectorAll('#ccOverlay button').forEach(b=>{if((b.textContent||'').trim()==='Tester')b.style.display='none';});
    },20);
    return r;
  };

  // Re-render immediately with authoritative state semantics.
  ensureStyles();
  setTimeout(()=>{try{renderSidebar?.();}catch(_){}},50);
})();