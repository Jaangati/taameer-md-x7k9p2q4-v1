// Team Updates runtime v5 — single authoritative notification engine
(function(){
  let timer = null;
  let lastState = null;
  let currentOpenId = null;
  let polling = false;

  function bell(){
    return document.querySelector('#dashboardView header i.fa-bell')?.closest('button') || null;
  }

  function paintBadge(count){
    const b = bell();
    if(!b) return;
    b.querySelectorAll('#notificationUnreadBadge').forEach(x=>x.remove());
    // remove original decorative dot only, never arbitrary content
    b.querySelectorAll('span.absolute.top-2.right-2.w-2.h-2').forEach(x=>x.remove());
    b.onclick = ()=>showView('notifications');
    b.title = 'Team Updates';
    b.style.position = 'relative';
    if(count>0){
      const s=document.createElement('span');
      s.id='notificationUnreadBadge';
      s.className='absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow-sm';
      s.textContent=count>99?'99+':String(count);
      b.appendChild(s);
    }
    const ind=document.getElementById('teamUpdatesNewIndicator');
    if(ind){
      ind.classList.toggle('hidden',count===0);
      ind.textContent=count?`${count} new`:'';
    }
  }

  async function getServerState(){
    const {data,error}=await supabaseClient.rpc('notification_unread_state_v3');
    if(error) throw error;
    return data?.[0] || {
      unread_updates:0, unread_events:0,
      latest_update_id:null, latest_update_title:null, latest_update_sender_name:null,
      latest_update_created_at:null, latest_event_id:null, latest_event_type:null,
      latest_event_actor_name:null, latest_event_notification_id:null,
      latest_event_notification_title:null, latest_event_created_at:null
    };
  }

  function eventLabel(t){
    return ({reply:'replied',pinned:'pinned this update',unpinned:'unpinned this update',acknowledged:'confirmed they saw it'})[t] || 'updated this';
  }

  async function playSound(){
    if(typeof notificationSoundEnabled==='function' && !notificationSoundEnabled()) return;
    try{
      if(typeof notificationSound!=='undefined'){
        notificationSound.pause();
        notificationSound.currentTime=0;
        notificationSound.volume=.7;
        await notificationSound.play();
      }
    }catch(err){ console.warn('Notification sound playback blocked',err); }
  }

  function announce(title,body,id){
    playSound();
    try{ if(typeof showInAppNotification==='function') showInAppNotification(title,body,id); }catch(_){ }
    try{ if(typeof showDesktopTeamNotification==='function') showDesktopTeamNotification(title,body,id); }catch(_){ }
  }

  async function refreshSeen(id){
    const el=document.getElementById('teamUpdateSeen');
    if(!el) return;
    const n=teamUpdates.find(x=>String(x.id)===String(id));
    if(!n) return;
    const {data,error}=await supabaseClient.rpc('notification_seen_by_v3',{p_notification_id:id});
    if(error){ console.error('Seen/confirmed status failed',error); return; }
    const rows=data||[];
    const seen=rows.filter(x=>String(x.user_id)!==String(n.sender_id));
    const confirmed=seen.filter(x=>x.acknowledged_at);
    const people=arr=>arr.length?arr.map(x=>`<span class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200"><span class="w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-[9px] font-bold">${Utils.escapeHTML(teamInitials(x.full_name||'Team member'))}</span>${Utils.escapeHTML(x.full_name||'Team member')}</span>`).join(''):'<span class="text-sm text-gray-400">No one yet</span>';
    el.innerHTML=`<div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4"><div class="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Seen by</div><div class="flex flex-wrap gap-2">${people(seen)}</div></div>${n.require_ack?`<div class="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Confirmed by</div><div class="flex flex-wrap gap-2">${people(confirmed)}</div></div>`:''}</div>`;
  }

  const originalOpen=window.openTeamUpdate;
  if(typeof originalOpen==='function'){
    window.openTeamUpdate=async function(id){
      currentOpenId=id;
      const r=await originalOpen(id);
      await refreshSeen(id);
      return r;
    };
  }
  const originalClose=window.closeTeamUpdateDetail;
  if(typeof originalClose==='function'){
    window.closeTeamUpdateDetail=function(){ currentOpenId=null; return originalClose(); };
  }
  window.loadTeamUpdateSeen=refreshSeen;

  async function tick(){
    if(polling || !supabaseClient) return;
    polling=true;
    try{
      const {data:sess}=await supabaseClient.auth.getSession();
      if(!sess?.session?.user) return;
      const s=await getServerState();
      const count=Number(s.unread_updates||0)+Number(s.unread_events||0);
      paintBadge(count);

      if(lastState){
        const prevCount=Number(lastState.unread_updates||0)+Number(lastState.unread_events||0);
        const updateChanged=s.latest_update_id && String(s.latest_update_id)!==String(lastState.latest_update_id||'');
        const eventChanged=s.latest_event_id && String(s.latest_event_id)!==String(lastState.latest_event_id||'');
        if(count>prevCount || updateChanged || eventChanged){
          if(eventChanged){
            announce(`${s.latest_event_actor_name||'Team member'} ${eventLabel(s.latest_event_type)}`,s.latest_event_notification_title||'Team Update',s.latest_event_notification_id);
          }else if(updateChanged){
            announce(`New Team Update — ${s.latest_update_title||'Team Update'}`,`${s.latest_update_sender_name||'Team member'} shared an update.`,s.latest_update_id);
          }
        }
      }
      lastState=s;

      // Refresh feed data from the canonical tables.
      if(typeof loadTeamUpdates==='function') await loadTeamUpdates();
      paintBadge(count); // base loader has its own badge code; overwrite it with server count.
      if(currentOpenId) await refreshSeen(currentOpenId);
    }catch(err){ console.error('Notification runtime v5 tick failed',err); }
    finally{ polling=false; }
  }

  async function start(){
    if(timer) return;
    await tick();
    timer=setInterval(tick,1500);
  }

  // Start now and also immediately after dashboard/auth becomes available.
  setTimeout(start,100);
  window.addEventListener('focus',tick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
})();