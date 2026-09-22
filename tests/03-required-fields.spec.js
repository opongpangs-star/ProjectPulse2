// 03-required-fields.spec.js — ช่องบังคับกรอก: ฟอร์มสร้างคำร้องขอความช่วยเหลือ (help-request-new.html)
// อ้างอิง MODULE2_SPEC.md ข้อ 3: "ทีม, ประเภทคำร้อง, ข้อความ ต้องกรอกครบก่อนบันทึกได้"
// ฟีเจอร์นี้ใช้ Firebase Auth จริง (security boundary จริงหนึ่งเดียวในระบบ) ต้องล็อกอินก่อนเข้าหน้าได้

const { test, expect } = require("@playwright/test");
const { signUpOrSignIn } = require("./utils/auth");

const TEST_EMAIL = "pp-test-a@example.com";
const TEST_PASSWORD = "TestPass123!";

test("กรอกฟอร์มคำร้องไม่ครบ (เว้นข้อความ) แล้วห้ามบันทึก", async ({ page }) => {
  await signUpOrSignIn(page, TEST_EMAIL, TEST_PASSWORD);

  await page.goto("/pages/help-request-new.html");
  await expect(page.locator("#reqForm")).toBeVisible({ timeout: 15000 });

  // รอให้ทีมโหลดมาจาก Firestore ก่อนเลือก
  await expect(page.locator("#teamSelect option").nth(1)).toBeAttached({ timeout: 15000 });
  await page.locator("#teamSelect").selectOption({ index: 1 });
  await page.locator("#typeSelect").selectOption("consult");
  await page.locator("#nameInput").fill("QA Tester A");
  // จงใจเว้น #messageInput ว่างไว้ (ช่องบังคับกรอกที่ต้องทดสอบ)

  const urlBeforeSubmit = page.url();
  await page.locator("#btnSubmit").click();

  // HTML5 required ต้องกันไม่ให้ submit event ยิงออก -> ต้อง "ไม่" redirect ไปหน้า list
  await page.waitForTimeout(1000); // ให้เวลาพอที่ถ้า redirect จริงจะทันเห็น
  expect(page.url()).toBe(urlBeforeSubmit);
  await expect(page).not.toHaveURL(/help-request-list\.html/);

  // ฟอร์ม validation ต้องรายงานว่า messageInput ไม่ผ่าน (native HTML5 required)
  const isMessageValid = await page.locator("#messageInput").evaluate((el) => el.checkValidity());
  expect(isMessageValid).toBe(false);
  const validationMessage = await page.locator("#messageInput").evaluate((el) => el.validationMessage);
  expect(validationMessage.length).toBeGreaterThan(0);
});
