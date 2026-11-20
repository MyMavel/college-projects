import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

// ด่านแรกก่อนเข้าทุกหน้า: ยังไม่ล็อกอิน → ไปหน้า /login, หน้า /admin → เฉพาะผู้ดูแลระบบ
// (API แต่ละตัวตรวจสิทธิ์ซ้ำอีกชั้นด้วย requireUser)
const PUBLIC = ["/login", "/api/login", "/api/health"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
