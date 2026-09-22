// 05-second-account-isolation.spec.js — บัญชีที่สองเปิดของบัญชีแรกไม่ได้
// อ้างอิง MODULE2_SPEC.md ข้อ 4: "บัญชีนิสิตคนที่สองต้องเห็นเฉพาะคำร้องของตัวเอง (createdByUid ของตน)
// เปิดของคนอื่นไม่ได้ ตามที่กำหนดใน Firestore Rules + ACL.md"
//
// *** หมายเหตุสำคัญ ***
// firestore.rules ในโค้ดถูกแก้ไว้แล้วให้บังคับ ACL นี้จริง แต่ยัง "deploy ไม่สำเร็จ" ไปยัง
// https://projectpulse2-eb313.web.app (ติด permission ของระบบ ผู้ใช้ต้อง deploy เองภายหลัง)
// เว็บที่ deploy จริงตอนนี้จึงยังใช้กฎเก่าที่หลวมกว่า — เทสต์นี้จึงมีโอกาสสูงที่จะ FAIL จริง
// ซึ่งเป็นผลที่ถูกต้อง (สะท้อนช่องโหว่จริงที่ยังไม่ได้ปิด) ไม่ใช่เทสต์เขียนผิด — ห้ามแก้เทสต์ให้ผ่านเอง

const { test, expect } = require("@playwright/test");
const { signUpOrSignIn } = require("./utils/auth");

const ACCOUNT_A = { email: "pp-test-a@example.com", password: "TestPass123!" };
const ACCOUNT_B = { email: "pp-test-b@example.com", password: "TestPass123!" };

// unique string ฝังไว้ในข้อความของ A เพื่อค้นหาแบบเจาะจงได้ในภายหลัง (ไม่ชนกับ run อื่นก่อนหน้า)
const UNIQUE_MARKER = `ISOLATION-TEST-${Date.now()}`;

test("บัญชี B ต้องไม่เห็นคำร้องที่บัญชี A สร้าง", async ({ browser }) => {
  // --- บัญชี A: สร้าง help request ใหม่ด้วยข้อความที่มี marker เฉพาะตัว ---
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await signUpOrSignIn(pageA, ACCOUNT_A.email, ACCOUNT_A.password);

  await pageA.goto("/pages/help-request-new.html");
  await expect(pageA.locator("#reqForm")).toBeVisible({ timeout: 15000 });
  await expect(pageA.locator("#teamSelect option").nth(1)).toBeAttached({ timeout: 15000 });
  await pageA.locator("#teamSelect").selectOption({ index: 1 });
  await pageA.locator("#typeSelect").selectOption("other");
  await pageA.locator("#nameInput").fill("QA Tester A");
  await pageA.locator("#messageInput").fill(UNIQUE_MARKER);
  await pageA.locator("#btnSubmit").click();
  await pageA.waitForURL(/help-request-list\.html/, { timeout: 15000 });

  // ยืนยันว่า A เห็นคำร้องของตัวเอง (sanity check ก่อนตรวจ isolation)
  await expect(pageA.locator("#listContent")).toContainText(UNIQUE_MARKER, { timeout: 15000 });
  await contextA.close();

  // --- บัญชี B: context ใหม่ทั้งหมด (ไม่มี auth state ของ A หลงเหลือ) ---
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await signUpOrSignIn(pageB, ACCOUNT_B.email, ACCOUNT_B.password);

  await pageB.goto("/pages/help-request-list.html");
  await expect(pageB.locator("#listContent")).toBeVisible({ timeout: 15000 });
  // รอให้ list โหลดเสร็จจริง (ไม่ใช่ skeleton ค้าง)
  await expect(pageB.locator("#listContent .skeleton")).toHaveCount(0, { timeout: 15000 });

  // *** จุดยืนยันช่องโหว่ / ACL ***
  // ถ้า Firestore Rules บังคับ createdByUid จริง (ตามที่แก้ไว้แล้วแต่ยัง deploy ไม่สำเร็จ)
  // ข้อความของ A (UNIQUE_MARKER) ต้องไม่ปรากฏใน DOM ของบัญชี B เลย
  const listTextB = await pageB.locator("#listContent").innerText();
  expect(listTextB).not.toContain(UNIQUE_MARKER);

  await contextB.close();
});
