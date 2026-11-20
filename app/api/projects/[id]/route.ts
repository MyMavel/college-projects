import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { actorOf, loadRef, parseProject } from "@/lib/projectData";
import { allowedActions, canDelete, canEdit, canExecute, canView } from "@/lib/projects";
import { bad, parseId, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// รายละเอียดโครงการ + ประวัติ + การเบิกจ่าย + รายงานผล + สิทธิ์ของฉัน
export async function GET(_req: Request, { params }: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบโครงการ", 404);
  const sql = await db();
  const ref = await loadRef(sql, id);
  const me = actorOf(user);
  if (!ref || !canView(me, ref)) return bad("ไม่พบโครงการ", 404);

  const [[project], actions, disbursements, [report]] = await Promise.all([
    sql`
      SELECT p.id, p.code, p.fiscal_year AS "fiscalYear", p.title, p.status,
             p.department_id AS "departmentId", d.name AS "departmentName",
             p.owner_id AS "ownerId", u.display_name AS "ownerName", p.co_owners AS "coOwners",
             p.project_type AS "projectType", p.strategy, p.rationale, p.objectives,
             p.target_quantity AS "targetQuantity", p.target_quality AS "targetQuality", p.location,
             p.start_date::text AS "startDate", p.end_date::text AS "endDate",
             p.budget_amount::float8 AS "budgetAmount", p.budget_source AS "budgetSource",
             p.budget_detail AS "budgetDetail", p.indicators, p.expected_outcome AS "expectedOutcome",
             p.created_at AS "createdAt", p.updated_at AS "updatedAt", p.approved_at AS "approvedAt"
      FROM projects p
      LEFT JOIN departments d ON d.id = p.department_id
      LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id = ${id}`,
    sql`
      SELECT a.id, a.action, a.from_status AS "fromStatus", a.to_status AS "toStatus", a.comment,
             a.created_at AS "createdAt", u.display_name AS "userName", u.role AS "userRole"
      FROM project_actions a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.project_id = ${id} ORDER BY a.created_at, a.id`,
    sql`
      SELECT x.id, x.spent_on::text AS "spentOn", x.amount::float8 AS amount, x.description,
             u.display_name AS "createdByName"
      FROM disbursements x LEFT JOIN users u ON u.id = x.created_by
      WHERE x.project_id = ${id} ORDER BY x.spent_on, x.id`,
    sql`
      SELECT r.actual_start::text AS "actualStart", r.actual_end::text AS "actualEnd", r.participants,
             r.results, r.indicator_results AS "indicatorResults", r.satisfaction::float8 AS satisfaction,
             r.problems, r.suggestions, r.submitted_at AS "submittedAt", u.display_name AS "submittedByName"
      FROM project_reports r LEFT JOIN users u ON u.id = r.submitted_by
      WHERE r.project_id = ${id}`,
  ]);

  return NextResponse.json({
    project,
    actions,
    disbursements,
    report: report ?? null,
    can: {
      edit: canEdit(me, ref),
      delete: canDelete(me, ref),
      execute: canExecute(me, ref),
      actions: allowedActions(me, ref),
    },
  });
}

// แก้ไขโครงการ
export async function PUT(req: Request, { params }: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบโครงการ", 404);
  const sql = await db();
  const ref = await loadRef(sql, id);
  if (!ref || !canView(actorOf(user), ref)) return bad("ไม่พบโครงการ", 404);
  if (!canEdit(actorOf(user), ref)) return bad("แก้ไขได้เฉพาะผู้รับผิดชอบ เมื่อโครงการเป็นร่างหรือถูกส่งกลับแก้ไข", 403);

  const [p, problem] = parseProject((await readJson(req)) ?? {});
  if (!p) return bad(problem!);
  // ปีงบประมาณเปลี่ยนไม่ได้หลังออกเลขโครงการแล้ว
  const fy = ref.code ? ref.fiscalYear : p.fiscalYear;
  await sql`
    UPDATE projects SET
      fiscal_year = ${fy}, title = ${p.title}, department_id = ${p.departmentId}, co_owners = ${p.coOwners},
      project_type = ${p.projectType}, strategy = ${p.strategy}, rationale = ${p.rationale},
      objectives = ${p.objectives}, target_quantity = ${p.targetQuantity}, target_quality = ${p.targetQuality},
      location = ${p.location}, start_date = ${p.startDate}, end_date = ${p.endDate},
      budget_amount = ${p.budgetAmount}, budget_source = ${p.budgetSource}, budget_detail = ${p.budgetDetail},
      indicators = ${p.indicators}, expected_outcome = ${p.expectedOutcome}, updated_at = now()
    WHERE id = ${id}
  `;
  return NextResponse.json({ ok: true });
}

// ลบ (เฉพาะร่าง)
export async function DELETE(_req: Request, { params }: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบโครงการ", 404);
  const sql = await db();
  const ref = await loadRef(sql, id);
  if (!ref || !canView(actorOf(user), ref)) return bad("ไม่พบโครงการ", 404);
  if (!canDelete(actorOf(user), ref)) return bad("ลบได้เฉพาะโครงการที่ยังเป็นร่าง (ถ้าส่งแล้วให้ใช้ \"ยกเลิกโครงการ\")", 403);
  await sql`DELETE FROM projects WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
