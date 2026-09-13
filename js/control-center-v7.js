// TAAMEER Control Center v7 — stable NEW badge cycles + true user visits
(() => {
  const esc=v=>Utils.escapeHTML(String(v??''));
  const isAdmin=()=>state.currentUser?.role==='admin';
  const stateOf=m=>{
    const s=m?.controlStatus || (m?.status==='disabled'?'hidden':m?.status==='soon'?'maintenance':'live');
    return s==='testing'?'new':s;
  };
  const cycleId=m=>m?.newSince || 'legacy';
  const visitKey=m=>`taameer_new_module_visits_v2:${state.currentUser?.id||'anon'}:${m.id}:${cycleId(m)}`;
  const visits=m=>Math.max(0,Number(localStorage.getItem(visitKey(m)))||0);

  const baseSetStatus=window.setModuleControlStatus;
  window.setModuleControlStatus=async function(id,st){
    if(st==='testing') st='new';
    await baseSetStatus?.(id,st);
    const m=state.modules?.find(x=>x.id===id); if(!m)return;
    if(st==='new'){
      m.controlStatus='new';
      m.status='active';
      m.newSince=new Date().toISOString();
      try{Store.saveLocal?.();await Cloud.syncNow?.();}catch(e){console.error('Could not persist NEW module cycle',e);}
      try{await window.renderAdminModules?.();}catch(_){}
      try{window.renderSidebar?.();}catch(_){}
    }
  };

  const baseSidebar=window.renderSidebar;
  window.renderSidebar=function(){
    baseSidebar?.();
    const nav=document.getElementById('sidebarNav'); if(!nav||!state.currentUser)return;
    (state.modules||[]).forEach(m=>{
      const item=[...nav.querySelectorAll('.nav-item')].find(x=>x.querySelector('.nav-label')?.textContent.trim()===m.name); if(!item)return;
      const st=stateOf(m);
      if(st!=='new') return;
      item.querySelectorAll('.cc6-side-badge.new,.cc7-side-badge.new').forEach(x=>x.remove());
      const shouldShow=isAdmin() || visits(m)<3;
      if(shouldShow){
        const b=document.createElement('span');
        b.className='cc6-side-badge cc7-side-badge sidebar-label new';
        b.textContent='NEW';
        item.appendChild(b);
      }
    });
  };

  const baseShowView=window.showView;
  window.showView=function(name){
    const m=state.modules?.find(x=>x.id===name||x.viewId===name);
    if(!m || stateOf(m)!=='new' || isAdmin()) return baseShowView?.(name);

    // Older control layers counted programmatic showView calls as visits.
    // Preserve that legacy counter so refresh/render calls can never consume the NEW badge.
    const legacyKey=`taameer_new_module_visits:${state.currentUser?.id||'anon'}:${m.id}`;
    const legacyBefore=localStorage.getItem(legacyKey);
    const trusted=Boolean(window.event?.isTrusted);
    const result=baseShowView?.(name);
    if(legacyBefore===null) localStorage.removeItem(legacyKey); else localStorage.setItem(legacyKey,legacyBefore);

    if(trusted){
      const next=Math.min(3,visits(m)+1);
      localStorage.setItem(visitKey(m),String(next));
      setTimeout(()=>window.renderSidebar?.(),30);
    }
    return result;
  };

  setTimeout(()=>window.renderSidebar?.(),120);
})();