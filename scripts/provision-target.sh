#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
DEFAULT_PW=12345678
DB_PASSWORD="mywebapp_secret_change_me"

echo "==> Updating packages and installing prerequisites"
apt-get update -qq
apt-get install -y curl ca-certificates gnupg gettext-base nginx postgresql postgresql-contrib

echo "==> Installing Docker CE"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Configuring users"
# User mywebapp with shell and home directory for SSH access from runner
if ! id mywebapp &>/dev/null; then
  useradd -m -s /bin/bash mywebapp
fi
# Add mywebapp to docker group to run docker commands without sudo
usermod -aG docker mywebapp

# Prepare SSH directory for mywebapp user
mkdir -p /home/mywebapp/.ssh
chmod 700 /home/mywebapp/.ssh
touch /home/mywebapp/.ssh/authorized_keys
chmod 600 /home/mywebapp/.ssh/authorized_keys
chown -R mywebapp:mywebapp /home/mywebapp/.ssh

# Student, teacher, operator users
for u in student teacher; do
  if ! id "$u" &>/dev/null; then
    useradd -m -s /bin/bash "$u"
    echo "$u:$DEFAULT_PW" | chpasswd
    chage -d 0 "$u"
    usermod -aG sudo "$u"
  fi
done

if ! id operator &>/dev/null; then
  useradd -m -s /bin/bash operator
  echo "operator:$DEFAULT_PW" | chpasswd
  chage -d 0 operator
fi

# Allow operator to restart mywebapp-container systemd service and reload nginx
echo "operator ALL=(root) NOPASSWD: /bin/systemctl start mywebapp-container, /bin/systemctl stop mywebapp-container, /bin/systemctl restart mywebapp-container, /bin/systemctl status mywebapp-container, /bin/systemctl reload nginx" >/etc/sudoers.d/operator
chmod 440 /etc/sudoers.d/operator

echo "==> Configuring PostgreSQL"
systemctl start postgresql
sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mywebapp') THEN
    CREATE ROLE mywebapp LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE mywebapp WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
EOSQL

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'mywebapp'" | grep -q 1 \
  || sudo -u postgres createdb -O "mywebapp" "mywebapp"

echo "==> Configuring Nginx"
cat > /etc/nginx/sites-available/mywebapp << 'EOF'
upstream mywebapp_backend {
  server 127.0.0.1:5200;
  keepalive 32;
}

server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  server_tokens off;

  access_log /var/log/nginx/mywebapp.access.log;
  error_log  /var/log/nginx/mywebapp.error.log;

  # Block health endpoints
  location = /health {
    return 404;
  }

  location ^~ /health/ {
    return 404;
  }

  location / {
    proxy_pass http://mywebapp_backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/mywebapp /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "==> Creating student gradebook"
echo "1" >/home/student/gradebook
chown student:student /home/student/gradebook

# Lock vagrant user password for security
passwd -l vagrant 2>/dev/null || true

echo "==> Target node provisioning finished successfully."
