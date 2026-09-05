/*
 * project-detail.js — ตรรกะหน้า Project Detail (บทบาท: นิสิตและอาจารย์)
 * รวมมุมมองของโครงงานหนึ่งทีมไว้ในหน้าเดียวแบบแท็บ: Milestones & Timeline, Task Checklist,
 * Submission History, Lecturer Feedback, Team Activity, Files
 * หน้านี้เป็น READ VIEW เป็นหลัก — ปุ่ม action ที่ "เขียน" ข้อมูลจริง (ส่งงาน/ให้ feedback/ยืนยัน checklist)
 * จะลิงก์ออกไปหน้าเดิมที่มีอยู่แล้วแทนที่จะ implement ซ้ำที่นี่
 */
(function () {
  const esc = PPNav.escapeHtml;
  const user = PP.getCurrentUser();

  // ---------------------------------------------------------------------
  // เส้นทางโครงการ (6 ระยะตามสเปก): Pre-production/Production/Post-production/Submission/
  // Revision/Completion — mapping ระดับ "milestone key" โดยตรง (ไม่ใช้ PP.getProjectPhases()'s 6 กลุ่ม
  // เดิมของ store.js เพราะกลุ่มเดิมมี label ภายในของตัวเอง เช่น "Testing"/"Presentation" ที่ไม่ตรงกับสเปกนี้)
  // เป็นเพียง label/การจัดกลุ่มสำหรับแสดงผลหน้านี้เท่านั้น ไม่แก้ไข PHASE_DEFS/getProjectPhases() ใน store.js
  // ---------------------------------------------------------------------
  const SPEC_PHASES = ["Pre-production", "Production", "Post-production", "Revision", "Submission", "Completion"];
  const MILESTONE_TO_PHASE = {
    topic_approval: "Pre-production", concept: "Pre-production", proposal: "Pre-production", tools_prep: "Pre-production",
    produce: "Production",
    edit: "Post-production", qc: "Post-production",
    revise_feedback: "Revision",
    final_submit: "Submission",
    present_prep: "Completion",
  };

  // คัดลอกจาก dashboard-student.js ทุกตัวอักษร (ตามกติกา "ชุดเดียวกันทั้งระบบ")
  const PULSE_LEVEL_META = {
    strong: { icon: "⬆️", label: "Strong — ahead of schedule", cls: "strong" },
    steady: { icon: "➡️", label: "Steady — on track", cls: "steady" },
    weak: { icon: "⬇️", label: "Weak — behind schedule", cls: "weak" },
    dormant: { icon: "⏸️", label: "Dormant — no recent activity", cls: "dormant" },
  };

  function resolveTeamId() {
    const qp = new URLSearchParams(location.search).get("team");
    if (qp) return qp;
    // ไม่มี query param — ใช้ทีมของผู้ใช้ที่ล็อกอินอยู่ (เฉพาะบทบาทนิสิตที่มีทีมของตัวเอง)
    return user.role === "student" ? user.teamId : null;
  }

  const teamId = resolveTeamId();
  const team = teamId ? PP.getTeam(teamId) : null;

  if (!team) {
    document.getElementById("roleGuardSlot").innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state__icon">🚫</div>
          ไม่พบทีม/โครงงานที่ต้องการดู
          <div style="margin-top:12px;"><a href="projects.html" class="btn btn-primary btn-sm">กลับไปหน้า Projects</a></div>
        </div>
      </div>`;
    document.getElementById("projectDetailContent").innerHTML = "";
    return;
  }

  document.title = `${team.projectName} — Project Detail — ProjectPulse`;
  document.getElementById("pageTitle").textContent = team.projectName;
  document.getElementById("pageDesc").textContent = `${team.name} · ${team.projectType}`;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function nearestDeadline() {
    const pending = PP.getMilestones(teamId).filter((m) => !["passed", "done"].includes(m.status));
    if (!pending.length) return null;
    return pending.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0].dueDate;
  }

  // -----------------------------------------------------------------------
  // Header — สรุปโครงงาน/ทีม/ชีพจร/ความคืบหน้า/กำหนดส่งที่ใกล้ที่สุด/กิจกรรมล่าสุด
  // -----------------------------------------------------------------------
  function renderHeader() {
    const health = PP.computeHealthScore(teamId);
    const current = PP.getCurrentMilestone(teamId);
    const progressPct = PP.computeProgressPct(teamId);
    const advisor = PP.getAdvisor(team.advisorId);
    const phaseLabel = MILESTONE_TO_PHASE[current.key] || current.name;
    const deadline = nearestDeadline();
    const meta = PULSE_LEVEL_META[health.level];
    const progressBarClass = progressPct >= 70 ? "green" : progressPct >= 40 ? "yellow" : "orange";

    return `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-hd">
        <div>
          <h3>🗂️ ${esc(team.projectName)}</h3>
          <div class="card-hd__sub">${esc(team.name)} · ${esc(team.projectType)} · Advisor: ${esc(advisor ? advisor.name : "—")}</div>
        </div>
        <span class="health-badge ${meta.cls}"><span class="health-dot"></span>${meta.icon} ${esc(meta.label)}</span>
      </div>
      <div class="grid grid-4">
        <div class="card card-stat">
          <span class="card-stat__label">Progress</span>
          <span class="card-stat__value">${progressPct}%</span>
          <div class="progress"><div class="progress__bar ${progressBarClass}" style="width:${progressPct}%;"></div></div>
          <span class="card-stat__hint">Health score ${health.score} / 100</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">Current Milestone / Phase</span>
          <span class="card-stat__value" style="font-size:1.05rem;">${esc(current.name)}</span>
          <span class="chip ${PP.statusMeta(current.status).chip}">${PP.statusMeta(current.status).label}</span>
          <span class="card-stat__hint">Phase: ${esc(phaseLabel)}</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">Nearest Deadline</span>
          <span class="card-stat__value" style="font-size:1.05rem;">${deadline ? ThaiDate.formatThaiDate(deadline) : "—"}</span>
          <span class="card-stat__hint">${deadline ? ThaiDate.relativeDaysLabel(deadline, new Date()) : "All milestones completed"}</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">Last Activity</span>
          <span class="card-stat__value" style="font-size:1.05rem;">${team.lastActivityDate ? ThaiDate.formatThaiDate(team.lastActivityDate) : "—"}</span>
          <span class="card-stat__hint">Streak: ${team.streakDays || 0} day(s)</span>
        </div>
      </div>
    </div>`;
  }

  // -----------------------------------------------------------------------
  // Tabs shell
  // -----------------------------------------------------------------------
  const TABS = [
    { key: "milestones", icon: "🗺️", label: "Milestones & Timeline" },
    { key: "tasks", icon: "✅", label: "Task Checklist" },
    { key: "submissions", icon: "📤", label: "Submission History" },
    { key: "feedback", icon: "💬", label: "Lecturer Feedback" },
    { key: "activity", icon: "👥", label: "Team Activity" },
    { key: "files", icon: "📎", label: "Files" },
  ];

  function renderTabsShell() {
    return `
    <div class="card" style="margin-bottom:16px;">
      <div class="tabs" id="pdTabs">
        ${TABS.map((t, i) => `<button type="button" class="tab-btn ${i === 0 ? "is-active" : ""}" data-tab="${t.key}">${t.icon} ${t.label}</button>`).join("")}
      </div>
    </div>
    ${TABS.map((t, i) => `<div class="tab-panel ${i === 0 ? "is-active" : ""}" data-tab-panel="${t.key}" id="tabPanel-${t.key}"></div>`).join("")}`;
  }

  function bindTabs() {
    const btns = Array.from(document.querySelectorAll("#pdTabs .tab-btn"));
    btns.forEach((btn) => btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
      const panel = document.getElementById(`tabPanel-${btn.dataset.tab}`);
      if (panel) panel.classList.add("is-active");
    }));
  }

  // -----------------------------------------------------------------------
  // Tab 1 — Milestones & Timeline (จัดกลุ่ม 10 milestone ตาม 6 ระยะของสเปกนี้โดยตรง ผ่าน MILESTONE_TO_PHASE
  // — ไม่ใช้ PP.getProjectPhases() ตรงๆ เพราะกลุ่ม/label ภายในของ store.js ไม่ตรงกับ 6 ชื่อระยะของสเปกนี้)
  // -----------------------------------------------------------------------
  function renderMilestonesTab() {
    const allMs = PP.getMilestones(teamId);
    const current = PP.getCurrentMilestone(teamId);
    const feedbacks = PP.getFeedbacksByTeam(teamId);
    const phases = SPEC_PHASES.map((name) => {
      const milestones = allMs.filter((m) => MILESTONE_TO_PHASE[m.key] === name);
      const completedCount = milestones.filter((m) => ["passed", "done"].includes(m.status)).length;
      const feedbackToFixCount = milestones.reduce((n, m) => n + feedbacks.filter((f) => f.milestoneId === m.id && !f.confirmedAt).length, 0);
      const dueDate = milestones.length ? milestones[milestones.length - 1].dueDate : null;
      return { name, milestones, completedCount, feedbackToFixCount, dueDate };
    }).filter((p) => p.milestones.length > 0);

    const body = phases.map((p, i) => {
      const isLast = i === phases.length - 1;
      const isCurrentPhase = p.milestones.some((m) => m.id === current.id);
      const allDone = p.completedCount === p.milestones.length;
      const dotClass = allDone ? "done" : isCurrentPhase ? "current" : "";
      const msRows = p.milestones.map((m) => {
        const meta = PP.statusMeta(m.status);
        return `
        <div class="task-row ${["passed", "done"].includes(m.status) ? "is-done" : ""}">
          <div class="task-row__title">${esc(m.name)}</div>
          <div class="task-row__meta">Due ${ThaiDate.formatThaiDate(m.dueDate)} · <span class="chip ${meta.chip}">${meta.label}</span></div>
        </div>`;
      }).join("");
      return `
      <div class="timeline-item">
        <div class="timeline-item__rail">
          <div class="timeline-item__dot ${dotClass}">${i + 1}</div>
          ${isLast ? "" : `<div class="timeline-item__line"></div>`}
        </div>
        <div class="timeline-item__body">
          <div class="timeline-item__hd">
            <span class="timeline-item__title">${esc(p.name)}</span>
            ${p.feedbackToFixCount > 0 ? `<span class="chip chip-revise">${p.feedbackToFixCount} feedback item(s) to fix</span>` : ""}
          </div>
          <div class="timeline-item__meta">Completed ${p.completedCount} / ${p.milestones.length} milestone(s)${p.dueDate ? ` · due ${ThaiDate.formatThaiDate(p.dueDate)}` : ""}</div>
          <div class="timeline-item__tasks">${msRows}</div>
        </div>
      </div>`;
    }).join("");

    document.getElementById("tabPanel-milestones").innerHTML = `
      <div class="card">
        <div class="card-hd">
          <div>
            <h3>🗺️ Milestones & Timeline</h3>
            <div class="card-hd__sub">Pre-production → Production → Post-production → Submission → Revision → Completion</div>
          </div>
        </div>
        <div class="timeline">${body}</div>
      </div>`;
  }

  // -----------------------------------------------------------------------
  // Tab 2 — Task Checklist (งานย่อยของ Milestone ปัจจุบัน + checklist ค้างจาก Feedback)
  // -----------------------------------------------------------------------
  function taskRowHtml(title, done, meta) {
    return `
    <div class="task-row ${done ? "is-done" : ""}">
      <span class="checkbox ${done ? "is-checked" : ""}" aria-hidden="true" title="Read-only — use Submit Work / Address Feedback Checklist to change this">✓</span>
      <div class="task-row__title">${esc(title)}</div>
      <div class="task-row__meta">${meta}</div>
    </div>`;
  }

  function renderTasksTab() {
    const current = PP.getCurrentMilestone(teamId);
    const pending = PP.getPendingWork(teamId);

    const subtaskRows = current.subtasks.length
      ? current.subtasks.map((st) => taskRowHtml(st.title, st.done, esc((PP.getStudent(st.assigneeId) || {}).name || "Unassigned"))).join("")
      : `<div class="callout-muted">No subtasks for the current milestone yet.</div>`;

    const checklistRows = pending.checklist.length
      ? pending.checklist.map((c) => taskRowHtml(
          c.title, c.done,
          `${esc((PP.getStudent(c.assigneeId) || {}).name || "Unassigned")}${c.dueDate ? " · due " + ThaiDate.formatThaiShort(c.dueDate) : ""}`
        )).join("")
      : `<div class="empty-state"><div class="empty-state__icon">🎉</div>No pending feedback checklist items.</div>`;

    document.getElementById("tabPanel-tasks").innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-hd"><div><h3>✅ Current Milestone Subtasks</h3><div class="card-hd__sub">${esc(current.name)} — read-only view</div></div></div>
        <div class="flex flex-col gap-2">${subtaskRows}</div>
      </div>
      <div class="card">
        <div class="card-hd"><div><h3>📋 Pending Feedback Checklist</h3><div class="card-hd__sub">Items not yet addressed from advisor feedback — read-only view</div></div></div>
        <div class="flex flex-col gap-2">${checklistRows}</div>
        <div class="flex gap-2" style="margin-top:14px;flex-wrap:wrap;">
          <a href="task-detail.html" class="btn btn-primary btn-sm">📨 Submit Work</a>
          <a href="feedback-to-task.html" class="btn btn-secondary btn-sm">🛠️ Address Feedback Checklist</a>
        </div>
        <div class="text-xs text-muted" style="margin-top:8px;">Note: these links open Task Detail / Feedback-to-Task for your own currently logged-in team — they don't yet support jumping straight into another team's queue from here.</div>
      </div>`;
  }

  // -----------------------------------------------------------------------
  // Tab 3 — Submission History
  // -----------------------------------------------------------------------
  function renderSubmissionsTab() {
    const subs = PP.getSubmissionsByTeam(teamId).slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    const rows = subs.map((s) => `
      <tr>
        <td>${esc(s.milestoneName)}</td>
        <td>${ThaiDate.formatThaiDateTime(s.submittedAt)}</td>
        <td><span class="chip ${PP.statusMeta(s.status).chip}">${PP.statusMeta(s.status).label}</span></td>
        <td>${s.revisionRound || 0}</td>
        <td>${esc(s.fileName || "—")}</td>
        <td>${["submitted", "reviewing"].includes(s.status)
          ? `<a href="review-feedback.html?sub=${encodeURIComponent(s.id)}" class="btn btn-secondary btn-sm">✍️ Write Feedback</a>`
          : ""}</td>
      </tr>`).join("");

    document.getElementById("tabPanel-submissions").innerHTML = `
      <div class="card">
        <div class="card-hd"><div><h3>📤 Submission History</h3><div class="card-hd__sub">${subs.length} submission(s), most recent first</div></div></div>
        ${subs.length
          ? `<div class="table-wrap"><table class="pp-table"><thead><tr><th>Milestone</th><th>Submitted At</th><th>Status</th><th>Revision Round</th><th>File</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
          : `<div class="empty-state"><div class="empty-state__icon">📭</div>No submissions yet.</div>`}
      </div>`;
  }

  // -----------------------------------------------------------------------
  // Tab 4 — Lecturer Feedback
  // -----------------------------------------------------------------------
  const DECISION_META = {
    passed: { label: "Passed", cls: "chip-passed" },
    revise: { label: "Revise", cls: "chip-revise" },
    need_info: { label: "Need Info", cls: "chip-info" },
  };

  function renderFeedbackTab() {
    const fbs = PP.getFeedbacksByTeam(teamId).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const cards = fbs.map((f) => {
      const dm = DECISION_META[f.decision] || { label: f.decision, cls: "chip-neutral" };
      const ms = PP.getMilestone(f.milestoneId);
      const doneCount = f.checklist.filter((c) => c.done).length;
      return `
      <div class="card">
        <div class="card-hd">
          <div>
            <h3>${esc(ms ? ms.name : "Feedback")}</h3>
            <div class="card-hd__sub">${ThaiDate.formatThaiDateTime(f.createdAt)}</div>
          </div>
          <span class="chip ${dm.cls}">${dm.label}</span>
        </div>
        <div class="text-sm" style="white-space:pre-wrap;">${esc(f.rawText)}</div>
        ${f.checklist.length ? `
        <div style="margin-top:12px;">
          <div class="font-bold text-sm" style="margin-bottom:6px;">Checklist (${doneCount}/${f.checklist.length} done)</div>
          <div class="flex flex-col gap-2">${f.checklist.map((c) => taskRowHtml(c.title, c.done, "")).join("")}</div>
        </div>` : ""}
        ${(!f.confirmedAt && f.checklist.length) ? `<div style="margin-top:12px;"><a href="feedback-to-task.html" class="btn btn-secondary btn-sm">🛠️ Address Feedback Checklist</a></div>` : ""}
      </div>`;
    }).join("");

    document.getElementById("tabPanel-feedback").innerHTML = fbs.length
      ? `<div class="flex flex-col gap-4">${cards}</div>`
      : `<div class="card"><div class="empty-state"><div class="empty-state__icon">💬</div>No lecturer feedback yet.</div></div>`;
  }

  // -----------------------------------------------------------------------
  // Tab 5 — Team Activity (ใช้ PPTeamWorkload.renderInto ที่ extract มาจาก team-workload.js)
  // -----------------------------------------------------------------------
  function renderActivityTab() {
    document.getElementById("tabPanel-activity").innerHTML = `
      <div class="card">
        <div class="card-hd"><div><h3>👥 Team Activity</h3><div class="card-hd__sub">Per-member workload for this team</div></div></div>
        <div id="teamActivityBox"></div>
      </div>`;
    PPTeamWorkload.renderInto(document.getElementById("teamActivityBox"), teamId);
  }

  // -----------------------------------------------------------------------
  // Tab 6 — Files (attachments ของทุก Milestone จัดกลุ่มตาม Milestone)
  // -----------------------------------------------------------------------
  function renderFilesTab() {
    const ms = PP.getMilestones(teamId).filter((m) => m.attachments.length);
    const groups = ms.map((m) => `
      <div style="margin-bottom:16px;">
        <div class="font-bold text-sm" style="margin-bottom:6px;">${esc(m.name)}</div>
        <div class="flex flex-col gap-2">
          ${m.attachments.map((a) => `
          <div class="task-row">
            <div class="task-row__title">📄 ${esc(a.name)}</div>
            <div class="task-row__meta">Uploaded ${ThaiDate.formatThaiDate(a.uploadedAt)}</div>
          </div>`).join("")}
        </div>
      </div>`).join("");

    document.getElementById("tabPanel-files").innerHTML = `
      <div class="card">
        <div class="card-hd"><div><h3>📎 Files</h3><div class="card-hd__sub">Attachments across all milestones</div></div></div>
        ${groups || `<div class="empty-state"><div class="empty-state__icon">🗃️</div>No files attached yet.</div>`}
      </div>`;
  }

  // -----------------------------------------------------------------------
  function renderAll() {
    document.getElementById("projectDetailContent").innerHTML = renderHeader() + renderTabsShell();
    renderMilestonesTab();
    renderTasksTab();
    renderSubmissionsTab();
    renderFeedbackTab();
    renderActivityTab();
    renderFilesTab();
    bindTabs();
  }

  renderAll();
})();
