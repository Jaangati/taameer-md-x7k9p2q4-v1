// TAAMEER Department Hub — permanent department knowledge and people area
(() => {
  'use strict';

  const Hub = {
    loaded: false,
    loading: false,
    team: [],
    roles: [],
    documents: [],
    acknowledgements: [],
    search: '',
    docFilter: 'all'
  };

  const esc = value => Utils.escapeHTML(String(value ?? ''));
  const isAdmin = () => state.currentUser?.role === 'admin';
  const canEdit = () => isAdmin() || state.permissions?.user?.['department-hub']?.edit === true;
  const canDelete = () => isAdmin() || state.permissions?.user?.['department-hub']?.delete === true;
  const currentId = () => String(state.currentUser?.id || '');
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
  const niceDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
  const niceDateTime = value => value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not yet';
  const roleFor = id => Hub.roles.find(role => String(role.user_id) === String(id)) || {};
  const manager = () => Hub.team.find(person => person.job_title === 'Marketing Manager') || Hub.team[0];
  const published = kind => Hub.documents.filter(doc => doc.kind === kind && (canEdit() || doc.status === 'published'));
  const acknowledged = id => Hub.acknowledgements.some(row => String(row.document_id) === String(id));

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
      .dh-chip{border:1px solid rgba(255,255,255,.1);cursor:pointer}.dh-chip:hover{background:rgba(255,255,255,.11);border-color:rgba(255,255,255,.2)}
      .dh-hero-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px;padding-top:15px;border-top:1px solid rgba(255,255,255,.09)}.dh-hero-summary span{font-size:9px!important;line-height:1.35;color:#aeb8c8}.dh-hero-summary b{display:block;color:#fff;font-size:18px;letter-spacing:-.03em}.dh-hero-summary .attention b{color:#f4b447}.dh-hero-summary .clear{display:flex;align-items:center;gap:6px;color:#71d4a1}.dh-main{margin-top:16px}.dh-section{scroll-margin-top:18px}.dh-section-number{display:block;color:var(--accent);font-size:9px;font-weight:900;letter-spacing:.15em;margin-bottom:6px}.dh-person{width:100%;text-align:left;cursor:pointer;transition:.18s}.dh-person:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent) 42%,#dce2e9);box-shadow:0 12px 26px rgba(15,23,42,.075)}.dh-person-open{margin-left:auto;color:#b0bac8;font-size:10px}
      .dh-knowledge-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.dh-library-tools{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.dh-filter{display:inline-flex;gap:4px;padding:4px;border-radius:13px;background:#f1f3f6}.dark .dh-filter{background:#17202d}.dh-filter button{border:0;border-radius:9px;padding:8px 11px;color:#7b8798;font-size:9px;font-weight:850}.dh-filter button span{margin-left:5px;color:#a0a9b7}.dh-filter button.active{background:#fff;color:#111827;box-shadow:0 2px 8px rgba(15,23,42,.08)}.dark .dh-filter button.active{background:#2a3545;color:#fff}.dh-review-strip{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;border:1px solid #f1d7a9;border-radius:14px;background:#fff8eb;padding:11px 13px;color:#9a5b0b;font-size:10px}.dh-review-strip span{display:flex;align-items:center;gap:8px}.dark .dh-review-strip{background:#2b2113;border-color:#5a411d;color:#f2b85b}
      .dh-doc{position:relative;cursor:pointer;min-height:220px}.dh-doc-type{margin-top:16px;color:var(--accent);font-size:8px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.dh-doc-footer{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:auto;padding-top:16px;border-top:1px solid #edf0f3}.dark .dh-doc-footer{border-color:#222d3c}.dh-doc-footer>div{display:flex;gap:6px;color:#929dad;font-size:8px}.dh-doc-open{display:flex;align-items:center;gap:7px;color:#4f5b6d;font-size:9px;font-weight:850}.dark .dh-doc-open{color:#d0d7e2}.dh-doc:hover .dh-doc-open{color:var(--accent)}.dh-doc-edit{position:absolute;right:15px;bottom:14px;width:30px;height:30px;border-radius:9px;background:#f1f3f6;color:#667085}.dark .dh-doc-edit{background:#202a39;color:#d5dce6}.dh-doc:has(.dh-doc-edit) .dh-doc-open{margin-right:38px}
      .dh-modal-eyebrow{display:block;color:#98a4b5;font-size:8px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;margin-bottom:5px}.dh-role-modal .dh-modal-head{align-items:center}.dh-role-section+.dh-role-section{margin-top:24px}.dh-role-section .dh-focus{margin-top:10px}.dh-responsibility-list{list-style:none;padding:0;margin:11px 0 0;display:grid;gap:8px}.dh-responsibility-list li{display:flex;align-items:flex-start;gap:10px;border-radius:12px;background:#f6f8fa;padding:11px 12px;color:#465266;font-size:10px;line-height:1.45}.dark .dh-responsibility-list li{background:#151e2c;color:#d0d7e2}.dh-responsibility-list i{margin-top:2px;color:var(--accent)}
      .dh-structure-shell{padding:0;overflow:hidden}.dh-structure-shell>.dh-card-head{padding:21px 23px;margin:0}.dh-org-board{position:relative;min-height:510px;overflow:hidden;padding:38px 32px 44px;border-radius:0 0 22px 22px;background:radial-gradient(circle at 50% 15%,color-mix(in srgb,var(--accent) 25%,transparent),transparent 31%),linear-gradient(145deg,#080e1a 0%,#111b2c 54%,#27354b 100%);color:#fff}.dh-org-board:before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,#000,transparent 86%)}.dh-org-board-title{position:absolute;left:30px;top:27px;z-index:2}.dh-org-board-title span{display:block;color:var(--accent);font-size:8px;font-weight:900;letter-spacing:.2em}.dh-org-board-title strong{display:block;margin-top:7px;font-size:17px;line-height:.95;letter-spacing:-.04em}.dh-org-mark{position:absolute;right:-20px;bottom:-105px;font-size:250px;line-height:1;font-weight:950;color:rgba(255,255,255,.025)}.dh-org-lead{position:relative;z-index:3;display:flex;justify-content:center}.dh-org-trunk{position:relative;z-index:2;width:1px;height:44px;margin:0 auto;background:rgba(255,255,255,.35)}.dh-org-branches{position:relative;z-index:2;display:grid;grid-template-columns:repeat(6,minmax(110px,1fr));gap:17px;padding-top:32px}.dh-org-branches:before{content:'';position:absolute;left:8.33%;right:8.33%;top:0;height:1px;background:rgba(255,255,255,.3)}.dh-org-branch{position:relative;display:flex;justify-content:center}.dh-org-branch:before{content:'';position:absolute;left:50%;top:-32px;width:1px;height:32px;background:rgba(255,255,255,.3)}.dh-org-node{position:relative;width:100%;max-width:160px;border:0;background:transparent;color:#fff;text-align:center;cursor:pointer;transition:.2s}.dh-org-node:hover{transform:translateY(-4px)}.dh-org-level{position:absolute;z-index:3;top:-8px;left:50%;transform:translateX(-50%);white-space:nowrap;border-radius:999px;background:color-mix(in srgb,var(--accent) 80%,#111827);padding:5px 9px;color:#fff;font-size:7px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 5px 14px rgba(0,0,0,.2)}.dh-org-node.lead .dh-org-level{background:#f0a935;color:#111827}.dh-org-photo{display:block;width:106px;height:112px;margin:0 auto;border-radius:20px 20px 14px 14px;padding:4px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 72%,#fff),#42506a);box-shadow:0 15px 28px rgba(0,0,0,.28)}.dh-org-node.lead{max-width:180px}.dh-org-node.lead .dh-org-photo{width:120px;height:126px;background:linear-gradient(145deg,#f5bd58,#7d5a32)}.dh-org-avatar{display:flex;width:100%;height:100%;align-items:center;justify-content:center;border-radius:16px 16px 11px 11px;object-fit:cover;background:#1c2738;color:#fff;font-size:18px;font-weight:900}.dh-org-node strong{position:relative;display:block;width:max-content;max-width:100%;margin:-9px auto 0;padding:6px 9px;border-radius:7px;background:#f7f4e9;color:#121826;font-size:9px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 5px 12px rgba(0,0,0,.2)}.dh-org-node small{display:block;margin-top:6px;color:#aeb9c9;font-size:7px;line-height:1.25}.dh-org-focus{display:inline-block;margin-top:7px;border-radius:999px;background:rgba(255,255,255,.07);padding:4px 7px;color:#aeb9c9;font-size:7px}
      .dh-document-modal{width:min(1180px,96vw);max-height:94vh;border-radius:28px}.dh-document-top{position:relative;display:flex;justify-content:space-between;gap:24px;padding:30px 34px;background:linear-gradient(125deg,#080e1a,#182235 68%,color-mix(in srgb,var(--accent) 34%,#273248));color:#fff}.dh-document-top h2{max-width:760px;margin-top:12px;font-size:28px;line-height:1.08;letter-spacing:-.035em;font-weight:880}.dh-document-top p{max-width:720px;margin-top:9px;color:#aeb9ca;font-size:11px;line-height:1.55}.dh-document-type{display:inline-flex;align-items:center;gap:7px;color:#b8c3d3;font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.dh-close.dark{flex:0 0 auto;background:rgba(255,255,255,.08);color:#fff}.dh-document-layout{display:grid;grid-template-columns:1fr;background:#f4f6f8}.dh-document-layout.with-audience{grid-template-columns:minmax(0,1fr) 330px}.dark .dh-document-layout{background:#0b111c}.dh-document-paper{min-width:0;padding:30px 34px 36px;background:#fff}.dark .dh-document-paper{background:#101824}.dh-document-meta{display:grid;grid-template-columns:1.45fr repeat(3,1fr);gap:9px}.dh-effective-date,.dh-meta-item{min-height:67px;border:1px solid #e7ebf0;border-radius:15px;padding:11px 13px}.dark .dh-effective-date,.dark .dh-meta-item{border-color:#2a3545}.dh-effective-date{display:flex;align-items:center;gap:12px;border-color:color-mix(in srgb,var(--accent) 35%,#e7ebf0);background:color-mix(in srgb,var(--accent) 8%,#fff)}.dark .dh-effective-date{background:color-mix(in srgb,var(--accent) 12%,#131c29)}.dh-effective-date>i{display:flex;width:35px;height:35px;align-items:center;justify-content:center;border-radius:10px;background:var(--accent);color:#fff}.dh-effective-date span,.dh-meta-item span{display:block;color:#99a4b4;font-size:7px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.dh-effective-date strong,.dh-meta-item strong{display:block;margin-top:5px;color:#172033;font-size:10px}.dark .dh-effective-date strong,.dark .dh-meta-item strong{color:#fff}.dh-document-rule{display:flex;justify-content:space-between;gap:12px;margin:23px 0;padding-bottom:10px;border-bottom:1px solid #e8ecf1;color:#a0a9b7;font-size:8px;font-weight:750}.dark .dh-document-rule{border-color:#293444}.dh-reader-body{white-space:normal;font-size:12px;line-height:1.85;color:#3d4859}.dh-reader-body p{margin:0 0 17px}.dh-reader-body h4{margin:24px 0 10px;color:#121a28;font-size:15px;font-weight:850}.dark .dh-reader-body h4{color:#fff}.dh-reader-body ul{display:grid;gap:8px;margin:0 0 18px;padding-left:20px}.dh-reader-body li{padding-left:3px}.dh-acknowledge-box{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:27px;border:1px solid #f0d39f;border-radius:17px;background:#fff9ee;padding:14px}.dark .dh-acknowledge-box{background:#2c2214;border-color:#5b431d}.dh-acknowledge-box.done{border-color:#bde4cc;background:#f0fbf5}.dark .dh-acknowledge-box.done{background:#13261d;border-color:#24563b}.dh-acknowledge-box>div{display:flex;align-items:center;gap:11px}.dh-acknowledge-box>div>i{font-size:19px;color:#d28b24}.dh-acknowledge-box.done>div>i{color:#31945b}.dh-acknowledge-box strong,.dh-acknowledge-box small{display:block}.dh-acknowledge-box strong{font-size:10px}.dh-acknowledge-box small{margin-top:3px;color:#8d98a8;font-size:8px}.dh-document-audience{border-left:1px solid #e0e5eb;background:#f5f7f9;padding:24px 20px}.dark .dh-document-audience{border-color:#293444;background:#0b111b}.dh-audience-head>span{color:var(--accent);font-size:7px;font-weight:900;letter-spacing:.15em}.dh-audience-head h3{margin-top:7px;font-size:16px;font-weight:850}.dh-audience-head p{margin-top:5px;color:#929dad;font-size:9px;line-height:1.45}.dh-audience-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:17px 0}.dh-audience-summary div{border-radius:11px;background:#fff;padding:10px}.dark .dh-audience-summary div{background:#151e2b}.dh-audience-summary b,.dh-audience-summary span{display:block}.dh-audience-summary b{font-size:16px}.dh-audience-summary span{margin-top:2px;color:#929dad;font-size:7px;text-transform:uppercase}.dh-audience-list{display:grid;gap:7px}.dh-audience-person{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:8px;border:1px solid #e5e9ee;border-radius:12px;background:#fff;padding:8px}.dark .dh-audience-person{border-color:#283344;background:#131c29}.dh-audience-avatar{display:flex;width:32px;height:32px;align-items:center;justify-content:center;border-radius:50%;object-fit:cover;background:#243044;color:#fff;font-size:8px;font-weight:850}.dh-audience-copy{min-width:0}.dh-audience-copy strong,.dh-audience-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dh-audience-copy strong{font-size:8px}.dh-audience-copy span{margin-top:3px;color:#929dad;font-size:6.5px}.dh-audience-status{border-radius:999px;padding:4px 6px;font-size:6px;font-weight:900;text-transform:uppercase}.dh-audience-status.acknowledged{background:#e8f8ef;color:#238650}.dh-audience-status.viewed{background:#eaf1ff;color:#376ac3}.dh-audience-status.pending{background:#eef1f4;color:#8490a0}.dh-audience-loading,.dh-audience-empty{padding:26px 8px;text-align:center;color:#929dad;font-size:9px}.dh-audience-loading i{margin-right:6px}
      .dh-member-modal{width:min(980px,95vw);max-height:92vh;border-radius:28px}.dh-member-cover{position:relative;height:125px;overflow:hidden;background:radial-gradient(circle at 78% 20%,color-mix(in srgb,var(--accent) 50%,transparent),transparent 26%),linear-gradient(125deg,#070d18,#1b2639)}.dh-member-cover:after{content:'';position:absolute;right:-30px;top:-125px;width:350px;height:350px;border:1px solid rgba(255,255,255,.06);border-radius:50%;box-shadow:0 0 0 55px rgba(255,255,255,.02),0 0 0 110px rgba(255,255,255,.015)}.dh-member-cover .dh-close{position:absolute;z-index:2;right:22px;top:21px}.dh-member-cover-mark{position:absolute;left:28px;top:25px;color:rgba(255,255,255,.09);font-size:42px;font-weight:950;letter-spacing:-.05em}.dh-member-profile{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:end;gap:17px;padding:0 28px 22px;border-bottom:1px solid #e7ebf0}.dark .dh-member-profile{border-color:#283344}.dh-member-avatar{display:flex;width:104px;height:104px;align-items:center;justify-content:center;margin-top:-50px;border:5px solid #fff;border-radius:24px;object-fit:cover;background:#263246;color:#fff;font-size:19px;font-weight:900;box-shadow:0 13px 30px rgba(15,23,42,.18)}.dark .dh-member-avatar{border-color:#0d1420}.dh-member-identity{padding-top:17px}.dh-member-identity h2{font-size:24px;line-height:1.05;font-weight:880;letter-spacing:-.035em}.dh-member-identity p{margin-top:6px;color:#7f8a9b;font-size:11px}.dh-member-body{display:grid;grid-template-columns:220px minmax(0,1fr);gap:27px;padding:25px 28px 30px}.dh-member-facts{display:grid;align-content:start;gap:8px}.dh-member-facts div{border-radius:13px;background:#f4f6f8;padding:11px 12px}.dark .dh-member-facts div{background:#151e2b}.dh-member-facts span,.dh-member-facts strong{display:block}.dh-member-facts span{color:#95a0b0;font-size:7px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.dh-member-facts strong{margin-top:5px;font-size:9px;line-height:1.35;overflow-wrap:anywhere}.dh-member-role{display:grid;gap:25px}.dh-member-focus{margin-top:10px}.dh-member-focus span{padding:8px 11px;font-size:9px}.dh-member-responsibilities{list-style:none;margin:11px 0 0;padding:0;counter-reset:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dh-member-responsibilities li{display:flex;gap:11px;border:1px solid #e8ecf1;border-radius:14px;padding:12px}.dark .dh-member-responsibilities li{border-color:#283445}.dh-member-responsibilities li>span{color:var(--accent);font-size:8px;font-weight:900}.dh-member-responsibilities p{font-size:9px;line-height:1.45;color:#4d596b}.dark .dh-member-responsibilities p{color:#c7d0dc}
      @media(max-width:1100px){.dh-card{grid-column:span 6}.dh-span-7,.dh-span-8,.dh-span-5{grid-column:span 6}.dh-doc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dh-team-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dh-team-grid:before,.dh-team-grid .dh-person:before{display:none}.dh-team-grid{padding-top:0}.dh-org-line{display:none}}
      @media(max-width:1250px){.dh-org-branches{grid-template-columns:repeat(3,minmax(120px,1fr));row-gap:42px}.dh-org-branches:before,.dh-org-branch:before{display:none}.dh-document-layout.with-audience{grid-template-columns:minmax(0,1fr) 290px}.dh-document-meta{grid-template-columns:1.5fr 1fr 1fr}.dh-meta-item:last-child{grid-column:span 3}}
      @media(max-width:760px){.dh-hero{padding:24px 20px}.dh-hero-grid{grid-template-columns:1fr}.dh-hero-card{display:none}.dh-card,.dh-span-5,.dh-span-7,.dh-span-8,.dh-span-12{grid-column:span 12}.dh-doc-grid,.dh-role-grid,.dh-team-grid{grid-template-columns:1fr}.dh-toolbar,.dh-library-tools{align-items:stretch;flex-direction:column}.dh-knowledge-head{align-items:stretch;flex-direction:column}.dh-search{min-width:0}.dh-form-row{grid-template-columns:1fr}.dh-stat-row{grid-template-columns:1fr 1fr}.dh-review-strip{align-items:flex-start;flex-direction:column}.dh-shell{padding-bottom:24px}.dh-org-board{padding:100px 18px 35px}.dh-org-board-title{left:20px}.dh-org-branches{grid-template-columns:repeat(2,minmax(110px,1fr))}.dh-org-node{max-width:145px}.dh-document-modal{width:96vw}.dh-document-top{padding:24px 21px}.dh-document-top h2{font-size:22px}.dh-document-layout.with-audience{grid-template-columns:1fr}.dh-document-paper{padding:21px}.dh-document-meta{grid-template-columns:1fr 1fr}.dh-effective-date{grid-column:span 2}.dh-meta-item:last-child{grid-column:span 2}.dh-document-audience{border-left:0;border-top:1px solid #e0e5eb}.dh-acknowledge-box{align-items:stretch;flex-direction:column}.dh-member-profile{grid-template-columns:auto 1fr;padding:0 20px 20px}.dh-member-profile>.dh-btn{grid-column:span 2}.dh-member-avatar{width:82px;height:82px}.dh-member-body{grid-template-columns:1fr;padding:21px}.dh-member-responsibilities{grid-template-columns:1fr}}
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
      const [teamRes, rolesRes, docsRes, ackRes] = await Promise.all([
        supabaseClient.rpc('team_directory'),
        supabaseClient.from('department_hub_team_roles').select('*').order('sort_order'),
        supabaseClient.from('department_hub_documents').select('*').order('sort_order').order('updated_at', { ascending: false }),
        supabaseClient.from('department_hub_acknowledgements').select('document_id,user_id,acknowledged_at').eq('user_id', uid)
      ]);
      const firstError = [teamRes, rolesRes, docsRes, ackRes].find(result => result.error)?.error;
      if (firstError) throw firstError;
      Hub.team = (teamRes.data || []).filter(person => person.full_name !== 'ADMIN');
      Hub.roles = rolesRes.data || [];
      Hub.documents = docsRes.data || [];
      Hub.acknowledgements = ackRes.data || [];
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
    return `<section class="dh-hero">
      <div class="dh-hero-grid">
        <div>
          <div class="dh-kicker"><span class="dh-kicker-dot"></span>TAAMEER Marketing Department</div>
          <h2>People, structure<br>and standards.</h2>
          <p>One clear place to understand who does what and find the department's approved documents.</p>
          <div class="dh-hero-meta">
            <button class="dh-chip" onclick="DepartmentHub.goTo('team')"><i class="fas fa-sitemap"></i>View team structure</button>
            <button class="dh-chip" onclick="DepartmentHub.goTo('knowledge')"><i class="fas fa-book-open"></i>Open knowledge library</button>
          </div>
        </div>
        <div class="dh-hero-card">
          <div class="dh-hero-card-label">You are here</div>
          <div class="dh-hero-card-row">${avatar(person, 'dh-mini-avatar')}<div><strong>${esc(person.full_name || 'Team member')}</strong><span>${esc(person.job_title || 'Marketing Department')}</span></div></div>
          <div class="dh-hero-summary"><span><b>${Hub.team.length}</b> members</span><span><b>${published('policy').length + published('procedure').length}</b> documents</span>${required ? `<span class="attention"><b>${required}</b> to review</span>` : '<span class="clear"><i class="fas fa-circle-check"></i> Up to date</span>'}</div>
        </div>
      </div>
    </section>`;
  }

  function structure() {
    const lead = manager();
    const team = Hub.team.filter(person => String(person.id) !== String(lead?.id));
    const personCard = (person, leadCard = false) => {
      const role = roleFor(person.id);
      return `<button class="dh-org-node ${leadCard ? 'lead' : 'member'}" onclick="DepartmentHub.openRole('${esc(person.id)}')"><span class="dh-org-level">${leadCard ? 'Department lead' : 'Team member'}</span><span class="dh-org-photo">${avatar(person, 'dh-org-avatar')}</span><strong>${esc(person.full_name)}</strong><small>${esc(person.job_title || 'Marketing Department')}</small>${!leadCard ? `<span class="dh-org-focus">${esc((role.focus_areas || [])[0] || 'View role')}</span>` : ''}</button>`;
    };
    return `<section class="dh-card dh-span-12 dh-section dh-structure-shell" id="dh-team"><div class="dh-card-head"><div><span class="dh-section-number">01</span><h3>Marketing organization chart</h3><p class="dh-card-sub">A visual view of the team. Select a person to open their role and responsibilities.</p></div><span class="dh-pill">${Hub.team.length} members</span></div><div class="dh-org-board"><div class="dh-org-board-title"><span>TAAMEER</span><strong>MARKETING<br>DEPARTMENT</strong></div><div class="dh-org-mark">T</div>${lead ? `<div class="dh-org-lead">${personCard(lead, true)}</div><div class="dh-org-trunk"></div>` : ''}<div class="dh-org-branches">${team.map(person => `<div class="dh-org-branch">${personCard(person)}</div>`).join('')}</div></div></section>`;
  }

  function knowledge() {
    const query = Hub.search.trim().toLowerCase();
    const items = Hub.documents.filter(doc => (canEdit() || doc.status === 'published') && (Hub.docFilter === 'all' || doc.kind === Hub.docFilter) && (!query || `${doc.title} ${doc.summary} ${doc.category} ${doc.owner}`.toLowerCase().includes(query)));
    const required = items.filter(doc => doc.status === 'published' && doc.is_required && !acknowledged(doc.id));
    return `<section class="dh-card dh-span-12 dh-section" id="dh-knowledge"><div class="dh-knowledge-head"><div><span class="dh-section-number">02</span><h3>Knowledge library</h3><p class="dh-card-sub">Policies and procedures together—search once, find the approved answer.</p></div>${canEdit() ? `<button class="dh-btn primary" onclick="DepartmentHub.editDocument(null,'policy')"><i class="fas fa-plus"></i>Add document</button>` : ''}</div>${required.length ? `<button class="dh-review-strip" onclick="DepartmentHub.openDocument('${esc(required[0].id)}')"><span><i class="fas fa-circle-exclamation"></i><strong>${required.length} document${required.length === 1 ? '' : 's'} need your review</strong></span><span>Start reviewing <i class="fas fa-arrow-right"></i></span></button>` : ''}<div class="dh-library-tools"><div class="dh-filter" role="group" aria-label="Document type">${[['all','All'],['policy','Policies'],['procedure','Procedures']].map(([id,label]) => `<button class="${Hub.docFilter === id ? 'active' : ''}" onclick="DepartmentHub.filterDocs('${id}')">${label}<span>${id === 'all' ? Hub.documents.filter(d => canEdit() || d.status === 'published').length : published(id).length}</span></button>`).join('')}</div><label class="dh-search"><i class="fas fa-search"></i><input value="${esc(Hub.search)}" oninput="DepartmentHub.search(this.value)" placeholder="Search documents…"></label></div>${items.length ? `<div class="dh-doc-grid">${items.map(docCard).join('')}</div>` : `<div class="dh-empty"><i class="fas fa-folder-open"></i>${query ? 'No document matches your search.' : 'No documents are available in this category yet.'}</div>`}</section>`;
  }

  function docCard(doc) {
    const isAck = acknowledged(doc.id);
    return `<article class="dh-doc ${doc.kind}" onclick="DepartmentHub.openDocument('${esc(doc.id)}')"><div class="dh-doc-top"><span class="dh-doc-icon"><i class="fas ${doc.kind === 'policy' ? 'fa-shield-halved' : 'fa-list-check'}"></i></span><div style="display:flex;gap:6px">${doc.status !== 'published' ? `<span class="dh-pill draft">${esc(doc.status)}</span>` : ''}${doc.is_required ? `<span class="dh-pill ${isAck ? '' : 'required'}">${isAck ? 'Read' : 'Required'}</span>` : ''}</div></div><div class="dh-doc-type">${doc.kind === 'policy' ? 'Policy & standard' : 'Procedure & SOP'}</div><h3>${esc(doc.title)}</h3><p>${esc(doc.summary || 'Open this document to read the full guidance.')}</p><div class="dh-doc-footer"><div><span>${esc(doc.category)}</span><span>v${esc(doc.version)}</span></div><span class="dh-doc-open">Open <i class="fas fa-arrow-right"></i></span></div>${canEdit() ? `<button class="dh-doc-edit" onclick="event.stopPropagation();DepartmentHub.editDocument('${esc(doc.id)}')" aria-label="Edit ${esc(doc.title)}"><i class="fas fa-pen"></i></button>` : ''}</article>`;
  }

  function render() {
    injectStyles();
    const view = ensureView();
    view.innerHTML = `<div class="dh-shell">${hero()}<main class="dh-grid dh-main">${structure()}${knowledge()}</main></div>`;
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

  function formatDocumentBody(value) {
    const blocks = String(value || '').trim().split(/\n\s*\n/).filter(Boolean);
    if (!blocks.length) return '<p>No content has been added yet.</p>';
    return blocks.map(block => {
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every(line => /^[-•]/.test(line))) return `<ul>${lines.map(line => `<li>${esc(line.replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul>`;
      if (lines.length === 1 && (lines[0].endsWith(':') || /^#{1,3}\s/.test(lines[0]))) return `<h4>${esc(lines[0].replace(/^#{1,3}\s*/, '').replace(/:$/, ''))}</h4>`;
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    }).join('');
  }

  async function loadDocumentAudience(doc) {
    const host = document.getElementById('dhReaderAudience');
    if (!host || !isAdmin()) return;
    const [viewsRes, ackRes, profilesRes] = await Promise.all([
      supabaseClient.from('department_hub_document_views').select('user_id,first_viewed_at,last_viewed_at,view_count').eq('document_id', doc.id),
      supabaseClient.from('department_hub_acknowledgements').select('user_id,acknowledged_at').eq('document_id', doc.id),
      supabaseClient.from('profiles').select('id,full_name,job_title,avatar,modules,status').eq('status', 'active')
    ]);
    const error = viewsRes.error || ackRes.error || profilesRes.error;
    if (error) { host.innerHTML = '<div class="dh-audience-empty">Audience data could not be loaded.</div>'; return; }
    const audience = (profilesRes.data || []).filter(person => Array.isArray(person.modules) && person.modules.includes('department-hub'));
    const views = new Map((viewsRes.data || []).map(row => [String(row.user_id), row]));
    const acks = new Map((ackRes.data || []).map(row => [String(row.user_id), row]));
    const rows = audience.map(person => ({ person, view: views.get(String(person.id)), ack: acks.get(String(person.id)) })).sort((a, b) => Number(Boolean(a.ack)) - Number(Boolean(b.ack)) || Number(Boolean(a.view)) - Number(Boolean(b.view)));
    const viewed = rows.filter(row => row.view).length;
    const acked = rows.filter(row => row.ack).length;
    host.innerHTML = `<div class="dh-audience-summary"><div><b>${audience.length}</b><span>Audience</span></div><div><b>${viewed}</b><span>Viewed</span></div>${doc.is_required ? `<div><b>${acked}</b><span>Acknowledged</span></div>` : ''}</div><div class="dh-audience-list">${rows.map(({ person, view, ack }) => `<div class="dh-audience-person">${avatar(person, 'dh-audience-avatar')}<div class="dh-audience-copy"><strong>${esc(person.full_name)}</strong><span>${ack ? `Acknowledged · ${niceDateTime(ack.acknowledged_at)}` : view ? `Viewed · ${niceDateTime(view.last_viewed_at)}` : 'Not viewed yet'}</span></div><span class="dh-audience-status ${ack ? 'acknowledged' : view ? 'viewed' : 'pending'}">${ack ? 'Acknowledged' : view ? 'Viewed' : 'Pending'}</span></div>`).join('') || '<div class="dh-audience-empty">No members currently have access to this Hub.</div>'}</div>`;
  }

  async function openDocument(id, trackView = true) {
    const doc = Hub.documents.find(item => String(item.id) === String(id));
    if (!doc) return;
    const isAck = acknowledged(doc.id);
    overlay(`<article class="dh-modal dh-document-modal"><header class="dh-document-top"><div><span class="dh-document-type"><i class="fas ${doc.kind === 'policy' ? 'fa-shield-halved' : 'fa-list-check'}"></i>${doc.kind === 'policy' ? 'Department policy' : 'Department procedure'}</span><h2>${esc(doc.title)}</h2><p>${esc(doc.summary || 'Approved department guidance')}</p></div><button class="dh-close dark" onclick="DepartmentHub.closeOverlay()"><i class="fas fa-xmark"></i></button></header><div class="dh-document-layout ${isAdmin() ? 'with-audience' : ''}"><main class="dh-document-paper"><div class="dh-document-meta"><div class="dh-effective-date"><i class="fas fa-calendar-day"></i><div><span>Effective date</span><strong>${niceDate(doc.effective_date)}</strong></div></div><div class="dh-meta-item"><span>Category</span><strong>${esc(doc.category)}</strong></div><div class="dh-meta-item"><span>Version</span><strong>${esc(doc.version)}</strong></div><div class="dh-meta-item"><span>Document owner</span><strong>${esc(doc.owner)}</strong></div></div><div class="dh-document-rule"><span>Approved department document</span><span>Updated ${niceDateTime(doc.updated_at)}</span></div><div class="dh-reader-body">${formatDocumentBody(doc.body || doc.summary)}</div>${doc.is_required && doc.status === 'published' ? `<div class="dh-acknowledge-box ${isAck ? 'done' : ''}"><div><i class="fas ${isAck ? 'fa-circle-check' : 'fa-file-signature'}"></i><span><strong>${isAck ? 'You acknowledged this document' : 'Acknowledgement required'}</strong><small>${isAck ? 'Your confirmation has been recorded.' : 'Confirm only after reading the complete document.'}</small></span></div><button class="dh-btn ${isAck ? '' : 'accent'}" onclick="DepartmentHub.toggleAcknowledgement('${esc(doc.id)}')">${isAck ? 'Acknowledged' : 'I have read and understood'}</button></div>` : ''}</main>${isAdmin() ? `<aside class="dh-document-audience"><div class="dh-audience-head"><span>ADMIN VIEW</span><h3>Reading status</h3><p>Live status for members who currently have access.</p></div><div id="dhReaderAudience"><div class="dh-audience-loading"><i class="fas fa-circle-notch fa-spin"></i>Loading audience…</div></div></aside>` : ''}</div></article>`);
    if (trackView) {
      const { error } = await supabaseClient.rpc('record_department_hub_document_view', { p_document_id: doc.id });
      if (error) console.error('Could not record document view', error);
    }
    if (isAdmin()) await loadDocumentAudience(doc);
  }

  function editDocument(id, fallbackKind = 'policy') {
    if (!canEdit()) return;
    const doc = Hub.documents.find(item => String(item.id) === String(id)) || { kind: fallbackKind, title: '', summary: '', body: '', category: 'General', owner: 'Marketing Management', version: '1.0', effective_date: new Date().toISOString().slice(0, 10), is_required: false, status: 'draft', sort_order: 100 };
    overlay(`<section class="dh-modal"><header class="dh-modal-head"><h3>${id ? 'Edit department document' : 'Add department document'}</h3><button class="dh-close" onclick="DepartmentHub.closeOverlay()"><i class="fas fa-xmark"></i></button></header><div class="dh-modal-body"><form class="dh-form" onsubmit="DepartmentHub.saveDocument(event,'${id ? esc(id) : ''}')"><div class="dh-form-row"><div class="dh-field"><label>Type</label><select name="kind"><option value="policy" ${doc.kind === 'policy' ? 'selected' : ''}>Policy / standard</option><option value="procedure" ${doc.kind === 'procedure' ? 'selected' : ''}>Procedure / SOP</option></select></div><div class="dh-field"><label>Status</label><select name="status"><option value="draft" ${doc.status === 'draft' ? 'selected' : ''}>Draft — editors only</option><option value="published" ${doc.status === 'published' ? 'selected' : ''}>Published — visible to members</option><option value="archived" ${doc.status === 'archived' ? 'selected' : ''}>Archived — editors only</option></select></div></div><div class="dh-field"><label>Title</label><input name="title" required value="${esc(doc.title)}"></div><div class="dh-field"><label>Short summary</label><textarea name="summary" style="min-height:75px">${esc(doc.summary)}</textarea></div><div class="dh-field"><label>Full content</label><textarea name="body" required>${esc(doc.body)}</textarea></div><div class="dh-form-row"><div class="dh-field"><label>Category</label><input name="category" value="${esc(doc.category)}"></div><div class="dh-field"><label>Owner</label><input name="owner" value="${esc(doc.owner)}"></div></div><div class="dh-form-row"><div class="dh-field"><label>Version</label><input name="version" value="${esc(doc.version)}"></div><div class="dh-field"><label>Effective date</label><input type="date" name="effective_date" value="${esc(doc.effective_date || '')}"></div></div><label style="display:flex;align-items:center;gap:9px;font-size:11px;font-weight:750"><input type="checkbox" name="is_required" ${doc.is_required ? 'checked' : ''}>Require every member to acknowledge this</label><div class="dh-form-actions">${id && canDelete() ? `<button type="button" class="dh-btn danger" style="margin-right:auto" onclick="DepartmentHub.deleteDocument('${esc(id)}')"><i class="fas fa-trash"></i>Delete</button>` : ''}<button type="button" class="dh-btn" onclick="DepartmentHub.closeOverlay()">Cancel</button><button class="dh-btn primary" type="submit"><i class="fas fa-check"></i>Save document</button></div></form></div></section>`);
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
    if (!canDelete() || !confirm('Delete this department document?')) return;
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
    openDocument(id, false);
  }

  function openRole(userId) {
    const person = Hub.team.find(item => String(item.id) === String(userId));
    const role = roleFor(userId);
    if (!person) return;
    const responsibilities = role.responsibilities || [];
    const reportsTo = Hub.team.find(item => String(item.id) === String(role.reports_to || ''));
    overlay(`<article class="dh-modal dh-member-modal"><header class="dh-member-cover"><div class="dh-member-cover-mark">TAAMEER</div><button class="dh-close dark" onclick="DepartmentHub.closeOverlay()"><i class="fas fa-xmark"></i></button></header><div class="dh-member-profile">${avatar(person, 'dh-member-avatar')}<div class="dh-member-identity"><span class="dh-modal-eyebrow">Role in the department</span><h2>${esc(person.full_name)}</h2><p>${esc(person.job_title || 'Marketing Department')}</p></div>${canEdit() ? `<button class="dh-btn primary" onclick="DepartmentHub.editRole('${esc(userId)}')"><i class="fas fa-pen"></i>Edit role</button>` : ''}</div><div class="dh-member-body"><aside class="dh-member-facts"><div><span>Reports to</span><strong>${esc(reportsTo?.full_name || (String(person.id) === String(manager()?.id) ? 'TAAMEER Management' : manager()?.full_name || 'Department lead'))}</strong></div><div><span>Focus areas</span><strong>${(role.focus_areas || []).length}</strong></div><div><span>Core responsibilities</span><strong>${responsibilities.length}</strong></div>${person.email ? `<div><span>Email</span><strong>${esc(person.email)}</strong></div>` : ''}</aside><main class="dh-member-role"><section><span class="dh-modal-eyebrow">Focus areas</span><div class="dh-focus dh-member-focus">${(role.focus_areas || []).map(area => `<span>${esc(area)}</span>`).join('') || '<span>Department support</span>'}</div></section><section><span class="dh-modal-eyebrow">Responsibilities</span>${responsibilities.length ? `<ol class="dh-member-responsibilities">${responsibilities.map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${esc(item)}</p></li>`).join('')}</ol>` : '<div class="dh-empty">Responsibilities have not been added yet.</div>'}</section></main></div></article>`);
  }

  function editRole(userId) {
    if (!canEdit()) return;
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

  function goTo(section) { document.getElementById(section === 'team' ? 'dh-team' : 'dh-knowledge')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function filterDocs(filter) { if (!['all', 'policy', 'procedure'].includes(filter)) return; Hub.docFilter = filter; render(); goTo('knowledge'); }
  function search(value) { Hub.search = value; render(); const input = document.querySelector('.dh-search input'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
  async function reload() { Hub.loaded = false; await load(); }

  window.DepartmentHub = { open: load, reload, goTo, filterDocs, search, openDocument, editDocument, saveDocument, deleteDocument, toggleAcknowledgement, openRole, editRole, saveRole, closeOverlay };

  ModuleRegistry.register('department-hub', () => {
    if (Hub.loaded) render();
    else if (!Hub.loading) renderLoading();
  });

  const priorSidebar = window.renderSidebar;
  window.renderSidebar = function() {
    priorSidebar?.();
    const nav = document.getElementById('sidebarNav');
    if (!nav || !state.currentUser) return;
    nav.querySelectorAll('[data-department-hub-nav="title"]').forEach(node => node.remove());
    const item = [...nav.querySelectorAll('.nav-item')].find(node => node.querySelector('.nav-label')?.textContent.trim() === 'Department Hub');
    if (!item) return;
    const module = state.modules?.find(entry => entry.id === 'department-hub');
    const hasView = state.currentUser.role === 'admin' || state.permissions?.user?.['department-hub']?.view !== false;
    const assigned = state.currentUser.role === 'admin' || state.currentUser.modules?.includes('department-hub');
    const status = module?.controlStatus || (module?.status === 'disabled' ? 'hidden' : module?.status === 'soon' ? 'maintenance' : 'live');
    if (!hasView || !assigned || (status === 'hidden' && state.currentUser.role !== 'admin')) {
      item.remove();
      return;
    }
    const title = document.createElement('div');
    title.className = 'section-title sidebar-label mt-2';
    title.dataset.departmentHubNav = 'title';
    title.textContent = 'Department';
    item.dataset.departmentHubNav = 'item';
    const adminTitle = [...nav.querySelectorAll('.section-title')].find(node => node.textContent.trim() === 'Administration');
    if (adminTitle) { nav.insertBefore(title, adminTitle); nav.insertBefore(item, adminTitle); }
    else { nav.append(title, item); }
  };

  const priorShowView = window.showView;
  window.showView = function(viewName) {
    if (viewName !== 'department-hub') return priorShowView?.(viewName);
    if (!state.currentUser) return;
    const module = state.modules?.find(entry => entry.id === 'department-hub');
    if (!module) return;
    const status = module.controlStatus || (module.status === 'disabled' ? 'hidden' : module.status === 'soon' ? 'maintenance' : 'live');
    const result = priorShowView?.(viewName);
    const target = document.getElementById('view-department-hub');
    if (!target || target.classList.contains('hidden')) return result;
    if (state.currentUser.role !== 'admin' && status === 'maintenance') return result;
    document.getElementById('headerTitle').textContent = 'Department Hub';
    document.getElementById('headerSubtitle').textContent = 'People, roles and the way we work';
    window.renderSidebar?.();
    window.closeUserDropdown?.();
    window.VaultApp?.syncQuickCapture?.('department-hub');
    if (!Hub.loaded) load(); else render();
    return result;
  };

  injectStyles();
  ensureView();
})();
