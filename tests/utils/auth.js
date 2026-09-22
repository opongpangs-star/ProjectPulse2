// tests/utils/auth.js — shared helper for the two Firebase-Auth test accounts.
// Both accounts are throwaway test accounts created purely for this test suite —
// not real users, no secrets. Signs up if the account doesn't exist yet, otherwise
// falls back to signing in (handles "email already in use" from a previous test run).

async function signUpOrSignIn(page, email, password) {
  await page.goto("/pages/signup.html");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#signupForm button[type=submit]").click();

  const result = await Promise.race([
    page.waitForURL(/help-request-list\.html/, { timeout: 15000 }).then(() => "signed-up"),
    page.locator("#errorBox .alert-danger").waitFor({ state: "visible", timeout: 15000 }).then(() => "error"),
  ]).catch(() => "timeout");

  if (result === "signed-up") return;

  await page.goto("/pages/login.html");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#loginForm button[type=submit]").click();
  await page.waitForURL(/help-request-list\.html/, { timeout: 15000 });
}

module.exports = { signUpOrSignIn };
