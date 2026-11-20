"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, baht, thaiDate, useMe, type Department } from "@/components/api";
import StatusBadge from "@/components/StatusBadge";
import { STATUSES, type Status } from "@/lib/projects";

type Row = {
  id: number; code: string | null; fiscalYear: number; title: string; status: Status; budgetAmount: number;
  spent: number; startDate: string | null; endDate: string | null; departmentName: string | null; ownerName: string | null;
};

const TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "mine", label: "ของฉัน" },
  { key: "todo", label: "รอฉันอนุมัติ" },
] as const;

export default function ProjectsPage() {
  const me = useMe();
  const [fy, setFy] = useState<number | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [depts, setDepts] = useState<Department[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "mine" || t === "todo") setTab(t);
    api<Department[]>("/api/departments").then(setDepts).catch(() => {});
  }, []);
  useEffect(() => { if (me && fy === null) setFy(me.currentFiscalYear); }, [me, fy]);

  useEffect(() => {
    if (fy === null) return;
    const p = new URLSearchParams({ fy: String(fy), q });
    if (dept) p.set("dept", dept);
    if (status) p.set("status", status);
    if (tab === "mine") p.set("mine", "1");
    if (tab === "todo") p.set("todo", "1");
    const t = setTimeout(() => api<Row[]>(`/api/projects?${p}`).then(setRows).catch((e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [fy, dept, status, q, tab]);

  const isApprover = me && me.role !== "teacher";
  const total = rows?.reduce((a, r) => a + r.budgetAmount, 0) ?? 0;

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">📋 โครงการ</h1>
        <div className="row-gap">
          {fy && <a className="btn ghost" href={`/api/export?fy=${fy}`}>⬇️ Excel</a>}
          <Link className="btn primary" href="/projects/new">+ เสนอโครงการ</Link>
        </div>
      </div>

      <div className="tabs">
        {TABS.filter((t) => t.key !== "todo" || isApprover).map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <section className="card filters">
        <label>ปีงบประมาณ
          <select value={fy ?? ""} onChange={(e) => setFy(Number(e.target.value))}>
            {me && [me.currentFiscalYear + 1, me.currentFiscalYear, me.currentFiscalYear - 1, me.currentFiscalYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label>แผนก/งาน
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>สถานะ
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {Object.entries(STATUSES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
        <label className="grow">ค้นหา
          <input type="search" placeholder="ชื่อหรือรหัสโครงการ" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </section>

      {error && <p className="error">{error}</p>}
      {rows === null && <p className="muted">กำลังโหลด…</p>}
      {rows?.length === 0 && (
        <section className="card empty">
          <p>{tab === "todo" ? "ไม่มีโครงการรอคุณอนุมัติ 🎉" : "ยังไม่มีโครงการ"}</p>
        </section>
      )}

      {rows && rows.length > 0 && (
        <section className="card">
          <div className="row-between small muted">
            <span>{rows.length} โครงการ</span>
            <span>งบประมาณรวม {baht(total)} บาท</span>
          </div>
          <ul className="project-list">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/projects/${r.id}`}>
                  <div className="pl-main">
                    <div className="pl-top">
                      <StatusBadge status={r.status} />
                      {r.code && <code>{r.code}</code>}
                    </div>
                    <strong className="pl-title">{r.title}</strong>
                    <small className="muted">
                      {r.departmentName ?? "ไม่ระบุแผนก"} · {r.ownerName ?? "—"}
                      {r.startDate && ` · ${thaiDate(r.startDate)} – ${thaiDate(r.endDate)}`}
                    </small>
                  </div>
                  <div className="pl-money">
                    <strong>{baht(r.budgetAmount)}</strong>
                    {r.spent > 0 && <small className="muted">ใช้ไป {baht(r.spent)}</small>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
