# ─────────────────────────────────────────────
#  DocuMind — Makefile
# ─────────────────────────────────────────────

SHELL          := /bin/bash
COMPOSE        := docker compose
COMPOSE_PROD   := $(COMPOSE) -f docker-compose.yml
COMPOSE_DEV    := $(COMPOSE) -f docker-compose.dev.yml
BACKUP_DIR     := ./backups
DOMAIN         ?= yourdomain.com
EMAIL          ?= admin@yourdomain.com

.DEFAULT_GOAL  := help

.PHONY: help dev prod down logs logs-backend logs-frontend logs-nginx \
        build build-no-cache restart backup restore ssl ssl-renew \
        clean prune ps shell-backend shell-frontend status

# ── Help ───────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  DocuMind — Available Commands"
	@echo "  ─────────────────────────────────────────"
	@echo "  make dev             Start in development mode"
	@echo "  make prod            Start in production mode"
	@echo "  make down            Stop all services"
	@echo "  make logs            Tail logs (all services)"
	@echo "  make logs-backend    Tail backend logs only"
	@echo "  make logs-frontend   Tail frontend logs only"
	@echo "  make logs-nginx      Tail nginx logs only"
	@echo "  make build           Build all images (use cache)"
	@echo "  make build-no-cache  Build all images (no cache)"
	@echo "  make restart         Restart all services"
	@echo "  make backup          Backup chroma_db volume"
	@echo "  make restore         Restore latest chroma_db backup"
	@echo "  make ssl             Issue SSL certificate (certbot)"
	@echo "  make ssl-renew       Renew SSL certificate"
	@echo "  make ps              Show running containers"
	@echo "  make status          Show services health"
	@echo "  make shell-backend   Open shell in backend container"
	@echo "  make shell-frontend  Open shell in frontend container"
	@echo "  make clean           Remove stopped containers + dangling images"
	@echo "  make prune           Full docker system prune (WARNING: destructive)"
	@echo ""

# ── Development ────────────────────────────────────────────────────────────────
dev:
	@echo "==> Starting DocuMind in development mode..."
	@if [ -f docker-compose.dev.yml ]; then \
		$(COMPOSE_DEV) up --build; \
	else \
		echo "docker-compose.dev.yml not found, using default compose with dev overrides..."; \
		$(COMPOSE) up --build; \
	fi

# ── Production ─────────────────────────────────────────────────────────────────
prod:
	@echo "==> Starting DocuMind in production mode..."
	@test -f .env || (echo "ERROR: .env file not found. Copy .env.example to .env first." && exit 1)
	$(COMPOSE_PROD) up -d --build --remove-orphans --wait
	@echo "==> Services started. Run 'make logs' to monitor."
	@echo "==> Run 'make status' to check health."

# ── Down ───────────────────────────────────────────────────────────────────────
down:
	@echo "==> Stopping all services..."
	$(COMPOSE_PROD) down

# ── Logs ───────────────────────────────────────────────────────────────────────
logs:
	$(COMPOSE_PROD) logs -f --tail=100

logs-backend:
	$(COMPOSE_PROD) logs -f --tail=100 backend

logs-frontend:
	$(COMPOSE_PROD) logs -f --tail=100 frontend

logs-nginx:
	$(COMPOSE_PROD) logs -f --tail=100 nginx

# ── Build ──────────────────────────────────────────────────────────────────────
build:
	@echo "==> Building images (with cache)..."
	$(COMPOSE_PROD) build

build-no-cache:
	@echo "==> Building images (no cache)..."
	$(COMPOSE_PROD) build --no-cache

# ── Restart ────────────────────────────────────────────────────────────────────
restart:
	@echo "==> Restarting all services..."
	$(COMPOSE_PROD) restart

# ── Backup ─────────────────────────────────────────────────────────────────────
backup:
	@echo "==> Backing up chroma_db volume..."
	@mkdir -p $(BACKUP_DIR)
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	BACKUP_FILE=$(BACKUP_DIR)/chroma_db_$$TIMESTAMP.tar.gz; \
	docker run --rm \
		-v documind_chroma_db:/data:ro \
		-v $$(pwd)/$(BACKUP_DIR):/backup \
		alpine \
		tar czf /backup/chroma_db_$$TIMESTAMP.tar.gz -C /data . ; \
	echo "==> Backup saved to $$BACKUP_FILE"; \
	ls -lh $(BACKUP_DIR)/chroma_db_$$TIMESTAMP.tar.gz
	@echo "==> Keeping last 7 backups..."
	@ls -t $(BACKUP_DIR)/chroma_db_*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm --
	@echo "==> Backup complete."

restore:
	@echo "==> Available backups:"
	@ls -lt $(BACKUP_DIR)/chroma_db_*.tar.gz 2>/dev/null || (echo "No backups found." && exit 1)
	@LATEST=$$(ls -t $(BACKUP_DIR)/chroma_db_*.tar.gz | head -1); \
	echo "==> Restoring from: $$LATEST"; \
	read -p "Continue? [y/N] " CONFIRM && [ "$$CONFIRM" = "y" ] || exit 0; \
	$(COMPOSE_PROD) stop backend; \
	docker run --rm \
		-v documind_chroma_db:/data \
		-v $$(pwd)/$(BACKUP_DIR):/backup:ro \
		alpine \
		sh -c "rm -rf /data/* && tar xzf /backup/$$(basename $$LATEST) -C /data"; \
	$(COMPOSE_PROD) start backend; \
	echo "==> Restore complete."

# ── SSL ────────────────────────────────────────────────────────────────────────
ssl:
	@echo "==> Issuing SSL certificate for $(DOMAIN)..."
	@test -n "$(DOMAIN)"  || (echo "ERROR: Set DOMAIN=yourdomain.com" && exit 1)
	@test -n "$(EMAIL)"   || (echo "ERROR: Set EMAIL=admin@yourdomain.com" && exit 1)
	@echo "==> Ensuring Nginx is running for ACME challenge..."
	$(COMPOSE_PROD) up -d nginx
	@sleep 3
	docker run --rm \
		-v documind_certbot_conf:/etc/letsencrypt \
		-v documind_certbot_www:/var/www/certbot \
		certbot/certbot certonly \
		--webroot \
		--webroot-path=/var/www/certbot \
		--email $(EMAIL) \
		--agree-tos \
		--no-eff-email \
		-d $(DOMAIN) \
		-d www.$(DOMAIN)
	@echo "==> Certificate issued. Reloading Nginx..."
	$(COMPOSE_PROD) exec nginx nginx -s reload
	@echo "==> SSL configured! Update nginx.conf with your domain if not done yet."

ssl-renew:
	@echo "==> Renewing SSL certificates..."
	docker compose run --rm certbot renew --quiet
	$(COMPOSE_PROD) exec nginx nginx -s reload
	@echo "==> Renewal complete."

# ── Status & Shells ────────────────────────────────────────────────────────────
ps:
	$(COMPOSE_PROD) ps

status:
	@echo "==> Container health status:"
	@docker ps --filter "name=documind_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "==> Backend health:"
	@curl -sf http://localhost:8000/health 2>/dev/null | python3 -m json.tool || echo "  Backend not reachable"
	@echo ""
	@echo "==> Nginx:"
	@curl -sf -o /dev/null -w "  HTTP status: %{http_code}\n" http://localhost/health 2>/dev/null || echo "  Nginx not reachable"

shell-backend:
	$(COMPOSE_PROD) exec backend /bin/sh

shell-frontend:
	$(COMPOSE_PROD) exec frontend /bin/sh

# ── Cleanup ────────────────────────────────────────────────────────────────────
clean:
	@echo "==> Removing stopped containers and dangling images..."
	docker container prune -f
	docker image prune -f
	@echo "==> Done."

prune:
	@echo "WARNING: This will remove ALL unused Docker resources (volumes excluded)."
	@read -p "Are you sure? [y/N] " CONFIRM && [ "$$CONFIRM" = "y" ] || exit 0
	docker system prune -f
	@echo "==> Done."
