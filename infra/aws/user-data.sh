#!/bin/bash
# First boot of the Pramaan host (Amazon Linux 2023, arm64): Docker with Compose and Buildx, and
# 3 GB of swap for image builds on a 2 GB instance.
set -euxo pipefail
dnf install -y docker
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL -o /usr/local/lib/docker/cli-plugins/docker-compose \
  https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-aarch64
curl -fsSL -o /usr/local/lib/docker/cli-plugins/docker-buildx \
  https://github.com/docker/buildx/releases/download/v0.29.1/buildx-v0.29.1.linux-arm64
chmod +x /usr/local/lib/docker/cli-plugins/*
systemctl enable --now docker
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=3072
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap defaults 0 0' >> /etc/fstab
fi
mkdir -p /opt/pramaan/releases
touch /opt/pramaan/.bootstrapped
