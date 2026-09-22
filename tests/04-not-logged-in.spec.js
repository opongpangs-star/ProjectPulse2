// 04-not-logged-in.spec.js — จุดที่ต้องล็อกอิน (security boundary จริง)
// อ้างอิง MODULE2_SPEC.md ข้อ 4: "help-request-new.html, help-request-list.html — ไม่ล็อกอินเปิดไม่ได้
// (requireAuth() เด้งไป login.html)"
//
// ใช้ browser context ใหม่ (Playwright สร้าง context ใหม่ให้อัตโนมัติต่อ test) ไม่มี auth state ใด ๆ

const { test, expect } = require("@playwright/test");

test("เปิด help-request-list.html โดยไม่ล็อกอิน ต้องถูกเด้งไป login.html", async ({ page }) => {
  await page.goto("/pages/help-request-list.html");

  await page.waitForURL(/login\.html/, { timeout: 15000 });
  expect(page.url()).toContain("login.html");
  expect(page.url()).toContain("returnTo=help-request-list.html");

  // ต้องไม่เห็นเนื้อหารายการคำร้องใด ๆ หลุดออกมาก่อน redirect
  await expect(page.locator("#loginForm")).toBeVisible();
});

test("เปิด help-request-new.html โดยไม่ล็อกอิน ต้องถูกเด้งไป login.html", async ({ page }) => {
  await page.goto("/pages/help-request-new.html");

  await page.waitForURL(/login\.html/, { timeout: 15000 });
  expect(page.url()).toContain("login.html");
  expect(page.url()).toContain("returnTo=help-request-new.html");

  await expect(page.locator("#loginForm")).toBeVisible();
});
