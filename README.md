# AgencyOS — Synkra

Plataforma de agentes de marketing autônomos com orquestração inteligente.

## Estrutura

```
synkra/
├── synkra3/          # Next.js 14 (adstock.ai)
│   ├── src/
│   │   ├── app/      # App Router pages + API routes
│   │   ├── lib/      # Orchestrator, AI client, agents
│   │   └── components/ # React UI
│   ├── prisma/       # PostgreSQL schema
│   └── worker/       # Cloudflare Worker (AI proxy + cron)
│
├── agent_office/     # Pixel Agents Office (visualização)
│   ├── server/       # Fastify + WebSocket server
│   ├── webview-ui/   # React pixel art office
│   └── dist/         # Build output
│
└── render.yaml       # Render deploy config (pixel office)
```

## Deploy

### adstock.ai (Vercel)
```bash
cd synkra3 && vercel deploy --prod
```

### Pixel Office (Render)
1. Crie um repo no GitHub
2. Conecte no Render: https://render.com → New Web Service
3. Root Directory: `agent_office`
4. Build: `npm install && cd webview-ui && npm install && cd .. && npm run build`
5. Start: `node dist/cli.mjs --host 0.0.0.0 --port $PORT`
