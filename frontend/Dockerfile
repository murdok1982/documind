# ─────────────────────────────────────────────
#  DocuMind Frontend — Multi-stage Dockerfile
#  Next.js 14 with standalone output
# ─────────────────────────────────────────────

# ── Stage 1: Dependencies ───────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests and install with clean cache
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# ── Stage 2: Builder ────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Receive build-time API URL
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Required for Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Enable standalone output in next.config (patched at build time if not present)
# The next.config.js/ts MUST include: output: 'standalone'
RUN node -e "\
  const fs = require('fs'); \
  const files = ['next.config.js', 'next.config.ts', 'next.config.mjs']; \
  const found = files.find(f => fs.existsSync(f)); \
  if (found) { \
    let c = fs.readFileSync(found, 'utf8'); \
    if (!c.includes('standalone')) { \
      c = c.replace(/(nextConfig\s*=\s*\{)/, '\$1\n  output: \"standalone\",'); \
      fs.writeFileSync(found, c); \
      console.log('Patched ' + found + ' to add standalone output'); \
    } else { console.log('standalone output already configured'); } \
  } else { \
    fs.writeFileSync('next.config.js', \
      'module.exports = { output: \"standalone\", reactStrictMode: true };'); \
    console.log('Created next.config.js with standalone output'); \
  } \
"

RUN npm run build

# ── Stage 3: Runner (production) ────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone output
COPY --from=builder /app/public ./public

# Set ownership for .next/cache
RUN mkdir -p .next
RUN chown nextjs:nodejs .next

# Standalone build includes its own node_modules subset
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
