#!/usr/bin/env bash
# อัปเดตแอป: ดึงโค้ดล่าสุด → build → รันใหม่ (GitHub Actions เรียกสคริปต์นี้ทุกครั้งที่ push)
set -euo pipefail
cd "$(dirname "$0")/.."
APP_PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2)

echo "▶ ดึงโค้ดล่าสุด"
git pull --ff-only

echo "▶ build และรันใหม่"
docker compose up -d --build

echo "▶ ลบ image เก่าที่ไม่ใช้"
docker image prune -f

echo "▶ ตรวจสถานะ"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null; then
    echo "✅ Deploy สำเร็จ"; exit 0
  fi
  sleep 2
done
echo "❌ แอปไม่ตอบสนอง ดู log ด้วย: docker compose logs app --tail 50"
exit 1
