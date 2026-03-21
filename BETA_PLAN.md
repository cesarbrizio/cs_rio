# CS Rio — Plano de Reestruturacão Beta

> Ultima atualizacao: **2026-03-20**
> Sem retrocompatibilidade. Migrations existentes podem ser editadas. Banco pode ser recriado do zero.

---

## Premissas

- Todas as mudanças devem ser refletidas em **mobile**, **desktop**, **editor de mapa** e **cs_rio_api**.
- A nomenclatura canônica do jogo deve ser **unica** entre plataformas.
- Funcionalidades removidas devem ser eliminadas por completo: schema, migrations, services, routes, systems, screens, features, stores, navigation, types e referências em docs.
- Funcionalidades adicionadas ou corrigidas devem funcionar de forma identica em mobile e desktop.

---

## Legenda de Status

| Icone | Significado  |
| ----- | ------------ |
| `[ ]` | Pendente     |
| `[~]` | Em andamento |
| `[x]` | Concluido    |

---

## FASE 1 — Remoções (limpar o que não entra no Beta)

Objetivo: eliminar sistemas inteiros que foram descartados, reduzindo superficie de codigo e complexidade antes de qualquer outra alteração.

### 1.1 Remover Combate PvP `[x]`

**API (`cs_rio_api`)**

- `src/services/pvp.ts` — deletar
- `src/systems/CombatSystem.ts` — deletar
- `src/api/routes/pvp.ts` — deletar
- `src/db/schema.ts` — remover tabelas e enums relacionados a PvP (buscar `pvp`, `combat` no schema)
- `src/api/routes/index.ts` — remover registro da rota pvp
- `src/services/player.ts` — remover referências a PvP (calor por combate PvP, conceito por PvP)
- `src/systems/PoliceHeatSystem.ts` — remover deltas de calor por PvP
- `src/services/territory/combat.ts` — verificar se é PvP puro ou combate territorial (territorial permanece)
- `src/scripts/scenarios/pvp-ready.json` — deletar cenário de teste PvP
- `test/combat-system.test.ts` — deletar
- `test/pvp-route.test.ts` — deletar
- Migrations — editar migrations existentes para remover DDL de tabelas PvP

**Desktop (`apps/desktop`)**

- `src/screens/CombatScreen.tsx` — deletar
- `src/router/AppRouter.tsx` — remover rota `/combat` e import
- `src/config/navigation.ts` — remover item `Combate`
- `src/services/api.ts` — remover import/export de `pvpApi`
- `src/router/navigationIntents.ts` — remover intents de combate (ex: `preselectedTargetId`)

**Mobile (`apps/mobile`)**

- `src/screens/CombatScreen.tsx` — deletar
- `src/features/combat.ts` — deletar
- `src/navigation/RootNavigator.tsx` — remover screen `Combat` e tipo do param list
- `src/screens/home/useHomeHudController.ts` — remover item `combat` ("Cacar alvo")
- `test/combat.test.ts` — deletar

**Shared/Domain (`packages/`)**

- `packages/shared/src/types.ts` — remover tipos de PvP
- `packages/domain/src/api/endpoints.ts` — remover endpoints de PvP
- `packages/ui/src/hooks/combatHelpers.ts` — deletar

**Docs**

- `JOGO.md` — marcar seção 13 (Combate PvP) como removida do Beta
- `PRODUCT_STATUS.md` — atualizar status da seção 13

### 1.2 Remover Contratos PvP (Assassinato por Encomenda) `[x]`

**API (`cs_rio_api`)**

- `src/db/schema.ts` — remover `assassinationContracts`, `assassinationContractNotifications`, enums `assassinationStatusEnum`, `assassinationNotificationTypeEnum`
- `src/api/routes/` — verificar se existe rota de contratos (pode estar embutida em `pvp.ts` ou ter rota propria)
- Services relacionados a contratos de assassinato — deletar
- Migrations — editar para remover DDL de assassinação

**Desktop (`apps/desktop`)**

- `src/screens/ContractsScreen.tsx` — deletar
- `src/router/AppRouter.tsx` — remover rota `/contracts` e import
- `src/config/navigation.ts` — remover item `Contratos`

**Mobile (`apps/mobile`)**

- `src/screens/ContractsScreen.tsx` — deletar
- `src/features/contracts.ts` — deletar
- `src/navigation/RootNavigator.tsx` — remover screen `Contracts` e tipo do param list
- `src/screens/home/useHomeHudController.ts` — verificar se há item de contratos no HUD
- `test/contracts.test.ts` — deletar

**Shared/Domain**

- `packages/ui/src/hooks/contractsHelpers.ts` — deletar
- `packages/shared/src/types.ts` — remover tipos de contratos
- `packages/domain/src/api/endpoints.ts` — remover endpoints de contratos

### 1.3 Remover Sabotagem `[x]`

**API (`cs_rio_api`)**

- `src/db/schema.ts` — remover `propertySabotageLogs`, enums `propertySabotageStateEnum`, `propertySabotageOutcomeEnum`, `propertySabotageOwnerAlertModeEnum`
- `src/db/schema.ts` — remover campo `sabotageState` de `properties` (se existir)
- Services de sabotagem — deletar
- Migrations — editar para remover DDL de sabotagem
- Migration `0049_sabotage_backbone.sql` — deletar inteiramente

**Desktop (`apps/desktop`)**

- Verificar se sabotagem está embutida em `OperationsScreen.tsx` — remover seção/tab
- `src/config/navigation.ts` — verificar referência a "centro de sabotagem" na descrição de Operacoes e limpar

**Mobile (`apps/mobile`)**

- `src/screens/SabotageScreen.tsx` — deletar
- `src/features/sabotage.ts` — deletar
- `src/features/sabotage-storage.ts` — deletar
- `src/navigation/RootNavigator.tsx` — remover screen `Sabotage` e tipo do param list
- `src/screens/home/useHomeHudController.ts` — remover item `sabotage` ("Sabotar rival")
- `test/sabotage.test.ts` — deletar

**Domain**

- `packages/domain/src/features/sabotage-storage.ts` — deletar
- `packages/domain/src/notify/sabotageCues.ts` — deletar
- `packages/domain/src/notify/index.ts` — remover export de sabotageCues
- `packages/domain/src/notify/orchestrator.ts` — remover referências a sabotagem

### 1.4 Remover Treino `[x]`

**API (`cs_rio_api`)**

- `src/services/training.ts` — deletar
- `src/api/routes/training.ts` — deletar
- `src/db/schema.ts` — remover `trainingSessions`, enum `trainingTypeEnum`
- `src/api/routes/index.ts` — remover registro da rota training
- `test/training-route.test.ts` — deletar
- Migrations — editar para remover DDL de treino

**Desktop (`apps/desktop`)**

- `src/screens/TrainingScreen.tsx` — deletar
- `src/router/AppRouter.tsx` — remover rota `/training` e import
- `src/config/navigation.ts` — remover item `Treino`
- `src/services/api.ts` — remover import/export de `trainingApi`

**Mobile (`apps/mobile`)**

- `src/screens/TrainingScreen.tsx` — deletar
- `src/features/training.ts` — deletar
- `src/navigation/RootNavigator.tsx` — remover screen `Training` e tipo do param list
- `src/screens/home/useHomeHudController.ts` — remover item `training` ("Treinar")
- `test/training.test.ts` — deletar

**Shared/Domain**

- `packages/ui/src/hooks/trainingHelpers.ts` — deletar
- `packages/shared/src/types.ts` — remover tipos de treino
- `packages/shared/src/map/types.ts` — remover `'training'` de `MapEntityKind` e `'treino'` de `MapStructureKind`
- `packages/shared/src/map/structureCatalog.ts` — remover entrada `treino` e `detailPreset: 'training'` com seu bloco de placement
- `packages/shared/src/map/generated/svgs/treino.svg` — deletar
- `packages/shared/src/map/structureSvgCatalog.ts` — remover referência a treino
- `packages/domain/src/api/endpoints.ts` — remover endpoints de treino

**Editor (`apps/editor`)**

- O catálogo de estruturas (`StructureCatalog.tsx`) se atualiza automaticamente quando `treino` for removido do `MAP_STRUCTURE_CATALOG`
- Mapas existentes que contenham POIs de treino precisam ser re-exportados sem a estrutura `treino`
- `apps/mobile/assets/maps/zona_norte.json` — verificar se há instâncias de `treino` e remover

**Docs**

- `JOGO.md` — marcar seção 9.1 (Centro de Treino) como removida do Beta
- `PRODUCT_STATUS.md` — atualizar status da seção 9

### 1.5 Remover tipo `luxury` do enum `propertyTypeEnum` `[x]`

**API (`cs_rio_api`)**

- `src/db/schema.ts` — remover `'luxury'` do `propertyTypeEnum`
- Services — verificar `property.ts`, `player-ops.ts` e remover tratamento de `luxury`
- Migrations — editar para remover o valor do enum

**Desktop e Mobile**

- Verificar se há cards/filtros de "Luxo" como categoria em Operações — remover
- NÃO confundir com artigos de luxo individuais (jewelry, art, car, boat, etc.) que permanecem

---

## FASE 2 — Limpeza de referências cruzadas

Objetivo: após as remoções da Fase 1, compilar o projeto e resolver todas as referências quebradas.

### 2.1 Resolver imports e referências quebradas `[x]`

- Rodar `tsc --noEmit` em `cs_rio_api`, `apps/desktop`, `apps/mobile` e cada pacote em `packages/`
- Corrigir todos os erros de compilação causados pelas remoções
- Remover referências em:
  - `packages/shared/src/types.ts` — tipos removidos
  - `packages/shared/src/constants.ts` — constantes removidas
  - `packages/domain/src/api/endpoints.ts` — endpoints removidos
  - `packages/domain/src/stores/` — stores com referências a features removidas
  - `packages/domain/src/notify/orchestrator.ts` — remover orquestração de sabotagem
  - `packages/domain/src/notify/index.ts` — limpar exports
  - `packages/domain/src/features/index.ts` — limpar exports de storages removidos
  - `packages/ui/src/hooks/index.ts` — limpar exports de helpers removidos
  - `packages/game-engine/src/` — sistemas removidos
  - `cs_rio_api/src/container.ts` — remover injeção de dependências de services/systems deletados
  - `cs_rio_api/src/services/player.ts` — remover referências a PvP e treino
  - `cs_rio_api/src/services/player-ops.ts` — remover referências a features deletadas
  - `cs_rio_api/src/rooms/GameRoom.ts` — remover handlers de PvP/combate
  - `cs_rio_api/src/rooms/FactionRoom.ts` — remover referências a features deletadas

### 2.2 Consolidar migrations `[x]`

Como não há retrocompatibilidade, consolidar todas as migrations em um unico arquivo `0000_initial.sql` que represente o schema final limpo (sem PvP, contratos, sabotagem, treino, luxury).

- Gerar nova migration a partir do schema.ts limpo
- Deletar todas as 51 migrations individuais
- Substituir por uma unica migration inicial
- Atualizar `drizzle.config.ts` se necessário
- Testar `drizzle-kit push` / `drizzle-kit generate` para validar

---

## FASE 3 — Correções de Territorios

Objetivo: garantir consistência lógica nas ações territoriais.

### 3.1 Logica de visibilidade dos botões de território `[x]`

Regras:

- **Favela dominada pela facção do jogador**: mostrar `Negociar arrego`, `Serviços`, `Baile`. Esconder `Conquistar`, `Declarar Guerra`.
- **Favela dominada por outra facção**: mostrar `Conquistar` (se neutra) ou `Declarar Guerra`. Esconder `Negociar arrego`, `Serviços`, `Baile`.
- **Favela neutra**: mostrar `Conquistar`. Esconder `Declarar Guerra`, `Negociar arrego`, `Serviços`, `Baile`.

**API (`cs_rio_api`)**

- `src/services/territory.ts` ou `src/services/territory/` — verificar se o backend já retorna `controlState` e `factionId` da favela para o frontend usar na lógica de visibilidade
- Garantir que o endpoint de detalhes da favela retorne informação suficiente para o frontend decidir

**Mobile (`apps/mobile`)**

- `src/screens/TerritoryScreen.tsx` — implementar lógica condicional de visibilidade dos botões baseada em `controlState` + `factionId` do jogador

**Desktop (`apps/desktop`)**

- `src/screens/TerritoryScreen.tsx` — mesma lógica condicional

### 3.2 Auditar ações adicionais de território `[x]`

- Verificar se há outras ações (upgrade de serviço, reparo, X9 desenrolo) que só fazem sentido quando a facção do jogador domina
- Aplicar a mesma lógica de visibilidade condicional
- Garantir paridade mobile ↔ desktop

---

## FASE 4 — Operações: categorização, regras econômicas e vinculação ao mapa

Objetivo: reestruturar o sistema de Operações para refletir as três categorias de ativos com regras econômicas corretas.

### 4.1 Categorização de ativos `[x]`

Definir três categorias claras no backend e frontend:

| Categoria          | Tipos                                                         | Renda | Despesa          |
| ------------------ | ------------------------------------------------------------- | ----- | ---------------- |
| **Negócio**        | boca, factory, puteiro, rave, front_store, slot_machine       | Sim   | Sim              |
| **Imóvel**         | house, beach_house, mansion                                   | Não   | Sim (manutenção) |
| **Artigo de luxo** | car, boat, yacht, jet_ski, airplane, helicopter, jewelry, art | Não   | Não              |

**API (`cs_rio_api`)**

- `src/db/schema.ts` — adicionar campo `category` (`business`, `realty`, `luxury_item`) ao `properties` ou criar mapeamento no código
- `src/services/property.ts` — garantir que imóveis não gerem renda, que artigos de luxo não gerem renda nem despesa
- `src/services/financial-updates.ts` — verificar cálculos de renda/despesa por tipo de propriedade
- Verificar `src/services/player-ops.ts` para garantir as regras

### 4.2 Exibir informações econômicas no card da operação `[x]`

No card de compra/gerenciamento de cada ativo, exibir:

- Tipo do ativo (negócio / imóvel / artigo de luxo)
- Renda estimada por dia (se aplicável)
- Despesa estimada por dia (se aplicável)
- Estoque disponível / quantidade restante
- Tag **"Fundos insuficientes"** quando `player.money < preço`

**API**

- Endpoints de operações devem retornar: `dailyIncome`, `dailyExpense`, `category`, `stockAvailable`

**Mobile e Desktop**

- Ambas as telas de Operações devem exibir esses dados de forma identica

### 4.3 Vinculação de imóveis e negócios ao mapa `[x]`

Regra: imóveis e negócios só podem ser adquiridos se houver um POI correspondente no mapa. A quantidade disponível é definida pelo mapa.

**Catálogo de estruturas (`packages/shared/src/map/`)**

O catálogo atual (`structureCatalog.ts`) define estruturas visuais do mapa: `boca`, `baile`, `rave`, `factory`, `hospital`, `prison`, `mercado-negro`, `treino`, `universidade`, `docas`, `desmanche`, casas e prédios.
Os types (`types.ts`) definem `MapStructureKind` e `MapEntityKind`.

Atualmente, essas estruturas são **apenas visuais** — não representam slots compráveis. É preciso estender o sistema para que algumas estruturas do mapa funcionem como **slots de propriedade** que jogadores podem adquirir.

- `packages/shared/src/map/types.ts`:
  - Adicionar tipo `MapPropertySlot` com campos: `structureId`, `propertyType` (boca, factory, puteiro, rave, front_store, slot_machine, house, beach_house, mansion), `favelaId` ou `regionId`, `gridPosition`, `status` (free/occupied), `ownerId?`
  - Remover `'training'` do `MapEntityKind` (treino removido)
  - Remover `'treino'` do `MapStructureKind` (treino removido)
  - Adicionar novos kinds para propriedades compráveis: `'puteiro'`, `'front-store'`, `'slot-machine'`, `'casa'` (se não coberto pelos existentes)

- `packages/shared/src/map/structureCatalog.ts`:
  - Remover entrada `treino` do catálogo
  - Remover `detailPreset: 'training'` e o bloco de placement correspondente
  - Adicionar novas entradas para: `puteiro`, `front-store`, `slot-machine` com categorias, paletas e placements
  - Adicionar campo `purchasable: boolean` às definições de estrutura (ou criar lista separada de kinds compráveis)

**Editor de mapa (`apps/editor`)**

O editor já permite colocar estruturas no mapa (PlaceTool + StructureCatalog + PropertyPanel). Precisa ser estendido:

- `src/panels/StructureCatalog.tsx` — o catálogo de estruturas já lista todas de `MAP_STRUCTURE_CATALOG`; ao remover `treino` e adicionar novas, ele se atualiza automaticamente
- `src/panels/PropertyPanel.tsx` — adicionar campos de edição para slots compráveis:
  - Campo `propertyType` (tipo de negócio/imóvel aceito neste slot)
  - `slotId` nao deve ser editável no editor; o ID unico do slot deve ser gerado automaticamente no export/seed
  - Campo `favelaId` (a qual favela pertence este slot)
  - Campo `maxUnits` (quantos negócios deste tipo cabem neste POI — padrão 1)
- `src/objects/objectLayerEditing.ts` — incluir metadados de slot no objeto salvo
- `src/state/editorStore.ts` — persistir metadados de slot no documento exportado
- `src/io/editorDocumentSnapshot.ts` — incluir slots no snapshot de exportação

**Geração de SVGs**

- `packages/shared/src/map/generated/svgs/treino.svg` — deletar
- Adicionar SVGs para novos tipos de estrutura (puteiro, front-store, slot-machine)
- `packages/shared/src/map/structureSvgCatalog.ts` — atualizar catálogo de SVGs

**API (`cs_rio_api`)**

- `src/db/schema.ts` — criar tabela `propertySlots` com: `id`, `mapRegion`, `favelaId`, `propertyType`, `gridX`, `gridY`, `structureId`, `ownerId` (nullable), `roundId`
- `src/db/seed.ts` — popular slots a partir dos dados exportados do editor de mapa
- `src/services/property.ts` — validar na compra: se não há slot livre para aquele tipo naquela localização, bloquear a compra
- Quando o jogador compra, vincular `ownerId` no slot
- Quando vende, setar `ownerId = null`
- Endpoint novo ou ampliado para listar slots disponíveis por região/favela

**Mobile e Desktop**

- No mapa, POIs de negócios/imóveis devem mostrar estado (livre / ocupado por jogador X)
- Compra deve partir do POI no mapa ou da tela de Operações (ambos os fluxos válidos)
- `apps/mobile/src/screens/home/useHomeMapScene.ts` — renderizar slots com indicação visual de disponibilidade
- `apps/desktop/src/renderer/` — renderizar slots no canvas desktop
- `apps/mobile/src/data/` — remover referências a treino em dados de mapa

### 4.4 Estoque de artigos de luxo `[x]`

Artigos de luxo NÃO são POIs no mapa, mas têm estoque limitado no banco.

**API**

- Criar tabela ou campo `luxury_stock` com: `type`, `available_quantity`, `round_id`
- Na compra: decrementar estoque. Se estoque = 0, bloquear compra
- Jogadores podem vender/comprar entre si via Mercado Negro (P2P)
- Seed inicial deve definir estoque por tipo e por rodada

### 4.5 Paridade de funcionalidades de Operações mobile ↔ desktop `[x]`

**Funcionalidades que existem no mobile mas não no desktop:**

- Contratação de seguranças para maquininha
- Contratação de GPs para puteiro
- Gestão detalhada de operações (coleta, configuração)

**Funcionalidades que existem no desktop mas não no mobile:**

- Aquisição de boca de fumo, rave, loja de fachada, fábrica de drogas
- Exibição de imóveis e artigos de luxo

**Ação:** unificar para que TODAS as funcionalidades estejam disponíveis em AMBAS as plataformas com interface e dados idênticos.

---

## FASE 5 — Inventário: paridade mobile ↔ desktop

### 5.1 Garantir inventário no mobile `[x]`

O inventário já existe no mobile (`InventoryScreen.tsx`) e no desktop. Verificar:

- Mesmas ações disponíveis: equipar, desequipar, reparar, consumir
- Mesma estrutura de dados
- Card expandível com ações inline (conforme AGENTS.md)
- Labels e descrições idênticas entre plataformas

---

## FASE 6 — Ranking: paridade mobile ↔ desktop

### 6.1 Adicionar ranking no mobile `[x]`

O desktop tem `RankingScreen.tsx`. O mobile não tem.

**Mobile (`apps/mobile`)**

- Criar `src/screens/RankingScreen.tsx` com mesma funcionalidade do desktop
- `src/navigation/RootNavigator.tsx` — adicionar screen `Ranking`
- `src/screens/home/useHomeHudController.ts` — adicionar item no HUD
- Usar mesmos endpoints que o desktop já usa

---

## FASE 7 — Mapa: experiência visual no desktop

### 7.1 Melhorar mapa do desktop `[x]`

Atualmente o desktop mostra apenas lista de regiões para clicar. O mobile mostra mapa visual.

**Desktop (`apps/desktop`)**

- `src/screens/MapScreen.tsx` — implementar visualização de mapa similar ao mobile
- Usar os mesmos dados de mapa (`packages/shared/src/map/`)
- Renderizar POIs, favelas, regiões com visual isométrico ou equivalente
- Manter interatividade: clicar em favela abre detalhes, clicar em POI abre ação

**Shared**

- `packages/shared/src/map/` — verificar se os dados de mapa são suficientes para renderizar em ambas as plataformas
- Extrair lógica de mapa reutilizável se necessário

---

## FASE 8 — Eventos e Notificações: filtragem por relevância

### 8.1 Filtrar notificações por relevância no backend `[x]`

Regra: o jogador só recebe notificação de eventos que o afetaram diretamente.

**Critérios de relevância:**

- Evento ocorreu em favela que o jogador/facção do jogador domina
- Evento afetou uma propriedade do jogador
- Evento envolveu a facção do jogador (guerra, conquista, perda)
- Resultado de operação do próprio jogador
- Resultado de tribunal que o jogador julgou ou que afetou favela dele

**Critérios de NÃO-relevância (não notificar):**

- Guerra em território sem participação do jogador/facção
- Conquista/perda de território de facção alheia
- Operações de outros jogadores sem impacto no jogador
- Eventos em favelas que o jogador não tem participação

**API (`cs_rio_api`)**

- `src/services/game-event.ts` — adicionar lógica de filtragem por relevância ao criar/despachar eventos
- `src/services/event-scheduler.ts` — garantir que o dispatcher respeita relevância
- `src/api/routes/events.ts` — endpoint de listagem deve filtrar por jogador
- Realtime (`src/realtime.ts`, `src/rooms/`) — emitir eventos apenas para jogadores relevantes

**Mobile e Desktop**

- `src/features/events.ts` / `src/screens/EventsScreen.tsx` — garantir que o frontend exibe apenas eventos recebidos (backend já filtra)
- `src/features/notifications.ts` — idem

### 8.2 Garantir notificação de TODOS os eventos relevantes `[x]`

Checklist de eventos que DEVEM ser notificados ao jogador afetado:

- [x] Guerra declarada/em andamento/concluída na sua facção
- [x] Conquista ou perda de território da sua facção
- [x] Resultado de operação própria (crime, roubo e demais ações síncronas seguem com retorno imediato ao executor; resultados assíncronos próprios entram apenas quando o backend os devolver no feed filtrado)
- [x] X9 em favela que ele domina
- [x] Faca na Caveira em favela que ele domina
- [x] Tribunal em favela que ele domina (caso pendente e resultado)
- [x] Sabotagem em propriedade dele (fora do beta atual desde a Fase 1; o checklist fica preservado como referência para futuros sistemas equivalentes)
- [x] Mudanças na facção (promoção, expulsão, eleição)
- [x] Prisão e hospitalização próprias

---

## FASE 9 — UI/UX: remoção de jargão técnico e profissionalização

### 9.1 Desktop: eliminar textos técnicos `[x]`

Arquivos identificados com problemas:

| Arquivo                                                          | Problema                                           | Correção                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/desktop/src/screens/shared/DesktopScreenPrimitives.tsx:49` | `eyebrow = 'Desktop jogavel'`                      | Remover eyebrow ou substituir por nome do jogo/seção                             |
| `apps/desktop/src/screens/TrainingScreen.tsx:155`                | `"Treinos assincronos reais do backend..."`        | Deletar (tela removida na Fase 1)                                                |
| `apps/desktop/src/screens/MarketScreen.tsx:100`                  | `"Mercado real do backend com livro de ordens..."` | Substituir por descrição do jogador: ex. `"Compre, venda e leiloe equipamento."` |
| `apps/desktop/src/layouts/GameLayout.tsx:87`                     | `<span className="eyebrow">Desktop jogavel</span>` | Remover ou substituir                                                            |
| `apps/desktop/src/config/navigation.ts`                          | Descriptions técnicas em vários itens              | Reescrever todas as descriptions com linguagem de jogador                        |

**Ação:** varrer TODOS os arquivos do desktop com `grep` por termos como "backend", "renderer", "shell", "realtime", "telemetria", "assincrono" e substituir por linguagem de jogador.

### 9.2 Mobile: auditar textos técnicos `[x]`

- Verificar `src/screens/home/useHomeHudController.ts` — descriptions dos itens do HUD
- Varrer com grep por termos técnicos em todo `apps/mobile/src/`
- Substituir por linguagem imersiva e de jogador

### 9.3 Padronizar visual entre plataformas `[x]`

- Garantir que ambas as plataformas tenham visual coerente (dark theme, cores, tipografia)
- Cards, modais e feedback visual devem seguir o mesmo padrão de design

---

## FASE 10 — Equivalência Canônica Mobile ↔ Desktop

Objetivo: garantir que labels, funcionalidades e fluxos sejam idênticos entre plataformas.

### 10.1 Levantamento de discrepâncias de nomenclatura `[x]`

| Funcionalidade | Mobile (atual)       | Desktop (atual) | Canônico (Beta)                     |
| -------------- | -------------------- | --------------- | ----------------------------------- |
| Crimes         | `Fazer corre`        | `Crimes`        | **Fazer corre**                     |
| Combate        | `Caçar alvo`         | `Combate`       | **REMOVIDO**                        |
| Contratos      | (verificar)          | `Contratos`     | **REMOVIDO**                        |
| Mercado        | `Negociar`           | `Mercado`       | **Negociar**                        |
| Treino         | `Treinar`            | `Treino`        | **REMOVIDO**                        |
| Inventário     | `Equipar`            | `Inventario`    | **Equipar**                         |
| Operações      | `Gerir ativos`       | `Operacoes`     | **Gerir ativos**                    |
| Território     | `Dominar area`       | `Territorio`    | **Dominar area**                    |
| Facção         | `Falar com a faccao` | `Faccao`        | **Falar com a faccao**              |
| Tribunal       | `Julgar caso`        | `Tribunal`      | **Julgar caso**                     |
| Universidade   | `Estudar`            | `Universidade`  | **Estudar**                         |
| Hospital       | `Ir ao hospital`     | `Hospital`      | **Ir ao hospital**                  |
| Prisão         | (contexto)           | `Prisao`        | **Prisão** (verificar label mobile) |
| Bicho          | `Jogo do Bicho`      | `Bicho`         | **Jogo do Bicho**                   |
| Ranking        | NÃO EXISTE           | `Ranking`       | **Ranking** (adicionar no mobile)   |
| Mapa           | `Mapa`               | `Mapa`          | **Mapa**                            |
| Mensagens      | `Abrir contatos`     | `Mensagens`     | **Contatos**                        |
| Sabotagem      | `Sabotar rival`      | (verificar)     | **REMOVIDO**                        |
| Perfil         | `Ver perfil`         | `Perfil`        | **Ver perfil**                      |
| Eventos        | `Ver eventos`        | `Notificacoes`  | **Ver eventos**                     |
| Config         | `Ajustar jogo`       | `Config`        | **Ajustar jogo**                    |

### 10.2 Aplicar nomenclatura canônica no desktop `[x]`

- `apps/desktop/src/config/navigation.ts` — reescrever `label` de cada item conforme tabela acima
- `apps/desktop/src/config/navigation.ts` — reescrever `description` com linguagem de jogador
- Telas individuais do desktop — atualizar títulos e headers
- Router paths podem permanecer em inglês (não são visíveis ao jogador)

### 10.3 Verificar e ajustar nomenclatura no mobile `[x]`

- `apps/mobile/src/screens/home/useHomeHudController.ts` — confirmar labels conforme tabela
- Telas individuais — verificar headers e títulos

### 10.4 Funcionalidades presentes apenas em uma plataforma `[x]`

| Feature             | Mobile                     | Desktop                   | Ação                                            |
| ------------------- | -------------------------- | ------------------------- | ----------------------------------------------- |
| Ranking             | Não                        | Sim                       | Adicionar no mobile (Fase 6)                    |
| Mapa visual         | Sim                        | Não (só lista)            | Melhorar desktop (Fase 7)                       |
| Fábricas (tela)     | Sim (FactoriesScreen)      | Não (embutido em Ops?)    | Unificar fluxo                                  |
| DrugUse (tela)      | Sim (DrugUseScreen)        | Não                       | Adicionar no desktop                            |
| Vocation (tela)     | Sim (VocationScreen)       | Não                       | Adicionar no desktop                            |
| War (tela separada) | Não (embutido em Faction?) | Sim (WarScreen)           | Unificar: guerra dentro de Território ou Facção |
| Events (tela)       | Sim (EventsScreen)         | Não (NotificationsScreen) | Unificar como "Ver eventos"                     |
| Contacts (tela)     | Sim (ContactsScreen)       | Não (MessagesScreen)      | Unificar como "Contatos"                        |
| FeaturePlaceholder  | Não                        | Sim                       | Deletar do desktop                              |

### 10.5 Implementar telas faltantes `[x]`

**Desktop — adicionar:**

- `DrugUseScreen.tsx` — consumo de drogas (ou embutir em local existente como Hospital/Rave)
- `VocationScreen.tsx` — central de vocação
- `EventsScreen.tsx` — se não existir como tela própria

**Mobile — adicionar:**

- `RankingScreen.tsx` — ranking da rodada

**Desktop — deletar:**

- `FeaturePlaceholderScreen.tsx`

---

## FASE 11 — Atualização de Documentação

### 11.1 Atualizar JOGO.md `[x]`

- Marcar seções 13 (Combate PvP), 9.1 (Centro de Treino), 20 (Sabotagem) como removidas do Beta
- Manter como "planejado para futuro" se desejado, mas deixar claro que não está no Beta
- Remover menções a contratos de assassinato

### 11.2 Atualizar PRODUCT_STATUS.md `[x]`

- `13. Combate PvP` → `Removido do Beta`
- `9. Treinamento` → `Parcial` (Universidade permanece, Centro de Treino removido)
- `20. Sabotagem` → `Removido do Beta`
- Adicionar nota sobre remoção de contratos de assassinato

### 11.3 Atualizar TODO.md `[x]`

- Remover itens de backlog relacionados a features removidas
- Adicionar itens pendentes desta reestruturação

### 11.4 Atualizar AGENTS.md `[x]`

- Remover referências a treino em guardrails de UX
- Atualizar referências a sabotagem
- Ajustar nomenclatura canônica

---

## FASE 12 — Refactor Estrutural Pós-Beta

Objetivo: executar a dívida estrutural descoberta na revisão final do beta, reduzindo arquivos críticos que ainda violam os limites definidos em `cs_rio/AGENTS.md`, sem reabrir o escopo funcional.

Critério de aceite:

- services/server: alvo de até `800` linhas
- repositories/server: alvo de até `800` linhas
- telas mobile/web: alvo de até `700` linhas
- hooks/controllers: alvo de até `500` linhas
- shared/editor: quebrar arquivos críticos por subdomínio e responsabilidade

### 12.1 Backend: serviços econômicos restantes `[x]`

- Refatorar `cs_rio_api/src/services/boca.ts`
- Refatorar `cs_rio_api/src/services/rave.ts`
- Refatorar `cs_rio_api/src/services/slot-machine.ts`
- Refatorar `cs_rio_api/src/services/factory.ts`

Critério:

- separar erro, suporte/calculadoras, serialização e persistência
- remover regra de negócio, mutação e acesso a banco do mesmo arquivo
- manter testes direcionados por rota/serviço

### 12.2 Backend: território, eventos e tribunal `[x]`

- Refatorar `cs_rio_api/src/services/territory.ts`
- Refatorar `cs_rio_api/src/services/territory/repository.ts`
- Refatorar `cs_rio_api/src/services/game-event.ts`
- Refatorar `cs_rio_api/src/services/tribunal.ts`

Critério:

- extrair sync, cálculo, serialização e emissão para módulos menores
- reduzir acoplamento entre service principal e detalhes de persistência
- preservar contratos públicos das rotas

### 12.3 Backend: operações sistêmicas e infraestrutura de domínio `[x]`

- Refatorar `cs_rio_api/src/services/robbery.ts`
- Refatorar `cs_rio_api/src/services/world-ops.ts`
- Refatorar `cs_rio_api/src/services/round-ops.ts`
- Refatorar `cs_rio_api/src/services/faction/repository.ts`
- Revisar `cs_rio_api/src/services/config-validation.ts`
- Revisar `cs_rio_api/src/services/player-ops.ts`
- Revisar `cs_rio_api/src/services/config-operations.ts`
- Revisar `cs_rio_api/src/services/player.ts`

Critério:

- reduzir arquivos multi-motivo de mudança
- explicitar contratos entre domínio, orquestração e persistência
- evitar repositórios e services “god object”

Fechamento confirmado em `2026-03-20`:
- `world-ops.ts` virou orquestração fina e `world-ops-operations.ts` caiu para `164` linhas
- a responsabilidade foi separada em `world-ops-preview.ts`, `world-ops-faction.ts`, `world-ops-favela.ts`, `world-ops-property.ts` e `world-ops-market.ts`
- `npm run typecheck` em `cs_rio_api` passou
- `npx vitest run test/world-ops.test.ts test/round-ops.test.ts` passou

### 12.4 Shared, domínio e editor `[x]`

- Refatorar `cs_rio/packages/shared/src/types.ts`
- Refatorar `cs_rio/packages/shared/src/constants.ts`
- Refatorar `cs_rio/apps/editor/src/state/editorStore.ts`
- Refatorar `cs_rio/packages/domain/src/data/mapRegionVisuals.ts`
- Refatorar `cs_rio/packages/shared/src/map/structureCatalog.ts`

Critério:

- fatiar por subdomínio em vez de concentrar tudo em arquivos centrais
- reduzir acoplamento do editor com estruturas e serialização
- evitar que `shared` vire ponto único de crescimento linear

### 12.5 Mobile: telas e controllers acima do limite `[x]`

- Refatorar `cs_rio/apps/mobile/src/screens/FactionScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/OperationsScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/TerritoryScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/MarketScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/TribunalScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/BichoScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/HospitalScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/UniversityScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/FactoriesScreen.tsx`
- Refatorar `cs_rio/apps/mobile/src/screens/home/useHomeHudController.ts`

Critério:

- separar hooks, sections e componentes filhos
- remover lógica de negócio pesada de dentro de screen
- manter UX atual sem regressão visual/funcional

Resultado consolidado em `2026-03-20`:
- a fase foi concluida com fechamento dos hotspots-alvo listados nesta fase, sem afirmar encerramento estrutural total do mobile
- `FactionScreen.styles.ts` e `TerritoryScreen.styles.ts` viraram composicao de submodulos (`*.actionStyles.ts` + `*.contentStyles.ts`), removendo os monolitos de estilo
- `Operations` foi reestruturado em controller, mutacoes, selecao, suporte, styles e sections dedicadas:
  - `OperationsScreenContent.tsx` (`34`)
  - `useOperationsScreenController.ts` (`456`)
  - `useOperationsScreenMutations.ts` (`494`)
  - `useOperationsScreenSelections.ts` (`206`)
  - `OperationsScreenPropertyPanelSection.tsx` (`186`)
  - `OperationsScreenPuteiroSection.tsx` (`187`)
  - `OperationsScreenSlotMachineSection.tsx` (`188`)
- `useHomeHudControllerImpl.ts` caiu para `470` linhas com extracao de contratos, builders de detalhes, toasts, quick actions, panel props, runtime actions, interacoes e ciclo de vida
- os wrappers das telas-alvo da fase ficaram finos e a logica pesada foi deslocada para hooks/sections especializados sem regressao funcional aparente
- validacao desta fase:
  - `npm run typecheck --workspace apps/mobile`
  - `npm run typecheck` em `cs_rio`
  - `npm run test --workspace @cs-rio/mobile -- test/operations.test.ts test/territory.test.ts`

### 12.6 Fechamento estrutural `[x]`

- Reexecutar varredura de tamanho em `cs_rio` e `cs_rio_api`
- Rodar `typecheck` nos dois repositórios
- Rodar testes direcionados para os módulos refatorados
- Atualizar este plano marcando cada bloco técnico concluído

Resultado da varredura de fechamento em `2026-03-21` (source-only, excluindo `dist`, `build`, `node_modules` e `test`):
- `typecheck` passou em `cs_rio`
- `typecheck` passou em `cs_rio_api`
- `npm run test --workspace @cs-rio/mobile -- test/operations.test.ts test/territory.test.ts` passou com `10` testes verdes
- `npx vitest run test/world-ops.test.ts test/round-ops.test.ts test/territory-route.test.ts test/game-event-route.test.ts test/tribunal-route.test.ts` passou com `57` testes verdes
- rodada complementar desta fase em `2026-03-21` tambem validou:
  - `npm run typecheck --workspace apps/mobile` em `cs_rio`
  - `npm run typecheck` em `cs_rio`
  - `npm run typecheck` em `cs_rio_api`
  - `npx vitest run test/market-route.test.ts` em `cs_rio_api` com `3` testes verdes
- fechamento técnico desta fase em `2026-03-21`:
  - `cs_rio_api/src/systems/CrimeSystem.ts` caiu para `788`, com extração para `src/systems/CrimeSystem.types.ts` e `src/systems/CrimeSystem.support.ts`
  - `cs_rio_api/src/services/faction.ts` caiu para `796`, consolidando `src/services/faction-support.ts`
  - `cs_rio_api/src/services/faction-war.ts` caiu para `791`, com suporte consolidado em `src/services/faction-war-support.ts`
  - `npx vitest run test/crime-system.test.ts test/faction-route.test.ts test/territory-route.test.ts` em `cs_rio_api` passou com `51` testes verdes
- resultado final:
  - a varredura source-only desta fase nao encontrou mais arquivos acima da regua estrutural aplicada por categoria
  - `12.6` fica concluida
  - `FASE 12` fica concluida
  - o plano `BETA_PLAN.md` fica concluido

Observação:

- esta fase não reabre o escopo funcional do beta
- ela organiza e executa a dívida estrutural descoberta na revisão final
- a régua de aceite da `12.6` foi atendida com varredura final, typecheck e testes direcionados; melhorias futuras deixam de ser bloqueio do plano

---

## Ordem de Execução

A sequência abaixo é a ordem lógica de implementação. Cada fase depende da anterior.

```
FASE 1  → Remoções (PvP, Contratos, Sabotagem, Treino, luxury)
FASE 2  → Limpeza de referências e consolidação de migrations
FASE 3  → Correções de Territórios
FASE 4  → Operações (categorização, economia, mapa, estoque)
FASE 5  → Inventário (paridade)
FASE 6  → Ranking (paridade)
FASE 7  → Mapa (visual desktop)
FASE 8  → Eventos/Notificações (filtragem por relevância)
FASE 9  → UI/UX (remoção de jargão técnico)
FASE 10 → Equivalência canônica (nomenclatura, telas faltantes)
FASE 11 → Documentação
FASE 12 → Refactor estrutural pós-beta
```

**Fases 1-2** são pré-requisito absoluto — sem elas o código tem referências quebradas.
**Fases 3-8** são independentes entre si e podem ser paralelizadas.
**Fases 9-10** dependem das fases anteriores para saber o estado final das telas.
**Fase 11** fecha o beta funcional.
**Fase 12** é um plano complementar de manutenção estrutural, sem alterar o escopo do beta.

---

## Arquivos-chave por repositório

### cs_rio_api

| Arquivo                           | Descrição                             |
| --------------------------------- | ------------------------------------- |
| `src/db/schema.ts`                | Definição de todas as tabelas e enums |
| `src/db/migrations/`              | 51 migrations (serão consolidadas)    |
| `src/db/seed.ts`                  | Seed de dados iniciais                |
| `src/api/routes/index.ts`         | Registro de todas as rotas            |
| `src/api/routes/pvp.ts`           | Rota de PvP (deletar)                 |
| `src/api/routes/training.ts`      | Rota de treino (deletar)              |
| `src/services/pvp.ts`             | Service de PvP (deletar)              |
| `src/services/training.ts`        | Service de treino (deletar)           |
| `src/services/property.ts`        | Service de propriedades (refatorar)   |
| `src/services/territory.ts`       | Service de territórios (ajustar)      |
| `src/services/game-event.ts`      | Service de eventos (filtrar)          |
| `src/services/event-scheduler.ts` | Scheduler de eventos (filtrar)        |
| `src/systems/CombatSystem.ts`     | Sistema de combate (deletar)          |
| `src/realtime.ts`                 | Realtime/WebSocket (filtrar emissão)  |

### cs_rio (apps/desktop)

| Arquivo                                          | Descrição                      |
| ------------------------------------------------ | ------------------------------ |
| `src/config/navigation.ts`                       | Menu de navegação (reescrever) |
| `src/router/AppRouter.tsx`                       | Rotas do desktop (limpar)      |
| `src/screens/CombatScreen.tsx`                   | Tela de combate (deletar)      |
| `src/screens/ContractsScreen.tsx`                | Tela de contratos (deletar)    |
| `src/screens/TrainingScreen.tsx`                 | Tela de treino (deletar)       |
| `src/screens/FeaturePlaceholderScreen.tsx`       | Placeholder (deletar)          |
| `src/screens/MapScreen.tsx`                      | Mapa (melhorar)                |
| `src/screens/OperationsScreen.tsx`               | Operações (refatorar)          |
| `src/screens/TerritoryScreen.tsx`                | Território (ajustar botões)    |
| `src/screens/MarketScreen.tsx`                   | Mercado (limpar textos)        |
| `src/screens/shared/DesktopScreenPrimitives.tsx` | Primitivos UI (limpar eyebrow) |
| `src/layouts/GameLayout.tsx`                     | Layout (limpar eyebrow)        |

### cs_rio (apps/mobile)

| Arquivo                                    | Descrição                              |
| ------------------------------------------ | -------------------------------------- |
| `src/navigation/RootNavigator.tsx`         | Navegação (limpar screens removidas)   |
| `src/screens/home/useHomeHudController.ts` | HUD principal (limpar items removidos) |
| `src/screens/CombatScreen.tsx`             | Tela de combate (deletar)              |
| `src/screens/ContractsScreen.tsx`          | Tela de contratos (deletar)            |
| `src/screens/SabotageScreen.tsx`           | Tela de sabotagem (deletar)            |
| `src/screens/TrainingScreen.tsx`           | Tela de treino (deletar)               |
| `src/screens/TerritoryScreen.tsx`          | Território (ajustar botões)            |
| `src/screens/OperationsScreen.tsx`         | Operações (refatorar)                  |
| `src/features/combat.ts`                   | Feature de combate (deletar)           |
| `src/features/contracts.ts`                | Feature de contratos (deletar)         |
| `src/features/sabotage.ts`                 | Feature de sabotagem (deletar)         |
| `src/features/sabotage-storage.ts`         | Storage de sabotagem (deletar)         |
| `src/features/training.ts`                 | Feature de treino (deletar)            |

### cs_rio (packages/)

| Arquivo                                             | Descrição                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/shared/src/types.ts`                      | Tipos compartilhados (limpar)                                         |
| `packages/shared/src/constants.ts`                  | Constantes (limpar)                                                   |
| `packages/shared/src/map/types.ts`                  | Tipos de mapa — remover `training`/`treino`, adicionar property slots |
| `packages/shared/src/map/structureCatalog.ts`       | Catálogo de estruturas — remover `treino`, adicionar compráveis       |
| `packages/shared/src/map/structureSvgCatalog.ts`    | Catálogo SVG — remover treino, adicionar novos                        |
| `packages/shared/src/map/generated/svgs/treino.svg` | SVG de treino (deletar)                                               |
| `packages/domain/src/api/endpoints.ts`              | Endpoints da API (limpar)                                             |
| `packages/domain/src/features/sabotage-storage.ts`  | Storage (deletar)                                                     |
| `packages/domain/src/notify/sabotageCues.ts`        | Notificações de sabotagem (deletar)                                   |
| `packages/domain/src/notify/orchestrator.ts`        | Orquestrador de notificações (limpar)                                 |
| `packages/domain/src/stores/`                       | Stores (limpar referências)                                           |
| `packages/ui/src/hooks/combatHelpers.ts`            | Helpers de combate (deletar)                                          |
| `packages/ui/src/hooks/contractsHelpers.ts`         | Helpers de contratos (deletar)                                        |
| `packages/ui/src/hooks/trainingHelpers.ts`          | Helpers de treino (deletar)                                           |

### cs_rio (apps/editor)

| Arquivo                              | Descrição                                                            |
| ------------------------------------ | -------------------------------------------------------------------- |
| `src/panels/PropertyPanel.tsx`       | Painel de propriedades — adicionar campos de slot comprável          |
| `src/panels/StructureCatalog.tsx`    | Catálogo visual — reflete automaticamente mudanças no shared catalog |
| `src/state/editorStore.ts`           | Store principal — persistir metadados de slot                        |
| `src/objects/objectLayerEditing.ts`  | Edição de objetos — incluir metadados de slot                        |
| `src/io/editorDocumentSnapshot.ts`   | Exportação — incluir slots no snapshot                               |
| `src/structures/structureEditing.ts` | Edição de estruturas — suportar novos campos                         |
