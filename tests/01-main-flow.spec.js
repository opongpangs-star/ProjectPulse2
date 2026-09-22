// 01-main-flow.spec.js — เส้นทางหลักของ Module 2:
// นิสิตส่งงาน (submission) -> เห็นอยู่ในคิวของอาจารย์ (feedback-queue.html)
// อ้างอิง MODULE2_SPEC.md หัวข้อ "เส้นทางหลัก / ปุ่มเปลี่ยนสถานะ / ช่องบังคับกรอก" ข้อ 1.
//
// Demo identity (PP.setCurrentTeam/setCurrentAdvisor) เป็นแค่ localStorage role-switcher
// ไม่ใช่ security boundary (ตาม CLAUDE.md/MODULE2_SPEC.md) จึงเรียกผ่าน page.evaluate ได้ตรง ๆ
// แต่การ "ส่งงาน" เองต้องทำผ่าน UI จริง (กรอกฟอร์ม + กดปุ่ม) ตามที่ผู้ว่าจ้างระบุ
//
// ทีมที่ใช้: t02 ("ทีมพะเยาว้าว", advisor adv1, currentStatus: "in_progress" ตาม seed-data.js)
// เลือกทีมนี้เพราะ Milestone ปัจจุบันไม่ได้อยู่ในสถานะที่ BLOCKED_SUBMIT_STATUSES กันไว้
// (submitted/reviewing/passed/done) จึงส่งงานใหม่ได้ทันทีโดยไม่ต้องเคลียร์สถานะเดิมก่อน

const { test, expect } = require("@playwright/test");

const TEAM_ID = "t02";
const TEAM_NAME = "ทีมพะเยาว้าว";
const ADVISOR_ID = "adv1";
const NOTE_TEXT = `เทสต์อัตโนมัติ main-flow ${Date.now()}`;

test("นิสิตส่งงานแล้วอาจารย์เห็นงานในคิวรอตรวจ", async ({ page }) => {
  // 1) เคลียร์ localStorage ให้ reseed สะอาด แล้วตั้งตัวเองเป็นนิสิตของทีม t02
  await page.goto("/pages/task-detail.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate((teamId) => {
    PP.setCurrentTeam(teamId);
  }, TEAM_ID);
  await page.reload();

  // sanity check: หน้านี้ต้องเป็นมุมมองนิสิต ไม่ใช่ empty-state ของบทบาทผิด
  await expect(page.locator("#milestoneTitle")).toBeVisible();

  // 2) ส่งงานจริงผ่าน UI: กรอกหมายเหตุ แล้วกดปุ่มส่งงานเข้าคิวตรวจ
  await page.locator("#noteInput").fill(NOTE_TEXT);
  await page.locator("#btnSubmitMilestone").click();

  // toast ยืนยันว่าระบบรับการส่งงานแล้ว
  await expect(page.locator(".toast")).toContainText("ส่งงานเข้าคิวตรวจแล้ว");

  // ฟอร์มต้องถูก disable ทันทีเพราะสถานะเปลี่ยนเป็น submitted (ห้ามส่งซ้ำ)
  // หมายเหตุ: เช็คที่ปุ่ม/input ลูกของ fieldset แทนตัว <fieldset> เอง เพราะตาม HTML spec
  // fieldset[disabled] ไม่ match :disabled ที่ตัวมันเอง (มีผลแค่กับ descendant form controls)
  await expect(page.locator("#btnSubmitMilestone")).toBeDisabled();
  await expect(page.locator("#noteInput")).toBeDisabled();
  const fieldsetDisabledProp = await page.locator("#submitFieldset").evaluate((el) => el.disabled);
  expect(fieldsetDisabledProp).toBe(true);

  // 3) ยืนยันด้วย store จริงว่ามี submission ใหม่ของทีมนี้ สถานะ submitted และหมายเหตุตรงกับที่กรอก
  const newSubmission = await page.evaluate((teamId) => {
    const subs = PP.getSubmissionsByTeam(teamId).filter((s) => s.status === "submitted");
    return subs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
  }, TEAM_ID);
  expect(newSubmission).toBeTruthy();
  expect(newSubmission.note).toBe(NOTE_TEXT);

  // 4) สลับมาเป็นอาจารย์ที่ปรึกษาของทีมนี้ แล้วเปิดคิวงานรอตรวจ
  await page.evaluate((advisorId) => {
    PP.setCurrentAdvisor(advisorId);
  }, ADVISOR_ID);
  await page.goto("/pages/feedback-queue.html");

  // 5) assert ว่าเห็นงานที่เพิ่งส่งอยู่ในคิว — ชื่อทีมต้องปรากฏในตารางคิว
  const queueWrap = page.locator("#queueTableWrap");
  await expect(queueWrap).toContainText(TEAM_NAME);

  // แถวของทีมนี้ต้องมีลิงก์ไปตรวจงานที่ชี้ไปยัง submission id ที่เพิ่งสร้าง
  // (แต่ละแถวมีปุ่มลิงก์ซ้ำ 3 ปุ่มที่ชี้ไป submission เดียวกัน — ✍️ ส่ง Feedback / 🔁 ให้แก้ไข / ✅ ผ่าน Milestone
  // เจตนาให้อาจารย์กดปุ่มไหนก็ได้เพื่อเข้าไปตัดสินใจในหน้าเดียวกัน — เช็คแค่ว่ามีอย่างน้อย 1 ลิงก์ชี้ไปถูก id)
  const reviewLinks = page.locator(`a[href*="review-feedback.html?sub=${newSubmission.id}"]`);
  await expect(reviewLinks.first()).toBeVisible();
  await expect(reviewLinks).toHaveCount(3);
});
