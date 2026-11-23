# Stage 1: Build Next.js (standalone)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL=https://saloon-server.bc.dartcodes.com/api
ARG INTERNAL_API_URL=http://backend:3000
ARG PLATFORM_DOMAIN=bc.dartcodes.com

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV PLATFORM_DOMAIN=$PLATFORM_DOMAIN
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL=https://saloon-server.bc.dartcodes.com/api
ARG INTERNAL_API_URL=http://backend:3000
ARG PLATFORM_DOMAIN=bc.dartcodes.com

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV PLATFORM_DOMAIN=$PLATFORM_DOMAIN

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Public directory if present
RUN mkdir -p ./public
COPY --from=builder /app/public ./public 2>/dev/null || true
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3002

CMD ["node", "server.js"]

