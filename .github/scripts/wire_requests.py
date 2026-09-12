from pathlib import Path

# app.js: load Requests before auth/dashboard and start background reminders after auth
p=Path('js/app.js')
s=p.read_text(encoding='utf-8')
if 'loadRequestsModuleScript' not in s:
    s=s.replace('// ---------- Startup ----------', '''// ---------- Startup ----------\nasync function loadRequestsModuleScript(){\n  if(typeof RequestsApp !== 'undefined') return;\n  await new Promise((resolve,reject)=>{\n    const existing=document.querySelector('script[data-requests-module]');\n    if(existing){ existing.addEventListener('load',resolve,{once:true}); existing.addEventListener('error',reject,{once:true}); return; }\n    const script=document.createElement('script');\n    script.src='js/requests.js?v=20260912-v1';\n    script.dataset.requestsModule='true';\n    script.onload=resolve; script.onerror=reject;\n    document.head.appendChild(script);\n  });\n}\n''')
s=s.replace('  Store.normalize();\n  const restored = await checkAuth();', '  Store.normalize();\n  try { await loadRequestsModuleScript(); } catch (err) { console.error(\'Requests module failed to load\', err); }\n  const restored = await checkAuth();')
s=s.replace("  if (!restored) {\n    loadSystemAccent();", "  if (restored && typeof RequestsApp !== 'undefined') RequestsApp.open().catch(err=>console.warn('Requests background init failed',err));\n  if (!restored) {\n    loadSystemAccent();")
p.write_text(s,encoding='utf-8')

# ui.js: view title + module open hook
p=Path('js/ui.js')
s=p.read_text(encoding='utf-8')
s=s.replace("vault: ['Vault','Shared department memory and smart reference search'],", "vault: ['Vault','Shared department memory and smart reference search'], requests: ['Requests','Team requests, deadlines and accountability'],") if "vault: ['Vault'" in s else s
if "requests: ['Requests'" not in s:
    s=s.replace("thinkspace: ['Thinkspace','Visual brainstorming, diagrams and collaborative boards'],", "thinkspace: ['Thinkspace','Visual brainstorming, diagrams and collaborative boards'], requests: ['Requests','Team requests, deadlines and accountability'],")
s=s.replace("  if (viewName === 'vault' && typeof VaultApp !== 'undefined' && VaultApp?.open) VaultApp.open();", "  if (viewName === 'vault' && typeof VaultApp !== 'undefined' && VaultApp?.open) VaultApp.open();\n  if (viewName === 'requests' && typeof RequestsApp !== 'undefined' && RequestsApp?.open) RequestsApp.open();")
p.write_text(s,encoding='utf-8')

# requests.js: request alerts should open Requests, not Team Updates
p=Path('js/requests.js')
s=p.read_text(encoding='utf-8')
s=s.replace("    if(typeof announceNotification==='function')return announceNotification(title,body,id);", "    if(typeof playTeamNotificationSound==='function') playTeamNotificationSound();\n    if(typeof desktopNotificationsEnabled==='function' && desktopNotificationsEnabled() && 'Notification' in window && Notification.permission==='granted'){\n      try{const n=new Notification(title,{body,tag:`request-${id||Date.now()}`,renotify:true});n.onclick=()=>{window.focus();showView('requests');if(id)setTimeout(()=>openDetail(id),200);n.close();};setTimeout(()=>n.close(),9000);}catch(_){ }\n    }")
p.write_text(s,encoding='utf-8')
