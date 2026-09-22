// 02-status-change.spec.js — ปุ่มเปลี่ยนสถานะ: การตัดสินผล "ผ่าน" (passed) ใน review-feedback.html
// อ้างอิง MODULE2_SPEC.md ข้อ 2: "ปุ่มตัดสินผลใน review-feedback.html (PP.giveFeedback -> decision: passed/revise/need_info)"
//
// ใช้ seed data ที่มีอยู่แล้ว: ทีม t01 ("ทีมข่วงศิลป์") advisor adv1 มี currentStatus: "submitted"
// อยู่แล้วตาม seed-data.js — ไม่ต้องส่งงานใหม่

const { test, expect } = require("@playwright/test");

const TEAM_ID = "t01";
const ADVISOR_ID = "adv1";
const FEEDBACK_TEXT = `เทสต์อัตโนมัติ status-change — งานผ่านมาตรฐาน ${Date.now()}`;

test("อาจารย์กดปุ่มผ่าน Milestone แล้วสถานะเปลี่ยนเป็น passed จริง", async ({ page }) => {
  // เคลียร์ localStorage ให้ reseed สะอาด แล้วตั้งตัวเองเป็นอาจารย์ของทีม t01
  await page.goto("/pages/feedback-queue.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate((advisorId) => {
    PP.setCurrentAdvisor(advisorId);
  }, ADVISOR_ID);
  await page.reload();

  // หา submission ที่รอตรวจอยู่แล้วของทีม t01 จาก seed data
  const submissionId = await page.evaluate((teamId) => {
    const sub = PP.getSubmissionsByTeam(teamId).find((s) => s.status === "submitted");
    return sub ? sub.id : null;
  }, TEAM_ID);
  expect(submissionId, "ต้องมี submission สถานะ submitted อยู่แล้วในทีม t01 จาก seed data").toBeTruthy();

  // เปิดหน้าตรวจงานของ submission นั้นโดยตรง
  await page.goto(`/pages/review-feedback.html?sub=${submissionId}`);
  await expect(page.locator("#reviewBody")).toBeVisible();

  // ต้องกรอกข้อความ Feedback ก่อน ไม่งั้นปุ่มตัดสินใจจะเตือนแล้วไม่บันทึก (ดู onDecision() ใน review-feedback.js)
  await page.locator("#rawTextInput").fill(FEEDBACK_TEXT);

  // กดปุ่มตัดสินผล "ผ่าน Milestone"
  await page.locator('[data-decision="passed"]').click();

  // toast ยืนยันผลการบันทึก
  await expect(page.locator(".toast")).toContainText("บันทึกผล: ผ่าน Milestone แล้ว");

  // assert ระดับ data: PP.getFeedbackBySubmission ต้องคืน decision: "passed" พร้อม rawText ที่กรอกไป
  const feedback = await page.evaluate((subId) => PP.getFeedbackBySubmission(subId), submissionId);
  expect(feedback).toBeTruthy();
  expect(feedback.decision).toBe("passed");
  expect(feedback.rawText).toBe(FEEDBACK_TEXT);

  // หน้าควรพากลับไปที่คิวงานรอตรวจหลังบันทึกสำเร็จ (setTimeout 1100ms ใน onDecision())
  await page.waitForURL(/feedback-queue\.html/, { timeout: 5000 });
});
