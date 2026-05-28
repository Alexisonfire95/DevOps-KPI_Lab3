#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f /vagrant/deploy/deployment.defaults ]]; then
	REPO_ROOT=/vagrant
elif [[ -f "$SCRIPT_DIR/../deploy/deployment.defaults" ]]; then
	REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
	echo "Cannot find repo (deploy/deployment.defaults)" >&2
	exit 1
fi

source "$REPO_ROOT/deploy/deployment.defaults"

export DEBIAN_FRONTEND=noninteractive
DB_PASSWORD="${DB_PASSWORD:-mywebapp_secret_change_me}"
export DB_PASSWORD
DEFAULT_PW=12345678
N=1

TMPL_DIR="$REPO_ROOT/deploy/templates"
LAUNCH_SRC="$REPO_ROOT/deploy/launch-mywebapp.sh"
for f in \
	"$TMPL_DIR/nginx-mywebapp.conf.template" \
	"$TMPL_DIR/mywebapp.socket.template" \
	"$TMPL_DIR/mywebapp.service.template" \
	"$TMPL_DIR/config.yaml.template" \
	"$LAUNCH_SRC"; do
	[[ -f "$f" ]] || {
		echo "Missing $f" >&2
		exit 1
	}
done

NVMRC_FILE="$REPO_ROOT/.nvmrc"
[[ -f "$NVMRC_FILE" ]] || {
	echo "Missing $NVMRC_FILE" >&2
	exit 1
}
NODE_VERSION_RAW="$(tr -d '[:space:]' <"$NVMRC_FILE")"
NODE_VERSION="${NODE_VERSION_RAW#v}"
NODE_MAJOR="${NODE_VERSION%%.*}"
[[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || {
	echo "Invalid .nvmrc value: $NODE_VERSION_RAW" >&2
	exit 1
}

PACKAGE_JSON="$REPO_ROOT/package.json"
[[ -f "$PACKAGE_JSON" ]] || {
	echo "Missing $PACKAGE_JSON" >&2
	exit 1
}
PNPM_VERSION="$(sed -n 's/.*"packageManager":[[:space:]]*"pnpm@\([^"]*\)".*/\1/p' "$PACKAGE_JSON" | head -n1)"
[[ -n "$PNPM_VERSION" ]] || {
	echo "packageManager with pnpm@<version> is required in package.json" >&2
	exit 1
}

_envsubst_vars='${DEPLOY_UNIT} ${DEPLOY_APP_USER} ${DEPLOY_APP_DIR} ${DEPLOY_APP_CONFIG} ${DEPLOY_APP_CONFIG_FILE} ${DEPLOY_APP_PORT} ${DEPLOY_APP_BIND} ${DEPLOY_DB_HOST} ${DEPLOY_DB_PORT} ${DEPLOY_DB_USER} ${DEPLOY_DB_NAME} ${DEPLOY_NGINX_ACCESS_LOG} ${DEPLOY_NGINX_ERROR_LOG} ${DB_PASSWORD}'

render_template() {
	local src=$1 dst=$2
	envsubst "$_envsubst_vars" <"$src" >"$dst"
}

echo "==> Packages"
apt-get update -qq
apt-get install -y curl ca-certificates gnupg postgresql nginx gettext-base rsync
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
apt-get install -y nodejs
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "==> Users"
for u in student teacher; do
	if ! id "$u" &>/dev/null; then
		useradd -m -s /bin/bash "$u"
		echo "$u:$DEFAULT_PW" | chpasswd
		chage -d 0 "$u"
		usermod -aG sudo "$u"
	fi
done
if ! id operator &>/dev/null; then
	if getent group operator &>/dev/null; then
		useradd -m -s /bin/bash -g operator operator
	else
		useradd -m -s /bin/bash operator
	fi
	echo "operator:$DEFAULT_PW" | chpasswd
	chage -d 0 operator
fi
if ! id "$DEPLOY_APP_USER" &>/dev/null; then
	useradd -r -s /usr/sbin/nologin -d "$DEPLOY_APP_DIR" "$DEPLOY_APP_USER"
fi
echo "operator ALL=(root) NOPASSWD: /bin/systemctl start ${DEPLOY_UNIT}, /bin/systemctl stop ${DEPLOY_UNIT}, /bin/systemctl restart ${DEPLOY_UNIT}, /bin/systemctl status ${DEPLOY_UNIT}, /bin/systemctl reload nginx" >/etc/sudoers.d/operator
chmod 440 /etc/sudoers.d/operator

echo "==> PostgreSQL"
systemctl start postgresql
sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DEPLOY_DB_USER}') THEN
    CREATE ROLE ${DEPLOY_DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DEPLOY_DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
EOSQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DEPLOY_DB_NAME}'" | grep -q 1 \
	|| sudo -u postgres createdb -O "${DEPLOY_DB_USER}" "${DEPLOY_DB_NAME}"

echo "==> App"
mkdir -p "$DEPLOY_APP_DIR" "$DEPLOY_APP_CONFIG"
[[ -f /vagrant/package.json ]] && rsync -a --exclude node_modules --exclude .git /vagrant/ "$DEPLOY_APP_DIR/"
[[ -f "$DEPLOY_APP_DIR/package.json" ]] || {
	echo "No package.json in $DEPLOY_APP_DIR" >&2
	exit 1
}
chown -R "${DEPLOY_APP_USER}:" "$DEPLOY_APP_DIR"
su -s /bin/bash "$DEPLOY_APP_USER" -c "cd $DEPLOY_APP_DIR && pnpm install"

umask 077
render_template "$TMPL_DIR/config.yaml.template" "$DEPLOY_APP_CONFIG_FILE"
chown "${DEPLOY_APP_USER}:" "$DEPLOY_APP_CONFIG_FILE"
chmod 600 "$DEPLOY_APP_CONFIG_FILE"

install -m755 "$LAUNCH_SRC" "$DEPLOY_APP_DIR/launch.sh"
chown "${DEPLOY_APP_USER}:" "$DEPLOY_APP_DIR/launch.sh"

su -s /bin/bash "$DEPLOY_APP_USER" -c "cd ${DEPLOY_APP_DIR} && CONFIG_PATH=${DEPLOY_APP_CONFIG_FILE} ./launch.sh migrate"

render_template "$TMPL_DIR/mywebapp.socket.template" "/etc/systemd/system/${DEPLOY_UNIT}.socket"
render_template "$TMPL_DIR/mywebapp.service.template" "/etc/systemd/system/${DEPLOY_UNIT}.service"
systemctl daemon-reload
systemctl enable "${DEPLOY_UNIT}.socket" "${DEPLOY_UNIT}.service"
systemctl restart "${DEPLOY_UNIT}.socket" "${DEPLOY_UNIT}"

echo "==> Nginx"
render_template "$TMPL_DIR/nginx-mywebapp.conf.template" "/etc/nginx/sites-available/${DEPLOY_UNIT}"
rm -f /etc/nginx/sites-enabled/default
ln -sf "/etc/nginx/sites-available/${DEPLOY_UNIT}" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "==> Finish"
echo "$N" >/home/student/gradebook
chown student:student /home/student/gradebook
passwd -l vagrant 2>/dev/null || true
echo "Done. http://127.0.0.1 (nginx) -> ${DEPLOY_APP_BIND}:${DEPLOY_APP_PORT}. Users: student, teacher, operator (pw $DEFAULT_PW, change on login)."
