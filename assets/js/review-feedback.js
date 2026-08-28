/*
 * review-feedback.js — ตรรกะหน้า ตรวจงานและให้ Feedback (อาจารย์)
 * รับ submissionId จาก query string ?sub=<id> แสดงรายละเอียดงานที่ส่ง ให้อาจารย์พิมพ์ Feedback
 * ใช้ PP.draftChecklistFromText ช่วยร่าง checklist เป็นตารางที่แก้ไขได้ก่อนบันทึกจริงด้วย PP.giveFeedback
 * สำคัญ: AI มีหน้าที่แค่ช่วย "ร่าง" checklist จากข้อความเท่านั้น ไม่ตัดสินคะแนน/ผ่านหรือไม่ผ่าน —
 * การตัดสินใจทั้งหมด (revise / need_info / passed) เป็นดุลยพินิจของอาจารย์ที่กดปุ่มเองเท่านั้น
 */
(function () {
  const user = PP.getCurrentUser();
  const esc = PPNav.escapeHtml;

  // หน้านี้เป็นมุมมองอาจารย์เท่านั้น
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

  const subId = new URLSearchParams(window.location.search).get("sub");
  const sub = subId ? PP.getSubmission(subId) : null;

  if (!sub) {
    document.getElementById("pageDesc").textContent = "";
    document.getElementById("reviewBody").innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state__icon">🔍</div>
          ไม่พบงานที่ต้องการตรวจ (อาจถูกลบหรือ URL ไม่ถูกต้อง)
          <div style="margin-top:12px;"><a href="feedback-queue.html" class="btn btn-primary btn-sm">กลับไปที่คิวงานรอตรวจ</a></div>
        </div>
      </div>`;
    return;
  }

  const team = PP.getTeam(sub.teamId);
  const milestone = PP.getMilestone(sub.milestoneId);
  const advisor = PP.getAdvisor(team.advisorId);
  const students = PP.getStudentsByTeam(team.id);
  const previousFeedback = PP.getPreviousFeedbackForSubmission(sub);

  const FEEDBACK_TEMPLATES = [
    { label: "ต้องการรายละเอียดเพิ่ม", text: "กรุณาเพิ่มรายละเอียดและหลักฐานประกอบให้ครบถ้วนก่อนส่งตรวจอีกครั้ง" },
    { label: "ขอบเขตงานยังไม่ชัด", text: "ขอบเขตงานส่วนนี้ยังกว้างเกินไป กรุณาระบุให้ชัดเจนและเจาะจงมากขึ้น" },
    { label: "คุณภาพงานยังไม่ผ่าน", text: "คุณภาพของงานส่วนนี้ยังไม่ผ่านมาตรฐานที่กำหนด กรุณาปรับปรุงและส่งใหม่" },
    { label: "ดีแล้ว ให้ผ่านพร้อมข้อสังเกต", text: "งานโดยรวมอยู่ในเกณฑ์ดี มีข้อสังเกตเล็กน้อยให้ปรับปรุงในรอบถัดไป" },
  ];

  let checklist = []; // ร่าง checklist ที่แก้ไขได้ในหน้านี้ — ยังไม่ถูกบันทึกจนกว่าจะกดปุ่มตัดสินใจ
  let submitting = false;
  let showPreview = false;
  let draftRawText = ""; // เก็บข้อความ Feedback ที่พิมพ์ค้างไว้ ไม่ให้หายเวลา re-render (เช่น ตอนกดดูตัวอย่าง)

  function renderShell() {
    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}" · อาจารย์ที่ปรึกษา: ${advisor.name}`;

    const waitDays = ThaiDate.diffDays(new Date(), sub.submittedAt);
    const statusChip = PP.statusMeta(sub.status);

    document.getElementById("reviewBody").innerHTML = `
      <div class="card">
        <div class="card-hd">
          <div>
            <h3>📄 รายละเอียดงานที่ส่ง</h3>
            <div class="card-hd__sub">ข้อมูลจากการส่งงานของนิสิต ใช้ประกอบการให้ Feedback</div>
          </div>
          <span class="chip ${statusChip.chip}">${statusChip.label}</span>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>ทีม</label><div>${esc(team.name)} · ${esc(team.projectName)}</div></div>
          <div class="field"><label>Milestone</label><div>${esc(milestone.name)}</div></div>
          <div class="field"><label>ส่งเมื่อ</label><div>${ThaiDate.formatThaiDateTime(sub.submittedAt)} <span class="text-xs text-muted">(${ThaiDate.waitingDaysLabel(waitDays)})</span></div></div>
          <div class="field">
            <label>ไฟล์แนบ</label>
            <div class="flex items-center gap-2">
              <span>${esc(sub.fileName)}</span>
              <button type="button" class="btn btn-outline btn-sm" id="btnOpenFile">📎 เปิดไฟล์งาน</button>
            </div>
          </div>
        </div>
        <div class="field" style="margin-top:8px;">
          <label>หมายเหตุจากนิสิต</label>
          <div class="callout-muted">${sub.note ? esc(sub.note) : "— ไม่มีหมายเหตุเพิ่มเติม —"}</div>
        </div>
      </div>

      ${sub.revisionRound > 0 ? renderWhatChangedCard() : ""}

      <div class="card">
        <div class="card-hd">
          <div>
            <h3>✍️ เขียน Feedback</h3>
            <div class="card-hd__sub">พิมพ์ Feedback เป็นข้อความอิสระ แล้วให้ AI ช่วยแยกเป็นรายการ Checklist ได้ (ไม่บังคับ)</div>
          </div>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;margin-bottom:10px;">
          ${FEEDBACK_TEMPLATES.map((t, i) => `<button type="button" class="btn btn-outline btn-sm" data-template="${i}">${esc(t.label)}</button>`).join("")}
        </div>
        <div class="field">
          <label for="rawTextInput">ข้อความ Feedback ถึงนิสิต</label>
          <textarea class="input" id="rawTextInput" rows="5" placeholder="เช่น: บทที่ 2 ควรเพิ่มงานวิจัยที่เกี่ยวข้องอีก 3 แหล่ง&#10;Storyboard ฉากที่ 4 สื่อความหมายไม่ชัดเจน ต้องแก้ไข&#10;ควรระบุกลุ่มเป้าหมายให้ชัดเจนกว่านี้">${esc(draftRawText)}</textarea>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnAiDraft">🤖 ให้ AI ช่วยแยกประเด็นเป็น Checklist</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btnTogglePreview">👁️ ${showPreview ? "ซ่อน" : "ดู"}ตัวอย่างก่อนส่ง</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btnScheduleTalk">🗓️ นัดหมายพูดคุย</button>
        </div>
        <div class="alert alert-info" style="margin-top:12px;">
          <div class="alert__icon">ℹ️</div>
          <div>
            <div class="alert__title">AI ช่วยร่างเท่านั้น</div>
            <div class="text-sm">AI ใช้เพียงแยกข้อความ Feedback ที่อาจารย์พิมพ์ออกเป็นรายการที่ตรวจสอบ/แก้ไขได้เท่านั้น <strong>AI ไม่มีสิทธิ์ตัดสินคะแนนหรือฟันธงว่าผ่าน/ไม่ผ่าน Milestone</strong> — การให้คะแนนและอนุมัติผ่าน Milestone เป็นดุลยพินิจของอาจารย์เท่านั้น โดยกดปุ่มตัดสินใจด้านล่างด้วยตนเอง</div>
          </div>
        </div>
        ${showPreview ? `<div class="card" style="background:var(--pp-surface-muted);margin-top:12px;box-shadow:none;"><div class="font-bold text-sm" style="margin-bottom:6px;">👁️ ตัวอย่างที่นิสิตจะเห็น</div><div id="previewBox" class="text-sm" style="white-space:pre-wrap;"></div></div>` : ""}
      </div>

      <div class="card">
        <div class="card-hd">
          <div>
            <h3>✅ Checklist สิ่งที่ต้องแก้ไข/ติดตาม</h3>
            <div class="card-hd__sub">ตรวจสอบ แก้ไข เพิ่ม หรือลบรายการก่อนบันทึกจริง</div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="btnAddRow">+ เพิ่มรายการ</button>
        </div>
        <div id="checklistTableWrap" class="table-wrap"></div>
      </div>

      <div class="card">
        <div class="card-hd">
          <div>
            <h3>📮 ตัดสินใจและส่ง Feedback</h3>
            <div class="card-hd__sub">เลือกผลการตรวจ 1 อย่าง ระบบจะบันทึก Feedback พร้อม Checklist ปัจจุบัน แล้วพากลับไปที่คิวงานรอตรวจ</div>
          </div>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;">
          <button type="button" class="btn btn-danger" data-decision="revise">🔁 ให้แก้ไข</button>
          <button type="button" class="btn btn-outline" data-decision="need_info">❓ ขอข้อมูลเพิ่มเติม</button>
          <button type="button" class="btn btn-success" data-decision="passed">✅ ผ่าน Milestone</button>
        </div>
      </div>
    `;

    document.getElementById("btnOpenFile").addEventListener("click", openFileModal);
    document.getElementById("btnAiDraft").addEventListener("click", onAiDraft);
    document.getElementById("btnAddRow").addEventListener("click", onAddRow);
    document.getElementById("rawTextInput").addEventListener("input", (e) => { draftRawText = e.target.value; });
    document.getElementById("btnTogglePreview").addEventListener("click", () => {
      draftRawText = document.getElementById("rawTextInput").value;
      showPreview = !showPreview;
      renderShell();
    });
    document.getElementById("btnScheduleTalk").addEventListener("click", onScheduleTalk);
    document.querySelectorAll("[data-template]").forEach((btn) => btn.addEventListener("click", () => {
      const tpl = FEEDBACK_TEMPLATES[Number(btn.dataset.template)];
      const ta = document.getElementById("rawTextInput");
      ta.value = ta.value ? `${ta.value}\n${tpl.text}` : tpl.text;
      draftRawText = ta.value;
    }));
    document.querySelectorAll("[data-decision]").forEach((btn) => {
      btn.addEventListener("click", () => onDecision(btn.dataset.decision));
    });

    renderChecklistTable();
    if (showPreview) renderPreview();
  }

  function renderWhatChangedCard() {
    if (!previousFeedback) return "";
    return `
      <div class="card" style="border-color:var(--pp-purple-500);">
        <div class="card-hd">
          <div>
            <h3>🔄 What Changed Since Last Review</h3>
            <div class="card-hd__sub">เปรียบเทียบ Feedback รอบก่อนกับสิ่งที่นิสิตอธิบายว่าแก้ไขแล้ว — ควรตรวจสอบก่อนใช้สรุปนี้ตัดสินใจ</div>
          </div>
          <span class="chip chip-neutral">ส่งใหม่รอบที่ ${sub.revisionRound}</span>
        </div>
        <div class="grid grid-2">
          <div>
            <div class="font-bold text-sm" style="margin-bottom:6px;">Feedback เดิม</div>
            <ul style="padding-left:1.1em;list-style:disc;margin:0;">
              ${previousFeedback.checklist.map((c) => `<li class="text-sm" style="margin-bottom:4px;">${esc(c.title)}${(sub.addressedChecklistIds || []).includes(c.id) ? ` <span class="chip chip-green" style="margin-left:4px;">แก้แล้ว</span>` : ""}</li>`).join("")}
            </ul>
          </div>
          <div>
            <div class="font-bold text-sm" style="margin-bottom:6px;">คำอธิบายการแก้ไขจากนิสิต</div>
            <div class="callout-muted">${sub.changesSummary ? esc(sub.changesSummary) : "— นิสิตไม่ได้อธิบายเพิ่มเติม —"}</div>
          </div>
        </div>
      </div>`;
  }

  function renderPreview() {
    const box = document.getElementById("previewBox");
    if (!box) return;
    const rawText = document.getElementById("rawTextInput").value.trim();
    const lines = [rawText || "(ยังไม่ได้พิมพ์ข้อความ Feedback)"];
    if (checklist.length) {
      lines.push("", "รายการที่ต้องแก้ไข:");
      checklist.forEach((c, i) => lines.push(`${i + 1}. ${c.title || "(ยังไม่ระบุ)"}${c.dueDate ? ` — กำหนด ${c.dueDate}` : ""}`));
    }
    box.textContent = lines.join("\n");
  }

  function onScheduleTalk() {
    const note = window.prompt("ระบุวัน/เวลาและหัวข้อที่ต้องการนัดพูดคุยกับทีม (จำลอง ไม่เชื่อมปฏิทินจริง):", "");
    if (!note) return;
    PP.pushNotification({
      audience: "student", teamId: team.id, type: "feedback_ready", severity: "info",
      title: "อาจารย์ที่ปรึกษาขอนัดพูดคุย", message: `อาจารย์${advisor.name}ขอนัดพูดคุยเกี่ยวกับ Milestone "${milestone.name}": ${note}`,
    });
    PPToast.show("บันทึกคำขอนัดหมายในระบบแล้ว ทีมจะเห็นเมื่อเข้าใช้งานครั้งถัดไป", "success");
  }

  function renderChecklistTable() {
    const wrap = document.getElementById("checklistTableWrap");
    if (!checklist.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📝</div>ยังไม่มีรายการ Checklist — พิมพ์ Feedback แล้วกด "ให้ AI ช่วยแยกประเด็น" หรือกด "+ เพิ่มรายการ" เพื่อเพิ่มเอง</div>`;
      return;
    }
    wrap.innerHTML = `
      <table class="pp-table">
        <thead>
          <tr>
            <th>ต้องแก้ไขอะไร</th>
            <th>ผู้รับผิดชอบ</th>
            <th>กำหนดส่ง</th>
            <th>ชม. โดยประมาณ</th>
            <th>เกี่ยวข้องกับไฟล์/ส่วนใด</th>
            <th>ตรวจซ้ำ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${checklist.map((c) => `
            <tr data-id="${esc(c.id)}">
              <td style="min-width:200px;"><input type="text" class="input" data-field="title" value="${esc(c.title || "")}" placeholder="รายละเอียดที่ต้องแก้ไข" /></td>
              <td style="min-width:170px;">
                <select class="input" data-field="assigneeId">
                  <option value="">— เลือกผู้รับผิดชอบ —</option>
                  ${students.map((s) => `<option value="${esc(s.id)}" ${c.assigneeId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
                </select>
              </td>
              <td style="min-width:150px;"><input type="date" class="input" data-field="dueDate" value="${c.dueDate ? esc(c.dueDate) : ""}" /></td>
              <td style="min-width:100px;"><input type="number" min="0" step="0.5" class="input" data-field="hours" value="${c.hours != null ? esc(c.hours) : ""}" /></td>
              <td style="min-width:160px;"><input type="text" class="input" data-field="relatedTo" value="${esc(c.relatedTo || "")}" placeholder="เช่น บทที่ 2 / ฉากที่ 4" /></td>
              <td style="text-align:center;"><input type="checkbox" data-field="needsRecheck" ${c.needsRecheck ? "checked" : ""} /></td>
              <td><button type="button" class="btn btn-danger btn-sm" data-remove="${esc(c.id)}">ลบ</button></td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    // ผูก event แก้ไขค่าทีละช่อง (อัปเดตอาเรย์ตรง ๆ โดยไม่ re-render ทั้งตาราง เพื่อไม่ให้ focus หลุด)
    wrap.querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.dataset.id;
      const item = checklist.find((c) => c.id === id);
      if (!item) return;
      tr.querySelectorAll("[data-field]").forEach((input) => {
        const field = input.dataset.field;
        const evt = (input.type === "checkbox" || input.tagName === "SELECT") ? "change" : "input";
        input.addEventListener(evt, () => {
          if (field === "needsRecheck") item.needsRecheck = input.checked;
          else if (field === "hours") item.hours = input.value === "" ? null : Number(input.value);
          else if (field === "dueDate") item.dueDate = input.value || null;
          else if (field === "assigneeId") item.assigneeId = input.value || null;
          else item[field] = input.value;
        });
      });
    });

    wrap.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        checklist = checklist.filter((c) => c.id !== btn.dataset.remove);
        renderChecklistTable();
      });
    });
  }

  function onAddRow() {
    checklist.push({ id: PP.uid("c"), title: "", assigneeId: null, dueDate: null, hours: null, relatedTo: "", needsRecheck: true, done: false });
    renderChecklistTable();
  }

  function onAiDraft() {
    const rawText = document.getElementById("rawTextInput").value.trim();
    if (!rawText) {
      PPToast.show("กรุณาพิมพ์ข้อความ Feedback ก่อน แล้วค่อยให้ AI ช่วยแยกประเด็น", "warn");
      return;
    }
    if (checklist.length && !window.confirm("มีรายการ Checklist อยู่แล้ว ต้องการให้ AI แยกประเด็นจากข้อความปัจจุบันมาแทนที่รายการเดิมหรือไม่?")) {
      return;
    }
    checklist = PP.draftChecklistFromText(rawText);
    renderChecklistTable();
    PPToast.show("AI ร่าง Checklist จากข้อความแล้ว — โปรดตรวจสอบ/แก้ไขก่อนบันทึกจริง", "info");
  }

  function onDecision(decision) {
    if (submitting) return;
    const rawText = document.getElementById("rawTextInput").value.trim();
    if (!rawText) {
      PPToast.show("กรุณากรอกข้อความ Feedback ก่อนบันทึกผลการตรวจ", "warn");
      return;
    }
    submitting = true;
    document.querySelectorAll("[data-decision]").forEach((b) => (b.disabled = true));

    PP.giveFeedback(sub.id, { rawText, decision, checklist });

    const label = decision === "passed" ? "บันทึกผล: ผ่าน Milestone แล้ว"
      : decision === "revise" ? "ส่งกลับให้นิสิตแก้ไขแล้ว"
      : "บันทึกคำขอข้อมูลเพิ่มเติมแล้ว นิสิตจะเห็นเมื่อเข้าใช้งานครั้งถัดไป";
    PPToast.show(label, decision === "passed" ? "success" : "info");

    setTimeout(() => { window.location.href = "feedback-queue.html"; }, 1100);
  }

  function openFileModal() {
    document.getElementById("fileModalBody").innerHTML = `
      <div class="callout-muted">📄 กำลังเปิดไฟล์: <strong>${esc(sub.fileName)}</strong></div>
      <p class="text-sm text-muted" style="margin-top:10px;">(จำลองการเปิดไฟล์งานสำหรับ prototype นี้ — ระบบจริงจะเปิด/ดาวน์โหลดไฟล์แนบจริง)</p>
    `;
    document.getElementById("fileModalBackdrop").classList.add("is-open");
  }

  function closeFileModal() {
    document.getElementById("fileModalBackdrop").classList.remove("is-open");
  }

  document.getElementById("closeFileModal").addEventListener("click", closeFileModal);
  document.getElementById("closeFileModal2").addEventListener("click", closeFileModal);
  document.getElementById("fileModalBackdrop").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeFileModal();
  });

  renderShell();
})();
