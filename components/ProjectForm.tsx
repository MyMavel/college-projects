"use client";

import { useEffect, useState } from "react";
import { api, type Department, type Me } from "./api";
import { BUDGET_SOURCES, PROJECT_TYPES } from "@/lib/projects";

export type ProjectValues = {
  title: string; fiscalYear: number; departmentId: string; coOwners: string; projectType: string;
  strategy: string; rationale: string; objectives: string; targetQuantity: string; targetQuality: string;
  location: string; startDate: string; endDate: string; budgetAmount: string; budgetSource: string;
  budgetDetail: string; indicators: string; expectedOutcome: string;
};

export function emptyProject(me: Me): ProjectValues {
  return {
    title: "", fiscalYear: me.currentFiscalYear, departmentId: me.departmentId ? String(me.departmentId) : "",
    coOwners: "", projectType: "new", strategy: "", rationale: "", objectives: "", targetQuantity: "",
    targetQuality: "", location: "", startDate: "", endDate: "", budgetAmount: "", budgetSource: "state",
    budgetDetail: "", indicators: "", expectedOutcome: "",
  };
}

function Area({ label, hint, value, onChange, rows = 4, required }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number; required?: boolean;
}) {
  return (
    <label className="full">
      <span>{label}{required && <b className="req"> *</b>} {hint && <small className="muted">— {hint}</small>}</span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} maxLength={5000} />
    </label>
  );
}

export default function ProjectForm({ initial, me, lockFiscalYear, onSave, saveLabel }: {
  initial: ProjectValues; me: Me; lockFiscalYear?: boolean; saveLabel: string;
  onSave: (v: ProjectValues) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [depts, setDepts] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProjectValues>(k: K) => (val: ProjectValues[K]) => setV((o) => ({ ...o, [k]: val }));

  useEffect(() => { api<Department[]>("/api/departments").then(setDepts).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await onSave(v); } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  const fy = me.currentFiscalYear;
  const noBudget = v.budgetSource === "none";

  return (
    <form className="project-form" onSubmit={submit}>
      <section className="card">
        <h2>1. ข้อมูลทั่วไป</h2>
        <div className="grid-form">
          <label className="full"><span>ชื่อโครงการ<b className="req"> *</b></span>
            <input required maxLength={300} value={v.title} onChange={(e) => set("title")(e.target.value)} placeholder="เช่น โครงการอบรมเชิงปฏิบัติการการซ่อมบำรุงเครื่องยนต์เล็ก" />
          </label>
          <label><span>ปีงบประมาณ<b className="req"> *</b></span>
            <select value={v.fiscalYear} disabled={lockFiscalYear} onChange={(e) => set("fiscalYear")(Number(e.target.value))}>
              {[fy - 1, fy, fy + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label><span>แผนก/งาน<b className="req"> *</b></span>
            <select value={v.departmentId} onChange={(e) => set("departmentId")(e.target.value)}>
              <option value="">— เลือก —</option>
              {depts.filter((d) => d.active || String(d.id) === v.departmentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label><span>ลักษณะโครงการ</span>
            <select value={v.projectType} onChange={(e) => set("projectType")(e.target.value)}>
              {Object.entries(PROJECT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label><span>ผู้ร่วมรับผิดชอบ</span>
            <input maxLength={500} value={v.coOwners} onChange={(e) => set("coOwners")(e.target.value)} placeholder="เช่น นายสมชาย ใจดี, นางสาวสมศรี รักเรียน" />
          </label>
          <Area label="ความสอดคล้องกับยุทธศาสตร์ / มาตรฐานการอาชีวศึกษา" value={v.strategy} onChange={set("strategy")} rows={2} />
        </div>
      </section>

      <section className="card">
        <h2>2. รายละเอียดโครงการ</h2>
        <div className="grid-form">
          <Area label="หลักการและเหตุผล" value={v.rationale} onChange={set("rationale")} rows={6} />
          <Area label="วัตถุประสงค์" hint="ข้อละบรรทัด" value={v.objectives} onChange={set("objectives")} required />
          <Area label="เป้าหมายเชิงปริมาณ" value={v.targetQuantity} onChange={set("targetQuantity")} rows={3} required />
          <Area label="เป้าหมายเชิงคุณภาพ" value={v.targetQuality} onChange={set("targetQuality")} rows={3} />
          <label><span>วันเริ่มต้น<b className="req"> *</b></span><input type="date" value={v.startDate} onChange={(e) => set("startDate")(e.target.value)} /></label>
          <label><span>วันสิ้นสุด<b className="req"> *</b></span><input type="date" value={v.endDate} min={v.startDate || undefined} onChange={(e) => set("endDate")(e.target.value)} /></label>
          <label className="full"><span>สถานที่ดำเนินการ</span><input maxLength={300} value={v.location} onChange={(e) => set("location")(e.target.value)} /></label>
        </div>
      </section>

      <section className="card">
        <h2>3. งบประมาณ</h2>
        <div className="grid-form">
          <label><span>แหล่งงบประมาณ</span>
            <select value={v.budgetSource} onChange={(e) => set("budgetSource")(e.target.value)}>
              {Object.entries(BUDGET_SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label><span>จำนวนเงิน (บาท){!noBudget && <b className="req"> *</b>}</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" disabled={noBudget} value={noBudget ? "" : v.budgetAmount} onChange={(e) => set("budgetAmount")(e.target.value)} placeholder="0.00" />
          </label>
          {!noBudget && <Area label="รายละเอียดการใช้งบประมาณ" hint="เช่น ค่าวัสดุ ค่าตอบแทนวิทยากร ค่าอาหาร" value={v.budgetDetail} onChange={set("budgetDetail")} />}
        </div>
      </section>

      <section className="card">
        <h2>4. การประเมินผล</h2>
        <div className="grid-form">
          <Area label="ตัวชี้วัดความสำเร็จ" hint="เช่น ผู้เข้าร่วมไม่น้อยกว่าร้อยละ 80" value={v.indicators} onChange={set("indicators")} required />
          <Area label="ผลที่คาดว่าจะได้รับ" value={v.expectedOutcome} onChange={set("expectedOutcome")} />
        </div>
      </section>

      <div className="sticky-actions">
        <span className="muted small"><b className="req">*</b> จำเป็นต้องกรอกก่อนส่งขออนุมัติ (บันทึกร่างได้แม้กรอกไม่ครบ)</span>
        {error && <span className="error">{error}</span>}
        <button className="btn primary" disabled={busy}>{busy ? "กำลังบันทึก…" : saveLabel}</button>
      </div>
    </form>
  );
}
