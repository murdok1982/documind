#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  DocuMind — VPS Setup Script (Ubuntu 22.04)
#  Run as root or a user with sudo
# ─────────────────────────────────────────────

set -euo pipefail
IFS=$'\n\t'

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}==> $*${RESET}"; }

# ── Require root / sudo ────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Please run as root: sudo bash setup_vps.sh"
fi

# ── Config — edit before running ───────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/yourorg/documind.git}"
APP_DIR="${APP_DIR:-/opt/documind}"
DEPLOYER_USER="${DEPLOYER_USER:-deployer}"
DOMAIN="${DOMAIN:-yourdomain.com}"
EMAIL="${EMAIL:-admin@yourdomain.com}"
BRANCH="${BRANCH:-main}"

# API keys — set these as env vars before running or you'll be prompted
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"

# ── Prompt for missing secrets ─────────────────────────────────────────────────
prompt_secret() {
  local var_name="$1"
  local prompt_text="$2"
  local current_val="${!var_name:-}"
  if [[ -z "$current_val" ]]; then
    read -rsp "${prompt_text}: " current_val
    echo ""
    [[ -z "$current_val" ]] && error "${var_name} cannot be empty."
    printf -v "$var_name" '%s' "$current_val"
  fi
}

# ─────────────────────────────────────────────
step "1. System Update"
# ─────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget gnupg2 ca-certificates lsb-release \
  git unzip software-properties-common \
  ufw fail2ban htop vim \
  python3 python3-pip certbot
success "System updated."

# ─────────────────────────────────────────────
step "2. Install Docker Engine"
# ─────────────────────────────────────────────
if command -v docker &>/dev/null; then
  warn "Docker already installed: $(docker --version)"
else
  # Official Docker install script
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
  rm /tmp/get-docker.sh
  systemctl enable docker
  systemctl start docker
  success "Docker installed: $(docker --version)"
fi

# Docker Compose v2 (plugin)
if docker compose version &>/dev/null; then
  warn "Docker Compose already available: $(docker compose version)"
else
  COMPOSE_VERSION="v2.27.0"
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  success "Docker Compose installed: $(docker compose version)"
fi

# ─────────────────────────────────────────────
step "3. Create deployer user"
# ─────────────────────────────────────────────
if id "$DEPLOYER_USER" &>/dev/null; then
  warn "User '$DEPLOYER_USER' already exists."
else
  useradd -m -s /bin/bash -G docker,sudo "$DEPLOYER_USER"
  # Lock password — only SSH key access
  passwd -l "$DEPLOYER_USER"
  success "User '$DEPLOYER_USER' created (password-locked, docker+sudo groups)."
fi

DEPLOYER_HOME=$(getent passwd "$DEPLOYER_USER" | cut -d: -f6)
SSH_DIR="$DEPLOYER_HOME/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
touch "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"
chown -R "$DEPLOYER_USER:$DEPLOYER_USER" "$SSH_DIR"

info "Add the CI/CD public key to $SSH_DIR/authorized_keys when ready."

# ─────────────────────────────────────────────
step "4. Harden SSH"
# ─────────────────────────────────────────────
SSHD_CONFIG=/etc/ssh/sshd_config
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak.$(date +%s)"

# Apply hardening settings
declare -A SSH_SETTINGS=(
  ["PermitRootLogin"]="no"
  ["PasswordAuthentication"]="no"
  ["ChallengeResponseAuthentication"]="no"
  ["UsePAM"]="yes"
  ["X11Forwarding"]="no"
  ["PrintMotd"]="no"
  ["ClientAliveInterval"]="300"
  ["ClientAliveCountMax"]="2"
  ["MaxAuthTries"]="3"
  ["AllowUsers"]="$DEPLOYER_USER"
)

for key in "${!SSH_SETTINGS[@]}"; do
  val="${SSH_SETTINGS[$key]}"
  if grep -q "^${key}" "$SSHD_CONFIG"; then
    sed -i "s|^${key}.*|${key} ${val}|" "$SSHD_CONFIG"
  else
    echo "${key} ${val}" >> "$SSHD_CONFIG"
  fi
done

sshd -t && systemctl reload sshd
success "SSH hardened. Root login and password auth disabled."

# ─────────────────────────────────────────────
step "5. Configure Firewall (ufw)"
# ─────────────────────────────────────────────
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Only allow required ports
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"

ufw --force enable
ufw status verbose
success "Firewall configured: only 22, 80, 443 open."

# ─────────────────────────────────────────────
step "6. Configure fail2ban"
# ─────────────────────────────────────────────
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled  = true
port     = 22
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
EOF

systemctl enable fail2ban
systemctl restart fail2ban
success "fail2ban configured."

# ─────────────────────────────────────────────
step "7. Configure unattended-upgrades"
# ─────────────────────────────────────────────
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
success "Automatic security updates enabled."

# ─────────────────────────────────────────────
step "8. Clone repository"
# ─────────────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  warn "Repository already cloned at $APP_DIR. Pulling latest..."
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH"
else
  info "Cloning $REPO_URL into $APP_DIR..."
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$DEPLOYER_USER:$DEPLOYER_USER" "$APP_DIR"
success "Repository ready at $APP_DIR."

# ─────────────────────────────────────────────
step "9. Configure .env"
# ─────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  prompt_secret OPENAI_API_KEY  "Enter OPENAI_API_KEY"
  prompt_secret GEMINI_API_KEY  "Enter GEMINI_API_KEY"
  prompt_secret NVIDIA_API_KEY  "Enter NVIDIA_API_KEY"

  cat > "$ENV_FILE" << EOF
# DocuMind Production Environment
OPENAI_API_KEY=${OPENAI_API_KEY}
GEMINI_API_KEY=${GEMINI_API_KEY}
NVIDIA_API_KEY=${NVIDIA_API_KEY}
DOMAIN=${DOMAIN}
ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
NEXT_PUBLIC_API_URL=/api
MAX_FILE_SIZE_MB=50
ENV=production
EOF
  chmod 600 "$ENV_FILE"
  chown "$DEPLOYER_USER:$DEPLOYER_USER" "$ENV_FILE"
  success ".env created at $ENV_FILE"
else
  warn ".env already exists at $ENV_FILE — skipping."
fi

# ─────────────────────────────────────────────
step "10. Create nginx config directory"
# ─────────────────────────────────────────────
mkdir -p "$APP_DIR/nginx"
chown -R "$DEPLOYER_USER:$DEPLOYER_USER" "$APP_DIR/nginx"

# Patch nginx.conf domain placeholder
if [[ -f "$APP_DIR/nginx/nginx.conf" ]]; then
  sed -i "s/yourdomain\.com/${DOMAIN}/g" "$APP_DIR/nginx/nginx.conf"
  success "nginx.conf patched with domain: $DOMAIN"
fi

# ─────────────────────────────────────────────
step "11. Obtain SSL Certificate (Let's Encrypt)"
# ─────────────────────────────────────────────
info "Starting temporary Nginx for ACME challenge..."
cd "$APP_DIR"

# First, start only nginx in HTTP-only mode for the ACME challenge
# We temporarily use the certbot standalone method to avoid chicken-and-egg
if [[ -d /etc/letsencrypt/live/$DOMAIN ]]; then
  warn "Certificate already exists for $DOMAIN."
else
  # Stop any service on port 80
  systemctl stop nginx 2>/dev/null || true
  certbot certonly \
    --standalone \
    --preferred-challenges http \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"
  success "SSL certificate issued for $DOMAIN."
fi

# ─────────────────────────────────────────────
step "12. Configure automatic certificate renewal"
# ─────────────────────────────────────────────
# Certbot renewal cron — twice daily (as recommended by EFF)
CRON_FILE=/etc/cron.d/certbot-renew
cat > "$CRON_FILE" << EOF
# DocuMind — certbot auto-renewal + nginx reload
0 0,12 * * * root certbot renew --quiet --deploy-hook "docker compose -f ${APP_DIR}/docker-compose.yml exec nginx nginx -s reload" >> /var/log/certbot-renew.log 2>&1
EOF
chmod 644 "$CRON_FILE"
success "Auto-renewal cron configured."

# ─────────────────────────────────────────────
step "13. Symlink certbot certs for Docker volumes"
# ─────────────────────────────────────────────
# The docker-compose mounts certbot_conf as a named volume.
# For an existing VPS cert, we can bind-mount instead or copy.
info "Note: If using named volumes in docker-compose, run 'make ssl' instead."
info "      If binding /etc/letsencrypt directly, update docker-compose volumes."

# ─────────────────────────────────────────────
step "14. Start services"
# ─────────────────────────────────────────────
cd "$APP_DIR"

# Add deployer to docker group (may need re-login)
usermod -aG docker "$DEPLOYER_USER"

sudo -u "$DEPLOYER_USER" docker compose up -d --build --wait
success "All services started."

# ─────────────────────────────────────────────
step "15. Post-install health check"
# ─────────────────────────────────────────────
sleep 10
info "Checking backend health..."
BACKEND_STATUS=$(curl -sf http://localhost:8000/health \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "unreachable")

if [[ "$BACKEND_STATUS" == "ok" ]]; then
  success "Backend healthy."
else
  warn "Backend not yet healthy (status='$BACKEND_STATUS'). Check: docker compose logs backend"
fi

info "Checking nginx..."
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "0")
if [[ "$HTTP_CODE" == "200" ]]; then
  success "Nginx serving correctly."
else
  warn "Nginx returned HTTP $HTTP_CODE. Check: docker compose logs nginx"
fi

# ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  DocuMind VPS Setup Complete!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  App directory  : ${BOLD}$APP_DIR${RESET}"
echo -e "  Domain         : ${BOLD}https://$DOMAIN${RESET}"
echo -e "  Deployer user  : ${BOLD}$DEPLOYER_USER${RESET}"
echo ""
echo -e "  NEXT STEPS:"
echo -e "  1. Add your CI/CD public key to:"
echo -e "     ${BOLD}$SSH_DIR/authorized_keys${RESET}"
echo -e "  2. Set GitHub secrets:"
echo -e "     ${BOLD}VPS_HOST, VPS_USER, VPS_SSH_KEY, OPENAI_API_KEY${RESET}"
echo -e "  3. Push to main to trigger the deploy pipeline."
echo ""
echo -e "  Useful commands:"
echo -e "  cd $APP_DIR && make logs"
echo -e "  cd $APP_DIR && make status"
echo ""
