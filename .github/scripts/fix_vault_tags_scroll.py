from pathlib import Path
import re

p = Path('js/vault.js')
s = p.read_text()

# 1) Make tags user-editable while keeping smart suggestions helpful.
s = s.replace(
    '<div><div class="vault-field-label">Extra tags</div><input id="veTags" class="meta" value="${esc((x?.tags||[]).join(\', \'))}" placeholder="e.g. campaign, supplier"></div>',
    '<div><div class="vault-field-label">Tags</div><input id="veTags" class="meta" value="${esc((x?.tags||[]).join(\', \'))}" placeholder="Smart tags appear here — edit freely"></div>'
)

old = """    let selectedColor=startColor;const title=document.getElementById('veTitle'),body=document.getElementById('veBody'),type=document.getElementById('veType'),suggest=document.getElementById('veSuggested');
    const refreshTags=()=>{const arr=autoTags(title.value,body.value,type.value);suggest.innerHTML=arr.length?arr.map(t=>`<span>#${esc(t)}</span>`).join(''):'<span>Start typing…</span>';suggest.dataset.tags=arr.join(',')};[title,body,type].forEach(el=>el.addEventListener('input',refreshTags));refreshTags();
"""
new = """    let selectedColor=startColor;const title=document.getElementById('veTitle'),body=document.getElementById('veBody'),type=document.getElementById('veType'),suggest=document.getElementById('veSuggested'),tagsInput=document.getElementById('veTags');
    let tagsTouched=!!id;
    const readTags=()=>tagsInput.value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean);
    const writeTags=arr=>{tagsInput.value=[...new Set(arr)].join(', ')};
    const refreshTags=()=>{
      const arr=autoTags(title.value,body.value,type.value);
      if(!tagsTouched&&!id) writeTags(arr);
      const current=new Set(readTags());
      suggest.innerHTML=arr.length?arr.map(t=>`<button type=\"button\" data-smart-tag=\"${esc(t)}\" class=\"${current.has(t)?'active':''}\">${current.has(t)?'✓':'+'} #${esc(t)}</button>`).join(''):'<span>Start typing…</span>';
      suggest.querySelectorAll('[data-smart-tag]').forEach(btn=>btn.onclick=()=>{
        tagsTouched=true;
        const tag=btn.dataset.smartTag, vals=readTags(), set=new Set(vals);
        set.has(tag)?set.delete(tag):set.add(tag);
        writeTags([...set]);
        refreshTags();
      });
    };
    tagsInput.addEventListener('input',()=>{tagsTouched=true;refreshTags()});
    [title,body,type].forEach(el=>el.addEventListener('input',refreshTags));refreshTags();
"""
if old not in s:
    raise SystemExit('tag refresh block not found')
s = s.replace(old, new, 1)

old = """    const title=document.getElementById('veTitle').value.trim(),body=document.getElementById('veBody').value.trim();if(!body&&!title)return toast('Add something first');const type=document.getElementById('veType').value;const manual=document.getElementById('veTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean),smart=(document.getElementById('veSuggested').dataset.tags||'').split(',').filter(Boolean),tags=[...new Set([...smart,...manual])].slice(0,10);const payload={title:title||null,body:body||'',item_type:type,visibility:document.getElementById('veVisibility').value,tags,source_url:document.getElementById('veUrl').value.trim()||null,card_color:selectedColor,updated_by:me()};let res;if(id)res=await supabaseClient.from('vault_items').update(payload).eq('id',id).select('*').single();else res=await supabaseClient.from('vault_items').insert({...payload,created_by:me()}).select('*').single();if(res.error)return alert(res.error.message);if(id)items=items.map(i=>i.id===id?res.data:i);else items.unshift(res.data);d.remove();updateResults();toast('Saved to Vault');
"""
new = """    const title=document.getElementById('veTitle').value.trim(),body=document.getElementById('veBody').value.trim();if(!body&&!title)return toast('Add something first');const type=document.getElementById('veType').value;const tags=[...new Set(document.getElementById('veTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean))].slice(0,10);const payload={title:title||null,body:body||'',item_type:type,visibility:document.getElementById('veVisibility').value,tags,source_url:document.getElementById('veUrl').value.trim()||null,card_color:selectedColor,updated_by:me()};let res;if(id)res=await supabaseClient.from('vault_items').update(payload).eq('id',id).select('*').single();else res=await supabaseClient.from('vault_items').insert({...payload,created_by:me()}).select('*').single();if(res.error)return alert(res.error.message);if(id)items=items.map(i=>i.id===id?res.data:i);else items.unshift(res.data);d.remove();updateResults();toast('Saved to Vault');
"""
if old not in s:
    raise SystemExit('saveEditor block not found')
s = s.replace(old, new, 1)

# 2) Make smart-tag chips clearly interactive.
needle = ".vault-smart-tags .chips span{font-size:9px;padding:4px 6px;border-radius:7px;background:#eef1f5;color:#5f6876}"
repl = needle + ".vault-smart-tags .chips button{font-size:9px;padding:5px 7px;border-radius:8px;border:0;background:#eef1f5;color:#5f6876;cursor:pointer}.vault-smart-tags .chips button.active{background:var(--accent-soft);color:var(--accent);font-weight:800}"
if needle not in s:
    raise SystemExit('smart tag css marker not found')
s = s.replace(needle, repl, 1)

# 3) Rebuild long-note viewer as fixed-height reader with an internal scroll area.
start = s.find('  function openView(id){')
end = s.find('  function openActions', start)
if start < 0 or end < 0:
    raise SystemExit('openView markers not found')
new_view = r'''  function openView(id){
    const x=items.find(i=>i.id===id);if(!x)return;
    const can=x.created_by===me()||admin(),c=colorFor(x);
    const d=modal(`<div class="vault-reader" style="background:${c.bg};color:${c.ink}">
      <div class="vault-reader-head">
        <div class="min-w-0"><div class="text-[9px] uppercase tracking-[.14em] font-bold opacity-55"><i class="fas ${iconFor(x.item_type)} mr-2"></i>${labelFor(x.item_type)}</div><h3 class="text-2xl font-extrabold mt-2 break-words">${esc(x.title||'Untitled')}</h3></div>
        <button data-close class="w-9 h-9 rounded-xl bg-white/35 flex-none"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="vault-reader-scroll">
        <div class="vault-reader-content"><div class="text-[14px] leading-7 whitespace-pre-wrap break-words">${esc(x.body)}</div>${(x.tags||[]).length?`<div class="vault-tags mt-5">${x.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener" class="inline-flex mt-4 text-xs font-bold"><i class="fas fa-arrow-up-right-from-square mr-2"></i>Open source</a>`:''}</div>
      </div>
      <div class="vault-reader-foot"><div class="flex items-center gap-2 min-w-0">${avatarHtml(x.created_by)}<span class="text-xs opacity-65 truncate">Added by <b>${esc(pname(x.created_by))}</b></span></div><div class="flex gap-2 flex-none"><button id="vvCopy" class="px-3 py-2 rounded-xl bg-white/40 text-xs font-bold"><i class="fas fa-copy mr-2"></i>Copy</button>${can?'<button id="vvEdit" class="px-3 py-2 rounded-xl bg-gray-950 text-white text-xs font-bold"><i class="fas fa-pen mr-2"></i>Edit</button>':''}</div></div>
    </div>`);
    d.querySelector('[data-close]').onclick=()=>d.remove();
    document.getElementById('vvCopy').onclick=()=>{navigator.clipboard?.writeText([x.title,x.body,x.source_url].filter(Boolean).join('\n'));toast('Copied to clipboard')};
    document.getElementById('vvEdit')?.addEventListener('click',()=>{d.remove();openEditor(id)});
  }

'''
s = s[:start] + new_view + s[end:]

css_anchor = ".vault-ask-modal{width:min(820px,94vw);background:#fff;border-radius:26px;overflow:hidden;box-shadow:0 36px 120px rgba(3,7,18,.30)}"
reader_css = ".vault-reader{width:min(820px,94vw);height:min(86vh,900px);max-height:86vh;border-radius:26px;overflow:hidden;box-shadow:0 36px 120px rgba(3,7,18,.30);display:flex;flex-direction:column;min-height:0}.vault-reader-head{padding:22px 24px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex:none;border-bottom:1px solid rgba(17,24,39,.08)}.vault-reader-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}.vault-reader-content{padding:22px 24px 28px}.vault-reader-foot{padding:14px 24px;border-top:1px solid rgba(17,24,39,.09);display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;background:rgba(255,255,255,.16);backdrop-filter:blur(8px)}"
if css_anchor not in s:
    raise SystemExit('reader css anchor not found')
s = s.replace(css_anchor, reader_css + css_anchor, 1)

# Keep modal itself from clipping the reader on short screens.
s = s.replace("d.className='fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center p-5'", "d.className='fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden'")

p.write_text(s)
print('vault tags + reader patched')
