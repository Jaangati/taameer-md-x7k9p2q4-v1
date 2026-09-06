// Team Updates hotfix — numeric badge only + reliable notification audio unlock
(function(){
  let audioUnlocked = false;

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
      // Browser may still require a direct user interaction; try again on the next interaction.
    }finally{
      notificationSound.volume = oldVolume;
    }
  }

  ['pointerdown','keydown','touchstart'].forEach(evt => {
    document.addEventListener(evt, unlockNotificationAudio, {capture:true, passive:true});
  });

  const previousUpdateNotificationBadge = updateNotificationBadge;
  updateNotificationBadge = function(){
    const bell = document.querySelector('i.fa-bell')?.closest('button');
    if(!bell) return previousUpdateNotificationBadge();

    // Remove the old decorative red dot and any previous numeric badge.
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

  // Keep the user's existing test behavior, but make sure clicking Sound On also unlocks future realtime playback.
  const previousToggleSound = toggleTeamNotificationSound;
  toggleTeamNotificationSound = function(){
    previousToggleSound();
    if(notificationSoundEnabled()) unlockNotificationAudio();
  };
})();
