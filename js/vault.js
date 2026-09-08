// TAAMEER Vault — shared department memory and smart reference search
const VaultApp = (() => {
  let items = [], profiles = [], filter = 'all', query = '', activeId = null;
  const TYPES = {
    all: ['All','fa-layer-group'], note:['Note','fa-note-sticky'], reference:['Reference','fa-bookmark'], list:['List','fa-list-check'], contact:['Contact','fa-address-card'], link:['Link','fa-link'], numbers:['Numbers','fa-hashtag'], copy:['Copy','fa-quote-left'], other:['Other','fa-box']
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const me = () => state.currentUser?.id;
  const admin = () => state.currentUser?.role === 'admin';
  const profile = id => profiles.find(p=>p.id===id)||{};
  const pname = id => profile(id).full_name || profile(id).username || 'Team member';
  const initials = id => pname(id).split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();

  async function load(){
    const [pi,ii]=await Promise.all([
      supabaseClient.from('profiles').select('id,full_name,username,avatar,status').eq('status','active'),
      supabaseClient.from('vault_items').select('*').order('is_pinned',{ascending:false}).order('updated_at',{ascending:false})
    ]);
    if(ii.error) throw ii.error;
    profiles=pi.data||[]; items=ii.data||[];
  }

  function shell(){
    const v=document.getElementById('view-vault'); if(!v)return null;
    v.className='view-section fade-in h-full';
    v.innerHTML='<div id="vaultRoot" class="h-full"></div>';
    return document.getElementById('vaultRoot');
  }

  async function open(){
    const r=shell(); if(!r)return;
    try{await load();render();ensureQuickCapture();}
    catch(e){console.error(e);r.innerHTML='<div class="h-full flex items-center justify-center text-red-500">Could not load Vault.</div>';}
  }

  function scoreItem(item,q){
    if(!q.trim()) return 1;
    const words=q.toLowerCase().split(/\s+/).filter(Boolean);
    const title=(item.title||'').toLowerCase(), body=(item.body||'').toLowerCase(), tags=(item.tags||[]).join(' ').toLowerCase(), type=(item.item_type||'').toLowerCase();
    const synonym={dimensions:['size','sizes','measurement','measurements','width','height','cm','mm'],models:['model','scale','mockup','maquette'],scale:['model','models','dimensions','size'],contact:['phone','email','number'],copy:['text','content','caption','wording']};
    let score=0;
    words.forEach(w=>{
      const variants=[w,...(synonym[w]||[])];
      variants.forEach(v=>{ if(title.includes(v))score+=8; if(tags.includes(v))score+=5; if(body.includes(v))score+=3; if(type.includes(v))score+=2; });
    });
    const full=q.toLowerCase(); if(title.includes(full))score+=12; if(body.includes(full))score+=6;
    return score;
  }

  function visibleItems(){
    let list=items.slice();
    if(filter==='pinned') list=list.filter(x=>x.is_pinned);
    else if(filter==='mine') list=list.filter(x=>x.created_by===me());
    else if(filter!=='all') list=list.filter(x=>x.item_type===filter);
    if(query.trim()) list=list.map(x=>({x,s:scoreItem(x,query)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s||new Date(b.x.updated_at)-new Date(a.x.updated_at)).map(o=>o.x);
    return list;
  }

  function render(){
    const r=document.getElementById('vaultRoot'); if(!r)return;
    const list=visibleItems();
    r.innerHTML=`<div class="h-full flex flex-col gap-4 overflow-hidden">
      <section class="rounded-3xl bg-gradient-to-r from-gray-950 via-gray-900 to-[var(--accent)] text-white px-7 py-5 flex items-center justify-between gap-6">
        <div><div class="text-[10px] tracking-[.22em] text-white/45 font-semibold">TAAMEER VAULT</div><h2 class="text-3xl font-bold mt-1">Save it once. Find it anytime.</h2><p class="text-sm text-white/55 mt-1">Your department’s shared memory.</p></div>
        <div class="flex gap-2"><button id="vaultAsk" class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm font-semibold"><i class="fas fa-sparkles mr-2"></i>Ask Vault</button><button id="vaultNew" class="px-4 py-2.5 rounded-xl bg-white text-gray-950 text-sm font-bold"><i class="fas fa-plus mr-2"></i>Save Something</button></div>
      </section>
      <section class="bg-white border rounded-2xl p-3 flex items-center gap-3 shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500"><i class="fas fa-magnifying-glass"></i></div>
        <input id="vaultSearch" value="${esc(query)}" class="flex-1 outline-none text-[15px]" placeholder="Search anything — models, dimensions, contacts, copy, links...">
        ${query?'<button id="vaultClear" class="w-9 h-9 rounded-xl hover:bg-gray-100 text-gray-400"><i class="fas fa-xmark"></i></button>':''}
      </section>
      <section class="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        <div class="flex gap-2">${[['all','All'],['pinned','Pinned'],['mine','Mine'],['reference','References'],['list','Lists'],['contact','Contacts'],['link','Links'],['numbers','Numbers'],['copy','Copy']].map(([k,l])=>`<button data-vf="${k}" class="whitespace-nowrap px-3.5 py-2 rounded-xl border text-sm font-semibold ${filter===k?'bg-gray-950 text-white border-gray-950':'bg-white text-gray-500'}">${l}</button>`).join('')}</div>
        <div class="text-xs text-gray-400 whitespace-nowrap">${list.length} item${list.length===1?'':'s'}</div>
      </section>
      <section class="flex-1 min-h-0 overflow-auto"><div class="columns-1 md:columns-2 xl:columns-3 gap-4 pb-4">${list.map(card).join('')||emptyState()}</div></section>
    </div>`;
    document.getElementById('vaultNew').onclick=()=>openEditor();
    document.getElementById('vaultAsk').onclick=()=>openAsk();
    const s=document.getElementById('vaultSearch'); s.oninput=e=>{query=e.target.value;render();}; s.focus(); try{s.setSelectionRange(query.length,query.length)}catch{}
    document.getElementById('vaultClear')?.addEventListener('click',()=>{query='';render();});
    r.querySelectorAll('[data-vf]').forEach(b=>b.onclick=()=>{filter=b.dataset.vf;render();});
    bindCards(r);
  }

  function emptyState(){return `<div class="break-inside-avoid mb-4 col-span-full border border-dashed rounded-3xl bg-white p-14 text-center"><div class="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400"><i class="fas fa-box-archive text-xl"></i></div><h3 class="font-bold mt-4">Nothing found</h3><p class="text-sm text-gray-400 mt-1">Save a useful reference or try a different search.</p></div>`}

  function iconFor(t){return TYPES[t]?.[1]||'fa-note-sticky'}
  function labelFor(t){return TYPES[t]?.[0]||'Note'}
  function avatarHtml(id){const p=profile(id);if(p.avatar)return `<img src="${esc(p.avatar)}" class="w-7 h-7 rounded-full object-cover">`;return `<span class="w-7 h-7 rounded-full bg-gray-950 text-white inline-flex items-center justify-center text-[9px] font-bold">${esc(initials(id))}</span>`}

  function card(x){
    const mine=x.created_by===me()||admin();
    const body=esc(x.body).replace(/\n/g,'<br>');
    return `<article class="vaultCard break-inside-avoid mb-4 bg-white rounded-3xl border p-5 hover:shadow-lg transition group" data-id="${x.id}">
      <div class="flex items-start justify-between gap-3"><div class="flex items-center gap-2"><span class="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 inline-flex items-center justify-center"><i class="fas ${iconFor(x.item_type)}"></i></span><div><span class="text-[10px] uppercase tracking-wider text-gray-400 font-bold">${labelFor(x.item_type)}</span>${x.is_pinned?'<span class="ml-2 text-[10px] text-amber-500 font-bold"><i class="fas fa-thumbtack mr-1"></i>Pinned</span>':''}</div></div><div class="flex opacity-0 group-hover:opacity-100 transition"><button data-copy="${x.id}" class="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400" title="Copy"><i class="fas fa-copy"></i></button>${mine?`<button data-more="${x.id}" class="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400" title="More"><i class="fas fa-ellipsis"></i></button>`:''}</div></div>
      ${x.title?`<h3 class="text-lg font-bold mt-4 text-gray-950">${esc(x.title)}</h3>`:''}
      <div class="text-sm text-gray-600 leading-6 mt-${x.title?'2':'4'} max-h-64 overflow-hidden">${body}</div>
      ${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener" class="mt-3 inline-flex items-center text-xs font-semibold text-[var(--accent)]"><i class="fas fa-arrow-up-right-from-square mr-1.5"></i>Open link</a>`:''}
      ${(x.tags||[]).length?`<div class="flex flex-wrap gap-1.5 mt-4">${x.tags.map(t=>`<span class="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500">#${esc(t)}</span>`).join('')}</div>`:''}
      <div class="flex items-center justify-between mt-5 pt-4 border-t"><div class="flex items-center gap-2">${avatarHtml(x.created_by)}<div><div class="text-[11px] font-semibold text-gray-700">${esc(pname(x.created_by))}</div><div class="text-[10px] text-gray-400">${new Date(x.updated_at).toLocaleDateString()}</div></div></div><span class="text-[10px] px-2 py-1 rounded-full ${x.visibility==='private'?'bg-gray-100 text-gray-500':'bg-emerald-50 text-emerald-600'}">${x.visibility==='private'?'Private':'Department'}</span></div>
    </article>`;
  }

  function bindCards(r){
    r.querySelectorAll('[data-copy]').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=items.find(i=>i.id===b.dataset.copy);navigator.clipboard?.writeText([x.title,x.body,x.source_url].filter(Boolean).join('\n'));toast('Copied to clipboard');});
    r.querySelectorAll('[data-more]').forEach(b=>b.onclick=e=>{e.stopPropagation();openActions(b.dataset.more);});
    r.querySelectorAll('.vaultCard').forEach(c=>c.onclick=e=>{if(e.target.closest('button,a'))return;openView(c.dataset.id);});
  }

  function modal(html){
    document.getElementById('vaultModal')?.remove();
    const d=document.createElement('div');d.id='vaultModal';d.className='fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center p-5';d.innerHTML=html;document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d)d.remove()});return d;
  }

  function openEditor(id=null,quick=false){
    const x=id?items.find(i=>i.id===id):null; activeId=id;
    const d=modal(`<div class="w-full ${quick?'max-w-xl':'max-w-2xl'} bg-white rounded-3xl shadow-2xl overflow-hidden"><div class="px-6 py-5 border-b flex items-center justify-between"><div><h3 class="text-xl font-bold">${id?'Edit Vault Item':'Save to Vault'}</h3><p class="text-sm text-gray-400 mt-1">${quick?'Drop it here. Find it later.':'Keep only what will be useful later.'}</p></div><button data-close class="w-10 h-10 rounded-xl hover:bg-gray-100"><i class="fas fa-xmark"></i></button></div><div class="p-6 space-y-4">
      <input id="veTitle" value="${esc(x?.title||'')}" class="w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-[var(--accent)]/20" placeholder="Title (optional)">
      <textarea id="veBody" rows="${quick?5:7}" class="w-full px-4 py-3 rounded-xl border outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]/20" placeholder="Write or paste anything useful...">${esc(x?.body||'')}</textarea>
      <div class="grid ${quick?'grid-cols-1':'grid-cols-2'} gap-3"><select id="veType" class="px-4 py-3 rounded-xl border bg-white">${Object.entries(TYPES).filter(([k])=>k!=='all').map(([k,v])=>`<option value="${k}" ${x?.item_type===k?'selected':''}>${v[0]}</option>`).join('')}</select><select id="veVisibility" class="px-4 py-3 rounded-xl border bg-white"><option value="department" ${x?.visibility!=='private'?'selected':''}>Department</option><option value="private" ${x?.visibility==='private'?'selected':''}>Private</option></select></div>
      ${quick?'':`<input id="veTags" value="${esc((x?.tags||[]).join(', '))}" class="w-full px-4 py-3 rounded-xl border" placeholder="Tags — models, cityscape, dimensions"><input id="veUrl" value="${esc(x?.source_url||'')}" class="w-full px-4 py-3 rounded-xl border" placeholder="Optional link / source URL">`}
    </div><div class="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50"><button data-close class="px-4 py-2.5 rounded-xl bg-white border font-semibold">Cancel</button><button id="veSave" class="px-5 py-2.5 rounded-xl bg-gray-950 text-white font-bold"><i class="fas fa-check mr-2"></i>Save</button></div></div>`);
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.remove());
    document.getElementById('veSave').onclick=()=>saveEditor(id,quick,d);
    setTimeout(()=>document.getElementById(quick?'veBody':'veTitle')?.focus(),50);
  }

  async function saveEditor(id,quick,d){
    const body=document.getElementById('veBody').value.trim(); if(!body)return toast('Add something first');
    const payload={title:document.getElementById('veTitle').value.trim()||null,body,item_type:document.getElementById('veType').value,visibility:document.getElementById('veVisibility').value,created_by:id?undefined:me()};
    if(!quick){payload.tags=document.getElementById('veTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean);payload.source_url=document.getElementById('veUrl').value.trim()||null;}
    let res;if(id){delete payload.created_by;res=await supabaseClient.from('vault_items').update(payload).eq('id',id).select('*').single();}else res=await supabaseClient.from('vault_items').insert(payload).select('*').single();
    if(res.error)return alert(res.error.message); if(id)items=items.map(i=>i.id===id?res.data:i);else items.unshift(res.data);d.remove();render();toast('Saved to Vault');
  }

  function openView(id){const x=items.find(i=>i.id===id);if(!x)return;const can=x.created_by===me()||admin();const d=modal(`<div class="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"><div class="p-6 border-b flex items-start justify-between"><div><div class="text-[10px] uppercase tracking-wider text-gray-400 font-bold"><i class="fas ${iconFor(x.item_type)} mr-2"></i>${labelFor(x.item_type)}</div><h3 class="text-2xl font-bold mt-2">${esc(x.title||'Untitled')}</h3></div><button data-close class="w-10 h-10 rounded-xl hover:bg-gray-100"><i class="fas fa-xmark"></i></button></div><div class="p-6"><div class="text-[15px] leading-7 whitespace-pre-wrap text-gray-700">${esc(x.body)}</div>${(x.tags||[]).length?`<div class="flex gap-2 flex-wrap mt-5">${x.tags.map(t=>`<span class="text-xs px-2.5 py-1 rounded-full bg-gray-100">#${esc(t)}</span>`).join('')}</div>`:''}<div class="mt-6 pt-5 border-t flex items-center justify-between"><div class="flex items-center gap-2">${avatarHtml(x.created_by)}<span class="text-sm text-gray-500">Added by <b class="text-gray-800">${esc(pname(x.created_by))}</b></span></div><div class="flex gap-2"><button id="vvCopy" class="px-3 py-2 rounded-xl border text-sm font-semibold"><i class="fas fa-copy mr-2"></i>Copy</button>${can?'<button id="vvEdit" class="px-3 py-2 rounded-xl bg-gray-950 text-white text-sm font-semibold"><i class="fas fa-pen mr-2"></i>Edit</button>':''}</div></div></div></div>`);d.querySelector('[data-close]').onclick=()=>d.remove();document.getElementById('vvCopy').onclick=()=>{navigator.clipboard?.writeText([x.title,x.body,x.source_url].filter(Boolean).join('\n'));toast('Copied to clipboard')};document.getElementById('vvEdit')?.addEventListener('click',()=>{d.remove();openEditor(id)});}

  function openActions(id){const x=items.find(i=>i.id===id);if(!x)return;const d=modal(`<div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-3"><button id="vaPin" class="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold"><i class="fas fa-thumbtack w-6"></i>${x.is_pinned?'Unpin':'Pin'}</button><button id="vaEdit" class="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold"><i class="fas fa-pen w-6"></i>Edit</button><button id="vaDelete" class="w-full text-left px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 font-semibold"><i class="fas fa-trash w-6"></i>Delete</button></div>`);document.getElementById('vaPin').onclick=async()=>{const {data,error}=await supabaseClient.from('vault_items').update({is_pinned:!x.is_pinned}).eq('id',id).select('*').single();if(error)return alert(error.message);items=items.map(i=>i.id===id?data:i);d.remove();render()};document.getElementById('vaEdit').onclick=()=>{d.remove();openEditor(id)};document.getElementById('vaDelete').onclick=async()=>{if(!confirm('Delete this Vault item?'))return;const {error}=await supabaseClient.from('vault_items').delete().eq('id',id);if(error)return alert(error.message);items=items.filter(i=>i.id!==id);d.remove();render();toast('Deleted')};}

  function openAsk(){
    const d=modal(`<div class="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden"><div class="p-6 bg-gray-950 text-white flex justify-between"><div><div class="text-[10px] tracking-[.2em] text-white/40">ASK VAULT</div><h3 class="text-2xl font-bold mt-1">Ask your department memory.</h3><p class="text-sm text-white/50 mt-1">Answers are grounded only in saved Vault items.</p></div><button data-close class="w-10 h-10 rounded-xl hover:bg-white/10"><i class="fas fa-xmark"></i></button></div><div class="p-6"><div class="flex gap-2"><input id="askInput" class="flex-1 px-4 py-3 rounded-xl border outline-none" placeholder="e.g. What are the scale model dimensions?"><button id="askGo" class="px-5 py-3 rounded-xl bg-[var(--accent)] text-white font-bold">Ask</button></div><div id="askResult" class="mt-5"></div></div></div>`);d.querySelector('[data-close]').onclick=()=>d.remove();const run=()=>answerAsk();document.getElementById('askGo').onclick=run;document.getElementById('askInput').onkeydown=e=>{if(e.key==='Enter')run()};setTimeout(()=>document.getElementById('askInput').focus(),50);
  }

  function answerAsk(){const q=document.getElementById('askInput').value.trim();if(!q)return;const ranked=items.map(x=>({x,s:scoreItem(x,q)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).slice(0,5);const r=document.getElementById('askResult');if(!ranked.length){r.innerHTML='<div class="p-5 rounded-2xl bg-gray-50 text-gray-500">I couldn’t find this in Vault.</div>';return;}const top=ranked.slice(0,3).map(o=>o.x);r.innerHTML=`<div class="p-5 rounded-2xl bg-gray-50"><div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Vault answer</div><div class="mt-3 space-y-3">${top.map(x=>`<div><div class="font-bold text-gray-900">${esc(x.title||labelFor(x.item_type))}</div><div class="text-sm text-gray-600 whitespace-pre-wrap mt-1">${esc(x.body.length>500?x.body.slice(0,500)+'…':x.body)}</div></div>`).join('')}</div></div><div class="mt-4"><div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Sources</div>${top.map(x=>`<button data-source="${x.id}" class="w-full text-left px-4 py-3 rounded-xl border mb-2 hover:bg-gray-50"><b>${esc(x.title||'Untitled')}</b><span class="text-xs text-gray-400 ml-2">${esc(pname(x.created_by))}</span></button>`).join('')}</div>`;r.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>openView(b.dataset.source));}

  function toast(msg){let t=document.getElementById('vaultToast');if(!t){t=document.createElement('div');t.id='vaultToast';t.className='fixed right-5 bottom-24 z-[500] px-4 py-3 bg-gray-950 text-white rounded-xl shadow-xl text-sm font-semibold transition';document.body.appendChild(t)}t.textContent=msg;t.style.opacity='1';clearTimeout(t._tm);t._tm=setTimeout(()=>t.style.opacity='0',1800)}

  function ensureQuickCapture(){
    if(!state.currentUser)return;let b=document.getElementById('vaultQuick');if(b)return;b=document.createElement('button');b.id='vaultQuick';b.title='Quick Save to Vault';b.className='fixed right-5 bottom-5 z-[180] w-12 h-12 rounded-2xl bg-gray-950 text-white shadow-xl hover:scale-105 transition flex items-center justify-center';b.innerHTML='<i class="fas fa-plus"></i>';b.onclick=()=>openEditor(null,true);document.body.appendChild(b);
  }
  setInterval(()=>{if(state.currentUser)ensureQuickCapture();else document.getElementById('vaultQuick')?.remove()},2500);

  return {open,ensureQuickCapture};
})();
