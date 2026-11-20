"use client";

import { useEffect, useState } from "react";
import { api, type Department } from "@/components/api";

const KINDS = ["แผนกวิชา", "งาน", "ฝ่าย"];

export default function DepartmentsPage() {
  const [rows, setRows] = useState<Department[] | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState(KINDS[0]);
  const [error, setError] = useState("");

  const load = () => api<Department[]>("/api/departments").then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { await api("/api/departments", { method: "POST", json: { name, kind } }); setName(""); load(); }
    catch (err) { setError((err as Error).message); }
  }
  async function update(d: Department, patch: Partial<Department>) {
    setError("");
    try { await api(`/api/departments/${d.id}`, { method: "PUT", json: patch }); load(); }
    catch (err) { setError((err as Error).message); }
  }
  async function rename(d: Department) {
    const n = prompt("ชื่อใหม่", d.name);
    if (n && n !== d.name) await update(d, { name: n });
  }
  async function remove(d: Department) {
    if (!confirm(`ลบ "${d.name}" ?`)) return;
    try { await api(`/api/departments/${d.id}`, { method: "DELETE" }); load(); }
    catch (err) { setError((err as Error).message); }
  }

  return (
    <>
      <h1 className="page-title">🏢 แผนกวิชา / งาน / ฝ่าย</h1>
      <section className="card">
        <form className="disb-form" onSubmit={add}>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <input className="grow" required maxLength={100} placeholder="เช่น แผนกวิชาช่างยนต์, งานวางแผนและงบประมาณ" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary">+ เพิ่ม</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ชื่อ</th><th>ประเภท</th><th className="num">ผู้ใช้</th><th className="num">โครงการ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {rows?.map((d) => (
                <tr key={d.id} className={d.active ? "" : "inactive"}>
                  <td>{d.name}</td>
                  <td>
                    <select value={d.kind} onChange={(e) => update(d, { kind: e.target.value })}>
                      {KINDS.map((k) => <option key={k}>{k}</option>)}
                    </select>
                  </td>
                  <td className="num">{d.userCount}</td>
                  <td className="num">{d.projectCount}</td>
                  <td><button className={"pill " + (d.active ? "on" : "off")} onClick={() => update(d, { active: !d.active })}>{d.active ? "ใช้งาน" : "ปิดใช้งาน"}</button></td>
                  <td className="nowrap">
                    <button className="icon-btn" title="เปลี่ยนชื่อ" onClick={() => rename(d)}>✏️</button>
                    <button className="icon-btn" title="ลบ" onClick={() => remove(d)}>🗑️</button>
                  </td>
                </tr>
              ))}
              {rows?.length === 0 && <tr><td colSpan={6} className="muted center">ยังไม่มีข้อมูล เริ่มเพิ่มด้านบนได้เลย</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
