# DevOps Tasks Progress Report

Follow the deployment schema from: `scripts/start-test.mjs`

- Configure postgres
- Configure redis
- Configure minio
- Configure cg-backend
- Configure traefik

## cg-backend Configuration
- build cg-backend project using `pnpm build` on local machine
- using rsync to copy files from local `dist` to server `/opt/cg-backend`
- configure systemd unit to run the `dist/main.js` file as demonstrated in `scripts/start-test.mjs`

## Traefik Configuration
- point minio to subdomain `cg-minio.kairospro.io`
- point minio admin to subdomain `cg-minio-admin.kairospro.io`
- point cg-backend api to subdomain `cg-api.kairospro.io`

## Deployment Notes
All services have been deployed and are running. PostgreSQL, Redis, MinIO, cg-backend, and Traefik are all active. DNS records need to be configured for Traefik SSL certificates to work.
aaa