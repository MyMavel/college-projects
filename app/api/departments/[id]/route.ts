import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, parseId, parseText, readJson } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

// แก้ไข { name?, kind?, active? } (admin)
export async function PUT(req: Request, { params }: Ctx) {
  const { error } = await requireUser(["admin"]);
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบข้อมูล", 404);
  const body = (await readJson(req)) ?? {};
  const sql = await db();
  if (body.name !== undefined) {
    const name = parseText(body.name, 100);
    if (!name) return bad("กรุณากรอกชื่อ");
    const [dup] = await sql`SELECT 1 FROM departments WHERE name = ${name} AND id <> ${id}`;
    if (dup) return bad("มีชื่อนี้อยู่แล้ว");
    await sql`UPDATE departments SET name = ${name} WHERE id = ${id}`;
  }
  if (body.kind !== undefined) await sql`UPDATE departments SET kind = ${parseText(body.kind, 20)} WHERE id = ${id}`;
  if (body.active !== undefined) await sql`UPDATE departments SET active = ${body.active === true} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

// ลบได้เฉพาะที่ยังไม่มีผู้ใช้/โครงการผูกอยู่ (ถ้ามีให้ใช้ "ปิดใช้งาน" แทน)
export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await requireUser(["admin"]);
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบข้อมูล", 404);
  const sql = await db();
  const [used] = await sql`
    SELECT 1 WHERE EXISTS (SELECT 1 FROM users WHERE department_id = ${id})
                OR EXISTS (SELECT 1 FROM projects WHERE department_id = ${id})
  `;
  if (used) return bad("มีผู้ใช้หรือโครงการผูกอยู่ ให้ใช้ \"ปิดใช้งาน\" แทนการลบ");
  const res = await sql`DELETE FROM departments WHERE id = ${id}`;
  return res.count ? NextResponse.json({ ok: true }) : bad("ไม่พบข้อมูล", 404);
}
