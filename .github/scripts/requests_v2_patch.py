from pathlib import Path
import re

p=Path('js/requests.js')
s=p.read_text(encoding='utf-8')

# state
s=s.replace("  let history = [];\n", "  let history = [];\n  let reads = [];\n  let commentEvents = [];\n  let timerTick = null;\n  let createAssigneeId = '';\n", 1)

# activity helpers
needle="  const activeStatuses = ['new','in_progress','submitted','blocked'];\n"
insert="""  const activeStatuses = ['new','in_progress','submitted','blocked'];
  const readFor = id => reads.find(x=>String(x.request_id)===String(id)&&String(x.user_id)===currentId());
  const latestActivityAt = r => {
    const times=[r.updated_at||r.created_at];
    changeRequests.filter(x=>String(x.request_id)===String(r.id)).forEach(x=>times.push(x.reviewed_at||x.created_at));
    commentEvents.filter(x=>String(x.request_id)===String(r.id)).forEach(x=>times.push(x.created_at));
    return Math.max(...times.filter(Boolean).map(x=>new Date(x).getTime()).filter(Number.isFinite));
  };
  const hasUnread = r => { const seen=readFor(r.id)?.last_seen_at; return !seen || latestActivityAt(r) > new Date(seen).getTime()+500; };
  const pendingActionCount = r => changeRequests.filter(x=>String(x.request_id)===String(r.id)&&x.status==='pending'&&(isAdmin()||String(x.requester_id)!==currentId())).length;
"""
if needle not in s: raise SystemExit('activeStatuses marker missing')
s=s.replace(needle,insert,1)

# load reads + comments timestamps
old="""    const [{data:r,error:re},{data:c},{data:ch}]=await Promise.all([
      q,
      supabaseClient.from('work_request_collaborators').select('*'),
      supabaseClient.from('work_request_change_requests').select('*').order('created_at',{ascending:false})
    ]);
    if(re) throw re;
    requests=r||[]; collaborators=c||[]; changeRequests=ch||[];
"""
new="""    const [{data:r,error:re},{data:c},{data:ch},{data:rd},{data:ce}]=await Promise.all([
      q,
      supabaseClient.from('work_request_collaborators').select('*'),
      supabaseClient.from('work_request_change_requests').select('*').order('created_at',{ascending:false}),
      supabaseClient.from('work_request_reads').select('*').eq('user_id',currentId()),
      supabaseClient.from('work_request_comments').select('request_id,created_at').order('created_at',{ascending:false})
    ]);
    if(re) throw re;
    requests=r||[]; collaborators=c||[]; changeRequests=ch||[]; reads=rd||[]; commentEvents=ce||[];
"""
if old not in s: raise SystemExit('loadData marker missing')
s=s.replace(old,new,1)

# CSS additions
css_marker="      .rq-bin-tag{background:#fee2e2;color:#b91c1c}.rq-notice{font-size:11px;padding:10px 12px;border-radius:12px;background:#eff6ff;color:#1d4ed8}.dark .rq-notice{background:#0f1b35;color:#93c5fd}\n"
css_add=css_marker+"""      .rq-row.rq-unread{border-color:color-mix(in srgb,var(--accent) 45%,#e5e7eb);box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 8%,transparent)}.rq-action-badge{margin-left:7px;display:inline-flex;min-width:20px;height:20px;padding:0 6px;border-radius:999px;align-items:center;justify-content:center;background:var(--accent);color:white;font-size:9px;font-weight:900;vertical-align:middle}.rq-live{display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums;padding:5px 8px;border-radius:9px;background:#f8fafc}.dark .rq-live{background:#111827}.rq-stat.notify{background:color-mix(in srgb,var(--accent) 8%,#f8fafc)}.rq-stat.notify .v{color:var(--accent)}
      .rq-assignee-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.rq-assignee-card{border:1px solid #e5e7eb;border-radius:14px;padding:10px;background:#fff;display:flex;align-items:center;gap:9px;text-align:left;transition:.15s}.rq-assignee-card:hover{border-color:#cbd5e1;transform:translateY(-1px)}.rq-assignee-card.active{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent);background:color-mix(in srgb,var(--accent) 4%,#fff)}.dark .rq-assignee-card{background:#101722;border-color:#263043}.rq-assignee-card .rq-avatar{width:36px;height:36px}.rq-assignee-card strong{font-size:11px;display:block}.rq-assignee-card small{font-size:9px;color:#94a3b8;display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:125px}
      .rq-deadline-box{border:1px solid #e5e7eb;border-radius:16px;padding:12px;background:#fafbfc}.dark .rq-deadline-box{background:#0f1621;border-color:#263043}.rq-quick-times{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.rq-time-chip{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800}.rq-time-chip:hover{border-color:var(--accent);color:var(--accent)}.dark .rq-time-chip{background:#111827;border-color:#263043}.rq-duration-line{display:grid;grid-template-columns:84px 110px 1fr;gap:8px;align-items:center}.rq-ref-list{display:grid;gap:7px}.rq-ref-row{display:flex;gap:7px}.rq-ref-row input{flex:1}.rq-ref-row button{width:38px;justify-content:center;padding:0}.rq-self-badge{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--accent) 35%,#e5e7eb);border-radius:14px;background:color-mix(in srgb,var(--accent) 5%,#fff)}.dark .rq-self-badge{background:#101722}
"""
if css_marker not in s: raise SystemExit('CSS marker missing')
s=s.replace(css_marker,css_add,1)

# scope filters: attention
scope_m=re.search(r"  function scopeRequests\(\)\{.*?\n  \}",s,re.S)
if not scope_m: raise SystemExit('scopeRequests missing')
scope=scope_m.group(0)
if "selectedStatus==='attention'" not in scope:
    scope=scope.replace("    if(selectedStatus==='closed') arr=arr.filter(r=>r.status==='closed');", "    if(selectedStatus==='attention') arr=arr.filter(r=>isOverdue(r)||r.status==='blocked'||r.status==='submitted'||pendingActionCount(r)>0);\n    if(selectedStatus==='closed') arr=arr.filter(r=>r.status==='closed');")
    s=s[:scope_m.start()]+scope+s[scope_m.end():]

# render
render_new=r'''  function render(){
    ensureView();
    const c=counts(), arr=scopeRequests();
    const scoped=requests.filter(r=>!r.deleted_at&&(isAdmin()||r.assignee_id===currentId()||r.creator_id===currentId()||requestCollabs(r.id).includes(currentId())));
    const unreadCount=scoped.filter(hasUnread).length;
    const actionCount=scoped.reduce((n,r)=>n+pendingActionCount(r),0);
    const attentionCount=scoped.filter(r=>isOverdue(r)||r.status==='blocked'||r.status==='submitted'||pendingActionCount(r)>0).length;
    const people=isAdmin()?directory.filter(p=>p.role!=='admin'||String(p.id)===currentId()):directory.filter(p=>String(p.id)===currentId());
    root.innerHTML=`<div class="rq-shell">
      <section class="rq-command">
        <div><div class="rq-eyebrow">TAAMEER WORK REQUESTS</div><div class="rq-title">Keep requests moving.</div><div class="rq-sub">Requests, personal tasks, deadlines and actions — without mixing them into Team Updates.</div></div>
        <div class="rq-command-actions">${isAdmin()?`<button class="rq-btn rq-btn-ghost text-white border-white/15" onclick="RequestsApp.openBin()"><i class="fas fa-trash-can"></i> Bin</button><button class="rq-btn rq-btn-dark" onclick="RequestsApp.openCreate()"><i class="fas fa-plus"></i> New Request</button>`:`<button class="rq-btn rq-btn-dark" onclick="RequestsApp.openCreate()"><i class="fas fa-plus"></i> New Personal Task</button>`}</div>
      </section>
      <div class="rq-people-wrap"><div class="rq-people">
        ${isAdmin()?`<button class="rq-person ${selectedUser==='all'?'active':''}" onclick="RequestsApp.selectUser('all')"><div class="rq-avatar rq-avatar-fallback"><i class="fas fa-users"></i></div><div><div class="rq-person-name">Whole team</div><div class="rq-person-role">Department view</div></div><div class="count">${requests.filter(r=>!r.deleted_at&&activeStatuses.includes(r.status)).length}</div></button>`:''}
        ${people.map(p=>`<button class="rq-person ${selectedUser===String(p.id)?'active':''}" onclick="RequestsApp.selectUser('${esc(p.id)}')">${avatar(p.id)}<div><div class="rq-person-name">${esc(p.full_name)}</div><div class="rq-person-role">${esc(p.job_title||'Team member')}</div></div><div class="count">${userRequestCount(p.id)}</div></button>`).join('')}
      </div></div>
      <div class="rq-workspace"><section class="rq-panel">
        <div class="rq-summary">
          <div class="rq-stat"><div class="v">${c.open}</div><div class="l">Open</div></div>
          <div class="rq-stat"><div class="v">${c.due}</div><div class="l">Due soon</div></div>
          <div class="rq-stat alert"><div class="v">${c.overdue}</div><div class="l">Overdue</div></div>
          <div class="rq-stat ${attentionCount||actionCount?'review':''}"><div class="v">${attentionCount}</div><div class="l">Needs attention${actionCount?` · ${actionCount} action${actionCount>1?'s':''}`:''}</div></div>
          <div class="rq-stat ${unreadCount?'notify':''}"><div class="v"><i class="fas fa-bell text-sm mr-1"></i>${unreadCount}</div><div class="l">New updates</div></div>
        </div>
        <div class="rq-toolbar"><div class="rq-tabs">${[['active','Open'],['attention','Needs attention'],['closed','Closed'],['cancelled','Cancelled']].map(x=>`<button class="rq-tab ${selectedStatus===x[0]?'active':''}" onclick="RequestsApp.setStatus('${x[0]}')">${x[1]}</button>`).join('')}${isAdmin()&&selectedStatus==='bin'?'<button class="rq-tab active rq-bin-tag">Recycle Bin</button>':''}</div><div class="rq-search"><i class="fas fa-search"></i><input value="${esc(searchTerm)}" oninput="RequestsApp.search(this.value)" placeholder="Search requests..."></div></div>
        <div class="rq-list">${arr.length?arr.map(requestRow).join(''):emptyState()}</div>
      </section></div>
    </div>`;
    requestAnimationFrame(updateTimers);
  }
'''
s,n=re.subn(r"  function render\(\)\{.*?\n  function requestRow",render_new+"\n  function requestRow",s,count=1,flags=re.S)
if n!=1: raise SystemExit('render replacement failed')

# request row
row_new=r'''  function requestRow(r){
    const dueClass=isOverdue(r)?'overdue':isDueSoon(r)?'soon':'';
    const coll=requestCollabs(r.id), unread=hasUnread(r), actions=pendingActionCount(r);
    return `<article class="rq-row ${unread?'rq-unread':''}" data-priority="${esc(r.priority)}" onclick="RequestsApp.openDetail('${esc(r.id)}')">
      <div><div class="rq-row-title">${esc(r.title)}${unread?`<span class="rq-action-badge" title="New activity"><i class="fas fa-bell"></i>${actions?` ${actions}`:''}</span>`:actions?`<span class="rq-action-badge" title="Action required">${actions}</span>`:''}</div><div class="rq-row-meta"><span>${r.creator_id===r.assignee_id?'Personal task':'Manager request'}</span>${coll.length?`<span>+ ${coll.length} collaborator${coll.length>1?'s':''}</span>`:''}${((r.reference_links||[]).length||r.link_url)?'<span><i class="fas fa-link"></i> Reference</span>':''}</div></div>
      <div class="rq-person-cell rq-person-col">${avatar(r.assignee_id)}<span>${esc(nameOf(r.assignee_id))}</span></div>
      <div class="rq-status-col"><span class="rq-chip status-${esc(r.status)}">${esc(r.status==='submitted'?'Needs action':statusLabel(r.status))}</span></div>
      <div class="rq-due ${dueClass}">${r.due_at?`<span class="rq-live" data-rq-due="${esc(r.due_at)}"><i class="fas fa-clock"></i><span>${esc(rel(r.due_at))}</span></span>`:'No deadline'}<div class="text-[9px] text-gray-400 mt-1">${esc(r.due_at?fmtDate(r.due_at):'')}</div></div>
      <div class="rq-priority rq-priority-col">${esc(priorityLabel(r.priority))}</div>
    </article>`;
  }
'''
s,n=re.subn(r"  function requestRow\(r\)\{.*?\n  function emptyState",row_new+"\n  function emptyState",s,count=1,flags=re.S)
if n!=1: raise SystemExit('row replacement failed')

# create/save
create_new=r'''  function setAssignee(id){
    createAssigneeId=String(id||'');
    document.querySelectorAll('.rq-assignee-card').forEach(x=>x.classList.toggle('active',x.dataset.id===createAssigneeId));
  }
  function setDuePreset(hours){
    const el=document.getElementById('rqDue'); if(!el)return;
    const d=new Date(Date.now()+Number(hours)*3600000); d.setSeconds(0,0);
    el.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  function setDueFlexible(){
    const qty=Math.max(1,Number(document.getElementById('rqDueQty')?.value||1));
    const unit=document.getElementById('rqDueUnit')?.value||'days';
    setDuePreset(unit==='hours'?qty:unit==='weeks'?qty*168:qty*24);
  }
  function addReferenceRow(value=''){
    const host=document.getElementById('rqRefs'); if(!host)return;
    const row=document.createElement('div');row.className='rq-ref-row';
    row.innerHTML=`<input class="rq-input rq-ref-input" type="url" placeholder="https://..." value="${esc(value)}"><button type="button" class="rq-btn" onclick="this.parentElement.remove()"><i class="fas fa-xmark"></i></button>`;
    host.appendChild(row);
  }
  function createForm(r=null){
    const editing=!!r;
    createAssigneeId=String(r?.assignee_id||(isAdmin()?'':currentId()));
    const localDue=r?.due_at?new Date(new Date(r.due_at).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';
    const refs=Array.isArray(r?.reference_links)&&r.reference_links.length?r.reference_links:(r?.link_url?[r.link_url]:[]);
    const members=directory.filter(p=>p.status!=='inactive'&&p.role!=='admin');
    modal(`<div class="rq-modal-card"><div class="rq-modal-head"><div><div class="rq-eyebrow">${editing?'EDIT REQUEST':isAdmin()?'NEW REQUEST':'NEW PERSONAL TASK'}</div><h3 class="text-xl font-bold mt-1">${editing?'Update the request':isAdmin()?'Assign it clearly.':'Capture it before you forget it.'}</h3><p class="text-xs text-gray-400 mt-1">Clear owner, flexible deadline, useful references. Nothing extra.</p></div><button class="rq-btn rq-btn-ghost text-white border-white/10" onclick="RequestsApp.closeModal()"><i class="fas fa-times"></i></button></div>
      <form id="rqCreateForm" class="rq-modal-body space-y-4"><div class="rq-field"><label>${isAdmin()?'Request':'Task'}</label><input id="rqTitle" class="rq-input" maxlength="220" required value="${esc(r?.title||'')}" placeholder="What needs to be done?"></div><div class="rq-field"><label>Details</label><textarea id="rqDetails" class="rq-textarea" placeholder="Useful context and expected result...">${esc(r?.details||'')}</textarea></div>
      ${isAdmin()?`<div class="rq-field"><label>Assigned to</label><div class="rq-assignee-grid">${members.map(p=>`<button type="button" data-id="${esc(p.id)}" class="rq-assignee-card ${createAssigneeId===String(p.id)?'active':''}" onclick="RequestsApp.setAssignee('${esc(p.id)}')">${avatar(p.id)}<span><strong>${esc(p.full_name)}</strong><small>${esc(p.job_title||'Team member')}</small></span></button>`).join('')}</div></div>`:`<div class="rq-field"><label>Owner</label><div class="rq-self-badge">${avatar(currentId())}<div><div class="text-xs font-bold">${esc(nameOf(currentId()))}</div><div class="text-[10px] text-gray-400">Personal task · visible to your manager</div></div></div></div>`}
      <div class="rq-grid2"><div class="rq-field"><label>Priority</label><select id="rqPriority" class="rq-select"><option value="normal" ${!r||r?.priority==='normal'?'selected':''}>Normal</option><option value="high" ${r?.priority==='high'?'selected':''}>High</option><option value="urgent" ${r?.priority==='urgent'?'selected':''}>Urgent</option></select></div><div class="rq-field"><label>Deadline</label><div class="rq-deadline-box"><div class="rq-quick-times"><button type="button" class="rq-time-chip" onclick="RequestsApp.setDuePreset(4)">4 hours</button><button type="button" class="rq-time-chip" onclick="RequestsApp.setDuePreset(8)">8 hours</button><button type="button" class="rq-time-chip" onclick="RequestsApp.setDuePreset(24)">1 day</button><button type="button" class="rq-time-chip" onclick="RequestsApp.setDuePreset(48)">2 days</button><button type="button" class="rq-time-chip" onclick="RequestsApp.setDuePreset(72)">3 days</button><button type="button" class="rq-time-chip" onclick="RequestsApp.setDuePreset(168)">1 week</button><button type="button" class="rq-time-chip" onclick="RequestsApp.setDuePreset(336)">2 weeks</button></div><div class="rq-duration-line"><input id="rqDueQty" class="rq-input" type="number" min="1" value="1"><select id="rqDueUnit" class="rq-select"><option value="hours">Hours</option><option value="days" selected>Days</option><option value="weeks">Weeks</option></select><button type="button" class="rq-btn" onclick="RequestsApp.setDueFlexible()">Apply duration</button></div><input id="rqDue" class="rq-input mt-2" type="datetime-local" value="${esc(localDue)}"></div></div></div>
      <div class="rq-field"><div class="flex items-center justify-between mb-2"><label class="!mb-0">Reference links</label><button type="button" class="rq-btn py-2" onclick="RequestsApp.addReferenceRow()"><i class="fas fa-plus"></i>Add link</button></div><div id="rqRefs" class="rq-ref-list">${(refs.length?refs:['']).map(v=>`<div class="rq-ref-row"><input class="rq-input rq-ref-input" type="url" placeholder="https://..." value="${esc(v)}"><button type="button" class="rq-btn" onclick="this.parentElement.remove()"><i class="fas fa-xmark"></i></button></div>`).join('')}</div></div><div class="rq-notice"><i class="fas fa-bell mr-2"></i>Deadline reminders and request actions stay inside Requests. Team Updates remains for announcements.</div></form><div class="rq-modal-foot"><button class="rq-btn" onclick="RequestsApp.closeModal()">Cancel</button><button class="rq-btn rq-btn-accent" onclick="RequestsApp.saveRequest('${esc(r?.id||'')}')"><i class="fas fa-check"></i>${editing?'Save Changes':isAdmin()?'Create Request':'Create Task'}</button></div></div>`);
  }
  async function saveRequest(id=''){
    const title=document.getElementById('rqTitle')?.value.trim(),details=document.getElementById('rqDetails')?.value.trim()||'',assignee_id=isAdmin()?createAssigneeId:currentId(),priority=document.getElementById('rqPriority')?.value||'normal',dueRaw=document.getElementById('rqDue')?.value;
    const reference_links=[...document.querySelectorAll('.rq-ref-input')].map(x=>x.value.trim()).filter(Boolean);
    if(!title||!assignee_id)return alert(isAdmin()?'Please add a request and choose who owns it.':'Please add a task title.');
    const payload={title,details,assignee_id,priority,due_at:dueRaw?new Date(dueRaw).toISOString():null,reference_links,link_url:reference_links[0]||null};
    let error,data;if(id){({error}=await supabaseClient.from('work_requests').update(payload).eq('id',id));}else{({data,error}=await supabaseClient.from('work_requests').insert({...payload,creator_id:state.currentUser.id,status:'new'}).select().single());}
    if(error)return alert(error.message||'Could not save request.');
    if(typeof recordActivity==='function')recordActivity(id?'request_updated':'request_created','work_request',id||data?.id,{title,assignee_id});closeModal();await reload();
  }
'''
s,n=re.subn(r"  function createForm\(r=null\)\{.*?\n  async function openDetail",create_new+"\n  async function openDetail",s,count=1,flags=re.S)
if n!=1: raise SystemExit('createForm replacement failed')

# mark read on open
s=s.replace("  async function openDetail(id){\n    selectedRequestId=id;\n", "  async function openDetail(id){\n    selectedRequestId=id;\n    await markRead(id);\n",1)

# multi links in detail
s=re.sub(r"\$\{r\.link_url\?`<a href=\\\"\$\{esc\(r\.link_url\)\}\\\".*?</a>`:''\}", "${(()=>{const links=Array.isArray(r.reference_links)&&r.reference_links.length?r.reference_links:(r.link_url?[r.link_url]:[]);return links.length?`<div class=\"mt-3 flex flex-wrap gap-2\">${links.map((u,i)=>`<a href=\"${esc(u)}\" target=\"_blank\" rel=\"noopener\" class=\"rq-chip text-[var(--accent)]\"><i class=\"fas fa-arrow-up-right-from-square\"></i> Reference ${i+1}</a>`).join('')}</div>`:'';})()}",s,count=1,flags=re.S)

# actions: no review; direct done; manager can reopen
actions_new=r'''  function detailActions(r){
    if(r.deleted_at&&isAdmin())return `<button class="rq-btn" onclick="RequestsApp.restore('${esc(r.id)}')"><i class="fas fa-rotate-left"></i>Restore</button><button class="rq-btn rq-btn-danger" onclick="RequestsApp.permanentDelete('${esc(r.id)}')"><i class="fas fa-trash"></i>Delete permanently</button>`;
    const mine=r.assignee_id===currentId()||requestCollabs(r.id).includes(currentId());
    if(isAdmin()) return `<button class="rq-btn" onclick="RequestsApp.edit('${esc(r.id)}')"><i class="fas fa-pen"></i>Edit</button>${['closed','cancelled'].includes(r.status)?`<button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','in_progress')"><i class="fas fa-rotate-left"></i>Reopen</button>`:`<button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','closed')"><i class="fas fa-check"></i>Close</button><button class="rq-btn" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','cancelled')">Cancel</button>`}<button class="rq-btn rq-btn-danger" onclick="RequestsApp.moveToBin('${esc(r.id)}')"><i class="fas fa-trash-can"></i></button>`;
    if(!mine)return '';
    if(r.status==='closed') return `<span class="text-xs text-emerald-600 font-bold mr-auto"><i class="fas fa-circle-check mr-1"></i>Closed by you</span>`;
    return `${r.status==='new'?`<button class="rq-btn" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','in_progress')"><i class="fas fa-play"></i>Start</button>`:''}${['new','in_progress','blocked','submitted'].includes(r.status)?`<button class="rq-btn" onclick="RequestsApp.requestExtension('${esc(r.id)}')"><i class="fas fa-clock"></i>Extension</button><button class="rq-btn" onclick="RequestsApp.requestAssistance('${esc(r.id)}')"><i class="fas fa-user-plus"></i>Request Help</button><button class="rq-btn" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','blocked')">Blocked</button><button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','closed')"><i class="fas fa-check"></i>Mark Done</button>`:''}${r.creator_id===currentId()&&r.assignee_id===currentId()?`<button class="rq-btn" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','cancelled')">Cancel task</button>`:''}`;
  }
'''
s,n=re.subn(r"  function detailActions\(r\)\{.*?\n  async function setRequestStatus",actions_new+"\n  async function setRequestStatus",s,count=1,flags=re.S)
if n!=1: raise SystemExit('detailActions replacement failed')

# status history + timestamps
status_pat=r"  async function setRequestStatus\(id,status\)\{.*?\n  \}"
status_new="""  async function setRequestStatus(id,status){
    const payload={status};
    if(status==='closed')payload.closed_at=new Date().toISOString();
    if(status==='cancelled')payload.cancelled_at=new Date().toISOString();
    if(status==='in_progress'){payload.closed_at=null;payload.cancelled_at=null;payload.submitted_at=null;}
    const {error}=await supabaseClient.from('work_requests').update(payload).eq('id',id);if(error)return alert(error.message);
    await supabaseClient.from('work_request_history').insert({request_id:id,actor_id:state.currentUser.id,action:'status_changed',details:{to:status}});
    if(typeof recordActivity==='function')recordActivity('request_status_changed','work_request',id,{status});closeModal();await reload();
  }"""
s,n=re.subn(status_pat,status_new,s,count=1,flags=re.S)
if n!=1: raise SystemExit('status replacement failed')

# read + timers
helper_marker="  function selectUser(id){selectedUser=id;render();}\n"
helpers=r'''  async function markRead(id){
    if(!state.currentUser||!id)return;const now=new Date().toISOString();
    try{await supabaseClient.from('work_request_reads').upsert({request_id:id,user_id:state.currentUser.id,last_seen_at:now},{onConflict:'request_id,user_id'});reads=reads.filter(x=>String(x.request_id)!==String(id)||String(x.user_id)!==currentId());reads.push({request_id:id,user_id:state.currentUser.id,last_seen_at:now});}catch(_){ }
  }
  function timerText(iso){
    const diff=new Date(iso).getTime()-Date.now(),past=diff<0,a=Math.abs(diff);const d=Math.floor(a/86400000),h=Math.floor((a%86400000)/3600000),m=Math.floor((a%3600000)/60000),sec=Math.floor((a%60000)/1000);const parts=[];if(d)parts.push(`${d}d`);if(h||d)parts.push(`${h}h`);parts.push(`${m}m`);if(a<86400000)parts.push(`${sec}s`);return `${past?'Overdue':'Due in'} ${parts.slice(0,3).join(' ')}`;
  }
  function updateTimers(){
    document.querySelectorAll('[data-rq-due]').forEach(el=>{const span=el.querySelector('span');if(span)span.textContent=timerText(el.dataset.rqDue);});if(timerTick)clearInterval(timerTick);timerTick=setInterval(()=>{if(root&&!root.classList.contains('hidden'))document.querySelectorAll('[data-rq-due]').forEach(el=>{const span=el.querySelector('span');if(span)span.textContent=timerText(el.dataset.rqDue);});},1000);
  }
'''
if helper_marker not in s: raise SystemExit('selectUser marker missing')
s=s.replace(helper_marker,helpers+"\n"+helper_marker,1)

# export methods
old_ret="return {open,render,selectUser,setStatus,search,openCreate:()=>createForm(),saveRequest,openDetail,closeModal,edit,setRequestStatus,addComment,requestExtension,submitExtension,requestAssistance,submitAssistance,reviewChange,moveToBin,restore,permanentDelete,openBin};"
new_ret="return {open,render,selectUser,setStatus,search,openCreate:()=>createForm(),saveRequest,openDetail,closeModal,edit,setRequestStatus,addComment,requestExtension,submitExtension,requestAssistance,submitAssistance,reviewChange,moveToBin,restore,permanentDelete,openBin,setAssignee,setDuePreset,setDueFlexible,addReferenceRow};"
if old_ret not in s: raise SystemExit('return marker missing')
s=s.replace(old_ret,new_ret,1)

p.write_text(s,encoding='utf-8')

idx=Path('index.html')
x=idx.read_text(encoding='utf-8')
x=re.sub(r'<script src="js/requests\.js(?:\?[^\"]*)?"></script>','<script src="js/requests.js?v=20260912-v11"></script>',x,count=1)
idx.write_text(x,encoding='utf-8')
print('Requests v2 patch complete')
