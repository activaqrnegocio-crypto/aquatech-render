# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .

# Generate Prisma client if using Prisma
RUN npx prisma generate

# Build-time environment variables (Passed from docker-compose or CI)
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY="BLSZBPzs10qOLxh4miqlss8CuAL-VmzTR8xEbOImfojxNJGcqIy9PR4qQwZg6qxvWPKPabCMguhCf-2Y97fNk-k"
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXTAUTH_URL="https://178.238.238.158.sslip.io/"
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ARG DATABASE_URL="mysql://root:password@localhost:3306/aquatech"
ENV DATABASE_URL=$DATABASE_URL

# Build the application
RUN npm run build

# Ensure sw.js bridge exists (next-pwa may delete it during build)
RUN echo "importScripts('/custom-sw.js');" > public/sw.js

# Stage 2: Run the application
FROM node:20-alpine AS runner

# Instalar curl para healthcheck (wget de busybox tiene bugs con IPv6)
RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from the builder
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
