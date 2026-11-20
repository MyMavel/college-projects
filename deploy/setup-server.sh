#!/usr/bin/env bash
# 🚀 ติดตั้งแอปบนเซิร์ฟเวอร์ครั้งแรก (รันครั้งเดียวต่อแอป)
#    ใช้: cd ~/<ชื่อแอป> && bash deploy/setup-server.sh
# สิ่งที่สคริปต์ทำ: สร้าง .env (เลือกพอร์ตว่างให้อัตโนมัติ) → build/รัน → ตั้ง Nginx → เปิด Firewall
set -euo pipefail
cd "$(dirname "$0")/.."
APP_NAME="$(basename "$PWD")"

port_used() {  # พอร์ตถูกใช้แล้ว (มีโปรแกรมฟังอยู่ หรือแอปอื่นจองไว้ใน .env)
  ss -ltnH "( sport = :$1 )" | grep -q . && return 0
  grep -qsE "^(APP_PORT|PUBLIC_PORT|DB_PORT)=$1\b" ~/*/.env && return 0
  return 1
}
free_port() { local p=$1; while port_used "$p"; do p=$((p + 1)); done; echo "$p"; }

if [[ -f .env ]]; then
  echo "ℹ️  พบไฟล์ .env อยู่แล้ว ใช้ค่าเดิม"
else
  echo "=== ตั้งค่าแอป: $APP_NAME ==="
  APP_PORT=$(free_port 3001)
  PUBLIC_PORT=$(free_port 8081)
  DB_PORT=$(free_port 5433)
  read -rp "ชื่อผู้ใช้ผู้ดูแลระบบ [admin]: " ADMIN_USERNAME
  ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
  while true; do
    read -rsp "รหัสผ่านผู้ดูแลระบบ (อย่างน้อย 8 ตัว): " ADMIN_PASSWORD; echo
    if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then echo "❌ สั้นเกินไป"; continue; fi
    if [[ "$ADMIN_PASSWORD" == *"'"* ]]; then echo "❌ ห้ามมีเครื่องหมาย '"; continue; fi
    break
  done
  umask 077
  cat > .env <<ENV
APP_PORT=$APP_PORT
PUBLIC_PORT=$PUBLIC_PORT
DB_PORT=$DB_PORT
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD='$ADMIN_PASSWORD'
COOKIE_SECURE=false
ENV
  echo "✅ สร้าง .env แล้ว (APP_PORT=$APP_PORT, PUBLIC_PORT=$PUBLIC_PORT, DB_PORT=$DB_PORT)"
fi

get() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
APP_PORT=$(get APP_PORT); PUBLIC_PORT=$(get PUBLIC_PORT); DB_PORT=$(get DB_PORT)

echo "▶ build และรันแอป (ครั้งแรกใช้เวลา 2–4 นาที)"
docker compose up -d --build

echo "▶ รอแอปพร้อมใช้งาน"
for i in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1 && break
  sleep 2
  [[ $i == 60 ]] && { echo "❌ แอปไม่ตอบสนอง ดู log: docker compose logs app --tail 50"; exit 1; }
done

echo "▶ ตั้งค่า Nginx (พอร์ต $PUBLIC_PORT → $APP_PORT)"
sudo tee "/etc/nginx/sites-available/$APP_NAME" >/dev/null <<NGINX
# $APP_NAME — สร้างโดย deploy/setup-server.sh
server {
    listen $PUBLIC_PORT;
    listen [::]:$PUBLIC_PORT;
    server_name _;
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
sudo ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/$APP_NAME"
sudo nginx -t
sudo systemctl reload nginx

echo "▶ เปิด Firewall พอร์ต $PUBLIC_PORT"
sudo ufw allow "$PUBLIC_PORT/tcp" >/dev/null

IP=$(hostname -I | awk '{print $1}')
cat <<DONE

🎉 ติดตั้งเสร็จแล้ว!
   เปิดเว็บ:      http://$IP:$PUBLIC_PORT
   ล็อกอิน:       ชื่อผู้ใช้ $(get ADMIN_USERNAME) + รหัสที่เพิ่งตั้ง
   DBeaver:      Host localhost / Port $DB_PORT / Database app / User app (ผ่าน SSH)

⚠️  ถ้าเปิดเว็บไม่ได้ ให้เปิดพอร์ต $PUBLIC_PORT ใน Firewall Rule ของ ReadyIDC ด้วย
DONE
