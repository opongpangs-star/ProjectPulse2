/*
 * task-detail.js — ตรรกะหน้ารายละเอียดงานและการส่งไฟล์ (บทบาท: นิสิต)
 * โฟกัสที่ Milestone ปัจจุบันของทีม: งานย่อย + ฟอร์มส่งงานจริง (จำลองไฟล์แนบ)
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
  // สถานะที่ "ไม่อนุญาต" ให้ส่งงานซ้ำ: รอตรวจอยู่แล้ว, กำลังตรวจ, หรือผ่าน/เสร็จสมบูรณ์ไปแล้ว
  const BLOCKED_SUBMIT_STATUSES = ["submitted", "reviewing", "passed", "done"];

  function riskChip(risk) {
    const map = {
      low: { label: "ความเสี่ยงต่ำ", cls: "chip-green" },
      medium: { label: "ความเสี่ยงปานกลาง", cls: "chip-yellow" },
      high: { label: "ความเสี่ยงสูง", cls: "chip-red" },
    };
    const r = map[risk] || map.low;
    return `<span class="chip ${r.cls}">${r.label}</span>`;
  }

  function dependsOnLabel(m) {
    if (!m.dependsOn) return "ไม่มี (เป็น Milestone แรกของโครงงาน)";
    const prev = PP.getMilestone(m.dependsOn);
    if (!prev) return "ไม่มี";
    const passed = ["passed", "done"].includes(prev.status);
    return `${esc(prev.name)} ${passed ? "<span class=\"chip chip-green\">ผ่านแล้ว</span>" : "<span class=\"chip chip-neutral\">ยังไม่ผ่าน</span>"}`;
  }

  function getSubmissionsForMilestone(milestoneId) {
    return PP.getSubmissionsByTeam(team.id)
      .filter((s) => s.milestoneId === milestoneId)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  function findActiveFeedback(current) {
    if (!["revise", "need_info"].includes(current.status)) return null;
    const subs = getSubmissionsForMilestone(current.id);
    for (const s of subs) {
      const fb = PP.getFeedbackBySubmission(s.id);
      if (fb && !fb.confirmedAt) return fb;
    }
    return null;
  }

  function renderFeedbackAlert(current) {
    const slot = document.getElementById("feedbackAlertSlot");
    const fb = findActiveFeedback(current);
    if (!fb) { slot.innerHTML = ""; return; }
    const meta = PP.statusMeta(current.status);
    slot.innerHTML = `
      <div class="alert alert-warn">
        <div class="alert__icon">📩</div>
        <div style="flex:1;">
          <div class="alert__title">อาจารย์ที่ปรึกษาส่ง Feedback กลับมาแล้ว (${meta.label})</div>
          <div class="text-sm">มีรายการที่ต้องตรวจสอบและยืนยันก่อนดำเนินการต่อ กรุณาตรวจสอบ Checklist ที่แปลงมาจาก Feedback แล้วยืนยันเพื่อสร้างงานย่อยจริงในโครงงาน</div>
          <div style="margin-top:8px;">
            <a href="feedback-to-task.html" class="btn btn-secondary btn-sm">📩 ดู Feedback → งานแก้ไข</a>
          </div>
        </div>
      </div>`;
  }

  function renderSubtasks(m) {
    const box = document.getElementById("subtaskList");
    if (!m.subtasks.length) {
      box.innerHTML = `<div class="callout-muted">ยังไม่มีงานย่อยสำหรับ Milestone นี้</div>`;
      return;
    }
    box.innerHTML = m.subtasks.map((st) => `
      <div class="task-row ${st.done ? "is-done" : ""}">
        <button class="checkbox ${st.done ? "is-checked" : ""}" data-action="toggle-subtask" data-st="${st.id}" aria-label="ทำเครื่องหมายงานย่อย">✓</button>
        <div class="task-row__title">${esc(st.title)}</div>
        <div class="task-row__meta">${esc((PP.getStudent(st.assigneeId) || {}).name || "ยังไม่มอบหมาย")}</div>
      </div>`).join("");

    box.querySelectorAll('[data-action="toggle-subtask"]').forEach((btn) => btn.addEventListener("click", () => {
      const wasChecked = btn.classList.contains("is-checked");
      PP.toggleSubtask(m.id, btn.dataset.st);
      PPToast.show("อัปเดตสถานะงานย่อยแล้ว", "success");
      if (!wasChecked) PPPulse.burst("ทำสำเร็จ!");
      renderAll();
    }));
  }

  function renderSubmitStatus(current) {
    const slot = document.getElementById("submitStatusSlot");
    const fieldset = document.getElementById("submitFieldset");
    const meta = PP.statusMeta(current.status);

    if (["passed", "done"].includes(current.status)) {
      fieldset.disabled = true;
      slot.innerHTML = `
        <div class="alert alert-success" style="margin-bottom:14px;">
          <div class="alert__icon">✅</div>
          <div>
            <div class="alert__title">Milestone นี้ผ่านเรียบร้อยแล้ว</div>
            <div class="text-sm">ไม่ต้องส่งงานซ้ำสำหรับ Milestone นี้ — ระบบจะเลื่อนไป Milestone ถัดไปให้อัตโนมัติ</div>
          </div>
        </div>`;
      return;
    }

    if (["submitted", "reviewing"].includes(current.status)) {
      fieldset.disabled = true;
      const sub = getSubmissionsForMilestone(current.id)[0];
      const waitDays = sub ? ThaiDate.diffDays(new Date(), sub.submittedAt) : 0;
      slot.innerHTML = `
        <div class="callout-muted" style="flex-direction:column;align-items:stretch;margin-bottom:14px;">
          <div class="flex items-center gap-2" style="margin-bottom:6px;">
            <span class="chip ${meta.chip}">${meta.label}</span>
          </div>
          <div class="text-sm font-bold">${ThaiDate.waitingDaysLabel(waitDays)}</div>
          ${sub ? `<div class="text-xs text-muted">ส่งเมื่อ ${ThaiDate.formatThaiDateTime(sub.submittedAt)} · ไฟล์ ${esc(sub.fileName)}</div>` : ""}
          <div class="text-xs text-muted" style="margin-top:6px;">ระหว่างรอผล สามารถทำงานย่อยของ Milestone ถัดไปที่ไม่เสี่ยงต้องรื้อใหม่ไปพลางก่อนได้</div>
        </div>`;
      return;
    }

    // สถานะที่ยังส่งได้: not_started / in_progress / ready / revise / need_info / blocked
    fieldset.disabled = false;
    slot.innerHTML = `
      <div class="callout-muted" style="margin-bottom:14px;">
        <span>ℹ️</span>
        <span>สถานะปัจจุบัน: <span class="chip ${meta.chip}" style="margin-left:4px;">${meta.label}</span> — กรอกไฟล์และหมายเหตุแล้วกดส่งงานเข้าคิวตรวจได้เลย</span>
      </div>`;

    renderResubmitSection(current);
  }

  // เมื่อกำลังส่งใหม่หลังถูกให้แก้ไข ต้องระบุว่าแก้ข้อไหนแล้วบ้าง + อธิบายสิ่งที่แก้ไข ก่อนจะส่งได้
  function renderResubmitSection(current) {
    const section = document.getElementById("resubmitSection");
    const box = document.getElementById("resubmitChecklistBox");
    const fb = findActiveFeedback(current);
    if (!["revise", "need_info"].includes(current.status) || !fb) {
      section.style.display = "none";
      box.innerHTML = "";
      return;
    }
    section.style.display = "";
    box.innerHTML = fb.checklist.map((c) => `
      <label class="checkbox-line">
        <input type="checkbox" data-addressed-item="${esc(c.id)}" />
        ${esc(c.title)}
      </label>`).join("");
  }

  function renderAll() {
    const current = PP.getCurrentMilestone(team.id);
    const advisor = PP.getAdvisor(team.advisorId);
    const meta = PP.statusMeta(current.status);

    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}" · อาจารย์ที่ปรึกษา: ${advisor.name}`;
    document.getElementById("milestoneTitle").textContent = `📌 ${current.name}`;
    document.getElementById("milestoneSub").innerHTML =
      `Milestone ที่ ${current.order} จาก 10 · <span class="chip ${meta.chip}">${meta.label}</span>`;

    document.getElementById("milestoneInfo").innerHTML = `
      <div><span class="text-xs text-muted">วันที่เริ่ม</span><div class="font-bold">${ThaiDate.formatThaiDate(current.startDate)}</div></div>
      <div><span class="text-xs text-muted">กำหนดส่ง</span><div class="font-bold">${ThaiDate.formatThaiDate(current.dueDate)} <span class="text-xs text-muted">(${ThaiDate.relativeDaysLabel(current.dueDate, new Date())})</span></div></div>
      <div><span class="text-xs text-muted">ชั่วโมงประมาณ</span><div class="font-bold">${current.hoursEstimate} ชม.</div></div>
      <div><span class="text-xs text-muted">ความเสี่ยง</span><div>${riskChip(current.risk)}</div></div>
      <div class="col-span-2"><span class="text-xs text-muted">งานที่ต้องผ่านก่อนหน้า (dependsOn)</span><div style="margin-top:4px;">${dependsOnLabel(current)}</div></div>
    `;

    renderFeedbackAlert(current);
    renderSubtasks(current);
    renderSubmitStatus(current);
  }

  // ฟอร์มส่งงานเป็น element คงที่ในหน้า HTML — ผูก listener ครั้งเดียว แล้วดึง milestone ปัจจุบันสดใหม่ตอน submit
  document.getElementById("submitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const current = PP.getCurrentMilestone(team.id);
    if (BLOCKED_SUBMIT_STATUSES.includes(current.status)) return; // กันไว้อีกชั้นแม้ fieldset จะ disabled อยู่แล้ว

    const isResubmit = ["revise", "need_info"].includes(current.status) && !!findActiveFeedback(current);
    let changesSummary = "";
    let addressedChecklistIds = [];
    if (isResubmit) {
      changesSummary = document.getElementById("changesSummaryInput").value.trim();
      if (!changesSummary) {
        PPToast.show("กรุณาอธิบายสิ่งที่แก้ไขก่อนส่งใหม่ อาจารย์จะได้เห็นว่าคุณแก้อะไรไปบ้าง", "warn");
        return;
      }
      addressedChecklistIds = Array.from(document.querySelectorAll("[data-addressed-item]:checked")).map((el) => el.dataset.addressedItem);
    }

    const fileInput = document.getElementById("fileInput");
    const noteInput = document.getElementById("noteInput");
    const file = fileInput.files && fileInput.files[0];
    const fileName = file ? file.name : `${current.name}.pdf`;
    const note = noteInput.value.trim();

    PP.submitMilestone(current.id, fileName, note, isResubmit ? { changesSummary, addressedChecklistIds } : undefined);
    PPToast.show("ส่งงานเข้าคิวตรวจแล้ว รอผลจากอาจารย์ที่ปรึกษา", "success");
    PPPulse.burst("ส่งงานสำเร็จ!");

    fileInput.value = "";
    noteInput.value = "";
    document.getElementById("changesSummaryInput").value = "";
    renderAll();
  });

  renderAll();
})();
