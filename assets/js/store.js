/*
 * store.js — ชั้นข้อมูลและตรรกะทางธุรกิจของ ProjectPulse
 * เก็บสถานะทั้งหมดใน localStorage (key เดียว) เพื่อจำลองฐานข้อมูล
 * โครงสร้างนี้ตั้งใจให้ "แทนที่" ด้วยการเรียก REST/GraphQL API จริงในอนาคตได้
 * โดยไม่ต้องเปลี่ยนหน้าตา UI — ทุกฟังก์ชันคืนค่าเป็น plain object/array เสมอ
 */
(function (global) {
  const TD = global.ThaiDate;
  const KEY = "projectpulse_state_v1";

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }

  // เมื่อต้อง reseed ข้อมูลตัวอย่าง (เช่น หลังแก้ชื่ออาจารย์/จำนวนทีม) ต้อง "ย้าย" ทีมที่นิสิตสร้างขึ้นเองจริง
  // (ผ่าน "สร้างทีมของฉันใหม่") มาไว้ในข้อมูลชุดใหม่ด้วยเสมอ — ห้ามลบข้อมูลจริงของนิสิตทิ้งไปเฉย ๆ
  // แยกทีมของนิสิตออกจากทีมตัวอย่างโดยเทียบกับรายการ id ของทีมตัวอย่างชุดใหม่ (ไม่ใช่การเดารูปแบบ id)
  function migrateCustomTeamData(oldState, freshState) {
    const freshTeamIds = new Set(freshState.teams.map((t) => t.id));
    const customTeamIds = new Set((oldState.teams || []).filter((t) => !freshTeamIds.has(t.id)).map((t) => t.id));
    if (!customTeamIds.size) return freshState;

    const keepByTeam = (key) => (oldState[key] || []).filter((x) => customTeamIds.has(x.teamId));
    freshState.teams.push(...oldState.teams.filter((t) => customTeamIds.has(t.id)));
    freshState.students.push(...keepByTeam("students"));
    freshState.milestones.push(...keepByTeam("milestones"));
    freshState.submissions.push(...keepByTeam("submissions"));
    freshState.feedbacks.push(...keepByTeam("feedbacks"));
    freshState.otherCourseTasks.push(...keepByTeam("otherCourseTasks"));
    freshState.schedule.push(...keepByTeam("schedule"));
    freshState.personalBlocks.push(...keepByTeam("personalBlocks"));
    freshState.freeTimeSuggestions.push(...keepByTeam("freeTimeSuggestions"));
    freshState.notifications.push(...(oldState.notifications || []).filter((n) => customTeamIds.has(n.teamId)));
    freshState.checkins = (freshState.checkins || []).concat((oldState.checkins || []).filter((c) => customTeamIds.has(c.teamId)));

    const keptSubIds = new Set(keepByTeam("submissions").map((s) => s.id));
    Object.entries(oldState.queueOverrides || {}).forEach(([subId, val]) => {
      if (keptSubIds.has(subId)) { freshState.queueOverrides = freshState.queueOverrides || {}; freshState.queueOverrides[subId] = val; }
    });
    ["pulsePoints", "weeklyMomentum", "waitingTasks"].forEach((key) => {
      freshState[key] = freshState[key] || {};
      Object.entries(oldState[key] || {}).forEach(([teamId, val]) => { if (customTeamIds.has(teamId)) freshState[key][teamId] = val; });
    });

    if (oldState.currentUser && customTeamIds.has(oldState.currentUser.teamId)) {
      freshState.currentUser = oldState.currentUser;
    }
    return freshState;
  }

  // ย้ายค่าตั้งต้นระดับรายวิชา (SLA/inactivity/collision window/reminder) ข้ามการ reseed ด้วย
  // (ไม่ใช้ migrateCustomTeamData เพราะโครงสร้างนี้เป็น singleton ไม่ใช่ array ต่อทีม)
  function migrateCourseSettings(oldState, freshState) {
    if (!oldState || !oldState.settings) return freshState;
    const keys = ["feedbackSlaDays", "studentInactivityDays", "deadlineCollisionWindowHours", "reminderMilestones", "studentDeadlineReminders"];
    freshState.courseSettings = freshState.courseSettings || {};
    keys.forEach((k) => { if (oldState.settings[k] !== undefined) freshState.courseSettings[k] = oldState.settings[k]; });
    return freshState;
  }

  // ย้ายเวลาส่วนตัวของนิสิตในทีมที่นิสิตสร้างเอง (ไม่ใช่ทีมตัวอย่าง) ข้ามการ reseed ด้วย
  // (personalPrefs เก็บตาม studentId ไม่ใช่ teamId จึงต้องแยกจาก migrateCustomTeamData ที่จัดการเป็น array ต่อทีม)
  function migratePersonalPrefs(oldState, freshState) {
    if (!oldState || !oldState.personalPrefs) return freshState;
    const freshTeamIds = new Set(freshState.teams.map((t) => t.id));
    const customTeamIds = new Set((oldState.teams || []).filter((t) => !freshTeamIds.has(t.id)).map((t) => t.id));
    if (!customTeamIds.size) return freshState;
    const customStudentIds = new Set((oldState.students || []).filter((s) => customTeamIds.has(s.teamId)).map((s) => s.id));
    freshState.personalPrefs = freshState.personalPrefs || {};
    Object.entries(oldState.personalPrefs).forEach(([sid, prefs]) => {
      if (customStudentIds.has(sid)) freshState.personalPrefs[sid] = prefs;
    });
    return freshState;
  }

  // แก้ currentUser.studentId ที่ค้างจากทีมก่อนหน้า (ไม่ตรงกับ currentUser.teamId) ให้กลับมาชี้ถูกทีมเสมอ
  // ป้องกันปัญหาชื่อ/ข้อมูลของทีมเดิมโผล่มาแสดงในทีมที่สลับ/สร้างใหม่
  function repairCurrentUserIdentity(state) {
    const cu = state.currentUser;
    if (!cu || cu.role !== "student") return false;
    const belongs = state.students.some((s) => s.id === cu.studentId && s.teamId === cu.teamId);
    if (belongs) return false;
    const firstMember = state.students.find((s) => s.teamId === cu.teamId);
    cu.studentId = firstMember ? firstMember.id : null;
    return true;
  }

  let STATE = load();
  // reseed อัตโนมัติเมื่อไม่มีข้อมูลเดิม หรือข้อมูลเดิมเป็นข้อมูลจำลองรุ่นเก่า (เช่น หลังแก้ชื่ออาจารย์/จำนวนทีม)
  // ผู้ใช้จะเห็นข้อมูลตัวอย่างชุดล่าสุดเสมอโดยไม่ต้องกดรีเซ็ตเอง — แต่ทีม/ข้อมูลจริงที่นิสิตสร้างเองต้องไม่หายไปด้วย
  if (!STATE || STATE.version !== global.PPSeed.SEED_VERSION) {
    const oldState = STATE;
    const fresh = global.PPSeed.buildSeedData();
    STATE = oldState ? migrateCustomTeamData(oldState, fresh) : fresh;
    if (oldState) migrateCourseSettings(oldState, STATE);
    if (oldState) migratePersonalPrefs(oldState, STATE);
    repairCurrentUserIdentity(STATE);
    save(STATE);
  } else if (repairCurrentUserIdentity(STATE)) {
    save(STATE);
  }

  function getState() { return STATE; }
  function commit() { save(STATE); }
  function resetDemoData() { STATE = global.PPSeed.buildSeedData(); save(STATE); }
  function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

  // ---------------------------------------------------------------------
  // Current user / demo identity switcher
  // ---------------------------------------------------------------------
  function getCurrentUser() { return STATE.currentUser; }
  function setRole(role) { STATE.currentUser.role = role; commit(); }
  // studentId ระบุ "คนที่กำลังใช้เบราว์เซอร์นี้" ในทีมใหม่ — ถ้าไม่ระบุมา จะ default เป็นสมาชิกคนแรกของทีมนั้น
  // (ห้ามปล่อยให้ studentId เดิมจากทีมก่อนหน้าค้างอยู่ ไม่งั้นชื่อ/ข้อมูลของทีมเดิมจะรั่วไปแสดงในทีมใหม่)
  function setCurrentTeam(teamId, studentId) {
    STATE.currentUser.teamId = teamId;
    STATE.currentUser.role = "student";
    if (studentId && STATE.students.some((s) => s.id === studentId && s.teamId === teamId)) {
      STATE.currentUser.studentId = studentId;
    } else {
      const firstMember = STATE.students.find((s) => s.teamId === teamId);
      STATE.currentUser.studentId = firstMember ? firstMember.id : null;
    }
    commit();
  }
  function setCurrentAdvisor(advisorId) { STATE.currentUser.advisorId = advisorId; STATE.currentUser.role = "advisor"; commit(); }

  // ---------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------
  // สัปดาห์ปัจจุบันคำนวณจาก "วันนี้จริง" เทียบกับวันเริ่มภาคการศึกษาเสมอ (ไม่ใช่ค่าคงที่ที่ค้างจากตอน seed)
  function getCourse() {
    const c = STATE.course;
    const start = TD.toDate(c.startDate);
    const diffDays = Math.floor((new Date() - start) / 86400000);
    const currentWeek = Math.max(1, Math.min(c.weeks, Math.floor(diffDays / 7) + 1));
    return Object.assign({}, c, { currentWeek });
  }
  function getCourseSettings() { return STATE.courseSettings; }
  function updateCourseSettings(patch) { Object.assign(STATE.courseSettings, patch); commit(); }
  function getNotificationPrefs(userId) {
    return (STATE.notificationPrefs && STATE.notificationPrefs[userId]) || { inApp: true, email: true };
  }
  function updateNotificationPrefs(userId, patch) {
    STATE.notificationPrefs = STATE.notificationPrefs || {};
    STATE.notificationPrefs[userId] = Object.assign({ inApp: true, email: true }, STATE.notificationPrefs[userId], patch);
    commit();
  }
  function getAdvisors() { return STATE.advisors; }
  function getAdvisor(id) { return STATE.advisors.find((a) => a.id === id); }
  function getTeams() { return STATE.teams; }
  function getTeam(teamId) { return STATE.teams.find((t) => t.id === teamId); }
  function getTeamsByAdvisor(advisorId) { return STATE.teams.filter((t) => t.advisorId === advisorId); }
  function getStudentsByTeam(teamId) { return STATE.students.filter((s) => s.teamId === teamId); }
  function getStudent(id) { return STATE.students.find((s) => s.id === id); }

  // ---------------------------------------------------------------------
  // สร้าง/แก้ไขทีมโครงงาน — ให้นิสิตกรอกข้อมูลทีมของตัวเอง (ไม่ใช่ทีมตัวอย่าง)
  // ---------------------------------------------------------------------
  function createTeam({ name, projectType, projectName, advisorId, members }) {
    const teamId = uid("team");
    const memberIds = (members || []).map(() => uid(`${teamId}-m`));
    (members || []).forEach((m, i) => {
      STATE.students.push({ id: memberIds[i], name: m.name, role: m.role || "สมาชิก", teamId });
    });
    const team = {
      id: teamId, name, projectType, projectName, advisorId,
      pace: "onTrack", health: "green", currentOrder: 1, blocksNext: false,
      inactivityDays: 0, streakDays: 0, lastActivityDate: TD.toISODate(new Date()),
    };
    STATE.teams.push(team);
    STATE.milestones.push(...global.PPSeed.buildMilestonesForNewTeam(teamId, memberIds, projectType));
    commit();
    return Object.assign({}, team, { memberIds });
  }

  // การเปลี่ยนอาจารย์ที่ปรึกษาต้องผ่าน requestAdvisorChange + respondAdvisorChangeRequest เท่านั้น (ต้องได้รับอนุมัติ)
  // ไม่ให้แก้ตรงผ่านฟอร์มข้อมูลทีมทั่วไป จึงตัด advisorId ออกจาก patch นี้เสมอ แม้จะมีการส่งมาด้วยก็ตาม
  function updateTeamInfo(teamId, patch) {
    const team = getTeam(teamId);
    const safePatch = Object.assign({}, patch);
    delete safePatch.advisorId;
    Object.assign(team, safePatch);
    commit();
  }

  // ---------------------------------------------------------------------
  // ขอเปลี่ยนอาจารย์ที่ปรึกษา — ต้องให้อาจารย์ท่านใหม่อนุมัติก่อนจึงมีผลจริง
  // ---------------------------------------------------------------------
  function requestAdvisorChange(teamId, newAdvisorId, reason) {
    const team = getTeam(teamId);
    if (!team || newAdvisorId === team.advisorId) return;
    team.pendingAdvisorChange = { newAdvisorId, reason: (reason || "").trim(), requestedAt: new Date().toISOString() };
    pushNotification({
      audience: "advisor", advisorId: newAdvisorId, teamId: team.id, type: "advisor_change_request", severity: "info",
      title: "คำขอเปลี่ยนอาจารย์ที่ปรึกษา",
      message: `${team.name} ขอเปลี่ยนมาอยู่ในความดูแลของท่าน${team.pendingAdvisorChange.reason ? " — เหตุผล: " + team.pendingAdvisorChange.reason : ""}`,
    });
    commit();
  }
  function respondAdvisorChangeRequest(teamId, accept) {
    const team = getTeam(teamId);
    if (!team || !team.pendingAdvisorChange) return;
    if (accept) {
      team.advisorId = team.pendingAdvisorChange.newAdvisorId;
      pushNotification({ audience: "student", teamId: team.id, type: "advisor_change_approved", severity: "success", title: "เปลี่ยนอาจารย์ที่ปรึกษาแล้ว", message: "คำขอเปลี่ยนอาจารย์ที่ปรึกษาของทีมได้รับการอนุมัติแล้ว" });
    } else {
      pushNotification({ audience: "student", teamId: team.id, type: "advisor_change_declined", severity: "warn", title: "คำขอเปลี่ยนอาจารย์ที่ปรึกษาไม่ได้รับการอนุมัติ", message: "อาจารย์ที่ท่านขอย้ายไปไม่รับคำขอนี้ในขณะนี้" });
    }
    team.pendingAdvisorChange = null;
    commit();
  }
  function getPendingAdvisorChangeRequests(advisorId) {
    return getTeams()
      .filter((t) => t.pendingAdvisorChange && t.pendingAdvisorChange.newAdvisorId === advisorId)
      .map((t) => ({ team: t, request: t.pendingAdvisorChange }));
  }

  function addTeamMember(teamId, { name, role }) {
    const id = uid(`${teamId}-m`);
    STATE.students.push({ id, name, role: role || "สมาชิก", teamId });
    commit();
    return { id, name, role: role || "สมาชิก" };
  }

  function removeTeamMember(studentId) {
    STATE.students = STATE.students.filter((s) => s.id !== studentId);
    commit();
  }

  function updateStudent(studentId, patch) {
    const s = getStudent(studentId);
    if (!s) return;
    Object.assign(s, patch);
    commit();
  }

  // ความก้าวหน้าจริงของโครงงาน — ให้เครดิตงานย่อยที่เสร็จแล้วของ Milestone ปัจจุบันด้วย ไม่ใช่แค่นับ Milestone ที่ผ่านแล้วเท่านั้น
  // (นับ Milestone ที่ผ่านแล้ว = 1 เต็ม, Milestone ที่ยังไม่ผ่านให้เครดิตตามสัดส่วนงานย่อยที่เสร็จ) ป้องกันไม่ให้ค้างที่ค่าเดิมจนกว่าจะผ่าน Milestone ทั้งก้อน
  function computeProgressPct(teamId) {
    const ms = getMilestones(teamId);
    if (!ms.length) return 0;
    const creditUnits = ms.reduce((sum, m) => {
      if (["passed", "done"].includes(m.status)) return sum + 1;
      if (m.subtasks.length) return sum + m.subtasks.filter((s) => s.done).length / m.subtasks.length;
      return sum;
    }, 0);
    return Math.round((creditUnits / ms.length) * 100);
  }

  function getMilestoneDefs() { return STATE.milestoneDefs; }
  function getMilestones(teamId) { return STATE.milestones.filter((m) => m.teamId === teamId).sort((a, b) => a.order - b.order); }
  function getMilestone(id) { return STATE.milestones.find((m) => m.id === id); }
  function getCurrentMilestone(teamId) {
    const ms = getMilestones(teamId);
    const team = getTeam(teamId);
    return ms.find((m) => m.order === team.currentOrder) || ms[0];
  }
  function statusMeta(key) { return STATE.statusMeta[key] || { label: key, chip: "chip-neutral" }; }
  function getSubmission(id) { return STATE.submissions.find((s) => s.id === id); }
  function getSubmissionsByTeam(teamId) { return STATE.submissions.filter((s) => s.teamId === teamId); }
  function getFeedback(id) { return STATE.feedbacks.find((f) => f.id === id); }
  function getFeedbackBySubmission(submissionId) { return STATE.feedbacks.find((f) => f.submissionId === submissionId); }
  function getFeedbacksByTeam(teamId) { return STATE.feedbacks.filter((f) => f.teamId === teamId); }
  function getOtherCourseTasks(teamId) { return STATE.otherCourseTasks.filter((t) => t.teamId === teamId); }
  function addOtherCourseTask(teamId, { courseName, title, dueDate, hoursEstimate }) {
    const task = { id: uid("oc"), teamId, courseName, title, dueDate, hoursEstimate: Number(hoursEstimate) };
    STATE.otherCourseTasks.push(task);
    recordActivity(teamId);
    commit();
    return task;
  }
  function removeOtherCourseTask(taskId) {
    STATE.otherCourseTasks = STATE.otherCourseTasks.filter((t) => t.id !== taskId);
    commit();
  }
  function getSchedule(teamId) { return STATE.schedule.filter((s) => s.teamId === teamId); }
  // ทีมที่นิสิตสร้างขึ้นเองใหม่ไม่มีตารางเรียนติดมาเลย (ต่างจาก 30 ทีมตัวอย่างที่มี SCHEDULE_TEMPLATE) — ต้องให้กรอกเองผ่านขั้นตอนตั้งค่าเริ่มต้น
  function addScheduleBlock(teamId, { dow, start, end, title }) {
    const block = { id: uid("sch"), teamId, dow: Number(dow), start, end, title: title || "คาบเรียน", type: "class" };
    STATE.schedule.push(block);
    commit();
    return block;
  }
  function removeScheduleBlock(id) {
    STATE.schedule = STATE.schedule.filter((s) => s.id !== id);
    commit();
  }
  function getPersonalBlocks(teamId) { return STATE.personalBlocks.filter((s) => s.teamId === teamId); }
  function getFreeTimeSuggestions(teamId) { return STATE.freeTimeSuggestions.filter((f) => f.teamId === teamId); }
  function getNotificationsFor(role, id) {
    return STATE.notifications
      .filter((n) => n.audience === role && (role === "student" ? n.teamId === id : n.advisorId === id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  function unreadCount(role, id) { return getNotificationsFor(role, id).filter((n) => !n.read).length; }
  function markNotificationRead(id) { const n = STATE.notifications.find((x) => x.id === id); if (n) { n.read = true; commit(); } }
  function markAllRead(role, id) { getNotificationsFor(role, id).forEach((n) => (n.read = true)); commit(); }
  function pushNotification(o) { STATE.notifications.unshift(Object.assign({ id: uid("n"), read: false, createdAt: new Date().toISOString() }, o)); commit(); }

  // ---------------------------------------------------------------------
  // Milestone / task mutations
  // ---------------------------------------------------------------------
  function setMilestoneStatus(milestoneId, status, note) {
    const m = getMilestone(milestoneId);
    if (!m) return;
    m.status = status;
    m.history.push({ date: TD.toISODate(new Date()), note: note || `เปลี่ยนสถานะเป็น "${statusMeta(status).label}"` });
    if (status === "passed" || status === "done") m.completedDate = TD.toISODate(new Date());
    const team = getTeam(m.teamId);
    if ((status === "passed" || status === "done") && m.order === team.currentOrder) {
      team.currentOrder = Math.min(m.order + 1, STATE.milestoneDefs.length);
      team.blocksNext = false;
    }
    commit();
  }

  function toggleSubtask(milestoneId, subtaskId) {
    const m = getMilestone(milestoneId);
    const st = m.subtasks.find((s) => s.id === subtaskId);
    if (!st) return;
    st.done = !st.done;
    if (m.status === "not_started" && st.done) m.status = "in_progress";
    // งานย่อยนี้ถูกสร้างมาจากรายการ checklist ของ Feedback — ผลักสถานะเสร็จ/ไม่เสร็จกลับไปที่รายการเดิมด้วย
    // เพื่อให้ตรา/คะแนน "แก้ครบตามรายการ" ยังทำงานถูกต้อง โดยไม่ต้องนับงานเดียวกันซ้ำสองที่
    if (st.sourceChecklistItemId) {
      const fb = STATE.feedbacks.find((f) => f.checklist.some((c) => c.id === st.sourceChecklistItemId));
      const item = fb && fb.checklist.find((c) => c.id === st.sourceChecklistItemId);
      if (item) {
        item.done = st.done;
        if (fb.checklist.length && fb.checklist.every((c) => c.done)) {
          recordMomentum(fb.teamId, "feedbackAddressed");
          awardPoints(fb.teamId, "feedback_addressed_complete", `feedback-complete-${fb.id}`);
        }
      }
    }
    if (st.done) {
      recordActivity(m.teamId);
      recordMomentum(m.teamId, "worked");
      recordCollaboration(m.teamId, st.assigneeId);
      const todayISO = TD.toISODate(new Date());
      const hasPlanToday = getFreeTimeSuggestions(m.teamId).some((f) => f.status === "confirmed" && f.date === todayISO);
      if (hasPlanToday) awardPoints(m.teamId, "complete_planned_task", `worked-${subtaskId}-${todayISO}`);
    }
    commit();
  }

  function addSubtask(milestoneId, title, assigneeId, extra) {
    const m = getMilestone(milestoneId);
    const subtask = Object.assign({ id: uid("st"), title, assigneeId: assigneeId || null, done: false }, extra || {});
    m.subtasks.push(subtask);
    if (m.status === "not_started") m.status = "in_progress";
    recordActivity(m.teamId);
    commit();
    return subtask;
  }

  function addAttachment(milestoneId, fileName) {
    const m = getMilestone(milestoneId);
    m.attachments.push({ name: fileName, uploadedAt: TD.toISODate(new Date()) });
    commit();
  }

  function submitMilestone(milestoneId, fileName, note, extra) {
    const m = getMilestone(milestoneId);
    m.status = "submitted";
    m.history.push({ date: TD.toISODate(new Date()), note: "นิสิตส่งงานให้อาจารย์ตรวจ" });
    if (fileName) m.attachments.push({ name: fileName, uploadedAt: TD.toISODate(new Date()) });
    const team = getTeam(m.teamId);
    const priorSubs = getSubmissionsByTeam(m.teamId).filter((s) => s.milestoneId === milestoneId);
    const sub = {
      id: uid("sub"), teamId: m.teamId, milestoneId: m.id, milestoneName: m.name,
      submittedAt: new Date().toISOString(), fileName: fileName || `${m.name}.pdf`,
      note: note || "", status: "submitted", reviewedBy: null, reviewedAt: null,
      revisionRound: priorSubs.length, // 0 = ส่งครั้งแรก, 1+ = ส่งใหม่หลังแก้ไขรอบที่ N
      changesSummary: (extra && extra.changesSummary) || null,
      addressedChecklistIds: (extra && extra.addressedChecklistIds) || [],
    };
    STATE.submissions.push(sub);
    pushNotification({ audience: "advisor", advisorId: team.advisorId, teamId: team.id, type: "advisor_ack", severity: "info", title: "ได้รับงานแล้ว", message: `ได้รับงานส่งจาก${team.name} (${m.name}) แล้ว รอคิวตรวจ` });
    recordActivity(m.teamId);
    recordMomentum(m.teamId, "submitted");
    if (new Date() <= new Date(m.dueDate)) awardPoints(m.teamId, "submit_on_time", `submit-ontime-${m.id}`);
    commit();
    return sub;
  }

  function startReview(submissionId) {
    const sub = getSubmission(submissionId);
    sub.status = "reviewing";
    setMilestoneStatus(sub.milestoneId, "reviewing", "อาจารย์เริ่มตรวจงาน");
    commit();
  }

  function requestMoreInfo(submissionId, message) {
    const sub = getSubmission(submissionId);
    sub.status = "need_info"; sub.reviewedAt = new Date().toISOString();
    setMilestoneStatus(sub.milestoneId, "need_info", "อาจารย์ขอข้อมูลเพิ่มเติม");
    const team = getTeam(sub.teamId);
    pushNotification({ audience: "student", teamId: team.id, type: "feedback_ready", severity: "warn", title: "อาจารย์ขอข้อมูลเพิ่มเติม", message: message || "กรุณาส่งข้อมูลเพิ่มเติมตามที่อาจารย์ร้องขอ" });
    commit();
  }

  // แยก raw feedback text เป็นรายการ checklist เบื้องต้น (ช่วยร่าง แต่ไม่ตัดสินคะแนน/ไม่เปลี่ยนความหมาย)
  function draftChecklistFromText(rawText) {
    return rawText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ id: uid("c"), title: line, assigneeId: null, dueDate: null, hours: null, relatedTo: "", needsRecheck: true, done: false }));
  }

  function giveFeedback(submissionId, { rawText, decision, checklist }) {
    const sub = getSubmission(submissionId);
    const team = getTeam(sub.teamId);
    sub.reviewedAt = new Date().toISOString();
    sub.reviewedBy = team.advisorId;
    sub.status = decision;

    const fb = {
      id: uid("fb"), submissionId, teamId: team.id, advisorId: team.advisorId, milestoneId: sub.milestoneId,
      createdAt: sub.reviewedAt, decision, rawText,
      checklist: checklist && checklist.length ? checklist : draftChecklistFromText(rawText),
    };
    STATE.feedbacks.push(fb);

    if (decision === "passed") {
      setMilestoneStatus(sub.milestoneId, "passed", "อาจารย์อนุมัติผ่าน Milestone");
      pushNotification({ audience: "student", teamId: team.id, type: "feedback_received", severity: "success", title: "ผ่าน Milestone แล้ว", message: `Milestone "${sub.milestoneName}" ผ่านเรียบร้อยแล้ว` });
    } else {
      setMilestoneStatus(sub.milestoneId, decision, decision === "revise" ? "อาจารย์ให้ Feedback: ต้องแก้ไข" : "อาจารย์ขอข้อมูลเพิ่มเติม");
      pushNotification({ audience: "student", teamId: team.id, type: "feedback_ready", severity: "info", title: "อาจารย์ส่ง Feedback แล้ว", message: `อาจารย์ให้ Feedback งาน "${sub.milestoneName}" แล้ว พร้อมรายการแก้ไข ${fb.checklist.length} รายการ` });
    }
    commit();
    return fb;
  }

  function updateChecklistItem(feedbackId, itemId, patch) {
    const fb = getFeedback(feedbackId);
    const item = fb.checklist.find((c) => c.id === itemId);
    Object.assign(item, patch);
    if (fb.checklist.length && fb.checklist.every((c) => c.done)) {
      recordMomentum(fb.teamId, "feedbackAddressed");
      awardPoints(fb.teamId, "feedback_addressed_complete", `feedback-complete-${feedbackId}`);
    }
    commit();
  }

  function confirmChecklist(feedbackId) {
    const fb = getFeedback(feedbackId);
    if (!fb || fb.confirmedAt) return; // ป้องกันกดยืนยันซ้ำสร้างงานย่อยซ้ำ
    fb.confirmedAt = new Date().toISOString();
    fb.checklist.forEach((item) => {
      if (item.assigneeId && item.dueDate) {
        // ผูก id งานย่อยที่สร้างขึ้นกับรายการ checklist ต้นทาง ทั้งสองทาง เพื่อไม่ให้ถูกนับภาระงานซ้ำสองที่
        const subtask = addSubtask(fb.milestoneId, `[แก้ไข] ${item.title}`, item.assigneeId, { sourceChecklistItemId: item.id });
        item.convertedToSubtaskId = subtask.id;
      }
    });
    commit();
  }

  // ---------------------------------------------------------------------
  // Feedback Queue (สำหรับอาจารย์)
  // ---------------------------------------------------------------------
  function feedbackQueue(advisorId) {
    const teams = getTeamsByAdvisor(advisorId);
    const teamIds = teams.map((t) => t.id);
    const pending = STATE.submissions.filter((s) => teamIds.includes(s.teamId) && ["submitted", "reviewing"].includes(s.status));
    const now = new Date();
    const sla = STATE.courseSettings.feedbackSlaDays;
    const overrides = STATE.queueOverrides || {};

    const rows = pending.map((sub) => {
      const team = getTeam(sub.teamId);
      const milestone = getMilestone(sub.milestoneId);
      const waitDays = TD.diffDays(now, sub.submittedAt);
      const feedbackDueDate = TD.addDays(sub.submittedAt, sla);
      const daysToOverdue = TD.diffDays(feedbackDueDate, now);
      const nextMilestoneDef = STATE.milestoneDefs.find((d) => d.order === milestone.order + 1);
      const nextMilestone = nextMilestoneDef ? STATE.milestones.find((m) => m.teamId === team.id && m.key === nextMilestoneDef.key) : null;
      let urgency = "ปกติ";
      if (waitDays >= sla) urgency = "เกินกำหนด";
      else if (waitDays >= sla - 2) urgency = "ใกล้เกินกำหนด";
      else if (waitDays >= 3) urgency = "ต้องติดตาม";

      // riskLevel มาจากชีพจรที่คำนวณสด (computeHealthScore) เสมอ ไม่ใช่ค่า team.health แบบ seed ที่นิ่งค้างไว้
      const health = computeHealthScore(team.id);
      const riskLevel = health.level === "dormant" ? "สูง" : health.level === "weak" ? "ปานกลาง" : "ต่ำ";
      const priorityScore = waitDays * 10 + (team.blocksNext ? 15 : 0) + (riskLevel === "สูง" ? 8 : riskLevel === "ปานกลาง" ? 4 : 0) - TD.diffDays(nextMilestone ? nextMilestone.dueDate : TD.addDays(now, 30), now) * 0.2;
      const override = overrides[sub.id];

      return {
        submission: sub, team, milestone, waitDays, feedbackDueDate: TD.toISODate(feedbackDueDate), daysToOverdue,
        nextMilestone, urgency, riskLevel, health, blocksNext: !!team.blocksNext,
        nextBestTasks: nextBestTasks(team.id),
        revisionRound: sub.revisionRound || 0,
        changesSummary: sub.changesSummary || null,
        priorityScore, overrideReason: override ? override.reason : null,
        overrideAt: override ? override.at : null,
        expectedReviewDate: sub.expectedReviewDate || null,
      };
    });

    // จัดลำดับตาม priorityScore ก่อน แล้วดึงรายการที่อาจารย์ "Override" ลำดับด้วยตนเองขึ้นบนสุด
    // (เรียงตามเวลาที่สั่ง override ล่าสุดไว้บนสุด) — ทุกครั้งที่ override ต้องมีเหตุผลกำกับเสมอ
    rows.sort((a, b) => b.priorityScore - a.priorityScore);
    const overridden = rows.filter((r) => r.overrideReason).sort((a, b) => new Date(b.overrideAt) - new Date(a.overrideAt));
    const rest = rows.filter((r) => !r.overrideReason);
    const ordered = [...overridden, ...rest];
    ordered.forEach((r, i) => (r.queueRank = i + 1));
    return ordered;
  }

  function overrideQueueOrder(submissionId, reason) {
    if (!reason || !reason.trim()) return;
    STATE.queueOverrides = STATE.queueOverrides || {};
    STATE.queueOverrides[submissionId] = { reason: reason.trim(), at: new Date().toISOString() };
    commit();
  }
  function clearQueueOverride(submissionId) {
    STATE.queueOverrides = STATE.queueOverrides || {};
    delete STATE.queueOverrides[submissionId];
    commit();
  }

  // อาจารย์แจ้งวันที่คาดว่าจะตรวจเสร็จให้นิสิตเห็นล่วงหน้า (เป็นการประมาณของอาจารย์เอง ไม่ใช่ SLA อัตโนมัติ)
  function setExpectedReviewDate(submissionId, dateISO) {
    const sub = getSubmission(submissionId);
    if (!sub) return;
    sub.expectedReviewDate = dateISO || null;
    commit();
  }

  // ตำแหน่งคิวของทีมตัวเอง (สำหรับนิสิต) — ไม่เปิดเผยชื่อ/ข้อมูลทีมอื่นใด ๆ
  function myQueuePosition(teamId) {
    const team = getTeam(teamId);
    const queue = feedbackQueue(team.advisorId);
    const row = queue.find((r) => r.team.id === teamId);
    if (!row) return null;
    return {
      position: row.queueRank, total: queue.length, waitDays: row.waitDays,
      feedbackDueDate: row.feedbackDueDate, urgency: row.urgency,
      expectedReviewDate: row.expectedReviewDate,
      overdueBy7Days: row.waitDays >= STATE.courseSettings.feedbackSlaDays,
    };
  }

  // เปรียบเทียบกับรอบตรวจก่อนหน้า — "What Changed Since Last Review"
  function getPreviousFeedbackForSubmission(sub) {
    if (!sub || !sub.revisionRound) return null;
    const teamSubs = getSubmissionsByTeam(sub.teamId)
      .filter((s) => s.milestoneId === sub.milestoneId)
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const idx = teamSubs.findIndex((s) => s.id === sub.id);
    if (idx <= 0) return null;
    return getFeedbackBySubmission(teamSubs[idx - 1].id);
  }

  // ---------------------------------------------------------------------
  // Next Best Task (ระหว่างรอตรวจ)
  // ---------------------------------------------------------------------
  function nextBestTasks(teamId) {
    const team = getTeam(teamId);
    const milestone = getCurrentMilestone(teamId);
    const lib = STATE.nextBestTaskLib[milestone.key] || [];
    return lib.slice(0, 4);
  }

  // ---------------------------------------------------------------------
  // Project Health Score — ตัวชี้วัดความเสี่ยง (ไม่ใช่คะแนนรายวิชา)
  // ---------------------------------------------------------------------
  function computeHealthScore(teamId) {
    const team = getTeam(teamId);
    const ms = getMilestones(teamId);
    const current = getCurrentMilestone(teamId);
    const now = new Date();
    let score = 100;
    const reasons = [];

    const passedCount = ms.filter((m) => m.status === "passed" || m.status === "done").length;
    const expectedPassed = current.order - 1;
    if (passedCount < expectedPassed) {
      const gap = expectedPassed - passedCount;
      score -= gap * 8;
      reasons.push(`ส่ง Milestone ล่าช้ากว่าแผน ${gap} รายการ`);
    } else {
      reasons.push("ส่ง Milestone ตรงตามแผนที่วางไว้");
    }

    // นิสิตกำลังรออาจารย์ตรวจอยู่ (ส่งแล้ว/อาจารย์กำลังตรวจ) — ห้ามนับความเสี่ยงจากการไม่มีความเคลื่อนไหว
    // และห้ามลดสถานะชีพจรเพราะอาจารย์ตรวจช้า (ไม่ใช่สิ่งที่นิสิตควบคุมได้)
    const isAwaitingReview = ["submitted", "reviewing"].includes(current.status);
    if (!isAwaitingReview && team.inactivityDays >= STATE.courseSettings.studentInactivityDays) {
      score -= team.inactivityDays * 5;
      reasons.push(`ไม่มีการอัปเดตความก้าวหน้ามาแล้ว ${team.inactivityDays} วัน`);
    }

    if (current.status === "blocked") {
      score -= 25;
      reasons.push(`Milestone ปัจจุบัน "${current.name}" ติดปัญหาและยังไม่ได้แก้ไข`);
    } else if (current.status === "revise" || current.status === "need_info") {
      const lastNoteDate = current.history.length ? current.history[current.history.length - 1].date : current.startDate;
      const daysSinceFeedback = TD.diffDays(now, lastNoteDate);
      if (daysSinceFeedback > 7) {
        score -= 25;
        reasons.push(`ได้รับคำขอแก้ไขจากอาจารย์มาแล้ว ${daysSinceFeedback} วัน แต่ยังไม่มีการดำเนินการ`);
      } else {
        score -= 12;
        reasons.push(`Milestone ปัจจุบัน "${current.name}" มีรายการที่ต้องแก้ไข/ให้ข้อมูลเพิ่มเติมค้างอยู่`);
      }
    }

    const daysToDue = TD.diffDays(current.dueDate, now);
    if (!isAwaitingReview && daysToDue >= 0 && daysToDue <= 7 && !["passed", "done"].includes(current.status)) {
      const hasConfirmedPlan = getFreeTimeSuggestions(teamId).some((f) => f.status === "confirmed" && new Date(f.date) >= now);
      if (!hasConfirmedPlan) {
        score -= 8;
        reasons.push(`Milestone ปัจจุบันใกล้ถึงกำหนดส่งภายใน ${daysToDue} วัน แต่ยังไม่มีแผนช่วงเวลาทำงานที่ยืนยันแล้ว`);
      }
    }

    if (team.blocksNext) {
      score -= 10;
      reasons.push("งานที่รอตรวจอยู่ในขณะนี้ขวางไม่ให้ทีมเริ่ม Milestone ถัดไปได้");
    }
    if (current.risk === "high") {
      score -= 15;
      reasons.push(`Milestone ปัจจุบันถูกประเมินความเสี่ยงไว้ในระดับสูง`);
    } else if (current.risk === "medium") {
      score -= 7;
      reasons.push(`Milestone ปัจจุบันถูกประเมินความเสี่ยงไว้ในระดับปานกลาง`);
    }

    const collision = detectDeadlineCollision(teamId);
    if (collision.hasCollision) {
      score -= 15;
      reasons.push(`พบกำหนดส่งชนกัน ${collision.items.length} ชิ้นภายใน ${STATE.courseSettings.deadlineCollisionWindowHours} ชั่วโมง`);
    }

    // หมายเหตุ: ตั้งใจไม่ลดคะแนนชีพจรจากระยะเวลาที่รอ Feedback — เพราะเป็นความล่าช้าฝั่งอาจารย์ ไม่ใช่พฤติกรรมของนิสิต
    // (การติดตามเวลารอ/SLA สำหรับอาจารย์ใช้ feedbackQueue()/riskRadar() แยกต่างหาก ไม่ปนกับชีพจรของนิสิต)
    if (isAwaitingReview) {
      reasons.push("งานอยู่ในคิวตรวจ กำลังรอผลจากอาจารย์ที่ปรึกษา");
    }

    const wl = teamWorkload(teamId);
    if (wl.unassigned.length > 0) {
      score -= wl.unassigned.length * 5;
      reasons.push(`มีงานที่ยังไม่มีผู้รับผิดชอบ ${wl.unassigned.length} รายการ`);
    }
    if (wl.imbalance) {
      score -= 8;
      reasons.push("ภาระงานของสมาชิกในทีมไม่สมดุล");
    }

    const daysToFinal = TD.diffDays(STATE.course.endDate, now);
    const remainingMilestones = ms.filter((m) => !["passed", "done"].includes(m.status)).length;
    if (remainingMilestones > 0 && daysToFinal / remainingMilestones < 5) {
      score -= 10;
      reasons.push("เวลาที่เหลือก่อนกำหนดส่งสุดท้ายกระชั้นชิดเมื่อเทียบกับงานที่เหลือ");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    // Project Pulse — 4 ระดับ (Dormant/Weak/Steady/Strong) คำนวณจาก threshold เดียวกับ statusTier ที่มีอยู่เดิม
    let level = "dormant";
    let statusTier = 0, statusLabel = "ต้องช่วยเหลือทันที";
    if (score >= 90) { statusTier = 3; statusLabel = "เดินหน้าได้ดี"; level = "strong"; }
    else if (score >= 78) { statusTier = 2; statusLabel = "อยู่ในจังหวะ"; level = "steady"; }
    else if (score >= 55) { statusTier = 1; statusLabel = "ต้องเฝ้าระวัง"; level = "weak"; }
    const nextStepOwner = isAwaitingReview ? "advisor" : "student";
    if (reasons.length === 0) reasons.push("ยังไม่พบความเสี่ยงในขณะนี้");
    return { score, level, statusTier, statusLabel, nextStepOwner, reasons };
  }

  // ---------------------------------------------------------------------
  // Deadline Collision Alert
  // ---------------------------------------------------------------------
  function detectDeadlineCollision(teamId) {
    const windowH = STATE.courseSettings.deadlineCollisionWindowHours;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowH * 3600 * 1000);
    const other = getOtherCourseTasks(teamId).filter((t) => new Date(t.dueDate) >= now && new Date(t.dueDate) <= windowEnd);
    const current = getCurrentMilestone(teamId);
    const projectSoon = !!(current && !["passed", "done"].includes(current.status) && new Date(current.dueDate) <= windowEnd);
    const items = other.map((t) => ({ title: t.title, courseName: t.courseName, dueDate: t.dueDate, hours: t.hoursEstimate, type: "other-course" }));

    // นับกำหนดส่ง Milestone ปัจจุบันของทีมเองเป็นหนึ่งใน "สิ่งที่ต้องส่งเร็ว ๆ นี้" ด้วย ไม่ใช่แค่ตัวแปรบอกใกล้/ไกลเฉย ๆ
    // ใช้ชั่วโมงงานย่อยที่เหลือของ Milestone ปัจจุบันเท่านั้น (ไม่รวมงานของ Milestone อื่นในอนาคตที่ยังไม่ต้องทำตอนนี้)
    if (projectSoon) {
      const remainingSubtasks = current.subtasks.filter((s) => !s.done).length;
      const projectHours = remainingSubtasks * 3;
      if (projectHours > 0) items.push({ title: current.name, courseName: "โครงงาน (Milestone ปัจจุบัน)", dueDate: current.dueDate, hours: projectHours, type: "project-milestone" });
    }
    const totalHours = items.reduce((s, i) => s + i.hours, 0);

    // เวลาว่างจริงในหน้าต่างเวลานี้ (ประมาณวันละ 16 ชม.ตื่น หักด้วยชั่วโมงเรียน/ภาระงานที่มีอยู่แล้ว ไม่นับเวลานอน/ส่วนตัว)
    let freeHoursInWindow = 0;
    for (let d = new Date(now); d <= windowEnd; d = TD.addDays(d, 1)) {
      const busy = dayEvents(teamId, TD.toISODate(d)).filter((e) => e.type !== "personal").reduce((s, e) => s + (e.hours || 0), 0);
      freeHoursInWindow += Math.max(0, 16 - busy);
    }

    // ชนกัน ถ้า (มี >=2 ชิ้นและรวม >=8 ชม.) หรือ (มีชิ้นเดียวแต่ใหญ่ >=6 ชม.) หรือ (งานรวมเกินเวลาว่างจริงที่มี)
    const hasCollision = items.length > 0 && (
      (items.length >= 2 && totalHours >= 8) ||
      items.some((i) => i.hours >= 6) ||
      totalHours > freeHoursInWindow
    );
    const suggestions = [];
    if (hasCollision) {
      suggestions.push("เลื่อนงานโครงงานบางส่วนมาเริ่มก่อน");
      suggestions.push("แบ่งงานใหญ่เป็นงานย่อยที่ใช้เวลาสั้นลง");
      suggestions.push("กระจายงานให้สมาชิกในทีมช่วยกันทำ");
      if (projectSoon) suggestions.push("ลดขอบเขตงานบางส่วน (ต้องให้อาจารย์อนุมัติก่อน)");
      suggestions.push("จองช่วงเวลาทำงานล่วงหน้าในปฏิทิน");
    }
    return { hasCollision, items, totalHours, freeHoursInWindow, windowHours: windowH, suggestions, projectSoon };
  }

  // ---------------------------------------------------------------------
  // Smart Free-Time Planner
  // ---------------------------------------------------------------------
  function confirmFreeTimeSlot(id) {
    const slot = STATE.freeTimeSuggestions.find((s) => s.id === id);
    if (!slot) return;
    slot.status = "confirmed";
    recordActivity(slot.teamId);
    recordMomentum(slot.teamId, "planned");
    awardPoints(slot.teamId, "plan_next_task", `plan-${id}`);
    commit();
  }
  function declineFreeTimeSlot(id) {
    const slot = STATE.freeTimeSuggestions.find((s) => s.id === id);
    if (!slot) return;
    slot.status = "declined";
    commit();
  }
  // แบ่งช่วงเวลาว่างออกเป็น 2 ครึ่งจริง (ไม่ใช่ "เวลาเริ่ม+1 ชม." แบบเดิม) — ปฏิเสธถ้าช่วงสั้นกว่า 60 นาที
  // เวลาไม่ถูกต้อง หรือครึ่งใดครึ่งหนึ่งที่แบ่งได้จะไปชนตารางเรียน/เวลาส่วนตัว
  function splitFreeTimeSlot(id) {
    const slot = STATE.freeTimeSuggestions.find((s) => s.id === id);
    if (!slot) return { ok: false, reason: "ไม่พบช่วงเวลานี้" };
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    const startMin = toMin(slot.start);
    const endMin = toMin(slot.end);
    if (endMin <= startMin || endMin - startMin < 60) {
      return { ok: false, reason: "ช่วงเวลานี้สั้นกว่า 60 นาที หรือเวลาสิ้นสุดไม่ถูกต้อง จึงแบ่งครึ่งให้ไม่ได้" };
    }
    const midMin = startMin + Math.floor((endMin - startMin) / 2);
    const mid = toHHMM(midMin);

    const dow = TD.toDate(slot.date).getDay();
    const busy = getSchedule(slot.teamId).filter((s) => s.dow === dow)
      .concat(getPersonalBlocks(slot.teamId).filter((s) => s.dow === dow))
      .map((b) => [toMin(b.start), toMin(b.end)])
      .filter(([s, e]) => e > s);
    const overlapsBusy = (s, e) => busy.some(([bs, be]) => s < be && e > bs);
    if (overlapsBusy(startMin, midMin) || overlapsBusy(midMin, endMin)) {
      return { ok: false, reason: "ช่วงเวลาที่แบ่งใหม่จะไปชนกับตารางเรียน/เวลาส่วนตัว จึงไม่แบ่งให้" };
    }

    slot.status = "split";
    STATE.freeTimeSuggestions.push({ id: uid("ft"), teamId: slot.teamId, date: slot.date, start: slot.start, end: mid, taskSuggestion: slot.taskSuggestion + " (ช่วงที่ 1)", reason: slot.reason, status: "confirmed" });
    STATE.freeTimeSuggestions.push({ id: uid("ft"), teamId: slot.teamId, date: slot.date, start: mid, end: slot.end, taskSuggestion: slot.taskSuggestion + " (ช่วงที่ 2)", reason: "แบ่งจากช่วงเดิมเพื่อให้ทำได้ง่ายขึ้น", status: "pending" });
    commit();
    return { ok: true };
  }
  function rescheduleFreeTimeSlot(id, date, start, end) {
    const slot = STATE.freeTimeSuggestions.find((s) => s.id === id);
    slot.date = date; slot.start = start; slot.end = end; slot.status = "pending";
    commit();
  }
  function addFreeTimeSuggestion(teamId, date, start, end, taskSuggestion, reason) {
    const slot = { id: uid("ft"), teamId, date, start, end, taskSuggestion, reason, status: "pending" };
    STATE.freeTimeSuggestions.push(slot);
    commit();
    return slot;
  }

  // ---------------------------------------------------------------------
  // Team Workload
  // ---------------------------------------------------------------------
  function teamWorkload(teamId) {
    const members = getStudentsByTeam(teamId);
    const ms = getMilestones(teamId);
    const allSubtasks = ms.flatMap((m) => m.subtasks.map((s) => ({ ...s, milestoneId: m.id, milestoneName: m.name, milestoneDue: m.dueDate })));
    // ไม่นับรายการ checklist ที่ถูกแปลงเป็นงานย่อยแล้ว (convertedToSubtaskId) — งานเดียวกันถูกนับผ่านงานย่อยแทน ไม่ให้ซ้ำสองที่
    const fbChecklist = getFeedbacksByTeam(teamId).flatMap((f) => f.checklist.filter((c) => !c.convertedToSubtaskId).map((c) => ({ ...c, source: "feedback", feedbackId: f.id })));

    const perMember = members.map((mem) => {
      const own = allSubtasks.filter((s) => s.assigneeId === mem.id);
      const ownFb = fbChecklist.filter((c) => c.assigneeId === mem.id);
      const done = own.filter((s) => s.done).length + ownFb.filter((c) => c.done).length;
      const total = own.length + ownFb.length;
      const overdue = ownFb.filter((c) => !c.done && c.dueDate && TD.diffDays(c.dueDate, new Date()) < 0).length;
      const hours = ownFb.filter((c) => !c.done).reduce((s, c) => s + (c.hours || 0), 0) + own.filter((s) => !s.done).length * 3;
      return { student: mem, totalTasks: total, done, overdue, hoursEstimate: hours };
    });

    const unassigned = [
      ...allSubtasks.filter((s) => !s.assigneeId && !s.done),
      ...fbChecklist.filter((c) => !c.assigneeId && !c.done),
    ];

    const hoursList = perMember.map((p) => p.hoursEstimate);
    const maxH = Math.max(1, ...hoursList);
    const minH = Math.min(...hoursList);
    const imbalance = maxH > 0 && minH >= 0 && maxH >= (minH * 2 + 4);

    return { members: perMember, unassigned, imbalance };
  }

  // ---------------------------------------------------------------------
  // งานค้างทั้งหมดของทีม (subtask ของ milestone + checklist จาก feedback) — ใช้ร่วมกันหลายหน้า
  // ---------------------------------------------------------------------
  function getPendingWork(teamId) {
    const ms = getMilestones(teamId);
    const subtasks = ms.flatMap((m) => m.subtasks.filter((s) => !s.done).map((s) => ({ ...s, milestoneId: m.id, milestoneName: m.name, dueDate: m.dueDate, source: "milestone" })));
    const checklist = getFeedbacksByTeam(teamId).flatMap((f) => f.checklist.filter((c) => !c.done && !c.convertedToSubtaskId).map((c) => ({ ...c, milestoneId: f.milestoneId, feedbackId: f.id, source: "feedback" })));
    return { subtasks, checklist, all: [...checklist, ...subtasks] };
  }

  // ---------------------------------------------------------------------
  // Gamification: Project Pulse (ชีพจร), Streak, Badges
  // ใช้เพื่อสร้างแรงจูงใจในการทำงานต่อเนื่องเท่านั้น — ไม่มีผลต่อคะแนน/การประเมินผลทางวิชาการใด ๆ
  // ---------------------------------------------------------------------
  function recordActivity(teamId) {
    const team = getTeam(teamId);
    const todayISO = TD.toISODate(new Date());
    if (team.lastActivityDate === todayISO) return; // มีกิจกรรมของวันนี้แล้ว ไม่ต้องคำนวณซ้ำ
    const gapDays = TD.diffDays(todayISO, team.lastActivityDate);
    if (gapDays === 1) {
      team.streakDays = (team.streakDays || 0) + 1;
    } else if (gapDays > 1) {
      if (team.streakDays > 0) {
        pushNotification({
          audience: "student", teamId, type: "pulse_drop", severity: "warn",
          title: "กลับมาสร้างจังหวะกันต่อ",
          message: `ทีมหยุดอัปเดตงานไป ${gapDays - 1} วัน — ไม่เป็นไร เริ่มใหม่จากงานเล็ก ๆ ได้เสมอ วันนี้ลองทำสัก 1 อย่างเพื่อกลับเข้าจังหวะกัน`,
        });
      }
      team.streakDays = 1;
    } else {
      team.streakDays = Math.max(1, team.streakDays || 0);
    }
    team.lastActivityDate = todayISO;
    team.inactivityDays = 0; // มีความเคลื่อนไหวจริงแล้ว ณ วันนี้
    commit();
  }

  function getPulseState(teamId) {
    const team = getTeam(teamId);
    const health = computeHealthScore(teamId);
    return { rhythm: health.level, score: health.score, level: health.level, reasons: health.reasons, streakDays: team.streakDays || 0, lastActivityDate: team.lastActivityDate };
  }

  // ตราความสำเร็จ — เป็นรางวัลด้านพฤติกรรมเท่านั้น ห้ามสื่อว่าผลงานมีคุณภาพหรือผ่านการประเมินแล้ว
  // (การอนุมัติ/ตัดสินคุณภาพผลงานเป็นอำนาจของอาจารย์เท่านั้น ไม่เกี่ยวกับตราเหล่านี้)
  const BADGE_DEFS = [
    { key: "started_early", icon: "🚀", label: "เริ่มก่อน", test: (teamId) => {
        const current = getCurrentMilestone(teamId);
        if (current.status === "not_started" || !current.history.length) return false;
        const totalSpan = TD.diffDays(current.dueDate, current.startDate);
        const daysLeftAtStart = TD.diffDays(current.dueDate, current.history[0].date);
        return totalSpan > 0 && daysLeftAtStart > totalSpan / 2;
      } },
    { key: "on_time_submit", icon: "🎯", label: "ส่งตรงจังหวะ", test: (teamId) => getMilestones(teamId).some((m) => ["passed", "done"].includes(m.status) && m.completedDate && m.completedDate <= m.dueDate) },
    { key: "kept_rhythm", icon: "📅", label: "รักษาจังหวะ", test: (teamId) => weeklyMomentumSummary(teamId).hasThreeWeekMomentum },
    { key: "addressed_all_feedback", icon: "✅", label: "แก้ครบตามรายการ", test: (teamId) => getFeedbacksByTeam(teamId).some((f) => f.checklist.length && f.checklist.every((c) => c.done)) },
    { key: "waited_with_plan", icon: "🧭", label: "รออย่างมีแผน", test: (teamId) => {
        const wt = STATE.waitingTasks && STATE.waitingTasks[teamId];
        return !!(wt && wt.items.filter((i) => i.done).length >= 2);
      } },
    { key: "back_on_track", icon: "💓", label: "กลับมาเข้าจังหวะ", test: (teamId) => ["red", "yellow"].includes(getTeam(teamId).health) && ["strong", "steady"].includes(computeHealthScore(teamId).level) },
  ];
  function getBadges(teamId) {
    return BADGE_DEFS.filter((b) => b.test(teamId)).map((b) => ({ key: b.key, icon: b.icon, label: b.label }));
  }
  // รายการตราทั้งหมด (รวมที่ยังไม่ปลดล็อก) — ใช้ในหน้า "ตราความสำเร็จของฉัน"
  function getAllBadges(teamId) {
    return BADGE_DEFS.map((b) => ({ key: b.key, icon: b.icon, label: b.label, earned: b.test(teamId) }));
  }

  // ---------------------------------------------------------------------
  // พลังชีพจร (Pulse Power Points) — ให้คะแนนจากพฤติกรรมที่นิสิตควบคุมได้เท่านั้น
  // ห้ามหักคะแนนเพราะอาจารย์ตรวจช้า ห้ามให้คะแนนซ้ำจากภารกิจเดิม (ป้องกันด้วย idempotency key ต่อ event)
  // ไม่เกี่ยวข้องกับคะแนนรายวิชา และห้ามใช้เป็นตัวแทนคุณภาพผลงาน
  // ---------------------------------------------------------------------
  const POINT_VALUES = {
    plan_next_task: 10,
    complete_planned_task: 15,
    submit_on_time: 25,
    feedback_addressed_complete: 15,
    waiting_task_done: 10,
    weekly_checkin: 10,
    flag_issue_early: 10,
    team_collaboration: 10,
  };
  function awardPoints(teamId, type, eventKey) {
    STATE.pulsePoints = STATE.pulsePoints || {};
    const bucket = STATE.pulsePoints[teamId] || (STATE.pulsePoints[teamId] = { total: 0, events: [] });
    if (bucket.events.some((e) => e.key === eventKey)) return null; // กันรับคะแนนซ้ำจาก event เดิม
    const points = POINT_VALUES[type] || 0;
    bucket.events.push({ key: eventKey, type, points, at: new Date().toISOString() });
    bucket.total += points;
    commit();
    return points;
  }
  function getPulsePoints(teamId) {
    STATE.pulsePoints = STATE.pulsePoints || {};
    const bucket = STATE.pulsePoints[teamId] || { total: 0, events: [] };
    return { total: bucket.total, events: bucket.events.slice().sort((a, b) => new Date(b.at) - new Date(a.at)) };
  }

  // ---------------------------------------------------------------------
  // แรงส่งประจำสัปดาห์ (Weekly Momentum) — ใช้แทน Daily Streak เพราะนิสิตอาจต้องรออาจารย์
  // หรือมีตารางเรียนไม่เหมือนกัน จึงนับความเคลื่อนไหวเป็นราย "สัปดาห์" แทนรายวัน
  // ---------------------------------------------------------------------
  const MOMENTUM_CATEGORIES = {
    planned: "วางแผนแล้ว",
    worked: "ลงมือทำแล้ว",
    submitted: "ส่งงานแล้ว",
    feedbackAddressed: "ตอบรับข้อเสนอแนะแล้ว",
    waitingTaskDone: "เตรียมงานระหว่างรอแล้ว",
  };
  function isoWeekKey(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  function recordMomentum(teamId, kind) {
    STATE.weeklyMomentum = STATE.weeklyMomentum || {};
    const bucket = STATE.weeklyMomentum[teamId] || (STATE.weeklyMomentum[teamId] = {});
    const key = isoWeekKey(new Date());
    const week = bucket[key] || (bucket[key] = {});
    week[kind] = true;
    commit();
  }

  // ให้พลังชีพจร "ช่วยกันทำงาน" เมื่อมีสมาชิกมากกว่า 1 คนช่วยกันทำงานย่อยเสร็จในสัปดาห์เดียวกัน (ไม่ใช่แค่คนเดียวทำทั้งหมด)
  function recordCollaboration(teamId, assigneeId) {
    if (!assigneeId) return;
    STATE.weeklyCollabDoneBy = STATE.weeklyCollabDoneBy || {};
    const bucket = STATE.weeklyCollabDoneBy[teamId] || (STATE.weeklyCollabDoneBy[teamId] = {});
    const key = isoWeekKey(new Date());
    const list = bucket[key] || (bucket[key] = []);
    if (!list.includes(assigneeId)) list.push(assigneeId);
    if (list.length >= 2) awardPoints(teamId, "team_collaboration", `collab-${teamId}-${key}`);
  }
  function weeklyMomentumSummary(teamId, weeksBack) {
    STATE.weeklyMomentum = STATE.weeklyMomentum || {};
    const bucket = STATE.weeklyMomentum[teamId] || {};
    const n = weeksBack || 6;
    const now = new Date();
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = TD.addDays(now, -7 * i);
      const key = isoWeekKey(d);
      const flags = bucket[key] || {};
      weeks.push({ key, flags, activeCount: Object.keys(MOMENTUM_CATEGORIES).filter((k) => flags[k]).length });
    }
    // "รักษาจังหวะ" — มีความเคลื่อนไหวต่อเนื่อง 3 สัปดาห์ล่าสุด (แต่ละสัปดาห์มีกิจกรรมอย่างน้อย 1 อย่าง)
    const lastThree = weeks.slice(-3);
    const hasThreeWeekMomentum = lastThree.length === 3 && lastThree.every((w) => w.activeCount > 0);
    return { weeks, categories: MOMENTUM_CATEGORIES, hasThreeWeekMomentum };
  }

  // ---------------------------------------------------------------------
  // ภารกิจระหว่างรอ (Waiting Tasks) — งานที่ทำได้ขณะรออาจารย์ตรวจ มีสถานะเสร็จ/ไม่เสร็จจริงต่อทีม
  // ---------------------------------------------------------------------
  function getWaitingTasks(teamId) {
    STATE.waitingTasks = STATE.waitingTasks || {};
    const milestone = getCurrentMilestone(teamId);
    let list = STATE.waitingTasks[teamId];
    if (!list || list.milestoneKey !== milestone.key) {
      const lib = STATE.nextBestTaskLib[milestone.key] || [];
      list = { milestoneKey: milestone.key, items: lib.slice(0, 4).map((title) => ({ id: uid("wt"), title, done: false })) };
      STATE.waitingTasks[teamId] = list;
      commit();
    }
    return list.items;
  }
  function completeWaitingTask(teamId, waitingTaskId) {
    const list = STATE.waitingTasks && STATE.waitingTasks[teamId];
    if (!list) return;
    const item = list.items.find((i) => i.id === waitingTaskId);
    if (!item || item.done) return;
    item.done = true;
    recordActivity(teamId);
    recordMomentum(teamId, "waitingTaskDone");
    awardPoints(teamId, "waiting_task_done", `waiting-${waitingTaskId}`);
    commit();
  }

  // ---------------------------------------------------------------------
  // "จัดเวลาให้ฉัน" — เสนอช่วงเวลาว่างจริงให้ตามตารางเรียน/ภาระงาน นิสิตเป็นผู้ยืนยันเวลาเอง
  // (การยืนยันจริงเกิดที่ confirmFreeTimeSlot ซึ่งเป็นจุดที่ได้คะแนน "วางแผนภารกิจถัดไป")
  // ---------------------------------------------------------------------
  function planNextTask(teamId) {
    const pendingSlots = getFreeTimeSuggestions(teamId).filter((s) => s.status === "pending");
    if (pendingSlots.length) return pendingSlots;
    const windows = computeFreeWindowsToday(teamId);
    const hero = getHeroTask(teamId);
    const suggestionTitle = hero ? hero.title : "ทำงานโครงงานต่อ";
    const created = [];
    windows.slice(0, 2).forEach((w) => {
      created.push(addFreeTimeSuggestion(teamId, TD.toISODate(new Date()), w.start, w.end, suggestionTitle, "ระบบจัดเวลาให้ตามช่วงว่างจริงและภารกิจถัดไปที่แนะนำ"));
    });
    if (!created.length) {
      const tomorrow = TD.addDays(new Date(), 1);
      created.push(addFreeTimeSuggestion(teamId, TD.toISODate(tomorrow), "09:00", "10:30", suggestionTitle, "วันนี้ตารางแน่น ระบบจึงเสนอช่วงเช้าวันถัดไปแทน"));
    }
    return created;
  }

  // ---------------------------------------------------------------------
  // แผนกู้จังหวะ (Recovery) — ขอคำปรึกษาจากอาจารย์ (ไม่ตำหนินิสิต)
  // ---------------------------------------------------------------------
  function requestConsultation(teamId, message) {
    const team = getTeam(teamId);
    pushNotification({
      audience: "advisor", advisorId: team.advisorId, teamId: team.id, type: "advisor_risk", severity: "warn",
      title: "นิสิตขอคำปรึกษา",
      message: `${team.name} ขอคำปรึกษา: ${message || "ต้องการคำแนะนำเพิ่มเติมในการดำเนินงาน"}`,
    });
  }

  function getBlockedReason(milestone) {
    if (!milestone || milestone.status !== "blocked") return null;
    // จับคู่ทั้งข้อความที่ flagBlocked() สร้างขึ้นจริง ("นิสิตแจ้งปัญหา:") และข้อความในข้อมูลตัวอย่าง ("ทีมแจ้งปัญหา:")
    // ไม่พึ่งพาลำดับของ history array (ข้อมูลตัวอย่างบางส่วนเรียงใหม่ก่อนเก่า) — เลือกรายการที่วันที่ล่าสุดเสมอ
    const matches = milestone.history.filter((h) => h.note && h.note.indexOf("แจ้งปัญหา:") >= 0);
    if (!matches.length) return null;
    const latest = matches.reduce((a, b) => (new Date(b.date) >= new Date(a.date) ? b : a));
    return latest.note.slice(latest.note.indexOf("แจ้งปัญหา:") + "แจ้งปัญหา:".length).trim();
  }

  // ข้อความหัวการ์ดตามสถานะชีพจร/การรอตรวจ — ใช้ให้ตรงกันทุกจุดที่แสดง Pulse Status Card
  function pulseStatusMessage(teamId) {
    const current = getCurrentMilestone(teamId);
    if (["submitted", "reviewing"].includes(current.status)) {
      return "งานอยู่ในคิวตรวจ ระหว่างรอคุณยังเตรียมขั้นตอนต่อไปได้";
    }
    const health = computeHealthScore(teamId);
    if (health.level === "strong") return "จังหวะดี ไปต่อภารกิจถัดไป";
    if (health.level === "steady") return "อยู่ในจังหวะที่ดี ทำต่อไปได้เลย";
    if (health.level === "weak") return "ชีพจรเริ่มแผ่ว เลือกงานเล็ก 1 งานให้เสร็จวันนี้";
    return "งานหลุดจากแผนแล้ว เริ่มแผนกู้จังหวะ 15 นาที";
  }

  // ---------------------------------------------------------------------
  // Hero Task — "สิ่งที่ควรทำวันนี้" งานเดียวที่สำคัญที่สุด (แทนที่จะโยนรายการยาว ๆ ให้)
  // ---------------------------------------------------------------------
  function getHeroTask(teamId) {
    const current = getCurrentMilestone(teamId);
    const pending = getPendingWork(teamId);
    const now = new Date();

    // 1) รายการแก้ไขจาก Feedback ที่ยังไม่เสร็จ มาก่อนเสมอถ้า Milestone อยู่ในสถานะต้องแก้ไข/รอข้อมูลเพิ่ม
    if (["revise", "need_info"].includes(current.status) && pending.checklist.length) {
      const item = pending.checklist.slice().sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"))[0];
      const daysLeft = item.dueDate ? TD.diffDays(item.dueDate, now) : null;
      let reason;
      if (daysLeft === null) reason = "เป็นรายการแก้ไขจาก Feedback ล่าสุดที่ยังไม่เสร็จ";
      else if (daysLeft < 0) reason = `เลยกำหนดมาแล้ว ${Math.abs(daysLeft)} วัน ควรรีบทำก่อนสิ่งอื่น`;
      else if (daysLeft === 0) reason = "แนะนำให้ทำวันนี้ เพราะครบกำหนดวันนี้";
      else reason = `แนะนำให้ทำวันนี้ เพราะต้องส่งใหม่ภายใน ${daysLeft} วัน`;
      return {
        title: item.title, milestoneName: current.name,
        estimatedMinutes: Math.round((item.hours || 1) * 60), reason,
        kind: "feedback", refId: item.id, feedbackId: item.feedbackId, milestoneId: current.id,
      };
    }

    // 2) งานย่อยของ Milestone ปัจจุบันที่ยังไม่เสร็จ
    const subtasks = pending.subtasks.filter((s) => s.milestoneId === current.id);
    if (subtasks.length) {
      const item = subtasks[0];
      const daysLeft = TD.diffDays(current.dueDate, now);
      return {
        title: item.title, milestoneName: current.name, estimatedMinutes: 60,
        reason: daysLeft <= 3 ? `เป็นงานย่อยของ Milestone ปัจจุบัน ใกล้ถึงกำหนดส่งแล้ว (อีก ${Math.max(daysLeft, 0)} วัน)` : "เป็นงานย่อยของ Milestone ปัจจุบันที่ยังไม่เสร็จ",
        kind: "milestone", refId: item.id, milestoneId: current.id,
      };
    }

    // 3) ถ้ากำลังรอผลตรวจ ให้แนะนำงานที่ทำต่อได้ระหว่างรอ (ไม่ต้องนั่งรอเฉย ๆ)
    if (["submitted", "reviewing"].includes(current.status)) {
      const tasks = nextBestTasks(teamId);
      if (tasks.length) {
        return {
          title: tasks[0], milestoneName: current.name, estimatedMinutes: 45,
          reason: "ระหว่างรอ Feedback จากอาจารย์ ยังทำสิ่งนี้ต่อไปพลางก่อนได้ ไม่จำเป็นต้องหยุดรอเฉย ๆ",
          kind: "waiting", milestoneId: current.id,
        };
      }
    }

    // 4) ยังไม่มีงานย่อยค้าง แต่ Milestone ยังไม่ผ่าน — แนะนำให้เริ่ม/ส่งงาน
    if (["not_started", "in_progress", "ready"].includes(current.status)) {
      const daysLeft = TD.diffDays(current.dueDate, now);
      return {
        title: current.status === "ready" ? `ส่งงาน Milestone: ${current.name}` : `เริ่ม/ทำต่อ Milestone: ${current.name}`,
        milestoneName: current.name, estimatedMinutes: 90,
        reason: `กำหนดส่ง Milestone นี้อีก ${Math.max(daysLeft, 0)} วัน เตรียมให้ทันเวลา`,
        kind: "milestone-main", milestoneId: current.id,
      };
    }

    return null; // ไม่มีงานค้าง (เช่น ผ่าน Milestone ล่าสุดไปแล้วและยังไม่เริ่มตัวถัดไป)
  }

  function flagBlocked(milestoneId, reason) {
    const m = getMilestone(milestoneId);
    const wasAlreadyBlocked = m.status === "blocked";
    setMilestoneStatus(milestoneId, "blocked", `นิสิตแจ้งปัญหา: ${reason}`);
    const team = getTeam(m.teamId);
    pushNotification({
      audience: "advisor", advisorId: team.advisorId, teamId: team.id, type: "advisor_risk", severity: "red",
      title: "นิสิตแจ้งปัญหาในโครงงาน",
      message: `${team.name} แจ้งปัญหาใน Milestone "${m.name}": ${reason}`,
    });
    // ให้พลังชีพจรสำหรับการแจ้งปัญหาแต่เนิ่น ๆ (ไม่ปล่อยให้ค้างเงียบ ๆ) — ให้ครั้งเดียวต่อวันต่อ Milestone ไม่ซ้ำจากการแจ้งซ้ำในวันเดียวกัน
    if (!wasAlreadyBlocked) {
      awardPoints(team.id, "flag_issue_early", `flag-${milestoneId}-${TD.toISODate(new Date())}`);
    }
  }

  // ผู้รับผิดชอบ/ขั้นตอนถัดไป/กำหนด/ระยะเวลาที่อยู่ในสถานะนี้ — ใช้แสดงผลสม่ำเสมอทุกหน้า
  const STATUS_OWNER = {
    not_started: "นิสิต", in_progress: "นิสิต", ready: "นิสิต",
    submitted: "อาจารย์ที่ปรึกษา", reviewing: "อาจารย์ที่ปรึกษา",
    revise: "นิสิต", need_info: "นิสิต",
    passed: "-", blocked: "นิสิต (รอความช่วยเหลือ)", done: "-",
  };
  const STATUS_NEXT_STEP = {
    not_started: "เริ่มทำงานย่อยของ Milestone นี้",
    in_progress: "ทำงานย่อยที่เหลือให้ครบ แล้วส่งงาน",
    ready: "ส่งงานให้อาจารย์ที่ปรึกษาตรวจ",
    submitted: "รออาจารย์เริ่มตรวจงาน",
    reviewing: "รอผล Feedback จากอาจารย์",
    revise: "แก้ไขตามรายการ Feedback แล้วส่งใหม่",
    need_info: "ส่งข้อมูลเพิ่มเติมตามที่อาจารย์ขอ",
    passed: "ไปต่อ Milestone ถัดไปได้เลย",
    blocked: "ระบุสิ่งที่ต้องการความช่วยเหลือ แล้วรอการตอบกลับ",
    done: "โครงงานเสร็จสมบูรณ์แล้ว",
  };
  function milestoneStatusDetail(milestone) {
    const lastDate = milestone.history.length ? milestone.history[milestone.history.length - 1].date : milestone.startDate;
    return {
      owner: STATUS_OWNER[milestone.status] || "-",
      nextStep: STATUS_NEXT_STEP[milestone.status] || "",
      dueBy: milestone.dueDate,
      daysInStatus: Math.max(0, TD.diffDays(new Date(), lastDate)),
    };
  }

  // ---------------------------------------------------------------------
  // เส้นทางโครงการ (Project Journey Map) — จัดกลุ่ม Milestone เดิม 10 รายการเข้า 6 ระยะ
  // เป็นเพียงมุมมองจัดกลุ่มเพื่อแสดงผล ไม่ได้เปลี่ยนโครงสร้าง Milestone/สถานะเดิมแต่อย่างใด
  // และไม่ปลดล็อก/อนุมัติระยะถัดไปแทนอาจารย์ — การอนุมัติแต่ละ Milestone ยังเป็นของอาจารย์เท่านั้น
  // ---------------------------------------------------------------------
  const PHASE_DEFS = [
    { key: "research", name: "Research", milestoneKeys: ["topic_approval", "concept"] },
    { key: "planning", name: "Storyboard / Planning", milestoneKeys: ["proposal", "tools_prep"] },
    { key: "prototype", name: "Prototype", milestoneKeys: ["produce"] },
    { key: "production", name: "Production", milestoneKeys: ["edit"] },
    { key: "testing", name: "Testing", milestoneKeys: ["qc", "revise_feedback"] },
    { key: "presentation", name: "Presentation", milestoneKeys: ["final_submit", "present_prep"] },
  ];
  function phaseForMilestoneKey(key) {
    return PHASE_DEFS.find((p) => p.milestoneKeys.includes(key)) || null;
  }
  function getCurrentPhaseName(teamId) {
    const current = getCurrentMilestone(teamId);
    const phase = phaseForMilestoneKey(current.key);
    return phase ? phase.name : current.name;
  }
  function getProjectPhases(teamId) {
    const ms = getMilestones(teamId);
    const feedbacks = getFeedbacksByTeam(teamId);
    return PHASE_DEFS.map((p) => {
      const phaseMilestones = ms.filter((m) => p.milestoneKeys.includes(m.key));
      const completed = phaseMilestones.filter((m) => ["passed", "done"].includes(m.status)).length;
      const feedbackToFix = phaseMilestones.flatMap((m) => feedbacks.filter((f) => f.milestoneId === m.id && !f.confirmedAt));
      return {
        key: p.key, name: p.name, milestones: phaseMilestones,
        completedCount: completed, remainingCount: phaseMilestones.length - completed,
        dueDate: phaseMilestones.length ? phaseMilestones[phaseMilestones.length - 1].dueDate : null,
        feedbackToFixCount: feedbackToFix.length,
      };
    });
  }

  // ---------------------------------------------------------------------
  // หลักฐานความคืบหน้าระหว่าง Milestone (แยกจากการ "ส่งงานจริง" เต็มรูปแบบ)
  // ---------------------------------------------------------------------
  function addProgressEvidence(milestoneId, { type, value, note }) {
    const m = getMilestone(milestoneId);
    if (!m) return;
    m.evidence = m.evidence || [];
    const ev = { id: uid("ev"), type: type || "note", value: value || "", note: note || "", createdAt: new Date().toISOString() };
    m.evidence.push(ev);
    m.history.push({ date: TD.toISODate(new Date()), note: `ส่งหลักฐานความคืบหน้า: ${note || value || "(ไม่มีคำอธิบาย)"}` });
    recordActivity(m.teamId);
    commit();
    return ev;
  }

  // ---------------------------------------------------------------------
  // Weekly Check-in — แบบสอบถามสั้น ๆ ไม่เกิน 1 นาทีต่อสัปดาห์
  // ---------------------------------------------------------------------
  function submitWeeklyCheckin(teamId, { accomplished, nextPlan, blockers, needsHelp }) {
    STATE.checkins = STATE.checkins || [];
    const c = {
      id: uid("ci"), teamId, createdAt: new Date().toISOString(),
      accomplished: accomplished || "", nextPlan: nextPlan || "", blockers: blockers || "", needsHelp: needsHelp || "",
    };
    STATE.checkins.push(c);
    recordActivity(teamId);
    awardPoints(teamId, "weekly_checkin", `checkin-${isoWeekKey(new Date())}`);
    commit();
    return c;
  }
  function getCheckins(teamId) {
    return (STATE.checkins || []).filter((c) => c.teamId === teamId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  function latestCheckinThisWeek(teamId) {
    const list = getCheckins(teamId);
    if (!list.length) return null;
    return TD.diffDays(new Date(), list[0].createdAt) < 7 ? list[0] : null;
  }

  // ---------------------------------------------------------------------
  // เวลาส่วนตัวรายบุคคล (เวลานอน/ช่วงห้ามแจ้งเตือน/ช่วงที่สะดวกทำงาน) — เก็บตาม studentId ไม่ใช่ teamId
  // เพราะสมาชิกแต่ละคนในทีมมีเวลาส่วนตัวต่างกัน ถ้ายังไม่มีใครตั้งค่า จะ fallback ไปใช้ personalBlocks ของทีม (ข้อมูลจำลอง)
  // ---------------------------------------------------------------------
  const DEFAULT_PERSONAL_PREFS = { sleepStart: "23:00", sleepEnd: "07:00", quietHoursStart: "22:00", quietHoursEnd: "07:00", preferredWorkStart: "18:00", preferredWorkEnd: "22:00" };
  function getPersonalPrefs(studentId) {
    return (STATE.personalPrefs && STATE.personalPrefs[studentId]) || null;
  }
  function updatePersonalPrefs(studentId, patch) {
    STATE.personalPrefs = STATE.personalPrefs || {};
    STATE.personalPrefs[studentId] = Object.assign({}, DEFAULT_PERSONAL_PREFS, STATE.personalPrefs[studentId], patch);
    commit();
  }

  // ---------------------------------------------------------------------
  // ช่วงเวลาว่างของ "วันนี้" คำนวณจริงจากตารางเรียน/เวลาส่วนตัว (ไม่ใช่แค่เดาจาก deadline)
  // studentId ไม่ระบุ = ใช้ของผู้ใช้ปัจจุบันถ้าอยู่ในทีมนี้ ไม่มีเวลาส่วนตัวที่ตั้งไว้ก็ใช้ personalBlocks ของทีมแทน
  // ---------------------------------------------------------------------
  function computeFreeWindowsToday(teamId, studentId) {
    const now = new Date();
    const dow = now.getDay();
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(((min % 60) + 60) % 60).padStart(2, "0")}`;
    const sid = studentId || (STATE.currentUser.teamId === teamId ? STATE.currentUser.studentId : null);
    const prefs = sid && getPersonalPrefs(sid);

    const rawBlocks = getSchedule(teamId).filter((s) => s.dow === dow).map((b) => [toMin(b.start), toMin(b.end)]);
    if (prefs) {
      rawBlocks.push([toMin(prefs.sleepStart), toMin(prefs.sleepEnd)]);
    } else {
      getPersonalBlocks(teamId).filter((s) => s.dow === dow).forEach((b) => rawBlocks.push([toMin(b.start), toMin(b.end)]));
    }

    // บล็อกที่ "เวลาสิ้นสุด <= เวลาเริ่ม" คือข้ามเที่ยงคืน (เช่น เวลานอน 23:00–07:00) — บนไทม์ไลน์ของวันนี้ ([0,1440) นาที)
    // บล็อกแบบนี้ต้องกินเวลา 2 ช่วง: ตอนเช้า (ที่ค้างมาจากคืนก่อน) และตอนดึก (ที่เริ่มคืนนี้) ไม่ใช่ถูกตัดออกไปเฉย ๆ
    const busy = rawBlocks
      .flatMap(([s, e]) => (e <= s ? [[0, e], [s, 1440]] : [[s, e]]))
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);

    const merged = [];
    busy.forEach(([s, e]) => {
      if (merged.length && s <= merged[merged.length - 1][1]) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
      else merged.push([s, e]);
    });

    const dayEndMin = 23 * 60;
    const nowMin = Math.max(now.getHours() * 60 + now.getMinutes(), 0);
    const gaps = [];
    let cursor = nowMin;
    merged.forEach(([s, e]) => {
      if (s > cursor) gaps.push([cursor, Math.min(s, dayEndMin)]);
      cursor = Math.max(cursor, e);
    });
    if (cursor < dayEndMin) gaps.push([cursor, dayEndMin]);

    const collision = detectDeadlineCollision(teamId);
    return gaps
      .filter(([s, e]) => e - s >= 30)
      .map(([s, e]) => ({
        start: toHHMM(s), end: toHHMM(e), minutes: e - s,
        isFree: !collision.hasCollision,
        label: collision.hasCollision ? "ช่วงที่พอทำงานโครงงานได้ (มีงานวิชาอื่นเร่งด่วนซ้อนอยู่ด้วย ควรแบ่งเวลาดี ๆ)" : "ว่างสำหรับทำโครงงาน",
      }));
  }

  // เวลาว่าง "ร่วมกันทั้งทีม" — ตัดกันของช่วงว่างส่วนตัวของสมาชิกทุกคน ต่างจากช่วงว่างของนิสิตคนเดียวข้างบน
  function computeTeamSharedFreeWindows(teamId) {
    const members = getStudentsByTeam(teamId);
    if (!members.length) return [];
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(((min % 60) + 60) % 60).padStart(2, "0")}`;
    const perMember = members.map((m) => computeFreeWindowsToday(teamId, m.id).map((w) => [toMin(w.start), toMin(w.end)]));
    let shared = perMember[0] || [];
    for (let i = 1; i < perMember.length; i++) {
      const next = [];
      shared.forEach(([s1, e1]) => {
        perMember[i].forEach(([s2, e2]) => {
          const s = Math.max(s1, s2), e = Math.min(e1, e2);
          if (e - s >= 30) next.push([s, e]);
        });
      });
      shared = next;
    }
    return shared.map(([s, e]) => ({ start: toHHMM(s), end: toHHMM(e), minutes: e - s }));
  }

  // ทีมที่ติดปัญหาอยู่ตอนนี้ (Milestone ปัจจุบันสถานะ blocked) — แยกจากคิวตรวจงานปกติที่เรียงตาม priority
  // เพื่อให้อาจารย์เห็นทีมที่ "รอความช่วยเหลือ" ได้ชัดเจน ไม่ปนกับคิวที่แค่รอตรวจตามปกติ
  function getBlockedTeams(advisorId) {
    return getTeamsByAdvisor(advisorId)
      .map((team) => {
        const current = getCurrentMilestone(team.id);
        if (!current || current.status !== "blocked") return null;
        return { team, milestone: current, reason: getBlockedReason(current), blockedSinceDays: Math.max(0, TD.diffDays(new Date(), current.history.length ? current.history[current.history.length - 1].date : current.startDate)) };
      })
      .filter(Boolean)
      .sort((a, b) => b.blockedSinceDays - a.blockedSinceDays);
  }

  // ---------------------------------------------------------------------
  // Risk Radar (อาจารย์) — ทุกทีมที่มีความเสี่ยง พร้อมเหตุผลที่มาของความเสี่ยงเสมอ
  // ---------------------------------------------------------------------
  function riskRadar(advisorId) {
    const teams = getTeamsByAdvisor(advisorId);
    const now = new Date();
    return teams.map((t) => {
      const health = computeHealthScore(t.id);
      const collision = detectDeadlineCollision(t.id);
      const current = getCurrentMilestone(t.id);
      const wl = teamWorkload(t.id);
      const reasons = [];
      if (t.inactivityDays >= 7) reasons.push(`ไม่มีการอัปเดตความก้าวหน้ามาแล้ว ${t.inactivityDays} วัน`);
      if (new Date(current.dueDate) < now && !["passed", "done"].includes(current.status)) {
        reasons.push(`พลาดกำหนดส่ง Milestone "${current.name}" (ครบกำหนด ${TD.toISODate(current.dueDate)})`);
      }
      if (collision.hasCollision) reasons.push(`มีกำหนดส่งชนกับงานวิชาอื่น ${collision.items.length} รายการภายใน ${collision.windowHours} ชม.`);
      const sub = getSubmissionsByTeam(t.id).find((s) => ["submitted", "reviewing"].includes(s.status));
      if (sub) {
        const waitDays = TD.diffDays(now, sub.submittedAt);
        if (waitDays >= STATE.courseSettings.feedbackSlaDays) reasons.push(`รอ Feedback นานเกินกรอบเวลา (${waitDays} วัน)`);
      }
      if (wl.members.some((m) => m.overdue > 0)) reasons.push("มีสมาชิกที่งานเลยกำหนดหลายรายการ (อาจประเมินชั่วโมงงานต่ำกว่าจริง)");
      return { team: t, health, reasons };
    }).filter((r) => r.reasons.length > 0).sort((a, b) => a.health.score - b.health.score);
  }

  // ---------------------------------------------------------------------
  // Advisor Workload — ภาพรวมภาระงานตรวจของอาจารย์เอง (ไม่ใช้ Gamification/Leaderboard)
  // ---------------------------------------------------------------------
  function advisorWorkloadSummary(advisorId) {
    const queue = feedbackQueue(advisorId);
    const avgAgeDays = queue.length ? Math.round((queue.reduce((s, r) => s + r.waitDays, 0) / queue.length) * 10) / 10 : 0;
    const overdueCount = queue.filter((r) => r.urgency === "เกินกำหนด").length;
    return { pendingCount: queue.length, avgAgeDays, overdueCount, topRecommended: queue.slice(0, 3) };
  }

  // ---------------------------------------------------------------------
  // Semester Workload Map — รวมเหตุการณ์ทั้งหมดต่อวัน
  // ---------------------------------------------------------------------
  function dayEvents(teamId, dateISO) {
    const d = TD.toDate(dateISO);
    const dow = d.getDay();
    const events = [];
    getSchedule(teamId).filter((s) => s.dow === dow).forEach((s) => events.push({ type: "class", title: s.title, start: s.start, end: s.end, hours: hoursBetween(s.start, s.end) }));
    getPersonalBlocks(teamId).filter((s) => s.dow === dow).forEach((s) => events.push({ type: "personal", title: s.title, start: s.start, end: s.end, hours: hoursBetween(s.start, s.end) }));
    getOtherCourseTasks(teamId).filter((t) => TD.toISODate(t.dueDate) === dateISO).forEach((t) => events.push({ type: "other-course", title: `กำหนดส่ง: ${t.title}`, hours: t.hoursEstimate, meta: t.courseName }));
    getMilestones(teamId).filter((m) => m.dueDate === dateISO).forEach((m) => events.push({ type: "milestone", title: `กำหนดส่ง Milestone: ${m.name}`, hours: 0, meta: m.name }));
    getFreeTimeSuggestions(teamId).filter((f) => f.date === dateISO && f.status === "confirmed").forEach((f) => events.push({ type: "project", title: f.taskSuggestion, start: f.start, end: f.end, hours: hoursBetween(f.start, f.end) }));
    return events;
  }
  function hoursBetween(start, end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let h = (eh + em / 60) - (sh + sm / 60);
    if (h < 0) h += 24;
    return Math.round(h * 10) / 10;
  }
  function dayLoadLevel(teamId, dateISO) {
    // ไม่นับเวลานอน/เวลาส่วนตัวเป็น "ภาระงาน" — heatmap ต้องสะท้อนงานจริง (เรียน/วิชาอื่น/โครงงาน) เท่านั้น
    const events = dayEvents(teamId, dateISO).filter((e) => e.type !== "personal");
    const totalHours = events.reduce((s, e) => s + (e.hours || 0), 0);
    if (totalHours >= 8) return "high";
    if (totalHours >= 4) return "mid";
    return "low";
  }

  // ---------------------------------------------------------------------
  // Weekly report / metrics ต่อทีมและภาพรวม
  // ---------------------------------------------------------------------
  function weeklyReport(teamId) {
    const ms = getMilestones(teamId);
    const done = ms.filter((m) => ["passed", "done"].includes(m.status));
    const onTimeDone = done.filter((m) => m.completedDate && m.completedDate <= m.dueDate);
    const health = computeHealthScore(teamId);
    return {
      teamId,
      milestonesCompletedPct: Math.round((done.length / ms.length) * 100),
      onTimePct: done.length ? Math.round((onTimeDone.length / done.length) * 100) : 100,
      health,
      currentMilestone: getCurrentMilestone(teamId),
    };
  }
  function overallExperimentMetrics() {
    const teams = getTeams();
    const perTeam = teams.map((t) => weeklyReport(t.id));
    const avgCompleted = Math.round(perTeam.reduce((s, r) => s + r.milestonesCompletedPct, 0) / perTeam.length);
    const avgOnTime = Math.round(perTeam.reduce((s, r) => s + r.onTimePct, 0) / perTeam.length);
    const waits = STATE.submissions.filter((s) => s.reviewedAt).map((s) => TD.diffDays(s.reviewedAt, s.submittedAt));
    const avgFeedbackWait = waits.length ? Math.round((waits.reduce((a, b) => a + b, 0) / waits.length) * 10) / 10 : 0;
    const completionRate = Math.round((teams.filter((t) => getMilestones(t.id).every((m) => ["passed", "done"].includes(m.status))).length / teams.length) * 100);
    const overdueFeedbackCount = STATE.submissions.filter((s) => ["submitted", "reviewing"].includes(s.status) && TD.diffDays(new Date(), s.submittedAt) > STATE.courseSettings.feedbackSlaDays).length;
    const recoveredCount = teams.filter((t) => ["red", "yellow"].includes(t.health) && ["strong", "steady"].includes(computeHealthScore(t.id).level)).length;
    return {
      teamsCount: teams.length,
      avgMilestonesCompletedPct: avgCompleted,
      avgOnTimePct: avgOnTime,
      avgFeedbackWaitDays: avgFeedbackWait,
      completionRate, overdueFeedbackCount, recoveredCount,
      targets: { milestoneCompletion: 70, onTime: 80, feedbackWaitMax: 7, cycleWeeksTarget: 13, cycleWeeksBaseline: 16 },
      perTeam,
    };
  }

  global.PP = {
    getState, commit, resetDemoData, uid,
    getCurrentUser, setRole, setCurrentTeam, setCurrentAdvisor,
    getCourse, getCourseSettings, updateCourseSettings, getNotificationPrefs, updateNotificationPrefs,
    getAdvisors, getAdvisor, getTeams, getTeam, getTeamsByAdvisor,
    getStudentsByTeam, getStudent,
    createTeam, updateTeamInfo, addTeamMember, removeTeamMember, updateStudent,
    requestAdvisorChange, respondAdvisorChangeRequest, getPendingAdvisorChangeRequests,
    getMilestoneDefs, getMilestones, getMilestone, getCurrentMilestone, statusMeta, getPendingWork, computeProgressPct,
    getSubmission, getSubmissionsByTeam, getFeedback, getFeedbackBySubmission, getFeedbacksByTeam,
    getOtherCourseTasks, addOtherCourseTask, removeOtherCourseTask, getSchedule, addScheduleBlock, removeScheduleBlock, getPersonalBlocks, getFreeTimeSuggestions,
    getNotificationsFor, unreadCount, markNotificationRead, markAllRead, pushNotification,
    setMilestoneStatus, toggleSubtask, addSubtask, addAttachment,
    submitMilestone, startReview, requestMoreInfo, giveFeedback, draftChecklistFromText,
    updateChecklistItem, confirmChecklist,
    feedbackQueue, nextBestTasks, computeHealthScore, detectDeadlineCollision,
    confirmFreeTimeSlot, declineFreeTimeSlot, splitFreeTimeSlot, rescheduleFreeTimeSlot, addFreeTimeSuggestion,
    teamWorkload, dayEvents, dayLoadLevel, hoursBetween,
    weeklyReport, overallExperimentMetrics,
    recordActivity, getPulseState, getBadges, getAllBadges,
    overrideQueueOrder, clearQueueOverride, setExpectedReviewDate, myQueuePosition, getPreviousFeedbackForSubmission,
    getBlockedTeams,
    getHeroTask, flagBlocked, milestoneStatusDetail,
    addProgressEvidence, submitWeeklyCheckin, getCheckins, latestCheckinThisWeek,
    computeFreeWindowsToday, computeTeamSharedFreeWindows, getPersonalPrefs, updatePersonalPrefs, riskRadar, advisorWorkloadSummary,
    getPulsePoints, weeklyMomentumSummary, getWaitingTasks, completeWaitingTask,
    planNextTask, requestConsultation, getBlockedReason, pulseStatusMessage,
    getCurrentPhaseName, getProjectPhases,
  };
})(window);
