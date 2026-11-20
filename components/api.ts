"use client";

// ตัวช่วยเรียก API: ถ้า error จะโยนข้อความภาษาไทยจาก server ออกมา
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  if (res.status === 401 && !url.includes("/api/login")) {
    window.location.href = "/login";
    throw new Error("กรุณาเข้าสู่ระบบ");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
  return data as T;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** "2026-11-20" → "20 พ.ย. 2569" (full=true → "20 พฤศจิกายน 2569") */
export function thaiDate(d: string | null | undefined, full = false): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return `${day} ${(full ? TH_MONTHS_FULL : TH_MONTHS)[m - 1]} ${y + 543}`;
}

export function baht(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type Department = { id: number; name: string; kind: string; active: boolean; userCount?: number; projectCount?: number };
export type Me = {
  id: number; username: string; displayName: string; role: import("@/lib/site").Role;
  departmentId: number | null; departmentName: string | null; currentFiscalYear: number;
};

import { useEffect, useState } from "react";

/** ข้อมูลผู้ใช้ที่ล็อกอินอยู่ (ใช้ในหน้าเว็บ) */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>("/api/me").then(setMe).catch(() => {}); }, []);
  return me;
}
