"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, baht, formatDateTime, thaiDate } from "@/components/api";
import StatusBadge from "@/components/StatusBadge";
import { ACTIONS, BUDGET_SOURCES, PROJECT_TYPES, STATUSES, type Action, type Status } from "@/lib/projects";
import { ROLES, type Role } from "@/lib/site";

type Project = {
  id: number; code: string | null; fiscalYear: number; title: string; status: Status;
  departmentName: string | null; ownerName: string | null; coOwners: string; projectType: keyof typeof PROJECT_TYPES;
  strategy: string; rationale: string; objectives: string; targetQuantity: string; targetQuality: string;
  location: string; startDate: string | null; endDate: string | null; budgetAmount: number;
  budgetSource: keyof typeof BUDGET_SOURCES; budgetDetail: string; indicators: string; expectedOutcome: string;
  updatedAt: string;
};
type ActionLog = { id: number; action: Action; fromStatus: Status; toStatus: Status; comment: string; createdAt: string; userName: string | null; userRole: Role | null };
type Disb = { id: number; spentOn: string; amount: number; description: string; createdByName: string | null };
type Report = {
  actualStart: string | null; actualEnd: string | null; participants: number | null; results: string;
  indicatorResults: string; satisfaction: number | null; problems: string; suggestions: string;
  submittedAt: string; submittedByName: string | null;
};
type Detail = {
  project: Project; actions: ActionLog[]; disbursements: Disb[]; report: Report | null;
  can: { edit: boolean; delete: boolean; execute: boolean; actions: Action[] };
};

const STEPS: { key: string; label: string; done: (s: Status, log: ActionLog[]) => boolean }[] = [
  { key: "draft", label: "จัดทำโครงการ", done: (s) => s !== "draft" },
  { key: "head", label: "หัวหน้าแผนก/งาน", done: (s, log) => ["pending_plan", "pending_director", "approved", "completed"].includes(s) || log.some((a) => a.toStatus === "pending_plan") },
  { key: "plan", label: "งานวางแผนฯ", done: (s) => ["pending_director", "approved", "completed"].includes(s) },
  { key: "director", label: "ผู้บริหารอนุมัติ", done: (s) => ["approved", "completed"].includes(s) },
  { key: "report", label: "รายงานผล", done: (s) => s === "completed" },
];
const CURRENT_STEP: Partial<Record<Status, string>> = {
  draft: "draft", revision: "draft", pending_head: "head", pending_plan: "plan", pending_director: "director", approved: "report",
};

function Text({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  );
}

function ActionDialog({ action, onClose, onDone, projectId }: { action: Action; projectId: number; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const needComment = action === "return" || action === "reject";

  async function go() {
    setBusy(true); setError("");
    try {
      await api(`/api/projects/${projectId}/action`, { method: "POST", json: { action, comment } });
      onDone();
    } catch (e) {
      setError((e as Error).message); setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>{ACTIONS[action]}</h2>
        <label>
          {needComment ? "เหตุผล / สิ่งที่ต้องแก้ไข *" : "ความเห็น (ไม่บังคับ)"}
          <textarea rows={4} autoFocus value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className={"btn " + (action === "reject" || action === "cancel" ? "danger" : "primary")} disabled={busy || (needComment && !comment.trim())} onClick={go}>
            {busy ? "กำลังบันทึก…" : `ยืนยัน${ACTIONS[action]}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function DisbursementForm({ projectId, onAdded }: { projectId: number; onAdded: () => void }) {
  const [spentOn, setSpentOn] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try {
      await api(`/api/projects/${projectId}/disbursements`, { method: "POST", json: { spentOn, amount, description } });
      setAmount(""); setDescription(""); onAdded();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <form className="disb-form" onSubmit={submit}>
      <input type="date" required value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
      <input type="number" inputMode="decimal" step="0.01" min="0.01" required placeholder="จำนวนเงิน" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input className="grow" maxLength={500} placeholder="รายการ เช่น ค่าวัสดุฝึก (ใบเสร็จเลขที่ ...)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <button className="btn primary">+ บันทึก</button>
      {error && <p className="error full">{error}</p>}
    </form>
  );
}

function ReportForm({ projectId, initial, onSaved, onCancel }: { projectId: number; initial: Report | null; onSaved: () => void; onCancel?: () => void }) {
  const [v, setV] = useState({
    actualStart: initial?.actualStart ?? "", actualEnd: initial?.actualEnd ?? "",
    participants: initial?.participants?.toString() ?? "", satisfaction: initial?.satisfaction?.toString() ?? "",
    results: initial?.results ?? "", indicatorResults: initial?.indicatorResults ?? "",
    problems: initial?.problems ?? "", suggestions: initial?.suggestions ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api(`/api/projects/${projectId}/report`, { method: "PUT", json: v }); onSaved(); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <form className="grid-form" onSubmit={submit}>
      <label>วันที่ดำเนินการจริง (เริ่ม)<input type="date" value={v.actualStart} onChange={set("actualStart")} /></label>
      <label>วันที่ดำเนินการจริง (สิ้นสุด)<input type="date" value={v.actualEnd} onChange={set("actualEnd")} /></label>
      <label>จำนวนผู้เข้าร่วม (คน)<input type="number" min="0" value={v.participants} onChange={set("participants")} /></label>
      <label>ความพึงพอใจเฉลี่ย (0–5)<input type="number" min="0" max="5" step="0.01" value={v.satisfaction} onChange={set("satisfaction")} /></label>
      <label className="full">ผลการดำเนินงาน *<textarea rows={5} required value={v.results} onChange={set("results")} /></label>
      <label className="full">ผลตามตัวชี้วัด<textarea rows={3} value={v.indicatorResults} onChange={set("indicatorResults")} /></label>
      <label className="full">ปัญหาและอุปสรรค<textarea rows={3} value={v.problems} onChange={set("problems")} /></label>
      <label className="full">ข้อเสนอแนะ<textarea rows={3} value={v.suggestions} onChange={set("suggestions")} /></label>
      {error && <p className="error full">{error}</p>}
      <div className="form-actions full">
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>ยกเลิก</button>}
        <button className="btn primary" disabled={busy}>{busy ? "กำลังบันทึก…" : initial ? "บันทึกการแก้ไข" : "📨 ส่งรายงานผล"}</button>
      </div>
    </form>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Action | null>(null);
  const [editReport, setEditReport] = useState(false);

  const load = useCallback(() => {
    api<Detail>(`/api/projects/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">กำลังโหลด…</p>;
  const { project: p, can } = d;
  const spent = d.disbursements.reduce((a, x) => a + x.amount, 0);
  const remain = p.budgetAmount - spent;
  const lastReturn = [...d.actions].reverse().find((a) => a.action === "return" || a.action === "reject");
  const current = CURRENT_STEP[p.status];

  async function removeProject() {
    if (!confirm("ลบโครงการร่างนี้?")) return;
    try { await api(`/api/projects/${p.id}`, { method: "DELETE" }); router.push("/projects"); }
    catch (e) { alert((e as Error).message); }
  }
  async function removeDisb(x: Disb) {
    if (!confirm(`ลบรายการเบิกจ่าย ${baht(x.amount)} บาท?`)) return;
    try { await api(`/api/disbursements/${x.id}`, { method: "DELETE" }); load(); }
    catch (e) { alert((e as Error).message); }
  }

  return (
    <>
      <Link href="/projects" className="back">← รายการโครงการ</Link>

      <section className="card project-head">
        <div className="pl-top">
          <StatusBadge status={p.status} />
          {p.code && <code>{p.code}</code>}
          <span className="muted small">ปีงบประมาณ {p.fiscalYear}</span>
        </div>
        <h1>{p.title}</h1>
        <p className="muted">{p.departmentName ?? "ไม่ระบุแผนก"} · ผู้รับผิดชอบ: {p.ownerName ?? "—"}{p.coOwners && `, ${p.coOwners}`}</p>

        {p.status === "revision" && lastReturn && (
          <div className="alert warn"><b>ส่งกลับแก้ไขโดย {lastReturn.userName}:</b> {lastReturn.comment}</div>
        )}
        {p.status === "rejected" && lastReturn && (
          <div className="alert danger"><b>ไม่อนุมัติโดย {lastReturn.userName}:</b> {lastReturn.comment}</div>
        )}

        {!["rejected", "cancelled"].includes(p.status) && (
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.key} className={s.done(p.status, d.actions) ? "done" : current === s.key ? "current" : ""}>
                <span className="dot" />{s.label}
              </li>
            ))}
          </ol>
        )}

        <div className="action-bar">
          {can.actions.filter((a) => a !== "cancel").map((a) => (
            <button key={a} className={"btn " + (a === "approve" || a === "submit" ? "primary" : a === "reject" ? "danger" : "ghost")} onClick={() => setDialog(a)}>
              {a === "approve" ? "✅ " : a === "submit" ? "📨 " : a === "return" ? "↩️ " : "⛔ "}{ACTIONS[a]}
            </button>
          ))}
          {can.edit && <Link className="btn ghost" href={`/projects/${p.id}/edit`}>✏️ แก้ไข</Link>}
          <Link className="btn ghost" href={`/projects/${p.id}/print`} target="_blank">🖨️ พิมพ์</Link>
          {can.delete && <button className="btn ghost danger-text" onClick={removeProject}>🗑️ ลบร่าง</button>}
          {can.actions.includes("cancel") && <button className="btn ghost danger-text" onClick={() => setDialog("cancel")}>ยกเลิกโครงการ</button>}
        </div>
      </section>

      <div className="detail-grid">
        <div className="col-main">
          <section className="card">
            <h2>รายละเอียดโครงการ</h2>
            <div className="fields-inline">
              <div><span className="muted">ลักษณะ</span> {PROJECT_TYPES[p.projectType]}</div>
              <div><span className="muted">ระยะเวลา</span> {thaiDate(p.startDate)} – {thaiDate(p.endDate)}</div>
              {p.location && <div><span className="muted">สถานที่</span> {p.location}</div>}
            </div>
            <Text label="ความสอดคล้องกับยุทธศาสตร์" value={p.strategy} />
            <Text label="หลักการและเหตุผล" value={p.rationale} />
            <Text label="วัตถุประสงค์" value={p.objectives} />
            <Text label="เป้าหมายเชิงปริมาณ" value={p.targetQuantity} />
            <Text label="เป้าหมายเชิงคุณภาพ" value={p.targetQuality} />
            <Text label="ตัวชี้วัดความสำเร็จ" value={p.indicators} />
            <Text label="ผลที่คาดว่าจะได้รับ" value={p.expectedOutcome} />
          </section>

          {(p.status === "approved" || p.status === "completed") && (
            <section className="card">
              <div className="row-between">
                <h2>📝 รายงานผลการดำเนินงาน</h2>
                {d.report && can.execute && !editReport && <button className="btn ghost" onClick={() => setEditReport(true)}>✏️ แก้ไข</button>}
              </div>
              {d.report && !editReport ? (
                <>
                  <div className="fields-inline">
                    <div><span className="muted">ดำเนินการจริง</span> {thaiDate(d.report.actualStart)} – {thaiDate(d.report.actualEnd)}</div>
                    {d.report.participants != null && <div><span className="muted">ผู้เข้าร่วม</span> {d.report.participants.toLocaleString()} คน</div>}
                    {d.report.satisfaction != null && <div><span className="muted">ความพึงพอใจ</span> {d.report.satisfaction.toFixed(2)} / 5</div>}
                  </div>
                  <Text label="ผลการดำเนินงาน" value={d.report.results} />
                  <Text label="ผลตามตัวชี้วัด" value={d.report.indicatorResults} />
                  <Text label="ปัญหาและอุปสรรค" value={d.report.problems} />
                  <Text label="ข้อเสนอแนะ" value={d.report.suggestions} />
                  <p className="muted small">ส่งโดย {d.report.submittedByName} · {formatDateTime(d.report.submittedAt)}</p>
                </>
              ) : can.execute ? (
                <ReportForm projectId={p.id} initial={d.report} onSaved={() => { setEditReport(false); load(); }} onCancel={d.report ? () => setEditReport(false) : undefined} />
              ) : (
                <p className="muted">ยังไม่ได้รายงานผล</p>
              )}
            </section>
          )}
        </div>

        <div className="col-side">
          <section className="card">
            <h2>💰 งบประมาณ</h2>
            <div className="money-row"><span>{BUDGET_SOURCES[p.budgetSource]}</span><strong>{baht(p.budgetAmount)}</strong></div>
            {(p.status === "approved" || p.status === "completed") && p.budgetAmount > 0 && (
              <>
                <div className="money-row"><span>เบิกจ่ายแล้ว</span><strong>{baht(spent)}</strong></div>
                <div className="money-row"><span>คงเหลือ</span><strong className={remain < 0 ? "error" : "success"}>{baht(remain)}</strong></div>
                <div className="bar"><div className={"bar-fill" + (remain < 0 ? " over" : "")} style={{ width: Math.min(100, (spent / p.budgetAmount) * 100) + "%" }} /></div>
              </>
            )}
            {p.budgetDetail && <Text label="รายละเอียด" value={p.budgetDetail} />}
          </section>

          {(p.status === "approved" || p.status === "completed") && (
            <section className="card">
              <h2>🧾 การเบิกจ่าย</h2>
              {can.execute && <DisbursementForm projectId={p.id} onAdded={load} />}
              <ul className="disb-list">
                {d.disbursements.map((x) => (
                  <li key={x.id}>
                    <div>
                      <strong>{baht(x.amount)}</strong> <span className="muted small">{thaiDate(x.spentOn)}</span>
                      {x.description && <div className="small">{x.description}</div>}
                    </div>
                    {can.execute && <button className="icon-btn" aria-label="ลบ" onClick={() => removeDisb(x)}>🗑️</button>}
                  </li>
                ))}
                {d.disbursements.length === 0 && <li className="muted small">ยังไม่มีการเบิกจ่าย</li>}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>🕓 ประวัติ</h2>
            <ul className="timeline">
              {d.actions.map((a) => (
                <li key={a.id}>
                  <div><b>{ACTIONS[a.action]}</b> → {STATUSES[a.toStatus].label}</div>
                  <div className="small muted">{a.userName}{a.userRole && ` (${ROLES[a.userRole]})`} · {formatDateTime(a.createdAt)}</div>
                  {a.comment && <div className="comment">“{a.comment}”</div>}
                </li>
              ))}
              {d.actions.length === 0 && <li className="muted small">ยังไม่ได้ส่งขออนุมัติ</li>}
            </ul>
          </section>
        </div>
      </div>

      {dialog && <ActionDialog action={dialog} projectId={p.id} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
    </>
  );
}
