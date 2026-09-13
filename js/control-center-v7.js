// TAAMEER Control Center v7 — Supabase-backed NEW badge cycles + true user visits
(() => {
  const isAdmin=()=>state.currentUser?.role==='admin';
  const stateOf=m=>{
    const s=m?.controlStatus || (m?.status==='disabled'?'hidden':m?.status==='soon'?'maintenance':'live');
    return s==='testing'?'new':s;
  };
  const cycleId=m=>new Date(m?.newSince||0).toISOString();
  const countKey=m=>`${state.currentUser?.id||'anon'}:${m.id}:${cycleId(m)}`;
  const visitCounts=new Map();
  let loadedForUser=null;
  let loadingVisits=null;
  const visits=m=>Math.max(0,Number(visitCounts.get(countKey(m)))||0);

  async function loadVisitCounts(){
    const uid=state.currentUser?.id;
    if(!uid||isAdmin()||loadedForUser===String(uid))return true;
    if(loadingVisits)return loadingVisits;
    loadingVisits=(async()=>{
      const {data,error}=await supabaseClient.from('module_user_visits').select('module_id,new_since,visit_count').eq('user_id',uid);
      if(error)throw error;
      visitCounts.clear();
      (data||[]).forEach(row=>visitCounts.set(`${uid}:${row.module_id}:${new Date(row.new_since).toISOString()}`,Math.min(3,Math.max(0,Number(row.visit_count)||0))));
      loadedForUser=String(uid);
      return true;
    })();
    try{return await loadingVisits;}catch(e){console.error('Could not load NEW module visits',e);return false;}finally{loadingVisits=null;}
  }

  async function saveNewCycle(){
    Store.saveLocal?.();
    const {data,error}=await supabaseClient.from('app_data').upsert({id:'modules',data:state.modules},{onConflict:'id'}).select('id').single();
    if(error)throw error;
    if(data?.id!=='modules')throw new Error('NEW module state was not confirmed by Supabase.');
  }

  const baseSetStatus=window.setModuleControlStatus;
  window.setModuleControlStatus=async function(id,st){
    if(st==='testing') st='new';
    const m=state.modules?.find(x=>x.id===id); if(!m)return;
    if(st==='new'){
      m.controlStatus='new';
      m.status='active';
      m.newSince=new Date().toISOString();
      delete m.testers;
      try{await saveNewCycle();}catch(e){console.error('Could not persist NEW module cycle',e);alert('Could not save the NEW module status. Please try again.');return;}
      try{await window.renderAdminModules?.();}catch(_){}
      try{window.renderSidebar?.();}catch(_){}
      if(!document.getElementById('view-home')?.classList.contains('hidden'))await window.renderHomeModules?.();
      return;
    }
    await baseSetStatus?.(id,st);
  };

  const baseSidebar=window.renderSidebar;
  window.renderSidebar=function(){
    baseSidebar?.();
    const nav=document.getElementById('sidebarNav'); if(!nav||!state.currentUser)return;
    if(!isAdmin()&&loadedForUser!==String(state.currentUser.id))loadVisitCounts().then(ok=>{if(ok)window.renderSidebar?.();});
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

  let trustedNavigation=false;
  document.addEventListener('click',event=>{
    if(!event.isTrusted)return;
    trustedNavigation=true;
    setTimeout(()=>{trustedNavigation=false;},0);
  },true);

  const baseShowView=window.showView;
  window.showView=function(name){
    const m=state.modules?.find(x=>x.id===name||x.viewId===name);
    if(!m || stateOf(m)!=='new' || isAdmin()) return baseShowView?.(name);

    // Older control layers counted programmatic showView calls as visits.
    // Preserve that legacy counter so refresh/render calls can never consume the NEW badge.
    const legacyKey=`taameer_new_module_visits:${state.currentUser?.id||'anon'}:${m.id}`;
    const legacyBefore=localStorage.getItem(legacyKey);
    const trusted=trustedNavigation||Boolean(window.event?.isTrusted);
    const result=baseShowView?.(name);
    if(legacyBefore===null) localStorage.removeItem(legacyKey); else localStorage.setItem(legacyKey,legacyBefore);

    if(trusted){
      const optimistic=Math.min(3,visits(m)+1);
      visitCounts.set(countKey(m),optimistic);
      supabaseClient.rpc('record_module_visit',{p_module_id:m.id,p_new_since:cycleId(m)}).then(({data,error})=>{
        if(error){console.error('Could not record module visit',error);loadVisitCounts();return;}
        visitCounts.set(countKey(m),Math.min(3,Math.max(0,Number(data)||optimistic)));
        window.renderSidebar?.();
      });
      setTimeout(()=>window.renderSidebar?.(),30);
    }
    return result;
  };

  setTimeout(()=>{loadVisitCounts().then(()=>window.renderSidebar?.());},120);
})();
