# ProjectPulse — สเปกฟังก์ชันรายหน้า (สำหรับผู้สร้างหน้าแต่ละหน้า)

โปรดอ่าน `DATA_MODEL.md` ก่อนเสมอ (มีรูปแบบไฟล์บังคับ + API ทั้งหมด) เอกสารนี้อธิบาย "อะไรต้องมีในแต่ละหน้า"
ดึงข้อมูลจริงจาก `PP.*` เท่านั้น ห้าม hardcode ข้อมูลจำลองเอง

บริบทระบบ: ProjectPulse เป็นเว็บแอปติดตามความก้าวหน้ารายวิชาโครงงานของนิสิตสาขาการสื่อสารสื่อใหม่
มหาวิทยาลัยพะเยา ใช้แนวคิด "Pulse" (ชีพจรของโครงงาน) ผู้ใช้มี 2 บทบาท: นิสิต และ อาจารย์ที่ปรึกษา
ผู้ใช้ปัจจุบันอ่านได้จาก `PP.getCurrentUser()` — หน้าเดียวกันต้องเช็ค role และ redirect/แสดงข้อความ
ถ้าเปิดผิดบทบาท (เช่น หน้าเฉพาะอาจารย์ถูกเปิดตอน role เป็น student ให้ขึ้น empty-state พร้อมลิงก์กลับ dashboard ของ role นั้น)

สถานะมาตรฐาน 10 สถานะ, Health Score, Deadline Collision, Next Best Task ฯลฯ —ดูรายละเอียดใน `DATA_MODEL.md`

---

## หน้า: Advisor Dashboard (`pages/advisor-dashboard.html`, nav key `advisor-dashboard`, บทบาท: อาจารย์)

แดชบอร์ดภาพรวมของอาจารย์ที่ปรึกษาคนปัจจุบัน (`PP.getCurrentUser().advisorId`) ต้องมีครบ:
- **สรุปตัวเลขด่วน** (stat cards แบบเดียวกับ student-dashboard): จำนวนทีมที่ดูแล (`PP.getTeamsByAdvisor`), จำนวนงานรอตรวจทั้งหมด (`PP.feedbackQueue(advisorId).length`), จำนวนงานที่ใกล้/เกินกรอบเวลา Feedback 7 วัน (กรอง `urgency` เป็น `'ใกล้เกินกำหนด'`/`'เกินกำหนด'`), จำนวนทีมที่ health เป็น `red`
- **ภาพรวมความก้าวหน้าของทุกทีม**: การ์ด/ตารางต่อทีม แสดงชื่อทีม, โครงงาน, Milestone ปัจจุบัน (chip สถานะ), % ความก้าวหน้า (progress bar), Health badge — คลิกทีมเพื่อไปหน้า `team-workload.html?team=<id>` ได้
- **คิวงานรอตรวจ (ย่อ)**: แสดง 5 อันดับแรกจาก `PP.feedbackQueue(advisorId)` (เรียงมาให้แล้ว) พร้อมปุ่ม "ดูคิวทั้งหมด" ไป `feedback-queue.html` และปุ่ม "เริ่มตรวจ" ที่ใช้งานได้จริงเหมือนในหน้า Feedback Queue
- **แจ้งเตือนสำคัญ**: การ์ดแสดงแจ้งเตือนที่ severity เป็น `red`/`warn` จาก `PP.getNotificationsFor('advisor', advisorId)` (ดูตัวอย่างข้อความสไตล์ "ทีมข่วงศิลป์ส่งบทฉบับแก้ไขมาแล้ว 5 วัน...")
- **งานที่กำหนดให้ทำคู่ขนานระหว่างรอตรวจ**: สรุปว่าแต่ละทีมที่มีงานค้างตรวจกำลังทำ Next Best Task อะไรอยู่ (จาก `nextBestTasks` ใน `feedbackQueue` row) เพื่อให้อาจารย์เห็นว่านิสิตไม่ได้ว่างเฉย ๆ

## หน้า: Semester Workload Map (`pages/workload-map.html`, nav key `workload-map`, บทบาท: นิสิต)

ปฏิทินภาพรวมภาระงานทั้งภาคการศึกษา 16 สัปดาห์ (ใช้ `PP.getCourse()` หาช่วงวันที่)

ต้องรวมและแยกสีชัดเจนตามประเภท (ใช้ class `cal-event type-class/type-other-course/type-project/type-personal/type-milestone` ที่มีอยู่แล้ว):
- ตารางเรียน (`PP.getSchedule`)
- งานจากวิชาอื่น (`PP.getOtherCourseTasks`)
- กำหนดส่งงานโครงงาน/Milestone (`PP.getMilestones`)
- Milestone ของโครงงาน
- เวลาส่วนตัว/เวลาที่ไม่สะดวก (`PP.getPersonalBlocks`)
- ช่วงเวลาที่ยืนยันแล้วจาก Free-Time Planner (สถานะ `confirmed`) — ใช้ `PP.dayEvents(teamId, dateISO)` ซึ่งรวมทุกอย่างให้แล้วต่อวัน

แสดงเป็นปฏิทินรายเดือน (ใช้ `cal-grid` + `cal-cell` ตาม CSS ที่มี) แบ่งได้เป็นมุมมองรายเดือน โดยให้ผู้ใช้กดปุ่ม "เดือนก่อนหน้า/ถัดไป" เพื่อเลื่อนดูตลอด 16 สัปดาห์ (คำนวณจาก `course.startDate`..`course.endDate`)

ใช้ `PP.dayLoadLevel(teamId, dateISO)` กำหนด class `load-low/load-mid/load-high` เป็น **Heatmap วันที่มีภาระงานสูง/ปานกลาง/ต่ำ** ต้องมี legend อธิบายสีทั้งหมด (ใช้ `.legend/.legend-item/.legend-swatch`)

กดที่ cell ของวันใดวันหนึ่ง (คลิกได้จริง) เพื่อเปิด modal/รายละเอียดแสดงรายการเหตุการณ์ของวันนั้นแบบเต็ม (ใช้ `.modal-backdrop`/`.modal` ที่มีสไตล์อยู่แล้ว)

## หน้า: Smart Free-Time Planner (`pages/free-time-planner.html`, nav key `free-time-planner`, บทบาท: นิสิต)

ต้องไม่สรุปเวลาว่างจากกำหนดส่งเพียงอย่างเดียว — อธิบายในหน้าว่าระบบพิจารณาจาก: ตารางเรียน, เวลานอน/ส่วนตัว, งานประจำ/กิจกรรม, กำหนดส่งงานวิชาอื่น, ชั่วโมงที่ต้องใช้ต่อแต่ละงาน, ช่วงเวลาที่ทำงานได้ดีที่สุด (ใช้ copy อธิบายสั้น ๆ ใต้หัวข้อ ไม่ต้องมี input ให้ผู้ใช้กรอกพลังงานจริงจัง เพราะ demo)

แสดงช่วงเวลาแนะนำ 2-3 ตัวเลือกในช่วง 7 วันข้างหน้า จาก `PP.getFreeTimeSuggestions(teamId)` (กรอง `status==='pending'`) ด้วย `.slot-card` — แต่ละใบต้องมีปุ่มที่ทำงานได้จริงครบ 4 แบบตามสเปก:
- **ยืนยันเวลานี้** → `PP.confirmFreeTimeSlot(id)` แล้วแจ้ง toast ว่าเพิ่มลงปฏิทินแล้ว (จะไปโผล่ใน Workload Map เอง)
- **เปลี่ยนเวลา** → เปิดฟอร์มเล็ก ๆ ให้เลือกวัน/เวลาใหม่ แล้วเรียก `PP.rescheduleFreeTimeSlot(id, date, start, end)`
- **แบ่งเป็นช่วงสั้น** → `PP.splitFreeTimeSlot(id)`
- **แจ้งว่าไม่สะดวก** → `PP.declineFreeTimeSlot(id)`

ตัวอย่างข้อความอ้างอิง (มีอยู่ในข้อมูลจำลองแล้วสำหรับทีมข่วงศิลป์): "วันพฤหัสบดี เวลา 19.00–21.00 น. ยังไม่มีงานวิชาอื่นที่เร่งด่วน แนะนำให้ใช้เวลา 2 ชั่วโมงจัดทำ Storyboard ฉบับแก้ไข"

แสดงรายการที่เคยยืนยัน/ปฏิเสธ/แบ่งไปแล้วเป็นประวัติด้านล่างด้วย (กรอง status อื่น ๆ)

## หน้า: Project Timeline และ Micro-Milestones (`pages/project-timeline.html`, nav key `project-timeline`, บทบาท: นิสิต)

แสดง 10 Milestone (`PP.getMilestones(teamId)`) เป็น `.timeline` (ใช้ `.timeline-item__dot.done/.current/.risk` ตามสถานะ) แต่ละ Milestone ต้องกดขยายดู/แก้ไขได้จริง แสดงครบ: งานย่อย (subtasks พร้อม checkbox toggle ได้จริงผ่าน `PP.toggleSubtask`, ปุ่มเพิ่มงานย่อยใหม่ผ่าน `PP.addSubtask`), ผู้รับผิดชอบ (ชื่อจาก `PP.getStudent(assigneeId)`), วันที่เริ่ม/กำหนดส่ง, จำนวนชั่วโมงประมาณ, งานที่ต้องทำก่อนหน้า (`dependsOn` → แสดงชื่อ milestone นั้น, ต้องผ่านก่อนถึงจะเริ่มงานถัดไปได้ตามตรรกะเชิงแสดงผล), ไฟล์แนบ (`attachments`, มีปุ่ม "แนบไฟล์" จำลองที่เรียก `PP.addAttachment(id, fileNameจาก prompt())`), สถานะ (chip), ความเสี่ยง (`risk`), ประวัติการแก้ไข (`history` แสดงเป็น timeline ย่อย)

ปุ่ม "ส่งงานให้อาจารย์ตรวจ" บน milestone ที่เป็นสถานะ `in_progress`/`ready` → เรียก `PP.submitMilestone(...)` แล้วพาไปหน้า/แสดงผลว่าเข้าคิวตรวจแล้ว (จำลองไฟล์แนบด้วย prompt() ถามชื่อไฟล์)

## หน้า: รายละเอียดงานและการส่งไฟล์ (`pages/task-detail.html`, nav key `task-detail`, บทบาท: นิสิต)

โฟกัสที่ Milestone ปัจจุบัน (`PP.getCurrentMilestone(teamId)`) เป็นหลัก: แสดงรายละเอียดงานย่อยทั้งหมด (toggle ได้), ฟอร์มส่งงาน (เลือก/จำลองไฟล์แนบด้วย `<input type="file">` จริง — อ่านแค่ชื่อไฟล์จาก `input.files[0].name` ไม่ต้องอัปโหลดจริง, ช่องหมายเหตุถึงอาจารย์) ปุ่ม "ส่งงานเข้าคิวตรวจ" เรียก `PP.submitMilestone(milestoneId, fileName, note)` เมื่อ milestone สถานะยังไม่ใช่ submitted/reviewing/passed เท่านั้น (ถ้าอยู่ระหว่างรอตรวจอยู่แล้วให้ disable ฟอร์มและโชว์สถานะ+จำนวนวันที่รอแทน ใช้ `ThaiDate.waitingDaysLabel`)

ถ้า milestone สถานะเป็น `revise`/`need_info` (มี feedback ค้างอยู่ผ่าน `PP.getFeedbackBySubmission`) ให้แสดงลิงก์เด่นไปหน้า `feedback-to-task.html`

## หน้า: Feedback Queue (`pages/feedback-queue.html`, nav key `feedback-queue`, บทบาท: อาจารย์)

ตารางคิวงานรอตรวจจาก `PP.feedbackQueue(advisorId)` (จัดลำดับความสำคัญมาให้แล้ว) แสดงคอลัมน์ครบ: ชื่อทีม, ชื่อโครงงาน, Milestone ที่ส่ง, วันที่/เวลาที่ส่ง (`ThaiDate.formatThaiDateTime`), จำนวนวันที่รอตรวจ (`waitDays`), ลำดับคิว (`queueRank`), วันที่ควรให้ Feedback (`feedbackDueDate`), กำหนดส่ง Milestone ถัดไป (`nextMilestone.dueDate`), ระดับความเร่งด่วน (`urgency` — ใช้สี chip แดง/ส้ม/เหลือง/เทาให้เหมาะ), ความเสี่ยง (`riskLevel`), งานที่นิสิตกำลังทำระหว่างรอตรวจ (`nextBestTasks`)

ใช้ `.table-wrap`/`table.pp-table`/`.queue-rank` ที่มีอยู่ ถ้าจอเล็กให้ตาราง scroll แนวนอนได้ (`.table-wrap` มี `overflow-x:auto` ให้แล้ว)

ปุ่มต่อแถวต้องกดได้จริงครบ: **เริ่มตรวจ** (`PP.startReview(submissionId)`), **เปิดไฟล์งาน** (แสดง modal/alert จำลองว่าเปิดไฟล์ `submission.fileName`), **ขอข้อมูลเพิ่มเติม** (เปิดช่องพิมพ์ข้อความแล้วเรียก `PP.requestMoreInfo`), **ส่ง Feedback / ให้แก้ไข / ผ่าน Milestone** — 3 ปุ่มนี้ให้ลิงก์ไปหน้า `review-feedback.html?sub=<submissionId>` เพื่อกรอกรายละเอียดเต็มรูปแบบที่นั่น

## หน้า: ตรวจงานและให้ Feedback (`pages/review-feedback.html`, nav key `review-feedback`, บทบาท: อาจารย์, รับ query `?sub=<submissionId>`)

อ่าน `submissionId` จาก `location.search` (`new URLSearchParams(location.search).get('sub')`) โหลดข้อมูลด้วย `PP.getSubmission(id)`; ถ้าไม่พบให้ขึ้น empty-state พร้อมลิงก์กลับ `feedback-queue.html`

แสดงรายละเอียดงานที่ส่ง (ทีม, milestone, ไฟล์, หมายเหตุนิสิต), ช่องกรอก Feedback แบบ textarea (rawText), ปุ่มช่วย "ให้ AI ช่วยแยกประเด็นเป็น Checklist" ที่เรียก `PP.draftChecklistFromText(rawText)` มาพรีวิวเป็นตารางแก้ไขได้ก่อนบันทึกจริง (เพิ่ม/ลบ/แก้ข้อความรายการได้ในฟอร์ม ก่อนกด submit จริง — ต้อง**ไม่**ให้ AI ตัดสินคะแนนหรือฟันธงว่าผ่าน ให้มีข้อความกำกับชัดว่า "การให้คะแนน/อนุมัติเป็นดุลยพินิจของอาจารย์เท่านั้น")

ปุ่มตัดสินใจ 3 แบบ (ให้อาจารย์เลือกอย่างใดอย่างหนึ่งเพื่อยืนยันส่ง): **ให้แก้ไข** (decision `revise`), **ขอข้อมูลเพิ่มเติม** (decision `need_info`), **ผ่าน Milestone** (decision `passed`) → เรียก `PP.giveFeedback(submissionId, {rawText, decision, checklist})` แล้วกลับไปหน้า `feedback-queue.html` พร้อม toast ยืนยัน

## หน้า: Feedback-to-Task (`pages/feedback-to-task.html`, nav key `feedback-to-task`, บทบาท: นิสิต)

แสดง Feedback ล่าสุดที่ยังไม่ยืนยัน (`confirmedAt` ยังไม่มีค่า) ของทีม จาก `PP.getFeedbacksByTeam(teamId)` — ถ้าไม่มีให้ขึ้น empty-state พร้อมลิงก์ไปดูโครงงาน

แสดง `rawText` ต้นฉบับของอาจารย์ประกบคู่กับ checklist ที่แปลงมาให้แล้ว (`feedback.checklist`) ให้นิสิต**ตรวจสอบก่อนบันทึก**: แก้ไขได้ทุกช่องต่อรายการ (ใช้ `PP.updateChecklistItem(feedbackId,itemId,patch)`) — ต้องกำหนดได้ครบตามสเปก: ต้องแก้ไขอะไร (title), ใครรับผิดชอบ (assigneeId, dropdown จาก `PP.getStudentsByTeam`), กำหนดส่งเมื่อใด (dueDate), ใช้เวลาประมาณกี่ชั่วโมง (hours), เกี่ยวข้องกับไฟล์/ส่วนใด (relatedTo), ต้องให้อาจารย์ตรวจซ้ำหรือไม่ (needsRecheck checkbox)

ปุ่ม "ยืนยันและบันทึก" ทำงานได้จริงเมื่อทุกแถวมี assignee+dueDate ครบ → เรียก `PP.confirmChecklist(feedbackId)` (จะสร้างงานย่อยจริงใน milestone ให้อัตโนมัติ) แล้ว toast ยืนยัน + ลิงก์ไปดูงานที่ `project-timeline.html`

## หน้า: Team Workload (`pages/team-workload.html`, nav key `team-workload`, บทบาท: นิสิตและอาจารย์ — ถ้าอาจารย์เข้าให้เพิ่ม selector เลือกทีมจาก `PP.getTeamsByAdvisor`)

ใช้ `PP.teamWorkload(teamId)` แสดงต่อสมาชิก: จำนวนงานที่รับผิดชอบ, ชั่วโมงงานโดยประมาณ, งานที่เสร็จแล้ว, งานที่ล่าช้า (overdue), ช่วงเวลาที่สมาชิกว่าง (ใช้ข้อความสรุปแบบง่ายจาก `PP.getPersonalBlocks`/`PP.getSchedule` เช่น "ว่างช่วงเย็นวันพฤหัส/เสาร์" ไม่ต้องคำนวณละเอียด), งานที่ยังไม่มีผู้รับผิดชอบ (`unassigned`, ต้องมีปุ่ม "มอบหมาย" ที่เลือกสมาชิกแล้วอัปเดตจริง — ถ้าเป็น subtask ใช้การหา milestone แล้ว mutate ผ่าน state โดยตรงด้วย `PP.getMilestone` + assign แล้ว `PP.commit()`, ถ้าเป็น checklist item ใช้ `PP.updateChecklistItem(feedbackId,id,{assigneeId})`)

ถ้า `imbalance===true` ให้โชว์ alert-warn เด่นว่าภาระงานไม่สมดุล ใช้ `.avatar`/`.avatar-stack` แสดงหน้าสมาชิก (ตัวอักษรย่อจาก `PPNav.initials`)

## หน้า: Notification Center (`pages/notifications.html`, nav key `notifications`, บทบาท: นิสิตและอาจารย์)

แสดงรายการแจ้งเตือนทั้งหมดของ user ปัจจุบัน (`PP.getNotificationsFor(role,id)`) ครบทุกประเภทที่ระบุในสเปก ใช้ `PPNav.notifIcon(type)`/`PPNav.renderNotifList` เป็นแนวทาง (จะเรียกใช้ตรง ๆ หรือเขียน render เองให้ละเอียดกว่าก็ได้) ต้องมี: ตัวกรองตามความรุนแรง (severity: info/warn/red/success) เป็น tabs (`.tabs`), ปุ่ม "อ่านแล้ว" ต่อรายการ (`PP.markNotificationRead(id)`) และ "อ่านทั้งหมด" (`PP.markAllRead`) ใช้งานได้จริง, คลิกที่การแจ้งเตือนที่มี context (เช่น deadline/feedback) ให้ลิงก์ไปหน้าที่เกี่ยวข้อง

## หน้า: รายงานความก้าวหน้ารายสัปดาห์ (`pages/weekly-report.html`, nav key `weekly-report`, บทบาท: นิสิตและอาจารย์)

**มุมมองนิสิต**: ใช้ `PP.weeklyReport(teamId)` แสดง % Milestone ที่เสร็จ, % ส่งตรงเวลา, Health score พร้อมเหตุผล (`reasons`), สรุปงานสัปดาห์นี้ (จาก `PP.getPendingWork`) เทียบ 16 สัปดาห์กับเป้าหมาย 13 สัปดาห์

**มุมมองอาจารย์**: ใช้ `PP.overallExperimentMetrics()` แสดงภาพรวมทุกทีม (ตาราง/การ์ดเทียบ `perTeam`) และหน้าสรุปผลตัวชี้วัดของการทดลองใช้ตามเป้าหมาย: Milestone ครบ ≥70%, ส่งตรงเวลา ≥80%, รอ Feedback ไม่เกิน 7 วัน, ลดวงจรจาก 16 เหลือ ~13 สัปดาห์ — **ต้องมีข้อความกำกับชัดเจนว่าตัวเลขเป้าหมายเหล่านี้เป็น "เป้าหมายของการทดลองใช้" ไม่ใช่ผลลัพธ์ที่พิสูจน์แล้ว** เทียบกับค่าจริงจากข้อมูลจำลอง (`avgMilestonesCompletedPct` ฯลฯ) เป็น progress bar คู่กัน (เป้าหมาย vs ปัจจุบัน)

## หน้า: ตั้งค่ากรอบเวลา Feedback และการแจ้งเตือน (`pages/settings.html`, nav key `settings`, บทบาท: นิสิตและอาจารย์ — แต่ควบคุมกรอบเวลา Feedback ควรเป็นสิทธิ์อาจารย์เป็นหลัก ฝั่งนิสิตให้เห็นค่าปัจจุบันแบบอ่านอย่างเดียว + ตั้งค่าการแจ้งเตือนส่วนตัวได้)

ใช้ `PP.getSettings()`/`PP.updateSettings(patch)`: ฟอร์มตั้งค่า feedbackSlaDays (ค่าเป้าหมายไม่เกิน 7 วัน แก้ได้), ระยะแจ้งเตือน reminderMilestones (วันที่ 1/3/5/7 ตามสเปก — แสดงเป็น checkbox/รายการแก้ตัวเลขได้), studentInactivityDays, deadlineCollisionWindowHours, studentDeadlineReminders, notifyChannels (in-app/email toggle) ปุ่ม "บันทึกการตั้งค่า" เรียก `PP.updateSettings` จริงแล้ว toast ยืนยัน

เพิ่มปุ่ม "รีเซ็ตข้อมูลตัวอย่าง" (`PP.resetDemoData()` แล้ว reload หน้า) พร้อม confirm dialog (`window.confirm(...)`) ก่อนทำจริง เพื่อให้ demo รีเซ็ตกลับสภาพเริ่มต้นได้

---

## หมายเหตุปิดท้าย

- ทุกหน้าต้อง responsive ทั้ง desktop/tablet/mobile และผ่านทดสอบว่าไม่มีปุ่มค้าง (dead button)
- ถ้าฟังก์ชันใน `PP.*` ที่ต้องใช้ยังไม่มี ให้เพิ่มฟังก์ชันใหม่ต่อท้ายใน `assets/js/store.js` (ห้ามลบ/แก้ของเดิม) แล้วอัปเดต export ใน `global.PP = {...}` ท้ายไฟล์ด้วย
- ห้ามให้นิสิตกดปุ่มที่ทำให้ milestone สถานะเป็น `passed` เอง — สิทธิ์นั้นเป็นของอาจารย์เท่านั้น
