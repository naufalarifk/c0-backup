compose:
	docker compose --env-file .env.docker up -d
tunnel:
	cloudflared tunnel --url http://localhost:3000
