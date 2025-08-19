compose:
	docker compose --env-file .env.docker up -d
tunnel:
# 	cloudflared tunnel --url http://localhost:3000
	ngrok http --url=helping-surely-tahr.ngrok-free.app 3000
