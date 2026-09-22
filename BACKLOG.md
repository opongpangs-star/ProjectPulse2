# BACKLOG.md — สิ่งที่ยังไม่เสร็จ ส่งต่อ Module 3

## 1. ย้ายคีย์ AI ไปไว้ฝั่งที่ผู้ใช้แตะไม่ได้

ตอนนี้ `assets/js/ai-client.js` เรียก OpenRouter (`google/gemini-2.5-flash-lite`) **ตรงจากฝั่งเบราว์เซอร์** โดยอ่านคีย์จาก `window.PP_AI_KEY` (ไฟล์ `assets/js/ai-secrets.js` ที่กันไว้ด้วย `.gitignore` ไม่ให้หลุดขึ้น GitHub) แต่ตัวคีย์เองยังถูกส่งออกไปในทุก request ที่เบราว์เซอร์ยิงตรงไป OpenRouter — ใครก็ตามที่เปิด DevTools ดู Network tab ตอนแอปที่ deploy จริงเรียก AI จะเห็นคีย์ได้ทันที ต่อให้ไม่โผล่ใน repo

**ต้องทำใน Module 3:** ย้ายการเรียก OpenRouter ไปอยู่หลัง backend/serverless function (เช่น Firebase Cloud Functions) ที่เก็บคีย์เป็น environment variable ฝั่งเซิร์ฟเวอร์ ให้เบราว์เซอร์เรียกเฉพาะ endpoint ของเราเอง ไม่ใช่เรียก OpenRouter ตรง

## 2. ฟีเจอร์ที่ยังไม่ได้ทำ

**หมายเหตุ:** โปรเจกต์นี้ไม่มีไฟล์ "Feature List" ของ Module 1 แยกต่างหากในระบบ (และไม่มี `SCOPE.md` จากการบ้านที่ 1 ด้วย) รายการด้านล่างจึงมาจากช่องว่างที่ระบุไว้ชัดเจนแล้วใน `MODULE2_SPEC.md`/`ACL.md`/`CLAUDE.md` แทน:

- **ข้อมูลหลักของแอป (teams/milestones/submissions/feedbacks ฯลฯ) ยังอยู่ใน `localStorage` ทั้งหมด** ไม่ได้ต่อกับ Firestore จริง — มีแค่ฟีเจอร์ Help Request เดียวที่ผ่าน Firestore จริง ถ้าจะทำให้ระบบใช้งานได้จริงกับผู้ใช้หลายคนพร้อมกัน ต้อง migrate ทั้งชั้นข้อมูลนี้ไป Firestore (ดูรายการ collection ที่ `store.js` implied ไว้ใน `CLAUDE.md`)
- **Demo role-switcher ยังไม่ใช่ auth จริง** — การสลับบทบาทนิสิต/อาจารย์ผ่านปุ่ม "Demo" บน header เป็น UI convenience (`localStorage`) ไม่ใช่ security boundary ต้องแทนที่ด้วย Firebase Auth จริงทั้งระบบถ้าจะ production-ready
- **AI checklist drafting / agentic team summary** เป็น fallback-first (ใช้ AI ได้ก็ต่อเมื่อมีคีย์ตั้งไว้) — ยังไม่มี retry/rate-limit handling ที่ดีพอสำหรับการใช้งานจริง
- **ไฟล์แนบ** (attachment) ทั้งระบบยังเป็นการจำลอง (`prompt()`/`input.files[0].name`) ไม่มีการอัปโหลดไฟล์จริง — ต้องต่อ Firebase Storage ถ้าจะใช้งานจริง

## 3. สิ่งที่เทสต์จับได้แต่ยังไม่ได้แก้

- **บัญชีอาจารย์ยังไม่ผูกกับ record ใน `advisors` collection** (ระบุไว้ใน `ACL.md` ว่าเป็น "known gap, deliberate, not yet built") — ผลคือบัญชีอาจารย์คนใดก็ตามเห็น/อนุมัติ/ปฏิเสธ **help request ของทุกทีม** ได้หมด ไม่ใช่แค่ทีมที่ตัวเองดูแล ชุดเทสต์ #5 ตรวจแค่ "บัญชีนิสิตคนที่สองเปิดของคนแรกไม่ได้" ไม่ได้ครอบคลุมมุมนี้ — ควรเพิ่มเทสต์และแก้ไขใน Module 3 โดยเพิ่มการ map Firebase Auth uid ↔ advisor record
- **`firebase deploy` (ทั้ง hosting และ firestore:rules) ต้องรันมือทุกครั้งที่แก้โค้ดที่กระทบฟีเจอร์ Help Request** — ไม่มี CI/CD auto-deploy ระหว่างพัฒนา ทำให้เกิดช่วงที่โค้ด local กับเว็บจริงไม่ตรงกัน (เจอจริงระหว่างพัฒนาการบ้านนี้ — เทสต์ #3/#4/#5 รอบแรกติดบล็อกเพราะเหตุนี้ ดู `test-results.md`) ควรตั้ง GitHub Actions ให้ deploy อัตโนมัติเมื่อ merge เข้า main ใน Module 3
