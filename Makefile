generate-auth:
	@echo "Generating auth schema..."
	@pnpm dlx @better-auth/cli generate --config scripts/auth.js --output src/shared/database/schema/auth.ts
	@echo "Separating drizzle schemas..."
	@node scripts/separate-drizzle-schemas.js
	@echo "Auth generation completed!"

compose:
	docker compose up -d

tunnel:
# 	cloudflared tunnel --url http://localhost:3000
	ngrok http --url=helping-surely-tahr.ngrok-free.app 3000
