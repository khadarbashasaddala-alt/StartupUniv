FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./
COPY components.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for health checks and debugging
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Upgrade the bundled npm CLI -- node:20-alpine ships npm 10, whose bundled
# tar is 6.2.1 (CVE-2026-59873). npm 11.19.0 bundles tar ^7.5.19 and still
# supports node 20; npm 12 requires node 22+. Kept in sync with Dockerfile.aws,
# which is the image the CI pipeline builds.
RUN npm install -g npm@11.19.0

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared

# Expose port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]

