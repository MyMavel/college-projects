"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, baht, useMe } from "@/components/api";
import { BUDGET_SOURCES } from "@/lib/projects";

type Dash = {
  fy: number; years: number[];
  totals: { submitted: number; pending: number; revision: number; approved: number; completed: number; rejected: number; approvedBudget: number; spent: number };
  byDept: { id: number; name: string; total: number; approved: number; completed: number; budget: number; spent: number }[];
  bySource: { source: keyof typeof BUDGET_SOURCES; budget: number; spent: number }[];
};

function Stat({ label, value, sub, href, tone }: { label: string; value: string | number; sub?: string; href?: string; tone?: string }) {
  const body = (
    <>
      <span className="muted">{label}</span>
      <strong className={tone}>{value}</strong>
      {sub && <small className="muted">{sub}</small>}
    </>
  );
  return href ? <Link href={href} className="card stat link">{body}</Link> : <div className="card stat">{body}</div>;
}

export default function Dashboard() {
  const me = useMe();
  const [fy, setFy] = useState<number | null>(null);
  const [d, setD] = useState<Dash | null>(null);
  const [todo, setTodo] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { if (me && fy === null) setFy(me.currentFiscalYear); }, [me, fy]);
  useEffect(() => {
    if (fy === null) return;
    api<Dash>(`/api/dashboard?fy=${fy}`).then(setD).catch((e) => setError(e.message));
  }, [fy]);
  useEffect(() => {
    if (me && me.role !== "teacher") api<unknown[]>("/api/projects?todo=1").then((r) => setTodo(r.length)).catch(() => {});
  }, [me]);

  if (error) return <p className="error">{error}</p>;
  if (!me || !d) return <p className="muted">กำลังโหลด…</p>;
  const t = d.totals;
  const pct = t.approvedBudget ? Math.round((t.spent / t.approvedBudget) * 100) : 0;
  const maxDept = Math.max(1, ...d.byDept.map((x) => x.budget));

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">สวัสดี {me.displayName} 👋</h1>
        <label className="inline">ปีงบประมาณ
          <select value={fy ?? ""} onChange={(e) => setFy(Number(e.target.value))}>
            {d.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {todo !== null && todo > 0 && (
        <Link href="/projects?tab=todo" className="alert info link">🔔 มี <b>{todo}</b> โครงการรอคุณพิจารณาอนุมัติ → ดูรายการ</Link>
      )}

      <section className="stats">
        <Stat label="โครงการที่เสนอ" value={t.submitted} href="/projects" />
        <Stat label="รออนุมัติ" value={t.pending} sub={t.revision ? `ส่งกลับแก้ไข ${t.revision}` : undefined} tone="blue" />
        <Stat label="อนุมัติแล้ว (กำลังดำเนินการ)" value={t.approved} tone="green" />
        <Stat label="เสร็จสิ้น / รายงานผลแล้ว" value={t.completed} tone="teal" />
      </section>

      <section className="stats">
        <Stat label="งบประมาณที่อนุมัติ (บาท)" value={baht(t.approvedBudget)} />
        <Stat label="เบิกจ่ายแล้ว (บาท)" value={baht(t.spent)} sub={`${pct}% ของงบที่อนุมัติ`} />
        <Stat label="คงเหลือ (บาท)" value={baht(t.approvedBudget - t.spent)} tone={t.approvedBudget - t.spent < 0 ? "red" : "green"} />
      </section>

      <div className="detail-grid">
        <section className="card col-main">
          <h2>แยกตามแผนก/งาน</h2>
          {d.byDept.length === 0 && <p className="muted">ยังไม่มีข้อมูล — เพิ่มแผนก/งานที่เมนู “แผนก/งาน”</p>}
          <div className="table-wrap">
            <table className="table dept-table">
              <thead><tr><th>แผนก/งาน</th><th className="num">โครงการ</th><th className="num">อนุมัติ</th><th className="num">เสร็จ</th><th>งบที่อนุมัติ / เบิกจ่าย</th></tr></thead>
              <tbody>
                {d.byDept.map((x) => (
                  <tr key={x.id}>
                    <td>{x.name}</td>
                    <td className="num">{x.total}</td>
                    <td className="num">{x.approved}</td>
                    <td className="num">{x.completed}</td>
                    <td>
                      <div className="mini-bar" title={`เบิกจ่าย ${baht(x.spent)}`}>
                        <div className="mb-budget" style={{ width: (x.budget / maxDept) * 100 + "%" }}>
                          <div className="mb-spent" style={{ width: x.budget ? Math.min(100, (x.spent / x.budget) * 100) + "%" : 0 }} />
                        </div>
                      </div>
                      <small className="muted">{baht(x.budget)} / {baht(x.spent)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card col-side">
          <h2>แยกตามแหล่งงบประมาณ</h2>
          {d.bySource.length === 0 && <p className="muted small">ยังไม่มีโครงการที่อนุมัติ</p>}
          {d.bySource.map((s) => (
            <div key={s.source} className="source-row">
              <div className="money-row"><span>{BUDGET_SOURCES[s.source]}</span><strong>{baht(s.budget)}</strong></div>
              <div className="bar"><div className="bar-fill" style={{ width: s.budget ? Math.min(100, (s.spent / s.budget) * 100) + "%" : 0 }} /></div>
              <small className="muted">เบิกจ่ายแล้ว {baht(s.spent)}</small>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
