import type postgres from "postgres";
import type { CurrentUser } from "./auth";
import { BUDGET_SOURCES, PROJECT_TYPES, type Actor, type ProjectRef, type Status } from "./projects";
import { parseDate, parseMoney, parseOptionalId, parseText } from "./validate";

export function actorOf(u: CurrentUser): Actor {
  return { id: u.id, role: u.role, departmentId: u.departmentId };
}

/** ข้อมูลสั้นของโครงการสำหรับตรวจสิทธิ์ */
export async function loadRef(sql: postgres.Sql, id: number): Promise<(ProjectRef & { id: number; fiscalYear: number; code: string | null }) | null> {
  const [p] = await sql<(ProjectRef & { id: number; fiscalYear: number; code: string | null })[]>`
    SELECT id, owner_id AS "ownerId", department_id AS "departmentId", status, fiscal_year AS "fiscalYear", code
    FROM projects WHERE id = ${id}
  `;
  return p ?? null;
}

export type ProjectInput = {
  title: string; fiscalYear: number; departmentId: number | null; coOwners: string; projectType: string;
  strategy: string; rationale: string; objectives: string; targetQuantity: string; targetQuality: string;
  location: string; startDate: string | null; endDate: string | null; budgetAmount: number;
  budgetSource: string; budgetDetail: string; indicators: string; expectedOutcome: string;
};

/** ตรวจและแปลงข้อมูลจากฟอร์ม → คืน [ข้อมูล, ข้อความผิดพลาด] */
export function parseProject(b: Record<string, unknown>): [ProjectInput | null, string | null] {
  const title = parseText(b.title, 300);
  if (!title) return [null, "กรุณากรอกชื่อโครงการ"];
  const fiscalYear = Number(b.fiscalYear);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2560 || fiscalYear > 2700) return [null, "ปีงบประมาณไม่ถูกต้อง"];
  const budgetAmount = parseMoney(b.budgetAmount ?? 0);
  if (budgetAmount === null) return [null, "จำนวนงบประมาณไม่ถูกต้อง"];
  const startDate = b.startDate ? parseDate(b.startDate) : null;
  const endDate = b.endDate ? parseDate(b.endDate) : null;
  if (b.startDate && !startDate) return [null, "วันเริ่มต้นไม่ถูกต้อง"];
  if (b.endDate && !endDate) return [null, "วันสิ้นสุดไม่ถูกต้อง"];
  if (startDate && endDate && endDate < startDate) return [null, "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"];
  const budgetSource = String(b.budgetSource ?? "state");
  if (!(budgetSource in BUDGET_SOURCES)) return [null, "แหล่งงบประมาณไม่ถูกต้อง"];
  const projectType = String(b.projectType ?? "new");
  if (!(projectType in PROJECT_TYPES)) return [null, "ลักษณะโครงการไม่ถูกต้อง"];
  const t = (k: string, max = 5000) => parseText(b[k], max);
  return [{
    title, fiscalYear, departmentId: parseOptionalId(b.departmentId), coOwners: t("coOwners", 500), projectType,
    strategy: t("strategy", 1000), rationale: t("rationale"), objectives: t("objectives"),
    targetQuantity: t("targetQuantity"), targetQuality: t("targetQuality"), location: t("location", 300),
    startDate, endDate, budgetAmount: budgetSource === "none" ? 0 : budgetAmount, budgetSource,
    budgetDetail: t("budgetDetail"), indicators: t("indicators"), expectedOutcome: t("expectedOutcome"),
  }, null];
}

/** ข้อมูลที่ต้องครบก่อน "ส่งขออนุมัติ" */
export async function submitProblems(sql: postgres.Sql, id: number): Promise<string[]> {
  const [p] = await sql`
    SELECT department_id, objectives, target_quantity, target_quality, start_date, end_date,
           budget_amount::float8 AS budget_amount, budget_source, indicators
    FROM projects WHERE id = ${id}
  `;
  const miss: string[] = [];
  if (!p.department_id) miss.push("แผนก/งาน");
  if (!p.objectives) miss.push("วัตถุประสงค์");
  if (!p.target_quantity && !p.target_quality) miss.push("เป้าหมาย");
  if (!p.start_date || !p.end_date) miss.push("ระยะเวลาดำเนินการ");
  if (p.budget_source !== "none" && !(p.budget_amount > 0)) miss.push("จำนวนงบประมาณ");
  if (!p.indicators) miss.push("ตัวชี้วัดความสำเร็จ");
  return miss;
}

export async function logAction(
  sql: postgres.Sql, projectId: number, userId: number, action: string, from: Status, to: Status, comment = "",
) {
  await sql`
    INSERT INTO project_actions (project_id, user_id, action, from_status, to_status, comment)
    VALUES (${projectId}, ${userId}, ${action}, ${from}, ${to}, ${comment})
  `;
}
