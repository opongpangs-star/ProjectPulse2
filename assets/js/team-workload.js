/*
 * team-workload.js — ตรรกะหน้า Team Workload (บทบาท: นิสิตและอาจารย์)
 * นิสิต: เห็นเฉพาะภาระงานของทีมตัวเอง
 * อาจารย์: เพิ่ม selector เลือกทีมจาก PP.getTeamsByAdvisor แล้วดูภาระงานของทีมที่เลือกได้
 *
 * หมายเหตุ shared-API: PP.teamWorkload(teamId).unassigned รวมทั้ง subtask ของ milestone
 * (ไม่มี field `source`) และ checklist item จาก feedback (มี `source:"feedback"` และ `feedbackId`)
 * โค้ดหน้านี้จึงแยกประเภทโดยเช็ค `item.feedbackId` แทนการเช็ค `item.source === 'milestone'` ตรง ๆ
 * เพราะฟังก์ชัน teamWorkload ใน store.js ไม่ได้ติด source ให้กับฝั่ง milestone subtask
 * (ไม่ได้แก้ store.js ตามกติกา — ปรับตรรกะฝั่งนี้แทน)
 */
(function (global) {
  const esc = PPNav.escapeHtml;
  const user = PP.getCurrentUser();
  const isAdvisor = user.role === "advisor";
  const teams = isAdvisor ? PP.getTeamsByAdvisor(user.advisorId) : [];
  let currentTeamId = isAdvisor ? (teams[0] ? teams[0].id : null) : user.teamId;

  const DOW_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

  function timeOverlap(s1, e1, s2, e2) { return s1 < e2 && s2 < e1; }

  function isBusy(teamId, dow, start, end) {
    const blocks = PP.getSchedule(teamId).concat(PP.getPersonalBlocks(teamId));
    return blocks.some((b) => b.dow === dow && timeOverlap(b.start, b.end, start, end));
  }

  // สรุปช่วงเวลาว่างแบบง่าย ๆ จากตารางเรียน + เวลาส่วนตัวของทีม (ข้อมูลนี้เป็นระดับทีม ไม่แยกรายบุคคล
  // จึงใช้คำแนะนำเดียวกันสำหรับทุกคนในทีม ตามสเปกที่ระบุว่า "ไม่ต้องคำนวณละเอียด")
  function freeTimeHint(teamId) {
    const eveningFreeDays = [];
    for (let d = 0; d < 7; d++) {
      if (!isBusy(teamId, d, "18:00", "21:00")) eveningFreeDays.push(DOW_NAMES[d]);
    }
    if (eveningFreeDays.length) {
      return `ว่างช่วงเย็น 18.00–21.00 น. วัน${eveningFreeDays.slice(0, 3).join("/")}`;
    }
    const weekendFreeDays = [0, 6].filter((d) => !isBusy(teamId, d, "13:00", "17:00")).map((d) => DOW_NAMES[d]);
    if (weekendFreeDays.length) {
      return `ว่างช่วงบ่าย 13.00–17.00 น. วัน${weekendFreeDays.join("/")}`;
    }
    return "ตารางค่อนข้างแน่นทั้งสัปดาห์ ควรนัดเวลาล่วงหน้า";
  }

  function renderAll() {
    if (isAdvisor && !teams.length) {
      document.getElementById("pageDesc").textContent = "คุณยังไม่มีทีมในความดูแล";
      document.getElementById("teamSelectorSlot").innerHTML = "";
      document.getElementById("imbalanceSlot").innerHTML = "";
      document.getElementById("membersGrid").innerHTML = `<div class="empty-state"><div class="empty-state__icon">👥</div>ยังไม่มีทีมในความดูแลของคุณ</div>`;
      document.getElementById("unassignedList").innerHTML = "";
      return;
    }

    const team = PP.getTeam(currentTeamId);
    const students = PP.getStudentsByTeam(currentTeamId);
    const workload = PP.teamWorkload(currentTeamId);
    const advisor = PP.getAdvisor(team.advisorId);

    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}"` + (isAdvisor ? "" : ` · อาจารย์ที่ปรึกษา: ${advisor.name}`);

    renderTeamSelector();
    renderImbalance(workload);
    renderMembers(workload, currentTeamId);
    renderUnassigned(workload, students);
  }

  function renderTeamSelector() {
    const slot = document.getElementById("teamSelectorSlot");
    if (!isAdvisor) { slot.innerHTML = ""; return; }
    slot.innerHTML = `
      <div class="card">
        <div class="field" style="max-width:360px;">
          <label for="teamPicker">เลือกทีมที่ต้องการดูภาระงาน</label>
          <select id="teamPicker" class="input">
            ${teams.map((t) => `<option value="${esc(t.id)}" ${t.id === currentTeamId ? "selected" : ""}>${esc(t.name)} — ${esc(t.projectName)}</option>`).join("")}
          </select>
        </div>
      </div>`;
    document.getElementById("teamPicker").addEventListener("change", (e) => {
      currentTeamId = e.target.value;
      renderAll();
    });
  }

  // --- ส่วน render ที่ใช้ร่วมกัน (คืนค่าเป็น HTML string ล้วน ๆ ไม่ผูกกับ id ของหน้าใดหน้าหนึ่ง) ---
  // แยกออกมาเพื่อให้ pages/team-workload.html (ผ่าน renderAll ด้านล่าง) และหน้าอื่น ๆ
  // (เช่น Project Detail ผ่าน PPTeamWorkload.renderInto) ใช้ตรรกะการแสดงผลชุดเดียวกันได้ ไม่ต้อง duplicate โค้ด
  function imbalanceHtml(workload) {
    if (!workload.imbalance) return "";
    return `
      <div class="alert alert-warn">
        <div class="alert__icon">⚖️</div>
        <div>
          <div class="alert__title">ภาระงานในทีมไม่สมดุล</div>
          <div class="text-sm">สมาชิกบางคนรับภาระงาน/ชั่วโมงมากกว่าคนอื่นในทีมอย่างมีนัยสำคัญ ควรพิจารณามอบหมายงานที่ยังไม่มีผู้รับผิดชอบด้านล่างให้สมาชิกที่มีภาระงานน้อยกว่า</div>
        </div>
      </div>`;
  }

  function memberCardsHtml(workload, teamId) {
    const hint = freeTimeHint(teamId);
    if (!workload.members.length) {
      return `<div class="empty-state">ทีมนี้ยังไม่มีสมาชิก</div>`;
    }
    return workload.members.map((m) => {
      const pct = m.totalTasks ? Math.round((m.done / m.totalTasks) * 100) : 0;
      const barClass = pct >= 70 ? "green" : pct >= 40 ? "yellow" : "orange";
      return `
      <div class="card">
        <div class="flex items-center gap-3">
          <div class="avatar">${esc(PPNav.initials(m.student.name))}</div>
          <div>
            <div class="font-bold">${esc(m.student.name)}</div>
            <div class="text-xs text-muted">${esc(m.student.role || "สมาชิกทีม")}</div>
          </div>
        </div>
        <hr class="divider" />
        <div class="grid grid-2" style="gap:10px;">
          <div><span class="text-xs text-muted">งานทั้งหมด</span><div class="font-bold">${m.totalTasks} รายการ</div></div>
          <div><span class="text-xs text-muted">ชั่วโมงประมาณ</span><div class="font-bold">${m.hoursEstimate} ชม.</div></div>
          <div><span class="text-xs text-muted">เสร็จแล้ว</span><div class="font-bold">${m.done} รายการ</div></div>
          <div><span class="text-xs text-muted">ล่าช้า (overdue)</span><div class="font-bold" style="${m.overdue > 0 ? "color:var(--pp-red-700);" : ""}">${m.overdue} รายการ</div></div>
        </div>
        <div class="progress" style="margin-top:10px;"><div class="progress__bar ${barClass}" style="width:${pct}%;"></div></div>
        <div class="callout-muted" style="margin-top:10px;">⏱️ ${esc(hint)}</div>
      </div>`;
    }).join("");
  }

  function unassignedListHtml(list, students) {
    if (!list.length) {
      return `<div class="empty-state"><div class="empty-state__icon">🎉</div>ไม่มีงานที่ค้างมอบหมายในขณะนี้</div>`;
    }
    return list.map((item, idx) => {
      const isFeedbackItem = !!item.feedbackId;
      let contextLabel = "";
      if (isFeedbackItem) {
        const fb = PP.getFeedback(item.feedbackId);
        const ms = fb ? PP.getMilestone(fb.milestoneId) : null;
        contextLabel = ms ? `Feedback · ${ms.name}` : "จาก Feedback";
      } else {
        contextLabel = item.milestoneName ? `Milestone · ${item.milestoneName}` : "งานย่อย Milestone";
      }
      const dueLabel = item.dueDate ? ThaiDate.formatThaiShort(item.dueDate) : "ยังไม่กำหนดวันส่ง";
      const hoursLabel = item.hours ? `${item.hours} ชม.` : "ยังไม่ระบุชั่วโมง";
      return `
      <div class="task-row" style="flex-wrap:wrap;" data-idx="${idx}">
        <div class="task-row__title">${esc(item.title)}</div>
        <div class="task-row__meta">${esc(contextLabel)} · กำหนด ${esc(dueLabel)} · ${esc(hoursLabel)}</div>
        <div class="flex gap-2 items-center" style="margin-left:auto;flex-wrap:wrap;">
          <select class="input" data-assign-select style="min-width:170px;">
            <option value="">-- เลือกผู้รับผิดชอบ --</option>
            ${students.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}
          </select>
          <button class="btn btn-primary btn-sm" data-assign-btn>มอบหมาย</button>
        </div>
      </div>`;
    }).join("");
  }

  // ผูก event ปุ่ม "มอบหมาย" ของรายการที่ยังไม่มีผู้รับผิดชอบ — ใช้ร่วมกันทั้งหน้า team-workload.html และ renderInto()
  // `afterChange` คือ callback ให้ re-render ส่วนที่เรียก (แต่ละหน้ามีขอบเขต DOM ที่ต้องรีเฟรชต่างกัน)
  function bindUnassignedEvents(wrap, list, afterChange) {
    wrap.querySelectorAll("[data-assign-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".task-row");
        const select = row.querySelector("[data-assign-select]");
        const assigneeId = select.value;
        if (!assigneeId) {
          PPToast.show("กรุณาเลือกผู้รับผิดชอบก่อนกดมอบหมาย", "warn");
          return;
        }
        const item = list[Number(row.dataset.idx)];
        if (item.feedbackId) {
          PP.updateChecklistItem(item.feedbackId, item.id, { assigneeId });
        } else {
          const ms = PP.getMilestone(item.milestoneId);
          const subtask = ms && ms.subtasks.find((s) => s.id === item.id);
          if (subtask) subtask.assigneeId = assigneeId;
          PP.commit();
        }
        PPToast.show("มอบหมายงานเรียบร้อยแล้ว", "success");
        afterChange();
      });
    });
  }

  function renderImbalance(workload) {
    document.getElementById("imbalanceSlot").innerHTML = imbalanceHtml(workload);
  }

  function renderMembers(workload, teamId) {
    document.getElementById("membersGrid").innerHTML = memberCardsHtml(workload, teamId);
  }

  function renderUnassigned(workload, students) {
    const wrap = document.getElementById("unassignedList");
    wrap.innerHTML = unassignedListHtml(workload.unassigned, students);
    bindUnassignedEvents(wrap, workload.unassigned, renderAll);
  }

  // หน้า team-workload.html เท่านั้นที่มี #membersGrid — สคริปต์นี้ถูกโหลดในหน้าอื่น (เช่น Project Detail) ด้วย
  // จึงต้อง guard ไม่ให้ bootstrap เดิมทำงานทับ DOM ของหน้าอื่นโดยไม่ตั้งใจ
  if (document.getElementById("membersGrid")) {
    renderAll();
  }

  // ---------------------------------------------------------------------
  // Reusable export — ใช้โดยหน้าอื่น (เช่น Project Detail's Team Activity tab) เพื่อแสดงตาราง
  // ภาระงานรายบุคคลของทีมเดียวชุดเดียวกับที่หน้า team-workload.html ใช้ โดยไม่ต้อง duplicate ตรรกะ
  // ไม่รวม UI ส่วนเลือกทีมสำหรับอาจารย์ (เป็นเรื่องเฉพาะของหน้า team-workload.html เท่านั้น)
  // ---------------------------------------------------------------------
  function renderInto(container, teamId) {
    const workload = PP.teamWorkload(teamId);
    const teamStudents = PP.getStudentsByTeam(teamId);
    container.innerHTML = `
      <div data-pp-imbalance></div>
      <div class="grid grid-auto" data-pp-members style="margin-top:12px;"></div>
      <div class="font-bold text-sm" style="margin-top:20px;margin-bottom:6px;">❗ งานที่ยังไม่มีผู้รับผิดชอบ</div>
      <div class="flex flex-col gap-2" data-pp-unassigned></div>`;
    container.querySelector("[data-pp-imbalance]").innerHTML = imbalanceHtml(workload);
    container.querySelector("[data-pp-members]").innerHTML = memberCardsHtml(workload, teamId);
    const wrap = container.querySelector("[data-pp-unassigned]");
    wrap.innerHTML = unassignedListHtml(workload.unassigned, teamStudents);
    bindUnassignedEvents(wrap, workload.unassigned, () => renderInto(container, teamId));
  }

  global.PPTeamWorkload = { renderInto };
})(window);
