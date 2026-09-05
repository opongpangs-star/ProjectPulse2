/*
 * notifications.js — ตรรกะหน้า Notification Center (ใช้ร่วมกันทั้งนิสิตและอาจารย์)
 * แยกออกจาก PPNav.renderNotifList (ที่ใช้ในกระดิ่งแจ้งเตือนแบบย่อ) เพราะหน้านี้ต้องมี
 * filter tabs ตามความรุนแรง + ปุ่มอ่านแล้ว/อ่านทั้งหมด + ลิงก์ไปหน้าที่เกี่ยวข้องต่อรายการ
 */
(function () {
  const esc = PPNav.escapeHtml;
  const user = PP.getCurrentUser();
  const isStudent = user.role === "student";
  const roleKey = isStudent ? "student" : "advisor";
  const roleId = isStudent ? user.teamId : user.advisorId;

  let currentFilter = "all";

  // หาปลายทางที่เกี่ยวข้องกับแจ้งเตือนแต่ละประเภท ตาม type เพื่อทำให้ทั้งการ์ดคลิกไปต่อได้
  function destinationFor(n) {
    switch (n.type) {
      case "feedback_ready":
      case "feedback_received":
        return isStudent ? "feedback-to-task.html" : "feedback-queue.html";
      case "collision":
        return "workload-map.html";
      case "free_time_found":
        return "workload-map.html?tab=free-time";
      case "team_imbalance":
      case "unassigned_task":
        return "team-workload.html";
      case "inactivity":
      case "milestone_delay":
        return isStudent ? "project-timeline.html" : "team-workload.html";
      case "deadline_reminder":
        return isStudent ? "workload-map.html" : "feedback-queue.html";
      case "pulse_drop":
        return "student-dashboard.html";
      case "advisor_sla_warn":
      case "advisor_sla_overdue":
      case "advisor_sla_normal":
      case "advisor_ack":
      case "advisor_risk":
        return "feedback-queue.html";
      default:
        return null;
    }
  }

  function severityAlertClass(sev) {
    if (sev === "red") return "alert-danger";
    if (sev === "warn") return "alert-warn";
    if (sev === "success") return "alert-success";
    return "alert-info"; // ครอบคลุม 'info' และค่าอื่นที่ไม่ได้อยู่ใน 4 กลุ่มหลัก (เช่น 'yellow' ของแจ้งเตือนอาจารย์)
  }

  function renderAll() {
    const list = PP.getNotificationsFor(roleKey, roleId);
    const unread = list.filter((n) => !n.read).length;
    document.getElementById("pageDesc").textContent =
      `${isStudent ? "นิสิต" : "อาจารย์ที่ปรึกษา"} · ทั้งหมด ${list.length} รายการ · ยังไม่ได้อ่าน ${unread} รายการ`;
    renderList(list);
  }

  function renderList(list) {
    const box = document.getElementById("notifListBox");
    const filtered = currentFilter === "all" ? list : list.filter((n) => n.severity === currentFilter);

    if (!filtered.length) {
      box.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔕</div>ไม่มีการแจ้งเตือนในหมวดนี้</div>`;
      return;
    }

    box.innerHTML = filtered.map((n) => {
      const dest = destinationFor(n);
      const cardStyle = `align-items:flex-start;${n.read ? "opacity:.6;" : ""}${dest ? "cursor:pointer;" : ""}`;
      return `
      <div class="alert ${severityAlertClass(n.severity)}" style="${cardStyle}"
           data-notif="${esc(n.id)}" data-dest="${dest ? esc(dest) : ""}"
           ${dest ? 'tabindex="0" role="link"' : ""}>
        <div class="alert__icon">${PPNav.notifIcon(n.type)}</div>
        <div style="flex:1;min-width:160px;">
          <div class="alert__title">${esc(n.title)}${n.read ? "" : ` <span class="chip chip-neutral">ยังไม่ได้อ่าน</span>`}</div>
          <div class="text-sm">${esc(n.message)}</div>
          <div class="text-xs text-muted" style="margin-top:4px;">${ThaiDate.formatThaiDateTime(n.createdAt)}${dest ? " · คลิกที่การ์ดนี้เพื่อไปยังหน้าที่เกี่ยวข้อง" : ""}</div>
        </div>
        <div class="flex gap-2" style="flex-shrink:0;">
          ${n.read ? "" : `<button type="button" class="btn btn-outline btn-sm" data-read="${esc(n.id)}">อ่านแล้ว</button>`}
        </div>
      </div>`;
    }).join("");

    // ปุ่ม "อ่านแล้ว" ต่อรายการ — ต้องกันไม่ให้ click ทะลุไปเปิดลิงก์ของทั้งการ์ด
    box.querySelectorAll("[data-read]").forEach((btn) => btn.addEventListener("click", (e) => {
      e.stopPropagation();
      PP.markNotificationRead(btn.dataset.read);
      PPToast.show("ทำเครื่องหมายว่าอ่านแล้ว", "success");
      renderAll();
    }));

    // ทั้งการ์ดคลิกได้เมื่อมีปลายทางที่เกี่ยวข้อง
    box.querySelectorAll(".alert[data-dest]").forEach((card) => {
      const dest = card.dataset.dest;
      if (!dest) return;
      card.addEventListener("click", () => { window.location.href = dest; });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = dest; }
      });
    });
  }

  document.querySelectorAll("#severityTabs .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll("#severityTabs .tab-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderAll();
    });
  });

  document.getElementById("btnMarkAllRead").addEventListener("click", () => {
    PP.markAllRead(roleKey, roleId);
    PPToast.show("ทำเครื่องหมายอ่านทั้งหมดแล้ว", "success");
    renderAll();
  });

  renderAll();
})();
