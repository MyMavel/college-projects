import { NextResponse } from "next/server";

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseId(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export function parseText(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function parseMoney(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n >= 1_000_000_000) return null;
  return Math.round(n * 100) / 100;
}

export function parseDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

export function parseOptionalId(v: unknown): number | null {
  const n = Number(v);
  return v !== null && v !== "" && Number.isInteger(n) && n > 0 ? n : null;
}
