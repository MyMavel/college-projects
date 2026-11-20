"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useMe } from "@/components/api";
import ProjectForm, { type ProjectValues } from "@/components/ProjectForm";

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const [initial, setInitial] = useState<ProjectValues | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ project: Record<string, unknown> & { code: string | null }; can: { edit: boolean } }>(`/api/projects/${id}`)
      .then(({ project: p, can }) => {
        if (!can.edit) return setError("คุณแก้ไขโครงการนี้ไม่ได้ในสถานะปัจจุบัน");
        const s = (k: string) => (p[k] == null ? "" : String(p[k]));
        setLocked(!!p.code);
        setInitial({
          title: s("title"), fiscalYear: Number(p.fiscalYear), departmentId: s("departmentId"), coOwners: s("coOwners"),
          projectType: s("projectType"), strategy: s("strategy"), rationale: s("rationale"), objectives: s("objectives"),
          targetQuantity: s("targetQuantity"), targetQuality: s("targetQuality"), location: s("location"),
          startDate: s("startDate"), endDate: s("endDate"), budgetAmount: s("budgetAmount"), budgetSource: s("budgetSource"),
          budgetDetail: s("budgetDetail"), indicators: s("indicators"), expectedOutcome: s("expectedOutcome"),
        });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!me || !initial) return <p className="muted">กำลังโหลด…</p>;
  return (
    <>
      <h1 className="page-title">✏️ แก้ไขโครงการ</h1>
      <ProjectForm
        me={me}
        initial={initial}
        lockFiscalYear={locked}
        saveLabel="💾 บันทึกการแก้ไข"
        onSave={async (v) => {
          await api(`/api/projects/${id}`, { method: "PUT", json: v });
          router.push(`/projects/${id}`);
        }}
      />
    </>
  );
}
