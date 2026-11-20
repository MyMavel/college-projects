"use client";

import { useEffect, useState } from "react";
import { api, formatDateTime, type Department } from "@/components/api";
import { ROLES, type Role } from "@/lib/site";

type User = { id: number; username: string; displayName: string; role: Role; active: boolean; departmentId: number | null; createdAt: string };

function AddUser({ onAdded, depts }: { onAdded: () => void; depts: Department[] }) {
  const empty = { username: "", displayName: "", role: "teacher" as Role, password: "", departmentId: "" };
  const [f, setF] = useState(empty);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/users", { method: "POST", json: f });
      setF(empty);
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="grid-form" onSubmit={submit}>
      <label>ชื่อผู้ใช้ (ใช้ล็อกอิน)<input required pattern="[a-zA-Z0-9._\-]{3,50}" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="เช่น somchai.k" /></label>
      <label>ชื่อที่แสดง<input required value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="เช่น นายสมชาย ใจดี" /></label>
      <label>บทบาท
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>แผนก/งาน
        <select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
          <option value="">— ไม่ระบุ —</option>
          {depts.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label>รหัสผ่านเริ่มต้น<input required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="อย่างน้อย 8 ตัว" /></label>
      {error && <p className="error full">{error}</p>}
      <div className="form-actions full"><button className="btn primary">+ เพิ่มผู้ใช้</button></div>
    </form>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [depts, setDepts] = useState<Department[]>([]);
  useEffect(() => { api<Department[]>("/api/departments").then(setDepts).catch(() => {}); }, []);

  const load = () => api<User[]>("/api/users").then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function update(u: User, patch: Partial<User> & { password?: string }) {
    setError("");
    try { await api(`/api/users/${u.id}`, { method: "PUT", json: patch }); load(); }
    catch (e) { setError((e as Error).message); }
  }

  async function resetPassword(u: User) {
    const pw = prompt(`ตั้งรหัสผ่านใหม่ให้ ${u.displayName} (อย่างน้อย 8 ตัว)`);
    if (pw) await update(u, { password: pw });
  }

  async function remove(u: User) {
    if (!confirm(`ลบผู้ใช้ ${u.displayName} (${u.username}) ?`)) return;
    try { await api(`/api/users/${u.id}`, { method: "DELETE" }); load(); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <section className="card">
        <h2>👥 เพิ่มผู้ใช้</h2>
        <AddUser onAdded={load} depts={depts} />
      </section>
      <section className="card">
        <h2>ผู้ใช้ทั้งหมด {users && <span className="muted">({users.length})</span>}</h2>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อที่แสดง</th><th>บทบาท</th><th>แผนก/งาน</th><th>สถานะ</th><th>สร้างเมื่อ</th><th></th></tr></thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className={u.active ? "" : "inactive"}>
                  <td><code>{u.username}</code></td>
                  <td>{u.displayName}</td>
                  <td>
                    <select value={u.role} onChange={(e) => update(u, { role: e.target.value as Role })}>
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={u.departmentId ?? ""} onChange={(e) => update(u, { departmentId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">— ไม่ระบุ —</option>
                      {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className={"pill " + (u.active ? "on" : "off")} onClick={() => update(u, { active: !u.active })}>
                      {u.active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </button>
                  </td>
                  <td className="muted">{formatDateTime(u.createdAt)}</td>
                  <td className="nowrap">
                    <button className="icon-btn" title="ตั้งรหัสผ่านใหม่" onClick={() => resetPassword(u)}>🔑</button>
                    <button className="icon-btn" title="ลบ" onClick={() => remove(u)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
