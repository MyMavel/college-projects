"use client";

import { useState } from "react";
import { api } from "@/components/api";
import { SITE } from "@/lib/site";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/login", { method: "POST", json: { username, password } });
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h1>{SITE.icon} {SITE.name}</h1>
        <p className="muted">เข้าสู่ระบบเพื่อใช้งาน</p>
        <input
          autoFocus required placeholder="ชื่อผู้ใช้" autoComplete="username"
          value={username} onChange={(e) => setUsername(e.target.value)}
        />
        <div className="pw-field">
          <input
            type={show ? "text" : "password"} required placeholder="รหัสผ่าน" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="icon-btn" aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setShow(!show)}>
            {show ? "🙈" : "👁️"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
      </form>
    </div>
  );
}
