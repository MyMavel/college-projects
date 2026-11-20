import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/password";
import { isRole } from "@/lib/site";
import { bad, parseId, parseOptionalId, parseText, readJson } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

// แก้ไขผู้ใช้ { displayName?, role?, departmentId?, active?, password? } (เฉพาะ admin)
export async function PUT(req: Request, { params }: Ctx) {
  const { user: me, error } = await requireUser(["admin"]);
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบผู้ใช้", 404);
  const body = (await readJson(req)) ?? {};
  const sql = await db();

  const [target] = await sql<{ id: number }[]>`SELECT id FROM users WHERE id = ${id}`;
  if (!target) return bad("ไม่พบผู้ใช้", 404);

  if (id === me.id && ((body.role !== undefined && body.role !== "admin") || body.active === false)) {
    return bad("ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตัวเองได้");
  }

  if (body.displayName !== undefined) {
    const name = parseText(body.displayName, 100);
    if (!name) return bad("กรุณากรอกชื่อที่แสดง");
    await sql`UPDATE users SET display_name = ${name} WHERE id = ${id}`;
  }
  if (body.role !== undefined) {
    if (!isRole(body.role)) return bad("บทบาทไม่ถูกต้อง");
    await sql`UPDATE users SET role = ${body.role} WHERE id = ${id}`;
  }
  if (body.departmentId !== undefined) {
    await sql`UPDATE users SET department_id = ${parseOptionalId(body.departmentId)} WHERE id = ${id}`;
  }
  if (body.active !== undefined) {
    await sql`UPDATE users SET active = ${body.active === true} WHERE id = ${id}`;
  }
  if (body.password !== undefined) {
    const problem = passwordProblem(body.password);
    if (problem) return bad(problem);
    await sql`UPDATE users SET password_hash = ${await hashPassword(String(body.password))} WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}

// ลบผู้ใช้ (เฉพาะ admin, ลบตัวเองไม่ได้)
export async function DELETE(_req: Request, { params }: Ctx) {
  const { user: me, error } = await requireUser(["admin"]);
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return bad("ไม่พบผู้ใช้", 404);
  if (id === me.id) return bad("ไม่สามารถลบบัญชีของตัวเองได้");
  const sql = await db();
  const res = await sql`DELETE FROM users WHERE id = ${id}`;
  return res.count ? NextResponse.json({ ok: true }) : bad("ไม่พบผู้ใช้", 404);
}
