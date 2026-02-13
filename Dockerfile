# Multi-stage Docker build for the Angular SSR app.
#
# Design goals:
# 1) Reproducible builds (`npm ci` + lockfile).
# 2) Fast rebuilds (dependency layers cached separately from source files).
# 3) Secure runtime image (non-root user + production dependencies only).

# Pin the Node base image by tag (set from CI workflow build arg).
ARG NODE_IMAGE_TAG=22-alpine


# 1) Shared base image used by all stages.
FROM node:${NODE_IMAGE_TAG} AS base
# Keep one stable working directory in every stage.
WORKDIR /digital-edition-frontend-ng


# 2) Install full dependencies required to build the app.
FROM base AS deps
# Copy only dependency manifests first so this layer is cacheable.
COPY package.json package-lock.json ./
# Deterministic install using package-lock.json.
RUN npm ci


# 3) Build stage: run prebuild scripts, SSR build, and static compression.
FROM deps AS build
# Copy application source after dependencies are installed.
COPY . .
# Generate sitemap consumed by the app.
RUN npm run generate-sitemap
# Generate static HTML files for collection menus.
RUN npm run generate-static-collection-menus
# Build browser + server bundles for SSR.
RUN npm run build:ssr
# Pre-compress browser assets for nginx/static delivery.
RUN npm run compress


# 4) Install runtime dependencies only.
FROM base AS prod-deps
# Copy dependency manifests for runtime install.
COPY package.json package-lock.json ./
# Install production dependencies only (needed by dist/app/proxy-server.js).
RUN npm ci --omit=dev


# 5) Final runtime image.
FROM base AS final
# Run as non-root for better container security.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Keep manifests in runtime image for traceability.
COPY package.json package-lock.json ./
# Copy production node_modules from dedicated stage.
COPY --from=prod-deps /digital-edition-frontend-ng/node_modules ./node_modules
# Copy build artifacts from the build stage.
COPY --from=build /digital-edition-frontend-ng/dist ./dist
# Ensure framework/runtime defaults to production mode.
ENV NODE_ENV=production
# Drop privileges before launching the app.
USER appuser
# Start the Node SSR proxy server.
CMD ["node", "dist/app/proxy-server.js"]
