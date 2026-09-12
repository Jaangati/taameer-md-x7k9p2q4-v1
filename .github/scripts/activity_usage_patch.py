from pathlib import Path
import re

ui=Path('js/ui.js')
s=ui.read_text(encoding='utf-8')
old="  const userModules = state.modules.filter(m => u.modules?.includes(m.id) && m.status !== 'disabled');"
new="  const moduleOrder = { calendar: 1, thinkspace: 2, vault: 3, requests: 4, projects: 5 };\n  const userModules = state.modules.filter(m => u.modules?.includes(m.id) && m.status !== 'disabled').sort((a,b) => (moduleOrder[a.id] || moduleOrder[a.viewId] || 99) - (moduleOrder[b.id] || moduleOrder[b.viewId] || 99));"
if old not in s:
    raise SystemExit('sidebar module marker not found')
s=s.replace(old,new,1)

old2="  const u=state.currentUser; const myModules=state.modules.filter(m=>u.modules?.includes(m.id));"
new2="  const u=state.currentUser; const moduleOrder={calendar:1,thinkspace:2,vault:3,requests:4,projects:5}; const myModules=state.modules.filter(m=>u.modules?.includes(m.id)).sort((a,b)=>(moduleOrder[a.id]||moduleOrder[a.viewId]||99)-(moduleOrder[b.id]||moduleOrder[b.viewId]||99));"
if old2 in s:
    s=s.replace(old2,new2,1)
ui.write_text(s,encoding='utf-8')

idx=Path('index.html')
x=idx.read_text(encoding='utf-8')
x=re.sub(r'<script src="js/activity-log\.js(?:\?[^\"]*)?"></script>', '<script src="js/activity-log.js?v=20260912-v2"></script>', x, count=1)
x=re.sub(r'<script src="js/ui\.js(?:\?[^\"]*)?"></script>', '<script src="js/ui.js?v=20260912-order2"></script>', x, count=1)
idx.write_text(x,encoding='utf-8')
print('activity usage patch applied')
