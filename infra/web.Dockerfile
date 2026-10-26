# Pramaan web app: a static build served by nginx, which also proxies the API.
#   docker build -f infra/web.Dockerfile -t pramaan-web .
FROM node:22-bookworm-slim AS build
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web/ ./
RUN npx vite build

FROM nginx:1.29-alpine
COPY infra/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY infra/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /web/dist /usr/share/nginx/html
