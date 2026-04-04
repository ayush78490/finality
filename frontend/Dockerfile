# Production build on Linux — use when `npm run build` fails on Windows exFAT with EISDIR/readlink.
# From repo root: docker build -f apps/web/Dockerfile -t finality-web-build .
# Output is in the image at /build/apps/web/.next — copy with: docker create --name fw finality-web-build && docker cp fw:/build/apps/web/.next ./apps/web/.next && docker rm fw

FROM node:20-bookworm-slim
WORKDIR /build
COPY config ./config
COPY apps/web ./apps/web
WORKDIR /build/apps/web
RUN npm ci
RUN npm run build
