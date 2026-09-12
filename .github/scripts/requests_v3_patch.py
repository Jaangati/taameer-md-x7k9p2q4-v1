from pathlib import Path
import re

p=Path('js/requests.js')
s=p.read_text(encoding='utf-8')

# ----- state / semantics -----
if "let completedRange" not in s:
    s=s.replace("  let searchTerm = '';\n", "  let searchTerm = '';\n  let completedRange = 'month';\n", 1)
s=s.replace("const statusLabel = s => ({new:'New',in_progress:'In progress',submitted:'Submitted',blocked:'Blocked',closed:'Closed',cancelled:'Cancelled'})[s] || s;",
            "const statusLabel = s => ({new:'Open',in_progress:'Open',submitted:'Completed',blocked:'Open',closed:'Completed',cancelled:'Cancelled'})[s] || s;")
s=s.replace("const activeStatuses = ['new','in_progress','submitted','blocked'];", "const activeStatuses = ['new','in_progress'];")

# ----- styling additions -----
css_anchor="      .rq-bin-tag{background:#fee2e2;color:#b91c1c}.rq-notice{font-size:11px;padding:10px 12px;border-radius:12px;background:#eff6ff;color:#1d4ed8}.dark .rq-notice{background:#0f1b35;color:#93c5fd}\n"
css_extra=css_anchor+"""      .rq-tab.open.active{background:#f97316;color:#fff}.rq-tab.attention.active{background:#dc2626;color:#fff}.rq-tab.completed.active{background:#16a34a;color:#fff}.rq-tab.cancelled.active{background:#6b7280;color:#fff}.rq-row.rq-unread{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 9%,#fff),#fff 38%);border-color:color-mix(in srgb,var(--accent) 45%,#dbe1e8)}.dark .rq-row.rq-unread{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 13%,#0d131d),#0d131d 45%)}.rq-new-chip{display:inline-flex;align-items:center;gap:5px;margin-left:8px;background:var(--accent);color:#fff;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:900;vertical-align:middle}.rq-age{font-size:9px;color:#94a3b8;margin-top:4px;font-variant-numeric:tabular-nums}.rq-completed-filter{display:flex;gap:4px;padding:4px;border-radius:11px;background:#f1f5f9;margin-left:6px}.dark .rq-completed-filter{background:#141b27}.rq-completed-filter button{border:0;background:transparent;padding:6px 8px;border-radius:8px;font-size:9px;font-weight:800;color:#64748b}.rq-completed-filter button.active{background:#fff;color:#166534;box-shadow:0 1px 4px rgba(15,23,42,.08)}.dark .rq-completed-filter button.active{background:#202938;color:#86efac}.rq-stat.notify{cursor:pointer}.rq-stat.notify:hover{outline:2px solid color-mix(in srgb,var(--accent) 20%,transparent)}.rq-sidebar-badge{margin-left:auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#ef4444;color:white;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:900}.rq-action-dot{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;font-size:9px;margin-left:6px}.rq-stat.completed .v{color:#16a34a}.rq-stat.cancelled .v{color:#6b7280}
"""
if '.rq-sidebar-badge' not in s:
    if css_anchor not in s: raise SystemExit('CSS anchor missing')
    s=s.replace(css_anchor,css_extra,1)

# ----- helper functions -----
helper_anchor="  function selectUser(id){selectedUser=id;render();}\n"
helpers=r'''  function elapsedText(iso){
    const ms=Math.max(0,Date.now()-new Date(iso).getTime());
    const d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000),m=Math.floor((ms%3600000)/60000);
    if(d)return `Open for ${d}d ${h}h`;
    if(h)return `Open for ${h}h ${m}m`;
    return `Open for ${m}m`;
  }
  function setCompletedRange(v){completedRange=v;render();}
  function visibleRequestScope(){
    return requests.filter(r=>!r.deleted_at&&(isAdmin()||String(r.assignee_id)===currentId()||String(r.creator_id)===currentId()||requestCollabs(r.id).includes(currentId())));
  }
  function unreadScope(){return visibleRequestScope().filter(r=>hasUnread(r));}
  function updateSidebarBadge(){
    const nav=document.getElementById('sidebarNav'); if(!nav)return;
    const item=[...nav.querySelectorAll('[onclick*="requests"]')].find(x=>/Requests/i.test(x.textContent||'')); if(!item)return;
    let badge=item.querySelector('.rq-sidebar-badge'); const count=unreadScope().length;
    if(!count){badge?.remove();return;}
    if(!badge){badge=document.createElement('span');badge.className='rq-sidebar-badge sidebar-label';item.appendChild(badge);} badge.textContent=String(count);
  }
'''
if 'function setCompletedRange' not in s:
    if helper_anchor not in s: raise SystemExit('helper anchor missing')
    s=s.replace(helper_anchor,helpers+'\n'+helper_anchor,1)

# ----- completed/date filtering and unread view -----
scope_new=r'''  function scopeRequests(){
    let arr=requests.filter(r=>isAdmin()||String(r.assignee_id)===currentId()||String(r.creator_id)===currentId()||requestCollabs(r.id).includes(currentId()));
    if(selectedStatus==='bin') arr=arr.filter(r=>!!r.deleted_at);
    else arr=arr.filter(r=>!r.deleted_at);
    if(selectedUser!=='all') arr=arr.filter(r=>String(r.assignee_id)===String(selectedUser)||requestCollabs(r.id).includes(String(selectedUser)));
    if(selectedStatus==='active') arr=arr.filter(r=>['new','in_progress'].includes(r.status));
    if(selectedStatus==='attention') arr=arr.filter(r=>isOverdue(r)||pendingActionCount(r)>0);
    if(selectedStatus==='unread') arr=arr.filter(hasUnread);
    if(selectedStatus==='closed'){
      arr=arr.filter(r=>r.status==='closed');
      if(completedRange!=='all'){
        const now=Date.now(),days=completedRange==='week'?7:completedRange==='month'?30:365,cut=now-days*86400000;
        arr=arr.filter(r=>new Date(r.closed_at||r.updated_at||r.created_at).getTime()>=cut);
      }
    }
    if(selectedStatus==='cancelled') arr=arr.filter(r=>r.status==='cancelled');
    if(searchTerm){const q=searchTerm.toLowerCase();arr=arr.filter(r=>[r.title,r.details,nameOf(r.assignee_id),nameOf(r.creator_id)].some(v=>String(v||'').toLowerCase().includes(q)));}
    return arr.sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at));
  }'''
s,n=re.subn(r"  function scopeRequests\(\)\{.*?\n  \}",scope_new,s,count=1,flags=re.S)
if n!=1: raise SystemExit('scopeRequests replacement failed')

# ----- render -----
render_new=r'''  function render(){
    ensureView();
    const c=counts(),arr=scopeRequests(),scoped=visibleRequestScope();
    const unreadCount=scoped.filter(hasUnread).length;
    const actionCount=scoped.reduce((n,r)=>n+pendingActionCount(r),0);
    const attentionCount=scoped.filter(r=>isOverdue(r)||pendingActionCount(r)>0).length;
    const completedCount=scoped.filter(r=>r.status==='closed').length;
    const cancelledCount=scoped.filter(r=>r.status==='cancelled').length;
    const people=isAdmin()?directory:directory.filter(p=>String(p.id)===currentId());
    root.innerHTML=`<div class="rq-shell">
      <section class="rq-command"><div><div class="rq-eyebrow">TAAMEER WORK REQUESTS</div><div class="rq-title">Keep requests moving.</div><div class="rq-sub">Clear requests, deadlines and accountability — without mixing them into Team Updates.</div></div><div class="rq-command-actions">${isAdmin()?`<button class="rq-btn rq-btn-ghost text-white border-white/15" onclick="RequestsApp.openBin()"><i class="fas fa-trash-can"></i> Bin</button><button class="rq-btn rq-btn-dark" onclick="RequestsApp.openCreate()"><i class="fas fa-plus"></i> New Request</button>`:`<button class="rq-btn rq-btn-dark" onclick="RequestsApp.openCreate()"><i class="fas fa-plus"></i> New Personal Task</button>`}</div></section>
      <div class="rq-people-wrap"><div class="rq-people">${isAdmin()?`<button class="rq-person ${selectedUser==='all'?'active':''}" onclick="RequestsApp.selectUser('all')"><div class="rq-avatar rq-avatar-fallback"><i class="fas fa-users"></i></div><div><div class="rq-person-name">Whole team</div><div class="rq-person-role">Department view</div></div><div class="count">${scoped.filter(r=>activeStatuses.includes(r.status)).length}</div></button>`:''}${people.map(p=>`<button class="rq-person ${selectedUser===String(p.id)?'active':''}" onclick="RequestsApp.selectUser('${esc(p.id)}')">${avatar(p.id)}<div><div class="rq-person-name">${esc(p.full_name)}</div><div class="rq-person-role">${esc(p.job_title||'Team member')}</div></div><div class="count">${userRequestCount(p.id)}</div></button>`).join('')}</div></div>
      <div class="rq-workspace"><section class="rq-panel">
        <div class="rq-summary"><div class="rq-stat"><div class="v" style="color:#f97316">${c.open}</div><div class="l">Open</div></div><div class="rq-stat"><div class="v">${c.due}</div><div class="l">Due soon</div></div><div class="rq-stat alert"><div class="v">${c.overdue}</div><div class="l">Overdue</div></div><div class="rq-stat ${attentionCount||actionCount?'review':''}"><div class="v">${attentionCount}</div><div class="l">Needs attention${actionCount?` · ${actionCount} action${actionCount>1?'s':''}`:''}</div></div><div class="rq-stat ${unreadCount?'notify':''}" onclick="RequestsApp.setStatus('unread')"><div class="v"><i class="fas fa-bell text-sm mr-1"></i>${unreadCount}</div><div class="l">Unread activity</div></div></div>
        <div class="rq-toolbar"><div class="rq-tabs">${[['active','Open','open'],['attention','Needs attention','attention'],['closed','Completed','completed'],['cancelled','Cancelled','cancelled']].map(x=>`<button class="rq-tab ${x[2]} ${selectedStatus===x[0]?'active':''}" onclick="RequestsApp.setStatus('${x[0]}')">${x[1]}</button>`).join('')}${selectedStatus==='unread'?'<button class="rq-tab active">Unread</button>':''}${selectedStatus==='closed'?`<div class="rq-completed-filter">${[['week','Week'],['month','Month'],['year','Year'],['all','All']].map(x=>`<button class="${completedRange===x[0]?'active':''}" onclick="RequestsApp.setCompletedRange('${x[0]}')">${x[1]}</button>`).join('')}</div>`:''}${isAdmin()&&selectedStatus==='bin'?'<button class="rq-tab active rq-bin-tag">Recycle Bin</button>':''}</div><div class="rq-search"><i class="fas fa-search"></i><input value="${esc(searchTerm)}" oninput="RequestsApp.search(this.value)" placeholder="Search requests..."></div></div>
        <div class="rq-list">${arr.length?arr.map(requestRow).join(''):emptyState()}</div>
      </section></div>
    </div>`;
    updateSidebarBadge(); requestAnimationFrame(updateTimers);
  }'''
s,n=re.subn(r"  function render\(\)\{.*?\n  function requestRow",render_new+"\n\n  function requestRow",s,count=1,flags=re.S)
if n!=1: raise SystemExit('render replacement failed')

# ----- row -----
row_new=r'''  function requestRow(r){
    const dueClass=isOverdue(r)?'overdue':isDueSoon(r)?'soon':'';
    const coll=requestCollabs(r.id),unread=hasUnread(r),actions=pendingActionCount(r),done=r.status==='closed';
    return `<article class="rq-row ${unread?'rq-unread':''}" data-priority="${esc(r.priority)}" onclick="RequestsApp.openDetail('${esc(r.id)}')"><div><div class="rq-row-title">${esc(r.title)}${unread?`<span class="rq-new-chip"><i class="fas fa-bell"></i>NEW</span>`:''}${actions?`<span class="rq-action-dot" title="Action required">${actions}</span>`:''}</div><div class="rq-row-meta"><span>${String(r.creator_id)===String(r.assignee_id)?'Personal task':'Requested by '+esc(nameOf(r.creator_id))}</span>${coll.length?`<span>+ ${coll.length} collaborator${coll.length>1?'s':''}</span>`:''}${((r.reference_links||[]).length||r.link_url)?'<span><i class="fas fa-link"></i> Reference</span>':''}<span class="rq-age" data-rq-age="${esc(r.created_at)}">${esc(elapsedText(r.created_at))}</span></div></div><div class="rq-person-cell rq-person-col">${avatar(r.assignee_id)}<span>${esc(nameOf(r.assignee_id))}</span></div><div class="rq-status-col"><span class="rq-chip status-${esc(r.status)}" style="${done?'background:#dcfce7;color:#15803d':r.status==='cancelled'?'background:#f3f4f6;color:#6b7280':'background:#fff7ed;color:#c2410c'}">${esc(statusLabel(r.status))}</span></div><div class="rq-due ${dueClass}">${r.due_at?`<span class="rq-live" data-rq-due="${esc(r.due_at)}"><i class="fas fa-clock"></i><span>${esc(rel(r.due_at))}</span></span>`:'No deadline'}<div class="text-[9px] text-gray-400 mt-1">${esc(r.due_at?fmtDate(r.due_at):'')}</div></div><div class="rq-priority rq-priority-col">${esc(priorityLabel(r.priority))}</div></article>`;
  }'''
s,n=re.subn(r"  function requestRow\(r\)\{.*?\n  function emptyState",row_new+"\n\n  function emptyState",s,count=1,flags=re.S)
if n!=1: raise SystemExit('requestRow replacement failed')

# ----- detail wording -----
s=s.replace('Created by ${esc(nameOf(r.creator_id))}', 'Requested by ${esc(nameOf(r.creator_id))}')
s=s.replace('Closed by you','Completed by you')

# ----- actions: no Start, no Blocked, direct complete -----
actions_new=r'''  function detailActions(r){
    if(r.deleted_at&&isAdmin())return `<button class="rq-btn" onclick="RequestsApp.restore('${esc(r.id)}')"><i class="fas fa-rotate-left"></i>Restore</button><button class="rq-btn rq-btn-danger" onclick="RequestsApp.permanentDelete('${esc(r.id)}')"><i class="fas fa-trash"></i>Delete permanently</button>`;
    const mine=String(r.assignee_id)===currentId()||requestCollabs(r.id).includes(currentId());
    if(isAdmin()) return `<button class="rq-btn" onclick="RequestsApp.edit('${esc(r.id)}')"><i class="fas fa-pen"></i>Edit</button>${['closed','cancelled'].includes(r.status)?`<button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','in_progress')"><i class="fas fa-rotate-left"></i>Reopen</button>`:`<button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','closed')"><i class="fas fa-check"></i>Mark Complete</button><button class="rq-btn" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','cancelled')">Cancel</button>`}<button class="rq-btn rq-btn-danger" onclick="RequestsApp.moveToBin('${esc(r.id)}')"><i class="fas fa-trash-can"></i></button>`;
    if(!mine)return '';
    if(r.status==='closed') return `<span class="text-xs text-emerald-600 font-bold mr-auto"><i class="fas fa-circle-check mr-1"></i>Completed by you</span>`;
    if(r.status==='cancelled') return `<span class="text-xs text-gray-500 font-bold mr-auto">Cancelled</span>`;
    return `<button class="rq-btn" onclick="RequestsApp.requestExtension('${esc(r.id)}')"><i class="fas fa-clock"></i>Extension</button><button class="rq-btn" onclick="RequestsApp.requestAssistance('${esc(r.id)}')"><i class="fas fa-user-plus"></i>Request Help</button><button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','closed')"><i class="fas fa-check"></i>Mark Done</button>${String(r.creator_id)===currentId()&&String(r.assignee_id)===currentId()?`<button class="rq-btn" onclick="RequestsApp.edit('${esc(r.id)}')"><i class="fas fa-pen"></i>Edit</button>`:''}`;
  }'''
s,n=re.subn(r"  function detailActions\(r\)\{.*?\n  \}",actions_new,s,count=1,flags=re.S)
if n!=1: raise SystemExit('detailActions replacement failed')

# ----- mark read immediately updates all badges -----
s=s.replace("    await markRead(id);\n", "    await markRead(id);\n    render();\n    updateSidebarBadge();\n", 1)

# ----- timer updater also shows elapsed age -----
old_timer="""  function updateTimers(){
    document.querySelectorAll('[data-rq-due]').forEach(el=>{const span=el.querySelector('span');if(span)span.textContent=timerText(el.dataset.rqDue);el.closest('.rq-due')?.classList.toggle('overdue',new Date(el.dataset.rqDue).getTime()<Date.now());});
    if(timerTick)clearInterval(timerTick);timerTick=setInterval(()=>{if(root&&!root.classList.contains('hidden'))document.querySelectorAll('[data-rq-due]').forEach(el=>{const span=el.querySelector('span');if(span)span.textContent=timerText(el.dataset.rqDue);});},1000);
  }"""
new_timer="""  function updateTimers(){
    const tick=()=>{document.querySelectorAll('[data-rq-due]').forEach(el=>{const span=el.querySelector('span');if(span)span.textContent=timerText(el.dataset.rqDue);el.closest('.rq-due')?.classList.toggle('overdue',new Date(el.dataset.rqDue).getTime()<Date.now());});document.querySelectorAll('[data-rq-age]').forEach(el=>el.textContent=elapsedText(el.dataset.rqAge));};
    tick(); if(timerTick)clearInterval(timerTick);timerTick=setInterval(()=>{if(root&&!root.classList.contains('hidden'))tick();},1000);
  }"""
if old_timer in s:s=s.replace(old_timer,new_timer,1)

# ----- creator should never receive a false unread badge for their own newly-created request -----
marker="    if(typeof recordActivity==='function')recordActivity(id?'request_updated':'request_created','work_request',id||data?.id,{title,assignee_id});closeModal();await reload();\n"
if marker in s and "work_request_reads').upsert" not in s[s.find(marker)-350:s.find(marker)+350]:
    repl="    if(!id&&data?.id){try{await supabaseClient.from('work_request_reads').upsert({request_id:data.id,user_id:state.currentUser.id,last_seen_at:new Date().toISOString()},{onConflict:'request_id,user_id'});}catch(_){ }}\n"+marker
    s=s.replace(marker,repl,1)

# ----- API -----
ret=re.search(r"return \{open,render,selectUser,setStatus,search,openCreate:\(\)=>createForm\(\),saveRequest,openDetail,closeModal,edit,setRequestStatus,addComment,requestExtension,submitExtension,requestAssistance,submitAssistance,reviewChange,moveToBin,restore,permanentDelete,openBin,setAssignee,setDuePreset,setDueFlexible,addReferenceRow\};",s)
if ret:
    s=s[:ret.start()]+ret.group(0).replace('addReferenceRow};','addReferenceRow,setCompletedRange,updateSidebarBadge};')+s[ret.end():]
elif 'setCompletedRange,updateSidebarBadge' not in s:
    raise SystemExit('Requests API export marker missing')

p.write_text(s,encoding='utf-8')
print('Requests v3 patch applied')