#!/usr/bin/env bash
# 🔑 ตั้งรหัสผ่านใหม่ให้ผู้ใช้ (ใช้ตอนลืมรหัส admin) และเปิดใช้งานบัญชีให้ด้วย
#    ใช้: bash deploy/reset-password.sh admin
set -euo pipefail
cd "$(dirname "$0")/.."
USERNAME="${1:-}"
if [[ ! "$USERNAME" =~ ^[a-z0-9._-]{3,50}$ ]]; then
  echo "ใช้: bash deploy/reset-password.sh <ชื่อผู้ใช้>"; exit 1
fi
read -rsp "รหัสผ่านใหม่สำหรับ $USERNAME (อย่างน้อย 8 ตัว): " PW; echo
[[ ${#PW} -ge 8 ]] || { echo "❌ สั้นเกินไป"; exit 1; }

# สร้าง hash แบบเดียวกับ lib/password.ts (ส่งรหัสผ่านทาง stdin ไม่ให้โผล่ในรายการ process)
HASH=$(printf '%s' "$PW" | docker compose exec -T app node -e '
const c = require("crypto"); let pw = "";
process.stdin.on("data", d => pw += d).on("end", () => {
  const salt = c.randomBytes(16);
  const key = c.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  process.stdout.write("scrypt$" + salt.toString("base64") + "$" + key.toString("base64"));
});')

RESULT=$(docker compose exec -T db psql -U app app -tAc \
  "UPDATE users SET password_hash = '$HASH', active = true WHERE username = '$USERNAME' RETURNING id")
if [[ -n "$RESULT" ]]; then echo "✅ ตั้งรหัสผ่านใหม่ให้ $USERNAME แล้ว"; else echo "❌ ไม่พบผู้ใช้ $USERNAME"; exit 1; fi
