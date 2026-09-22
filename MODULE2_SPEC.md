# MODULE2_SPEC.md — สเปกสำหรับการบ้านที่ 4 (Module 2 sign-off)

> **หมายเหตุตั้งชื่อไฟล์:** เดิมตั้งใจตั้งชื่อ `spec.md` ตามที่การบ้านขอ แต่ระบบไฟล์ของเครื่องนี้ (Windows) ไม่แยกตัวพิมพ์เล็ก-ใหญ่ ทำให้ `spec.md` ชนกับไฟล์ `SPEC.md` เดิมที่มีอยู่แล้วในโปรเจกต์ (เอกสารคนละบทบาทกัน — ดูหมายเหตุถัดไป) จึงตั้งชื่อใหม่เป็น `MODULE2_SPEC.md` เพื่อไม่ให้ทับกัน
>
> **หมายเหตุขอบเขต:** โปรเจกต์นี้ไม่มีไฟล์ `SCOPE.md` แยกต่างหาก (การบ้านที่ 1 ของหัวข้อนี้ไม่ได้สร้างไฟล์นั้นไว้) สเปกนี้จึงสรุปจากโค้ดจริงใน `pages/`, `assets/js/store.js`, และเอกสารที่มีอยู่ (`README.md`, `SPEC.md`, `DATA_MODEL.md`, `ACL.md`) — โดยยึดโค้ดจริงเป็นหลักเมื่อเอกสารเก่าไม่ตรงกับของจริง (ตามที่ `CLAUDE.md` เตือนไว้ว่า `SPEC.md`/`DATA_MODEL.md` ล้าหลังโค้ดไปแล้ว) **ไฟล์นี้ไม่ใช่การแทนที่ `SPEC.md` เดิม** — `SPEC.md` ยังทำหน้าที่ "สเปกฟังก์ชันรายหน้าผูกกับ implementation" ตามเดิม ส่วนไฟล์นี้คือสเปกสรุปสำหรับงานส่งการบ้าน Module 2 โดยเฉพาะ

## ระบบคืออะไร

**ProjectPulse** — เว็บแอปติดตามความก้าวหน้ารายวิชาโครงงานของนิสิตสาขาการสื่อสารสื่อใหม่ ม.พะเยา ใช้แนวคิด "Pulse" (ชีพจรโครงงาน) ให้ทั้งนิสิตและอาจารย์ที่ปรึกษาเห็นความคืบหน้าของแต่ละทีมตลอดเทอม แทนที่จะรู้ตอนใกล้ปิดเทอม

## บทบาทผู้ใช้ (2 ระบบยืนยันตัวตนคู่ขนาน — สำคัญ)

โปรเจกต์นี้มี **ระบบยืนยันตัวตน 2 ระบบที่ไม่เกี่ยวกัน**:

1. **Demo identity (`localStorage`, ทุกหน้าในแอปหลัก)** — สลับบทบาทได้อิสระผ่านตัวสลับ "Demo" บน header (`PP.setRole`/`setCurrentTeam`/`setCurrentAdvisor`) ไม่ใช่ security boundary จริง เป็นแค่ UI convenience สำหรับสาธิต 2 บทบาท:
   - **นิสิต (student)** — ติดตาม Milestone ของทีมตัวเอง, ส่งงานเข้าคิวตรวจ, รับ Feedback แล้วแปลงเป็นงานย่อย, วางแผนเวลาว่าง, ดูภาระงานทีม
   - **อาจารย์ที่ปรึกษา (advisor)** — ดูภาพรวมทุกทีมที่ดูแล, จัดคิวงานรอตรวจ, ให้ Feedback + ตัดสินผล, ตั้งค่ากรอบเวลา Feedback
2. **Firebase Auth จริง (เฉพาะฟีเจอร์ "คำร้องขอความช่วยเหลือถึงอาจารย์")** — `pages/login.html`, `pages/signup.html`, `assets/js/auth-guard.js` → `requireAuth()` เช็ค `onAuthStateChanged` จริง แล้วอ่านบทบาทจาก Firestore `users/{uid}.role` (ค่าเริ่มต้น `"student"` ตอนสมัคร, อาจารย์ต้องตั้งมือใน Firebase Console) นี่คือ **security boundary จริงหนึ่งเดียวในระบบ** ที่บังคับด้วย Firestore Security Rules ([firestore.rules](firestore.rules)) ไม่ใช่แค่ UI — ดูสิทธิ์เต็มใน [ACL.md](ACL.md)

> **หมายเหตุ:** ฟีเจอร์นี้เดิมชื่อ "คำขอเปลี่ยนอาจารย์ที่ปรึกษา" — เปลี่ยนเป็น "คำร้องขอความช่วยเหลือถึงอาจารย์" ตามการตัดสินใจของเจ้าของโปรเจกต์ (อาจารย์ที่ปรึกษากำหนดตอนสร้างทีมครั้งเดียว **เปลี่ยนไม่ได้ภายหลัง** — จึงไม่มีเวิร์กโฟลว์เปลี่ยนอาจารย์ในระบบนี้โดยตั้งใจ) กลไกทางเทคนิค (Firebase Auth + Firestore ACL) เหมือนเดิมทุกประการ เปลี่ยนแค่โดเมนข้อมูล

## หน้าจอทั้งหมด (`pages/*.html`, 25 หน้า)

### หน้า public / ไม่ต้องล็อกอิน
| หน้า | หน้าที่ |
|---|---|
| `index.html` | เลือก/สลับบทบาท demo (root, ไม่อยู่ใน `pages/`) |
| `login.html`, `signup.html` | ล็อกอิน/สมัครด้วย Firebase Auth (อีเมล/รหัสผ่าน) |
| `contact.html`, `help.html`, `privacy.html`, `terms.html`, `user-guide.html` | หน้าข้อมูลทั่วไป ไม่ผูกข้อมูลผู้ใช้ |

### หน้าเฉพาะนิสิต (guard: `role !== "student"`)
| หน้า | หน้าที่ |
|---|---|
| `student-dashboard.html` | ภาพรวม Pulse, Hero Task, งานรอทำของทีมตัวเอง |
| `project-timeline.html` | Timeline/Micro-Milestones ของทีม |
| `task-detail.html` | รายละเอียดงานย่อย + แนบไฟล์ |
| `feedback-to-task.html` | แปลง Feedback ที่ได้รับเป็นงานย่อย |
| `workload-map.html` | ปฏิทิน/Heatmap ภาระงานทั้งเทอม |
| `free-time-planner.html` (ใช้ `free-time-tab.js`) | Smart Free-Time Planner |
| `achievements.html` | เหรียญ/แต้ม Pulse Points ของทีม |

### หน้าเฉพาะอาจารย์ (guard: `role !== "advisor"`)
| หน้า | หน้าที่ |
|---|---|
| `advisor-dashboard.html` | ภาพรวมทุกทีมที่ดูแล + Risk Radar |
| `feedback-queue.html` | คิวงานรอตรวจ เรียงตามความสำคัญ |
| `review-feedback.html` (`?sub=<submissionId>`) | ตรวจงาน + ให้ Feedback + ตัดสินผล |

### หน้าใช้ร่วมกัน 2 บทบาท (guard ภายในหน้า หรือไม่มี guard)
| หน้า | หน้าที่ |
|---|---|
| `projects.html`, `project-detail.html` | รายการ/รายละเอียดโครงงาน (Pulse, Milestones & Timeline tab) |
| `profile.html` | โปรไฟล์ผู้ใช้ |
| `notifications.html` | ศูนย์แจ้งเตือน |
| `team-workload.html` | ภาระงานทีม (อาจารย์เพิ่ม selector เลือกทีม) |
| `weekly-report.html` | รายงานความก้าวหน้ารายสัปดาห์ |
| `settings.html` | ตั้งค่ากรอบเวลา Feedback (อาจารย์คุม) + การแจ้งเตือนส่วนตัว |
| `help-request-new.html`, `help-request-list.html` | **คำร้องขอความช่วยเหลือถึงอาจารย์ (เลื่อนกำหนดส่ง/ขอคำปรึกษา/อื่น ๆ) — ใช้ Firebase Auth จริง** (ดู ACL.md) |

## โครงสร้างข้อมูล (data layer)

### `localStorage` (แหล่งข้อมูลจริงของแอปหลัก — key เดียว `projectpulse_state_v1`)
จัดการผ่าน `window.PP` (`assets/js/store.js`, ~100 ฟังก์ชัน) เอนทิตีหลักใน `STATE`:
`course`, `courseSettings`, `advisors`, `teams`, `students`, `milestoneDefs`, `milestones`, `submissions`, `feedbacks`, `otherCourseTasks`, `schedule`, `personalBlocks`, `freeTimeSuggestions`, `notifications`, `checkins`, `pulsePoints`, `weeklyMomentum`

โครงสร้างสำคัญ:
- **Milestone** — 10 ขั้นตายตัวต่อทีม (`STATE.milestoneDefs`) มี `status` 1 ใน 10 สถานะมาตรฐาน (ดู `DATA_MODEL.md`), subtask, attachment
- **Submission → Feedback** — นิสิตส่งงาน (`submission.status = "submitted"`) → อาจารย์ `PP.giveFeedback()` ให้ผล `feedback.decision` เป็น `passed` (ผ่าน) / `revise` (แก้ไข) / `need_info` (ขอข้อมูลเพิ่ม) — นี่คือ workflow แบบ 3 สถานะ pending→approved/rejected ของระบบนี้
- **Health Score / Pulse** — `PP.computeHealthScore(teamId)` → คะแนน 0–100 → ระดับ `dormant|weak|steady|strong` (เกณฑ์ `<55|<78|<90|else`)

### Firestore (experimental — เดินจริงเฉพาะฟีเจอร์คำร้องขอความช่วยเหลือ)
Collection ที่ใช้งานจริงวันนี้: `advisors`, `teams` (seed เท่านั้น), `users` (สร้างตอน signup, มี `role`), `helpRequests` (`teamId`/`teamName`, `advisorId`/`advisorName`, `type: extension|consult|other`, `message`, `status: pending|approved|declined`, `createdByUid`, `decidedAt`)

## เส้นทางหลัก / ปุ่มเปลี่ยนสถานะ / ช่องบังคับกรอก (สำหรับแผนทดสอบ)

1. **เส้นทางหลัก (main flow):** นิสิตส่งงาน (submission) → เห็นอยู่ในคิวของอาจารย์ (`feedback-queue.html`) → อาจารย์เปิด `review-feedback.html?sub=...` ให้ Feedback → นิสิตเห็นผลใน `feedback-to-task.html`/dashboard
2. **ปุ่มเปลี่ยนสถานะ:** ปุ่มตัดสินผลใน `review-feedback.html` (`PP.giveFeedback` → `decision: passed/revise/need_info`) และปุ่มอนุมัติ/ปฏิเสธคำร้องขอความช่วยเหลือใน `help-request-list.html` (เปลี่ยน `status: pending → approved/declined`, อาจารย์เท่านั้น)
3. **ช่องบังคับกรอก:** ฟอร์มสร้างคำร้องขอความช่วยเหลือ (`help-request-new.html`) — ทีม, ประเภทคำร้อง, ข้อความ ต้องกรอกครบก่อนบันทึกได้
4. **จุดที่ต้องล็อกอิน (security boundary จริง):** `help-request-new.html`, `help-request-list.html` — ไม่ล็อกอินเปิดไม่ได้ (`requireAuth()` เด้งไป `login.html`), บัญชีนิสิตคนที่สองต้องเห็น**เฉพาะคำร้องของตัวเอง** (`createdByUid` ของตน) เปิดของคนอื่นไม่ได้ ตามที่กำหนดใน Firestore Rules + `ACL.md`

## สิ่งที่ไม่ทำใน Module นี้ (out of scope)

- ไม่ย้าย demo identity (`localStorage` role-switcher) ไปเป็น auth จริง — คงไว้เป็น prototype ตามที่ `CLAUDE.md` ระบุชัดว่า "ทุก role check เป็นแค่ UI convenience ไม่ใช่ security boundary"
- ไม่มีเวิร์กโฟลว์เปลี่ยนอาจารย์ที่ปรึกษาในระบบนี้โดยตั้งใจ — อาจารย์กำหนดตอนสร้างทีมครั้งเดียว เปลี่ยนไม่ได้ภายหลัง ("เลือกแล้วเลือกเลย")
- ไม่ผูก advisor account กับ record ใน `advisors` collection (ช่องโหว่ที่ตั้งใจปล่อยไว้ ระบุใน `ACL.md`: อาจารย์อนุมัติคำร้องของทีมที่ไม่ใช่ของตัวเองได้)
- ไม่ย้ายข้อมูลหลักของแอป (teams/milestones/submissions/feedbacks ฯลฯ) จาก `localStorage` ไป Firestore จริง — Firestore เป็น experiment คู่ขนานตาม `CLAUDE.md`
- ไม่แก้ให้ `bundle.html` sync อัตโนมัติทั้งหมด (มีแค่ 4 ไฟล์ที่ sync อัตโนมัติผ่าน `build-bundle.ps1` ที่เหลือ hand-edit)
- คีย์ AI (`assets/js/ai-secrets.js`, ฟีเจอร์ Gemini checklist/agentic summary) ต้องอยู่นอก repo เสมอ — งานนี้จะตรวจซ้ำก่อน push
