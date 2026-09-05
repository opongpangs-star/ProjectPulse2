// การตั้งค่าการเชื่อมต่อ Firebase/Firestore ของโปรเจกต์ projectpulse2
// ใช้ร่วมกันทั้งหน้า seed ข้อมูลตัวอย่างและหน้าที่อ่านข้อมูลจริงจาก Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGyTSG8rnEwjC0LDF2-Ruhay1T3172c10",
  authDomain: "projectpulse2-eb313.firebaseapp.com",
  projectId: "projectpulse2-eb313",
  storageBucket: "projectpulse2-eb313.firebasestorage.app",
  messagingSenderId: "202400130360",
  appId: "1:202400130360:web:3d988ba0a00e3ded770dcd",
  measurementId: "G-36YNF1RYVZ",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
