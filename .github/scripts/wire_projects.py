from pathlib import Path
import re

projects = Path('js/projects.js')
s = projects.read_text(encoding='utf-8')
old = "function render(view){ if(!view.dataset.projectsReady){renderShell(view);view.dataset.projectsReady='1';} }"
new = """function render(view){
    if(!view.dataset.projectsReady){renderShell(view);view.dataset.projectsReady='1';}
    if(!view.dataset.projectsLoaded){
      view.dataset.projectsLoaded='1';
      load().then(()=>renderLibrary()).catch(e=>{
        console.error('Projects load failed',e);
        const main=document.getElementById('projectsMain');
        if(main) main.innerHTML='<div class="projects-empty"><div><i class="fas fa-triangle-exclamation"></i><div style="font-weight:800">Could not load projects</div><div style="font-size:11px;margin-top:5px">Please refresh and try again.</div></div></div>';
      });
    }
  }"""
if old in s:
    s = s.replace(old, new, 1)
elif 'view.dataset.projectsLoaded' not in s:
    raise SystemExit('Projects render hook not found')
projects.write_text(s, encoding='utf-8')

index = Path('index.html')
h = index.read_text(encoding='utf-8')
if 'js/projects.js' not in h:
    h, n = re.subn(r'(<script src="js/vault\.js[^\"]*"></script>)', r'\1\n<script src="js/projects.js?v=20260908-v2"></script>', h, count=1)
    if n != 1:
        raise SystemExit('Vault script anchor not found')
    index.write_text(h, encoding='utf-8')
