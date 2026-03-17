# PERFORMANCE_UPGRADE.md — Plano Técnico de Otimização CS RIO

**Data**: 17/03/2026
**Versão**: 1.0
**Objetivo**: Reduzir o tamanho do aplicativo, melhorar fluidez de navegação, otimizar tempo de resposta do servidor

---

## DIAGNÓSTICO INICIAL — RADIOGRAFIA DO PROJETO

### Tamanho atual do monorepo

| Componente | Tamanho | Observação |
|---|---|---|
| **Monorepo total** | **4.0 GB** | Inclui node_modules e .git |
| `node_modules/` (root) | 1.8 GB | Deps compartilhadas |
| `apps/mobile/node_modules/` | 1.2 GB | Deps do mobile |
| `apps/server/node_modules/` | 24 KB | Apenas symlinks (hoisted) |
| `.git/` | 105 MB | Histórico Git |
| `apps/mobile/assets/` | **61 MB** | Assets do app |
| `apps/mobile/assets/examples/` | **58 MB** | 81 imagens de referência NÃO USADAS |
| `apps/mobile/assets/maps/` | 2.2 MB | 3 arquivos, 1 não usado |
| `apps/mobile/assets/tilesets/` | 8 KB | 1 arquivo NÃO USADO |
| `apps/server/src/` | 12 MB | Backend completo |
| `packages/shared/` | 464 KB | Tipos e constantes |
| `packages/game-engine/` | 308 KB | Motor de jogo |

### Assets utilizados vs não utilizados

| Arquivo | Tamanho | Referenciado no código? | Ação |
|---|---|---|---|
| `assets/examples/` (82 imagens) | **58 MB** | NÃO | REMOVER |
| `assets/maps/rj.webp` | 636 KB | SIM (MapScreen.tsx) | MANTER |
| `assets/maps/zona_norte.json` | 1.3 MB | SIM (zonaNortePrototypeMap.ts) | MANTER |
| `assets/maps/zona_norte.tmj` | 243 KB | NÃO | REMOVER |
| `assets/tilesets/city_base.png` | 4 KB | NÃO | REMOVER |
| `assets/sprites/player_base.png` | ~28 KB | SIM (GameView.tsx) | MANTER |
| `assets/audio/*.wav` (3 arquivos) | ~92 KB | SIM (audioCatalog.ts) | MANTER |

### Problema crítico: `assetBundlePatterns` em app.json

```json
"assetBundlePatterns": ["**/*"]
```

Esse wildcard inclui TUDO — inclusive os 58 MB de `examples/` e arquivos não usados. Isso infla o bundle do app diretamente.

---

## ETAPAS DO PLANO

---

### ETAPA 1 — Separação do Backend para o Repositório `cs_rio_api`
**Impacto**: Redução do monorepo, builds independentes, mobile não carrega deps do server
**Complexidade**: Alta
**Status**: `[x] Concluída em 17/03/2026`

> **DECISÃO APROVADA**: Esta etapa continua no pacote de melhorias e não será removida do plano, mesmo não sendo a primeira a ser executada.

#### O que mover para `cs_rio_api`

| Pasta/Arquivo | Origem | Destino |
|---|---|---|
| `apps/server/` | `cs_rio/apps/server/` | `cs_rio_api/` (raiz) |
| `packages/shared/` | `cs_rio/packages/shared/` | `cs_rio_api/packages/shared/` (cópia) |
| `docker-compose.dev.yml` | `cs_rio/` | `cs_rio_api/` |
| `.env` / `.env.example` | `cs_rio/` | `cs_rio_api/` |

#### Estrutura alvo do `cs_rio_api`

```
cs_rio_api/
├── src/                     # (era apps/server/src/)
│   ├── api/
│   ├── config/
│   ├── db/
│   ├── errors/
│   ├── observability/
│   ├── rooms/
│   ├── scripts/
│   ├── services/
│   ├── systems/
│   ├── app.ts
│   ├── container.ts
│   ├── index.ts
│   └── realtime.ts
├── test/                    # (era apps/server/test/)
├── packages/
│   └── shared/              # Cópia do @cs-rio/shared
├── drizzle.config.ts
├── vitest.config.ts
├── tsconfig.json
├── package.json
├── docker-compose.dev.yml
├── .env.example
└── .gitignore
```

#### Passos detalhados

1. **Copiar `apps/server/` inteiro para `cs_rio_api/`** — ajustar paths para remover `apps/server/` do prefixo
2. **Copiar `packages/shared/` para `cs_rio_api/packages/shared/`** — o server depende dele
3. **Ajustar `package.json`** do server:
   - Remover referência `file:../../packages/shared` → usar `file:./packages/shared`
   - Manter todas as deps do server (fastify, colyseus, drizzle, bcrypt, pg, redis, etc.)
   - Copiar devDeps relevantes do root (typescript, vitest, eslint, tsx)
4. **Ajustar `tsconfig.json`** — paths relativos
5. **Ajustar `drizzle.config.ts`** — paths de schema e migrations
6. **Copiar `docker-compose.dev.yml`** — PostgreSQL + Redis para dev local
7. **Copiar scripts CLI** (`ops:*`) e ajustar imports
8. **Criar `.gitignore`** adequado (node_modules, dist, .env, etc.)
9. **Validar**: rodar `npm install`, `npm run build`, `npm run test`, `npm run dev`

#### Ajustes no `cs_rio` (mobile) após a separação

1. **Remover `apps/server/`** inteiro
2. **Remover do `turbo.json`** qualquer referência a tasks do server
3. **Remover do root `package.json`** deps exclusivas do server (já estão hoisted)
4. **`packages/shared/`** continua no monorepo mobile (o mobile também depende)
5. **`packages/game-engine/`** continua no monorepo mobile (exclusivo do mobile)
6. **Ajustar `workspaces`** no root package.json se necessário

> **NOTA**: O `@cs-rio/shared` ficará duplicado (uma cópia em cada repo). Isso é intencional — são tipos e constantes que raramente mudam. Se no futuro quiser unificar, pode publicar como pacote npm privado.

#### Resultado da execução

- `cs_rio_api/` criado na raiz de `projects/` com `src/`, `test/`, `packages/shared/`, `package.json`, `package-lock.json`, `Dockerfile`, `drizzle.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.base.json`, `.env.example`, `.gitignore` e workflows próprios
- backend promovido para rodar na raiz do novo repo, com `@cs-rio/shared` local em `file:./packages/shared` e comandos `ops:*` ajustados para nao depender de `--workspace @cs-rio/server`
- `docker-compose.dev.yml`, `.env` e `.env.example` copiados para `cs_rio_api`, preservando bootstrap local de PostgreSQL + Redis e a configuracao ativa do backend
- `cs_rio` limpo para mobile-only: `apps/server/`, `docker-compose.dev.yml` e `.github/workflows/deploy-server.yml` removidos
- `cs_rio/package.json`, `.env.example`, `.gitignore`, `README.md`, `ROLL_OUT.md` e `CHEATS.md` atualizados para apontar o backend no repo irmao `../cs_rio_api`
- `package-lock.json` do `cs_rio` recalculado sem o workspace do server; o bloco extraneous residual de `apps/server` foi removido
- validacoes do novo repo executadas com sucesso: `npm install`, `npm run build`, `npm run lint`, `npm run test` (`66` arquivos, `348` testes) e bootstrap curto via `timeout 20s npm run dev` em `PORT=3102` / `COLYSEUS_PORT=3569`
- validacoes do repo mobile executadas com sucesso: `npm install`, `npm run build`, `npm run lint`, `npm run test` e `node ./scripts/run-expo-with-root-env.mjs config --type public`

---

### ETAPA 2 — Remoção de Assets Não Utilizados
**Impacto**: ~58.2 MB a menos no bundle do app
**Complexidade**: Baixa
**Status**: `[x] Concluída em 17/03/2026`

#### Ações

| # | Ação | Economia |
|---|---|---|
| 2.1 | Remover `apps/mobile/assets/examples/` inteira | **58 MB** |
| 2.2 | Remover `apps/mobile/assets/maps/zona_norte.tmj` | 243 KB |
| 2.3 | Remover `apps/mobile/assets/tilesets/city_base.png` | 4 KB |
| | **Total** | **~58.2 MB** |

#### Resultado da execução

- `apps/mobile/assets/examples/` removida
- `apps/mobile/assets/maps/zona_norte.tmj` removido
- `apps/mobile/assets/tilesets/city_base.png` removido
- `apps/mobile/assets/maps/zona_norte.json` limpo para nao manter referencia textual ao tileset removido
- `apps/mobile/app.json` atualizado para bundlar apenas os assets necessarios
- tamanho de `apps/mobile/assets/` reduzido de `61 MB` para `2.3 MB`

#### Verificação pré-remoção (checklist)

- [x] `examples/` — 0 imports no código fonte. 82 imagens JPG/PNG/WebP de referência para geração de SVG. Nenhuma tela do app carrega essas imagens.
- [x] `zona_norte.tmj` — Arquivo-fonte do Tiled Map Editor. O app usa `zona_norte.json` (a versão exportada). O `.tmj` é arquivo de autoria, não runtime.
- [x] `city_base.png` — 0 imports. Grep por `city_base` e `tilesets` no `src/` retorna 0 resultados.

#### Ajustar `assetBundlePatterns` em `app.json`

**Antes:**
```json
"assetBundlePatterns": ["**/*"]
```

**Depois:**
```json
"assetBundlePatterns": [
  "assets/audio/**/*",
  "assets/maps/**/*.json",
  "assets/maps/**/*.webp",
  "assets/map-structures/**/*",
  "assets/sprites/**/*"
]
```

Isso garante que apenas assets efetivamente usados entrem no bundle, mesmo que alguém adicione arquivos temporários na pasta `assets/` no futuro.

---

### ETAPA 3 — Remoção de Dependências Não Utilizadas
**Impacto**: Redução do bundle JS e tempo de instalação
**Complexidade**: Baixa
**Status**: `[x] Concluída em 17/03/2026`

#### Dependências confirmadas como não utilizadas

| Pacote | Versão | Evidência | Ação |
|---|---|---|---|
| `react-native-game-engine` | ^1.2.0 | 0 imports em todo o `src/` | **REMOVER** |
| `expo-manifests` | ^0.15.8 | 0 imports diretos (dep transitiva de expo-dev-client) | **REMOVER** |
| `expo-updates-interface` | ^1.0.0 | 0 imports diretos (dep transitiva de expo-dev-client) | **REMOVER** |

#### Dependências de desenvolvimento que podem ser limpas

| Pacote | Versão | Observação | Ação |
|---|---|---|---|
| `expo-dev-launcher` | ^5.0.35 | Redundante com `expo-dev-client` (que já inclui o launcher) | **REMOVER** |
| `expo-dev-menu` | ^6.0.25 | Redundante com `expo-dev-client` | **REMOVER** |
| `expo-dev-menu-interface` | ^1.9.3 | Redundante com `expo-dev-client` | **REMOVER** |

#### Resultado da execução

- Dependências removidas de `apps/mobile/package.json`: `react-native-game-engine`, `expo-manifests`, `expo-updates-interface`, `expo-dev-launcher`, `expo-dev-menu`, `expo-dev-menu-interface`
- `package-lock.json` recalculado com o workspace mobile sem essas dependências diretas
- `expo-dev-launcher`, `expo-dev-menu`, `expo-dev-menu-interface`, `expo-manifests` e `expo-updates-interface` continuam presentes como dependências transitivas de `expo-dev-client`, o que é esperado no estado atual do app
- `react-native-game-engine` deixou de existir no grafo instalado do mobile
- validacoes executadas com sucesso: `build`, `test`, `lint` e subida do Expo/Metro em porta dedicada

#### Passos

1. Remover do `apps/mobile/package.json`:
   ```bash
   npm uninstall react-native-game-engine expo-manifests expo-updates-interface expo-dev-launcher expo-dev-menu expo-dev-menu-interface --workspace=apps/mobile
   ```
2. Rodar `npm install` para recalcular lockfile
3. Rodar `npx expo start` e verificar se o app inicia normalmente
4. Rodar `npx expo prebuild --clean` se necessário

---

### ETAPA 4 — Lazy Loading de Telas (Code Splitting)
**Impacto**: Redução do tempo de carregamento inicial, menor uso de memória
**Complexidade**: Média
**Status**: `[x] Concluída em 17/03/2026`

#### Problema atual

O `RootNavigator.tsx` importa **todas as 27 telas eagerly** no topo do arquivo. Isso significa que ao abrir o app, o JS bundle carrega:

| Tela | Linhas | Acessada no boot? |
|---|---|---|
| FactionScreen | 2.353 linhas | NÃO |
| OperationsScreen | 2.151 linhas | NÃO |
| TerritoryScreen | 1.999 linhas | NÃO |
| MarketScreen | 1.517 linhas | NÃO |
| CombatScreen | 1.224 linhas | NÃO |
| TribunalScreen | 1.217 linhas | NÃO |
| BichoScreen | 1.103 linhas | NÃO |
| ContractsScreen | 1.063 linhas | NÃO |
| HospitalScreen | 993 linhas | NÃO |
| UniversityScreen | 969 linhas | NÃO |
| FactoriesScreen | 934 linhas | NÃO |
| TrainingScreen | 839 linhas | NÃO |
| SabotageScreen | 813 linhas | NÃO |
| ContactsScreen | 749 linhas | NÃO |
| ... e mais 13 telas | ~5.000 linhas | NÃO |
| **HomeScreen** | ~500 linhas | **SIM** |
| **LoginScreen** | ~100 linhas | **SIM** |
| **Total carregado desnecessariamente** | **~24.000 linhas** | - |

#### Solução aprovada: React Navigation `getComponent` com carregamento tardio

**Antes** (`RootNavigator.tsx`):
```typescript
import { FactionScreen } from '../screens/FactionScreen';
import { OperationsScreen } from '../screens/OperationsScreen';
// ... 25 imports estáticos
```

**Depois** (`RootNavigator.tsx`):
```typescript
// Telas acessadas no boot — manter eager
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { CharacterCreationScreen } from '../screens/CharacterCreationScreen';

<Stack.Screen
  name="Faction"
  getComponent={() => require('../screens/FactionScreen').FactionScreen}
  options={inGameSheetOptions}
/>
```

#### Telas para manter como import estático (usadas no boot)

| Tela | Razão |
|---|---|
| LoginScreen | Primeira tela se não autenticado |
| RegisterScreen | Acessada direto do Login |
| CharacterCreationScreen | Primeira tela se sem personagem |
| HomeScreen | Primeira tela se autenticado |

#### Telas para lazy loading (23 restantes)

BichoScreen, CombatScreen, ContactsScreen, ContractsScreen, CrimesScreen, DrugUseScreen, EventsScreen, FactionScreen, FactoriesScreen, HospitalScreen, InventoryScreen, MapScreen, MarketScreen, OperationsScreen, PrisonScreen, ProfileScreen, SabotageScreen, SettingsScreen, TerritoryScreen, TrainingScreen, TribunalScreen, UniversityScreen, VocationScreen

#### Data files que também podem ser lazy

| Arquivo | Tamanho | Onde é usado | Ação |
|---|---|---|---|
| `data/mapRegionVisuals.ts` | 73 KB | HomeScreen (helpers) | Manter eager (usado no boot) |
| `data/mapStructureCatalog.ts` | 18 KB | GameView (renderers) | Manter eager (usado no boot) |
| `data/mapStructureSvgCatalog.ts` | - | GameView | Manter eager |

> **DECISÃO APROVADA**: a implementação desta etapa deve usar `getComponent` do React Navigation para adiar o carregamento das telas fora do boot. O objetivo aqui é reduzir custo de startup e montagem inicial; não tratar esta etapa como redução direta do tamanho do app final.

#### Resultado da execução

- `apps/mobile/src/navigation/RootNavigator.tsx` passou a manter eager apenas `Login`, `Register`, `CharacterCreation` e `Home`
- as outras `23` telas do fluxo autenticado foram registradas via `getComponent`, com carregamento síncrono tardio compatível com `native-stack`
- a configuração ficou centralizada em uma lista `inGameDeferredScreens`, evitando espalhar `require` por cada `Stack.Screen`
- a regra de lint contra `require` foi desabilitada apenas no bloco dessa lista, porque o `getComponent` depende de loader síncrono
- validações executadas com sucesso: `build`, `lint`, `test` e subida curta do Expo/Metro em `CI` na porta `8084`

---

### ETAPA 5 — Índices no Banco de Dados
**Impacto**: Queries até 10-100x mais rápidas em tabelas com muitas linhas
**Complexidade**: Média
**Status**: `[x] Concluída em 17/03/2026`

#### Estado atual

O schema possui 72 tabelas mas **praticamente zero índices secundários**. Apenas:
- Unique indexes em config tables (game_config_entries, feature_flags, etc.)
- Unique constraints em players(email), players(nickname), factions(name), factions(abbreviation)
- Primary keys (automáticos)

**Nenhum índice de foreign key.** Isso significa que TODA query filtrada por `playerId`, `factionId`, `favelaId`, `propertyId`, etc. faz full table scan.

#### Índices a criar — Prioridade CRITICAL

Estes são acessados em praticamente toda request:

```sql
-- player_inventory: acessado em TODA operação de inventário
CREATE INDEX idx_player_inventory_player_id ON player_inventory (player_id);
CREATE INDEX idx_player_inventory_player_type ON player_inventory (player_id, item_type);

-- properties: listagem, sabotagem, operações
CREATE INDEX idx_properties_player_id ON properties (player_id);
CREATE INDEX idx_properties_favela_id ON properties (favela_id);
CREATE INDEX idx_properties_region_id ON properties (region_id);
CREATE INDEX idx_properties_region_type ON properties (region_id, type);

-- faction_members: toda operação de facção
CREATE INDEX idx_faction_members_faction_id ON faction_members (faction_id);

-- prison_records: middleware de prisão (TODA request protegida)
CREATE INDEX idx_prison_records_player_id ON prison_records (player_id);
CREATE INDEX idx_prison_records_player_release ON prison_records (player_id, release_at);

-- transactions: histórico financeiro
CREATE INDEX idx_transactions_player_id ON transactions (player_id);
CREATE INDEX idx_transactions_player_created ON transactions (player_id, created_at DESC);

-- player_bank_ledger: operações bancárias
CREATE INDEX idx_player_bank_ledger_player_id ON player_bank_ledger (player_id);
```

#### Índices a criar — Prioridade HIGH

```sql
-- faction_bank_ledger
CREATE INDEX idx_faction_bank_ledger_faction_id ON faction_bank_ledger (faction_id);

-- property_sabotage_logs: histórico de sabotagem
CREATE INDEX idx_property_sabotage_logs_property_id ON property_sabotage_logs (property_id);
CREATE INDEX idx_property_sabotage_logs_attacker ON property_sabotage_logs (attacker_player_id, created_at DESC);

-- soldiers: roster de propriedade
CREATE INDEX idx_soldiers_property_id ON soldiers (property_id);

-- bicho_bets: apostas por jogador e por sorteio
CREATE INDEX idx_bicho_bets_player_id ON bicho_bets (player_id);
CREATE INDEX idx_bicho_bets_draw_id ON bicho_bets (draw_id);

-- market_orders: mercado
CREATE INDEX idx_market_orders_seller_id ON market_orders (seller_id);
CREATE INDEX idx_market_orders_item ON market_orders (item_type, item_id);

-- market_auctions
CREATE INDEX idx_market_auctions_seller_id ON market_auctions (seller_id);
CREATE INDEX idx_market_auctions_status ON market_auctions (status);

-- market_auction_bids
CREATE INDEX idx_market_auction_bids_auction_id ON market_auction_bids (auction_id);
CREATE INDEX idx_market_auction_bids_bidder_id ON market_auction_bids (bidder_id);

-- faction_leadership_elections
CREATE INDEX idx_faction_leadership_elections_faction_id ON faction_leadership_elections (faction_id);

-- faction_wars
CREATE INDEX idx_faction_wars_attacker ON faction_wars (attacker_faction_id, status);
CREATE INDEX idx_faction_wars_defender ON faction_wars (defender_faction_id, status);
CREATE INDEX idx_faction_wars_favela ON faction_wars (favela_id);

-- contacts
CREATE INDEX idx_contacts_player_type ON contacts (player_id, type);
```

#### Índices a criar — Prioridade MEDIUM

```sql
-- assassination_contracts
CREATE INDEX idx_assassination_contracts_requester ON assassination_contracts (requester_id);
CREATE INDEX idx_assassination_contracts_target ON assassination_contracts (target_id);
CREATE INDEX idx_assassination_contracts_status ON assassination_contracts (status);

-- training_sessions
CREATE INDEX idx_training_sessions_player ON training_sessions (player_id, claimed_at);

-- university_enrollments
CREATE INDEX idx_university_enrollments_player ON university_enrollments (player_id);

-- game_events
CREATE INDEX idx_game_events_region ON game_events (region_id);
CREATE INDEX idx_game_events_favela ON game_events (favela_id);

-- favela_services
CREATE INDEX idx_favela_services_favela ON favela_services (favela_id);

-- favela_bailes
CREATE INDEX idx_favela_bailes_favela ON favela_bailes (favela_id);
CREATE INDEX idx_favela_bailes_faction ON favela_bailes (faction_id);

-- x9_events
CREATE INDEX idx_x9_events_favela ON x9_events (favela_id);
CREATE INDEX idx_x9_events_status ON x9_events (status);

-- tribunal_cases
CREATE INDEX idx_tribunal_cases_favela ON tribunal_cases (favela_id);

-- propina_payments
CREATE INDEX idx_propina_payments_faction ON propina_payments (faction_id);
CREATE INDEX idx_propina_payments_favela ON propina_payments (favela_id);

-- chat_messages
CREATE INDEX idx_chat_messages_channel ON chat_messages (channel_type, channel_id, sent_at DESC);

-- market_auction_notifications
CREATE INDEX idx_market_auction_notifications_player ON market_auction_notifications (player_id);

-- round_rankings
CREATE INDEX idx_round_rankings_round ON round_rankings (round_id);
```

#### Como implementar

1. Criar nova migration via Drizzle: `npm run db:generate` após adicionar os índices no `schema.ts`
2. Em Drizzle ORM, índices são declarados com `index()` no schema:
   ```typescript
   import { index } from 'drizzle-orm/pg-core';

   export const playerInventory = pgTable('player_inventory', {
     // ... columns
   }, (table) => [
     index('idx_player_inventory_player_id').on(table.playerId),
     index('idx_player_inventory_player_type').on(table.playerId, table.itemType),
   ]);
   ```
3. Gerar e aplicar migration: `npm run db:generate && npm run db:push`
4. Monitorar impacto com `EXPLAIN ANALYZE` nas queries mais lentas

**Total: ~45 índices em ~25 tabelas.**

> **DECISÃO APROVADA**: executar o pacote completo de índices planejado, sem reduzir o escopo para uma versão conservadora.

#### Resultado da execução

- `apps/server/src/db/schema.ts` atualizado com o pacote completo de índices secundários da etapa
- migration manual `apps/server/src/db/migrations/0050_performance_indexes.sql` criada com `CREATE INDEX IF NOT EXISTS`
- `apps/server/src/db/migrations/meta/_journal.json` alinhado para incluir `0048_vocation_domain`, `0049_sabotage_backbone` e `0050_performance_indexes`
- `drizzle-kit generate` nao foi utilizavel neste estado porque o projeto ja estava com drift historico e prompt interativo sobre rename antigo em `crimes.cansaco_cost`
- migration `0050_performance_indexes.sql` aplicada com sucesso no PostgreSQL local `cs_rio_postgres`
- validacoes executadas com sucesso: `build`, `lint` e `test` do server
- banco local confirmado com `47` índices `idx_*` novos aplicados

---

### ETAPA 6 — Caching no Servidor
**Impacto**: Redução de queries ao banco, menor latência nas respostas
**Complexidade**: Média
**Status**: `[x] Concluída em 17/03/2026`

#### Cache já implementado (funcional)

| Dado | Mecanismo | TTL | Arquivo |
|---|---|---|---|
| Player Profile | Redis `player:profile:{id}` | 30s | player-cache.ts |
| Cooldowns | Redis por player/action | Variável | CooldownSystem.ts |
| Drug Tolerance | Redis por player/drug | Variável | DrugToleranceSystem.ts |
| Hospitalization Status | Redis | Variável | OverdoseSystem.ts |
| Police Heat | Redis | Variável | PoliceHeatSystem.ts |
| Economy Config | In-memory static | Indefinido | economy-config.ts |
| Rate Limiting | Redis counters | 60s | http-hardening.ts |
| Action Idempotency | Redis SETNX | 30s | action-idempotency.ts |

#### Cache a implementar — Prioridade HIGH

| Dado | Frequência de acesso | Query atual | TTL sugerido | Impacto |
|---|---|---|---|---|
| **Active Round** | Toda request que usa GameConfig | `SELECT * FROM round WHERE status='active' ORDER BY started_at DESC LIMIT 1` | 60s | Elimina query repetitiva |
| **NPC Inflation Profile** | Toda interação com NPC (hospital, training, market, university) | Calcula a partir do round ativo | 120s | Elimina recomputação constante |
| **Game Config Catalog** | Toda request que usa configuração dinâmica | `SELECT * FROM game_config_sets/entries` com joins | 300s | Query pesada evitada |
| **Feature Flags** | Toda request que checa flags | `SELECT * FROM feature_flags` | 300s | Query evitada |
| **Faction Upgrades** | Toda operação de facção | `SELECT * FROM faction_upgrades WHERE faction_id = ?` | 60s (invalidar no upgrade) | Reduz N+1 queries |

#### Padrão de implementação recomendado

Usar o mesmo `keyValueStore` (Redis) já disponível em todos os serviços:

```typescript
// Exemplo para GameConfig
async getActiveRound(): Promise<RoundRecord | null> {
  const cacheKey = 'game:active-round';
  const cached = await this.keyValueStore.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const round = await this.queryActiveRound(); // query existente
  if (round) {
    await this.keyValueStore.set(cacheKey, JSON.stringify(round), 60);
  }

  return round;
}
```

#### Invalidação de cache

| Cache | Quando invalidar |
|---|---|
| Active Round | Quando round é criado/finalizado (evento raro) |
| NPC Inflation | Quando round muda |
| Game Config | Quando admin altera config via ops:config |
| Feature Flags | Quando admin altera flags |
| Faction Upgrades | Quando facção compra upgrade |

> **DECISÃO APROVADA**: executar o pacote completo de cache planejado, sem reduzir o escopo para uma versão conservadora.

#### Resultado da execução

- `GameConfigService` passou a cachear em Redis a rodada ativa (`60s`) e o catálogo resolvido completo (`300s`), cobrindo entries e feature flags no mesmo payload
- `DatabaseNpcInflationReader` passou a cachear o perfil de inflação NPC em Redis (`120s`)
- `FactionService` passou a cachear upgrades por facção em Redis (`60s`), com chave atrelada à rodada ativa para não reaproveitar estado entre rounds
- `ConfigOperationService` agora invalida explicitamente os caches de configuração ao persistir mutações operacionais
- `RoundService` agora invalida os caches dependentes de rodada ao abrir/encerrar rounds
- container e bootstrap do server foram ajustados para compartilhar `keyValueStore`, `GameConfigService` e `DatabaseNpcInflationReader` nas rotas e serviços principais
- validações executadas com sucesso: `build`, `lint`, `test` e subida curta do server em portas alternativas (`3101` e `3568`)
- suíte do server passou com `66` arquivos e `348` testes aprovados, incluindo cobertura nova para cache de config, inflação NPC, upgrades de facção e invalidação operacional

---

## RESUMO DE IMPACTO ESTIMADO

### Redução de tamanho do app

| Ação | Economia |
|---|---|
| Remover `assets/examples/` | **58 MB** |
| Remover assets não usados (tmj, tileset) | 0.25 MB |
| Ajustar `assetBundlePatterns` | Previne futuras inclusões acidentais |
| Remover `react-native-game-engine` | ~50 KB bundle JS |
| Remover deps transitivas não usadas | Menor install, sem impacto no bundle |
| Separar backend | Menor clone, menor CI, builds independentes |
| **Total estimado de redução** | **~58+ MB no bundle** |

### Melhoria de performance no app

| Ação | Impacto |
|---|---|
| Lazy loading de 23 telas | Startup ~40-60% mais rápido (menos JS para parsear) |
| Menos assets no bundle | Menor uso de memória |

### Melhoria de performance no servidor

| Ação | Impacto |
|---|---|
| 45 índices no banco | Queries 10-100x mais rápidas em tabelas com dados |
| Cache de config/round/inflation | ~5 queries a menos por request típica |
| Cache de faction upgrades | Elimina N+1 em operações de facção |

---

## ORDEM DE EXECUÇÃO RECOMENDADA

| Ordem | Etapa | Risco | Tempo estimado |
|---|---|---|---|
| 1 | **Etapa 2** — Remoção de assets | Muito baixo | Rápido |
| 2 | **Etapa 3** — Remoção de deps | Baixo | Rápido |
| 3 | **Etapa 5** — Índices no banco | Baixo | Médio |
| 4 | **Etapa 4** — Lazy loading | Médio | Médio |
| 5 | **Etapa 6** — Caching servidor | Médio | Médio |
| 6 | **Etapa 1** — Separação backend | Alto | Longo |

> A separação do backend é a mais impactante estruturalmente mas a mais arriscada. Recomendo executar por último, quando todas as outras otimizações já estiverem validadas no monorepo atual.

---

## CHECKLIST DE VALIDAÇÃO PÓS-IMPLEMENTAÇÃO

### Após Etapa 1 (Separação)
- [x] `cs_rio_api`: `npm install` sem erros
- [x] `cs_rio_api`: `npm run build` compila sem erros
- [x] `cs_rio_api`: `npm run test` todos os testes passam
- [x] `cs_rio_api`: `npm run dev` servidor inicia e responde em /api/health
- [x] `cs_rio`: `npm install` sem erros (sem o server)
- [x] `cs_rio`: `npx expo start` inicia normalmente
- [x] Ambos repos funcionam independentemente

### Após Etapa 2 (Assets)
- [ ] App compila sem erros
- [ ] MapScreen renderiza o mapa (rj.webp funciona)
- [ ] GameView renderiza sprites (player_base.png funciona)
- [ ] Sons funcionam (3 WAV files)
- [ ] Build do app é visivelmente menor

### Após Etapa 3 (Deps)
- [ ] `npm install` sem erros
- [ ] App inicia normalmente
- [ ] Dev client funciona
- [ ] Nenhum crash em runtime

### Após Etapa 4 (Lazy Loading)
- [ ] App abre e mostra HomeScreen sem delay adicional
- [ ] Navegação para cada tela funciona (pode ter ~100ms de loading no primeiro acesso)
- [ ] Voltar e renavegar é instantâneo (componente já está em memória)
- [ ] Login/Register/CharacterCreation funcionam normalmente (eager)

### Após Etapa 5 (Índices)
- [ ] Migration aplicada sem erros
- [ ] Queries de inventário são mais rápidas
- [ ] Queries de propriedades são mais rápidas
- [ ] Middleware de prisão não adiciona latência perceptível
- [ ] Nenhum deadlock ou lock contention

### Após Etapa 6 (Caching)
- [ ] Config é carregado do cache (verificar logs)
- [ ] Invalidação funciona (alterar config → cache atualiza)
- [ ] Sem stale data em operações críticas (round, upgrades)
- [ ] Latência média de resposta reduzida
