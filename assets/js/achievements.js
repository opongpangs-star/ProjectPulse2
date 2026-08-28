/*
 * achievements.js — หน้า "ตราความสำเร็จของฉัน"
 * แสดงตราทั้งหมด (ปลดล็อกแล้ว/ยังไม่ปลดล็อก) + ประวัติพลังชีพจร — มุมมองนิสิตเท่านั้น
 * ตราเป็นรางวัลด้านพฤติกรรมเท่านั้น ไม่สื่อว่าผลงานผ่านการประเมิน/มีคุณภาพแล้ว
 */
(function () {
  const user = PP.getCurrentUser();
  const esc = PPNav.escapeHtml;

  if (user.role !== "student") {
    document.getElementById("dashboardContent").style.display = "none";
    document.getElementById("roleGuardSlot").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🚫</div>
        หน้านี้ใช้สำหรับมุมมองนิสิตเท่านั้น
        <div style="margin-top:12px;"><a href="advisor-dashboard.html" class="btn btn-primary btn-sm">กลับไปแดชบอร์ดอาจารย์</a></div>
      </div>`;
    return;
  }

  const team = PP.getTeam(user.teamId);
  const advisor = PP.getAdvisor(team.advisorId);

  const POINT_TYPE_LABEL = {
    plan_next_task: "วางแผนภารกิจถัดไป",
    complete_planned_task: "ทำภารกิจเสร็จตามเวลาที่วางแผน",
    submit_on_time: "ส่ง Milestone ภายในกำหนด",
    feedback_addressed_complete: "ดำเนินการตาม Feedback ครบทุกข้อ",
    waiting_task_done: "ทำภารกิจระหว่างรอสำเร็จ",
    weekly_checkin: "Check-in ความก้าวหน้าประจำสัปดาห์",
  };

  function renderAll() {
    document.getElementById("pageDesc").textContent =
      `${team.name} · ${team.projectType} "${team.projectName}" · อาจารย์ที่ปรึกษา: ${advisor.name}`;
    renderStatCards();
    renderBadgeGrid();
    renderPointsHistory();
  }

  function renderStatCards() {
    const points = PP.getPulsePoints(team.id);
    const badges = PP.getAllBadges(team.id);
    const earnedCount = badges.filter((b) => b.earned).length;
    const momentum = PP.weeklyMomentumSummary(team.id, 4);
    document.getElementById("statCards").innerHTML = `
      <div class="card card-stat">
        <span class="card-stat__label">พลังชีพจรสะสม</span>
        <span class="card-stat__value">${points.total}</span>
        <span class="card-stat__hint">ไม่เกี่ยวข้องกับคะแนนรายวิชา</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">ตราที่ปลดล็อกแล้ว</span>
        <span class="card-stat__value">${earnedCount} / ${badges.length}</span>
        <span class="card-stat__hint">รางวัลด้านพฤติกรรมการทำงาน</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">แรงส่งประจำสัปดาห์</span>
        <span class="card-stat__value">${momentum.hasThreeWeekMomentum ? "ต่อเนื่อง 3 สัปดาห์" : "กำลังสร้างจังหวะ"}</span>
        <span class="card-stat__hint">${momentum.hasThreeWeekMomentum ? "ได้รับตรา \"รักษาจังหวะ\" แล้ว" : "ทำกิจกรรมอย่างน้อย 1 อย่าง/สัปดาห์"}</span>
      </div>
      <div class="card card-stat">
        <span class="card-stat__label">เหตุการณ์ที่ได้รับคะแนน</span>
        <span class="card-stat__value">${points.events.length}</span>
        <span class="card-stat__hint">แต่ละภารกิจได้คะแนนเพียงครั้งเดียว</span>
      </div>`;
  }

  function renderBadgeGrid() {
    const box = document.getElementById("allBadgesGrid");
    const badges = PP.getAllBadges(team.id);
    if (!badges.length) {
      box.innerHTML = `<div class="empty-state">ยังไม่มีตราในระบบ</div>`;
      return;
    }
    box.innerHTML = badges.map((b) => `
      <div class="card" style="text-align:center;${b.earned ? "" : "opacity:.45;filter:grayscale(1);"}">
        <div style="font-size:2.2rem;">${b.earned ? b.icon : "🔒"}</div>
        <div class="font-bold text-sm" style="margin-top:6px;">${esc(b.label)}</div>
        <div class="text-xs text-muted" style="margin-top:2px;">${b.earned ? "ปลดล็อกแล้ว" : "ยังไม่ปลดล็อก"}</div>
      </div>`).join("");
  }

  function renderPointsHistory() {
    const box = document.getElementById("pointsHistoryBox");
    const points = PP.getPulsePoints(team.id);
    if (!points.events.length) {
      box.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚡</div>ยังไม่มีประวัติพลังชีพจร — เริ่มวางแผนหรือทำภารกิจแรกของคุณได้เลย</div>`;
      return;
    }
    box.innerHTML = `<table class="pp-table"><thead><tr><th>วันที่</th><th>กิจกรรม</th><th>คะแนน</th></tr></thead><tbody>
      ${points.events.map((e) => `<tr><td>${ThaiDate.formatThaiDateTime(e.at)}</td><td>${esc(POINT_TYPE_LABEL[e.type] || e.type)}</td><td>+${e.points}</td></tr>`).join("")}
      </tbody></table>`;
  }

  renderAll();
})();
