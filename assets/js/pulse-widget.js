/*
 * pulse-widget.js — Gamification: แปลง Project Health Score ให้เป็น "ชีพจร" ที่มองเห็นได้จริง
 * ทีมยิ่งช้า/ติดปัญหา ชีพจรยิ่งเต้นอ่อนและช้าลงจนเกือบหยุด — สร้างความเร่งด่วนแบบเกม
 * ย้ำ: ใช้เพื่อสร้างแรงจูงใจเท่านั้น ไม่มีผลต่อคะแนนหรือการประเมินผลทางวิชาการใด ๆ
 */
(function (global) {
  // Project Pulse — 4 ระดับ: Strong / Steady / Weak / Dormant เสมอแสดงไอคอน+สี+ข้อความ (ไม่ใช้สีอย่างเดียว)
  const RHYTHM_META = {
    strong: { bpm: 82, duration: "1s", color: "var(--pp-green-600)", label: "Strong — ahead of schedule", faceEmoji: "⬆️" },
    steady: { bpm: 68, duration: "1.6s", color: "var(--pp-yellow-700)", label: "Steady — on track", faceEmoji: "➡️" },
    weak: { bpm: 50, duration: "2.6s", color: "var(--pp-orange-700)", label: "Weak — behind schedule", faceEmoji: "⬇️" },
    dormant: { bpm: 22, duration: "4.5s", color: "var(--pp-red-700)", label: "Dormant — no recent activity", faceEmoji: "⏸" },
  };

  function buildEcgPath(amplitude, cycles) {
    const segW = 100;
    let d = "M0,20";
    for (let i = 0; i < cycles; i++) {
      const x = i * segW;
      d += ` L${x + 18},20 L${x + 23},${20 - amplitude * 0.4} L${x + 28},${20 + amplitude} L${x + 33},${20 - amplitude * 1.6} L${x + 38},${20 + amplitude * 0.8} L${x + 44},20 L${x + segW},20`;
    }
    return d;
  }

  const AMPLITUDE_BY_RHYTHM = { strong: 15, steady: 10, weak: 6, dormant: 2 };

  // การ์ตูนกราฟชีพจรแบบ ECG ที่ scroll วนไม่รู้จบ ความเร็ว/แอมพลิจูดเปลี่ยนตามระดับสุขภาพโครงงาน
  function heartbeatSVG(rhythm, opts = {}) {
    const meta = RHYTHM_META[rhythm] || RHYTHM_META.strong;
    const amp = AMPLITUDE_BY_RHYTHM[rhythm];
    const cycles = 5;
    const width = cycles * 100;
    const path = buildEcgPath(amp, cycles);
    const height = opts.height || 56;
    const uid = `ecg${Math.random().toString(36).slice(2, 8)}`;
    return `
      <div class="pulse-ecg" role="img" aria-label="${meta.label}">
        <svg viewBox="0 0 200 40" preserveAspectRatio="none" style="width:100%;height:${height}px;overflow:hidden;display:block;">
          <g class="pulse-ecg-track-${uid}" style="animation: pulse-ecg-scroll ${meta.duration} linear infinite;">
            <path d="${path}" fill="none" stroke="${meta.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
            <path d="${path}" fill="none" stroke="${meta.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(${width},0)" />
          </g>
        </svg>
        <style>.pulse-ecg-track-${uid}{ transform-box: fill-box; }</style>
      </div>`;
  }

  function pulseSummary(pulse) {
    const meta = RHYTHM_META[pulse.rhythm] || RHYTHM_META.strong;
    return `
      <div class="pulse-widget pulse-widget--${pulse.rhythm}">
        <div class="pulse-widget__hd">
          <span class="pulse-widget__face">${meta.faceEmoji}</span>
          <div>
            <div class="pulse-widget__label">${meta.label}</div>
            <div class="pulse-widget__bpm">${meta.bpm} BPM (จำลอง) · Health Score ${pulse.score}/100</div>
          </div>
          ${pulse.streakDays > 0 ? `<div class="streak-badge">🔥 ${pulse.streakDays} วันติดต่อกัน</div>` : `<div class="streak-badge streak-badge--broken">🌱 เริ่มใหม่วันนี้ได้เสมอ</div>`}
        </div>
        ${heartbeatSVG(pulse.rhythm)}
      </div>`;
  }

  function badgeRow(badges) {
    if (!badges.length) {
      return `<div class="text-xs text-muted">ยังไม่ปลดล็อกความสำเร็จ — ลองอัปเดตงานต่อเนื่องหรือมอบหมายงานให้ครบทุกคนดูสิ!</div>`;
    }
    return `<div class="badge-row">${badges.map((b) => `<span class="badge-chip" title="${b.label}">${b.icon} ${b.label}</span>`).join("")}</div>`;
  }

  // Micro-animation ตอนทำงานสำเร็จ (ติ๊กงานย่อย/ส่งหลักฐาน/ส่งงาน ฯลฯ) — ให้ผลตอบรับทันที
  // เพื่อสร้างแรงจูงใจเท่านั้น ไม่มีผลต่อคะแนน/การประเมินผล และใช้เฉพาะฝั่งนิสิตเท่านั้น (ไม่ใช้ในหน้าอาจารย์)
  function burst(message) {
    let layer = document.getElementById("pulseBurstLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "pulseBurstLayer";
      layer.className = "pulse-burst-layer";
      document.body.appendChild(layer);
    }
    const el = document.createElement("div");
    el.className = "pulse-burst";
    el.innerHTML = `<span class="pulse-burst__heart">💓</span><span>${message || "เยี่ยม! ชีพจรเต้นแรงขึ้น"}</span>`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  global.PPPulse = { RHYTHM_META, heartbeatSVG, pulseSummary, badgeRow, burst };
})(window);
