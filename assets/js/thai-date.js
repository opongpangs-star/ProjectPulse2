/*
 * thai-date.js — Thai Buddhist-calendar date helpers for ProjectPulse.
 * ทุกวันที่ในระบบใช้ ISO string (YYYY-MM-DD หรือ YYYY-MM-DDTHH:mm) เป็น "ค่าเก็บ"
 * แล้วแปลงเป็นข้อความไทย/พ.ศ. เฉพาะตอนแสดงผลเท่านั้น เพื่อให้เชื่อมต่อฐานข้อมูล/ปฏิทินจริงได้ในอนาคต
 */
(function (global) {
  const THAI_MONTHS_FULL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const THAI_MONTHS_SHORT = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  const THAI_DOW_FULL = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
  const THAI_DOW_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

  function toDate(d) {
    if (d instanceof Date) return d;
    if (typeof d === "string") {
      // รองรับ "YYYY-MM-DD" แบบไม่ผูก timezone เพื่อไม่ให้วันเลื่อน
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
      if (m) {
        return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
      }
      return new Date(d);
    }
    return new Date(d);
  }

  function toBE(year) { return year + 543; }

  function formatThaiDate(d, opts = {}) {
    const date = toDate(d);
    const { withDow = false, short = false, withYear = true } = opts;
    const day = date.getDate();
    const month = short ? THAI_MONTHS_SHORT[date.getMonth()] : THAI_MONTHS_FULL[date.getMonth()];
    const year = toBE(date.getFullYear());
    let out = `${day} ${month}`;
    if (withYear) out += ` ${short ? "" : "พ.ศ. "}${year}`;
    if (withDow) out = `${THAI_DOW_FULL[date.getDay()]}ที่ ${out}`;
    return out;
  }

  function formatThaiDateTime(d) {
    const date = toDate(d);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${formatThaiDate(date)} เวลา ${hh}.${mm} น.`;
  }

  function formatThaiShort(d) {
    const date = toDate(d);
    return `${date.getDate()} ${THAI_MONTHS_SHORT[date.getMonth()]} ${String(toBE(date.getFullYear())).slice(-2)}`;
  }

  function dowShort(d) { return THAI_DOW_SHORT[toDate(d).getDay()]; }

  function startOfDay(d) { const x = toDate(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()); }

  function diffDays(a, b) {
    const A = startOfDay(a).getTime();
    const B = startOfDay(b).getTime();
    return Math.round((A - B) / 86400000);
  }

  function addDays(d, n) { const x = toDate(d); const r = new Date(x); r.setDate(r.getDate() + n); return r; }

  function toISODate(d) {
    const x = toDate(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function relativeDaysLabel(targetDate, fromDate) {
    const n = diffDays(targetDate, fromDate);
    if (n === 0) return "วันนี้";
    if (n === 1) return "พรุ่งนี้";
    if (n === -1) return "เมื่อวาน";
    if (n > 1) return `อีก ${n} วัน`;
    return `เลยมาแล้ว ${Math.abs(n)} วัน`;
  }

  function waitingDaysLabel(n) {
    if (n <= 0) return "เพิ่งส่งวันนี้";
    return `รอตรวจมาแล้ว ${n} วัน`;
  }

  global.ThaiDate = {
    THAI_MONTHS_FULL, THAI_MONTHS_SHORT, THAI_DOW_FULL, THAI_DOW_SHORT,
    toDate, toBE, formatThaiDate, formatThaiDateTime, formatThaiShort,
    dowShort, startOfDay, diffDays, addDays, toISODate, relativeDaysLabel, waitingDaysLabel,
  };
})(window);
