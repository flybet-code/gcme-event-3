# Stage 1: Base image with Node.js
FROM node:20-alpine AS base
WORKDIR /app
# Install system dependencies (libc6-compat for Next.js, openssl for Prisma)
RUN apk add --no-cache libc6-compat wget openssl ttf-dejavu font-noto font-noto-ethiopic

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# Stage 3: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client
RUN PRISMA_GENERATE_SKIP_AUTOINSTALL=1 DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma generate

# Build Next.js
# Better Auth requires a secret during build, even if not used
ENV BETTER_AUTH_SECRET=build_time_secret_placeholder 
RUN npm run build

# Stage 4: Production image
FROM base AS runner
WORKDIR /app

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Create data and uploads directory for persistence
RUN mkdir -p data uploads && \
    chown -R nextjs:nodejs data uploads

# Switch to the non-root user
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Command to run the Next.js server
CMD ["node", "server.js"]
