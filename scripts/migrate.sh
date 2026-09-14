#!/bin/sh
# Runs as Railway's preDeployCommand — a one-off container from the same
# built image, executed once before a new deployment is promoted to take
# traffic. Applies any pending migrations against the live DATABASE_URL
# with `prisma migrate deploy` (the production-safe command — never
# `prisma migrate dev`, which can prompt interactively or reset data).
set -e

echo "Running database migrations..."
npx prisma migrate deploy
echo "Migrations applied."
