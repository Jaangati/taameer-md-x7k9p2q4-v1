// ---------- Team Updates v2: modern UI, named seen list, activity alerts, sound & desktop notifications ----------
let notificationEvents = [];
let notificationV2Channel = null;
const notificationSound = new Audio('assets/confirm-notification.mp3');
notificationSound.preload = 'auto';
notificationSound.volume = 0.65;

function notificationSoundEnabled(){ return localStorage.getItem('taameer_notification_sound') !== 'off'; }
function desktopNotificationsEnabled(){ return localStorage.getItem('taameer_desktop_notifications') === 'on'; }
function teamProfile(id){ return teamDirectory.find(x => String(x.id) === String(id)); }
function teamInitials(name='Team member'){ return String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || 'T'; }
function teamAvatarHTML(id, size='w-11 h-11'){
  const p = teamProfile(id); const name = p?.full_name || notificationUserName(id);
  if (p?.avatar) return `<img src="${Utils.escapeHTML(p.avatar)}" alt="" class="${size} rounded-full object-cover ring-2 ring-white dark:ring-gray-900">`;
  return `<div class="${size} rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-gray-900">${Utils.escapeHTML(teamInitials(name))}</div>`;
}
function relativeTime(iso){
  const ms=Date.now()-new Date(iso).getTime(), min=Math.floor(ms/60000);
  if(min<1)return 'Just now'; if(min<60)return `${min}m ago`; const h=Math.floor(min/60); if(h<24)return `${h}h ago`; const d=Math.floor(h/24); if(d<7)return `${d}d ago`; return new Date(iso).toLocaleDateString();
}
function eventLabel(type){return({reply:'replied',pinned:'pinned this update',unpinned:'unpinned this update',acknowledged:'confirmed they saw it'})[type]||'updated this';}
function eventIcon(type){return({reply:'fa-reply',pinned:'fa-thumbtack',unpinned:'fa-thumbtack',acknowledged:'fa-check-double'})[type]||'fa-bell';}

function playTeamNotificationSound(test=false){
  if(!test && !notificationSoundEnabled()) return;
  try{ notificationSound.currentTime=0; const p=notificationSound.play(); if(p?.catch)p.catch(()=>{}); }catch(_){ }
}
function showInAppNotification(title, body, notificationId){
  let host=document.getElementById('teamNotificationToastHost');
  if(!host){host=document.createElement('div');host.id='teamNotificationToastHost';host.className='fixed top-5 right-5 z-[9999] space-y-3 w-[360px] max-w-[calc(100vw-2rem)]';document.body.appendChild(host);}
  const toast=document.createElement('button');toast.className='w-full text-left p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl hover:-translate-y-0.5 transition-all';
  toast.innerHTML=`<div class="flex gap-3"><div class="w-10 h-10 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center"><i class="fas fa-bell"></i></div><div class="min-w-0 flex-1"><div class="font-semibold text-sm text-gray-900 dark:text-white">${Utils.escapeHTML(title)}</div><div class="text-xs text-gray-500 mt-1 line-clamp-2">${Utils.escapeHTML(body||'')}</div></div><i class="fas fa-times text-gray-300 text-xs mt-1"></i></div>`;
  toast.onclick=()=>{toast.remove();showView('notifications');if(notificationId)setTimeout(()=>openTeamUpdate(notificationId),50);};host.prepend(toast);setTimeout(()=>toast.remove(),7000);
}
function showDesktopTeamNotification(title, body, notificationId){
  if(!desktopNotificationsEnabled() || !('Notification' in window) || Notification.permission!=='granted')return;
  try{const n=new Notification(title,{body,icon:'',tag:`taameer-${notificationId||Date.now()}`,renotify:true});n.onclick=()=>{window.focus();showView('notifications');if(notificationId)setTimeout(()=>openTeamUpdate(notificationId),80);n.close();};setTimeout(()=>n.close(),9000);}catch(_){ }
}
function notifyIncoming(title, body, notificationId){playTeamNotificationSound();showInAppNotification(title,body,notificationId);showDesktopTeamNotification(title,body,notificationId);}

async function requestDesktopTeamNotifications(){
  if(!('Notification' in window)) return alert('Desktop notifications are not supported by this browser.');
  const permission=await Notification.requestPermission();
  localStorage.setItem('taameer_desktop_notifications',permission==='granted'?'on':'off');
  refreshNotificationV2Controls();
  if(permission==='granted')showInAppNotification('Desktop alerts enabled','TAAMEER updates can now appear as browser notifications.');
}
function toggleTeamNotificationSound(){
  const enabled=!notificationSoundEnabled();localStorage.setItem('taameer_notification_sound',enabled?'on':'off');refreshNotificationV2Controls();if(enabled)playTeamNotificationSound(true);
}
function refreshNotificationV2Controls(){
  const sb=document.getElementById('teamSoundBtn');if(sb)sb.innerHTML=`<i class="fas ${notificationSoundEnabled()?'fa-volume-high':'fa-volume-xmark'} mr-2"></i>${notificationSoundEnabled()?'Sound On':'Sound Off'}`;
  const db=document.getElementById('teamDesktopBtn');if(db){const on=desktopNotificationsEnabled()&&('Notification'in window)&&Notification.permission==='granted';db.innerHTML=`<i class="fas fa-display mr-2"></i>${on?'Desktop Alerts On':'Enable Desktop Alerts'}`;db.classList.toggle('opacity-60',on);}
}

const ensureNotificationUIV1=ensureNotificationUI;
ensureNotificationUI=function(){
  ensureNotificationUIV1();
  const view=document.getElementById('view-notifications');if(!view||document.getElementById('notificationV2Header'))return;
  const shell=view.querySelector('.max-w-5xl');if(!shell)return;shell.classList.remove('max-w-5xl');shell.classList.add('max-w-6xl');
  const oldHeader=shell.children[0];if(oldHeader)oldHeader.classList.add('hidden');
  const header=document.createElement('div');header.id='notificationV2Header';header.className='relative overflow-hidden mb-6 p-6 md:p-7 rounded-3xl bg-gray-950 text-white border border-gray-800 shadow-sm';
  header.innerHTML=`<div class="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[var(--accent)] opacity-20 blur-3xl"></div><div class="relative flex items-start justify-between gap-5 flex-wrap"><div><div class="flex items-center gap-3"><div class="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center"><i class="fas fa-bell text-[var(--accent)]"></i></div><div><h2 class="text-2xl font-bold">Team Updates</h2><p class="text-sm text-gray-400 mt-0.5">Fast updates. No noise. Everyone stays aligned.</p></div></div><div class="mt-4 flex items-center gap-2 flex-wrap"><span id="teamUpdatesNewIndicator" class="hidden text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500 text-white"></span><span class="text-xs text-gray-500">Replies, confirmations and pin activity appear here too.</span></div></div><div class="flex gap-2 flex-wrap"><button id="teamSoundBtn" onclick="toggleTeamNotificationSound()" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium"></button><button id="teamDesktopBtn" onclick="requestDesktopTeamNotifications()" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium"></button><button onclick="openTeamUpdateComposer()" class="px-4 py-2 rounded-xl bg-white text-gray-950 text-sm font-semibold hover:bg-gray-100"><i class="fas fa-plus mr-2"></i>New Update</button></div></div>`;
  shell.insertBefore(header,shell.firstChild);
  const filters=document.getElementById('teamUpdateFilters');if(filters){filters.className='flex gap-2 flex-wrap mb-5 p-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-fit';filters.querySelectorAll('button').forEach(b=>b.className='px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all');}
  const activity=document.createElement('div');activity.id='teamUpdatesActivity';activity.className='mb-5';filters?.insertAdjacentElement('afterend',activity);
  refreshNotificationV2Controls();
};

async function loadNotificationEvents(){
  const {data,error}=await supabaseClient.rpc('notification_event_feed',{p_limit:100});
  if(!error)notificationEvents=data||[];
}
loadTeamUpdates=async function(){
  if(!state.currentUser)return;ensureNotificationUI();
  const [{data:updates,error:uErr},{data:reads,error:rErr}]=await Promise.all([
    supabaseClient.from('notifications').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(200),
    supabaseClient.from('notification_reads').select('notification_id,read_at,acknowledged_at').eq('user_id',state.currentUser.id),
    loadNotificationEvents()
  ]);
  if(uErr){console.error(uErr);return;}teamUpdates=updates||[];teamUpdateReads=new Map((rErr?[]:reads||[]).map(r=>[r.notification_id,r]));renderTeamUpdates();renderNotificationActivity();updateNotificationBadge();
};

updateNotificationBadge=function(){
  const bell=document.querySelector('i.fa-bell')?.closest('button');if(!bell)return;bell.onclick=()=>showView('notifications');bell.title='Team Updates';bell.style.position='relative';bell.querySelectorAll('#notificationUnreadBadge').forEach(x=>x.remove());
  const unreadUpdates=teamUpdates.filter(n=>!teamUpdateReads.has(n.id)&&String(n.sender_id)!==String(state.currentUser?.id)).length;
  const unreadEvents=notificationEvents.filter(e=>!e.read_at).length;const count=unreadUpdates+unreadEvents;
  if(count){const badge=document.createElement('span');badge.id='notificationUnreadBadge';badge.className='absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow-sm';badge.textContent=count>99?'99+':String(count);bell.appendChild(badge);}
  const ind=document.getElementById('teamUpdatesNewIndicator');if(ind){ind.classList.toggle('hidden',!count);ind.textContent=count?`${count} new`:'';}
};

renderTeamUpdates=function(){
  const feed=document.getElementById('teamUpdatesFeed');if(!feed)return;
  document.querySelectorAll('#teamUpdateFilters [data-filter]').forEach(b=>{const active=b.dataset.filter===teamUpdateFilter;b.classList.toggle('bg-gray-950',active);b.classList.toggle('text-white',active);b.classList.toggle('dark:bg-white',active);b.classList.toggle('dark:text-gray-950',active);});
  let rows=[...teamUpdates];if(teamUpdateFilter==='unread')rows=rows.filter(n=>!teamUpdateReads.has(n.id));if(teamUpdateFilter==='important')rows=rows.filter(n=>n.priority==='important'||n.priority==='urgent');if(teamUpdateFilter==='pinned')rows=rows.filter(n=>n.pinned);
  if(!rows.length){feed.innerHTML='<div class="p-12 text-center text-sm text-gray-400 bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800 rounded-3xl"><div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><i class="fas fa-inbox"></i></div>Nothing here yet.</div>';return;}
  feed.innerHTML=rows.map(n=>{const unread=!teamUpdateReads.has(n.id)&&String(n.sender_id)!==String(state.currentUser?.id);const p=teamProfile(n.sender_id);const priority=n.priority==='urgent'?'<span class="px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 text-[11px] font-semibold">Urgent</span>':n.priority==='important'?'<span class="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 text-[11px] font-semibold">Important</span>':'';return `<button onclick="openTeamUpdate('${n.id}')" class="group relative w-full overflow-hidden text-left p-5 md:p-6 bg-white dark:bg-gray-900 border ${unread?'border-[var(--accent)] shadow-sm':'border-gray-200 dark:border-gray-800'} rounded-3xl hover:shadow-md hover:-translate-y-0.5 transition-all">${unread?'<span class="absolute left-0 top-5 bottom-5 w-1 rounded-r-full bg-[var(--accent)]"></span>':''}<div class="flex gap-4 md:gap-5">${teamAvatarHTML(n.sender_id,'w-12 h-12')}<div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-4"><div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-[15px] text-gray-900 dark:text-white">${Utils.escapeHTML(n.title)}</span>${unread?'<span class="px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold tracking-wide">NEW</span>':''}${n.pinned?'<span class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><i class="fas fa-thumbtack text-[10px]"></i></span>':''}</div><div class="text-xs text-gray-400 mt-1.5"><span class="font-medium text-gray-600 dark:text-gray-300">${Utils.escapeHTML(p?.full_name||notificationUserName(n.sender_id))}</span> · ${relativeTime(n.created_at)}</div></div>${priority}</div><p class="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed line-clamp-2">${Utils.escapeHTML(n.message)}</p><div class="flex items-center gap-2 flex-wrap mt-4"><span class="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500">${Utils.escapeHTML(updateCategoryLabel(n.category))}</span><span class="text-[11px] text-gray-400"><i class="fas fa-users mr-1"></i>${n.audience==='team'?'Everyone':'Selected people'}</span>${n.link_url?'<span class="text-[11px] text-gray-400"><i class="fas fa-link mr-1"></i>Link</span>':''}${n.attachment_path?'<span class="text-[11px] text-gray-400"><i class="fas fa-paperclip mr-1"></i>Attachment</span>':''}${n.require_ack?'<span class="text-[11px] text-gray-400"><i class="fas fa-check-double mr-1"></i>Confirmation</span>':''}<span class="ml-auto text-gray-300 group-hover:text-gray-500"><i class="fas fa-chevron-right text-xs"></i></span></div></div></div></button>`;}).join('');
};

function renderNotificationActivity(){
  const el=document.getElementById('teamUpdatesActivity');if(!el)return;const recent=notificationEvents.slice(0,6);if(!recent.length){el.innerHTML='';return;}
  const unread=recent.filter(e=>!e.read_at).length;
  el.innerHTML=`<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden"><div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800"><div><div class="font-semibold text-sm text-gray-900 dark:text-white">Recent activity</div><div class="text-xs text-gray-400 mt-0.5">Replies and actions on your updates</div></div>${unread?`<span class="px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 text-[11px] font-semibold">${unread} new</span>`:''}</div><div class="divide-y divide-gray-100 dark:divide-gray-800">${recent.map(e=>`<button onclick="openNotificationEvent(${e.id})" class="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${e.read_at?'opacity-70':''}">${teamAvatarHTML(e.actor_id,'w-9 h-9')}<div class="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><i class="fas ${eventIcon(e.event_type)} text-xs"></i></div><div class="min-w-0 flex-1"><div class="text-sm text-gray-700 dark:text-gray-300"><span class="font-semibold">${Utils.escapeHTML(e.actor_name||'Team member')}</span> ${Utils.escapeHTML(eventLabel(e.event_type))}</div><div class="text-xs text-gray-400 truncate mt-0.5">${Utils.escapeHTML(e.notification_title||'Team update')}${e.message?` · ${Utils.escapeHTML(e.message)}`:''}</div></div><span class="text-[11px] text-gray-400 whitespace-nowrap">${relativeTime(e.created_at)}</span>${!e.read_at?'<span class="w-2 h-2 rounded-full bg-[var(--accent)]"></span>':''}</button>`).join('')}</div></div>`;
}
async function openNotificationEvent(id){const e=notificationEvents.find(x=>String(x.id)===String(id));if(!e)return;if(!e.read_at){const now=new Date().toISOString();await supabaseClient.from('notification_events').update({read_at:now}).eq('id',id);e.read_at=now;}updateNotificationBadge();renderNotificationActivity();await openTeamUpdate(e.notification_id);}

loadTeamUpdateSeen=async function(id,n){
  const el=document.getElementById('teamUpdateSeen');if(!el)return;const {data,error}=await supabaseClient.rpc('notification_seen_by',{p_notification_id:id});if(error){el.innerHTML='';return;}
  const seen=(data||[]).filter(x=>String(x.user_id)!==String(n.sender_id));const ack=seen.filter(x=>x.acknowledged_at);
  const people=(arr)=>arr.length?arr.map(x=>`<span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300">${x.avatar?`<img src="${Utils.escapeHTML(x.avatar)}" class="w-5 h-5 rounded-full object-cover">`:`<span class="w-5 h-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-[8px] font-bold">${Utils.escapeHTML(teamInitials(x.full_name))}</span>`}${Utils.escapeHTML(x.full_name)}</span>`).join(''):'<span class="text-xs text-gray-400">No one yet</span>';
  el.innerHTML=`<div class="mt-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Seen by</div><div class="flex flex-wrap gap-2">${people(seen)}</div>${n.require_ack?`<div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Confirmed by</div><div class="flex flex-wrap gap-2">${people(ack)}</div>`:''}</div>`;
};

loadTeamUpdateReplies=async function(id){
  const el=document.getElementById('teamUpdateReplies');if(!el)return;const {data,error}=await supabaseClient.from('notification_replies').select('id,user_id,message,created_at').eq('notification_id',id).order('created_at',{ascending:true});if(error||!data?.length){el.innerHTML='<div class="py-4 text-center text-xs text-gray-400">No replies yet.</div>';return;}
  el.innerHTML=data.map(r=>`<div class="flex gap-3">${teamAvatarHTML(r.user_id,'w-8 h-8')}<div class="flex-1 p-3.5 rounded-2xl rounded-tl-md bg-gray-50 dark:bg-gray-800"><div class="flex items-center justify-between gap-3"><span class="text-xs font-semibold text-gray-700 dark:text-gray-300">${Utils.escapeHTML(notificationUserName(r.user_id))}</span><span class="text-[10px] text-gray-400">${relativeTime(r.created_at)}</span></div><div class="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">${Utils.escapeHTML(r.message)}</div></div></div>`).join('');
};

openTeamUpdate=async function(id){
  const n=teamUpdates.find(x=>x.id===id);if(!n)return;await markTeamUpdateRead(id,false);const card=document.getElementById('teamUpdateDetailCard');const currentRead=teamUpdateReads.get(id);const p=teamProfile(n.sender_id);const relatedEvents=notificationEvents.filter(e=>String(e.notification_id)===String(id)).slice(0,12);
  card.className='bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-gray-200 dark:border-gray-800 fade-in';
  card.innerHTML=`<div class="sticky top-0 z-10 p-5 md:p-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800"><div class="flex items-start justify-between gap-4"><div class="flex gap-3">${teamAvatarHTML(n.sender_id,'w-11 h-11')}<div><div class="flex items-center gap-2 flex-wrap mb-1"><span class="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500">${Utils.escapeHTML(updateCategoryLabel(n.category))}</span>${n.priority!=='normal'?`<span class="px-2.5 py-1 rounded-full ${n.priority==='urgent'?'bg-red-50 dark:bg-red-950/30 text-red-600':'bg-amber-50 dark:bg-amber-950/30 text-amber-600'} text-[11px] font-semibold">${Utils.escapeHTML(n.priority)}</span>`:''}${n.pinned?'<span class="px-2.5 py-1 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-[11px]"><i class="fas fa-thumbtack mr-1"></i>Pinned</span>':''}</div><h3 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">${Utils.escapeHTML(n.title)}</h3><p class="text-xs text-gray-400 mt-1.5"><span class="font-medium text-gray-600 dark:text-gray-300">${Utils.escapeHTML(p?.full_name||notificationUserName(n.sender_id))}</span> · ${new Date(n.created_at).toLocaleString()}</p></div></div><button onclick="closeTeamUpdateDetail()" class="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><i class="fas fa-times"></i></button></div></div><div class="p-5 md:p-6"><p class="text-[15px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-7">${Utils.escapeHTML(n.message)}</p><div class="flex gap-2 flex-wrap mt-5">${n.link_url?`<button onclick="window.open('${Utils.escapeHTML(n.link_url)}','_blank','noopener')" class="btn-secondary"><i class="fas fa-arrow-up-right-from-square mr-2"></i>Open Link</button>`:''}${n.attachment_path?`<button onclick="openTeamUpdateAttachment('${n.id}')" class="btn-secondary"><i class="fas fa-paperclip mr-2"></i>${Utils.escapeHTML(n.attachment_name||'Attachment')}</button>`:''}${n.require_ack&&!currentRead?.acknowledged_at?`<button onclick="acknowledgeTeamUpdate('${n.id}')" class="btn-primary"><i class="fas fa-check mr-2"></i>Got it</button>`:''}</div><div id="teamUpdateSeen"></div>${relatedEvents.length?`<div class="mt-6"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Activity</div><div class="space-y-2">${relatedEvents.map(e=>`<div class="flex items-center gap-3 text-xs text-gray-500"><div class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><i class="fas ${eventIcon(e.event_type)} text-[10px]"></i></div><span><strong class="text-gray-700 dark:text-gray-300">${Utils.escapeHTML(e.actor_name||'Team member')}</strong> ${Utils.escapeHTML(eventLabel(e.event_type))}</span><span class="ml-auto text-gray-400">${relativeTime(e.created_at)}</span></div>`).join('')}</div></div>`:''}<div class="mt-7 pt-6 border-t border-gray-100 dark:border-gray-800"><div class="font-semibold text-sm text-gray-900 dark:text-white mb-4">Replies</div><div id="teamUpdateReplies" class="space-y-3 mb-4"></div><form onsubmit="replyToTeamUpdate(event,'${n.id}')" class="flex gap-2"><input id="teamUpdateReplyInput" class="input-field flex-1" maxlength="1000" placeholder="Write a quick reply…"><button class="btn-primary" type="submit"><i class="fas fa-paper-plane"></i></button></form></div>${(String(n.sender_id)===String(state.currentUser.id)||state.currentUser.role==='admin')?`<div class="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 flex gap-2"><button onclick="toggleTeamUpdatePin('${n.id}',${!n.pinned})" class="btn-secondary text-xs"><i class="fas fa-thumbtack mr-1"></i>${n.pinned?'Unpin':'Pin'}</button><button onclick="deleteTeamUpdate('${n.id}')" class="btn-secondary text-xs text-red-500"><i class="fas fa-trash mr-1"></i>Delete</button></div>`:''}</div>`;
  document.getElementById('teamUpdateDetail').classList.add('show');loadTeamUpdateReplies(id);loadTeamUpdateSeen(id,n);
};

initTeamUpdates=async function(){
  if(!state.currentUser||!supabaseClient)return;ensureNotificationUI();await loadTeamDirectory();await loadTeamUpdates();
  if(teamUpdatesChannel)supabaseClient.removeChannel(teamUpdatesChannel);if(notificationV2Channel)supabaseClient.removeChannel(notificationV2Channel);
  notificationV2Channel=supabaseClient.channel(`team-updates-v2-${state.currentUser.id}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications'},payload=>{const n=payload.new;if(String(n.sender_id)!==String(state.currentUser.id)){notifyIncoming(`New Team Update — ${n.title}`,`${notificationUserName(n.sender_id)} shared an update.`,n.id);}loadTeamUpdates();})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'notifications'},()=>loadTeamUpdates())
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'notifications'},()=>loadTeamUpdates())
    .on('postgres_changes',{event:'*',schema:'public',table:'notification_reads'},()=>loadTeamUpdates())
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'notification_events'},payload=>{setTimeout(async()=>{await loadNotificationEvents();const e=notificationEvents.find(x=>String(x.id)===String(payload.new.id));if(e){notifyIncoming(`${e.actor_name||'Team member'} ${eventLabel(e.event_type)}`,e.notification_title||'Team Update',e.notification_id);}renderNotificationActivity();updateNotificationBadge();},120);})
    .subscribe();
};
