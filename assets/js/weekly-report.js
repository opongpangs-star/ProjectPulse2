/*
 * weekly-report.js — ตรรกะหน้า "รายงานความก้าวหน้ารายสัปดาห์"
 * หน้าเดียวใช้ทั้ง 2 บทบาท: นิสิต (PP.weeklyReport) และ อาจารย์ (PP.overallExperimentMetrics)
 * โครงสร้าง/แพทเทิร์นก็อปมาจาก dashboard-student.js (renderAll + escapeHtml + toast หลัง mutation)
 */
(function () {
  const user = PP.getCurrentUser();
  const esc = PPNav.escapeHtml;

  function renderAll() {
    if (user.role === "student") renderStudentView();
    else renderAdvisorView();
  }

  // -----------------------------------------------------------------------
  // มุมมองนิสิต
  // -----------------------------------------------------------------------
  function renderStudentView() {
    const team = PP.getTeam(user.teamId);
    const advisor = PP.getAdvisor(team.advisorId);
    const report = PP.weeklyReport(team.id);
    const course = PP.getCourse();
    const pending = PP.getPendingWork(team.id);

    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}" · อาจารย์ที่ปรึกษา: ${advisor.name}`;

    const completedBar = report.milestonesCompletedPct >= 70 ? "green" : report.milestonesCompletedPct >= 40 ? "yellow" : "orange";
    const onTimeBar = report.onTimePct >= 80 ? "green" : report.onTimePct >= 50 ? "yellow" : "orange";
    const experimentTargetWeeks = 13;
    const weekVsTargetPct = Math.min(100, Math.round((course.currentWeek / experimentTargetWeeks) * 100));
    const weekVsSemesterPct = Math.min(100, Math.round((course.currentWeek / course.weeks) * 100));
    const aheadOfTarget = course.currentWeek <= experimentTargetWeeks;

    const html = `
      <div class="grid grid-4" id="statCards">
        <div class="card card-stat">
          <span class="card-stat__label">Milestone ที่เสร็จแล้ว</span>
          <span class="card-stat__value">${report.milestonesCompletedPct}%</span>
          <div class="progress"><div class="progress__bar ${completedBar}" style="width:${report.milestonesCompletedPct}%;"></div></div>
          <span class="card-stat__hint">Milestone ปัจจุบัน: ${esc(report.currentMilestone.name)}</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">ส่งงานตรงเวลา</span>
          <span class="card-stat__value">${report.onTimePct}%</span>
          <div class="progress"><div class="progress__bar ${onTimeBar}" style="width:${report.onTimePct}%;"></div></div>
          <span class="card-stat__hint">คำนวณจาก Milestone ที่ผ่านแล้วทั้งหมด</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">Project Health Score</span>
          <span class="health-badge ${report.health.level}"><span class="health-dot"></span>${report.health.score} / 100</span>
          <span class="text-xs text-muted">*เป็นตัวชี้วัดความเสี่ยงของการดำเนินงาน ไม่ใช่คะแนนรายวิชา</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">สัปดาห์ของภาคการศึกษา</span>
          <span class="card-stat__value">${course.currentWeek}<span style="font-size:1rem;color:var(--pp-text-500);"> / ${course.weeks}</span></span>
          <span class="card-stat__hint">เทียบเป้าหมายรอบเวลาทดลองใช้ ${experimentTargetWeeks} สัปดาห์</span>
        </div>
      </div>

      <div class="grid grid-3">
        <div class="card col-span-2">
          <div class="card-hd">
            <div>
              <h3>🩺 เหตุผลของ Health Score</h3>
              <div class="card-hd__sub">รายการปัจจัยเสี่ยงทั้งหมดที่ใช้ประกอบการคำนวณคะแนน</div>
            </div>
          </div>
          <ul style="padding-left:1.1em;margin:0;">
            ${report.health.reasons.map((r) => `<li class="text-sm" style="margin-bottom:6px;">${esc(r)}</li>`).join("")}
          </ul>
        </div>
        <div class="card">
          <div class="card-hd"><h3>📌 Milestone ปัจจุบัน</h3></div>
          <div class="flex flex-col gap-2">
            <span class="font-bold">${esc(report.currentMilestone.name)}</span>
            <span class="chip ${PP.statusMeta(report.currentMilestone.status).chip}">${PP.statusMeta(report.currentMilestone.status).label}</span>
            <span class="text-sm text-muted">กำหนดส่ง ${ThaiDate.formatThaiDate(report.currentMilestone.dueDate)}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <div>
            <h3>🗓️ ความเร็วของภาคการศึกษาเทียบเป้าหมายการทดลองใช้</h3>
            <div class="card-hd__sub">การทดลองใช้ ProjectPulse ตั้งเป้าลดรอบเวลาทำโครงงานจากแบบเดิม ${course.weeks} สัปดาห์ เหลือประมาณ ${experimentTargetWeeks} สัปดาห์</div>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <div>
            <div class="flex justify-between text-sm"><span>เทียบกับภาคการศึกษาทั้งหมด (${course.weeks} สัปดาห์)</span><span class="font-bold">สัปดาห์ที่ ${course.currentWeek}</span></div>
            <div class="progress"><div class="progress__bar" style="width:${weekVsSemesterPct}%;"></div></div>
          </div>
          <div>
            <div class="flex justify-between text-sm"><span>เทียบกับเป้าหมายรอบเวลาทดลองใช้ (${experimentTargetWeeks} สัปดาห์)</span><span class="font-bold">${weekVsTargetPct}%</span></div>
            <div class="progress"><div class="progress__bar ${aheadOfTarget ? "green" : "orange"}" style="width:${weekVsTargetPct}%;"></div></div>
          </div>
          <div class="callout-muted">${aheadOfTarget
            ? `ตอนนี้อยู่ในสัปดาห์ที่ ${course.currentWeek} ซึ่งยังอยู่ในกรอบเป้าหมาย ${experimentTargetWeeks} สัปดาห์ของการทดลองใช้`
            : `ตอนนี้อยู่ในสัปดาห์ที่ ${course.currentWeek} ซึ่งเกินกรอบเป้าหมาย ${experimentTargetWeeks} สัปดาห์ของการทดลองใช้แล้ว ควรเร่งความคืบหน้า`}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <div>
            <h3>📋 สรุปงานสัปดาห์นี้</h3>
            <div class="card-hd__sub">งานย่อยและรายการแก้ไขจาก Feedback ที่ยังไม่เสร็จทั้งหมด ${pending.all.length} รายการ (งานย่อย ${pending.subtasks.length} · จาก Feedback ${pending.checklist.length})</div>
          </div>
        </div>
        <div id="pendingWorkBox" class="flex flex-col gap-2"></div>
      </div>
    `;
    document.getElementById("reportContent").innerHTML = html;
    renderPendingWork(pending);
  }

  function renderPendingWork(pending) {
    const box = document.getElementById("pendingWorkBox");
    if (!pending.all.length) {
      box.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🎉</div>ไม่มีงานค้างในสัปดาห์นี้</div>`;
      return;
    }
    box.innerHTML = pending.all.slice(0, 8).map((t) => `
      <div class="task-row" data-kind="${t.source}" data-mid="${t.milestoneId}" data-id="${t.id}" data-fid="${t.feedbackId || ""}">
        <button class="checkbox" data-action="toggle">✓</button>
        <div class="task-row__title">${esc(t.title)}</div>
        <div class="task-row__meta">${esc(t.milestoneName || "")}${t.dueDate ? " · กำหนด " + ThaiDate.formatThaiShort(t.dueDate) : ""}${t.hours ? " · " + t.hours + " ชม." : ""}</div>
      </div>`).join("");

    box.querySelectorAll('[data-action="toggle"]').forEach((btn) => btn.addEventListener("click", () => {
      const row = btn.closest(".task-row");
      if (row.dataset.kind === "feedback") PP.updateChecklistItem(row.dataset.fid, row.dataset.id, { done: true });
      else PP.toggleSubtask(row.dataset.mid, row.dataset.id);
      PPToast.show("ทำเครื่องหมายว่าเสร็จแล้ว", "success");
      renderAll();
    }));
  }

  // -----------------------------------------------------------------------
  // มุมมองอาจารย์
  // -----------------------------------------------------------------------
  function renderAdvisorView() {
    const advisor = PP.getAdvisor(user.advisorId);
    const metrics = PP.overallExperimentMetrics();

    document.getElementById("pageDesc").textContent =
      `ภาพรวมผลการทดลองใช้ ProjectPulse ทุกทีมในรายวิชา · อาจารย์ที่ปรึกษา: ${advisor.name}`;

    const html = `
      <div class="grid grid-4">
        <div class="card card-stat">
          <span class="card-stat__label">จำนวนทีมทั้งหมด</span>
          <span class="card-stat__value">${metrics.teamsCount}</span>
          <span class="card-stat__hint">ทุกทีมในรายวิชา</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">Milestone เสร็จเฉลี่ย</span>
          <span class="card-stat__value">${metrics.avgMilestonesCompletedPct}%</span>
          <span class="card-stat__hint">เป้าหมาย ≥ ${metrics.targets.milestoneCompletion}%</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">ส่งตรงเวลาเฉลี่ย</span>
          <span class="card-stat__value">${metrics.avgOnTimePct}%</span>
          <span class="card-stat__hint">เป้าหมาย ≥ ${metrics.targets.onTime}%</span>
        </div>
        <div class="card card-stat">
          <span class="card-stat__label">รอ Feedback เฉลี่ย</span>
          <span class="card-stat__value">${metrics.avgFeedbackWaitDays} วัน</span>
          <span class="card-stat__hint">เป้าหมาย ≤ ${metrics.targets.feedbackWaitMax} วัน</span>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <div>
            <h3>🧪 ผลการทดลองใช้เทียบเป้าหมาย</h3>
            <div class="card-hd__sub">เปรียบเทียบค่าเป้าหมายของการทดลองใช้กับค่าเฉลี่ยจริงจากข้อมูลจำลอง</div>
          </div>
        </div>
        <div class="alert alert-info" style="margin-bottom:var(--pp-space-4);">
          <div class="alert__icon">ℹ️</div>
          <div>
            <div class="alert__title">เป้าหมายของการทดลองใช้ ไม่ใช่ผลลัพธ์ที่พิสูจน์แล้ว</div>
            <div class="text-sm">ตัวเลขเป้าหมายด้านล่าง (Milestone ครบ ≥70%, ส่งตรงเวลา ≥80%, รอ Feedback ไม่เกิน 7 วัน, ลดรอบเวลาจาก 16 เหลือ ~13 สัปดาห์) เป็นสมมติฐานที่ตั้งไว้สำหรับการทดลองใช้ระบบเท่านั้น ยังไม่ใช่ผลลัพธ์ที่ผ่านการพิสูจน์หรือรับรองอย่างเป็นทางการ ควรใช้ประกอบการตัดสินใจอย่างระมัดระวังร่วมกับข้อมูลเชิงคุณภาพอื่น ๆ</div>
          </div>
        </div>
        <div class="flex flex-col gap-4" id="metricPairs"></div>
      </div>

      <div class="card">
        <div class="card-hd">
          <div>
            <h3>👥 เปรียบเทียบผลของทุกทีม</h3>
            <div class="card-hd__sub">ข้อมูล ณ ปัจจุบัน แยกตามทีมทั้งหมดในรายวิชา</div>
          </div>
        </div>
        <div class="table-wrap" id="perTeamTable"></div>
      </div>
    `;
    document.getElementById("reportContent").innerHTML = html;
    renderMetricPairs(metrics);
    renderPerTeamTable(metrics);
  }

  function pairedBarBlock({ title, targetVal, targetLabel, actualVal, actualLabel, unit, maxVal, lowerIsBetter, meets }) {
    const targetPct = Math.max(0, Math.min(100, Math.round((targetVal / maxVal) * 100)));
    const actualPct = Math.max(0, Math.min(100, Math.round((actualVal / maxVal) * 100)));
    const barClass = meets ? "green" : "orange";
    return `
      <div>
        <div class="flex justify-between text-sm" style="margin-bottom:4px;"><strong>${esc(title)}</strong><span class="${meets ? "text-muted" : "font-bold"}">${meets ? "เป็นไปตามเป้าหมาย" : "ยังไม่ถึงเป้าหมาย"}</span></div>
        <div class="flex justify-between text-xs text-muted"><span>${esc(targetLabel)}: ${targetVal}${unit}</span></div>
        <div class="progress" style="margin-bottom:8px;"><div class="progress__bar" style="width:${targetPct}%;"></div></div>
        <div class="flex justify-between text-xs text-muted"><span>${esc(actualLabel)}: ${actualVal}${unit}</span></div>
        <div class="progress"><div class="progress__bar ${barClass}" style="width:${actualPct}%;"></div></div>
      </div>`;
  }

  function renderMetricPairs(metrics) {
    const t = metrics.targets;
    const blocks = [
      pairedBarBlock({
        title: "Milestone ที่เสร็จสมบูรณ์", unit: "%", maxVal: 100,
        targetVal: t.milestoneCompletion, targetLabel: "เป้าหมาย",
        actualVal: metrics.avgMilestonesCompletedPct, actualLabel: "ค่าเฉลี่ยจริง (ข้อมูลจำลอง)",
        meets: metrics.avgMilestonesCompletedPct >= t.milestoneCompletion,
      }),
      pairedBarBlock({
        title: "ส่งงานตรงเวลา", unit: "%", maxVal: 100,
        targetVal: t.onTime, targetLabel: "เป้าหมาย",
        actualVal: metrics.avgOnTimePct, actualLabel: "ค่าเฉลี่ยจริง (ข้อมูลจำลอง)",
        meets: metrics.avgOnTimePct >= t.onTime,
      }),
      pairedBarBlock({
        title: "ระยะเวลารอ Feedback", unit: " วัน", maxVal: Math.max(14, Math.ceil(metrics.avgFeedbackWaitDays * 1.2), t.feedbackWaitMax * 2),
        targetVal: t.feedbackWaitMax, targetLabel: "เป้าหมายสูงสุด",
        actualVal: metrics.avgFeedbackWaitDays, actualLabel: "ค่าเฉลี่ยจริง (ข้อมูลจำลอง)",
        meets: metrics.avgFeedbackWaitDays <= t.feedbackWaitMax,
      }),
      pairedBarBlock({
        title: "รอบเวลาทำโครงงาน (สัปดาห์)", unit: " สัปดาห์", maxVal: t.cycleWeeksBaseline,
        targetVal: t.cycleWeeksTarget, targetLabel: "เป้าหมายการทดลองใช้",
        actualVal: t.cycleWeeksBaseline, actualLabel: "รูปแบบเดิม (baseline)",
        meets: true,
      }),
    ];
    document.getElementById("metricPairs").innerHTML = blocks.join(`<hr class="divider" />`);
  }

  function renderPerTeamTable(metrics) {
    const rows = metrics.perTeam.map((r) => {
      const team = PP.getTeam(r.teamId);
      const meta = PP.statusMeta(r.currentMilestone.status);
      return `
        <tr>
          <td class="font-bold">${esc(team.name)}</td>
          <td>${esc(team.projectName)}</td>
          <td>${esc(r.currentMilestone.name)} <span class="chip ${meta.chip}">${meta.label}</span></td>
          <td>${r.milestonesCompletedPct}%</td>
          <td>${r.onTimePct}%</td>
          <td><span class="health-badge ${r.health.level}"><span class="health-dot"></span>${r.health.score}</span></td>
        </tr>`;
    }).join("");
    document.getElementById("perTeamTable").innerHTML = `
      <table class="pp-table">
        <thead><tr><th>ทีม</th><th>โครงงาน</th><th>Milestone ปัจจุบัน</th><th>% เสร็จ</th><th>% ตรงเวลา</th><th>Health</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  renderAll();
})();
