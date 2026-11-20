import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "./db";
import { readSession, SESSION_COOKIE } from "./session";
import type { Role } from "./site";

export type CurrentUser = {
  id: number; username: string; displayName: string; role: Role;
  departmentId: number | null; departmentName: string | null;
};

/** ผู้ใช้ที่ล็อกอินอยู่ (ตรวจกับฐานข้อมูลทุกครั้ง: ถ้าถูกปิดบัญชี/ลบ จะใช้ไม่ได้ทันที) */
export async function currentUser(): Promise<CurrentUser | null> {
  const s = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const sql = await db();
  const [u] = await sql<CurrentUser[]>`
    SELECT u.id, u.username, u.display_name AS "displayName", u.role,
           u.department_id AS "departmentId", d.name AS "departmentName"
    FROM users u LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.id = ${s.uid} AND u.active
  `;
  return u ?? null;
}

type Guard = { user: CurrentUser; error?: never } | { user?: never; error: NextResponse };

/**
 * ใช้ในทุก API route:
 *   const { user, error } = await requireUser();            // ต้องล็อกอิน
 *   const { user, error } = await requireUser(["admin"]);   // เฉพาะบทบาทที่กำหนด
 *   if (error) return error;
 */
export async function requireUser(roles?: Role[]): Promise<Guard> {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  if (roles && !roles.includes(user.role)) {
    return { error: NextResponse.json({ error: "คุณไม่มีสิทธิ์ใช้งานส่วนนี้" }, { status: 403 }) };
  }
  return { user };
}
