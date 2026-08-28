# ProjectPulse — Data Model & Shared API Reference

อ่านไฟล์นี้ก่อนเริ่มเขียนหน้าใหม่เสมอ ทุกหน้าใช้ชั้นข้อมูลเดียวกันนี้ — **ห้ามแก้ไข**
`assets/js/store.js`, `assets/js/seed-data.js`, `assets/js/nav.js`, `assets/js/thai-date.js`,
หรือ `assets/css/style.css` เว้นแต่พบบั๊กจริงที่บล็อกงานของคุณ (ถ้าจำเป็นให้เพิ่มฟังก์ชันใหม่
ต่อท้ายเท่านั้น อย่าลบ/แก้ของเดิม เพราะหน้าอื่นพึ่งพาอยู่)

## โครงสร้างไฟล์ของหน้าใหม่ 1 หน้า (รูปแบบบังคับ)

ดูตัวอย่างจริงที่ `pages/student-dashboard.html` + `assets/js/dashboard-student.js` — ให้ก็อปโครงนี้ไปดัดแปลง

```html
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ชื่อหน้า — ProjectPulse</title>
<link rel="stylesheet" href="../assets/css/style.css" />
</head>
<body>
<a href="#pageContent" class="skip-link">ข้ามไปยังเนื้อหา</a>
<div class="app-shell" id="appShell">
  <div class="app-body" id="appBody">
    <main class="app-main">
      <div class="app-main__inner" id="pageContent">
        <!-- เนื้อหาเฉพาะหน้า: page-head + card ต่าง ๆ วาง container ว่างไว้ให้ JS เติมข้อมูล -->
      </div>
    </main>
  </div>
</div>
<script src="../assets/js/thai-date.js"></script>
<script src="../assets/js/seed-data.js"></script>
<script src="../assets/js/store.js"></script>
<script src="../assets/js/nav.js"></script>
<script>PPNav.mount("PAGE_KEY");</script>
<script src="../assets/js/PAGE_SPECIFIC.js"></script>
</body>
</html>
```

กฎสำคัญ:
- ไฟล์ HTML อยู่ใน `pages/*.html` เท่านั้น อ้างอิง asset ด้วย `../assets/...`
- ต้องโหลดสคริปต์ตามลำดับนี้เท่านั้น: `thai-date.js` → `seed-data.js` → `store.js` → `nav.js` (แล้วเรียก `PPNav.mount(...)`) → ไฟล์ JS เฉพาะหน้าของคุณ
- `PAGE_KEY` ที่ส่งให้ `PPNav.mount()` ต้องตรงกับ `key` ใน `STUDENT_NAV`/`ADVISOR_NAV` ใน `nav.js` (เช่น `"workload-map"`) เพื่อให้ sidebar ไฮไลต์เมนูถูกต้อง
- ทุกปุ่ม/ทุกฟอร์มต้องมี event handler จริง ห้ามมีปุ่มที่กดแล้วไม่มีอะไรเกิดขึ้น — ถ้าเป็น action ที่ยังไม่ได้ implement เต็มรูปแบบ ให้อย่างน้อย mutate state ผ่าน `PP.*` แล้วเรียก `PPToast.show(...)` และ re-render
- ใช้ `PPNav.escapeHtml(str)` ทุกครั้งที่แทรกข้อความจากข้อมูลลง `innerHTML` เพื่อกัน XSS
- แสดงผลวันที่ด้วย `ThaiDate.formatThaiDate/formatThaiDateTime/formatThaiShort` เสมอ (ห้ามใช้ `Date.toLocaleDateString` ตรง ๆ เพราะจะได้ปี ค.ศ.)
- Responsive: ใช้ class `grid`, `grid-2/3/4`, `grid-auto`, `col-span-2/3` ที่มีอยู่แล้วใน CSS (ยุบเป็น 1 คอลัมน์อัตโนมัติที่จอมือถือ) อย่าล็อกความกว้างเป็น px ตายตัว
- Pattern การ render: เขียนฟังก์ชัน `renderAll()` ที่ query ข้อมูลจาก `PP.*` แล้วสร้าง HTML string ใส่ container, ผูก event listener หลัง set `innerHTML` ทุกครั้ง, และหลัง mutation ใด ๆ ให้เรียก `renderAll()` ซ้ำ (ไม่ต้อง reload หน้า) พร้อม `PPToast.show(message, "success"|"warn"|"danger"|"info")`

## Global objects ที่มีให้ใช้

- `window.ThaiDate` — ยูทิลิตี้วันที่/พ.ศ.
- `window.PP` — ชั้นข้อมูล + ตรรกะธุรกิจ (localStorage-backed)
- `window.PPNav` — shell/nav (เรียก `.mount(key)` ครั้งเดียวต่อหน้า) + `escapeHtml`, `initials`
- `window.PPToast.show(message, type)` — type: `"success" | "warn" | "danger" | "info"`

## `ThaiDate` API

```js
ThaiDate.formatThaiDate(dateOrISO, { withDow:false, short:false, withYear:true }) // "17 สิงหาคม พ.ศ. 2569"
ThaiDate.formatThaiDateTime(dateOrISO)   // "17 สิงหาคม พ.ศ. 2569 เวลา 09.00 น."
ThaiDate.formatThaiShort(dateOrISO)      // "17 ส.ค. 69"
ThaiDate.relativeDaysLabel(target, from) // "วันนี้" | "พรุ่งนี้" | "อีก N วัน" | "เลยมาแล้ว N วัน"
ThaiDate.waitingDaysLabel(n)             // "รอตรวจมาแล้ว N วัน"
ThaiDate.diffDays(a, b)                  // จำนวนวัน a - b (ปัดเป็น integer)
ThaiDate.addDays(date, n)                // คืน Date object ใหม่
ThaiDate.toISODate(date)                 // "YYYY-MM-DD"
ThaiDate.toDate(isoStringOrDate)         // แปลงเป็น Date object แบบไม่เลื่อน timezone
ThaiDate.startOfDay(date)
```

## `PP` API (ชั้นข้อมูล/ตรรกะธุรกิจ) — ทุกฟังก์ชัน mutate แล้ว `commit()` (เขียนลง localStorage) ให้อัตโนมัติ

### ผู้ใช้ปัจจุบัน (Demo identity)
```js
PP.getCurrentUser() // { role: 'student'|'advisor', teamId, studentId, advisorId }
PP.setRole(role)
PP.setCurrentTeam(teamId)      // เปลี่ยนทีมที่ล็อกอินอยู่ (role เป็น student)
PP.setCurrentAdvisor(advisorId)
```

### ข้อมูลหลัก (read-only lookups)
```js
PP.getCourse() // { code, name, program, semesterLabel, weeks:16, startDate, endDate, currentWeek, feedbackTargetDays }
PP.getSettings() // { feedbackSlaDays, reminderMilestones:[1,3,5,7], studentInactivityDays:3, deadlineCollisionWindowHours:48, studentDeadlineReminders:[7,3,1], notifyChannels:{inApp,email} }
PP.updateSettings(patch)
PP.getAdvisors() // [{id,name,initials,feedbackSlaDays}]
PP.getAdvisor(id)
PP.getTeams() // [{id,name,projectType,projectName,advisorId,pace,health:'green'|'yellow'|'red',currentOrder,blocksNext,inactivityDays}]
PP.getTeam(teamId)
PP.getTeamsByAdvisor(advisorId)
PP.getStudentsByTeam(teamId) // [{id,name,role,teamId}]
PP.getStudent(id)
PP.getMilestoneDefs() // นิยาม 10 Milestone คงที่: {order,key,name,startWeek,endWeek}
PP.getMilestones(teamId) // milestone จริงของทีม เรียงตาม order — ดูโครงสร้างด้านล่าง
PP.getMilestone(id)
PP.getCurrentMilestone(teamId)
PP.statusMeta(statusKey) // {label:'ภาษาไทย', chip:'chip-xxx'} ใช้กับ 10 สถานะมาตรฐาน
PP.getSubmission(id)
PP.getSubmissionsByTeam(teamId)
PP.getFeedback(id)
PP.getFeedbackBySubmission(submissionId)
PP.getFeedbacksByTeam(teamId)
PP.getOtherCourseTasks(teamId)
PP.getSchedule(teamId)          // ตารางเรียน recurring {dow:0-6,start,end,title,type:'class'}
PP.getPersonalBlocks(teamId)    // เวลานอน/ส่วนตัว recurring
PP.getFreeTimeSuggestions(teamId)
PP.getNotificationsFor('student'|'advisor', teamIdOrAdvisorId)
PP.unreadCount(role, id)
PP.markNotificationRead(id)
PP.markAllRead(role, id)
PP.pushNotification({audience,teamId?,advisorId?,type,severity,title,message})
PP.getPendingWork(teamId) // {subtasks:[...], checklist:[...], all:[...]} งานย่อยที่ยังไม่เสร็จทั้งหมด
```

### สถานะมาตรฐาน 10 สถานะ (key ภายใน → label ไทย, ใช้กับ milestone.status และ submission.status)
```
not_started  ยังไม่เริ่ม        chip-neutral
in_progress  กำลังดำเนินการ     chip-progress
ready        พร้อมส่ง           chip-ready
submitted    ส่งแล้ว–รอตรวจ     chip-waiting
reviewing    อาจารย์กำลังตรวจ   chip-reviewing
revise       ต้องแก้ไข          chip-revise
need_info    รอข้อมูลเพิ่มเติม   chip-info
passed       ผ่าน Milestone     chip-passed
blocked      ติดปัญหา           chip-blocked
done         เสร็จสมบูรณ์        chip-done
```
เรนเดอร์เป็น `<span class="chip ${meta.chip}">${meta.label}</span>` เสมอ — ห้าม hardcode สีสถานะเอง

### โครงสร้าง Milestone object
```js
{
  id, teamId, order, key, name, startDate, dueDate, completedDate,
  hoursEstimate, dependsOn /* milestone id ก่อนหน้า หรือ null */, status, risk: 'low'|'medium'|'high',
  attachments: [{name, uploadedAt}],
  history: [{date, note}],
  subtasks: [{id, title, assigneeId, done}],
}
```

### Mutations: Milestone / งานย่อย / ไฟล์แนบ
```js
PP.setMilestoneStatus(milestoneId, statusKey, note?)
PP.toggleSubtask(milestoneId, subtaskId)
PP.addSubtask(milestoneId, title, assigneeId?)
PP.addAttachment(milestoneId, fileName)
```

### ส่งงาน / ตรวจงาน / Feedback (นิสิต ↔ อาจารย์)
```js
PP.submitMilestone(milestoneId, fileName?, note?) // -> submission object; ตั้ง milestone.status='submitted'
PP.startReview(submissionId)     // อาจารย์เริ่มตรวจ -> status='reviewing'
PP.requestMoreInfo(submissionId, message?) // -> status='need_info' + แจ้งเตือนนิสิต
PP.draftChecklistFromText(rawText) // AI ช่วยร่าง checklist จากข้อความ (แยกทีละบรรทัด) — ใช้ตอนอาจารย์พิมพ์ feedback
PP.giveFeedback(submissionId, {rawText, decision, checklist?})
  // decision: 'revise' | 'need_info' | 'passed'
  // ถ้าไม่ส่ง checklist มา จะ auto-draft จาก rawText ให้
  // ถ้า decision==='passed' -> milestone.status='passed' และปลดล็อก currentOrder ของทีม +1
PP.updateChecklistItem(feedbackId, itemId, patch) // patch: {title?,assigneeId?,dueDate?,hours?,relatedTo?,needsRecheck?,done?}
PP.confirmChecklist(feedbackId) // นิสิตกดยืนยันหลังตรวจสอบ checklist แล้ว -> สร้าง subtask จริงใน milestone จากรายการที่มี assignee+dueDate ครบ
```

### โครงสร้าง Feedback object
```js
{
  id, submissionId, teamId, advisorId, milestoneId, createdAt,
  decision: 'revise'|'need_info'|'passed', rawText,
  checklist: [{id,title,assigneeId,dueDate,hours,relatedTo,needsRecheck,done}],
  confirmedAt?, // ตั้งหลัง PP.confirmChecklist()
}
```

### Feedback Queue (อาจารย์)
```js
PP.feedbackQueue(advisorId)
// -> [{ submission, team, milestone, waitDays, feedbackDueDate, daysToOverdue,
//       nextMilestone, urgency: 'ปกติ'|'ต้องติดตาม'|'ใกล้เกินกำหนด'|'เกินกำหนด',
//       riskLevel: 'ต่ำ'|'ปานกลาง'|'สูง', blocksNext, nextBestTasks:[...], queueRank }]
// เรียงลำดับความสำคัญให้แล้วจากมาก->น้อย (waitDays, blocksNext, risk, กำหนด milestone ถัดไป)
```

### Next Best Task / Health Score / Deadline Collision
```js
PP.nextBestTasks(teamId) // string[] 2-4 รายการ ตาม milestone ปัจจุบันของทีม
PP.computeHealthScore(teamId) // { score:0-100, level:'green'|'yellow'|'red', reasons: string[] } — ต้องแสดง reasons เสมอ ห้ามโชว์แค่ตัวเลข
PP.detectDeadlineCollision(teamId)
// -> { hasCollision, items:[{title,courseName,dueDate,hours,type}], totalHours, windowHours, suggestions:string[], projectSoon }
```

### Smart Free-Time Planner
```js
PP.confirmFreeTimeSlot(id)
PP.declineFreeTimeSlot(id)
PP.splitFreeTimeSlot(id)              // แบ่งเป็น 2 ช่วงสั้นอัตโนมัติ
PP.rescheduleFreeTimeSlot(id, date, start, end) // "เปลี่ยนเวลา" -> กลับไป status='pending'
PP.addFreeTimeSuggestion(teamId, date, start, end, taskSuggestion, reason)
// FreeTimeSuggestion: {id,teamId,date,start,end,taskSuggestion,reason,status:'pending'|'confirmed'|'declined'|'split'}
// เมื่อ status==='confirmed' จะไปโผล่ในปฏิทิน Workload Map เป็น event type 'project' ให้อัตโนมัติ (ผ่าน PP.dayEvents)
```

### Team Workload
```js
PP.teamWorkload(teamId)
// -> { members: [{student, totalTasks, done, overdue, hoursEstimate}], unassigned: [...], imbalance: boolean }
```

### Semester Workload Map (ปฏิทิน/Heatmap)
```js
PP.dayEvents(teamId, isoDateString)
// -> [{type:'class'|'personal'|'other-course'|'milestone'|'project', title, start?, end?, hours, meta?}]
PP.dayLoadLevel(teamId, isoDateString) // 'low' | 'mid' | 'high' (ใช้ตั้ง class cal-cell load-*)
PP.hoursBetween(startHHMM, endHHMM)
```

### รายงาน / ตัวชี้วัด
```js
PP.weeklyReport(teamId) // { teamId, milestonesCompletedPct, onTimePct, health, currentMilestone }
PP.overallExperimentMetrics()
// -> { teamsCount, avgMilestonesCompletedPct, avgOnTimePct, avgFeedbackWaitDays,
//      targets:{milestoneCompletion:70, onTime:80, feedbackWaitMax:7, cycleWeeksTarget:13, cycleWeeksBaseline:16},
//      perTeam:[...weeklyReport ทุกทีม] }
// ต้องระบุชัดในหน้า UI ว่าตัวเลขใน targets เป็น "เป้าหมายของการทดลองใช้" ไม่ใช่ผลลัพธ์ที่พิสูจน์แล้ว
```

### อื่น ๆ
```js
PP.resetDemoData() // ล้างแล้วสร้างข้อมูลจำลองใหม่ทั้งหมด (ใช้ในหน้า Settings ปุ่ม "รีเซ็ตข้อมูลตัวอย่าง")
PP.uid(prefix) // สุ่ม id string ใหม่
```

## CSS component classes ที่มีให้แล้ว (ดู `assets/css/style.css`)

Layout: `app-shell / app-header / app-body / app-sidebar / app-main / app-main__inner / page-head / page-head__title / page-head__eyebrow / page-head__desc / page-head__actions`

Primitives: `btn (btn-primary/secondary/outline/ghost/success/danger, btn-sm, btn-block, btn-icon)`,
`card (card-hd, card-pad-lg, card-stat)`, `grid (grid-2/3/4/auto, col-span-2/3)`,
`chip (chip-neutral/progress/ready/waiting/reviewing/revise/info/passed/blocked/done, chip-green/yellow/orange/red)`,
`health-badge (green/yellow/red)`, `progress + progress__bar (green/yellow/orange/red)`,
`timeline + timeline-item (+ __dot.done/.current/.risk)`, `task-row + checkbox(.is-checked)`,
`cal-grid + cal-cell (load-low/mid/high, is-today, is-outside) + cal-event (type-class/other-course/project/personal/milestone)`,
`legend + legend-item + legend-swatch`, `slot-card(.is-confirmed)`, `table-wrap + table.pp-table + queue-rank`,
`field / input / form-row / checkbox-line`, `alert (alert-info/warn/danger/success)`, `callout-muted`,
`modal-backdrop(.is-open) + modal + modal-hd + modal-footer`, `tabs + tab-btn(.is-active) + tab-panel(.is-active)`,
`avatar + avatar-stack`, `empty-state`, `divider`, utility: `flex, flex-col, items-center, justify-between, gap-1..4, text-muted, text-sm, text-xs, font-bold, w-full`

## กติกาการออกแบบที่ต้องรักษาไว้ทุกหน้า

- ภาษาไทยเป็นหลัก, วันที่แบบไทย/พ.ศ. เสมอ
- สีกรมท่า/ม่วง/ฟ้า (ผ่าน `--pp-*` CSS variables และ class ที่มีอยู่) เป็นสีหลักของ UI; สีเขียว/เหลือง/ส้ม/แดง **ใช้เฉพาะสื่อสถานะ/ความเสี่ยง** เท่านั้น อย่านำไปใช้ตกแต่งทั่วไป
- Responsive ทุกหน้า (ทดสอบ mental model ที่ ~375px, ~768px, ~1280px) — ใช้ grid ที่มีอยู่แล้ว อย่า fix width
- Contrast สูงพอสำหรับผู้มีข้อจำกัดด้านการมองเห็น (สีที่กำหนดไว้ผ่านเกณฑ์แล้ว ใช้ตามที่มี อย่าลดความเข้ม)
- Project Health Score ต้องมีคำอธิบายเหตุผลกำกับเสมอ และระบุว่า "เป็นตัวชี้วัดความเสี่ยง ไม่ใช่คะแนนรายวิชา"
- ทุกปุ่ม/ฟอร์มต้องทำงานได้จริงและเปลี่ยน state จริง (localStorage ผ่าน `PP.*`) ห้ามมีปุ่มตกแต่งเฉย ๆ
- อาจารย์เท่านั้นที่ "ให้คะแนน/อนุมัติผ่าน Milestone" ได้ — หน้าใด ๆ ที่เป็นมุมมองนิสิต ห้ามมีปุ่มที่ทำให้ milestone สถานะเป็น `passed` เอง (นิสิตทำได้แค่ submit/toggle subtask/confirm checklist)
