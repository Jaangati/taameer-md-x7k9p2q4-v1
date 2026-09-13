// TAAMEER Control Center v6 — consistent states + cleaner access & permissions
(() => {
  const esc=v=>Utils.escapeHTML(String(v??''));
  const isAdmin=()=>state.currentUser?.role==='admin';
  const stateOf=m=>{
    const s=m?.controlStatus || (m?.status==='disabled'?'hidden':m?.status==='soon'?'maintenance':'live');
    return s==='testing'?'new':s;
  };
  const visitKey=m=>`taameer_new_module_visits:${state.currentUser?.id||'anon'}:${m.id}`;
  const visitCount=m=>Math.max(0,Number(localStorage.getItem(visitKey(m)))||0);
  const userNeedsNewBadge=m=>stateOf(m)==='new'&&visitCount(m)<3;
  const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  const avatar=u=>u?.avatar?`<img class="cc6-avatar" src="${esc(u.avatar)}" alt="">`:`<div class="cc6-avatar cc6-fallback">${esc(initials(u?.fullName))}</div>`;
  const fmtAgo=iso=>{if(!iso)return'—';const ms=Math.max(0,Date.now()-new Date(iso).getTime()),m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24);if(m<1)return'Just now';if(m<60)return`${m}m ago`;if(h<24)return`${h}h ago`;return`${d}d ago`;};

  function ensureStyles(){
    if(document.getElementById('cc6Styles'))return;
    const s=document.createElement('style');s.id='cc6Styles';s.textContent=`
      .cc6-side-badge{margin-left:auto;padding:3px 7px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.06em;white-space:nowrap}
      .cc6-side-badge.new{background:#dcfce7;color:#15803d}.cc6-side-badge.maintenance{background:#ffedd5;color:#c2410c}.cc6-side-badge.hidden{background:#e5e7eb;color:#64748b}
      .cc-status.new{background:#dcfce7!important;color:#15803d!important}.cc-status.maintenance{background:#fff7ed!important;color:#c2410c!important}.cc-status.hidden{background:#f1f5f9!important;color:#64748b!important}
      .cc6-access-shell{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(320px,.6fr);gap:14px}.cc6-card{border:1px solid #e5e7eb;border-radius:18px;background:#fff;padding:16px}.dark .cc6-card{background:#0b1018;border-color:#202938}
      .cc6-access-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.cc6-user-list{display:grid;gap:8px}.cc6-user{display:grid;grid-template-columns:minmax(220px,1fr) 110px 90px;align-items:center;gap:12px;border:1px solid #edf0f3;border-radius:14px;padding:11px 12px}.dark .cc6-user{border-color:#202938}
      .cc6-avatar{width:40px;height:40px;border-radius:12px;object-fit:cover;flex:0 0 auto}.cc6-fallback{display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:10px;font-weight:850}
      .cc6-role{font-size:9px;font-weight:850;text-transform:uppercase;color:#64748b;background:#f1f5f9;border-radius:999px;padding:5px 8px;width:max-content}.dark .cc6-role{background:#182131;color:#cbd5e1}
      .cc6-perm-grid{display:grid;gap:9px}.cc6-perm{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #edf0f3;border-radius:14px;padding:12px}.dark .cc6-perm{border-color:#202938}.cc6-perm strong{font-size:12px}.cc6-perm small{display:block;color:#94a3b8;font-size:9px;margin-top:2px}
      .cc6-state-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.cc6-state-btn{border:1px solid #e5e7eb;border-radius:13px;padding:12px 9px;background:#fff;text-align:left;transition:.15s}.dark .cc6-state-btn{background:#111827;border-color:#293244;color:#fff}.cc6-state-btn.active{box-shadow:0 0 0 2px currentColor inset}.cc6-state-btn b{display:block;font-size:11px;text-transform:uppercase}.cc6-state-btn span{display:block;font-size:9px;color:#94a3b8;margin-top:3px}.cc6-state-btn.live{color:#047857}.cc6-state-btn.new{color:#15803d}.cc6-state-btn.maintenance{color:#c2410c}.cc6-state-btn.hidden{color:#64748b}
      .cc6-module-card{position:relative}.cc6-module-status{position:absolute;right:18px;top:18px}
      @media(max-width:900px){.cc6-access-shell{grid-template-columns:1fr}.cc6-user{grid-template-columns:1fr 90px}.cc6-role-col{display:none}.cc6-state-grid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  async function sessionRows(days=30){
    try{const since=new Date(Date.now()-days*86400000).toISOString();const {data,error}=await supabaseClient.from('dashboard_sessions').select('*').gte('started_at',since).order('started_at',{ascending:false}).limit(2500);if(error)throw error;return data||[];}catch(_){return[];}
  }
  function statsFor(m,rows){const r=rows.filter(s=>s.current_view===m.id);return{sessions:r.length,users:new Set(r.map(x=>String(x.user_id))).size,last:r[0]?.last_seen_at||r[0]?.started_at||null,time:r.reduce((n,x)=>n+(Number(x.duration_seconds)||0),0)};}
  const dur=sec=>{sec=Math.max(0,Number(sec)||0);const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return h?`${h}h ${m}m`:`${m}m`;};

  async function persistModuleState(m){
    try{Store.saveLocal?.();await Cloud.syncNow?.();}catch(e){console.error('Module state sync failed',e);}
  }

  window.setModuleControlStatus=async function(id,st){
    const m=state.modules.find(x=>x.id===id);if(!m)return;
    if(st==='testing')st='new';if(!['live','new','maintenance','hidden'].includes(st))st='live';
    m.controlStatus=st;m.status=st==='hidden'?'disabled':st==='maintenance'?'soon':'active';delete m.testers;
    if(st==='live')localStorage.removeItem(visitKey(m));
    if(st==='new')localStorage.setItem(visitKey(m),'0');
    if(st==='maintenance'&&!m.maintenanceMessage)m.maintenanceMessage='This module is currently under maintenance. We will be back soon.';
    await persistModuleState(m);
    await window.renderAdminModules?.();window.renderSidebar?.();
    if(!document.getElementById('view-home')?.classList.contains('hidden'))await window.renderHomeModules?.();
  };

  const priorSidebar=window.renderSidebar;
  window.renderSidebar=function(){
    ensureStyles();
    priorSidebar?.();
    const nav=document.getElementById('sidebarNav');if(!nav||!state.currentUser)return;
    [...nav.querySelectorAll('.nav-item')].filter(x=>x.textContent.trim()==='Permissions').forEach(x=>x.remove());

    // Guarantee every module is present for admin, regardless of hidden/maintenance legacy status.
    if(isAdmin()){
      const adminTitle=[...nav.querySelectorAll('.section-title')].find(x=>x.textContent.trim()==='Administration');
      state.modules.forEach(m=>{
        let item=[...nav.querySelectorAll('.nav-item')].find(x=>x.querySelector('.nav-label')?.textContent.trim()===m.name);
        if(!item){item=document.createElement('div');item.className='nav-item';const viewId=ModuleRegistry.ensureView(m);item.setAttribute('onclick',`showView('${esc(viewId)}')`);item.innerHTML=`<span class="nav-icon"><i class="fas ${Utils.validIcon(m.icon)} text-white"></i></span><span class="nav-label sidebar-label">${esc(m.name)}</span>`;if(adminTitle)nav.insertBefore(item,adminTitle);else nav.appendChild(item);}
      });
    }

    state.modules.forEach(m=>{
      const item=[...nav.querySelectorAll('.nav-item')].find(x=>x.querySelector('.nav-label')?.textContent.trim()===m.name);if(!item)return;
      item.querySelectorAll('.cc3-nav-tag,.cc4-state-badge,.cc5-state-badge,.cc6-side-badge').forEach(x=>x.remove());
      const st=stateOf(m);
      if(!isAdmin()){
        if(st==='hidden'){item.remove();return;}
        if(st==='maintenance'){item.classList.add('opacity-80');item.setAttribute('onclick',`showMaintenanceView('${esc(m.id)}')`);item.onclick=e=>{e.preventDefault();e.stopPropagation();window.showMaintenanceView?.(m.id);};}
      }
      const showBadge=isAdmin()?st!=='live':st==='maintenance'||userNeedsNewBadge(m);
      if(showBadge){const b=document.createElement('span');b.className=`cc6-side-badge sidebar-label ${st}`;b.textContent=st==='new'?'NEW':st==='maintenance'?'MAINTENANCE':'HIDDEN';item.appendChild(b);}
    });
  };

  window.renderAdminModules=async function(){
    ensureStyles();const view=document.getElementById('view-modules-admin');if(!view)return;const rows=await sessionRows(30);
    const counts={live:0,new:0,maintenance:0,hidden:0};state.modules.forEach(m=>counts[stateOf(m)]++);
    view.innerHTML=`<div class="cc-page"><div class="cc-head"><div><div class="cc-kicker">Administration</div><h2 class="cc-title">Module Control Center</h2><p class="cc-sub">One source of truth for module status, access, permissions and usage.</p></div><button class="cc-btn primary" onclick="openModuleModal()"><i class="fas fa-plus"></i>New Module</button></div><div class="cc-summary"><div class="cc-stat"><div class="v">${state.modules.length}</div><div class="l">Modules</div></div><div class="cc-stat"><div class="v text-emerald-600">${counts.live}</div><div class="l">Live</div></div><div class="cc-stat"><div class="v text-green-600">${counts.new}</div><div class="l">New</div></div><div class="cc-stat"><div class="v text-orange-600">${counts.maintenance}</div><div class="l">Maintenance</div></div></div><div class="cc-grid">${state.modules.map(m=>{const st=stateOf(m),assigned=state.users.filter(u=>(u.modules||[]).includes(m.id)),ms=statsFor(m,rows);return `<article class="cc-module cc6-module-card"><span class="cc-status ${st} cc6-module-status">${st}</span><div class="cc-module-top"><div class="flex gap-3 pr-24"><div class="cc-icon"><i class="fas ${Utils.validIcon(m.icon)}"></i></div><div><h3 class="font-bold text-gray-900 dark:text-white">${esc(m.name)}</h3><p class="text-xs text-gray-500 mt-1">${esc(m.desc||'')}</p></div></div></div><div class="cc-metrics"><div class="cc-metric"><strong>${assigned.length}</strong><span>Access</span></div><div class="cc-metric"><strong>${ms.users}</strong><span>Active 30d</span></div><div class="cc-metric"><strong>${ms.last?fmtAgo(ms.last):'—'}</strong><span>Last used</span></div></div><div class="flex items-center justify-between gap-3 mb-4"><div class="cc-avatars">${assigned.slice(0,5).map(u=>avatar(u).replaceAll('cc6-avatar','cc-avatar')).join('')}${assigned.length>5?`<div class="cc-avatar cc-avatar-fallback">+${assigned.length-5}</div>`:''}</div><div class="text-[10px] text-gray-400">${ms.sessions} sessions · ${dur(ms.time)}</div></div><div class="cc-actions"><button class="cc-btn" onclick="showView('${esc(m.id)}')"><i class="fas fa-arrow-up-right-from-square"></i>Open</button><button class="cc-btn" onclick="openModuleControl('${esc(m.id)}','overview')"><i class="fas fa-sliders"></i>Manage</button>${st==='live'?`<button class="cc-btn" onclick="setModuleControlStatus('${esc(m.id)}','maintenance')"><i class="fas fa-pause"></i>Maintenance</button>`:`<button class="cc-btn" onclick="setModuleControlStatus('${esc(m.id)}','live')"><i class="fas fa-play"></i>Go Live</button>`}</div></article>`;}).join('')}</div></div>`;
  };

  window.setModuleUserAccessV6=async function(mid,uid,on){
    const u=state.users.find(x=>String(x.id)===String(uid));if(!u)return;
    const mods=Array.isArray(u.modules)?[...u.modules]:[];const next=on?[...new Set([...mods,mid])]:mods.filter(x=>x!==mid);
    const {error}=await supabaseClient.from('profiles').update({modules:next}).eq('id',uid);if(error){console.error(error);alert('Could not update module access.');return;}
    u.modules=next;
    try{const cu=String(state.currentUser?.id)===String(uid);if(cu)state.currentUser.modules=next;}catch(_){}
    await window.renderAdminModules?.();
    const open=document.getElementById('ccOverlay');if(open)window.openModuleControl?.(mid,'access');
  };

  window.openModuleControl=async function(id,tab='overview'){
    ensureStyles();const m=state.modules.find(x=>x.id===id);if(!m)return;document.getElementById('ccOverlay')?.remove();
    const el=document.createElement('div');el.id='ccOverlay';el.className='cc-overlay';el.innerHTML=`<div class="cc-drawer"><div class="cc-drawer-head"><div class="flex items-center gap-3"><div class="cc-icon bg-white/10"><i class="fas ${Utils.validIcon(m.icon)}"></i></div><div><div class="cc-kicker text-gray-400">MODULE CONTROL</div><h3 class="text-xl font-bold">${esc(m.name)}</h3><p class="text-xs text-gray-400 mt-1">${esc(m.desc||'')}</p></div></div><button class="cc-btn" onclick="document.getElementById('ccOverlay').remove()"><i class="fas fa-times"></i></button></div><div class="cc-tabs">${['overview','access','analytics','activity'].map(t=>`<button class="cc-tab ${tab===t?'active':''}" onclick="openModuleControl('${esc(id)}','${t}')">${t==='access'?'Access & Permissions':t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div><div id="ccModuleBody" class="cc-body"></div></div>`;document.body.appendChild(el);
    const body=document.getElementById('ccModuleBody'),st=stateOf(m);
    if(tab==='overview'){
      const rows=await sessionRows(30),ms=statsFor(m,rows);
      body.innerHTML=`<div class="cc6-card"><div class="cc-kicker">Module status</div><h4 class="font-bold mt-1">Choose exactly how ${esc(m.name)} behaves</h4><div class="cc6-state-grid">${[['live','Live','Available normally'],['new','New','Live + NEW badge for users'],['maintenance','Maintenance','Users see locked maintenance view'],['hidden','Hidden','Invisible to users']].map(([s,n,d])=>`<button class="cc6-state-btn ${s} ${st===s?'active':''}" onclick="setModuleControlStatus('${esc(m.id)}','${s}');openModuleControl('${esc(m.id)}','overview')"><b>${n}</b><span>${d}</span></button>`).join('')}</div></div><div class="grid md:grid-cols-2 gap-3 mt-3"><div class="cc6-card"><div class="cc-kicker">Usage · 30 days</div><div class="cc-metrics mt-3"><div class="cc-metric"><strong>${ms.sessions}</strong><span>Sessions</span></div><div class="cc-metric"><strong>${ms.users}</strong><span>Users</span></div><div class="cc-metric"><strong>${dur(ms.time)}</strong><span>Tracked time</span></div></div><p class="text-xs text-gray-500 mt-2">Last used: ${ms.last?fmtAgo(ms.last):'No tracked usage yet'}</p></div><div class="cc6-card"><div class="cc-kicker">Module settings</div><div class="font-bold mt-1">${esc(m.name)}</div><p class="text-xs text-gray-500 mt-2">Identity, description and icon.</p><button class="cc-btn mt-4" onclick="editModule('${esc(m.id)}');document.getElementById('ccOverlay')?.remove()"><i class="fas fa-pen"></i>Edit module</button></div></div>`;return;
    }
    if(tab==='access'){
      const perm=state.permissions?.user?.[m.id]||{view:false,edit:false,delete:false};const assignedCount=state.users.filter(u=>(u.modules||[]).includes(m.id)).length;
      body.innerHTML=`<div class="cc6-access-shell"><section class="cc6-card"><div class="cc6-access-head"><div><div class="cc-kicker">People with access</div><h4 class="font-bold mt-1">${assignedCount} of ${state.users.length} users assigned</h4></div><span class="cc-status ${st}">${st}</span></div><div class="cc6-user-list">${state.users.map(u=>{const on=(u.modules||[]).includes(m.id);return `<div class="cc6-user"><div class="flex items-center gap-3 min-w-0">${avatar(u)}<div class="min-w-0"><div class="font-bold text-sm truncate">${esc(u.fullName)}</div><div class="text-[10px] text-gray-400 truncate">${esc(u.jobTitle||u.email||u.role)}</div></div></div><div class="cc6-role-col"><span class="cc6-role">${u.role==='admin'?'Admin':'User'}</span></div><div class="text-center"><button class="cc-toggle ${on?'on':''}" onclick="setModuleUserAccessV6('${esc(m.id)}','${esc(u.id)}',${!on})"></button><div class="text-[9px] text-gray-400 mt-1">${on?'Access on':'No access'}</div></div></div>`;}).join('')}</div></section><aside class="cc6-card"><div class="cc-kicker">Standard user permissions</div><h4 class="font-bold mt-1 mb-3">What assigned users can do</h4><div class="cc6-perm-grid">${[['view','View','Open and use this module'],['edit','Edit','Create or change module content'],['delete','Delete','Remove module content where supported']].map(([k,n,d])=>`<div class="cc6-perm"><div><strong>${n}</strong><small>${d}</small></div><button class="cc-toggle ${perm[k]?'on':''}" onclick="updatePerm('user','${esc(m.id)}','${k}',${!perm[k]});openModuleControl('${esc(m.id)}','access')"></button></div>`).join('')}</div><div class="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] text-gray-500"><i class="fas fa-circle-info mr-1"></i>Admins always retain full control. Access is assigned per person here; permissions define what standard users can do once inside.</div></aside></div>`;return;
    }
    if(tab==='analytics'){
      const rows=await sessionRows(30),ms=statsFor(m,rows);const users=[...new Set(rows.filter(x=>x.current_view===m.id).map(x=>String(x.user_id)))];
      body.innerHTML=`<div class="cc6-card"><div class="cc-kicker">Module analytics · 30 days</div><div class="cc-metrics mt-3"><div class="cc-metric"><strong>${ms.sessions}</strong><span>Sessions</span></div><div class="cc-metric"><strong>${ms.users}</strong><span>Active users</span></div><div class="cc-metric"><strong>${dur(ms.time)}</strong><span>Tracked time</span></div></div><div class="mt-4 text-xs text-gray-500">${users.length?'Used by '+users.map(id=>esc(state.users.find(u=>String(u.id)===id)?.fullName||'User')).join(', '):'No tracked use yet.'}</div></div>`;return;
    }
    let acts=[];try{const {data}=await supabaseClient.from('activity_log').select('*').eq('entity_type','module').eq('entity_id',m.id).order('created_at',{ascending:false}).limit(50);acts=data||[];}catch(_){}
    body.innerHTML=`<div class="cc6-card"><div class="cc-kicker">Module activity</div>${acts.length?acts.map(a=>`<div class="py-3 border-b border-gray-100 dark:border-gray-800"><div class="font-bold text-sm">${esc((a.action||'activity').replaceAll('_',' '))}</div><div class="text-[10px] text-gray-400">${esc(fmtAgo(a.created_at))}</div></div>`).join(''):'<div class="text-sm text-gray-400 py-5">No module activity recorded yet.</div>'}</div>`;
  };

  // One final sidebar pass after all older control layers have initialized.
  ensureStyles();setTimeout(()=>{try{window.renderSidebar?.();}catch(_){}},180);
})();