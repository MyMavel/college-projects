// ⚙️ ตั้งค่าของแอป
export const SITE = {
  name: "ระบบบริหารจัดการโครงการ",
  shortName: "บริหารโครงการ",
  org: "วิทยาลัยเทคนิคแพร่",          // ชื่อหน่วยงาน (แสดงในเอกสารพิมพ์)
  icon: "📋",
  description: "ระบบเสนอ อนุมัติ ติดตามงบประมาณ และรายงานผลโครงการ",
  themeColor: "#1f3a5f",
};

// บทบาทผู้ใช้ (admin = งานวางแผนและงบประมาณ / ผู้ดูแลระบบ)
export const ROLES = {
  admin: "งานวางแผนฯ / ผู้ดูแลระบบ",
  director: "ผู้บริหาร",
  head: "หัวหน้าแผนก/งาน",
  teacher: "ครู / ผู้รับผิดชอบโครงการ",
} as const;

export type Role = keyof typeof ROLES;

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && v in ROLES;
}
