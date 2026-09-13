// TAAMEER Department Hub — permanent department knowledge and people area
(() => {
  'use strict';

  const Hub = {
    tab: 'overview',
    loaded: false,
    loading: false,
    team: [],
    roles: [],
    documents: [],
    acknowledgements: [],
    onboarding: [],
    progress: [],
    search: ''
  };

  const esc = value => Utils.escapeHTML(String(value ?? ''));
  const isAdmin = () => state.currentUser?.role === 'admin';
  const currentId = () => String(state.currentUser?.id || '');
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
  const niceDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
  const roleFor = id => Hub.roles.find(role => String(role.user_id) === String(id)) || {};
  const manager = () => Hub.team.find(person => person.job_title === 'Marketing Manager') || Hub.team[0];
  const published = kind => Hub.documents.filter(doc => doc.kind === kind && (isAdmin() || doc.status === 'published'));
  const acknowledged = id => Hub.acknowledgements.some(row => String(row.document_id) === String(id));
  const completed = id => Hub.progress.some(row => String(row.item_id) === String(id));

  function injectStyles() {
    if (document.getElementById('departmentHubStyles')) return;
    const style = document.createElement('style');
    style.id = 'departmentHubStyles';
    style.textContent = `
      .dh-shell{max-width:1500px;margin:0 auto;padding-bottom:40px;color:#0b1220}.dark .dh-shell{color:#f8fafc}
      .dh-hero{position:relative;overflow:hidden;border-radius:26px;padding:30px 32px;background:linear-gradient(128deg,#070d19 0%,#121a2a 67%,color-mix(in srgb,var(--accent) 30%,#252b38) 145%);color:#fff;box-shadow:0 18px 45px rgba(10,15,28,.12)}
      .dh-hero:before{content:'';position:absolute;width:380px;height:380px;border:1px solid rgba(255,255,255,.08);border-radius:50%;right:-110px;top:-215px;box-shadow:0 0 0 52px rgba(255,255,255,.025),0 0 0 104px rgba(255,255,255,.018)}
      .dh-hero-grid{position:relative;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(320px,.7fr);gap:28px;align-items:end}.dh-kicker{display:flex;align-items:center;gap:9px;color:#a9b4c7;font-size:10px;font-weight:850;letter-spacing:.18em;text-transform:uppercase}.dh-kicker-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 18%,transparent)}
      .dh-hero h2{font-size:clamp(28px,3vw,44px);line-height:1.04;letter-spacing:-.045em;font-weight:850;margin-top:14px}.dh-hero p{color:#aeb8c8;font-size:13px;line-height:1.65;max-width:650px;margin-top:12px}.dh-hero-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.dh-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:8px 11px;background:rgba(255,255,255,.055);font-size:10px;font-weight:750;color:#dce3ed}
      .dh-hero-card{border:1px solid rgba(255,255,255,.1);border-radius:20px;background:rgba(255,255,255,.065);backdrop-filter:blur(12px);padding:18px}.dh-hero-card-label{font-size:9px;font-weight:850;letter-spacing:.14em;text-transform:uppercase;color:#9ca9bc}.dh-hero-card-row{display:flex;align-items:center;gap:12px;margin-top:13px}.dh-mini-avatar{width:45px;height:45px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.18)}.dh-mini-avatar-fallback{display:flex;align-items:center;justify-content:center;background:var(--accent);font-size:11px;font-weight:900}.dh-hero-card strong{display:block;font-size:13px}.dh-hero-card span{display:block;color:#aeb8c8;font-size:10px;margin-top:3px}
      .dh-tabs{display:flex;gap:6px;align-items:center;overflow-x:auto;margin:16px 0;padding:6px;background:#e9edf2;border-radius:16px;scrollbar-width:none}.dark .dh-tabs{background:#101826}.dh-tabs::-webkit-scrollbar{display:none}.dh-tab{border:0;border-radius:11px;padding:10px 14px;white-space:nowrap;color:#667085;font-size:11px;font-weight:800;transition:.16s}.dh-tab:hover{color:#111827}.dark .dh-tab:hover{color:#fff}.dh-tab.active{background:#fff;color:#0b1220;box-shadow:0 3px 12px rgba(15,23,42,.08)}.dark .dh-tab.active{background:#263043;color:#fff}
      .dh-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}.dh-card{grid-column:span 4;border:1px solid #e4e8ee;border-radius:22px;background:#fff;padding:20px;min-width:0;box-shadow:0 8px 24px rgba(15,23,42,.035)}.dark .dh-card{background:#0d1420;border-color:#222d3c}.dh-span-5{grid-column:span 5}.dh-span-7{grid-column:span 7}.dh-span-8{grid-column:span 8}.dh-span-12{grid-column:span 12}.dh-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.dh-card h3{font-size:16px;line-height:1.2;font-weight:850;letter-spacing:-.02em}.dh-card-sub{font-size:10px;line-height:1.5;color:#97a2b3;margin-top:5px}.dh-link{border:0;background:transparent;color:#667085;font-size:10px;font-weight:800}.dh-link:hover{color:var(--accent)}
      .dh-stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.dh-stat{border-radius:15px;background:#f6f8fa;padding:14px}.dark .dh-stat{background:#151e2c}.dh-stat strong{display:block;font-size:24px;letter-spacing:-.04em}.dh-stat span{display:block;color:#8a96a8;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.1em;margin-top:4px}
      .dh-progress{height:8px;border-radius:99px;background:#edf0f4;overflow:hidden}.dark .dh-progress{background:#263043}.dh-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 58%,#fff));transition:width .25s}.dh-progress-copy{display:flex;justify-content:space-between;gap:10px;margin-bottom:9px;font-size:10px;color:#7b8798}.dh-progress-copy strong{font-size:20px;color:#111827}.dark .dh-progress-copy strong{color:#fff}
      .dh-list{display:grid;gap:8px}.dh-list-item{width:100%;border:1px solid #edf0f3;border-radius:14px;background:#fff;padding:12px;display:flex;align-items:center;gap:11px;text-align:left;transition:.15s}.dark .dh-list-item{background:#111925;border-color:#232e3e}.dh-list-item:hover{border-color:color-mix(in srgb,var(--accent) 55%,#dce1e8);transform:translateY(-1px)}.dh-list-icon{width:35px;height:35px;border-radius:11px;background:#f1f3f6;display:flex;align-items:center;justify-content:center;color:#667085;flex:0 0 auto}.dark .dh-list-icon{background:#202a39}.dh-list-copy{min-width:0;flex:1}.dh-list-copy strong{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dh-list-copy span{display:block;color:#96a0b0;font-size:9px;margin-top:4px}.dh-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 8px;background:#eff2f5;color:#6c7788;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.dark .dh-pill{background:#1d2736}.dh-pill.required{background:#fff2de;color:#b96a08}.dh-pill.draft{background:#fff7ed;color:#c2410c}
      .dh-focus{display:flex;gap:7px;flex-wrap:wrap}.dh-focus span{border-radius:999px;padding:7px 9px;background:color-mix(in srgb,var(--accent) 10%,#f7f8fa);color:color-mix(in srgb,var(--accent) 70%,#273142);font-size:9px;font-weight:800}.dark .dh-focus span{background:color-mix(in srgb,var(--accent) 16%,#17202d);color:#d8dee8}
      .dh-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.dh-search{min-width:240px;position:relative}.dh-search i{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:11px;color:#9aa5b5}.dh-search input{width:100%;border:1px solid #e2e7ed;border-radius:13px;background:#fff;padding:11px 12px 11px 35px;font-size:11px;outline:none}.dark .dh-search input{background:#111925;border-color:#263142;color:#fff}.dh-search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}
      .dh-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #dfe4ea;border-radius:12px;background:#fff;color:#172033;padding:10px 13px;font-size:10px;font-weight:850;transition:.15s}.dark .dh-btn{background:#151e2c;border-color:#2b3647;color:#fff}.dh-btn:hover{border-color:var(--accent);transform:translateY(-1px)}.dh-btn.primary{background:#0b1220;border-color:#0b1220;color:#fff}.dh-btn.accent{background:var(--accent);border-color:var(--accent);color:#fff}.dh-btn.danger{color:#dc2626}.dh-btn.small{padding:8px 10px;border-radius:10px;font-size:9px}
      .dh-org{padding:6px 0 2px}.dh-manager-wrap{display:flex;justify-content:center}.dh-person{position:relative;border:1px solid #e4e8ee;border-radius:20px;background:#fff;padding:17px;min-width:0;box-shadow:0 7px 22px rgba(15,23,42,.045)}.dark .dh-person{background:#0d1420;border-color:#233044}.dh-person.manager{width:min(430px,100%);border-color:color-mix(in srgb,var(--accent) 35%,#e4e8ee);background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--accent) 5%,#fff))}.dark .dh-person.manager{background:linear-gradient(135deg,#0d1420,color-mix(in srgb,var(--accent) 9%,#0d1420))}.dh-person-top{display:flex;align-items:center;gap:13px}.dh-avatar{width:58px;height:58px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 0 0 1px #e0e5eb,0 5px 14px rgba(15,23,42,.09);flex:0 0 auto}.dark .dh-avatar{border-color:#101826;box-shadow:0 0 0 1px #334155}.dh-avatar-fallback{display:flex;align-items:center;justify-content:center;background:#1b2535;color:#fff;font-size:13px;font-weight:900}.dh-person h4{font-size:13px;font-weight:850}.dh-person p{font-size:9px;color:#8e99aa;margin-top:4px}.dh-person .dh-focus{margin-top:13px}.dh-org-line{height:35px;width:1px;background:#dce2e9;margin:0 auto}.dark .dh-org-line{background:#334155}.dh-team-grid{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;padding-top:24px}.dh-team-grid:before{content:'';position:absolute;left:16.67%;right:16.67%;top:0;height:1px;background:#dce2e9}.dark .dh-team-grid:before{background:#334155}.dh-team-grid .dh-person:before{content:'';position:absolute;left:50%;top:-24px;height:24px;width:1px;background:#dce2e9}.dark .dh-team-grid .dh-person:before{background:#334155}
      .dh-role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.dh-role-card{border:1px solid #e4e8ee;border-radius:20px;background:#fff;padding:18px}.dark .dh-role-card{background:#0d1420;border-color:#233044}.dh-role-head{display:flex;align-items:center;gap:12px}.dh-role-head .dh-avatar{width:48px;height:48px}.dh-role-card ul{list-style:none;margin:15px 0 0;padding:0;display:grid;gap:8px}.dh-role-card li{position:relative;padding-left:16px;font-size:10px;line-height:1.45;color:#5f6b7c}.dark .dh-role-card li{color:#bbc4d0}.dh-role-card li:before{content:'';position:absolute;left:0;top:5px;width:6px;height:6px;border-radius:50%;background:var(--accent)}
      .dh-doc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.dh-doc{display:flex;flex-direction:column;min-height:235px;border:1px solid #e4e8ee;border-radius:20px;background:#fff;padding:18px;transition:.16s}.dark .dh-doc{background:#0d1420;border-color:#233044}.dh-doc:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(15,23,42,.07)}.dh-doc-top{display:flex;justify-content:space-between;align-items:center;gap:12px}.dh-doc-icon{width:42px;height:42px;border-radius:13px;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center}.dh-doc.procedure .dh-doc-icon{background:var(--accent)}.dh-doc h3{font-size:15px;line-height:1.25;margin-top:17px}.dh-doc p{font-size:10px;line-height:1.55;color:#7e899a;margin-top:8px}.dh-doc-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:auto;padding-top:16px}.dh-doc-actions{display:flex;gap:7px;margin-top:12px}
      .dh-checklist{display:grid;gap:9px}.dh-check{width:100%;display:grid;grid-template-columns:38px minmax(0,1fr) auto auto;align-items:center;gap:11px;border:1px solid #e6eaf0;border-radius:15px;background:#fff;padding:12px;text-align:left}.dark .dh-check{background:#101824;border-color:#253143}.dh-check-mark{width:32px;height:32px;border-radius:10px;background:#edf1f5;color:#9aa5b5;display:flex;align-items:center;justify-content:center}.dh-check.done .dh-check-mark{background:#dcfce7;color:#16834c}.dh-check strong{font-size:11px}.dh-check span{display:block;font-size:9px;color:#929dad;margin-top:3px}.dh-check-state{font-size:8px!important;font-weight:850;text-transform:uppercase;letter-spacing:.07em;margin:0!important}.dh-check.done .dh-check-state{color:#16834c}.dh-check-edit{width:30px;height:30px;border-radius:9px;background:#f1f3f6;display:flex!important;align-items:center;justify-content:center;margin:0!important;color:#667085!important}.dark .dh-check-edit{background:#202a39}
      .dh-empty{border:1px dashed #dce2e9;border-radius:17px;padding:34px 18px;text-align:center;color:#97a2b2;font-size:10px}.dark .dh-empty{border-color:#2b3748}.dh-empty i{display:block;font-size:22px;margin-bottom:10px;color:#c2c9d3}
      .dh-overlay{position:fixed;inset:0;z-index:130;background:rgba(6,11,20,.62);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:22px}.dh-modal{width:min(760px,100%);max-height:min(86vh,850px);overflow:auto;border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.28)}.dark .dh-modal{background:#0d1420;color:#fff}.dh-modal-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:14px;padding:19px 21px;border-bottom:1px solid #e7ebf0;background:inherit}.dark .dh-modal-head{border-color:#253043}.dh-modal-head h3{font-size:17px;font-weight:850}.dh-close{width:36px;height:36px;border-radius:11px;background:#f1f3f6;color:#596577}.dark .dh-close{background:#202a39;color:#fff}.dh-modal-body{padding:22px}.dh-reader-meta{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px}.dh-reader-body{white-space:pre-line;font-size:12px;line-height:1.8;color:#465266}.dark .dh-reader-body{color:#c7d0dc}.dh-form{display:grid;gap:13px}.dh-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dh-field label{display:block;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.08em;color:#7b8798;margin-bottom:6px}.dh-field input,.dh-field select,.dh-field textarea{width:100%;border:1px solid #dfe5ec;border-radius:12px;background:#fff;padding:11px 12px;font-size:11px;outline:none}.dark .dh-field input,.dark .dh-field select,.dark .dh-field textarea{background:#131c29;border-color:#2a3648;color:#fff}.dh-field textarea{min-height:120px;resize:vertical}.dh-form-actions{display:flex;justify-content:flex-end;gap:9px;border-top:1px solid #edf0f4;padding-top:15px}.dark .dh-form-actions{border-color:#253043}
      @media(max-width:1100px){.dh-card{grid-column:span 6}.dh-span-7,.dh-span-8,.dh-span-5{grid-column:span 6}.dh-doc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dh-team-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dh-team-grid:before,.dh-team-grid .dh-person:before{display:none}.dh-team-grid{padding-top:0}.dh-org-line{display:none}}
      @media(max-width:760px){.dh-hero{padding:24px 20px}.dh-hero-grid{grid-template-columns:1fr}.dh-hero-card{display:none}.dh-card,.dh-span-5,.dh-span-7,.dh-span-8,.dh-span-12{grid-column:span 12}.dh-doc-grid,.dh-role-grid,.dh-team-grid{grid-template-columns:1fr}.dh-toolbar{align-items:stretch;flex-direction:column}.dh-search{min-width:0}.dh-form-row{grid-template-columns:1fr}.dh-stat-row{grid-template-columns:1fr 1fr}.dh-shell{padding-bottom:24px}}
    `;
    document.head.appendChild(style);
  }

  function ensureView() {
    let view = document.getElementById('view-department-hub');
    if (!view) {
      view = document.createElement('div');
      view.id = 'view-department-hub';
      view.className = 'view-section hidden fade-in';
      document.getElementById('mainContent')?.appendChild(view);
    }
    return view;
  }

  function avatar(person, className = 'dh-avatar') {
    return person?.avatar
      ? `<img class="${className}" src="${esc(person.avatar)}" alt="${esc(person.full_name || '')}">`
      : `<div class="${className} dh-avatar-fallback">${esc(initials(person?.full_name))}</div>`;
  }

  async function load() {
    if (Hub.loading) return;
    Hub.loading = true;
    renderLoading();
    try {
      const uid = currentId();
      const [teamRes, rolesRes, docsRes, ackRes, itemsRes, progressRes] = await Promise.all([
        supabaseClient.rpc('team_directory'),
        supabaseClient.from('department_hub_team_roles').select('*').order('sort_order'),
        supabaseClient.from('department_hub_documents').select('*').order('sort_order').order('updated_at', { ascending: false }),
        supabaseClient.from('department_hub_acknowledgements').select('document_id,user_id,acknowledged_at').eq('user_id', uid),
        supabaseClient.from('department_hub_onboarding_items').select('*').order('sort_order'),
        supabaseClient.from('department_hub_onboarding_progress').select('item_id,user_id,completed_at').eq('user_id', uid)
      ]);
      const firstError = [teamRes, rolesRes, docsRes, ackRes, itemsRes, progressRes].find(result => result.error)?.error;
      if (firstError) throw firstError;
      Hub.team = (teamRes.data || []).filter(person => person.full_name !== 'ADMIN');
      Hub.roles = rolesRes.data || [];
      Hub.documents = docsRes.data || [];
      Hub.acknowledgements = ackRes.data || [];
      Hub.onboarding = itemsRes.data || [];
      Hub.progress = progressRes.data || [];
      Hub.loaded = true;
      render();
    } catch (error) {
      console.error('Department Hub load failed', error);
      renderError();
    } finally {
      Hub.loading = false;
    }
  }

  function renderLoading() {
    const view = ensureView();
    view.innerHTML = `<div class="dh-shell"><div class="dh-empty"><i class="fas fa-circle-notch fa-spin"></i>Preparing your Department Hub…</div></div>`;
  }

  function renderError() {
    const view = ensureView();
    view.innerHTML = `<div class="dh-shell"><div class="dh-empty"><i class="fas fa-triangle-exclamation"></i>We could not load the Department Hub.<br><button class="dh-btn small" style="margin-top:14px" onclick="DepartmentHub.reload()">Try again</button></div></div>`;
  }

  function hero() {
    const person = Hub.team.find(p => String(p.id) === currentId()) || { full_name: state.currentUser?.fullName, job_title: state.currentUser?.jobTitle, avatar: state.currentUser?.avatar };
    const required = Hub.documents.filter(doc => doc.is_required && doc.status === 'published' && !acknowledged(doc.id)).length;
    const done = Hub.progress.length;
    return `<section class="dh-hero">
      <div class="dh-hero-grid">
        <div>
          <div class="dh-kicker"><span class="dh-kicker-dot"></span>TAAMEER Marketing</div>
          <h2>The department,<br>in one clear place.</h2>
          <p>Know the team, understand every role, find the approved way of working and complete your department essentials without searching across different tools.</p>
          <div class="dh-hero-meta">
            <span class="dh-chip"><i class="fas fa-users"></i>${Hub.team.length} team members</span>
            <span class="dh-chip"><i class="fas fa-book-open"></i>${published('policy').filter(d => d.status === 'published').length} policies</span>
            <span class="dh-chip"><i class="fas fa-list-check"></i>${required ? `${required} action${required === 1 ? '' : 's'} for you` : 'Everything reviewed'}</span>
          </div>
        </div>
        <div class="dh-hero-card">
          <div class="dh-hero-card-label">Your place in the department</div>
          <div class="dh-hero-card-row">${avatar(person, 'dh-mini-avatar')}<div><strong>${esc(person.full_name || 'Team member')}</strong><span>${esc(person.job_title || 'Marketing Department')}</span></div></div>
          <div class="dh-progress-copy" style="margin-top:16px"><span>Onboarding progress</span><span>${done}/${Hub.onboarding.length}</span></div>
          <div class="dh-progress"><span style="width:${Hub.onboarding.length ? Math.round(done / Hub.onboarding.length * 100) : 0}%"></span></div>
        </div>
      </div>
    </section>`;
  }

  const tabs = [
    ['overview', 'fa-compass', 'Overview'],
    ['structure', 'fa-sitemap', 'Team Structure'],
    ['roles', 'fa-user-tag', 'Roles & Responsibilities'],
    ['policies', 'fa-shield-halved', 'Policies & Standards'],
    ['procedures', 'fa-list-check', 'Procedures & SOPs'],
    ['onboarding', 'fa-route', 'Onboarding']
  ];

  function tabBar() {
    return `<nav class="dh-tabs" aria-label="Department Hub sections">${tabs.map(([id, icon, label]) => `<button class="dh-tab ${Hub.tab === id ? 'active' : ''}" onclick="DepartmentHub.setTab('${id}')"><i class="fas ${icon}" style="margin-right:7px"></i>${label}</button>`).join('')}</nav>`;
  }

  function overview() {
    const me = Hub.team.find(person => String(person.id) === currentId());
    const myRole = roleFor(me?.id);
    const required = Hub.documents.filter(doc => doc.status === 'published' && doc.is_required && !acknowledged(doc.id));
    const recent = Hub.documents.filter(doc => doc.status === 'published').slice(0, 4);
    const done = Hub.progress.length;
    const managerPerson = manager();
    return `<div class="dh-grid">
      <section class="dh-card dh-span-7">
        <div class="dh-card-head"><div><h3>Start here</h3><p class="dh-card-sub">The essentials that help you move without asking where to look.</p></div></div>
        <div class="dh-stat-row">
          <button class="dh-stat" onclick="DepartmentHub.setTab('structure')"><strong>${Hub.team.length}</strong><span>People in the team</span></button>
          <button class="dh-stat" onclick="DepartmentHub.setTab('policies')"><strong>${published('policy').length}</strong><span>Department policies</span></button>
          <button class="dh-stat" onclick="DepartmentHub.setTab('procedures')"><strong>${published('procedure').length}</strong><span>Working procedures</span></button>
        </div>
        <div style="margin-top:17px"><div class="dh-card-head" style="margin-bottom:10px"><div><h3 style="font-size:12px">Your focus</h3></div><button class="dh-link" onclick="DepartmentHub.setTab('roles')">View role <i class="fas fa-arrow-right" style="margin-left:5px"></i></button></div><div class="dh-focus">${(myRole.focus_areas || []).map(area => `<span>${esc(area)}</span>`).join('') || '<span>Department support</span>'}</div></div>
      </section>
      <section class="dh-card dh-span-5">
        <div class="dh-card-head"><div><h3>Your department lead</h3><p class="dh-card-sub">The person responsible for direction and alignment.</p></div></div>
        ${managerPerson ? `<div class="dh-person-top">${avatar(managerPerson)}<div><h4>${esc(managerPerson.full_name)}</h4><p>${esc(managerPerson.job_title)}</p></div></div><div class="dh-focus" style="margin-top:15px">${(roleFor(managerPerson.id).focus_areas || []).map(area => `<span>${esc(area)}</span>`).join('')}</div>` : '<div class="dh-empty">Department lead not configured.</div>'}
      </section>
      <section class="dh-card dh-span-7">
        <div class="dh-card-head"><div><h3>${required.length ? 'Needs your review' : 'You are up to date'}</h3><p class="dh-card-sub">Required department reading and acknowledgements.</p></div><button class="dh-link" onclick="DepartmentHub.setTab('policies')">All policies <i class="fas fa-arrow-right" style="margin-left:5px"></i></button></div>
        ${required.length ? `<div class="dh-list">${required.slice(0, 3).map(doc => docListItem(doc)).join('')}</div>` : `<div class="dh-empty"><i class="fas fa-circle-check" style="color:#39ad70"></i>No required policies are waiting for you.</div>`}
      </section>
      <section class="dh-card dh-span-5">
        <div class="dh-card-head"><div><h3>Onboarding</h3><p class="dh-card-sub">Your department essentials, at your pace.</p></div><button class="dh-link" onclick="DepartmentHub.setTab('onboarding')">Open checklist <i class="fas fa-arrow-right" style="margin-left:5px"></i></button></div>
        <div class="dh-progress-copy"><strong>${Hub.onboarding.length ? Math.round(done / Hub.onboarding.length * 100) : 0}%</strong><span>${done} of ${Hub.onboarding.length} complete</span></div><div class="dh-progress"><span style="width:${Hub.onboarding.length ? Math.round(done / Hub.onboarding.length * 100) : 0}%"></span></div>
        <div class="dh-list" style="margin-top:14px">${Hub.onboarding.filter(item => !completed(item.id)).slice(0, 2).map(item => `<button class="dh-list-item" onclick="DepartmentHub.setTab('onboarding')"><span class="dh-list-icon"><i class="fas fa-arrow-right"></i></span><span class="dh-list-copy"><strong>${esc(item.title)}</strong><span>${esc(item.category)}</span></span></button>`).join('') || '<div class="dh-card-sub">Your checklist is complete.</div>'}</div>
      </section>
      <section class="dh-card dh-span-12">
        <div class="dh-card-head"><div><h3>Recently updated</h3><p class="dh-card-sub">The latest approved department references.</p></div></div>
        ${recent.length ? `<div class="dh-list" style="grid-template-columns:repeat(2,minmax(0,1fr))">${recent.map(doc => docListItem(doc)).join('')}</div>` : '<div class="dh-empty">Published department content will appear here.</div>'}
      </section>
    </div>`;
  }

  function docListItem(doc) {
    return `<button class="dh-list-item" onclick="DepartmentHub.openDocument('${esc(doc.id)}')"><span class="dh-list-icon"><i class="fas ${doc.kind === 'policy' ? 'fa-shield-halved' : 'fa-list-check'}"></i></span><span class="dh-list-copy"><strong>${esc(doc.title)}</strong><span>${esc(doc.category)} · v${esc(doc.version)}</span></span>${doc.is_required ? '<span class="dh-pill required">Required</span>' : ''}</button>`;
  }

  function structure() {
    const lead = manager();
    const team = Hub.team.filter(person => String(person.id) !== String(lead?.id));
    const personCard = (person, leadCard = false) => {
      const role = roleFor(person.id);
      return `<article class="dh-person ${leadCard ? 'manager' : ''}"><div class="dh-person-top">${avatar(person)}<div><h4>${esc(person.full_name)}</h4><p>${esc(person.job_title || 'Marketing Department')}</p></div></div><div class="dh-focus">${(role.focus_areas || []).slice(0, 3).map(area => `<span>${esc(area)}</span>`).join('')}</div></article>`;
    };
    return `<section class="dh-card dh-span-12"><div class="dh-card-head"><div><h3>Marketing Department structure</h3><p class="dh-card-sub">A simple view of the team and reporting line—built from live member profiles.</p></div><span class="dh-pill">${Hub.team.length} members</span></div><div class="dh-org">${lead ? `<div class="dh-manager-wrap">${personCard(lead, true)}</div><div class="dh-org-line"></div>` : ''}<div class="dh-team-grid">${team.map(person => personCard(person)).join('')}</div></div></section>`;
  }

  function roles() {
    return `<div class="dh-toolbar"><div><h2 style="font-size:20px;font-weight:850;letter-spacing:-.03em">Who owns what</h2><p class="dh-card-sub">Clear responsibilities without turning job descriptions into paperwork.</p></div></div><div class="dh-role-grid">${Hub.team.map(person => {
      const role = roleFor(person.id);
      return `<article class="dh-role-card"><div class="dh-role-head">${avatar(person)}<div style="min-width:0;flex:1"><h3 style="font-size:13px;font-weight:850">${esc(person.full_name)}</h3><p class="dh-card-sub">${esc(person.job_title || 'Marketing Department')}</p></div>${isAdmin() ? `<button class="dh-btn small" onclick="DepartmentHub.editRole('${esc(person.id)}')"><i class="fas fa-pen"></i>Edit</button>` : ''}</div><div class="dh-focus" style="margin-top:14px">${(role.focus_areas || []).map(area => `<span>${esc(area)}</span>`).join('')}</div><ul>${(role.responsibilities || ['Support department priorities']).map(item => `<li>${esc(item)}</li>`).join('')}</ul></article>`;
    }).join('')}</div>`;
  }

  function documents(kind) {
    const label = kind === 'policy' ? 'Policies & standards' : 'Procedures & SOPs';
    const subtitle = kind === 'policy' ? 'The approved principles and standards everyone should know.' : 'Clear, repeatable steps for doing department work well.';
    const query = Hub.search.trim().toLowerCase();
    const items = published(kind).filter(doc => !query || `${doc.title} ${doc.summary} ${doc.category}`.toLowerCase().includes(query));
    return `<div class="dh-toolbar"><div><h2 style="font-size:20px;font-weight:850;letter-spacing:-.03em">${label}</h2><p class="dh-card-sub">${subtitle}</p></div><div style="display:flex;gap:9px;flex-wrap:wrap"><label class="dh-search"><i class="fas fa-search"></i><input value="${esc(Hub.search)}" oninput="DepartmentHub.search(this.value)" placeholder="Search ${kind === 'policy' ? 'policies' : 'procedures'}…"></label>${isAdmin() ? `<button class="dh-btn primary" onclick="DepartmentHub.editDocument(null,'${kind}')"><i class="fas fa-plus"></i>Add ${kind}</button>` : ''}</div></div>${items.length ? `<div class="dh-doc-grid">${items.map(docCard).join('')}</div>` : `<div class="dh-empty"><i class="fas ${kind === 'policy' ? 'fa-shield-halved' : 'fa-list-check'}"></i>${query ? 'No matching content.' : `No ${kind === 'policy' ? 'policies' : 'procedures'} have been published yet.`}</div>`}`;
  }

  function docCard(doc) {
    const isAck = acknowledged(doc.id);
    return `<article class="dh-doc ${doc.kind}"><div class="dh-doc-top"><span class="dh-doc-icon"><i class="fas ${doc.kind === 'policy' ? 'fa-shield-halved' : 'fa-list-check'}"></i></span><div style="display:flex;gap:6px">${doc.status !== 'published' ? `<span class="dh-pill draft">${esc(doc.status)}</span>` : ''}${doc.is_required ? `<span class="dh-pill ${isAck ? '' : 'required'}">${isAck ? 'Read' : 'Required'}</span>` : ''}</div></div><h3>${esc(doc.title)}</h3><p>${esc(doc.summary || 'Open this document to read the full guidance.')}</p><div class="dh-doc-meta"><span class="dh-pill">${esc(doc.category)}</span><span class="dh-pill">v${esc(doc.version)}</span></div><div class="dh-doc-actions"><button class="dh-btn small" onclick="DepartmentHub.openDocument('${esc(doc.id)}')">Open <i class="fas fa-arrow-right"></i></button>${isAdmin() ? `<button class="dh-btn small" onclick="DepartmentHub.editDocument('${esc(doc.id)}')"><i class="fas fa-pen"></i></button>` : ''}</div></article>`;
  }

  function onboarding() {
    const done = Hub.progress.length;
    const percent = Hub.onboarding.length ? Math.round(done / Hub.onboarding.length * 100) : 0;
    return `<div class="dh-grid"><section class="dh-card dh-span-5"><div class="dh-card-head"><div><h3>Your department start</h3><p class="dh-card-sub">Useful for new members and as a refresher for the whole team.</p></div>${isAdmin() ? '<button class="dh-btn small" onclick="DepartmentHub.editOnboarding()"><i class="fas fa-plus"></i>Add step</button>' : ''}</div><div class="dh-progress-copy"><strong>${percent}%</strong><span>${done} of ${Hub.onboarding.length} complete</span></div><div class="dh-progress"><span style="width:${percent}%"></span></div><div class="dh-focus" style="margin-top:18px"><span>People</span><span>Role</span><span>Standards</span><span>Tools</span><span>Access</span></div></section><section class="dh-card dh-span-7"><div class="dh-card-head"><div><h3>Essentials checklist</h3><p class="dh-card-sub">Tick an item when you have genuinely completed it.</p></div></div><div class="dh-checklist">${Hub.onboarding.map(item => `<button class="dh-check ${completed(item.id) ? 'done' : ''}" onclick="DepartmentHub.toggleOnboarding(${Number(item.id)})"><span class="dh-check-mark"><i class="fas ${completed(item.id) ? 'fa-check' : 'fa-circle'}"></i></span><span><strong>${esc(item.title)}</strong><span>${esc(item.description)}</span></span><span class="dh-check-state">${completed(item.id) ? 'Complete' : esc(item.category)}</span>${isAdmin() ? `<span class="dh-check-edit" role="button" aria-label="Edit checklist item" onclick="event.preventDefault();event.stopPropagation();DepartmentHub.editOnboarding(${Number(item.id)})"><i class="fas fa-pen"></i></span>` : '<span></span>'}</button>`).join('')}</div></section></div>`;
  }

  function content() {
    if (Hub.tab === 'structure') return structure();
    if (Hub.tab === 'roles') return roles();
    if (Hub.tab === 'policies') return documents('policy');
    if (Hub.tab === 'procedures') return documents('procedure');
    if (Hub.tab === 'onboarding') return onboarding();
    return overview();
  }

  function render() {
    injectStyles();
    const view = ensureView();
    view.innerHTML = `<div class="dh-shell">${hero()}${tabBar()}<main>${content()}</main></div>`;
  }

  function overlay(html) {
    closeOverlay();
    const node = document.createElement('div');
    node.className = 'dh-overlay';
    node.id = 'departmentHubOverlay';
    node.addEventListener('click', event => { if (event.target === node) closeOverlay(); });
    node.innerHTML = html;
    document.body.appendChild(node);
  }

  function closeOverlay() { document.getElementById('departmentHubOverlay')?.remove(); }

  function openDocument(id) {
    const doc = Hub.documents.find(item => String(item.id) === String(id));
    if (!doc) return;
    const isAck = acknowledged(doc.id);
    overlay(`<article class="dh-modal"><header class="dh-modal-head"><div><span class="dh-pill">${esc(doc.kind)}</span><h3 style="margin-top:8px">${esc(doc.title)}</h3></div><button class="dh-close" onclick="DepartmentHub.closeOverlay()"><i class="fas fa-xmark"></i></button></header><div class="dh-modal-body"><div class="dh-reader-meta"><span class="dh-pill">${esc(doc.category)}</span><span class="dh-pill">Version ${esc(doc.version)}</span><span class="dh-pill">Effective ${niceDate(doc.effective_date)}</span><span class="dh-pill">Owner: ${esc(doc.owner)}</span></div><div class="dh-reader-body">${esc(doc.body || doc.summary || 'No content has been added yet.')}</div>${doc.is_required && doc.status === 'published' ? `<div class="dh-form-actions" style="margin-top:24px"><button class="dh-btn ${isAck ? '' : 'accent'}" onclick="DepartmentHub.toggleAcknowledgement('${esc(doc.id)}')"><i class="fas ${isAck ? 'fa-circle-check' : 'fa-check'}"></i>${isAck ? 'Acknowledged' : 'I have read this'}</button></div>` : ''}</div></article>`);
  }

  function editDocument(id, fallbackKind = 'policy') {
    if (!isAdmin()) return;
    const doc = Hub.documents.find(item => String(item.id) === String(id)) || { kind: fallbackKind, title: '', summary: '', body: '', category: 'General', owner: 'Marketing Management', version: '1.0', effective_date: new Date().toISOString().slice(0, 10), is_required: false, status: 'draft', sort_order: 100 };
    overlay(`<section class="dh-modal"><header class="dh-modal-head"><h3>${id ? 'Edit department document' : 'Add department document'}</h3><button class="dh-close" onclick="DepartmentHub.closeOverlay()"><i class="fas fa-xmark"></i></button></header><div class="dh-modal-body"><form class="dh-form" onsubmit="DepartmentHub.saveDocument(event,'${id ? esc(id) : ''}')"><div class="dh-form-row"><div class="dh-field"><label>Type</label><select name="kind"><option value="policy" ${doc.kind === 'policy' ? 'selected' : ''}>Policy / standard</option><option value="procedure" ${doc.kind === 'procedure' ? 'selected' : ''}>Procedure / SOP</option></select></div><div class="dh-field"><label>Status</label><select name="status"><option value="draft" ${doc.status === 'draft' ? 'selected' : ''}>Draft — admin only</option><option value="published" ${doc.status === 'published' ? 'selected' : ''}>Published — visible to members</option><option value="archived" ${doc.status === 'archived' ? 'selected' : ''}>Archived — admin only</option></select></div></div><div class="dh-field"><label>Title</label><input name="title" required value="${esc(doc.title)}"></div><div class="dh-field"><label>Short summary</label><textarea name="summary" style="min-height:75px">${esc(doc.summary)}</textarea></div><div class="dh-field"><label>Full content</label><textarea name="body" required>${esc(doc.body)}</textarea></div><div class="dh-form-row"><div class="dh-field"><label>Category</label><input name="category" value="${esc(doc.category)}"></div><div class="dh-field"><label>Owner</label><input name="owner" value="${esc(doc.owner)}"></div></div><div class="dh-form-row"><div class="dh-field"><label>Version</label><input name="version" value="${esc(doc.version)}"></div><div class="dh-field"><label>Effective date</label><input type="date" name="effective_date" value="${esc(doc.effective_date || '')}"></div></div><label style="display:flex;align-items:center;gap:9px;font-size:11px;font-weight:750"><input type="checkbox" name="is_required" ${doc.is_required ? 'checked' : ''}>Require every member to acknowledge this</label><div class="dh-form-actions">${id ? `<button type="button" class="dh-btn danger" style="margin-right:auto" onclick="DepartmentHub.deleteDocument('${esc(id)}')"><i class="fas fa-trash"></i>Delete</button>` : ''}<button type="button" class="dh-btn" onclick="DepartmentHub.closeOverlay()">Cancel</button><button class="dh-btn primary" type="submit"><i class="fas fa-check"></i>Save document</button></div></form></div></section>`);
  }

  async function saveDocument(event, id) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const data = new FormData(form);
    const payload = {
      kind: data.get('kind'), title: String(data.get('title') || '').trim(), summary: String(data.get('summary') || '').trim(), body: String(data.get('body') || '').trim(), category: String(data.get('category') || 'General').trim(), owner: String(data.get('owner') || 'Marketing Management').trim(), version: String(data.get('version') || '1.0').trim(), effective_date: data.get('effective_date') || null, is_required: data.get('is_required') === 'on', status: data.get('status'), updated_by: currentId(), updated_at: new Date().toISOString()
    };
    try {
      const result = id ? await supabaseClient.from('department_hub_documents').update(payload).eq('id', id) : await supabaseClient.from('department_hub_documents').insert({ ...payload, created_by: currentId() });
      if (result.error) throw result.error;
      closeOverlay();
      await reload();
    } catch (error) {
      console.error(error);
      alert(error?.message || 'Could not save this document.');
      button.disabled = false;
    }
  }

  async function deleteDocument(id) {
    if (!isAdmin() || !confirm('Delete this department document?')) return;
    const { error } = await supabaseClient.from('department_hub_documents').delete().eq('id', id);
    if (error) return alert(error.message || 'Could not delete the document.');
    closeOverlay();
    await reload();
  }

  async function toggleAcknowledgement(id) {
    const has = acknowledged(id);
    const query = has
      ? supabaseClient.from('department_hub_acknowledgements').delete().eq('document_id', id).eq('user_id', currentId())
      : supabaseClient.from('department_hub_acknowledgements').insert({ document_id: id, user_id: currentId() });
    const { error } = await query;
    if (error) return alert(error.message || 'Could not update acknowledgement.');
    closeOverlay();
    await reload();
    openDocument(id);
  }

  async function toggleOnboarding(id) {
    const has = completed(id);
    const query = has
      ? supabaseClient.from('department_hub_onboarding_progress').delete().eq('item_id', id).eq('user_id', currentId())
      : supabaseClient.from('department_hub_onboarding_progress').insert({ item_id: id, user_id: currentId() });
    const { error } = await query;
    if (error) return alert(error.message || 'Could not update your checklist.');
    await reload();
  }

  function editRole(userId) {
    if (!isAdmin()) return;
    const person = Hub.team.find(item => String(item.id) === String(userId));
    const role = roleFor(userId);
    if (!person) return;
    overlay(`<section class="dh-modal"><header class="dh-modal-head"><div><h3>Edit ${esc(person.full_name)}’s responsibilities</h3><p class="dh-card-sub">${esc(person.job_title)}</p></div><button class="dh-close" onclick="DepartmentHub.closeOverlay()"><i class="fas fa-xmark"></i></button></header><div class="dh-modal-body"><form class="dh-form" onsubmit="DepartmentHub.saveRole(event,'${esc(userId)}')"><div class="dh-field"><label>Reports to</label><select name="reports_to"><option value="">Department lead / no reporting line</option>${Hub.team.filter(item => String(item.id) !== String(userId)).map(item => `<option value="${esc(item.id)}" ${String(role.reports_to || '') === String(item.id) ? 'selected' : ''}>${esc(item.full_name)} — ${esc(item.job_title)}</option>`).join('')}</select></div><div class="dh-field"><label>Focus areas — one per line</label><textarea name="focus_areas" style="min-height:90px">${esc((role.focus_areas || []).join('\n'))}</textarea></div><div class="dh-field"><label>Responsibilities — one per line</label><textarea name="responsibilities">${esc((role.responsibilities || []).join('\n'))}</textarea></div><div class="dh-form-actions"><button type="button" class="dh-btn" onclick="DepartmentHub.closeOverlay()">Cancel</button><button class="dh-btn primary" type="submit">Save role</button></div></form></div></section>`);
  }

  async function saveRole(event, userId) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const lines = value => String(value || '').split('\n').map(item => item.trim()).filter(Boolean);
    const existing = roleFor(userId);
    const payload = { user_id: userId, reports_to: data.get('reports_to') || null, focus_areas: lines(data.get('focus_areas')), responsibilities: lines(data.get('responsibilities')), sort_order: existing.sort_order || 100, updated_at: new Date().toISOString() };
    const { error } = await supabaseClient.from('department_hub_team_roles').upsert(payload, { onConflict: 'user_id' });
    if (error) return alert(error.message || 'Could not save this role.');
    closeOverlay();
    await reload();
  }

  function editOnboarding(id = null) {
    if (!isAdmin()) return;
    const item = Hub.onboarding.find(row => Number(row.id) === Number(id)) || { title: '', description: '', category: 'Getting started', sort_order: 100, active: true };
    overlay(`<section class="dh-modal"><header class="dh-modal-head"><h3>${id ? 'Edit onboarding step' : 'Add onboarding step'}</h3><button class="dh-close" onclick="DepartmentHub.closeOverlay()"><i class="fas fa-xmark"></i></button></header><div class="dh-modal-body"><form class="dh-form" onsubmit="DepartmentHub.saveOnboarding(event,${id ? Number(id) : 'null'})"><div class="dh-field"><label>Step title</label><input name="title" required value="${esc(item.title)}"></div><div class="dh-field"><label>Description</label><textarea name="description" style="min-height:90px">${esc(item.description)}</textarea></div><div class="dh-form-row"><div class="dh-field"><label>Category</label><input name="category" value="${esc(item.category)}"></div><div class="dh-field"><label>Order</label><input type="number" name="sort_order" value="${Number(item.sort_order) || 100}"></div></div><label style="display:flex;align-items:center;gap:9px;font-size:11px;font-weight:750"><input type="checkbox" name="active" ${item.active ? 'checked' : ''}>Visible to members</label><div class="dh-form-actions">${id ? `<button type="button" class="dh-btn danger" style="margin-right:auto" onclick="DepartmentHub.deleteOnboarding(${Number(id)})"><i class="fas fa-trash"></i>Delete</button>` : ''}<button type="button" class="dh-btn" onclick="DepartmentHub.closeOverlay()">Cancel</button><button class="dh-btn primary" type="submit">Save step</button></div></form></div></section>`);
  }

  async function saveOnboarding(event, id) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = { title: String(data.get('title') || '').trim(), description: String(data.get('description') || '').trim(), category: String(data.get('category') || 'Getting started').trim(), sort_order: Number(data.get('sort_order')) || 100, active: data.get('active') === 'on' };
    const result = id ? await supabaseClient.from('department_hub_onboarding_items').update(payload).eq('id', id) : await supabaseClient.from('department_hub_onboarding_items').insert(payload);
    if (result.error) return alert(result.error.message || 'Could not save this onboarding step.');
    closeOverlay();
    await reload();
  }

  async function deleteOnboarding(id) {
    if (!isAdmin() || !confirm('Delete this onboarding step for everyone?')) return;
    const { error } = await supabaseClient.from('department_hub_onboarding_items').delete().eq('id', id);
    if (error) return alert(error.message || 'Could not delete this onboarding step.');
    closeOverlay();
    await reload();
  }

  function setTab(tab) {
    if (!tabs.some(item => item[0] === tab)) return;
    Hub.tab = tab;
    Hub.search = '';
    render();
    document.getElementById('mainContent')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function search(value) { Hub.search = value; render(); const input = document.querySelector('.dh-search input'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
  async function reload() { Hub.loaded = false; await load(); }

  window.DepartmentHub = { open: load, reload, setTab, search, openDocument, editDocument, saveDocument, deleteDocument, toggleAcknowledgement, toggleOnboarding, editRole, saveRole, editOnboarding, saveOnboarding, deleteOnboarding, closeOverlay };

  const priorSidebar = window.renderSidebar;
  window.renderSidebar = function() {
    priorSidebar?.();
    const nav = document.getElementById('sidebarNav');
    if (!nav || !state.currentUser || nav.querySelector('[data-department-hub-nav]')) return;
    const title = document.createElement('div');
    title.className = 'section-title sidebar-label mt-2';
    title.dataset.departmentHubNav = 'title';
    title.textContent = 'Department';
    const item = document.createElement('div');
    item.className = `nav-item ${document.getElementById('view-department-hub') && !document.getElementById('view-department-hub').classList.contains('hidden') ? 'active' : ''}`;
    item.dataset.departmentHubNav = 'item';
    item.onclick = () => window.showView('department-hub');
    item.innerHTML = '<span class="nav-icon"><i class="fas fa-landmark"></i></span><span class="nav-label sidebar-label">Department Hub</span>';
    const adminTitle = [...nav.querySelectorAll('.section-title')].find(node => node.textContent.trim() === 'Administration');
    if (adminTitle) { nav.insertBefore(title, adminTitle); nav.insertBefore(item, adminTitle); }
    else { nav.append(title, item); }
  };

  const priorShowView = window.showView;
  window.showView = function(viewName) {
    if (viewName !== 'department-hub') return priorShowView?.(viewName);
    if (!state.currentUser) return;
    ensureView();
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-department-hub')?.classList.remove('hidden');
    document.getElementById('headerTitle').textContent = 'Department Hub';
    document.getElementById('headerSubtitle').textContent = 'People, roles and the way we work';
    window.renderSidebar?.();
    window.closeUserDropdown?.();
    window.VaultApp?.syncQuickCapture?.('department-hub');
    if (!Hub.loaded) load(); else render();
  };

  injectStyles();
  ensureView();
})();
