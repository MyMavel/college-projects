"use client";

import { useState } from "react";
import { api } from "@/components/api";

export default function AccountPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setMsg({ ok: false, text: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" });
    try {
      await api("/api/me/password", { method: "PUT", json: { current, next } });
      setMsg({ ok: true, text: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <section className="card narrow">
      <h2>🔑 เปลี่ยนรหัสผ่าน</h2>
      <form className="stack" onSubmit={submit}>
        <label>รหัสผ่านปัจจุบัน<input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></label>
        <label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)<input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
        <label>ยืนยันรหัสผ่านใหม่<input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>
        {msg && <p className={msg.ok ? "success" : "error"}>{msg.text}</p>}
        <div className="form-actions"><button className="btn primary">บันทึก</button></div>
      </form>
    </section>
  );
}
