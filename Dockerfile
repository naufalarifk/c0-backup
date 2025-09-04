FROM node:24.7.0-alpine3.22 AS builder

WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@10 --activate

# Use an explicit pnpm store path so we can mount and cache it with BuildKit
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_PATH=/pnpm/store

COPY ./package.json ./
COPY ./pnpm-lock.yaml ./
COPY ./pnpm-workspace.yaml ./

# Use BuildKit inline cache mount so the pnpm store is reused between builds.
# When building, enable BuildKit (DOCKER_BUILDKIT=1) and you can also export
# the cache to the host with buildx flags (--cache-to / --cache-from) to
# persist a host-side pnpm store between CI/machine and container builds.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
	pnpm install --frozen-lockfile --ignore-scripts

COPY ./nest-cli.json ./
COPY ./tsconfig.build.json ./
COPY ./tsconfig.json ./

COPY ./src ./src

RUN pnpm run build

# After building, install only production dependencies in the builder so we can
# copy them into the final image. This ensures no devDependencies (from the
# workspace or root) are pulled into the runtime image.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
	pnpm install --frozen-lockfile --ignore-scripts --prod --filter .

FROM node:24.7.0-alpine3.22

WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@10 --activate

COPY ./package.json ./
COPY ./pnpm-lock.yaml ./

# Copy production node_modules and pnpm store from the builder stage. We copy
# the .pnpm store and .modules.yaml so the symlinked layout pnpm creates in
# node_modules works correctly in the final image.
COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/node_modules/.pnpm ./.pnpm
# COPY --from=builder /app/node_modules/.modules.yaml ./.modules.yaml

COPY --from=builder /app/dist ./dist
COPY ./src/shared/repositories/postgres/ ./dist/shared/repositories/postgres

ENV NODE_ENV=development
ENV APP_NAME=CryptoGadai
ENV PORT=3000
ENV ENABLE_DOCUMENTATION=true
ENV API_VERSION=v1.0.0
ENV ALLOWED_ORIGINS=http://localhost:3000

ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cryptogadai
ENV DATABASE_LOGGER=true

ENV BETTER_AUTH_SECRET=better-auth-secret-123456789
ENV BETTER_AUTH_URL=http://localhost:3000
ENV BETTER_AUTH_COOKIE_PREFIX=cryptogadai
ENV BETTER_AUTH_MAXIMUM_SESSIONS=3
ENV BETTER_AUTH_TELEMETRY=0
ENV BETTER_AUTH_TELEMETRY_DEBUG=1
ENV BETTER_AUTH_EXPIRATION_TIME=3600

ENV SESSION_MAX_AGE=604800
ENV SESSION_UPDATE_AGE=86400
ENV SESSION_COOKIE_CACHE_AGE=300

ENV GOOGLE_CLIENT_SECRET=TODO__SET_GOOGLE_CLIENT_SECRET
ENV GOOGLE_CLIENT_ID=TODO__SET_GOOGLE_CLIENT_ID

ENV THROTTLER_TTL=1m
ENV THROTTLER_LIMIT=100

ENV RESEND_API_KEY=TODO__SET_RESEND_API_KEY

ENV TWILIO_ACCOUNT_SID=AC_TODO__SET_WILIO_ACCOUNT_SID
ENV TWILIO_AUTH_TOKEN=TODO__SET_WILIO_AUTH_TOKEN
ENV TWILIO_VERIFY_SID=TODO__SET_TWILIO_VERIFY_SID
ENV TWILIO_PHONE_NUMBER=TODO__SET_TWILIO_PHONE_NUMBER
ENV TWILIO_DEFAULT_WHATSAPP_FROM=whatsapp:+TODO__SET_TWILIO_WHATSAPP_NUMBER

ENV EMAIL_FROM=no-reply@cryptogadai.local
ENV MAIL_HOST=localhost
ENV MAIL_PORT=1025
ENV MAIL_SMTP_PORT=1025
ENV MAIL_USER=local
ENV MAIL_PASSWORD=local
ENV MAIL_IGNORE_TLS=true
ENV MAIL_SECURE=false
ENV MAIL_REQUIRE_TLS=false
ENV MAIL_DEFAULT_EMAIL=no-reply@cryptogadai.local
ENV MAIL_DEFAULT_NAME=local
ENV MAIL_HTTP_PORT=8025

ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
