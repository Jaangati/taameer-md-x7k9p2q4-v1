// TAAMEER Requests v7 — authoritative reads, notification routing, cleaner team bar
(() => {
  if (!window.RequestsApp) return;

  let requestNotificationChannel = null;
  let requestNotificationPoll = null;
  let initializedNotifications = false;

  function ensureStyles(){
    if(document.getElementById('rqV7Styles')) return;
    const s=document.createElement('style');
    s.id='rqV7Styles';
    s.textContent=`
      #view-requests .rq-people-wrap{overflow:visible!important;padding-bottom:12px!important}
      #view-requests .rq-people{display:flex!important;flex-wrap:wrap!important;min-width:0!important;width:100%!important;gap:10px!important}
      #view-requests .rq-person{flex:1 1 155px!important;min-width:145px!important;max-width:none!important}
      #view-requests .rq-summary{grid-template-columns:repeat(6,minmax(0,1fr))}
      #view-requests .rq-mark-read-v7{margin-left:auto;border:0;background:transparent;color:#64748b;font-size:9px;font-weight:850;text-decoration:underline;cursor:pointer;white-space:nowrap}
      #view-requests .rq-mark-read-v7:hover{color:#111827}.dark #view-requests .rq-mark-read-v7:hover{color:#fff}
      #view-requests .rq-mark-all-v7{border:1px solid #dfe3e8;background:#fff;border-radius:10px;padding:7px 10px;font-size:10px;font-weight:850;color:#475569;display:inline-flex;align-items:center;gap:6px}
      .dark #view-requests .rq-mark-all-v7{background:#111827;border-color:#293244;color:#d1d5db}
      .rq-request-toast-host{position:fixed;top:18px;right:18px;z-index:12000;width:360px;max-width:calc(100vw - 36px);display:flex;flex-direction:column;gap:10px}
      .rq-request-toast{width:100%;text-align:left;padding:14px;background:rgba(255,255,255,.97);border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 18px 48px rgba(15,23,42,.16);backdrop-filter:blur(12px)}
      .dark .rq-request-toast{background:rgba(11,16,24,.97);border-color:#293244;color:#fff}
      .rq-request-toast .ico{width:38px;height:38px;border-radius:12px;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
      @media(max-width:700px){#view-requests .rq-person{flex:1 1 calc(50% - 6px)!important;min-width:135px!important}#view-requests .rq-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(s);
  }

  async function authoritativeMarkRead(id){
    if(!state.currentUser || !id) return false;
    const { error } = await supabaseClient.rpc('mark_work_request_read',{p_request_id:id});
    if(error){console.error('Mark request read failed',error);return false;}
    return true;
  }

  async function authoritativeMarkAllRead(){
    if(!state.currentUser) return false;
    const { error } = await supabaseClient.rpc('mark_all_work_requests_read');
    if(error){console.error('Mark all request activity read failed',error);return false;}
    return true;
  }

  function requestIdFromRow(row){
    const raw=row.getAttribute('onclick')||'';
    return raw.match(/openDetail\('([^']+)'\)/)?.[1] || raw.match(/openDetail\("([^"]+)"\)/)?.[1] || '';
  }

  function clearUnreadVisual(row){
    if(!row)return;
    row.classList.remove('rq-unread');
    row.querySelectorAll('.rq-new-chip,.rq-action-badge[title="New activity"],.rq-attention-note').forEach(x=>x.remove());
  }

  window.markRequestReadV7=async function(id,e){
    e?.preventDefault?.();e?.stopPropagation?.();
    const row=e?.target?.closest?.('.rq-row');
    const ok=await authoritativeMarkRead(id);
    if(!ok)return alert('Could not mark this activity as read.');
    clearUnreadVisual(row);
    try{
      await RequestsApp.open();
      RequestsApp.setStatus?.('unread');
      RequestsApp.updateSidebarBadge?.();
    }catch(err){console.warn('Request read refresh failed',err);}
  };

  window.markAllRequestsReadV7=async function(){
    const ok=await authoritativeMarkAllRead();
    if(!ok)return alert('Could not mark request activity as read.');
    document.querySelectorAll('#view-requests .rq-row').forEach(clearUnreadVisual);
    try{
      await RequestsApp.open();
      RequestsApp.setStatus?.('unread');
      RequestsApp.updateSidebarBadge?.();
    }catch(err){console.warn('Mark all refresh failed',err);}
  };

  function enhanceRequestUI(){
    ensureStyles();
    const summary=document.querySelector('#view-requests .rq-summary');
    if(summary){
      const unread=[...summary.querySelectorAll('.rq-stat')].find(x=>/unread activity/i.test(x.querySelector('.l')?.textContent||''));
      if(unread && summary.firstElementChild!==unread) summary.prepend(unread);
    }

    const activeUnread=[...document.querySelectorAll('#view-requests .rq-tab.active')].some(x=>/unread/i.test(x.textContent||''));
    const toolbar=document.querySelector('#view-requests .rq-toolbar');
    if(toolbar){
      toolbar.querySelectorAll('.rq-mark-all,.rq-mark-all-v7').forEach(x=>x.remove());
      if(activeUnread){
        const b=document.createElement('button');b.className='rq-mark-all-v7';b.innerHTML='<i class="fas fa-check-double"></i>Mark all as read';b.onclick=window.markAllRequestsReadV7;toolbar.appendChild(b);
      }
    }

    document.querySelectorAll('#view-requests .rq-row').forEach(row=>{
      row.querySelectorAll('.rq-mark-read,.rq-mark-read-v7').forEach(x=>x.remove());
      const id=requestIdFromRow(row);if(!id)return;
      const isUnread=row.classList.contains('rq-unread') || !!row.querySelector('.rq-new-chip,.rq-action-badge[title="New activity"]');
      if(!isUnread)return;
      let note=row.querySelector('.rq-attention-note');
      if(!note){
        const host=row.querySelector(':scope > div');if(!host)return;
        note=document.createElement('div');note.className='rq-attention-note';note.innerHTML='<i class="fas fa-bell mt-[1px]"></i><span>Unread activity</span>';host.appendChild(note);
      }
      const b=document.createElement('button');b.className='rq-mark-read-v7';b.textContent='Mark as read';b.onclick=e=>window.markRequestReadV7(id,e);note.appendChild(b);
    });
  }

  function toastRequestEvent(ev){
    let host=document.getElementById('rqRequestToastHost');
    if(!host){host=document.createElement('div');host.id='rqRequestToastHost';host.className='rq-request-toast-host';document.body.appendChild(host);}
    const icon=ev.event_type==='assigned'?'fa-list-check':ev.event_type==='completed'?'fa-circle-check':ev.event_type==='mentioned'?'fa-at':'fa-reply';
    const btn=document.createElement('button');btn.className='rq-request-toast';
    btn.innerHTML=`<div class="flex gap-3"><div class="ico"><i class="fas ${icon}"></i></div><div class="min-w-0 flex-1"><div class="font-bold text-sm">${Utils.escapeHTML(ev.title||'Request update')}</div><div class="text-xs text-gray-500 mt-1 line-clamp-2">${Utils.escapeHTML(ev.body||'Open Requests to view the update.')}</div></div></div>`;
    btn.onclick=()=>{btn.remove();showView('requests');setTimeout(()=>RequestsApp.openDetail?.(ev.request_id),180);};
    host.prepend(btn);setTimeout(()=>btn.remove(),8500);
  }

  async function playRequestSound(){
    try{
      if(typeof playTeamNotificationSound==='function'){await playTeamNotificationSound();return;}
      const a=new Audio('assets/confirm-notification.mp3?v=20260913-requests');a.volume=.82;await a.play();
    }catch(_){ }
  }

  function desktopRequestEvent(ev){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    try{
      const n=new Notification(ev.title||'Request update',{body:ev.body||'',tag:`request-${ev.id}`,renotify:true});
      n.onclick=()=>{window.focus();showView('requests');setTimeout(()=>RequestsApp.openDetail?.(ev.request_id),180);n.close();};
      setTimeout(()=>n.close(),9000);
    }catch(_){ }
  }

  async function consumeRequestEvent(ev,withSound=true){
    if(!ev || String(ev.recipient_id)!==String(state.currentUser?.id) || ev.seen_at)return;
    toastRequestEvent(ev);desktopRequestEvent(ev);if(withSound)playRequestSound();
    try{await supabaseClient.from('request_notification_events').update({seen_at:new Date().toISOString()}).eq('id',ev.id).eq('recipient_id',state.currentUser.id);}catch(_){ }
  }

  async function pullUnseenRequestEvents(playSoundForBatch=false){
    if(!state.currentUser)return;
    try{
      const {data,error}=await supabaseClient.from('request_notification_events').select('*').eq('recipient_id',state.currentUser.id).is('seen_at',null).order('created_at',{ascending:true}).limit(10);
      if(error)throw error;
      const rows=data||[];
      for(let i=0;i<rows.length;i++) await consumeRequestEvent(rows[i],playSoundForBatch && i===0);
    }catch(e){console.warn('Request notifications unavailable',e);}
  }

  async function initRequestNotifications(){
    if(!state.currentUser||!supabaseClient)return;
    if(requestNotificationChannel){try{await supabaseClient.removeChannel(requestNotificationChannel);}catch(_){}requestNotificationChannel=null;}
    if(requestNotificationPoll){clearInterval(requestNotificationPoll);requestNotificationPoll=null;}
    await pullUnseenRequestEvents(true);
    requestNotificationChannel=supabaseClient.channel(`request-events-${state.currentUser.id}-${Date.now()}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'request_notification_events',filter:`recipient_id=eq.${state.currentUser.id}`},payload=>consumeRequestEvent(payload.new,true))
      .subscribe();
    requestNotificationPoll=setInterval(()=>pullUnseenRequestEvents(false),15000);
    initializedNotifications=true;
  }

  const baseOpen=RequestsApp.open?.bind(RequestsApp);
  if(baseOpen)RequestsApp.open=async(...args)=>{const r=await baseOpen(...args);setTimeout(enhanceRequestUI,60);if(!initializedNotifications)initRequestNotifications();return r;};
  const baseRender=RequestsApp.render?.bind(RequestsApp);
  if(baseRender)RequestsApp.render=(...args)=>{const r=baseRender(...args);setTimeout(enhanceRequestUI,40);return r;};

  const obs=new MutationObserver(()=>setTimeout(enhanceRequestUI,40));obs.observe(document.body,{subtree:true,childList:true});
  ensureStyles();setTimeout(()=>{enhanceRequestUI();initRequestNotifications();},120);
})();