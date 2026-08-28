/*
 * workload-map.js — ตรรกะหน้า Semester Workload Map (ปฏิทินภาระงานทั้งเทอม, บทบาทนิสิต)
 * โครงสร้างและ convention ยึดตาม assets/js/dashboard-student.js
 */
(function () {
  const esc = PPNav.escapeHtml;
  const user = PP.getCurrentUser();

  // กันบทบาทผิด: หน้านี้สำหรับนิสิตเท่านั้น
  if (user.role !== "student") {
    document.getElementById("mapContent").style.display = "none";
    document.getElementById("roleGuardSlot").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔒</div>
        หน้านี้ใช้สำหรับบทบาทนิสิตเท่านั้น
        <div style="margin-top:10px;"><a href="advisor-dashboard.html" class="btn btn-primary btn-sm">กลับไปแดชบอร์ดอาจารย์</a></div>
      </div>`;
    return;
  }

  const team = PP.getTeam(user.teamId);
  const course = PP.getCourse();
  const courseStart = ThaiDate.toDate(course.startDate);
  const courseEnd = ThaiDate.toDate(course.endDate);

  const TYPE_META = {
    "class": { label: "ตารางเรียน", swatch: "var(--pp-blue-600)" },
    "other-course": { label: "งานวิชาอื่น", swatch: "var(--pp-orange-700)" },
    "project": { label: "งานโครงงาน (ช่วงที่ยืนยันแล้ว)", swatch: "var(--pp-purple-700)" },
    "personal": { label: "เวลาส่วนตัว / เวลานอน", swatch: "var(--pp-text-500)" },
    "milestone": { label: "กำหนดส่ง Milestone", swatch: "var(--pp-red-700)" },
  };
  const LOAD_META = {
    low: { label: "ภาระงานต่ำ", swatch: "var(--pp-green-600)" },
    mid: { label: "ภาระงานปานกลาง", swatch: "var(--pp-yellow-700)" },
    high: { label: "ภาระงานสูง", swatch: "var(--pp-red-700)" },
  };
  const LOAD_LABEL_SHORT = { low: "ต่ำ", mid: "กลาง", high: "สูง" };

  function ym(d) { return d.getFullYear() * 12 + d.getMonth(); }
  const minYM = ym(courseStart);
  const maxYM = ym(courseEnd);
  const todayYM = ym(new Date());
  let curYM = Math.min(Math.max(todayYM, minYM), maxYM);

  function renderAll() {
    const advisor = PP.getAdvisor(team.advisorId);
    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}" · อาจารย์ที่ปรึกษา: ${advisor.name} · ${course.semesterLabel}`;
    renderOtherCourseTaskList();
    renderCalendar();
    renderLegend();
  }

  function renderOtherCourseTaskList() {
    const tasks = PP.getOtherCourseTasks(team.id).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const box = document.getElementById("otherCourseTaskList");
    if (!tasks.length) {
      box.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📚</div>ยังไม่มีงานจากวิชาอื่นที่บันทึกไว้ — กด "+ เพิ่มงานจากวิชาอื่น" เพื่อเริ่มบันทึก</div>`;
      return;
    }
    box.innerHTML = `<table class="pp-table"><thead><tr><th>วิชา</th><th>งาน</th><th>กำหนดส่ง</th><th>ชม. โดยประมาณ</th><th></th></tr></thead><tbody>
      ${tasks.map((t) => `
        <tr>
          <td>${esc(t.courseName)}</td>
          <td>${esc(t.title)}</td>
          <td>${ThaiDate.formatThaiDateTime(t.dueDate)}</td>
          <td>${t.hoursEstimate} ชม.</td>
          <td><button type="button" class="btn btn-danger btn-sm" data-remove-oc="${esc(t.id)}">ลบ</button></td>
        </tr>`).join("")}
      </tbody></table>`;

    box.querySelectorAll("[data-remove-oc]").forEach((btn) => btn.addEventListener("click", () => {
      PP.removeOtherCourseTask(btn.dataset.removeOc);
      PPToast.show("ลบงานจากวิชาอื่นแล้ว", "success");
      renderAll();
    }));
  }

  function renderCalendar() {
    const year = Math.floor(curYM / 12);
    const month = curYM % 12;

    document.getElementById("calMonthLabel").textContent =
      `${ThaiDate.THAI_MONTHS_FULL[month]} พ.ศ. ${ThaiDate.toBE(year)}`;
    document.getElementById("calRangeHint").textContent =
      `ตลอดภาคการศึกษา (${ThaiDate.formatThaiDate(course.startDate, { short: true })} – ${ThaiDate.formatThaiDate(course.endDate, { short: true })})`;

    const prevBtn = document.getElementById("btnPrevMonth");
    const nextBtn = document.getElementById("btnNextMonth");
    prevBtn.disabled = curYM <= minYM;
    nextBtn.disabled = curYM >= maxYM;

    document.getElementById("calDowRow").innerHTML =
      ThaiDate.THAI_DOW_SHORT.map((d) => `<div class="cal-dow">${esc(d)}</div>`).join("");

    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const gridStart = ThaiDate.addDays(firstOfMonth, -firstOfMonth.getDay());
    const gridEnd = ThaiDate.addDays(lastOfMonth, 6 - lastOfMonth.getDay());
    const totalCells = ThaiDate.diffDays(gridEnd, gridStart) + 1;
    const todayISO = ThaiDate.toISODate(new Date());

    let html = "";
    for (let i = 0; i < totalCells; i++) {
      const d = ThaiDate.addDays(gridStart, i);
      const iso = ThaiDate.toISODate(d);
      const isOutside = d.getMonth() !== month;
      const isToday = iso === todayISO;
      const level = PP.dayLoadLevel(team.id, iso);
      const events = PP.dayEvents(team.id, iso);
      const shown = events.slice(0, 3);
      const moreCount = events.length - shown.length;

      html += `
        <div class="cal-cell load-${level}${isOutside ? " is-outside" : ""}${isToday ? " is-today" : ""}" data-date="${iso}" tabindex="0" role="button" aria-label="ดูรายละเอียดวันที่ ${esc(ThaiDate.formatThaiDate(iso))}">
          <div class="flex items-center" style="width:100%;">
            <span class="cal-cell__date">${d.getDate()}</span>
            <span class="cal-cell__load">${LOAD_LABEL_SHORT[level]}</span>
          </div>
          ${shown.map((e) => `<div class="cal-event type-${e.type}">${esc(e.title)}</div>`).join("")}
          ${moreCount > 0 ? `<div class="cal-more">+${moreCount} เพิ่มเติม</div>` : ""}
        </div>`;
    }
    const gridEl = document.getElementById("calGrid");
    gridEl.innerHTML = html;

    gridEl.querySelectorAll(".cal-cell").forEach((cell) => {
      cell.addEventListener("click", () => openDayModal(cell.dataset.date));
      cell.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openDayModal(cell.dataset.date); }
      });
    });

    prevBtn.onclick = () => { if (curYM > minYM) { curYM -= 1; renderCalendar(); } };
    nextBtn.onclick = () => { if (curYM < maxYM) { curYM += 1; renderCalendar(); } };
  }

  function renderLegend() {
    document.getElementById("legendTypes").innerHTML = Object.entries(TYPE_META).map(([type, meta]) => `
      <div class="legend-item">
        <span class="legend-swatch" style="background:${meta.swatch};"></span>
        <span>${esc(meta.label)}</span>
      </div>`).join("");

    document.getElementById("legendLoad").innerHTML = Object.entries(LOAD_META).map(([level, meta]) => `
      <div class="legend-item">
        <span class="legend-swatch" style="background:${meta.swatch};"></span>
        <span>${esc(meta.label)} (รวมชั่วโมงภาระงานของวันนั้น)</span>
      </div>`).join("");
  }

  function openDayModal(iso) {
    const backdrop = document.getElementById("dayModalBackdrop");
    const events = PP.dayEvents(team.id, iso);
    const totalHours = events.reduce((s, e) => s + (e.hours || 0), 0);
    const level = PP.dayLoadLevel(team.id, iso);

    document.getElementById("dayModalTitle").textContent = ThaiDate.formatThaiDate(iso, { withDow: true });

    const body = document.getElementById("dayModalBody");
    const summary = `<div class="callout-muted">รวมภาระงานวันนี้ประมาณ ${totalHours} ชั่วโมง — ระดับ${LOAD_META[level].label}</div>`;

    if (!events.length) {
      body.innerHTML = summary + `<div class="empty-state"><div class="empty-state__icon">🌿</div>ไม่มีเหตุการณ์หรือภาระงานในวันนี้</div>`;
    } else {
      const rows = events.map((e) => {
        const timeText = e.start && e.end ? `${e.start}–${e.end} น.` : "";
        const metaText = e.meta ? esc(e.meta) : "";
        const parts = [timeText, e.hours ? `${e.hours} ชม.` : "", metaText].filter(Boolean).join(" · ");
        return `
          <div class="task-row">
            <span class="cal-event type-${e.type}" style="flex-shrink:0;">${esc(TYPE_META[e.type] ? TYPE_META[e.type].label : e.type)}</span>
            <div style="flex:1;min-width:120px;">
              <div class="task-row__title">${esc(e.title)}</div>
              ${parts ? `<div class="task-row__meta">${parts}</div>` : ""}
            </div>
          </div>`;
      }).join("");
      body.innerHTML = summary + rows;
    }

    backdrop.classList.add("is-open");
  }

  document.getElementById("dayModalClose").addEventListener("click", () => document.getElementById("dayModalBackdrop").classList.remove("is-open"));
  document.getElementById("dayModalCloseBtn").addEventListener("click", () => document.getElementById("dayModalBackdrop").classList.remove("is-open"));
  document.getElementById("dayModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "dayModalBackdrop") e.currentTarget.classList.remove("is-open");
  });

  // ---------------------------------------------------------------------
  // เพิ่มงานจากวิชาอื่นด้วยตัวเอง — สอดคล้องกับข้อกำหนด "สามารถเพิ่มงานจากวิชาอื่นและคำนวณช่วงเวลาว่างใหม่ได้"
  // ---------------------------------------------------------------------
  const taskModalBackdrop = document.getElementById("taskModalBackdrop");
  function closeTaskModal() { taskModalBackdrop.classList.remove("is-open"); document.getElementById("otherCourseTaskForm").reset(); }
  document.getElementById("btnAddOtherCourseTask").addEventListener("click", () => taskModalBackdrop.classList.add("is-open"));
  document.getElementById("taskModalClose").addEventListener("click", closeTaskModal);
  document.getElementById("taskModalCancel").addEventListener("click", closeTaskModal);
  taskModalBackdrop.addEventListener("click", (e) => { if (e.target === taskModalBackdrop) closeTaskModal(); });

  document.getElementById("otherCourseTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const courseName = document.getElementById("ocCourseName").value.trim();
    const title = document.getElementById("ocTitle").value.trim();
    const date = document.getElementById("ocDueDate").value;
    const time = document.getElementById("ocDueTime").value || "23:59";
    const hoursEstimate = Number(document.getElementById("ocHours").value);
    if (!courseName || !title || !date || !hoursEstimate) return;

    PP.addOtherCourseTask(team.id, {
      courseName, title, hoursEstimate,
      dueDate: new Date(`${date}T${time}:00`).toISOString(),
    });
    PPToast.show("เพิ่มงานจากวิชาอื่นแล้ว ระบบคำนวณ Deadline Collision ใหม่ให้แล้ว", "success");
    closeTaskModal();
    renderAll();
  });

  renderAll();
})();
