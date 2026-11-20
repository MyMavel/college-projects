import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { actorOf, loadRef, logAction } from "@/lib/projectData";
import { canExecute } from "@/lib/projects";
import { bad, parseDate, parseId, parseText, readJson } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

// ส่ง/แก้ไขรายงานผล → โครงการเปลี่ยนเป็น "เสร็จสิ้น"
export async function PUT(req: Request, { params }: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบโครงการ", 404);
  const sql = await db();
  const ref = await loadRef(sql, id);
  if (!ref) return bad("ไม่พบโครงการ", 404);
  if (!canExecute(actorOf(user), ref)) return bad("รายงานผลได้เฉพาะผู้รับผิดชอบ หลังโครงการได้รับอนุมัติ", 403);

  const b = (await readJson(req)) ?? {};
  const results = parseText(b.results, 5000);
  if (!results) return bad("กรุณากรอกผลการดำเนินงาน");
  const actualStart = b.actualStart ? parseDate(b.actualStart) : null;
  const actualEnd = b.actualEnd ? parseDate(b.actualEnd) : null;
  if ((b.actualStart && !actualStart) || (b.actualEnd && !actualEnd)) return bad("วันที่ไม่ถูกต้อง");
  const participants = b.participants === "" || b.participants == null ? null : Number(b.participants);
  if (participants !== null && (!Number.isInteger(participants) || participants < 0)) return bad("จำนวนผู้เข้าร่วมไม่ถูกต้อง");
  const satisfaction = b.satisfaction === "" || b.satisfaction == null ? null : Number(b.satisfaction);
  if (satisfaction !== null && !(satisfaction >= 0 && satisfaction <= 5)) return bad("คะแนนความพึงพอใจต้องอยู่ระหว่าง 0–5");

  const v = {
    actual_start: actualStart, actual_end: actualEnd, participants, results,
    indicator_results: parseText(b.indicatorResults, 5000), satisfaction,
    problems: parseText(b.problems, 5000), suggestions: parseText(b.suggestions, 5000),
    submitted_by: user.id,
  };
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO project_reports ${tx({ project_id: id, ...v })}
      ON CONFLICT (project_id) DO UPDATE SET ${tx(v)}, submitted_at = now()
    `;
    if (ref.status === "approved") {
      await tx`UPDATE projects SET status = 'completed', updated_at = now() WHERE id = ${id}`;
      await logAction(tx as never, id, user.id, "report", "approved", "completed");
    }
  });
  return NextResponse.json({ ok: true });
}
