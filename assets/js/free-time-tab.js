/*
 * free-time-tab.js — ตรรกะแท็บ "Smart Free-Time" ภายในหน้าปฏิทิน (pages/workload-map.html)
 * ย้ายมาจาก assets/js/free-time-planner.js เดิม (เคยเป็นหน้าแยก pages/free-time-planner.html)
 * เพื่อ render เข้าไปในแท็บที่สองของหน้าปฏิทินแทน — ตรรกะ/พฤติกรรมเดิมทุกจุดคงไว้ไม่เปลี่ยน
 * เฉพาะบทบาทนิสิตเท่านั้น (อาจารย์ไม่มีความหมายของ "เวลาว่างส่วนตัว" ให้วางแผน)
 */
(function () {
  const esc = PPNav.escapeHtml;
  const user = PP.getCurrentUser();

  // แท็บนี้มีความหมายเฉพาะบทบาทนิสิตเท่านั้น — ไม่สร้างทั้งปุ่มแท็บและเนื้อหาเลยสำหรับอาจารย์
  // (ไม่ใช่แค่ซ่อนด้วย CSS: เอา placeholder panel ออกจาก DOM ไปเลย)
  if (user.role !== "student") {
    const panel = document.getElementById("tabPanelFreeTime");
    if (panel) panel.remove();
    return;
  }

  const team = PP.getTeam(user.teamId);

  // id ของ slot ที่กำลังเปิดฟอร์ม "เปลี่ยนเวลา" อยู่ (มีได้ทีละ 1 ใบ)
  let openRescheduleId = null;

  const HISTORY_STATUS_META = {
    confirmed: { icon: "✅", label: "ยืนยันแล้ว — อยู่ในปฏิทินแล้ว" },
    declined: { icon: "🚫", label: "แจ้งว่าไม่สะดวก" },
    split: { icon: "✂️", label: "แบ่งเป็นช่วงสั้นแล้ว" },
  };

  // ---------------------------------------------------------------------
  // ประกอบปุ่มแท็บ + เนื้อหาแท็บเข้ากับโครง tabs/tab-panel ที่มีอยู่แล้วในหน้า
  // ---------------------------------------------------------------------
  const tabsEl = document.getElementById("calendarTabs");
  const tabBtnFreeTime = document.createElement("button");
  tabBtnFreeTime.type = "button";
  tabBtnFreeTime.className = "tab-btn";
  tabBtnFreeTime.id = "tabBtnFreeTime";
  tabBtnFreeTime.dataset.tab = "free-time";
  tabBtnFreeTime.textContent = "⏱️ แผนเวลาว่างอัจฉริยะ";
  tabsEl.appendChild(tabBtnFreeTime);

  const panel = document.getElementById("tabPanelFreeTime");
  panel.innerHTML = `
    <div class="card">
      <div class="card-hd"><h3>ระบบพิจารณาช่วงเวลาว่างจากอะไรบ้าง</h3></div>
      <div class="callout-muted">
        ระบบไม่ได้สรุปเวลาว่างจากกำหนดส่งงานเพียงอย่างเดียว แต่พิจารณาร่วมกันจาก
        ตารางเรียน, เวลานอน/เวลาส่วนตัว, งานประจำ/กิจกรรมของทีม, กำหนดส่งงานวิชาอื่น,
        จำนวนชั่วโมงที่แต่ละงานต้องใช้ และช่วงเวลาที่ทีมทำงานได้อย่างมีประสิทธิภาพที่สุด
        (เวอร์ชัน demo นี้ไม่ต้องกรอกระดับพลังงาน/สมาธิจริงของผู้ใช้)
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <div>
          <h3>⏱️ ช่วงเวลาแนะนำในสัปดาห์นี้</h3>
          <div class="card-hd__sub">เลือกยืนยัน เปลี่ยนเวลา แบ่งเป็นช่วงสั้น หรือแจ้งว่าไม่สะดวกได้ทันที</div>
        </div>
      </div>
      <div id="pendingSlots" class="grid grid-auto"></div>
    </div>

    <div class="card">
      <div class="card-hd"><h3>📜 ประวัติช่วงเวลาที่เคยพิจารณาแล้ว</h3></div>
      <div id="historySlots" class="flex flex-col gap-2"></div>
    </div>`;

  // ---------------------------------------------------------------------
  // สลับแท็บ Calendar <-> Smart Free-Time
  // ---------------------------------------------------------------------
  function selectTab(tab) {
    document.querySelectorAll("#calendarTabs .tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    document.querySelectorAll("#mapContent > .tab-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.tabPanel === tab));
  }
  document.getElementById("tabBtnCalendar").addEventListener("click", () => selectTab("calendar"));
  tabBtnFreeTime.addEventListener("click", () => selectTab("free-time"));

  // เปิดแท็บนี้ทันทีถ้ามาจากลิงก์ ?tab=free-time (เช่นจากแดชบอร์ด/แจ้งเตือน/หน้า redirect เดิม)
  if (new URLSearchParams(location.search).get("tab") === "free-time") selectTab("free-time");

  // ---------------------------------------------------------------------
  // ตรรกะเดิมจาก free-time-planner.js — ย้ายมาทั้งหมดโดยไม่เปลี่ยนพฤติกรรม
  // ---------------------------------------------------------------------
  function renderAll() {
    renderPending();
    renderHistory();
  }

  function slotTimeLabel(slot) {
    return `${ThaiDate.formatThaiDate(slot.date, { withDow: true })} · ${slot.start}–${slot.end} น.`;
  }

  function renderPending() {
    const slots = PP.getFreeTimeSuggestions(team.id)
      .filter((s) => s.status === "pending")
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const box = document.getElementById("pendingSlots");

    if (!slots.length) {
      box.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state__icon">🎉</div>ยังไม่มีช่วงเวลาแนะนำใหม่ในขณะนี้ ระบบจะแนะนำเพิ่มเมื่อพบช่วงว่างที่เหมาะสม</div>`;
      return;
    }

    box.innerHTML = slots.map((s) => `
      <div class="slot-card">
        <div class="slot-card__time">${esc(slotTimeLabel(s))}</div>
        <div class="font-bold text-sm">${esc(s.taskSuggestion)}</div>
        <div class="slot-card__reason">${esc(s.reason)}</div>
        <div class="slot-card__actions">
          <button class="btn btn-success btn-sm" data-act="confirm" data-id="${s.id}">✓ ยืนยันเวลานี้</button>
          <button class="btn btn-outline btn-sm" data-act="reschedule-toggle" data-id="${s.id}">🔁 เปลี่ยนเวลา</button>
          <button class="btn btn-secondary btn-sm" data-act="split" data-id="${s.id}">✂️ แบ่งเป็นช่วงสั้น</button>
          <button class="btn btn-ghost btn-sm" data-act="decline" data-id="${s.id}">✕ แจ้งว่าไม่สะดวก</button>
        </div>
        ${openRescheduleId === s.id ? rescheduleFormHtml(s) : ""}
      </div>`).join("");

    bindPendingEvents();
  }

  function rescheduleFormHtml(s) {
    return `
      <div class="divider"></div>
      <form data-reschedule-form="${s.id}">
        <div class="form-row">
          <div class="field">
            <label for="rs-date-${s.id}">วันที่ใหม่</label>
            <input class="input" type="date" id="rs-date-${s.id}" name="date" value="${s.date}" required />
          </div>
          <div class="field">
            <label for="rs-start-${s.id}">เวลาเริ่ม</label>
            <input class="input" type="time" id="rs-start-${s.id}" name="start" value="${s.start}" required />
          </div>
          <div class="field">
            <label for="rs-end-${s.id}">เวลาสิ้นสุด</label>
            <input class="input" type="time" id="rs-end-${s.id}" name="end" value="${s.end}" required />
          </div>
        </div>
        <div class="flex gap-2" style="margin-top:8px;">
          <button type="submit" class="btn btn-primary btn-sm">บันทึกเวลาใหม่</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="reschedule-cancel" data-id="${s.id}">ยกเลิก</button>
        </div>
      </form>`;
  }

  function bindPendingEvents() {
    const box = document.getElementById("pendingSlots");

    box.querySelectorAll('[data-act="confirm"]').forEach((btn) => btn.addEventListener("click", () => {
      PP.confirmFreeTimeSlot(btn.dataset.id);
      PPToast.show("เพิ่มลงปฏิทินแล้ว ดูได้ที่ปฏิทินภาระงานทั้งเทอม", "success");
      renderAll();
    }));

    box.querySelectorAll('[data-act="split"]').forEach((btn) => btn.addEventListener("click", () => {
      PP.splitFreeTimeSlot(btn.dataset.id);
      PPToast.show("แบ่งช่วงเวลาออกเป็น 2 ช่วงสั้นแล้ว", "success");
      renderAll();
    }));

    box.querySelectorAll('[data-act="decline"]').forEach((btn) => btn.addEventListener("click", () => {
      PP.declineFreeTimeSlot(btn.dataset.id);
      PPToast.show("บันทึกว่าคุณไม่สะดวกช่วงเวลานี้แล้ว", "info");
      renderAll();
    }));

    box.querySelectorAll('[data-act="reschedule-toggle"]').forEach((btn) => btn.addEventListener("click", () => {
      openRescheduleId = openRescheduleId === btn.dataset.id ? null : btn.dataset.id;
      renderPending();
    }));

    box.querySelectorAll('[data-act="reschedule-cancel"]').forEach((btn) => btn.addEventListener("click", () => {
      openRescheduleId = null;
      renderPending();
    }));

    box.querySelectorAll("[data-reschedule-form]").forEach((form) => form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const id = form.getAttribute("data-reschedule-form");
      const date = form.querySelector('[name="date"]').value;
      const start = form.querySelector('[name="start"]').value;
      const end = form.querySelector('[name="end"]').value;
      if (!date || !start || !end) { PPToast.show("กรุณากรอกวันที่และเวลาให้ครบ", "warn"); return; }
      if (start >= end) { PPToast.show("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม", "warn"); return; }
      PP.rescheduleFreeTimeSlot(id, date, start, end);
      openRescheduleId = null;
      PPToast.show("เปลี่ยนเวลานัดหมายแล้ว รอการยืนยันอีกครั้ง", "success");
      renderAll();
    }));
  }

  function renderHistory() {
    const slots = PP.getFreeTimeSuggestions(team.id)
      .filter((s) => s.status !== "pending")
      .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
    const box = document.getElementById("historySlots");

    if (!slots.length) {
      box.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🗒️</div>ยังไม่มีประวัติการพิจารณาช่วงเวลา</div>`;
      return;
    }

    box.innerHTML = slots.map((s) => {
      const meta = HISTORY_STATUS_META[s.status] || { icon: "•", label: s.status };
      return `
      <div class="slot-card${s.status === "confirmed" ? " is-confirmed" : ""}">
        <div class="flex justify-between items-center" style="flex-wrap:wrap;gap:6px;">
          <div class="slot-card__time">${esc(slotTimeLabel(s))}</div>
          <span class="text-sm font-bold">${meta.icon} ${esc(meta.label)}</span>
        </div>
        <div class="text-sm">${esc(s.taskSuggestion)}</div>
        <div class="slot-card__reason">${esc(s.reason)}</div>
      </div>`;
    }).join("");
  }

  renderAll();
})();
