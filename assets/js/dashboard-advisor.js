/*
 * dashboard-advisor.js — ตรรกะหน้า Advisor Dashboard
 * Review Queue เป็นองค์ประกอบหลักของหน้า (ใช้พื้นที่มากที่สุด) ตามด้วย Risk Radar และภาระงานตรวจ
 */
(function () {
  const esc = PPNav.escapeHtml;
  const user = PP.getCurrentUser();

  if (user.role !== "advisor") {
    document.getElementById("dashboardContent").style.display = "none";
    document.getElementById("roleGuardSlot").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🚫</div>
        หน้านี้สำหรับอาจารย์ที่ปรึกษาเท่านั้น
        <div style="margin-top:12px;"><a href="student-dashboard.html" class="btn btn-primary btn-sm">กลับไปแดชบอร์ดของฉัน</a></div>
      </div>`;
    return;
  }

  const advisorId = user.advisorId;
  const advisor = PP.getAdvisor(advisorId);
  let filterStatus = "";
  let filterRisk = "";

  function urgencyChipClass(u) {
    if (u === "เกินกำหนด") return "chip-red";
    if (u === "ใกล้เกินกำหนด") return "chip-orange";
    if (u === "ต้องติดตาม") return "chip-yellow";
    return "chip-neutral";
  }
  function riskChipClass(r) {
    if (r === "สูง") return "chip-red";
    if (r === "ปานกลาง") return "chip-yellow";
    return "chip-green";
  }

  // Project Pulse — 4 ระดับ: แสดงด้วยไอคอน+สี+ข้อความเสมอ (ไม่ใช้สีอย่างเดียว)
  const PULSE_LEVEL_META = {
    strong: { icon: "⬆️", label: "Strong — ahead of schedule" },
    steady: { icon: "➡️", label: "Steady — on track" },
    weak: { icon: "⬇️", label: "Weak — behind schedule" },
    dormant: { icon: "⏸️", label: "Dormant — no recent activity" },
  };

  function renderAll() {
    const teams = PP.getTeamsByAdvisor(advisorId);
    const queue = PP.feedbackQueue(advisorId);

    document.getElementById("pageDesc").textContent =
      `${advisor.name} · ดูแล ${teams.length} ทีม · มีงานรอตรวจ ${queue.length} รายการ`;

    renderStatCards(teams, queue);
    renderBlockedTeams();
    renderRiskRadar();
    renderAdvisorWorkload();
    populateStatusFilter(queue);
    renderReviewQueue(queue);
    renderUrgentNotifs();

    document.getElementById("btnReviewNext").disabled = !queue.length;
    document.getElementById("btnReviewNext").onclick = () => {
      if (!queue.length) return;
      const next = queue[0];
      if (next.submission.status === "submitted") PP.startReview(next.submission.id);
      window.location.href = `review-feedback.html?sub=${encodeURIComponent(next.submission.id)}`;
    };
  }

  function renderStatCards(teams, queue) {
    // Project Overview — 5 tiles ตามสเปกใหม่ (คำนวณจาก Project Pulse ที่คำนวณสดของแต่ละทีม)
    const healths = teams.map((t) => PP.computeHealthScore(t.id));
    const onTrack = healths.filter((h) => ["strong", "steady"].includes(h.level)).length;
    const atRisk = healths.filter((h) => h.level === "weak").length;
    const overdue = healths.filter((h) => h.level === "dormant").length;

    document.getElementById("statCards").innerHTML = `
      <div class="card card-stat">
        <span class="card-stat__label">Total Projects</span>
        <span class="card-stat__value">${teams.length}</span>
        <span class="card-stat__hint">ทีมทั้งหมดในความรับผิดชอบ</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">On Track</span>
        <span class="card-stat__value">${onTrack}</span>
        <span class="card-stat__hint">Pulse: Strong หรือ Steady</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">Awaiting Review</span>
        <span class="card-stat__value">${queue.length}</span>
        <span class="card-stat__hint">อยู่ในคิว Feedback ขณะนี้</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">At Risk</span>
        <span class="card-stat__value">${atRisk}</span>
        ${atRisk > 0 ? `<span class="chip chip-orange">⬇️ Pulse: Weak</span>` : `<span class="card-stat__hint">ไม่มีทีมความเสี่ยงในขณะนี้</span>`}
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">Overdue</span>
        <span class="card-stat__value">${overdue}</span>
        ${overdue > 0 ? `<span class="chip chip-red">⏸️ Pulse: Dormant — ต้องติดตามใกล้ชิด</span>` : `<span class="card-stat__hint">ไม่มีทีมหยุดนิ่งในขณะนี้</span>`}
      </div>`;
  }

  // ---------------------------------------------------------------------
  // ทีมที่ติดปัญหา — แยกจากคิวตรวจปกติ ให้เห็นทีมที่รอความช่วยเหลือชัดเจน
  // ---------------------------------------------------------------------
  function renderBlockedTeams() {
    const box = document.getElementById("blockedTeamsBox");
    const list = PP.getBlockedTeams(advisorId);
    if (!list.length) {
      box.innerHTML = `<div class="callout-muted">ไม่มีทีมที่ติดปัญหาในขณะนี้ 🎉</div>`;
      return;
    }
    box.innerHTML = list.map((b) => `
      <div class="alert alert-danger" style="align-items:flex-start;flex-wrap:wrap;">
        <div class="alert__icon">🚧</div>
        <div style="flex:1;min-width:200px;">
          <div class="alert__title">${esc(b.team.name)} · ${esc(b.milestone.name)}</div>
          <div class="text-sm">${esc(b.reason || "ไม่มีรายละเอียดเพิ่มเติม")}</div>
          <div class="text-xs text-muted" style="margin-top:4px;">ติดปัญหามาแล้ว ${b.blockedSinceDays} วัน</div>
        </div>
        <a href="team-workload.html?team=${esc(b.team.id)}" class="btn btn-outline btn-sm">ดูทีม</a>
      </div>`).join("");
  }

  // ---------------------------------------------------------------------
  // Risk Radar — ทุกเหตุผลมีที่มาจากข้อมูลจริงเสมอ
  // ---------------------------------------------------------------------
  function renderRiskRadar() {
    const box = document.getElementById("riskRadarBox");
    const rows = PP.riskRadar(advisorId);
    if (!rows.length) {
      box.innerHTML = `<div class="callout-muted">ยังไม่พบทีมที่มีความเสี่ยงชัดเจนในขณะนี้ 🎉</div>`;
      return;
    }
    box.innerHTML = rows.map((r) => {
      const pulseMeta = PULSE_LEVEL_META[r.health.level];
      const current = PP.getCurrentMilestone(r.team.id);
      const blockedReason = PP.getBlockedReason(current);
      return `
      <div class="task-row" style="align-items:flex-start;flex-wrap:wrap;">
        <span class="health-badge ${r.health.level}" style="flex-shrink:0;"><span class="health-dot"></span>${r.health.score}</span>
        <div style="flex:1;min-width:180px;">
          <a href="team-workload.html?team=${esc(r.team.id)}" class="task-row__title">${esc(r.team.name)}</a>
          <div class="text-xs" style="margin-top:2px;">${pulseMeta.icon} ${esc(pulseMeta.label)}</div>
          <ul style="margin:4px 0 0;padding-left:18px;">
            ${r.reasons.map((reason) => `<li class="text-xs text-muted">${esc(reason)}</li>`).join("")}
          </ul>
          ${blockedReason ? `<div class="alert alert-danger" style="margin-top:6px;padding:8px 10px;"><div class="alert__icon">🚧</div><div class="text-xs">อุปสรรคที่นิสิตแจ้ง: ${esc(blockedReason)}</div></div>` : ""}
          ${r.team.aiSuggestion ? `<div class="callout-muted text-xs" style="margin-top:6px;">🤖 <strong>AI เคยแนะนำ:</strong> ${esc(r.team.aiSuggestion)}</div>` : ""}
        </div>
        <button type="button" class="btn btn-outline btn-sm" data-ai-summary="${esc(r.team.id)}" style="flex-shrink:0;">🤖 AI สรุปภาพรวมทีม</button>
      </div>`;
    }).join("");

    box.querySelectorAll("[data-ai-summary]").forEach((btn) => btn.addEventListener("click", () => onAiSummaryClick(btn.dataset.aiSummary, btn)));
  }

  // ---------------------------------------------------------------------
  // ภาระงานตรวจของอาจารย์เอง
  // ---------------------------------------------------------------------
  function renderAdvisorWorkload() {
    const box = document.getElementById("advisorWorkloadBox");
    const s = PP.advisorWorkloadSummary(advisorId);
    box.innerHTML = `
      <div class="grid grid-3" style="gap:10px;">
        <div><span class="text-xs text-muted">งานรอตรวจ</span><div class="font-bold" style="font-size:1.3rem;">${s.pendingCount}</div></div>
        <div><span class="text-xs text-muted">อายุคิวเฉลี่ย</span><div class="font-bold" style="font-size:1.3rem;">${s.avgAgeDays} วัน</div></div>
        <div><span class="text-xs text-muted">เกิน SLA</span><div class="font-bold" style="font-size:1.3rem;${s.overdueCount > 0 ? "color:var(--pp-red-700);" : ""}">${s.overdueCount}</div></div>
      </div>
      ${s.topRecommended.length ? `
      <div style="margin-top:12px;">
        <div class="text-xs text-muted" style="margin-bottom:4px;">ควรตรวจก่อน (พร้อมเหตุผล)</div>
        ${s.topRecommended.map((r) => `<div class="text-sm" style="margin-bottom:4px;">🔹 <strong>${esc(r.team.name)}</strong> — ${ThaiDate.waitingDaysLabel(r.waitDays)}${r.blocksNext ? " · ขวางไม่ให้ทีมเริ่ม Milestone ถัดไป" : ""}</div>`).join("")}
      </div>` : ""}`;
  }

  // ---------------------------------------------------------------------
  // Review Queue — องค์ประกอบหลัก พร้อมตัวกรองและปุ่ม override ลำดับ
  // ---------------------------------------------------------------------
  function populateStatusFilter(queue) {
    const sel = document.getElementById("filterMilestoneStatus");
    if (sel.dataset.bound) return;
    sel.dataset.bound = "1";
    const statuses = [...new Set(queue.map((r) => r.milestone.status))];
    sel.innerHTML = `<option value="">ทั้งหมด</option>` + statuses.map((s) => `<option value="${esc(s)}">${esc(PP.statusMeta(s).label)}</option>`).join("");
    sel.addEventListener("change", () => { filterStatus = sel.value; renderAll(); });
    document.getElementById("filterRisk").addEventListener("change", (e) => { filterRisk = e.target.value; renderAll(); });
  }

  function renderReviewQueue(queue) {
    const box = document.getElementById("reviewQueueBox");
    const filtered = queue.filter((r) => (!filterStatus || r.milestone.status === filterStatus) && (!filterRisk || r.riskLevel === filterRisk));

    if (!filtered.length) {
      box.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🎉</div>${queue.length ? "ไม่มีงานที่ตรงกับตัวกรองที่เลือก" : "ไม่มีงานรอตรวจในขณะนี้"}</div>`;
      return;
    }

    box.innerHTML = filtered.map((r) => {
      const health = PP.computeHealthScore(r.team.id);
      const pulseMeta = PULSE_LEVEL_META[health.level];
      const blockedReason = PP.getBlockedReason(r.milestone);
      return `
      <div class="card" style="background:var(--pp-surface-muted);">
        <div class="flex items-start gap-3" style="flex-wrap:wrap;">
          <span class="queue-rank" style="flex-shrink:0;">${r.queueRank}</span>
          <div style="flex:2;min-width:220px;">
            <div class="font-bold">${esc(r.team.name)} <span class="text-muted" style="font-weight:400;">· ${esc(r.team.projectName)}</span></div>
            <div class="text-sm">${esc(r.milestone.name)} <span class="chip ${PP.statusMeta(r.submission.status).chip}">${PP.statusMeta(r.submission.status).label}</span>${r.revisionRound > 0 ? ` <span class="chip chip-neutral">ส่งใหม่รอบที่ ${r.revisionRound}</span>` : ""}</div>
            <div class="text-xs" style="margin-top:4px;">${pulseMeta.icon} ${esc(pulseMeta.label)}</div>
            <div class="text-xs text-muted" style="margin-top:4px;">ส่งเมื่อ ${ThaiDate.formatThaiDateTime(r.submission.submittedAt)} · ${ThaiDate.waitingDaysLabel(r.waitDays)} · Milestone ถัดไปกำหนดส่ง ${r.nextMilestone ? ThaiDate.formatThaiDate(r.nextMilestone.dueDate) : "—"}</div>
            ${r.changesSummary ? `<div class="callout-muted" style="margin-top:6px;"><strong>สิ่งที่แก้ไขจากรอบก่อน:</strong> ${esc(r.changesSummary)}</div>` : ""}
            ${blockedReason ? `<div class="alert alert-danger" style="margin-top:6px;padding:8px 10px;"><div class="alert__icon">🚧</div><div class="text-xs">อุปสรรคที่นิสิตแจ้ง: ${esc(blockedReason)}</div></div>` : ""}
            ${r.overrideReason ? `<div class="text-xs" style="margin-top:6px;color:var(--pp-purple-700);">📌 จัดลำดับเอง: ${esc(r.overrideReason)}</div>` : ""}
          </div>
          <div style="flex:1;min-width:160px;">
            <div class="flex gap-2" style="flex-wrap:wrap;margin-bottom:6px;">
              <span class="chip ${urgencyChipClass(r.urgency)}">${esc(r.urgency)}</span>
              <span class="chip ${riskChipClass(r.riskLevel)}">ความเสี่ยง: ${esc(r.riskLevel)}</span>
            </div>
          </div>
          <div class="flex flex-col gap-2" style="min-width:150px;">
            ${r.submission.status === "submitted" ? `<button class="btn btn-primary btn-sm" data-start="${esc(r.submission.id)}">▶️ เริ่มตรวจ</button>` : `<a href="review-feedback.html?sub=${encodeURIComponent(r.submission.id)}" class="btn btn-secondary btn-sm">✍️ ไปที่ Review Workspace</a>`}
            ${r.overrideReason ? `<button class="btn btn-ghost btn-sm" data-clear-override="${esc(r.submission.id)}">ยกเลิกการจัดลำดับเอง</button>` : `<button class="btn btn-outline btn-sm" data-override="${esc(r.submission.id)}">📌 จัดลำดับเอง</button>`}
            <button class="btn btn-ghost btn-sm" data-set-eta="${esc(r.submission.id)}">📅 ${r.expectedReviewDate ? "แก้ไขวันคาดว่าจะตรวจเสร็จ" : "แจ้งวันคาดว่าจะตรวจเสร็จ"}</button>
          </div>
        </div>
        ${r.expectedReviewDate ? `<div class="text-xs" style="margin-top:8px;color:var(--pp-purple-700);">📅 แจ้งนิสิตแล้ว: คาดว่าจะตรวจเสร็จ ${ThaiDate.formatThaiDate(r.expectedReviewDate)}</div>` : ""}
        ${r.nextBestTasks.length ? `<div class="text-xs text-muted" style="margin-top:8px;">นิสิตกำลังทำระหว่างรอ: ${r.nextBestTasks.slice(0, 2).map(esc).join(" · ")}</div>` : ""}
      </div>`;
    }).join("");

    box.querySelectorAll("[data-start]").forEach((btn) => btn.addEventListener("click", () => {
      PP.startReview(btn.dataset.start);
      PPToast.show("เริ่มตรวจงานแล้ว เปลี่ยนสถานะเป็น \"อาจารย์กำลังตรวจ\"", "success");
      renderAll();
    }));
    box.querySelectorAll("[data-override]").forEach((btn) => btn.addEventListener("click", () => openOverrideModal(btn.dataset.override)));
    box.querySelectorAll("[data-clear-override]").forEach((btn) => btn.addEventListener("click", () => {
      PP.clearQueueOverride(btn.dataset.clearOverride);
      PPToast.show("ยกเลิกการจัดลำดับเองแล้ว กลับไปใช้ลำดับอัตโนมัติ", "info");
      renderAll();
    }));
    box.querySelectorAll("[data-set-eta]").forEach((btn) => btn.addEventListener("click", () => {
      const input = window.prompt("ระบุวันที่คาดว่าจะตรวจเสร็จ (รูปแบบ YYYY-MM-DD) — เว้นว่างเพื่อลบวันที่ที่แจ้งไว้", "");
      if (input === null) return;
      const trimmed = input.trim();
      if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        PPToast.show("รูปแบบวันที่ไม่ถูกต้อง กรุณาระบุเป็น YYYY-MM-DD", "warn");
        return;
      }
      PP.setExpectedReviewDate(btn.dataset.setEta, trimmed || null);
      PPToast.show(trimmed ? "แจ้งวันที่คาดว่าจะตรวจเสร็จแล้ว" : "ลบวันที่ที่แจ้งไว้แล้ว", "success");
      renderAll();
    }));
  }

  let overrideTargetSubId = null;
  function openOverrideModal(subId) {
    overrideTargetSubId = subId;
    document.getElementById("overrideReasonInput").value = "";
    document.getElementById("overrideModalBackdrop").classList.add("is-open");
  }
  function closeOverrideModal() { document.getElementById("overrideModalBackdrop").classList.remove("is-open"); }
  document.getElementById("closeOverrideModal").addEventListener("click", closeOverrideModal);
  document.getElementById("cancelOverrideModal").addEventListener("click", closeOverrideModal);
  document.getElementById("overrideModalBackdrop").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeOverrideModal(); });
  document.getElementById("confirmOverrideModal").addEventListener("click", () => {
    const reason = document.getElementById("overrideReasonInput").value.trim();
    if (!reason) { PPToast.show("กรุณาระบุเหตุผลก่อนจัดลำดับเอง", "warn"); return; }
    PP.overrideQueueOrder(overrideTargetSubId, reason);
    closeOverrideModal();
    PPToast.show("จัดลำดับคิวใหม่แล้ว", "success");
    renderAll();
  });

  // ---------------------------------------------------------------------
  // AI สรุปภาพรวมทีม (agentic): อ่านหลายที่ -> สรุปให้อาจารย์อ่าน -> เขียนกลับเมื่อยืนยัน -> จดบันทึกลง Firestore
  // ---------------------------------------------------------------------
  const AI_SUMMARY_SYSTEM_PROMPT =
    "คุณคือผู้ช่วยของอาจารย์ที่ปรึกษาโครงงานนิสิต จะได้รับข้อมูลสถานะของทีมหนึ่งทีมเป็น JSON " +
    "หน้าที่ของคุณคือสรุปภาพรวมทีมนี้ให้อาจารย์อ่านได้เร็ว พร้อมข้อเสนอแนะสิ่งที่อาจารย์ควรทำต่อ " +
    "ห้ามฟันธงเรื่องคะแนนหรือผ่าน/ไม่ผ่าน — เป็นเพียงข้อเสนอแนะให้อาจารย์ตัดสินใจเองเท่านั้น " +
    "ตอบกลับเป็น JSON object เดียวเท่านั้น รูปแบบ {\"summary\":\"...\",\"reason\":\"...\",\"suggestedAction\":\"...\"} " +
    "โดย summary คือสรุปภาพรวม 2-3 ประโยค, reason คือเหตุผล/สัญญาณที่พบจากข้อมูล, suggestedAction คือสิ่งที่ควรทำต่อ 1 ประโยค";

  function gatherTeamContext(teamId) {
    const team = PP.getTeam(teamId);
    const health = PP.computeHealthScore(teamId);
    const report = PP.weeklyReport(teamId);
    const milestones = PP.getMilestones(teamId).map((m) => ({ name: m.name, status: m.status, dueDate: m.dueDate }));
    const submissions = PP.getSubmissionsByTeam(teamId).map((s) => ({ status: s.status, submittedAt: s.submittedAt, reviewedAt: s.reviewedAt || null }));
    const feedbacks = PP.getFeedbacksByTeam(teamId).map((f) => ({ decision: f.decision, createdAt: f.createdAt }));
    const notifications = PP.getNotificationsFor("advisor", advisorId)
      .filter((n) => n.teamId === teamId)
      .slice(0, 8)
      .map((n) => ({ type: n.type, severity: n.severity, title: n.title }));
    return {
      teamName: team.name, projectType: team.projectType, projectName: team.projectName,
      healthLevel: health.level, healthScore: health.score,
      milestonesCompletedPct: report.milestonesCompletedPct, onTimePct: report.onTimePct,
      milestones, submissions, feedbacks, notifications,
    };
  }

  let aiSummaryState = null; // { teamId, logId, result }

  async function onAiSummaryClick(teamId, btn) {
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "🤖 กำลังอ่านข้อมูลทีม...";
    try {
      const context = gatherTeamContext(teamId);
      const content = await PPAI.chat([
        { role: "system", content: AI_SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(context) },
      ]);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      if (!result.summary) throw new Error("AI ไม่ได้สรุปข้อมูลกลับมา");

      let logId = null;
      try {
        logId = await window.PPFirestoreLog.logAIRun(teamId, {
          advisorId, model: PPAI.MODEL,
          summary: result.summary, reason: result.reason || "", suggestedAction: result.suggestedAction || "",
        });
      } catch (logErr) {
        console.warn("บันทึก AI log ลง Firestore ไม่สำเร็จ (จะยังแสดงผลสรุปให้อาจารย์อ่านตามปกติ):", logErr);
      }

      aiSummaryState = { teamId, logId, result };
      openAiSummaryModal(PP.getTeam(teamId), result);
    } catch (err) {
      console.warn("เรียก AI สรุปภาพรวมทีมไม่สำเร็จ:", err);
      PPToast.show("เรียก AI ไม่สำเร็จ ลองใหม่อีกครั้ง (" + err.message + ")", "danger");
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  function openAiSummaryModal(team, result) {
    document.getElementById("aiSummaryModalBody").innerHTML = `
      <div class="field"><label>ทีม</label><div class="font-bold">${esc(team.name)}</div></div>
      <div class="field"><label>สรุปภาพรวม (AI ร่าง)</label><div class="callout-muted">${esc(result.summary)}</div></div>
      ${result.reason ? `<div class="field"><label>เหตุผล/สัญญาณที่พบ</label><div class="text-sm">${esc(result.reason)}</div></div>` : ""}
      ${result.suggestedAction ? `<div class="field"><label>ข้อเสนอแนะสิ่งที่ควรทำต่อ</label><div class="text-sm">${esc(result.suggestedAction)}</div></div>` : ""}
    `;
    document.getElementById("aiSummaryModalBackdrop").classList.add("is-open");
  }

  function closeAiSummaryModal() {
    document.getElementById("aiSummaryModalBackdrop").classList.remove("is-open");
    aiSummaryState = null;
  }

  document.getElementById("closeAiSummaryModal").addEventListener("click", closeAiSummaryModal);
  document.getElementById("cancelAiSummaryModal").addEventListener("click", closeAiSummaryModal);
  document.getElementById("aiSummaryModalBackdrop").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeAiSummaryModal(); });
  document.getElementById("confirmAiSummaryModal").addEventListener("click", async () => {
    if (!aiSummaryState) return;
    const { teamId, logId, result } = aiSummaryState;
    PP.saveAITeamSummary(teamId, result);
    if (logId) {
      try { await window.PPFirestoreLog.confirmAIRun(teamId, logId); }
      catch (err) { console.warn("อัปเดตสถานะยืนยันใน Firestore log ไม่สำเร็จ:", err); }
    }
    closeAiSummaryModal();
    PPToast.show("บันทึกสรุปของ AI ลงในทีมนี้แล้ว", "success");
    renderAll();
  });

  function renderUrgentNotifs() {
    const box = document.getElementById("urgentNotifBox");
    const list = PP.getNotificationsFor("advisor", advisorId)
      .filter((n) => n.severity === "red" || n.severity === "warn")
      .slice(0, 6);
    if (!list.length) {
      box.innerHTML = `<div class="callout-muted">ไม่มีแจ้งเตือนเร่งด่วนในขณะนี้ 🎉</div>`;
      return;
    }
    box.innerHTML = list.map((n) => `
      <div class="alert alert-${n.severity === "red" ? "danger" : "warn"}" style="align-items:flex-start;${n.read ? "opacity:.6;" : ""}">
        <div class="alert__icon">${PPNav.notifIcon(n.type)}</div>
        <div style="flex:1;">
          <div class="alert__title">${esc(n.title)}</div>
          <div class="text-sm">${esc(n.message)}</div>
          <div class="text-xs text-muted" style="margin-top:4px;">${ThaiDate.formatThaiDateTime(n.createdAt)}</div>
        </div>
      </div>`).join("") +
      `<a href="notifications.html" class="btn btn-ghost btn-sm" style="margin-top:2px;">ดูการแจ้งเตือนทั้งหมด</a>`;
  }

  renderAll();
})();
