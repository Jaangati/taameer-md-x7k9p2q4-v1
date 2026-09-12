from pathlib import Path
import re

index = Path('index.html')
s = index.read_text(encoding='utf-8')
if 'src="js/requests.js' not in s:
    marker = '<script src="js/app.js?v=20260907-final"></script>'
    if marker not in s:
        marker = '<script src="js/app.js"></script>'
    if marker not in s:
        raise SystemExit('app.js script marker not found')
    s = s.replace(marker, '<script src="js/requests.js?v=20260912-v2"></script>\n' + marker, 1)
else:
    s = re.sub(r'<script src="js/requests\.js(?:\?[^\"]*)?"></script>', '<script src="js/requests.js?v=20260912-v2"></script>', s, count=1)
index.write_text(s, encoding='utf-8')

ui = Path('js/ui.js')
s = ui.read_text(encoding='utf-8')
old = "  if (viewName === 'requests' && typeof RequestsApp !== 'undefined' && RequestsApp?.open) RequestsApp.open();"
new = """  if (viewName === 'requests') {
    if (typeof RequestsApp !== 'undefined' && RequestsApp?.open) {
      RequestsApp.open().catch(err => console.error('Requests open failed', err));
    } else if (typeof loadRequestsModuleScript === 'function') {
      loadRequestsModuleScript().then(() => RequestsApp.open()).catch(err => {
        console.error('Requests module failed to load', err);
        const el = document.getElementById('view-requests');
        if (el) el.innerHTML = '<div class=\"h-full flex items-center justify-center text-sm text-red-500\">Requests failed to load. Please refresh the page.</div>';
      });
    }
  }"""
if old in s:
    s = s.replace(old, new, 1)
ui.write_text(s, encoding='utf-8')
