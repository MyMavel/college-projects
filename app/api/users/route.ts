import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/password";
import { isRole } from "@/lib/site";
import { bad, parseOptionalId, parseText, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// รายชื่อผู้ใช้ทั้งหมด (เฉพาะ admin)
export async function GET() {
  const { error } = await requireUser(["admin"]);
  if (error) return error;
  const sql = await db();
  const rows = await sql`
    SELECT u.id, u.username, u.display_name AS "displayName", u.role, u.active,
           u.department_id AS "departmentId", d.name AS "departmentName", u.created_at AS "createdAt"
    FROM users u LEFT JOIN departments d ON d.id = u.department_id
    ORDER BY u.id
  `;
  return NextResponse.json(rows);
}

// เพิ่มผู้ใช้ { username, displayName, role, password, departmentId }
export async function POST(req: Request) {
  const { error } = await requireUser(["admin"]);
  if (error) return error;
  const body = await readJson(req);
  const username = parseText(body?.username, 50).toLowerCase();
  const displayName = parseText(body?.displayName, 100);

  if (!/^[a-z0-9._-]{3,50}$/.test(username)) return bad("ชื่อผู้ใช้ต้องเป็น a-z, 0-9, . _ - ยาว 3–50 ตัว");
  if (!displayName) return bad("กรุณากรอกชื่อที่แสดง");
  if (!isRole(body?.role)) return bad("บทบาทไม่ถูกต้อง");
  const problem = passwordProblem(body?.password);
  if (problem) return bad(problem);

  const sql = await db();
  const [exists] = await sql`SELECT 1 FROM users WHERE username = ${username}`;
  if (exists) return bad("ชื่อผู้ใช้นี้มีอยู่แล้ว");
  const [row] = await sql`
    INSERT INTO users (username, display_name, role, password_hash, department_id)
    VALUES (${username}, ${displayName}, ${body.role}, ${await hashPassword(String(body.password))},
            ${parseOptionalId(body.departmentId)})
    RETURNING id
  `;
  return NextResponse.json(row, { status: 201 });
}
