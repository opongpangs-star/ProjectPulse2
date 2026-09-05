/*
 * profile.js — หน้า "Profile" (hub)
 * เป็นทางเข้ารวมไปยังหน้าที่เกี่ยวกับบัญชี/ตัวผู้ใช้เอง (Settings, Achievements, Weekly Report)
 * ไม่ทำซ้ำเนื้อหาของหน้าเหล่านั้น — แสดงแค่สรุปบัญชี + การ์ดลิงก์นำทาง
 */
(function () {
  const user = PP.getCurrentUser();
  const esc = PPNav.escapeHtml;
  const isStudent = user.role === "student";

  document.getElementById("pageDesc").textContent =
    "Your account summary and quick links to account-related pages.";

  function summaryCardHTML() {
    if (isStudent) {
      const student = PP.getStudent(user.studentId);
      const team = PP.getTeam(user.teamId);
      const name = (student || {}).name || team.name;
      return `
        <div class="card">
          <div class="flex items-center gap-3">
            <span class="avatar" style="width:56px;height:56px;font-size:1.1rem;">${esc(PPNav.initials(name))}</span>
            <div>
              <div class="font-bold" style="font-size:1.15rem;">${esc(name)}</div>
              <div class="text-sm text-muted">Student · Team ${esc(team.name)} · ${esc(team.projectName)}</div>
            </div>
          </div>
        </div>`;
    }
    const advisor = PP.getAdvisor(user.advisorId);
    const teamCount = PP.getTeamsByAdvisor(user.advisorId).length;
    return `
      <div class="card">
        <div class="flex items-center gap-3">
          <span class="avatar" style="width:56px;height:56px;font-size:1.1rem;">${esc(PPNav.initials(advisor.name))}</span>
          <div>
            <div class="font-bold" style="font-size:1.15rem;">${esc(advisor.name)}</div>
            <div class="text-sm text-muted">Advisor · Advising ${teamCount} team${teamCount === 1 ? "" : "s"}</div>
          </div>
        </div>
      </div>`;
  }

  function linkCard({ href, icon, title, desc }) {
    return `
      <a class="project-card" href="${href}">
        <div class="project-card__hd">
          <span style="font-size:1.6rem;">${icon}</span>
          <span class="project-card__name">${esc(title)}</span>
        </div>
        <div class="project-card__team">${esc(desc)}</div>
      </a>`;
  }

  function linksHTML() {
    const cards = [
      { href: "settings.html", icon: "⚙️", title: "Account & Settings", desc: "Feedback timeframes, notification preferences, and account options." },
    ];
    if (isStudent) {
      cards.push({ href: "achievements.html", icon: "🏅", title: "Achievements & Streaks", desc: "Badges earned and your pulse point history." });
    }
    cards.push({ href: "weekly-report.html", icon: "📊", title: "Weekly Report", desc: "Your weekly progress summary against course targets." });

    return `<div class="grid grid-3" style="margin-top:var(--pp-space-4);">${cards.map(linkCard).join("")}</div>`;
  }

  document.getElementById("profileContent").innerHTML = summaryCardHTML() + linksHTML();
})();
