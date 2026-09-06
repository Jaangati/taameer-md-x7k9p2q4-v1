// Team Updates reliability v3 — server-authoritative badge/read status + reliable sound
(function(){
  let pollTimer = null;
  let pollStarted = false;
  let activeUserId = null;
  let serverUnreadTotal = 0;
  let lastState = null;
  let currentOpenNotificationId = null;

  let audioCtx = null;
  let audioBuffer = null;
  let audioLoading = null;

  function headerBellButton(){
    return document.querySelector('#dashboardView header i.fa-bell')?.closest('button') || null;
  }

  function renderServerBadge(){
    const bell = headerBellButton();
    if(!bell) return;

    bell.querySelectorAll('span').forEach(x => x.remove());
    bell.onclick = () => showView('notifications');
    bell.title = 'Team Updates';
    bell.style.position = 'relative';

    if(serverUnreadTotal > 0){
      const badge = document.createElement('span');
      badge.id = 'notificationUnreadBadge';
      badge.className = 'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow-sm';
      badge.textContent = serverUnreadTotal > 99 ? '99+' : String(serverUnreadTotal);
      bell.appendChild(badge);
    }

    const ind = document.getElementById('teamUpdatesNewIndicator');
    if(ind){
      ind.classList.toggle('hidden', serverUnreadTotal === 0);
      ind.textContent = serverUnreadTotal ? `${serverUnreadTotal} new` : '';
    }
  }

  updateNotificationBadge = renderServerBadge;

  async function primeAudio(playTest=false){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return false;
      if(!audioCtx) audioCtx = new Ctx();
      if(audioCtx.state === 'suspended') await audioCtx.resume();

      if(!audioBuffer){
        if(!audioLoading){
          audioLoading = fetch('assets/confirm-notification.mp3', {cache:'force-cache'})
            .then(r => { if(!r.ok) throw new Error('Notification sound file unavailable'); return r.arrayBuffer(); })
            .then(buf => audioCtx.decodeAudioData(buf))
            .then(decoded => { audioBuffer = decoded; return decoded; })
            .catch(err => { console.error('Notification sound load failed', err); audioLoading = null; return null; });
        }
        await audioLoading;
      }

      if(playTest && audioBuffer) playAudioBuffer();
      return !!audioBuffer && audioCtx.state === 'running';
    }catch(err){
      console.warn('Notification audio could not be primed', err);
      return false;
    }
  }

  function playAudioBuffer(){
    if(!audioCtx || !audioBuffer || audioCtx.state !== 'running') return false;
    try{
      const src = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.7;
      src.buffer = audioBuffer;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start(0);
      return true;
    }catch(err){
      console.warn('Notification sound playback failed', err);
      return false;
    }
  }

  async function playReliableSound(){
    if(!notificationSoundEnabled()) return;
    if(playAudioBuffer()) return;

    try{
      if(audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
      if(playAudioBuffer()) return;
    }catch(_){ }

    try{
      notificationSound.currentTime = 0;
      notificationSound.volume = 0.7;
      await notificationSound.play();
    }catch(err){
      console.warn('Browser blocked notification sound until the next user interaction', err);
    }
  }

  const baseToggleSound = toggleTeamNotificationSound;
  toggleTeamNotificationSound = function(){
    const wasEnabled = notificationSoundEnabled();
    baseToggleSound();
    const nowEnabled = notificationSoundEnabled();
    if(nowEnabled && !wasEnabled) primeAudio(true);
    else if(nowEnabled) primeAudio(false);
  };

  const unlockFromGesture = () => {
    if(notificationSoundEnabled()) primeAudio(false);
  };
  document.addEventListener('pointerdown', unlockFromGesture, {capture:true});
  document.addEventListener('keydown', unlockFromGesture, {capture:true});
  document.addEventListener('touchstart', unlockFromGesture, {capture:true, passive:true});

  notifyIncoming = function(title, body, notificationId){
    playReliableSound();
    showInAppNotification(title, body, notificationId);
    showDesktopTeamNotification(title, body, notificationId);
  };

  loadTeamUpdateSeen = async function(id, n){
    const el = document.getElementById('teamUpdateSeen');
    if(!el) return;

    const {data,error} = await supabaseClient.rpc('notification_seen_by_v3', {p_notification_id:id});
    if(error){
      console.error('Could not load Seen by / Confirmed by', error);
      el.innerHTML = '<div class="mt-5 text-xs text-red-500">Could not load read status. Refresh and try again.</div>';
      return;
    }

    const rows = data || [];
    const seen = rows.filter(x => String(x.user_id) !== String(n.sender_id));
    const confirmed = seen.filter(x => !!x.acknowledged_at);

    const people = arr => arr.length
      ? arr.map(x => `<span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300">${x.avatar ? `<img src="${Utils.escapeHTML(x.avatar)}" class="w-5 h-5 rounded-full object-cover">` : `<span class="w-5 h-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-[8px] font-bold">${Utils.escapeHTML(teamInitials(x.full_name || 'Team member'))}</span>`}${Utils.escapeHTML(x.full_name || 'Team member')}</span>`).join('')
      : '<span class="text-xs text-gray-400">No one yet</span>';

    el.innerHTML = `<div class="mt-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Seen by</div><div class="flex flex-wrap gap-2">${people(seen)}</div>${n.require_ack ? `<div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Confirmed by</div><div class="flex flex-wrap gap-2">${people(confirmed)}</div>` : ''}</div>`;
  };

  const baseOpenTeamUpdate = openTeamUpdate;
  openTeamUpdate = async function(id){
    currentOpenNotificationId = id;
    return baseOpenTeamUpdate(id);
  };
  const baseCloseTeamUpdateDetail = closeTeamUpdateDetail;
  closeTeamUpdateDetail = function(){
    currentOpenNotificationId = null;
    return baseCloseTeamUpdateDetail();
  };

  function eventText(type){
    return ({reply:'replied',pinned:'pinned this update',unpinned:'unpinned this update',acknowledged:'confirmed they saw it'})[type] || 'updated this';
  }

  async function fetchServerState(){
    const {data,error} = await supabaseClient.rpc('notification_unread_state_v3');
    if(error){
      console.error('Notification unread state failed', error);
      return null;
    }
    return data?.[0] || null;
  }

  function isNewerTime(a,b){
    const aa = a ? new Date(a).getTime() : 0;
    const bb = b ? new Date(b).getTime() : 0;
    return aa > bb;
  }

  async function pollServer(initial=false){
    if(!state.currentUser || !supabaseClient) return;

    const s = await fetchServerState();
    if(!s) return;

    const nextTotal = Number(s.unread_updates || 0) + Number(s.unread_events || 0);

    if(!initial && lastState){
      const newUpdate = s.latest_update_id && String(s.latest_update_id) !== String(lastState.latest_update_id || '') && isNewerTime(s.latest_update_created_at, lastState.latest_update_created_at);
      const newEvent = s.latest_event_id && String(s.latest_event_id) !== String(lastState.latest_event_id || '') && isNewerTime(s.latest_event_created_at, lastState.latest_event_created_at);

      if(newUpdate){
        notifyIncoming(
          `New Team Update — ${s.latest_update_title || 'Team Update'}`,
          `${s.latest_update_sender_name || 'Team member'} shared an update.`,
          s.latest_update_id
        );
      } else if(newEvent){
        notifyIncoming(
          `${s.latest_event_actor_name || 'Team member'} ${eventText(s.latest_event_type)}`,
          s.latest_event_notification_title || 'Team Update',
          s.latest_event_notification_id
        );
      }
    }

    serverUnreadTotal = nextTotal;
    lastState = s;
    renderServerBadge();

    // Keep the feed/activity fresh from the database too.
    await loadTeamUpdates();
    serverUnreadTotal = nextTotal;
    renderServerBadge();

    if(currentOpenNotificationId){
      const n = teamUpdates.find(x => String(x.id) === String(currentOpenNotificationId));
      if(n) loadTeamUpdateSeen(currentOpenNotificationId, n);
    }
  }

  async function startPolling(){
    if(!state.currentUser) return;
    const uid = String(state.currentUser.id);
    if(pollStarted && activeUserId === uid) return;

    if(pollTimer) clearInterval(pollTimer);
    pollStarted = true;
    activeUserId = uid;
    lastState = null;

    try{
      if(teamUpdatesChannel) supabaseClient.removeChannel(teamUpdatesChannel);
      if(notificationV2Channel) supabaseClient.removeChannel(notificationV2Channel);
    }catch(_){ }

    await pollServer(true);
    pollTimer = setInterval(() => pollServer(false), 2000);
  }

  const baseInitTeamUpdates = initTeamUpdates;
  initTeamUpdates = async function(){
    await baseInitTeamUpdates();
    await startPolling();
  };

  window.addEventListener('focus', () => pollServer(false));
  document.addEventListener('visibilitychange', () => { if(!document.hidden) pollServer(false); });
})();
