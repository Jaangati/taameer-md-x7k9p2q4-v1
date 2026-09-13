// TAAMEER Requests v5 — completion routing + read controls
(() => {
  if(!window.RequestsApp) return;
  const esc=v=>Utils.escapeHTML(String(v??''));
  function ensureStyle(){if(document.getElementById('rqV5Styles'))return;const s=document.createElement('style');s.id='rqV5Styles';s.textContent=`.rq-mark-read{margin-left:auto;border:0;background:transparent;color:#64748b;font-size:9px;font-weight:850;text-decoration:underline;cursor:pointer}.rq-mark-read:hover{color:#111827}.dark .rq-mark-read:hover{color:#fff}.rq-mark-all{border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:7px 9px;font-size:10px;font-weight:850;color:#475569}.dark .rq-mark-all{background:#111827;border-color:#293244;color:#cbd5e1}`;document.head.appendChild(s);}

  async function markRead(id){
    if(!state.currentUser||!id)return;
    const now=new Date().toISOString();
    const {error}=await supabaseClient.from('work_request_reads').upsert({request_id:id,user_id:state.currentUser.id,last_seen_at:now},{onConflict:'request_id,user_id'});
    if(error)console.warn('Could not mark request read',error);
  }
  window.markRequestReadV5=async function(id,e){
    e?.stopPropagation?.();await markRead(id);try{await RequestsApp.open();RequestsApp.setStatus?.('unread');RequestsApp.updateSidebarBadge?.();}catch(_){}
  };
  window.markAllRequestsReadV5=async function(){
    if(!state.currentUser)return;
    try{
      const {data,error}=await supabaseClient.from('work_requests').select('id').is('deleted_at',null);if(error)throw error;
      const now=new Date().toISOString(),rows=(data||[]).map(r=>({request_id:r.id,user_id:state.currentUser.id,last_seen_at:now}));
      if(rows.length){const {error:e}=await supabaseClient.from('work_request_reads').upsert(rows,{onConflict:'request_id,user_id'});if(e)throw e;}
      await RequestsApp.open();RequestsApp.setStatus?.('unread');RequestsApp.updateSidebarBadge?.();
    }catch(e){console.error(e);alert('Could not mark request activity as read.');}
  };

  function requestIdFromRow(row){const raw=row.getAttribute('onclick')||'';return raw.match(/openDetail\('([^']+)'\)/)?.[1]||raw.match(/openDetail\("([^"]+)"\)/)?.[1]||'';}
  function enhanceUnreadControls(){
    ensureStyle();
    const activeUnread=[...document.querySelectorAll('#view-requests .rq-tab.active')].some(x=>/unread/i.test(x.textContent||''));
    const toolbar=document.querySelector('#view-requests .rq-toolbar');
    if(toolbar){toolbar.querySelector('.rq-mark-all')?.remove();if(activeUnread){const b=document.createElement('button');b.className='rq-mark-all';b.innerHTML='<i class="fas fa-check-double mr-1"></i>Mark all as read';b.onclick=window.markAllRequestsReadV5;toolbar.appendChild(b);}}
    document.querySelectorAll('#view-requests .rq-row').forEach(row=>{const id=requestIdFromRow(row);if(!id)return;const note=row.querySelector('.rq-attention-note');if(note&&!note.querySelector('.rq-mark-read')){const b=document.createElement('button');b.className='rq-mark-read';b.textContent='Mark read';b.onclick=e=>window.markRequestReadV5(id,e);note.appendChild(b);}});
  }

  const baseStatus=RequestsApp.setRequestStatus?.bind(RequestsApp);
  if(baseStatus)RequestsApp.setRequestStatus=async function(id,status){
    const result=await baseStatus(id,status);
    if(status==='closed'){
      // The user's own completion event should never come back as unread.
      await markRead(id);
      try{RequestsApp.setStatus?.('closed');RequestsApp.updateSidebarBadge?.();}catch(_){}
    }
    setTimeout(enhanceUnreadControls,120);
    return result;
  };

  const baseOpen=RequestsApp.open?.bind(RequestsApp);if(baseOpen)RequestsApp.open=async(...a)=>{const r=await baseOpen(...a);setTimeout(enhanceUnreadControls,120);return r;};
  const baseRender=RequestsApp.render?.bind(RequestsApp);if(baseRender)RequestsApp.render=(...a)=>{const r=baseRender(...a);setTimeout(enhanceUnreadControls,80);return r;};
  const obs=new MutationObserver(()=>setTimeout(enhanceUnreadControls,60));obs.observe(document.body,{subtree:true,childList:true});
  ensureStyle();setTimeout(enhanceUnreadControls,100);
})();