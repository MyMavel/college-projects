import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { bad, readJson } from "@/lib/validate";

// เปลี่ยนรหัสผ่านของตัวเอง { current, next }
export async function PUT(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const body = await readJson(req);
  const problem = passwordProblem(body?.next);
  if (problem) return bad(problem);

  const sql = await db();
  const [row] = await sql<{ password_hash: string }[]>`SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!(await verifyPassword(String(body?.current ?? ""), row.password_hash))) {
    return bad("รหัสผ่านปัจจุบันไม่ถูกต้อง");
  }
  await sql`UPDATE users SET password_hash = ${await hashPassword(String(body!.next))} WHERE id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
