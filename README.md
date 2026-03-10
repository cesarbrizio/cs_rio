# CS RIO

RPG criminal multiplayer mobile (Android/iOS) ambientado no Rio de Janeiro, com visual isométrico 2D inspirado em Tibia e Age of Empires. Mecânicas baseadas no The Crims, adaptadas para a realidade carioca: facções, favelas, tráfico, tribunal do tráfico e domínio territorial.

## Stack

| Camada | Tecnologia |
|---|---|
| App | Expo (React Native) + TypeScript |
| Game Rendering | @shopify/react-native-skia |
| Game Loop | react-native-game-engine |
| State | Zustand |
| Real-time | Colyseus |
| API | Fastify |
| Database | PostgreSQL + Redis |
| ORM | Drizzle |
| Auth | JWT + bcrypt |
| Monorepo | Turborepo |
| Build | EAS Build |

## Estrutura

```
cs_rio/
├── apps/
│   ├── mobile/          # Expo app (React Native)
│   └── server/          # Game server (Node.js + Colyseus + Fastify)
├── packages/
│   ├── shared/          # Tipos e constantes compartilhados
│   └── game-engine/     # Engine isométrica (Skia)
├── JOGO.md              # Game Design Document completo
├── TODO.md              # Roadmap técnico com 181 tarefas
└── README.md
```

## Documentos

- **[JOGO.md](./JOGO.md)** — Game Design Document com todas as mecânicas
- **[TODO.md](./TODO.md)** — Roadmap técnico detalhado (22 fases, 181 tarefas)

## Dev

```bash
# Subir serviços de dev (PostgreSQL + Redis)
docker compose -f docker-compose.dev.yml up -d

# Instalar dependências
npm install

# Dev (todos os workspaces)
npx turbo dev

# Server apenas
npx turbo dev --filter=server

# Mobile apenas
npx turbo dev --filter=mobile
```
