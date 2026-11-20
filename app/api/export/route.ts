import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BUDGET_SOURCES, fiscalYearOf, PROJECT_TYPES, STATUSES } from "@/lib/projects";

export const dynamic = "force-dynamic";

// GET /api/export?fy=2570 → ไฟล์ CSV เปิดด้วย Excel ได้ (มี BOM ให้ภาษาไทยไม่เพี้ยน)
export async function GET(req: Request) {
  const { error } = await requireUser();
  if (error) return error;
  const fy = Number(new URL(req.url).searchParams.get("fy")) || fiscalYearOf();
  const sql = await db();
  const rows = await sql`
    SELECT p.code, p.title, d.name AS dept, u.display_name AS owner, p.project_type, p.status,
           p.start_date::text AS start_date, p.end_date::text AS end_date, p.budget_source,
           p.budget_amount::float8 AS budget,
           COALESCE((SELECT SUM(amount) FROM disbursements x WHERE x.project_id = p.id), 0)::float8 AS spent,
           r.participants, r.satisfaction::float8 AS satisfaction
    FROM projects p
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN users u ON u.id = p.owner_id
    LEFT JOIN project_reports r ON r.project_id = p.id
    WHERE p.fiscal_year = ${fy} AND p.status <> 'draft'
    ORDER BY d.sort_order NULLS LAST, p.code NULLS LAST, p.id
  `;

  const head = ["รหัสโครงการ", "ชื่อโครงการ", "แผนก/งาน", "ผู้รับผิดชอบ", "ลักษณะ", "สถานะ", "วันเริ่ม", "วันสิ้นสุด",
    "แหล่งงบประมาณ", "งบประมาณ (บาท)", "เบิกจ่ายแล้ว (บาท)", "คงเหลือ (บาท)", "ผู้เข้าร่วม (คน)", "ความพึงพอใจ"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => [
    r.code, r.title, r.dept, r.owner, PROJECT_TYPES[r.project_type as keyof typeof PROJECT_TYPES] ?? r.project_type,
    STATUSES[r.status as keyof typeof STATUSES]?.label ?? r.status, r.start_date, r.end_date,
    BUDGET_SOURCES[r.budget_source as keyof typeof BUDGET_SOURCES] ?? r.budget_source,
    r.budget, r.spent, r.budget - r.spent, r.participants, r.satisfaction,
  ].map(esc).join(","));
  const csv = "﻿" + [head.join(","), ...lines].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projects-${fy}.csv"`,
    },
  });
}
