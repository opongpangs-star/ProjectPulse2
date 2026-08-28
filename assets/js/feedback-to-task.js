/*
 * feedback-to-task.js — ตรรกะหน้า Feedback-to-Task (บทบาท: นิสิต)
 * แสดง Feedback ของทีมที่ยังไม่ยืนยัน (confirmedAt ยังไม่มีค่า) ประกบ rawText ต้นฉบับของอาจารย์
 * คู่กับ checklist ที่แปลงมาให้ ให้นิสิตแก้ไข/ตรวจสอบให้ครบก่อนกดยืนยันบันทึกจริง
 */
(function () {
  const esc = PPNav.escapeHtml;
  const user = PP.getCurrentUser();

  function renderAll() {
    const listEl = document.getElementById("feedbackList");

    if (user.role !== "student") {
      document.getElementById("pageDesc").textContent = "";
      listEl.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">🚫</div>
            หน้านี้สำหรับบทบาทนิสิตเท่านั้น
            <div style="margin-top:12px;">
              <a href="advisor-dashboard.html" class="btn btn-secondary btn-sm">กลับไปแดชบอร์ดอาจารย์</a>
            </div>
          </div>
        </div>`;
      return;
    }

    const team = PP.getTeam(user.teamId);
    const advisor = PP.getAdvisor(team.advisorId);
    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}" · อาจารย์ที่ปรึกษา: ${advisor.name}`;

    const students = PP.getStudentsByTeam(team.id);
    const pending = PP.getFeedbacksByTeam(team.id)
      .filter((f) => !f.confirmedAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!pending.length) {
      listEl.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">✅</div>
            ไม่มี Feedback ที่รอแปลงเป็นงานในขณะนี้ ทุกรายการได้รับการยืนยันและบันทึกแล้ว
            <div style="margin-top:12px;">
              <a href="project-timeline.html" class="btn btn-primary btn-sm">ไปดูไทม์ไลน์โครงงาน</a>
            </div>
          </div>
        </div>`;
      return;
    }

    listEl.innerHTML = pending.map((fb) => renderFeedbackCard(fb, students)).join("");
    bindEvents();
  }

  function renderFeedbackCard(fb, students) {
    const milestone = PP.getMilestone(fb.milestoneId);
    const meta = PP.statusMeta(fb.decision);
    const allFilled = fb.checklist.length > 0 && fb.checklist.every((c) => c.assigneeId && c.dueDate);
    return `
    <div class="card" data-fb-card="${esc(fb.id)}">
      <div class="card-hd">
        <div>
          <h3>${esc(milestone ? milestone.name : "Milestone")}</h3>
          <div class="card-hd__sub">อาจารย์ให้ Feedback เมื่อ ${ThaiDate.formatThaiDateTime(fb.createdAt)}</div>
        </div>
        <span class="chip ${meta.chip}">${meta.label}</span>
      </div>

      <div class="grid grid-2">
        <div class="card" style="background:var(--pp-surface-muted);box-shadow:none;">
          <div class="font-bold text-sm" style="margin-bottom:8px;">📝 ข้อความจากอาจารย์ (ต้นฉบับ)</div>
          <div class="text-sm" style="white-space:pre-wrap;">${esc(fb.rawText)}</div>
        </div>

        <div>
          <div class="font-bold text-sm" style="margin-bottom:8px;">✅ Checklist ที่แปลงมาให้ (แก้ไขได้ทุกช่องก่อนยืนยัน)</div>
          <div class="table-wrap">
            <table class="pp-table">
              <thead>
                <tr>
                  <th>รายการที่ต้องแก้ไข</th>
                  <th>ผู้รับผิดชอบ</th>
                  <th>กำหนดส่ง</th>
                  <th>ชั่วโมง</th>
                  <th>เกี่ยวข้องกับ</th>
                  <th>ตรวจซ้ำ?</th>
                </tr>
              </thead>
              <tbody>
                ${fb.checklist.map((c) => renderChecklistRow(fb.id, c, students)).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3" style="margin-top:14px;flex-wrap:wrap;">
        <button class="btn btn-primary" data-confirm-fb="${esc(fb.id)}" ${allFilled ? "" : "disabled"}>✔️ ยืนยันและบันทึก</button>
        ${allFilled
          ? `<span class="text-xs text-muted">ทุกรายการพร้อมแล้ว กดยืนยันเพื่อสร้างงานย่อยจริงในไทม์ไลน์</span>`
          : `<span class="text-xs text-muted">กรุณาระบุ "ผู้รับผิดชอบ" และ "กำหนดส่ง" ให้ครบทุกรายการก่อนจึงจะยืนยันได้</span>`}
      </div>
    </div>`;
  }

  function renderChecklistRow(fbId, c, students) {
    return `
    <tr data-fb="${esc(fbId)}" data-item="${esc(c.id)}">
      <td><input type="text" class="input" data-field="title" value="${esc(c.title)}" style="min-width:180px;" /></td>
      <td>
        <select class="input" data-field="assigneeId" style="min-width:150px;">
          <option value="">-- เลือกผู้รับผิดชอบ --</option>
          ${students.map((s) => `<option value="${esc(s.id)}" ${c.assigneeId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
        </select>
      </td>
      <td><input type="date" class="input" data-field="dueDate" value="${c.dueDate ? esc(c.dueDate) : ""}" style="min-width:155px;" /></td>
      <td><input type="number" class="input" data-field="hours" min="0" step="0.5" value="${c.hours != null ? esc(c.hours) : ""}" style="min-width:90px;" /></td>
      <td><input type="text" class="input" data-field="relatedTo" value="${esc(c.relatedTo || "")}" placeholder="เช่น บทที่ 2 / Storyboard" style="min-width:150px;" /></td>
      <td style="text-align:center;">
        <label class="checkbox-line" style="justify-content:center;" title="ต้องให้อาจารย์ตรวจซ้ำหรือไม่">
          <input type="checkbox" data-field="needsRecheck" ${c.needsRecheck ? "checked" : ""} />
        </label>
      </td>
    </tr>`;
  }

  function bindEvents() {
    document.querySelectorAll("#feedbackList [data-field]").forEach((el) => {
      el.addEventListener("change", () => {
        const tr = el.closest("tr");
        const fbId = tr.dataset.fb;
        const itemId = tr.dataset.item;
        const field = el.dataset.field;
        let value;
        if (field === "needsRecheck") value = el.checked;
        else if (field === "hours") value = el.value === "" ? null : Number(el.value);
        else if (field === "dueDate") value = el.value || null;
        else value = el.value;
        PP.updateChecklistItem(fbId, itemId, { [field]: value });
        renderAll();
      });
    });

    document.querySelectorAll("#feedbackList [data-confirm-fb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fbId = btn.dataset.confirmFb;
        PP.confirmChecklist(fbId);
        PPToast.show("ยืนยันและบันทึก Checklist แล้ว งานถูกเพิ่มเข้าไทม์ไลน์โครงงานให้อัตโนมัติ", "success");
        renderAll();
      });
    });
  }

  renderAll();
})();
