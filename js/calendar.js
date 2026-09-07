// TAAMEER Team Calendar v1
// Personal + department calendar. Simple by design.
const CalendarApp = (() => {
  const TYPES = [
    ['meeting','Meeting','fa-users'],
    ['deadline','Deadline','fa-flag-checkered'],
    ['appointment','Appointment','fa-clock'],
    ['shoot','Shoot / Production','fa-video'],
    ['content','Content / Campaign','fa-bullhorn'],
    ['review','Review / Approval','fa-check-circle'],
    ['event','Event','fa-calendar-day'],
    ['reminder','Reminder','fa-bell'],
    ['other','Other','fa-circle']
  ];
  const typeMap = Object.fromEntries(TYPES.map(x => [x[0], x]));
  let mode = 'my';
  let viewMode = 'week';
  let anchor = new Date();
  let events = [];
  let profiles = [];
  let personFilter = 'all';
  let typeFilter = 'all';

  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
  const mondayOf = d => { const x = startOfDay(d); const day=x.getDay(); x.setDate(x.getDate() - (day===0?6:day-1)); return x; };
  const sameDay = (a,b) => new Date(a).toDateString() === new Date(b).toDateString();
  const personName = id => profiles.find(p=>p.id===id)?.full_name || profiles.find(p=>p.id===id)?.username || 'Team member';
  const currentId = () => state?.currentUser?.id;
  const isAdmin = () => state?.currentUser?.role === 'admin';

  function shell() {
    const view = document.getElementById('view-calendar');
    if (!view) return null;
    view.className = 'view-section fade-in h-full';
    view.innerHTML = `
      <div class="h-full flex flex-col gap-4 overflow-hidden">
        <section class="rounded-3xl bg-gradient-to-r from-gray-950 via-gray-900 to-[var(--accent)] text-white p-5 lg:p-6 flex items-center justify-between gap-4 flex-shrink-0 shadow-sm">
          <div class="min-w-0">
            <div class="text-xs uppercase tracking-[.18em] text-white/55 font-semibold">TAAMEER TEAM CALENDAR</div>
            <h2 class="text-2xl font-bold mt-1">Your schedule. Your team. One view.</h2>
            <p class="text-sm text-white/60 mt-1">Plan your work without turning it into project management.</p>
          </div>
          <button id="calNewBtn" class="flex-shrink-0 bg-white text-gray-950 px-4 py-2.5 rounded-xl font-semibold text-sm hover:scale-[1.02] transition-transform"><i class="fas fa-plus mr-2"></i>New Event</button>
        </section>

        <section class="flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div class="inline-flex p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <button data-cal-mode="my" class="calMode px-4 py-2 rounded-lg text-sm font-semibold">My Calendar</button>
            <button data-cal-mode="department" class="calMode px-4 py-2 rounded-lg text-sm font-semibold">Department</button>
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <select id="calPersonFilter" class="input-field !w-auto !py-2 text-sm hidden"></select>
            <select id="calTypeFilter" class="input-field !w-auto !py-2 text-sm"><option value="all">All types</option>${TYPES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('')}</select>
            <div class="inline-flex p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
              <button data-cal-view="month" class="calView px-3 py-1.5 rounded-lg text-xs font-semibold">Month</button>
              <button data-cal-view="week" class="calView px-3 py-1.5 rounded-lg text-xs font-semibold">Week</button>
              <button data-cal-view="agenda" class="calView px-3 py-1.5 rounded-lg text-xs font-semibold">Agenda</button>
            </div>
          </div>
        </section>

        <section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex-1 min-h-0 overflow-hidden flex flex-col">
          <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-2"><button id="calPrev" class="w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><i class="fas fa-chevron-left"></i></button><button id="calToday" class="px-3 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold">Today</button><button id="calNext" class="w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><i class="fas fa-chevron-right"></i></button></div>
            <div id="calRangeTitle" class="font-bold text-gray-900 dark:text-white"></div>
            <div id="calCount" class="text-xs text-gray-400 min-w-[70px] text-right"></div>
          </div>
          <div id="calCanvas" class="flex-1 min-h-0 overflow-auto"></div>
        </section>
      </div>

      <div id="calModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm hidden items-center justify-center z-[80] p-4">
        <div class="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"><div><h3 id="calModalTitle" class="text-xl font-bold text-gray-900 dark:text-white">New Event</h3><p class="text-xs text-gray-500 mt-1">Only the useful details.</p></div><button id="calClose" class="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"><i class="fas fa-times"></i></button></div>
          <form id="calForm" class="p-6 grid grid-cols-2 gap-4 max-h-[72vh] overflow-auto">
            <input type="hidden" id="calEventId">
            <div class="col-span-2"><label class="text-xs font-semibold text-gray-500">Title *</label><input id="calTitleInput" class="input-field mt-1" maxlength="180" required placeholder="e.g. Canal Bay brochure review"></div>
            <div><label class="text-xs font-semibold text-gray-500">Type</label><select id="calTypeInput" class="input-field mt-1">${TYPES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('')}</select></div>
            <div><label class="text-xs font-semibold text-gray-500">Assigned to</label><select id="calAssignee" class="input-field mt-1"></select></div>
            <div><label class="text-xs font-semibold text-gray-500">Start *</label><input id="calStartInput" type="datetime-local" class="input-field mt-1" required></div>
            <div><label class="text-xs font-semibold text-gray-500">End</label><input id="calEndInput" type="datetime-local" class="input-field mt-1"></div>
            <div><label class="text-xs font-semibold text-gray-500">Visibility</label><select id="calVisibility" class="input-field mt-1"><option value="department">Department</option><option value="personal">My Calendar only</option></select></div>
            <div><label class="text-xs font-semibold text-gray-500">Reminder</label><select id="calReminder" class="input-field mt-1"><option value="">None</option><option value="15">15 min before</option><option value="30">30 min before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></div>
            <div><label class="text-xs font-semibold text-gray-500">Location / Link</label><input id="calLocation" class="input-field mt-1" placeholder="Optional"></div>
            <div class="flex items-end"><label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pb-3"><input id="calAllDay" type="checkbox" class="rounded"> All day</label></div>
            <div class="col-span-2"><label class="text-xs font-semibold text-gray-500">Notes</label><textarea id="calNotes" class="input-field mt-1 min-h-[80px] resize-none" placeholder="Optional"></textarea></div>
            <div class="col-span-2 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <button type="button" id="calDelete" class="hidden text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20"><i class="fas fa-trash mr-2"></i>Delete</button>
              <div class="ml-auto flex gap-2"><button type="button" id="calCancel" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 font-semibold text-sm">Cancel</button><button type="submit" class="px-5 py-2 rounded-xl bg-accent text-white font-semibold text-sm">Save Event</button></div>
            </div>
          </form>
        </div>
      </div>`;
    return view;
  }

  async function load() {
    const [{data: p, error: pe},{data: e, error: ee}] = await Promise.all([
      supabaseClient.from('profiles').select('id,full_name,username,job_title,role,status').eq('status','active').order('full_name'),
      supabaseClient.from('calendar_events').select('*').order('starts_at',{ascending:true})
    ]);
    if (pe) console.warn('Calendar profiles', pe);
    if (ee) throw ee;
    profiles = p || [];
    events = e || [];
    fillPeople();
    render();
  }

  function fillPeople() {
    const filter = document.getElementById('calPersonFilter');
    const assignee = document.getElementById('calAssignee');
    if (filter) filter.innerHTML = `<option value="all">All team</option>${profiles.map(p=>`<option value="${p.id}">${esc(p.full_name||p.username)}</option>`).join('')}`;
    if (assignee) assignee.innerHTML = `<option value="">Entire team / no specific person</option>${profiles.map(p=>`<option value="${p.id}">${esc(p.full_name||p.username)}</option>`).join('')}`;
  }

  function visibleEvents() {
    let out = events.slice();
    if (mode === 'my') out = out.filter(e => e.owner_id === currentId() || e.assigned_user_id === currentId());
    else out = out.filter(e => e.visibility === 'department');
    if (personFilter !== 'all') out = out.filter(e => e.owner_id===personFilter || e.assigned_user_id===personFilter);
    if (typeFilter !== 'all') out = out.filter(e => e.event_type === typeFilter);
    return out;
  }

  function eventCard(e, compact=false) {
    const t = typeMap[e.event_type] || typeMap.other;
    const owner = personName(e.assigned_user_id || e.owner_id);
    const start = new Date(e.starts_at);
    return `<button class="w-full text-left ${compact?'px-2 py-1.5':'p-3'} rounded-xl border border-gray-200 dark:border-gray-800 hover:border-[var(--accent)] hover:shadow-sm transition-all bg-white dark:bg-gray-900" onclick="CalendarApp.edit('${e.id}')">
      <div class="flex items-start gap-2 min-w-0"><div class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 flex-shrink-0"><i class="fas ${t[2]} text-xs"></i></div><div class="min-w-0 flex-1"><div class="font-semibold ${compact?'text-xs':'text-sm'} text-gray-900 dark:text-white truncate">${esc(e.title)}</div><div class="text-[11px] text-gray-400 mt-0.5 truncate">${e.all_day?'All day':start.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${esc(owner)}</div></div></div>
    </button>`;
  }

  function render() {
    document.querySelectorAll('.calMode').forEach(b=>{const on=b.dataset.calMode===mode;b.className=`calMode px-4 py-2 rounded-lg text-sm font-semibold ${on?'bg-gray-950 text-white dark:bg-white dark:text-gray-950':'text-gray-500'}`;});
    document.querySelectorAll('.calView').forEach(b=>{const on=b.dataset.calView===viewMode;b.className=`calView px-3 py-1.5 rounded-lg text-xs font-semibold ${on?'bg-gray-950 text-white dark:bg-white dark:text-gray-950':'text-gray-500'}`;});
    const pf=document.getElementById('calPersonFilter'); if(pf) pf.classList.toggle('hidden', mode!=='department');
    const list = visibleEvents();
    document.getElementById('calCount').textContent = `${list.length} ${list.length===1?'item':'items'}`;
    if (viewMode==='month') renderMonth(list); else if (viewMode==='agenda') renderAgenda(list); else renderWeek(list);
  }

  function renderWeek(list) {
    const start=mondayOf(anchor), end=addDays(start,6);
    document.getElementById('calRangeTitle').textContent = `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
    const html=[];
    for(let i=0;i<7;i++){
      const d=addDays(start,i), dayEvents=list.filter(e=>sameDay(e.starts_at,d));
      const today=sameDay(d,new Date());
      html.push(`<div class="min-w-[150px] flex-1 border-r last:border-r-0 border-gray-100 dark:border-gray-800 p-3 ${today?'bg-gray-50 dark:bg-gray-950/40':''}"><div class="flex items-center justify-between mb-3"><div><div class="text-[10px] uppercase tracking-wider text-gray-400">${d.toLocaleDateString('en-US',{weekday:'short'})}</div><div class="text-xl font-bold ${today?'text-accent':'text-gray-900 dark:text-white'}">${d.getDate()}</div></div><button onclick="CalendarApp.newOn('${d.toISOString()}')" class="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><i class="fas fa-plus text-xs"></i></button></div><div class="space-y-2">${dayEvents.length?dayEvents.map(e=>eventCard(e,true)).join(''):'<div class="text-[11px] text-gray-300 py-3 text-center">No plans</div>'}</div></div>`);
    }
    document.getElementById('calCanvas').innerHTML=`<div class="h-full min-w-[900px] flex">${html.join('')}</div>`;
  }

  function renderMonth(list) {
    const y=anchor.getFullYear(), m=anchor.getMonth(), first=new Date(y,m,1), start=addDays(first,-first.getDay()), days=[];
    document.getElementById('calRangeTitle').textContent=anchor.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    for(let i=0;i<42;i++){
      const d=addDays(start,i), inMonth=d.getMonth()===m, dayEvents=list.filter(e=>sameDay(e.starts_at,d));
      days.push(`<div class="min-h-[110px] border-r border-b border-gray-100 dark:border-gray-800 p-2 ${inMonth?'':'bg-gray-50/60 dark:bg-gray-950/20'}"><div class="flex items-center justify-between"><span class="text-xs font-semibold ${sameDay(d,new Date())?'text-accent':'text-gray-500'}">${d.getDate()}</span><button onclick="CalendarApp.newOn('${d.toISOString()}')" class="text-gray-300 hover:text-accent"><i class="fas fa-plus text-[10px]"></i></button></div><div class="mt-2 space-y-1">${dayEvents.slice(0,3).map(e=>eventCard(e,true)).join('')}${dayEvents.length>3?`<div class="text-[10px] text-gray-400">+${dayEvents.length-3} more</div>`:''}</div></div>`);
    }
    document.getElementById('calCanvas').innerHTML=`<div class="min-w-[850px]"><div class="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="p-2 text-center text-[10px] uppercase tracking-wider text-gray-400 font-semibold">${x}</div>`).join('')}</div><div class="grid grid-cols-7">${days.join('')}</div></div>`;
  }

  function renderAgenda(list) {
    const future=list.filter(e=>new Date(e.starts_at)>=startOfDay(new Date())).slice(0,100);
    document.getElementById('calRangeTitle').textContent='Upcoming';
    if(!future.length){document.getElementById('calCanvas').innerHTML='<div class="h-full flex items-center justify-center text-sm text-gray-400">Nothing scheduled yet.</div>';return;}
    let last='';
    document.getElementById('calCanvas').innerHTML=`<div class="p-4 space-y-4">${future.map(e=>{const d=new Date(e.starts_at),key=d.toDateString();const heading=key!==last?(last=key,`<div class="text-xs uppercase tracking-wider text-gray-400 font-semibold pt-2">${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>`):'';return heading+eventCard(e);}).join('')}</div>`;
  }

  function openModal(e=null,date=null){
    const modal=document.getElementById('calModal'); if(!modal)return;
    document.getElementById('calForm').reset(); document.getElementById('calEventId').value=e?.id||'';
    document.getElementById('calModalTitle').textContent=e?'Edit Event':'New Event';
    document.getElementById('calDelete').classList.toggle('hidden', !e || !(e.owner_id===currentId() || isAdmin()));
    document.getElementById('calTitleInput').value=e?.title||'';
    document.getElementById('calTypeInput').value=e?.event_type||'meeting';
    document.getElementById('calAssignee').value=e?.assigned_user_id || currentId() || '';
    document.getElementById('calVisibility').value=e?.visibility||'department';
    document.getElementById('calReminder').value=e?.reminder_minutes??'';
    document.getElementById('calLocation').value=e?.location||'';
    document.getElementById('calNotes').value=e?.notes||'';
    document.getElementById('calAllDay').checked=!!e?.all_day;
    const localVal = d => { const x=new Date(d); const off=x.getTimezoneOffset(); return new Date(x.getTime()-off*60000).toISOString().slice(0,16); };
    const s=e?.starts_at?new Date(e.starts_at):(date?new Date(date):new Date()); if(!e){s.setMinutes(Math.ceil(s.getMinutes()/30)*30,0,0);}
    const en=e?.ends_at?new Date(e.ends_at):new Date(s.getTime()+60*60000);
    document.getElementById('calStartInput').value=localVal(s); document.getElementById('calEndInput').value=localVal(en);
    modal.classList.remove('hidden'); modal.classList.add('flex');
  }

  function closeModal(){const m=document.getElementById('calModal');if(m){m.classList.add('hidden');m.classList.remove('flex');}}

  async function save(ev){
    ev.preventDefault();
    const id=document.getElementById('calEventId').value;
    const payload={
      title:document.getElementById('calTitleInput').value.trim(),
      event_type:document.getElementById('calTypeInput').value,
      assigned_user_id:document.getElementById('calAssignee').value||null,
      starts_at:new Date(document.getElementById('calStartInput').value).toISOString(),
      ends_at:document.getElementById('calEndInput').value?new Date(document.getElementById('calEndInput').value).toISOString():null,
      all_day:document.getElementById('calAllDay').checked,
      visibility:document.getElementById('calVisibility').value,
      reminder_minutes:document.getElementById('calReminder').value?Number(document.getElementById('calReminder').value):null,
      location:document.getElementById('calLocation').value.trim()||null,
      notes:document.getElementById('calNotes').value.trim()||null
    };
    if(!payload.title)return;
    let error;
    if(id) ({error}=await supabaseClient.from('calendar_events').update(payload).eq('id',id));
    else ({error}=await supabaseClient.from('calendar_events').insert({...payload,owner_id:currentId()}));
    if(error)return alert(error.message||'Could not save event.');
    closeModal(); await load();
  }

  async function remove(){
    const id=document.getElementById('calEventId').value; if(!id||!confirm('Delete this calendar event?'))return;
    const {error}=await supabaseClient.from('calendar_events').delete().eq('id',id); if(error)return alert(error.message||'Could not delete event.');
    closeModal(); await load();
  }

  function bind(){
    document.getElementById('calNewBtn').onclick=()=>openModal(); document.getElementById('calClose').onclick=closeModal; document.getElementById('calCancel').onclick=closeModal; document.getElementById('calForm').onsubmit=save; document.getElementById('calDelete').onclick=remove;
    document.querySelectorAll('.calMode').forEach(b=>b.onclick=()=>{mode=b.dataset.calMode;personFilter='all';render();});
    document.querySelectorAll('.calView').forEach(b=>b.onclick=()=>{viewMode=b.dataset.calView;render();});
    document.getElementById('calTypeFilter').onchange=e=>{typeFilter=e.target.value;render();};
    document.getElementById('calPersonFilter').onchange=e=>{personFilter=e.target.value;render();};
    document.getElementById('calToday').onclick=()=>{anchor=new Date();render();};
    document.getElementById('calPrev').onclick=()=>{anchor=viewMode==='month'?new Date(anchor.getFullYear(),anchor.getMonth()-1,1):addDays(anchor,viewMode==='week'?-7:-30);render();};
    document.getElementById('calNext').onclick=()=>{anchor=viewMode==='month'?new Date(anchor.getFullYear(),anchor.getMonth()+1,1):addDays(anchor,viewMode==='week'?7:30);render();};
    document.getElementById('calModal').addEventListener('click',e=>{if(e.target.id==='calModal')closeModal();});
  }

  async function open(){
    const view=shell();
    if(!view)return;
    view.classList.remove('hidden');
    bind();
    try{await load();}catch(err){console.error(err);const canvas=document.getElementById('calCanvas');if(canvas)canvas.innerHTML='<div class="h-full flex items-center justify-center text-red-500 text-sm">Could not load calendar.</div>';}
  }

  function edit(id){const e=events.find(x=>x.id===id);if(e)openModal(e);}
  function newOn(iso){openModal(null,iso);}

  return {open,edit,newOn};
})();
window.CalendarApp=CalendarApp;