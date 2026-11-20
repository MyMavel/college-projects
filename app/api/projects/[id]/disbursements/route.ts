import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { actorOf, loadRef } from "@/lib/projectData";
import { canExecute } from "@/lib/projects";
import { bad, parseDate, parseId, parseMoney, parseText, readJson } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

// บันทึกการเบิกจ่าย { spentOn, amount, description }
export async function POST(req: Request, { params }: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบโครงการ", 404);
  const sql = await db();
  const ref = await loadRef(sql, id);
  if (!ref) return bad("ไม่พบโครงการ", 404);
  if (!canExecute(actorOf(user), ref)) return bad("บันทึกการเบิกจ่ายได้เฉพาะผู้รับผิดชอบ หลังโครงการได้รับอนุมัติ", 403);

  const body = await readJson(req);
  const amount = parseMoney(body?.amount);
  const spentOn = parseDate(body?.spentOn);
  if (!amount) return bad("จำนวนเงินไม่ถูกต้อง");
  if (!spentOn) return bad("วันที่ไม่ถูกต้อง");
  const [row] = await sql`
    INSERT INTO disbursements (project_id, spent_on, amount, description, created_by)
    VALUES (${id}, ${spentOn}, ${amount}, ${parseText(body?.description, 500)}, ${user.id})
    RETURNING id
  `;
  await sql`UPDATE projects SET updated_at = now() WHERE id = ${id}`;
  return NextResponse.json(row, { status: 201 });
}
