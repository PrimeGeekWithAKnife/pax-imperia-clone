#!/bin/bash
# Install the Ex Nihilo reports dashboard as a systemd service.
# Run as root: bash reports/install-service.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
NODE_BIN="$(which node)"
SERVICE_NAME="ex-nihilo-reports"

cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Ex Nihilo Pipeline Reports Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=${REPO_DIR}
ExecStart=${NODE_BIN} ${SCRIPT_DIR}/serve.cjs
Restart=always
RestartSec=5
Environment=PORT=8090
Environment=PULL_INTERVAL=300000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}

echo "Reports dashboard installed and started."
echo "Access at: http://$(hostname -I | awk '{print $1}'):8090"
echo "Service: systemctl status ${SERVICE_NAME}"
