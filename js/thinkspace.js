// TAAMEER Thinkspace v2 — advanced visual collaboration workspace
const ThinkspaceApp = (() => {
  const PAGE_PRESETS = {
    free: { label: 'Infinite canvas', w: 2200, h: 1400 },
    screen16x9: { label: 'Presentation 16:9', w: 1920, h: 1080 },
    screen4x3: { label: 'Presentation 4:3', w: 1600, h: 1200 },
    a4: { label: 'A4', w: 794, h: 1123 },
    a3: { label: 'A3', w: 1123, h: 1587 },
    letter: { label: 'Letter', w: 816, h: 1056 },
    square: { label: 'Square', w: 1080, h: 1080 }
  };

  const TOOL_GROUPS = [
    [['select', 'fa-arrow-pointer', 'Select (V)'], ['hand', 'fa-hand', 'Pan (H / Space)']],
    [['text', 'fa-font', 'Text (T)'], ['sticky', 'fa-note-sticky', 'Sticky note (S)']],
    [['rect', 'fa-square', 'Rectangle (R)'], ['circle', 'fa-circle', 'Ellipse (O)'], ['diamond', 'fa-diamond', 'Decision (D)']],
    [['connector', 'fa-arrow-right-long', 'Connector (C)'], ['pen', 'fa-pen', 'Pen (P)'], ['marker', 'fa-highlighter', 'Marker (M)']],
    [['frame', 'fa-object-group', 'Frame (F)'], ['image', 'fa-image', 'Image (I)']]
  ];

  let boards = [], profiles = [], board = null, data = null;
  let filter = 'all', tool = 'select', selected = null, connectFrom = null;
  let drag = null, pan = null, drawStroke = null, saveTimer = null;
  let history = [], historyIndex = -1, keySpace = false, clipboardNode = null;

  const cid = () => state.currentUser.id;
  const isAdmin = () => state.currentUser.role === 'admin';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => crypto.randomUUID?.() || ('n' + Date.now() + Math.random().toString(16).slice(2));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const profile = id => profiles.find(p => p.id === id) || null;
  const pname = id => profile(id)?.full_name || profile(id)?.username || 'Team member';
  const canEdit = () => !!board && (board.owner_id === cid() || board.collaborator_ids?.includes(cid()) || isAdmin());

  function avatar(id, size = 30) {
    const p = profile(id);
    if (p?.avatar) return `<img src="${esc(p.avatar)}" style="width:${size}px;height:${size}px" class="rounded-full object-cover border-2 border-white">`;
    const initials = (p?.full_name || p?.username || '?').split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
    return `<span style="width:${size}px;height:${size}px" class="rounded-full bg-gray-950 text-white inline-flex items-center justify-center text-[10px] font-bold border-2 border-white">${esc(initials)}</span>`;
  }

  function baseData() {
    return {
      nodes: [], connectors: [], strokes: [], viewport: { x: 0, y: 0, zoom: 1 },
      page: { preset: 'free', width: 2200, height: 1400, orientation: 'landscape', grid: true, gridSize: 20, background: '#ffffff' }
    };
  }

  function ensureData() {
    data = data || baseData();
    data.nodes = Array.isArray(data.nodes) ? data.nodes : [];
    data.connectors = Array.isArray(data.connectors) ? data.connectors : [];
    data.strokes = Array.isArray(data.strokes) ? data.strokes : [];
    data.viewport = data.viewport || { x: 0, y: 0, zoom: 1 };
    data.page = Object.assign(baseData().page, data.page || {});
    data.nodes.forEach(n => {
      if (!n.id) n.id = uid();
      n.w = Number(n.w) || 180; n.h = Number(n.h) || 72;
      n.x = Number(n.x) || 0; n.y = Number(n.y) || 0;
      n.text = n.text ?? '';
      n.fill = n.fill || (n.type === 'sticky' ? '#FEF3C7' : '#FFFFFF');
      n.stroke = n.stroke || '#D1D5DB'; n.strokeWidth = Number(n.strokeWidth) || 1.5;
      n.textColor = n.textColor || '#111827'; n.fontSize = Number(n.fontSize) || 16;
    });
    data.connectors.forEach(c => { c.id = c.id || uid(); c.color = c.color || '#64748B'; c.width = Number(c.width) || 2; c.arrow = c.arrow !== false; });
  }

  function snapshot(push = true) {
    if (!push) return;
    const snap = JSON.stringify(data);
    if (historyIndex >= 0 && history[historyIndex] === snap) return;
    history = history.slice(0, historyIndex + 1);
    history.push(snap);
    if (history.length > 60) history.shift();
    historyIndex = history.length - 1;
  }

  function undo() { if (historyIndex <= 0) return; historyIndex--; data = JSON.parse(history[historyIndex]); selected = null; renderCanvas(); scheduleSave(); }
  function redo() { if (historyIndex >= history.length - 1) return; historyIndex++; data = JSON.parse(history[historyIndex]); selected = null; renderCanvas(); scheduleSave(); }

  async function loadProfiles() {
    const { data: rows = [] } = await supabaseClient.from('profiles').select('id,full_name,username,avatar,status').eq('status','active');
    profiles = rows;
  }
  async function loadBoards() {
    const { data: rows = [], error } = await supabaseClient.from('thinkspace_boards').select('*').order('updated_at', { ascending: false });
    if (error) throw error; boards = rows;
  }

  function moduleShell() {
    const v = document.getElementById('view-thinkspace');
    if (!v) return;
    v.className = 'view-section fade-in h-full';
    v.innerHTML = '<div id="tsRoot" class="h-full"></div>';
  }

  async function open() {
    moduleShell();
    try { await Promise.all([loadProfiles(), loadBoards()]); library(); }
    catch (e) { console.error(e); document.getElementById('tsRoot').innerHTML = '<div class="h-full flex items-center justify-center text-red-500">Could not load Thinkspace.</div>'; }
  }

  function library() {
    board = null;
    const root = document.getElementById('tsRoot');
    const accessible = boards.filter(b => b.owner_id === cid() || isAdmin() || b.visibility === 'department' || (b.collaborator_ids||[]).includes(cid()) || (b.viewer_ids||[]).includes(cid()));
    const list = filter === 'all' ? accessible
      : filter === 'mine' ? accessible.filter(b => b.owner_id === cid())
      : filter === 'shared' ? accessible.filter(b => b.owner_id !== cid() && ((b.collaborator_ids||[]).includes(cid()) || (b.viewer_ids||[]).includes(cid())) )
      : accessible.filter(b => b.visibility === 'department');

    root.innerHTML = `<div class="h-full flex flex-col gap-4 overflow-hidden">
      <section class="rounded-3xl bg-gradient-to-r from-gray-950 via-gray-900 to-[var(--accent)] text-white px-7 py-5 flex items-center justify-between gap-6">
        <div><div class="text-[10px] tracking-[.2em] text-white/45 font-semibold">TAAMEER THINKSPACE</div><h2 class="text-3xl font-bold mt-1">Ideas start here.</h2><p class="text-sm text-white/55 mt-1">Think. Map. Build. Together.</p></div>
        <div class="flex gap-2 flex-wrap justify-end"><button data-template="blank" class="tsNew px-4 py-2.5 rounded-xl bg-white text-gray-950 text-sm font-bold"><i class="fas fa-plus mr-2"></i>New Board</button><button data-template="mindmap" class="tsNew px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm font-semibold"><i class="fas fa-diagram-project mr-2"></i>Mind Map</button><button data-template="flow" class="tsNew px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm font-semibold"><i class="fas fa-code-branch mr-2"></i>Flowchart</button></div>
      </section>
      <section class="flex items-center justify-between gap-4"><div class="inline-flex p-1 bg-white border rounded-xl">${[['all','All'],['mine','My Boards'],['shared','Shared With Me'],['department','Department']].map(([k,l]) => `<button data-filter="${k}" class="tsFilter px-4 py-2 rounded-lg text-sm font-semibold ${filter===k?'bg-gray-950 text-white':'text-gray-500 hover:bg-gray-50'}">${l}</button>`).join('')}</div><div class="text-xs text-gray-400">${list.length} board${list.length===1?'':'s'}</div></section>
      <section class="flex-1 min-h-0 overflow-auto"><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">${list.map(boardCard).join('') || emptyLibrary()}</div></section>
    </div>`;
    root.querySelectorAll('.tsNew').forEach(b => b.onclick = () => createBoard(b.dataset.template));
    root.querySelectorAll('.tsFilter').forEach(b => b.onclick = () => { filter = b.dataset.filter; library(); });
    root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openBoard(b.dataset.open));
    root.querySelectorAll('[data-more]').forEach(b => b.onclick = e => { e.stopPropagation(); quickMenu(b.dataset.more); });
  }

  function emptyLibrary() { return `<div class="md:col-span-2 xl:col-span-3 border border-dashed rounded-3xl bg-white p-12 text-center"><div class="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500"><i class="fas fa-pen-ruler text-xl"></i></div><h3 class="font-bold mt-4">Nothing here yet</h3><p class="text-sm text-gray-400 mt-1">Start a blank board or use a quick template.</p></div>`; }

  function previewSvg(b) {
    const d = b.board_data || {}, page = Object.assign(baseData().page, d.page || {}), nodes = Array.isArray(d.nodes) ? d.nodes : [], cons = Array.isArray(d.connectors) ? d.connectors : [], strokes = Array.isArray(d.strokes) ? d.strokes : [];
    const W = page.width || 2200, H = page.height || 1400, sx = 360/W, sy = 160/H;
    const nodeMap = new Map(nodes.map(n => [n.id,n]));
    const lines = cons.map(c => { const a=nodeMap.get(c.from), z=nodeMap.get(c.to); if(!a||!z)return ''; const p1=center(a),p2=center(z); return `<line x1="${p1.x*sx}" y1="${p1.y*sy}" x2="${p2.x*sx}" y2="${p2.y*sy}" stroke="${esc(c.color||'#94A3B8')}" stroke-width="1.5"/>`; }).join('');
    const shapeHtml = nodes.slice(0,60).map(n => { const x=n.x*sx,y=n.y*sy,w=Math.max(10,n.w*sx),h=Math.max(7,n.h*sy),fill=n.fill||'#fff',stroke=n.stroke||'#CBD5E1'; if(n.type==='circle') return `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" stroke="${stroke}"/>`; if(n.type==='diamond') return `<polygon points="${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}" fill="${fill}" stroke="${stroke}"/>`; if(n.type==='frame') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="${stroke}" stroke-dasharray="4 3"/>`; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}"/>`; }).join('');
    const strokeHtml = strokes.slice(0,60).map(s => `<polyline points="${(s.points||[]).map(p=>`${p.x*sx},${p.y*sy}`).join(' ')}" fill="none" stroke="${esc(s.color||'#111827')}" stroke-width="${Math.max(1,(s.width||3)*sx)}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.opacity??1}"/>`).join('');
    return `<svg viewBox="0 0 360 160" class="w-full h-full">${lines}${strokeHtml}${shapeHtml}</svg>`;
  }

  function boardCard(b) {
    const others = [...(b.collaborator_ids||[]),...(b.viewer_ids||[])].filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
    return `<div data-open="${b.id}" class="group bg-white rounded-3xl border p-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"><div class="relative h-40 rounded-2xl overflow-hidden border bg-[#fbfbfc]">${previewSvg(b)}</div><div class="p-2 pt-3"><div class="flex justify-between gap-3"><div class="min-w-0"><h3 class="font-bold truncate">${esc(b.title)}</h3><p class="text-xs text-gray-400 mt-1">${b.owner_id===cid()?'You':esc(pname(b.owner_id))} · ${new Date(b.updated_at).toLocaleDateString()}</p></div><button data-more="${b.id}" class="w-9 h-9 rounded-xl hover:bg-gray-100 text-gray-400"><i class="fas fa-ellipsis"></i></button></div><div class="flex items-center justify-between mt-3"><div class="flex -space-x-2">${avatar(b.owner_id)}${others.map(x=>avatar(x)).join('')}</div><span class="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500">${b.visibility==='department'?'Department':b.visibility==='shared'?'Shared':'Private'}</span></div></div></div>`;
  }

  async function quickMenu(id) {
    const b = boards.find(x => x.id === id); if (!b) return;
    if (b.owner_id === cid() || isAdmin()) { if (confirm(`Delete “${b.title}”?`)) await deleteBoard(id); }
  }

  function makeNode(type,x,y,w=180,h=72,text='') { return { id:uid(), type, x,y,w,h,text, fill:type==='sticky'?'#FEF3C7':'#FFFFFF', stroke:'#CBD5E1', strokeWidth:1.5, textColor:'#111827', fontSize:16, radius:16 }; }

  async function createBoard(template='blank') {
    let title = template==='mindmap' ? 'New Mind Map' : template==='flow' ? 'New Flowchart' : 'Untitled Board';
    const d = baseData();
    if (template==='mindmap') {
      const root=makeNode('rect',890,510,240,84,'Main Idea');
      const children=[makeNode('sticky',470,300,200,82,'Idea 1'),makeNode('sticky',470,720,200,82,'Idea 2'),makeNode('sticky',1380,300,200,82,'Idea 3'),makeNode('sticky',1380,720,200,82,'Idea 4')];
      d.nodes=[root,...children]; d.connectors=children.map(n=>({id:uid(),from:root.id,to:n.id,color:'#64748B',width:2,arrow:true}));
    }
    if (template==='flow') {
      const a=makeNode('rect',900,220,220,74,'Start'), b=makeNode('diamond',900,470,220,120,'Decision'), c=makeNode('rect',540,760,220,74,'Option A'), e=makeNode('rect',1260,760,220,74,'Option B');
      d.nodes=[a,b,c,e]; d.connectors=[{id:uid(),from:a.id,to:b.id,color:'#64748B',width:2,arrow:true},{id:uid(),from:b.id,to:c.id,color:'#64748B',width:2,arrow:true},{id:uid(),from:b.id,to:e.id,color:'#64748B',width:2,arrow:true}];
    }
    const {data:newBoard,error}=await supabaseClient.from('thinkspace_boards').insert({title,owner_id:cid(),visibility:'private',board_data:d}).select().single();
    if (error) return alert(error.message); boards.unshift(newBoard); openBoard(newBoard.id);
  }

  async function deleteBoard(id) { const {error}=await supabaseClient.from('thinkspace_boards').delete().eq('id',id); if(error)return alert(error.message); boards=boards.filter(x=>x.id!==id); library(); }

  async function openBoard(id) {
    board = boards.find(x=>x.id===id); if(!board)return;
    data = structuredClone(board.board_data || baseData()); ensureData(); selected=null;connectFrom=null;tool='select';history=[];historyIndex=-1;snapshot();
    workspace(); renderCanvas(); fitPage(); await loadComments();
  }

  function workspace() {
    const root=document.getElementById('tsRoot'), editable=canEdit();
    root.innerHTML=`<div class="h-full rounded-3xl border bg-white overflow-hidden flex flex-col">
      <header class="h-14 px-3 border-b flex items-center gap-3 bg-white shrink-0"><button id="backBoards" class="w-9 h-9 rounded-xl hover:bg-gray-100"><i class="fas fa-chevron-left"></i></button><div class="w-9 h-9 rounded-xl bg-gray-950 text-white flex items-center justify-center"><i class="fas fa-pen-ruler"></i></div><div class="min-w-0"><input id="boardTitle" value="${esc(board.title)}" ${editable?'':'readonly'} class="font-bold bg-transparent outline-none w-64 max-w-[30vw] truncate"><div id="saveState" class="text-[10px] text-gray-400">Saved</div></div><div class="flex-1"></div><button id="pageBtn" class="px-3 py-2 rounded-xl border text-xs font-semibold"><i class="fas fa-file mr-1"></i>Canvas</button><button id="gridBtn" class="w-9 h-9 rounded-xl border" title="Toggle grid"><i class="fas fa-border-all"></i></button><div class="flex -space-x-2">${avatar(board.owner_id)}${(board.collaborator_ids||[]).slice(0,3).map(x=>avatar(x)).join('')}</div><button id="commentToggle" class="w-9 h-9 rounded-xl border"><i class="far fa-comment"></i></button>${board.owner_id===cid()||isAdmin()?'<button id="shareBtn" class="px-3 py-2 rounded-xl bg-gray-950 text-white text-xs font-semibold"><i class="fas fa-user-plus mr-1"></i>Share</button>':''}<button id="exportBtn" class="px-3 py-2 rounded-xl border text-xs font-semibold"><i class="fas fa-download mr-1"></i>Export</button></header>
      <div class="relative flex-1 min-h-0 bg-[#eef1f5] overflow-hidden">
        <div id="tsCanvasWrap" class="absolute inset-0 overflow-hidden cursor-default"><div id="tsWorld" class="absolute origin-top-left"><div id="tsPage" class="absolute shadow-[0_12px_45px_rgba(15,23,42,.18)] overflow-hidden"><svg id="tsLines" class="absolute inset-0 w-full h-full overflow-visible"></svg><svg id="tsStrokes" class="absolute inset-0 w-full h-full overflow-visible pointer-events-none"></svg><div id="tsNodes" class="absolute inset-0"></div></div></div></div>
        ${editable ? toolbarHtml() : ''}
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border rounded-xl shadow-sm p-1 z-20"><button id="undoBtn" class="w-8 h-8 rounded-lg hover:bg-gray-100" title="Undo Ctrl/Cmd+Z"><i class="fas fa-rotate-left"></i></button><button id="redoBtn" class="w-8 h-8 rounded-lg hover:bg-gray-100" title="Redo Ctrl/Cmd+Shift+Z"><i class="fas fa-rotate-right"></i></button><span class="w-px h-5 bg-gray-200 mx-1"></span><button id="zoomOut" class="w-8 h-8 rounded-lg hover:bg-gray-100">−</button><button id="zoomLabel" class="px-2 text-xs font-semibold min-w-[52px] text-center hover:bg-gray-100 rounded-lg">100%</button><button id="zoomIn" class="w-8 h-8 rounded-lg hover:bg-gray-100">+</button><button id="fitBtn" class="w-8 h-8 rounded-lg hover:bg-gray-100" title="Fit page"><i class="fas fa-expand"></i></button></div>
        <div id="toolOptions" class="absolute left-1/2 top-4 -translate-x-1/2 z-20 hidden bg-white border rounded-2xl shadow-lg p-2"></div>
        ${pagePanelHtml()}${commentsPanelHtml()}${shareModalHtml()}
      </div>
    </div><input id="tsImageInput" type="file" accept="image/*" class="hidden">`;
    bindWorkspace();
  }

  function toolbarHtml(){
    return `<div id="tsToolbar" class="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-white/95 backdrop-blur border rounded-2xl shadow-xl z-20 flex flex-col gap-1">${TOOL_GROUPS.map((g,gi)=>`${gi?'<div class="h-px bg-gray-200 my-1"></div>':''}${g.map(([k,ic,label])=>`<button data-tool="${k}" class="toolBtn w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition" title="${label}"><i class="fas ${ic}"></i></button>`).join('')}`).join('')}</div>`;
  }
  function pagePanelHtml(){ return `<aside id="pagePanel" class="absolute top-0 right-0 bottom-0 w-[340px] bg-white border-l shadow-2xl translate-x-full transition-transform z-40 flex flex-col"><div class="p-4 border-b flex items-start justify-between"><div><b>Canvas setup</b><div class="text-xs text-gray-400 mt-0.5">Size, orientation and grid</div></div><button id="closePage" class="w-8 h-8 rounded-lg hover:bg-gray-100"><i class="fas fa-times"></i></button></div><div class="p-4 space-y-5 overflow-auto"><div><label class="text-xs font-semibold text-gray-500">Preset</label><select id="pagePreset" class="input-field mt-2">${Object.entries(PAGE_PRESETS).map(([k,v])=>`<option value="${k}" ${data.page.preset===k?'selected':''}>${v.label}</option>`).join('')}<option value="custom" ${data.page.preset==='custom'?'selected':''}>Custom size</option></select></div><div class="grid grid-cols-2 gap-3"><div><label class="text-xs font-semibold text-gray-500">Width (px)</label><input id="pageW" type="number" min="200" max="8000" value="${data.page.width}" class="input-field mt-2"></div><div><label class="text-xs font-semibold text-gray-500">Height (px)</label><input id="pageH" type="number" min="200" max="8000" value="${data.page.height}" class="input-field mt-2"></div></div><div><label class="text-xs font-semibold text-gray-500">Orientation</label><div class="grid grid-cols-2 gap-2 mt-2"><button data-orient="portrait" class="orientBtn border rounded-xl py-3 text-xs font-semibold"><i class="fas fa-mobile-screen mr-2"></i>Portrait</button><button data-orient="landscape" class="orientBtn border rounded-xl py-3 text-xs font-semibold"><i class="fas fa-display mr-2"></i>Landscape</button></div></div><div class="flex items-center justify-between border rounded-xl p-3"><div><div class="text-sm font-semibold">Grid</div><div class="text-xs text-gray-400">Show alignment dots</div></div><button id="panelGrid" class="w-11 h-6 rounded-full bg-gray-200 relative"><span class="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition"></span></button></div><div><label class="text-xs font-semibold text-gray-500">Grid spacing</label><input id="gridSize" type="range" min="10" max="80" step="5" value="${data.page.gridSize}" class="w-full mt-2"><div class="text-xs text-gray-400 mt-1"><span id="gridSizeLabel">${data.page.gridSize}</span> px</div></div><div><label class="text-xs font-semibold text-gray-500">Background</label><div class="flex gap-2 mt-2"><input id="pageBg" type="color" value="${data.page.background}" class="w-11 h-11 p-1 border rounded-xl bg-white"><button id="resetBg" class="px-3 rounded-xl border text-xs font-semibold">White</button></div></div><button id="applyPage" class="w-full py-3 rounded-xl bg-gray-950 text-white font-semibold text-sm">Apply canvas</button></div></aside>`; }
  function commentsPanelHtml(){ return `<aside id="commentsPanel" class="absolute top-0 right-0 bottom-0 w-80 bg-white border-l shadow-xl translate-x-full transition-transform z-40 flex flex-col"><div class="p-4 border-b flex justify-between"><div><b>Comments</b><div class="text-xs text-gray-400">Board conversation</div></div><button id="closeComments"><i class="fas fa-times"></i></button></div><div id="commentsList" class="flex-1 overflow-auto p-4 space-y-3"></div><form id="commentForm" class="p-3 border-t flex gap-2"><input id="commentInput" class="input-field !py-2" placeholder="Add a comment…"><button class="w-10 h-10 rounded-xl bg-accent text-white"><i class="fas fa-paper-plane"></i></button></form></aside>`; }
  function shareModalHtml(){ return `<div id="shareModal" class="fixed inset-0 bg-black/45 backdrop-blur-sm hidden items-center justify-center z-[95] p-4"><div class="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"><div class="p-5 border-b flex justify-between"><div><h3 class="text-xl font-bold">Share board</h3><p class="text-xs text-gray-400">Choose who can view or edit.</p></div><button id="closeShare"><i class="fas fa-times"></i></button></div><div class="p-5 space-y-5"><div><label class="text-xs font-semibold text-gray-500">Visibility</label><div class="grid grid-cols-3 gap-2 mt-2">${[['private','Private'],['shared','Selected'],['department','Department']].map(([k,l])=>`<button data-vis="${k}" class="visBtn px-3 py-2 rounded-xl border text-xs font-semibold">${l}</button>`).join('')}</div></div><div><div class="text-xs font-semibold text-gray-500 mb-2">Team members</div><div class="space-y-2 max-h-64 overflow-auto">${profiles.filter(p=>p.id!==cid()).map(p=>`<div class="flex items-center gap-3 p-2 rounded-xl border">${avatar(p.id)}<div class="flex-1 text-sm font-semibold">${esc(p.full_name||p.username)}</div><select data-share="${p.id}" class="border rounded-lg px-2 py-1.5 text-xs"><option value="none">No access</option><option value="view" ${(board.viewer_ids||[]).includes(p.id)?'selected':''}>Can view</option><option value="edit" ${(board.collaborator_ids||[]).includes(p.id)?'selected':''}>Can edit</option></select></div>`).join('')}</div></div><button id="saveShare" class="w-full py-3 rounded-xl bg-gray-950 text-white font-semibold text-sm">Save sharing</button></div></div></div>`; }

  function bindWorkspace(){
    const q=id=>document.getElementById(id);
    q('backBoards').onclick=async()=>{await saveNow();await loadBoards();library();};
    q('boardTitle')?.addEventListener('input',()=>scheduleSave(true));
    q('pageBtn').onclick=()=>q('pagePanel').classList.remove('translate-x-full'); q('closePage').onclick=()=>q('pagePanel').classList.add('translate-x-full');
    q('gridBtn').onclick=()=>{data.page.grid=!data.page.grid; renderPage(); scheduleSave();};
    q('commentToggle').onclick=()=>q('commentsPanel').classList.remove('translate-x-full'); q('closeComments').onclick=()=>q('commentsPanel').classList.add('translate-x-full');
    q('shareBtn') && (q('shareBtn').onclick=()=>{q('shareModal').classList.remove('hidden');q('shareModal').classList.add('flex');updateShareButtons();});
    q('closeShare').onclick=()=>{q('shareModal').classList.add('hidden');q('shareModal').classList.remove('flex');};
    q('saveShare').onclick=saveShare; q('exportBtn').onclick=exportMenu;
    q('undoBtn').onclick=undo;q('redoBtn').onclick=redo;q('zoomIn').onclick=()=>zoomBy(1.15);q('zoomOut').onclick=()=>zoomBy(.87);q('fitBtn').onclick=fitPage;q('zoomLabel').onclick=()=>{data.viewport.zoom=1;renderTransform();};
    q('commentForm').onsubmit=postComment;
    q('tsImageInput').onchange=handleImage;
    document.querySelectorAll('.toolBtn').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
    bindPagePanel(); bindCanvasEvents(); bindKeyboard(); setTool('select');
  }

  function bindPagePanel(){
    const q=id=>document.getElementById(id);
    q('pagePreset').onchange=()=>{const p=PAGE_PRESETS[q('pagePreset').value];if(p){q('pageW').value=p.w;q('pageH').value=p.h;}};
    q('gridSize').oninput=()=>q('gridSizeLabel').textContent=q('gridSize').value;
    q('panelGrid').onclick=()=>{data.page.grid=!data.page.grid;updateGridSwitch();renderPage();};
    document.querySelectorAll('.orientBtn').forEach(b=>b.onclick=()=>{const want=b.dataset.orient;if(want!==data.page.orientation){[q('pageW').value,q('pageH').value]=[q('pageH').value,q('pageW').value];data.page.orientation=want;}updateOrientButtons();});
    q('resetBg').onclick=()=>q('pageBg').value='#ffffff';
    q('applyPage').onclick=()=>{data.page.preset=q('pagePreset').value;data.page.width=clamp(Number(q('pageW').value)||1920,200,8000);data.page.height=clamp(Number(q('pageH').value)||1080,200,8000);data.page.gridSize=Number(q('gridSize').value)||20;data.page.background=q('pageBg').value||'#ffffff';snapshot();renderCanvas();fitPage();scheduleSave();};
    updateGridSwitch();updateOrientButtons();
  }
  function updateGridSwitch(){const b=document.getElementById('panelGrid');if(!b)return;b.classList.toggle('bg-gray-950',!!data.page.grid);b.classList.toggle('bg-gray-200',!data.page.grid);const s=b.querySelector('span');s.style.left=data.page.grid?'24px':'4px';}
  function updateOrientButtons(){document.querySelectorAll('.orientBtn').forEach(b=>{const on=b.dataset.orient===data.page.orientation;b.classList.toggle('bg-gray-950',on);b.classList.toggle('text-white',on);});}

  function setTool(k){tool=k;connectFrom=null;document.querySelectorAll('.toolBtn').forEach(b=>{const on=b.dataset.tool===k;b.classList.toggle('bg-gray-950',on);b.classList.toggle('text-white',on);b.classList.toggle('text-gray-500',!on);});const wrap=document.getElementById('tsCanvasWrap');if(wrap)wrap.style.cursor=(k==='hand'||keySpace)?'grab':k==='pen'||k==='marker'?'crosshair':k==='text'?'text':'default';showToolOptions();}
  function showToolOptions(){const el=document.getElementById('toolOptions');if(!el)return;if(['pen','marker'].includes(tool)){const isMarker=tool==='marker';el.innerHTML=`<div class="flex items-center gap-2"><span class="text-xs font-semibold text-gray-500">${isMarker?'Marker':'Pen'}</span><input id="drawColor" type="color" value="${isMarker?'#FDE047':'#111827'}" class="w-9 h-9 p-1 border rounded-lg"><input id="drawWidth" type="range" min="1" max="30" value="${isMarker?14:3}" class="w-28"><span id="drawWidthLabel" class="text-xs text-gray-500 w-7">${isMarker?14:3}</span></div>`;el.classList.remove('hidden');document.getElementById('drawWidth').oninput=e=>document.getElementById('drawWidthLabel').textContent=e.target.value;}else el.classList.add('hidden');}

  function bindCanvasEvents(){
    const wrap=document.getElementById('tsCanvasWrap');
    wrap.onpointerdown=e=>{
      if(e.button!==0&&e.button!==1)return;
      const isPan=tool==='hand'||keySpace||e.button===1;
      if(isPan){pan={sx:e.clientX,sy:e.clientY,ox:data.viewport.x,oy:data.viewport.y};wrap.setPointerCapture?.(e.pointerId);wrap.style.cursor='grabbing';return;}
      const world=screenToWorld(e.clientX,e.clientY);
      if(['pen','marker'].includes(tool)){const col=document.getElementById('drawColor')?.value||(tool==='marker'?'#FDE047':'#111827'),wid=Number(document.getElementById('drawWidth')?.value)||(tool==='marker'?14:3);drawStroke={id:uid(),type:tool,color:col,width:wid,opacity:tool==='marker'?.45:1,points:[world]};data.strokes.push(drawStroke);renderStrokes();wrap.setPointerCapture?.(e.pointerId);return;}
      if(e.target===wrap||e.target.id==='tsWorld'||e.target.id==='tsPage'||e.target.id==='tsNodes'||e.target.id==='tsLines'||e.target.id==='tsStrokes'){
        selected=null; renderSelection();
        if(['text','sticky','rect','circle','diamond','frame'].includes(tool)){const size=tool==='frame'?[420,260]:tool==='sticky'?[200,110]:tool==='diamond'?[190,120]:tool==='text'?[220,54]:[200,90];const n=makeNode(tool,world.x-size[0]/2,world.y-size[1]/2,size[0],size[1],tool==='text'?'Type something…':tool==='sticky'?'Note':tool==='diamond'?'Decision':tool==='frame'?'Frame':'Text');data.nodes.push(n);selected=n.id;snapshot();renderCanvas();scheduleSave();setTimeout(()=>editNodeText(n.id,true),0);if(tool!=='frame')setTool('select');}
      }
    };
    wrap.onpointermove=e=>{if(pan){data.viewport.x=pan.ox+(e.clientX-pan.sx);data.viewport.y=pan.oy+(e.clientY-pan.sy);renderTransform();return;}if(drawStroke){drawStroke.points.push(screenToWorld(e.clientX,e.clientY));renderStrokes();return;}if(drag){const p=screenToWorld(e.clientX,e.clientY),n=getNode(drag.id);if(!n)return;n.x=drag.x+(p.x-drag.px);n.y=drag.y+(p.y-drag.py);renderNodePosition(n);renderConnectors();}};
    wrap.onpointerup=e=>{if(pan){pan=null;wrap.style.cursor=(tool==='hand'||keySpace)?'grab':'default';scheduleSave();}if(drawStroke){drawStroke=null;snapshot();scheduleSave();}if(drag){drag=null;snapshot();scheduleSave();}};
    wrap.onwheel=e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const factor=e.deltaY<0?1.08:.92;zoomAt(factor,e.clientX,e.clientY);}else if(e.shiftKey){data.viewport.x-=e.deltaY;renderTransform();}else{data.viewport.x-=e.deltaX;data.viewport.y-=e.deltaY;renderTransform();}}, {passive:false};
  }

  function bindKeyboard(){
    if(window._tsKeyDown)document.removeEventListener('keydown',window._tsKeyDown);if(window._tsKeyUp)document.removeEventListener('keyup',window._tsKeyUp);
    window._tsKeyDown=e=>{if(!board)return;const tag=(e.target.tagName||'').toLowerCase(),typing=['input','textarea','select'].includes(tag)||e.target.isContentEditable;if(e.code==='Space'&&!typing){e.preventDefault();keySpace=true;document.getElementById('tsCanvasWrap').style.cursor='grab';return;}if(typing)return;const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();return;}if(mod&&e.key.toLowerCase()==='c'&&selected){e.preventDefault();const n=getNode(selected);if(n)clipboardNode=structuredClone(n);return;}if(mod&&e.key.toLowerCase()==='v'&&clipboardNode&&canEdit()){e.preventDefault();const n=structuredClone(clipboardNode);n.id=uid();n.x+=24;n.y+=24;data.nodes.push(n);selected=n.id;clipboardNode=structuredClone(n);snapshot();renderCanvas();scheduleSave();return;}if(mod&&e.key.toLowerCase()==='d'&&selected&&canEdit()){e.preventDefault();const src=getNode(selected);if(src){const n=structuredClone(src);n.id=uid();n.x+=24;n.y+=24;data.nodes.push(n);selected=n.id;snapshot();renderCanvas();scheduleSave();}return;}if(e.key==='Delete'||e.key==='Backspace'){if(selected){e.preventDefault();deleteSelected();}return;}if(e.key==='Escape'){selected=null;connectFrom=null;setTool('select');renderSelection();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected){e.preventDefault();const n=getNode(selected);if(n){const step=e.shiftKey?10:1;n.x+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;n.y+=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;renderNodePosition(n);renderConnectors();scheduleSave();}return;}if(e.key==='+'||e.key==='='){zoomBy(1.12);return;}if(e.key==='-'){zoomBy(.89);return;}const k=e.key.toLowerCase();const map={v:'select',h:'hand',t:'text',s:'sticky',r:'rect',o:'circle',d:'diamond',c:'connector',p:'pen',m:'marker',i:'image'};if(map[k]){if(map[k]==='image')document.getElementById('tsImageInput').click();else setTool(map[k]);}if(k==='0')fitPage();};
    window._tsKeyUp=e=>{if(e.code==='Space'){keySpace=false;const wrap=document.getElementById('tsCanvasWrap');if(wrap)wrap.style.cursor=tool==='hand'?'grab':'default';}};
    document.addEventListener('keydown',window._tsKeyDown);document.addEventListener('keyup',window._tsKeyUp);
  }

  function getNode(id){return data.nodes.find(n=>n.id===id)||null;}
  function center(n){return{x:n.x+n.w/2,y:n.y+n.h/2};}
  function edgePoint(n,toward){const c=center(n),dx=toward.x-c.x,dy=toward.y-c.y;if(n.type==='circle'){const rx=n.w/2,ry=n.h/2,k=1/Math.sqrt((dx*dx)/(rx*rx)+(dy*dy)/(ry*ry)||1);return{x:c.x+dx*k,y:c.y+dy*k};}const sx=Math.abs(dx)/(n.w/2||1),sy=Math.abs(dy)/(n.h/2||1),k=1/Math.max(sx,sy,1);return{x:c.x+dx*k,y:c.y+dy*k};}

  function renderCanvas(){ensureData();renderPage();renderNodes();renderStrokes();renderConnectors();renderTransform();renderSelection();}
  function renderPage(){const page=document.getElementById('tsPage'),world=document.getElementById('tsWorld');if(!page||!world)return;world.style.width=data.page.width+'px';world.style.height=data.page.height+'px';page.style.width=data.page.width+'px';page.style.height=data.page.height+'px';page.style.backgroundColor=data.page.background;page.style.backgroundImage=data.page.grid?`radial-gradient(#cbd5e1 1px, transparent 1px)`:'none';page.style.backgroundSize=`${data.page.gridSize}px ${data.page.gridSize}px`;document.getElementById('gridBtn')?.classList.toggle('bg-gray-950',!!data.page.grid);document.getElementById('gridBtn')?.classList.toggle('text-white',!!data.page.grid);}

  function renderNodes(){const layer=document.getElementById('tsNodes');if(!layer)return;layer.innerHTML=data.nodes.map(nodeHtml).join('');layer.querySelectorAll('[data-node]').forEach(el=>{el.onpointerdown=nodePointerDown;el.ondblclick=e=>{e.stopPropagation();editNodeText(el.dataset.node,true);};el.onclick=e=>nodeClick(e,el.dataset.node);});}

  function nodeHtml(n){const rotate=n.rotate||0,common=`left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;transform:rotate(${rotate}deg);`;let shape='';if(n.type==='diamond')shape=`<div class="absolute inset-[12%]" style="background:${n.fill};border:${n.strokeWidth}px solid ${n.stroke};transform:rotate(45deg);border-radius:10px"></div>`;else if(n.type==='circle')shape=`<div class="absolute inset-0 rounded-full" style="background:${n.fill};border:${n.strokeWidth}px solid ${n.stroke}"></div>`;else if(n.type==='frame')shape=`<div class="absolute inset-0 rounded-2xl border-2 border-dashed" style="border-color:${n.stroke};background:${hexAlpha(n.fill,.03)}"></div><div class="absolute -top-6 left-0 text-xs font-semibold text-gray-400">${esc(n.text||'Frame')}</div>`;else if(n.type==='text')shape='';else if(n.type==='image')shape=`<img src="${esc(n.src||'')}" class="absolute inset-0 w-full h-full object-contain rounded-xl" draggable="false">`;else shape=`<div class="absolute inset-0" style="background:${n.fill};border:${n.strokeWidth}px solid ${n.stroke};border-radius:${n.type==='sticky'?18:(n.radius||16)}px;box-shadow:${n.type==='sticky'?'0 8px 20px rgba(15,23,42,.08)':'0 4px 12px rgba(15,23,42,.05)'}"></div>`;const txt=n.type==='image'||n.type==='frame'?'':`<div data-text="${n.id}" class="absolute inset-0 flex items-center justify-center text-center px-3 py-2 outline-none overflow-hidden whitespace-pre-wrap" style="color:${n.textColor};font-size:${n.fontSize}px;font-weight:${n.bold?700:500};font-style:${n.italic?'italic':'normal'}">${esc(n.text)}</div>`;return `<div data-node="${n.id}" class="absolute select-none group" style="${common}">${shape}${txt}<div class="tsSelectRing pointer-events-none absolute -inset-1 rounded-[18px] border-2 border-accent opacity-0"></div></div>`;}

  function hexAlpha(hex,alpha){if(!/^#[0-9a-f]{6}$/i.test(hex||''))return `rgba(255,255,255,${alpha})`;const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${alpha})`;}
  function renderNodePosition(n){const el=document.querySelector(`[data-node="${CSS.escape(n.id)}"]`);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px';}}
  function renderSelection(){document.querySelectorAll('.tsSelectRing').forEach(x=>x.style.opacity='0');if(selected){document.querySelector(`[data-node="${CSS.escape(selected)}"] .tsSelectRing`)?.style.setProperty('opacity','1');showInspector();}else hideInspector();}

  function nodePointerDown(e){if(!canEdit())return;if(keySpace||tool==='hand')return;e.stopPropagation();const id=e.currentTarget.dataset.node;if(tool==='connector')return;selected=id;renderSelection();if(tool==='select'){const n=getNode(id),p=screenToWorld(e.clientX,e.clientY);drag={id,px:p.x,py:p.y,x:n.x,y:n.y};e.currentTarget.setPointerCapture?.(e.pointerId);}}
  function nodeClick(e,id){e.stopPropagation();selected=id;if(tool==='connector'){if(!connectFrom){connectFrom=id;document.querySelector(`[data-node="${CSS.escape(id)}"] .tsSelectRing`)?.style.setProperty('opacity','1');toast('Choose the destination shape');}else if(connectFrom!==id){const exists=data.connectors.some(c=>c.from===connectFrom&&c.to===id);if(!exists)data.connectors.push({id:uid(),from:connectFrom,to:id,color:'#64748B',width:2,arrow:true,style:'curve'});connectFrom=null;snapshot();renderConnectors();scheduleSave();toast('Connected');}}else renderSelection();}

  function editNodeText(id,selectAll=false){const n=getNode(id),el=document.querySelector(`[data-text="${CSS.escape(id)}"]`);if(!n||!el||!canEdit())return;el.contentEditable='true';el.classList.add('select-text');el.focus();if(selectAll){const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);}const finish=()=>{n.text=el.innerText.replace(/\n+$/,'');el.contentEditable='false';el.classList.remove('select-text');snapshot();scheduleSave();};el.onblur=finish;el.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();el.blur();}e.stopPropagation();};}

  function deleteSelected(){if(!selected||!canEdit())return;data.nodes=data.nodes.filter(n=>n.id!==selected);data.connectors=data.connectors.filter(c=>c.from!==selected&&c.to!==selected);selected=null;snapshot();renderCanvas();scheduleSave();}

  function showInspector(){const n=getNode(selected),el=document.getElementById('toolOptions');if(!n||!el||!canEdit())return;el.innerHTML=`<div class="flex items-center gap-2"><button id="editTxt" class="h-9 px-3 border rounded-lg text-xs font-semibold"><i class="fas fa-pen mr-1"></i>Edit text</button><input id="fillColor" type="color" value="${n.fill||'#ffffff'}" class="w-9 h-9 p-1 border rounded-lg"><input id="strokeColor" type="color" value="${n.stroke||'#cbd5e1'}" class="w-9 h-9 p-1 border rounded-lg"><input id="textColor" type="color" value="${n.textColor||'#111827'}" class="w-9 h-9 p-1 border rounded-lg"><button id="boldBtn" class="w-9 h-9 border rounded-lg font-bold ${n.bold?'bg-gray-950 text-white':''}">B</button><button id="delNode" class="w-9 h-9 border rounded-lg text-red-500"><i class="fas fa-trash"></i></button></div>`;el.classList.remove('hidden');document.getElementById('editTxt').onclick=()=>editNodeText(n.id,true);document.getElementById('fillColor').oninput=e=>{n.fill=e.target.value;renderNodes();renderSelection();scheduleSave();};document.getElementById('strokeColor').oninput=e=>{n.stroke=e.target.value;renderNodes();renderSelection();scheduleSave();};document.getElementById('textColor').oninput=e=>{n.textColor=e.target.value;renderNodes();renderSelection();scheduleSave();};document.getElementById('boldBtn').onclick=()=>{n.bold=!n.bold;renderNodes();renderSelection();scheduleSave();};document.getElementById('delNode').onclick=deleteSelected;}
  function hideInspector(){const el=document.getElementById('toolOptions');if(!el)return;if(!['pen','marker'].includes(tool))el.classList.add('hidden');}

  function renderConnectors(){const svg=document.getElementById('tsLines');if(!svg)return;const defs=`<defs><marker id="tsArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="context-stroke"/></marker></defs>`;svg.innerHTML=defs+data.connectors.map(c=>{const a=getNode(c.from),b=getNode(c.to);if(!a||!b)return '';const ca=center(a),cb=center(b),p1=edgePoint(a,cb),p2=edgePoint(b,ca),dx=Math.abs(p2.x-p1.x);const c1x=p1.x+(p2.x>=p1.x?Math.max(50,dx*.35):-Math.max(50,dx*.35)),c2x=p2.x-(p2.x>=p1.x?Math.max(50,dx*.35):-Math.max(50,dx*.35));const d=c.style==='straight'?`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`:`M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${c2x} ${p2.y}, ${p2.x} ${p2.y}`;return `<path d="${d}" fill="none" stroke="${esc(c.color||'#64748B')}" stroke-width="${c.width||2}" stroke-linecap="round" marker-end="${c.arrow===false?'':'url(#tsArrow)'}"/>`;}).join('');}

  function renderStrokes(){const svg=document.getElementById('tsStrokes');if(!svg)return;svg.innerHTML=data.strokes.map(s=>`<polyline points="${(s.points||[]).map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${esc(s.color||'#111827')}" stroke-width="${s.width||3}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.opacity??1}"/>`).join('');}

  function screenToWorld(cx,cy){const wrap=document.getElementById('tsCanvasWrap').getBoundingClientRect(),z=data.viewport.zoom;return{x:(cx-wrap.left-data.viewport.x)/z,y:(cy-wrap.top-data.viewport.y)/z};}
  function renderTransform(){const world=document.getElementById('tsWorld');if(!world)return;world.style.transform=`translate(${data.viewport.x}px,${data.viewport.y}px) scale(${data.viewport.zoom})`;document.getElementById('zoomLabel').textContent=Math.round(data.viewport.zoom*100)+'%';}
  function zoomBy(f){const wrap=document.getElementById('tsCanvasWrap').getBoundingClientRect();zoomAt(f,wrap.left+wrap.width/2,wrap.top+wrap.height/2);}
  function zoomAt(f,cx,cy){const before=screenToWorld(cx,cy),old=data.viewport.zoom;data.viewport.zoom=clamp(old*f,.15,4);const wrap=document.getElementById('tsCanvasWrap').getBoundingClientRect();data.viewport.x=cx-wrap.left-before.x*data.viewport.zoom;data.viewport.y=cy-wrap.top-before.y*data.viewport.zoom;renderTransform();scheduleSave();}
  function fitPage(){requestAnimationFrame(()=>{const wrap=document.getElementById('tsCanvasWrap');if(!wrap)return;const r=wrap.getBoundingClientRect(),pad=70,z=clamp(Math.min((r.width-pad*2)/data.page.width,(r.height-pad*2)/data.page.height),.15,1.25);data.viewport.zoom=z;data.viewport.x=(r.width-data.page.width*z)/2;data.viewport.y=(r.height-data.page.height*z)/2;renderTransform();});}

  async function handleImage(e){const file=e.target.files?.[0];if(!file)return;if(file.size>4*1024*1024)return alert('Image too large. Max 4 MB.');const reader=new FileReader();reader.onload=ev=>{const n=makeNode('image',data.page.width/2-180,data.page.height/2-120,360,240,'');n.src=ev.target.result;data.nodes.push(n);selected=n.id;snapshot();renderCanvas();scheduleSave();setTool('select');};reader.readAsDataURL(file);e.target.value='';}

  function scheduleSave(titleToo=false){if(!board||!canEdit())return;const st=document.getElementById('saveState');if(st)st.textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveNow(titleToo),550);}
  async function saveNow(){if(!board||!canEdit())return;const title=(document.getElementById('boardTitle')?.value||board.title||'Untitled Board').trim()||'Untitled Board';const {error}=await supabaseClient.from('thinkspace_boards').update({title,board_data:data,updated_at:new Date().toISOString()}).eq('id',board.id);if(error){console.error(error);toast('Could not save','error');return;}board.title=title;board.board_data=structuredClone(data);board.updated_at=new Date().toISOString();const st=document.getElementById('saveState');if(st)st.textContent='Saved';}

  function updateShareButtons(){document.querySelectorAll('.visBtn').forEach(b=>{const on=b.dataset.vis===board.visibility;b.classList.toggle('bg-gray-950',on);b.classList.toggle('text-white',on);});}
  async function saveShare(){const modal=document.getElementById('shareModal'),active=modal.querySelector('.visBtn.bg-gray-950')?.dataset.vis||board.visibility;const coll=[],view=[];modal.querySelectorAll('[data-share]').forEach(s=>{if(s.value==='edit')coll.push(s.dataset.share);if(s.value==='view')view.push(s.dataset.share);});const {error}=await supabaseClient.from('thinkspace_boards').update({visibility:active,collaborator_ids:coll,viewer_ids:view}).eq('id',board.id);if(error)return alert(error.message);board.visibility=active;board.collaborator_ids=coll;board.viewer_ids=view;document.getElementById('shareModal').classList.add('hidden');toast('Sharing updated');}

  async function loadComments(){if(!board)return;const {data:rows=[]}=await supabaseClient.from('thinkspace_comments').select('*').eq('board_id',board.id).order('created_at',{ascending:true});const list=document.getElementById('commentsList');if(!list)return;list.innerHTML=rows.map(c=>`<div class="rounded-2xl bg-gray-50 p-3"><div class="flex items-center gap-2">${avatar(c.author_id,26)}<span class="text-xs font-semibold">${esc(pname(c.author_id))}</span></div><div class="text-sm mt-2 text-gray-700">${esc(c.body)}</div><div class="text-[10px] text-gray-400 mt-2">${new Date(c.created_at).toLocaleString()}</div></div>`).join('')||'<div class="text-sm text-gray-400 text-center py-8">No comments yet.</div>';}
  async function postComment(e){e.preventDefault();const input=document.getElementById('commentInput'),body=input.value.trim();if(!body)return;const {error}=await supabaseClient.from('thinkspace_comments').insert({board_id:board.id,author_id:cid(),body,node_id:selected||null});if(error)return alert(error.message);input.value='';await loadComments();}

  function exportMenu(){const choice=prompt('Export board as:\n1 = PNG\n2 = PDF','1');if(choice==='1')exportPNG();else if(choice==='2')exportPDF();}
  async function exportPNG(){const page=document.getElementById('tsPage');if(!window.html2canvas)return alert('Export library is still loading.');const old=data.viewport.zoom;const canvas=await html2canvas(page,{backgroundColor:data.page.background,scale:Math.min(2,2400/Math.max(data.page.width,data.page.height)),useCORS:true});const a=document.createElement('a');a.download=(board.title||'thinkspace')+'.png';a.href=canvas.toDataURL('image/png');a.click();data.viewport.zoom=old;}
  async function exportPDF(){const page=document.getElementById('tsPage');if(!window.html2canvas||!window.jspdf)return alert('Export library is still loading.');const canvas=await html2canvas(page,{backgroundColor:data.page.background,scale:1.4,useCORS:true});const {jsPDF}=window.jspdf;const landscape=data.page.width>=data.page.height,pdf=new jsPDF({orientation:landscape?'landscape':'portrait',unit:'px',format:[data.page.width,data.page.height]});pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,data.page.width,data.page.height);pdf.save((board.title||'thinkspace')+'.pdf');}

  function toast(msg,type='ok'){let el=document.getElementById('tsToast');if(!el){el=document.createElement('div');el.id='tsToast';el.className='fixed bottom-6 right-6 z-[120] px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white transition';document.body.appendChild(el);}el.textContent=msg;el.style.background=type==='error'?'#DC2626':'#111827';el.style.opacity='1';clearTimeout(el._t);el._t=setTimeout(()=>el.style.opacity='0',1800);}

  return { open };
})();

// Thinkspace router hook
const _thinkspaceShowView = window.showView;
window.showView = function(viewName){
  _thinkspaceShowView(viewName);
  if(viewName === 'thinkspace' && window.ThinkspaceApp) ThinkspaceApp.open();
};
