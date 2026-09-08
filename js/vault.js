// TAAMEER Vault — visual department memory + live grounded search
const VaultApp = (() => {
  let items = [], profiles = [], filter = 'all', query = '', searchTimer = null;

  const TYPES = {
    note:['Note','fa-note-sticky'], reference:['Reference','fa-bookmark'], list:['List','fa-list-check'],
    contact:['Contact','fa-address-card'], link:['Link','fa-link'], numbers:['Numbers','fa-hashtag'],
    copy:['Copy','fa-quote-left'], other:['Other','fa-box']
  };

  const COLORS = {
    sunrise:{name:'Sunrise',bg:'linear-gradient(145deg,#FFF2B8 0%,#FFD66B 100%)',ink:'#3B2B08',swatch:'#FFD66B'},
    coral:{name:'Coral',bg:'linear-gradient(145deg,#FFD6CF 0%,#FF8F7C 100%)',ink:'#4A201A',swatch:'#FF8F7C'},
    ocean:{name:'Ocean',bg:'linear-gradient(145deg,#D8F1FF 0%,#79C7FF 100%)',ink:'#173B57',swatch:'#79C7FF'},
    mint:{name:'Mint',bg:'linear-gradient(145deg,#DDF8E8 0%,#8BE0B3 100%)',ink:'#17442E',swatch:'#8BE0B3'},
    lilac:{name:'Lilac',bg:'linear-gradient(145deg,#EFE3FF 0%,#B99BFF 100%)',ink:'#352457',swatch:'#B99BFF'},
    dusk:{name:'Dusk',bg:'linear-gradient(145deg,#E4E8EF 0%,#A8B3C7 100%)',ink:'#202A3A',swatch:'#A8B3C7'}
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
    const v=document.getElementById('view-vault'); if(!v) return null;
    v.className='view-section fade-in h-full';
    v.innerHTML='<div id="vaultRoot" class="h-full"></div>';
    return document.getElementById('vaultRoot');
  }

  async function open(){
    const r=shell(); if(!r) return;
    injectStyles();
    try{await load();render();ensureQuickCapture();bindGlobalKeys();}
    catch(e){console.error(e);r.innerHTML='<div class="h-full flex items-center justify-center text-red-500">Could not load Vault.</div>';}
  }

  function injectStyles(){
    if(document.getElementById('vaultStylesV3')) return;
    const s=document.createElement('style'); s.id='vaultStylesV3';
    s.textContent=`
      .vault-page{height:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:linear-gradient(180deg,#f7f8fb 0%,#f3f4f7 100%)}
      .vault-head{padding:4px 2px 12px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px}.vault-head h2{font-size:28px;line-height:1;font-weight:850;letter-spacing:-.035em;color:#101522}.vault-head p{font-size:12px;color:#8c94a3;margin-top:7px}.vault-head-actions{display:flex;gap:8px}.vault-head-actions button{height:40px;padding:0 14px;border-radius:12px;border:1px solid #e0e4eb;background:#fff;font-size:12px;font-weight:750;color:#202737}.vault-head-actions button.primary{background:#111827;color:#fff;border-color:#111827;box-shadow:0 8px 18px rgba(17,24,39,.12)}
      .vault-askbox{position:relative;border-radius:24px;padding:18px;background:linear-gradient(90deg,var(--system-dark) 0%,var(--system-dark-2) 58%,var(--accent) 145%);color:#fff;box-shadow:0 16px 34px rgba(3,7,18,.18);overflow:hidden;z-index:3}.vault-askbox:before{content:'';position:absolute;inset:0;border-radius:24px;border:1px solid rgba(255,255,255,.09);pointer-events:none}.vault-ask-row{display:flex;align-items:center;gap:14px}.vault-ask-icon{width:46px;height:46px;border-radius:15px;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:17px;flex:none}.vault-ask-copy{min-width:155px}.vault-ask-copy strong{display:block;font-size:14px}.vault-ask-copy span{display:block;font-size:10px;color:rgba(255,255,255,.5);margin-top:3px}.vault-ask-input{height:50px;flex:1;min-width:0;border-radius:15px;background:#fff;color:#101522;display:flex;align-items:center;gap:10px;padding:0 13px;box-shadow:0 10px 26px rgba(0,0,0,.1)}.vault-ask-input input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13px}.vault-ask-input button{height:34px;padding:0 13px;border:0;border-radius:10px;background:var(--accent);color:white;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 6px 14px rgba(15,23,42,.12)}.vault-kbd{font-size:9px;color:#9aa1ad;background:#f1f3f6;padding:4px 6px;border-radius:7px;white-space:nowrap}
      .vault-live{position:absolute;left:18px;right:18px;top:82px;background:rgba(255,255,255,.98);color:#111827;border:1px solid #e6e8ed;border-radius:18px;box-shadow:0 22px 55px rgba(15,23,42,.18);padding:9px;display:none;max-height:330px;overflow:auto}.vault-live.show{display:block}.vault-live-title{padding:6px 8px 8px;font-size:9px;font-weight:800;letter-spacing:.12em;color:#9aa1ad}.vault-live-item{width:100%;text-align:left;border:0;background:transparent;border-radius:12px;padding:10px;display:flex;gap:10px;align-items:flex-start}.vault-live-item:hover{background:#f5f6f8}.vault-live-dot{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:#eef0f4;color:#626b79;flex:none}.vault-live-item b{font-size:12px;display:block}.vault-live-item p{font-size:10px;color:#7b8492;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vault-live-empty{padding:20px;text-align:center;font-size:11px;color:#9299a5}
      .vault-tabs{padding:12px 0 10px;display:flex;align-items:center;justify-content:space-between;gap:12px}.vault-tabset{display:flex;gap:6px;flex-wrap:wrap}.vault-tabset button{height:34px;padding:0 11px;border-radius:10px;border:1px solid transparent;color:#6e7684;font-size:11px;font-weight:750}.vault-tabset button:hover{background:#fff}.vault-tabset button.active{background:#fff;border-color:#dfe3e9;color:#111827;box-shadow:0 4px 12px rgba(15,23,42,.05)}.vault-count{height:32px;padding:0 11px;border-radius:10px;background:#fff;border:1px solid #e2e6ec;box-shadow:0 7px 20px rgba(15,23,42,.08);font-size:10px;font-weight:800;color:#596273;display:flex;align-items:center;white-space:nowrap}
      .vault-grid-wrap{flex:1;min-height:0;overflow:auto;padding:0 2px 18px}.vault-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:14px;align-items:start}.vault-card{min-width:0;border-radius:22px;padding:16px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.55);box-shadow:0 10px 25px rgba(15,23,42,.07);cursor:pointer;transition:.18s ease}.vault-card:hover{transform:translateY(-2px);box-shadow:0 15px 34px rgba(15,23,42,.1)}.vault-card:before{content:'';position:absolute;inset:0;background:linear-gradient(140deg,rgba(255,255,255,.48),transparent 42%);pointer-events:none}.vault-card>*{position:relative}.vault-card-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.vault-type{font-size:8px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;opacity:.62}.vault-card-actions{display:flex;gap:3px;opacity:.72}.vault-card-actions button{width:27px;height:27px;border:0;border-radius:9px;background:rgba(255,255,255,.38)}.vault-card h3{font-size:16px;line-height:1.2;font-weight:850;letter-spacing:-.02em;margin-top:11px}.vault-card-body{font-size:11.5px;line-height:1.62;margin-top:7px;white-space:pre-wrap;max-height:150px;overflow:hidden}.vault-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.vault-tags span{font-size:8px;font-weight:800;padding:4px 6px;border-radius:7px;background:rgba(255,255,255,.38)}.vault-meta{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(17,24,39,.08);font-size:8px;opacity:.68}.vault-avatar{width:22px;height:22px;border-radius:999px;object-fit:cover;display:inline-flex;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:7px;font-weight:900}
      .vault-empty{grid-column:1/-1;min-height:300px;border:1px dashed #d7dce4;border-radius:22px;background:rgba(255,255,255,.65);display:flex;align-items:center;justify-content:center;text-align:center;padding:40px}.vault-empty .icon{width:52px;height:52px;border-radius:16px;background:#eef1f5;display:flex;align-items:center;justify-content:center;margin:0 auto 13px;color:#7f8794}.vault-empty h3{font-size:15px;font-weight:800;color:#202737}.vault-empty p{font-size:11px;color:#969daa;margin-top:4px}.vault-empty button{margin-top:14px;height:36px;padding:0 12px;border-radius:10px;border:0;background:#111827;color:#fff;font-size:11px;font-weight:800}
      .vault-compose{width:min(1180px,96vw);max-height:88vh;background:#f7f8fa;border-radius:26px;box-shadow:0 36px 120px rgba(3,7,18,.28);overflow:hidden;display:flex;flex-direction:column}.vault-compose-top{padding:17px 20px;background:linear-gradient(90deg,var(--system-dark) 0%,var(--system-dark-2) 70%,var(--accent) 155%);color:#fff;display:flex;justify-content:space-between;align-items:center;flex:none}.vault-compose-body{padding:0;display:grid;grid-template-columns:310px minmax(0,1fr);min-height:0;overflow:auto}.vault-compose-settings{padding:18px;background:#f1f3f6;border-right:1px solid #e2e6ec;display:flex;flex-direction:column;gap:14px}.vault-compose-main{padding:22px;background:#fff;display:flex;flex-direction:column;min-width:0}.vault-field-label{font-size:9px;font-weight:850;letter-spacing:.08em;color:#77808f;margin-bottom:6px;text-transform:uppercase}.vault-compose-title{width:100%;border:1px solid #e3e6eb;background:#f9fafb;border-radius:14px;font-size:22px;font-weight:850;outline:0;color:#171b22;padding:13px 14px;margin-bottom:12px}.vault-compose-title:focus,.vault-compose textarea:focus,.vault-compose select:focus,.vault-compose input.meta:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);background:#fff}.vault-compose textarea{width:100%;min-height:360px;flex:1;border:1px solid #e3e6eb;background:#f9fafb;border-radius:16px;padding:15px;outline:0;resize:vertical;font-size:13px;line-height:1.7}.vault-compose-row{display:grid;grid-template-columns:1fr;gap:9px;margin-top:0}.vault-compose select,.vault-compose input.meta{width:100%;height:42px;border-radius:11px;border:1px solid #dfe3e9;background:#fff;padding:0 11px;font-size:11px;outline:0}.vault-color-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.vault-color-row button{width:31px;height:31px;border-radius:10px;border:2px solid transparent;box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}.vault-color-row button.active{border-color:var(--system-dark);box-shadow:0 0 0 2px #fff,0 0 0 4px var(--system-dark)}.vault-smart-tags{padding:11px 12px;border-radius:13px;background:#fff;border:1px solid #dfe3e9}.vault-smart-tags .chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.vault-smart-tags .chips span{font-size:9px;padding:4px 6px;border-radius:7px;background:#eef1f5;color:#5f6876}.vault-compose-foot{padding:12px 16px;border-top:1px solid #e4e7eb;display:flex;justify-content:space-between;gap:10px;background:#fff;flex:none}.vault-compose-foot button{height:38px;padding:0 14px;border-radius:10px;border:1px solid #e0e4e8;background:#fff;font-size:11px;font-weight:800}.vault-compose-foot button.save{background:var(--system-dark);color:#fff;border-color:var(--system-dark)}
      
      .vault-modal-shell{max-height:calc(100vh - 48px);overflow:hidden;display:flex;flex-direction:column}.vault-modal-scroll{min-height:0;overflow:auto;overscroll-behavior:contain}.vault-note-reader{width:min(900px,94vw);max-height:calc(100vh - 48px);background:#fff;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 36px 120px rgba(3,7,18,.30)}.vault-note-reader-body{padding:24px;overflow:auto;min-height:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.72;font-size:13px;color:#303846;background:#fff}.vault-note-reader-head{flex:none;padding:18px 20px;background:linear-gradient(90deg,var(--system-dark) 0%,var(--system-dark-2) 68%,var(--accent) 155%);color:#fff;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.vault-note-reader-foot{flex:none;padding:12px 16px;border-top:1px solid #e6e9ee;background:#fff;display:flex;justify-content:flex-end;gap:8px}@media(max-width:760px){.vault-note-reader{width:96vw;max-height:92vh}.vault-note-reader-body{padding:18px}}
.vault-ask-modal{width:min(820px,94vw);background:#fff;border-radius:26px;overflow:hidden;box-shadow:0 36px 120px rgba(3,7,18,.30)}.vault-ask-modal-head{padding:22px;background:linear-gradient(90deg,var(--system-dark) 0%,var(--system-dark-2) 62%,var(--accent) 150%);color:white}.vault-ask-modal-input{display:flex;gap:8px;margin-top:16px;background:#fff;border-radius:15px;padding:6px;box-shadow:0 10px 30px rgba(3,7,18,.16)}.vault-ask-modal-input input{flex:1;border:0;outline:0;padding:0 8px;color:#111827;font-size:13px}.vault-ask-modal-input button{height:38px;border:0;border-radius:10px;background:var(--accent);color:#fff;padding:0 15px;font-size:11px;font-weight:800}.vault-ask-results{padding:18px;max-height:60vh;overflow:auto;background:#fff}.vault-answer-card{padding:15px;border-radius:16px;background:#f6f7f9;border:1px solid #eceff3;margin-bottom:10px;transition:.16s}.vault-answer-card:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(3,7,18,.07)}.vault-answer-card b{font-size:12px;color:#111827}.vault-answer-card p{font-size:11px;color:#687180;white-space:pre-wrap;margin-top:5px;line-height:1.55}
      .vault-overlay>div{max-height:calc(100vh - 48px);overflow:auto} @media(max-width:900px){.vault-compose{width:min(720px,96vw);max-height:92vh}.vault-compose-body{grid-template-columns:1fr}.vault-compose-settings{border-right:0;border-bottom:1px solid #e2e6ec;display:grid;grid-template-columns:1fr 1fr}.vault-compose-main{padding:18px}.vault-compose textarea{min-height:260px}}@media(max-width:760px){.vault-ask-row{flex-wrap:wrap}.vault-ask-copy{min-width:0;width:100%}.vault-ask-input{width:100%}.vault-head{align-items:flex-start}.vault-head-actions{flex-wrap:wrap;justify-content:flex-end}.vault-compose-settings{grid-template-columns:1fr}.vault-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function scoreItem(item,q){
    if(!q.trim()) return 1;
    const words=q.toLowerCase().split(/\s+/).filter(Boolean);
    const title=(item.title||'').toLowerCase(), body=(item.body||'').toLowerCase(), tags=(item.tags||[]).join(' ').toLowerCase(), type=(item.item_type||'').toLowerCase();
    const synonym={dimensions:['size','sizes','measurement','measurements','width','height','cm','mm'],models:['model','scale','mockup','maquette'],scale:['model','models','dimensions','size'],contact:['phone','email','number'],copy:['text','content','caption','wording'],deadline:['due','date','timeline'],supplier:['vendor','company'],showroom:['office','location'],team:['staff','members','roles']};
    let score=0;
    words.forEach(w=>{const variants=[w,...(synonym[w]||[])];variants.forEach(v=>{if(title.includes(v))score+=10;if(tags.includes(v))score+=6;if(body.includes(v))score+=3;if(type.includes(v))score+=2;});});
    const full=q.toLowerCase(); if(title.includes(full))score+=14;if(body.includes(full))score+=7;
    return score;
  }

  function baseVisible(){
    let list=items.slice();
    if(filter==='pinned') list=list.filter(x=>x.is_pinned);
    else if(filter==='mine') list=list.filter(x=>x.created_by===me());
    else if(filter==='shared') list=list.filter(x=>x.visibility==='department' && x.created_by!==me());
    return list;
  }
  function visibleItems(){
    let list=baseVisible();
    if(query.trim()) list=list.map(x=>({x,s:scoreItem(x,query)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s||new Date(b.x.updated_at)-new Date(a.x.updated_at)).map(o=>o.x);
    return list;
  }
  function ranked(q,limit=6){return items.map(x=>({x,s:scoreItem(x,q)})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).slice(0,limit).map(o=>o.x)}

  function render(){
    const r=document.getElementById('vaultRoot'); if(!r)return;
    r.innerHTML=`<div class="vault-page">
      <div class="vault-head">
        <div><h2>Department Memory</h2><p>Save useful things once. Find them the moment you need them.</p></div>
        <div class="vault-head-actions"><button id="vaultAskTop"><i class="fas fa-sparkles mr-2"></i>Ask Vault</button><button id="vaultNew" class="primary"><i class="fas fa-plus mr-2"></i>New Note</button></div>
      </div>
      <section class="vault-askbox">
        <div class="vault-ask-row"><div class="vault-ask-icon"><i class="fas fa-magnifying-glass"></i></div><div class="vault-ask-copy"><strong>Search Vault</strong><span>Shortlist the actual notes instantly as you type.</span></div><div class="vault-ask-input"><i class="fas fa-magnifying-glass text-gray-400"></i><input id="vaultSearch" value="${esc(query)}" placeholder="Try “scale model dimensions”, “showrooms”, “team roles”..."><span class="vault-kbd">Ctrl K</span><button id="vaultAskGo">Search</button></div></div>
      </section>
      <div class="vault-tabs"><div class="vault-tabset">${tab('all','All Notes','fa-layer-group')}${tab('pinned','Pinned','fa-thumbtack')}${tab('mine','My Notes','fa-user')}${tab('shared','Shared','fa-users')}</div><div id="vaultCount" class="vault-count"></div></div>
      <div class="vault-grid-wrap"><div id="vaultGrid" class="vault-grid"></div></div>
    </div>`;
    document.getElementById('vaultNew').onclick=()=>openEditor();
    document.getElementById('vaultAskTop').onclick=()=>openAsk(query);
    document.getElementById('vaultAskGo').onclick=()=>document.getElementById('vaultSearch').focus();
    r.querySelectorAll('[data-vf]').forEach(b=>b.onclick=()=>{filter=b.dataset.vf;query='';render();});
    const s=document.getElementById('vaultSearch');
    s.oninput=e=>{query=e.target.value;updateResults();};
    s.onkeydown=e=>{if(e.key==='Escape'){query='';s.value='';updateResults();}};
    updateResults();
  }

  function tab(key,label,icon){return `<button data-vf="${key}" class="${filter===key?'active':''}"><i class="fas ${icon} mr-2"></i>${label}</button>`}
  function updateResults(){
    const grid=document.getElementById('vaultGrid'),count=document.getElementById('vaultCount'); if(!grid)return;
    const list=visibleItems(); count.textContent=query?`${list.length} MATCHING NOTE${list.length===1?'':'S'}`:`${list.length} TOTAL NOTE${list.length===1?'':'S'}`;
    grid.innerHTML=list.length?list.map(card).join(''):emptyState(); bindCards(document.getElementById('vaultRoot'));
    document.getElementById('vaultEmptyAdd')?.addEventListener('click',()=>openEditor());
  }
  function updateLive(){
    const box=document.getElementById('vaultLive'); if(!box)return;
    const q=query.trim(); if(!q){box.classList.remove('show');box.innerHTML='';return;}
    const list=ranked(q,5); box.classList.add('show');
    box.innerHTML=list.length?`<div class="vault-live-title">MATCHES AS YOU TYPE</div>${list.map(x=>`<button class="vault-live-item" data-live="${x.id}"><span class="vault-live-dot"><i class="fas ${iconFor(x.item_type)}"></i></span><span class="min-w-0"><b>${esc(x.title||labelFor(x.item_type))}</b><p>${esc((x.body||'').replace(/\n/g,' ').slice(0,110))}</p></span></button>`).join('')}`:`<div class="vault-live-empty">No Vault match yet. Keep typing or save this as a new note.</div>`;
    box.querySelectorAll('[data-live]').forEach(b=>b.onclick=()=>openView(b.dataset.live));
  }
  function emptyState(){
    const msg=query?'No notes match this search.':'Nothing here yet.';
    const sub=query?'Try another phrase, or save this knowledge for the team.':'Start building the department memory with one useful note.';
    return `<div class="vault-empty"><div><div class="icon"><i class="fas fa-note-sticky"></i></div><h3>${msg}</h3><p>${sub}</p><button id="vaultEmptyAdd"><i class="fas fa-plus mr-2"></i>New Note</button></div></div>`;
  }

  function iconFor(t){return TYPES[t]?.[1]||'fa-note-sticky'}
  function labelFor(t){return TYPES[t]?.[0]||'Note'}
  function colorFor(x){return COLORS[x.card_color]||COLORS.sunrise}
  function avatarHtml(id){const p=profile(id);if(p.avatar)return `<img src="${esc(p.avatar)}" class="vault-avatar">`;return `<span class="vault-avatar">${esc(initials(id))}</span>`}
  function card(x){
    const can=x.created_by===me()||admin(),c=colorFor(x);
    return `<article class="vaultCard vault-card" data-id="${x.id}" style="background:${c.bg};color:${c.ink}"><div class="vault-card-top"><div class="vault-type"><i class="fas ${iconFor(x.item_type)} mr-1"></i>${labelFor(x.item_type)}${x.is_pinned?' · PINNED':''}</div><div class="vault-card-actions"><button data-copy="${x.id}" title="Copy"><i class="fas fa-copy"></i></button>${can?`<button data-more="${x.id}" title="More"><i class="fas fa-ellipsis"></i></button>`:''}</div></div>${x.title?`<h3>${esc(x.title)}</h3>`:''}<div class="vault-card-body">${esc(x.body||'')}</div>${(x.tags||[]).length?`<div class="vault-tags">${x.tags.slice(0,5).map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}<div class="vault-meta"><div class="flex items-center gap-2">${avatarHtml(x.created_by)}<span>${esc(pname(x.created_by))}</span></div><span>${new Date(x.updated_at).toLocaleDateString()}</span></div></article>`;
  }
  function bindCards(r){
    r.querySelectorAll('[data-copy]').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=items.find(i=>i.id===b.dataset.copy);navigator.clipboard?.writeText([x.title,x.body,x.source_url].filter(Boolean).join('\n'));toast('Copied to clipboard');});
    r.querySelectorAll('[data-more]').forEach(b=>b.onclick=e=>{e.stopPropagation();openActions(b.dataset.more);});
    r.querySelectorAll('.vaultCard').forEach(c=>c.onclick=e=>{if(e.target.closest('button,a'))return;openView(c.dataset.id);});
  }

  function modal(html){document.getElementById('vaultModal')?.remove();const d=document.createElement('div');d.id='vaultModal';d.className='fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center p-5';d.innerHTML=html;
    const vaultModalChild=(d.firstElementChild); if(vaultModalChild) vaultModalChild.classList.add('vault-modal-shell');document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d)d.remove()});return d;}
  function autoTags(title,body,type){
    const text=`${title||''} ${body||''}`.toLowerCase();
    const rules={models:['model','scale model','maquette','mockup'],dimensions:['dimension','dimensions','size','width','height','cm','mm','meter'],cityscape:['cityscape'],project:['project','residence','tower','villa'],contact:['phone','email','contact','whatsapp'],supplier:['supplier','vendor','factory'],copy:['caption','copy','wording','text','headline'],event:['event','launch','open house','exhibition'],deadline:['deadline','due','submit'],social:['instagram','linkedin','facebook','social'],video:['video','reel','shoot','camera'],brochure:['brochure','presentation','pdf'],pricing:['price','qar','usd','cost','budget'],showroom:['showroom','office','location'],team:['team','roles','staff','member'],link:['http','www.']};
    const tags=[];Object.entries(rules).forEach(([tag,terms])=>{if(terms.some(t=>text.includes(t)))tags.push(tag)});if(type&&type!=='note'&&type!=='other')tags.push(type);return [...new Set(tags)].slice(0,7);
  }
  function openEditor(id=null,quick=false){
    const x=id?items.find(i=>i.id===id):null,startColor=x?.card_color||'sunrise';
    const d=modal(`<div class="vault-compose"><div class="vault-compose-top"><div><div class="text-[9px] tracking-[.15em] text-white/45 font-bold">${id?'EDIT NOTE':'SAVE TO VAULT'}</div><div class="text-lg font-bold mt-1">${id?'Update this memory':'Save it once. Find it later.'}</div></div><button data-close class="w-9 h-9 rounded-xl hover:bg-white/10"><i class="fas fa-xmark"></i></button></div><div class="vault-compose-body"><aside class="vault-compose-settings"><div><div class="vault-field-label">Note type</div><select id="veType">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${x?.item_type===k?'selected':''}>${v[0]}</option>`).join('')}</select></div><div><div class="vault-field-label">Visibility</div><select id="veVisibility"><option value="department" ${x?.visibility!=='private'?'selected':''}>Department</option><option value="private" ${x?.visibility==='private'?'selected':''}>Private</option></select></div><div><div class="vault-field-label">Card color</div><div class="vault-color-row">${Object.entries(COLORS).map(([k,c])=>`<button data-vcolor="${k}" class="${startColor===k?'active':''}" style="background:${c.bg}" title="${c.name}"></button>`).join('')}</div></div><div class="vault-smart-tags"><div class="flex items-center justify-between"><span class="text-[9px] font-bold text-gray-500">SMART TAGS</span><span class="text-[8px] text-gray-400">automatic</span></div><div id="veSuggested" class="chips"></div></div><div><div class="vault-field-label">Extra tags</div><input id="veTags" class="meta" value="${esc((x?.tags||[]).join(', '))}" placeholder="e.g. campaign, supplier"></div><div><div class="vault-field-label">Source link</div><input id="veUrl" class="meta" value="${esc(x?.source_url||'')}" placeholder="Optional URL"></div></aside><main class="vault-compose-main"><div class="vault-field-label">Title</div><input id="veTitle" class="vault-compose-title" value="${esc(x?.title||'')}" placeholder="Give this note a clear title"><div class="vault-field-label">Note content</div><textarea id="veBody" placeholder="Paste a message, dimensions, list, contact, copy, link, reference...">${esc(x?.body||'')}</textarea></main></div><div class="vault-compose-foot"><span class="text-[9px] text-gray-400 flex items-center"><i class="fas fa-wand-magic-sparkles mr-2"></i>Smart tags are added automatically.</span><div class="flex gap-2"><button data-close>Cancel</button><button id="veSave" class="save">Save</button></div></div></div>`);
    let selectedColor=startColor;const title=document.getElementById('veTitle'),body=document.getElementById('veBody'),type=document.getElementById('veType'),suggest=document.getElementById('veSuggested');
    const refreshTags=()=>{const arr=autoTags(title.value,body.value,type.value);suggest.innerHTML=arr.length?arr.map(t=>`<span>#${esc(t)}</span>`).join(''):'<span>Start typing…</span>';suggest.dataset.tags=arr.join(',')};[title,body,type].forEach(el=>el.addEventListener('input',refreshTags));refreshTags();
    d.querySelectorAll('[data-vcolor]').forEach(b=>b.onclick=()=>{selectedColor=b.dataset.vcolor;d.querySelectorAll('[data-vcolor]').forEach(x=>x.classList.toggle('active',x===b))});d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.remove());document.getElementById('veSave').onclick=()=>saveEditor(id,d,selectedColor);setTimeout(()=>document.getElementById(quick?'veBody':'veTitle')?.focus(),40);
  }
  async function saveEditor(id,d,selectedColor){
    const title=document.getElementById('veTitle').value.trim(),body=document.getElementById('veBody').value.trim();if(!body&&!title)return toast('Add something first');const type=document.getElementById('veType').value;const manual=document.getElementById('veTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean),smart=(document.getElementById('veSuggested').dataset.tags||'').split(',').filter(Boolean),tags=[...new Set([...smart,...manual])].slice(0,10);const payload={title:title||null,body:body||'',item_type:type,visibility:document.getElementById('veVisibility').value,tags,source_url:document.getElementById('veUrl').value.trim()||null,card_color:selectedColor,updated_by:me()};let res;if(id)res=await supabaseClient.from('vault_items').update(payload).eq('id',id).select('*').single();else res=await supabaseClient.from('vault_items').insert({...payload,created_by:me()}).select('*').single();if(res.error)return alert(res.error.message);if(id)items=items.map(i=>i.id===id?res.data:i);else items.unshift(res.data);d.remove();updateResults();toast('Saved to Vault');
  }
  function openView(id){
    const x=items.find(i=>i.id===id);if(!x)return;const can=x.created_by===me()||admin(),c=colorFor(x);const d=modal(`<div class="w-full max-w-2xl rounded-[26px] shadow-2xl overflow-hidden" style="background:${c.bg};color:${c.ink}"><div class="p-6 flex items-start justify-between"><div><div class="text-[9px] uppercase tracking-[.14em] font-bold opacity-55"><i class="fas ${iconFor(x.item_type)} mr-2"></i>${labelFor(x.item_type)}</div><h3 class="text-2xl font-extrabold mt-2">${esc(x.title||'Untitled')}</h3></div><button data-close class="w-9 h-9 rounded-xl bg-white/35"><i class="fas fa-xmark"></i></button></div><div class="px-6 pb-6"><div class="text-[14px] leading-7 whitespace-pre-wrap">${esc(x.body)}</div>${(x.tags||[]).length?`<div class="vault-tags mt-5">${x.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener" class="inline-flex mt-4 text-xs font-bold"><i class="fas fa-arrow-up-right-from-square mr-2"></i>Open source</a>`:''}<div class="mt-6 pt-5 border-t border-black/10 flex items-center justify-between"><div class="flex items-center gap-2">${avatarHtml(x.created_by)}<span class="text-xs opacity-65">Added by <b>${esc(pname(x.created_by))}</b></span></div><div class="flex gap-2"><button id="vvCopy" class="px-3 py-2 rounded-xl bg-white/40 text-xs font-bold"><i class="fas fa-copy mr-2"></i>Copy</button>${can?'<button id="vvEdit" class="px-3 py-2 rounded-xl bg-gray-950 text-white text-xs font-bold"><i class="fas fa-pen mr-2"></i>Edit</button>':''}</div></div></div></div>`);d.querySelector('[data-close]').onclick=()=>d.remove();document.getElementById('vvCopy').onclick=()=>{navigator.clipboard?.writeText([x.title,x.body,x.source_url].filter(Boolean).join('\n'));toast('Copied to clipboard')};document.getElementById('vvEdit')?.addEventListener('click',()=>{d.remove();openEditor(id)});
  }
  function openActions(id){
    const x=items.find(i=>i.id===id);if(!x)return;const d=modal(`<div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-3"><button id="vaPin" class="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold"><i class="fas fa-thumbtack w-6"></i>${x.is_pinned?'Unpin':'Pin'}</button><button id="vaEdit" class="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold"><i class="fas fa-pen w-6"></i>Edit</button><button id="vaDelete" class="w-full text-left px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 font-semibold"><i class="fas fa-trash w-6"></i>Delete</button></div>`);document.getElementById('vaPin').onclick=async()=>{const {data,error}=await supabaseClient.from('vault_items').update({is_pinned:!x.is_pinned,updated_by:me()}).eq('id',id).select('*').single();if(error)return alert(error.message);items=items.map(i=>i.id===id?data:i);d.remove();updateResults()};document.getElementById('vaEdit').onclick=()=>{d.remove();openEditor(id)};document.getElementById('vaDelete').onclick=async()=>{if(!confirm('Delete this Vault note?'))return;const {error}=await supabaseClient.from('vault_items').delete().eq('id',id);if(error)return alert(error.message);items=items.filter(i=>i.id!==id);d.remove();updateResults();toast('Deleted')};
  }

  function openAsk(seed=''){
    const d=modal(`<div class="vault-ask-modal"><div class="vault-ask-modal-head"><div class="flex items-start justify-between"><div><div class="text-[9px] tracking-[.16em] text-white/45 font-bold">ASK VAULT</div><h3 class="text-2xl font-extrabold mt-1">Ask your department memory.</h3><p class="text-xs text-white/55 mt-1">Answers only use what your team saved here.</p></div><button data-close class="w-9 h-9 rounded-xl hover:bg-white/10"><i class="fas fa-xmark"></i></button></div><div class="vault-ask-modal-input"><i class="fas fa-magnifying-glass text-gray-400 self-center ml-2"></i><input id="askInput" value="${esc(seed)}" placeholder="What do you need to know?"><button id="askGo">Ask</button></div></div><div id="askResult" class="vault-ask-results"></div></div>`);d.querySelector('[data-close]').onclick=()=>d.remove();const input=document.getElementById('askInput'),run=()=>answerAsk(input.value.trim());input.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(run,120)};input.onkeydown=e=>{if(e.key==='Enter')run()};document.getElementById('askGo').onclick=run;run();setTimeout(()=>input.focus(),40);
  }
  function answerAsk(q){
    const r=document.getElementById('askResult');if(!r)return;if(!q){r.innerHTML='<div class="text-center py-10 text-sm text-gray-400">Start typing and Vault will surface the best saved knowledge instantly.</div>';return;}const top=ranked(q,5);if(!top.length){r.innerHTML='<div class="text-center py-10 text-sm text-gray-400">I couldn’t find this in Vault.</div>';return;}r.innerHTML=`<div class="text-[9px] font-bold tracking-[.12em] text-gray-400 mb-3">BEST MATCHES</div>${top.map(x=>`<button class="vault-answer-card w-full text-left" data-source="${x.id}"><b>${esc(x.title||labelFor(x.item_type))}</b><p>${esc((x.body||'').slice(0,420))}${(x.body||'').length>420?'…':''}</p><div class="text-[9px] text-gray-400 mt-2">Source: ${esc(pname(x.created_by))}</div></button>`).join('')}`;r.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>openView(b.dataset.source));
  }
  function toast(msg){let t=document.getElementById('vaultToast');if(!t){t=document.createElement('div');t.id='vaultToast';t.className='fixed right-5 bottom-24 z-[500] px-4 py-3 bg-gray-950 text-white rounded-xl shadow-xl text-sm font-semibold transition';document.body.appendChild(t)}t.textContent=msg;t.style.opacity='1';clearTimeout(t._tm);t._tm=setTimeout(()=>t.style.opacity='0',1800)}
  function ensureQuickCapture(){if(!state.currentUser)return;let b=document.getElementById('vaultQuick');if(b)return;b=document.createElement('button');b.id='vaultQuick';b.title='Quick Save to Vault';b.className='fixed right-5 bottom-5 z-[180] h-11 px-4 rounded-2xl bg-gray-950 text-white shadow-xl hover:scale-105 transition flex items-center justify-center text-xs font-bold';b.innerHTML='<i class="fas fa-plus mr-2"></i>Quick Save';b.onclick=()=>openEditor(null,true);document.body.appendChild(b)}
  function bindGlobalKeys(){if(window.__vaultKeysBound)return;window.__vaultKeysBound=true;document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&state.currentUser){const v=document.getElementById('view-vault');if(v&&!v.classList.contains('hidden')){e.preventDefault();document.getElementById('vaultSearch')?.focus();}}});setInterval(()=>{if(state.currentUser)ensureQuickCapture();else document.getElementById('vaultQuick')?.remove()},2500)}
  return {open,ensureQuickCapture};
})();