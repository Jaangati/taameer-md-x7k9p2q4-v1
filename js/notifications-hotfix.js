// Team Updates reliability layer — server summary polling, robust badge, sound and named seen/confirmed
(function(){
  let pollTimer=null;
  let pollStarted=false;
  let previousUnreadTotal=null;
  let lastLatestUpdateId=null;
  let lastLatestEventId=null;

  function headerBellButton(){
    const buttons=[...document.querySelectorAll('button')].filter(b=>b.querySelector('i.fa-bell'));
    return buttons.find(b=>!b.closest('#view-notifications')&&!b.closest('.modal-overlay')) || buttons[0] || null;
  }

  function renderHeaderBadge(count){
    const bell=headerBellButton();
    if(!bell)return;
    bell.querySelectorAll('#notificationUnreadBadge').forEach(x=>x.remove());
    // Remove only old decorative dot(s), never the icon.
    bell.querySelectorAll('span').forEach(x=>{if(x.id!=='notificationUnreadBadge')x.remove();});
    bell.onclick=()=>showView('notifications');
    bell.title='Team Updates';
    bell.style.position='relative';
    if(count>0){
      const badge=document.createElement('span');
      badge.id='notificationUnreadBadge';
      badge.className='absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow-sm';
      badge.textContent=count>99?'99+':String(count);
      bell.appendChild(badge);
    }
    const ind=document.getElementById('teamUpdatesNewIndicator');
    if(ind){ind.classList.toggle('hidden',count===0);ind.textContent=count?`${count} new`:'';}
  }

  async function forcePlayNotificationSound(){
    if(!notificationSoundEnabled())return;
    try{
      notificationSound.pause();
      notificationSound.currentTime=0;
      notificationSound.muted=false;
      notificationSound.volume=.9;
      await notificationSound.play();
    }catch(err){
      console.warn('Notification sound blocked by browser',err);
    }
  }

  // Clicking Sound On remains the explicit browser gesture that authorizes later playback.
  const oldToggle=toggleTeamNotificationSound;
  toggleTeamNotificationSound=function(){
    oldToggle();
    if(notificationSoundEnabled()){
      notificationSound.muted=false;
      notificationSound.volume=.9;
      notificationSound.currentTime=0;
      notificationSound.play().catch(()=>{});
    }
  };

  async function serverSummary(){
    const {data,error}=await supabaseClient.rpc('notification_unread_summary');
    if(error)throw error;
    return Array.isArray(data)?(data[0]||{}):(data||{});
  }

  async function refreshNotificationState(initial=false){
    if(!state.currentUser||!supabaseClient)return;
    try{
      const [summaryResult,updatesResult,readsResult]=await Promise.all([
        serverSummary(),
        supabaseClient.from('notifications').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(200),
        supabaseClient.from('notification_reads').select('notification_id,read_at,acknowledged_at').eq('user_id',state.currentUser.id)
      ]);
      if(updatesResult.error)throw updatesResult.error;
      teamUpdates=updatesResult.data||[];
      teamUpdateReads=new Map(((readsResult.error?[]:readsResult.data)||[]).map(r=>[r.notification_id,r]));
      await loadNotificationEvents();

      const unreadUpdates=Number(summaryResult.unread_updates||0);
      const unreadEvents=Number(summaryResult.unread_events||0);
      const total=unreadUpdates+unreadEvents;
      renderHeaderBadge(total);
      renderTeamUpdates();
      renderNotificationActivity();

      if(!initial&&previousUnreadTotal!==null&&total>previousUnreadTotal){
        const newUpdate=summaryResult.latest_update_id && String(summaryResult.latest_update_id)!==String(lastLatestUpdateId);
        const newEvent=summaryResult.latest_event_id && String(summaryResult.latest_event_id)!==String(lastLatestEventId);
        await forcePlayNotificationSound();
        if(newUpdate){
          const sender=notificationUserName(summaryResult.latest_update_sender);
          showInAppNotification(`New Team Update — ${summaryResult.latest_update_title||'Update'}`,`${sender} shared an update.`,summaryResult.latest_update_id);
          showDesktopTeamNotification(`TAAMEER — ${summaryResult.latest_update_title||'New Team Update'}`,`${sender} shared an update.`,summaryResult.latest_update_id);
        }else if(newEvent){
          const label=eventLabel(summaryResult.latest_event_type);
          const actor=summaryResult.latest_event_actor_name||'Team member';
          showInAppNotification(`${actor} ${label}`,summaryResult.latest_event_title||'Team Update',summaryResult.latest_event_notification_id);
          showDesktopTeamNotification(`${actor} ${label}`,summaryResult.latest_event_title||'Team Update',summaryResult.latest_event_notification_id);
        }
      }

      previousUnreadTotal=total;
      lastLatestUpdateId=summaryResult.latest_update_id||null;
      lastLatestEventId=summaryResult.latest_event_id||null;
    }catch(err){
      console.warn('Notification state refresh failed',err);
    }
  }

  // Use the database as the source of truth for who saw / confirmed.
  loadTeamUpdateSeen=async function(id,n){
    const el=document.getElementById('teamUpdateSeen');if(!el)return;
    const {data,error}=await supabaseClient.rpc('notification_seen_by',{p_notification_id:id});
    if(error){console.error('Seen status failed',error);el.innerHTML='<div class="mt-4 text-xs text-red-400">Could not load seen status.</div>';return;}
    const rows=(data||[]).filter(x=>String(x.user_id)!==String(n.sender_id));
    const seen=rows.filter(x=>x.read_at);
    const confirmed=rows.filter(x=>x.acknowledged_at);
    const pills=arr=>arr.length?arr.map(x=>`<span class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200">${x.avatar?`<img src="${Utils.escapeHTML(x.avatar)}" class="w-6 h-6 rounded-full object-cover">`:`<span class="w-6 h-6 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 flex items-center justify-center text-[9px] font-bold">${Utils.escapeHTML(teamInitials(x.full_name||'Team member'))}</span>`}${Utils.escapeHTML(x.full_name||'Team member')}</span>`).join(''):'<span class="text-xs text-gray-400">No one yet</span>';
    el.innerHTML=`<div class="mt-6 grid gap-3 ${n.require_ack?'md:grid-cols-2':''}"><div class="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-3">Seen by</div><div class="flex flex-wrap gap-2">${pills(seen)}</div></div>${n.require_ack?`<div class="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-3">Confirmed by</div><div class="flex flex-wrap gap-2">${pills(confirmed)}</div></div>`:''}</div>`;
  };

  // Keep badge server-driven even when other UI functions call the old updater.
  updateNotificationBadge=function(){refreshNotificationState(true);};

  async function startPolling(){
    if(pollStarted||!state.currentUser)return;
    pollStarted=true;
    await refreshNotificationState(true);
    pollTimer=setInterval(()=>refreshNotificationState(false),2000);
  }

  const oldInit=initTeamUpdates;
  initTeamUpdates=async function(){
    await oldInit();
    setTimeout(startPolling,100);
  };

  window.addEventListener('focus',()=>refreshNotificationState(false));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshNotificationState(false);});
})();
