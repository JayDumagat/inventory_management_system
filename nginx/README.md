# nginx Configuration

This directory contains two nginx configuration files:

## `frontend.conf`
The container-internal nginx configuration used by the **frontend** Docker container to serve the built SPA. It handles:
- Serving `index.html` for all SPA routes (`try_files`)
- Proxying `/storage/` requests to the internal MinIO service so browsers can load product images without CORS issues
- Long-lived caching for static assets (`js`, `css`, images, fonts)
- gzip compression

**Used by:** `frontend/Dockerfile` — copied to `/etc/nginx/conf.d/default.conf` inside the container.

## `proxy.conf`
The reverse-proxy nginx configuration used by the dedicated **nginx** service in `docker-compose.yml`. It routes traffic between services:
- `/api/` → backend (port 3001)
- `/socket/` → backend WebSocket upgrade
- `/health` → backend health check
- `/storage/` → MinIO (port 9000)
- `/` → frontend (port 80)

**Used by:** the `nginx` service in `docker-compose.yml` via the volume mount `./nginx/proxy.conf:/etc/nginx/conf.d/default.conf`.

## Development vs Production

In local development (no Docker Compose), configure your reverse proxy or use `vite`'s built-in proxy instead.
In production, both configs should be reviewed and hardened (TLS termination, `server_name`, rate limiting, etc.).
