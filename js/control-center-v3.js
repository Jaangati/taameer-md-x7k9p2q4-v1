// TAAMEER — Control Center v3: module state enforcement + simplified user administration
(() => {
  const esc = v => Utils.escapeHTML(String(v ?? ''));
  const statusOf = m => m?.controlStatus || (m?.status === 'active' ? 'live' : m?.status === 'soon' ? 'testing' : 'hidden');
  const isAdmin = () => state.currentUser?.role === 'admin';
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  const avatar = (u, cls='cc3-avatar') => u?.avatar ? `<img class="${cls}" src="${esc(u.avatar)}" alt="">` : `<div class="${cls} cc3-avatar-fallback">${esc(initials(u?.fullName))}</div>`;
  const fmt = iso => iso ? new Date(iso).toLocaleString([], {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Never';

  function ensureStyles(){
    if(document.getElementById('cc3Styles')) return;
    const s=document.createElement('style'); s.id='cc3Styles'; s.textContent=`
      .cc3-nav-tag{margin-left:auto;padding:3px 6px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.06em;line-height:1.1}.cc3-nav-tag.testing{background:#dbeafe;color:#1d4ed8}.cc3-nav-tag.maintenance{background:#ffedd5;color:#c2410c}.cc3-nav-tag.hidden{background:#e5e7eb;color:#64748b}
      .cc3-user-grid{display:grid;gap:10px}.cc3-user-card{display:grid;grid-template-columns:minmax(260px,1.4fr) minmax(210px,.9fr) 120px 150px auto;align-items:center;gap:16px;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:14px 16px;transition:.16s}.cc3-user-card:hover{box-shadow:0 10px 28px rgba(15,23,42,.06);transform:translateY(-1px)}.dark .cc3-user-card{background:#0b1018;border-color:#202938}.cc3-avatar{width:44px;height:44px;border-radius:14px;object-fit:cover;flex:0 0 auto}.cc3-avatar-fallback{display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:12px;font-weight:850}.cc3-access{display:flex;gap:5px;flex-wrap:wrap}.cc3-chip{padding:5px 7px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:9px;font-weight:800}.dark .cc3-chip{background:#182131;color:#cbd5e1}.cc3-role{display:inline-flex;padding:5px 8px;border-radius:999px;background:#f3f4f6;color:#374151;font-size:9px;font-weight:850;text-transform:uppercase}.cc3-role.admin{background:#111827;color:#fff}.cc3-status{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800}.cc3-dot{width:7px;height:7px;border-radius:50%;background:#22c55e}.cc3-dot.off{background:#cbd5e1}.cc3-actions{display:flex;gap:7px;justify-content:flex-end}.cc3-btn{border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:8px 10px;font-size:10px;font-weight:800;color:#111827}.cc3-btn:hover{background:#f8fafc}.dark .cc3-btn{background:#111827;border-color:#293244;color:#fff}.cc3-profile-photo{width:84px;height:84px;border-radius:22px;overflow:hidden;position:relative;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:850}.cc3-profile-photo img{width:100%;height:100%;object-fit:cover}.cc3-photo-change{position:absolute;inset:auto 5px 5px 5px;border:0;border-radius:10px;padding:6px;background:rgba(0,0,0,.65);color:#fff;font-size:9px;font-weight:800}.cc3-readonly-access{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cc3-access-row{display:flex;align-items:center;gap:10px;border:1px solid #e5e7eb;border-radius:13px;padding:10px}.dark .cc3-access-row{border-color:#202938}
      @media(max-width:1050px){.cc3-user-card{grid-template-columns:minmax(240px,1fr) 1fr 100px auto}.cc3-last{display:none}}
      @media(max-width:760px){.cc3-user-card{grid-template-columns:1fr auto}.cc3-access-col,.cc3-role-col,.cc3-last{display:none}.cc3-readonly-access{grid-template-columns:1fr}}
    `; document.head.appendChild(s);
  }

  // Enforce module state for actual users, not just the admin card UI.
  window.canAccessModule = function(m){
    if(!m || !state.currentUser) return false;
    const st=statusOf(m);
    if(isAdmin()) return true;
    const assigned=(state.currentUser.modules||[]).includes(m.id);
    if(!assigned || st==='hidden' || st==='maintenance') return false;
    if(st==='testing' && !(m.testers||[]).map(String).includes(String(state.currentUser.id))) return false;
    return state.permissions?.user?.[m.id]?.view !== false;
  };

  const previousSidebar=window.renderSidebar;
  window.renderSidebar=function(){
    previousSidebar?.(); ensureStyles();
    const nav=document.getElementById('sidebarNav'); if(!nav||!state.currentUser)return;
    // Permissions now live only inside each module.
    [...nav.querySelectorAll('.nav-item')].filter(x=>x.textContent.trim()==='Permissions').forEach(x=>x.remove());
    const items=[...nav.querySelectorAll('.nav-item')];
    state.modules.forEach(m=>{
      const item=items.find(x=>x.querySelector('.nav-label')?.textContent.trim()===m.name || x.textContent.trim()===m.name); if(!item)return;
      item.querySelector('.cc3-nav-tag')?.remove();
      const st=statusOf(m),assigned=(state.currentUser.modules||[]).includes(m.id),tester=(m.testers||[]).map(String).includes(String(state.currentUser.id));
      if(!isAdmin()){
        if(!assigned || st==='hidden' || (st==='testing'&&!tester)){item.remove();return;}
        if(st==='maintenance'){
          item.setAttribute('onclick',`showModuleMaintenance('${String(m.id).replaceAll("'",'')}')`); item.classList.add('opacity-80');
        }
      }
      if(st!=='live'){
        const tag=document.createElement('span');tag.className=`cc3-nav-tag sidebar-label ${st}`;tag.textContent=st==='testing'?'TESTING':st==='maintenance'?'MAINT.':'HIDDEN';item.appendChild(tag);
      }
    });
  };

  const previousShowView=window.showView;
  window.showView=function(name){
    if(name==='permissions') return previousShowView?.('modules-admin');
    const m=state.modules?.find(x=>x.id===name);
    if(m && !isAdmin()){
      const st=statusOf(m),assigned=(state.currentUser.modules||[]).includes(m.id),tester=(m.testers||[]).map(String).includes(String(state.currentUser.id));
      if(st==='hidden'||!assigned||(st==='testing'&&!tester)) return;
      if(st==='maintenance') return window.showModuleMaintenance?.(m.id);
    }
    return previousShowView?.(name);
  };

  const previousSetStatus=window.setModuleControlStatus;
  window.setModuleControlStatus=async function(id,st){
    await previousSetStatus?.(id,st);
    const m=state.modules.find(x=>x.id===id); if(m){m.controlStatus=st; m.status='active'; save();}
    renderSidebar();
    if(document.getElementById('view-home')&&!document.getElementById('view-home').classList.contains('hidden')) window.renderHomeModules?.();
  };

  // Keep maintenance visible to assigned users on Home with a clear state, while Hidden really disappears.
  const previousHome=window.renderHomeModules;
  window.renderHomeModules=async function(){
    await previousHome?.(); ensureStyles();
    if(!state.currentUser || isAdmin()) return;
    const host=document.querySelector('#view-home .cc-module-grid'); if(!host)return;
    state.modules.filter(m=>(state.currentUser.modules||[]).includes(m.id)&&statusOf(m)==='maintenance').forEach(m=>{
      if([...host.querySelectorAll('.cc-home-module h4')].some(x=>x.textContent.trim()===m.name))return;
      const card=document.createElement('div');card.className='cc-card cc-home-module clickable';card.onclick=()=>window.showModuleMaintenance?.(m.id);card.innerHTML=`<div class="flex justify-between items-start"><div class="cc-icon"><i class="fas ${Utils.validIcon(m.icon)}"></i></div><span class="cc-status maintenance">MAINTENANCE</span></div><div><h4 class="font-bold text-base">${esc(m.name)}</h4><div class="text-lg font-extrabold mt-2 text-orange-600">Temporarily unavailable</div><p class="text-xs text-gray-500 mt-1">${esc(m.maintenanceMessage||'This module is being updated.')}</p></div><div class="text-xs font-bold mt-4">View status <i class="fas fa-circle-info ml-1"></i></div>`;host.appendChild(card);
    });
  };

  // User editor: identity/profile only. Access is intentionally managed in Modules.
  const baseOpenUserModal=window.openUserModal;
  window.openUserModal=function(userId=null){
    baseOpenUserModal?.(userId); ensureStyles();
    const form=document.getElementById('userForm'),box=document.getElementById('userModuleCheckboxes'); if(!form)return;
    if(box?.parentElement){box.parentElement.style.display='none';}
    let note=form.querySelector('#cc3AccessNote');
    if(!note){note=document.createElement('div');note.id='cc3AccessNote';note.className='p-3 rounded-xl bg-blue-50 text-blue-700 text-xs dark:bg-blue-950/30 dark:text-blue-300';note.innerHTML='<i class="fas fa-shield-halved mr-2"></i>Module access and permissions are managed only from <strong>Administration → Modules</strong>.';box?.parentElement?.insertAdjacentElement('afterend',note);}
    form.querySelector('#cc3PhotoEditor')?.remove();
    const user=state.users.find(x=>String(x.id)===String(userId));
    const wrap=document.createElement('div');wrap.id='cc3PhotoEditor';wrap.className='flex items-center gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800';
    wrap.innerHTML=`<div class="cc3-profile-photo">${user?.avatar?`<img src="${esc(user.avatar)}">`:esc(initials(user?.fullName||'New User'))}${user?'<button type="button" class="cc3-photo-change" onclick="document.getElementById(\'cc3AvatarInput\').click()"><i class="fas fa-camera mr-1"></i>Change</button>':''}</div><div><div class="text-sm font-bold">Profile picture</div><div class="text-xs text-gray-500 mt-1">${user?'You can update this user’s photo directly.':'Create the user first, then edit the profile picture.'}</div>${user?'<input id="cc3AvatarInput" type="file" accept="image/*" class="hidden">':''}</div>`;
    const first=form.firstElementChild; first?.insertAdjacentElement('afterend',wrap);
    if(user){document.getElementById('cc3AvatarInput')?.addEventListener('change',e=>updateUserAvatar(user.id,e.target.files?.[0]));}
  };

  window.updateUserAvatar=async function(uid,file){
    if(!file)return;if(file.size>2*1024*1024)return alert('Image too large. Maximum 2 MB.');
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
    const {error}=await supabaseClient.from('profiles').update({avatar:data}).eq('id',uid); if(error)return alert(error.message||'Could not update profile picture.');
    const u=state.users.find(x=>String(x.id)===String(uid));if(u)u.avatar=data;alert('Profile picture updated.');openUserModal(uid);
  };

  // Advanced users view: no activity duplication, access is read-only here.
  window.loadUsers=async function(){
    if(!isAdmin())return; ensureStyles();
    try{if(typeof refreshAdminUsers==='function')await refreshAdminUsers();}catch(e){console.warn(e);}
    const view=document.getElementById('view-users');if(!view)return;
    view.innerHTML=`<div class="cc-page"><div class="cc-head"><div><div class="cc-kicker">Administration</div><h2 class="cc-title">Team & Users</h2><p class="cc-sub">Manage user identity and account details. Module access stays centralized in Modules.</p></div><button class="cc-btn primary" onclick="openUserModal()"><i class="fas fa-user-plus"></i>Add User</button></div><div class="cc-summary"><div class="cc-stat"><div class="v">${state.users.length}</div><div class="l">Users</div></div><div class="cc-stat"><div class="v">${state.users.filter(u=>u.status==='active').length}</div><div class="l">Active accounts</div></div><div class="cc-stat"><div class="v">${state.users.filter(u=>u.role==='admin').length}</div><div class="l">Administrators</div></div><div class="cc-stat"><div class="v">${state.users.filter(u=>u.role!=='admin').length}</div><div class="l">Standard users</div></div></div><div class="cc3-user-grid">${state.users.map(u=>{const mods=state.modules.filter(m=>(u.modules||[]).includes(m.id));return `<article class="cc3-user-card"><div class="flex items-center gap-3">${avatar(u)}<div class="min-w-0"><div class="font-bold text-sm text-gray-900 dark:text-white">${esc(u.fullName)}</div><div class="text-xs text-gray-500 truncate">${esc(u.jobTitle||'No job title')} · ${esc(u.email||'—')}</div></div></div><div class="cc3-access-col"><div class="text-[9px] uppercase font-bold text-gray-400 mb-1.5">Module access</div><div class="cc3-access">${mods.length?mods.slice(0,5).map(m=>`<span class="cc3-chip">${esc(m.name)}</span>`).join(''):'<span class="text-xs text-gray-400">No modules assigned</span>'}${mods.length>5?`<span class="cc3-chip">+${mods.length-5}</span>`:''}</div></div><div class="cc3-role-col"><span class="cc3-role ${u.role==='admin'?'admin':''}">${u.role==='admin'?'Admin':'User'}</span></div><div class="cc3-last"><div class="cc3-status"><span class="cc3-dot ${u.status==='active'?'':'off'}"></span>${esc(u.status)}</div><div class="text-[9px] text-gray-400 mt-1">Last login: ${esc(fmt(u.lastLogin))}</div></div><div class="cc3-actions"><button class="cc3-btn" onclick="openUserControlV3('${esc(u.id)}')"><i class="fas fa-eye"></i></button><button class="cc3-btn" onclick="editUser('${esc(u.id)}')"><i class="fas fa-pen"></i>Edit</button></div></article>`;}).join('')}</div></div>`;
  };

  window.openUserControlV3=function(uid){
    ensureStyles();const u=state.users.find(x=>String(x.id)===String(uid));if(!u)return;document.getElementById('cc3UserOverlay')?.remove();
    const mods=state.modules.filter(m=>(u.modules||[]).includes(m.id));const el=document.createElement('div');el.id='cc3UserOverlay';el.className='cc-overlay';el.innerHTML=`<div class="cc-drawer" style="width:min(850px,96vw)"><div class="cc-drawer-head"><div class="flex items-center gap-3">${avatar(u,'cc3-avatar')}<div><div class="cc-kicker text-gray-400">USER PROFILE</div><h3 class="text-xl font-bold">${esc(u.fullName)}</h3><p class="text-xs text-gray-400 mt-1">${esc(u.jobTitle||'Team member')}</p></div></div><button class="cc-btn" onclick="document.getElementById('cc3UserOverlay').remove()"><i class="fas fa-times"></i></button></div><div class="cc-body"><div class="grid md:grid-cols-2 gap-3"><div class="cc-section"><div class="cc-kicker">Profile</div><div class="space-y-3 mt-3 text-sm"><div><span class="text-gray-400">Email</span><div class="font-bold">${esc(u.email||'—')}</div></div><div><span class="text-gray-400">Phone</span><div class="font-bold">${esc(u.phone||'—')}</div></div><div><span class="text-gray-400">Role</span><div class="font-bold">${u.role==='admin'?'Administrator':'Standard User'}</div></div><div><span class="text-gray-400">Status</span><div class="font-bold">${esc(u.status)}</div></div></div></div><div class="cc-section"><div class="flex justify-between items-center"><div><div class="cc-kicker">Module access · read only</div><p class="text-xs text-gray-500 mt-1">Change access from Module Control Center.</p></div><button class="cc-btn" onclick="document.getElementById('cc3UserOverlay').remove();showView('modules-admin')">Manage in Modules</button></div><div class="cc3-readonly-access mt-3">${mods.length?mods.map(m=>`<div class="cc3-access-row"><div class="cc-icon" style="width:34px;height:34px"><i class="fas ${Utils.validIcon(m.icon)}"></i></div><div><div class="text-xs font-bold">${esc(m.name)}</div><div class="text-[9px] text-gray-400">${esc(statusOf(m))}</div></div></div>`).join(''):'<div class="text-xs text-gray-400">No module access assigned.</div>'}</div></div></div><div class="cc-section"><button class="cc-btn primary" onclick="document.getElementById('cc3UserOverlay').remove();editUser('${esc(u.id)}')"><i class="fas fa-pen"></i>Edit full profile</button></div></div></div>`;document.body.appendChild(el);
  };

  // Remove the old user activity drawer entry point if it is called elsewhere.
  window.openUserControl=function(uid){return window.openUserControlV3(uid);};

  ensureStyles();
  setTimeout(()=>{renderSidebar();if(document.getElementById('view-users')&&!document.getElementById('view-users').classList.contains('hidden'))loadUsers();},50);
})();