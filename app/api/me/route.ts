import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { fiscalYearOf } from "@/lib/projects";

export const dynamic = "force-dynamic";

// ข้อมูลผู้ใช้ที่ล็อกอินอยู่ (หน้าเว็บใช้แสดงชื่อและเมนูตามสิทธิ์)
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  return NextResponse.json({ ...user, currentFiscalYear: fiscalYearOf() });
}
