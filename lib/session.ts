import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "./site";

/**
 * Session แบบ cookie ที่มีลายเซ็น (HMAC) — ไม่ต้องมีตาราง session
 * รูปแบบ: base64url(JSON) + "." + ลายเซ็น
 */
export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 วัน

export type SessionData = { uid: number; role: Role; name: string; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET ต้องยาวอย่างน้อย 16 ตัวอักษร");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSession(data: Omit<SessionData, "exp">): string {
  const payload = Buffer.from(
    JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token: string | undefined): SessionData | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionData;
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
