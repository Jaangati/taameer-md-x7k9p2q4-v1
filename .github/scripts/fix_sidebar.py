from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')

old_css = """  .sidebar-header { min-height: 64px; position: relative; }
  .sidebar-toggle-btn { opacity: 0; transform: translateX(-4px); transition: opacity 0.25s ease, transform 0.25s ease, background 0.2s; }
  .sidebar-expanded .sidebar-toggle-btn { opacity: 1; transform: translateX(0); }
  .sidebar-toggle-btn:hover { background: rgba(255,255,255,0.1) !important; }
  .sidebar-collapsed .sidebar-label { display: none !important; }
  .sidebar-collapsed .sidebar-header { cursor: pointer; }
  #toggleIcon { transition: transform 0.3s ease; }"""

new_css = """  .sidebar-header { min-height: 64px; position: relative; }
  .sidebar-toggle-btn { transition: background 0.2s; }
  .sidebar-toggle-btn:hover { background: rgba(255,255,255,0.1) !important; }
  .sidebar-collapsed .sidebar-label { display: none !important; }
  .sidebar-collapsed .sidebar-toggle-btn { display: none !important; }
  .sidebar-collapsed .sidebar-header { cursor: pointer; justify-content: center; }
  .sidebar-collapsed .sidebar-header > div { justify-content: center; }
  .sidebar-expanded .sidebar-toggle-btn { display: flex !important; }
  #toggleIcon { transition: transform 0.3s ease; }"""

old_header = '    <div class="sidebar-header flex items-center justify-between px-3 py-4 border-b border-gray-900 relative" onclick="if (!sidebarExpanded) toggleSidebar()">'
new_header = '    <div class="sidebar-header flex items-center justify-between px-3 py-4 border-b border-gray-900 relative">'

old_js = "function toggleSidebar() { sidebarExpanded = !sidebarExpanded; const sb = document.getElementById('sidebar'); sb.classList.toggle('sidebar-expanded', sidebarExpanded); sb.classList.toggle('sidebar-collapsed', !sidebarExpanded); const icon = document.getElementById('toggleIcon'); if (icon) icon.style.transform = sidebarExpanded ? 'rotate(0deg)' : 'rotate(180deg)'; }\n\nconst VIEW_TITLES"
new_js = """function toggleSidebar() {
  sidebarExpanded = !sidebarExpanded;
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('sidebar-expanded', sidebarExpanded);
  sb.classList.toggle('sidebar-collapsed', !sidebarExpanded);
  const icon = document.getElementById('toggleIcon');
  if (icon) icon.style.transform = sidebarExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
}

const sidebarHeader = document.querySelector('.sidebar-header');
if (sidebarHeader) {
  sidebarHeader.addEventListener('click', (e) => {
    if (e.target.closest('.sidebar-toggle-btn')) return;
    if (!sidebarExpanded) toggleSidebar();
  });
}

const VIEW_TITLES"""

for old, new, label in [(old_css, new_css, 'CSS'), (old_header, new_header, 'header'), (old_js, new_js, 'JS')]:
    if old not in text:
        raise SystemExit(f'Expected {label} block not found; no changes made.')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Sidebar patch applied successfully.')
