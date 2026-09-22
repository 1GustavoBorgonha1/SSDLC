#!/bin/bash
# Bootstrap da instância — instala Docker e prepara /opt/salafacil.
# O deploy em si é feito pela pipeline (SPEC-006 §3); a instância nunca compila código.
set -euo pipefail

dnf update -y
dnf install -y docker

systemctl enable --now docker
usermod -aG docker ec2-user

# Plugin do Docker Compose v2.
install -d /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

install -d -o ec2-user -g ec2-user /opt/salafacil
