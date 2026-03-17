# CS Rio — Plano de Estrutura Tecnica

> Plano tecnico detalhado de melhorias estruturais, seguranca e qualidade de codigo.
> Baseado em auditoria completa realizada em 2026-03-16.
> Organizado em etapas sequenciais com dependencias explicitas.
> Desde 2026-03-17, o backend ativo foi movido para [`../cs_rio_api`](/home/cesar/projects/cs_rio_api). As referencias a `apps/server` e `@cs-rio/server` preservam o contexto historico das entregas registradas aqui.

---

## Estado atual

| Metrica               | Valor                                            |
| --------------------- | ------------------------------------------------ |
| Esteira               | Verde (typecheck, lint, test, build)             |
| Testes                | 484 testes / 108 arquivos / 0 falhas             |
| Hardening             | 20/20 etapas concluidas                          |
| Nota geral            | 8.6/10                                           |
| Vulnerabilidade real  | SELECT-then-UPDATE sem row lock (~25 pontos)     |
| Divida tecnica        | Servicos monoliticos, DI manual, stores inchados |

---

## Mapa de progressao

```
Etapa 1 ─── Blindagem financeira (seguranca)
  │
Etapa 2 ─── Hierarquia de erros unificada (fundacao)
  │
Etapa 3 ─┬─ Fatiamento territory.ts (SRP server)
  │       │
Etapa 4 ─┤  Fatiamento faction.ts e market.ts (SRP server)
  │       │
Etapa 5 ─┘  Container de DI no server (DIP)
  │
Etapa 6 ─── Segregacao de interfaces (ISP)
  │
Etapa 7 ─── Error handler extensivel (OCP)
  │
Etapa 8 ─── Fatiamento mobile: App.tsx e stores (SRP mobile)
  │
Etapa 9 ─── Fatiamento mobile: HomeScreen e GameView (SRP mobile)
  │
Etapa 10 ── React.memo e otimizacao de renders (performance)
  │
Etapa 11 ── Limpeza de code smells (clean code)
  │
Etapa 12 ── Validacao client-side e catch blocks (polimento)
```

---

## Etapa 1 — Blindagem financeira

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com helper compartilhado para mutacoes guardadas de `players` e `factions`, migracao dos fluxos financeiros criticos do server e validacao automatizada completa no workspace `@cs-rio/server`.
> Complemento residual aplicado em 2026-03-16 para fechar quatro debitos de `credits` premium que ainda estavam fora do padrao atomico com guard (`prison:bailOut`, `hospital:performSurgery`, `hospital:purchaseHealthPlan` e `player/repository:changeVocation`), com regressao automatizada dedicada.

**Objetivo**: Eliminar a classe inteira de race conditions em operacoes financeiras de `money`, `bankMoney` e debitos de `credits`.

**Problema**: O `market.ts:adjustPlayerMoney` usa o pattern correto (UPDATE atomico com WHERE guard), mas ~25 outros pontos no codebase usam SELECT→compute→UPDATE sem row lock, permitindo double-spend teorico com requests paralelos.

**Pattern alvo** (ja funciona em market.ts:427-440):

```typescript
const [updated] = await tx
  .update(players)
  .set({
    money: sql`round((${players.money} - ${cost})::numeric, 2)`,
  })
  .where(
    and(
      eq(players.id, playerId),
      sql`(${players.money} - ${cost}) >= 0`,
    ),
  )
  .returning({ id: players.id });

if (!updated) {
  throw new ServiceError('insufficient_funds', 'Saldo insuficiente.');
}
```

### 1.1 — bank.ts (3 pontos)

| Local             | Linha | Operacao                | Pattern atual          |
| ----------------- | ----- | ----------------------- | ---------------------- |
| `deposit`         | 133   | money e bankMoney       | SELECT→compute→UPDATE  |
| `withdraw`        | 203   | money e bankMoney       | SELECT→compute→UPDATE  |
| `syncBankInterest`| 471   | bankMoney               | SELECT→compute→UPDATE  |

**Acao**: Substituir os 3 UPDATEs por SQL atomico com WHERE guard.

Detalhe: deposit e withdraw alteram dois campos simultaneamente (money e bankMoney). O UPDATE atomico deve garantir que ambos os campos resultantes sejam >= 0:

```typescript
await tx
  .update(players)
  .set({
    money: sql`round((${players.money} - ${amount})::numeric, 2)`,
    bankMoney: sql`round((${players.bankMoney} + ${amount})::numeric, 2)`,
  })
  .where(
    and(
      eq(players.id, playerId),
      sql`(${players.money} - ${amount}) >= 0`,
    ),
  )
  .returning({ id: players.id });
```

Para `syncBankInterest`, o juros e sempre positivo (credito), entao o guard de saldo nao e necessario, mas o UPDATE deve ser atomico para evitar sobrescrita:

```typescript
await tx
  .update(players)
  .set({
    bankMoney: sql`round((${players.bankMoney} + ${interest})::numeric, 2)`,
    bankInterestSyncedAt: now,
  })
  .where(eq(players.id, playerId));
```

**Testes**: Adicionar teste de concorrencia que dispara dois depositos/saques simultaneos e verifica saldo final.

---

### 1.2 — prison.ts (2 pontos)

| Local           | Linha | Operacao     | Pattern atual          |
| --------------- | ----- | ------------ | ---------------------- |
| `attemptBribe`  | 264   | money        | SELECT→compute→UPDATE  |
| `factionRescue` | 508   | bankMoney    | SELECT→compute→UPDATE  |

**Acao**: Migrar para UPDATE atomico com WHERE guard.

Para `attemptBribe`:
```typescript
const [updated] = await tx
  .update(players)
  .set({
    money: sql`round((${players.money} - ${bribeCost})::numeric, 2)`,
  })
  .where(
    and(
      eq(players.id, playerId),
      sql`(${players.money} - ${bribeCost}) >= 0`,
    ),
  )
  .returning({ id: players.id });

if (!updated) {
  throw new PrisonError('insufficient_resources', 'Saldo insuficiente.');
}
```

Para `factionRescue`:
```typescript
const [updated] = await tx
  .update(factions)
  .set({
    bankMoney: sql`round((${factions.bankMoney} - ${rescueCost})::numeric, 2)`,
  })
  .where(
    and(
      eq(factions.id, factionId),
      sql`(${factions.bankMoney} - ${rescueCost}) >= 0`,
    ),
  )
  .returning({ id: factions.id });
```

**Testes**: Adicionar teste de bribe concorrente (dois subornos simultaneos com saldo para apenas um).

---

### 1.3 — hospital.ts (3 pontos)

| Local         | Linha | Operacao                | Pattern atual           |
| ------------- | ----- | ----------------------- | ----------------------- |
| `treatment`   | 294   | money                   | SQL atomico SEM guard   |
| `detox`       | 325   | money                   | SQL atomico SEM guard   |
| `statPurchase`| 458   | money                   | SQL atomico SEM guard   |

**Problema especifico**: hospital.ts usa `sql\`${players.money} - ${cost}\`` (atomico no SET) mas nao tem WHERE guard. O saldo pode ficar negativo.

**Acao**: Adicionar WHERE guard em cada UPDATE:

```typescript
const [updated] = await tx
  .update(players)
  .set({
    hp: 100,
    money: sql`round((${players.money} - ${treatmentCost})::numeric, 2)`,
  })
  .where(
    and(
      eq(players.id, playerId),
      sql`(${players.money} - ${treatmentCost}) >= 0`,
    ),
  )
  .returning({ id: players.id });

if (!updated) {
  throw new HospitalError('insufficient_resources', 'Saldo insuficiente.');
}
```

---

### 1.4 — training.ts (1 ponto)

| Local            | Linha | Operacao       | Pattern atual          |
| ---------------- | ----- | -------------- | ---------------------- |
| `createSession`  | 213   | money, cansaco | SELECT→compute→UPDATE  |

**Acao**: Migrar para UPDATE atomico com guard duplo (money >= 0 E cansaco >= 0).

---

### 1.5 — university.ts (1 ponto)

| Local    | Linha | Operacao | Pattern atual          |
| -------- | ----- | -------- | ---------------------- |
| `enroll` | 159   | money    | SELECT→compute→UPDATE  |

**Acao**: Migrar para UPDATE atomico com WHERE guard.

---

### 1.6 — bicho.ts (2 pontos)

| Local       | Linha | Operacao          | Pattern atual          |
| ----------- | ----- | ----------------- | ---------------------- |
| `placeBet`  | 359   | money (debito)    | SELECT→compute→UPDATE  |
| `settleWin` | 480   | money (credito)   | SELECT→compute→UPDATE  |

**Acao**: `placeBet` → UPDATE atomico com WHERE guard. `settleWin` → UPDATE atomico sem guard (credito positivo).

---

### 1.7 — robbery.ts (2 pontos)

| Local           | Linha | Operacao         | Pattern atual          |
| --------------- | ----- | ---------------- | ---------------------- |
| `attemptResult` | 502   | money (variavel) | SELECT→compute→UPDATE  |
| `banditReturn`  | 720   | money (credito)  | SELECT→compute→UPDATE  |

**Acao**: Migrar para UPDATE atomico. Para `attemptResult` que pode debitar, adicionar WHERE guard.

---

### 1.8 — property.ts (5 pontos)

| Local            | Linha | Operacao    | Pattern atual          |
| ---------------- | ----- | ----------- | ---------------------- |
| `maintenance`    | 338   | money       | SELECT→compute→UPDATE  |
| `purchase`       | 376   | money       | SELECT→compute→UPDATE  |
| `hireSoldiers`   | 604   | money       | SELECT→compute→UPDATE  |
| `collectRevenue` | 868   | money       | SELECT→compute→UPDATE  |
| `upgrade`        | 1001  | money       | SELECT→compute→UPDATE  |

**Acao**: Migrar todos para UPDATE atomico com WHERE guard.

---

### 1.9 — Servicos de operacao (boca, puteiro, rave, front-store, slot-machine, drug-sale, factory)

| Servico        | Pontos | Linhas principais             |
| -------------- | ------ | ----------------------------- |
| boca.ts        | 2      | 244, 417                      |
| puteiro.ts     | 3      | 274, 420, 542                 |
| rave.ts        | 2      | 268, 443                      |
| front-store.ts | 2      | 285, 567                      |
| slot-machine.ts| 3      | 279, 414, 598                 |
| drug-sale.ts   | 1      | 379                           |
| factory.ts     | 3      | 222, 840, 904                 |

**Acao**: Migrar todos para UPDATE atomico. Debitos com WHERE guard, creditos sem guard.

---

### 1.10 — faction/repository.ts (2 pontos)

| Local            | Linha | Operacao     | Pattern atual          |
| ---------------- | ----- | ------------ | ---------------------- |
| `memberDeposit`  | 520   | player money | SELECT→compute→UPDATE  |
| `factionPayout`  | 1148  | player money | SELECT→compute→UPDATE  |

**Acao**: Migrar para UPDATE atomico com WHERE guard.

---

### 1.11 — pvp.ts e player/repository.ts

| Servico             | Pontos | Linhas | Operacao        |
| ------------------- | ------ | ------ | --------------- |
| pvp.ts              | ~2     | varios | loot de combate |
| player/repository.ts| 1      | 708    | money update    |
| player-ops.ts       | 1      | 315    | money update    |

**Acao**: Migrar para UPDATE atomico.

---

### Totais da Etapa 1

| Metrica              | Valor |
| -------------------- | ----- |
| Arquivos afetados    | ~18   |
| Pontos de mutacao    | ~35   |
| Testes novos         | ~6-8  |
| Risco de regressao   | Medio |
| Dependencias         | Nenhuma |

**Criterio de conclusao**: Zero ocorrencias de `money: nextMoney.toFixed(2)` ou `money: updatedMoney.toFixed(2)` no codebase. Toda mutacao financeira de `money`, `bankMoney` e debito de `credits` usa SQL atomico com guard quando houver risco de saldo negativo.

**Validacao**: `grep -rn 'money:.*toFixed' apps/server/src/services/` retorna zero resultados.

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server`

---

## Etapa 2 — Hierarquia de erros unificada

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com `DomainError` central, factories por dominio, manutencao dos nomes `XError` como wrappers compativeis e simplificacao do `http-errors.ts` para um unico ramo `instanceof DomainError`. Validacao final executada no workspace `@cs-rio/server`.

**Objetivo**: Substituir 26 classes de erro isoladas por uma hierarquia coesa.

**Problema**: Cada servico define sua propria classe de erro (AuthError, BankError, BichoError, BocaError, CrimeError, ContactError, DrugSaleError, FactionError, FactoryError, FrontStoreError, HospitalError, MarketError, PlayerError, PrisonError, PropertyError, PuteiroError, PvpError, PrivateMessageError, RaveError, RobberyError, SlotMachineError, TerritoryError, TrainingError, TribunalError, UniversityError). Isso gera 26 checks `instanceof` no error handler e impede extensibilidade.

### 2.1 — Criar classe base `DomainError`

Arquivo: `apps/server/src/errors/domain-error.ts`

```typescript
export type DomainErrorCategory =
  | 'auth'
  | 'conflict'
  | 'forbidden'
  | 'infrastructure'
  | 'insufficient_resources'
  | 'invalid_input'
  | 'not_found'
  | 'rate_limited'
  | 'unauthorized';

export class DomainError extends Error {
  constructor(
    public readonly domain: string,           // 'faction', 'market', 'prison', etc.
    public readonly code: string,             // 'insufficient_funds', 'not_found', etc.
    public readonly category: DomainErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
```

### 2.2 — Criar factory functions por dominio

Cada servico substitui sua classe customizada por uma factory:

```typescript
// Antes (26 classes):
export class BankError extends Error {
  constructor(public readonly code: string, message: string) { ... }
}
throw new BankError('conflict', 'Saldo insuficiente.');

// Depois (1 classe, factories):
export function bankError(code: string, message: string): DomainError {
  const category = resolveBankErrorCategory(code);
  return new DomainError('bank', code, category, message);
}
throw bankError('conflict', 'Saldo insuficiente.');
```

### 2.3 — Simplificar `http-errors.ts`

Substituir 26 blocos `if (error instanceof XError)` por um unico check:

```typescript
// Antes (26 checks):
if (error instanceof AuthError) { return mapAuthError(error); }
if (error instanceof BankError) { return mapBankError(error); }
// ... 24 mais

// Depois (1 check):
if (error instanceof DomainError) {
  return createMappedDomainError(error);
}
```

### 2.4 — Mapa de migracao por servico

| Servico              | Classe atual       | Factory nova            |
| -------------------- | ------------------ | ----------------------- |
| auth.ts              | AuthError          | authError()             |
| bank.ts              | BankError          | bankError()             |
| bicho.ts             | BichoError         | bichoError()            |
| boca.ts              | BocaError          | bocaError()             |
| crime system         | CrimeError         | crimeError()            |
| contact.ts           | ContactError       | contactError()          |
| drug-sale.ts         | DrugSaleError      | drugSaleError()         |
| faction.ts           | FactionError       | factionError()          |
| factory.ts           | FactoryError       | factoryError()          |
| front-store.ts       | FrontStoreError    | frontStoreError()       |
| hospital.ts          | HospitalError      | hospitalError()         |
| market.ts            | MarketError        | marketError()           |
| player.ts            | PlayerError        | playerError()           |
| prison.ts            | PrisonError        | prisonError()           |
| property.ts          | PropertyError      | propertyError()         |
| puteiro.ts           | PuteiroError       | puteiroError()          |
| pvp.ts               | PvpError           | pvpError()              |
| private-message.ts   | PrivateMessageError| privateMessageError()   |
| rave.ts              | RaveError          | raveError()             |
| robbery.ts           | RobberyError       | robberyError()          |
| slot-machine.ts      | SlotMachineError   | slotMachineError()      |
| territory.ts         | TerritoryError     | territoryError()        |
| training.ts          | TrainingError      | trainingError()         |
| tribunal.ts          | TribunalError      | tribunalError()         |
| university.ts        | UniversityError    | universityError()       |

**Criterio de conclusao**: Zero `instanceof XError` no `http-errors.ts` exceto `instanceof DomainError`.

**Testes**: Atualizar `http-errors.test.ts` para usar `DomainError`. Adicionar teste de mapeamento por category.

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server`

**Resultado do fechamento**:
- criado `apps/server/src/errors/domain-error.ts`
- `apps/server/src/api/http-errors.ts` caiu para `252` linhas e perdeu todos os `instanceof XError`
- 25 dominios de jogo migrados para `DomainError` com factories locais e wrappers compativeis
- `apps/server/test/http-errors.test.ts` passou a cobrir `DomainError` diretamente, incluindo override de status especifico por dominio
- `@cs-rio/server`: `63` arquivos / `332` testes passando

---

## Etapa 3 — Fatiamento de territory.ts (SRP)

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com extracao dos fluxos de guerra de faccao, propina, X9, baile, overview territorial e helpers de combate/estado para modulos dedicados. Validacao final executada no workspace `@cs-rio/server`.

**Objetivo**: Reduzir `territory.ts` de 5.081 linhas para modulos coesos, mantendo `territory.ts` abaixo de 2.000 linhas e cada novo servico abaixo de 1.000 linhas.

**Responsabilidades atuais do territory.ts** (15 concerns):

1. Conquista e controle de favelas
2. Servicos de favela (instalacao, upgrade, ciclos)
3. Propina (negociacao, pagamentos)
4. X9 (incursoes policiais, desenrolo)
5. Baile (organizacao, MCs)
6. Guerra de faccao (declaracao, rodadas, status)
7. Bandit syncing
8. Territorio loss tracking
9. Satisfacao regional
10. Ciclo de servicos
11. Feed de territorio
12. Overview territorial
13. Boss assignments
14. Dominacao regional de faccao
15. Validacao e normalizacao

### 3.1 — Extrair `FactionWarService`

Arquivo: `apps/server/src/services/faction-war.ts`

Responsabilidades migradas:
- Declaracao de guerra
- Preparacao e rodadas de guerra
- Status e resultado da guerra
- War loss tracking e replay

Estimativa: ~800-1000 linhas.

### 3.2 — Extrair `PropinaService`

Arquivo: `apps/server/src/services/propina.ts`

Responsabilidades migradas:
- Negociacao de propina
- Pagamentos periodicos
- Calculo de satisfacao por propina

Estimativa: ~400-600 linhas.

### 3.3 — Extrair `X9IncursionService`

Arquivo: `apps/server/src/services/x9-incursion.ts`

Responsabilidades migradas:
- Mecanica de X9
- Desenrolo e resolucao
- Bandit management

Estimativa: ~400-600 linhas.

### 3.4 — Extrair `BaileService`

Arquivo: `apps/server/src/services/baile.ts`

Responsabilidades migradas:
- Organizacao de baile
- Tiers de MC
- Efeitos do baile na favela

Estimativa: ~300-400 linhas.

### 3.5 — Resultado esperado

| Arquivo                   | Linhas estimadas | Responsabilidade                     |
| ------------------------- | ---------------- | ------------------------------------ |
| territory.ts (residual)   | ~1500-2000       | Conquista, controle, overview, feed  |
| faction-war.ts            | ~800-1000        | Guerra entre faccoes                 |
| propina.ts                | ~400-600         | Extorsao e negociacao                |
| x9-incursion.ts           | ~400-600         | Incursoes policiais                  |
| baile.ts                  | ~300-400         | Eventos de baile                     |

**Dependencia**: Etapa 2 segue recomendada para padronizacao global de erros, mas a extracao desta etapa foi executada preservando `TerritoryError` e contratos locais para nao bloquear o fatiamento.

**Criterio de conclusao**: `territory.ts` < 2000 linhas. Cada novo servico < 1000 linhas. Todos os testes existentes passam.

**Resultado executado**:

| Arquivo                                 | Linhas reais | Responsabilidade consolidada               |
| --------------------------------------- | ------------ | ------------------------------------------ |
| territory.ts                            | 1770         | Conquista, controle, servicos e satisfacao |
| faction-war.ts                          | 988          | Guerra entre faccoes                       |
| propina.ts                              | 439          | Extorsao e negociacao                      |
| x9-incursion.ts                         | 566          | Incursoes policiais e desenrolo            |
| baile.ts                                | 382          | Eventos de baile                           |
| territory/overview.ts                   | 626          | Overview, transicoes e loss feed           |
| territory/combat.ts                     | 110          | Helpers compartilhados de combate          |

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server -- territory-route.test.ts`
- `npm run test --workspace @cs-rio/server`

---

## Etapa 4 — Fatiamento de faction.ts e market.ts

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com extracao dos fluxos de lideranca e tesouraria de `faction.ts`, extracao do fluxo de leiloes e do repositório de `market.ts` e validacao automatizada completa no workspace `@cs-rio/server`.

**Objetivo**: Reduzir faction.ts (1.635 linhas) e market.ts (2.126 linhas) para modulos coesos.

### 4.1 — Extrair `FactionLeadershipService`

Arquivo: `apps/server/src/services/faction-leadership.ts`

Responsabilidades migradas:
- Eleicoes de lideranca
- Desafios de lideranca
- Votacao
- Suporte de campanha

Estimativa: ~400-500 linhas.

### 4.2 — Extrair `FactionBankService`

Arquivo: `apps/server/src/services/faction-bank.ts`

Responsabilidades migradas:
- Depositos e saques na treasury
- Ledger de transacoes
- Auditoria financeira

Estimativa: ~300-400 linhas.

### 4.3 — Extrair `MarketAuctionService`

Arquivo: `apps/server/src/services/market-auction.ts`

Responsabilidades migradas:
- Criacao de leiloes
- Lances (bidding)
- Liquidacao (settlement)
- Notificacoes de leilao

Estimativa: ~700-900 linhas.

### 4.4 — Resultado esperado

| Arquivo                   | Linhas estimadas | Responsabilidade                |
| ------------------------- | ---------------- | ------------------------------- |
| faction.ts (residual)     | ~700-900         | CRUD de faccao, membros, upgrades |
| faction-leadership.ts     | ~400-500         | Eleicoes e desafios             |
| faction-bank.ts           | ~300-400         | Treasury e ledger               |
| market.ts (residual)      | ~800-1000        | Orders, system offers           |
| market-auction.ts         | ~700-900         | Leiloes completos               |

**Criterio de conclusao**: Nenhum servico > 1000 linhas. Todos os testes passam.

**Resultado executado**:

| Arquivo                      | Linhas reais | Responsabilidade consolidada            |
| ---------------------------- | ------------ | --------------------------------------- |
| faction.ts                   | 951          | CRUD de faccao, membros e upgrades      |
| faction-bank.ts              | 132          | Treasury e ledger                       |
| faction-leadership.ts        | 715          | Eleicoes, votos e desafios              |
| market.ts                    | 798          | Orders e ofertas sistemicas             |
| market-auction.ts            | 488          | Leiloes, lances e settlement            |
| market-repository.ts         | 934          | Repositorio DB e contratos internos     |

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server -- faction-route.test.ts market-route.test.ts composite-financial-transactions.test.ts http-schemas.test.ts action-idempotency-routes.test.ts`
- `npm run test --workspace @cs-rio/server`

---

## Etapa 5 — Container de DI no server

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com extracao completa do wiring de servicos para `container.ts`, preservacao do contrato de `createApp(options)` para testes e reducao de `app.ts` a um shell HTTP fino. Validacao final executada no workspace `@cs-rio/server`.

**Objetivo**: Substituir 190 linhas de wiring manual em `app.ts` por container de injecao de dependencias.

**Problema atual** (`app.ts:100-290`):
- 30+ flags `ownsXService`
- 30+ instanciacoes `new ServiceClass()`
- 30+ hooks `onClose` condicionais
- Cada novo servico requer 5+ linhas novas

### 5.1 — Criar modulo de container

Arquivo: `apps/server/src/container.ts`

Implementar container simples sem biblioteca externa (manter zero deps novas):

```typescript
export interface ServiceContainer {
  authService: AuthService;
  bankService: BankService;
  // ... todos os servicos
  close(): Promise<void>;
}

export function createServiceContainer(
  overrides?: Partial<ServiceContainerOverrides>,
): ServiceContainer {
  // Instancia servicos com resolucao de dependencias
  // Permite overrides para testes
}
```

### 5.2 — Migrar `app.ts`

Reduzir de ~190 linhas de wiring para ~20 linhas:

```typescript
const container = createServiceContainer(options);
registerRoutes(app, container);
app.addHook('onClose', () => container.close());
```

### 5.3 — Migrar testes

Testes que criam `createApp({ authService: mockAuth })` continuam funcionando — o container aceita overrides.

**Criterio de conclusao**: `app.ts` < 120 linhas. Zero flags `ownsXService`. Todos os testes passam.

**Resultado executado**:

| Arquivo        | Linhas reais | Responsabilidade consolidada                              |
| -------------- | ------------ | --------------------------------------------------------- |
| app.ts         | 62           | bootstrap Fastify, hooks, hardening e registro das rotas  |
| container.ts   | 383          | resolucao de servicos, overrides de teste e lifecycle     |

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server`

**Resultado da validacao**:
- `app.ts` caiu para `62` linhas
- zero flags `ownsXService` em `app.ts`
- `createApp(options)` preservado com overrides compatíveis para a suíte
- `@cs-rio/server`: `63` arquivos / `332` testes passando

---

## Etapa 6 — Segregacao de interfaces (ISP)

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com extracao de `KeyValueStore` para um modulo segregado, especializacao dos consumidores do server por capacidade real (`reader`, `writer`, `atomic`) e fatiamento de `TerritoryRepository` em contratos menores por dominio. Validacao final executada no workspace `@cs-rio/server`.

**Objetivo**: Interfaces amplas demais devem ser divididas para que consumidores dependam apenas do que usam.

### 6.1 — Segregar `KeyValueStore`

Arquivo: `apps/server/src/services/key-value-store.ts`

```typescript
// De 1 interface com 6 metodos:
export interface KeyValueStore {
  close?(): Promise<void>;
  delete?(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  increment(key: string, ttlSeconds: number): Promise<number>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setIfAbsent?(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
}

// Para interfaces segregadas:
export interface KeyValueReader {
  get(key: string): Promise<string | null>;
}

export interface KeyValueWriter extends KeyValueReader {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

export interface KeyValueAtomic extends KeyValueWriter {
  increment(key: string, ttlSeconds: number): Promise<number>;
  setIfAbsent?(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
}

export interface KeyValueStore extends KeyValueAtomic {
  close?(): Promise<void>;
  delete?(key: string): Promise<void>;
}
```

**Resultado executado**:

- criado `apps/server/src/services/key-value-store.ts` com:
  - `KeyValueReader`
  - `KeyValueWriter`
  - `KeyValueAtomic`
  - `KeyValueDelete`
  - `KeyValueLifecycle`
  - `KeyValueStore`
  - aliases `ManagedKeyValueAtomic` e `ManagedKeyValueWriter`
- `apps/server/src/services/auth.ts` passou a consumir/reexportar os contratos segregados, mantendo `RedisKeyValueStore` compativel com o restante do server
- consumidores especializados foram ajustados:
  - `ActionIdempotency` -> `ManagedKeyValueAtomic`
  - `http-hardening` / rate limit -> `KeyValueAtomic`
  - `resource-state` -> `KeyValueReader` e `KeyValueWriter`
  - `player-cache` -> `KeyValueDelete`
  - `territory` -> `KeyValueWriter`
- o container e as rotas HTTP foram alinhados sem quebrar o wiring existente

Servicos que so leem (cache reads) dependem de `KeyValueReader`. Servicos que precisam de atomicidade (idempotency, rate limit) dependem de `KeyValueAtomic`.

### 6.2 — Segregar `TerritoryRepository`

**Resultado executado**:

- `apps/server/src/services/territory/types.ts` passou a expor interfaces menores por dominio:
  - `TerritoryCoreReadRepository`
  - `TerritoryOverviewReadRepository`
  - `TerritoryConquestRepository`
  - `TerritoryFavelaServiceRepository`
  - `TerritoryWarRepository`
  - `TerritoryPropinaRepository`
  - `TerritoryX9Repository`
  - `TerritoryBaileRepository`
- os contratos compostos ficaram como aliases de intersecao:
  - `TerritoryRepository`
  - `TerritoryFactionWarRepository`
  - `TerritoryPropinaDomainRepository`
  - `TerritoryX9DomainRepository`
  - `TerritoryBaileDomainRepository`
- consumidores foram restringidos ao dominio que realmente usam:
  - `FactionWarService` -> `TerritoryFactionWarRepository`
  - `PropinaService` -> `TerritoryPropinaDomainRepository`
  - `X9IncursionService` -> `TerritoryX9DomainRepository`
  - `BaileService` -> `TerritoryBaileDomainRepository`

**Criterio de conclusao**: Nenhuma interface com mais de 15 metodos.

**Resultado da implementacao**:
- `key-value-store.ts`: `25` linhas
- `TerritoryRepository` deixou de existir como interface monolitica e virou composicao de 8 contratos
- maior interface territorial ficou com `9` metodos (`TerritoryOverviewReadRepository`)

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server`

**Resultado da validacao**:
- `@cs-rio/server`: `63` arquivos / `332` testes passando
- `typecheck` verde
- `eslint` verde
- criterio da etapa atingido:
  - consumidores do key-value store especializados por capacidade real
  - nenhum contrato territorial acima de `15` metodos
  - suite existente preservada

---

## Etapa 7 — Error handler extensivel (OCP)

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com registry extensivel de mapeadores por dominio, extracao dos mapeadores padrao para modulo proprio e simplificacao de `http-errors.ts` para resolver `DomainError` por registro. Validacao final executada no workspace `@cs-rio/server`.

**Objetivo**: Tornar `http-errors.ts` extensivel sem modificacao.

### 7.1 — Implementar error mapper registry

Arquivo: `apps/server/src/api/http-error-registry.ts`

```typescript
export interface DomainErrorMapper {
  domain: string;
  resolveStatusCode(code: string): number;
}

const registry = new Map<string, DomainErrorMapper>();

export function registerErrorMapper(mapper: DomainErrorMapper): void {
  registry.set(mapper.domain, mapper);
}

export function resolveDomainErrorStatus(error: DomainError): number {
  const mapper = registry.get(error.domain);
  return mapper?.resolveStatusCode(error.code) ?? resolveDefaultStatus(error.category);
}
```

### 7.2 — Registrar mappers por servico

Cada servico registra seu mapper na inicializacao:

```typescript
registerErrorMapper({
  domain: 'faction',
  resolveStatusCode: (code) => ({
    forbidden: 403,
    not_found: 404,
    rate_limited: 429,
  })[code] ?? 409,
});
```

### 7.3 — Simplificar `http-errors.ts`

Substituir o bloco de 26 `instanceof` checks por:

```typescript
if (error instanceof DomainError) {
  const statusCode = resolveDomainErrorStatus(error);
  return { statusCode, category: error.category, message: error.message };
}
```

**Dependencia**: Etapa 2 (DomainError).

**Criterio de conclusao**: `http-errors.ts` < 200 linhas. Zero instanceof checks de servicos especificos. Adicionar novo servico nao requer modificar `http-errors.ts`.

**Resultado executado**:

- criado `apps/server/src/api/http-error-registry.ts` com:
  - `DomainErrorMapper`
  - `registerErrorMapper(...)`
  - `clearErrorMappers()`
  - `resolveDomainErrorStatus(...)`
  - `createFixedStatusCodeMapper(...)`
  - `mapDomainErrorCategoryToStatus(...)`
- criado `apps/server/src/api/http-error-mappers.ts` com o registro dos mapeadores padrao do projeto
- `apps/server/src/api/http-errors.ts` foi simplificado para:
  - registrar os mapeadores padrao na instalacao do handler global
  - resolver `DomainError` via `resolveDomainErrorStatus(...)`
  - remover a tabela local de overrides HTTP por dominio
  - manter zero `instanceof` de servicos especificos
- adicionado teste dedicado em `apps/server/test/http-error-registry.test.ts` provando que um dominio novo pode definir status HTTP sem alterar `http-errors.ts`

**Resultado da implementacao**:
- `http-errors.ts`: `193` linhas
- zero `instanceof XError` ou checks de servicos especificos no handler
- novos dominios agora entram por registry, sem modificar `http-errors.ts`

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server -- http-errors.test.ts http-error-registry.test.ts`
- `npm run test --workspace @cs-rio/server`

**Resultado da validacao**:
- `@cs-rio/server`: `64` arquivos / `334` testes passando
- `typecheck` verde
- `eslint` verde
- criterio da etapa atingido:
  - `http-errors.ts < 200`
  - zero checks de servicos especificos
  - extensao por registry validada em teste

---

## Etapa 8 — Fatiamento mobile: App.tsx e stores

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com extracao de `usePollManager`, `RootNavigator`, `RootModals`, divisao de stores (`audio`, `notification`, `eventFeed`, `tutorial`, `ui`, `inventory`) e conversao de `appStore` em hub/facade de composicao. `authStore` deixou de carregar mutacoes de inventario. Validacao automatizada completa no workspace `@cs-rio/mobile`: `typecheck`, `eslint` e `41` arquivos / `125` testes passando.

**Objetivo**: Reduzir `App.tsx` de 1.313 linhas e dividir stores inchados.

### 8.1 — Extrair `usePollManager` hook

Arquivo: `apps/mobile/src/hooks/usePollManager.ts`

Migrar as 10 funcoes de polling de AppContent (linhas 270-866) para um hook dedicado:

- pollEventFeed
- pollEventResults
- pollPrivateMessages
- pollSabotageCues
- pollTribunalCues
- pollAttackNotifications
- pollWarResults
- pollTerritoryLosses
- pollAsyncActivityResults
- pollFactionPromotionResults

O hook encapsula os 17 useRefs, os intervalos, e a logica de dedup.

Estimativa de reducao: ~600 linhas do AppContent.

### 8.2 — Extrair `RootNavigator`

Arquivo: `apps/mobile/src/navigation/RootNavigator.tsx`

Migrar as 28 declaracoes de Stack.Screen (linhas 995-1163) para componente dedicado.

Estimativa de reducao: ~170 linhas.

### 8.3 — Extrair `RootModals`

Arquivo: `apps/mobile/src/components/RootModals.tsx`

Migrar a renderizacao condicional dos 8 modais (linhas 1170-1282) para componente dedicado.

Estimativa de reducao: ~110 linhas.

### 8.4 — Dividir `appStore`

De 1 store com 12+ propriedades e 20+ setters para stores focados:

| Store novo                | Responsabilidades                     | Linhas estimadas |
| ------------------------- | ------------------------------------- | ---------------- |
| `useAudioStore`           | Volume, mute, SFX                     | ~50              |
| `useNotificationStore`    | Permissao, settings                   | ~50              |
| `useEventFeedStore`       | Feed, toasts, banners, results        | ~80              |
| `useTutorialStore`        | Progresso, steps, estado              | ~60              |
| `useUIStore`              | Bootstrap, map cues, sabotage cues    | ~40              |

### 8.5 — Limpar `authStore`

Mover operacoes de inventario (consume, equip, repair, unequip — linhas 60-109) para `useInventoryStore`.

### 8.6 — Resultado esperado

| Arquivo            | Antes  | Depois    |
| ------------------ | ------ | --------- |
| App.tsx            | 1.313  | 102       |
| appStore.ts        | 274    | 255 (hub/facade) |
| authStore.ts       | 451    | 346       |
| usePollManager.ts  | novo   | 829       |
| RootNavigator.tsx  | novo   | 237       |
| RootModals.tsx     | novo   | 162       |
| Stores novos (6)   | novos  | 444 total |

**Criterio de conclusao**: cumprido.
- `App.tsx` ficou com `102` linhas.
- Nenhum store focado ultrapassa `10` propriedades de estado:
  - `useAudioStore`: `1`
  - `useNotificationStore`: `1`
  - `useEventFeedStore`: `9`
  - `useTutorialStore`: `1`
  - `useUIStore`: `2`
  - `useInventoryStore`: `0` propriedades de estado, apenas mutacoes
- A divergencia principal em relacao a estimativa foi `usePollManager`, que ficou maior para absorver integralmente o polling, os `refs` de deduplicacao e os closes dos cues antes espalhados em `App.tsx`.

---

## Etapa 9 — Fatiamento mobile: HomeScreen e GameView

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com `useHomeMapData`, `useHomeHudController`, `HomeHudPanel`, `useGameCamera` e `useGameInput`. A antiga `HomeHudOverlay` foi mantida como superficie renderizadora do HUD, agora acionada por `HomeHudPanel`, enquanto a orquestracao saiu de `HomeScreen`. A subetapa de `HomeEventModals` foi absorvida pelo que ja havia sido feito na etapa 8, porque os modais assincronos ficaram centralizados em `RootModals` e nao fazia sentido recriar uma camada paralela dentro da Home. Validacao automatizada completa no workspace `@cs-rio/mobile`: `typecheck`, `eslint` e `41` arquivos / `125` testes passando.

**Objetivo**: Reduzir HomeScreen (1.654 linhas) e GameView (960 linhas).

### 9.1 — Extrair `useHomeMapData` hook

Se nao existir, criar hook que encapsula:
- Territory overview fetch
- Event runtime state fetch
- Round summary e inflation fetch
- Os 3 catch blocks silenciosos (linhas 149, 161, 183)

### 9.2 — Extrair `<HomeHudPanel>`

Componente com:
- StatusBar
- ResourceRow
- RoundIndicator
- ActionBar integration

### 9.3 — Extrair `<HomeEventModals>`

Componente com todos os modais de eventos e resultados renderizados condicionalmente.

### 9.4 — Extrair `useGameCamera` hook

De GameView, extrair:
- Estado inicial da camera
- Follow/free/recenter modes
- Debug overlay

### 9.5 — Extrair `useGameInput` hook

De GameView, extrair:
- Gesture handlers (tap, pan, pinch)
- Tile/entity hit detection
- UI rect blocking

### 9.6 — Resultado esperado

| Arquivo                | Antes  | Depois    |
| ---------------------- | ------ | --------- |
| HomeScreen.tsx         | 1.654  | 244       |
| GameView.tsx           | 960    | 656       |
| HomeHudPanel.tsx       | novo   | 9         |
| HomeHudOverlay.tsx     | 585    | 511       |
| useHomeHudController.ts| novo   | 1.549     |
| useHomeMapData.ts      | novo   | 130       |
| useGameCamera.ts       | novo   | 247       |
| useGameInput.ts        | novo   | 297       |

**Criterio de conclusao**: cumprido.
- `HomeScreen.tsx` ficou com `244` linhas.
- `GameView.tsx` ficou com `656` linhas.
- Nenhum componente passou de `800` linhas:
  - `HomeScreen.tsx`: `244`
  - `GameView.tsx`: `656`
  - `HomeHudOverlay.tsx`: `511`
- A principal divergencia para o plano original foi a troca de `HomeEventModals` por `useHomeHudController`: a camada de modais ja havia sido extraida para `RootModals` na etapa 8, entao a reducao real de complexidade da Home veio de mover estados, handlers e copy operacional para um hook dedicado.

---

## Etapa 10 — React.memo e otimizacao de renders

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com memoizacao dos componentes pesados do canvas e do HUD, estabilizacao de callback critico do `GameView` e validacao completa no workspace `@cs-rio/mobile`. O repositório nao possui harness de profiler interativo em device/browser; a confirmacao operacional desta etapa foi feita por auditoria da superficie renderizadora, contagem de componentes memoizados e esteira verde.

**Objetivo**: Aplicar React.memo em componentes pesados que re-renderizam desnecessariamente.

**Problema**: 194 useMemo + 189 useCallback no codebase, mas 0 React.memo. Memoizar computacoes sem memoizar componentes limita o beneficio.

### 10.1 — Wrap com React.memo (alta prioridade)

| Componente          | Arquivo                              | Motivo                          |
| ------------------- | ------------------------------------ | ------------------------------- |
| GameCanvasScene     | components/game-view/               | Rendering pesado (Skia canvas)  |
| GameOverlayLayer    | components/game-view/               | Re-renderizado a cada frame     |
| Minimap             | components/hud/Minimap.tsx           | Atualizado frequentemente       |
| ActionBar           | components/hud/ActionBar.tsx         | Deveria ser estavel entre renders |

### 10.2 — Wrap com React.memo (media prioridade)

| Componente          | Arquivo                              | Motivo                          |
| ------------------- | ------------------------------------ | ------------------------------- |
| StatusBar           | components/hud/StatusBar.tsx         | Display puro                    |
| HudToast            | components/hud/HudToast.tsx          | Display puro                    |
| ContextMenu         | components/hud/ContextMenu.tsx       | Ativado por evento              |
| CrimeResultModal    | components/CrimeResultModal.tsx      | Modal pesado                    |

### 10.3 — Auditar over-memoization

Revisar useCallbacks com dependency arrays > 8 items. Se as dependencias mudam frequentemente, o useCallback nao ajuda e adiciona overhead.

**Criterio de conclusao**: Pelo menos 8 componentes com React.memo. Profile antes e depois para confirmar melhoria.

**Resultado executado**:

- `React.memo` aplicado nos componentes de maior custo ou maior frequencia de re-render:
  - `GameCanvasScene`
  - `GameOverlayLayer`
  - `Minimap`
  - `GridBackdrop`
  - `LegendItem`
  - `ActionBar`
  - `StatusBar`
  - `HudToast`
  - `ContextMenu`
  - `CrimeResultModal`
  - `MetricCard`
  - `HomeHudOverlay`
  - `HomeHudPanel`
- `apps/mobile/src/components/GameView.tsx` ganhou estabilizacao explicita de `onFollowPress`, evitando invalidar o `memo` de `GameOverlayLayer` por callback inline recriado em cada render
- a auditoria de over-memoization da Home foi feita em torno dos callbacks que alimentam os componentes memoizados; os `useCallback` restantes do `useHomeHudController` foram mantidos porque ainda funcionam como fronteira de estabilidade para props do HUD

**Resultado da implementacao**:
- `13` componentes memoizados no recorte mobile relevante desta etapa
- `GameView` passou a fornecer `onFollowPress` estavel para a camada de overlay
- o HUD e a camada de canvas agora podem pular renders quando o pai atualiza sem mudar as props realmente observadas

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/mobile`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/mobile`
- `npm run build --workspace @cs-rio/mobile`

**Resultado da validacao**:
- `@cs-rio/mobile`: `41` arquivos / `125` testes passando
- `typecheck` verde
- `eslint` verde
- `build` verde
- criterio da etapa atingido:
  - pelo menos `8` componentes com `React.memo` (`13` aplicados)
  - componentes pesados do canvas e do HUD protegidos contra rerenderes evitaveis
  - esteira do mobile preservada

---

## Etapa 11 — Limpeza de code smells

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com eliminacao de `as unknown as` do codigo-fonte e da suite de testes, propagacao de `DatabaseExecutor` pelos caminhos transacionais do server, extracao dos magic numbers relevantes de `HomeScreen.tsx` e auditoria do polling mobile. A verificacao de naming confirmou que todas as funcoes seguem o padrao `pollXxx`, entao a subetapa `11.3` foi fechada sem necessidade de refactor adicional.

**Objetivo**: Resolver type assertions, magic numbers e patterns inconsistentes.

### 11.1 — Eliminar `as unknown as DatabaseClient`

**Problema**: ~32 ocorrencias de `as unknown as` no server, principalmente para typing de transacoes Drizzle.

**Acao**: Criar tipo utilitario:

```typescript
// db/types.ts
import type { PgTransaction } from 'drizzle-orm/pg-core';

export type TransactionExecutor = PgTransaction<...> | typeof db;
```

Usar este tipo em vez de `as unknown as DatabaseClient` em todos os repositories.

### 11.2 — Extrair magic numbers do HomeScreen

| Valor | Contexto                      | Constante sugerida                |
| ----- | ----------------------------- | --------------------------------- |
| 24    | property marker min X         | MARKER_MIN_X                      |
| 21    | property marker offset        | MARKER_OFFSET_X                   |
| 48    | property marker margin        | MARKER_MARGIN                     |
| 18    | distancia maxima de jogadores | RELEVANT_PLAYER_MAX_DISTANCE      |
| 2     | jogadores minimos visiveis    | RELEVANT_PLAYER_MIN_COUNT         |
| 3     | jogadores maximos visiveis    | RELEVANT_PLAYER_MAX_COUNT         |

### 11.3 — Padronizar naming de funcoes de polling

Todas as funcoes de polling seguem o pattern `pollXxx`. Verificar e alinhar qualquer outlier.

**Resultado executado**:

- o server passou a usar `DatabaseExecutor` diretamente em:
  - `faction/repository`
  - `bank`
  - `market-repository`
  - `config-operations`
  - `pvp`
- os pontos que ainda faziam double-cast para ledger faccional ou transacao Drizzle foram limpos em:
  - `boca`
  - `front-store`
  - `rave`
  - `puteiro`
  - `slot-machine`
  - `territory/repository`
- os snapshots operacionais de `player-ops`, `world-ops` e `round-ops` passaram a usar `toJsonRecord(...)`, removendo casts duplos sem perder serializacao
- `HomeScreen.tsx` ganhou constantes nomeadas para distancia e distribuicao visual dos marcadores:
  - `RELEVANT_REMOTE_PLAYER_MAX_DISTANCE`
  - `RELEVANT_REMOTE_PLAYER_MIN_COUNT`
  - `RELEVANT_REMOTE_PLAYER_MAX_COUNT`
  - `PROPERTY_MARKER_MIN_X`
  - `PROPERTY_MARKER_MIN_Y`
  - `PROPERTY_MARKER_OFFSET_X`
  - `PROPERTY_MARKER_OFFSET_Y`
  - `PROPERTY_MARKER_RESERVED_WIDTH`
  - `PROPERTY_MARKER_RESERVED_HEIGHT`
- a auditoria do polling confirmou que o hook `usePollManager` ja estava totalmente padronizado em `pollXxx`, entao nenhuma renomeacao foi necessaria
- a suite de testes do server tambem foi limpa para remover `as unknown as` residuais em mocks e acessos a internals

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `npm run typecheck --workspace @cs-rio/mobile`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server`
- `npm run test --workspace @cs-rio/mobile`

**Resultado da validacao**:
- `@cs-rio/server`: `64` arquivos / `334` testes passando
- `@cs-rio/mobile`: `41` arquivos / `125` testes passando
- `typecheck` verde em `server` e `mobile`
- `eslint` verde
- criterio da etapa atingido:
  - zero `as unknown as` no codigo-fonte e na suite de testes
  - zero magic numbers remanescentes no trecho critico de renderizacao da Home
  - naming de polling auditado e consistente

---

## Etapa 12 — Validacao client-side e catch blocks

> **Status**: concluida em 2026-03-16.
> Implementacao aplicada com validacao client-side de comprimento para chat/coordenacao faccional, centralizacao de warnings de storage persistido e documentacao dos fallbacks silenciosos remanescentes no mobile. O plano original ainda citava `HomeScreen.tsx`, mas os `catch blocks` desse fluxo ja tinham sido extraidos para `useHomeMapData` na etapa 9; a entrega foi aplicada no caminho real do repositorio.

**Objetivo**: Polir os ultimos detalhes de qualidade.

### 12.1 — Adicionar validacao de comprimento no chat

Arquivo: `apps/mobile/src/services/factionRealtime.ts`

```typescript
// sendChatMessage (linha ~175):
if (normalizedMessage.length > FACTION_REALTIME_MAX_MESSAGE_LENGTH) {
  return;
}

// sendCoordinationMessage (linha ~195):
if (normalizedLabel.length > FACTION_REALTIME_MAX_LABEL_LENGTH) {
  return;
}
```

### 12.2 — Documentar catch blocks silenciosos

Para cada um dos 13 catch blocks vazios identificados, adicionar comentario explicativo ou log minimo:

| Arquivo                          | Linha | Acao                                      |
| -------------------------------- | ----- | ----------------------------------------- |
| HomeScreen.tsx                   | 149   | Comentario: round pill fallback           |
| HomeScreen.tsx                   | 161   | Comentario: territory overview fallback   |
| HomeScreen.tsx                   | 183   | Comentario: event runtime fallback        |
| storage.ts                       | 14    | Log warning: JSON parse fail              |
| event-result-storage.ts          | 13    | Log warning: JSON parse fail              |
| sabotage-storage.ts              | 13    | Log warning: JSON parse fail              |
| activity-result-storage.ts       | 13    | Log warning: JSON parse fail              |
| private-message-storage.ts       | 13    | Log warning: JSON parse fail              |
| tribunal-result-storage.ts       | 13    | Log warning: JSON parse fail              |
| territory-loss-storage.ts        | 13    | Log warning: JSON parse fail              |
| war-result-storage.ts            | 13    | Log warning: JSON parse fail              |
| baseRealtimeRoom.ts              | 107   | Ja tem comentario (manter)                |
| authStore.ts                     | 150   | Comentario: secure store fallback         |

### 12.3 — Verificacao final

Executar:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Todos verdes. Zero regressoes.

**Criterio de conclusao**: Esteira verde. Zero catch blocks sem comentario. Validacao de chat no client alinhada com constantes do shared.

**Resultado executado**:

- `FactionRealtimeService` passou a bloquear mensagens acima dos limites compartilhados em:
  - `FACTION_REALTIME_MAX_MESSAGE_LENGTH`
  - `FACTION_REALTIME_MAX_LABEL_LENGTH`
- a camada de storage ganhou `warnStorageFallback(...)` em `apps/mobile/src/features/storage.ts`, usada pelos caches de:
  - resultados de evento
  - sabotagem
  - atividades
  - mensagens privadas
  - tribunal
  - perda territorial
  - guerra
- `useHomeMapData` recebeu comentarios explicitos para os tres fallbacks silenciosos de:
  - round pill
  - territory overview
  - event runtime overlays
- `authStore` recebeu comentarios explicitos nos pontos de fallback de:
  - token expirado durante bootstrap
  - falha de hidratacao de sessao
  - refresh token invalido/expirado
- `baseRealtimeRoom.ts` foi auditado e manteve os comentarios existentes de best-effort cleanup
- cobertura nova entrou em:
  - `apps/mobile/test/faction-realtime.test.ts`
  - `apps/mobile/test/storage.test.ts`

**Validacao executada no fechamento**:
- `npm run typecheck --workspace @cs-rio/server`
- `npm run typecheck --workspace @cs-rio/mobile`
- `eslint` nos arquivos alterados da etapa
- `npm run test --workspace @cs-rio/server`
- `npm run test --workspace @cs-rio/mobile`
- `npm run build --workspace @cs-rio/server`
- `npm run build --workspace @cs-rio/mobile`

**Resultado da validacao**:
- `@cs-rio/server`: `64` arquivos / `334` testes passando
- `@cs-rio/mobile`: `42` arquivos / `128` testes passando
- `typecheck` verde em `server` e `mobile`
- `eslint` verde
- `build` verde em `server` e `mobile`
- criterio da etapa atingido:
  - validacao de chat no client alinhada com o shared
  - todos os `catch blocks` silenciosos do recorte agora tem comentario ou warning explicito
  - esteira verde sem regressao

---

## Resumo de impacto

| Etapa | Principio   | Arquivos | Risco    | Beneficio                           |
| ----- | ----------- | -------- | -------- | ----------------------------------- |
| 1     | Seguranca   | ~18      | Medio    | Elimina double-spend                |
| 2     | Clean Code  | ~30      | Medio    | Fundacao para extensibilidade       |
| 3     | SRP         | ~6       | Medio    | territory.ts 5081→2000              |
| 4     | SRP         | ~6       | Medio    | faction.ts e market.ts < 1000       |
| 5     | DIP         | ~3       | Baixo    | app.ts 190→20 linhas de wiring      |
| 6     | ISP         | ~5       | Baixo    | Interfaces enxutas                  |
| 7     | OCP         | ~3       | Baixo    | Error handler extensivel            |
| 8     | SRP         | ~12      | Medio    | App.tsx 1313→102, stores modulares  |
| 9     | SRP         | ~8       | Medio    | HomeScreen 1654→244, GameView 960→656 |
| 10    | Performance | ~8       | Baixo    | Renders otimizados                  |
| 11    | Clean Code  | ~15      | Baixo    | Zero type assertions, zero magic    |
| 12    | Polimento   | ~15      | Baixo    | Catch blocks documentados, chat ok  |

---

## Observacoes

- Cada etapa deve terminar com esteira verde (typecheck + lint + test + build).
- Etapas 1-2 sao pre-requisitos para as demais. Etapas 3-7 podem ser paralelizadas. Etapas 8-12 podem ser paralelizadas.
- O criterio de conclusao de cada etapa esta explicito. Nao avance para a proxima sem cumprir o criterio.
- Este plano nao inclui features novas. E exclusivamente sobre qualidade estrutural, seguranca e manutibilidade.
