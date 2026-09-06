// ---------- Team Updates / Notifications — single authoritative engine ----------
let teamUpdates = [];
let teamUpdateReads = new Map();
let teamDirectory = [];
let notificationEvents = [];
let teamUpdateFilter = 'all';
let notificationPollTimer = null;
let notificationPollBusy = false;
let notificationUnreadCount = 0;
let notificationLastServerState = null;
let notificationOpenId = null;

const notificationSound = new Audio('assets/confirm-notification.mp3?v=20260907');
notificationSound.preload = 'auto';
notificationSound.volume = 0.7;

function notificationSoundEnabled(){ return localStorage.getItem('taameer_notification_sound') !== 'off'; }
function desktopNotificationsEnabled(){ return localStorage.getItem('taameer_desktop_notifications') === 'on'; }
function teamProfile(id){ return teamDirectory.find(x => String(x.id) === String(id)); }
function notificationUserName(id){
  const p = teamProfile(id);
  return p?.full_name || (String(id) === String(state.currentUser?.id) ? state.currentUser.fullName : 'Team member');
}
function teamInitials(name='Team member'){ return String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || 'T'; }
function relativeTime(iso){
  const ms=Date.now()-new Date(iso).getTime(), min=Math.floor(ms/60000);
  if(min<1)return 'Just now'; if(min<60)return `${min}m ago`; const h=Math.floor(min/60); if(h<24)return `${h}h ago`; const d=Math.floor(h/24); if(d<7)return `${d}d ago`; return new Date(iso).toLocaleDateString();
}
function updateCategoryLabel(c){ return ({update:'Update',file_update:'File Update',action_required:'Action Required',approval:'Approval',deadline:'Deadline',announcement:'Announcement'})[c] || 'Update'; }
function eventLabel(type){ return ({reply:'replied',pinned:'pinned this update',unpinned:'unpinned this update',acknowledged:'confirmed they saw it'})[type] || 'updated this'; }
function eventIcon(type){ return ({reply:'fa-reply',pinned:'fa-thumbtack',unpinned:'fa-thumbtack',acknowledged:'fa-check-double'})[type] || 'fa-bell'; }
function teamAvatarHTML(id,size='w-11 h-11'){
  const p=teamProfile(id), name=p?.full_name||notificationUserName(id);
  if(p?.avatar) return `<img src="${Utils.escapeHTML(p.avatar)}" alt="" class="${size} rounded-full object-cover">`;
  return `<div class="${size} rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 flex items-center justify-center text-xs font-bold">${Utils.escapeHTML(teamInitials(name))}</div>`;
}

function ensureNotificationUI(){
  if(!document.getElementById('view-notifications')){
    const anchor=document.getElementById('view-settings');
    const parent=anchor?.parentElement;
    if(parent){
      const section=document.createElement('section');
      section.id='view-notifications';
      section.className='view-section hidden overflow-y-auto p-6';
      section.innerHTML=`<div class="max-w-6xl mx-auto">
        <div id="notificationHero" class="relative overflow-hidden mb-6 p-6 md:p-7 rounded-3xl bg-gradient-to-br from-gray-950 via-[#12131a] to-[#21183b] text-white border border-gray-800 shadow-sm">
          <div class="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[var(--accent)] opacity-30 blur-3xl"></div>
          <div class="absolute -bottom-24 left-1/3 w-56 h-56 rounded-full bg-[var(--accent)] opacity-10 blur-3xl"></div>
          <div class="relative flex items-start justify-between gap-5 flex-wrap">
            <div>
              <div class="flex items-center gap-3"><div class="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center"><i class="fas fa-bell text-[var(--accent)]"></i></div><div><h2 class="text-2xl font-bold">Team Updates</h2><p class="text-sm text-gray-400 mt-0.5">Fast updates. No noise. Everyone stays aligned.</p></div></div>
              <div class="mt-4 flex items-center gap-2 flex-wrap"><span id="teamUpdatesNewIndicator" class="hidden text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500 text-white"></span><span class="text-xs text-gray-500">Replies, confirmations and pin activity appear here too.</span></div>
            </div>
            <div class="flex gap-2 flex-wrap"><button id="teamSoundBtn" onclick="toggleTeamNotificationSound()" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium"></button><button id="teamDesktopBtn" onclick="requestDesktopTeamNotifications()" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium"></button><button onclick="openTeamUpdateComposer()" class="px-4 py-2 rounded-xl bg-white text-gray-950 text-sm font-semibold hover:bg-gray-100"><i class="fas fa-plus mr-2"></i>New Update</button></div>
          </div>
        </div>
        <div class="flex gap-2 flex-wrap mb-5 p-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-fit" id="teamUpdateFilters">
          <button onclick="setTeamUpdateFilter('all')" data-filter="all" class="px-4 py-2 rounded-xl text-xs font-medium">All</button><button onclick="setTeamUpdateFilter('unread')" data-filter="unread" class="px-4 py-2 rounded-xl text-xs font-medium">Unread</button><button onclick="setTeamUpdateFilter('important')" data-filter="important" class="px-4 py-2 rounded-xl text-xs font-medium">Important</button><button onclick="setTeamUpdateFilter('pinned')" data-filter="pinned" class="px-4 py-2 rounded-xl text-xs font-medium">Pinned</button>
        </div>
        <div id="teamUpdatesActivity" class="mb-5"></div>
        <div id="teamUpdatesFeed" class="space-y-3"></div>
      </div>`;
      parent.appendChild(section);
    }
  }

  if(!document.getElementById('teamUpdateComposer')){
    const composer=document.createElement('div');
    composer.className='modal-overlay'; composer.id='teamUpdateComposer';
    composer.innerHTML=`<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800 fade-in"><div class="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800"><div><h3 class="text-xl font-bold text-gray-900 dark:text-white">Share an Update</h3><p class="text-xs text-gray-500 mt-1">Keep it quick and useful.</p></div><button onclick="closeTeamUpdateComposer()" class="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><i class="fas fa-times"></i></button></div><form id="teamUpdateForm" class="p-5 space-y-4"><div><label class="block text-sm font-medium mb-2">To</label><select id="tuAudience" class="input-field" onchange="toggleSelectedRecipients()"><option value="team">Everyone</option><option value="selected">Selected people</option></select></div><div id="tuRecipientsWrap" class="hidden"><label class="block text-sm font-medium mb-2">People</label><div id="tuRecipients" class="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"></div></div><div class="grid grid-cols-2 gap-3"><div><label class="block text-sm font-medium mb-2">Type</label><select id="tuCategory" class="input-field"><option value="update">Update</option><option value="file_update">File Update</option><option value="action_required">Action Required</option><option value="approval">Approval</option><option value="deadline">Deadline</option><option value="announcement">Announcement</option></select></div><div><label class="block text-sm font-medium mb-2">Priority</label><select id="tuPriority" class="input-field"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></div></div><div><label class="block text-sm font-medium mb-2">Title</label><input id="tuTitle" class="input-field" maxlength="140" required></div><div><label class="block text-sm font-medium mb-2">Message</label><textarea id="tuMessage" class="input-field" rows="4" maxlength="3000" required></textarea></div><div><label class="block text-sm font-medium mb-2">Link <span class="text-xs text-gray-400">(optional)</span></label><input id="tuLink" type="url" class="input-field" placeholder="https://..."></div><div><label class="block text-sm font-medium mb-2">Attachment <span class="text-xs text-gray-400">(optional, max 10 MB)</span></label><input id="tuAttachment" type="file" class="input-field"></div><label class="flex items-center gap-2 text-sm"><input id="tuAck" type="checkbox" class="rounded border-gray-300"> Ask people to confirm they saw it</label><div class="flex gap-3 pt-2"><button type="button" onclick="closeTeamUpdateComposer()" class="btn-secondary flex-1">Cancel</button><button type="submit" class="btn-primary flex-1">Post Update</button></div></form></div>`;
    document.body.appendChild(composer);
    document.getElementById('teamUpdateForm')?.addEventListener('submit',publishTeamUpdate);
  }
  if(!document.getElementById('teamUpdateDetail')){
    const detail=document.createElement('div'); detail.className='modal-overlay'; detail.id='teamUpdateDetail';
    detail.innerHTML='<div id="teamUpdateDetailCard" class="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800 fade-in"></div>';
    document.body.appendChild(detail);
  }
  refreshNotificationControls();
}

function refreshNotificationControls(){
  const sb=document.getElementById('teamSoundBtn'); if(sb) sb.innerHTML=`<i class="fas ${notificationSoundEnabled()?'fa-volume-high':'fa-volume-xmark'} mr-2"></i>${notificationSoundEnabled()?'Sound On':'Sound Off'}`;
  const db=document.getElementById('teamDesktopBtn'); if(db){const on=desktopNotificationsEnabled()&&('Notification'in window)&&Notification.permission==='granted';db.innerHTML=`<i class="fas fa-display mr-2"></i>${on?'Desktop Alerts On':'Enable Desktop Alerts'}`;}
}
function toggleTeamNotificationSound(){
  const enabled=!notificationSoundEnabled(); localStorage.setItem('taameer_notification_sound',enabled?'on':'off'); refreshNotificationControls();
  if(enabled){ notificationSound.currentTime=0; notificationSound.play().catch(()=>{}); }
}
async function requestDesktopTeamNotifications(){
  if(!('Notification'in window))return alert('Desktop notifications are not supported by this browser.');
  const p=await Notification.requestPermission(); localStorage.setItem('taameer_desktop_notifications',p==='granted'?'on':'off'); refreshNotificationControls();
}
function showInAppNotification(title,body,id){
  let host=document.getElementById('teamNotificationToastHost'); if(!host){host=document.createElement('div');host.id='teamNotificationToastHost';host.className='fixed top-5 right-5 z-[9999] space-y-3 w-[360px] max-w-[calc(100vw-2rem)]';document.body.appendChild(host);}
  const toast=document.createElement('button'); toast.className='w-full text-left p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl'; toast.innerHTML=`<div class="flex gap-3"><div class="w-10 h-10 rounded-xl bg-gray-950 dark:bg-white text-white dark:text-gray-950 flex items-center justify-center"><i class="fas fa-bell"></i></div><div class="min-w-0 flex-1"><div class="font-semibold text-sm">${Utils.escapeHTML(title)}</div><div class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(body||'')}</div></div></div>`; toast.onclick=()=>{toast.remove();showView('notifications');if(id)setTimeout(()=>openTeamUpdate(id),50);}; host.prepend(toast); setTimeout(()=>toast.remove(),7000);
}
function showDesktopTeamNotification(title,body,id){
  if(!desktopNotificationsEnabled()||!('Notification'in window)||Notification.permission!=='granted')return;
  try{const n=new Notification(title,{body,tag:`taameer-${id||Date.now()}`,renotify:true});n.onclick=()=>{window.focus();showView('notifications');if(id)setTimeout(()=>openTeamUpdate(id),50);n.close();};setTimeout(()=>n.close(),9000);}catch(_){ }
}
async function playTeamNotificationSound(){
  if(!notificationSoundEnabled())return;
  try{notificationSound.pause();notificationSound.currentTime=0;notificationSound.volume=.7;await notificationSound.play();}catch(err){console.warn('Notification sound blocked',err);}
}
function announceNotification(title,body,id){ playTeamNotificationSound(); showInAppNotification(title,body,id); showDesktopTeamNotification(title,body,id); }

async function loadTeamDirectory(){ const {data,error}=await supabaseClient.rpc('team_directory'); if(error) throw error; teamDirectory=data||[]; }
async function loadNotificationEvents(){ const {data,error}=await supabaseClient.from('notification_events').select('*').eq('recipient_id',state.currentUser.id).order('created_at',{ascending:false}).limit(100); if(error) throw error; notificationEvents=data||[]; }
async function loadTeamUpdates(){
  if(!state.currentUser)return;
  ensureNotificationUI();
  const [{data:updates,error:uErr},{data:reads,error:rErr}]=await Promise.all([
    supabaseClient.from('notifications').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(200),
    supabaseClient.from('notification_reads').select('notification_id,read_at,acknowledged_at').eq('user_id',state.currentUser.id)
  ]);
  if(uErr)throw uErr; teamUpdates=updates||[]; teamUpdateReads=new Map((rErr?[]:(reads||[])).map(r=>[r.notification_id,r])); renderTeamUpdates();
}
async function getNotificationServerState(){ const {data,error}=await supabaseClient.rpc('notification_unread_state_v3'); if(error)throw error; return data?.[0]||null; }

function updateNotificationBadge(){
  const bell=document.querySelector('#dashboardView header i.fa-bell')?.closest('button'); if(!bell)return;
  bell.onclick=()=>showView('notifications'); bell.title='Team Updates'; bell.style.position='relative';
  bell.querySelectorAll('#notificationUnreadBadge').forEach(x=>x.remove()); bell.querySelectorAll('span.absolute.top-2.right-2.w-2.h-2').forEach(x=>x.remove());
  if(notificationUnreadCount>0){const b=document.createElement('span');b.id='notificationUnreadBadge';b.className='absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow-sm';b.textContent=notificationUnreadCount>99?'99+':String(notificationUnreadCount);bell.appendChild(b);}
  const ind=document.getElementById('teamUpdatesNewIndicator');if(ind){ind.classList.toggle('hidden',notificationUnreadCount===0);ind.textContent=notificationUnreadCount?`${notificationUnreadCount} new`:'';}
}

function setTeamUpdateFilter(filter){teamUpdateFilter=filter;renderTeamUpdates();}
function renderTeamUpdates(){
  const feed=document.getElementById('teamUpdatesFeed');if(!feed)return;
  document.querySelectorAll('#teamUpdateFilters [data-filter]').forEach(b=>{const active=b.dataset.filter===teamUpdateFilter;b.classList.toggle('bg-gray-950',active);b.classList.toggle('text-white',active);b.classList.toggle('dark:bg-white',active);b.classList.toggle('dark:text-gray-950',active);if(!active){b.classList.add('text-gray-500');}});
  let rows=[...teamUpdates];if(teamUpdateFilter==='unread')rows=rows.filter(n=>!teamUpdateReads.has(n.id)&&String(n.sender_id)!==String(state.currentUser.id));if(teamUpdateFilter==='important')rows=rows.filter(n=>n.priority==='important'||n.priority==='urgent');if(teamUpdateFilter==='pinned')rows=rows.filter(n=>n.pinned);
  if(!rows.length){feed.innerHTML='<div class="p-12 text-center text-sm text-gray-400 bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800 rounded-3xl">Nothing here yet.</div>';return;}
  feed.innerHTML=rows.map(n=>{const unread=!teamUpdateReads.has(n.id)&&String(n.sender_id)!==String(state.currentUser.id);const p=teamProfile(n.sender_id);const priority=n.priority==='urgent'?'<span class="px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[11px] font-semibold">Urgent</span>':n.priority==='important'?'<span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[11px] font-semibold">Important</span>':'';return `<button onclick="openTeamUpdate('${n.id}')" class="group relative w-full overflow-hidden text-left p-5 md:p-6 bg-white dark:bg-gray-900 border ${unread?'border-[var(--accent)] shadow-sm':'border-gray-200 dark:border-gray-800'} rounded-3xl hover:shadow-md transition-all">${unread?'<span class="absolute left-0 top-5 bottom-5 w-1 rounded-r-full bg-[var(--accent)]"></span>':''}<div class="flex gap-4 md:gap-5">${teamAvatarHTML(n.sender_id,'w-12 h-12')}<div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-4"><div><div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-[15px]">${Utils.escapeHTML(n.title)}</span>${unread?'<span class="px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold">NEW</span>':''}${n.pinned?'<i class="fas fa-thumbtack text-xs text-gray-400"></i>':''}</div><div class="text-xs text-gray-400 mt-1.5"><span class="font-medium text-gray-600 dark:text-gray-300">${Utils.escapeHTML(p?.full_name||notificationUserName(n.sender_id))}</span> · ${relativeTime(n.created_at)}</div></div>${priority}</div><p class="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">${Utils.escapeHTML(n.message)}</p><div class="flex gap-3 mt-4 text-[11px] text-gray-400"><span>${Utils.escapeHTML(updateCategoryLabel(n.category))}</span><span>${n.audience==='team'?'Everyone':'Selected people'}</span>${n.link_url?'<span><i class="fas fa-link mr-1"></i>Link</span>':''}${n.attachment_path?'<span><i class="fas fa-paperclip mr-1"></i>Attachment</span>':''}${n.require_ack?'<span><i class="fas fa-check-double mr-1"></i>Confirm</span>':''}</div></div></div></button>`;}).join('');
}
function renderNotificationActivity(){
  const el=document.getElementById('teamUpdatesActivity');if(!el)return;const recent=notificationEvents.slice(0,6);if(!recent.length){el.innerHTML='';return;}const unread=recent.filter(e=>!e.read_at).length;
  el.innerHTML=`<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden"><div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800"><div><div class="font-semibold text-sm">Recent activity</div><div class="text-xs text-gray-400 mt-0.5">Replies and actions on your updates</div></div>${unread?`<span class="px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[11px] font-semibold">${unread} new</span>`:''}</div><div class="divide-y divide-gray-100 dark:divide-gray-800">${recent.map(e=>`<button onclick="openNotificationEvent(${e.id})" class="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 ${e.read_at?'opacity-60':''}">${teamAvatarHTML(e.actor_id,'w-9 h-9')}<div class="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><i class="fas ${eventIcon(e.event_type)} text-xs"></i></div><div class="min-w-0 flex-1"><div class="text-sm"><span class="font-semibold">${Utils.escapeHTML(notificationUserName(e.actor_id))}</span> <span class="text-gray-500">${Utils.escapeHTML(eventLabel(e.event_type))}</span></div><div class="text-xs text-gray-400 mt-0.5 truncate">${Utils.escapeHTML(e.message||'Team Update')}</div></div><span class="text-xs text-gray-400">${relativeTime(e.created_at)}</span></button>`).join('')}</div></div>`;
}
async function openNotificationEvent(id){const e=notificationEvents.find(x=>Number(x.id)===Number(id));if(!e)return;await supabaseClient.from('notification_events').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',state.currentUser.id);await notificationTick(true);showView('notifications');setTimeout(()=>openTeamUpdate(e.notification_id),30);}

async function openTeamUpdateComposer(){ensureNotificationUI();if(!teamDirectory.length)await loadTeamDirectory();const box=document.getElementById('tuRecipients');box.innerHTML=teamDirectory.filter(p=>String(p.id)!==String(state.currentUser.id)).map(p=>`<label class="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-900"><input class="tuRecipient rounded" type="checkbox" value="${p.id}"><span class="text-sm">${Utils.escapeHTML(p.full_name||'Team member')}</span></label>`).join('');document.getElementById('teamUpdateForm').reset();toggleSelectedRecipients();document.getElementById('teamUpdateComposer').classList.add('show');}
function closeTeamUpdateComposer(){document.getElementById('teamUpdateComposer')?.classList.remove('show');}
function toggleSelectedRecipients(){document.getElementById('tuRecipientsWrap')?.classList.toggle('hidden',document.getElementById('tuAudience')?.value!=='selected');}
async function publishTeamUpdate(e){
  e.preventDefault();const submit=e.target.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Posting…';let uploadedPath=null;
  try{const audience=document.getElementById('tuAudience').value;const recipients=[...document.querySelectorAll('.tuRecipient:checked')].map(x=>x.value);if(audience==='selected'&&!recipients.length)throw new Error('Choose at least one person.');const file=document.getElementById('tuAttachment').files[0];let attachmentName=null;if(file){if(file.size>10*1024*1024)throw new Error('Attachment must be 10 MB or smaller.');attachmentName=file.name;const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');uploadedPath=`${state.currentUser.id}/${crypto.randomUUID()}-${safe}`;const {error}=await supabaseClient.storage.from('notification-attachments').upload(uploadedPath,file,{upsert:false});if(error)throw error;}const row={sender_id:state.currentUser.id,title:document.getElementById('tuTitle').value.trim(),message:document.getElementById('tuMessage').value.trim(),category:document.getElementById('tuCategory').value,priority:document.getElementById('tuPriority').value,audience,link_url:document.getElementById('tuLink').value.trim()||null,attachment_name:attachmentName,attachment_path:uploadedPath,require_ack:document.getElementById('tuAck').checked};const {data,error}=await supabaseClient.from('notifications').insert(row).select('id').single();if(error)throw error;if(audience==='selected'){const {error:rErr}=await supabaseClient.from('notification_recipients').insert(recipients.map(user_id=>({notification_id:data.id,user_id})));if(rErr)throw rErr;}closeTeamUpdateComposer();await notificationTick(true);}catch(err){if(uploadedPath)await supabaseClient.storage.from('notification-attachments').remove([uploadedPath]);alert(err?.message||'Could not post update.');}finally{submit.disabled=false;submit.textContent='Post Update';}
}

async function markTeamUpdateRead(id,acknowledge=false){const now=new Date().toISOString(),existing=teamUpdateReads.get(id);const payload={notification_id:id,user_id:state.currentUser.id,read_at:existing?.read_at||now,acknowledged_at:acknowledge?now:(existing?.acknowledged_at||null)};const {error}=await supabaseClient.from('notification_reads').upsert(payload,{onConflict:'notification_id,user_id'});if(error)throw error;teamUpdateReads.set(id,payload);}
async function loadTeamUpdateSeen(id,n){const el=document.getElementById('teamUpdateSeen');if(!el)return;const {data,error}=await supabaseClient.rpc('notification_seen_by_v3',{p_notification_id:id});if(error){el.innerHTML='<span class="text-xs text-red-500">Could not load status.</span>';return;}const rows=data||[],seen=rows.filter(x=>String(x.user_id)!==String(n.sender_id)),confirmed=seen.filter(x=>!!x.acknowledged_at);const people=arr=>arr.length?arr.map(x=>`<span class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs"><span class="w-6 h-6 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 flex items-center justify-center text-[9px] font-bold">${Utils.escapeHTML(teamInitials(x.full_name||'Team member'))}</span>${Utils.escapeHTML(x.full_name||'Team member')}</span>`).join(''):'<span class="text-sm text-gray-400">No one yet</span>';el.innerHTML=`<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div class="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Seen by</div><div class="flex flex-wrap gap-2">${people(seen)}</div></div>${n.require_ack?`<div class="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Confirmed by</div><div class="flex flex-wrap gap-2">${people(confirmed)}</div></div>`:''}</div>`;}
async function loadTeamUpdateReplies(id){const el=document.getElementById('teamUpdateReplies');if(!el)return;const {data,error}=await supabaseClient.from('notification_replies').select('id,user_id,message,created_at').eq('notification_id',id).order('created_at',{ascending:true});if(error||!data?.length){el.innerHTML='<div class="text-xs text-gray-400">No replies yet.</div>';return;}el.innerHTML=data.map(r=>`<div class="flex gap-3">${teamAvatarHTML(r.user_id,'w-9 h-9')}<div class="flex-1 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800"><div class="text-xs font-semibold">${Utils.escapeHTML(notificationUserName(r.user_id))}<span class="font-normal text-gray-400"> · ${relativeTime(r.created_at)}</span></div><div class="text-sm text-gray-600 dark:text-gray-300 mt-1">${Utils.escapeHTML(r.message)}</div></div></div>`).join('');}
async function openTeamUpdate(id){
  const n=teamUpdates.find(x=>String(x.id)===String(id));if(!n)return;notificationOpenId=id;try{await markTeamUpdateRead(id,false);}catch(err){console.error('Could not mark notification read',err);}const currentRead=teamUpdateReads.get(id);const card=document.getElementById('teamUpdateDetailCard');card.innerHTML=`<div class="p-7 border-b border-gray-200 dark:border-gray-800"><div class="flex items-start gap-4">${teamAvatarHTML(n.sender_id,'w-16 h-16')}<div class="flex-1"><div class="flex gap-2 flex-wrap mb-2"><span class="badge bg-gray-100 text-gray-600">${Utils.escapeHTML(updateCategoryLabel(n.category))}</span>${n.priority!=='normal'?`<span class="badge ${n.priority==='urgent'?'bg-red-50 text-red-600':'bg-amber-50 text-amber-700'}">${Utils.escapeHTML(n.priority)}</span>`:''}</div><h3 class="text-3xl font-bold">${Utils.escapeHTML(n.title)}</h3><p class="text-sm text-gray-500 mt-2">${Utils.escapeHTML(notificationUserName(n.sender_id))} · ${new Date(n.created_at).toLocaleString()}</p></div><button onclick="closeTeamUpdateDetail()" class="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><i class="fas fa-times"></i></button></div></div><div class="p-7"><p class="text-lg text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${Utils.escapeHTML(n.message)}</p><div class="flex gap-2 flex-wrap mt-5">${n.link_url?`<button onclick="window.open('${Utils.escapeHTML(n.link_url)}','_blank','noopener')" class="btn-secondary"><i class="fas fa-link mr-2"></i>Open Link</button>`:''}${n.attachment_path?`<button onclick="openTeamUpdateAttachment('${n.id}')" class="btn-secondary"><i class="fas fa-paperclip mr-2"></i>${Utils.escapeHTML(n.attachment_name||'Attachment')}</button>`:''}${n.require_ack&&!currentRead?.acknowledged_at?`<button onclick="acknowledgeTeamUpdate('${n.id}')" class="btn-primary"><i class="fas fa-check mr-2"></i>Got it</button>`:''}</div><div id="teamUpdateSeen" class="mt-7"></div><div class="mt-7 pt-5 border-t border-gray-200 dark:border-gray-800"><div class="font-semibold mb-3">Replies</div><div id="teamUpdateReplies" class="space-y-3 mb-4"></div><form onsubmit="replyToTeamUpdate(event,'${n.id}')" class="flex gap-2"><input id="teamUpdateReplyInput" class="input-field flex-1" maxlength="1000" placeholder="Write a quick reply…"><button class="btn-primary" type="submit"><i class="fas fa-paper-plane"></i></button></form></div>${(String(n.sender_id)===String(state.currentUser.id)||state.currentUser.role==='admin')?`<div class="mt-6 pt-5 border-t border-gray-200 dark:border-gray-800 flex gap-2"><button onclick="toggleTeamUpdatePin('${n.id}',${!n.pinned})" class="btn-secondary text-xs"><i class="fas fa-thumbtack mr-1"></i>${n.pinned?'Unpin':'Pin'}</button><button onclick="deleteTeamUpdate('${n.id}')" class="btn-secondary text-xs text-red-500"><i class="fas fa-trash mr-1"></i>Delete</button></div>`:''}</div>`;document.getElementById('teamUpdateDetail').classList.add('show');await Promise.all([loadTeamUpdateReplies(id),loadTeamUpdateSeen(id,n)]);await notificationTick(true);
}
function closeTeamUpdateDetail(){notificationOpenId=null;document.getElementById('teamUpdateDetail')?.classList.remove('show');}
async function acknowledgeTeamUpdate(id){await markTeamUpdateRead(id,true);await notificationTick(true);await openTeamUpdate(id);}
async function replyToTeamUpdate(e,id){e.preventDefault();const input=document.getElementById('teamUpdateReplyInput'),message=input.value.trim();if(!message)return;const {error}=await supabaseClient.from('notification_replies').insert({notification_id:id,user_id:state.currentUser.id,message});if(error)return alert(error.message);input.value='';await loadTeamUpdateReplies(id);}
async function openTeamUpdateAttachment(id){const n=teamUpdates.find(x=>x.id===id);if(!n?.attachment_path)return;const {data,error}=await supabaseClient.storage.from('notification-attachments').createSignedUrl(n.attachment_path,120);if(error)return alert('Could not open attachment.');window.open(data.signedUrl,'_blank','noopener');}
async function toggleTeamUpdatePin(id,pinned){const {error}=await supabaseClient.from('notifications').update({pinned,updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await notificationTick(true);await openTeamUpdate(id);}
async function deleteTeamUpdate(id){if(!confirm('Delete this update?'))return;const n=teamUpdates.find(x=>x.id===id);const {error}=await supabaseClient.from('notifications').delete().eq('id',id);if(error)return alert(error.message);if(n?.attachment_path)await supabaseClient.storage.from('notification-attachments').remove([n.attachment_path]);closeTeamUpdateDetail();await notificationTick(true);}

function showNotificationView(){ensureNotificationUI();document.querySelectorAll('.view-section').forEach(el=>el.classList.add('hidden'));document.getElementById('view-notifications')?.classList.remove('hidden');document.getElementById('headerTitle').textContent='Team Updates';document.getElementById('headerSubtitle').textContent='Updates from your marketing team';closeUserDropdown();notificationTick(true);}
const notificationBaseShowView=showView;
showView=function(viewName){if(viewName==='notifications')return showNotificationView();return notificationBaseShowView(viewName);};

async function notificationTick(initial=false){
  if(notificationPollBusy||!state.currentUser||!supabaseClient)return;notificationPollBusy=true;
  try{
    const previous=notificationLastServerState;
    const [serverState]=await Promise.all([getNotificationServerState(),loadTeamUpdates(),loadNotificationEvents()]);
    notificationUnreadCount=Number(serverState?.unread_updates||0)+Number(serverState?.unread_events||0);updateNotificationBadge();renderNotificationActivity();
    if(!initial&&previous){
      const updateChanged=serverState?.latest_update_id&&String(serverState.latest_update_id)!==String(previous.latest_update_id||'');
      const eventChanged=serverState?.latest_event_id&&String(serverState.latest_event_id)!==String(previous.latest_event_id||'');
      if(eventChanged)announceNotification(`${serverState.latest_event_actor_name||'Team member'} ${eventLabel(serverState.latest_event_type)}`,serverState.latest_event_notification_title||'Team Update',serverState.latest_event_notification_id);
      else if(updateChanged)announceNotification(`New Team Update — ${serverState.latest_update_title||'Team Update'}`,`${serverState.latest_update_sender_name||'Team member'} shared an update.`,serverState.latest_update_id);
    }
    notificationLastServerState=serverState;
    if(notificationOpenId){const n=teamUpdates.find(x=>String(x.id)===String(notificationOpenId));if(n)await Promise.all([loadTeamUpdateSeen(notificationOpenId,n),loadTeamUpdateReplies(notificationOpenId)]);}
  }catch(err){console.error('Team Updates tick failed',err);}finally{notificationPollBusy=false;}
}

async function initTeamUpdates(){
  if(!state.currentUser||!supabaseClient)return;
  ensureNotificationUI();
  if(notificationPollTimer){clearInterval(notificationPollTimer);notificationPollTimer=null;}
  notificationLastServerState=null;
  try{await loadTeamDirectory();await notificationTick(true);}catch(err){console.error('Team Updates initialization failed',err);}
  notificationPollTimer=setInterval(()=>notificationTick(false),1500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)notificationTick(false);},{passive:true});
  window.addEventListener('focus',()=>notificationTick(false));
}
function stopTeamUpdates(){if(notificationPollTimer){clearInterval(notificationPollTimer);notificationPollTimer=null;}notificationLastServerState=null;notificationUnreadCount=0;updateNotificationBadge();}

// Browser audio permission: one silent play/pause after first interaction helps later notification playback.
document.addEventListener('pointerdown',()=>{try{notificationSound.volume=0;const p=notificationSound.play();if(p?.then)p.then(()=>{notificationSound.pause();notificationSound.currentTime=0;notificationSound.volume=.7;}).catch(()=>{notificationSound.volume=.7;});}catch(_){notificationSound.volume=.7;}},{capture:true,once:true});
