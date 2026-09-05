// auth-guard.js — ใช้ร่วมกันทุกหน้าที่ต้อง "ล็อกอินก่อนถึงจะเข้าได้จริง" (advisor-change-*.html)
// รอสถานะล็อกอินให้พร้อมก่อนเสมอ (onAuthStateChanged) แล้วค่อยอ่าน Firestore — ไม่งั้นจะเจอ
// หน้าว่างเปล่าหรือ permission-denied เพราะอ่านข้อมูลไปก่อนที่ Firebase จะรู้ว่าใครล็อกอินอยู่
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function requireAuth(returnPath) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const loginUrl = "login.html" + (returnPath ? `?returnTo=${encodeURIComponent(returnPath)}` : "");
        window.location.replace(loginUrl);
        return;
      }
      let role = "student";
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().role) role = snap.data().role;
      } catch (err) {
        // ถ้าอ่านไม่ได้ (เช่น กฎยังไม่อนุญาต) ให้ตกลงเป็น "student" (สิทธิ์น้อยที่สุด) ไว้ก่อน ไม่ใช่ล้มทั้งหน้า
      }
      resolve({ user, role });
    });
  });
}

// Header เล็ก ๆ แสดงอีเมลที่ล็อกอินอยู่ + ปุ่มออกจากระบบ — ใส่ไว้บนสุดของเนื้อหาหน้าที่ต้องล็อกอิน
export function renderAuthBar(container, user) {
  container.innerHTML = `
    <div class="flex items-center justify-between" style="margin-bottom:var(--pp-space-4);flex-wrap:wrap;gap:8px;">
      <span class="text-sm text-muted">Signed in as <strong>${user.email}</strong></span>
      <button class="btn btn-outline btn-sm" id="btnLogout">Log out</button>
    </div>`;
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}
