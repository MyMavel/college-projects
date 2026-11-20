import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { actorOf, parseProject } from "@/lib/projectData";
import { fiscalYearOf, STATUSES } from "@/lib/projects";
import { bad, parseOptionalId, parseText, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects?fy=2570&dept=3&status=approved&q=คำค้น&mine=1&todo=1
 * - mine=1  เฉพาะโครงการที่ฉันรับผิดชอบ
 * - todo=1  เฉพาะโครงการที่รอฉันอนุมัติ
 */
export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const sp = new URL(req.url).searchParams;
  const fy = Number(sp.get("fy")) || null;
  const dept = parseOptionalId(sp.get("dept"));
  const status = sp.get("status");
  const q = parseText(sp.get("q"), 100);
  const mine = sp.get("mine") === "1";
  const todo = sp.get("todo") === "1";
  const sql = await db();
  const me = actorOf(user);

  const todoFilter =
    me.role === "admin" ? sql`p.status IN ('pending_head','pending_plan','pending_director')`
    : me.role === "director" ? sql`p.status = 'pending_director'`
    : me.role === "head" ? sql`p.status = 'pending_head' AND p.department_id = ${me.departmentId ?? -1}`
    : sql`false`;

  const rows = await sql`
    SELECT p.id, p.code, p.fiscal_year AS "fiscalYear", p.title, p.status,
           p.budget_amount::float8 AS "budgetAmount", p.budget_source AS "budgetSource",
           p.start_date::text AS "startDate", p.end_date::text AS "endDate",
           p.department_id AS "departmentId", d.name AS "departmentName",
           p.owner_id AS "ownerId", u.display_name AS "ownerName", p.updated_at AS "updatedAt",
           COALESCE((SELECT SUM(amount) FROM disbursements x WHERE x.project_id = p.id), 0)::float8 AS "spent"
    FROM projects p
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE (p.status <> 'draft' OR p.owner_id = ${me.id} OR ${me.role === "admin"})
      ${fy ? sql`AND p.fiscal_year = ${fy}` : sql``}
      ${dept ? sql`AND p.department_id = ${dept}` : sql``}
      ${status && status in STATUSES ? sql`AND p.status = ${status}` : sql``}
      ${q ? sql`AND (p.title ILIKE ${"%" + q + "%"} OR p.code ILIKE ${"%" + q + "%"})` : sql``}
      ${mine ? sql`AND p.owner_id = ${me.id}` : sql``}
      ${todo ? sql`AND ${todoFilter}` : sql``}
    ORDER BY p.updated_at DESC
    LIMIT 500
  `;
  return NextResponse.json(rows);
}

// สร้างโครงการใหม่ (สถานะ "ร่าง") — ผู้สร้างเป็นผู้รับผิดชอบ
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const body = (await readJson(req)) ?? {};
  const [p, problem] = parseProject({ fiscalYear: fiscalYearOf(), departmentId: user.departmentId, ...body });
  if (!p) return bad(problem!);
  const sql = await db();
  const [row] = await sql`
    INSERT INTO projects (
      fiscal_year, title, department_id, owner_id, co_owners, project_type, strategy, rationale, objectives,
      target_quantity, target_quality, location, start_date, end_date, budget_amount, budget_source,
      budget_detail, indicators, expected_outcome
    ) VALUES (
      ${p.fiscalYear}, ${p.title}, ${p.departmentId}, ${user.id}, ${p.coOwners}, ${p.projectType}, ${p.strategy},
      ${p.rationale}, ${p.objectives}, ${p.targetQuantity}, ${p.targetQuality}, ${p.location}, ${p.startDate},
      ${p.endDate}, ${p.budgetAmount}, ${p.budgetSource}, ${p.budgetDetail}, ${p.indicators}, ${p.expectedOutcome}
    ) RETURNING id
  `;
  return NextResponse.json(row, { status: 201 });
}
