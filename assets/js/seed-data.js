/*
 * seed-data.js — ข้อมูลจำลองสำหรับ ProjectPulse Prototype
 * 1 รายวิชา / 1 ภาคการศึกษา 16 สัปดาห์ / นิสิต 10 ทีม / อาจารย์ 2 คน
 * วันที่ทั้งหมดคำนวณ "สัมพัทธ์กับวันนี้" เพื่อให้ demo ดูสมจริงไม่ว่าจะเปิดวันไหน
 * โครงสร้างนี้ออกแบบให้ map เข้ากับตาราง DB จริง (teams, milestones, submissions, ...) ได้ในอนาคต
 */
(function (global) {
  const TD = global.ThaiDate;
  const addDays = TD.addDays, iso = TD.toISODate;
  // เพิ่มเลขนี้ทุกครั้งที่แก้ไขข้อมูลตัวอย่างแบบมีนัยสำคัญ (ชื่ออาจารย์, จำนวนทีม, ฯลฯ)
  // เพื่อให้ store.js รู้ว่าต้อง reseed ใหม่ทับข้อมูลเก่าที่ค้างอยู่ใน localStorage ของผู้ใช้โดยอัตโนมัติ
  const SEED_VERSION = 6;

  const now = new Date(); // เวลาจริง ณ ตอนโหลด — ใช้กับกรณีที่ต้องคำนวณ "ภายใน N ชั่วโมง" แบบละเอียด (เช่น Deadline Collision)
  const today = new Date();
  today.setHours(9, 0, 0, 0); // ปักหมุดเป็นเวลา 09:00 ของวันนี้ — ใช้กับการคำนวณระดับ "วัน" (Milestone, ปฏิทินภาคเรียน) ที่ไม่สนใจนาที/ชั่วโมงละเอียด

  // วันเริ่มภาคการศึกษาคงที่ (ไม่ขยับตาม "วันนี้" อีกต่อไป) — สัปดาห์ปัจจุบันคำนวณไปข้างหน้าจากวันนี้จริง
  // ที่ store.js's getCourse() เสมอ (ไม่ค้างเป็นค่าคงที่ตั้งแต่ตอน seed) แล้ว clamp ไว้ในช่วง [1, SEMESTER_WEEKS]
  const SEMESTER_WEEKS = 16;
  const SEMESTER_START = new Date(2026, 6, 13); // 13 กรกฎาคม 2569 (เดือนใน JS Date เริ่มนับที่ 0)
  const SEMESTER_END = addDays(SEMESTER_START, SEMESTER_WEEKS * 7 - 1);
  const SEMESTER_YEAR_BE = SEMESTER_START.getFullYear() + 543;

  function weekStart(w) { return addDays(SEMESTER_START, (w - 1) * 7); }
  function weekEnd(w) { return addDays(SEMESTER_START, w * 7 - 1); }
  function atTime(d, h, m) { const x = new Date(d); x.setHours(h, m, 0, 0); return x; }

  // -------------------------------------------------------------------
  // สถานะมาตรฐาน 10 สถานะ (ใช้ key ภายในระบบ + label ภาษาไทยสำหรับแสดงผล)
  // -------------------------------------------------------------------
  const STATUS_META = {
    not_started: { label: "ยังไม่เริ่ม", chip: "chip-neutral" },
    in_progress: { label: "กำลังดำเนินการ", chip: "chip-progress" },
    ready: { label: "พร้อมส่ง", chip: "chip-ready" },
    submitted: { label: "ส่งแล้ว–รอตรวจ", chip: "chip-waiting" },
    reviewing: { label: "อาจารย์กำลังตรวจ", chip: "chip-reviewing" },
    revise: { label: "ต้องแก้ไข", chip: "chip-revise" },
    need_info: { label: "รอข้อมูลเพิ่มเติม", chip: "chip-info" },
    passed: { label: "ผ่าน Milestone", chip: "chip-passed" },
    blocked: { label: "ติดปัญหา", chip: "chip-blocked" },
    done: { label: "เสร็จสมบูรณ์", chip: "chip-done" },
  };
  const STATUS_ORDER = Object.keys(STATUS_META);

  // -------------------------------------------------------------------
  // นิยาม Micro-Milestone 10 รายการ (คงที่ตลอดทั้งระบบ)
  // -------------------------------------------------------------------
  const MILESTONE_DEFS = [
    { order: 1, key: "topic_approval", name: "อนุมัติหัวข้อ", startWeek: 1, endWeek: 2 },
    { order: 2, key: "concept", name: "พัฒนาแนวคิด", startWeek: 2, endWeek: 3 },
    { order: 3, key: "proposal", name: "เขียนข้อเสนอโครงการ", startWeek: 3, endWeek: 5 },
    { order: 4, key: "tools_prep", name: "เตรียมเครื่องมือเก็บข้อมูล", startWeek: 5, endWeek: 6 },
    { order: 5, key: "produce", name: "ลงพื้นที่หรือผลิตสื่อ", startWeek: 6, endWeek: 9 },
    { order: 6, key: "edit", name: "ตัดต่อหรือพัฒนาผลงาน", startWeek: 9, endWeek: 11 },
    { order: 7, key: "qc", name: "ตรวจสอบคุณภาพ", startWeek: 11, endWeek: 12 },
    { order: 8, key: "revise_feedback", name: "แก้ไขตาม Feedback", startWeek: 12, endWeek: 13 },
    { order: 9, key: "final_submit", name: "ส่งผลงานฉบับสมบูรณ์", startWeek: 13, endWeek: 14 },
    { order: 10, key: "present_prep", name: "เตรียมนำเสนอและสอบ", startWeek: 15, endWeek: 16 },
  ];

  const SUBTASK_LIB = {
    topic_approval: ["ระดมหัวข้อโครงงาน 3 แนวทาง", "ปรึกษาอาจารย์ที่ปรึกษาเบื้องต้น", "ส่งแบบฟอร์มขออนุมัติหัวข้อ"],
    concept: ["เขียน Concept Note 1 หน้า", "หาโครงงานอ้างอิง/แรงบันดาลใจ", "กำหนดกลุ่มเป้าหมายและวัตถุประสงค์"],
    proposal: ["เขียนโครงร่างบทที่ 1-3", "ออกแบบระเบียบวิธี/แผนการผลิต", "ทำไทม์ไลน์การทำงานทั้งโครงงาน", "ส่งข้อเสนอโครงการฉบับเต็ม"],
    tools_prep: ["ออกแบบแนวคำถาม/บทสัมภาษณ์", "เตรียมอุปกรณ์ถ่ายทำ/บันทึกเสียง", "ทำหนังสือขออนุญาตเก็บข้อมูล"],
    produce: ["ติดต่อนัดหมายแหล่งข้อมูล", "ลงพื้นที่เก็บข้อมูล/ถ่ายทำ", "สำรองไฟล์ Footage ทุกวัน", "ทำบันทึกรายละเอียด Footage"],
    edit: ["คัดเลือกฟุตเทจ/เนื้อหาหลัก", "ตัดต่อ Rough Cut", "ใส่กราฟิก/เสียงประกอบ"],
    qc: ["ตรวจสอบความถูกต้องของเนื้อหา", "ทดสอบกับกลุ่มตัวอย่าง", "ตรวจสอบคุณภาพเสียง/ภาพ"],
    revise_feedback: ["สรุปประเด็นจาก Feedback", "แก้ไขตามรายการที่ได้รับมอบหมาย", "ส่งฉบับแก้ไขให้อาจารย์ตรวจซ้ำ"],
    final_submit: ["ตรวจทานฉบับสมบูรณ์รอบสุดท้าย", "จัดทำรูปเล่ม/เอกสารประกอบ", "ส่งไฟล์ฉบับสมบูรณ์"],
    present_prep: ["ทำสไลด์นำเสนอ", "ซ้อมนำเสนอในทีม", "เตรียมตอบคำถามกรรมการ"],
  };

  // -------------------------------------------------------------------
  // แม่แบบ Milestone/งานย่อยตามประเภทผลงาน — ทับเฉพาะ "ชื่อ" ของ Milestone และงานย่อยในขั้นผลิต
  // (ไม่แก้ order/key/startWeek/endWeek/จำนวน Milestone เพื่อไม่กระทบฟังก์ชันอื่นที่สมมติโครงสร้างเดียวกันทั้งระบบ)
  // มีผลเฉพาะทีมที่นิสิตสร้างขึ้นเองใหม่เท่านั้น ไม่ย้อนแก้ Milestone ของ 30 ทีมตัวอย่างที่มีอยู่แล้ว
  // -------------------------------------------------------------------
  const MILESTONE_TEMPLATE_OVERRIDES = {
    software: {
      produce: { name: "พัฒนาและทดสอบฟีเจอร์หลัก" },
      edit: { name: "ปรับแต่ง/ทำ QA รอบแรก" },
    },
    design: {
      produce: { name: "ออกแบบและจัดทำชิ้นงาน" },
      edit: { name: "ปรับแต่งภาพ/ข้อมูลให้สมบูรณ์" },
    },
  };
  const SUBTASK_LIB_OVERRIDES = {
    software: {
      produce: ["ออกแบบโครงสร้างข้อมูล/ระบบ", "พัฒนาฟีเจอร์หลักเวอร์ชันแรก", "ทดสอบการใช้งานกับผู้ใช้ตัวอย่าง", "แก้ไขบั๊กที่พบจากการทดสอบ"],
    },
    design: {
      produce: ["รวบรวมและตรวจสอบความถูกต้องของข้อมูล/เนื้อหา", "ออกแบบชิ้นงานฉบับร่าง", "ปรับปรุงตามความเห็นในทีม"],
    },
  };
  const TEMPLATE_KEY_BY_PROJECT_TYPE = {
    "เกมเพื่อการศึกษา": "software",
    "เว็บไซต์เชิงโต้ตอบ": "software",
    "Data Visualization": "design",
    "สื่อ Infographic": "design",
    "Motion Graphic": "design",
  };
  function resolveMilestoneDefs(projectType) {
    const templateKey = TEMPLATE_KEY_BY_PROJECT_TYPE[projectType];
    const overrides = (templateKey && MILESTONE_TEMPLATE_OVERRIDES[templateKey]) || {};
    return MILESTONE_DEFS.map((def) => (overrides[def.key] ? Object.assign({}, def, overrides[def.key]) : def));
  }
  function resolveSubtaskLib(projectType) {
    const templateKey = TEMPLATE_KEY_BY_PROJECT_TYPE[projectType];
    const overrides = (templateKey && SUBTASK_LIB_OVERRIDES[templateKey]) || {};
    return Object.assign({}, SUBTASK_LIB, overrides);
  }

  // -------------------------------------------------------------------
  // อาจารย์ 4 คน (3 ท่านแรกดูแลทีมตัวอย่างท่านละประมาณ 10 ทีม, ท่านที่ 4 เพิ่มเข้ามาใหม่ยังไม่มีทีมตัวอย่าง)
  // -------------------------------------------------------------------
  const advisors = [
    { id: "adv1", name: "ผู้ช่วยศาสตราจารย์ ดร.ณปภา สุวรรณรงค์", initials: "ณส", feedbackSlaDays: 7 },
    { id: "adv2", name: "ผู้ช่วยศาสตราจารย์ ดร.วิวัน สุขเจริญ เกษแก้ว", initials: "วก", feedbackSlaDays: 7 },
    { id: "adv3", name: "ดร.พีรญา รัตนจันท์วงศ์", initials: "พร", feedbackSlaDays: 7 },
    { id: "adv4", name: "รองศาสตราจารย์ ดร.ภัทรา บุรารักษ์", initials: "ภบ", feedbackSlaDays: 7 },
  ];

  // -------------------------------------------------------------------
  // รายวิชา
  // -------------------------------------------------------------------
  const course = {
    id: "mc401",
    code: "NM401",
    name: "โครงงานนิเทศศาสตร์และการสื่อสารสื่อใหม่",
    program: "สาขาวิชาการสื่อสารสื่อใหม่ มหาวิทยาลัยพะเยา",
    semesterLabel: `ภาคการศึกษาที่ 1 ปีการศึกษา ${SEMESTER_YEAR_BE}`,
    weeks: SEMESTER_WEEKS,
    startDate: iso(SEMESTER_START),
    endDate: iso(SEMESTER_END),
    feedbackTargetDays: 7,
  };

  // -------------------------------------------------------------------
  // ทีมนิสิต — แต่ละทีมมี "จังหวะการทำงาน" (pace) ต่างกัน
  // pace delay: onTrack=0, atRisk=10, delayed=21 วัน (เทียบกับกำหนดมาตรฐาน)
  // 10 ทีมแรก (t01–t10) เป็นทีม "เรือธง" ที่คุมสถานการณ์ไว้ละเอียดสำหรับสาธิต use case หลักของสเปก
  // (เวลารอตรวจ 1/3/5/เกิน 7 วัน, ทีมติดปัญหา, feedback→checklist ฯลฯ)
  // ที่เหลือ (t11 เป็นต้นไป) เป็นทีมเสริมที่ generate ตามรูปแบบ (profile) เพื่อให้อาจารย์แต่ละท่านมีทีมในความดูแลครบ ~10 ทีม
  // -------------------------------------------------------------------
  const PACE_DELAY = { onTrack: 0, atRisk: 10, delayed: 21 };

  const FLAGSHIP_TEAMS = [
    {
      id: "t01", name: "ทีมข่วงศิลป์", projectType: "สารคดี", projectName: "เสียงจากดอย",
      advisorId: "adv1", pace: "onTrack", currentOrder: 4, currentStatus: "submitted",
      waitDays: 5, blocksNext: true, health: "yellow",
      members: [
        { name: "ธนวัฒน์ ใจแก้ว", role: "หัวหน้าทีม" },
        { name: "ชลธิชา ปัญญาดี", role: "ตัดต่อ/ผลิตสื่อ" },
        { name: "ภูริณัฐ วงศ์คำ", role: "วิจัย/เก็บข้อมูล" },
      ],
    },
    {
      id: "t02", name: "ทีมพะเยาว้าว", projectType: "แคมเปญโซเชียลมีเดีย", projectName: "เที่ยวพะเยาแบบสโลว์ไลฟ์",
      advisorId: "adv1", pace: "onTrack", currentOrder: 5, currentStatus: "in_progress",
      waitDays: 0, blocksNext: false, health: "green",
      members: [
        { name: "ปาริชาติ ดวงแก้ว", role: "หัวหน้าทีม" },
        { name: "นันทวัฒน์ ทองสุข", role: "ครีเอทีฟ/คอนเทนต์" },
        { name: "กมลชนก อินทร์จันทร์", role: "กราฟิก/ภาพถ่าย" },
      ],
    },
    {
      id: "t03", name: "ทีมกว๊านสตูดิโอ", projectType: "พอดแคสต์", projectName: "คุยกับกว๊าน",
      advisorId: "adv1", pace: "atRisk", currentOrder: 4, currentStatus: "submitted",
      waitDays: 3, blocksNext: true, health: "yellow",
      members: [
        { name: "ศุภกร มณีรัตน์", role: "หัวหน้าทีม" },
        { name: "อภิสรา บุญมา", role: "โปรดิวเซอร์เสียง" },
      ],
    },
    {
      id: "t04", name: "ทีมสายลมเหนือ", projectType: "หนังสั้น", projectName: "ทางกลับบ้าน",
      advisorId: "adv1", pace: "delayed", currentOrder: 3, currentStatus: "blocked",
      waitDays: 0, blocksNext: true, health: "red", inactivityDays: 6,
      members: [
        { name: "วรากร ศรีวิชัย", role: "หัวหน้าทีม/กำกับ" },
        { name: "ธีรดา คำมูล", role: "บทภาพยนตร์" },
        { name: "ณัฐพงษ์ แสงจันทร์", role: "ถ่ายภาพ" },
      ],
    },
    {
      id: "t05", name: "ทีมเฟรมแรก", projectType: "ภาพถ่ายสารคดี", projectName: "หน้ากว๊าน",
      advisorId: "adv1", pace: "onTrack", currentOrder: 5, currentStatus: "submitted",
      waitDays: 1, blocksNext: false, health: "green",
      members: [
        { name: "พิชญา รุ่งเรือง", role: "หัวหน้าทีม" },
        { name: "กิตติภูมิ เจริญสุข", role: "ภาพถ่าย" },
      ],
    },
    {
      id: "t06", name: "ทีมดอยหลวงมีเดีย", projectType: "ซีรีส์วล็อก", projectName: "ชีวิตนิสิตหอใน",
      advisorId: "adv2", pace: "atRisk", currentOrder: 4, currentStatus: "revise",
      waitDays: 0, reviewedDaysAgo: 2, submittedDaysAgo: 6, blocksNext: true, health: "yellow",
      members: [
        { name: "สุพิชญา ทองอินทร์", role: "หัวหน้าทีม" },
        { name: "ปฐมพร วิไลวรรณ", role: "ตัดต่อ" },
        { name: "เอกภพ ชัยมงคล", role: "ถ่ายทำ" },
      ],
    },
    {
      id: "t07", name: "ทีมพิกเซลพะเยา", projectType: "เกมเพื่อการศึกษา", projectName: "กว๊านเควส",
      advisorId: "adv2", pace: "onTrack", currentOrder: 5, currentStatus: "reviewing",
      waitDays: 2, blocksNext: false, health: "green",
      members: [
        { name: "จิรายุ ไชยวงศ์", role: "หัวหน้าทีม/โปรแกรมเมอร์" },
        { name: "ขวัญฤดี พรมมา", role: "กราฟิก/ดีไซน์" },
      ],
    },
    {
      id: "t08", name: "ทีมนนทรีสื่อสาร", projectType: "เว็บไซต์เชิงโต้ตอบ", projectName: "แผนที่ร้านกาแฟพะเยา",
      advisorId: "adv2", pace: "delayed", currentOrder: 3, currentStatus: "submitted",
      waitDays: 9, blocksNext: true, health: "red",
      members: [
        { name: "ปัณณวิชญ์ ทิพย์วงศ์", role: "หัวหน้าทีม/นักพัฒนา" },
        { name: "ณิชากานต์ ศรีบุญเรือง", role: "เนื้อหา/UX" },
      ],
    },
    {
      id: "t09", name: "ทีมอิงดอย", projectType: "แอนิเมชัน", projectName: "ตำนานกว๊านพะเยา",
      advisorId: "adv2", pace: "atRisk", currentOrder: 4, currentStatus: "need_info",
      waitDays: 0, reviewedDaysAgo: 1, submittedDaysAgo: 4, blocksNext: true, health: "yellow",
      members: [
        { name: "รัตนาภรณ์ ใจดี", role: "หัวหน้าทีม" },
        { name: "ธนกฤต หล้าคำ", role: "แอนิเมเตอร์" },
        { name: "มนัสนันท์ คำภีระ", role: "เสียง/ดนตรีประกอบ" },
      ],
    },
    {
      id: "t10", name: "ทีมยูวี ครีเอทีฟ", projectType: "สารคดี", projectName: "ครูดอย",
      advisorId: "adv2", pace: "delayed", currentOrder: 2, currentStatus: "in_progress",
      waitDays: 0, blocksNext: false, health: "red", inactivityDays: 7,
      members: [
        { name: "อรปรียา แก้วมูล", role: "หัวหน้าทีม" },
        { name: "ภาณุวิชญ์ ปินตา", role: "ถ่ายทำ/ตัดต่อ" },
      ],
    },
  ];

  // -------------------------------------------------------------------
  // ทีมเสริม (filler teams) — generate ให้อาจารย์แต่ละท่านมีทีมในความดูแลครบ ~10 ทีม
  // adv1 (ณปภา) และ adv2 (วิวัน) มีทีมเรือธงอยู่แล้ว 5 ทีม จึงเสริมอีกท่านละ 5 ทีม
  // adv3 (พีรญา) เป็นอาจารย์ใหม่ทั้งหมด จึงได้ทีมเสริม 10 ทีม
  // -------------------------------------------------------------------
  const FILLER_PROJECT_POOL = [
    { type: "สารคดี", name: "เสียงบ้านเฮา" },
    { type: "หนังสั้น", name: "ระหว่างทาง" },
    { type: "พอดแคสต์", name: "ฟังเสียงเมือง" },
    { type: "แคมเปญโซเชียลมีเดีย", name: "พะเยาในมุมใหม่" },
    { type: "แอนิเมชัน", name: "นิทานลูกท้าว" },
    { type: "เกมเพื่อการศึกษา", name: "ผจญภัยกว๊านพะเยา" },
    { type: "เว็บไซต์เชิงโต้ตอบ", name: "แผนที่ตลาดเช้าเมืองพะเยา" },
    { type: "ภาพถ่ายสารคดี", name: "วิถีชาวนา" },
    { type: "ซีรีส์วล็อก", name: "หนึ่งวันของนิสิตนิเทศฯ" },
    { type: "สื่อ Infographic", name: "ข้อมูลสิ่งแวดล้อมกว๊านพะเยา" },
    { type: "สารคดี", name: "คนกับควาย" },
    { type: "หนังสั้น", name: "จดหมายจากอดีต" },
    { type: "พอดแคสต์", name: "เรื่องเล่าหลังเลิกเรียน" },
    { type: "แคมเปญโซเชียลมีเดีย", name: "กินอยู่แบบพะเยา" },
    { type: "แอนิเมชัน", name: "เจ้าปลาในกว๊าน" },
    { type: "เกมเพื่อการศึกษา", name: "ภารกิจพิทักษ์กว๊าน" },
    { type: "เว็บไซต์เชิงโต้ตอบ", name: "คลังภูมิปัญญาท้องถิ่นพะเยา" },
    { type: "ภาพถ่ายสารคดี", name: "รอยเวลาในตลาดเก่า" },
    { type: "ซีรีส์วล็อก", name: "ของกินริมกว๊าน" },
    { type: "สื่อ Infographic", name: "สถิติน้ำท่วมกว๊านพะเยา" },
  ];
  const FILLER_TEAM_NAMES = [
    "ทีมสายหมอกดอย", "ทีมทะเลหมอกภูกามยาว", "ทีมริมกว๊านครีเอทีฟ", "ทีมแสงแรกแห่งเมือง", "ทีมภูกามยาวสตูดิโอ",
    "ทีมเงาเมืองพะเยา", "ทีมวิถีชาวดอย", "ทีมเสียงกว๊าน", "ทีมแพรวไพรวัลย์", "ทีมดอกเสี้ยวบาน",
    "ทีมสายลมกว๊าน", "ทีมมองพะเยา", "ทีมจอมทองสื่อสาร", "ทีมออนซอนเหนือ", "ทีมพะเยาไอเดีย",
    "ทีมล้านนาเฟรม", "ทีมเมฆหมอกไอเดีย", "ทีมแสงเงินแสงทอง", "ทีมพิกุลทองมีเดีย", "ทีมงามดอยครีเอทีฟ",
  ];
  const FILLER_FIRST_NAMES = [
    "กันต์ธีร์", "ชนิสรา", "ปิยะพร", "ศิรวิชญ์", "ธัญชนก", "วรัญญู", "พรนภา", "อดิศักดิ์", "กัญญาณัฐ", "ณัฐวุฒิ",
    "สุธาสินี", "ภัทรพล", "จิดาภา", "เจษฎา", "วิภาดา", "ศักดิ์สิทธิ์", "อรวรรณ", "ปรัชญา", "นภัสวรรณ", "ธีรภัทร",
  ];
  const FILLER_LAST_NAMES = ["แสงอรุณ", "บุญเรือง", "ศรีวิไล", "คำมา", "ปัญญาวงศ์", "จันทร์แจ่ม", "ทองดี", "ไชยเมือง", "สายบัว", "เรืองศรี"];
  const FILLER_ROLES = ["หัวหน้าทีม", "สมาชิก (ตัดต่อ/ผลิตสื่อ)", "สมาชิก (วิจัย/ข้อมูล)"];

  // สลับรูปแบบสถานะ/pace ให้ทีมเสริมมีความหลากหลายใกล้เคียงของจริง โดยไม่ต้องเขียนกำกับทีละทีม
  const FILLER_PROFILES = [
    { pace: "onTrack", currentOrder: 5, currentStatus: "in_progress", waitDays: 0, blocksNext: false, health: "green" },
    { pace: "onTrack", currentOrder: 5, currentStatus: "submitted", waitDays: 2, blocksNext: false, health: "green" },
    { pace: "atRisk", currentOrder: 4, currentStatus: "submitted", waitDays: 4, blocksNext: true, health: "yellow" },
    { pace: "atRisk", currentOrder: 4, currentStatus: "in_progress", waitDays: 0, blocksNext: false, health: "yellow" },
    { pace: "delayed", currentOrder: 3, currentStatus: "blocked", waitDays: 0, blocksNext: true, health: "red", inactivityDays: 5 },
    { pace: "onTrack", currentOrder: 6, currentStatus: "in_progress", waitDays: 0, blocksNext: false, health: "green" },
    { pace: "atRisk", currentOrder: 4, currentStatus: "reviewing", waitDays: 2, blocksNext: false, health: "yellow" },
    { pace: "delayed", currentOrder: 2, currentStatus: "in_progress", waitDays: 0, blocksNext: false, health: "red", inactivityDays: 6 },
  ];

  function buildFillerTeams() {
    const advisorPlan = [
      { advisorId: "adv1", count: 5, startIdx: 11 },
      { advisorId: "adv2", count: 5, startIdx: 16 },
      { advisorId: "adv3", count: 10, startIdx: 21 },
    ];
    const teams = [];
    let nameSeed = 0;
    advisorPlan.forEach((plan) => {
      for (let i = 0; i < plan.count; i++) {
        const globalIdx = teams.length; // 0..19 ต่อเนื่องข้าม advisor เพื่อสลับ project/profile ให้ทั่วถึง
        const proj = FILLER_PROJECT_POOL[globalIdx % FILLER_PROJECT_POOL.length];
        const profile = FILLER_PROFILES[globalIdx % FILLER_PROFILES.length];
        const teamId = `t${plan.startIdx + i}`;
        const memberCount = 2 + (globalIdx % 2); // สลับ 2–3 คนต่อทีม
        const members = [];
        for (let m = 0; m < memberCount; m++) {
          const first = FILLER_FIRST_NAMES[nameSeed % FILLER_FIRST_NAMES.length];
          const last = FILLER_LAST_NAMES[(nameSeed * 3 + 7) % FILLER_LAST_NAMES.length];
          members.push({ name: `${first} ${last}`, role: FILLER_ROLES[m % FILLER_ROLES.length] });
          nameSeed++;
        }
        teams.push({
          id: teamId,
          name: FILLER_TEAM_NAMES[globalIdx % FILLER_TEAM_NAMES.length],
          projectType: proj.type,
          projectName: proj.name,
          advisorId: plan.advisorId,
          members,
          ...profile,
        });
      }
    });
    return teams;
  }

  const TEAM_CONFIG = [...FLAGSHIP_TEAMS, ...buildFillerTeams()];

  const students = [];
  TEAM_CONFIG.forEach((t) => {
    t.members.forEach((m, i) => {
      students.push({ id: `${t.id}-m${i + 1}`, name: m.name, role: m.role, teamId: t.id });
    });
  });

  function riskFromStatus(status, pace) {
    if (status === "blocked") return "high";
    if (pace === "delayed") return "high";
    if (["revise", "need_info", "submitted"].includes(status) && pace === "atRisk") return "medium";
    if (pace === "atRisk") return "medium";
    return "low";
  }

  const milestones = [];
  const submissions = [];
  const feedbacks = [];

  TEAM_CONFIG.forEach((team) => {
    const delay = PACE_DELAY[team.pace];
    const memberIds = students.filter((s) => s.teamId === team.id).map((s) => s.id);
    let prevId = null;

    MILESTONE_DEFS.forEach((def) => {
      const id = `${team.id}-${def.key}`;
      const start = addDays(weekStart(def.startWeek), delay);
      const due = addDays(weekEnd(def.endWeek), delay);
      let status = "not_started";
      let completedDate = null;
      let risk = "low";
      const history = [];

      if (def.order < team.currentOrder) {
        status = "passed";
        completedDate = iso(due);
        risk = "low";
        history.push({ date: iso(addDays(due, -1)), note: "ส่งงานให้อาจารย์ตรวจ" });
        history.push({ date: iso(due), note: `อาจารย์อนุมัติผ่าน Milestone: ${def.name}` });
      } else if (def.order === team.currentOrder) {
        status = team.currentStatus;
        risk = riskFromStatus(status, team.pace);
        history.push({ date: iso(start), note: `เริ่มดำเนินการ Milestone: ${def.name}` });
        if (["submitted", "reviewing", "revise", "need_info"].includes(status)) {
          history.push({ date: iso(addDays(today, -(team.submittedDaysAgo || team.waitDays || 1))), note: "ส่งงานให้อาจารย์ตรวจ" });
        }
        if (status === "revise") history.push({ date: iso(addDays(today, -(team.reviewedDaysAgo || 1))), note: "อาจารย์ให้ Feedback: ต้องแก้ไข" });
        if (status === "need_info") history.push({ date: iso(addDays(today, -(team.reviewedDaysAgo || 1))), note: "อาจารย์ขอข้อมูลเพิ่มเติม" });
        if (status === "blocked") history.push({ date: iso(addDays(today, -(team.inactivityDays || 3))), note: "ทีมแจ้งปัญหา: ติดต่อแหล่งข้อมูลไม่ได้" });
      } else if (def.order === team.currentOrder + 1) {
        status = team.blocksNext ? "not_started" : "not_started";
      }

      const subtaskTitles = SUBTASK_LIB[def.key] || [];
      const subtasks = subtaskTitles.map((title, i) => ({
        id: `${id}-st${i + 1}`,
        title,
        assigneeId: memberIds[i % memberIds.length],
        done: def.order < team.currentOrder ? true : (def.order === team.currentOrder ? i < Math.ceil(subtaskTitles.length / 2) : false),
      }));

      milestones.push({
        id, teamId: team.id, order: def.order, key: def.key, name: def.name,
        startDate: iso(start), dueDate: iso(due), completedDate,
        hoursEstimate: 8 + def.order * 2,
        dependsOn: prevId, status, risk,
        attachments: def.order <= team.currentOrder && def.order >= team.currentOrder - 1
          ? [{ name: `${def.name}_v${def.order}.pdf`, uploadedAt: iso(addDays(due, -1)) }]
          : [],
        history, subtasks,
      });
      prevId = id;

      if (def.order === team.currentOrder && ["submitted", "reviewing", "revise", "need_info"].includes(status)) {
        const waitDays = team.waitDays || team.submittedDaysAgo || 0;
        const submittedAt = atTime(addDays(today, -(team.submittedDaysAgo || waitDays)), 21, 30);
        const sub = {
          id: `sub-${id}`, teamId: team.id, milestoneId: id, milestoneName: def.name,
          submittedAt: submittedAt.toISOString(), fileName: `${def.name}_ฉบับส่งตรวจ.pdf`,
          note: "ส่งงานตามกำหนด กรุณาตรวจสอบและให้ Feedback",
          status, reviewedBy: null, reviewedAt: null,
        };
        if (status === "revise" || status === "need_info") {
          sub.reviewedBy = team.advisorId;
          sub.reviewedAt = atTime(addDays(today, -(team.reviewedDaysAgo || 1)), 14, 0).toISOString();
          const fb = buildFeedback(team, def, sub);
          feedbacks.push(fb);
        }
        submissions.push(sub);
      }
    });
  });

  function buildFeedback(team, def, submission) {
    const memberIds = students.filter((s) => s.teamId === team.id).map((s) => s.id);
    if (def.key === "tools_prep" && team.id === "t06") {
      return {
        id: `fb-${submission.id}`, submissionId: submission.id, teamId: team.id, advisorId: team.advisorId,
        milestoneId: submission.milestoneId,
        createdAt: submission.reviewedAt,
        decision: "revise",
        rawText:
          "แนวคำถามสัมภาษณ์ยังกว้างเกินไป ให้ตัดคำถามที่ซ้ำซ้อนออกและโฟกัสประเด็น 'ชีวิตหอในช่วงสอบ' ให้ชัดเจนขึ้น\n" +
          "หนังสือขออนุญาตยังไม่มีชื่อผู้ประสานงานฝ่ายหอพัก กรุณาระบุเพิ่มก่อนนำไปยื่น\n" +
          "อุปกรณ์บันทึกเสียงที่เลือกใช้เสี่ยงมีเสียงรบกวนในพื้นที่จริง ให้ทดสอบสถานที่จริงก่อนลงพื้นที่",
        checklist: [
          { id: `${submission.id}-c1`, title: "ตัดคำถามสัมภาษณ์ที่ซ้ำซ้อน โฟกัส 'ชีวิตหอในช่วงสอบ'", assigneeId: memberIds[0], dueDate: iso(addDays(today, 2)), hours: 2, relatedTo: "แนวคำถามสัมภาษณ์.docx", needsRecheck: true, done: false },
          { id: `${submission.id}-c2`, title: "เพิ่มชื่อผู้ประสานงานฝ่ายหอพักในหนังสือขออนุญาต", assigneeId: memberIds[1] || memberIds[0], dueDate: iso(addDays(today, 1)), hours: 1, relatedTo: "หนังสือขออนุญาต.pdf", needsRecheck: true, done: true },
          { id: `${submission.id}-c3`, title: "ทดสอบอุปกรณ์บันทึกเสียงในพื้นที่จริงก่อนลงพื้นที่", assigneeId: memberIds[2] || memberIds[0], dueDate: iso(addDays(today, 3)), hours: 2, relatedTo: "อุปกรณ์ถ่ายทำ", needsRecheck: false, done: false },
        ],
      };
    }
    // generic fallback
    return {
      id: `fb-${submission.id}`, submissionId: submission.id, teamId: team.id, advisorId: team.advisorId,
      milestoneId: submission.milestoneId,
      createdAt: submission.reviewedAt,
      decision: def.key === "need_info" ? "more-info" : "revise",
      rawText: "กรุณาเพิ่มรายละเอียดและหลักฐานประกอบให้ครบถ้วนก่อนส่งตรวจอีกครั้ง",
      checklist: [
        { id: `${submission.id}-c1`, title: `เพิ่มรายละเอียดตาม Feedback: ${def.name}`, assigneeId: memberIds[0], dueDate: iso(addDays(today, 2)), hours: 2, relatedTo: def.name, needsRecheck: true, done: false },
      ],
    };
  }

  // -------------------------------------------------------------------
  // ตารางเรียน (recurring, dow 0=อาทิตย์..6=เสาร์) ต่อทีม (ใช้ร่วมกันทั้งทีม)
  // -------------------------------------------------------------------
  const schedule = [];
  const SCHEDULE_TEMPLATE = [
    { dow: 1, start: "09:00", end: "12:00", title: "วิชาแกนการสื่อสาร" },
    { dow: 2, start: "13:00", end: "16:00", title: "ภาษาอังกฤษเพื่อการสื่อสาร" },
    { dow: 3, start: "09:00", end: "11:00", title: "หลักการตลาดดิจิทัล" },
    { dow: 4, start: "13:00", end: "15:00", title: "โครงงาน (คาบให้คำปรึกษา)" },
    { dow: 5, start: "09:00", end: "12:00", title: "การถ่ายภาพขั้นสูง" },
  ];
  TEAM_CONFIG.forEach((team) => {
    SCHEDULE_TEMPLATE.forEach((s, i) => {
      schedule.push({ id: `${team.id}-sch${i}`, teamId: team.id, dow: s.dow, start: s.start, end: s.end, title: s.title, type: "class" });
    });
  });

  const personalBlocks = [];
  TEAM_CONFIG.forEach((team) => {
    for (let d = 0; d <= 6; d++) {
      personalBlocks.push({ id: `${team.id}-sleep${d}`, teamId: team.id, dow: d, start: "23:00", end: "07:00", title: "เวลานอน", type: "personal" });
    }
    personalBlocks.push({ id: `${team.id}-pt`, teamId: team.id, dow: 6, start: "10:00", end: "16:00", title: "งานพาร์ทไทม์/กิจกรรมส่วนตัว", type: "personal" });
  });

  // -------------------------------------------------------------------
  // งานจากวิชาอื่น — สร้างจุดชนกันชัดเจนให้ทีมข่วงศิลป์ (t01) ตามตัวอย่างในสเปก
  // "สัปดาห์นี้มีงาน 3 ชิ้น กำหนดส่งภายใน 48 ชม. รวมประมาณ 14 ชม."
  // -------------------------------------------------------------------
  const otherCourseTasks = [
    { id: "oc1", teamId: "t01", courseName: "หลักการตลาดดิจิทัล", title: "ส่งแผนแคมเปญกลุ่ม", dueDate: new Date(now.getTime() + 18 * 3600 * 1000).toISOString(), hoursEstimate: 5 },
    { id: "oc2", teamId: "t01", courseName: "การถ่ายภาพขั้นสูง", title: "ส่งพอร์ตภาพนิ่ง 10 ภาพ", dueDate: new Date(now.getTime() + 28 * 3600 * 1000).toISOString(), hoursEstimate: 6 },
    { id: "oc3", teamId: "t01", courseName: "ภาษาอังกฤษเพื่อการสื่อสาร", title: "ควิซท้ายบทที่ 4", dueDate: new Date(now.getTime() + 36 * 3600 * 1000).toISOString(), hoursEstimate: 3 },
    { id: "oc4", teamId: "t01", courseName: "วิชาแกนการสื่อสาร", title: "อ่านบทความก่อนเข้าเรียน", dueDate: atTime(addDays(today, 6), 9, 0).toISOString(), hoursEstimate: 2 },
    { id: "oc5", teamId: "t03", courseName: "หลักการตลาดดิจิทัล", title: "ส่งแผนแคมเปญกลุ่ม", dueDate: atTime(addDays(today, 1), 12, 0).toISOString(), hoursEstimate: 5 },
    { id: "oc6", teamId: "t05", courseName: "การถ่ายภาพขั้นสูง", title: "ส่งพอร์ตภาพนิ่ง 10 ภาพ", dueDate: atTime(addDays(today, 3), 9, 0).toISOString(), hoursEstimate: 6 },
    { id: "oc7", teamId: "t08", courseName: "ภาษาอังกฤษเพื่อการสื่อสาร", title: "ควิซท้ายบทที่ 4", dueDate: atTime(addDays(today, 2), 15, 0).toISOString(), hoursEstimate: 3 },
    { id: "oc8", teamId: "t02", courseName: "หลักการตลาดดิจิทัล", title: "นำเสนอแผนแคมเปญ", dueDate: atTime(addDays(today, 5), 13, 0).toISOString(), hoursEstimate: 4 },
  ];

  // -------------------------------------------------------------------
  // Smart Free-Time Planner — ช่วงเวลาแนะนำตัวอย่าง (ทีมข่วงศิลป์)
  // -------------------------------------------------------------------
  function nextWeekday(from, targetDow) {
    let d = new Date(from);
    while (d.getDay() !== targetDow) d = addDays(d, 1);
    return d;
  }
  const thu = nextWeekday(addDays(today, 1), 4);
  const sat = nextWeekday(addDays(today, 1), 6);
  const freeTimeSuggestions = [
    {
      id: "ft1", teamId: "t01", date: iso(thu), start: "19:00", end: "21:00",
      taskSuggestion: "จัดทำ Storyboard ฉบับแก้ไข", reason: "ยังไม่มีงานวิชาอื่นที่เร่งด่วนในช่วงนี้ และเป็นช่วงที่ทีมทำงานได้มีประสิทธิภาพ",
      status: "pending",
    },
    {
      id: "ft2", teamId: "t01", date: iso(sat), start: "09:00", end: "11:00",
      taskSuggestion: "ถอดคำสัมภาษณ์ที่เก็บมาแล้วบางส่วน", reason: "ช่วงเช้าวันเสาร์ว่างจากตารางเรียนและงานพาร์ทไทม์เริ่ม 10 โมง",
      status: "pending",
    },
    {
      id: "ft3", teamId: "t01", date: iso(addDays(today, 3)), start: "20:00", end: "21:30",
      taskSuggestion: "เตรียมหนังสือขออนุญาตเก็บข้อมูลเพิ่มเติม", reason: "ช่วงเย็นวันนี้มีงานวิชาอื่นเบาลงหลังส่งงาน 2 ชิ้นแรกแล้ว",
      status: "declined",
    },
  ];

  // -------------------------------------------------------------------
  // Next Best Task — คลังคำแนะนำงานระหว่างรอตรวจ (ตาม Milestone)
  // -------------------------------------------------------------------
  const NEXT_BEST_TASK_LIB = {
    topic_approval: ["ค้นคว้าโครงงานตัวอย่างที่ใกล้เคียงหัวข้อ", "ร่างขอบเขตและวัตถุประสงค์เพิ่มเติม"],
    concept: ["จัดระเบียบเอกสารอ้างอิงที่เกี่ยวข้อง", "ร่าง Moodboard/แนวทางภาพรวมของผลงาน"],
    proposal: ["จัดระเบียบเอกสารอ้างอิงและบรรณานุกรม", "เตรียมแผนการเก็บข้อมูลล่วงหน้า"],
    tools_prep: ["เตรียมคำถามสัมภาษณ์ฉบับสำรอง", "ติดต่อแหล่งข้อมูลหรือสถานที่ถ่ายทำ", "เตรียมเอกสารขออนุญาตเพิ่มเติม"],
    produce: ["ทำ Shot List หรือ Storyboard ส่วนที่เหลือ", "ตรวจสอบและสำรองไฟล์ Footage", "ทำบันทึกรายละเอียด Footage", "ถอดคำสัมภาษณ์ที่เก็บมาแล้ว", "เก็บ B-roll เพิ่มเติม"],
    edit: ["เตรียม Rough Cut ในส่วนที่ไม่กระทบงานที่รออนุมัติ", "จัดระเบียบไฟล์เสียง/ภาพประกอบ", "แบ่งงานตัดต่อรอบถัดไปให้สมาชิก"],
    qc: ["เตรียมแบบทดสอบ/แบบสอบถามกลุ่มตัวอย่าง", "จัดทำเอกสารสรุปผลการตรวจสอบคุณภาพ"],
    revise_feedback: ["สรุปรายการแก้ไขเป็นหมวดหมู่", "แบ่งงานแก้ไขให้สมาชิกตามความถนัด"],
    final_submit: ["เตรียมสไลด์หรือข้อมูลสำหรับการนำเสนอ", "ตรวจทานเอกสารประกอบฉบับสมบูรณ์"],
    present_prep: ["ซ้อมนำเสนอในทีม", "เตรียมคำตอบสำหรับคำถามที่คาดว่าจะถูกถาม"],
  };

  // -------------------------------------------------------------------
  // Notification เริ่มต้น
  // -------------------------------------------------------------------
  const notifications = [];
  let nid = 1;
  function addNotif(o) { notifications.push(Object.assign({ id: `n${nid++}`, read: false }, o)); }

  addNotif({ audience: "student", teamId: "t01", type: "collision", severity: "red", createdAt: atTime(today, 8, 0).toISOString(), title: "พบกำหนดส่งชนกัน", message: "สัปดาห์นี้คุณมีงาน 3 ชิ้นกำหนดส่งภายใน 48 ชั่วโมง และต้องใช้เวลารวมประมาณ 14 ชั่วโมง งานโครงงานมีความเสี่ยงที่จะล่าช้า ควรเริ่มงานเก็บข้อมูลภายในวันอังคาร" });
  addNotif({ audience: "student", teamId: "t01", type: "free_time_found", severity: "info", createdAt: atTime(addDays(today, 0), 8, 5).toISOString(), title: "พบช่วงเวลาว่างที่เหมาะสม", message: `${TD.formatThaiDate(thu, { withDow: true })} เวลา 19.00–21.00 น. แนะนำให้จัดทำ Storyboard ฉบับแก้ไข` });
  addNotif({ audience: "student", teamId: "t01", type: "feedback_received", severity: "warn", createdAt: atTime(addDays(today, -5), 14, 0).toISOString(), title: "งานอยู่ระหว่างรอตรวจ", message: "งาน 'เตรียมเครื่องมือเก็บข้อมูล' รอตรวจมาแล้ว 5 วัน ยังไม่มี Feedback กลับมา" });
  addNotif({ audience: "student", teamId: "t04", type: "inactivity", severity: "red", createdAt: atTime(today, 8, 10).toISOString(), title: "ไม่มีการอัปเดตงาน", message: "ทีมของคุณไม่มีการอัปเดตความก้าวหน้ามาแล้ว 6 วัน อาจกระทบต่อกำหนดส่ง Milestone ถัดไป" });
  addNotif({ audience: "student", teamId: "t06", type: "feedback_ready", severity: "info", createdAt: atTime(addDays(today, -2), 14, 5).toISOString(), title: "อาจารย์ส่ง Feedback แล้ว", message: "อาจารย์ที่ปรึกษาให้ Feedback งาน 'เตรียมเครื่องมือเก็บข้อมูล' แล้ว พร้อมรายการแก้ไข 3 รายการ" });
  addNotif({ audience: "student", teamId: "t06", type: "unassigned_task", severity: "warn", createdAt: atTime(addDays(today, -2), 14, 10).toISOString(), title: "มีรายการแก้ไขที่ยังไม่มอบหมาย", message: "รายการแก้ไข 'ทดสอบอุปกรณ์บันทึกเสียงในพื้นที่จริง' ยังไม่ได้กำหนดผู้รับผิดชอบ" });
  addNotif({ audience: "student", teamId: "t09", type: "team_imbalance", severity: "warn", createdAt: atTime(today, 8, 15).toISOString(), title: "ภาระงานในทีมไม่สมดุล", message: "สมาชิก 1 คนรับผิดชอบงานมากกว่าค่าเฉลี่ยของทีมกว่า 2 เท่า" });
  addNotif({ audience: "student", teamId: "t10", type: "milestone_delay", severity: "red", createdAt: atTime(today, 8, 20).toISOString(), title: "Milestone ล่าช้า", message: "Milestone 'พัฒนาแนวคิด' ล่าช้ากว่าแผนกว่า 3 สัปดาห์ อาจกระทบกำหนดส่งสุดท้าย" });
  addNotif({ audience: "student", teamId: "t08", type: "deadline_reminder", severity: "red", createdAt: atTime(today, 8, 25).toISOString(), title: "ใกล้ถึงกำหนดส่งสุดท้าย", message: "งานที่รอตรวจเกินกรอบ Feedback 7 วันแล้ว ควรติดตามอาจารย์โดยด่วน" });

  addNotif({ audience: "advisor", advisorId: "adv1", teamId: "t01", type: "advisor_sla_warn", severity: "red", createdAt: atTime(today, 8, 0).toISOString(), title: "ใกล้เกินกรอบเวลา Feedback", message: "ทีมข่วงศิลป์ส่งบทฉบับแก้ไขมาแล้ว 5 วัน เหลือเวลา 2 วันก่อนเกินกรอบ Feedback และทีมยังไม่สามารถเริ่มถ่ายทำได้ ควรตรวจงานนี้เป็นลำดับถัดไป" });
  addNotif({ audience: "advisor", advisorId: "adv2", teamId: "t08", type: "advisor_sla_overdue", severity: "red", createdAt: atTime(today, 8, 5).toISOString(), title: "เกินกรอบเวลา Feedback แล้ว", message: "ทีมนนทรีสื่อสารรอ Feedback มาแล้ว 9 วัน เกินกรอบเวลา 7 วัน และเป็นงานที่ขวางขั้นตอนถัดไป" });
  addNotif({ audience: "advisor", advisorId: "adv1", teamId: "t03", type: "advisor_sla_normal", severity: "warn", createdAt: atTime(today, 8, 10).toISOString(), title: "แจ้งเตือนระดับปกติ", message: "ทีมกว๊านสตูดิโอรอ Feedback มาแล้ว 3 วัน" });
  addNotif({ audience: "advisor", advisorId: "adv1", teamId: "t05", type: "advisor_ack", severity: "info", createdAt: atTime(addDays(today, -1), 21, 30).toISOString(), title: "ได้รับงานแล้ว", message: "ได้รับงานส่งจากทีมเฟรมแรกแล้ว รอคิวตรวจ" });
  addNotif({ audience: "advisor", advisorId: "adv1", teamId: "t04", type: "advisor_risk", severity: "red", createdAt: atTime(today, 8, 15).toISOString(), title: "ทีมเสี่ยงล่าช้า", message: "ทีมสายลมเหนือติดปัญหาและไม่มีการอัปเดตมา 6 วัน ควรติดต่อทีมเพื่อช่วยแก้ไข" });

  // -------------------------------------------------------------------
  // ค่าตั้งต้นระบบ
  // -------------------------------------------------------------------
  // ค่าตั้งต้นระดับรายวิชา (สิทธิ์อาจารย์/ผู้ดูแลเท่านั้น) — แยกออกจากการแจ้งเตือนส่วนบุคคลของแต่ละคน
  // ซึ่งอยู่ที่ notificationPrefs[userId] แทน ไม่ใช่ค่ากลางที่ทุกคนเขียนทับกันเหมือนก่อนหน้านี้
  const courseSettings = {
    feedbackSlaDays: 7,
    reminderMilestones: [1, 3, 5, 7],
    studentInactivityDays: 3,
    deadlineCollisionWindowHours: 48,
    studentDeadlineReminders: [7, 3, 1],
  };

  function buildSeedData() {
    return {
      version: SEED_VERSION,
      seededAt: new Date().toISOString(),
      course, advisors, students,
      teams: TEAM_CONFIG.map((t) => {
        const inactivityDays = t.inactivityDays || 0;
        // ไฟ streak (ต่อเนื่องกี่วัน): ทีมที่ไม่มีการอัปเดตงาน (inactivityDays>0) streak จะขาดตอน (=0)
        // ทีมตามแผน/เริ่มเสี่ยง แต่ยังไม่ขาดการอัปเดต จะมี streak สั้น-ยาวตาม pace
        const streakDays = inactivityDays > 0 ? 0 : (t.pace === "onTrack" ? 6 : t.pace === "atRisk" ? 2 : 1);
        const lastActivityDate = inactivityDays > 0 ? iso(addDays(today, -inactivityDays)) : iso(today);
        return {
          id: t.id, name: t.name, projectType: t.projectType, projectName: t.projectName,
          advisorId: t.advisorId, pace: t.pace, health: t.health, currentOrder: t.currentOrder,
          blocksNext: !!t.blocksNext, inactivityDays, streakDays, lastActivityDate,
        };
      }),
      milestoneDefs: MILESTONE_DEFS,
      statusMeta: STATUS_META,
      statusOrder: STATUS_ORDER,
      milestones, submissions, feedbacks,
      schedule, personalBlocks, otherCourseTasks, freeTimeSuggestions,
      nextBestTaskLib: NEXT_BEST_TASK_LIB,
      notifications,
      courseSettings,
      notificationPrefs: {},
      personalPrefs: {},
      checkins: [],
      queueOverrides: {},
      pulsePoints: {},
      weeklyMomentum: {},
      waitingTasks: {},
      currentUser: { role: "student", teamId: "t01", studentId: "t01-m1", advisorId: "adv1" },
    };
  }

  // สร้างชุด Milestone มาตรฐาน 10 รายการให้ทีมที่นิสิตสร้างขึ้นเองใหม่ (ใช้กำหนดส่งตามปฏิทินรายวิชาจริง ไม่ขยับตาม pace)
  function buildMilestonesForNewTeam(teamId, memberIds, projectType) {
    const defs = resolveMilestoneDefs(projectType);
    const subtaskLib = resolveSubtaskLib(projectType);
    let prevId = null;
    return defs.map((def) => {
      const id = `${teamId}-${def.key}`;
      const start = weekStart(def.startWeek);
      const due = weekEnd(def.endWeek);
      const status = def.order === 1 ? "in_progress" : "not_started";
      const subtaskTitles = subtaskLib[def.key] || [];
      const subtasks = subtaskTitles.map((title, i) => ({
        id: `${id}-st${i + 1}`, title, assigneeId: (memberIds && memberIds[i % memberIds.length]) || null, done: false,
      }));
      const history = def.order === 1 ? [{ date: iso(new Date()), note: `เริ่มดำเนินการ Milestone: ${def.name}` }] : [];
      const m = {
        id, teamId, order: def.order, key: def.key, name: def.name,
        startDate: iso(start), dueDate: iso(due), completedDate: null,
        hoursEstimate: 8 + def.order * 2, dependsOn: prevId, status, risk: "low",
        attachments: [], history, subtasks,
      };
      prevId = id;
      return m;
    });
  }

  global.PPSeed = {
    buildSeedData, buildMilestonesForNewTeam, SEED_VERSION,
    SEMESTER_START: iso(SEMESTER_START), SEMESTER_END: iso(SEMESTER_END),
  };
})(window);
