import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { cookieOptions, createSession, SESSION_COOKIE } from "@/lib/session";
import { bad, parseText, readJson } from "@/lib/validate";
import type { Role } from "@/lib/site";

export async function POST(req: Request) {
  const body = await readJson(req);
  const username = parseText(body?.username, 50).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";

  const sql = await db();
  const [u] = await sql<{ id: number; display_name: string; role: Role; password_hash: string; active: boolean }[]>`
    SELECT id, display_name, role, password_hash, active FROM users WHERE username = ${username}
  `;
  const ok = u && u.active && (await verifyPassword(password, u.password_hash));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // หน่วงเวลา กันการเดารหัส
    return bad("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSession({ uid: u.id, role: u.role, name: u.display_name }), cookieOptions());
  return res;
}
