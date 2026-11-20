import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { actorOf, loadRef } from "@/lib/projectData";
import { canExecute } from "@/lib/projects";
import { bad, parseId } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบรายการ", 404);
  const sql = await db();
  const [d] = await sql<{ project_id: number }[]>`SELECT project_id FROM disbursements WHERE id = ${id}`;
  if (!d) return bad("ไม่พบรายการ", 404);
  const ref = await loadRef(sql, d.project_id);
  if (!ref || !canExecute(actorOf(user), ref)) return bad("คุณไม่มีสิทธิ์ลบรายการนี้", 403);
  await sql`DELETE FROM disbursements WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
