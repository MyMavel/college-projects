"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE, ROLES, type Role } from "@/lib/site";
import { api } from "./api";

type NavUser = { displayName: string; role: Role } | null;

// 🧭 เมนูหลัก — เพิ่มเมนูของโมดูลใหม่ที่นี่ (roles = บทบาทที่เห็นเมนูนี้, ไม่ใส่ = ทุกคน)
const LINKS: { href: string; label: string; icon: string; roles?: Role[] }[] = [
  { href: "/", label: "ภาพรวม", icon: "📊" },
  { href: "/projects", label: "โครงการ", icon: "📋" },
  { href: "/admin/departments", label: "แผนก/งาน", icon: "🏢", roles: ["admin"] },
  { href: "/admin/users", label: "ผู้ใช้", icon: "👥", roles: ["admin"] },
  { href: "/account", label: "บัญชี", icon: "🔑" },
];

export default function Nav({ user }: { user: NavUser }) {
  const path = usePathname();
  if (!user || path === "/login") return null;

  async function logout() {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">{SITE.icon} <span className="brand-full">{SITE.name}</span><span className="brand-short">{SITE.shortName}</span></Link>
        <nav className="nav-links">
          {LINKS.filter((l) => !l.roles || l.roles.includes(user.role)).map((l) => (
            <Link key={l.href} href={l.href} className={(l.href === "/" ? path === "/" : path.startsWith(l.href)) ? "active" : ""}>
              <span aria-hidden>{l.icon}</span> {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-user">
          <span className="who">{user.displayName} <small>({ROLES[user.role]})</small></span>
          <button className="link-btn" onClick={logout}>ออกจากระบบ</button>
        </div>
      </div>
    </header>
  );
}
