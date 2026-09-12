// ---------- Requests — lightweight team accountability ----------
window.RequestsApp = (() => {
  let root = null;
  let directory = [];
  let requests = [];
  let collaborators = [];
  let changeRequests = [];
  let comments = [];
  let history = [];
  let reads = [];
  let commentEvents = [];
  let timerTick = null;
  let createAssigneeId = '';
  let selectedUser = 'all';
  let selectedStatus = 'active';
  let searchTerm = '';
  let completedRange = 'month';
  let selectedRequestId = null;
  let realtime = null;
  let backgroundStarted = false;
  let reminderTimer = null;

  const esc = s => Utils.escapeHTML(String(s ?? ''));
  const currentId = () => String(state.currentUser?.id || '');
  const isAdmin = () => state.currentUser?.role === 'admin';
  const person = id => directory.find(x => String(x.id) === String(id));
  const nameOf = id => person(id)?.full_name || (String(id) === currentId() ? state.currentUser?.fullName : 'Team member');
  const initials = name => String(name || 'Team member').trim().split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase();
  const avatar = (id, cls='rq-avatar') => {
    const p = person(id), n = p?.full_name || nameOf(id);
    return p?.avatar ? `<img class="${cls}" src="${esc(p.avatar)}" alt="">` : `<div class="${cls} rq-avatar-fallback">${esc(initials(n))}</div>`;
  };
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : 'No deadline';
  const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'No deadline';
  const rel = iso => {
    if(!iso) return 'No deadline';
    const ms = new Date(iso).getTime()-Date.now(), a=Math.abs(ms), d=Math.ceil(a/86400000), h=Math.ceil(a/3600000);
    if(ms < 0) return a < 86400000 ? `${h}h overdue` : `${d}d overdue`;
    if(a < 86400000) return `Due in ${h}h`;
    return `Due in ${d}d`;
  };
  const priorityLabel = p => ({normal:'Normal',high:'High',urgent:'Urgent'})[p] || 'Normal';
  const statusLabel = s => ({new:'Open',in_progress:'Open',submitted:'Completed',blocked:'Open',closed:'Completed',cancelled:'Cancelled'})[s] || s;
  const activeStatuses = ['new','in_progress'];
  const readFor = id => reads.find(x=>String(x.request_id)===String(id)&&String(x.user_id)===currentId());
  const latestActivityAt = r => {
    const times=[r.updated_at||r.created_at];
    changeRequests.filter(x=>String(x.request_id)===String(r.id)).forEach(x=>times.push(x.reviewed_at||x.created_at));
    commentEvents.filter(x=>String(x.request_id)===String(r.id)).forEach(x=>times.push(x.created_at));
    return Math.max(...times.filter(Boolean).map(x=>new Date(x).getTime()).filter(Number.isFinite));
  };
  const hasUnread = r => { const seen=readFor(r.id)?.last_seen_at; return !seen || latestActivityAt(r) > new Date(seen).getTime()+500; };
  const pendingActionCount = r => changeRequests.filter(x=>String(x.request_id)===String(r.id)&&x.status==='pending'&&(isAdmin()||String(x.requester_id)!==currentId())).length;
  const isOverdue = r => !!r.due_at && !['closed','cancelled'].includes(r.status) && new Date(r.due_at).getTime() < Date.now();
  const isDueSoon = r => !!r.due_at && activeStatuses.includes(r.status) && new Date(r.due_at).getTime() >= Date.now() && new Date(r.due_at).getTime()-Date.now() <= 48*3600000;

  function ensureStyle(){
    if(document.getElementById('requestsStyles')) return;
    const s=document.createElement('style'); s.id='requestsStyles'; s.textContent=`
      #view-requests{height:100%;overflow:hidden;padding:0!important;background:#f5f6f8}.dark #view-requests{background:#06080d}
      .rq-shell{height:100%;display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;color:#111827}.dark .rq-shell{color:#f8fafc}
      .rq-command{margin:18px 22px 0;padding:18px 20px;border-radius:24px;background:linear-gradient(110deg,#030712 0%,#111827 58%,color-mix(in srgb,var(--accent) 70%,#111827) 100%);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 18px 50px rgba(3,7,18,.16)}
      .rq-eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#94a3b8;font-weight:800}.rq-title{font-size:27px;line-height:1.1;font-weight:800;margin-top:5px}.rq-sub{font-size:12px;color:#a8b2c1;margin-top:6px}.rq-command-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.rq-btn{border:1px solid #e5e7eb;background:#fff;color:#111827;border-radius:12px;padding:10px 14px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:8px}.rq-btn:hover{background:#f8fafc}.rq-btn-dark{background:#fff;color:#030712;border-color:#fff}.rq-btn-accent{background:var(--accent);border-color:var(--accent);color:#fff}.rq-btn-danger{color:#dc2626;background:#fff;border-color:#fecaca}.rq-btn-ghost{background:transparent;color:inherit}.dark .rq-btn{background:#111827;border-color:#263043;color:#f8fafc}.dark .rq-btn-dark{background:#fff;color:#030712}
      .rq-people-wrap{padding:14px 22px 10px;overflow-x:auto}.rq-people{display:flex;gap:10px;min-width:max-content}.rq-person{appearance:none;border:1px solid #e5e7eb;background:#fff;border-radius:17px;padding:9px 12px 9px 9px;display:flex;align-items:center;gap:9px;min-width:160px;text-align:left;transition:.18s}.rq-person:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(15,23,42,.07)}.rq-person.active{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 16%,transparent)}.dark .rq-person{background:#0c111b;border-color:#202938}.rq-person .count{margin-left:auto;min-width:25px;height:25px;padding:0 7px;border-radius:999px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}.dark .rq-person .count{background:#182131}.rq-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:0 0 auto}.rq-avatar-fallback{background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}.dark .rq-avatar-fallback{background:#e5e7eb;color:#111827}.rq-person-name{font-size:12px;font-weight:800;white-space:nowrap}.rq-person-role{font-size:10px;color:#94a3b8;margin-top:2px;max-width:95px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rq-workspace{min-height:0;padding:0 22px 20px;display:grid;grid-template-columns:1fr;overflow:hidden}.rq-panel{min-height:0;background:#fff;border:1px solid #e5e7eb;border-radius:24px;display:grid;grid-template-rows:auto auto 1fr;overflow:hidden}.dark .rq-panel{background:#0a0f18;border-color:#202938}.rq-summary{padding:16px 18px;border-bottom:1px solid #eef0f3;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.dark .rq-summary{border-color:#1e2633}.rq-stat{padding:12px 14px;border-radius:16px;background:#f8fafc;min-width:0}.dark .rq-stat{background:#101722}.rq-stat .v{font-size:22px;font-weight:800;line-height:1}.rq-stat .l{font-size:10px;color:#7c8798;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}.rq-stat.alert .v{color:#dc2626}.rq-stat.review .v{color:#7c3aed}
      .rq-toolbar{padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #eef0f3}.dark .rq-toolbar{border-color:#1e2633}.rq-tabs{display:flex;gap:5px;flex-wrap:wrap}.rq-tab{border:0;background:transparent;padding:8px 11px;border-radius:10px;font-size:11px;font-weight:700;color:#64748b}.rq-tab.active{background:#030712;color:#fff}.dark .rq-tab.active{background:#f8fafc;color:#030712}.rq-search{position:relative;max-width:300px;flex:1}.rq-search input{width:100%;border:1px solid #e5e7eb;background:#f8fafc;border-radius:11px;padding:9px 12px 9px 33px;font-size:11px;outline:none}.rq-search i{position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:11px;color:#94a3b8}.dark .rq-search input{background:#101722;border-color:#263043;color:#fff}
      .rq-list{overflow:auto;padding:10px 12px 18px}.rq-row{display:grid;grid-template-columns:minmax(260px,1.7fr) 150px 130px 125px 96px;gap:12px;align-items:center;padding:13px 12px;border:1px solid #e8ebef;border-radius:16px;margin-bottom:8px;background:#fff;cursor:pointer;transition:.15s;position:relative}.rq-row:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(15,23,42,.06)}.dark .rq-row{background:#0d131d;border-color:#202938}.rq-row:before{content:'';position:absolute;left:0;top:13px;bottom:13px;width:3px;border-radius:0 4px 4px 0;background:#94a3b8}.rq-row[data-priority=high]:before{background:#f59e0b}.rq-row[data-priority=urgent]:before{background:#ef4444}.rq-row-title{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rq-row-meta{font-size:10px;color:#8a95a5;margin-top:4px;display:flex;gap:7px;align-items:center;flex-wrap:wrap}.rq-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:10px;font-weight:750;white-space:nowrap}.dark .rq-chip{background:#182131;color:#cbd5e1}.rq-chip.status-submitted{background:#ede9fe;color:#6d28d9}.rq-chip.status-blocked{background:#fff1f2;color:#be123c}.rq-chip.status-closed{background:#ecfdf5;color:#047857}.rq-chip.status-cancelled{background:#f1f5f9;color:#64748b}.rq-due{font-size:11px;font-weight:700}.rq-due.overdue{color:#dc2626}.rq-due.soon{color:#d97706}.rq-person-cell{display:flex;align-items:center;gap:7px;min-width:0}.rq-person-cell .rq-avatar{width:28px;height:28px}.rq-person-cell span{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rq-priority{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.rq-empty{height:100%;min-height:220px;display:flex;align-items:center;justify-content:center;text-align:center;color:#94a3b8}.rq-empty i{font-size:28px;margin-bottom:12px;color:#cbd5e1}.rq-empty h4{font-size:15px;color:#334155}.dark .rq-empty h4{color:#e2e8f0}
      .rq-modal{position:fixed;inset:0;background:rgba(3,7,18,.62);backdrop-filter:blur(5px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px}.rq-modal-card{width:min(920px,96vw);max-height:92vh;overflow:hidden;background:#fff;border-radius:26px;box-shadow:0 30px 90px rgba(0,0,0,.25);display:grid;grid-template-rows:auto 1fr auto}.dark .rq-modal-card{background:#0b1018;color:#fff}.rq-modal-head{padding:20px 22px;background:linear-gradient(105deg,#030712 0%,#111827 64%,color-mix(in srgb,var(--accent) 62%,#111827));color:#fff;display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.rq-modal-body{overflow:auto;padding:20px 22px}.rq-modal-foot{padding:13px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.dark .rq-modal-foot{border-color:#202938}.rq-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.rq-field label{display:block;font-size:10px;font-weight:800;color:#7c8798;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px}.rq-input,.rq-textarea,.rq-select{width:100%;border:1px solid #dfe3e8;background:#fff;border-radius:12px;padding:10px 11px;font-size:12px;outline:none}.rq-input:focus,.rq-textarea:focus,.rq-select:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}.dark .rq-input,.dark .rq-textarea,.dark .rq-select{background:#101722;border-color:#263043;color:#fff}.rq-textarea{min-height:110px;resize:vertical}.rq-detail-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:20px}.rq-detail-section{border:1px solid #e5e7eb;border-radius:18px;padding:16px;margin-bottom:12px}.dark .rq-detail-section{border-color:#202938}.rq-detail-section h4{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#7c8798;margin-bottom:10px}.rq-detail-text{font-size:13px;line-height:1.7;white-space:pre-wrap}.rq-history{position:relative;padding-left:16px}.rq-history:before{content:'';position:absolute;left:4px;top:5px;bottom:5px;width:1px;background:#e5e7eb}.dark .rq-history:before{background:#273142}.rq-hitem{position:relative;padding:0 0 13px 10px;font-size:11px}.rq-hitem:before{content:'';position:absolute;left:-15px;top:4px;width:7px;height:7px;border-radius:50%;background:var(--accent)}.rq-hitem small{display:block;color:#94a3b8;margin-top:2px}.rq-comment{padding:10px 0;border-bottom:1px solid #eef0f3}.dark .rq-comment{border-color:#1e2633}.rq-comment:last-child{border:0}.rq-comment .who{font-size:11px;font-weight:800}.rq-comment .when{font-size:9px;color:#94a3b8;margin-left:6px}.rq-comment .body{font-size:12px;margin-top:4px;white-space:pre-wrap}.rq-request-card{border:1px solid #e5e7eb;border-radius:14px;padding:11px;margin-bottom:8px;background:#f8fafc}.dark .rq-request-card{background:#101722;border-color:#263043}
      .rq-bin-tag{background:#fee2e2;color:#b91c1c}.rq-notice{font-size:11px;padding:10px 12px;border-radius:12px;background:#eff6ff;color:#1d4ed8}.dark .rq-notice{background:#0f1b35;color:#93c5fd}
      .rq-tab.open.active{background:#f97316;color:#fff}.rq-tab.attention.active{background:#dc2626;color:#fff}.rq-tab.completed.active{background:#16a34a;color:#fff}.rq-tab.cancelled.active{background:#6b7280;color:#fff}.rq-row.rq-unread{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 9%,#fff),#fff 38%);border-color:color-mix(in srgb,var(--accent) 45%,#dbe1e8)}.dark .rq-row.rq-unread{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 13%,#0d131d),#0d131d 45%)}.rq-new-chip{display:inline-flex;align-items:center;gap:5px;margin-left:8px;background:var(--accent);color:#fff;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:900;vertical-align:middle}.rq-age{font-size:9px;color:#94a3b8;margin-top:4px;font-variant-numeric:tabular-nums}.rq-completed-filter{display:flex;gap:4px;padding:4px;border-radius:11px;background:#f1f5f9;margin-left:6px}.dark .rq-completed-filter{background:#141b27}.rq-completed-filter button{border:0;background:transparent;padding:6px 8px;border-radius:8px;font-size:9px;font-weight:800;color:#64748b}.rq-completed-filter button.active{background:#fff;color:#166534;box-shadow:0 1px 4px rgba(15,23,42,.08)}.dark .rq-completed-filter button.active{background:#202938;color:#86efac}.rq-stat.notify{cursor:pointer}.rq-stat.notify:hover{outline:2px solid color-mix(in srgb,var(--accent) 20%,transparent)}.rq-sidebar-badge{margin-left:auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#ef4444;color:white;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:900}.rq-action-dot{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;font-size:9px;margin-left:6px}.rq-stat.completed .v{color:#16a34a}.rq-stat.cancelled .v{color:#6b7280}
      .rq-row.rq-unread{border-color:color-mix(in srgb,var(--accent) 45%,#e5e7eb);box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 8%,transparent)}.rq-action-badge{margin-left:7px;display:inline-flex;min-width:20px;height:20px;padding:0 6px;border-radius:999px;align-items:center;justify-content:center;background:var(--accent);color:white;font-size:9px;font-weight:900;vertical-align:middle}.rq-live{display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums;padding:5px 8px;border-radius:9px;background:#f8fafc}.dark .rq-live{background:#111827}.rq-stat.notify{background:color-mix(in srgb,var(--accent) 8%,#f8fafc)}.rq-stat.notify .v{color:var(--accent)}
      .rq-assignee-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.rq-assignee-card{border:1px solid #e5e7eb;border-radius:14px;padding:10px;background:#fff;display:flex;align-items:center;gap:9px;text-align:left;transition:.15s}.rq-assignee-card:hover{border-color:#cbd5e1;transform:translateY(-1px)}.rq-assignee-card.active{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent);background:color-mix(in srgb,var(--accent) 4%,#fff)}.dark .rq-assignee-card{background:#101722;border-color:#263043}.rq-assignee-card .rq-avatar{width:36px;height:36px}.rq-assignee-card strong{font-size:11px;display:block}.rq-assignee-card small{font-size:9px;color:#94a3b8;display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:125px}
      .rq-deadline-box{border:1px solid #e5e7eb;border-radius:16px;padding:12px;background:#fafbfc}.dark .rq-deadline-box{background:#0f1621;border-color:#263043}.rq-quick-times{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.rq-time-chip{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800}.rq-time-chip:hover{border-color:var(--accent);color:var(--accent)}.dark .rq-time-chip{background:#111827;border-color:#263043}.rq-duration-line{display:grid;grid-template-columns:84px 110px 1fr;gap:8px;align-items:center}.rq-ref-list{display:grid;gap:7px}.rq-ref-row{display:flex;gap:7px}.rq-ref-row input{flex:1}.rq-ref-row button{width:38px;justify-content:center;padding:0}.rq-self-badge{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--accent) 35%,#e5e7eb);border-radius:14px;background:color-mix(in srgb,var(--accent) 5%,#fff)}.dark .rq-self-badge{background:#101722}
      @media(max-width:1050px){.rq-row{grid-template-columns:minmax(220px,1.4fr) 135px 120px 95px}.rq-row .rq-priority-col{display:none}.rq-summary{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:760px){#view-requests{overflow:auto}.rq-shell{height:auto;min-height:100%}.rq-command{margin:12px 12px 0;border-radius:20px;align-items:flex-start}.rq-command-actions{width:100%}.rq-command{flex-direction:column}.rq-people-wrap{padding:12px}.rq-workspace{padding:0 12px 16px;overflow:visible}.rq-panel{overflow:visible}.rq-summary{grid-template-columns:repeat(2,1fr)}.rq-toolbar{align-items:stretch;flex-direction:column}.rq-search{max-width:none}.rq-list{overflow:visible}.rq-row{grid-template-columns:1fr 105px}.rq-row .rq-person-col,.rq-row .rq-status-col,.rq-row .rq-priority-col{display:none}.rq-detail-grid,.rq-grid2{grid-template-columns:1fr}.rq-modal{padding:8px}.rq-modal-card{max-height:96vh;border-radius:20px}}
    `; document.head.appendChild(s);
  }

  function ensureView(){
    ensureStyle();
    let v=document.getElementById('view-requests');
    if(!v){v=document.createElement('div');v.id='view-requests';v.className='view-section hidden';document.getElementById('mainContent')?.appendChild(v);}
    root=v;
    return v;
  }

  async function loadDirectory(){
    try{const {data,error}=await supabaseClient.rpc('team_directory');if(error)throw error;directory=(data||[]).filter(x=>x.status!=='inactive');}
    catch(_){const {data}=await supabaseClient.from('profiles').select('id,full_name,job_title,avatar,role,status').eq('status','active').order('full_name');directory=data||[];}
  }

  async function loadData(){
    if(!state.currentUser) return;
    const q=supabaseClient.from('work_requests').select('*').order('created_at',{ascending:false});
    const [{data:r,error:re},{data:c},{data:ch},{data:rd},{data:ce}]=await Promise.all([
      q,
      supabaseClient.from('work_request_collaborators').select('*'),
      supabaseClient.from('work_request_change_requests').select('*').order('created_at',{ascending:false}),
      supabaseClient.from('work_request_reads').select('*').eq('user_id',currentId()),
      supabaseClient.from('work_request_comments').select('request_id,created_at').order('created_at',{ascending:false})
    ]);
    if(re) throw re;
    requests=r||[]; collaborators=c||[]; changeRequests=ch||[]; reads=rd||[]; commentEvents=ce||[];
  }

  function requestCollabs(id){return collaborators.filter(c=>c.request_id===id).map(c=>c.user_id);}
  function userRequestCount(uid){return requests.filter(r=>!r.deleted_at && activeStatuses.includes(r.status) && (r.assignee_id===uid || requestCollabs(r.id).includes(uid))).length;}
  function scopeRequests(){
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
  }

  function counts(arrBase=null){
    let arr=(arrBase||requests).filter(r=>!r.deleted_at);
    if(selectedUser!=='all') arr=arr.filter(r=>r.assignee_id===selectedUser||requestCollabs(r.id).includes(selectedUser));
    if(!isAdmin()) arr=arr.filter(r=>r.assignee_id===currentId()||requestCollabs(r.id).includes(currentId()));
    return {
      open:arr.filter(r=>activeStatuses.includes(r.status)).length,
      due:arr.filter(isDueSoon).length,
      overdue:arr.filter(isOverdue).length,
      submitted:arr.filter(r=>r.status==='submitted').length,
      closed:arr.filter(r=>r.status==='closed').length
    };
  }

  function render(){
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
  }

  function requestRow(r){
    const dueClass=isOverdue(r)?'overdue':isDueSoon(r)?'soon':'';
    const coll=requestCollabs(r.id),unread=hasUnread(r),actions=pendingActionCount(r),done=r.status==='closed';
    return `<article class="rq-row ${unread?'rq-unread':''}" data-priority="${esc(r.priority)}" onclick="RequestsApp.openDetail('${esc(r.id)}')"><div><div class="rq-row-title">${esc(r.title)}${unread?`<span class="rq-new-chip"><i class="fas fa-bell"></i>NEW</span>`:''}${actions?`<span class="rq-action-dot" title="Action required">${actions}</span>`:''}</div><div class="rq-row-meta"><span>${String(r.creator_id)===String(r.assignee_id)?'Personal task':'Requested by '+esc(nameOf(r.creator_id))}</span>${coll.length?`<span>+ ${coll.length} collaborator${coll.length>1?'s':''}</span>`:''}${((r.reference_links||[]).length||r.link_url)?'<span><i class="fas fa-link"></i> Reference</span>':''}<span class="rq-age" data-rq-age="${esc(r.created_at)}">${esc(elapsedText(r.created_at))}</span></div></div><div class="rq-person-cell rq-person-col">${avatar(r.assignee_id)}<span>${esc(nameOf(r.assignee_id))}</span></div><div class="rq-status-col"><span class="rq-chip status-${esc(r.status)}" style="${done?'background:#dcfce7;color:#15803d':r.status==='cancelled'?'background:#f3f4f6;color:#6b7280':'background:#fff7ed;color:#c2410c'}">${esc(statusLabel(r.status))}</span></div><div class="rq-due ${dueClass}">${r.due_at?`<span class="rq-live" data-rq-due="${esc(r.due_at)}"><i class="fas fa-clock"></i><span>${esc(rel(r.due_at))}</span></span>`:'No deadline'}<div class="text-[9px] text-gray-400 mt-1">${esc(r.due_at?fmtDate(r.due_at):'')}</div></div><div class="rq-priority rq-priority-col">${esc(priorityLabel(r.priority))}</div></article>`;
  }

  function emptyState(){
    const msg=selectedStatus==='bin'?'The recycle bin is empty.':selectedStatus==='closed'?'No closed requests here yet.':'Nothing needs your attention in this view.';
    return `<div class="rq-empty"><div><i class="fas fa-circle-check"></i><h4>${esc(msg)}</h4><p class="text-xs mt-2">${isAdmin()?'Switch a team member or filter to see more.':'You are all clear here.'}</p></div></div>`;
  }

  function modal(html){
    closeModal(); const el=document.createElement('div');el.id='requestsModal';el.className='rq-modal';el.innerHTML=html;document.body.appendChild(el);
    el.addEventListener('click',e=>{if(e.target===el)closeModal();});
  }
  function closeModal(){document.getElementById('requestsModal')?.remove();}

  function setAssignee(id){
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
    if(!id&&data?.id){try{await supabaseClient.from('work_request_reads').upsert({request_id:data.id,user_id:state.currentUser.id,last_seen_at:new Date().toISOString()},{onConflict:'request_id,user_id'});}catch(_){ }}
    if(typeof recordActivity==='function')recordActivity(id?'request_updated':'request_created','work_request',id||data?.id,{title,assignee_id});closeModal();await reload();
  }

  async function openDetail(id){
    selectedRequestId=id;
    await markRead(id);
    render();
    updateSidebarBadge();
    const r=requests.find(x=>x.id===id);if(!r)return;
    const [{data:h},{data:co},{data:ch}]=await Promise.all([
      supabaseClient.from('work_request_history').select('*').eq('request_id',id).order('created_at',{ascending:false}).limit(100),
      supabaseClient.from('work_request_comments').select('*').eq('request_id',id).order('created_at',{ascending:true}),
      supabaseClient.from('work_request_change_requests').select('*').eq('request_id',id).order('created_at',{ascending:false})
    ]); history=h||[];comments=co||[];changeRequests=ch||[];
    renderDetail(r);
  }

  function renderDetail(r){
    const coll=requestCollabs(r.id); const pending=changeRequests.filter(x=>x.request_id===r.id&&x.status==='pending');
    modal(`<div class="rq-modal-card"><div class="rq-modal-head"><div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><span class="rq-chip status-${esc(r.status)}">${esc(statusLabel(r.status))}</span><span class="text-[10px] uppercase tracking-wider text-gray-400 font-bold">${esc(priorityLabel(r.priority))}</span></div><h3 class="text-2xl font-bold mt-2 truncate">${esc(r.title)}</h3><p class="text-xs text-gray-400 mt-1">Requested by ${esc(nameOf(r.creator_id))} · ${esc(fmtDateTime(r.created_at))}</p></div><button class="rq-btn rq-btn-ghost text-white border-white/10" onclick="RequestsApp.closeModal()"><i class="fas fa-times"></i></button></div>
      <div class="rq-modal-body"><div class="rq-detail-grid"><div>
        <section class="rq-detail-section"><h4>Request</h4><div class="rq-detail-text">${esc(r.details||'No additional details.')}</div>${r.link_url?`<a href="${esc(r.link_url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 mt-3 text-xs font-bold text-[var(--accent)]"><i class="fas fa-arrow-up-right-from-square"></i> Open reference link</a>`:''}</section>
        <section class="rq-detail-section"><h4>Conversation</h4><div>${comments.length?comments.map(x=>`<div class="rq-comment"><span class="who">${esc(nameOf(x.author_id))}</span><span class="when">${esc(fmtDateTime(x.created_at))}</span><div class="body">${esc(x.body)}</div></div>`).join(''):'<div class="text-xs text-gray-400 py-2">No comments yet.</div>'}</div><div class="flex gap-2 mt-3"><input id="rqComment" class="rq-input" placeholder="Add a quick comment..."><button class="rq-btn rq-btn-accent" onclick="RequestsApp.addComment('${esc(r.id)}')"><i class="fas fa-paper-plane"></i></button></div></section>
        ${pending.length?`<section class="rq-detail-section"><h4>Pending requests</h4>${pending.map(changeCard).join('')}</section>`:''}
      </div><aside>
        <section class="rq-detail-section"><h4>Owner & timing</h4><div class="rq-person-cell mb-3">${avatar(r.assignee_id)}<div><div class="text-xs font-bold">${esc(nameOf(r.assignee_id))}</div><div class="text-[10px] text-gray-400">Primary owner</div></div></div><div class="text-xs font-bold ${isOverdue(r)?'text-red-600':''}">${esc(r.due_at?fmtDateTime(r.due_at):'No deadline')}</div>${r.due_at?`<div class="text-[10px] text-gray-400 mt-1">${esc(rel(r.due_at))}</div>`:''}${coll.length?`<div class="mt-4"><div class="text-[10px] uppercase font-bold text-gray-400 mb-2">Collaborators</div><div class="flex -space-x-2">${coll.map(id=>avatar(id)).join('')}</div></div>`:''}</section>
        <section class="rq-detail-section"><h4>History</h4><div class="rq-history">${history.length?history.map(historyItem).join(''):'<div class="text-xs text-gray-400">No history yet.</div>'}</div></section>
      </aside></div></div>
      <div class="rq-modal-foot">${detailActions(r)}</div></div>`);
  }

  function historyItem(h){
    const d=h.details||{}; let text=({created:'Request created',status_changed:`Status changed to ${statusLabel(d.to)}`,deadline_changed:'Deadline updated',assignee_changed:'Owner changed',priority_changed:'Priority updated',moved_to_bin:'Moved to recycle bin',restored:'Restored from recycle bin',commented:'Comment added',extension_requested:'Extension requested',assistance_requested:'Assistance requested',change_approved:'Request approved',change_declined:'Request declined',collaborator_added:'Collaborator added'})[h.action]||h.action.replaceAll('_',' ');
    return `<div class="rq-hitem"><strong>${esc(text)}</strong><small>${esc(nameOf(h.actor_id))} · ${esc(fmtDateTime(h.created_at))}</small></div>`;
  }

  function changeCard(ch){
    const target=ch.request_type==='extension'?`New deadline: ${fmtDateTime(ch.requested_due_at)}`:`Help from: ${nameOf(ch.requested_user_id)}`;
    return `<div class="rq-request-card"><div class="text-xs font-bold">${ch.request_type==='extension'?'Extension request':'Assistance request'}</div><div class="text-[10px] text-gray-500 mt-1">${esc(target)}</div>${ch.reason?`<div class="text-xs mt-2">${esc(ch.reason)}</div>`:''}${isAdmin()?`<div class="flex gap-2 mt-3"><button class="rq-btn rq-btn-accent" onclick="RequestsApp.reviewChange(${Number(ch.id)},true)">Approve</button><button class="rq-btn" onclick="RequestsApp.reviewChange(${Number(ch.id)},false)">Decline</button></div>`:''}</div>`;
  }

  function detailActions(r){
    if(r.deleted_at&&isAdmin())return `<button class="rq-btn" onclick="RequestsApp.restore('${esc(r.id)}')"><i class="fas fa-rotate-left"></i>Restore</button><button class="rq-btn rq-btn-danger" onclick="RequestsApp.permanentDelete('${esc(r.id)}')"><i class="fas fa-trash"></i>Delete permanently</button>`;
    const mine=String(r.assignee_id)===currentId()||requestCollabs(r.id).includes(currentId());
    if(isAdmin()) return `<button class="rq-btn" onclick="RequestsApp.edit('${esc(r.id)}')"><i class="fas fa-pen"></i>Edit</button>${['closed','cancelled'].includes(r.status)?`<button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','in_progress')"><i class="fas fa-rotate-left"></i>Reopen</button>`:`<button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','closed')"><i class="fas fa-check"></i>Mark Complete</button><button class="rq-btn" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','cancelled')">Cancel</button>`}<button class="rq-btn rq-btn-danger" onclick="RequestsApp.moveToBin('${esc(r.id)}')"><i class="fas fa-trash-can"></i></button>`;
    if(!mine)return '';
    if(r.status==='closed') return `<span class="text-xs text-emerald-600 font-bold mr-auto"><i class="fas fa-circle-check mr-1"></i>Completed by you</span>`;
    if(r.status==='cancelled') return `<span class="text-xs text-gray-500 font-bold mr-auto">Cancelled</span>`;
    return `<button class="rq-btn" onclick="RequestsApp.requestExtension('${esc(r.id)}')"><i class="fas fa-clock"></i>Extension</button><button class="rq-btn" onclick="RequestsApp.requestAssistance('${esc(r.id)}')"><i class="fas fa-user-plus"></i>Request Help</button><button class="rq-btn rq-btn-accent" onclick="RequestsApp.setRequestStatus('${esc(r.id)}','closed')"><i class="fas fa-check"></i>Mark Done</button>${String(r.creator_id)===currentId()&&String(r.assignee_id)===currentId()?`<button class="rq-btn" onclick="RequestsApp.edit('${esc(r.id)}')"><i class="fas fa-pen"></i>Edit</button>`:''}`;
  }

  async function setRequestStatus(id,status){
    const payload={status};
    if(status==='closed')payload.closed_at=new Date().toISOString();
    if(status==='cancelled')payload.cancelled_at=new Date().toISOString();
    if(status==='in_progress'){payload.closed_at=null;payload.cancelled_at=null;payload.submitted_at=null;}
    const {error}=await supabaseClient.from('work_requests').update(payload).eq('id',id);if(error)return alert(error.message);
    await supabaseClient.from('work_request_history').insert({request_id:id,actor_id:state.currentUser.id,action:'status_changed',details:{to:status}});
    if(typeof recordActivity==='function')recordActivity('request_status_changed','work_request',id,{status});closeModal();await reload();
  }
  async function addComment(id){
    const body=document.getElementById('rqComment')?.value.trim();if(!body)return;
    const {error}=await supabaseClient.from('work_request_comments').insert({request_id:id,author_id:state.currentUser.id,body});if(error)return alert(error.message);
    await supabaseClient.from('work_request_history').insert({request_id:id,actor_id:state.currentUser.id,action:'commented',details:{}});
    await openDetail(id);
  }

  function requestExtension(id){
    const r=requests.find(x=>x.id===id);if(!r)return;
    modal(`<div class="rq-modal-card" style="max-width:560px"><div class="rq-modal-head"><div><div class="rq-eyebrow">REQUEST EXTENSION</div><h3 class="text-xl font-bold mt-1">Need more time?</h3></div><button class="rq-btn rq-btn-ghost text-white border-white/10" onclick="RequestsApp.closeModal()"><i class="fas fa-times"></i></button></div><div class="rq-modal-body space-y-4"><div class="rq-field"><label>Requested new deadline</label><input id="rqExtensionDue" class="rq-input" type="datetime-local"></div><div class="rq-field"><label>Why?</label><textarea id="rqExtensionReason" class="rq-textarea" placeholder="Short reason — keep it useful."></textarea></div></div><div class="rq-modal-foot"><button class="rq-btn" onclick="RequestsApp.openDetail('${esc(id)}')">Cancel</button><button class="rq-btn rq-btn-accent" onclick="RequestsApp.submitExtension('${esc(id)}')">Send Request</button></div></div>`);
  }
  async function submitExtension(id){
    const due=document.getElementById('rqExtensionDue')?.value,reason=document.getElementById('rqExtensionReason')?.value.trim()||'';if(!due)return alert('Choose the new requested deadline.');
    const {error}=await supabaseClient.from('work_request_change_requests').insert({request_id:id,requester_id:state.currentUser.id,request_type:'extension',requested_due_at:new Date(due).toISOString(),reason});if(error)return alert(error.message);
    await supabaseClient.from('work_request_history').insert({request_id:id,actor_id:state.currentUser.id,action:'extension_requested',details:{requested_due_at:new Date(due).toISOString()}});closeModal();await reload();
  }

  function requestAssistance(id){
    const options=directory.filter(p=>String(p.id)!==currentId()).map(p=>`<option value="${esc(p.id)}">${esc(p.full_name)} — ${esc(p.job_title||'Team member')}</option>`).join('');
    modal(`<div class="rq-modal-card" style="max-width:560px"><div class="rq-modal-head"><div><div class="rq-eyebrow">REQUEST ASSISTANCE</div><h3 class="text-xl font-bold mt-1">Bring someone in.</h3></div><button class="rq-btn rq-btn-ghost text-white border-white/10" onclick="RequestsApp.closeModal()"><i class="fas fa-times"></i></button></div><div class="rq-modal-body space-y-4"><div class="rq-field"><label>Team member</label><select id="rqHelpUser" class="rq-select">${options}</select></div><div class="rq-field"><label>Reason</label><textarea id="rqHelpReason" class="rq-textarea" placeholder="What kind of help do you need?"></textarea></div></div><div class="rq-modal-foot"><button class="rq-btn" onclick="RequestsApp.openDetail('${esc(id)}')">Cancel</button><button class="rq-btn rq-btn-accent" onclick="RequestsApp.submitAssistance('${esc(id)}')">Ask Manager</button></div></div>`);
  }
  async function submitAssistance(id){
    const requested_user_id=document.getElementById('rqHelpUser')?.value,reason=document.getElementById('rqHelpReason')?.value.trim()||'';if(!requested_user_id)return;
    const {error}=await supabaseClient.from('work_request_change_requests').insert({request_id:id,requester_id:state.currentUser.id,request_type:'assistance',requested_user_id,reason});if(error)return alert(error.message);
    await supabaseClient.from('work_request_history').insert({request_id:id,actor_id:state.currentUser.id,action:'assistance_requested',details:{requested_user_id}});closeModal();await reload();
  }

  async function reviewChange(changeId,approve){
    const ch=changeRequests.find(x=>Number(x.id)===Number(changeId));if(!ch)return;
    if(approve&&ch.request_type==='extension'){
      const {error}=await supabaseClient.from('work_requests').update({due_at:ch.requested_due_at}).eq('id',ch.request_id);if(error)return alert(error.message);
    }
    if(approve&&ch.request_type==='assistance'){
      const {error}=await supabaseClient.from('work_request_collaborators').upsert({request_id:ch.request_id,user_id:ch.requested_user_id,added_by:state.currentUser.id});if(error)return alert(error.message);
      await supabaseClient.from('work_request_history').insert({request_id:ch.request_id,actor_id:state.currentUser.id,action:'collaborator_added',details:{user_id:ch.requested_user_id}});
    }
    const {error}=await supabaseClient.from('work_request_change_requests').update({status:approve?'approved':'declined',reviewed_by:state.currentUser.id,reviewed_at:new Date().toISOString()}).eq('id',changeId);if(error)return alert(error.message);
    await supabaseClient.from('work_request_history').insert({request_id:ch.request_id,actor_id:state.currentUser.id,action:approve?'change_approved':'change_declined',details:{request_type:ch.request_type}});closeModal();await reload();
  }

  async function moveToBin(id){if(!confirm('Move this request to the recycle bin?'))return;const {error}=await supabaseClient.from('work_requests').update({deleted_at:new Date().toISOString(),deleted_by:state.currentUser.id}).eq('id',id);if(error)return alert(error.message);closeModal();await reload();}
  async function restore(id){const {error}=await supabaseClient.from('work_requests').update({deleted_at:null,deleted_by:null}).eq('id',id);if(error)return alert(error.message);closeModal();await reload();}
  async function permanentDelete(id){if(!confirm('Permanently delete this request and its history? This cannot be undone.'))return;const {error}=await supabaseClient.from('work_requests').delete().eq('id',id);if(error)return alert(error.message);if(typeof recordActivity==='function')recordActivity('request_permanently_deleted','work_request',id,{});closeModal();await reload();}
  function openBin(){selectedUser='all';selectedStatus='bin';render();}
  function edit(id){const r=requests.find(x=>x.id===id);if(r)createForm(r);}

  async function reload(){await loadData();render();if(selectedRequestId&&document.getElementById('requestsModal'))openDetail(selectedRequestId);}

  async function markRead(id){
    if(!state.currentUser||!id)return;const now=new Date().toISOString();
    try{await supabaseClient.from('work_request_reads').upsert({request_id:id,user_id:state.currentUser.id,last_seen_at:now},{onConflict:'request_id,user_id'});reads=reads.filter(x=>String(x.request_id)!==String(id)||String(x.user_id)!==currentId());reads.push({request_id:id,user_id:state.currentUser.id,last_seen_at:now});}catch(_){ }
  }
  function timerText(iso){
    const diff=new Date(iso).getTime()-Date.now(),past=diff<0,a=Math.abs(diff);const d=Math.floor(a/86400000),h=Math.floor((a%86400000)/3600000),m=Math.floor((a%3600000)/60000),sec=Math.floor((a%60000)/1000);const parts=[];if(d)parts.push(`${d}d`);if(h||d)parts.push(`${h}h`);parts.push(`${m}m`);if(a<86400000)parts.push(`${sec}s`);return `${past?'Overdue':'Due in'} ${parts.slice(0,3).join(' ')}`;
  }
  function updateTimers(){
    document.querySelectorAll('[data-rq-due]').forEach(el=>{const span=el.querySelector('span');if(span)span.textContent=timerText(el.dataset.rqDue);});if(timerTick)clearInterval(timerTick);timerTick=setInterval(()=>{if(root&&!root.classList.contains('hidden'))document.querySelectorAll('[data-rq-due]').forEach(el=>{const span=el.querySelector('span');if(span)span.textContent=timerText(el.dataset.rqDue);});},1000);
  }

  function elapsedText(iso){
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

  function selectUser(id){selectedUser=id;render();}
  function setStatus(s){selectedStatus=s;render();}
  function search(v){searchTerm=v;render();requestAnimationFrame(()=>{const i=root.querySelector('.rq-search input');if(i){i.focus();i.selectionStart=i.selectionEnd=v.length;}});}

  async function open(){
    const module = state.modules.find(m=>m.id==='requests') || {id:'requests',name:'Requests',desc:'Team requests, deadlines and accountability',icon:'fa-list-check',status:'active',roles:['admin','user']};
    ModuleRegistry.ensureView(module);
    root = document.getElementById('view-requests');
    if(!root) throw new Error('Requests view container missing');
    root.className='view-section h-full';
    ensureStyle();
    root.innerHTML='<div class="h-full flex items-center justify-center text-sm text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading requests...</div>';
    try{await Promise.all([loadDirectory(),loadData()]);if(!isAdmin()){selectedUser=currentId();}render();startBackground();}
    catch(err){console.error(err);root.innerHTML=`<div class="h-full flex items-center justify-center text-sm text-red-500">Could not load Requests.</div>`;}
  }

  function startBackground(){
    if(backgroundStarted||!state.currentUser)return;backgroundStarted=true;
    try{
      realtime=supabaseClient.channel(`work-requests-${currentId()}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'work_requests'},payload=>handleRealtime(payload))
        .on('postgres_changes',{event:'*',schema:'public',table:'work_request_change_requests'},()=>handleRealtime(null))
        .subscribe();
    }catch(_){ }
    checkReminders(); reminderTimer=setInterval(checkReminders,60000);
  }

  async function handleRealtime(payload){
    const oldMap=new Map(requests.map(r=>[r.id,r]));
    try{await loadData();}catch(_){return;}
    const incoming=payload?.new;
    if(incoming&&incoming.id){
      const relevant=incoming.assignee_id===currentId()||requestCollabs(incoming.id).includes(currentId());
      const old=oldMap.get(incoming.id);
      if(relevant&&incoming.creator_id!==currentId()){
        if(!old)announce(`New request from ${nameOf(incoming.creator_id)}`,incoming.title,incoming.id);
        else if(old.status!==incoming.status)announce(`Request updated`,`${incoming.title} · ${statusLabel(incoming.status)}`,incoming.id);
      }
      if(isAdmin()&&old&&old.status!==incoming.status&&incoming.assignee_id!==currentId()&&['submitted','blocked'].includes(incoming.status))announce(`Request ${statusLabel(incoming.status).toLowerCase()}`,`${nameOf(incoming.assignee_id)} · ${incoming.title}`,incoming.id);
    }
    if(root&&!root.classList.contains('hidden'))render();
  }

  function announce(title,body,id){
    if(typeof playTeamNotificationSound==='function') playTeamNotificationSound();
    if(typeof desktopNotificationsEnabled==='function' && desktopNotificationsEnabled() && 'Notification' in window && Notification.permission==='granted'){
      try{const n=new Notification(title,{body,tag:`request-${id||Date.now()}`,renotify:true});n.onclick=()=>{window.focus();showView('requests');if(id)setTimeout(()=>openDetail(id),200);n.close();};setTimeout(()=>n.close(),9000);}catch(_){ }
    }
    let host=document.getElementById('rqToastHost');if(!host){host=document.createElement('div');host.id='rqToastHost';host.className='fixed top-5 right-5 z-[20000] space-y-2 w-[340px] max-w-[calc(100vw-2rem)]';document.body.appendChild(host);}const t=document.createElement('button');t.className='w-full text-left bg-white border border-gray-200 rounded-2xl shadow-xl p-4';t.innerHTML=`<div class="font-bold text-sm">${esc(title)}</div><div class="text-xs text-gray-500 mt-1">${esc(body)}</div>`;t.onclick=()=>{t.remove();showView('requests');setTimeout(()=>openDetail(id),250);};host.prepend(t);setTimeout(()=>t.remove(),7000);
  }

  async function checkReminders(){
    if(!state.currentUser)return;
    try{await loadData();}catch(_){return;}
    const mine=requests.filter(r=>!r.deleted_at&&activeStatuses.includes(r.status)&&(r.assignee_id===currentId()||requestCollabs(r.id).includes(currentId()))&&r.due_at);
    for(const r of mine){
      const diff=new Date(r.due_at).getTime()-Date.now(); let kind='';
      if(diff<0)kind='overdue'; else if(diff<=24*3600000)kind='24h';
      if(!kind)continue;
      const key=`rq-reminder:${r.id}:${kind}:${new Date().toISOString().slice(0,10)}`;
      if(localStorage.getItem(key))continue;localStorage.setItem(key,'1');announce(kind==='overdue'?'Request overdue':'Request due soon',`${r.title} · ${rel(r.due_at)}`,r.id);
    }
    if(isAdmin()){
      const attention=requests.filter(r=>!r.deleted_at&&(r.status==='submitted'||r.status==='blocked'||isOverdue(r)));
      const key=`rq-manager-brief:${new Date().toISOString().slice(0,10)}`;
      if(attention.length&& !localStorage.getItem(key)){localStorage.setItem(key,'1');announce('Requests need attention',`${attention.length} request${attention.length>1?'s':''} waiting for you`,'');}
    }
  }

  ModuleRegistry.register('requests',(view)=>{root=view;view.className='view-section hidden h-full';view.dataset.generated='true';ensureStyle();});

  return {open,render,selectUser,setStatus,search,openCreate:()=>createForm(),saveRequest,openDetail,closeModal,edit,setRequestStatus,addComment,requestExtension,submitExtension,requestAssistance,submitAssistance,reviewChange,moveToBin,restore,permanentDelete,openBin,setAssignee,setDuePreset,setDueFlexible,addReferenceRow,setCompletedRange,updateSidebarBadge};
})();

// Start request reminders/realtime shortly after authentication, even if the module is never opened.
setInterval(()=>{ if(state?.currentUser && !document.hidden){ RequestsApp && RequestsApp.open && (()=>{})(); } },300000);
