/*
 * project-timeline.js — ตรรกะหน้า Project Timeline และ Micro-Milestones (บทบาท: นิสิต)
 * แสดง 10 Milestone เป็น .timeline แบบขยายดูรายละเอียดได้ทีละรายการ (accordion)
 */
(function () {
  const esc = PPNav.escapeHtml;
  const user = PP.getCurrentUser();
  const pageContent = document.getElementById("pageContent");

  // หน้านี้เป็นมุมมองนิสิตเท่านั้น — ถ้าเปิดผิดบทบาทให้ขึ้น empty-state พร้อมลิงก์กลับ
  if (user.role !== "student") {
    pageContent.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state__icon">🚫</div>
          หน้านี้ใช้สำหรับมุมมองนิสิตเท่านั้น
          <div style="margin-top:12px;">
            <a href="advisor-dashboard.html" class="btn btn-primary btn-sm">กลับไปแดชบอร์ดอาจารย์</a>
          </div>
        </div>
      </div>`;
    return;
  }

  const team = PP.getTeam(user.teamId);
  let expandedId = null;

  function riskChip(risk) {
    const map = {
      low: { label: "ความเสี่ยงต่ำ", cls: "chip-green" },
      medium: { label: "ความเสี่ยงปานกลาง", cls: "chip-yellow" },
      high: { label: "ความเสี่ยงสูง", cls: "chip-red" },
    };
    const r = map[risk] || map.low;
    return `<span class="chip ${r.cls}">${r.label}</span>`;
  }

  function dotClass(m, current) {
    if (["passed", "done"].includes(m.status)) return "done";
    if (m.risk === "high") return "risk";
    if (current && m.id === current.id) return "current";
    return "";
  }

  function assigneeNames(m) {
    const ids = [...new Set(m.subtasks.map((s) => s.assigneeId).filter(Boolean))];
    const names = ids.map((id) => (PP.getStudent(id) || {}).name).filter(Boolean);
    return names.length ? names.join(", ") : "ยังไม่ระบุผู้รับผิดชอบ";
  }

  function dependsOnLabel(m) {
    if (!m.dependsOn) return "ไม่มี (เป็น Milestone แรกของโครงงาน)";
    const prev = PP.getMilestone(m.dependsOn);
    if (!prev) return "ไม่มี";
    const passed = ["passed", "done"].includes(prev.status);
    return `${esc(prev.name)} ${passed ? "<span class=\"chip chip-green\">ผ่านแล้ว</span>" : "<span class=\"chip chip-neutral\">ยังไม่ผ่าน</span>"}`;
  }

  function renderSubtasks(m) {
    if (!m.subtasks.length) {
      return `<div class="callout-muted">ยังไม่มีงานย่อยสำหรับ Milestone นี้</div>`;
    }
    return m.subtasks.map((st) => `
      <div class="task-row ${st.done ? "is-done" : ""}">
        <button class="checkbox ${st.done ? "is-checked" : ""}" data-action="toggle-subtask" data-mid="${m.id}" data-st="${st.id}" aria-label="ทำเครื่องหมายงานย่อย">✓</button>
        <div class="task-row__title">${esc(st.title)}</div>
        <div class="task-row__meta">${esc((PP.getStudent(st.assigneeId) || {}).name || "ยังไม่มอบหมาย")}</div>
      </div>`).join("");
  }

  function renderAttachments(m) {
    const list = m.attachments.length
      ? m.attachments.map((a) => `
        <div class="task-row">
          <div class="task-row__title">📄 ${esc(a.name)}</div>
          <div class="task-row__meta">แนบเมื่อ ${ThaiDate.formatThaiDate(a.uploadedAt)}</div>
        </div>`).join("")
      : `<div class="callout-muted">ยังไม่มีไฟล์แนบสำหรับ Milestone นี้</div>`;
    return `${list}<button class="btn btn-outline btn-sm" data-action="add-attachment" data-mid="${m.id}" style="margin-top:8px;">📎 แนบไฟล์</button>`;
  }

  function renderHistory(m) {
    if (!m.history.length) return `<div class="text-sm text-muted">ยังไม่มีประวัติการดำเนินงาน</div>`;
    return `<div class="flex flex-col gap-1">${m.history.slice().reverse().map((h) => `
      <div class="text-sm"><span class="text-muted">${ThaiDate.formatThaiDate(h.date)}</span> — ${esc(h.note)}</div>`).join("")}</div>`;
  }

  function renderDetail(m) {
    const students = PP.getStudentsByTeam(team.id);
    const canSubmit = ["in_progress", "ready"].includes(m.status);
    const detail = PP.milestoneStatusDetail(m);
    return `
      <div class="timeline-item__details" style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--pp-border);display:flex;flex-direction:column;gap:16px;">
        <div class="callout-muted" style="flex-direction:column;align-items:stretch;gap:2px;">
          <span class="text-xs">ผู้รับผิดชอบขั้นตอนนี้ตอนนี้: <strong>${esc(detail.owner)}</strong></span>
          <span class="text-xs">ขั้นตอนถัดไป: ${esc(detail.nextStep)}</span>
          <span class="text-xs">อยู่ในสถานะนี้มาแล้ว ${detail.daysInStatus} วัน</span>
        </div>
        <div class="grid grid-2">
          <div><span class="text-xs text-muted">วันที่เริ่ม</span><div class="font-bold">${ThaiDate.formatThaiDate(m.startDate)}</div></div>
          <div><span class="text-xs text-muted">กำหนดส่ง</span><div class="font-bold">${ThaiDate.formatThaiDate(m.dueDate)}</div></div>
          <div><span class="text-xs text-muted">ชั่วโมงประมาณ</span><div class="font-bold">${m.hoursEstimate} ชม.</div></div>
          <div><span class="text-xs text-muted">ผู้รับผิดชอบ</span><div class="font-bold">${esc(assigneeNames(m))}</div></div>
        </div>
        <div>
          <span class="text-xs text-muted">งานที่ต้องผ่านก่อนหน้า (dependsOn)</span>
          <div style="margin-top:4px;">${dependsOnLabel(m)}</div>
        </div>

        <div>
          <div class="font-bold text-sm" style="margin-bottom:6px;">✅ งานย่อย</div>
          <div class="flex flex-col gap-2">${renderSubtasks(m)}</div>
          <form class="form-row" data-add-subtask="${m.id}" style="margin-top:10px;">
            <div class="field" style="flex:2;">
              <label>เพิ่มงานย่อยใหม่</label>
              <input type="text" class="input" name="title" placeholder="เช่น ตัดต่อฉากเปิด" required />
            </div>
            <div class="field">
              <label>ผู้รับผิดชอบ</label>
              <select class="input" name="assignee">
                <option value="">ไม่ระบุ</option>
                ${students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field" style="justify-content:flex-end;">
              <button type="submit" class="btn btn-secondary btn-sm">+ เพิ่มงานย่อย</button>
            </div>
          </form>
        </div>

        <div>
          <div class="font-bold text-sm" style="margin-bottom:6px;">📎 ไฟล์แนบ</div>
          ${renderAttachments(m)}
        </div>

        <div>
          <div class="font-bold text-sm" style="margin-bottom:6px;">🕒 ประวัติการดำเนินงาน</div>
          ${renderHistory(m)}
        </div>

        ${canSubmit ? `
        <div>
          <button class="btn btn-primary" data-action="submit-ms" data-mid="${m.id}">📨 ส่งงานให้อาจารย์ตรวจ</button>
        </div>` : ""}
      </div>`;
  }

  // เส้นทางโครงการ (Project Journey Map) — จัดกลุ่ม Milestone เดิมเข้า 6 ระยะ (มุมมองแสดงผลเท่านั้น)
  function renderPhaseMap(current) {
    const box = document.getElementById("phaseMapBox");
    const phases = PP.getProjectPhases(team.id);
    box.innerHTML = phases.map((p) => {
      const isCurrentPhase = p.milestones.some((m) => m.id === current.id);
      const allDone = p.remainingCount === 0;
      return `
      <div class="card" style="${isCurrentPhase ? "border-color:var(--pp-purple-500);" : ""}${allDone ? "background:var(--pp-green-100);" : ""}">
        <div class="font-bold text-sm">${allDone ? "✅" : isCurrentPhase ? "▶️" : "⏳"} ${esc(p.name)}</div>
        <div class="text-xs text-muted" style="margin-top:4px;">เสร็จแล้ว ${p.completedCount} / ${p.milestones.length} Milestone</div>
        ${p.dueDate ? `<div class="text-xs text-muted">กำหนดส่งระยะนี้: ${ThaiDate.formatThaiDate(p.dueDate)}</div>` : ""}
        ${p.feedbackToFixCount > 0 ? `<div class="text-xs" style="color:var(--pp-red-700);margin-top:2px;">มี Feedback ที่ต้องแก้ไข ${p.feedbackToFixCount} รายการ</div>` : ""}
      </div>`;
    }).join("");
  }

  function renderAll() {
    const milestones = PP.getMilestones(team.id);
    const current = PP.getCurrentMilestone(team.id);
    const passedCount = milestones.filter((m) => ["passed", "done"].includes(m.status)).length;
    const advisor = PP.getAdvisor(team.advisorId);

    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}" · อาจารย์ที่ปรึกษา: ${advisor.name}`;
    document.getElementById("timelineSummary").textContent =
      `ผ่านแล้ว ${passedCount} / ${milestones.length} Milestone · Milestone ปัจจุบัน: ${current.name}`;

    renderPhaseMap(current);

    const list = document.getElementById("timelineList");
    list.innerHTML = milestones.map((m, i) => {
      const isLast = i === milestones.length - 1;
      const isOpen = expandedId === m.id;
      const meta = PP.statusMeta(m.status);
      return `
      <div class="timeline-item">
        <div class="timeline-item__rail">
          <div class="timeline-item__dot ${dotClass(m, current)}">${i + 1}</div>
          ${isLast ? "" : `<div class="timeline-item__line"></div>`}
        </div>
        <div class="timeline-item__body">
          <div class="timeline-item__hd">
            <span class="timeline-item__title">${esc(m.name)}</span>
            <span class="chip ${meta.chip}">${meta.label}</span>
            ${riskChip(m.risk)}
            <button class="btn btn-ghost btn-sm" data-toggle="${m.id}" style="margin-left:auto;">
              ${isOpen ? "▲ ซ่อนรายละเอียด" : "▾ ดูรายละเอียด"}
            </button>
          </div>
          <div class="timeline-item__meta">
            กำหนดส่ง ${ThaiDate.formatThaiDate(m.dueDate)} (${ThaiDate.relativeDaysLabel(m.dueDate, new Date())}) · ${m.hoursEstimate} ชม. · ${esc(assigneeNames(m))}
          </div>
          ${isOpen ? renderDetail(m) : ""}
        </div>
      </div>`;
    }).join("");

    // ผูก event ใหม่ทุกครั้งหลัง render
    list.querySelectorAll("[data-toggle]").forEach((btn) => btn.addEventListener("click", () => {
      expandedId = expandedId === btn.dataset.toggle ? null : btn.dataset.toggle;
      renderAll();
    }));

    list.querySelectorAll('[data-action="toggle-subtask"]').forEach((btn) => btn.addEventListener("click", () => {
      const wasChecked = btn.classList.contains("is-checked");
      PP.toggleSubtask(btn.dataset.mid, btn.dataset.st);
      PPToast.show("อัปเดตสถานะงานย่อยแล้ว", "success");
      if (!wasChecked) PPPulse.burst("ทำสำเร็จ!");
      renderAll();
    }));

    list.querySelectorAll('[data-action="add-attachment"]').forEach((btn) => btn.addEventListener("click", () => {
      const fileName = window.prompt("ระบุชื่อไฟล์ที่ต้องการแนบ (จำลอง ไม่มีการอัปโหลดจริง):", "");
      if (!fileName) return;
      PP.addAttachment(btn.dataset.mid, fileName.trim());
      PPToast.show("แนบไฟล์เรียบร้อยแล้ว", "success");
      renderAll();
    }));

    list.querySelectorAll('[data-action="submit-ms"]').forEach((btn) => btn.addEventListener("click", () => {
      const fileName = window.prompt("ระบุชื่อไฟล์งานที่จะส่งให้อาจารย์ตรวจ (จำลอง ไม่มีการอัปโหลดจริง):", "");
      if (fileName === null) return;
      PP.submitMilestone(btn.dataset.mid, fileName.trim() || undefined);
      PPToast.show("ส่งงานเข้าคิวตรวจแล้ว รอผลจากอาจารย์ที่ปรึกษา", "success");
      PPPulse.burst("ส่งงานสำเร็จ!");
      renderAll();
    }));

    list.querySelectorAll("form[data-add-subtask]").forEach((form) => form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = form.title.value.trim();
      if (!title) return;
      PP.addSubtask(form.dataset.addSubtask, title, form.assignee.value || undefined);
      PPToast.show("เพิ่มงานย่อยใหม่แล้ว", "success");
      renderAll();
    }));
  }

  renderAll();
})();
