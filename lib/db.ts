import postgres from "postgres";
import { MIGRATIONS } from "./migrations";
import { hashPassword } from "./password";

// เชื่อมต่อ PostgreSQL ผ่าน DATABASE_URL และรัน migrations อัตโนมัติครั้งแรกที่ใช้งาน
const g = globalThis as unknown as { __sql?: postgres.Sql; __ready?: Promise<void> };

function client(): postgres.Sql {
  if (!g.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("ยังไม่ได้ตั้งค่า DATABASE_URL");
    g.__sql = postgres(url, { max: 10, idle_timeout: 30 });
  }
  return g.__sql;
}

async function migrate(sql: postgres.Sql) {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(727274)`; // กันรันซ้อนกัน
    const done = new Set((await tx<{ id: string }[]>`SELECT id FROM schema_migrations`).map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await tx.unsafe(m.sql);
      await tx`INSERT INTO schema_migrations (id) VALUES (${m.id})`;
      console.log(`[db] migrated ${m.id}`);
    }

    // สร้างผู้ดูแลระบบคนแรกจาก .env ถ้ายังไม่มีผู้ใช้เลย
    const [{ count }] = await tx<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM users`;
    if (count === 0) {
      const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD;
      if (!password) throw new Error("ยังไม่มีผู้ใช้ในระบบ: ต้องตั้ง ADMIN_PASSWORD ใน .env");
      await tx`
        INSERT INTO users (username, display_name, role, password_hash)
        VALUES (${username}, 'ผู้ดูแลระบบ', 'admin', ${await hashPassword(password)})
      `;
      console.log(`[db] created first admin user "${username}"`);
    }
  });
}

export async function db(): Promise<postgres.Sql> {
  const sql = client();
  if (!g.__ready) {
    g.__ready = migrate(sql).catch((e) => {
      g.__ready = undefined;
      throw e;
    });
  }
  await g.__ready;
  return sql;
}
