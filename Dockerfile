# Multi-stage build for Kubernetes Log Viewer
FROM node:18-alpine AS frontend-build

WORKDIR /app

# Copy frontend package files
COPY package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source code
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY eslint.config.js ./

# Build frontend for production
RUN npm run build

# Production stage - Combined backend with frontend
FROM node:18-alpine AS production

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd backend && npm ci --only=production

# Copy backend source code (including entrypoint script)
COPY backend/ ./backend/

# Create the public directory first
RUN mkdir -p ./backend/api/public

# Copy built frontend to backend public directory
COPY --from=frontend-build /app/dist ./backend/api/public

# Create configs directory for kubeconfig files
RUN mkdir -p ./backend/configs

# Create .kube directory for mounted kubeconfig
RUN mkdir -p /root/.kube

# Make the entrypoint script executable
RUN chmod +x ./backend/docker-entrypoint.sh && \
    chmod +x ./backend/docker-entrypoint-simple.sh || true

# Expose backend port
EXPOSE 3006

# Set working directory to backend
WORKDIR /app/backend

# Install kubectl, python3, and py3-yaml for kubeconfig path fixing
# Use Alpine's package manager for py3-yaml to avoid pip externally-managed-environment error
# Detect architecture for multi-platform support
RUN apk add --no-cache curl python3 py3-yaml && \
    ARCH=$(uname -m) && \
    case ${ARCH} in \
        x86_64) KUBECTL_ARCH=amd64 ;; \
        aarch64|arm64) KUBECTL_ARCH=arm64 ;; \
        armv7l) KUBECTL_ARCH=arm ;; \
        *) KUBECTL_ARCH=amd64 ;; \
    esac && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${KUBECTL_ARCH}/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Start the backend server using the simple entrypoint script
# This script doesn't modify kubeconfig files - just uses them as-is
ENTRYPOINT ["/app/backend/docker-entrypoint-simple.sh"]
