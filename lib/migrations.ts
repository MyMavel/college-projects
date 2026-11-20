/**
 * 🗂️ โครงสร้างฐานข้อมูล (Migrations)
 * - แต่ละรายการรันครั้งเดียว ตามลำดับ → ต้องการเปลี่ยนโครงสร้าง "เพิ่มรายการใหม่ต่อท้าย" เท่านั้น
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_users",
    sql: `
      CREATE TABLE users (
        id             SERIAL PRIMARY KEY,
        username       TEXT NOT NULL UNIQUE,
        display_name   TEXT NOT NULL,
        role           TEXT NOT NULL DEFAULT 'teacher',
        password_hash  TEXT NOT NULL,
        active         BOOLEAN NOT NULL DEFAULT true,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    id: "002_departments",
    sql: `
      CREATE TABLE departments (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        kind        TEXT NOT NULL DEFAULT 'แผนกวิชา',   -- แผนกวิชา | งาน | ฝ่าย
        sort_order  INT NOT NULL DEFAULT 0,
        active      BOOLEAN NOT NULL DEFAULT true
      );
      ALTER TABLE users ADD COLUMN department_id INT REFERENCES departments(id) ON DELETE SET NULL;
    `,
  },
  {
    id: "003_projects",
    sql: `
      CREATE TABLE projects (
        id                SERIAL PRIMARY KEY,
        code              TEXT UNIQUE,                 -- เช่น 2570-001 (ออกให้ตอนอนุมัติ)
        fiscal_year       INT  NOT NULL,               -- ปีงบประมาณ พ.ศ.
        title             TEXT NOT NULL,
        department_id     INT  REFERENCES departments(id) ON DELETE SET NULL,
        owner_id          INT  REFERENCES users(id) ON DELETE SET NULL,
        co_owners         TEXT NOT NULL DEFAULT '',     -- ผู้ร่วมรับผิดชอบ
        project_type      TEXT NOT NULL DEFAULT 'new',  -- new | continuing
        strategy          TEXT NOT NULL DEFAULT '',     -- สอดคล้องกับยุทธศาสตร์/มาตรฐาน
        rationale         TEXT NOT NULL DEFAULT '',     -- หลักการและเหตุผล
        objectives        TEXT NOT NULL DEFAULT '',
        target_quantity   TEXT NOT NULL DEFAULT '',
        target_quality    TEXT NOT NULL DEFAULT '',
        location          TEXT NOT NULL DEFAULT '',
        start_date        DATE,
        end_date          DATE,
        budget_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
        budget_source     TEXT NOT NULL DEFAULT 'state',
        budget_detail     TEXT NOT NULL DEFAULT '',     -- รายละเอียดการใช้งบ
        indicators        TEXT NOT NULL DEFAULT '',     -- ตัวชี้วัดความสำเร็จ
        expected_outcome  TEXT NOT NULL DEFAULT '',
        status            TEXT NOT NULL DEFAULT 'draft',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        approved_at       TIMESTAMPTZ
      );
      CREATE INDEX projects_fy_idx ON projects (fiscal_year, status);

      -- ประวัติการดำเนินการ/อนุมัติ
      CREATE TABLE project_actions (
        id           SERIAL PRIMARY KEY,
        project_id   INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id      INT REFERENCES users(id) ON DELETE SET NULL,
        action       TEXT NOT NULL,
        from_status  TEXT NOT NULL,
        to_status    TEXT NOT NULL,
        comment      TEXT NOT NULL DEFAULT '',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX project_actions_project_idx ON project_actions (project_id, created_at);

      -- การเบิกจ่ายงบประมาณ
      CREATE TABLE disbursements (
        id           SERIAL PRIMARY KEY,
        project_id   INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        spent_on     DATE NOT NULL,
        amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        description  TEXT NOT NULL DEFAULT '',
        created_by   INT REFERENCES users(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX disbursements_project_idx ON disbursements (project_id);

      -- รายงานผลการดำเนินโครงการ
      CREATE TABLE project_reports (
        project_id         INT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        actual_start       DATE,
        actual_end         DATE,
        participants       INT,
        results            TEXT NOT NULL DEFAULT '',
        indicator_results  TEXT NOT NULL DEFAULT '',
        satisfaction       NUMERIC(3,2),               -- คะแนนความพึงพอใจ 0–5
        problems           TEXT NOT NULL DEFAULT '',
        suggestions        TEXT NOT NULL DEFAULT '',
        submitted_by       INT REFERENCES users(id) ON DELETE SET NULL,
        submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
];
