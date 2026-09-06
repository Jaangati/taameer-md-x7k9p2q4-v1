// ---------- Team Updates / Notifications ----------
let teamUpdates = [];
let teamUpdateReads = new Map();
let teamDirectory = [];
let teamUpdateFilter = 'all';
let teamUpdatesChannel = null;

function notificationUserName(id){
  const p = teamDirectory.find(x => String(x.id) === String(id));
  return p?.full_name || (String(id) === String(state.currentUser?.id) ? state.currentUser.fullName : 'Team member');
}

function ensureNotificationUI(){
  if (!document.getElementById('view-notifications')) {
    const anchor = document.getElementById('view-settings');
    const parent = anchor?.parentElement;
    if (parent) {
      const section = document.createElement('section');
      section.id = 'view-notifications';
      section.className = 'view-section hidden overflow-y-auto p-6';
      section.innerHTML = `
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center justify-between gap-4 flex-wrap mb-5">
            <div><h2 class="text-2xl font-bold text-gray-900 dark:text-white">Team Updates</h2><p class="text-sm text-gray-500 mt-1">Quick updates that help everyone stay aligned.</p></div>
            <button onclick="openTeamUpdateComposer()" class="btn-primary"><i class="fas fa-plus mr-2"></i>New Update</button>
          </div>
          <div class="flex gap-2 flex-wrap mb-5" id="teamUpdateFilters">
            <button onclick="setTeamUpdateFilter('all')" data-filter="all" class="btn-secondary text-xs">All</button>
            <button onclick="setTeamUpdateFilter('unread')" data-filter="unread" class="btn-secondary text-xs">Unread</button>
            <button onclick="setTeamUpdateFilter('important')" data-filter="important" class="btn-secondary text-xs">Important</button>
            <button onclick="setTeamUpdateFilter('pinned')" data-filter="pinned" class="btn-secondary text-xs">Pinned</button>
          </div>
          <div id="teamUpdatesFeed" class="space-y-3"></div>
        </div>`;
      parent.appendChild(section);
    }
  }

  if (!document.getElementById('teamUpdateComposer')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="teamUpdateComposer">
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800 fade-in">
          <div class="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800"><div><h3 class="text-xl font-bold text-gray-900 dark:text-white">Share an Update</h3><p class="text-xs text-gray-500 mt-1">Keep it quick and useful.</p></div><button onclick="closeTeamUpdateComposer()" class="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><i class="fas fa-times"></i></button></div>
          <form id="teamUpdateForm" class="p-5 space-y-4">
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To</label><select id="tuAudience" class="input-field" onchange="toggleSelectedRecipients()"><option value="team">Everyone</option><option value="selected">Selected people</option></select></div>
            <div id="tuRecipientsWrap" class="hidden"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">People</label><div id="tuRecipients" class="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"></div></div>
            <div class="grid grid-cols-2 gap-3"><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label><select id="tuCategory" class="input-field"><option value="update">Update</option><option value="file_update">File Update</option><option value="action_required">Action Required</option><option value="approval">Approval</option><option value="deadline">Deadline</option><option value="announcement">Announcement</option></select></div><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label><select id="tuPriority" class="input-field"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></div></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label><input id="tuTitle" class="input-field" maxlength="140" required placeholder="e.g. Valencia brochure updated"></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message</label><textarea id="tuMessage" class="input-field" rows="4" maxlength="3000" required placeholder="What changed or what should the team know?"></textarea></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Link <span class="text-xs text-gray-400">(optional)</span></label><input id="tuLink" type="url" class="input-field" placeholder="https://..."></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attachment <span class="text-xs text-gray-400">(optional, max 10 MB)</span></label><input id="tuAttachment" type="file" class="input-field"></div>
            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input id="tuAck" type="checkbox" class="rounded border-gray-300"> Ask people to confirm they saw it</label>
            <div class="flex gap-3 pt-2"><button type="button" onclick="closeTeamUpdateComposer()" class="btn-secondary flex-1">Cancel</button><button type="submit" class="btn-primary flex-1">Post Update</button></div>
          </form>
        </div>
      </div>
      <div class="modal-overlay" id="teamUpdateDetail"><div id="teamUpdateDetailCard" class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800 fade-in"></div></div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('teamUpdateForm')?.addEventListener('submit', publishTeamUpdate);
  }
}

async function loadTeamDirectory(){
  const {data,error} = await supabaseClient.rpc('team_directory');
  if (!error) teamDirectory = data || [];
}

async function loadTeamUpdates(){
  if (!state.currentUser) return;
  ensureNotificationUI();
  const [{data:updates,error:uErr},{data:reads,error:rErr}] = await Promise.all([
    supabaseClient.from('notifications').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(200),
    supabaseClient.from('notification_reads').select('notification_id,read_at,acknowledged_at').eq('user_id',state.currentUser.id)
  ]);
  if (uErr) { console.error(uErr); return; }
  teamUpdates = updates || [];
  teamUpdateReads = new Map((rErr ? [] : reads || []).map(r => [r.notification_id,r]));
  renderTeamUpdates();
  updateNotificationBadge();
}

function updateNotificationBadge(){
  const bell = document.querySelector('i.fa-bell')?.closest('button');
  if (!bell) return;
  bell.onclick = () => showView('notifications');
  bell.title = 'Team Updates';
  bell.style.position = 'relative';
  const oldDots = bell.querySelectorAll('span');
  oldDots.forEach(x => x.remove());
  const count = teamUpdates.filter(n => !teamUpdateReads.has(n.id) && String(n.sender_id) !== String(state.currentUser?.id)).length;
  if (count) {
    const badge = document.createElement('span');
    badge.id = 'notificationUnreadBadge';
    badge.className = 'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold';
    badge.textContent = count > 99 ? '99+' : String(count);
    bell.appendChild(badge);
  }
}

function setTeamUpdateFilter(filter){ teamUpdateFilter = filter; renderTeamUpdates(); }
function updateCategoryLabel(c){ return ({update:'Update',file_update:'File Update',action_required:'Action Required',approval:'Approval',deadline:'Deadline',announcement:'Announcement'})[c] || 'Update'; }

function renderTeamUpdates(){
  const feed = document.getElementById('teamUpdatesFeed');
  if (!feed) return;
  document.querySelectorAll('#teamUpdateFilters [data-filter]').forEach(b => b.classList.toggle('ring-2', b.dataset.filter === teamUpdateFilter));
  let rows = [...teamUpdates];
  if (teamUpdateFilter === 'unread') rows = rows.filter(n => !teamUpdateReads.has(n.id));
  if (teamUpdateFilter === 'important') rows = rows.filter(n => n.priority === 'important' || n.priority === 'urgent');
  if (teamUpdateFilter === 'pinned') rows = rows.filter(n => n.pinned);
  if (!rows.length) { feed.innerHTML = '<div class="p-10 text-center text-sm text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">Nothing here yet.</div>'; return; }
  feed.innerHTML = rows.map(n => {
    const unread = !teamUpdateReads.has(n.id) && String(n.sender_id) !== String(state.currentUser?.id);
    const priority = n.priority === 'urgent' ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : n.priority === 'important' ? 'text-amber-700 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-600 bg-gray-100 dark:bg-gray-800';
    return `<button onclick="openTeamUpdate('${n.id}')" class="w-full text-left p-5 bg-white dark:bg-gray-900 border ${unread?'border-[var(--accent)]':'border-gray-200 dark:border-gray-800'} rounded-2xl hover:shadow-sm transition-all">
      <div class="flex gap-4"><div class="mt-1 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 text-gray-500"><i class="fas ${n.category==='file_update'?'fa-file-arrow-up':n.category==='action_required'?'fa-circle-exclamation':n.category==='announcement'?'fa-bullhorn':'fa-bell'}"></i></div>
      <div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-3"><div><div class="flex items-center gap-2 flex-wrap"><span class="font-semibold text-gray-900 dark:text-white">${Utils.escapeHTML(n.title)}</span>${unread?'<span class="w-2 h-2 rounded-full bg-[var(--accent)]"></span>':''}${n.pinned?'<i class="fas fa-thumbtack text-xs text-gray-400"></i>':''}</div><div class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(notificationUserName(n.sender_id))} · ${new Date(n.created_at).toLocaleString()}</div></div><span class="badge ${priority}">${Utils.escapeHTML(n.priority)}</span></div>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">${Utils.escapeHTML(n.message)}</p><div class="flex gap-3 mt-3 text-xs text-gray-400"><span>${Utils.escapeHTML(updateCategoryLabel(n.category))}</span><span>${n.audience==='team'?'Everyone':'Selected people'}</span>${n.link_url?'<span><i class="fas fa-link mr-1"></i>Link</span>':''}${n.attachment_path?'<span><i class="fas fa-paperclip mr-1"></i>File</span>':''}${n.require_ack?'<span><i class="fas fa-check-double mr-1"></i>Confirm</span>':''}</div></div></div></button>`;
  }).join('');
}

async function openTeamUpdateComposer(){
  ensureNotificationUI();
  if (!teamDirectory.length) await loadTeamDirectory();
  const box = document.getElementById('tuRecipients');
  box.innerHTML = teamDirectory.filter(p => String(p.id)!==String(state.currentUser.id)).map(p => `<label class="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-900"><input class="tuRecipient rounded" type="checkbox" value="${p.id}"><span class="text-sm text-gray-700 dark:text-gray-300">${Utils.escapeHTML(p.full_name || 'Team member')}</span></label>`).join('');
  document.getElementById('teamUpdateForm').reset();
  toggleSelectedRecipients();
  document.getElementById('teamUpdateComposer').classList.add('show');
}
function closeTeamUpdateComposer(){ document.getElementById('teamUpdateComposer')?.classList.remove('show'); }
function toggleSelectedRecipients(){ document.getElementById('tuRecipientsWrap')?.classList.toggle('hidden', document.getElementById('tuAudience')?.value !== 'selected'); }

async function publishTeamUpdate(e){
  e.preventDefault();
  const submit = e.target.querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Posting…';
  let uploadedPath = null;
  try {
    const audience = document.getElementById('tuAudience').value;
    const recipients = [...document.querySelectorAll('.tuRecipient:checked')].map(x => x.value);
    if (audience === 'selected' && !recipients.length) throw new Error('Choose at least one person.');
    const file = document.getElementById('tuAttachment').files[0];
    let attachmentName = null;
    if (file) {
      if (file.size > 10 * 1024 * 1024) throw new Error('Attachment must be 10 MB or smaller.');
      attachmentName = file.name;
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      uploadedPath = `${state.currentUser.id}/${crypto.randomUUID()}-${safe}`;
      const {error} = await supabaseClient.storage.from('notification-attachments').upload(uploadedPath,file,{upsert:false});
      if (error) throw error;
    }
    const row = { sender_id:state.currentUser.id, title:document.getElementById('tuTitle').value.trim(), message:document.getElementById('tuMessage').value.trim(), category:document.getElementById('tuCategory').value, priority:document.getElementById('tuPriority').value, audience, link_url:document.getElementById('tuLink').value.trim() || null, attachment_name:attachmentName, attachment_path:uploadedPath, require_ack:document.getElementById('tuAck').checked };
    const {data,error} = await supabaseClient.from('notifications').insert(row).select('id').single();
    if (error) throw error;
    if (audience === 'selected') {
      const {error:rErr} = await supabaseClient.from('notification_recipients').insert(recipients.map(user_id => ({notification_id:data.id,user_id})));
      if (rErr) throw rErr;
    }
    if (typeof recordActivity === 'function') recordActivity('notification_published','notification',data.id,{title:row.title,audience:row.audience,category:row.category,priority:row.priority});
    closeTeamUpdateComposer();
    await loadTeamUpdates();
  } catch(err) {
    if (uploadedPath) await supabaseClient.storage.from('notification-attachments').remove([uploadedPath]);
    alert(err?.message || 'Could not post update.');
  } finally { submit.disabled = false; submit.textContent = 'Post Update'; }
}

async function markTeamUpdateRead(id, acknowledge=false){
  const now = new Date().toISOString();
  const existing = teamUpdateReads.get(id);
  const payload = {notification_id:id,user_id:state.currentUser.id,read_at:existing?.read_at || now,acknowledged_at:acknowledge ? now : (existing?.acknowledged_at || null)};
  const {error} = await supabaseClient.from('notification_reads').upsert(payload,{onConflict:'notification_id,user_id'});
  if (!error) { teamUpdateReads.set(id,payload); updateNotificationBadge(); renderTeamUpdates(); }
}

async function openTeamUpdate(id){
  const n = teamUpdates.find(x => x.id === id); if (!n) return;
  await markTeamUpdateRead(id,false);
  const card = document.getElementById('teamUpdateDetailCard');
  const currentRead = teamUpdateReads.get(id);
  card.innerHTML = `<div class="p-6 border-b border-gray-200 dark:border-gray-800"><div class="flex items-start justify-between gap-4"><div><div class="flex gap-2 flex-wrap mb-2"><span class="badge bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">${Utils.escapeHTML(updateCategoryLabel(n.category))}</span>${n.priority!=='normal'?`<span class="badge ${n.priority==='urgent'?'bg-red-50 text-red-600':'bg-amber-50 text-amber-700'}">${Utils.escapeHTML(n.priority)}</span>`:''}${n.pinned?'<span class="badge bg-gray-100 text-gray-600"><i class="fas fa-thumbtack mr-1"></i>Pinned</span>':''}</div><h3 class="text-xl font-bold text-gray-900 dark:text-white">${Utils.escapeHTML(n.title)}</h3><p class="text-xs text-gray-500 mt-2">${Utils.escapeHTML(notificationUserName(n.sender_id))} · ${new Date(n.created_at).toLocaleString()}</p></div><button onclick="closeTeamUpdateDetail()" class="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><i class="fas fa-times"></i></button></div></div>
    <div class="p-6"><p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${Utils.escapeHTML(n.message)}</p><div class="flex gap-2 flex-wrap mt-5">${n.link_url?`<button onclick="window.open('${Utils.escapeHTML(n.link_url)}','_blank','noopener')" class="btn-secondary"><i class="fas fa-link mr-2"></i>Open Link</button>`:''}${n.attachment_path?`<button onclick="openTeamUpdateAttachment('${n.id}')" class="btn-secondary"><i class="fas fa-paperclip mr-2"></i>${Utils.escapeHTML(n.attachment_name || 'Attachment')}</button>`:''}${n.require_ack && !currentRead?.acknowledged_at?`<button onclick="acknowledgeTeamUpdate('${n.id}')" class="btn-primary"><i class="fas fa-check mr-2"></i>Got it</button>`:''}</div>
    <div id="teamUpdateSeen" class="text-xs text-gray-400 mt-4"></div>
    <div class="mt-7 pt-5 border-t border-gray-200 dark:border-gray-800"><div class="font-semibold text-sm text-gray-900 dark:text-white mb-3">Replies</div><div id="teamUpdateReplies" class="space-y-3 mb-4"></div><form onsubmit="replyToTeamUpdate(event,'${n.id}')" class="flex gap-2"><input id="teamUpdateReplyInput" class="input-field flex-1" maxlength="1000" placeholder="Reply…"><button class="btn-primary" type="submit">Send</button></form></div>
    ${(String(n.sender_id)===String(state.currentUser.id)||state.currentUser.role==='admin')?`<div class="mt-6 pt-5 border-t border-gray-200 dark:border-gray-800 flex gap-2"><button onclick="toggleTeamUpdatePin('${n.id}',${!n.pinned})" class="btn-secondary text-xs"><i class="fas fa-thumbtack mr-1"></i>${n.pinned?'Unpin':'Pin'}</button><button onclick="deleteTeamUpdate('${n.id}')" class="btn-secondary text-xs text-red-500"><i class="fas fa-trash mr-1"></i>Delete</button></div>`:''}</div>`;
  document.getElementById('teamUpdateDetail').classList.add('show');
  loadTeamUpdateReplies(id); loadTeamUpdateSeen(id,n);
}
function closeTeamUpdateDetail(){ document.getElementById('teamUpdateDetail')?.classList.remove('show'); }
async function acknowledgeTeamUpdate(id){ await markTeamUpdateRead(id,true); await openTeamUpdate(id); }
async function openTeamUpdateAttachment(id){ const n=teamUpdates.find(x=>x.id===id); if(!n?.attachment_path)return; const {data,error}=await supabaseClient.storage.from('notification-attachments').createSignedUrl(n.attachment_path,120); if(error)return alert('Could not open attachment.'); window.open(data.signedUrl,'_blank','noopener'); }

async function loadTeamUpdateReplies(id){
  const el=document.getElementById('teamUpdateReplies'); if(!el)return;
  const {data,error}=await supabaseClient.from('notification_replies').select('id,user_id,message,created_at').eq('notification_id',id).order('created_at',{ascending:true});
  if(error||!data?.length){el.innerHTML='<div class="text-xs text-gray-400">No replies yet.</div>';return;}
  el.innerHTML=data.map(r=>`<div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800"><div class="text-xs font-semibold text-gray-700 dark:text-gray-300">${Utils.escapeHTML(notificationUserName(r.user_id))} <span class="font-normal text-gray-400">· ${new Date(r.created_at).toLocaleString()}</span></div><div class="text-sm text-gray-600 dark:text-gray-400 mt-1">${Utils.escapeHTML(r.message)}</div></div>`).join('');
}
async function replyToTeamUpdate(e,id){ e.preventDefault(); const input=document.getElementById('teamUpdateReplyInput'); const message=input.value.trim(); if(!message)return; const {error}=await supabaseClient.from('notification_replies').insert({notification_id:id,user_id:state.currentUser.id,message}); if(error)return alert(error.message); input.value=''; await loadTeamUpdateReplies(id); }

async function loadTeamUpdateSeen(id,n){
  const el=document.getElementById('teamUpdateSeen'); if(!el)return;
  if(String(n.sender_id)!==String(state.currentUser.id) && state.currentUser.role!=='admin'){el.textContent=n.require_ack?'Confirmation requested.':'';return;}
  const {data}=await supabaseClient.from('notification_reads').select('user_id,acknowledged_at').eq('notification_id',id);
  const readCount=(data||[]).filter(x=>String(x.user_id)!==String(n.sender_id)).length;
  const ackCount=(data||[]).filter(x=>x.acknowledged_at && String(x.user_id)!==String(n.sender_id)).length;
  el.textContent=n.require_ack?`Seen by ${readCount} · Confirmed by ${ackCount}`:`Seen by ${readCount}`;
}
async function toggleTeamUpdatePin(id,pinned){ const {error}=await supabaseClient.from('notifications').update({pinned,updated_at:new Date().toISOString()}).eq('id',id); if(error)return alert(error.message); closeTeamUpdateDetail(); await loadTeamUpdates(); }
async function deleteTeamUpdate(id){ if(!confirm('Delete this update?'))return; const n=teamUpdates.find(x=>x.id===id); const {error}=await supabaseClient.from('notifications').delete().eq('id',id); if(error)return alert(error.message); if(n?.attachment_path) await supabaseClient.storage.from('notification-attachments').remove([n.attachment_path]); closeTeamUpdateDetail(); await loadTeamUpdates(); }

const _showViewBeforeNotifications = showView;
showView = function(viewName){
  if(viewName !== 'notifications') return _showViewBeforeNotifications(viewName);
  ensureNotificationUI();
  document.querySelectorAll('.view-section').forEach(el=>el.classList.add('hidden'));
  document.getElementById('view-notifications')?.classList.remove('hidden');
  document.getElementById('headerTitle').textContent='Team Updates';
  document.getElementById('headerSubtitle').textContent='Updates from your marketing team';
  closeUserDropdown();
  loadTeamUpdates();
};

async function initTeamUpdates(){
  if(!state.currentUser || !supabaseClient) return;
  ensureNotificationUI();
  await loadTeamDirectory();
  await loadTeamUpdates();
  if(teamUpdatesChannel) supabaseClient.removeChannel(teamUpdatesChannel);
  teamUpdatesChannel = supabaseClient.channel(`team-updates-${state.currentUser.id}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>loadTeamUpdates())
    .on('postgres_changes',{event:'*',schema:'public',table:'notification_reads'},()=>loadTeamUpdates())
    .on('postgres_changes',{event:'*',schema:'public',table:'notification_replies'},()=>{ const open=document.getElementById('teamUpdateDetail')?.classList.contains('show'); if(open){ const n=teamUpdates.find(x=>document.getElementById('teamUpdateDetailCard')?.innerHTML.includes(Utils.escapeHTML(x.title))); if(n)loadTeamUpdateReplies(n.id); } })
    .subscribe();
}

const _showDashboardBeforeTeamUpdates = showDashboard;
showDashboard = function(){ _showDashboardBeforeTeamUpdates(); setTimeout(initTeamUpdates,0); };
