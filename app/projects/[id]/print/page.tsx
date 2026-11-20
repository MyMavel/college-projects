"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, baht, thaiDate } from "@/components/api";
import { BUDGET_SOURCES, PROJECT_TYPES, type Status } from "@/lib/projects";
import { SITE } from "@/lib/site";

type P = Record<string, string | number | null> & { status: Status };
type A = { action: string; toStatus: Status; userName: string | null; createdAt: string };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="doc-section">
      <h3>{n}. {title}</h3>
      <div className="doc-text">{children}</div>
    </div>
  );
}

function Sign({ role, name, date }: { role: string; name?: string | null; date?: string }) {
  return (
    <div className="sign">
      <div>ลงชื่อ ........................................................</div>
      <div>( {name || "........................................................"} )</div>
      <div>{role}</div>
      <div className="small">{date ? `วันที่ ${thaiDate(date, true)}` : "วันที่ ........ / ........ / ........"}</div>
    </div>
  );
}

// 🖨️ แบบเสนอโครงการสำหรับพิมพ์ / บันทึกเป็น PDF (Ctrl+P)
export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<{ project: P; actions: A[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { api<{ project: P; actions: A[] }>(`/api/projects/${id}`).then(setD).catch((e) => setError(e.message)); }, [id]);
  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">กำลังโหลด…</p>;
  const p = d.project;
  // หัวข้อที่ไม่มีข้อมูลจะไม่แสดง และเลขข้อจะเรียงใหม่ให้อัตโนมัติ
  const target = [p.targetQuantity && `เชิงปริมาณ\n${p.targetQuantity}`, p.targetQuality && `เชิงคุณภาพ\n${p.targetQuality}`].filter(Boolean).join("\n");
  const budget = `${BUDGET_SOURCES[p.budgetSource as keyof typeof BUDGET_SOURCES]} จำนวน ${baht(Number(p.budgetAmount))} บาท${p.budgetDetail ? `\n${p.budgetDetail}` : ""}`;
  const sections = ([
    ["ความสอดคล้องกับยุทธศาสตร์", p.strategy],
    ["หลักการและเหตุผล", p.rationale],
    ["วัตถุประสงค์", p.objectives],
    ["เป้าหมาย", target],
    ["งบประมาณ", budget],
    ["ตัวชี้วัดความสำเร็จ", p.indicators],
    ["ผลที่คาดว่าจะได้รับ", p.expectedOutcome],
  ] as [string, unknown][]).filter(([, v]) => v) as [string, string][];
  const head = d.actions.find((a) => a.action === "approve" && a.toStatus === "pending_plan");
  const plan = d.actions.find((a) => a.action === "approve" && a.toStatus === "pending_director");
  const director = d.actions.find((a) => a.action === "approve" && a.toStatus === "approved");

  return (
    <div className="print-page">
      <div className="no-print print-toolbar">
        <button className="btn primary" onClick={() => window.print()}>🖨️ พิมพ์ / บันทึกเป็น PDF</button>
        <span className="muted small">ในหน้าต่างพิมพ์ เลือก “บันทึกเป็น PDF” ได้</span>
      </div>
      <article className="doc">
        <header className="doc-head">
          <div className="small right">{p.code ? `รหัสโครงการ ${p.code}` : "(ยังไม่ได้รับเลขโครงการ)"}</div>
          <h1>แบบเสนอโครงการ ประจำปีงบประมาณ {p.fiscalYear}</h1>
          <div>{SITE.org}</div>
        </header>
        <table className="doc-info">
          <tbody>
            <tr><th>ชื่อโครงการ</th><td>{p.title}</td></tr>
            <tr><th>แผนก/งาน</th><td>{p.departmentName ?? "—"}</td></tr>
            <tr><th>ผู้รับผิดชอบ</th><td>{p.ownerName}{p.coOwners ? `, ${p.coOwners}` : ""}</td></tr>
            <tr><th>ลักษณะโครงการ</th><td>{PROJECT_TYPES[p.projectType as keyof typeof PROJECT_TYPES]}</td></tr>
            <tr><th>ระยะเวลาดำเนินการ</th><td>{thaiDate(p.startDate as string, true)} ถึง {thaiDate(p.endDate as string, true)}</td></tr>
            {p.location && <tr><th>สถานที่</th><td>{p.location}</td></tr>}
          </tbody>
        </table>
        {sections.map(([title, body], i) => <Section key={title} n={i + 1} title={title}>{body}</Section>)}

        <div className="signs">
          <Sign role="ผู้เสนอโครงการ" name={p.ownerName as string} />
          <Sign role="หัวหน้าแผนก/งาน" name={head?.userName} date={head?.createdAt} />
          <Sign role="งานวางแผนและงบประมาณ" name={plan?.userName} date={plan?.createdAt} />
          <Sign role="ผู้อำนวยการ / ผู้มีอำนาจอนุมัติ" name={director?.userName} date={director?.createdAt} />
        </div>
      </article>
    </div>
  );
}
