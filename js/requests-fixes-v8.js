// TAAMEER Requests v8 — stable unread controls + balanced team grid
(() => {
  if(!window.RequestsApp) return;

  const esc=v=>Utils.escapeHTML(String(v??''));
  const oldMarkSelectors='.rq-mark-read,.rq-mark-read-v7,.rq-mark-all,.rq-mark-all-v7';

  function ensureStyles(){
    if(document.getElementById('rqV8Styles')) return;
    const s=document.createElement('style');s.id='rqV8Styles';s.textContent=`
      #view-requests .rq-mark-read,#view-requests .rq-mark-read-v7,#view-requests .rq-mark-all,#view-requests .rq-mark-all-v7{display:none!important}
      #view-requests .rq-people-wrap{overflow:visible!important;padding:12px 22px 14px!important}
      #view-requests .rq-people{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;width:100%!important;min-width:0!important}
      #view-requests .rq-person{width:100%!important;min-width:0!important;max-width:none!important;padding:10px 12px!important;box-sizing:border-box!important}
      #view-requests .rq-person .count{margin-left:auto!important;flex:0 0 auto!important;min-width:28px!important}
      #view-requests .rq-person-name,#view-requests .rq-person-role{max-width:100%!important}
      #view-requests .rq-toolbar{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(240px,320px) auto!important;align-items:center!important;gap:12px!important}
      #view-requests .rq-tabs{min-width:0!important}
      #view-requests .rq-search{max-width:none!important;width:100%!important}
      #view-requests .rq-v8-all{border:1px solid #dfe3e8;background:#fff;border-radius:11px;padding:9px 12px;font-size:10px;font-weight:850;color:#475569;display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
      .dark #view-requests .rq-v8-all{background:#111827;border-color:#293244;color:#d1d5db}
      #view-requests .rq-v8-read{margin-left:auto;border:0;background:transparent;color:#475569;font-size:9px;font-weight:850;text-decoration:underline;cursor:pointer;white-space:nowrap}
      .dark #view-requests .rq-v8-read{color:#cbd5e1}
      #view-requests .rq-v8-read:hover{color:#111827}.dark #view-requests .rq-v8-read:hover{color:#fff}
      #view-requests .rq-attention-note{min-height:34px!important;display:flex!important;align-items:center!important;gap:8px!important}
      @media(max-width:1350px){#view-requests .rq-people{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
      @media(max-width:980px){#view-requests .rq-people{grid-template-columns:repeat(2,minmax(0,1fr))!important}#view-requests .rq-toolbar{grid-template-columns:1fr!important}.rq-v8-all{justify-self:start}}
      @media(max-width:620px){#view-requests .rq-people{grid-template-columns:1fr!important}}
    `;document.head.appendChild(s);
  }

  function requestIdFromRow(row){
    const raw=row?.getAttribute('onclick')||'';
    return raw.match(/openDetail\('([^']+)'\)/)?.[1] || raw.match(/openDetail\("([^"]+)"\)/)?.[1] || '';
  }

  async function markRead(id){
    const {error}=await supabaseClient.rpc('mark_work_request_read',{p_request_id:id});
    if(error) throw error;
  }
  async function markAllRead(){
    const {error}=await supabaseClient.rpc('mark_all_work_requests_read');
    if(error) throw error;
  }

  function clearRowUnread(row){
    if(!row)return;
    row.classList.remove('rq-unread');
    row.querySelectorAll('.rq-new-chip,.rq-action-badge[title="New activity"],.rq-v8-read').forEach(x=>x.remove());
    const note=row.querySelector('.rq-attention-note');
    if(note && /^(created|status changed|new reply|reopened|deadline changed|priority changed|unread activity)$/i.test((note.querySelector('span')?.textContent||'').trim())) note.remove();
  }

  window.markRequestReadV8=async function(id,e){
    e?.preventDefault?.();e?.stopPropagation?.();
    const row=e?.target?.closest?.('.rq-row');
    try{
      await markRead(id);
      clearRowUnread(row);
      RequestsApp.updateSidebarBadge?.();
      if([...document.querySelectorAll('#view-requests .rq-tab.active')].some(x=>/unread/i.test(x.textContent||''))){
        row?.remove();
        await RequestsApp.open();
        RequestsApp.setStatus?.('unread');
      } else {
        await RequestsApp.open();
      }
    }catch(err){console.error(err);alert('Could not mark this activity as read.');}
  };

  window.markAllRequestsReadV8=async function(){
    try{
      await markAllRead();
      document.querySelectorAll('#view-requests .rq-row').forEach(clearRowUnread);
      await RequestsApp.open();
      RequestsApp.setStatus?.('unread');
      RequestsApp.updateSidebarBadge?.();
    }catch(err){console.error(err);alert('Could not mark request activity as read.');}
  };

  function stabilize(){
    ensureStyles();
    const view=document.getElementById('view-requests');if(!view)return;

    // Old mutation-based controls still run in older layers; keep them invisible and remove duplicates.
    view.querySelectorAll(oldMarkSelectors).forEach(x=>x.remove());

    const summary=view.querySelector('.rq-summary');
    if(summary){
      const unread=[...summary.querySelectorAll('.rq-stat')].find(x=>/unread activity/i.test(x.querySelector('.l')?.textContent||''));
      if(unread && summary.firstElementChild!==unread) summary.prepend(unread);
    }

    const activeUnread=[...view.querySelectorAll('.rq-tab.active')].some(x=>/unread/i.test(x.textContent||''));
    const toolbar=view.querySelector('.rq-toolbar');
    if(toolbar){
      toolbar.querySelectorAll('.rq-v8-all').forEach((x,i)=>{if(i)x.remove();});
      let btn=toolbar.querySelector('.rq-v8-all');
      if(activeUnread){
        if(!btn){btn=document.createElement('button');btn.className='rq-v8-all';btn.innerHTML='<i class="fas fa-check-double"></i><span>Mark all as read</span>';btn.onclick=window.markAllRequestsReadV8;toolbar.appendChild(btn);}
      }else btn?.remove();
    }

    view.querySelectorAll('.rq-row').forEach(row=>{
      row.querySelectorAll('.rq-v8-read').forEach((x,i)=>{if(i)x.remove();});
      const unread=row.classList.contains('rq-unread') || !!row.querySelector('.rq-new-chip,.rq-action-badge[title="New activity"]');
      if(!unread){row.querySelectorAll('.rq-v8-read').forEach(x=>x.remove());return;}
      const id=requestIdFromRow(row);if(!id)return;
      let note=row.querySelector('.rq-attention-note');
      if(!note){
        const host=row.querySelector(':scope > div');if(!host)return;
        note=document.createElement('div');note.className='rq-attention-note';note.innerHTML='<i class="fas fa-bell"></i><span>Unread activity</span>';host.appendChild(note);
      }
      if(!note.querySelector('.rq-v8-read')){
        const b=document.createElement('button');b.className='rq-v8-read';b.textContent='Mark as read';b.onclick=e=>window.markRequestReadV8(id,e);note.appendChild(b);
      }
    });
  }

  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;stabilize();});}
  const baseOpen=RequestsApp.open?.bind(RequestsApp);if(baseOpen)RequestsApp.open=async(...a)=>{const r=await baseOpen(...a);schedule();return r;};
  const baseRender=RequestsApp.render?.bind(RequestsApp);if(baseRender)RequestsApp.render=(...a)=>{const r=baseRender(...a);schedule();return r;};
  const baseSetStatus=RequestsApp.setStatus?.bind(RequestsApp);if(baseSetStatus)RequestsApp.setStatus=(...a)=>{const r=baseSetStatus(...a);schedule();return r;};
  ensureStyles();setTimeout(schedule,120);
})();