from pathlib import Path
import re

p=Path('js/requests.js')
s=p.read_text(encoding='utf-8')

# Keep the module framed strictly as Requests, never as a task tracker.
s=s.replace('New Personal Task','New Request')
s=s.replace('Personal task','Personal request')
s=s.replace('personal task','personal request')
s=s.replace('Personal tasks','Requests')
s=s.replace('personal tasks','requests')
# Remove any remaining standalone Task/Tasks wording in this module.
s=re.sub(r'\bTasks\b','Requests',s)
s=re.sub(r'\bTask\b','Request',s)
s=re.sub(r'\btasks\b','requests',s)
s=re.sub(r'\btask\b','request',s)

# Clean the command subtitle if the older wording is still present.
s=s.replace('Requests, requests, deadlines and actions — without mixing them into Team Updates.','Clear requests, deadlines and accountability in one place.')
s=s.replace('Requests, personal requests, deadlines and actions — without mixing them into Team Updates.','Clear requests, deadlines and accountability in one place.')
s=s.replace('Clear requests, deadlines and accountability — without mixing them into Team Updates.','Clear requests, deadlines and accountability in one place.')

# Add a sixth summary card for Completed.
s=s.replace('grid-template-columns:repeat(5,minmax(0,1fr))','grid-template-columns:repeat(6,minmax(0,1fr))',1)
s=s.replace('.rq-stat.review .v{color:#7c3aed}', '.rq-stat.review .v{color:#7c3aed}.rq-stat.completed .v{color:#16a34a}',1)

attention="    const attentionCount=scoped.filter(r=>isOverdue(r)||pendingActionCount(r)>0).length;\n"
if attention in s and 'const completedCount=scoped.filter' not in s:
    s=s.replace(attention, attention+"    const completedCount=scoped.filter(r=>r.status==='closed').length;\n",1)

unread='''<div class="rq-stat ${unreadCount?'notify':''}" onclick="RequestsApp.setStatus('unread')"><div class="v"><i class="fas fa-bell text-sm mr-1"></i>${unreadCount}</div><div class="l">Unread activity</div></div>'''
completed='''<div class="rq-stat completed" onclick="RequestsApp.setStatus('closed')"><div class="v">${completedCount}</div><div class="l">Completed</div></div>'''
if completed not in s:
    if unread not in s: raise SystemExit('Unread summary card marker not found')
    s=s.replace(unread,completed+unread,1)

if re.search(r'\bTasks?\b',s,re.I):
    raise SystemExit('Standalone task wording still remains in js/requests.js')

p.write_text(s,encoding='utf-8')

# Cache-bust the Requests bundle.
idx=Path('index.html')
x=idx.read_text(encoding='utf-8')
x=re.sub(r'<script src="js/requests\.js(?:\?[^\"]*)?"></script>', '<script src="js/requests.js?v=20260912-v13"></script>', x, count=1)
idx.write_text(x,encoding='utf-8')

print('Requests v4 labels patch applied')
