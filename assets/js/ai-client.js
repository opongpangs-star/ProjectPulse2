/*
 * ai-client.js — ตัวช่วยเรียก OpenRouter (google/gemini-2.5-flash-lite) แบบเบา ใช้ร่วมกันได้ทุกหน้าที่มีปุ่ม AI
 * ต้องโหลด assets/js/ai-secrets.js (ไฟล์ที่ .gitignore กันไว้ — ไม่มีไฟล์นี้ = ไม่มีคีย์ = โหมด AI ปิด) ก่อนไฟล์นี้
 * ผู้เรียกมีหน้าที่ fallback เองเมื่อ isAvailable() เป็น false หรือ chat() throw (คีย์ไม่มี/เครือข่ายพัง/timeout)
 */
(function (global) {
  const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
  const MODEL = "google/gemini-2.5-flash-lite";
  const TIMEOUT_MS = 15000;

  function isAvailable() {
    return !!global.PP_AI_KEY;
  }

  async function chat(messages, { temperature = 0.2 } = {}) {
    if (!isAvailable()) throw new Error("ยังไม่ได้ตั้งค่าคีย์ AI (assets/js/ai-secrets.js)");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${global.PP_AI_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({ model: MODEL, messages, temperature }),
      });
      if (!res.ok) throw new Error(`AI request failed: HTTP ${res.status}`);
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI ไม่ตอบกลับเนื้อหา");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  global.PPAI = { isAvailable, chat, MODEL };
})(window);
