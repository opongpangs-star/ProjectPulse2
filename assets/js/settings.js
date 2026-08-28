/*
 * settings.js — ตรรกะหน้า "ตั้งค่ากรอบเวลา Feedback และการแจ้งเตือน"
 * หน้าเดียวใช้ทั้ง 2 บทบาท: อาจารย์ควบคุมกรอบเวลา Feedback ทั้งหมด (สิทธิ์หลัก)
 * นิสิตเห็นค่าเดียวกันแบบอ่านอย่างเดียว + ตั้งค่าช่องทางการแจ้งเตือนของตัวเองได้
 */
(function () {
  const user = PP.getCurrentUser();
  const esc = PPNav.escapeHtml;
  const REMINDER_DAY_OPTIONS = [1, 3, 5, 7];

  function parseIntList(str) {
    return String(str)
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  function currentUserId() { return user.role === "advisor" ? user.advisorId : user.studentId; }

  function renderAll() {
    const settings = PP.getCourseSettings();
    if (user.role === "advisor") {
      const advisor = PP.getAdvisor(user.advisorId);
      document.getElementById("pageDesc").textContent =
        `จัดการกรอบเวลา Feedback มาตรฐานและการแจ้งเตือนของรายวิชา · อาจารย์ที่ปรึกษา: ${advisor.name}`;
      renderAdvisorSettings(settings);
    } else {
      const team = PP.getTeam(user.teamId);
      document.getElementById("pageDesc").textContent =
        `${team.name} · ดูกรอบเวลา Feedback ที่อาจารย์กำหนด และตั้งค่าการแจ้งเตือนส่วนตัวของคุณ`;
      renderStudentSettings(settings);
    }
    bindDangerZone();
  }

  // -----------------------------------------------------------------------
  // มุมมองอาจารย์ — แก้ไขกรอบเวลา Feedback ได้เต็มรูปแบบ (ระดับรายวิชา สิทธิ์อาจารย์เท่านั้น)
  // -----------------------------------------------------------------------
  function pendingAdvisorRequestsCardHTML() {
    const requests = PP.getPendingAdvisorChangeRequests(user.advisorId);
    if (!requests.length) return "";
    return `
      <div class="card" style="border-color:#bcd8f5;">
        <div class="card-hd">
          <div>
            <h3>📨 คำขอเปลี่ยนอาจารย์ที่ปรึกษา</h3>
            <div class="card-hd__sub">ทีมที่ขอย้ายมาอยู่ในความดูแลของท่าน — ต้องอนุมัติก่อนจึงมีผลจริง</div>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          ${requests.map(({ team, request }) => `
            <div class="task-row" style="align-items:flex-start;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <div class="font-bold">${esc(team.name)} <span class="text-muted" style="font-weight:400;">· ${esc(team.projectName)}</span></div>
                ${request.reason ? `<div class="text-sm text-muted">เหตุผล: ${esc(request.reason)}</div>` : ""}
              </div>
              <div class="flex gap-2">
                <button class="btn btn-primary btn-sm" data-accept-advisor-req="${esc(team.id)}">✅ อนุมัติ</button>
                <button class="btn btn-ghost btn-sm" data-decline-advisor-req="${esc(team.id)}">ปฏิเสธ</button>
              </div>
            </div>`).join("")}
        </div>
      </div>`;
  }

  function bindPendingAdvisorRequests() {
    document.querySelectorAll("[data-accept-advisor-req]").forEach((btn) => btn.addEventListener("click", () => {
      PP.respondAdvisorChangeRequest(btn.dataset.acceptAdvisorReq, true);
      PPToast.show("อนุมัติคำขอเปลี่ยนอาจารย์ที่ปรึกษาแล้ว", "success");
      renderAll();
    }));
    document.querySelectorAll("[data-decline-advisor-req]").forEach((btn) => btn.addEventListener("click", () => {
      PP.respondAdvisorChangeRequest(btn.dataset.declineAdvisorReq, false);
      PPToast.show("ปฏิเสธคำขอแล้ว", "info");
      renderAll();
    }));
  }

  function renderAdvisorSettings(settings) {
    const notifyPrefs = PP.getNotificationPrefs(currentUserId());
    document.getElementById("settingsContent").innerHTML = pendingAdvisorRequestsCardHTML() + `
      <div class="card">
        <div class="card-hd">
          <div>
            <h3>⏱️ กรอบเวลา Feedback (สิทธิ์อาจารย์)</h3>
            <div class="card-hd__sub">ค่ามาตรฐานที่ใช้คำนวณคิวงานรอตรวจ, Health Score และการแจ้งเตือนของทุกทีมในรายวิชา</div>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="inpSla">SLA การให้ Feedback (วัน)</label>
            <input type="number" min="1" class="input" id="inpSla" value="${settings.feedbackSlaDays}" />
            <span class="hint">เป้าหมายของการทดลองใช้: ไม่เกิน 7 วัน</span>
          </div>
          <div class="field">
            <label for="inpInactivity">แจ้งเตือนเมื่อทีมไม่มีความเคลื่อนไหว (วัน)</label>
            <input type="number" min="1" class="input" id="inpInactivity" value="${settings.studentInactivityDays}" />
          </div>
          <div class="field">
            <label for="inpCollisionWindow">ตรวจกำหนดส่งชนกันภายใน (ชั่วโมง)</label>
            <input type="number" min="1" class="input" id="inpCollisionWindow" value="${settings.deadlineCollisionWindowHours}" />
          </div>
        </div>

        <hr class="divider" />

        <div class="field" style="margin-bottom:var(--pp-space-4);">
          <label>ระยะแจ้งเตือน Milestone มาตรฐาน (วัน)</label>
          <span class="hint">จุดเช็คพอยต์มาตรฐานตามสเปกของรายวิชา — เลือกได้ว่าจะเปิดใช้งานจุดใดบ้าง</span>
          <div class="flex gap-3" style="flex-wrap:wrap;margin-top:6px;">
            ${REMINDER_DAY_OPTIONS.map((d) => `
              <label class="checkbox-line">
                <input type="checkbox" data-reminder-day="${d}" ${settings.reminderMilestones.includes(d) ? "checked" : ""} />
                ครบ ${d} วัน
              </label>`).join("")}
          </div>
        </div>

        <div class="field" style="margin-bottom:var(--pp-space-4);">
          <label for="inpStudentReminders">ระยะแจ้งเตือนกำหนดส่งล่วงหน้าให้นิสิต (วัน, คั่นด้วยจุลภาค)</label>
          <input type="text" class="input" id="inpStudentReminders" value="${esc(settings.studentDeadlineReminders.join(", "))}" />
          <span class="hint">เช่น "7, 3, 1" หมายถึงแจ้งเตือนล่วงหน้า 7 วัน, 3 วัน และ 1 วันก่อนกำหนดส่ง</span>
        </div>

        <hr class="divider" />

        <div class="field" style="margin-bottom:var(--pp-space-4);">
          <label>ช่องทางการแจ้งเตือนของฉัน (ส่วนบุคคล — ไม่กระทบผู้ใช้คนอื่น)</label>
          <div class="flex gap-3" style="flex-wrap:wrap;margin-top:6px;">
            <label class="checkbox-line"><input type="checkbox" id="chkNotifyInApp" ${notifyPrefs.inApp ? "checked" : ""} /> แจ้งเตือนในแอป (In-app)</label>
            <label class="checkbox-line"><input type="checkbox" id="chkNotifyEmail" ${notifyPrefs.email ? "checked" : ""} /> แจ้งเตือนทางอีเมล <span class="hint">(ต้นแบบนี้ยังไม่มีการส่งอีเมลจริง เป็นการจำลองเท่านั้น)</span></label>
          </div>
        </div>

        <button class="btn btn-primary" id="btnSaveSettings">💾 บันทึกการตั้งค่า</button>
      </div>`;

    bindPendingAdvisorRequests();

    document.getElementById("btnSaveSettings").addEventListener("click", () => {
      const settingsNow = PP.getCourseSettings();
      const slaVal = Number(document.getElementById("inpSla").value);
      const inactivityVal = Number(document.getElementById("inpInactivity").value);
      const collisionVal = Number(document.getElementById("inpCollisionWindow").value);
      const reminderMilestones = Array.from(document.querySelectorAll("[data-reminder-day]"))
        .filter((cb) => cb.checked)
        .map((cb) => Number(cb.dataset.reminderDay))
        .sort((a, b) => a - b);
      const studentDeadlineReminders = parseIntList(document.getElementById("inpStudentReminders").value);

      const patch = {
        feedbackSlaDays: slaVal > 0 ? slaVal : settingsNow.feedbackSlaDays,
        studentInactivityDays: inactivityVal > 0 ? inactivityVal : settingsNow.studentInactivityDays,
        deadlineCollisionWindowHours: collisionVal > 0 ? collisionVal : settingsNow.deadlineCollisionWindowHours,
        reminderMilestones: reminderMilestones.length ? reminderMilestones : settingsNow.reminderMilestones,
        studentDeadlineReminders: studentDeadlineReminders.length ? studentDeadlineReminders : settingsNow.studentDeadlineReminders,
      };
      PP.updateCourseSettings(patch);
      PP.updateNotificationPrefs(currentUserId(), {
        inApp: document.getElementById("chkNotifyInApp").checked,
        email: document.getElementById("chkNotifyEmail").checked,
      });

      if (patch.feedbackSlaDays > 7) {
        PPToast.show("บันทึกแล้ว แต่ SLA ที่ตั้งเกินเป้าหมายของการทดลองใช้ (ไม่เกิน 7 วัน)", "warn");
      } else {
        PPToast.show("บันทึกการตั้งค่าเรียบร้อยแล้ว", "success");
      }
      renderAll();
    });
  }

  // -----------------------------------------------------------------------
  // มุมมองนิสิต — แก้ไขข้อมูลทีมของตัวเอง + อ่านค่ากรอบเวลา + ตั้งค่าการแจ้งเตือนส่วนตัว
  // -----------------------------------------------------------------------
  function advisorChangeBlockHTML(team) {
    const currentAdvisor = PP.getAdvisor(team.advisorId);
    if (team.pendingAdvisorChange) {
      const target = PP.getAdvisor(team.pendingAdvisorChange.newAdvisorId);
      return `
        <div class="field">
          <label>อาจารย์ที่ปรึกษา</label>
          <div class="text-sm font-bold">${esc(currentAdvisor.name)}</div>
          <div class="callout-muted" style="margin-top:6px;">📨 มีคำขอเปลี่ยนไปอยู่ในความดูแลของ <strong>${esc(target.name)}</strong> รอการอนุมัติจากอาจารย์ท่านนั้นอยู่</div>
        </div>`;
    }
    const otherAdvisors = PP.getAdvisors().filter((a) => a.id !== team.advisorId);
    return `
      <div class="field">
        <label>อาจารย์ที่ปรึกษา</label>
        <div class="text-sm font-bold">${esc(currentAdvisor.name)}</div>
        <span class="hint">การเปลี่ยนอาจารย์ที่ปรึกษาต้องได้รับอนุมัติจากอาจารย์ท่านใหม่ก่อนจึงมีผล — ไม่ใช่การเปลี่ยนทันที</span>
        <div class="form-row" style="margin-top:8px;">
          <select class="input" id="reqAdvisorSelect">${otherAdvisors.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</select>
          <button type="button" class="btn btn-outline btn-sm" id="btnRequestAdvisorChange">ส่งคำขอเปลี่ยนอาจารย์ที่ปรึกษา</button>
        </div>
      </div>`;
  }

  function teamInfoCardHTML(team) {
    const members = PP.getStudentsByTeam(team.id);
    return `
      <div class="card">
        <div class="card-hd">
          <div>
            <h3>👥 ข้อมูลทีมของฉัน</h3>
            <div class="card-hd__sub">แก้ไขชื่อทีม ชื่อโครงงาน ประเภทผลงาน และสมาชิกในทีมได้ที่นี่</div>
          </div>
        </div>
        <div class="form-row">
          <div class="field"><label for="tiTeamName">ชื่อทีม</label><input class="input" id="tiTeamName" value="${esc(team.name)}" /></div>
          <div class="field"><label for="tiProjectName">ชื่อโครงงาน</label><input class="input" id="tiProjectName" value="${esc(team.projectName)}" /></div>
        </div>
        <div class="form-row">
          <div class="field"><label for="tiProjectType">ประเภทผลงาน</label><input class="input" id="tiProjectType" value="${esc(team.projectType)}" /></div>
        </div>
        ${advisorChangeBlockHTML(team)}
        <div class="field">
          <label>สมาชิกในทีม</label>
          <div id="tiMembers" class="flex flex-col gap-2">
            ${members.map((m) => `
              <div class="flex gap-2 member-row" data-student-id="${esc(m.id)}">
                <input class="input" data-field="name" value="${esc(m.name)}" />
                <input class="input" data-field="role" value="${esc(m.role)}" style="max-width:200px;" />
                <button type="button" class="btn btn-danger btn-sm" data-remove-member>ลบ</button>
              </div>`).join("")}
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="btnAddTeamMemberRow" style="margin-top:8px;">+ เพิ่มสมาชิก</button>
        </div>
        <button class="btn btn-primary" id="btnSaveTeamInfo" style="margin-top:12px;">💾 บันทึกข้อมูลทีม</button>
      </div>`;
  }

  function bindTeamInfoCard(team) {
    const reqBtn = document.getElementById("btnRequestAdvisorChange");
    if (reqBtn) {
      reqBtn.addEventListener("click", () => {
        const targetId = document.getElementById("reqAdvisorSelect").value;
        const reason = window.prompt("เหตุผลที่ขอเปลี่ยนอาจารย์ที่ปรึกษา (ไม่บังคับ)", "") || "";
        PP.requestAdvisorChange(team.id, targetId, reason);
        PPToast.show("ส่งคำขอเปลี่ยนอาจารย์ที่ปรึกษาแล้ว รอการอนุมัติจากอาจารย์ท่านใหม่", "success");
        renderAll();
      });
    }
    const membersBox = document.getElementById("tiMembers");
    membersBox.querySelectorAll("[data-remove-member]").forEach((btn) => btn.addEventListener("click", () => {
      const row = btn.closest(".member-row");
      const studentId = row.dataset.studentId;
      if (membersBox.children.length <= 1) { PPToast.show("ทีมต้องมีสมาชิกอย่างน้อย 1 คน", "warn"); return; }
      if (studentId) PP.removeTeamMember(studentId);
      row.remove();
    }));
    document.getElementById("btnAddTeamMemberRow").addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "flex gap-2 member-row";
      row.innerHTML = `
        <input class="input" data-field="name" placeholder="ชื่อ-สกุล" />
        <input class="input" data-field="role" placeholder="บทบาท" style="max-width:200px;" />
        <button type="button" class="btn btn-danger btn-sm" data-remove-member>ลบ</button>`;
      row.querySelector("[data-remove-member]").addEventListener("click", () => {
        if (membersBox.children.length <= 1) { PPToast.show("ทีมต้องมีสมาชิกอย่างน้อย 1 คน", "warn"); return; }
        row.remove();
      });
      membersBox.appendChild(row);
    });
    document.getElementById("btnSaveTeamInfo").addEventListener("click", () => {
      PP.updateTeamInfo(team.id, {
        name: document.getElementById("tiTeamName").value.trim() || team.name,
        projectName: document.getElementById("tiProjectName").value.trim() || team.projectName,
        projectType: document.getElementById("tiProjectType").value.trim() || team.projectType,
      });
      membersBox.querySelectorAll(".member-row").forEach((row) => {
        const name = row.querySelector('[data-field="name"]').value.trim();
        const role = row.querySelector('[data-field="role"]').value.trim() || "สมาชิก";
        if (!name) return;
        if (row.dataset.studentId) PP.updateStudent(row.dataset.studentId, { name, role });
        else PP.addTeamMember(team.id, { name, role });
      });
      PPToast.show("บันทึกข้อมูลทีมเรียบร้อยแล้ว", "success");
      renderAll();
    });
  }

  function renderStudentSettings(settings) {
    const team = PP.getTeam(user.teamId);
    const notifyPrefs = PP.getNotificationPrefs(currentUserId());
    document.getElementById("settingsContent").innerHTML = teamInfoCardHTML(team) + `
      <div class="card">
        <div class="card-hd">
          <div>
            <h3>⏱️ กรอบเวลา Feedback ปัจจุบัน</h3>
            <div class="card-hd__sub">การตั้งค่านี้จัดการโดยอาจารย์ที่ปรึกษาเท่านั้น นิสิตดูได้แบบอ่านอย่างเดียว</div>
          </div>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;margin-bottom:12px;">
          <span class="chip chip-neutral">SLA การให้ Feedback: ${settings.feedbackSlaDays} วัน</span>
          <span class="chip chip-neutral">แจ้งเตือนเมื่อทีมไม่มีความเคลื่อนไหว: ${settings.studentInactivityDays} วัน</span>
          <span class="chip chip-neutral">ตรวจกำหนดส่งชนกันภายใน: ${settings.deadlineCollisionWindowHours} ชั่วโมง</span>
        </div>
        <div class="text-sm text-muted" style="margin-bottom:6px;">ระยะแจ้งเตือน Milestone มาตรฐาน: ${settings.reminderMilestones.map((d) => `${d} วัน`).join(", ")}</div>
        <div class="text-sm text-muted">ระยะแจ้งเตือนกำหนดส่งล่วงหน้า: ${settings.studentDeadlineReminders.map((d) => `${d} วัน`).join(", ")}</div>
      </div>

      <div class="card">
        <div class="card-hd">
          <div>
            <h3>🔔 การแจ้งเตือนของฉัน</h3>
            <div class="card-hd__sub">เลือกช่องทางที่ต้องการรับการแจ้งเตือนจากระบบ — เป็นค่าส่วนตัวของคุณเท่านั้น ไม่กระทบสมาชิกในทีมหรือทีมอื่น</div>
          </div>
        </div>
        <div class="flex gap-3" style="flex-wrap:wrap;margin-bottom:var(--pp-space-4);">
          <label class="checkbox-line"><input type="checkbox" id="chkNotifyInApp" ${notifyPrefs.inApp ? "checked" : ""} /> แจ้งเตือนในแอป (In-app)</label>
          <label class="checkbox-line"><input type="checkbox" id="chkNotifyEmail" ${notifyPrefs.email ? "checked" : ""} /> แจ้งเตือนทางอีเมล <span class="hint">(ต้นแบบนี้ยังไม่มีการส่งอีเมลจริง เป็นการจำลองเท่านั้น)</span></label>
        </div>
        <button class="btn btn-primary" id="btnSaveSettings">💾 บันทึกการตั้งค่า</button>
      </div>`;

    bindTeamInfoCard(team);

    document.getElementById("btnSaveSettings").addEventListener("click", () => {
      PP.updateNotificationPrefs(currentUserId(), {
        inApp: document.getElementById("chkNotifyInApp").checked,
        email: document.getElementById("chkNotifyEmail").checked,
      });
      PPToast.show("บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว", "success");
      renderAll();
    });
  }

  // -----------------------------------------------------------------------
  // โซนอันตราย — รีเซ็ตข้อมูลตัวอย่าง (สิทธิ์อาจารย์/ผู้ดูแลเท่านั้น — นิสิตไม่เห็นปุ่มนี้)
  // -----------------------------------------------------------------------
  function bindDangerZone() {
    const btn = document.getElementById("btnResetDemo");
    if (!btn) return;
    if (user.role !== "advisor") {
      const card = btn.closest(".card");
      if (card) card.remove(); else btn.style.display = "none";
      return;
    }
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const ok = window.confirm("ต้องการรีเซ็ตข้อมูลตัวอย่างทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่? การกระทำนี้จะล้างข้อมูลที่เปลี่ยนแปลงระหว่างการสาธิตทั้งหมดและไม่สามารถย้อนกลับได้");
      if (!ok) return;
      PP.resetDemoData();
      PPToast.show("รีเซ็ตข้อมูลตัวอย่างเรียบร้อยแล้ว", "success");
      location.reload();
    });
  }

  renderAll();
})();
