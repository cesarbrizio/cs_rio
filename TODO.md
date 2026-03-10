# CS Rio — Roadmap Técnico de Desenvolvimento

> Documento vivo de acompanhamento do desenvolvimento do jogo CS Rio.
> Cada tarefa possui status, dependências e especificação técnica.
> Última atualização: 2026-03-10

## Legenda de Status

```
[ ] Não iniciado
[~] Em andamento
[x] Concluído
[!] Bloqueado (ver dependência)
[-] Cancelado/Removido
```

## Stack Definida

| Camada | Tecnologia |
|---|---|
| App Framework | Expo (React Native) SDK 52+ |
| Game Rendering | @shopify/react-native-skia |
| Game Loop | react-native-game-engine |
| UI/HUD | React Native (componentes nativos) |
| Navegação | React Navigation 7+ |
| State Management | Zustand |
| Comunicação Real-time | Colyseus Client SDK |
| Linguagem Client | TypeScript 5.x |
| Game Server | Node.js 22 LTS + Colyseus 0.15+ |
| API REST | Fastify 5.x |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache/Pub-Sub | Redis 7 |
| Auth | JWT (access + refresh) + bcrypt |
| Linguagem Server | TypeScript 5.x |
| Monorepo | Turborepo |
| Build Mobile | EAS Build (Expo) |
| CI/CD | GitHub Actions |
| Containerização | Docker Compose (dev), Docker (prod) |
| CDN/Assets | Cloudflare R2 |
| Deploy Server | Docker em VPS (Hetzner/DigitalOcean) |

---

# FASE 0 — Infraestrutura e Setup do Projeto

> Setup inicial do monorepo, ambientes de desenvolvimento, CI/CD e configuração base.
> **Dependência:** Nenhuma
> **Entregável:** Projeto rodando localmente com hot-reload no app e no server.

## 0.1 — Monorepo e Estrutura de Pastas

- [ ] **0.1.1** Inicializar monorepo com Turborepo
  - `npx create-turbo@latest`
  - Configurar `turbo.json` com pipelines: `build`, `dev`, `lint`, `test`, `typecheck`
  - Workspaces: `apps/mobile`, `apps/server`, `packages/shared`, `packages/game-engine`
  - Arquivo: `turbo.json`, `package.json` (root)

- [ ] **0.1.2** Criar workspace `apps/mobile` — Expo App
  - `npx create-expo-app apps/mobile --template blank-typescript`
  - Configurar `app.json`: nome "CS Rio", slug, versão, orientação (landscape + portrait)
  - Instalar dependências core: `expo-dev-client`
  - Configurar `tsconfig.json` com path aliases (`@/`, `@shared/`, `@engine/`)
  - Arquivos: `apps/mobile/app.json`, `apps/mobile/tsconfig.json`, `apps/mobile/package.json`

- [ ] **0.1.3** Criar workspace `apps/server` — Game Server
  - Inicializar Node.js + TypeScript
  - Instalar: `colyseus`, `fastify`, `drizzle-orm`, `pg`, `redis`, `jsonwebtoken`, `bcrypt`
  - Configurar `tsconfig.json` com `target: ES2022`, `moduleResolution: bundler`
  - Script de dev com `tsx watch`
  - Arquivos: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/index.ts`

- [ ] **0.1.4** Criar workspace `packages/shared` — Tipos compartilhados
  - Definir tipos base: `Player`, `Crime`, `Faction`, `Favela`, `Item`, `Drug`
  - Definir constantes: `LEVELS`, `VOCATIONS`, `REGIONS`, `DRUGS`, `WEAPONS`
  - Definir enums: `VocationType`, `LevelTitle`, `RegionId`, `DrugType`, `CrimeType`
  - Exportar interfaces de mensagens WebSocket (client→server, server→client)
  - Arquivos: `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`, `packages/shared/src/messages.ts`

- [ ] **0.1.5** Criar workspace `packages/game-engine` — Engine Isométrica
  - Módulo isolado com a lógica de renderização isométrica
  - Exporta: `Camera`, `TilemapRenderer`, `SpriteSheet`, `InputHandler`, `Pathfinding`
  - Zero dependência de React Native (puro TypeScript + interfaces para Skia)
  - Arquivos: `packages/game-engine/src/index.ts`

## 0.2 — Ambiente de Desenvolvimento

- [ ] **0.2.1** Docker Compose para serviços de backend (dev)
  - PostgreSQL 16 (porta 5433 para não conflitar)
  - Redis 7 (porta 6380)
  - Adminer ou pgAdmin para debug de banco
  - Arquivo: `docker-compose.dev.yml`

- [ ] **0.2.2** Configurar variáveis de ambiente
  - `.env.example` com todas as variáveis documentadas
  - `apps/server/.env`: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `COLYSEUS_PORT`
  - `apps/mobile/.env`: `API_URL`, `WS_URL`
  - Usar `dotenv` no server, `expo-constants` no mobile
  - Arquivos: `.env.example`, `apps/server/.env.example`, `apps/mobile/.env.example`

- [ ] **0.2.3** Configurar ESLint + Prettier (monorepo)
  - Config compartilhada na raiz
  - Rules: `@typescript-eslint/recommended`, `react-hooks/exhaustive-deps`
  - Prettier: single quotes, trailing comma, 100 print width
  - Arquivo: `.eslintrc.js`, `.prettierrc`

- [ ] **0.2.4** Configurar Vitest para testes unitários
  - `packages/shared`: testes de cálculos (probabilidade de crime, fórmulas de poder)
  - `packages/game-engine`: testes de pathfinding, conversão de coordenadas iso↔screen
  - `apps/server`: testes de game logic (sistemas de crime, combate, economia)
  - Arquivo: `vitest.config.ts` (raiz), configs por workspace

## 0.3 — CI/CD

- [ ] **0.3.1** GitHub Actions — Pipeline de CI
  - Trigger: push/PR em `main` e `develop`
  - Jobs: `lint`, `typecheck`, `test`, `build-server`, `build-mobile-check`
  - Cache de `node_modules` e `.turbo`
  - Arquivo: `.github/workflows/ci.yml`

- [ ] **0.3.2** GitHub Actions — Build Mobile (EAS)
  - Trigger: tag `v*` ou manual
  - Usa `eas-cli` para build Android (APK/AAB) e iOS (IPA)
  - Arquivo: `.github/workflows/mobile-build.yml`

- [ ] **0.3.3** GitHub Actions — Deploy Server
  - Trigger: push em `main` (path: `apps/server/**`)
  - Build Docker image, push para registry, deploy via SSH
  - Arquivo: `.github/workflows/deploy-server.yml`

## 0.4 — Database Schema Base

- [ ] **0.4.1** Setup Drizzle ORM + migrações
  - Configurar `drizzle.config.ts` com conexão PostgreSQL
  - Script de migrate: `drizzle-kit push` / `drizzle-kit generate`
  - Arquivo: `apps/server/drizzle.config.ts`

- [ ] **0.4.2** Schema inicial — tabelas core
  - `players`: id, email, password_hash, nickname, vocation, level, conceito, forca, inteligencia, resistencia, carisma, stamina, nerve, hp, addiction, money, bank_money, region_id, position_x, position_y, faction_id, created_at, last_login
  - `factions`: id, name, abbreviation, is_fixed, leader_id, bank_money, bank_drugs, points, created_at
  - `faction_members`: player_id, faction_id, rank, joined_at
  - `favelas`: id, name, region_id, population, difficulty, controlling_faction_id, satisfaction, propina_value, propina_due_date, state_controlled_until
  - `favela_services`: favela_id, service_type, level, active, installed_at
  - `weapons`: id, name, power, durability_max, level_required, price
  - `vests`: id, name, defense, durability_max, level_required, price
  - `player_inventory`: id, player_id, item_type, item_id, quantity, durability, proficiency
  - `crimes`: id, name, level_required, stamina_cost, nerve_cost, min_power, reward_min, reward_max, conceito_reward, arrest_chance, cooldown_seconds
  - `drugs`: id, name, stamina_recovery, moral_boost, price, addiction_rate, nerve_boost, production_level
  - `properties`: id, player_id, type (boca/factory/puteiro/rave/house/front_store/slot_machine), region_id, favela_id, level, soldiers_count, created_at
  - `soldiers`: id, property_id, type, power, daily_cost, hired_at
  - `market_orders`: id, seller_id, item_type, item_id, quantity, price_per_unit, created_at, expires_at
  - `round`: id, number, started_at, ends_at, status
  - `round_rankings`: round_id, player_id, final_conceito, final_rank
  - Arquivo: `apps/server/src/db/schema.ts`

- [ ] **0.4.3** Schema — tabelas de facção e território
  - `faction_upgrades`: faction_id, upgrade_type, level, unlocked_at
  - `faction_wars`: id, attacker_faction_id, defender_faction_id, favela_id, status, declared_at, starts_at, ended_at, winner_faction_id
  - `propina_payments`: id, faction_id, favela_id, amount, paid_at, next_due
  - `x9_events`: id, favela_id, triggered_at, soldiers_arrested, drugs_lost, weapons_lost, money_lost
  - Arquivo: `apps/server/src/db/schema.ts` (continuação)

- [ ] **0.4.4** Schema — tabelas de tribunal, eventos, social
  - `tribunal_cases`: id, favela_id, case_type, accuser_charisma_community, accuser_charisma_faction, accused_charisma_community, accused_charisma_faction, community_supports (accuser/accused), antigao_hint, punishment_chosen, moral_moradores_impact, moral_facao_impact, conceito_impact, judged_by, judged_at
  - `game_events`: id, event_type, region_id, favela_id, started_at, ends_at, data_json
  - `chat_messages`: id, channel_type, channel_id, sender_id, message, sent_at
  - `contacts`: player_id, contact_id, type (partner/known), since
  - `assassination_contracts`: id, requester_id, target_id, reward, accepted_by, status, created_at
  - `prison_records`: id, player_id, reason, sentenced_at, release_at, released_early_by
  - `transactions`: id, player_id, type, amount, description, created_at
  - Arquivo: `apps/server/src/db/schema.ts` (continuação)

- [ ] **0.4.5** Seed de dados fixos
  - 7 facções fixas (CV, TCP, ADA, TC, MIL, LJ, PCC) com territórios iniciais
  - 6 regiões com metadados (riqueza, densidade, bônus)
  - ~50 favelas reais com população, região, dificuldade
  - Tabela de crimes (todos os ~50 crimes do JOGO.md com stats)
  - Tabela de armas (14 armas com stats)
  - Tabela de coletes (9 coletes com stats)
  - Tabela de drogas (7 drogas com stats)
  - Tabela de soldados (5 tipos com stats)
  - Arquivo: `apps/server/src/db/seed.ts`

---

# FASE 1 — Game Engine (Renderização Isométrica)

> Motor de renderização isométrica 2D usando Skia. Roda 100% no client.
> **Dependência:** 0.1.2, 0.1.5
> **Entregável:** Mapa isométrico navegável com tiles, câmera com pan/zoom e personagem andando.

## 1.1 — Sistema de Coordenadas Isométricas

- [ ] **1.1.1** Implementar conversão cartesiano ↔ isométrico
  - `cartToIso(x, y)`: converte coordenada de grid para posição na tela
  - `isoToCart(screenX, screenY)`: converte toque na tela para coordenada de grid
  - Suporte a tiles de 128×64px (losango isométrico padrão)
  - Testes unitários para todas as conversões (Vitest)
  - Arquivo: `packages/game-engine/src/coordinates.ts`

- [ ] **1.1.2** Implementar sistema de profundidade (Z-sorting)
  - Sprites renderizados na ordem correta (tiles de trás para frente)
  - Algoritmo: ordenar por `y + x` (painter's algorithm adaptado para iso)
  - Suporte a objetos em múltiplas tiles (prédios 2×2, 3×3)
  - Arquivo: `packages/game-engine/src/depth-sort.ts`

## 1.2 — Tilemap Renderer

- [ ] **1.2.1** Parser de mapas Tiled (.tmj / .json)
  - Ler formato JSON exportado pelo Tiled Map Editor
  - Suporte a múltiplas layers: ground, objects, collision, regions
  - Extrair dados de colisão e metadados de região
  - Arquivo: `packages/game-engine/src/tilemap-parser.ts`

- [ ] **1.2.2** Renderer de tilemap com Skia Canvas
  - Renderizar apenas tiles visíveis na viewport (culling)
  - Usar `Skia.Image` para drawImage de cada tile do spritesheet
  - Batch rendering: agrupar tiles do mesmo spritesheet para minimizar draw calls
  - Layer order: ground → objects → characters → UI overlay
  - Performance target: 60fps com mapa de 200×200 tiles no dispositivo médio
  - Arquivo: `packages/game-engine/src/tilemap-renderer.ts`

- [ ] **1.2.3** Criar mapa protótipo no Tiled
  - Tilesheet base (ruas, calçadas, prédios, vegetação, favela)
  - Mapa 200×200 representando 1 região (Zona Norte como protótipo)
  - Layers: terrain, buildings, collision, spawn_points, region_markers
  - Exportar como JSON
  - Arquivo: `apps/mobile/assets/maps/zona_norte.tmj`, `apps/mobile/assets/tilesets/city_base.png`

## 1.3 — Sistema de Câmera

- [ ] **1.3.1** Câmera com pan (arrastar) e zoom (pinch)
  - Pan: gesture handler (react-native-gesture-handler) com inércia
  - Zoom: pinch-to-zoom com limites (0.5x a 3x)
  - Smooth interpolation (lerp) para movimentação fluida
  - Limites de câmera: não permitir scroll para fora do mapa
  - Arquivo: `packages/game-engine/src/camera.ts`

- [ ] **1.3.2** Câmera seguindo o personagem
  - Modo "follow": câmera centralizada no jogador com dead-zone
  - Modo "free": jogador pode navegar livremente pelo mapa (toque e arraste)
  - Transição suave entre modos
  - Arquivo: `packages/game-engine/src/camera.ts` (extensão)

## 1.4 — Sistema de Sprites

- [ ] **1.4.1** Loader de spritesheets
  - Carregar spritesheet (PNG) + metadata (JSON com frames)
  - Suporte ao formato Aseprite (export JSON array)
  - Cache de imagens carregadas (evitar re-decode)
  - Arquivo: `packages/game-engine/src/spritesheet.ts`

- [ ] **1.4.2** Sistema de animação de sprites
  - AnimationController: play, pause, loop, speed
  - Suporte a animações por estado: `idle`, `walk_n`, `walk_s`, `walk_e`, `walk_w`, `walk_ne`, `walk_nw`, `walk_se`, `walk_sw`
  - Frame timing independente do game loop (delta-time based)
  - Arquivo: `packages/game-engine/src/animation.ts`

- [ ] **1.4.3** Criar sprites protótipo do personagem
  - Spritesheet com 8 direções × 4 frames de caminhada + 1 frame idle por direção
  - Total: 40 frames (8 idle + 32 walk), cada frame ~48×64px
  - Formato: Aseprite → export PNG + JSON
  - Arquivo: `apps/mobile/assets/sprites/player_base.png`, `apps/mobile/assets/sprites/player_base.json`

## 1.5 — Pathfinding e Movimentação

- [ ] **1.5.1** Implementar A* para grid isométrico
  - Pathfinding A* considerando collision layer do tilemap
  - Heurística: distância de Manhattan adaptada para isométrico
  - Custo de movimento: 1 para ortogonal, 1.41 para diagonal
  - Máximo de 100 nós expandidos (evitar freeze em paths longos)
  - Arquivo: `packages/game-engine/src/pathfinding.ts`

- [ ] **1.5.2** Movimentação do personagem
  - Tap-to-move: tocar na tela define destino, A* calcula path
  - Personagem segue path tile a tile com animação direcional
  - Velocidade de movimento: 3 tiles/segundo (ajustável)
  - Cancelar path se tocar em novo destino
  - Arquivo: `packages/game-engine/src/movement.ts`

- [ ] **1.5.3** Input handler para touch
  - Detectar: tap (mover), long press (abrir menu de ação), pan (câmera), pinch (zoom)
  - Integrar com react-native-gesture-handler
  - Distinguir tap em UI overlay vs. tap no game world
  - Arquivo: `packages/game-engine/src/input-handler.ts`

## 1.6 — Game Loop

- [ ] **1.6.1** Implementar game loop principal
  - requestAnimationFrame via Skia canvas callback
  - Delta-time calculation para frame-rate independence
  - Update cycle: input → game logic → physics/movement → render
  - Performance monitoring: FPS counter (debug mode)
  - Arquivo: `packages/game-engine/src/game-loop.ts`

- [ ] **1.6.2** Integrar Game Loop com React Native
  - Componente `<GameView />` que encapsula Skia Canvas + Game Loop
  - Props: `mapData`, `playerState`, `entities`, `onTileTap`, `onEntityTap`
  - Comunicação com React via callbacks (sem re-render do canvas a cada frame)
  - Arquivo: `apps/mobile/src/components/GameView.tsx`

---

# FASE 2 — Autenticação e Fundação do Jogador

> Sistema de auth, criação de personagem, persistência e sincronização.
> **Dependência:** 0.2, 0.4
> **Entregável:** Jogador faz login, cria personagem, aparece no mapa com atributos persistidos.

## 2.1 — Autenticação (Server)

- [ ] **2.1.1** Endpoint `POST /auth/register`
  - Input: email, password, nickname
  - Validação: email único, nickname único (3-16 chars, alfanumérico + _), senha 8+ chars
  - Hash: bcrypt com salt rounds 12
  - Retorno: JWT access token (15min) + refresh token (30 dias)
  - Arquivo: `apps/server/src/api/routes/auth.ts`

- [ ] **2.1.2** Endpoint `POST /auth/login`
  - Input: email, password
  - Validação: bcrypt compare
  - Retorno: JWT access + refresh tokens
  - Rate limiting: 5 tentativas por minuto por IP (Redis)
  - Arquivo: `apps/server/src/api/routes/auth.ts`

- [ ] **2.1.3** Endpoint `POST /auth/refresh`
  - Input: refresh token
  - Validação: verificar token, verificar não está na blacklist
  - Retorno: novo access token + novo refresh token (rotation)
  - Blacklist do refresh antigo no Redis (TTL = tempo restante do token)
  - Arquivo: `apps/server/src/api/routes/auth.ts`

- [ ] **2.1.4** Middleware de autenticação JWT
  - Extrair token do header `Authorization: Bearer <token>`
  - Verificar assinatura e expiração
  - Injetar `playerId` no request
  - Aplicar em todas as rotas exceto `/auth/*`
  - Arquivo: `apps/server/src/api/middleware/auth.ts`

## 2.2 — Criação de Personagem (Server)

- [ ] **2.2.1** Endpoint `POST /players/create`
  - Input: vocation (Cria/Gerente/Soldado/Político/Empreendedor), appearance (skin, hair, outfit)
  - Lógica: atribuir stats iniciais conforme tabela de vocação, nível 1 (Pivete), conceito 0, stamina 100%, HP 100
  - Definir posição inicial (spawn point da região escolhida ou aleatório)
  - Arquivo: `apps/server/src/api/routes/players.ts`

- [ ] **2.2.2** Endpoint `GET /players/me`
  - Retorna dados completos do jogador autenticado
  - Inclui: stats, inventário, facção, propriedades, localização
  - Cache: Redis com TTL 30s (invalidar em write)
  - Arquivo: `apps/server/src/api/routes/players.ts`

## 2.3 — Autenticação (Mobile)

- [ ] **2.3.1** Tela de Login
  - Formulário: email + senha
  - Validação local antes de enviar
  - Loading state, error handling
  - Salvar tokens em `expo-secure-store`
  - Arquivo: `apps/mobile/src/screens/LoginScreen.tsx`

- [ ] **2.3.2** Tela de Registro
  - Formulário: email + senha + confirmação + nickname
  - Validação local (formato email, senha forte, nickname válido)
  - Após registro, auto-login
  - Arquivo: `apps/mobile/src/screens/RegisterScreen.tsx`

- [ ] **2.3.3** Tela de Criação de Personagem
  - Seletor de vocação (5 opções com descrição e stats preview)
  - Customização visual (skin tone slider, hair style picker, outfit)
  - Preview do personagem (sprite animado com as escolhas)
  - Botão confirmar → cria personagem no server → navega para GameScreen
  - Arquivo: `apps/mobile/src/screens/CharacterCreationScreen.tsx`

- [ ] **2.3.4** Auth store (Zustand)
  - State: `token`, `refreshToken`, `player`, `isAuthenticated`, `isLoading`
  - Actions: `login()`, `register()`, `logout()`, `refreshAuth()`, `loadStoredAuth()`
  - Interceptor Axios: attach token em requests, auto-refresh em 401
  - Arquivo: `apps/mobile/src/stores/authStore.ts`

- [ ] **2.3.5** API client (Axios)
  - Base URL configurável via env
  - Interceptors: auth token, refresh on 401, error formatting
  - Tipagem forte: cada endpoint com tipos de request/response do `shared`
  - Arquivo: `apps/mobile/src/services/api.ts`

## 2.4 — Conexão WebSocket (Colyseus)

- [ ] **2.4.1** Configurar Colyseus Server
  - Criar `GameRoom` com state schema (Colyseus Schema)
  - State: jogadores na sala (posição, estado, animação), NPCs, entidades
  - Autenticação via JWT no `onAuth` do room
  - Room por região: `room_zona_norte`, `room_zona_sul`, etc.
  - Máximo 100 jogadores por room
  - Arquivo: `apps/server/src/rooms/GameRoom.ts`, `apps/server/src/rooms/schemas/GameState.ts`

- [ ] **2.4.2** Colyseus Client no mobile
  - Conectar ao room da região do jogador
  - Sincronizar posição de outros jogadores em tempo real
  - Reconexão automática em caso de disconnect
  - Arquivo: `apps/mobile/src/services/colyseus.ts`

- [ ] **2.4.3** Sincronização de posição do jogador
  - Client envia posição a cada 100ms (throttled)
  - Server valida velocidade de movimento (anti-teleport)
  - Server broadcast posição para outros jogadores na room
  - Client interpola posição de outros jogadores (smooth movement)
  - Arquivo: `apps/server/src/rooms/handlers/movement.ts`

---

# FASE 3 — HUD e Interface do Jogo

> Todos os componentes de UI sobrepostos ao game view.
> **Dependência:** Fase 1, Fase 2
> **Entregável:** Interface completa com HUD, menus, navegação entre telas.

## 3.1 — HUD Principal (sobreposto ao mapa)

- [ ] **3.1.1** Barra de status do jogador
  - Exibe: nome, nível/título, HP (barra vermelha), estamina (barra verde), nervos (barra azul), vício (barra roxa), dinheiro no bolso
  - Posição: topo da tela, compacto
  - Toca para expandir detalhes (stats completos)
  - Arquivo: `apps/mobile/src/components/hud/StatusBar.tsx`

- [ ] **3.1.2** Minimap
  - Miniatura do mapa da região no canto superior direito
  - Ponto piscante indicando posição do jogador
  - Pontos coloridos para outros jogadores, propriedades, locais
  - Toque para abrir mapa full-screen
  - Arquivo: `apps/mobile/src/components/hud/Minimap.tsx`

- [ ] **3.1.3** Barra de ações rápidas
  - Posição: parte inferior da tela
  - Botões: Crimes, Inventário, Facção, Chat, Menu
  - Ícones com badges (notificações)
  - Arquivo: `apps/mobile/src/components/hud/ActionBar.tsx`

- [ ] **3.1.4** Menu de ação contextual
  - Aparece ao tocar em NPC, jogador, prédio ou local no mapa
  - Lista ações disponíveis (ex: tocar em Mercado Negro → Comprar/Vender/Reparar)
  - Arquivo: `apps/mobile/src/components/hud/ContextMenu.tsx`

## 3.2 — Telas de Menu (React Navigation Stack)

- [ ] **3.2.1** Tela de Inventário
  - Grid de itens (armas, coletes, drogas, impulsos, consumíveis)
  - Detalhes ao tocar: stats, durabilidade, proficiência
  - Ações: equipar, usar, vender, descartar
  - Arquivo: `apps/mobile/src/screens/InventoryScreen.tsx`

- [ ] **3.2.2** Tela de Perfil do Jogador
  - Stats completos, vocação, nível, conceito
  - Histórico de conquistas
  - Estatísticas públicas
  - Opção de trocar vocação
  - Arquivo: `apps/mobile/src/screens/ProfileScreen.tsx`

- [ ] **3.2.3** Tela de Mapa Full-Screen
  - Mapa de todas as regiões do RJ
  - Favelas marcadas com cores da facção dominante
  - Zoom para ver detalhes de cada região
  - Fast travel: mototáxi para outra região (custo + tempo)
  - Arquivo: `apps/mobile/src/screens/MapScreen.tsx`

- [ ] **3.2.4** Tela de Configurações
  - Volume de som/música, qualidade gráfica, idioma
  - Gerenciamento de conta (mudar senha, logout)
  - Sobre o jogo, links de suporte
  - Arquivo: `apps/mobile/src/screens/SettingsScreen.tsx`

---

# FASE 4 — Core Gameplay: Crimes e Progressão

> Loop principal: cometer crimes, ganhar conceito, subir de nível.
> **Dependência:** Fase 2, Fase 3
> **Entregável:** Jogador pode cometer crimes solo, ganhar/perder recursos, ser preso.

## 4.1 — Sistema de Crimes (Server)

- [ ] **4.1.1** Crime engine — lógica central
  - Função `attemptCrime(playerId, crimeId)`:
    1. Verificar nível mínimo
    2. Verificar stamina e nervos suficientes
    3. Verificar cooldown
    4. Calcular poder do jogador (atributos + equip + vocação)
    5. Calcular probabilidade de sucesso
    6. Roll aleatório (Math.random vs. probabilidade)
    7. Se sucesso: calcular recompensa (dinheiro, conceito, chance de drop)
    8. Se falha: calcular penalidade (chance de prisão, perda de HP, perda de conceito)
    9. Deduzir stamina e nervos
    10. Atualizar cooldown
    11. Registrar no log de ações
  - Arquivo: `apps/server/src/systems/CrimeSystem.ts`

- [ ] **4.1.2** Sistema de cooldowns
  - Redis: `crime:{playerId}:{crimeId}` com TTL = cooldown do crime
  - Verificar antes de permitir ação
  - Arquivo: `apps/server/src/systems/CooldownSystem.ts`

- [ ] **4.1.3** Sistema de "calor da polícia"
  - Redis: `heat:{playerId}` — score que decai com tempo
  - Cada crime adiciona heat (proporcional à gravidade)
  - Heat alto: aumenta chance de prisão em qualquer crime
  - Decai: -1 ponto a cada 5 minutos reais de inatividade criminal
  - Arquivo: `apps/server/src/systems/PoliceHeatSystem.ts`

## 4.2 — Sistema de Recursos (Server)

- [ ] **4.2.1** Regeneração de estamina
  - Timer server-side: calcula estamina baseado no tempo decorrido e estado de moral
  - Não é tick-based — é calculado sob demanda (quando jogador faz ação)
  - Fórmula: `staminaAtual = min(100, staminaSalva + (tempoDecorrido × taxaRecuperação))`
  - Taxa depende do moral, casa, bônus de facção
  - Arquivo: `apps/server/src/systems/StaminaSystem.ts`

- [ ] **4.2.2** Regeneração de nervos
  - Similar à estamina: sob demanda, não tick-based
  - Taxa fixa: 1 ponto a cada 5 min reais
  - Máximo: 100
  - Arquivo: `apps/server/src/systems/NerveSystem.ts`

- [ ] **4.2.3** Decaimento de vício
  - Reduz 1% por hora de jogo sem usar drogas
  - Verificação sob demanda (quando jogador tenta ação ou abre perfil)
  - Arquivo: `apps/server/src/systems/AddictionSystem.ts`

- [ ] **4.2.4** Sistema de nível / progressão
  - Ao ganhar conceito: verificar se atingiu threshold do próximo nível
  - Se sim: level up → desbloquear features → notificar client
  - Evento: `onLevelUp(playerId, newLevel)` — pode triggar tutoriais
  - Arquivo: `apps/server/src/systems/LevelSystem.ts`

## 4.3 — Interface de Crimes (Mobile)

- [ ] **4.3.1** Tela de lista de crimes
  - Lista agrupada por nível (abas ou seções)
  - Cada crime mostra: nome, custo (estamina/nervos), probabilidade de sucesso (%), recompensa estimada, cooldown restante
  - Crimes bloqueados (nível insuficiente) aparecem em cinza
  - Crimes em cooldown aparecem com timer
  - Toque para executar → confirmação → animação de resultado
  - Arquivo: `apps/mobile/src/screens/CrimesScreen.tsx`

- [ ] **4.3.2** Animação/feedback de resultado de crime
  - Sucesso: som + efeito visual verde + popup com recompensas detalhadas
  - Falha: som + efeito vermelho + popup com penalidades
  - Prisão: tela especial de "Preso!" com opções de saída
  - Arquivo: `apps/mobile/src/components/CrimeResultModal.tsx`

---

# FASE 5 — Equipamento e Mercado Negro

> **Dependência:** Fase 4
> **Entregável:** Jogador compra/vende armas, coletes, itens. Inventário funcional.

- [ ] **5.1** Inventário (Server): CRUD de itens, limites de peso/slots, equipar/desequipar
- [ ] **5.2** Mercado Negro (Server): sistema de ordens de compra/venda, matching, comissão 5%
- [ ] **5.3** Durabilidade e reparo: desgaste por uso, endpoint de reparo com custo
- [ ] **5.4** Proficiência de armas: sistema de XP por arma, bônus crescente
- [ ] **5.5** Tela de Mercado Negro (Mobile): listagem, busca, filtros, comprar, vender, reparar
- [ ] **5.6** Sistema de leilão: criar leilão, dar lance, timer, notificação de vitória

---

# FASE 6 — Drogas e Vício

> **Dependência:** Fase 4
> **Entregável:** Jogador consome drogas, sistema de tolerância/vício/overdose funcional.

- [ ] **6.1** Drug consumption engine (Server): consumir droga → recuperar estamina + moral + nervos, aumentar tolerância + vício
- [ ] **6.2** Sistema de tolerância por droga: decay com tempo, eficiência decrescente
- [ ] **6.3** Sistema de overdose: trigger, hospitalização, penalidades
- [ ] **6.4** Fábricas de drogas (Server): produção automática por ciclo, componentes, manutenção
- [ ] **6.5** Venda de drogas: tráfico direto, boca, rave, docas com lógica de preço
- [ ] **6.6** Interface de consumo de drogas (Mobile): tela de rave/baile, seletor de droga, aviso de overdose
- [ ] **6.7** Interface de fábricas (Mobile): criar, gerenciar, estocar componentes, coletar produção

---

# FASE 7 — Negócios e Propriedades

> **Dependência:** Fase 5, Fase 6
> **Entregável:** Bocas, raves, puteiros, lojas de fachada, maquininhas, imóveis funcionais.

- [ ] **7.1** Sistema de propriedades (Server): comprar, upgradar, manutenção diária, soldados
- [ ] **7.2** Bocas de fumo: estoque de drogas, venda automática a NPCs, lucro por localização
- [ ] **7.3** Raves e Bailes: configurar drogas e preço, fluxo de visitantes, receita
- [ ] **7.4** Puteiros e GPs: compra de GP, tipos, lucro, riscos (fuga, morte, DST)
- [ ] **7.5** Lojas de fachada + lavagem de dinheiro: investir, retorno, risco de investigação
- [ ] **7.6** Maquininhas de caça-níquel: compra, instalação, odds configuráveis, lucro passivo
- [ ] **7.7** Jogo do bicho: apostar, sorteio, pagamento
- [ ] **7.8** Imóveis: comprar casa, bônus de estamina, cofre
- [ ] **7.9** Telas de gerenciamento de negócios (Mobile): dashboard, coletar renda, gerenciar soldados

---

# FASE 8 — Treinamento e Universidade

> **Dependência:** Fase 4
> **Entregável:** Treinos funcionais, Universidade do Crime com cursos por vocação.

- [ ] **8.1** Centro de treino (Server): sessões com timer real, ganho de stats, rendimento decrescente
- [ ] **8.2** Universidade do Crime (Server): cursos com pré-requisitos, timer, efeitos passivos permanentes
- [ ] **8.3** Tela de treino (Mobile): selecionar tipo, iniciar, progresso visual, resultado
- [ ] **8.4** Tela de universidade (Mobile): árvore de cursos por vocação, status, iniciar curso

---

# FASE 9 — Facções

> **Dependência:** Fase 4
> **Entregável:** Criar/entrar em facção, hierarquia, banco, upgrades, crimes coletivos.

- [ ] **9.1** CRUD de facções (Server): criar, dissolver, configurar (nome, sigla, descrição)
- [ ] **9.2** Sistema de membros e hierarquia: entrar, sair, promover, rebaixar, expulsar
- [ ] **9.3** Banco da facção: depósitos, saques (por cargo), histórico
- [ ] **9.4** Sistema de upgrades de facção: pontos, desbloquear upgrades, aplicar bônus
- [ ] **9.5** Crimes de facção (Server): coordenação, custo, poder combinado, recompensa dividida
- [ ] **9.6** Facções fixas: seed + lógica de NPC líder quando sem jogador líder
- [ ] **9.7** Eleição e desafio de liderança: votação, PvP de desafio
- [ ] **9.8** Colyseus: FactionRoom para chat e coordenação em tempo real
- [ ] **9.9** Telas de facção (Mobile): visão geral, membros, banco, upgrades, guerra, candidatura

---

# FASE 10 — Sistema Territorial (Favelas)

> **Dependência:** Fase 9
> **Entregável:** Conquista de favelas, serviços, satisfação, X9, propina, baile funk.

- [ ] **10.1** Favela state machine (Server): estados (neutra, controlada, em_guerra, estado)
- [ ] **10.2** Conquista: combate vs boss NPC, cálculo de poder, transição de controle
- [ ] **10.3** Serviços de favela: instalar, upgradar, calcular receita (fórmula completa)
- [ ] **10.4** Sistema de satisfação: cálculo contínuo, fatores de aumento/diminuição
- [ ] **10.5** Bônus de domínio regional: detectar controle total, aplicar/remover bônus
- [ ] **10.6** X9 event engine: roll diário, trigger incursão, cálculo de perdas, desenrolo
- [ ] **10.7** Propina/Arrego (Server): cobrança periódica, negociação, inadimplência, tomada pelo Estado
- [ ] **10.8** Baile funk (Server): organizar, calcular resultado, aplicar efeitos
- [ ] **10.9** Guerra de facção (Server): declaração, preparação, combate (rounds), resultado, cooldown
- [ ] **10.10** Telas de território (Mobile): mapa de favelas, detalhes, serviços, satisfação, organizar baile

---

# FASE 11 — Tribunal do Tráfico

> **Dependência:** Fase 10
> **Entregável:** Casos aleatórios, julgamento interativo, impacto moral, Antigão conselheiro.

- [ ] **11.1** Case generator (Server): criar caso aleatório com tipo, carisma dos lados, história
- [ ] **11.2** Antigão AI: gerar dicas baseadas na verdade do caso e nos impactos de cada punição
- [ ] **11.3** Julgamento (Server): receber punição escolhida, calcular impactos em moradores e facção
- [ ] **11.4** Tela do Tribunal (Mobile): apresentação do caso, ambos os lados, Antigão, seletor de punição, resultado
- [ ] **11.5** Templates de história: ~5 variações de texto por tipo de caso (50+ textos)

---

# FASE 12 — Combate PvP

> **Dependência:** Fase 5
> **Entregável:** Porrada 1v1, emboscada, contratos de assassinato.

- [ ] **12.1** Combat engine (Server): cálculo de poder, roll, dano, morte, recompensa
- [ ] **12.2** Porrada 1v1: atacar jogador, resultado, loot, hospitalização
- [ ] **12.3** Emboscada: grupo vs solo, poder combinado, divisão de recompensa
- [ ] **12.4** Contratos de assassinato: criar, aceitar, executar, recompensar, notificações
- [ ] **12.5** Proteção de novato: flag nos primeiros 3 dias, bloquear ataques
- [ ] **12.6** Tela de combate (Mobile): seleção de alvo, confirmação, animação de resultado
- [ ] **12.7** Tela de contratos (Mobile): lista de contratos, criar, aceitar

---

# FASE 13 — Prisão e Hospital

> **Dependência:** Fase 4
> **Entregável:** Mecânica de prisão completa, hospital com todos os serviços.

- [ ] **13.1** Prisão (Server): encarceramento com timer, bloqueio de ações, calor da polícia
- [ ] **13.2** Saída da prisão: esperar, suborno, fiança (créditos), fuga (minigame), resgate de facção
- [ ] **13.3** Hospital (Server): cura, desintox, cirurgia, consumíveis de stat, DST, plano de saúde
- [ ] **13.4** Tela de prisão (Mobile): status da pena, opções de saída, timer
- [ ] **13.5** Tela de hospital (Mobile): menu de serviços, compra, timer de tratamento

---

# FASE 14 — Eventos do Jogo

> **Dependência:** Fase 10
> **Entregável:** Eventos programados e aleatórios funcionais.

- [ ] **14.1** Event scheduler (Server): cron job (node-cron) verificando eventos programados e rolls aleatórios
- [ ] **14.2** Navio nas Docas: ativar porto, preço premium, timer
- [ ] **14.3** Operação Policial / Blitz: selecionar região, aplicar efeitos
- [ ] **14.4** Eventos sazonais: Carnaval, Ano Novo — ativar bônus por período
- [ ] **14.5** Notificação de eventos (Mobile): push notification + banner in-game

---

# FASE 15 — Economia e Banco

> **Dependência:** Fase 7
> **Entregável:** Banco funcional, inflação, fluxo econômico balanceado.

- [ ] **15.1** Banco (Server): depósito (limite diário), saque (taxa), juros diários, proteção
- [ ] **15.2** Sistema de inflação: escalonar preços de NPCs com o dia da rodada
- [ ] **15.3** Rodadas (Server): iniciar rodada, timer de fim, calcular ranking final, premiar, resetar
- [ ] **15.4** Hall da Fama: persistir rankings entre rodadas
- [ ] **15.5** Bônus de rodada anterior: calcular e aplicar na nova rodada

---

# FASE 16 — Social (Chat e Contatos)

> **Dependência:** Fase 2
> **Entregável:** Chat global/local/facção/privado, contatos, perfis públicos.

- [ ] **16.1** Chat server (Colyseus ou Redis pub/sub): canais global, local, facção, privado, comércio
- [ ] **16.2** Rate limiting de chat: max 1 msg/segundo, anti-flood
- [ ] **16.3** Filtro de palavras proibidas: lista + regex, punição automática
- [ ] **16.4** Sistema de contatos: adicionar parceiro/conhecido, limites, perda por eventos
- [ ] **16.5** Perfil público: stats, conquistas, facção — endpoint + tela
- [ ] **16.6** Tela de chat (Mobile): tabs por canal, input, mensagens, timestamp
- [ ] **16.7** Tela de contatos (Mobile): lista, adicionar, remover, enviar mensagem

---

# FASE 17 — Monetização

> **Dependência:** Fase 3
> **Entregável:** Loja de créditos, compra in-app, itens cosméticos.

- [ ] **17.1** Loja de créditos (Server): catálogo de itens, verificar saldo, comprar
- [ ] **17.2** In-App Purchase: integrar `expo-in-app-purchases` (Google Play + App Store)
- [ ] **17.3** Itens cosméticos: skins, roupas, emotes, molduras — aplicar no personagem
- [ ] **17.4** Créditos gratuitos: recompensa por nível, achievements, login diário
- [ ] **17.5** Tela da loja (Mobile): grid de itens, preview, comprar, equipar

---

# FASE 18 — Anti-Cheat e Segurança

> **Dependência:** Fase 2
> **Entregável:** Detecção de multi-conta, anti-bot, validação server-side.

- [ ] **18.1** Device ID tracking: `expo-application` device ID, vincular à conta
- [ ] **18.2** Validação server-side de todas as ações (nunca confiar no client)
- [ ] **18.3** Rate limiting por endpoint: Redis sliding window
- [ ] **18.4** Anti-speedhack: validar timestamps de ações (cooldowns, movimentação)
- [ ] **18.5** Sistema de report: jogador reporta outro, fila de moderação
- [ ] **18.6** Sistema de ban: ban temporário/permanente, motivo, endpoint admin

---

# FASE 19 — Áudio e Polish

> **Dependência:** Todas as fases anteriores
> **Entregável:** Sons, música, animações polidas, tutoriais.

- [ ] **19.1** Sistema de áudio: `expo-av` para sons e música
- [ ] **19.2** Sound effects: caminhada, crime, combate, notificação, level up, morte
- [ ] **19.3** Música ambiente: por região (funk na Z.Norte, bossa na Z.Sul, etc.)
- [ ] **19.4** Tutorial interativo: onboarding nos primeiros 30 minutos (guiado por NPCs)
- [ ] **19.5** Animações de transição entre telas
- [ ] **19.6** Efeitos visuais: partículas em level up, combate, crime
- [ ] **19.7** Notificações push: `expo-notifications` para eventos, ataques, fim de timer

---

# FASE 20 — Testes e Balanceamento

> **Dependência:** Todas as fases de gameplay (4-15)
> **Entregável:** Jogo balanceado, testado, sem exploits conhecidos.

- [ ] **20.1** Testes unitários: todos os sistemas server-side (crime, combate, economia, etc.)
- [ ] **20.2** Testes de integração: fluxos completos (registrar → criar personagem → crime → subir nível)
- [ ] **20.3** Testes de carga: simular 500+ jogadores simultâneos (k6 ou Artillery)
- [ ] **20.4** Balanceamento de economia: simulação de 1 rodada com bots (verificar inflação/deflação)
- [ ] **20.5** Balanceamento de crimes: verificar progressão de dificuldade, recompensa vs risco
- [ ] **20.6** Balanceamento de PvP: verificar que nenhuma vocação é dominante
- [ ] **20.7** Balanceamento territorial: verificar que facções fixas não são imbatíveis
- [ ] **20.8** Playtest fechado: 20-50 testers, coletar feedback, iterar

---

# FASE 21 — Build e Publicação

> **Dependência:** Fase 19, Fase 20
> **Entregável:** App nas stores, server em produção, monitoramento.

## 21.1 — Infraestrutura de Produção

- [ ] **21.1.1** Provisionar VPS (Hetzner ou DigitalOcean): 4vCPU, 8GB RAM, 80GB SSD
- [ ] **21.1.2** Setup Docker em produção: Dockerfile para server, docker-compose.prod.yml
- [ ] **21.1.3** PostgreSQL em produção: managed database ou self-hosted com backup automático
- [ ] **21.1.4** Redis em produção: managed ou self-hosted com persistência
- [ ] **21.1.5** Nginx reverse proxy: SSL (Let's Encrypt), WebSocket upgrade, rate limiting
- [ ] **21.1.6** Monitoramento: Uptime Kuma ou Grafana + Prometheus para métricas de server
- [ ] **21.1.7** Logging: estruturado com pino (Fastify default), rotação de logs
- [ ] **21.1.8** Backup automatizado: pg_dump diário → Cloudflare R2

## 21.2 — App Stores

- [ ] **21.2.1** Configurar EAS Build: `eas.json` com profiles (development, preview, production)
- [ ] **21.2.2** Configurar signing: keystore Android, certificados iOS
- [ ] **21.2.3** App Store metadata: ícone, screenshots, descrição, classificação etária (18+)
- [ ] **21.2.4** Google Play metadata: ícone, screenshots, descrição, classificação etária
- [ ] **21.2.5** Privacy Policy e Terms of Service (requisito das stores)
- [ ] **21.2.6** Build de produção Android (AAB) via EAS
- [ ] **21.2.7** Build de produção iOS (IPA) via EAS
- [ ] **21.2.8** Submit para review: Google Play (3-7 dias) e App Store (1-3 dias)
- [ ] **21.2.9** Beta fechado: TestFlight (iOS) + Internal Testing (Google Play)

## 21.3 — Lançamento

- [ ] **21.3.1** Soft launch: liberar para região limitada (BR apenas)
- [ ] **21.3.2** Monitorar métricas: DAU, retenção D1/D7/D30, crash rate, server load
- [ ] **21.3.3** Hotfix pipeline: EAS Update (OTA) para correções urgentes sem re-review
- [ ] **21.3.4** Launch público: abrir para todos

---

# Resumo de Dependências entre Fases

```
Fase 0 (Infra)
├── Fase 1 (Engine)
│   └── Fase 3 (HUD/UI) ──→ Fase 17 (Monetização)
├── Fase 2 (Auth/Player) ──→ Fase 16 (Social), Fase 18 (Anti-Cheat)
│   ├── Fase 4 (Crimes/Progressão)
│   │   ├── Fase 5 (Equipamento/Mercado) ──→ Fase 12 (PvP)
│   │   ├── Fase 6 (Drogas/Vício)
│   │   │   └── Fase 7 (Negócios) ──→ Fase 15 (Economia)
│   │   ├── Fase 8 (Treino/Universidade)
│   │   ├── Fase 9 (Facções)
│   │   │   └── Fase 10 (Território)
│   │   │       ├── Fase 11 (Tribunal)
│   │   │       └── Fase 14 (Eventos)
│   │   └── Fase 13 (Prisão/Hospital)
│   └── Fase 2.4 (WebSocket)
│
Fases 1-18 ──→ Fase 19 (Polish) ──→ Fase 20 (Testes) ──→ Fase 21 (Launch)
```

---

# Métricas de Progresso

| Fase | Tarefas | Concluídas | % |
|---|---|---|---|
| Fase 0 — Infra | 15 | 0 | 0% |
| Fase 1 — Engine | 13 | 0 | 0% |
| Fase 2 — Auth/Player | 12 | 0 | 0% |
| Fase 3 — HUD/UI | 8 | 0 | 0% |
| Fase 4 — Crimes | 7 | 0 | 0% |
| Fase 5 — Equipamento | 6 | 0 | 0% |
| Fase 6 — Drogas | 7 | 0 | 0% |
| Fase 7 — Negócios | 9 | 0 | 0% |
| Fase 8 — Treino | 4 | 0 | 0% |
| Fase 9 — Facções | 9 | 0 | 0% |
| Fase 10 — Território | 10 | 0 | 0% |
| Fase 11 — Tribunal | 5 | 0 | 0% |
| Fase 12 — PvP | 7 | 0 | 0% |
| Fase 13 — Prisão/Hospital | 5 | 0 | 0% |
| Fase 14 — Eventos | 5 | 0 | 0% |
| Fase 15 — Economia | 5 | 0 | 0% |
| Fase 16 — Social | 7 | 0 | 0% |
| Fase 17 — Monetização | 5 | 0 | 0% |
| Fase 18 — Anti-Cheat | 6 | 0 | 0% |
| Fase 19 — Polish | 7 | 0 | 0% |
| Fase 20 — Testes | 8 | 0 | 0% |
| Fase 21 — Launch | 17 | 0 | 0% |
| **TOTAL** | **181** | **0** | **0%** |

---

> Este documento é a fonte de verdade para o progresso do desenvolvimento.
> Atualizar status das tarefas conforme forem sendo implementadas.
