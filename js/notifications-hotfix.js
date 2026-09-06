// Team Updates reliability hotfix — numeric badge only + polling fallback for sound/badge
(function(){
  let audioUnlocked = false;
  let pollTimer = null;
  let pollStarted = false;
  let knownUpdateIds = new Set();
  let knownEventIds = new Set();

  async function unlockNotificationAudio(){
    if(audioUnlocked || typeof notificationSound === 'undefined') return;
    const oldVolume = notificationSound.volume;
    try{
      notificationSound.volume = 0;
      notificationSound.currentTime = 0;
      await notificationSound.play();
      notificationSound.pause();
      notificationSound.currentTime = 0;
      audioUnlocked = true;
    }catch(_){
      // Try again on the next user interaction.
    }finally{
      notificationSound.volume = oldVolume;
    }
  }

  ['pointerdown','keydown','touchstart'].forEach(evt => {
    document.addEventListener(evt, unlockNotificationAudio, {capture:true, passive:true});
  });

  // Keep only the numeric unread badge on the header bell.
  updateNotificationBadge = function(){
    const bell = document.querySelector('i.fa-bell')?.closest('button');
    if(!bell) return;

    bell.querySelectorAll('span').forEach(x => x.remove());
    bell.onclick = () => showView('notifications');
    bell.title = 'Team Updates';
    bell.style.position = 'relative';

    const unreadUpdates = teamUpdates.filter(n => !teamUpdateReads.has(n.id) && String(n.sender_id) !== String(state.currentUser?.id)).length;
    const unreadEvents = notificationEvents.filter(e => !e.read_at).length;
    const count = unreadUpdates + unreadEvents;

    if(count){
      const badge = document.createElement('span');
      badge.id = 'notificationUnreadBadge';
      badge.className = 'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow-sm';
      badge.textContent = count > 99 ? '99+' : String(count);
      bell.appendChild(badge);
    }

    const ind = document.getElementById('teamUpdatesNewIndicator');
    if(ind){
      ind.classList.toggle('hidden', !count);
      ind.textContent = count ? `${count} new` : '';
    }
  };

  const previousToggleSound = toggleTeamNotificationSound;
  toggleTeamNotificationSound = function(){
    previousToggleSound();
    if(notificationSoundEnabled()) unlockNotificationAudio();
  };

  async function pollNotifications(initial=false){
    if(!state.currentUser || !supabaseClient) return;
    try{
      const [{data:updates,error:uErr},{data:reads,error:rErr}] = await Promise.all([
        supabaseClient.from('notifications').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(200),
        supabaseClient.from('notification_reads').select('notification_id,read_at,acknowledged_at').eq('user_id',state.currentUser.id)
      ]);
      if(uErr) return;

      const previousUpdates = knownUpdateIds;
      const previousEvents = knownEventIds;

      teamUpdates = updates || [];
      teamUpdateReads = new Map((rErr ? [] : reads || []).map(r => [r.notification_id,r]));
      await loadNotificationEvents();

      if(!initial){
        const incomingUpdate = teamUpdates.find(n => !previousUpdates.has(String(n.id)) && String(n.sender_id) !== String(state.currentUser.id));
        const incomingEvent = notificationEvents.find(e => !previousEvents.has(String(e.id)) && !e.read_at);

        if(incomingUpdate){
          notifyIncoming(`New Team Update — ${incomingUpdate.title}`,`${notificationUserName(incomingUpdate.sender_id)} shared an update.`,incomingUpdate.id);
        } else if(incomingEvent){
          notifyIncoming(`${incomingEvent.actor_name || 'Team member'} ${eventLabel(incomingEvent.event_type)}`,incomingEvent.notification_title || 'Team Update',incomingEvent.notification_id);
        }
      }

      knownUpdateIds = new Set(teamUpdates.map(n => String(n.id)));
      knownEventIds = new Set(notificationEvents.map(e => String(e.id)));

      renderTeamUpdates();
      renderNotificationActivity();
      updateNotificationBadge();
    }catch(err){
      console.warn('Notification polling failed',err);
    }
  }

  async function startReliableNotificationPolling(){
    if(pollStarted || !state.currentUser) return;
    pollStarted = true;

    // Avoid duplicate realtime alerts; polling is deliberately used as the reliable transport here.
    try{
      if(teamUpdatesChannel) supabaseClient.removeChannel(teamUpdatesChannel);
      if(notificationV2Channel) supabaseClient.removeChannel(notificationV2Channel);
    }catch(_){ }

    await pollNotifications(true);
    pollTimer = setInterval(()=>pollNotifications(false),2500);
  }

  const previousInitTeamUpdates = initTeamUpdates;
  initTeamUpdates = async function(){
    await previousInitTeamUpdates();
    setTimeout(startReliableNotificationPolling,250);
  };

  window.addEventListener('focus',()=>pollNotifications(false));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollNotifications(false);});
})();
