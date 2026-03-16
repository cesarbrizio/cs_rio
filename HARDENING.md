# HARDENING.md — Plano Técnico de Hardening

**Versão:** `1.18.1`  
**Data:** `2026-03-16`  
**Status:** `Concluído`  
**Escopo:** backend, mobile, observabilidade, validação HTTP, transações, cache, modularização e robustez operacional.

## Contexto

Este documento consolida o plano de ação para corrigir os problemas técnicos levantados na revisão de hardening do `cs_rio`.

As contagens de arquivos, testes e suites registradas aqui são **snapshots históricos de validação por etapa**.
Para validação operacional atual de deploy, smoke, rollback e critérios de liberação, a fonte de verdade é [ROLL_OUT.md](./ROLL_OUT.md).
O fato de este plano constar como `Concluído` significa fechamento do pacote histórico de hardening, e **não ausência de backlog residual**; achados posteriores devem ser rastreados em `TODO.md` e `PRODUCT_STATUS.md`.

Os riscos principais identificados foram:

- ausência de validação HTTP consistente
- tratamento de erro genérico e sem logging suficiente
- falta de atomicidade em operações financeiras
- secrets inseguros com fallback previsível
- cache sem invalidação adequada
- CORS excessivamente permissivo
- serviços monolíticos grandes demais
- race conditions na game logic
- duplicação de validações e fluxos
- componentes/clientes ainda grandes e frágeis

## Objetivo

Levar o projeto para um estado mais seguro, depurável e sustentável, sem perder a capacidade de iteração rápida da Pré-Alpha.

## Ordem de execução

As etapas abaixo devem ser executadas nesta ordem.  
Cada etapa tem foco, ações concretas e critério de aceite.

## Baseline Congelada — Etapa 1 concluída

**Status da etapa 1:** `Concluída em 2026-03-14`

### Baseline histórica da esteira

Baseline medida no monorepo no momento de abertura do hardening:

- `npm run typecheck`: **verde**
  - turbo: `6 tasks successful`
- `npm run lint`: **verde**
  - turbo: `4 tasks successful`
- `npm run test`: **verde**
  - `@cs-rio/shared`: `1 arquivo / 8 testes`
  - `@cs-rio/server`: `44 arquivos / 213 testes`
  - `@cs-rio/mobile`: `29 arquivos / 80 testes`
- `npm run build`: **verde**
  - turbo: `4 tasks successful`

### Rotas HTTP críticas priorizadas

Os grupos mais sensíveis para o hardening imediato são:

- `auth`
- `players`
- `market`
- `factions`
- `territory`
- `hospital`
- `prison`
- `inventory`
- `bank`
- `pvp`
- `round`
- `events`

Hotspots mais relevantes da camada HTTP, por tamanho:

- `apps/server/src/api/routes/factions.ts` — `481` linhas
- `apps/server/src/api/routes/territory.ts` — `343` linhas
- `apps/server/src/api/routes/inventory.ts` — `205` linhas
- `apps/server/src/api/routes/pvp.ts` — `163` linhas
- `apps/server/src/api/routes/market.ts` — `152` linhas
- `apps/server/src/api/routes/hospital.ts` — `131` linhas

### Serviços sensíveis priorizados

Hotspots principais do backend, por tamanho e risco operacional:

- `apps/server/src/services/territory.ts` — `7036` linhas
- `apps/server/src/services/faction.ts` — `3609` linhas
- `apps/server/src/services/market.ts` — `2079` linhas
- `apps/server/src/services/game-event.ts` — `2081` linhas
- `apps/server/src/services/pvp.ts` — `1966` linhas
- `apps/server/src/services/world-ops.ts` — `1903` linhas
- `apps/server/src/services/robbery.ts` — `1899` linhas
- `apps/server/src/services/tribunal.ts` — `1784` linhas
- `apps/server/src/services/player.ts` — `1719` linhas
- `apps/server/src/services/round-ops.ts` — `1695` linhas

Serviços diretamente ligados aos riscos de dinheiro, cache, autorização e race condition:

- `bank.ts`
- `market.ts`
- `player.ts`
- `faction.ts`
- `territory.ts`
- `hospital.ts`
- `prison.ts`
- `auth.ts`
- `round.ts`
- `game-event.ts`

### Escopo prioritário de correção

O hardening deve atacar primeiro estes fluxos:

1. autenticação e refresh de token
2. leitura de perfil e membership de facção
3. mercado, banco e saldo do jogador
4. treasury e ledger de facção
5. guerra, propina, território e serviços territoriais
6. hospital e prisão
7. PvP, crimes e roubos
8. eventos e scheduler

### Checklist operacional de regressão

Este checklist deve ser executado a cada bloco sensível do hardening:

#### Esteira

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

#### Backend — smoke crítico

- registrar + login + refresh
- criar personagem
- ler perfil (`players/me`)
- abrir banco
- abrir mercado
- comprar / vender / cancelar ordem
- abrir território
- abrir hospital
- abrir prisão
- executar crime
- executar roubo
- abrir facção e banco de facção

#### Mobile — smoke crítico

- login
- criação de personagem
- abrir `Home`
- abrir `Crimes`
- abrir `Mercado Negro`
- abrir `Território`
- abrir `QG da Facção`
- abrir `Hospital`
- abrir `Prisão`
- abrir macro mapa

#### Observabilidade mínima a preservar

- erros não podem sumir em silêncio
- respostas de erro devem continuar legíveis para o app
- logs do server devem permanecer úteis para depuração local

---

## 1. Congelar baseline técnica e abrir trilha de hardening

**Objetivo:** criar uma linha de base confiável antes de mexer nos pontos críticos.

**Status:** `Concluída`

**Ações:**
- registrar o estado atual das suites, builds, rotas críticas e serviços sensíveis
- listar endpoints financeiros, territoriais, auth e realtime como escopo prioritário
- abrir checklist operacional para acompanhar regressões do hardening

**Critério de aceite:**
- baseline documentada e priorização explícita dos fluxos críticos

## 2. Impedir boot inseguro por secrets ausentes

**Objetivo:** evitar que o servidor rode com segredo previsível.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- remover fallback hardcoded de `JWT_SECRET` e `JWT_REFRESH_SECRET`
- falhar no startup se secrets obrigatórios não existirem
- padronizar mensagem de erro de configuração inválida no boot

**Critério de aceite:**
- servidor não sobe sem secrets válidos

**Implementação concluída:**
- `apps/server/src/config/env.ts` agora valida `JWT_SECRET` e `JWT_REFRESH_SECRET`
- placeholders legados (`change-me`, `change-me-too`) foram bloqueados
- secrets agora precisam:
  - existir
  - ter ao menos `32` caracteres
  - ser diferentes entre si
- o boot do server falha cedo com `InvalidEnvironmentError`
- `AuthService` também valida secrets no construtor, evitando uso inseguro fora do boot
- a suíte de testes recebeu secrets explícitos via `test/setup-env.ts`

## 3. Restringir CORS por ambiente

**Objetivo:** parar de aceitar qualquer origem em produção.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- trocar `origin: true` por allowlist via env
- separar política de `dev`, `staging` e `prod`
- documentar exemplos de configuração local e produtiva

**Critério de aceite:**
- produção aceita apenas origens explicitamente aprovadas

**Implementação concluída:**
- `apps/server/src/config/cors.ts` centraliza a política de CORS
- `development` e `test` aceitam:
  - `localhost`
  - `127.0.0.1`
  - `10.0.2.2`
  - IPs de LAN privada (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`)
- `staging` e `production` exigem `CORS_ALLOWED_ORIGINS`
- o allowlist explícito é separado por vírgula e deduplicado
- requests sem header `Origin` continuam aceitos para não quebrar cliente nativo e integrações servidor-a-servidor
- `README.md` recebeu exemplos de configuração por ambiente

## 4. Adicionar correlation ID e contexto por request

**Objetivo:** tornar requests rastreáveis de ponta a ponta.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- criar middleware Fastify que anexa `requestId`
- incluir `route`, `method`, `playerId`, `regionId` e IP quando disponíveis
- propagar esse contexto para logs de erro e logs operacionais

**Critério de aceite:**
- toda requisição relevante gera contexto rastreável em log

**Implementação concluída:**
- `apps/server/src/observability/request-context.ts` criou contexto por requisição com `AsyncLocalStorage`
- o `Fastify` agora:
  - aceita `x-request-id`
  - devolve `x-request-id` na resposta
  - liga `requestId`, `route`, `method`, `path`, `ip`, `playerId` e `regionId` ao contexto da requisição
- `apps/server/src/api/middleware/auth.ts` atualiza o contexto assim que o `playerId` é autenticado
- `request.contextLog` agora nasce como logger filho já enriquecido com os bindings da requisição
- a cobertura entrou em:
  - `apps/server/test/app.test.ts`
  - `apps/server/test/request-context.test.ts`

## 5. Centralizar error handling HTTP

**Objetivo:** parar de espalhar `500` genérico sem contexto.

**Ações:**
- criar error handler global do Fastify
- padronizar shape de erro para cliente
- classificar erro de domínio, validação, auth, infra e erro interno

**Critério de aceite:**
- rotas não precisam mais repetir `reply.code(500).send(...)`

**Status:** `Concluída em 2026-03-14`

**Entrega realizada:**
- handler global em `apps/server/src/api/http-errors.ts`
- payload HTTP padronizado com `message`, `category` e `requestId`
- mapeamento centralizado das classes de erro do domínio
- fallback interno único para erro não mapeado
- logs estruturados via `request.contextLog` ou `request.log`
- rotas migradas para relançar erro normalizado em vez de responder `500` localmente
- cobertura adicional em `apps/server/test/http-errors.test.ts`

## 6. Parar de engolir erros silenciosamente

**Objetivo:** restaurar visibilidade operacional dos problemas reais.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- substituir listeners silenciosos por logging estruturado
- adicionar logging explícito para Redis, realtime e integrações críticas
- padronizar severidade (`info`, `warn`, `error`, `fatal`)

**Critério de aceite:**
- erros de Redis, realtime e infra não são mais descartados

**Entrega realizada:**
- logger compartilhado de infraestrutura em `apps/server/src/observability/logger.ts`
- handlers fatais de processo em `apps/server/src/observability/process-errors.ts`
- `RedisKeyValueStore` agora registra `ready`, `reconnecting`, `end` e `error`
- room realtime agora registra exceções não tratadas via `onUncaughtException`
- `createRealtimeServer()` agora loga erro do transport HTTP/WebSocket e o carregamento das room definitions
- cobertura adicional em:
  - `apps/server/test/redis-kv-store.test.ts`
  - `apps/server/test/realtime-logging.test.ts`
  - `apps/server/test/process-errors.test.ts`

## 7. Definir contrato HTTP com schema em todas as rotas

**Objetivo:** criar camada HTTP segura e tipada.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- adotar schema Fastify para `params`, `query`, `body` e `response`
- garantir inferência de tipos a partir do schema
- definir padrão compartilhado para rotas simples e mutações críticas

**Critério de aceite:**
- novas rotas e rotas críticas antigas têm schema formal

**Entrega realizada:**
- módulo compartilhado de schema em `apps/server/src/api/schemas.ts`
- schemas formais aplicados nas rotas críticas:
  - `apps/server/src/api/routes/auth.ts`
  - `apps/server/src/api/routes/players.ts`
  - `apps/server/src/api/routes/market.ts`
  - `apps/server/src/api/routes/factions.ts`
  - `apps/server/src/api/routes/territory.ts`
  - `apps/server/src/api/routes/hospital.ts`
  - `apps/server/src/api/routes/prison.ts`
  - `apps/server/src/api/routes/round.ts`
- padronização de:
  - `params` com IDs e enums
  - `querystring` com filtros tipados
  - `body` com limites de comprimento, enums, min/max e `additionalProperties: false`
  - `response` com contrato genérico formal para sucesso e erro HTTP
- teste dedicado da borda HTTP em `apps/server/test/http-schemas.test.ts`, cobrindo rejeição de payload inválido antes da camada de serviço

## 8. Retrofitar validação nas rotas mais expostas

**Objetivo:** cobrir primeiro os fluxos de maior risco.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- aplicar schema em auth, player, market, faction, territory, hospital, prison e round
- adicionar limites de comprimento em strings
- adicionar min/max e enums para números e flags de entrada

**Critério de aceite:**
- payload inválido falha antes de tocar service layer

**Entrega realizada:**
- o módulo `apps/server/src/api/schemas.ts` passou a cobrir também os contratos das rotas operacionais e de negócio:
  - banco
  - inventário
  - crimes
  - roubos
  - PvP
  - tribunal
  - treino
  - universidade
  - jogo do bicho
  - venda de drogas
  - propriedades e centros de operação (`bocas`, `factories`, `front-stores`, `puteiros`, `raves`, `slot-machines`)
- as rotas retrofitadas agora usam `schema` formal para `body`, `params` e `response`
- o backend ficou sem módulos de rota funcionais “soltos” sem `schema`, exceto o endpoint trivial de `health`
- a cobertura de borda HTTP foi ampliada em `apps/server/test/http-schemas.test.ts`
- a suíte do server fechou verde após o retrofit em `52 arquivos / 248 testes`

## 9. Bloquear payload abusivo e input malformado

**Objetivo:** reduzir risco de abuso e DoS por entrada.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- limitar payload size em endpoints críticos
- normalizar/sanitizar campos textuais livres
- adicionar rate limiting nos endpoints mais sensíveis

**Critério de aceite:**
- servidor rejeita payloads fora do contrato e entradas abusivas

**Entrega realizada:**
- `apps/server/src/api/http-hardening.ts` centraliza:
  - `bodyLimit` padrão do Fastify em `16 KB`
  - saneamento de texto livre marcado por schema
  - rate limiting HTTP para auth público e mutações protegidas
- `apps/server/src/app.ts` agora sobe o Fastify com `bodyLimit` endurecido e instala o saneamento de input na camada HTTP
- `apps/server/src/api/routes/auth.ts` passou a aplicar rate limit HTTP específico nas rotas públicas
- `apps/server/src/api/routes/index.ts` passou a aplicar rate limit HTTP nas mutações protegidas após autenticação
- `apps/server/src/api/schemas.ts` passou a:
  - incluir `413` no contrato padrão de respostas
  - marcar `freeformStringSchema()` com `$comment: cs_rio:sanitize:freeform`
- `apps/server/src/api/http-errors.ts` agora classifica `413` como erro de validação
- a cobertura adicional entrou em `apps/server/test/http-hardening.test.ts`, cobrindo:
  - payload oversized com `413`
  - saneamento de texto livre
  - rate limit público
  - rate limit protegido

---

## Changelog

- `1.13.0` — conclui etapa 15 separando perfil cacheável de leitura fresca de membership/rank nos gates sensíveis de realtime
- `1.12.0` — conclui etapa 14 com revalidação atômica de prisão/hospital no service layer para crime, roubo, treino, universidade e PvP
- `1.11.0` — conclui etapa 13 com guard central de idempotência, proteção contra double tap/retry e cobertura nas rotas críticas
- `1.10.0` — conclui etapa 12 com transação explícita nas mutações monetárias do hospital e testes reais de rollback em fluxos financeiros compostos
- `1.9.0` — conclui etapa 11 com auditoria dos fluxos monetários simples e testes reais de rollback em transações
- `1.8.0` — conclui etapa 10 com validadores compartilhados entre `shared`, `server`, `mobile` e schemas HTTP
- `1.7.0` — conclui etapa 9 com limite global de payload, saneamento de texto livre e rate limiting HTTP
- `1.6.0` — conclui etapa 8 com retrofit de validação HTTP nas rotas mais expostas e amplia cobertura de testes do server

## 10. Centralizar validadores reutilizáveis

**Objetivo:** eliminar duplicação e drift de regras.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- extrair validadores de email, nickname, IDs, money, quantity e filtros
- compartilhar helpers entre rotas e stores do mobile quando fizer sentido
- remover validação duplicada espalhada em auth e fluxos de entrada

**Critério de aceite:**
- regras de validação principais existem em um único ponto por domínio

**Entrega realizada:**
- `packages/shared/src/validation.ts` consolidou helpers e constantes compartilhadas para:
  - email
  - nickname
  - senha
  - token/filtro opcional
  - texto colapsado
  - dinheiro
  - inteiros positivos
- `packages/shared/test/validation.test.ts` ampliou a cobertura dos helpers compartilhados
- `apps/mobile/src/stores/authStore.ts` passou a usar os helpers compartilhados para login e cadastro
- `apps/server/src/services/auth.ts` removeu duplicação local de email, nickname e senha
- `apps/server/src/services/hospital.ts` passou a reaproveitar a validação compartilhada de nickname
- `apps/server/src/services/faction.ts` reaproveitou normalização compartilhada para descrições, nomes, recruit nickname e valores monetários
- `apps/server/src/services/bank.ts` passou a usar normalização monetária compartilhada
- `apps/server/src/services/market.ts` passou a usar validadores compartilhados para filtros, quantidades e valores monetários
- `apps/server/src/api/schemas.ts` passou a usar constantes e patterns compartilhados para email, nickname, senha e token

## 11. Colocar transação nas operações financeiras simples

**Objetivo:** garantir atomicidade em mutações monetárias diretas.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- envolver em transação compra, venda, reparo, cobrança, pagamento e débito/crédito de jogador
- revisar escrita de `money`, `bankMoney` e ledgers correlatos
- adicionar testes de rollback em falha parcial

**Critério de aceite:**
- não existe update financeiro multi-etapa fora de transação

**Entrega realizada:**
- auditoria dos fluxos monetários simples confirmou transação explícita nos caminhos diretos de:
  - treino
  - universidade
  - compra e upgrade de propriedade
  - manutenção de propriedade
  - contratação de soldados
  - reparo de inventário
  - banco do jogador
  - jogo do bicho
- cobertura real de rollback entrou em `apps/server/test/simple-financial-transactions.test.ts`
- os testes validam que, quando a segunda etapa da mutação falha depois do débito inicial, o saldo do jogador volta ao valor original e nenhum registro parcial sobra no banco

## 12. Colocar transação nas operações financeiras compostas

**Objetivo:** fechar os fluxos econômicos mais perigosos.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- transacionar treasury de facção, guerra, propina, hospital, prisão e operações de mercado
- alinhar saldo, ledger, inventory e efeito colateral na mesma unidade atômica
- proteger pontos com risco de duplicação ou inconsistência

**Critério de aceite:**
- saldo e ledger não divergem em falha parcial

**Entrega realizada:**
- mutações monetárias do hospital agora abrem fronteira transacional explícita em:
  - `applyTreatment`
  - `detox`
  - `performSurgery`
  - `applyDstTreatment`
  - `purchaseHealthPlan`
- a auditoria dos fluxos compostos confirmou transação explícita já existente nos caminhos mais perigosos de:
  - treasury e ledger de facção
  - resgate, suborno e fiança da prisão
  - pagamento de propina territorial
  - operações do mercado negro via `withTransaction`
- a cobertura adicional entrou em `apps/server/test/composite-financial-transactions.test.ts`, provando rollback real em banco para:
  - atualização de caixa de facção + ledger
  - reserva monetária do mercado + lançamento em `transactions`
  - remoção de inventário + criação de leilão

## 13. Adicionar idempotência e proteção contra dupla execução

**Objetivo:** evitar replay e dupla aplicação de ação crítica.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- definir guardas/idempotency keys para ações sensíveis
- proteger contra retry automático, duplo toque e reenvio de request
- aplicar primeiro em crimes, mercado, hospital, prison e território

**Critério de aceite:**
- repetir a mesma ação crítica não duplica efeitos indevidos

**Entrega realizada:**
- helper central em `apps/server/src/api/action-idempotency.ts`
  - fingerprint estável por `playerId + acao + params/body/query`
  - suporte a `idempotency-key` e `x-idempotency-key`
  - bloqueio de request em andamento
  - bloqueio curto de replay logo após sucesso
- integração do guard no bootstrap via:
  - `apps/server/src/app.ts`
  - `apps/server/src/api/routes/index.ts`
- aplicação inicial nas rotas críticas de:
  - `apps/server/src/api/routes/crimes.ts`
  - `apps/server/src/api/routes/market.ts`
  - `apps/server/src/api/routes/hospital.ts`
  - `apps/server/src/api/routes/prison.ts`
  - `apps/server/src/api/routes/territory.ts`
- cobertura adicional em:
  - `apps/server/test/action-idempotency.test.ts`
  - `apps/server/test/action-idempotency-routes.test.ts`

## 14. Tornar verificações de estado atômicas

**Objetivo:** remover race condition entre “check” e “mutate”.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- unificar check de prisão/hospital com execução da ação
- revisar leitura stale em inventário, recursos e permissão de facção
- usar lock lógico ou transação quando o fluxo exigir

**Critério de aceite:**
- jogador preso/hospitalizado não executa ação por janela de corrida

**Entrega realizada:**
- helper central em `apps/server/src/services/action-readiness.ts` para revalidar prisão e hospitalização no ponto de mutação
- o service layer passou a fazer revalidação dupla (`early + late`) nos fluxos críticos de:
  - `apps/server/src/services/training.ts`
  - `apps/server/src/services/university.ts`
  - `apps/server/src/services/robbery.ts`
  - `apps/server/src/systems/CrimeSystem.ts`
  - `apps/server/src/services/pvp.ts`
- com isso, os fluxos acima deixaram de depender apenas do middleware HTTP; eles voltam a checar prisão/hospital imediatamente antes da escrita crítica
- a cobertura de regressão foi ampliada em:
  - `apps/server/test/training-route.test.ts`
  - `apps/server/test/university-route.test.ts`
  - `apps/server/test/robbery-route.test.ts`
  - `apps/server/test/crime-system.test.ts`
  - `apps/server/test/pvp-route.test.ts`
- a suíte do server fechou verde após o endurecimento em `57 arquivos / 274 testes`

## 15. Revisar cache de perfil e membership

**Objetivo:** impedir que autorização sensível dependa de cache stale.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- mapear chaves e duração de cache atuais
- separar cache tolerável de cache sensível a permissão
- reduzir ou remover cache em membership, rank e acesso a facção

**Critério de aceite:**
- mudanças de facção/rank refletem imediatamente onde são críticas

**Entrega realizada:**
- o mapeamento confirmou que o cache sensível residual estava concentrado no perfil do jogador em `apps/server/src/services/player.ts`
  - chave: `buildPlayerProfileCacheKey(playerId)`
  - TTL: `30s`
  - payload inclui `faction.id`, `faction.name`, `faction.abbreviation` e `faction.rank`
- `apps/server/src/services/player.ts` agora separa:
  - `getPlayerProfile(...)` como leitura cacheável para HUD/estado visual
  - `getFreshPlayerProfile(...)` como leitura fresca para gates sensíveis
- as realtime rooms deixaram de depender do perfil cacheado para autorização em:
  - `apps/server/src/rooms/FactionRoom.ts`
  - `apps/server/src/rooms/GameRoom.ts`
- com isso, região atual, facção atual e rank atual passam a ser lidos frescos no handshake das rooms
- a cobertura foi ampliada em:
  - `apps/server/test/realtime.test.ts`
  - `apps/server/test/realtime-logging.test.ts`
- os testes agora provam que room auth usa o snapshot fresco, e não um perfil stale que permitiria facção/região antigas
- a suíte do server fechou verde após o ajuste em `57 arquivos / 276 testes`

## 16. Implementar invalidação de cache por escrita

**Objetivo:** manter leitura coerente após mutações.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- invalidar cache de perfil, recursos, facção, território e membership ao escrever
- centralizar essa invalidação em helpers reutilizáveis
- adicionar testes para garantir que escrita limpa a leitura derivada correta

**Critério de aceite:**
- mutação relevante não deixa leitura stale disponível por janela indevida

**Entrega realizada:**
- helper central em `apps/server/src/services/player-cache.ts` com:
  - `buildPlayerProfileCacheKey(...)`
  - `invalidatePlayerProfileCache(...)`
  - `invalidatePlayerProfileCaches(...)`
- a invalidação da chave `player:profile:{playerId}` deixou de depender de `delete(...)` solto e passou a usar uma fronteira compartilhada com:
  - invalidação individual
  - invalidação em lote
  - deduplicação
  - tolerância a ids vazios
  - `Promise.allSettled(...)` no lote
- `apps/server/src/services/player.ts` passou a reutilizar e reexportar o helper central, preservando a leitura cacheada existente sem duplicar a montagem da chave
- os principais writers do backend foram migrados para o helper central, incluindo:
  - `bank`
  - `faction`
  - `crime`
  - `robbery`
  - `market`
  - `pvp`
  - `world-ops`
  - `player-ops`
  - `drug-sale`
  - `factory`
  - `slot-machine`
  - `prison`
  - `tribunal`
  - `property`
  - `puteiro`
  - `rave`
  - `bicho`
  - `hospital`
  - `front-store`
  - `training`
  - `boca`
  - `university`
- a cobertura específica entrou em `apps/server/test/player-cache.test.ts`, provando:
  - invalidação individual
  - invalidação em lote com deduplicação
  - refresh imediato de `/api/players/me` após mutações de:
    - banco
    - facção
    - hospital
- validação executada nesta etapa:
  - `npm run typecheck --workspace @cs-rio/server`
  - `npm run lint --workspace @cs-rio/server`
  - `npm run build --workspace @cs-rio/server`
  - `npm run test --workspace @cs-rio/server -- test/player-cache.test.ts`
  - `npm run test --workspace @cs-rio/server -- test/scenario-ops.test.ts`
  - `npm run test --workspace @cs-rio/server -- test/world-ops.test.ts`
- observação de estabilidade:
  - a suíte completa do server segue com flakes intermitentes pré-existentes em `scenario-ops` e `world-ops`
  - nas repetições desta etapa, cada falha apareceu isoladamente e ambos os arquivos passaram quando rerodados sozinhos

## 17. Fatiar `territory.ts`

**Objetivo:** reduzir o maior hotspot do backend.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- dividir `territory.ts` em módulos por domínio:
  - overview/leitura
  - conquista
  - guerra
  - serviços
  - baile
  - X9/propina
  - satisfação/helpers
- preservar contratos públicos enquanto a refatoração ocorre

**Critério de aceite:**
- `territory.ts` deixa de ser arquivo monolítico gigante

**Entrega realizada:**
- primeiro corte estrutural concluído com extração da camada de persistência e dos contratos internos para:
  - `apps/server/src/services/territory/repository.ts`
  - `apps/server/src/services/territory/types.ts`
  - `apps/server/src/services/territory/shared.ts`
- `apps/server/src/services/territory.ts` deixou de carregar a implementação `DatabaseTerritoryRepository` e passou a usá-la como dependência externa via fachada
- o hotspot principal caiu de aproximadamente `7036` linhas para `4622` linhas
- a implementação de persistência ficou isolada em `repository.ts` com `2258` linhas e os contratos/tipos compartilhados ficaram em `types.ts` com `672` linhas
- helpers de serialização e mapeamento necessários ao repositório foram isolados em `shared.ts`
- contratos públicos e rotas permaneceram inalterados; o corte foi puramente estrutural
- validação executada nesta etapa:
  - `npm run typecheck --workspace @cs-rio/server`
  - `npm run lint --workspace @cs-rio/server`
  - `npm run build --workspace @cs-rio/server`
  - `npm run test --workspace @cs-rio/server -- test/territory-route.test.ts test/tribunal-route.test.ts test/property-route.test.ts test/scenario-ops.test.ts`
  - `npm run test --workspace @cs-rio/server`
- observação de estabilidade:
  - a suíte dirigida de território ficou verde (`37/37`)
  - a suíte completa do server manteve o mesmo flake intermitente pré-existente em `scenario-ops`
  - `scenario-ops.test.ts` passou verde quando rerodado isoladamente após a extração

## 18. Fatiar `faction.ts` e `player.ts`

**Objetivo:** atacar o restante dos serviços críticos superdimensionados.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- separar leitura, mutação, banco/ledger, membership, upgrades e realtime helpers
- extrair operações de localização, recursos e perfil para módulos menores
- manter API interna explícita entre os módulos resultantes

**Critério de aceite:**
- `faction.ts` e `player.ts` ficam menores e com responsabilidade clara

**Entrega realizada:**
- extração dos contratos e tipos de `player` para:
  - `apps/server/src/services/player/types.ts`
- extração da persistência de `player` para:
  - `apps/server/src/services/player/repository.ts`
- `apps/server/src/services/player.ts` foi reduzido a fachada de serviço/orquestração com reexports do contrato público
- extração dos contratos e tipos de `faction` para:
  - `apps/server/src/services/faction/types.ts`
- extração da persistência e dos helpers compartilhados de `faction` para:
  - `apps/server/src/services/faction/repository.ts`
- `apps/server/src/services/faction.ts` foi reduzido a fachada de serviço/orquestração com reexports do contrato público
- redução concreta dos hotspots:
  - `apps/server/src/services/player.ts`: de `1727` para `877` linhas
  - `apps/server/src/services/faction.ts`: de `3599` para `1451` linhas
- contratos públicos preservados para:
  - rotas
  - tests `InMemoryRepository`
  - `player-ops`
  - `CombatSystem`
  - serviços que consomem `calculateFactionPointsDelta`, `insertFactionBankLedgerEntry` e `NoopFactionUpgradeEffectReader`

**Validação concluída:**
- `npm run typecheck --workspace @cs-rio/server`
- `npm run lint --workspace @cs-rio/server`
- `npm run build --workspace @cs-rio/server`
- `npm run test --workspace @cs-rio/server -- test/faction-route.test.ts test/auth.test.ts test/inventory-route.test.ts test/player-ops.test.ts test/world-ops.test.ts`
- `npm run test --workspace @cs-rio/server`

**Resultado final da suíte do server após a etapa 18:**
- `58 arquivos / 282 testes passando`

## 19. Consolidar robustez do client

**Objetivo:** reduzir fragilidade no mobile.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- unificar a lógica duplicada de conexão/reconexão realtime
- adicionar error boundary global no React Native
- garantir fallback visual quando houver erro de render ou falha em árvore crítica

**Critério de aceite:**
- erro de render não derruba o app inteiro sem fallback

**Implementação concluída:**
- base comum de room/reconnect extraída para:
  - `apps/mobile/src/services/realtime/baseRealtimeRoom.ts`
- `ColyseusService` e `FactionRealtimeService` passaram a reutilizar a mesma infraestrutura de:
  - `ensureClient`
  - `subscribe`
  - `disconnect`
  - `bindRoom`
  - `scheduleReconnect`
  - `reconnect`
- `colyseus.ts` caiu para `356` linhas
- `factionRealtime.ts` caiu para `354` linhas
- `AppErrorBoundary` global foi instalado em:
  - `apps/mobile/src/components/AppErrorBoundary.tsx`
  - `apps/mobile/App.tsx`
- lógica do fallback do boundary foi isolada em:
  - `apps/mobile/src/components/app-error-boundary.shared.ts`
- cobertura nova adicionada em:
  - `apps/mobile/test/app-error-boundary.test.ts`
- serviços realtime continuaram cobertos em:
  - `apps/mobile/test/colyseus.test.ts`
  - `apps/mobile/test/faction-realtime.test.ts`

**Validação concluída:**
- `npm run typecheck --workspace @cs-rio/mobile`
- `npm run lint --workspace @cs-rio/mobile`
- `npm run test --workspace @cs-rio/mobile`
- `npm run build --workspace @cs-rio/mobile`
- estado final do mobile:
  - `30 arquivos / 82 testes passando`

## 20. Fechar com regressão, observabilidade e rollout

**Objetivo:** validar o hardening e deixar o projeto operável em produção.

**Status:** `Concluída em 2026-03-14`

**Ações:**
- adicionar testes para validação HTTP, transações, cache invalidation e race conditions
- revisar logging e métricas mínimas de produção
- preparar checklist de rollout e verificação pós-deploy

**Critério de aceite:**
- pipeline cobre os riscos corrigidos e o rollout tem checklist objetivo

**Implementação concluída:**
- matriz de regressão consolidada abaixo, ligando risco endurecido a:
  - teste automatizado
  - smoke obrigatório
  - checklist operacional
- observabilidade mínima da Pré-Alpha consolidada neste documento
- checklist operacional criado em:
  - `ROLL_OUT.md`
- `README.md` atualizado para apontar o rollout
- snapshot final validado no fechamento do plano:
  - `@cs-rio/shared`: `2 arquivos / 12 testes`
  - `@cs-rio/game-engine`: `2 arquivos / 13 testes`
  - `@cs-rio/mobile`: `30 arquivos / 82 testes`
  - `@cs-rio/server`: `58 arquivos / 282 testes`

**Observação importante:**
- a etapa 20 concluiu a consolidação operacional do plano
- a observação antiga dizendo que a etapa `18` seguia pendente era apenas resíduo documental e foi removida nesta revisão

### Matriz de regressão consolidada

| Risco | Proteção automatizada | Smoke / checklist |
|---|---|---|
| Secrets / boot seguro | `apps/server/test/env.test.ts` | validar boot + `/api/health` |
| CORS por ambiente | `apps/server/test/cors.test.ts` | validar origem real autorizada |
| `requestId` e contexto por request | `apps/server/test/app.test.ts`, `apps/server/test/request-context.test.ts` | conferir logs com `requestId` |
| Error handler HTTP | `apps/server/test/http-errors.test.ts` | erro HTTP precisa devolver `requestId` e payload padronizado |
| Schemas Fastify / validação HTTP | `apps/server/test/http-schemas.test.ts` | payload inválido deve morrer antes do service layer |
| Payload hardening / `bodyLimit` / rate limit | `apps/server/test/http-hardening.test.ts` | requests abusivos devem falhar com resposta consistente |
| Transações simples | `apps/server/test/simple-financial-transactions.test.ts` | fluxo monetário simples não pode deixar resíduo parcial |
| Transações compostas | `apps/server/test/composite-financial-transactions.test.ts` | ledger / market / hospital não podem ficar inconsistentes |
| Idempotência | `apps/server/test/action-idempotency.test.ts`, `apps/server/test/action-idempotency-routes.test.ts` | double tap não pode duplicar efeito |
| Check atômico de prisão / hospital | `training-route`, `university-route`, `robbery-route`, `crime-system`, `pvp-route` | preso/hospitalizado não pode executar ação |
| Leitura fresca de membership/rank | `apps/server/test/realtime.test.ts` | auth de room precisa refletir facção/rank atuais |
| Invalidação de cache por escrita | `apps/server/test/player-cache.test.ts` | `/players/me` deve refletir mutação imediatamente |
| Logging de Redis / realtime / processo | `apps/server/test/redis-kv-store.test.ts`, `apps/server/test/realtime-logging.test.ts`, `apps/server/test/process-errors.test.ts` | operadores precisam ver erro útil no log |
| Realtime compartilhado do mobile | `apps/mobile/test/colyseus.test.ts`, `apps/mobile/test/faction-realtime.test.ts` | reconnect e snapshot precisam continuar funcionando |
| Error boundary do mobile | `apps/mobile/test/app-error-boundary.test.ts` | crash de render precisa cair em fallback |

### Observabilidade mínima da Pré-Alpha

No estado atual, o projeto deve preservar no server:

- logs HTTP com:
  - `requestId`
  - `route`
  - `method`
  - `path`
  - `ip`
  - `playerId`
  - `regionId`
- logs explícitos de:
  - Redis
  - realtime
  - exceções fatais de processo
- responses de erro com:
  - `message`
  - `category`
  - `requestId`

No mobile, a observabilidade mínima esperada é:

- fallback visual via `AppErrorBoundary`
- status de conexão visível nos fluxos que dependem de realtime
- falha de reconnect não deve matar a navegação inteira

---

## Resultado consolidado do plano

Com as 20 etapas concluídas, o `cs_rio` ficou posicionado para operar a Pré-Alpha com:

- com HTTP validado e tipado
- com erro tratável e rastreável
- com a maior parte dos fluxos financeiros endurecida por transação, ainda sujeita a backlog residual de concorrência quando novas auditorias encontrarem gaps específicos
- com cache mais coerente com autorização e estado do jogo
- com serviços centrais mais modulares
- com mobile mais resiliente
- com observabilidade suficiente para operar e depurar a Pré-Alpha

## Change Log

### `1.0.0` — 2026-03-14

- criação inicial do plano de hardening
- consolidação dos 10 achados críticos/altos/médios em 20 etapas operacionais

### `1.1.0` — 2026-03-14

- etapa 1 executada
- baseline técnica congelada com estado real da esteira
- rotas e serviços críticos priorizados
- checklist operacional de regressão adicionado ao plano

### `1.5.0` — 2026-03-14

- etapa 7 executada
- camada HTTP crítica passou a ter schema formal de `params`, `querystring`, `body` e `response`
- helpers compartilhados de schema adicionados ao backend
- teste dedicado de validação HTTP adicionado para garantir rejeição antes do service layer

### `1.6.0` — 2026-03-14

- etapa 8 executada
- retrofit de validação HTTP aplicado nas rotas mais expostas
- cobertura do server ampliada para payload inválido morrer antes do service layer

### `1.7.0` — 2026-03-14

- etapa 9 executada
- `bodyLimit` global, saneamento de texto livre e rate limiting HTTP adicionados

### `1.8.0` — 2026-03-14

- etapa 10 executada
- validadores compartilhados centralizados entre `shared`, `server` e `mobile`

### `1.9.0` — 2026-03-14

- etapa 11 executada
- fluxos monetários simples auditados com testes reais de rollback

### `1.10.0` — 2026-03-14

- etapa 12 executada
- transações compostas endurecidas e cobridas com rollback real em banco

### `1.11.0` — 2026-03-14

- etapa 13 executada
- guard central de idempotência aplicado nas rotas críticas

### `1.12.0` — 2026-03-14

- etapa 14 executada
- revalidação atômica de prisão e hospitalização adicionada ao service layer de crime, roubo, treino, universidade e PvP
- regressões de corrida cobrindo bloqueio tardio antes da persistência

### `1.13.0` — 2026-03-14

- etapa 15 executada
- leitura fresca de perfil passou a ser usada nos gates sensíveis de realtime
- cache de HUD permaneceu separado da autorização crítica

### `1.14.0` — 2026-03-14

- etapa 16 executada
- invalidação de `player:profile:{playerId}` foi centralizada em helper compartilhado
- writers principais migrados para a nova fronteira de invalidação

### `1.15.0` — 2026-03-14

- etapa 17 executada
- `territory.ts` foi fatiado no primeiro corte estrutural
- persistência e contratos internos foram extraídos para `services/territory/`

### `1.16.0` — 2026-03-14

- etapa 19 executada
- base compartilhada de realtime extraída para o mobile
- `ColyseusService` e `FactionRealtimeService` ficaram mais finos sem mudar a API pública
- `AppErrorBoundary` global instalado no topo do app
- suíte completa do mobile validada verde com `30 arquivos / 82 testes`

### `1.17.0` — 2026-03-14

- etapa 20 executada
- matriz de regressão e observabilidade mínima consolidadas no `HARDENING.md`
- `ROLL_OUT.md` criado com checklist de pre-deploy, smoke, pos-deploy e rollback
- `README.md` atualizado para apontar o documento de rollout
- esteira completa do monorepo validada verde:
  - `@cs-rio/shared`: `2 arquivos / 12 testes`
  - `@cs-rio/game-engine`: `2 arquivos / 13 testes`
  - `@cs-rio/mobile`: `30 arquivos / 82 testes`
  - `@cs-rio/server`: `58 arquivos / 282 testes`

### `1.18.1` — 2026-03-16

- revisão documental pós-fechamento
- correção da contradição que ainda apontava a etapa `18` como pendente
- enquadramento explícito das contagens de testes como snapshots históricos, não contrato operacional vigente
- alinhamento com `ROLL_OUT.md` como fonte de verdade para validação atual de deploy e smoke
