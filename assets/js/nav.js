/*
 * nav.js — Shared app shell (header + sidebar + notification bell + role switcher + toast)
 * ทุกหน้าภายใน pages/ เรียก PPNav.mount("<page-key>") หลังโหลด store.js แล้ว
 * เพื่อประกอบ header/sidebar ล้อมรอบเนื้อหาที่อยู่ใน <div id="pageContent">
 */
(function (global) {
  // เมนูหลักรวมเป็นชุดเดียวกันทั้งสองบทบาท (Dashboard/Projects/Review Queue/Calendar/Notifications/Profile)
  // ปลายทาง (href) ต่างกันตามบทบาท แต่ label/icon/ตำแหน่งเมนูเหมือนกันเสมอ — เนื้อหาภายในหน้าเป็นตัวปรับตามบทบาทแทน
  const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", icon: "🧭", href: { student: "student-dashboard.html", advisor: "advisor-dashboard.html" } },
    { key: "projects", label: "Projects", icon: "🗂️", href: { student: "projects.html", advisor: "projects.html" } },
    { key: "review-queue", label: "Review Queue", icon: "📥", href: { student: "feedback-queue.html", advisor: "feedback-queue.html" } },
    { key: "calendar", label: "Calendar", icon: "🗓️", href: { student: "workload-map.html", advisor: "workload-map.html" } },
    { key: "notifications", label: "Notifications", icon: "🔔", href: { student: "notifications.html", advisor: "notifications.html" } },
    { key: "profile", label: "Profile", icon: "👤", href: { student: "profile.html", advisor: "profile.html" } },
  ];

  // หน้าเดิมที่ไม่ได้ขึ้นเป็นเมนูหลักแล้ว (เข้าถึงจาก Project Detail/Profile แทน) — ยัง map ไปยังเมนูหลักที่ใกล้เคียงที่สุด
  // เพื่อให้แถบเมนูด้านซ้าย highlight ตำแหน่งที่ถูกต้องเมื่อผู้ใช้เปิดหน้าเหล่านี้ตรง ๆ (เช่น จากลิงก์ใน Project Detail)
  const ACTIVE_KEY_ALIAS = {
    "student-dashboard": "dashboard", "advisor-dashboard": "dashboard",
    "projects": "projects", "project-detail": "projects",
    "project-timeline": "projects", "task-detail": "projects", "team-workload": "projects",
    "feedback-queue": "review-queue", "review-feedback": "review-queue", "feedback-to-task": "review-queue",
    "workload-map": "calendar", "free-time-planner": "calendar",
    "notifications": "notifications",
    "profile": "profile", "settings": "profile", "achievements": "profile", "weekly-report": "profile",
  };

  // Bottom Navigation (มือถือ) — เข้าถึงหน้าหลักที่ใช้บ่อยได้เร็ว เสริมจากเมนู hamburger เดิม ไม่ได้แทนที่ ใช้ 5 จาก 6 เมนูหลัก
  const BOTTOM_NAV_KEYS = ["dashboard", "projects", "calendar", "notifications", "profile"];
  function buildBottomNav(user, activeParentKey) {
    const items = NAV_ITEMS.filter((i) => BOTTOM_NAV_KEYS.includes(i.key));
    return `<nav class="bottom-nav" aria-label="เมนูหลัก (มือถือ)">${items.map((i) => `
      <a class="bottom-nav__item ${i.key === activeParentKey ? "is-active" : ""}" href="${i.href[user.role] || i.href.student}">
        <span class="bottom-nav__icon">${i.icon}</span><span>${i.label}</span>
      </a>`).join("")}</nav>`;
  }

  // เข้าถึงได้ (Accessibility): ทำให้ modal ทุกจุดในระบบมี role/aria ถูกต้อง, ปิดด้วย Esc ได้, และ focus ไม่หลุดออกนอก modal
  // ทำงานแบบรวมศูนย์ที่นี่ที่เดียว ไม่ต้องแก้ทุกไฟล์ที่เปิด modal
  function enhanceModals() {
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      const modal = backdrop.querySelector(".modal");
      if (modal && !modal.hasAttribute("role")) {
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
      }
      if (backdrop.dataset.a11yBound) return;
      backdrop.dataset.a11yBound = "1";
      let lastFocused = null;
      new MutationObserver(() => {
        if (backdrop.classList.contains("is-open")) {
          lastFocused = document.activeElement;
          const focusable = modal && modal.querySelector("input, textarea, select, button, [href], [tabindex]");
          if (focusable) focusable.focus();
        } else if (lastFocused) {
          lastFocused.focus();
          lastFocused = null;
        }
      }).observe(backdrop, { attributes: true, attributeFilter: ["class"] });
    });
    if (document.body.dataset.a11yKeysBound) return;
    document.body.dataset.a11yKeysBound = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop.is-open").forEach((bd) => bd.classList.remove("is-open"));
        return;
      }
      if (e.key !== "Tab") return;
      const openModal = document.querySelector(".modal-backdrop.is-open .modal");
      if (!openModal) return;
      const focusables = Array.from(openModal.querySelectorAll("input, textarea, select, button, [href], [tabindex]")).filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  // เข้าถึงได้: ปุ่ม toggle แบบ checkbox (.checkbox) ทุกจุดในระบบให้มี aria-pressed ตรงกับสถานะ is-checked เสมอ
  // สังเกตการเปลี่ยนแปลงของ #pageContent ด้วย MutationObserver จึงครอบคลุมทุกหน้าโดยไม่ต้องแก้ไฟล์ render ทีละจุด
  function enhanceToggleButtons() {
    const stamp = () => document.querySelectorAll(".checkbox").forEach((cb) => {
      cb.setAttribute("aria-pressed", cb.classList.contains("is-checked") ? "true" : "false");
    });
    stamp();
    const pageContent = document.getElementById("pageContent");
    if (pageContent && !pageContent.dataset.a11yObserved) {
      pageContent.dataset.a11yObserved = "1";
      new MutationObserver(stamp).observe(pageContent, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function initials(name) { return (name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(""); }

  function buildHeader(user) {
    const isStudent = user.role === "student";
    const team = isStudent ? PP.getTeam(user.teamId) : null;
    const advisor = !isStudent ? PP.getAdvisor(user.advisorId) : null;
    const name = isStudent ? (PP.getStudent(user.studentId) || { name: team.name }).name : advisor.name;
    const roleLabel = isStudent ? `นิสิต · ${team.name}` : "อาจารย์ที่ปรึกษา";
    const unread = isStudent ? PP.unreadCount("student", user.teamId) : PP.unreadCount("advisor", user.advisorId);

    return `
    <header class="app-header">
      <div class="flex items-center gap-3">
        <button class="app-header__menu-btn" id="btnToggleSidebar" aria-label="เปิดเมนู">☰</button>
        <a href="../index.html" class="app-header__brand" style="text-decoration:none;">
          <span class="pulse-dot"></span>
          <span class="brand-wordmark">ProjectPulse</span><span class="brand-text text-muted" style="font-weight:500;"> · ติดตามโครงงาน</span>
        </a>
      </div>
      <div class="app-header__right">
        <div class="role-switch" role="group" aria-label="สลับบทบาท Demo">
          <button data-role="student" class="${isStudent ? "is-active" : ""}" aria-pressed="${isStudent}">นิสิต</button>
          <button data-role="advisor" class="${!isStudent ? "is-active" : ""}" aria-pressed="${!isStudent}">อาจารย์</button>
        </div>
        <button class="icon-btn" id="btnDataScopeInfo" aria-label="ข้อมูลของระบบต้นแบบนี้" title="ข้อมูลทั้งหมดเป็นข้อมูลจำลองสำหรับสาธิต เก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่มีฐานข้อมูลกลาง">ℹ️</button>
        <button class="icon-btn" id="btnNotifBell" aria-label="การแจ้งเตือน" title="การแจ้งเตือน">
          🔔${unread > 0 ? `<span class="badge-dot">${unread > 9 ? "9+" : unread}</span>` : ""}
        </button>
        <button class="user-chip" id="btnUserChip" style="background:transparent;border:none;cursor:pointer;" title="เปลี่ยนผู้ใช้งาน Demo">
          <span class="user-chip__avatar">${escapeHtml(initials(name))}</span>
          <span class="flex flex-col" style="align-items:flex-start;">
            <span class="user-chip__name">${escapeHtml(name)}</span>
            <span class="user-chip__role">${escapeHtml(roleLabel)}</span>
          </span>
        </button>
      </div>
    </header>
    <div class="modal-backdrop" id="notifPanelBackdrop">
      <div class="modal" style="max-width:420px;">
        <div class="modal-hd"><h3>🔔 การแจ้งเตือน</h3><button class="modal-close" id="closeNotifPanel">✕</button></div>
        <div id="notifPanelList" class="flex flex-col gap-2"></div>
        <div class="modal-footer">
          <a href="notifications.html" class="btn btn-secondary btn-sm">ดูทั้งหมด</a>
          <button class="btn btn-ghost btn-sm" id="btnMarkAllRead">อ่านทั้งหมดแล้ว</button>
        </div>
      </div>
    </div>
    <div class="modal-backdrop" id="userPanelBackdrop">
      <div class="modal" style="max-width:380px;">
        <div class="modal-hd"><h3>สลับผู้ใช้งาน Demo</h3><button class="modal-close" id="closeUserPanel">✕</button></div>
        <div id="userPanelList" class="flex flex-col gap-2"></div>
        <div class="modal-footer">
          <a href="../index.html" class="btn btn-outline btn-sm">กลับหน้าเข้าสู่ระบบ</a>
        </div>
      </div>
    </div>`;
  }

  function buildSidebar(user, activeParentKey) {
    const links = NAV_ITEMS.map((i) => `
      <a class="nav-link ${i.key === activeParentKey ? "is-active" : ""}" href="${i.href[user.role] || i.href.student}">
        <span class="nav-icon">${i.icon}</span><span>${i.label}</span>
      </a>`).join("");
    return `
    <nav class="app-sidebar" id="appSidebar" aria-label="เมนูหลัก">
      <div class="app-sidebar__section-title">Menu</div>
      ${links}
    </nav>
    <div class="sidebar-overlay" id="sidebarOverlay"></div>`;
  }

  function buildFooter() {
    return `
    <footer class="app-footer">
      <div class="app-footer__brand"><span class="brand-wordmark">ProjectPulse</span></div>
      <nav class="app-footer__links" aria-label="Footer">
        <a href="help.html">Help Center</a>
        <a href="user-guide.html">User Guide</a>
        <a href="privacy.html">Privacy</a>
        <a href="terms.html">Terms</a>
        <a href="contact.html">Contact</a>
      </nav>
      <div>© ${new Date().getFullYear()} ProjectPulse · University of Phayao</div>
    </footer>`;
  }

  function notifIcon(type) {
    const map = {
      collision: "⚠️", free_time_found: "⏱️", feedback_received: "⏳", inactivity: "😴",
      feedback_ready: "📩", unassigned_task: "❗", team_imbalance: "⚖️", milestone_delay: "📉",
      deadline_reminder: "⏰", advisor_sla_warn: "🟠", advisor_sla_overdue: "🔴", advisor_sla_normal: "🟡",
      advisor_ack: "📥", advisor_risk: "🚨", pulse_drop: "💔",
    };
    return map[type] || "🔔";
  }

  function renderNotifList(container, list, limit) {
    const rows = limit ? list.slice(0, limit) : list;
    if (!rows.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔕</div>ไม่มีการแจ้งเตือน</div>`;
      return;
    }
    container.innerHTML = rows.map((n) => `
      <div class="alert alert-${n.severity === "red" ? "danger" : n.severity === "warn" ? "warn" : n.severity === "success" ? "success" : "info"}" style="${n.read ? "opacity:.6;" : ""}" data-notif-id="${n.id}">
        <div class="alert__icon">${notifIcon(n.type)}</div>
        <div>
          <div class="alert__title">${escapeHtml(n.title)}</div>
          <div class="text-sm">${escapeHtml(n.message)}</div>
          <div class="text-xs text-muted" style="margin-top:4px;">${ThaiDate.formatThaiDateTime(n.createdAt)}</div>
        </div>
      </div>`).join("");
  }

  function mount(activeKey) {
    const user = PP.getCurrentUser();
    const activeParentKey = ACTIVE_KEY_ALIAS[activeKey] || activeKey;
    const shell = document.getElementById("appShell");
    const headerWrap = document.createElement("div");
    headerWrap.innerHTML = buildHeader(user);
    const sidebarWrap = document.createElement("div");
    sidebarWrap.innerHTML = buildSidebar(user, activeParentKey);

    shell.prepend(...Array.from(headerWrap.childNodes));
    const body = document.getElementById("appBody");
    body.prepend(...Array.from(sidebarWrap.childNodes));

    const pageContent = document.getElementById("pageContent");
    if (pageContent && pageContent.parentElement && !document.querySelector(".app-footer")) {
      const footerWrap = document.createElement("div");
      footerWrap.innerHTML = buildFooter();
      pageContent.insertAdjacentElement("afterend", footerWrap.firstElementChild);
    }

    if (!document.querySelector(".bottom-nav")) {
      const bottomNavWrap = document.createElement("div");
      bottomNavWrap.innerHTML = buildBottomNav(user, activeParentKey);
      document.body.appendChild(bottomNavWrap.firstElementChild);
    }
    enhanceModals();
    enhanceToggleButtons();

    // Mobile sidebar toggle
    const sidebar = document.getElementById("appSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    document.getElementById("btnToggleSidebar").addEventListener("click", () => {
      sidebar.classList.toggle("is-open"); overlay.classList.toggle("is-open");
    });
    overlay.addEventListener("click", () => { sidebar.classList.remove("is-open"); overlay.classList.remove("is-open"); });

    // Role switch
    document.querySelectorAll(".role-switch button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.dataset.role;
        PP.setRole(role);
        window.location.href = role === "student" ? "student-dashboard.html" : "advisor-dashboard.html";
      });
    });

    // Notification bell panel
    document.getElementById("btnDataScopeInfo").addEventListener("click", () => {
      toast("ข้อมูลทั้งหมดเป็นข้อมูลจำลองสำหรับสาธิต เก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่มีฐานข้อมูลกลาง", "info");
    });

    const notifBackdrop = document.getElementById("notifPanelBackdrop");
    document.getElementById("btnNotifBell").addEventListener("click", () => {
      const list = user.role === "student" ? PP.getNotificationsFor("student", user.teamId) : PP.getNotificationsFor("advisor", user.advisorId);
      renderNotifList(document.getElementById("notifPanelList"), list, 6);
      notifBackdrop.classList.add("is-open");
    });
    document.getElementById("closeNotifPanel").addEventListener("click", () => notifBackdrop.classList.remove("is-open"));
    document.getElementById("btnMarkAllRead").addEventListener("click", () => {
      if (user.role === "student") PP.markAllRead("student", user.teamId); else PP.markAllRead("advisor", user.advisorId);
      notifBackdrop.classList.remove("is-open");
      location.reload();
    });

    // User / identity switch panel
    const userBackdrop = document.getElementById("userPanelBackdrop");
    document.getElementById("btnUserChip").addEventListener("click", () => {
      const listEl = document.getElementById("userPanelList");
      if (user.role === "student") {
        listEl.innerHTML = PP.getTeams().map((t) => `
          <button class="btn ${t.id === user.teamId ? "btn-primary" : "btn-outline"} btn-block" style="justify-content:flex-start;" data-team="${t.id}">
            ${escapeHtml(t.name)} <span class="text-xs" style="margin-left:auto;opacity:.8;">${escapeHtml(t.projectType)}</span>
          </button>`).join("");
        listEl.querySelectorAll("button[data-team]").forEach((b) => b.addEventListener("click", () => {
          PP.setCurrentTeam(b.dataset.team); window.location.href = "student-dashboard.html";
        }));
      } else {
        listEl.innerHTML = PP.getAdvisors().map((a) => `
          <button class="btn ${a.id === user.advisorId ? "btn-primary" : "btn-outline"} btn-block" style="justify-content:flex-start;" data-adv="${a.id}">
            ${escapeHtml(a.name)}
          </button>`).join("");
        listEl.querySelectorAll("button[data-adv]").forEach((b) => b.addEventListener("click", () => {
          PP.setCurrentAdvisor(b.dataset.adv); window.location.href = "advisor-dashboard.html";
        }));
      }
      userBackdrop.classList.add("is-open");
    });
    document.getElementById("closeUserPanel").addEventListener("click", () => userBackdrop.classList.remove("is-open"));

    [notifBackdrop, userBackdrop].forEach((bd) => bd.addEventListener("click", (e) => { if (e.target === bd) bd.classList.remove("is-open"); }));
  }

  function toast(message, type) {
    let stack = document.getElementById("toastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toastStack"; stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = `toast ${type || ""}`;
    el.innerHTML = `<span>${type === "success" ? "✅" : type === "danger" ? "⛔" : type === "warn" ? "⚠️" : "ℹ️"}</span><span>${escapeHtml(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, 3200);
  }

  global.PPNav = { mount, NAV_ITEMS, escapeHtml, initials, notifIcon, renderNotifList };
  global.PPToast = { show: toast };
})(window);
