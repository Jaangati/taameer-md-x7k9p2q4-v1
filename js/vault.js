// TAAMEER Vault — visual department memory + smart search
const VaultApp = (() => {
  let items = [], profiles = [], filter = 'all', query = '';

  const TYPES = {
    note:['Note','fa-note-sticky'],
    reference:['Reference','fa-bookmark'],
    list:['List','fa-list-check'],
    contact:['Contact','fa-address-card'],
    link:['Link','fa-link'],
    numbers:['Numbers','fa-hashtag'],
    copy:['Copy','fa-quote-left'],
    other:['Other','fa-box']
  };

  const COLORS = {
    sand:{name:'Sand',bg:'#F6EDCF',ink:'#3F392B',soft:'#EBDDAD'},
    blue:{name:'Sky',bg:'#DDECF7',ink:'#24465F',soft:'#C8DFEF'},
    rose:{name:'Rose',bg:'#F4DEDF',ink:'#5B3537',soft:'#EBC9CB'},
    mint:{name:'Mint',bg:'#DDEFE5',ink:'#2E5340',soft:'#C8E3D4'},
    lavender:{name:'Lavender',bg:'#E8E1F4',ink:'#4C3E65',soft:'#D9CEE9'},
    slate:{name:'Slate',bg:'#E8EBEF',ink:'#303843',soft:'#D8DDE4'}
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
    profiles=pi.data||[];
    items=ii.data||[];
  }

  function shell(){
    const v=document.getElementById('view-vault');
    if(!v) return null;
    v.className='view-section fade-in h-full';
    v.innerHTML='<div id="vaultRoot" class="h-full"></div>';
    return document.getElementById('vaultRoot');
  }

  async function open(){
    const r=shell();
    if(!r) return;
    injectStyles();
    try{await load(); render(); ensureQuickCapture();}
    catch(e){console.error(e);r.innerHTML='<div class="h-full flex items-center justify-center text-red-500">Could not load Vault.</div>';}
  }

  function injectStyles(){
    if(document.getElementById('vaultStyles')) return;
    const s=document.createElement('style');
    s.id='vaultStyles';
    s.textContent=`
      .vault-shell{height:100%;display:grid;grid-template-columns:190px minmax(0,1fr);background:#f5f6f8;border:1px solid #e8e8eb;border-radius:24px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,.04)}
      .vault-rail{background:linear-gradient(180deg,#11151c 0%,#151a22 70%,#1b2028 100%);color:#fff;padding:18px 14px;display:flex;flex-direction:column;gap:18px}
      .vault-brand{padding:6px 8px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
      .vault-brand h2{font-size:22px;font-weight:800;line-height:1;margin:0}.vault-brand p{font-size:11px;color:rgba(255,255,255,.45);margin-top:6px}
      .vault-nav{display:flex;flex-direction:column;gap:6px}.vault-nav button{display:flex;align-items:center;gap:10px;width:100%;padding:10px 11px;border-radius:12px;color:rgba(255,255,255,.66);font-size:13px;font-weight:600;text-align:left}.vault-nav button:hover{background:rgba(255,255,255,.06);color:#fff}.vault-nav button.active{background:#fff;color:#111827}
      .vault-nav button i{width:17px;text-align:center}.vault-rail-foot{margin-top:auto;padding:10px 8px 2px;color:rgba(255,255,255,.38);font-size:10px;line-height:1.5}
      .vault-main{min-width:0;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#fbfbfc 0,#f5f6f8 100%)}
      .vault-top{padding:22px 24px 14px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.vault-top h2{font-size:30px;font-weight:800;letter-spacing:-.03em;color:#111827}.vault-top p{font-size:13px;color:#8b93a3;margin-top:4px}
      .vault-actions{display:flex;gap:8px}.vault-actions button{height:40px;padding:0 14px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid #e4e6eb;background:#fff;color:#222}.vault-actions button.primary{background:#111827;color:#fff;border-color:#111827}
      .vault-search-wrap{padding:0 24px 14px}.vault-search{height:52px;border-radius:16px;background:#fff;border:1px solid #e3e5ea;display:flex;align-items:center;gap:12px;padding:0 15px;box-shadow:0 5px 20px rgba(15,23,42,.035)}.vault-search input{flex:1;outline:none;border:none;background:transparent;font-size:14px;color:#111827}.vault-search .hint{font-size:10px;color:#a0a6b2;background:#f3f4f6;padding:5px 7px;border-radius:8px}
      .vault-subbar{padding:0 24px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.vault-subbar .summary{font-size:11px;color:#8d94a3}.vault-filter-btn{height:34px;padding:0 11px;border-radius:10px;border:1px solid #e3e5ea;background:#fff;font-size:11px;font-weight:700;color:#626b79}
      .vault-grid{padding:0 24px 24px;overflow:auto;columns:1;column-gap:14px}.vault-card{break-inside:avoid;margin:0 0 14px;border-radius:20px;padding:17px 17px 14px;position:relative;cursor:pointer;transition:.18s ease;border:1px solid rgba(17,24,39,.05);box-shadow:0 8px 22px rgba(15,23,42,.045)}.vault-card:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(15,23,42,.08)}
      .vault-card:after{content:'';position:absolute;right:0;bottom:0;width:28px;height:28px;background:linear-gradient(135deg,transparent 49%,rgba(255,255,255,.7) 50%);border-radius:0 0 20px 0;pointer-events:none}
      .vault-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.vault-type{display:inline-flex;align-items:center;gap:6px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;opacity:.58}.vault-card-actions{display:flex;gap:3px;opacity:0;transition:.15s}.vault-card:hover .vault-card-actions{opacity:1}.vault-card-actions button{width:28px;height:28px;border-radius:9px;background:rgba(255,255,255,.45)}
      .vault-card h3{font-size:17px;line-height:1.2;font-weight:800;margin-top:12px;letter-spacing:-.015em}.vault-card-body{font-size:12.5px;line-height:1.65;margin-top:8px;white-space:pre-wrap;max-height:190px;overflow:hidden}.vault-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:12px}.vault-tags span{font-size:9px;font-weight:700;background:rgba(255,255,255,.42);padding:4px 6px;border-radius:7px}.vault-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:11px;border-top:1px solid rgba(17,24,39,.08);font-size:9px;opacity:.58}.vault-avatar{width:23px;height:23px;border-radius:999px;object-fit:cover;display:inline-flex;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:8px;font-weight:800}
      .vault-empty{border:1px dashed #d7dae2;background:#fff;border-radius:22px;padding:60px 24px;text-align:center;color:#8f96a5}
      .vault-compose{width:min(720px,94vw);background:#f8f8f9;border-radius:26px;box-shadow:0 30px 100px rgba(0,0,0,.22);overflow:hidden}.vault-compose-top{padding:18px 20px;background:#161a21;color:#fff;display:flex;justify-content:space-between;align-items:center}.vault-compose-body{padding:18px}.vault-compose-title{width:100%;border:none;background:transparent;font-size:24px;font-weight:800;outline:none;color:#171b22;padding:2px 0 10px}.vault-compose textarea{width:100%;min-height:170px;border:none;background:#fff;border-radius:16px;padding:15px;outline:none;resize:vertical;font-size:13px;line-height:1.65;border:1px solid #e7e8ec}.vault-compose-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.vault-compose select,.vault-compose input.meta{height:42px;border-radius:12px;border:1px solid #e3e5ea;background:#fff;padding:0 12px;font-size:12px;outline:none}.vault-color-row{display:flex;align-items:center;gap:8px;margin-top:12px}.vault-color-row button{width:27px;height:27px;border-radius:9px;border:2px solid transparent}.vault-color-row button.active{border-color:#111827;box-shadow:0 0 0 2px #fff inset}.vault-smart-tags{margin-top:12px;padding:11px 12px;border-radius:14px;background:#fff;border:1px solid #e8e9ed}.vault-smart-tags .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.vault-smart-tags .chips span{font-size:10px;padding:5px 7px;border-radius:8px;background:#eef0f4;color:#596170}.vault-compose-foot{padding:13px 18px;border-top:1px solid #e6e7ea;display:flex;justify-content:space-between;gap:10px;background:#fff}.vault-compose-foot .left{font-size:10px;color:#969ca7;display:flex;align-items:center}.vault-compose-foot button{height:40px;padding:0 15px;border-radius:11px;font-size:12px;font-weight:800;border:1px solid #e1e4e8;background:#fff}.vault-compose-foot button.save{background:#111827;color:#fff;border-color:#111827}
      @media(min-width:900px){.vault-grid{columns:2}}@media(min-width:1280px){.vault-grid{columns:3}}@media(max-width:900px){.vault-shell{grid-template-columns:1fr}.vault-rail{display:none}.vault-top{padding:18px}.vault-search-wrap,.vault-subbar,.vault-grid{padding-left:18px;padding-right:18px}.vault-compose-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function scoreItem(item,q){
    if(!q.trim()) return 1;
    const words=q.toLowerCase().split(/\s+/).filter(Boolean);
    const title=(item.title||'').toLowerCase();
    const body=(item.body||'').toLowerCase();
    const tags=(item.tags||[]).join(' ').toLowerCase();
    const type=(item.item_type||'').toLowerCase();
    const synonym={dimensions:['size','sizes','measurement','measurements','width','height','cm','mm'],models:['model','scale','mockup','maquette'],scale:['model','models','dimensions','size'],contact:['phone','email','number'],copy:['text','content','caption','wording'],deadline:['due','date','timeline'],supplier:['vendor','company']};
    let score=0;
    words.forEach(w=>{
      const variants=[w,...(synonym[w]||[])];
      variants.forEach(v=>{if(title.includes(v))score+=9;if(tags.includes(v))score+=6;if(body.includes(v))score+=3;if(type.includes(v))score+=2;});
    });
    if(title.includes(q.toLowerCase()))score+=12;
    if(body.includes(q.toLowerCase()))score+=6;
    return score;
  }

  function visibleItems(){
    let list=items.slice();
    if(filter==='pinned') list=list.filter(x=>x.is_pinned);
    else if(filter==='mine') list=list.filter(x=>x.created_by===me());
    else if(filter==='shared') list=list.filter(x=>x.visibility==='department' && x.created_by!==me());
    if(query.trim()) list=list.map(x=>({x,s:scoreItem(x,query)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s||new Date(b.x.updated_at)-new Date(a.x.updated_at)).map(o=>o.x);
    return list;
  }

  function render(){
    const r=document.getElementById('vaultRoot');
    if(!r) return;
    const list=visibleItems();
    r.innerHTML=`<div class="vault-shell">
      <aside class="vault-rail">
        <div class="vault-brand"><div class="text-[9px] tracking-[.2em] text-white/35 font-bold">TAAMEER</div><h2>Vault</h2><p>Department memory, searchable.</p></div>
        <div class="vault-nav">
          ${navBtn('all','fa-layer-group','All Notes')}
          ${navBtn('pinned','fa-thumbtack','Pinned')}
          ${navBtn('mine','fa-user','My Notes')}
          ${navBtn('shared','fa-users','Shared')}
        </div>
        <button id="vaultAskRail" class="mt-1 w-full px-3 py-3 rounded-xl bg-white/8 border border-white/8 text-left text-xs font-bold"><i class="fas fa-sparkles mr-2"></i>Ask Vault</button>
        <div class="vault-rail-foot">Save useful information once.<br>Search it instead of asking again.</div>
      </aside>

      <main class="vault-main">
        <div class="vault-top">
          <div><div class="text-[9px] tracking-[.16em] font-bold text-gray-400">KNOWLEDGE WALL</div><h2>${filter==='all'?'All Notes':filter==='pinned'?'Pinned Notes':filter==='mine'?'My Notes':'Shared Notes'}</h2><p>${filter==='all'?'Everything useful the team has saved.':'A focused view of your Vault.'}</p></div>
          <div class="vault-actions"><button id="vaultAsk"><i class="fas fa-sparkles mr-2"></i>Ask Vault</button><button id="vaultNew" class="primary"><i class="fas fa-plus mr-2"></i>New Note</button></div>
        </div>

        <div class="vault-search-wrap"><div class="vault-search"><i class="fas fa-magnifying-glass text-gray-400"></i><input id="vaultSearch" value="${esc(query)}" placeholder="Search models, dimensions, copy, contacts, suppliers, anything..."><span class="hint">Ctrl K</span>${query?'<button id="vaultClear" class="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400"><i class="fas fa-xmark"></i></button>':''}</div></div>

        <div class="vault-subbar"><div class="summary">${list.length} note${list.length===1?'':'s'}${query?` matching “${esc(query)}”`:''}</div><button id="vaultFilter" class="vault-filter-btn"><i class="fas fa-sliders mr-2"></i>Smart view</button></div>

        <div class="vault-grid">${list.map(card).join('')||emptyState()}</div>
      </main>
    </div>`;

    document.getElementById('vaultNew').onclick=()=>openEditor();
    document.getElementById('vaultAsk').onclick=openAsk;
    document.getElementById('vaultAskRail').onclick=openAsk;
    document.getElementById('vaultClear')?.addEventListener('click',()=>{query='';render();});
    document.getElementById('vaultFilter').onclick=()=>toast('Search and the four views are enough for now');
    r.querySelectorAll('[data-vf]').forEach(b=>b.onclick=()=>{filter=b.dataset.vf;render();});
    const s=document.getElementById('vaultSearch');
    s.oninput=e=>{query=e.target.value;render();};
    bindCards(r);
  }

  function navBtn(key,icon,label){return `<button data-vf="${key}" class="${filter===key?'active':''}"><i class="fas ${icon}"></i><span>${label}</span></button>`}
  function emptyState(){return `<div class="vault-empty"><div class="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center"><i class="fas fa-note-sticky"></i></div><div class="font-bold text-gray-800 mt-4">Nothing here yet</div><div class="text-xs mt-1">Save something useful or try another search.</div></div>`}
  function iconFor(t){return TYPES[t]?.[1]||'fa-note-sticky'}
  function labelFor(t){return TYPES[t]?.[0]||'Note'}
  function colorFor(x){return COLORS[x.card_color]||COLORS.sand}
  function avatarHtml(id){const p=profile(id);if(p.avatar)return `<img src="${esc(p.avatar)}" class="vault-avatar">`;return `<span class="vault-avatar">${esc(initials(id))}</span>`}

  function card(x){
    const can=x.created_by===me()||admin();
    const c=colorFor(x);
    return `<article class="vaultCard vault-card" data-id="${x.id}" style="background:${c.bg};color:${c.ink}">
      <div class="vault-card-top"><div class="vault-type"><i class="fas ${iconFor(x.item_type)}"></i>${labelFor(x.item_type)}${x.is_pinned?'<span>· Pinned</span>':''}</div><div class="vault-card-actions"><button data-copy="${x.id}" title="Copy"><i class="fas fa-copy"></i></button>${can?`<button data-more="${x.id}" title="More"><i class="fas fa-ellipsis"></i></button>`:''}</div></div>
      ${x.title?`<h3>${esc(x.title)}</h3>`:''}
      <div class="vault-card-body">${esc(x.body)}</div>
      ${(x.tags||[]).length?`<div class="vault-tags">${x.tags.slice(0,5).map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}
      <div class="vault-meta"><div class="flex items-center gap-2">${avatarHtml(x.created_by)}<span>${esc(pname(x.created_by))}</span></div><span>${new Date(x.updated_at).toLocaleDateString()}</span></div>
    </article>`;
  }

  function bindCards(r){
    r.querySelectorAll('[data-copy]').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=items.find(i=>i.id===b.dataset.copy);navigator.clipboard?.writeText([x.title,x.body,x.source_url].filter(Boolean).join('\n'));toast('Copied to clipboard');});
    r.querySelectorAll('[data-more]').forEach(b=>b.onclick=e=>{e.stopPropagation();openActions(b.dataset.more);});
    r.querySelectorAll('.vaultCard').forEach(c=>c.onclick=e=>{if(e.target.closest('button,a'))return;openView(c.dataset.id);});
  }

  function modal(html){
    document.getElementById('vaultModal')?.remove();
    const d=document.createElement('div');
    d.id='vaultModal';
    d.className='fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center p-5';
    d.innerHTML=html;
    document.body.appendChild(d);
    d.addEventListener('click',e=>{if(e.target===d)d.remove()});
    return d;
  }

  function autoTags(title,body,type){
    const text=`${title||''} ${body||''}`.toLowerCase();
    const rules={
      models:['model','scale model','maquette','mockup'], dimensions:['dimension','dimensions','size','width','height','cm','mm','meter'], cityscape:['cityscape'], project:['project','residence','tower','villa'], contact:['phone','email','contact','whatsapp'], supplier:['supplier','vendor','factory'], copy:['caption','copy','wording','text','headline'], event:['event','launch','open house','exhibition'], deadline:['deadline','due','submit'], social:['instagram','linkedin','facebook','social'], video:['video','reel','shoot','camera'], brochure:['brochure','presentation','pdf'], pricing:['price','qar','usd','cost','budget'], link:['http','www.']
    };
    const tags=[];
    Object.entries(rules).forEach(([tag,terms])=>{if(terms.some(t=>text.includes(t)))tags.push(tag)});
    if(type && type!=='note' && type!=='other') tags.push(type);
    const capital=(title||'').match(/\b[A-Z][A-Za-z0-9-]{3,}\b/g)||[];
    capital.slice(0,2).forEach(v=>tags.push(v.toLowerCase()));
    return [...new Set(tags)].slice(0,6);
  }

  function openEditor(id=null,quick=false){
    const x=id?items.find(i=>i.id===id):null;
    const startColor=x?.card_color||'sand';
    const d=modal(`<div class="vault-compose">
      <div class="vault-compose-top"><div><div class="text-[9px] tracking-[.16em] text-white/40 font-bold">${id?'EDIT NOTE':'QUICK CAPTURE'}</div><div class="text-lg font-bold mt-1">${id?'Update this memory':'Drop it here. Find it later.'}</div></div><button data-close class="w-9 h-9 rounded-xl hover:bg-white/10"><i class="fas fa-xmark"></i></button></div>
      <div class="vault-compose-body">
        <input id="veTitle" class="vault-compose-title" value="${esc(x?.title||'')}" placeholder="Give it a title...">
        <textarea id="veBody" placeholder="Paste a message, dimensions, content list, contact, link, reference...">${esc(x?.body||'')}</textarea>
        <div class="vault-compose-row"><select id="veType">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${x?.item_type===k?'selected':''}>${v[0]}</option>`).join('')}</select><select id="veVisibility"><option value="department" ${x?.visibility!=='private'?'selected':''}>Department</option><option value="private" ${x?.visibility==='private'?'selected':''}>Private</option></select></div>
        <div class="vault-color-row"><span class="text-[10px] text-gray-500 font-bold mr-2">CARD</span>${Object.entries(COLORS).map(([k,c])=>`<button data-vcolor="${k}" class="${startColor===k?'active':''}" style="background:${c.bg}" title="${c.name}"></button>`).join('')}</div>
        <div class="vault-smart-tags"><div class="flex items-center justify-between"><span class="text-[10px] font-bold text-gray-500">SMART TAGS</span><span class="text-[9px] text-gray-400">generated automatically</span></div><div id="veSuggested" class="chips"></div></div>
        <div class="vault-compose-row"><input id="veTags" class="meta" value="${esc((x?.tags||[]).join(', '))}" placeholder="Add custom tags, separated by commas"><input id="veUrl" class="meta" value="${esc(x?.source_url||'')}" placeholder="Optional source link"></div>
      </div>
      <div class="vault-compose-foot"><div class="left"><i class="fas fa-wand-magic-sparkles mr-2"></i>Tags help search, but you don't need to manage them.</div><div class="flex gap-2"><button data-close>Cancel</button><button id="veSave" class="save">Save to Vault</button></div></div>
    </div>`);
    let selectedColor=startColor;
    const title=document.getElementById('veTitle'),body=document.getElementById('veBody'),type=document.getElementById('veType'),suggest=document.getElementById('veSuggested');
    const refreshTags=()=>{const arr=autoTags(title.value,body.value,type.value);suggest.innerHTML=arr.length?arr.map(t=>`<span>#${esc(t)}</span>`).join(''):'<span>Start typing and I’ll suggest tags</span>';suggest.dataset.tags=arr.join(',')};
    [title,body,type].forEach(el=>el.addEventListener('input',refreshTags)); refreshTags();
    d.querySelectorAll('[data-vcolor]').forEach(b=>b.onclick=()=>{selectedColor=b.dataset.vcolor;d.querySelectorAll('[data-vcolor]').forEach(x=>x.classList.toggle('active',x===b))});
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.remove());
    document.getElementById('veSave').onclick=()=>saveEditor(id,d,selectedColor);
    setTimeout(()=>document.getElementById(quick?'veBody':'veTitle')?.focus(),40);
  }

  async function saveEditor(id,d,selectedColor){
    const title=document.getElementById('veTitle').value.trim();
    const body=document.getElementById('veBody').value.trim();
    if(!body && !title) return toast('Add something first');
    const type=document.getElementById('veType').value;
    const manual=document.getElementById('veTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean);
    const smart=(document.getElementById('veSuggested').dataset.tags||'').split(',').filter(Boolean);
    const tags=[...new Set([...smart,...manual])].slice(0,10);
    const payload={title:title||null,body:body||'',item_type:type,visibility:document.getElementById('veVisibility').value,tags,source_url:document.getElementById('veUrl').value.trim()||null,card_color:selectedColor,updated_by:me()};
    let res;
    if(id) res=await supabaseClient.from('vault_items').update(payload).eq('id',id).select('*').single();
    else res=await supabaseClient.from('vault_items').insert({...payload,created_by:me()}).select('*').single();
    if(res.error) return alert(res.error.message);
    if(id) items=items.map(i=>i.id===id?res.data:i); else items.unshift(res.data);
    d.remove();render();toast('Saved to Vault');
  }

  function openView(id){
    const x=items.find(i=>i.id===id);if(!x)return;
    const can=x.created_by===me()||admin();const c=colorFor(x);
    const d=modal(`<div class="w-full max-w-2xl rounded-[28px] shadow-2xl overflow-hidden" style="background:${c.bg};color:${c.ink}"><div class="p-6 flex items-start justify-between"><div><div class="text-[9px] uppercase tracking-[.14em] font-bold opacity-50"><i class="fas ${iconFor(x.item_type)} mr-2"></i>${labelFor(x.item_type)}</div><h3 class="text-2xl font-extrabold mt-2">${esc(x.title||'Untitled')}</h3></div><button data-close class="w-9 h-9 rounded-xl bg-white/40"><i class="fas fa-xmark"></i></button></div><div class="px-6 pb-6"><div class="text-[14px] leading-7 whitespace-pre-wrap">${esc(x.body)}</div>${(x.tags||[]).length?`<div class="vault-tags mt-5">${x.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener" class="inline-flex mt-4 text-xs font-bold"><i class="fas fa-arrow-up-right-from-square mr-2"></i>Open source</a>`:''}<div class="mt-6 pt-5 border-t border-black/10 flex items-center justify-between"><div class="flex items-center gap-2">${avatarHtml(x.created_by)}<span class="text-xs opacity-65">Added by <b>${esc(pname(x.created_by))}</b></span></div><div class="flex gap-2"><button id="vvCopy" class="px-3 py-2 rounded-xl bg-white/45 text-xs font-bold"><i class="fas fa-copy mr-2"></i>Copy</button>${can?'<button id="vvEdit" class="px-3 py-2 rounded-xl bg-gray-950 text-white text-xs font-bold"><i class="fas fa-pen mr-2"></i>Edit</button>':''}</div></div></div></div>`);
    d.querySelector('[data-close]').onclick=()=>d.remove();
    document.getElementById('vvCopy').onclick=()=>{navigator.clipboard?.writeText([x.title,x.body,x.source_url].filter(Boolean).join('\n'));toast('Copied to clipboard')};
    document.getElementById('vvEdit')?.addEventListener('click',()=>{d.remove();openEditor(id)});
  }

  function openActions(id){
    const x=items.find(i=>i.id===id);if(!x)return;
    const d=modal(`<div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-3"><button id="vaPin" class="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold"><i class="fas fa-thumbtack w-6"></i>${x.is_pinned?'Unpin':'Pin'}</button><button id="vaEdit" class="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold"><i class="fas fa-pen w-6"></i>Edit</button><button id="vaDelete" class="w-full text-left px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 font-semibold"><i class="fas fa-trash w-6"></i>Delete</button></div>`);
    document.getElementById('vaPin').onclick=async()=>{const {data,error}=await supabaseClient.from('vault_items').update({is_pinned:!x.is_pinned,updated_by:me()}).eq('id',id).select('*').single();if(error)return alert(error.message);items=items.map(i=>i.id===id?data:i);d.remove();render()};
    document.getElementById('vaEdit').onclick=()=>{d.remove();openEditor(id)};
    document.getElementById('vaDelete').onclick=async()=>{if(!confirm('Delete this Vault note?'))return;const {error}=await supabaseClient.from('vault_items').delete().eq('id',id);if(error)return alert(error.message);items=items.filter(i=>i.id!==id);d.remove();render();toast('Deleted')};
  }

  function openAsk(){
    const d=modal(`<div class="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden"><div class="p-6 bg-[#161a21] text-white flex justify-between"><div><div class="text-[9px] tracking-[.18em] text-white/35">ASK VAULT</div><h3 class="text-2xl font-extrabold mt-1">Ask your department memory.</h3><p class="text-sm text-white/45 mt-1">Answers are grounded only in saved Vault notes.</p></div><button data-close class="w-10 h-10 rounded-xl hover:bg-white/10"><i class="fas fa-xmark"></i></button></div><div class="p-6"><div class="flex gap-2"><input id="askInput" class="flex-1 px-4 py-3 rounded-xl border outline-none" placeholder="e.g. What are the scale model dimensions?"><button id="askGo" class="px-5 py-3 rounded-xl bg-gray-950 text-white font-bold">Ask</button></div><div id="askResult" class="mt-5"></div></div></div>`);
    d.querySelector('[data-close]').onclick=()=>d.remove();
    const run=answerAsk;document.getElementById('askGo').onclick=run;document.getElementById('askInput').onkeydown=e=>{if(e.key==='Enter')run()};setTimeout(()=>document.getElementById('askInput').focus(),40);
  }

  function answerAsk(){
    const q=document.getElementById('askInput').value.trim();if(!q)return;
    const ranked=items.map(x=>({x,s:scoreItem(x,q)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).slice(0,5);
    const r=document.getElementById('askResult');
    if(!ranked.length){r.innerHTML='<div class="p-5 rounded-2xl bg-gray-50 text-gray-500">I couldn’t find this in Vault.</div>';return;}
    const top=ranked.slice(0,3).map(o=>o.x);
    r.innerHTML=`<div class="p-5 rounded-2xl bg-gray-50"><div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Vault answer</div><div class="mt-3 space-y-4">${top.map(x=>`<div><div class="font-bold text-gray-900">${esc(x.title||labelFor(x.item_type))}</div><div class="text-sm text-gray-600 whitespace-pre-wrap mt-1">${esc(x.body.length>420?x.body.slice(0,420)+'…':x.body)}</div></div>`).join('')}</div></div><div class="mt-4"><div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Sources</div>${top.map(x=>`<button data-source="${x.id}" class="w-full text-left px-4 py-3 rounded-xl border mb-2 hover:bg-gray-50"><b>${esc(x.title||'Untitled')}</b><span class="text-xs text-gray-400 ml-2">${esc(pname(x.created_by))}</span></button>`).join('')}</div>`;
    r.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>openView(b.dataset.source));
  }

  function toast(msg){
    let t=document.getElementById('vaultToast');
    if(!t){t=document.createElement('div');t.id='vaultToast';t.className='fixed right-5 bottom-24 z-[500] px-4 py-3 bg-gray-950 text-white rounded-xl shadow-xl text-sm font-semibold transition';document.body.appendChild(t)}
    t.textContent=msg;t.style.opacity='1';clearTimeout(t._tm);t._tm=setTimeout(()=>t.style.opacity='0',1800);
  }

  function ensureQuickCapture(){
    if(!state.currentUser)return;
    let b=document.getElementById('vaultQuick');if(b)return;
    b=document.createElement('button');b.id='vaultQuick';b.title='Quick Save to Vault';b.className='fixed right-5 bottom-5 z-[180] h-12 px-4 rounded-2xl bg-gray-950 text-white shadow-xl hover:scale-[1.02] transition flex items-center gap-2 text-xs font-bold';b.innerHTML='<i class="fas fa-plus"></i><span>Quick Save</span>';b.onclick=()=>openEditor(null,true);document.body.appendChild(b);
  }

  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k' && document.getElementById('vaultRoot')){e.preventDefault();document.getElementById('vaultSearch')?.focus();}});
  setInterval(()=>{if(state.currentUser)ensureQuickCapture();else document.getElementById('vaultQuick')?.remove()},2500);

  return {open,ensureQuickCapture};
})();
