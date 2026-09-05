/*
 * projects.js — Projects grid page
 * Advisors see every team they advise; students see just their own team (same rendering path,
 * a single team simply renders as a 1-card result). All filtering runs client-side over data
 * already exposed by PP.* getters — no data-layer changes.
 */
(function () {
  const user = PP.getCurrentUser();
  const esc = PPNav.escapeHtml;

  // Project Pulse — 4 levels, always shown as icon + text label (never color alone).
  // Exact strings reused from dashboard-student.js's PULSE_LEVEL_META for consistency.
  const PULSE_LEVEL_META = {
    strong: { icon: "⬆️", label: "Strong — ahead of schedule", cls: "strong" },
    steady: { icon: "➡️", label: "Steady — on track", cls: "steady" },
    weak: { icon: "⬇️", label: "Weak — behind schedule", cls: "weak" },
    dormant: { icon: "⏸️", label: "Dormant — no recent activity", cls: "dormant" },
  };

  const DEADLINE_BUCKETS = [
    { key: "overdue", label: "Overdue" },
    { key: "this_week", label: "Due this week" },
    { key: "two_weeks", label: "Due in 2 weeks" },
    { key: "later", label: "Later" },
    { key: "none", label: "No upcoming deadline" },
  ];

  // ---------------------------------------------------------------------
  // 1) Resolve which teams this user can see
  // ---------------------------------------------------------------------
  function myTeams() {
    if (user.role === "student") {
      const team = PP.getTeam(user.teamId);
      return team ? [team] : [];
    }
    return PP.getTeamsByAdvisor(user.advisorId);
  }

  // ---------------------------------------------------------------------
  // 2) Build one enriched "project" record per team
  // ---------------------------------------------------------------------
  function nearestDeadlineMilestone(teamId) {
    const open = PP.getMilestones(teamId).filter((m) => !["passed", "done"].includes(m.status));
    if (!open.length) return null;
    return open.reduce((a, b) => (new Date(a.dueDate) < new Date(b.dueDate) ? a : b));
  }

  function deadlineBucketFor(dueDate) {
    if (!dueDate) return "none";
    const diff = ThaiDate.diffDays(dueDate, new Date());
    if (diff < 0) return "overdue";
    if (diff <= 7) return "this_week";
    if (diff <= 14) return "two_weeks";
    return "later";
  }

  function buildProjects(teams) {
    return teams.map((team) => {
      const progressPct = PP.computeProgressPct(team.id);
      const health = PP.computeHealthScore(team.id);
      const current = PP.getCurrentMilestone(team.id);
      const phaseName = PP.getCurrentPhaseName(team.id);
      const reviewMeta = PP.statusMeta(current.status);
      const deadlineMilestone = nearestDeadlineMilestone(team.id);
      const deadlineBucket = deadlineBucketFor(deadlineMilestone ? deadlineMilestone.dueDate : null);
      const members = PP.getStudentsByTeam(team.id);
      return { team, progressPct, health, current, phaseName, reviewMeta, deadlineMilestone, deadlineBucket, members };
    });
  }

  // ---------------------------------------------------------------------
  // 3) Filter bar — options are built once from the full visible dataset
  // ---------------------------------------------------------------------
  const state = { search: "", phase: "", pulse: "", deadline: "", team: "", review: "" };

  function fillSelect(select, options, allLabel) {
    select.innerHTML = [`<option value="">${esc(allLabel)}</option>`]
      .concat(options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`))
      .join("");
  }

  function uniqueBy(arr, keyFn, labelFn) {
    const seen = new Map();
    arr.forEach((item) => {
      const key = keyFn(item);
      if (key && !seen.has(key)) seen.set(key, labelFn(item));
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }

  function setupFilterBar(projects) {
    const course = PP.getCourse();
    const courseSelect = document.getElementById("filterCourse");
    courseSelect.innerHTML = `<option>${esc(course.code)} — ${esc(course.name)}</option>`;

    fillSelect(document.getElementById("filterPhase"), uniqueBy(projects, (p) => p.phaseName, (p) => p.phaseName), "All phases");

    fillSelect(document.getElementById("filterPulse"), Object.keys(PULSE_LEVEL_META).map((key) => ({
      value: key, label: `${PULSE_LEVEL_META[key].icon} ${key[0].toUpperCase()}${key.slice(1)}`,
    })), "All Pulse statuses");

    fillSelect(document.getElementById("filterDeadline"), DEADLINE_BUCKETS.map((b) => ({ value: b.key, label: b.label })), "All deadlines");

    fillSelect(document.getElementById("filterTeam"), uniqueBy(projects, (p) => p.team.id, (p) => p.team.name), "All teams");

    fillSelect(document.getElementById("filterReview"), uniqueBy(projects, (p) => p.current.status, (p) => p.reviewMeta.label), "All review statuses");

    document.getElementById("filterSearch").addEventListener("input", (e) => { state.search = e.target.value.trim().toLowerCase(); renderGrid(projects); });
    document.getElementById("filterPhase").addEventListener("change", (e) => { state.phase = e.target.value; renderGrid(projects); });
    document.getElementById("filterPulse").addEventListener("change", (e) => { state.pulse = e.target.value; renderGrid(projects); });
    document.getElementById("filterDeadline").addEventListener("change", (e) => { state.deadline = e.target.value; renderGrid(projects); });
    document.getElementById("filterTeam").addEventListener("change", (e) => { state.team = e.target.value; renderGrid(projects); });
    document.getElementById("filterReview").addEventListener("change", (e) => { state.review = e.target.value; renderGrid(projects); });

    const clearFilters = () => {
      state.search = ""; state.phase = ""; state.pulse = ""; state.deadline = ""; state.team = ""; state.review = "";
      document.getElementById("filterSearch").value = "";
      ["filterPhase", "filterPulse", "filterDeadline", "filterTeam", "filterReview"].forEach((id) => (document.getElementById(id).value = ""));
      renderGrid(projects);
    };
    document.getElementById("btnClearFilters").addEventListener("click", clearFilters);
    document.getElementById("btnEmptyClear").addEventListener("click", clearFilters);
  }

  function matchesFilters(p) {
    if (state.phase && p.phaseName !== state.phase) return false;
    if (state.pulse && p.health.level !== state.pulse) return false;
    if (state.deadline && p.deadlineBucket !== state.deadline) return false;
    if (state.team && p.team.id !== state.team) return false;
    if (state.review && p.current.status !== state.review) return false;
    if (state.search) {
      const haystack = `${p.team.name} ${p.team.projectName || ""}`.toLowerCase();
      if (!haystack.includes(state.search)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // 4) Card rendering
  // ---------------------------------------------------------------------
  function avatarStack(members) {
    if (!members.length) return "";
    const shown = members.slice(0, 4);
    const extra = members.length - shown.length;
    return `<div class="avatar-stack" aria-hidden="true">
      ${shown.map((m) => `<span class="avatar" title="${esc(m.name)}">${esc(PPNav.initials(m.name))}</span>`).join("")}
      ${extra > 0 ? `<span class="avatar" style="background:var(--pp-surface-muted);color:var(--pp-text-700);">+${extra}</span>` : ""}
    </div>`;
  }

  function deadlineText(p) {
    if (!p.deadlineMilestone) return "All milestones complete";
    return `${esc(p.deadlineMilestone.name)} · ${ThaiDate.formatThaiShort(p.deadlineMilestone.dueDate)}`;
  }

  function cardHtml(p, idx) {
    const pulse = PULSE_LEVEL_META[p.health.level];
    const moreId = `projCardMore-${idx}`;
    return `
    <a class="project-card" href="project-detail.html?team=${encodeURIComponent(p.team.id)}" aria-describedby="${moreId}">
      <div class="project-card__hd">
        <div>
          <div class="project-card__name">${esc(p.team.projectName || p.team.name)}</div>
          <div class="project-card__team">${esc(p.team.name)}</div>
        </div>
        <span class="health-badge ${pulse.cls}"><span class="health-dot"></span>${pulse.icon} ${esc(pulse.label.split(" — ")[0])}</span>
      </div>

      ${avatarStack(p.members)}

      <div class="project-card__meta-row">
        <span>Phase: <strong>${esc(p.phaseName)}</strong></span>
        <span>Progress: <strong>${p.progressPct}%</strong></span>
        <span>Nearest deadline: <strong>${deadlineText(p)}</strong></span>
        <span>Last activity: <strong>${p.team.lastActivityDate ? ThaiDate.formatThaiShort(p.team.lastActivityDate) : "—"}</strong></span>
        <span>Review status: <span class="chip ${p.reviewMeta.chip}">${esc(p.reviewMeta.label)}</span></span>
      </div>

      <div class="project-card__more" id="${moreId}">
        <div>${esc(pulse.icon)} ${esc(pulse.label)}</div>
        <div>${esc(p.health.reasons[0] || "")}</div>
        <div>${esc(p.team.projectType || "")}</div>
      </div>
    </a>`;
  }

  // Hover already expands .project-card__more via CSS (:hover). Keyboard users tabbing onto the
  // card (it's a real <a>, no nested interactive control) get the same expand via focus, delegated
  // once on the grid container so it keeps working across re-renders.
  function bindExpandOnFocus(grid) {
    if (grid.dataset.expandBound) return;
    grid.dataset.expandBound = "1";
    grid.addEventListener("focusin", (e) => {
      const card = e.target.closest(".project-card");
      if (card) card.classList.add("is-expanded");
    });
    grid.addEventListener("focusout", (e) => {
      const card = e.target.closest(".project-card");
      if (card) card.classList.remove("is-expanded");
    });
  }

  function renderGrid(projects) {
    const filtered = projects.filter(matchesFilters);
    const grid = document.getElementById("projectsGrid");
    const empty = document.getElementById("projectsEmpty");
    document.getElementById("resultCount").textContent =
      `Showing ${filtered.length} of ${projects.length} project${projects.length === 1 ? "" : "s"}`;

    bindExpandOnFocus(grid);

    if (!filtered.length) {
      grid.hidden = true; grid.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.hidden = false;
    grid.innerHTML = filtered.map(cardHtml).join("");
  }

  // ---------------------------------------------------------------------
  // 5) Skeleton loading state, then real render
  //    (data is actually synchronous from localStorage — this fakes a brief
  //     realistic loading state, as done elsewhere in the app)
  // ---------------------------------------------------------------------
  function renderSkeleton(count) {
    const box = document.getElementById("projectsSkeleton");
    box.innerHTML = Array.from({ length: count }).map(() => `
      <div class="card skeleton-card">
        <div class="skeleton skeleton-line w-60"></div>
        <div class="skeleton skeleton-line w-40"></div>
        <div class="skeleton skeleton-line w-80"></div>
      </div>`).join("");
  }

  function init() {
    const teams = myTeams();

    if (!teams.length) {
      document.getElementById("projectsSkeleton").hidden = true;
      document.getElementById("projectsContent").innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🗂️</div>
          ${user.role === "student" ? "You are not part of a team yet." : "You are not advising any teams yet."}
        </div>`;
      return;
    }

    renderSkeleton(Math.min(teams.length, 6));

    setTimeout(() => {
      const projects = buildProjects(teams);
      setupFilterBar(projects);
      renderGrid(projects);
      document.getElementById("projectsSkeleton").hidden = true;
      document.getElementById("projectsSkeleton").innerHTML = "";
    }, 300);
  }

  init();
})();
