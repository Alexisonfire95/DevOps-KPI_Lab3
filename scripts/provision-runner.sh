#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
RUNNER_VERSION="2.321.0"

echo "==> Updating packages and installing dependencies"
apt-get update -qq
apt-get install -y curl ca-certificates gnupg gettext-base git libicu-dev jq

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

echo "==> Configuring runner user and SSH keys"
if ! id runner &>/dev/null; then
  useradd -m -s /bin/bash runner
fi
usermod -aG docker runner

sudo -u runner mkdir -p /home/runner/.ssh
sudo -u runner ssh-keygen -t ed25519 -N "" -f /home/runner/.ssh/id_ed25519

sudo -u runner tee /home/runner/.ssh/config >/dev/null <<EOF
Host 192.168.56.10
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
EOF
chmod 700 /home/runner/.ssh
chmod 600 /home/runner/.ssh/id_ed25519 /home/runner/.ssh/config
chown -R runner:runner /home/runner/.ssh

echo "==> Downloading and extracting GitHub Actions Runner package"
mkdir -p /home/runner/actions-runner
cd /home/runner/actions-runner
curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
tar xzf ./actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
rm ./actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
chown -R runner:runner /home/runner/actions-runner

echo "==> Installing runner service dependencies"
./bin/installdependencies.sh

echo "==> Runner provisioning finished successfully."
