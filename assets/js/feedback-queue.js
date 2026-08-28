/*
 * feedback-queue.js — ตรรกะหน้า Feedback Queue (อาจารย์)
 * ดึงคิวงานรอตรวจจาก PP.feedbackQueue(advisorId) (จัดลำดับความสำคัญมาให้แล้ว)
 * ทำตามรูปแบบเดียวกับ dashboard-student.js: render เป็น HTML string แล้วผูก event หลังทุก renderAll()
 */
(function () {
  const user = PP.getCurrentUser();
  const esc = PPNav.escapeHtml;

  // หน้านี้เป็นมุมมองอาจารย์เท่านั้น — ถ้าเปิดผิดบทบาทให้ขึ้น empty-state พร้อมลิงก์กลับ
  if (user.role !== "advisor") {
    document.getElementById("pageContent").innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state__icon">🔒</div>
          หน้านี้สำหรับอาจารย์ที่ปรึกษาเท่านั้น
          <div style="margin-top:12px;"><a href="student-dashboard.html" class="btn btn-primary btn-sm">กลับไปที่แดชบอร์ดของฉัน</a></div>
        </div>
      </div>`;
    return;
  }

  const advisor = PP.getAdvisor(user.advisorId);

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

  function renderAll() {
    const rows = PP.feedbackQueue(user.advisorId);
    document.getElementById("pageDesc").textContent =
      `${advisor.name} · มีงานรอการตรวจทั้งหมด ${rows.length} รายการ`;
    renderTable(rows);
  }

  function renderTable(rows) {
    const wrap = document.getElementById("queueTableWrap");
    if (!rows.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🎉</div>ไม่มีงานรอตรวจในขณะนี้ ทุกทีมได้รับ Feedback ครบแล้ว</div>`;
      return;
    }
    wrap.innerHTML = `
      <table class="pp-table">
        <thead>
          <tr>
            <th>คิว</th>
            <th>ทีม</th>
            <th>โครงงาน</th>
            <th>Milestone ที่ส่ง</th>
            <th>ส่งเมื่อ</th>
            <th>รอมาแล้ว</th>
            <th>ควรให้ Feedback ภายใน</th>
            <th>Milestone ถัดไปกำหนดส่ง</th>
            <th>ความเร่งด่วน</th>
            <th>ความเสี่ยง</th>
            <th>นิสิตกำลังทำระหว่างรอ</th>
            <th>การจัดการ</th>
          </tr>
        </thead>
        <tbody>${rows.map(rowHtml).join("")}</tbody>
      </table>`;
    bindRowEvents(rows);
  }

  function rowHtml(r) {
    const sub = r.submission;
    const statusChip = PP.statusMeta(sub.status);
    return `
      <tr data-sub="${esc(sub.id)}">
        <td><span class="queue-rank">${r.queueRank}</span></td>
        <td class="font-bold">${esc(r.team.name)}</td>
        <td>${esc(r.team.projectName)}</td>
        <td>
          ${esc(r.milestone.name)}
          <div style="margin-top:4px;"><span class="chip ${statusChip.chip}">${statusChip.label}</span></div>
        </td>
        <td>${ThaiDate.formatThaiDateTime(sub.submittedAt)}</td>
        <td>${ThaiDate.waitingDaysLabel(r.waitDays)}</td>
        <td>${ThaiDate.formatThaiDate(r.feedbackDueDate)}</td>
        <td>${r.nextMilestone ? ThaiDate.formatThaiDate(r.nextMilestone.dueDate) : "—"}</td>
        <td><span class="chip ${urgencyChipClass(r.urgency)}">${esc(r.urgency)}</span></td>
        <td><span class="chip ${riskChipClass(r.riskLevel)}">${esc(r.riskLevel)}</span></td>
        <td>
          ${r.nextBestTasks.length
            ? `<ul style="padding-left:1.1em;list-style:disc;" class="text-xs">${r.nextBestTasks.slice(0, 2).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
            : `<span class="text-xs text-muted">—</span>`}
        </td>
        <td>
          <div class="flex flex-col gap-2" style="min-width:190px;">
            ${sub.status === "submitted"
              ? `<button type="button" class="btn btn-secondary btn-sm" data-action="start">▶️ เริ่มตรวจ</button>`
              : `<span class="chip chip-reviewing" style="align-self:flex-start;">กำลังตรวจอยู่</span>`}
            <button type="button" class="btn btn-outline btn-sm" data-action="file">📎 เปิดไฟล์งาน</button>
            <button type="button" class="btn btn-outline btn-sm" data-action="info">❓ ขอข้อมูลเพิ่มเติม</button>
            <div class="flex gap-2" style="flex-wrap:wrap;">
              <a href="review-feedback.html?sub=${encodeURIComponent(sub.id)}" class="btn btn-primary btn-sm">✍️ ส่ง Feedback</a>
              <a href="review-feedback.html?sub=${encodeURIComponent(sub.id)}" class="btn btn-outline btn-sm">🔁 ให้แก้ไข</a>
              <a href="review-feedback.html?sub=${encodeURIComponent(sub.id)}" class="btn btn-success btn-sm">✅ ผ่าน Milestone</a>
            </div>
          </div>
        </td>
      </tr>`;
  }

  function bindRowEvents(rows) {
    document.querySelectorAll("#queueTableWrap [data-action]").forEach((btn) => {
      const tr = btn.closest("tr");
      const subId = tr.dataset.sub;
      const row = rows.find((r) => r.submission.id === subId);
      if (!row) return;
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "start") {
          PP.startReview(subId);
          PPToast.show("เริ่มตรวจงานแล้ว", "success");
          renderAll();
        } else if (action === "file") {
          openFileModal(row.submission);
        } else if (action === "info") {
          openInfoModal(row.submission);
        }
      });
    });
  }

  function openFileModal(sub) {
    document.getElementById("fileModalBody").innerHTML = `
      <div class="callout-muted">📄 กำลังเปิดไฟล์: <strong>${esc(sub.fileName)}</strong></div>
      <p class="text-sm text-muted" style="margin-top:10px;">(จำลองการเปิดไฟล์งานสำหรับ prototype นี้ — ระบบจริงจะเปิด/ดาวน์โหลดไฟล์แนบจริง)</p>
      ${sub.note ? `<div class="field" style="margin-top:8px;"><label>หมายเหตุจากนิสิต</label><div class="text-sm">${esc(sub.note)}</div></div>` : ""}
    `;
    document.getElementById("fileModalBackdrop").classList.add("is-open");
  }

  function openInfoModal(sub) {
    document.getElementById("infoModalText").value = "";
    const backdrop = document.getElementById("infoModalBackdrop");
    backdrop.dataset.sub = sub.id;
    backdrop.classList.add("is-open");
  }

  function closeModals() {
    document.getElementById("fileModalBackdrop").classList.remove("is-open");
    document.getElementById("infoModalBackdrop").classList.remove("is-open");
  }

  function bindStaticEvents() {
    document.getElementById("closeFileModal").addEventListener("click", closeModals);
    document.getElementById("closeFileModal2").addEventListener("click", closeModals);
    document.getElementById("closeInfoModal").addEventListener("click", closeModals);
    document.getElementById("closeInfoModal2").addEventListener("click", closeModals);
    document.getElementById("btnSendInfoRequest").addEventListener("click", () => {
      const backdrop = document.getElementById("infoModalBackdrop");
      const subId = backdrop.dataset.sub;
      const msg = document.getElementById("infoModalText").value.trim();
      if (!msg) {
        PPToast.show("กรุณาพิมพ์ข้อความที่ต้องการขอเพิ่มเติมก่อน", "warn");
        return;
      }
      PP.requestMoreInfo(subId, msg);
      closeModals();
      PPToast.show("บันทึกคำขอข้อมูลเพิ่มเติมในระบบแล้ว นิสิตจะเห็นเมื่อเข้าใช้งานครั้งถัดไป", "success");
      renderAll();
    });
    [document.getElementById("fileModalBackdrop"), document.getElementById("infoModalBackdrop")].forEach((bd) => {
      bd.addEventListener("click", (e) => { if (e.target === bd) closeModals(); });
    });
  }

  bindStaticEvents();
  renderAll();
})();
