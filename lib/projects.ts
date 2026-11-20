/**
 * 📋 กติกาของโครงการ: สถานะ ขั้นตอนอนุมัติ และสิทธิ์
 * ใช้ร่วมกันทั้งฝั่ง API และหน้าเว็บ (ฝั่ง API เป็นตัวตัดสินจริง)
 *
 * ลำดับ: ร่าง → รอหัวหน้าแผนก/งาน → รองานวางแผนฯ → รอผู้บริหาร → อนุมัติ → (รายงานผล) → เสร็จสิ้น
 *        ทุกขั้นที่ "รอ..." ผู้อนุมัติสามารถ ส่งกลับแก้ไข หรือ ไม่อนุมัติ ได้
 */
import type { Role } from "./site";

export const STATUSES = {
  draft: { label: "ร่าง", color: "#868e96" },
  revision: { label: "ส่งกลับแก้ไข", color: "#e67700" },
  pending_head: { label: "รอหัวหน้าแผนก/งาน", color: "#1971c2" },
  pending_plan: { label: "รองานวางแผนฯ", color: "#1971c2" },
  pending_director: { label: "รอผู้บริหาร", color: "#5f3dc4" },
  approved: { label: "อนุมัติแล้ว", color: "#2b8a3e" },
  completed: { label: "เสร็จสิ้น (รายงานผลแล้ว)", color: "#0b7285" },
  rejected: { label: "ไม่อนุมัติ", color: "#c92a2a" },
  cancelled: { label: "ยกเลิก", color: "#495057" },
} as const;
export type Status = keyof typeof STATUSES;
export const PENDING: Status[] = ["pending_head", "pending_plan", "pending_director"];

export const BUDGET_SOURCES = {
  state: "งบประมาณแผ่นดิน",
  income: "เงินรายได้สถานศึกษา",
  subsidy: "เงินอุดหนุน",
  external: "งบจากหน่วยงานภายนอก",
  none: "ไม่ใช้งบประมาณ",
} as const;
export type BudgetSource = keyof typeof BUDGET_SOURCES;

export const PROJECT_TYPES = { new: "โครงการใหม่", continuing: "โครงการต่อเนื่อง" } as const;

export const ACTIONS = {
  submit: "ส่งขออนุมัติ",
  approve: "อนุมัติ / เห็นชอบ",
  return: "ส่งกลับแก้ไข",
  reject: "ไม่อนุมัติ",
  cancel: "ยกเลิกโครงการ",
  report: "รายงานผล",
} as const;
export type Action = keyof typeof ACTIONS;

export type Actor = { id: number; role: Role; departmentId: number | null };
export type ProjectRef = { ownerId: number | null; departmentId: number | null; status: Status };

const isOwner = (u: Actor, p: ProjectRef) => p.ownerId === u.id;
const isHeadOf = (u: Actor, p: ProjectRef) =>
  u.role === "head" && u.departmentId !== null && u.departmentId === p.departmentId;

/** ใครอนุมัติขั้นปัจจุบันได้ (admin ทำแทนได้ทุกขั้น) */
export function canDecide(u: Actor, p: ProjectRef): boolean {
  if (u.role === "admin") return PENDING.includes(p.status);
  if (p.status === "pending_head") return isHeadOf(u, p);
  if (p.status === "pending_director") return u.role === "director";
  return false;
}

/** ขั้นถัดไปเมื่อ "อนุมัติ" */
export function nextOnApprove(s: Status): Status | null {
  return s === "pending_head" ? "pending_plan" : s === "pending_plan" ? "pending_director" : s === "pending_director" ? "approved" : null;
}

/** ขั้นแรกเมื่อ "ส่งขออนุมัติ": ถ้าผู้ส่งเป็นหัวหน้าของแผนกนั้นเอง (หรือ admin) ข้ามขั้นหัวหน้าไป */
export function firstPending(u: Actor, p: ProjectRef): Status {
  return isHeadOf(u, p) || u.role === "admin" ? "pending_plan" : "pending_head";
}

export function canView(u: Actor, p: ProjectRef): boolean {
  if (p.status !== "draft") return true; // โครงการที่ส่งแล้วทุกคนดูได้ (โปร่งใส)
  return isOwner(u, p) || u.role === "admin";
}

export function canEdit(u: Actor, p: ProjectRef): boolean {
  if (u.role === "admin") return !["completed", "cancelled"].includes(p.status);
  return isOwner(u, p) && (p.status === "draft" || p.status === "revision");
}

export function canDelete(u: Actor, p: ProjectRef): boolean {
  return (isOwner(u, p) || u.role === "admin") && p.status === "draft";
}

/** บันทึกการเบิกจ่าย / รายงานผล: ผู้รับผิดชอบ หรือ admin เมื่อโครงการอนุมัติแล้ว */
export function canExecute(u: Actor, p: ProjectRef): boolean {
  return (isOwner(u, p) || u.role === "admin") && (p.status === "approved" || p.status === "completed");
}

export function allowedActions(u: Actor, p: ProjectRef): Action[] {
  const a: Action[] = [];
  if ((isOwner(u, p) || u.role === "admin") && (p.status === "draft" || p.status === "revision")) a.push("submit");
  if (canDecide(u, p)) a.push("approve", "return", "reject");
  if ((isOwner(u, p) || u.role === "admin") && ["draft", "revision", "approved"].includes(p.status)) a.push("cancel");
  return a;
}

/** ปีงบประมาณ (พ.ศ.) ของวันที่: ต.ค.–ก.ย. เช่น พ.ย. 2569 → ปีงบ 2570 */
export function fiscalYearOf(d = new Date()): number {
  const bkk = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return bkk.getFullYear() + 543 + (bkk.getMonth() >= 9 ? 1 : 0);
}
