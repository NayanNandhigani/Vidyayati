# Production image for Railway (build.dockerfilePath = "Dockerfile" on the
# Vidyayati service). Deliberately NOT using Next.js's "standalone" output
# mode — that mode prunes node_modules down to only what's traced from
# import/require statements, which drops the `prisma` CLI package (it's
# invoked via `npx prisma ...`, not imported, so Next's tracer never sees
# it) and would silently break scripts/migrate.sh's `prisma migrate
# deploy`, which Railway's preDeployCommand runs against this same image
# before every deploy. Keeping the full node_modules costs image size,
# not correctness — a deliberate trade for "actually works" over "small."
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Prisma's postinstall (`prisma generate`) needs the schema present.
COPY prisma ./prisma
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/instrumentation.ts ./instrumentation.ts

RUN chmod +x ./scripts/migrate.sh \
 && mkdir -p ./DATA/uploads \
 && chown -R nextjs:nodejs ./DATA

USER nextjs
EXPOSE 3000

CMD ["npm", "run", "start"]
