/*
 * dashboard-student.js — ตรรกะหน้า Student Dashboard
 * จัดลำดับ: Pulse Status Card (สถานะชีพจร+ภารกิจถัดไป) -> แผนกู้จังหวะ (ถ้าจำเป็น) -> สรุปสั้น ->
 * เวลาว่าง/คิวตรวจ -> ภารกิจระหว่างรอ -> Milestone Timeline -> งานค้างอื่น ๆ -> Feedback-to-Task ->
 * Pulse/พลังชีพจร -> แรงส่งประจำสัปดาห์ -> Weekly Check-in
 */
(function () {
  const user = PP.getCurrentUser();

  if (user.role !== "student") {
    document.getElementById("dashboardContent").style.display = "none";
    document.getElementById("roleGuardSlot").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🚫</div>
        หน้านี้ใช้สำหรับมุมมองนิสิตเท่านั้น
        <div style="margin-top:12px;"><a href="advisor-dashboard.html" class="btn btn-primary btn-sm">กลับไปแดชบอร์ดอาจารย์</a></div>
      </div>`;
    return;
  }

  const team = PP.getTeam(user.teamId);
  const esc = PPNav.escapeHtml;

  // สถานะชีพจร 3 ระดับ — แสดงด้วยไอคอน+สี+ข้อความเสมอ (ไม่ใช้สีอย่างเดียว เพื่อรองรับ Accessibility)
  const PULSE_LEVEL_META = {
    green: { icon: "🟢", label: "ตามแผน — ชีพจรปกติ", cls: "green" },
    yellow: { icon: "🟡", label: "เริ่มเสี่ยง — ชีพจรแผ่ว", cls: "yellow" },
    red: { icon: "🔴", label: "ล่าช้า — ชีพจรวิกฤต", cls: "red" },
  };

  function renderAll() {
    const ms = PP.getMilestones(team.id);
    const current = PP.getCurrentMilestone(team.id);
    const progressPct = PP.computeProgressPct(team.id);
    const health = PP.computeHealthScore(team.id);
    const pending = PP.getPendingWork(team.id);
    const collision = PP.detectDeadlineCollision(team.id);
    const advisor = PP.getAdvisor(team.advisorId);
    const hero = PP.getHeroTask(team.id);

    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}" · อาจารย์ที่ปรึกษา: ${advisor.name}`;

    renderCollisionAlert(collision);
    renderRecoveryBanner(health);
    renderHero(hero, current, health);
    renderRecoveryPanel(health);
    renderStatCards(progressPct, current, health);
    renderFreeTimeToday(team.id);
    renderMyQueue(team.id);
    renderWhileYouWait(team.id, current);
    renderMilestoneMini(team.id, current);
    renderUpcoming(current, team.id);
    renderSecondaryTasks(pending, hero);
    renderFeedbackToTaskTeaser(team.id);
    renderPulseWidget(team.id);
    renderWeeklyMomentum(team.id);
    renderWeeklyCheckin(team.id);
  }

  // -----------------------------------------------------------------------
  // 1) Pulse Status Card: สถานะชีพจร + ภารกิจถัดไปเพียง 1 งาน
  // -----------------------------------------------------------------------
  function heroDestination(hero) {
    if (!hero) return "project-timeline.html";
    if (hero.kind === "feedback") return "feedback-to-task.html";
    return "project-timeline.html";
  }

  function renderHero(hero, current, health) {
    const slot = document.getElementById("heroSlot");
    const isAwaiting = ["submitted", "reviewing"].includes(current.status);
    const levelMeta = isAwaiting ? { icon: "📥", label: "รอตรวจ — อยู่ในคิว" } : PULSE_LEVEL_META[health.level];
    const statusMsg = PP.pulseStatusMessage(team.id);
    const phaseName = PP.getCurrentPhaseName(team.id);
    const reasonText = health.reasons[0] || "";

    let heroBody;
    if (!hero) {
      heroBody = `
        <div class="flex items-center gap-3" style="margin-top:12px;">
          <span style="font-size:2rem;">🎉</span>
          <div>
            <div class="font-bold" style="font-size:1.05rem;color:#fff;">ตอนนี้ยังไม่มีงานเร่งด่วนที่ต้องทำ</div>
            <div class="text-sm" style="color:rgba(255,255,255,.85);">ลองแวะดูไทม์ไลน์โครงงานเพื่อเตรียมตัวสำหรับ Milestone ถัดไป</div>
          </div>
        </div>`;
    } else {
      const hrs = Math.floor(hero.estimatedMinutes / 60);
      const mins = hero.estimatedMinutes % 60;
      const timeLabel = hrs > 0 ? `${hrs} ชม.${mins ? ` ${mins} นาที` : ""}` : `${mins} นาที`;
      heroBody = `
        <div class="page-head__eyebrow" style="color:rgba(255,255,255,.8);margin-top:10px;">ภารกิจถัดไป</div>
        <h2 style="color:#fff;margin-top:4px;">${esc(hero.title)}</h2>
        <div class="text-sm" style="color:rgba(255,255,255,.85);margin-bottom:6px;">Milestone: ${esc(hero.milestoneName)} · ใช้เวลาประมาณ ${timeLabel}</div>
        <div class="text-sm" style="color:#fff;background:rgba(255,255,255,.16);border-radius:var(--pp-radius-sm);padding:10px 12px;margin-top:8px;">${esc(hero.reason)}</div>`;
    }

    slot.innerHTML = `
      <div class="card card-pad-lg" style="background:var(--pp-gradient-pulse);color:#fff;border:none;">
        <div class="flex items-center gap-2" style="flex-wrap:wrap;">
          <span class="chip" style="background:rgba(255,255,255,.22);color:#fff;font-weight:800;">${levelMeta.icon} ${esc(levelMeta.label)}</span>
          <span class="text-xs" style="color:rgba(255,255,255,.8);">ระยะปัจจุบัน: ${esc(phaseName)} · ${esc(current.name)}</span>
        </div>
        <div class="text-sm" style="color:#fff;font-weight:700;margin-top:8px;">${esc(statusMsg)}</div>
        ${reasonText ? `<div class="text-xs" style="color:rgba(255,255,255,.8);margin-top:2px;">เหตุผล: ${esc(reasonText)}</div>` : ""}
        <div class="text-xs" style="color:rgba(255,255,255,.8);margin-top:4px;">กำหนดส่งที่ใกล้ที่สุด: ${ThaiDate.formatThaiDate(current.dueDate)} (${ThaiDate.relativeDaysLabel(current.dueDate, new Date())})</div>
        ${heroBody}
        <div class="flex gap-2" style="margin-top:16px;flex-wrap:wrap;">
          ${hero ? `<button class="btn" style="background:#fff;color:var(--pp-navy-900);" id="btnHeroStart">▶️ เริ่มภารกิจถัดไป</button>` : ""}
          <button class="btn" style="background:rgba(255,255,255,.18);color:#fff;" id="btnPlanForMe">🗓️ จัดเวลาให้ฉัน</button>
          ${hero ? `<a href="${heroDestination(hero)}" class="btn" style="background:rgba(255,255,255,.18);color:#fff;">🔍 ดูรายละเอียด</a>` : ""}
          <button class="btn" style="background:rgba(0,0,0,.18);color:#fff;" id="btnHeroBlocked">🚧 ติดปัญหา</button>
        </div>
      </div>`;

    if (hero) {
      document.getElementById("btnHeroStart").addEventListener("click", () => {
        PP.recordActivity(team.id);
        PPToast.show("บันทึกว่าเริ่มภารกิจนี้แล้ว ไปที่หน้ารายละเอียดกันเลย", "success");
        window.location.href = heroDestination(hero);
      });
    }
    document.getElementById("btnPlanForMe").addEventListener("click", () => {
      const slots = PP.planNextTask(team.id);
      PPToast.show(slots.length ? "จัดเวลาให้แล้ว เลื่อนไปดูที่ช่วงเวลาว่างที่แนะนำ แล้วกดยืนยันเวลาที่ต้องการ" : "ไม่พบช่วงเวลาว่างที่เหมาะสมในขณะนี้", slots.length ? "info" : "warn");
      renderAll();
      document.getElementById("freeTimeTodayBox").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.getElementById("btnHeroBlocked").addEventListener("click", () => openBlockedModal(current.id));
  }

  // -----------------------------------------------------------------------
  // แผนกู้จังหวะ (Recovery Panel) — แสดงเมื่อชีพจรเป็นสีเหลือง/แดงเท่านั้น ไม่ตำหนินิสิต
  // -----------------------------------------------------------------------
  function renderRecoveryPanel(health) {
    const slot = document.getElementById("recoveryPanelSlot");
    if (health.level === "green") { slot.innerHTML = ""; return; }
    const meta = PULSE_LEVEL_META[health.level];
    slot.innerHTML = `
      <div class="card" style="border-color:${health.level === "red" ? "var(--pp-red-700)" : "#f0dd9a"};">
        <div class="card-hd">
          <div>
            <h3>🧭 แผนกู้จังหวะ</h3>
            <div class="card-hd__sub">${meta.icon} ${esc(meta.label)} — ไม่เป็นไร ค่อย ๆ กลับเข้าแผนไปด้วยกัน ทำตาม 3 ขั้นตอนนี้</div>
          </div>
        </div>
        <ol style="margin:0 0 12px;padding-left:20px;display:flex;flex-direction:column;gap:6px;">
          <li class="text-sm">เลือกงานที่เล็กที่สุดและทำให้เสร็จได้ภายใน 15–30 นาที</li>
          <li class="text-sm">จองช่วงเวลาว่างสำหรับงานสำคัญภายใน 48 ชั่วโมง</li>
          <li class="text-sm">ระบุอุปสรรคหรือขอความช่วยเหลือจากอาจารย์ ถ้ามี</li>
        </ol>
        <div class="flex gap-2" style="flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="btnStartRecovery">▶️ เริ่มกู้จังหวะ</button>
          <a href="free-time-planner.html" class="btn btn-outline btn-sm">🗓️ จัดเวลาใหม่</a>
          <button class="btn btn-outline btn-sm" id="btnReportObstacle">🚧 แจ้งอุปสรรค</button>
          <button class="btn btn-ghost btn-sm" id="btnAskAdvisor">🙋 ขอคำปรึกษา</button>
        </div>
      </div>`;

    document.getElementById("btnStartRecovery").addEventListener("click", () => {
      PPToast.show("เริ่มแผนกู้จังหวะแล้ว — เลือกงานเล็กที่สุดจากรายการ \"งานอื่นที่ยังค้างอยู่\" ด้านล่างได้เลย", "info");
      document.getElementById("secondaryTasksBox").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.getElementById("btnReportObstacle").addEventListener("click", () => openBlockedModal(PP.getCurrentMilestone(team.id).id));
    document.getElementById("btnAskAdvisor").addEventListener("click", () => {
      const msg = window.prompt("อธิบายสั้น ๆ ว่าต้องการคำปรึกษาเรื่องใด:", "");
      if (!msg) return;
      PP.requestConsultation(team.id, msg);
      PPToast.show("บันทึกคำขอคำปรึกษาในระบบแล้ว อาจารย์ที่ปรึกษาจะเห็นเมื่อเข้าใช้งานครั้งถัดไป", "success");
      renderAll();
    });
  }

  // เมื่อชีพจรกลับมาเป็นสีเขียวจากสีเหลือง/แดง แสดงข้อความให้กำลังใจครั้งเดียว
  function renderRecoveryBanner(health) {
    const slot = document.getElementById("recoveryBannerSlot");
    const lastSeen = team.lastPulseLevelSeen;
    if (health.level === "green" && (lastSeen === "yellow" || lastSeen === "red")) {
      slot.innerHTML = `
        <div class="alert alert-success">
          <div class="alert__icon">💓</div>
          <div class="text-sm font-bold">ชีพจรกลับมาเป็นปกติแล้ว คุณกลับมาอยู่ในแผนอีกครั้ง</div>
        </div>`;
    } else {
      slot.innerHTML = "";
    }
    if (lastSeen !== health.level) PP.updateTeamInfo(team.id, { lastPulseLevelSeen: health.level });
  }

  // -----------------------------------------------------------------------
  // ติดปัญหา (BLOCKED) modal — เป็น flag ที่แนบเหตุผลเสมอ ไม่ใช่แค่กดเฉย ๆ
  // -----------------------------------------------------------------------
  let blockedTargetMilestoneId = null;
  function openBlockedModal(milestoneId) {
    blockedTargetMilestoneId = milestoneId;
    document.getElementById("blockedReasonInput").value = "";
    document.getElementById("blockedModalBackdrop").classList.add("is-open");
  }
  function closeBlockedModal() { document.getElementById("blockedModalBackdrop").classList.remove("is-open"); }
  document.getElementById("closeBlockedModal").addEventListener("click", closeBlockedModal);
  document.getElementById("cancelBlockedModal").addEventListener("click", closeBlockedModal);
  document.getElementById("blockedModalBackdrop").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeBlockedModal(); });
  document.getElementById("confirmBlockedModal").addEventListener("click", () => {
    const reason = document.getElementById("blockedReasonInput").value.trim();
    if (!reason) { PPToast.show("กรุณาอธิบายสั้น ๆ ว่าติดปัญหาอะไร", "warn"); return; }
    PP.flagBlocked(blockedTargetMilestoneId, reason);
    closeBlockedModal();
    PPToast.show("บันทึกปัญหาที่แจ้งในระบบแล้ว อาจารย์ที่ปรึกษาจะเห็นเมื่อเข้าใช้งานครั้งถัดไป", "info");
    renderAll();
  });

  // -----------------------------------------------------------------------
  // ส่งหลักฐานความคืบหน้า (ไม่ใช่ full submission)
  // -----------------------------------------------------------------------
  let evidenceTargetMilestoneId = null;
  function openEvidenceModal(milestoneId) {
    evidenceTargetMilestoneId = milestoneId;
    document.getElementById("evidenceType").value = "link";
    document.getElementById("evidenceValue").value = "";
    document.getElementById("evidenceNote").value = "";
    document.getElementById("evidenceModalBackdrop").classList.add("is-open");
  }
  function closeEvidenceModal() { document.getElementById("evidenceModalBackdrop").classList.remove("is-open"); }
  document.getElementById("closeEvidenceModal").addEventListener("click", closeEvidenceModal);
  document.getElementById("cancelEvidenceModal").addEventListener("click", closeEvidenceModal);
  document.getElementById("evidenceModalBackdrop").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeEvidenceModal(); });
  document.getElementById("confirmEvidenceModal").addEventListener("click", () => {
    const type = document.getElementById("evidenceType").value;
    const value = document.getElementById("evidenceValue").value.trim();
    const note = document.getElementById("evidenceNote").value.trim();
    if (!value && !note) { PPToast.show("กรุณากรอกลิงก์/ชื่อไฟล์ หรือคำอธิบายอย่างน้อย 1 อย่าง", "warn"); return; }
    PP.addProgressEvidence(evidenceTargetMilestoneId, { type, value, note });
    closeEvidenceModal();
    PPToast.show("บันทึกหลักฐานความคืบหน้าแล้ว", "success");
    PPPulse.burst("บันทึกความคืบหน้าแล้ว!");
    renderAll();
  });

  function renderCollisionAlert(collision) {
    const slot = document.getElementById("collisionAlertSlot");
    if (!collision.hasCollision) { slot.innerHTML = ""; return; }
    const itemsText = collision.items.map((i) => `${i.title} (${i.courseName}, ${i.hours} ชม.)`).join(", ");
    slot.innerHTML = `
      <div class="alert alert-danger">
        <div class="alert__icon">⚠️</div>
        <div style="flex:1;">
          <div class="alert__title">พบกำหนดส่งชนกัน</div>
          <div class="text-sm">สัปดาห์นี้คุณมีงาน ${collision.items.length} ชิ้นกำหนดส่งภายใน ${collision.windowHours} ชั่วโมง และต้องใช้เวลารวมประมาณ ${collision.totalHours} ชั่วโมง (${esc(itemsText)}) งานโครงงานมีความเสี่ยงที่จะล่าช้า ควรจัดสรรเวลาโครงงานล่วงหน้า</div>
          <ul>${collision.suggestions.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
          <div class="flex gap-2" style="margin-top:8px;flex-wrap:wrap;">
            <a href="free-time-planner.html" class="btn btn-sm btn-outline">⏱️ จองช่วงเวลาทำงานล่วงหน้า</a>
            <a href="project-timeline.html" class="btn btn-sm btn-outline">🧩 แบ่งงานใหญ่เป็นงานย่อย</a>
            <a href="team-workload.html" class="btn btn-sm btn-outline">👥 กระจายงานให้ทีม</a>
          </div>
        </div>
      </div>`;
  }

  function healthNote(level) {
    if (level === "green") return "โครงงานของคุณดำเนินไปตามแผน";
    if (level === "yellow") return "เริ่มมีสัญญาณความเสี่ยง ควรติดตามใกล้ชิด";
    return "มีความเสี่ยงสูงที่จะล่าช้า ควรดำเนินการทันที";
  }

  function renderStatCards(progressPct, current, health) {
    const barClass = progressPct >= 70 ? "green" : progressPct >= 40 ? "yellow" : "orange";
    document.getElementById("statCards").innerHTML = `
      <div class="card card-stat">
        <span class="card-stat__label">ความก้าวหน้าโครงงาน</span>
        <span class="card-stat__value">${progressPct}%</span>
        <div class="progress"><div class="progress__bar ${barClass}" style="width:${progressPct}%;"></div></div>
        <span class="card-stat__hint">ผ่านแล้ว ${PP.getMilestones(team.id).filter((m) => ["passed", "done"].includes(m.status)).length} / ${PP.getMilestones(team.id).length} Milestone</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">Milestone ปัจจุบัน</span>
        <span class="card-stat__value" style="font-size:1.15rem;">${esc(current.name)}</span>
        <span class="chip ${PP.statusMeta(current.status).chip}">${PP.statusMeta(current.status).label}</span>
        <span class="card-stat__hint">กำหนดส่ง ${ThaiDate.formatThaiDate(current.dueDate)}</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">สัปดาห์ของภาคการศึกษา</span>
        <span class="card-stat__value">${PP.getCourse().currentWeek}<span style="font-size:1rem;color:var(--pp-text-500);"> / ${PP.getCourse().weeks}</span></span>
        <span class="card-stat__hint">${esc(PP.getCourse().semesterLabel)}</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">Project Health Score</span>
        <span class="health-badge ${health.level}"><span class="health-dot"></span>${health.score} / 100</span>
        <span class="card-stat__hint">${healthNote(health.level)} · <a href="weekly-report.html">ดูเหตุผลทั้งหมด</a></span>
        <span class="text-xs text-muted">*เป็นตัวชี้วัดความเสี่ยงของการดำเนินงาน ไม่ใช่คะแนนรายวิชา</span>
      </div>`;
  }

  // -----------------------------------------------------------------------
  // 2) Recommended Free Time — คำนวณจริงจากตารางเรียน/ภาระงาน ไม่ใช่แค่เดา
  // -----------------------------------------------------------------------
  function renderFreeTimeToday(teamId) {
    const box = document.getElementById("freeTimeTodayBox");
    const windows = PP.computeFreeWindowsToday(teamId);
    const suggestions = PP.nextBestTasks(teamId);
    const pendingSlots = PP.getFreeTimeSuggestions(teamId).filter((s) => s.status === "pending").slice(0, 2);

    let html = "";
    if (!windows.length) {
      html += `<div class="callout-muted">วันนี้ตารางค่อนข้างแน่น ไม่พบช่วงว่างต่อเนื่องอย่างน้อย 30 นาที ลองดูวันถัดไปในปฏิทินภาระงาน</div>`;
    } else {
      html += windows.slice(0, 2).map((w, i) => {
        const h = Math.floor(w.minutes / 60), m = w.minutes % 60;
        const durText = h > 0 ? `${h} ชม.${m ? ` ${m} นาที` : ""}` : `${m} นาที`;
        const suggestion = suggestions[i % Math.max(suggestions.length, 1)] || "ทำงานโครงงานต่อ";
        return `
        <div class="slot-card${w.isFree ? "" : ""}">
          <div class="slot-card__time">วันนี้ ${w.start}–${w.end} น. · ${w.isFree ? "ว่าง" : "พอทำได้"} ${durText}</div>
          <div class="slot-card__reason">${w.isFree ? `เหมาะสำหรับ ${esc(suggestion)}` : esc(w.label)}</div>
        </div>`;
      }).join("");
    }

    if (pendingSlots.length) {
      html += pendingSlots.map((s) => `
        <div class="slot-card">
          <div class="slot-card__time">${ThaiDate.formatThaiDate(s.date, { withDow: true })} · ${s.start}–${s.end} น.</div>
          <div class="slot-card__reason">${esc(s.taskSuggestion)}</div>
          <div class="slot-card__actions">
            <button class="btn btn-success btn-sm" data-confirm="${s.id}">✓ ยืนยัน</button>
            <a href="free-time-planner.html" class="btn btn-outline btn-sm">เปลี่ยน/แบ่งช่วง</a>
          </div>
        </div>`).join("");
    }
    box.innerHTML = html || `<div class="callout-muted">ยังไม่มีช่วงเวลาแนะนำใหม่ในขณะนี้</div>`;

    box.querySelectorAll("[data-confirm]").forEach((btn) => btn.addEventListener("click", () => {
      PP.confirmFreeTimeSlot(btn.dataset.confirm);
      PPToast.show("เพิ่มลงปฏิทินแล้ว ได้รับ +10 พลังชีพจรจากการวางแผนภารกิจถัดไป", "success");
      PPPulse.burst("วางแผนสำเร็จ! +10");
      renderAll();
    }));
  }

  // -----------------------------------------------------------------------
  // 3) Feedback Queue ของตัวเอง — เห็นเฉพาะทีมตัวเอง
  // -----------------------------------------------------------------------
  function renderMyQueue(teamId) {
    const box = document.getElementById("myQueueBox");
    const qpos = PP.myQueuePosition(teamId);
    if (!qpos) {
      box.innerHTML = `<div class="callout-muted">ไม่มีงานที่รอตรวจในขณะนี้</div><a href="task-detail.html" class="btn btn-primary btn-sm btn-block" style="margin-top:10px;">ส่งงาน Milestone ปัจจุบัน</a>`;
      return;
    }
    const urgencyChip = qpos.urgency === "เกินกำหนด" ? "chip-red" : qpos.urgency === "ใกล้เกินกำหนด" ? "chip-orange" : qpos.urgency === "ต้องติดตาม" ? "chip-yellow" : "chip-neutral";
    box.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="queue-rank">${qpos.position}</span>
          <span class="text-sm">คิวลำดับที่ ${qpos.position} จาก ${qpos.total} รายการ</span>
        </div>
        <div class="text-sm">คาดว่าจะได้รับ Feedback ภายใน <strong>${ThaiDate.formatThaiDate(qpos.feedbackDueDate)}</strong> <span class="text-xs text-muted">(กรอบเวลามาตรฐานของรายวิชา)</span></div>
        ${qpos.expectedReviewDate ? `<div class="text-sm" style="color:var(--pp-purple-700);">📅 อาจารย์แจ้งว่าคาดว่าจะตรวจเสร็จ: <strong>${ThaiDate.formatThaiDate(qpos.expectedReviewDate)}</strong></div>` : ""}
        <span class="chip ${urgencyChip}" style="align-self:flex-start;">${esc(qpos.urgency)}</span>
        ${qpos.overdueBy7Days ? `<div class="alert alert-warn" style="margin-top:4px;"><div class="alert__icon">⏰</div><div class="text-sm">รอนานกว่ากำหนด (เกิน 7 วัน) — ระบบแจ้งอาจารย์ที่ปรึกษาให้แล้วโดยอัตโนมัติ</div></div>` : ""}
      </div>`;
  }

  // -----------------------------------------------------------------------
  // 4) ภารกิจระหว่างรอ (Waiting Tasks) — ทำได้จริง มีปุ่มเริ่ม/เสร็จ และได้พลังชีพจร
  // -----------------------------------------------------------------------
  function renderWhileYouWait(teamId, current) {
    const box = document.getElementById("whileYouWaitBox");
    if (!["submitted", "reviewing", "revise", "need_info"].includes(current.status)) {
      box.innerHTML = `<div class="callout-muted" style="grid-column:1/-1;">ตอนนี้ยังไม่มีงานรอตรวจ — ดูภารกิจหลักที่ควรทำในการ์ดด้านบนได้เลย</div>`;
      return;
    }
    const tasks = PP.getWaitingTasks(teamId);
    if (!tasks.length) {
      box.innerHTML = `<div class="callout-muted" style="grid-column:1/-1;">ยังไม่มีภารกิจระหว่างรอสำหรับ Milestone นี้</div>`;
      return;
    }
    box.innerHTML = tasks.map((t) => `
      <div class="card" style="background:${t.done ? "var(--pp-green-100)" : "var(--pp-surface-muted)"};border-style:dashed;">
        <div class="flex gap-2 items-center" style="justify-content:space-between;">
          <div class="flex gap-2 items-center"><span>${t.done ? "✅" : "💡"}</span><span class="text-sm font-bold">${esc(t.title)}</span></div>
          ${!t.done ? `<button class="btn btn-success btn-sm" data-wt="${t.id}">ทำเสร็จ · +10</button>` : `<span class="text-xs text-muted">เสร็จแล้ว</span>`}
        </div>
      </div>`).join("");

    box.querySelectorAll("[data-wt]").forEach((btn) => btn.addEventListener("click", () => {
      PP.completeWaitingTask(teamId, btn.dataset.wt);
      PPToast.show("ทำภารกิจระหว่างรอสำเร็จแล้ว ได้รับ +10 พลังชีพจร", "success");
      PPPulse.burst("เตรียมพร้อมระหว่างรอ! +10");
      renderAll();
    }));
  }

  // -----------------------------------------------------------------------
  // 5) Milestone Timeline mini + หลักฐานความคืบหน้า
  // -----------------------------------------------------------------------
  function renderMilestoneMini(teamId, current) {
    const box = document.getElementById("milestoneMiniBox");
    const ms = PP.getMilestones(teamId);
    const next = ms.find((m) => m.order === current.order + 1);
    const detail = PP.milestoneStatusDetail(current);
    const daysLeft = ThaiDate.diffDays(current.dueDate, new Date());
    const daysLeftText = daysLeft > 0 ? `เหลืออีก ${daysLeft} วัน` : daysLeft === 0 ? "ครบกำหนดวันนี้" : `เลยกำหนดมา ${Math.abs(daysLeft)} วัน`;
    const pct = current.status === "not_started" ? 0 : ["passed", "done"].includes(current.status) ? 100 : 50;
    const barClass = daysLeft < 0 ? "orange" : "green";
    const evidenceCount = (current.evidence || []).length;

    box.innerHTML = `
      <div class="flex flex-col gap-2">
        <div>
          <div class="flex justify-between text-sm"><strong>${esc(current.name)}</strong><span class="text-muted">${esc(daysLeftText)}</span></div>
          <div class="progress" style="margin:6px 0;"><div class="progress__bar ${barClass}" style="width:${pct}%;"></div></div>
          <div class="text-xs text-muted">ผู้รับผิดชอบขั้นตอนนี้: ${esc(detail.owner)} · ขั้นตอนถัดไป: ${esc(detail.nextStep)} · อยู่ในสถานะนี้มาแล้ว ${detail.daysInStatus} วัน</div>
        </div>
        ${next ? `<div class="text-xs text-muted">Milestone ถัดไป: <strong>${esc(next.name)}</strong> (กำหนดส่ง ${ThaiDate.formatThaiDate(next.dueDate)})</div>` : ""}
        <div class="flex gap-2 items-center" style="flex-wrap:wrap;margin-top:4px;">
          <button class="btn btn-outline btn-sm" id="btnAddEvidence">📎 ส่งหลักฐานความคืบหน้า</button>
          ${evidenceCount ? `<span class="text-xs text-muted">ส่งมาแล้ว ${evidenceCount} ครั้ง</span>` : ""}
          <a href="project-timeline.html" class="btn btn-ghost btn-sm">ดูไทม์ไลน์เต็ม</a>
        </div>
      </div>`;

    document.getElementById("btnAddEvidence").addEventListener("click", () => openEvidenceModal(current.id));
  }

  function renderUpcoming(current, teamId) {
    const now = new Date();
    const horizon = ThaiDate.addDays(now, 14);
    const items = [
      { date: current.dueDate, title: `กำหนดส่ง Milestone: ${current.name}`, type: "โครงงาน", hours: current.hoursEstimate },
      ...PP.getOtherCourseTasks(teamId).map((t) => ({ date: ThaiDate.toISODate(t.dueDate), title: t.title, type: t.courseName, hours: t.hoursEstimate })),
    ].filter((i) => ThaiDate.toDate(i.date) >= ThaiDate.startOfDay(now) && ThaiDate.toDate(i.date) <= horizon)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const wrap = document.getElementById("upcomingDeadlines");
    if (!items.length) { wrap.innerHTML = `<div class="empty-state">ไม่มีกำหนดส่งในอีก 14 วันข้างหน้า</div>`; return; }
    wrap.innerHTML = `<table class="pp-table"><thead><tr><th>วันที่</th><th>รายการ</th><th>ประเภท/วิชา</th><th>ชม. โดยประมาณ</th></tr></thead><tbody>
      ${items.map((i) => `<tr><td>${ThaiDate.formatThaiDate(i.date)} <span class="text-xs text-muted">(${ThaiDate.relativeDaysLabel(i.date, now)})</span></td><td>${esc(i.title)}</td><td>${esc(i.type)}</td><td>${i.hours} ชม.</td></tr>`).join("")}
      </tbody></table>`;
  }

  // -----------------------------------------------------------------------
  // งานอื่นที่ยังค้างอยู่ (รอง จาก Hero — ไม่นับรายการที่ Hero แสดงไปแล้ว)
  // -----------------------------------------------------------------------
  function renderSecondaryTasks(pending, hero) {
    const box = document.getElementById("secondaryTasksBox");
    const heroRefId = hero ? hero.refId : null;
    const list = pending.all.filter((t) => t.id !== heroRefId);
    if (!list.length) {
      box.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🎉</div>ไม่มีงานค้างอื่นนอกจากงานหลักด้านบน</div>`;
      return;
    }
    box.innerHTML = list.slice(0, 6).map((t) => `
      <div class="task-row" data-kind="${t.source}" data-mid="${t.milestoneId}" data-id="${t.id}" data-fid="${t.feedbackId || ""}">
        <button class="checkbox" data-action="toggle" aria-label="ทำเครื่องหมายว่าเสร็จ: ${esc(t.title)}">✓</button>
        <div class="task-row__title">${esc(t.title)}</div>
        <div class="task-row__meta">${esc(t.milestoneName || "")}${t.dueDate ? " · กำหนด " + ThaiDate.formatThaiShort(t.dueDate) : ""}${t.hours ? " · " + t.hours + " ชม." : ""}</div>
      </div>`).join("");

    box.querySelectorAll('[data-action="toggle"]').forEach((btn) => btn.addEventListener("click", () => {
      const row = btn.closest(".task-row");
      if (row.dataset.kind === "feedback") PP.updateChecklistItem(row.dataset.fid, row.dataset.id, { done: true });
      else PP.toggleSubtask(row.dataset.mid, row.dataset.id);
      PPToast.show("ทำเครื่องหมายว่าเสร็จแล้ว", "success");
      PPPulse.burst("ทำสำเร็จ!");
      renderAll();
    }));
  }

  // -----------------------------------------------------------------------
  // 6) Feedback-to-Task teaser
  // -----------------------------------------------------------------------
  function renderFeedbackToTaskTeaser(teamId) {
    const slot = document.getElementById("feedbackToTaskTeaserSlot");
    const pendingFb = PP.getFeedbacksByTeam(teamId).filter((f) => !f.confirmedAt);
    if (!pendingFb.length) { slot.innerHTML = ""; return; }
    slot.innerHTML = `
      <div class="alert alert-info">
        <div class="alert__icon">📩</div>
        <div style="flex:1;">
          <div class="alert__title">มี Feedback ที่ยังไม่ได้แปลงเป็นงานแก้ไข (${pendingFb.length} รายการ)</div>
          <div class="text-sm">ตรวจสอบ Checklist ที่แปลงจาก Feedback แล้วยืนยันเพื่อสร้างงานจริงในไทม์ไลน์ — ดำเนินการครบทุกข้อจะได้รับ +15 พลังชีพจร</div>
          <a href="feedback-to-task.html" class="btn btn-secondary btn-sm" style="margin-top:8px;">ไปที่ Feedback → งานแก้ไข</a>
        </div>
      </div>`;
  }

  function renderPulseWidget(teamId) {
    const pulse = PP.getPulseState(teamId);
    const badges = PP.getBadges(teamId);
    const points = PP.getPulsePoints(teamId);
    document.getElementById("pulseWidgetBox").innerHTML = PPPulse.pulseSummary(pulse);
    document.getElementById("badgeRowBox").innerHTML = PPPulse.badgeRow(badges);
    document.getElementById("pulsePointsChip").textContent = `⚡ พลังชีพจร ${points.total} คะแนน`;
  }

  // -----------------------------------------------------------------------
  // แรงส่งประจำสัปดาห์ (Weekly Momentum)
  // -----------------------------------------------------------------------
  function renderWeeklyMomentum(teamId) {
    const box = document.getElementById("weeklyMomentumBox");
    const summary = PP.weeklyMomentumSummary(teamId, 4);
    const cats = Object.keys(summary.categories);
    box.innerHTML = `
      <div class="table-wrap">
        <table class="pp-table">
          <thead><tr><th>สัปดาห์</th>${cats.map((c) => `<th>${esc(summary.categories[c])}</th>`).join("")}</tr></thead>
          <tbody>
            ${summary.weeks.map((w) => `<tr><td>${esc(w.key)}</td>${cats.map((c) => `<td style="text-align:center;">${w.flags[c] ? "✅" : "—"}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
      ${summary.hasThreeWeekMomentum
        ? `<div class="alert alert-success" style="margin-top:10px;"><div class="alert__icon">📅</div><div class="text-sm">มีความเคลื่อนไหวต่อเนื่อง 3 สัปดาห์ล่าสุด — ได้รับตรา "รักษาจังหวะ" แล้ว!</div></div>`
        : `<div class="text-xs text-muted" style="margin-top:8px;">ทำกิจกรรมอย่างน้อย 1 อย่างต่อสัปดาห์ ติดต่อกัน 3 สัปดาห์ เพื่อรับตรา "รักษาจังหวะ"</div>`}`;
  }

  // -----------------------------------------------------------------------
  // 7) Weekly Check-in
  // -----------------------------------------------------------------------
  function renderWeeklyCheckin(teamId) {
    const box = document.getElementById("weeklyCheckinBox");
    const latest = PP.latestCheckinThisWeek(teamId);
    if (latest) {
      box.innerHTML = `
        <div class="alert alert-success">
          <div class="alert__icon">✅</div>
          <div style="flex:1;">
            <div class="alert__title">ทำ Check-in สัปดาห์นี้แล้วเมื่อ ${ThaiDate.formatThaiDateTime(latest.createdAt)}</div>
            <div class="text-sm" style="margin-top:6px;"><strong>สำเร็จ:</strong> ${esc(latest.accomplished)}</div>
            <div class="text-sm"><strong>สัปดาห์หน้า:</strong> ${esc(latest.nextPlan)}</div>
            ${latest.blockers ? `<div class="text-sm"><strong>ติดปัญหา:</strong> ${esc(latest.blockers)}</div>` : ""}
            ${latest.needsHelp ? `<div class="text-sm"><strong>อยากให้ช่วย:</strong> ${esc(latest.needsHelp)}</div>` : ""}
          </div>
        </div>
        <button class="btn btn-outline btn-sm" id="btnRedoCheckin" style="margin-top:10px;">✏️ ทำ Check-in ใหม่อีกครั้ง</button>`;
      document.getElementById("btnRedoCheckin").addEventListener("click", () => renderCheckinForm(teamId));
      return;
    }
    renderCheckinForm(teamId);
  }

  function renderCheckinForm(teamId) {
    const box = document.getElementById("weeklyCheckinBox");
    box.innerHTML = `
      <form id="checkinForm" class="flex flex-col gap-3">
        <div class="field">
          <label for="ciAccomplished">สัปดาห์นี้ทำอะไรสำเร็จ</label>
          <input class="input" id="ciAccomplished" placeholder="เช่น ถ่ายสัมภาษณ์เสร็จ 2 คน" required />
        </div>
        <div class="field">
          <label for="ciNextPlan">สัปดาห์หน้าจะทำอะไร</label>
          <input class="input" id="ciNextPlan" placeholder="เช่น เริ่มตัดต่อฉากเปิด" required />
        </div>
        <div class="field">
          <label for="ciBlockers">ติดปัญหาอะไรไหม <span class="hint">(ไม่มีก็เว้นว่างได้)</span></label>
          <input class="input" id="ciBlockers" placeholder="เช่น ยังหาผู้ให้สัมภาษณ์คนที่ 3 ไม่ได้" />
        </div>
        <div class="field">
          <label for="ciNeedsHelp">ต้องการให้อาจารย์ช่วยเรื่องใด <span class="hint">(ไม่มีก็เว้นว่างได้)</span></label>
          <input class="input" id="ciNeedsHelp" placeholder="เช่น อยากขอคำแนะนำแหล่งข้อมูลเพิ่มเติม" />
        </div>
        <button type="submit" class="btn btn-primary btn-block">ส่ง Check-in (ใช้เวลาไม่ถึง 1 นาที) · +10 พลังชีพจร</button>
      </form>`;

    document.getElementById("checkinForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const accomplished = document.getElementById("ciAccomplished").value.trim();
      const nextPlan = document.getElementById("ciNextPlan").value.trim();
      const blockers = document.getElementById("ciBlockers").value.trim();
      const needsHelp = document.getElementById("ciNeedsHelp").value.trim();
      if (!accomplished || !nextPlan) { PPToast.show("กรุณากรอกอย่างน้อย 2 ข้อแรก", "warn"); return; }
      PP.submitWeeklyCheckin(teamId, { accomplished, nextPlan, blockers, needsHelp });
      PPToast.show("ส่ง Check-in เรียบร้อยแล้ว ได้รับ +10 พลังชีพจร", "success");
      PPPulse.burst("Check-in สำเร็จ!");
      renderAll();
    });
  }

  renderAll();
})();
