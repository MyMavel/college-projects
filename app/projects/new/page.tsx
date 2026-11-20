"use client";

import { useRouter } from "next/navigation";
import { api, useMe } from "@/components/api";
import ProjectForm, { emptyProject } from "@/components/ProjectForm";

export default function NewProjectPage() {
  const me = useMe();
  const router = useRouter();
  if (!me) return <p className="muted">กำลังโหลด…</p>;
  return (
    <>
      <h1 className="page-title">+ เสนอโครงการใหม่</h1>
      <p className="muted">บันทึกเป็นร่างก่อนได้ แล้วกด “ส่งขออนุมัติ” ในหน้ารายละเอียดเมื่อพร้อม</p>
      <ProjectForm
        me={me}
        initial={emptyProject(me)}
        saveLabel="💾 บันทึกร่าง"
        onSave={async (v) => {
          const { id } = await api<{ id: number }>("/api/projects", { method: "POST", json: v });
          router.push(`/projects/${id}`);
        }}
      />
    </>
  );
}
