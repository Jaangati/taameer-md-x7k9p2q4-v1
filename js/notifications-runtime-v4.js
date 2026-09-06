// Team Updates runtime v4 — independent background poller, badge, sound, popup, read/confirm refresh
(function(){
  let startedForUser = null;
  let timer = null;
  let lastLatestUpdateId = null;
  let lastLatestEventId = null;
  let firstPass = true;
  let currentOpenId = null;

  function bellButton(){
    return document.querySelector('#dashboardView header i.fa-bell')?.closest('button') || null;
  }

  function renderBadge(count){
    const bell = bellButton();
    if(!bell) return;
    bell.querySelectorAll('span').forEach(s => s.remove());
    bell.onclick = () => showView('notifications');
    bell.title = 'Team Updates';
    bell.style.position = 'relative';
    if(count > 0){
      const badge = document.createElement('span');
      badge.id = 'notificationUnreadBadge';
      badge.className = 'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow-sm';
      badge.textContent = count > 99 ? '99+' : String(count);
      bell.appendChild(badge);
    }
    const ind = document.getElementById('teamUpdatesNewIndicator');
    if(ind){
      ind.classList.toggle('hidden', count === 0);
      ind.textContent = count ? `${count} new` : '';
    }
  }

  async function playIncomingSound(){
    if(typeof notificationSoundEnabled === 'function' && !notificationSoundEnabled()) return;
    try{
      if(typeof notificationSound !== 'undefined'){
        notificationSound.pause();
        notificationSound.currentTime = 0;
        notificationSound.volume = 0.75;
        await notificationSound.play();
        return;
      }
    }catch(_){ }
    try{
      const a = new Audio('assets/confirm-notification.mp3?v=4');
      a.volume = 0.75;
      await a.play();
    }catch(err){ console.warn('Notification sound blocked', err); }
  }

  function fireIncoming(title, body, id){
    playIncomingSound();
    if(typeof showInAppNotification === 'function') showInAppNotification(title, body, id);
    if(typeof showDesktopTeamNotification === 'function') showDesktopTeamNotification(title, body, id);
  }

  async function getSessionUser(){
    try{
      const {data,error} = await supabaseClient.auth.getSession();
      if(error || !data?.session?.user) return null;
      return data.session.user;
    }catch(_){ return null; }
  }

  async function fetchState(uid){
    const [{data:updates,error:uErr},{data:reads,error:rErr},{data:events,error:eErr}] = await Promise.all([
      supabaseClient.from('notifications').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(200),
      supabaseClient.from('notification_reads').select('notification_id,read_at,acknowledged_at').eq('user_id',uid),
      supabaseClient.from('notification_events').select('id,notification_id,actor_id,event_type,message,created_at,read_at').eq('recipient_id',uid).order('created_at',{ascending:false}).limit(100)
    ]);
    if(uErr) throw uErr;
    return {
      updates: updates || [],
      reads: rErr ? [] : (reads || []),
      events: eErr ? [] : (events || [])
    };
  }

  async function refreshSeen(id){
    const el = document.getElementById('teamUpdateSeen');
    if(!el) return;
    const n = teamUpdates.find(x => String(x.id) === String(id));
    if(!n) return;
    const {data,error} = await supabaseClient.rpc('notification_seen_by_v3',{p_notification_id:id});
    if(error){ console.error('Seen/confirmed load failed', error); return; }
    const rows = data || [];
    const seen = rows.filter(x => String(x.user_id) !== String(n.sender_id));
    const confirmed = seen.filter(x => !!x.acknowledged_at);
    const people = arr => arr.length ? arr.map(x => `<span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300">${x.avatar ? `<img src="${Utils.escapeHTML(x.avatar)}" class="w-5 h-5 rounded-full object-cover">` : `<span class="w-5 h-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-[8px] font-bold">${Utils.escapeHTML(teamInitials(x.full_name || 'Team member'))}</span>`}${Utils.escapeHTML(x.full_name || 'Team member')}</span>`).join('') : '<span class="text-xs text-gray-400">No one yet</span>';
    el.innerHTML = `<div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4"><div class="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Seen by</div><div class="flex flex-wrap gap-2">${people(seen)}</div></div>${n.require_ack ? `<div class="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Confirmed by</div><div class="flex flex-wrap gap-2">${people(confirmed)}</div></div>` : ''}</div>`;
  }

  if(typeof openTeamUpdate === 'function'){
    const baseOpen = openTeamUpdate;
    openTeamUpdate = async function(id){
      currentOpenId = id;
      const result = await baseOpen(id);
      await refreshSeen(id);
      return result;
    };
  }
  if(typeof closeTeamUpdateDetail === 'function'){
    const baseClose = closeTeamUpdateDetail;
    closeTeamUpdateDetail = function(){ currentOpenId = null; return baseClose(); };
  }
  if(typeof loadTeamUpdateSeen === 'function') loadTeamUpdateSeen = refreshSeen;

  async function tick(){
    const user = await getSessionUser();
    if(!user) return;
    const uid = String(user.id);
    if(startedForUser !== uid){
      startedForUser = uid;
      firstPass = true;
      lastLatestUpdateId = null;
      lastLatestEventId = null;
      try{ if(typeof loadTeamDirectory === 'function') await loadTeamDirectory(); }catch(_){ }
    }

    let s;
    try{ s = await fetchState(uid); }catch(err){ console.error('Team Updates poll failed', err); return; }

    teamUpdates = s.updates;
    teamUpdateReads = new Map(s.reads.map(r => [r.notification_id,r]));
    if(typeof notificationEvents !== 'undefined') notificationEvents = s.events;

    const unreadUpdates = s.updates.filter(n => String(n.sender_id) !== uid && !teamUpdateReads.has(n.id));
    const unreadEvents = s.events.filter(e => !e.read_at);
    renderBadge(unreadUpdates.length + unreadEvents.length);

    const latestUpdate = s.updates.find(n => String(n.sender_id) !== uid) || null;
    const latestEvent = s.events[0] || null;

    if(!firstPass){
      if(latestUpdate && String(latestUpdate.id) !== String(lastLatestUpdateId || '')){
        const sender = typeof notificationUserName === 'function' ? notificationUserName(latestUpdate.sender_id) : 'Team member';
        fireIncoming(`New Team Update — ${latestUpdate.title}`, `${sender} shared an update.`, latestUpdate.id);
      } else if(latestEvent && String(latestEvent.id) !== String(lastLatestEventId || '')){
        const actor = typeof notificationUserName === 'function' ? notificationUserName(latestEvent.actor_id) : 'Team member';
        const label = ({reply:'replied',pinned:'pinned this update',unpinned:'unpinned this update',acknowledged:'confirmed they saw it'})[latestEvent.event_type] || 'updated this';
        fireIncoming(`${actor} ${label}`, latestEvent.message || 'Team Update', latestEvent.notification_id);
      }
    }

    lastLatestUpdateId = latestUpdate?.id || null;
    lastLatestEventId = latestEvent?.id || null;
    firstPass = false;

    try{ if(typeof renderTeamUpdates === 'function') renderTeamUpdates(); }catch(_){ }
    try{ if(typeof renderNotificationActivity === 'function') renderNotificationActivity(); }catch(_){ }
    if(currentOpenId) refreshSeen(currentOpenId);
  }

  async function start(){
    if(timer) return;
    await tick();
    timer = setInterval(tick, 1500);
  }

  document.addEventListener('pointerdown',()=>{
    try{
      if(typeof notificationSound !== 'undefined'){
        notificationSound.volume = 0;
        const p = notificationSound.play();
        if(p?.then) p.then(()=>{ notificationSound.pause(); notificationSound.currentTime=0; notificationSound.volume=.65; }).catch(()=>{ notificationSound.volume=.65; });
      }
    }catch(_){ }
  },{capture:true,once:true});

  setTimeout(start,300);
  window.addEventListener('focus',tick);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) tick(); });
})();
