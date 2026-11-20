import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, parseText, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// รายชื่อแผนก/งาน (ทุกคนดูได้)
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const sql = await db();
  const rows = await sql`
    SELECT d.id, d.name, d.kind, d.sort_order AS "sortOrder", d.active,
           (SELECT COUNT(*)::int FROM users u WHERE u.department_id = d.id) AS "userCount",
           (SELECT COUNT(*)::int FROM projects p WHERE p.department_id = d.id) AS "projectCount"
    FROM departments d ORDER BY d.sort_order, d.name
  `;
  return NextResponse.json(rows);
}

// เพิ่มแผนก/งาน { name, kind } (admin)
export async function POST(req: Request) {
  const { error } = await requireUser(["admin"]);
  if (error) return error;
  const body = await readJson(req);
  const name = parseText(body?.name, 100);
  const kind = parseText(body?.kind, 20) || "แผนกวิชา";
  if (!name) return bad("กรุณากรอกชื่อ");
  const sql = await db();
  const [dup] = await sql`SELECT 1 FROM departments WHERE name = ${name}`;
  if (dup) return bad("มีชื่อนี้อยู่แล้ว");
  const [row] = await sql`
    INSERT INTO departments (name, kind, sort_order)
    VALUES (${name}, ${kind}, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM departments))
    RETURNING id
  `;
  return NextResponse.json(row, { status: 201 });
}
