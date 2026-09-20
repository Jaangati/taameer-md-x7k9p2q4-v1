// TAAMEER Agent Campaigns — sales-agent account readiness, media budgets and lead campaigns.
(() => {
  const H = {
    loaded: false,
    loading: false,
    tab: "overview",
    month: new Date().toISOString().slice(0, 7) + "-01",
    agents: [],
    accounts: [],
    months: [],
    allocations: [],
    campaigns: [],
    updates: [],
    statusUpdates: [],
    dailyCheckins: [],
    people: [],
    permissions: null,
    search: "",
    filter: "all",
  };
  let root;
  const esc = (v) => Utils.escapeHTML(String(v ?? ""));
  const uid = () => String(state.currentUser?.id || "");
  const money = (v) =>
    new Intl.NumberFormat("en-QA", {
      style: "currency",
      currency: "QAR",
      maximumFractionDigits: 0,
    }).format(Number(v) || 0);
  const number = (v) =>
    new Intl.NumberFormat("en-US", {
      notation: Number(v) > 9999 ? "compact" : "standard",
      maximumFractionDigits: 1,
    }).format(Number(v) || 0);
  const fmt = (v) =>
    v
      ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString(
          "en-GB",
          { day: "2-digit", month: "short", year: "numeric" },
        )
      : "Not set";
  const initials = (v) =>
    String(v || "Agent")
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0] || "")
      .join("")
      .toUpperCase();
  const month = () => H.months.find((x) => x.month_start === H.month);
  const periodLabel = (m) =>
    new Date((m?.month_start || H.month) + "T12:00:00").toLocaleDateString(
      "en-US",
      { month: "long", year: "numeric" },
    );
  const monthRange = (m) => {
    const start = m?.month_start || H.month,
      d = new Date(`${start}T12:00:00`),
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${fmt(start)} – ${fmt(end.toISOString().slice(0, 10))}`;
  };
  const account = (id) =>
    H.accounts.find((x) => String(x.agent_id) === String(id));
  const allocation = (id) =>
    H.allocations.find(
      (x) =>
        String(x.agent_id) === String(id) &&
        String(x.month_id) === String(month()?.id),
    );
  const campaignsFor = (id) =>
    H.campaigns.filter((x) => String(x.agent_id) === String(id));
  const latestUpdate = (id) =>
    H.updates
      .filter((x) => String(x.campaign_id) === String(id))
      .sort((a, b) =>
        String(b.report_date).localeCompare(String(a.report_date)),
      )[0];
  const spendForCampaign = (id) => Number(latestUpdate(id)?.spend || 0);
  const active = (c) => ["active", "learning", "scheduled"].includes(c.status);
  const dailyFor = (id) =>
    H.dailyCheckins
      .filter((x) => String(x.campaign_id) === String(id))
      .sort((a, b) =>
        String(b.checkin_date).localeCompare(String(a.checkin_date)),
      );
  const dailySummary = (c) => {
    const rows = dailyFor(c.id),
      today = new Date().toISOString().slice(0, 10);
    return {
      rows,
      missed: rows.filter((x) => x.state === "missed").length,
      today: rows.find((x) => x.checkin_date === today),
    };
  };
  const isDue = (c) => {
    if (!["active", "learning"].includes(c.status)) return false;
    const d = dailySummary(c);
    return d.missed > 0 || !d.today || d.today.state !== "completed";
  };
  const canBudget = () =>
    state.currentUser?.role === "admin" || H.permissions?.can_manage_budget;
  const canSecrets = () =>
    state.currentUser?.role === "admin" || H.permissions?.can_view_credentials;
  const statusLabel = (v) =>
    ({
      no_account: "No account",
      setup_required: "Setup required",
      under_setup: "Under setup",
      access_pending: "Access pending",
      ready: "Ready",
      campaign_active: "Campaign active",
      paused: "Paused",
      offboarded: "Offboarded",
      draft: "Draft",
      scheduled: "Scheduled",
      active: "Active",
      learning: "Learning",
      completed: "Completed",
      cancelled: "Cancelled",
    })[v] || v;
  const agentPhoto = (a, cls = "") =>
    a.profile_photo_url
      ? `<img class="ach-avatar ${cls}" src="${esc(a.profile_photo_url)}" alt="">`
      : `<span class="ach-avatar ach-fallback ${cls}">${esc(initials(a.full_name_en))}</span>`;
  const readinessKeys = [
    ["two_factor_enabled", "2FA enabled"],
    ["credentials_saved", "Credentials secured"],
    ["profile_picture_approved", "Profile picture ready"],
    ["starting_posts_setup_done", "Starting posts setup"],
    ["bio_added_correctly", "Bio added"],
    ["job_title_added", "Job title added"],
    ["agent_informed", "Agent informed"],
    ["ads_manager_linked", "Linked to main Ads Manager"],
  ];
  const readiness = (a) => {
    const x = account(a.id);
    if (!x) return 0;
    return (
      (readinessKeys.filter(([key]) => Boolean(x[key])).length /
        readinessKeys.length) *
      100
    );
  };
  const statusHistory = (id) =>
    H.statusUpdates
      .filter((x) => String(x.campaign_id) === String(id))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const tone = (s) =>
    ["ready", "campaign_active", "active", "completed"].includes(s)
      ? "green"
      : [
            "setup_required",
            "under_setup",
            "scheduled",
            "learning",
            "draft",
          ].includes(s)
        ? "amber"
        : ["no_account", "access_pending", "paused", "cancelled"].includes(s)
          ? "red"
          : "gray";
  const safeUrl = (value) => {
    try {
      const u = new URL(value);
      return /^https?:$/.test(u.protocol) ? u.href : "";
    } catch (_) {
      return "";
    }
  };
  const slug = (value) =>
    String(value || "download")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function toast(message) {
    let t = document.getElementById("agentCampaignToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "agentCampaignToast";
      t.className = "ach-toast";
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(H.toastTimer);
    H.toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }
  async function copyText(value, label = "Detail") {
    if (!value) return toast(`${label} is not available yet.`);
    try {
      await navigator.clipboard.writeText(String(value));
      toast(`${label} copied.`);
    } catch (_) {
      toast("Copy was blocked by the browser.");
    }
  }
  const contactRow = (label, value, key, full = false) =>
    `<div class="ach-contact ${full ? "full" : ""}"><label>${label}</label><strong title="${esc(value || "Not added")}">${esc(value || "Not added")}</strong>${value ? `<button class="ach-copy" title="Copy ${esc(label)}" onclick="AgentCampaigns.copyAgent('${key}')"><i class="fas fa-copy"></i></button>` : ""}</div>`;
  function agentPack(a, x) {
    return [
      `Name: ${a.full_name_en || ""}`,
      a.full_name_ar ? `Arabic name: ${a.full_name_ar}` : "",
      x?.username ? `Instagram: @${x.username}` : "",
      x?.profile_url ? `Profile: ${x.profile_url}` : "",
      a.company_email ? `Company email: ${a.company_email}` : "",
      a.work_phone ? `Work phone: ${a.work_phone}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function ensureView() {
    root = document.getElementById("view-agent-campaigns");
    if (!root) {
      root = document.createElement("div");
      root.id = "view-agent-campaigns";
      root.className = "view-section hidden fade-in";
      document.getElementById("mainContent")?.appendChild(root);
    }
    root.dataset.generated = "true";
  }
  function styles() {
    if (document.getElementById("agentCampaignStyles")) return;
    const s = document.createElement("style");
    s.id = "agentCampaignStyles";
    s.textContent = `
    #view-agent-campaigns{min-height:100%;color:#111827}.ach-shell{max-width:1580px;margin:0 auto;padding:4px 2px 50px}.ach-hero{position:relative;overflow:hidden;border-radius:28px;padding:34px 38px;background:linear-gradient(120deg,#080d1b 0%,#111827 58%,color-mix(in srgb,var(--accent) 55%,#111827) 145%);color:#fff;box-shadow:0 24px 55px rgba(15,23,42,.16)}.ach-hero:after{content:"GROWTH";position:absolute;right:-12px;bottom:-38px;font-weight:950;font-size:130px;letter-spacing:-8px;color:rgba(255,255,255,.035)}.ach-hero-top{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;position:relative;z-index:1}.ach-kicker{font-size:10px;font-weight:900;letter-spacing:.19em;text-transform:uppercase;color:#98a2b3}.ach-hero .ach-kicker{color:#d0d5dd}.ach-hero h2{font-size:36px;font-weight:850;letter-spacing:-.04em;line-height:1.03;margin:9px 0}.ach-hero p{font-size:12px;color:#cbd5e1;max-width:650px}.ach-actions,.ach-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ach-btn{border:1px solid #e4e7ec;background:#fff;color:#101828;border-radius:12px;padding:10px 14px;font-size:11px;font-weight:850;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;transition:.18s}.ach-btn:hover{transform:translateY(-1px);box-shadow:0 9px 20px rgba(15,23,42,.09)}.ach-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.ach-btn.dark{background:#0b1020;border-color:#0b1020;color:#fff}.ach-btn.ghost{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.13);color:#fff}.ach-btn.sm{padding:7px 10px;border-radius:9px;font-size:10px}.ach-month{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);color:#fff;border-radius:12px;padding:10px 12px;font-size:11px;font-weight:800}.ach-budget{display:grid;grid-template-columns:repeat(4,1fr);margin-top:27px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.055);backdrop-filter:blur(12px);position:relative;z-index:1}.ach-budget-item{padding:18px 22px;border-right:1px solid rgba(255,255,255,.1)}.ach-budget-item:last-child{border:0}.ach-budget-item strong{display:block;font-size:24px;letter-spacing:-.04em}.ach-budget-item span{font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#98a2b3}.ach-nav{display:flex;gap:5px;margin:18px 0;background:#e9ecf1;padding:5px;border-radius:14px;width:max-content}.ach-tab{border:0;background:transparent;color:#667085;padding:10px 16px;border-radius:10px;font-size:11px;font-weight:850}.ach-tab.active{background:#fff;color:#101828;box-shadow:0 4px 12px rgba(15,23,42,.07)}.ach-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(310px,.72fr);gap:18px}.ach-panel{background:#fff;border:1px solid #e4e7ec;border-radius:22px;box-shadow:0 10px 30px rgba(15,23,42,.045);overflow:hidden}.ach-panel.full{grid-column:1/-1}.ach-head{padding:22px 24px 16px;display:flex;align-items:end;justify-content:space-between;gap:14px}.ach-head h3{font-size:19px;font-weight:850;letter-spacing:-.025em}.ach-sub{font-size:10px;color:#98a2b3;margin-top:4px}.ach-health{padding:4px 24px 22px}.ach-track{height:13px;border-radius:999px;background:#edf0f4;overflow:hidden;display:flex}.ach-track span{height:100%;display:block}.ach-legend{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;font-size:10px;color:#667085}.ach-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}.ach-focus{padding:0 14px 15px}.ach-focus-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 10px;border-top:1px solid #edf0f4}.ach-focus-icon{width:36px;height:36px;border-radius:11px;background:#f2f4f7;display:grid;place-items:center;color:#667085}.ach-focus-row strong{font-size:12px;display:block}.ach-focus-row small{font-size:10px;color:#98a2b3}.ach-pulse{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0 20px 20px}.ach-pulse-card{background:#f7f8fa;border:1px solid #edf0f4;border-radius:16px;padding:16px}.ach-pulse-card strong{font-size:22px}.ach-pulse-card span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#98a2b3;font-weight:900;margin-top:4px}.ach-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:0 20px 20px}.ach-agent{border:1px solid #e4e7ec;border-radius:19px;padding:18px;background:#fff;text-align:left;transition:.18s}.ach-agent:hover{transform:translateY(-2px);box-shadow:0 14px 28px rgba(15,23,42,.08)}.ach-agent-top{display:flex;justify-content:space-between;gap:12px}.ach-avatar{width:48px;height:48px;border-radius:15px;object-fit:cover;display:grid;place-items:center;background:#111827;color:#fff;font-weight:900;font-size:12px}.ach-fallback{background:linear-gradient(135deg,#111827,color-mix(in srgb,var(--accent) 55%,#111827))}.ach-agent h4{font-size:13px;font-weight:850;margin-top:14px}.ach-agent .handle{font-size:10px;color:#98a2b3;margin-top:3px}.ach-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}.ach-chip.green{background:#ecfdf3;color:#027a48}.ach-chip.amber{background:#fff7e8;color:#b54708}.ach-chip.red{background:#fef3f2;color:#b42318}.ach-chip.gray{background:#f2f4f7;color:#667085}.ach-ready{display:flex;align-items:center;gap:9px;margin-top:16px}.ach-ready-track{height:6px;border-radius:99px;background:#edf0f4;flex:1;overflow:hidden}.ach-ready-track span{height:100%;display:block;background:var(--accent)}.ach-ready small{font-size:9px;font-weight:900;color:#667085}.ach-agent-foot{display:flex;justify-content:space-between;align-items:end;border-top:1px solid #edf0f4;margin-top:15px;padding-top:13px}.ach-agent-foot strong{font-size:12px}.ach-agent-foot span{font-size:8px;color:#98a2b3;text-transform:uppercase;letter-spacing:.08em;font-weight:800}.ach-filterbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px 16px}.ach-filters{display:flex;gap:5px;overflow:auto}.ach-filter{border:0;background:#f2f4f7;color:#667085;border-radius:9px;padding:8px 10px;font-size:9px;font-weight:850;white-space:nowrap}.ach-filter.active{background:#111827;color:#fff}.ach-search{position:relative}.ach-search i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#98a2b3;font-size:10px}.ach-search input{border:1px solid #e4e7ec;border-radius:11px;padding:9px 12px 9px 31px;font-size:11px;width:230px;outline:none}.ach-table-wrap{overflow:auto}.ach-table{width:100%;border-collapse:collapse}.ach-table th{text-align:left;padding:11px 18px;background:#f8f9fb;color:#98a2b3;font-size:8px;text-transform:uppercase;letter-spacing:.11em}.ach-table td{padding:15px 18px;border-top:1px solid #edf0f4;font-size:11px}.ach-campaign-name{font-size:12px;font-weight:850}.ach-empty{padding:65px 22px;text-align:center;color:#98a2b3;font-size:11px}.ach-empty i{font-size:25px;display:block;margin-bottom:10px;color:#d0d5dd}.ach-overlay{position:fixed;inset:0;z-index:22000;background:rgba(3,7,18,.67);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px}.ach-modal{width:min(900px,96vw);max-height:92vh;background:#fff;border-radius:25px;box-shadow:0 35px 100px rgba(0,0,0,.3);overflow:hidden;display:flex;flex-direction:column}.ach-modal.wide{width:min(1160px,96vw)}.ach-modalbar{padding:21px 24px;border-bottom:1px solid #e4e7ec;display:flex;justify-content:space-between;gap:18px;align-items:center}.ach-modalbar h3{font-size:18px;font-weight:850}.ach-modalbody{padding:24px;overflow:auto}.ach-formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:15px}.ach-field.full{grid-column:1/-1}.ach-field label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.09em;font-weight:900;color:#667085;margin-bottom:7px}.ach-input{width:100%;border:1px solid #dfe3e8;border-radius:11px;padding:11px 12px;font-size:12px;outline:none;background:#fff}.ach-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 15%,transparent)}textarea.ach-input{min-height:90px;resize:vertical}.ach-modalfoot{padding:16px 24px;border-top:1px solid #e4e7ec;display:flex;justify-content:flex-end;gap:9px}.ach-drawer{width:min(1040px,96vw);height:min(900px,94vh);background:#f5f6f8;border-radius:25px;overflow:hidden;display:flex;flex-direction:column}.ach-drawer-hero{padding:27px 30px;background:linear-gradient(120deg,#080d1b,#252d3d);color:#fff;display:flex;justify-content:space-between;gap:20px}.ach-drawer-id{display:flex;align-items:center;gap:15px}.ach-drawer-id .ach-avatar{width:66px;height:66px;border-radius:20px}.ach-drawer-id h3{font-size:23px;font-weight:850}.ach-drawer-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;padding:18px;overflow:auto}.ach-box{background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:20px}.ach-box h4{font-size:14px;font-weight:850}.ach-checks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}.ach-check{display:flex;gap:9px;align-items:center;background:#f7f8fa;border-radius:11px;padding:10px;font-size:10px;font-weight:750}.ach-check input{accent-color:var(--accent)}.ach-secret{background:#0b1020;color:#fff;border-radius:17px;padding:18px}.ach-secret .ach-input{background:#151c2d;color:#fff;border-color:#2d364a}.ach-secret-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:12px}.ach-callout{border:1px dashed #d0d5dd;background:#fafafa;border-radius:15px;padding:16px;font-size:10px;color:#667085}.ach-note{padding:13px 17px;border-radius:14px;background:#fffaeb;color:#b54708;font-size:10px;font-weight:700}.ach-progress{height:7px;background:#edf0f4;border-radius:99px;overflow:hidden}.ach-progress span{display:block;height:100%;background:var(--accent)}
    @media(max-width:1100px){.ach-card-grid{grid-template-columns:repeat(2,1fr)}.ach-grid{grid-template-columns:1fr}.ach-budget{grid-template-columns:repeat(2,1fr)}.ach-budget-item:nth-child(2){border-right:0}.ach-budget-item:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.1)}}@media(max-width:700px){.ach-hero{padding:25px 21px}.ach-hero-top{align-items:flex-start;flex-direction:column}.ach-hero h2{font-size:29px}.ach-card-grid{grid-template-columns:1fr}.ach-formgrid,.ach-drawer-grid{grid-template-columns:1fr}.ach-budget{grid-template-columns:1fr}.ach-budget-item{border-right:0;border-bottom:1px solid rgba(255,255,255,.1)}.ach-filterbar{align-items:stretch;flex-direction:column}.ach-search input{width:100%}.ach-checks{grid-template-columns:1fr}}
  `;
    document.head.appendChild(s);
  }

  async function load(force = false) {
    ensureView();
    styles();
    if (H.loading) return;
    if (H.loaded && !force) {
      render();
      return;
    }
    H.loading = true;
    loading();
    try {
      const sync = await supabaseClient.rpc(
        "agent_campaign_sync_daily_checkins",
      );
      if (
        sync.error &&
        !String(sync.error.message || "").includes(
          "Could not find the function",
        )
      )
        throw sync.error;
      const [a, ac, m, al, c, u, su, dc, p, per] = await Promise.all([
        supabaseClient
          .from("agent_campaign_agents")
          .select("*")
          .order("full_name_en"),
        supabaseClient.from("agent_campaign_accounts").select("*"),
        supabaseClient
          .from("agent_campaign_months")
          .select("*")
          .order("month_start", { ascending: false }),
        supabaseClient.from("agent_campaign_allocations").select("*"),
        supabaseClient
          .from("agent_campaign_campaigns")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("agent_campaign_updates")
          .select("*")
          .order("report_date", { ascending: false }),
        supabaseClient
          .from("agent_campaign_status_updates")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("agent_campaign_daily_checkins")
          .select("*")
          .order("checkin_date", { ascending: false }),
        supabaseClient
          .from("profiles")
          .select("id,full_name,username,job_title,avatar,status")
          .eq("status", "active")
          .order("full_name"),
        supabaseClient
          .from("agent_campaign_user_permissions")
          .select("*")
          .eq("user_id", uid())
          .maybeSingle(),
      ]);
      const err = [a, ac, m, al, c, u, su, dc, p, per].find(
        (x) => x.error,
      )?.error;
      if (err) throw err;
      Object.assign(H, {
        agents: a.data || [],
        accounts: ac.data || [],
        months: m.data || [],
        allocations: al.data || [],
        campaigns: c.data || [],
        updates: u.data || [],
        statusUpdates: su.data || [],
        dailyCheckins: dc.data || [],
        people: p.data || [],
        permissions: per.data || null,
        loaded: true,
      });
      if (!H.months.some((x) => x.month_start === H.month))
        H.month = new Date().toISOString().slice(0, 7) + "-01";
      render();
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="ach-panel ach-empty"><i class="fas fa-triangle-exclamation"></i>${esc(e.message || "Agent Campaigns could not be loaded.")}</div>`;
    } finally {
      H.loading = false;
    }
  }
  function loading() {
    root.innerHTML =
      '<div class="ach-panel ach-empty"><i class="fas fa-circle-notch fa-spin"></i>Preparing campaign control…</div>';
  }
  function totals() {
    const mid = month()?.id,
      alloc = H.allocations
        .filter((x) => String(x.month_id) === String(mid))
        .reduce((n, x) => n + Number(x.allocated_budget || 0), 0),
      cs = H.campaigns.filter((x) => String(x.month_id) === String(mid)),
      spent = cs.reduce((n, x) => n + spendForCampaign(x.id), 0),
      budget = Number(month()?.total_budget || 0);
    return {
      budget,
      alloc,
      spent,
      remaining: budget - spent,
      cs,
      due: cs.filter(isDue).length,
    };
  }
  function hero() {
    const t = totals(),
      ready = H.agents.filter((a) => readiness(a) === 100).length;
    return `<section class="ach-hero"><div class="ach-hero-top"><div><div class="ach-kicker">Sales Agent Growth · Marketing Control</div><h2>Agent campaign control.</h2><p>Account setup, monthly media allocation, live campaigns and daily performance records in one place.</p></div><div class="ach-actions"><select class="ach-month" onchange="AgentCampaigns.changeMonth(this.value)">${H.months.map((x) => `<option value="${x.month_start}" ${x.month_start === H.month ? "selected" : ""}>${esc(periodLabel(x))}</option>`).join("")}</select>${canBudget() ? '<button class="ach-btn ghost" onclick="AgentCampaigns.budget()"><i class="fas fa-wallet"></i>Set monthly budget</button>' : ""}<button class="ach-btn primary" onclick="AgentCampaigns.campaign()"><i class="fas fa-plus"></i>New campaign</button></div></div><div class="ach-budget"><div class="ach-budget-item"><strong>${money(t.budget)}</strong><span>Monthly budget</span></div><div class="ach-budget-item"><strong>${money(t.alloc)}</strong><span>Allocated to agents</span></div><div class="ach-budget-item"><strong>${money(t.spent)}</strong><span>Latest recorded spend</span></div><div class="ach-budget-item"><strong>${ready}/${H.agents.length}</strong><span>Accounts ready</span></div></div></section>`;
  }
  function nav() {
    return `<div class="ach-nav">${[
      ["overview", "Overview"],
      ["agents", "Agents"],
      ["campaigns", "Campaigns"],
    ]
      .map(
        (x) =>
          `<button class="ach-tab ${H.tab === x[0] ? "active" : ""}" onclick="AgentCampaigns.tab('${x[0]}')">${x[1]}</button>`,
      )
      .join("")}</div>`;
  }
  function render() {
    if (!root) return;
    root.innerHTML = `<div class="ach-shell">${hero()}${nav()}${H.tab === "overview" ? overview() : H.tab === "agents" ? agentsView() : campaignsView()}</div>`;
  }
  function overview() {
    const t = totals(),
      ready = H.agents.filter((a) => readiness(a) === 100).length,
      no = H.agents.filter(
        (a) => !account(a.id) || account(a.id)?.status === "no_account",
      ).length,
      focus = [];
    H.agents
      .filter((a) => !account(a.id) || account(a.id)?.status === "no_account")
      .slice(0, 2)
      .forEach((a) =>
        focus.push({
          icon: "fa-user-plus",
          title: `Create ${a.full_name_en}'s account`,
          sub: "No Instagram account yet",
          action: `AgentCampaigns.agent('${a.id}')`,
        }),
      );
    t.cs
      .filter(isDue)
      .slice(0, 3 - focus.length)
      .forEach((c) => {
        const d = dailySummary(c);
        focus.push({
          icon: "fa-rotate",
          title: `Check in: ${c.name}`,
          sub: d.missed
            ? `${d.missed} missed ${d.missed === 1 ? "day" : "days"} · complete the record`
            : "Today’s performance is due",
          action: `AgentCampaigns.update('${c.id}')`,
        });
      });
    return `<div class="ach-overview"><section class="ach-panel ach-command"><div class="ach-compact-head"><div><div class="ach-kicker">${esc(periodLabel(month()))}</div><h3>Budget pace</h3><div class="ach-sub">${esc(monthRange(month()))}</div></div>${canBudget() ? '<button class="ach-btn sm" onclick="AgentCampaigns.budget()">Adjust budget</button>' : ""}</div><div class="ach-health"><div class="ach-track"><span style="width:${t.budget ? Math.min(100, (t.spent / t.budget) * 100) : 0}%;background:var(--accent)"></span><span style="width:${t.budget ? Math.max(0, Math.min(100, ((t.alloc - t.spent) / t.budget) * 100)) : 0}%;background:#f5b33f"></span></div><div class="ach-compact-metrics"><span><strong>${money(t.spent)}</strong> spent</span><span><strong>${money(t.alloc)}</strong> allocated</span><span><strong>${money(Math.max(0, t.budget - t.alloc))}</strong> unallocated</span><span><strong>${t.cs.filter(active).length}</strong> live</span></div></div></section><aside class="ach-panel ach-attention"><div class="ach-compact-head"><div><div class="ach-kicker">Do next</div><h3>Attention</h3></div><span class="ach-count">${focus.length}</span></div><div class="ach-focus">${focus.length ? focus.map((x) => `<button class="ach-focus-row w-full text-left" onclick="${x.action}"><span class="ach-focus-icon"><i class="fas ${x.icon}"></i></span><span><strong>${esc(x.title)}</strong><small>${esc(x.sub)}</small></span><i class="fas fa-arrow-right text-gray-300"></i></button>`).join("") : '<div class="ach-clear"><i class="fas fa-circle-check"></i>Everything is up to date.</div>'}</div></aside><section class="ach-panel ach-roster"><div class="ach-compact-head"><div><div class="ach-kicker">Account readiness</div><h3>Agent roster</h3><div class="ach-sub">${ready} ready · ${H.agents.length - ready - no} in setup · ${no} without account</div></div><button class="ach-btn sm" onclick="AgentCampaigns.tab('agents')">Open directory <i class="fas fa-arrow-right"></i></button></div><div class="ach-mini-grid">${H.agents.map(miniAgent).join("")}</div></section></div>`;
  }
  function miniAgent(a) {
    const x = account(a.id),
      pct = Math.round(readiness(a));
    return `<button class="ach-mini-agent ${pct === 100 ? "ready" : ""}" onclick="AgentCampaigns.openAgent('${a.id}')">${agentPhoto(a, "mini")}<span class="ach-mini-copy"><strong>${esc(a.full_name_en)}</strong><small>${x?.username ? "@" + esc(x.username) : "No Instagram account"}</small></span><span class="ach-mini-score"><b>${pct}%</b><i><em style="width:${pct}%"></em></i></span></button>`;
  }
  function agentCard(a) {
    const x = account(a.id),
      pct = Math.round(readiness(a)),
      al = allocation(a.id),
      cs = campaignsFor(a.id).filter(active),
      spent = cs.reduce((n, c) => n + spendForCampaign(c.id), 0),
      url = safeUrl(x?.profile_url);
    return `<article class="ach-agent ${pct === 100 ? "ready" : ""}" onclick="AgentCampaigns.openAgent('${a.id}')"><div class="ach-agent-visual">${agentPhoto(a)}<span class="ach-chip ach-agent-status ${tone(x?.status || "no_account")}">${statusLabel(x?.status || "no_account")}</span>${url ? `<a class="ach-agent-open" title="Open Instagram" href="${esc(url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="fab fa-instagram"></i></a>` : ""}<div class="ach-agent-overlay"><h4>${esc(a.full_name_en)}</h4><div class="handle">${x?.username ? "@" + esc(x.username) : "Instagram not created"}</div></div></div><div class="ach-agent-body"><div class="ach-agent-meta"><span class="ach-agent-readiness"><i></i>${pct}% ready</span><span class="ach-sub">${cs.length} live ${cs.length === 1 ? "campaign" : "campaigns"}</span></div><div class="ach-ready"><div class="ach-ready-track"><span style="width:${pct}%"></span></div></div><div class="ach-agent-numbers"><div><strong>${money(al?.allocated_budget || 0)}</strong><span>Allocated</span></div><div><strong>${money(spent)}</strong><span>Recorded spend</span></div></div></div></article>`;
  }
  function agentsView() {
    const list = H.agents.filter((a) => {
      const x = account(a.id),
        q = (
          a.full_name_en +
          " " +
          (a.company_email || "") +
          " " +
          (x?.username || "")
        )
          .toLowerCase()
          .includes(H.search.toLowerCase());
      return (
        q &&
        (H.filter === "all" ||
          x?.status === H.filter ||
          (H.filter === "no_account" && !x))
      );
    });
    return `<section class="ach-panel ach-directory"><div class="ach-head"><div><div class="ach-kicker">Instagram account directory</div><h3>People first. Campaigns second.</h3><div class="ach-sub">Open an agent to copy account details, manage access, update readiness or start a campaign.</div></div><div class="ach-tools"><label class="ach-btn"><i class="fas fa-file-import"></i>Import HR CSV<input type="file" accept=".csv" hidden onchange="AgentCampaigns.importRoster(this)"></label><button class="ach-btn dark" onclick="AgentCampaigns.agent()"><i class="fas fa-user-plus"></i>Add agent</button></div></div><div class="ach-filterbar"><div class="ach-filters">${[
      ["all", `All ${H.agents.length}`],
      ["ready", "Ready"],
      ["campaign_active", "Campaign active"],
      ["under_setup", "Under setup"],
      ["setup_required", "Setup required"],
      ["no_account", "No account"],
    ]
      .map(
        (x) =>
          `<button class="ach-filter ${H.filter === x[0] ? "active" : ""}" onclick="AgentCampaigns.filter('${x[0]}')">${x[1]}</button>`,
      )
      .join(
        "",
      )}</div><div class="ach-search"><i class="fas fa-search"></i><input value="${esc(H.search)}" oninput="AgentCampaigns.search(this.value)" placeholder="Find a person or @account"></div></div><div class="ach-card-grid">${list.length ? list.map(agentCard).join("") : '<div class="ach-empty" style="grid-column:1/-1"><i class="fas fa-search"></i>No agents match this view.</div>'}</div></section>`;
  }
  function campaignsView() {
    const mid = month()?.id,
      list = H.campaigns.filter((x) => String(x.month_id) === String(mid));
    return `<section class="ach-panel"><div class="ach-head"><div><div class="ach-kicker">${esc(periodLabel(month()))}</div><h3>${list.length} campaigns this month</h3><div class="ach-sub">Active campaigns require a performance check-in every calendar day; missed dates remain in the record.</div></div><div class="ach-actions"><button class="ach-btn" onclick="AgentCampaigns.report()"><i class="fas fa-download"></i>Download report</button><button class="ach-btn dark" onclick="AgentCampaigns.campaign()"><i class="fas fa-plus"></i>New campaign</button></div></div><div class="ach-table-wrap"><table class="ach-table"><thead><tr><th>Campaign</th><th>Agent</th><th>Status</th><th>Budget</th><th>Latest spend</th><th>Daily record</th><th></th></tr></thead><tbody>${list
      .map((c) => {
        const a = H.agents.find((x) => x.id === c.agent_id),
          u = latestUpdate(c.id),
          d = dailySummary(c),
          due = isDue(c),
          label = d.missed
            ? `${d.missed} missed ${d.missed === 1 ? "day" : "days"}`
            : d.today?.state === "completed"
              ? "Today complete"
              : due
                ? "Due today"
                : "Not required";
        return `<tr><td><div class="ach-campaign-name">${esc(c.name)}</div><small class="text-gray-400">${esc(c.project_name || c.objective)}</small></td><td>${esc(a?.full_name_en || "—")}</td><td><span class="ach-chip ${tone(c.status)}">${statusLabel(c.status)}</span></td><td>${money(c.budget)}</td><td><b>${money(u?.spend || 0)}</b></td><td><span class="ach-chip ${due ? "red" : "green"}">${esc(label)}</span></td><td><div class="ach-tools"><button class="ach-btn sm" onclick="AgentCampaigns.update('${c.id}')"><i class="fas fa-rotate"></i>Check in</button><button class="ach-btn sm" title="Download campaign report" onclick="AgentCampaigns.downloadCampaigns('', '${c.id}')"><i class="fas fa-download"></i></button><button class="ach-btn sm" title="Edit campaign" onclick="AgentCampaigns.campaign('${c.id}')"><i class="fas fa-pen"></i></button></div></td></tr>`;
      })
      .join(
        "",
      )}</tbody></table>${list.length ? "" : '<div class="ach-empty"><i class="fas fa-bullseye"></i>No campaigns yet. Start with an agent, budget and duration.</div>'}</div></section>`;
  }
  function overlay(html, wide = false) {
    close();
    const d = document.createElement("div");
    d.id = "agentCampaignOverlay";
    d.className = "ach-overlay";
    d.innerHTML = `<div class="ach-modal ${wide ? "wide" : ""}">${html}</div>`;
    document.body.appendChild(d);
    d.addEventListener("click", (e) => {
      if (e.target === d) close();
    });
  }
  function close() {
    H.lastCredential = null;
    H.credentialAccountId = null;
    clearTimeout(H.secretTimer);
    document.getElementById("agentCampaignOverlay")?.remove();
  }
  const field = (
    label,
    id,
    value = "",
    type = "text",
    full = false,
    extra = "",
  ) =>
    `<div class="ach-field ${full ? "full" : ""}"><label for="${id}">${label}</label><input id="${id}" class="ach-input" type="${type}" value="${esc(value)}" ${extra}></div>`;
  function agent(id = "") {
    const a = H.agents.find((x) => x.id === id) || {},
      x = account(id) || {};
    overlay(
      `<div class="ach-modalbar"><div><div class="ach-kicker">${id ? "Edit account" : "New sales agent"}</div><h3>${id ? esc(a.full_name_en) : "Add agent & Instagram account"}</h3></div><button class="ach-btn" onclick="AgentCampaigns.close()"><i class="fas fa-times"></i></button></div><form onsubmit="AgentCampaigns.saveAgent(event,'${id}')"><div class="ach-modalbody"><div class="ach-formgrid">${field("Instagram profile link", "aga_url", x.profile_url || "", "url", true, 'oninput="AgentCampaigns.parseInstagram(this.value)"')}${field("Full name · English", "aga_name", a.full_name_en || "")}${field("Full name · Arabic", "aga_ar", a.full_name_ar || "")}${field("Company email", "aga_email", a.company_email || "", "email")}${field("Work phone", "aga_phone", a.work_phone || "")}${field("Instagram username", "aga_username", x.username || "")}${field("Department / team", "aga_team", a.department_team || "")}${field("Photo URL", "aga_photo", a.profile_photo_url || "", "url", true)}<div class="ach-field"><label>Account status</label><select id="aga_status" class="ach-input">${["no_account", "setup_required", "under_setup", "access_pending", "ready", "campaign_active", "paused", "offboarded"].map((v) => `<option value="${v}" ${x.status === v ? "selected" : ""}>${statusLabel(v)}</option>`).join("")}</select></div><div class="ach-field"><label>Assigned specialist</label><select id="aga_specialist" class="ach-input"><option value="">Unassigned</option>${H.people.map((p) => `<option value="${p.id}" ${String(a.assigned_specialist) === String(p.id) ? "selected" : ""}>${esc(p.full_name || p.username)}</option>`).join("")}</select></div><div class="ach-field full"><label>Notes</label><textarea id="aga_notes" class="ach-input">${esc(x.notes || "")}</textarea></div></div></div><div class="ach-modalfoot"><button type="button" class="ach-btn" onclick="AgentCampaigns.close()">Cancel</button><button class="ach-btn primary" type="submit">Save agent</button></div></form>`,
    );
  }
  function parseInstagram(value) {
    try {
      const u = new URL(value),
        part = u.pathname.split("/").filter(Boolean)[0];
      if (u.hostname.includes("instagram.com") && part)
        document.getElementById("aga_username").value = part;
    } catch (_) {}
  }
  async function saveAgent(e, id) {
    e.preventDefault();
    const payload = {
      full_name_en: v("aga_name"),
      full_name_ar: v("aga_ar") || null,
      company_email: v("aga_email").trim() || null,
      work_phone: v("aga_phone") || null,
      department_team: v("aga_team") || null,
      profile_photo_url: v("aga_photo") || null,
      assigned_specialist: v("aga_specialist") || null,
      updated_by: uid(),
    };
    let a;
    if (id) {
      const r = await supabaseClient
        .from("agent_campaign_agents")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (r.error) return alert(r.error.message);
      a = r.data;
    } else {
      const r = await supabaseClient
        .from("agent_campaign_agents")
        .insert({
          ...payload,
          source: "manual",
          employment_status: "active",
          created_by: uid(),
        })
        .select()
        .single();
      if (r.error) return alert(r.error.message);
      a = r.data;
    }
    const ap = {
      agent_id: a.id,
      username: v("aga_username") || null,
      profile_url: v("aga_url") || null,
      status: v("aga_status"),
      notes: v("aga_notes") || null,
      updated_by: uid(),
    };
    const r2 = await supabaseClient
      .from("agent_campaign_accounts")
      .upsert(ap, { onConflict: "agent_id" });
    if (r2.error) return alert(r2.error.message);
    recordActivity?.(
      "agent_campaign_agent_saved",
      "agent_campaign_agent",
      a.id,
      { status: ap.status },
    );
    close();
    await load(true);
  }
  async function uploadPhoto(agentId, input) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      input.value = "";
      return toast("Photo must be smaller than 5 MB.");
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      input.value = "";
      return toast("Use a JPG, PNG or WebP image.");
    }
    const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg",
      path = `${agentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    toast("Uploading profile photo…");
    const up = await supabaseClient.storage
      .from("agent-campaign-photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      input.value = "";
      return toast(up.error.message);
    }
    const url = supabaseClient.storage
      .from("agent-campaign-photos")
      .getPublicUrl(path).data.publicUrl;
    const saved = await supabaseClient
      .from("agent_campaign_agents")
      .update({ profile_photo_url: url, updated_by: uid() })
      .eq("id", agentId);
    if (saved.error) return toast(saved.error.message);
    recordActivity?.(
      "agent_campaign_photo_updated",
      "agent_campaign_agent",
      agentId,
      {},
    );
    input.value = "";
    close();
    await load(true);
    openAgent(agentId);
    toast("Profile photo updated.");
  }
  async function downloadPhoto(agentId) {
    const a = H.agents.find((x) => String(x.id) === String(agentId));
    if (!a?.profile_photo_url)
      return toast("No profile photo is available yet.");
    try {
      const response = await fetch(a.profile_photo_url);
      if (!response.ok) throw new Error("Photo could not be downloaded.");
      const blob = await response.blob();
      const ext = blob.type.includes("png")
        ? "png"
        : blob.type.includes("webp")
          ? "webp"
          : "jpg";
      downloadBlob(blob, `${slug(a.full_name_en)}-profile-photo.${ext}`);
      toast("Profile photo downloaded.");
    } catch (_) {
      window.open(a.profile_photo_url, "_blank", "noopener");
    }
  }
  async function copyAgent(key) {
    const a = H.agents.find((x) => x.id === H.activeAgentId),
      x = account(H.activeAgentId);
    if (!a) return;
    const values = {
      username: x?.username ? "@" + x.username : "",
      email: a.company_email || "",
      phone: a.work_phone || "",
      url: safeUrl(x?.profile_url),
      team: a.department_team || "",
      all: agentPack(a, x),
    };
    await copyText(
      values[key],
      key === "all" ? "Account sheet" : key[0].toUpperCase() + key.slice(1),
    );
  }
  function openAgent(id) {
    const a = H.agents.find((x) => x.id === id),
      x = account(id);
    if (!a) return;
    H.activeAgentId = id;
    const al = allocation(id),
      cs = campaignsFor(id),
      pct = Math.round(readiness(a)),
      url = safeUrl(x?.profile_url);
    const checks = readinessKeys
      .map(
        ([key, label]) =>
          `<label class="ach-check ${key === "credentials_saved" ? "locked" : ""}"><input type="checkbox" ${x?.[key] ? "checked" : ""} ${key === "credentials_saved" ? 'disabled title="Managed by the secure credential locker"' : `onchange="AgentCampaigns.check('${x?.id || ""}','${key}',this.checked)"`}>${esc(label)}${key === "credentials_saved" ? '<i class="fas fa-lock"></i>' : ""}</label>`,
      )
      .join("");
    const campaignRows = cs.length
      ? cs
          .map((c) => {
            const d = dailySummary(c);
            return `<div class="ach-campaign-row"><span class="ach-focus-icon"><i class="fas fa-bullseye"></i></span><span><strong>${esc(c.name)}</strong><small>${statusLabel(c.status)} · ${money(c.budget)}${d.missed ? ` · ${d.missed} missed` : ""}</small></span><button class="ach-btn sm" onclick="AgentCampaigns.close();AgentCampaigns.update('${c.id}')">Check in</button></div>`;
          })
          .join("")
      : '<div class="ach-clear">No campaigns for this agent yet.</div>';
    const credentials = x
      ? `<section class="ach-box ach-credentials-card"><div class="ach-kicker">Secure account access</div><h4>Instagram credentials</h4><p class="ach-sub">Encrypted in Supabase Vault. Reveals are logged and hidden automatically.</p>${canSecrets() ? `<button class="ach-btn ghost w-full" onclick="AgentCampaigns.revealInline('${x.id}')"><i class="fas fa-eye"></i>${x.credentials_saved ? "Reveal password & details" : "No saved credential"}</button><div id="agInlineSecret"></div><button class="ach-copy-all ach-copy-dark" onclick="AgentCampaigns.credentials('${x.id}')"><i class="fas fa-key"></i>${x.credentials_saved ? "Update secure details" : "Add secure details"}</button>` : '<div class="ach-note">Credential access is restricted.</div>'}</section>`
      : "";
    overlay(
      `<header class="ach-profile-head"><div class="ach-profile-person">${agentPhoto(a, "profile")}<div><div class="ach-kicker">Sales agent · Instagram account</div><h3>${esc(a.full_name_en)}</h3><p>${x?.username ? "@" + esc(x.username) : "Account not created"} · ${esc(a.department_team || "Sales team")}</p></div></div><div class="ach-actions">${url ? `<a class="ach-btn primary" target="_blank" rel="noopener" href="${esc(url)}"><i class="fab fa-instagram"></i>Instagram</a>` : ""}<button class="ach-btn light" onclick="AgentCampaigns.close();AgentCampaigns.agent('${id}')"><i class="fas fa-pen"></i>Edit details</button><button class="ach-icon-close" aria-label="Close" onclick="AgentCampaigns.close()"><i class="fas fa-times"></i></button></div></header>
      <div class="ach-profile-body"><main>
      <section class="ach-box"><div class="ach-section-title"><div><div class="ach-kicker">Account details</div><h4>Contact & profile</h4></div><span class="ach-chip ${tone(x?.status || "no_account")}">${statusLabel(x?.status || "no_account")}</span></div><div class="ach-contact-sheet">${contactRow("Instagram username", x?.username ? "@" + x.username : "", "username")}${contactRow("Company email", a.company_email, "email")}${contactRow("Work phone", a.work_phone, "phone")}${contactRow("Profile shortcut", url, "url")}${contactRow("Team / department", a.department_team, "team", true)}</div><button class="ach-copy-all" onclick="AgentCampaigns.copyAgent('all')"><i class="fas fa-copy"></i>Copy complete account sheet</button></section>
      <section class="ach-box"><div class="ach-section-title"><div><div class="ach-kicker">Account readiness</div><h4><span id="achReadinessValue">${pct}%</span> complete</h4></div><span class="ach-sub">${readinessKeys.filter(([key]) => x?.[key]).length}/${readinessKeys.length} checks</span></div><div class="ach-progress"><span id="achReadinessBar" class="${pct === 100 ? "complete" : ""}" style="width:${pct}%"></span></div><div class="ach-checks">${checks}</div></section>
      <section class="ach-box"><div class="ach-section-title"><div><div class="ach-kicker">Campaigns</div><h4>${cs.length} linked</h4></div><div class="ach-actions"><button class="ach-btn sm" onclick="AgentCampaigns.downloadCampaigns('${id}')"><i class="fas fa-download"></i>Report</button><button class="ach-btn sm" onclick="AgentCampaigns.close();AgentCampaigns.campaign('', '${id}')"><i class="fas fa-plus"></i>New campaign</button></div></div><div class="ach-campaign-list">${campaignRows}</div></section>
      </main><aside>${credentials}<section class="ach-box"><div class="ach-kicker">${esc(periodLabel(month()))}</div><h4>Media allocation</h4><p class="ach-sub">${esc(monthRange(month()))}</p><div class="ach-allocation-field">${field("Allocated budget · QAR", "aga_allocation", al?.allocated_budget || 0, "number", false, 'min="0" step="1"')}</div>${canBudget() ? `<button class="ach-btn primary w-full" onclick="AgentCampaigns.saveAllocation('${id}')">Save monthly allocation</button>` : '<div class="ach-note">Budget access is restricted.</div>'}</section>
      <div class="ach-photo-upload"><span>${agentPhoto(a, "upload")}</span><span><strong>Profile picture</strong><small>JPG, PNG or WebP · max 5 MB</small></span><span class="ach-photo-actions">${a.profile_photo_url ? `<button class="ach-btn sm" onclick="AgentCampaigns.downloadPhoto('${id}')"><i class="fas fa-download"></i>Download</button>` : ""}<label class="ach-btn sm">${a.profile_photo_url ? "Change" : "Upload"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onchange="AgentCampaigns.uploadPhoto('${id}',this)"></label></span></div></aside></div>`,
      true,
    );
    const m = document.querySelector("#agentCampaignOverlay .ach-modal");
    if (m) m.className = "ach-drawer ach-profile-drawer";
  }
  function refreshReadiness(agentId) {
    const a = H.agents.find((x) => String(x.id) === String(agentId)),
      x = account(agentId);
    if (!a || !x) return;
    const pct = Math.round(readiness(a)),
      count = readinessKeys.filter(([key]) => x[key]).length;
    const value = document.getElementById("achReadinessValue"),
      bar = document.getElementById("achReadinessBar");
    if (value) value.textContent = `${pct}%`;
    if (bar) {
      bar.style.width = `${pct}%`;
      bar.classList.toggle("complete", pct === 100);
    }
    const sub = value?.closest(".ach-section-title")?.querySelector(".ach-sub");
    if (sub) sub.textContent = `${count}/${readinessKeys.length} checks`;
  }
  async function check(id, key, value) {
    if (!id || key === "credentials_saved") return;
    const x = H.accounts.find((a) => a.id === id);
    if (!x) return;
    const before = x[key];
    x[key] = value;
    const agent = H.agents.find((a) => String(a.id) === String(x.agent_id));
    const pct = agent ? Math.round(readiness(agent)) : 0;
    const nextStatus =
      pct === 100
        ? x.status === "campaign_active"
          ? "campaign_active"
          : "ready"
        : x.status === "ready"
          ? "under_setup"
          : x.status;
    const r = await supabaseClient
      .from("agent_campaign_accounts")
      .update({ [key]: value, status: nextStatus, updated_by: uid() })
      .eq("id", id);
    if (r.error) {
      x[key] = before;
      return alert(r.error.message);
    }
    x.status = nextStatus;
    refreshReadiness(x.agent_id);
    render();
  }
  async function saveAllocation(agentId) {
    const m = month();
    if (!m) return alert("Create this month first.");
    const amt = Number(v("aga_allocation") || 0),
      r = await supabaseClient.from("agent_campaign_allocations").upsert(
        {
          month_id: m.id,
          agent_id: agentId,
          allocated_budget: amt,
          updated_by: uid(),
        },
        { onConflict: "month_id,agent_id" },
      );
    if (r.error) return alert(r.error.message);
    recordActivity?.(
      "agent_campaign_budget_allocated",
      "agent_campaign_agent",
      agentId,
      { amount: amt, month: H.month },
    );
    close();
    await load(true);
    openAgent(agentId);
  }
  function budget() {
    const m = month() || {};
    overlay(
      `<div class="ach-modalbar"><div><div class="ach-kicker">Calendar month budget</div><h3>${esc(periodLabel(m))}</h3><div class="ach-sub">${esc(monthRange(m))}</div></div><button class="ach-btn" onclick="AgentCampaigns.close()"><i class="fas fa-times"></i></button></div><form onsubmit="AgentCampaigns.saveBudget(event)"><div class="ach-modalbody"><div class="ach-formgrid">${field("Approved monthly budget · QAR", "agb_total", m.total_budget || 0, "number", false, 'min="0" step="1"')}<div class="ach-field"><label>Month status</label><select id="agb_status" class="ach-input">${["planning", "open", "locked", "closed"].map((x) => `<option ${m.status === x ? "selected" : ""}>${x}</option>`).join("")}</select></div><div class="ach-field full"><label>Planning note</label><textarea id="agb_notes" class="ach-input">${esc(m.notes || "")}</textarea></div></div></div><div class="ach-modalfoot"><button type="button" class="ach-btn" onclick="AgentCampaigns.close()">Cancel</button><button type="submit" class="ach-btn primary">Save monthly budget</button></div></form>`,
    );
  }
  async function saveBudget(e) {
    e.preventDefault();
    const m = month();
    const d = new Date(`${H.month}T12:00:00`),
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);
    const payload = {
      month_start: H.month,
      period_label: periodLabel(m),
      period_start: H.month,
      period_end: end,
      total_budget: Number(v("agb_total") || 0),
      status: v("agb_status"),
      notes: v("agb_notes") || null,
      updated_by: uid(),
    };
    const r = m
      ? await supabaseClient
          .from("agent_campaign_months")
          .update(payload)
          .eq("id", m.id)
      : await supabaseClient
          .from("agent_campaign_months")
          .insert({ ...payload, created_by: uid() });
    if (r.error) return alert(r.error.message);
    recordActivity?.(
      "agent_campaign_monthly_budget_saved",
      "agent_campaign_month",
      H.month,
      {
        total_budget: payload.total_budget,
        period_start: H.month,
        period_end: end,
      },
    );
    close();
    await load(true);
  }
  function campaign(id = "", agentId = "") {
    const c = H.campaigns.find((x) => x.id === id) || {},
      chosen = agentId || c.agent_id || "";
    overlay(
      `<div class="ach-modalbar"><div><div class="ach-kicker">${id ? "Edit campaign" : "New campaign"}</div><h3>Lead-generation campaign</h3></div><button class="ach-btn" onclick="AgentCampaigns.close()"><i class="fas fa-times"></i></button></div><form class="ach-scroll-form" onsubmit="AgentCampaigns.saveCampaign(event,'${id}')"><div class="ach-modalbody"><div class="ach-formgrid"><div class="ach-field"><label>Sales agent</label><select id="agc_agent" class="ach-input" required><option value="">Choose agent</option>${H.agents.map((a) => `<option value="${a.id}" ${String(chosen) === String(a.id) ? "selected" : ""}>${esc(a.full_name_en)}</option>`).join("")}</select></div><div class="ach-field"><label>Status</label><select id="agc_status" class="ach-input">${["draft", "scheduled", "active", "learning", "paused", "completed", "cancelled"].map((x) => `<option value="${x}" ${c.status === x ? "selected" : ""}>${statusLabel(x)}</option>`).join("")}</select></div>${field("Campaign name", "agc_name", c.name || "", "text", true, "required")}${field("Project / property", "agc_project", c.project_name || "")}${field("Budget · QAR", "agc_budget", c.budget || 0, "number", false, 'min="0" step="1"')}<div class="ach-field"><label>Objective</label><select id="agc_objective" class="ach-input">${["leads", "messages", "traffic", "engagement", "awareness", "sales", "other"].map((x) => `<option ${c.objective === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>${field("Target location", "agc_location", c.target_location || "")}${field("Start date", "agc_start", c.start_date || "", "date")}${field("End date", "agc_end", c.end_date || "", "date")}${field("Ads Manager / reference link", "agc_url", c.ad_manager_url || "", "url", true)}<div class="ach-field full"><label>Notes</label><textarea id="agc_notes" class="ach-input">${esc(c.notes || "")}</textarea></div></div></div><div class="ach-modalfoot"><button type="button" class="ach-btn" onclick="AgentCampaigns.close()">Cancel</button><button type="submit" class="ach-btn primary"><i class="fas fa-check"></i>${id ? "Save changes" : "Create campaign"}</button></div></form>`,
    );
  }
  async function saveCampaign(e, id) {
    e.preventDefault();
    const agentId = v("agc_agent"),
      payload = {
        agent_id: agentId,
        account_id: account(agentId)?.id || null,
        month_id: month()?.id || null,
        name: v("agc_name"),
        project_name: v("agc_project") || null,
        objective: v("agc_objective"),
        status: v("agc_status"),
        budget: Number(v("agc_budget") || 0),
        target_location: v("agc_location") || null,
        start_date: v("agc_start") || null,
        end_date: v("agc_end") || null,
        ad_manager_url: v("agc_url") || null,
        notes: v("agc_notes") || null,
        updated_by: uid(),
      };
    const q = id
      ? supabaseClient
          .from("agent_campaign_campaigns")
          .update(payload)
          .eq("id", id)
      : supabaseClient
          .from("agent_campaign_campaigns")
          .insert({ ...payload, created_by: uid() });
    const r = await q.select().single();
    if (r.error) return alert(r.error.message);
    if (!id) {
      const h = await supabaseClient
        .from("agent_campaign_status_updates")
        .insert({
          campaign_id: r.data.id,
          status: payload.status,
          summary: "Campaign created",
          changes: ["Campaign setup"],
          notes: payload.notes,
          created_by: uid(),
        });
      if (h.error) return alert(h.error.message);
    }
    if (["active", "learning"].includes(payload.status) && account(agentId))
      await supabaseClient
        .from("agent_campaign_accounts")
        .update({ status: "campaign_active" })
        .eq("agent_id", agentId);
    recordActivity?.("agent_campaign_saved", "agent_campaign", r.data.id, {
      status: payload.status,
      budget: payload.budget,
    });
    close();
    await load(true);
  }
  function update(id) {
    const c = H.campaigns.find((x) => x.id === id),
      u = latestUpdate(id) || {},
      history = statusHistory(id),
      daily = dailySummary(c || {});
    if (!c) return;
    const changes = [
      "Creative",
      "Copy",
      "Targeting",
      "Audience",
      "Budget",
      "Schedule",
      "Landing page",
      "Lead form",
      "Other",
    ];
    const missed = daily.rows.filter((x) => x.state === "missed"),
      today = new Date().toISOString().slice(0, 10),
      selectedDate = missed.length
        ? missed[missed.length - 1].checkin_date
        : today,
      recentDays = daily.rows.slice(0, 7).reverse();
    overlay(
      `<div class="ach-modalbar"><div><div class="ach-kicker">Daily campaign check-in</div><h3>${esc(c.name)}</h3></div><button class="ach-btn" onclick="AgentCampaigns.close()"><i class="fas fa-times"></i></button></div><form class="ach-scroll-form" onsubmit="AgentCampaigns.saveUpdate(event,'${id}')"><div class="ach-modalbody"><div class="ach-checkin-lead ${missed.length ? "has-missed" : ""}"><div><strong>${missed.length ? `${missed.length} missed ${missed.length === 1 ? "day needs" : "days need"} completion` : "Today’s performance record"}</strong><span>${missed.length ? `The oldest missed day is selected. Complete it without losing today’s requirement.` : "Active campaigns require one complete performance record every day."}</span></div><span class="ach-chip ${tone(c.status)}">${statusLabel(c.status)}</span></div>${recentDays.length ? `<div class="ach-daily-strip">${recentDays.map((d) => `<span class="${d.state}"><b>${new Date(`${d.checkin_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</b><small>${String(d.checkin_date).slice(8)}</small><i class="fas ${d.state === "completed" ? "fa-check" : d.state === "missed" ? "fa-xmark" : "fa-clock"}"></i></span>`).join("")}</div>` : ""}<div class="ach-formgrid">${field("Update title", "agu_summary", "Daily performance check-in", "text", true, 'required placeholder="Example: Creative and targeting refined"')}<div class="ach-field"><label>Campaign status</label><select id="agu_status" class="ach-input">${["draft", "scheduled", "active", "learning", "paused", "completed", "cancelled"].map((x) => `<option value="${x}" ${c.status === x ? "selected" : ""}>${statusLabel(x)}</option>`).join("")}</select></div>${field("Check-in date", "agu_date", selectedDate, "date", false, `required max="${today}"`)}<div class="ach-field full"><label>What was changed?</label><div class="ach-change-grid">${changes.map((x) => `<label><input type="checkbox" name="agu_change" value="${esc(x)}">${esc(x)}</label>`).join("")}</div></div><div class="ach-field full"><label>Update notes</label><textarea id="agu_notes" class="ach-input" placeholder="What was checked, changed or decided?"></textarea></div></div><section class="ach-performance-block"><div class="ach-performance-head"><div><div class="ach-kicker">Required performance</div><h4>Numbers as of this check-in</h4></div><span><i class="fas fa-lock"></i> Required</span></div><div class="ach-formgrid">${field("Spend to date · QAR", "agu_spend", u.spend || 0, "number", false, 'min="0" step="0.01" required')}${field("Reach", "agu_reach", u.reach || 0, "number", false, 'min="0" required')}${field("Impressions", "agu_impressions", u.impressions || 0, "number", false, 'min="0" required')}${field("Profile visits", "agu_visits", u.profile_visits || 0, "number", false, 'min="0" required')}${field("Messages", "agu_messages", u.messages || 0, "number", false, 'min="0" required')}${field("Leads", "agu_leads", u.leads || 0, "number", false, 'min="0" required')}</div></section>${
        history.length
          ? `<div class="ach-history"><div class="ach-kicker">Previous check-ins</div>${history
              .slice(0, 5)
              .map(
                (h) =>
                  `<div><span><strong>${esc(h.summary)}</strong><small>${new Date(h.created_at).toLocaleString()} · ${statusLabel(h.status)}</small></span><em>${(h.changes || []).map(esc).join(" · ")}</em></div>`,
              )
              .join("")}</div>`
          : ""
      }</div><div class="ach-modalfoot"><button type="button" class="ach-btn" onclick="AgentCampaigns.close()">Cancel</button><button type="submit" class="ach-btn primary"><i class="fas fa-check"></i>Save check-in</button></div></form>`,
    );
  }
  async function saveUpdate(e, id) {
    e.preventDefault();
    const changes = [
        ...document.querySelectorAll('input[name="agu_change"]:checked'),
      ].map((x) => x.value),
      status = v("agu_status"),
      summary = v("agu_summary").trim(),
      notes = v("agu_notes") || null,
      checkinDate = v("agu_date"),
      today = new Date().toISOString().slice(0, 10);
    if (!summary) return alert("Add a short title for this check-in.");
    if (!checkinDate || checkinDate > today)
      return alert("Choose today or a missed date in the past.");
    const metricIds = [
      "agu_spend",
      "agu_reach",
      "agu_impressions",
      "agu_visits",
      "agu_messages",
      "agu_leads",
    ];
    if (metricIds.some((key) => v(key) === "" || Number(v(key)) < 0))
      return alert(
        "Complete every performance number with zero or a positive value.",
      );
    const h = await supabaseClient
      .from("agent_campaign_status_updates")
      .insert({
        campaign_id: id,
        status,
        summary,
        changes,
        notes,
        created_by: uid(),
      })
      .select("id")
      .single();
    if (h.error) return alert(h.error.message);
    const c = await supabaseClient
      .from("agent_campaign_campaigns")
      .update({ status, updated_by: uid() })
      .eq("id", id);
    if (c.error) return alert(c.error.message);
    const payload = {
      campaign_id: id,
      report_date: checkinDate,
      spend: Number(v("agu_spend") || 0),
      reach: Number(v("agu_reach") || 0),
      impressions: Number(v("agu_impressions") || 0),
      profile_visits: Number(v("agu_visits") || 0),
      messages: Number(v("agu_messages") || 0),
      leads: Number(v("agu_leads") || 0),
      notes,
      created_by: uid(),
    };
    const r = await supabaseClient
      .from("agent_campaign_updates")
      .upsert(payload, { onConflict: "campaign_id,report_date" });
    if (r.error) return alert(r.error.message);
    const daily = await supabaseClient
      .from("agent_campaign_daily_checkins")
      .upsert(
        {
          campaign_id: id,
          checkin_date: checkinDate,
          state: "completed",
          status_update_id: h.data.id,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,checkin_date" },
      );
    if (daily.error) return alert(daily.error.message);
    recordActivity?.("agent_campaign_checkin_saved", "agent_campaign", id, {
      status,
      summary,
      changes,
    });
    close();
    await load(true);
  }
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  function report() {
    overlay(
      `<div class="ach-modalbar"><div><div class="ach-kicker">Campaign reporting</div><h3>Download campaign overview</h3></div><button class="ach-btn" onclick="AgentCampaigns.close()"><i class="fas fa-times"></i></button></div><form onsubmit="AgentCampaigns.runReport(event)"><div class="ach-modalbody"><div class="ach-report-intro"><i class="fas fa-file-arrow-down"></i><div><strong>Excel-ready performance report</strong><span>Includes campaign setup, budget, latest spend, required performance, check-in history and every missed day.</span></div></div><div class="ach-formgrid"><div class="ach-field"><label>Campaign owner</label><select id="agr_agent" class="ach-input"><option value="">All agents</option>${H.agents.map((a) => `<option value="${a.id}">${esc(a.full_name_en)}</option>`).join("")}</select></div><div class="ach-field"><label>Period</label><select id="agr_scope" class="ach-input"><option value="month">${esc(periodLabel(month()))}</option><option value="all">All campaign history</option></select></div></div></div><div class="ach-modalfoot"><button type="button" class="ach-btn" onclick="AgentCampaigns.close()">Cancel</button><button type="submit" class="ach-btn primary"><i class="fas fa-download"></i>Download CSV</button></div></form>`,
    );
  }
  function runReport(e) {
    e.preventDefault();
    downloadCampaigns(v("agr_agent"), "", v("agr_scope"));
    close();
  }
  function downloadCampaigns(agentId = "", campaignId = "", scope = "all") {
    const mid = month()?.id;
    let list = H.campaigns.filter(
      (c) =>
        (!agentId || String(c.agent_id) === String(agentId)) &&
        (!campaignId || String(c.id) === String(campaignId)) &&
        (scope !== "month" || String(c.month_id) === String(mid)),
    );
    if (!list.length) return toast("No campaigns match this report.");
    const headers = [
      "Month",
      "Agent",
      "Instagram",
      "Campaign",
      "Project / property",
      "Objective",
      "Status",
      "Start date",
      "End date",
      "Budget QAR",
      "Latest spend QAR",
      "Budget remaining QAR",
      "Reach",
      "Impressions",
      "Profile visits",
      "Messages",
      "Leads",
      "Last performance date",
      "Completed check-ins",
      "Missed dates",
      "Missing date list",
      "Latest check-in note",
      "Ads Manager link",
    ];
    const rows = list.map((c) => {
      const a = H.agents.find((x) => String(x.id) === String(c.agent_id)),
        x = account(c.agent_id),
        u = latestUpdate(c.id) || {},
        daily = dailyFor(c.id),
        history = statusHistory(c.id),
        m = H.months.find((x) => String(x.id) === String(c.month_id));
      const missed = daily
        .filter((d) => d.state === "missed")
        .map((d) => d.checkin_date);
      return [
        periodLabel(m),
        a?.full_name_en || "",
        x?.username ? `@${x.username}` : "",
        c.name,
        c.project_name || "",
        c.objective,
        c.status,
        c.start_date || "",
        c.end_date || "",
        Number(c.budget || 0),
        Number(u.spend || 0),
        Number(c.budget || 0) - Number(u.spend || 0),
        Number(u.reach || 0),
        Number(u.impressions || 0),
        Number(u.profile_visits || 0),
        Number(u.messages || 0),
        Number(u.leads || 0),
        u.report_date || "",
        daily.filter((d) => d.state === "completed").length,
        missed.length,
        missed.join(" | "),
        history[0]?.summary || "",
        c.ad_manager_url || "",
      ];
    });
    const csv =
      "\ufeff" +
      [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const name = campaignId
      ? slug(list[0].name)
      : agentId
        ? slug(
            H.agents.find((a) => String(a.id) === String(agentId))
              ?.full_name_en,
          ) + "-campaigns"
        : scope === "month"
          ? slug(periodLabel(month())) + "-campaigns"
          : "all-agent-campaigns";
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `${name}-report.csv`,
    );
    toast("Campaign report downloaded.");
  }
  function credentials(accountId) {
    const x = H.accounts.find((a) => a.id === accountId),
      a = H.agents.find((y) => y.id === x?.agent_id);
    overlay(
      `<div class="ach-modalbar"><div><div class="ach-kicker">Secure login locker</div><h3>${esc(a?.full_name_en || "Instagram account")} · @${esc(x?.username || "instagram")}</h3></div><button class="ach-btn" onclick="AgentCampaigns.close()"><i class="fas fa-times"></i></button></div><div class="ach-modalbody"><div class="ach-secret"><div class="flex justify-between gap-4 items-start"><div><div class="ach-kicker">Supabase Vault</div><h4>Encrypted account access</h4><p class="text-[10px] text-gray-400 mt-1">Only approved users can reveal this data. Every reveal is recorded.</p></div>${x?.profile_url ? `<a class="ach-btn ghost sm" href="${esc(safeUrl(x.profile_url))}" target="_blank" rel="noopener"><i class="fab fa-instagram"></i>Instagram</a>` : ""}</div><div id="agSecretResult"></div>${x?.credentials_saved ? `<button class="ach-btn ghost w-full mt-4" onclick="AgentCampaigns.reveal('${accountId}')"><i class="fas fa-eye"></i>Reveal saved details</button>` : '<div class="ach-note mt-4">No secure login has been stored yet.</div>'}</div><form onsubmit="AgentCampaigns.saveCredential(event,'${accountId}')" class="mt-5"><div class="ach-kicker mb-3">${x?.credentials_saved ? "Replace secure details" : "Add secure details"}</div><div class="ach-formgrid">${field("Login / account email", "ags_email", "", "email")}${field("New password", "ags_password", "", "password", false, 'minlength="6" required')}${field("Recovery email", "ags_recovery_email", "", "email")}${field("Recovery phone", "ags_recovery_phone", "")}</div><div class="ach-modalfoot px-0 pb-0"><button class="ach-btn primary"><i class="fas fa-shield-halved"></i>Encrypt & save</button></div></form></div>`,
    );
    H.credentialAccountId = accountId;
  }
  async function saveCredential(e, id) {
    e.preventDefault();
    const r = await supabaseClient.rpc("agent_campaign_save_credential", {
      p_account_id: id,
      p_password: v("ags_password"),
      p_login_email: v("ags_email") || null,
      p_recovery_email: v("ags_recovery_email") || null,
      p_recovery_phone: v("ags_recovery_phone") || null,
    });
    if (r.error) return alert(r.error.message);
    alert("Credential encrypted and saved.");
    close();
    await load(true);
  }
  function secretPanel(x) {
    if (!x)
      return '<div class="ach-note mt-4">No credential has been saved yet.</div>';
    const rows = [
      ["Login email", "login_email"],
      ["Password", "password"],
      ["Recovery email", "recovery_email"],
      ["Recovery phone", "recovery_phone"],
    ];
    return `<div class="ach-secret-data">${rows.map(([label, key]) => `<div class="ach-secret-item"><label>${label}</label><code>${esc(x[key] || "Not stored")}</code>${x[key] ? `<button class="ach-copy" onclick="AgentCampaigns.copySecret('${key}')" title="Copy ${label}"><i class="fas fa-copy"></i></button>` : ""}</div>`).join("")}<button class="ach-copy-all" style="background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16);color:#fff" onclick="AgentCampaigns.copySecret('all')"><i class="fas fa-copy"></i> Copy complete login pack</button><div class="text-[9px] text-gray-400 mt-3">Last rotated ${esc(new Date(x.last_rotated_at).toLocaleString())}</div></div>`;
  }
  async function getCredential(id, out) {
    if (!out) return;
    out.innerHTML =
      '<div class="text-xs mt-4"><i class="fas fa-circle-notch fa-spin"></i> Opening Vault…</div>';
    const r = await supabaseClient.rpc("agent_campaign_reveal_credential", {
      p_account_id: id,
    });
    if (r.error) {
      out.innerHTML = `<div class="ach-note mt-4">${esc(r.error.message)}</div>`;
      return;
    }
    H.lastCredential = r.data?.[0] || null;
    out.innerHTML = secretPanel(H.lastCredential);
    clearTimeout(H.secretTimer);
    H.secretTimer = setTimeout(() => {
      H.lastCredential = null;
      const el = document.getElementById(out.id);
      if (el)
        el.innerHTML =
          '<div class="ach-note mt-4">Secure details were hidden automatically.</div>';
    }, 60000);
  }
  async function reveal(id) {
    await getCredential(id, document.getElementById("agSecretResult"));
  }
  async function revealInline(id) {
    await getCredential(id, document.getElementById("agInlineSecret"));
  }
  async function copySecret(key) {
    const x = H.lastCredential;
    if (!x) return toast("Reveal the secure details first.");
    const value =
      key === "all"
        ? [
            `Login email: ${x.login_email || ""}`,
            `Password: ${x.password || ""}`,
            `Recovery email: ${x.recovery_email || ""}`,
            `Recovery phone: ${x.recovery_phone || ""}`,
          ].join("\n")
        : x[key];
    await copyText(value, key === "all" ? "Login pack" : "Secure detail");
  }
  async function importRoster(input) {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text(),
      lines = text.split(/\r?\n/).filter(Boolean),
      headers = lines
        .shift()
        .split(",")
        .map((x) =>
          x
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_"),
        ),
      idx = (n) => headers.findIndex((h) => h === n || h.includes(n));
    const rows = lines
      .map((line) => {
        const c = line
          .match(/("[^"]*(?:""[^"]*)*"|[^,]*)/g)
          .filter((_, i) => i % 2 === 0)
          .map((x) => x.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
        return {
          hr_employee_id: c[idx("employee_id")] || c[idx("agent_id")] || null,
          full_name_en: c[idx("full_name")] || c[idx("name")] || "",
          company_email: c[idx("email")] || null,
          work_phone: c[idx("phone")] || null,
          employment_status: "active",
          source: "hr_import",
          updated_by: uid(),
        };
      })
      .filter((x) => x.full_name_en);
    if (!rows.length)
      return alert(
        "No recognizable rows found. Include Full Name, Email, Phone and Employee ID columns.",
      );
    if (
      !confirm(
        `Import ${rows.length} HR roster records? Existing emails will be matched and updated.`,
      )
    )
      return;
    for (const row of rows) {
      let q = row.company_email
        ? await supabaseClient
            .from("agent_campaign_agents")
            .select("id")
            .ilike("company_email", row.company_email)
            .maybeSingle()
        : { data: null };
      if (q.data)
        await supabaseClient
          .from("agent_campaign_agents")
          .update(row)
          .eq("id", q.data.id);
      else
        await supabaseClient
          .from("agent_campaign_agents")
          .insert({ ...row, created_by: uid() });
    }
    input.value = "";
    await load(true);
    alert("HR roster imported and matched by company email.");
  }
  const v = (id) => document.getElementById(id)?.value ?? "";
  function tab(x) {
    H.tab = x;
    render();
  }
  function filter(x) {
    H.filter = x;
    render();
  }
  function search(x) {
    H.search = x;
    render();
    document.querySelector(".ach-search input")?.focus();
  }
  function changeMonth(x) {
    H.month = x;
    render();
  }
  window.AgentCampaigns = {
    open: load,
    tab,
    filter,
    search,
    changeMonth,
    close,
    agent,
    parseInstagram,
    saveAgent,
    uploadPhoto,
    downloadPhoto,
    copyAgent,
    openAgent,
    check,
    saveAllocation,
    budget,
    saveBudget,
    campaign,
    saveCampaign,
    update,
    saveUpdate,
    report,
    runReport,
    downloadCampaigns,
    credentials,
    saveCredential,
    reveal,
    revealInline,
    copySecret,
    copyText,
    importRoster,
  };
  ModuleRegistry.register("agent-campaigns", (view) => {
    root = view;
    view.dataset.generated = "true";
    styles();
    H.loaded ? render() : loading();
  });
  const priorShow = window.showView;
  window.showView = function (viewName) {
    if (viewName !== "agent-campaigns") return priorShow?.(viewName);
    if (!state.currentUser?.modules?.includes("agent-campaigns")) return;
    const m = state.modules?.find((x) => x.id === "agent-campaigns"),
      status =
        m?.controlStatus ||
        (m?.status === "disabled"
          ? "hidden"
          : m?.status === "soon"
            ? "maintenance"
            : "live"),
      result = priorShow?.(viewName),
      view = document.getElementById("view-agent-campaigns");
    if (
      !view ||
      view.classList.contains("hidden") ||
      (state.currentUser.role !== "admin" && status === "maintenance")
    )
      return result;
    document.getElementById("headerTitle").textContent = "Agent Campaigns";
    document.getElementById("headerSubtitle").textContent =
      "Sales agent accounts, budget and lead-generation control";
    window.closeUserDropdown?.();
    window.VaultApp?.syncQuickCapture?.("agent-campaigns");
    load();
    return result;
  };
  ensureView();
  styles();
})();
