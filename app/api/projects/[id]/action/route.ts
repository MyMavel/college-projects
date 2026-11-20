import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { actorOf, loadRef, logAction, submitProblems } from "@/lib/projectData";
import { allowedActions, firstPending, nextOnApprove, type Action, type Status } from "@/lib/projects";
import { bad, parseId, parseText, readJson } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** POST { action: submit|approve|return|reject|cancel, comment } */
export async function POST(req: Request, { params }: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบโครงการ", 404);
  const body = await readJson(req);
  const action = String(body?.action) as Action;
  const comment = parseText(body?.comment, 2000);

  const sql = await db();
  const me = actorOf(user);
  let result: { status: Status } | { error: string; code?: number } = { error: "ไม่ทราบสาเหตุ" };

  await sql.begin(async (tx) => {
    await tx`SELECT 1 FROM projects WHERE id = ${id} FOR UPDATE`; // กันกดซ้อนกัน 2 คน
    const ref = await loadRef(tx as never, id);
    if (!ref) return (result = { error: "ไม่พบโครงการ", code: 404 });
    if (!allowedActions(me, ref).includes(action)) {
      return (result = { error: "คุณไม่มีสิทธิ์ทำรายการนี้ในขั้นตอนปัจจุบัน (สถานะอาจเปลี่ยนไปแล้ว ลองรีเฟรช)", code: 403 });
    }
    if ((action === "return" || action === "reject") && !comment) {
      return (result = { error: "กรุณาระบุเหตุผล" });
    }

    let to: Status;
    if (action === "submit") {
      const miss = await submitProblems(tx as never, id);
      if (miss.length) return (result = { error: `กรุณากรอกข้อมูลให้ครบก่อนส่ง: ${miss.join(", ")}` });
      to = firstPending(me, ref);
    } else if (action === "approve") {
      to = nextOnApprove(ref.status)!;
    } else if (action === "return") {
      to = "revision";
    } else if (action === "reject") {
      to = "rejected";
    } else {
      to = "cancelled";
    }

    if (to === "approved") {
      // ออกเลขโครงการ: ปีงบ-ลำดับ เช่น 2570-001
      const [{ next }] = await tx<{ next: number }[]>`
        SELECT COALESCE(MAX(SPLIT_PART(code, '-', 2)::int), 0) + 1 AS next
        FROM projects WHERE fiscal_year = ${ref.fiscalYear} AND code IS NOT NULL
      `;
      const code = `${ref.fiscalYear}-${String(next).padStart(3, "0")}`;
      await tx`UPDATE projects SET status = ${to}, code = ${code}, approved_at = now(), updated_at = now() WHERE id = ${id}`;
    } else {
      await tx`UPDATE projects SET status = ${to}, updated_at = now() WHERE id = ${id}`;
    }
    await logAction(tx as never, id, me.id, action, ref.status, to, comment);
    result = { status: to };
  });

  return "error" in result ? bad(result.error, result.code) : NextResponse.json(result);
}
