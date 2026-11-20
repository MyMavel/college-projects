import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fiscalYearOf } from "@/lib/projects";

export const dynamic = "force-dynamic";

// GET /api/dashboard?fy=2570 → สรุปภาพรวมทั้งปีงบประมาณ (ไม่นับโครงการที่ยังเป็นร่าง)
export async function GET(req: Request) {
  const { error } = await requireUser();
  if (error) return error;
  const fy = Number(new URL(req.url).searchParams.get("fy")) || fiscalYearOf();
  const sql = await db();

  const [byStatus, byDept, bySource, years] = await Promise.all([
    sql<{ status: string; count: number; budget: number }[]>`
      SELECT status, COUNT(*)::int AS count, SUM(budget_amount)::float8 AS budget
      FROM projects WHERE fiscal_year = ${fy} AND status <> 'draft' GROUP BY status`,
    sql`
      SELECT d.id, d.name,
             COUNT(p.id)::int AS total,
             COUNT(p.id) FILTER (WHERE p.status IN ('approved','completed'))::int AS approved,
             COUNT(p.id) FILTER (WHERE p.status = 'completed')::int AS completed,
             COALESCE(SUM(p.budget_amount) FILTER (WHERE p.status IN ('approved','completed')), 0)::float8 AS budget,
             COALESCE(SUM((SELECT SUM(x.amount) FROM disbursements x WHERE x.project_id = p.id)), 0)::float8 AS spent
      FROM departments d
      LEFT JOIN projects p ON p.department_id = d.id AND p.fiscal_year = ${fy} AND p.status <> 'draft'
      GROUP BY d.id, d.name, d.sort_order
      HAVING COUNT(p.id) > 0 OR bool_or(d.active)
      ORDER BY d.sort_order, d.name`,
    sql`
      SELECT p.budget_source AS source,
             SUM(p.budget_amount)::float8 AS budget,
             COALESCE(SUM((SELECT SUM(x.amount) FROM disbursements x WHERE x.project_id = p.id)), 0)::float8 AS spent
      FROM projects p WHERE p.fiscal_year = ${fy} AND p.status IN ('approved','completed')
      GROUP BY p.budget_source ORDER BY budget DESC`,
    sql<{ fy: number }[]>`SELECT DISTINCT fiscal_year AS fy FROM projects ORDER BY fy DESC`,
  ]);

  const count = (s: string[]) => byStatus.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.count, 0);
  const approvedBudget = bySource.reduce((a, r) => a + Number(r.budget), 0);
  const spent = bySource.reduce((a, r) => a + Number(r.spent), 0);

  return NextResponse.json({
    fy,
    years: Array.from(new Set([fiscalYearOf(), fy, ...years.map((y) => y.fy)])).sort((a, b) => b - a),
    totals: {
      submitted: count(["pending_head", "pending_plan", "pending_director", "approved", "completed", "revision", "rejected", "cancelled"]),
      pending: count(["pending_head", "pending_plan", "pending_director"]),
      revision: count(["revision"]),
      approved: count(["approved"]),
      completed: count(["completed"]),
      rejected: count(["rejected", "cancelled"]),
      approvedBudget,
      spent,
    },
    byStatus,
    byDept,
    bySource,
  });
}
