# CHEATS.md — Plano Técnico de Operações Internas / Cheats de Desenvolvimento

## Objetivo

Criar uma camada interna de operações para desenvolvimento e playtest que permita:

- preparar contas e cenários rapidamente
- evitar esperar stamina, nervos, dinheiro, cooldown e timers naturais
- ajustar uma rodada sem editar o banco manualmente
- operar tudo por **CLI interno**, sem painel admin e sem client exposto ao usuário

Este sistema é para **desenvolvimento, QA e operação interna**.

## Princípios

- **Sem client admin por enquanto**.
- **Sem acesso para usuário final**.
- Tudo deve passar por **scripts internos** e **service layer**, não por `UPDATE` manual no banco.
- Toda mutação relevante deve deixar **trilha de auditoria**.
- Sempre que possível, os cheats devem reutilizar:
  - serviços já existentes do backend
  - `ops:config`
  - catálogo/snapshot data-driven da rodada

## Escopo

### Deve cobrir

- player
- facção
- território
- mercado / inventário
- prisão / hospital
- eventos
- rodada
- presets de cenário

### Não deve cobrir por enquanto

- painel web/admin
- menu oculto no app
- permissões granulares multi-operador
- editor visual de cenário

## Base já existente

Hoje já existe uma base útil para isso:

- comando interno de configuração em `apps/server/src/scripts/config-command.ts`
- serviço de operações de configuração em `apps/server/src/services/config-operations.ts`
- catálogo data-driven por banco
- snapshots por rodada
- auditoria de config

O sistema de cheats deve nascer **em cima dessa filosofia operacional**, não como uma solução paralela improvisada.

---

## Arquitetura-alvo

### Camadas

1. **CLI scripts**
   - comandos executados via `npm run ... --workspace @cs-rio/server`

2. **Application services**
   - uma camada dedicada para mutações operacionais
   - ex.: `player-ops.ts`, `scenario-ops.ts`

3. **Domain services existentes**
   - `PlayerService`
   - `FactionService`
   - `TerritoryService`
   - `MarketService`
   - `RoundService`
   - `GameEventService`

4. **Audit log**
   - cada operação deve registrar:
     - quem/qual comando executou
     - alvo
     - antes/depois
     - rodada
     - timestamp
     - payload

### Formatos de uso

Dois formatos devem coexistir:

- **comando direto**
  - ideal para mudanças pequenas e rápidas

- **arquivo de cenário**
  - ideal para aplicar muitos ajustes de uma vez

Exemplos desejados:

```bash
npm run ops:player --workspace @cs-rio/server -- --player flucesar --set-money 500000
npm run ops:player --workspace @cs-rio/server -- --player flucesar --set-region zona_norte
npm run ops:player --workspace @cs-rio/server -- --player flucesar --set-stamina 100 --set-nerve 100
npm run ops:player --workspace @cs-rio/server -- --player flucesar --grant-item weapon:pistola_380:1
```

```bash
npm run ops:scenario --workspace @cs-rio/server -- --apply starter-pack --player flucesar
npm run ops:scenario --workspace @cs-rio/server -- --file ./scenarios/zona-norte-war.json
```

---

## Fases

## Métricas de Progresso

| Fase | Tarefas | Concluídas | % |
|---|---|---|---|
| Fase 0 — Fundação Operacional | 5 | 5 | 100% |
| Fase 1 — Operações de Player | 8 | 8 | 100% |
| Fase 2 — Operações de Facção / Território / Economia | 9 | 9 | 100% |
| Fase 3 — Cenários Reutilizáveis | 9 | 9 | 100% |
| Fase 4 — Rodada / Eventos / Mundo | 7 | 7 | 100% |
| Fase 5 — Segurança / Auditoria / Guardrails | 7 | 7 | 100% |
| Fase 6 — DX / Presets / Documentação | 6 | 6 | 100% |
| **TOTAL** | **51** | **51** | **100%** |

### Estado atual

O objetivo do sistema está **atendido** para uso diário em desenvolvimento e playtest.

Hoje o backend já entrega:

- `ops:list`
- `ops:player`
- `ops:world`
- `ops:scenario`
- `ops:round`
- `ops:audit`
- `dry-run` nos comandos principais
- `--confirm` para operações sensíveis
- bloqueio por ambiente inadequado, com liberação explícita por `CSRIO_ALLOW_INTERNAL_OPS=true`
- validação semântica reaproveitada entre os comandos
- idempotência prática nos setters e re-seeds repetíveis
- trilha consultável de auditoria por player, facção, favela, rodada, comando, actor e batch

Arquivos centrais agora presentes no código:

- `apps/server/src/scripts/audit-command.ts`
- `apps/server/src/scripts/shared/cli-guards.ts`
- `apps/server/src/services/ops-guardrails.ts`
- `apps/server/src/services/ops-audit.ts`
- `apps/server/test/ops-guardrails.test.ts`
- `apps/server/test/ops-audit.test.ts`

## Catálogo de Comandos

### Descoberta rápida

Para ver o panorama geral:

```bash
cd /home/cesar/projects/cs_rio
npm run ops:help --workspace @cs-rio/server
```

Para ver a ajuda detalhada de cada CLI:

```bash
npm run ops:list     --workspace @cs-rio/server -- --help
npm run ops:player   --workspace @cs-rio/server -- --help
npm run ops:world    --workspace @cs-rio/server -- --help
npm run ops:round    --workspace @cs-rio/server -- --help
npm run ops:scenario --workspace @cs-rio/server -- --help
npm run ops:quick    --workspace @cs-rio/server -- --help
npm run ops:alias    --workspace @cs-rio/server -- --help
npm run ops:audit    --workspace @cs-rio/server -- --help
```

### `ops:list`

Consulta listas de referência para você descobrir nomes, siglas, códigos e UUIDs antes de usar os outros comandos.

Tipos suportados:

- `players` / `users`
- `factions`
- `favelas`
- `regions`
- `scenarios`

Filtros:

- `--search <texto>`
- `--region <regionId>`
- `--faction <sigla|nome|template|uuid>`
- `--fixed-only`
- `--all`
- `--limit <n>`
- `--json`

Exemplos:

```bash
cd /home/cesar/projects/cs_rio

# Lista jogadores/usuários
npm run ops:list --workspace @cs-rio/server -- --type players

# Lista facções
npm run ops:list --workspace @cs-rio/server -- --type factions

# Lista só facções fixas
npm run ops:list --workspace @cs-rio/server -- --type factions --fixed-only

# Lista favelas da Zona Norte
npm run ops:list --workspace @cs-rio/server -- --type favelas --region zona_norte

# Lista jogadores de uma facção
npm run ops:list --workspace @cs-rio/server -- --type players --faction cv

# Lista regiões
npm run ops:list --workspace @cs-rio/server -- --type regions

# Lista cenários built-in
npm run ops:list --workspace @cs-rio/server -- --type scenarios
```

Exemplos em JSON para referência/copiar:

```bash
npm run ops:list --workspace @cs-rio/server -- --type favelas --json
npm run ops:list --workspace @cs-rio/server -- --type factions --json
npm run ops:list --workspace @cs-rio/server -- --type players --json
```

### Fluxo recomendado para descobrir referências

Antes de rodar `ops:player`, `ops:world`, `ops:round` ou `ops:scenario`, use `ops:list` para descobrir o identificador correto.

Exemplos práticos:

```bash
# 1. Descobrir o código/nome da favela
npm run ops:list --workspace @cs-rio/server -- --type favelas --region zona_norte

# 2. Descobrir a facção correta
npm run ops:list --workspace @cs-rio/server -- --type factions

# 3. Descobrir o nickname/UUID do jogador
npm run ops:list --workspace @cs-rio/server -- --type players --search flu

# 4. Só então aplicar a operação
npm run ops:world --workspace @cs-rio/server -- --player flucesar --favela-code complexo_da_penha --set-favela-controller cv
```

### Guardrails comuns

Os comandos operacionais principais aceitam:

- `--dry-run`
- `--confirm`

Uso típico:

```bash
npm run ops:player --workspace @cs-rio/server -- --player flucesar --clear-prison --dry-run
npm run ops:player --workspace @cs-rio/server -- --player flucesar --clear-prison --confirm
```

### `ops:player`

Seletores:

- `--player <nickname>`
- `--nickname <nickname>`
- `--email <email>`
- `--player-id <uuid>`

Operações disponíveis:

- dinheiro:
  - `--set-money`
  - `--add-money`
  - `--set-bank-money`
  - `--add-bank-money`
- recursos:
  - `--set-hp`
  - `--set-stamina`
  - `--set-nerve`
  - `--set-morale`
  - `--set-addiction`
  - `--full-resources`
- progressão:
  - `--set-conceito`
  - `--set-level`
  - `--set-vocation`
- posição:
  - `--set-region`
  - `--set-position x:y`
  - `--move-to-region-spawn`
- status especiais:
  - `--clear-prison`
  - `--set-prison-minutes`
  - `--clear-hospital`
  - `--set-hospital-minutes`
- inventário:
  - `--grant-item tipo:codigo:quantidade`
  - `--remove-item`
  - `--set-item-quantity`
  - `--equip-item`
  - `--unequip-item`
  - `--repair-all`

Exemplo direto para sair da cadeia:

```bash
cd /home/cesar/projects/cs_rio
npm run ops:player --workspace @cs-rio/server -- --player flucesar --clear-prison
```

Exemplo para encher recursos e voltar ao teste:

```bash
npm run ops:player --workspace @cs-rio/server -- --player flucesar --full-resources --clear-prison --clear-hospital
```

### `ops:world`

Seletores/contexto:

- `--player`
- `--nickname`
- `--email`
- `--player-id`
- `--faction-code`
- `--faction-id`
- `--favela-code`
- `--favela-id`
- `--property-id`
- `--region-id`

Operações disponíveis:

- facção:
  - `--join-faction`
  - `--leave-faction`
  - `--set-rank`
  - `--set-faction-bank-money`
  - `--set-faction-points`
  - `--set-faction-internal-satisfaction`
- território:
  - `--set-favela-controller`
  - `--neutralize-favela`
  - `--set-favela-satisfaction`
  - `--set-favela-state`
  - `--set-bandits`
  - `--set-max-soldiers`
- propriedades:
  - `--grant-property`
  - `--set-property-level`
  - `--set-property-soldiers`
  - `--set-property-cash`
  - `--set-factory-output`
  - `--set-boca-stock droga:quantidade`
  - `--set-rave-stock droga:quantidade[:multiplicador]`
- mercado:
  - `--seed-market-offers`
  - `--clear-market-offers`
  - `--restock-system-offers`

### `ops:round`

Seletores/contexto:

- `--round-id`
- `--round-number`
- `--region-id`
- `--favela-code`
- `--favela-id`

Operações disponíveis:

- rodada:
  - `--set-round-day`
  - `--finish-round`
  - `--start-next-round`
  - `--snapshot-round-state`
- eventos:
  - `--trigger-event`
  - `--expire-event`
  - `--enable-event`
  - `--disable-event`
- mundo:
  - `--reseed-fixed-factions`
  - `--reseed-territories`
  - `--reseed-system-market`
  - `--rebuild-world-state`

Eventos suportados hoje:

- `navio_docas`
- `operacao_policial`
- `blitz_pm`
- `faca_na_caveira`
- `saidinha_natal`
- `carnaval`
- `ano_novo_copa`
- `operacao_verao`

### `ops:scenario`

Executa cenários versionados.

Opções:

- `--apply <cenario>`
- `--file <arquivo-json>`
- variáveis de contexto do cenário
- `--dry-run`
- `--confirm`

Cenários built-in atuais:

- `starter-pack`
- `territory-ready`
- `market-ready`
- `pvp-ready`
- `prison-ready`
- `hospital-ready`
- `tribunal-ready`
- `war-ready`
- `no-wait`
- `round-late-game`
- `hospital-loop`

Exemplo:

```bash
npm run ops:scenario --workspace @cs-rio/server -- --apply prison-ready --player flucesar
```

### `ops:quick`

Presets rápidos para playtest.

Presets atuais:

- `full-combat-kit`
- `god-lite`
- `market-fill`
- `no-wait`
- `territory-check`

Exemplo:

```bash
npm run ops:quick --workspace @cs-rio/server -- --preset no-wait --player flucesar
```

### `ops:alias`

Aliases compostos de cenário.

Aliases atuais:

- `hospital-loop`
- `north-war`
- `round-late-game`
- `tribunal-ready`

Exemplo:

```bash
npm run ops:alias --workspace @cs-rio/server -- --run hospital-loop --player flucesar
```

### `ops:audit`

Consulta o histórico operacional.

Filtros:

- `--latest`
- `--source`
- `--player`
- `--faction`
- `--favela`
- `--round-id`
- `--command`
- `--actor`
- `--batch-id`
- `--json`

Exemplo:

```bash
npm run ops:audit --workspace @cs-rio/server -- --player flucesar --latest 20
```

---

## Fase 0 — Fundação Operacional

Objetivo: criar a espinha dorsal dos comandos.

> **Saída esperada desta fase:** uma base única e previsível para operações internas, com CLIs consistentes, lookup flexível de alvo, payload composto de cenário e trilha de auditoria reaproveitável nas fases seguintes.

> **Status atual:** concluída. O backend já expõe `ops:player`, `ops:world`, `ops:scenario` e `ops:round`, todos apoiados em camadas dedicadas de serviço, lookup por múltiplas chaves e logs persistidos.

### 0.1 — Definir padrão único de CLI

- `ops:player`
- `ops:world`
- `ops:scenario`
- `ops:round`

Critério:
- todos os comandos seguem sintaxe parecida
- ajudam a evitar scripts soltos e divergentes

### 0.2 — Criar camada `ops` no backend

Arquivos-alvo esperados:
- `apps/server/src/services/player-ops.ts`
- `apps/server/src/services/world-ops.ts`
- `apps/server/src/services/scenario-ops.ts`
- `apps/server/src/scripts/player-command.ts`
- `apps/server/src/scripts/world-command.ts`
- `apps/server/src/scripts/scenario-command.ts`

### 0.3 — Resolver lookup de player por múltiplas chaves

Aceitar:
- `playerId`
- `nickname`
- `email`

### 0.4 — Definir formato de payload de cenário

Formato base desejado:

```json
{
  "round": "active",
  "player": "flucesar",
  "operations": [
    { "type": "set-money", "value": 500000 },
    { "type": "set-region", "value": "zona_norte" },
    { "type": "grant-item", "value": "weapon:pistola_380:1" }
  ]
}
```

### 0.5 — Integrar tudo com log de operação

Mesmo no MVP, tudo precisa deixar trilha.

- [x] **0.1** Definir padrão único de CLI
- [x] **0.2** Criar camada `ops` no backend
- [x] **0.3** Resolver lookup de player por múltiplas chaves
- [x] **0.4** Definir formato de payload de cenário
- [x] **0.5** Integrar tudo com log de operação

### Checklist para considerar a Fase 0 pronta

- [x] existe uma família coerente de comandos `ops:*`
- [x] o backend tem camadas dedicadas para operações de player, mundo, cenário e rodada
- [x] o alvo do jogador pode ser resolvido por múltiplas chaves
- [x] cenários compostos têm formato estável para evolução futura
- [x] toda mutação relevante já deixa trilha persistida

---

## Fase 1 — Operações de Player

Objetivo: eliminar o atrito de teste por conta individual.

> **Saída esperada desta fase:** um tester consegue pegar qualquer conta existente e, em menos de 30 segundos, colocá-la no estado exato necessário para testar login, progressão, combate, mercado, facção, prisão, hospital ou território sem editar banco manualmente.

> **Status atual:** concluída e validada. O backend já expõe `ops:player` com lookup por múltiplas chaves, auditoria persistida e cobertura automatizada.

### Decisões operacionais da Fase 1

- A Fase 1 cobre **somente estado individual do jogador**.
- Tudo deve funcionar por **CLI direto**, sem exigir arquivo de cenário.
- O alvo do comando deve aceitar:
  - `--player-id`
  - `--nickname`
  - `--email`
- Toda operação deve:
  - resolver o jogador uma única vez
  - validar o payload
  - aplicar a mutação
  - registrar trilha de auditoria
- Sempre que existir service de domínio já pronto, a operação deve reutilizá-lo.
- Quando não existir service adequado, a mutação operacional deve ficar numa camada própria de `player-ops`, sem espalhar SQL cru pelos scripts.

### Entregáveis funcionais obrigatórios da Fase 1

Ao final da fase, o sistema precisa permitir:

- alterar dinheiro e banco
- encher ou zerar recursos
- ajustar conceito / nível / vocação
- mudar região e posição do jogador
- limpar ou forçar prisão / hospital
- conceder, remover, equipar e reparar itens
- executar tudo com comando curto e previsível

Exemplos-alvo de uso ao final da fase:

```bash
npm run ops:player --workspace @cs-rio/server -- --player flucesar --set-money 500000 --set-bank-money 250000
npm run ops:player --workspace @cs-rio/server -- --player flucesar --full-resources
npm run ops:player --workspace @cs-rio/server -- --player flucesar --set-conceito 1500 --set-level 5
npm run ops:player --workspace @cs-rio/server -- --player flucesar --set-region zona_norte --move-to-region-spawn
npm run ops:player --workspace @cs-rio/server -- --player flucesar --grant-item weapon:pistola_380:1 --equip-item weapon:pistola_380
```

### Arquivos-alvo esperados

- `apps/server/src/services/player-ops.ts`
- `apps/server/src/scripts/player-command.ts`
- `apps/server/src/test/player-ops.test.ts`
- eventual apoio em:
  - `apps/server/src/services/player.ts`
  - `apps/server/src/services/prison.ts`
  - `apps/server/src/services/hospital.ts`
  - `apps/server/src/services/market.ts`

### 1.1 — Dinheiro e banco

Comandos mínimos:

- `set-money`
- `set-bank-money`
- `add-money`
- `add-bank-money`

Regras:

- aceitar inteiro positivo e zero
- impedir valor negativo quando a intenção é “set”
- registrar `before` e `after`

Critério:

- preparar poder de compra para teste não pode depender de grind

### 1.2 — Recursos instantâneos

Comandos mínimos:

- `set-hp`
- `set-stamina`
- `set-nerve`
- `set-morale`
- `set-addiction`
- `full-resources`

Regras:

- respeitar piso e teto dos recursos quando fizer sentido
- `full-resources` deve encher tudo de uma vez
- `set-morale` e `set-addiction` precisam seguir a nomenclatura vigente do backend

Critério:

- tester não espera timer natural para continuar teste

### 1.3 — Progressão

Comandos mínimos:

- `set-conceito`
- `set-level`
- `set-vocation`

Regras:

- `set-level` deve ajustar o mínimo necessário para manter coerência com `conceito`, ou deixar isso explícito em auditoria
- `set-vocation` deve aceitar só vocações válidas
- mudança de progressão deve refletir no perfil imediatamente

Critério:

- qualquer faixa do jogo pode ser testada sem grind

### 1.4 — Posição e deslocamento

Comandos mínimos:

- `set-region`
- `set-position`
- `move-to-region-spawn`

Regras:

- `set-region` deve usar a fonte de verdade atual das regiões
- `set-position` deve validar coordenadas minimamente
- `move-to-region-spawn` deve reposicionar com base no spawn oficial da região

Critério:

- o tester entra diretamente na região e no ponto que precisa

### 1.5 — Status especiais

Comandos mínimos:

- `clear-prison`
- `clear-hospital`
- `set-prison-time`
- `set-hospital-time`

Regras:

- limpar prisão/hospital deve remover o bloqueio funcional imediatamente
- forçar tempo deve aceitar minutos/segundos restantes ou timestamp, mas o formato precisa ser único e documentado
- se houver efeitos colaterais (heat, registros, motivo), isso deve ser auditado

Critério:

- prisão e hospital deixam de travar playtest

### 1.6 — Inventário

Comandos mínimos:

- `grant-item`
- `remove-item`
- `set-item-quantity`
- `equip-item`
- `unequip-item`
- `repair-all`

Regras:

- `grant-item` deve aceitar sintaxe curta `tipo:codigo:quantidade`
- `equip-item` precisa validar compatibilidade com o slot
- `repair-all` deve atuar só nos itens reparáveis
- tudo precisa refletir corretamente no perfil/inventário

Critério:

- tester consegue montar loadout real sem depender de mercado ou loot

### 1.7 — Ergonomia de uso

Além dos comandos, a fase deve fechar:

- help curto no CLI
- mensagens de erro úteis
- saída final resumindo:
  - alvo
  - operações aplicadas
  - principais valores finais

Critério:

- o comando precisa ser usável sem abrir o código toda vez

### 1.8 — Critério final da fase

Se, ao tentar preparar um jogador para teste, ainda acontecer qualquer um destes casos:

- “precisei editar banco manualmente”
- “precisei esperar stamina / nervos / dinheiro”
- “precisei fazer 10 comandos para um ajuste simples”

então a Fase 1 falhou.

- [x] **1.1** Dinheiro e banco
- [x] **1.2** Recursos instantâneos
- [x] **1.3** Progressão
- [x] **1.4** Posição e deslocamento
- [x] **1.5** Status especiais
- [x] **1.6** Inventário
- [x] **1.7** Ergonomia de uso
- [x] **1.8** Validar que qualquer estado individual é preparado em menos de 30 segundos

### Checklist para considerar a Fase 1 pronta

- [x] o CLI aceita `playerId`, `nickname` ou `email`
- [x] dinheiro e banco podem ser ajustados sem SQL manual
- [x] stamina / nervos / HP / vício / moral podem ser ajustados instantaneamente
- [x] conceito / nível / vocação podem ser alterados com segurança
- [x] região e posição podem ser forçadas
- [x] prisão e hospital podem ser limpos ou forçados
- [x] itens podem ser concedidos, removidos, equipados e reparados
- [x] toda operação deixa trilha de auditoria
- [x] a saída do comando é compreensível sem ler código
- [x] um tester consegue preparar um jogador para qualquer fluxo central em menos de 30 segundos

---

## Fase 2 — Operações de Facção / Território / Economia

Objetivo: montar rapidamente estados de facção e mapa.

> **Saída esperada desta fase:** um tester consegue preparar, em menos de 2 minutos, um cenário completo de facção, território e economia local para validar invasão, guerra, mercado, domínio, serviços, roubos e operações coletivas sem editar banco manualmente.

> **Status atual:** concluída e validada no escopo da fase. O backend já expõe `ops:world` com lookup por múltiplos alvos, auditoria persistida e cobertura automatizada. A suíte completa do monorepo continua com duas falhas antigas do mobile (`colyseus.test.ts` e `faction-realtime.test.ts`) que não pertencem a esta entrega.

### Decisões operacionais da Fase 2

- A Fase 2 cobre **estado compartilhado do mundo jogável**, não só um jogador isolado.
- A fase deve funcionar por **CLI direto**, mas já pode preparar o caminho para cenários compostos da Fase 3.
- O alvo dos comandos deve aceitar:
  - `--player`
  - `--faction-id`
  - `--faction-code`
  - `--favela-id`
  - `--favela-code`
  - `--region-id`
- Toda operação deve:
  - validar se o alvo existe
  - aplicar a mutação de forma autoritativa
  - invalidar caches/config quando necessário
  - registrar trilha de auditoria
- Sempre que possível, as mutações devem reutilizar:
  - `FactionService`
  - `TerritoryService`
  - `MarketService`
  - `RoundService`
  - `ServerConfigService`
- Quando não existir service pronto, a mutação operacional deve ficar numa camada dedicada de `world-ops`, sem espalhar SQL cru pelos scripts.

### Entregáveis funcionais obrigatórios da Fase 2

Ao final da fase, o sistema precisa permitir:

- colocar um jogador dentro ou fora de facção
- mudar cargo/rank rapidamente
- ajustar caixa, pontos e satisfação interna da facção
- transferir domínio territorial
- neutralizar favela
- ajustar satisfação, bandidos e limite de soldados
- conceder propriedades e preparar caixa/estoque de negócio
- reabastecer ou limpar oferta sistêmica do mercado

Exemplos-alvo de uso ao final da fase:

```bash
npm run ops:world --workspace @cs-rio/server -- --player flucesar --join-faction cv --set-rank cria
npm run ops:world --workspace @cs-rio/server -- --faction-code cv --set-faction-bank-money 500000 --set-faction-points 2500
npm run ops:world --workspace @cs-rio/server -- --favela-code complexo_da_penha --set-favela-controller cv --set-bandits 180 --set-favela-satisfaction 62
npm run ops:world --workspace @cs-rio/server -- --player flucesar --grant-property boca --set-property-level 3 --set-property-soldiers 12
npm run ops:world --workspace @cs-rio/server -- --restock-system-offers
```

### Arquivos-alvo esperados

- `apps/server/src/services/world-ops.ts`
- `apps/server/src/scripts/world-command.ts`
- `apps/server/src/test/world-ops.test.ts`
- eventual apoio em:
  - `apps/server/src/services/faction.ts`
  - `apps/server/src/services/territory.ts`
  - `apps/server/src/services/property.ts`
  - `apps/server/src/services/market.ts`
  - `apps/server/src/services/bank.ts`

### 2.1 — Facção

- `join-faction`
- `leave-faction`
- `set-rank`
- `set-faction-bank-money`
- `set-faction-points`
- `set-faction-internal-satisfaction`

Regras:

- `join-faction` deve aceitar facção fixa ou criada
- `leave-faction` deve limpar vínculo e refletir isso no perfil do jogador
- `set-rank` deve validar ranks existentes
- caixa e pontos devem refletir no backend sem depender de ação in-game posterior

Critério:

- qualquer fluxo faccional pode ser preparado instantaneamente

### 2.2 — Território

- `set-favela-controller`
- `neutralize-favela`
- `set-favela-satisfaction`
- `set-favela-state`
- `set-bandits`
- `set-max-soldiers`

Regras:

- `set-favela-controller` deve aceitar facção e neutralidade
- `set-favela-state` deve cobrir pelo menos:
  - neutra
  - controlada
  - guerra
  - x9 / pressão alta quando fizer sentido
- `set-bandits` e `set-max-soldiers` devem atualizar a fonte de verdade do território

Critério:

- um teste de invasão, domínio ou guerra não pode depender de preparar o mapa manualmente no banco

### 2.3 — Propriedades e negócios

- `grant-property`
- `set-property-level`
- `set-property-soldiers`
- `set-property-cash`
- `set-factory-output`
- `set-boca-stock`
- `set-rave-stock`

Regras:

- `grant-property` deve aceitar o tipo de propriedade e vinculá-la ao jogador
- `set-property-soldiers` deve respeitar o shape atual do modelo de propriedade
- `set-property-cash` deve permitir preparar coleta imediata
- estoque e produção devem refletir no fluxo do negócio sem “tick” natural obrigatório

Critério:

- tester consegue montar boca, fábrica e rave prontas para validar sem grind

### 2.4 — Mercado

- `seed-market-offers`
- `clear-market-offers`
- `restock-system-offers`

Regras:

- `seed-market-offers` deve semear ofertas mínimas previsíveis
- `clear-market-offers` deve afetar só ofertas sistêmicas ou deixar isso explícito
- `restock-system-offers` deve simular reposição da rodada sem depender do relógio natural

Critério:

- o Mercado Negro nunca fica “morto” durante playtest por falta de oferta

### 2.5 — Critério final da fase

Se, ao tentar preparar um cenário de facção, território ou economia, ainda acontecer qualquer um destes casos:

- “precisei editar facção direto no banco”
- “precisei neutralizar ou dominar favela manualmente”
- “precisei criar oferta de mercado ou caixa de negócio na mão”
- “precisei de 10 passos para preparar um cenário de guerra”

então a Fase 2 falhou.

- [x] **2.1** Facção
- [x] **2.2** Território
- [x] **2.3** Propriedades e negócios
- [x] **2.4** Mercado
- [x] **2.5** Validar que facção/território/economia são preparados em menos de 2 minutos

### Checklist para considerar a Fase 2 pronta

- [x] é possível colocar ou tirar qualquer jogador de uma facção sem SQL manual
- [x] é possível ajustar rank, caixa, pontos e satisfação interna da facção
- [x] é possível transferir, neutralizar e parametrizar qualquer favela
- [x] é possível ajustar bandidos e limite de soldados por favela
- [x] é possível conceder propriedade e preparar negócio sem grind
- [x] é possível reabastecer ou limpar a oferta sistêmica do mercado
- [x] toda operação deixa trilha de auditoria
- [x] um tester consegue montar um cenário de facção/território/economia em menos de 2 minutos

---

## Fase 3 — Cenários Reutilizáveis

Objetivo: evitar repetir 15 comandos manuais toda vez.

> **Saída esperada desta fase:** um tester consegue preparar fluxos centrais do jogo por **nome de cenário**, sem lembrar uma sequência manual de 5 a 15 comandos. A CLI deve aceitar presets reutilizáveis e arquivos compostos, preservando auditoria e previsibilidade.

> **Status atual:** concluída. O backend já expõe `ops:scenario` com presets por nome, execução por arquivo, biblioteca versionada de cenários, auditoria por lote e cobertura automatizada.

### Decisões operacionais da Fase 3

- A Fase 3 deve **compor** o que já foi entregue em `ops:player` e `ops:world`; ela não deve duplicar lógica de mutação.
- O sistema precisa aceitar dois formatos de entrada:
  - `--apply <scenario-name>`
  - `--file ./caminho/do-cenario.json`
- Todo cenário deve ser:
  - idempotente quando fizer sentido
  - auditável como lote único
  - legível o bastante para revisão em PR
- A fase deve suportar:
  - cenário com **um jogador**
  - cenário com **vários jogadores**
  - cenário com **mundo + rodada + facções**
- Cada preset deve declarar explicitamente:
  - alvo principal
  - pré-condições mínimas
  - operações compostas
  - saída esperada

### Entregáveis funcionais obrigatórios da Fase 3

Ao final da fase, o sistema precisa permitir:

- aplicar um preset curto por nome
- carregar um cenário composto de arquivo
- preparar múltiplos fluxos centrais em segundos
- registrar auditoria por cenário aplicado
- mostrar um resumo final que diga claramente o que foi montado

Exemplos-alvo de uso ao final da fase:

```bash
npm run ops:scenario --workspace @cs-rio/server -- --apply starter-pack --player flucesar
npm run ops:scenario --workspace @cs-rio/server -- --apply territory-ready --player flucesar --faction-code cv --region-id zona_norte
npm run ops:scenario --workspace @cs-rio/server -- --apply war-ready --player flucesar --file apps/server/src/scripts/scenarios/war-ready.json
```

### Arquivos-alvo esperados

- `apps/server/src/services/scenario-ops.ts`
- `apps/server/src/scripts/scenario-command.ts`
- `apps/server/src/scripts/scenarios/*.json`
- `apps/server/src/test/scenario-ops.test.ts`
- eventual apoio em:
  - `apps/server/src/services/player-ops.ts`
  - `apps/server/src/services/world-ops.ts`
  - `apps/server/src/services/round-ops.ts`

### 3.1 — `starter-pack`

Entrega:
- dinheiro inicial alto
- recursos cheios
- kit básico de arma/colete/drogas
- região configurável

Regras:
- deve funcionar sobre conta nova ou antiga
- deve deixar o jogador pronto para crimes, mercado e deslocamento
- não deve prender o teste a facção ou território

Critério:
- qualquer tester entra no jogo e começa a testar o loop base em menos de 1 minuto

### 3.2 — `territory-ready`

Entrega:
- jogador dentro de facção
- rank adequado
- região correta
- recursos para invadir

Regras:
- deve aceitar facção por código/id
- deve mover o jogador para a região certa
- deve garantir condições mínimas para abrir `TerritoryScreen` e testar conquista

Critério:
- invasão e domínio podem ser testados sem preparação manual longa

### 3.3 — `market-ready`

Entrega:
- inventário com itens vendáveis
- ofertas sistêmicas repostas
- dinheiro suficiente para compra

Regras:
- deve deixar o jogador apto a comprar, vender, reparar e leiloar
- deve garantir que o mercado não apareça “morto”
- deve respeitar o catálogo sistêmico da rodada

Critério:
- o Mercado Negro fica testável imediatamente

### 3.4 — `pvp-ready`

Entrega:
- dois ou mais jogadores com arma/colete/atributos mínimos

Regras:
- deve aceitar múltiplos alvos
- deve garantir região compatível e proteção de novato fora do caminho
- deve cobrir porrada, emboscada e contrato

Critério:
- fluxos PvP deixam de depender de preparação manual em várias contas

### 3.5 — `prison-ready`

Entrega:
- jogador preso
- heat alto
- ações de saída disponíveis

Regras:
- deve forçar uma prisão coerente com a faixa de calor
- deve deixar visíveis as saídas relevantes do fluxo
- deve ser fácil reexecutar o cenário sobre o mesmo jogador

Critério:
- prisão pode ser testada instantaneamente

### 3.6 — `hospital-ready`

Entrega:
- jogador hospitalizado ou viciado/DST

Regras:
- deve aceitar variantes:
  - internação por combate
  - internação por overdose
  - vício alto
  - DST
- deve expor serviços realmente úteis ao teste do hospital

Critério:
- hospital deixa de depender de “causar dano no jogo” para poder ser testado

### 3.7 — `tribunal-ready`

Entrega:
- facção controlando favela
- caso pronto para julgamento

Regras:
- deve garantir jogador numa facção com permissões mínimas
- deve garantir favela válida e caso ativo
- deve deixar a tela do tribunal pronta para validar leitura, escolha e impacto

Critério:
- Tribunal do Tráfico pode ser aberto em estado jogável por um único comando

### 3.8 — `war-ready`

Entrega:
- duas facções com caixa
- favela disputável
- preparação de guerra

Regras:
- deve preparar os dois lados
- deve garantir caixa, região e domínio coerentes
- deve deixar a guerra declarável ou já em estado de preparação, conforme o preset

Critério:
- a guerra deixa de depender de uma longa preparação multi-etapa

### 3.9 — Critério final da fase

Se, ao tentar preparar qualquer fluxo central do jogo, ainda acontecer qualquer um destes casos:

- “precisei lembrar uma sequência de comandos”
- “precisei preparar manualmente mais de uma conta”
- “precisei editar banco porque o preset não cobriu o caso”
- “precisei explicar verbalmente como montar o cenário”

então a Fase 3 falhou.

- [x] **3.1** `starter-pack`
- [x] **3.2** `territory-ready`
- [x] **3.3** `market-ready`
- [x] **3.4** `pvp-ready`
- [x] **3.5** `prison-ready`
- [x] **3.6** `hospital-ready`
- [x] **3.7** `tribunal-ready`
- [x] **3.8** `war-ready`
- [x] **3.9** Validar que qualquer fluxo central pode ser preparado por nome de cenário

### Checklist para considerar a Fase 3 pronta

- [x] existe `ops:scenario` funcional
- [x] cenários podem ser aplicados por nome
- [x] cenários podem ser carregados por arquivo
- [x] presets centrais cobrem onboarding, território, mercado, PvP, prisão, hospital, tribunal e guerra
- [x] a auditoria registra o cenário aplicado como lote único
- [x] a saída final do comando resume claramente o cenário montado
- [x] qualquer tester consegue iniciar um fluxo central do jogo por nome de cenário

---

## Fase 4 — Rodada / Eventos / Mundo

Objetivo: operar a rodada viva sem refactor manual.

> **Saída esperada desta fase:** um operador consegue manipular a rodada ativa, disparar ou encerrar eventos e restaurar a base viva do mundo em poucos comandos, sem refactor manual, sem `UPDATE` direto e sem depender do relógio natural do servidor.

> **Status atual:** concluída. A fase já está funcional e validada no backend.

### Decisões operacionais da Fase 4

- A Fase 4 cobre **estado global da rodada**, não o estado individual de conta ou o cenário pontual de um único fluxo.
- O comando principal desta fase deve nascer como:
  - `ops:round`
- Sempre que possível, ele deve reutilizar:
  - `RoundService`
  - `GameEventService`
  - `ServerConfigService`
  - `ConfigOperationsService`
  - rotinas já existentes de reseed/snapshot
- Toda ação desta fase deve ser tratada como **operação sensível**, com:
  - trilha de auditoria
  - resumo final claro
  - proteção para evitar execução acidental
- A fase precisa deixar explícita a diferença entre:
  - **mudar o dia da rodada**
  - **encerrar a rodada**
  - **abrir a próxima rodada**
  - **reseedar o mundo**
  - **disparar evento**

### Entregáveis funcionais obrigatórios da Fase 4

Ao final da fase, o sistema precisa permitir:

- mover a rodada para um dia específico
- encerrar a rodada atual de forma controlada
- abrir a próxima rodada sob comando
- registrar snapshot resumido do estado da rodada
- disparar, desativar, reativar e expirar eventos
- reseedar facções fixas, territórios e mercado sistêmico
- reidratar o mundo-base sem editar banco manualmente

Exemplos-alvo de uso ao final da fase:

```bash
npm run ops:round --workspace @cs-rio/server -- --set-round-day 12
npm run ops:round --workspace @cs-rio/server -- --trigger-event navio_docas
npm run ops:round --workspace @cs-rio/server -- --expire-event operacao_policial
npm run ops:round --workspace @cs-rio/server -- --reseed-territories
npm run ops:round --workspace @cs-rio/server -- --finish-round --start-next-round
```

### Comandos disponíveis hoje

Exemplos práticos já suportados:

```bash
cd /home/cesar/projects/cs_rio

# mover a rodada ativa para um dia específico
npm run ops:round --workspace @cs-rio/server -- --set-round-day 12

# capturar um snapshot resumido da rodada
npm run ops:round --workspace @cs-rio/server -- --snapshot-round-state

# disparar ou expirar evento
npm run ops:round --workspace @cs-rio/server -- --trigger-event navio_docas
npm run ops:round --workspace @cs-rio/server -- --expire-event operacao_policial --favela-code morro_da_providencia

# ligar ou desligar um evento por override de rodada
npm run ops:round --workspace @cs-rio/server -- --enable-event faca_na_caveira
npm run ops:round --workspace @cs-rio/server -- --disable-event faca_na_caveira

# restaurar partes do mundo
npm run ops:round --workspace @cs-rio/server -- --reseed-fixed-factions
npm run ops:round --workspace @cs-rio/server -- --reseed-territories
npm run ops:round --workspace @cs-rio/server -- --reseed-system-market

# reconstruir o baseline do mundo em lote
npm run ops:round --workspace @cs-rio/server -- --rebuild-world-state

# fechar a rodada atual e abrir a próxima
npm run ops:round --workspace @cs-rio/server -- --finish-round --start-next-round
```

### Arquivos-alvo esperados

- `apps/server/src/services/round-ops.ts`
- `apps/server/src/scripts/round-command.ts`
- `apps/server/src/test/round-ops.test.ts`
- eventual apoio em:
  - `apps/server/src/services/round.ts`
  - `apps/server/src/services/game-event.ts`
  - `apps/server/src/services/config-operations.ts`
  - `apps/server/src/db/seed.ts`

### 4.1 — Operações de rodada

- `set-round-day`
- `set-round-hour` ou equivalente mínimo se necessário
- `set-round-phase` quando existir separação operacional real

Regras:

- `set-round-day` deve validar o intervalo permitido da rodada
- a operação deve refletir imediatamente em inflação, catálogos e qualquer sistema que dependa do dia
- se houver snapshot congelado da rodada, a operação deve respeitar ou explicitar o efeito sobre ele

Critério:

- playtest de early, mid e late round pode ser feito sem esperar passagem natural de dias

### 4.2 — Fechamento e abertura de rodada

- `finish-round`
- `start-next-round`

Regras:

- deve ser possível fechar a rodada atual sob comando
- deve ser possível abrir a próxima rodada sem depender do scheduler natural
- a operação deve deixar explícito:
  - ranking final
  - premiação
  - reset do mundo
  - reaplicação do mundo-base

Critério:

- rollover de rodada pode ser testado localmente e de forma reproduzível

### 4.3 — Snapshot de estado da rodada

- `snapshot-round-state`

Regras:

- precisa registrar pelo menos:
  - rodada ativa
  - dia
  - ranking resumido
  - eventos ativos
  - domínio territorial resumido
  - flags/config relevantes
- deve funcionar como ferramenta de diagnóstico, não só de auditoria

Critério:

- um operador consegue congelar o “estado da rodada” para inspecionar e comparar

### 4.4 — Eventos

- `trigger-event`
- `disable-event`
- `enable-event`
- `expire-event`

Regras:

- deve aceitar eventos data-driven da rodada
- `trigger-event` precisa permitir alvo e payload mínimo quando aplicável
- `disable-event` e `enable-event` devem preferir feature flags/overrides, não SQL solto
- `expire-event` deve encerrar o evento de forma coerente com o ciclo de vida dele

Critério:

- qualquer evento relevante do jogo pode ser testado sob comando

### 4.5 — Mundo base

- `reseed-fixed-factions`
- `reseed-territories`
- `reseed-system-market`

Regras:

- comandos devem reaplicar o estado-base da rodada sem destruir dados de forma silenciosa
- precisa ficar explícito se a operação é:
  - total
  - parcial
  - cumulativa
- o operador deve conseguir restaurar o baseline do mundo após bagunçar o playtest

Critério:

- o mundo pode ser “resetado para estado conhecido” sem SQL manual

### 4.6 — Reidratação operacional do mundo

- `rebuild-world-state` ou equivalente composto

Regras:

- deve funcionar como um atalho de recuperação
- precisa recompor, no mínimo:
  - facções fixas
  - domínio territorial base
  - mercado sistêmico
  - flags/config esperadas da rodada
- ideal para ambiente local destruído por playtests sucessivos

Critério:

- um ambiente local volta a um estado jogável com um único comando composto

### 4.7 — Critério final da fase

Se, ao tentar testar rodada, evento ou mundo base, ainda acontecer qualquer um destes casos:

- “precisei esperar o relógio natural”
- “precisei reiniciar a rodada mexendo direto no banco”
- “precisei criar evento ou encerrar evento manualmente”
- “precisei restaurar território/mercado/facções à mão”

então a Fase 4 falhou.

- [x] **4.1** Operações de rodada
- [x] **4.2** Fechamento e abertura de rodada
- [x] **4.3** Snapshot de estado da rodada
- [x] **4.4** Eventos
- [x] **4.5** Mundo base
- [x] **4.6** Reidratação operacional do mundo
- [x] **4.7** Validar que rodada/eventos/mundo podem ser manipulados sem SQL manual

### Checklist para considerar a Fase 4 pronta

- [x] existe `ops:round` funcional
- [x] é possível mover o dia da rodada sob comando
- [x] é possível fechar a rodada e abrir a seguinte sem esperar o scheduler
- [x] é possível capturar snapshot resumido do estado da rodada
- [x] é possível disparar, desativar, reativar e expirar eventos
- [x] é possível restaurar facções fixas, territórios e mercado sistêmico
- [x] existe um comando composto de recuperação do mundo local
- [x] toda operação deixa trilha de auditoria

---

## Fase 5 — Segurança / Auditoria / Guardrails

Objetivo: impedir que os cheats virem caos operacional.

> **Saída esperada desta fase:** qualquer operação interna sensível pode ser simulada, validada, auditada e restringida por ambiente, sem causar estado invisível, irreprodutível ou destrutivo por acidente.

> **Status atual:** concluída. A camada coesa de guardrails já existe e cobre ambiente, confirmação, `dry-run`, auditoria e consulta de histórico.

### Decisões operacionais da Fase 5

- A Fase 5 não cria novos “poderes” de operação; ela cria **proteção operacional** para os poderes já entregues nas fases 1 a 4.
- O foco principal aqui é padronizar comportamento em:
  - `ops:player`
  - `ops:world`
  - `ops:scenario`
  - `ops:round`
- Sempre que possível, os guardrails devem ser implementados em camada compartilhada, e não repetidos em cada script de forma solta.
- O padrão desejado é:
  - validar
  - simular (`dry-run`)
  - confirmar quando necessário
  - aplicar
  - auditar
  - resumir
- Toda operação destrutiva ou ambígua precisa ser tratada como **ação sensível**, mesmo em ambiente de desenvolvimento.

### Entregáveis funcionais obrigatórios da Fase 5

Ao final da fase, o sistema precisa permitir:

- executar operações com `dry-run`
- exigir confirmação explícita em ações destrutivas
- bloquear execução em ambiente inadequado
- validar semântica de payload antes de mutar o estado
- evitar duplicação indevida em comandos idempotentes
- consultar histórico operacional de forma legível
- deixar claro para o operador o que aconteceu e o que mudou

Exemplos-alvo de uso ao final da fase:

```bash
npm run ops:world --workspace @cs-rio/server -- --favela-code complexo_da_penha --neutralize-favela --dry-run
npm run ops:round --workspace @cs-rio/server -- --finish-round --confirm
npm run ops:player --workspace @cs-rio/server -- --player flucesar --grant-item weapon:pistola_380:1 --dry-run
npm run ops:audit --workspace @cs-rio/server -- --latest 20
```

### Arquivos-alvo esperados

- `apps/server/src/services/ops-guardrails.ts`
- `apps/server/src/services/ops-audit.ts`
- `apps/server/src/scripts/shared/cli-guards.ts`
- `apps/server/src/scripts/audit-command.ts`
- `apps/server/src/test/ops-guardrails.test.ts`
- apoio em:
  - `apps/server/src/services/player-ops.ts`
  - `apps/server/src/services/world-ops.ts`
  - `apps/server/src/services/scenario-ops.ts`
  - `apps/server/src/services/round-ops.ts`

### 5.1 — Audit log dedicado

Registrar, de forma padronizada:
- comando
- operador
- alvo
- rodada
- payload
- `before`
- `after`
- lote/batch quando aplicável

Regras:
- o formato do log deve ser consistente entre todos os comandos
- o log precisa servir para leitura humana, não só para armazenar JSON cru
- se uma operação falhar em validação, isso também deve poder ser rastreado

Critério:
- qualquer mutação importante consegue ser auditada sem abrir o banco “na unha”

### 5.2 — `dry-run`

Todo comando importante deve poder mostrar:
- o que mudaria
- o que foi validado
- sem aplicar mutação real

Regras:
- `dry-run` deve usar a mesma lógica de validação da execução real
- a saída precisa ser clara e resumida
- o operador deve saber exatamente se a operação seria:
  - válida
  - parcial
  - rejeitada

Critério:
- operações críticas podem ser simuladas antes de mexer no estado do jogo

### 5.3 — `confirm` para ações destrutivas

Exemplos:
- resetar facção
- neutralizar favela
- encerrar rodada
- reconstruir o mundo-base

Regras:
- o comando deve exigir `--confirm` ou equivalente
- sem confirmação explícita, a operação deve recusar execução
- a mensagem de erro precisa explicar o motivo

Critério:
- nenhum comando destrutivo é disparado “por acidente”

### 5.4 — Ambiente restrito

Os comandos devem:
- rodar só em `development`, `test` ou ambiente explicitamente habilitado

Regras:
- produção deve vir bloqueada por padrão
- a abertura excepcional precisa ser intencional e explícita por variável/config
- a mensagem de bloqueio deve deixar claro o porquê

Critério:
- cheats não podem vazar por acidente para ambiente indevido

### 5.5 — Validação semântica

Exemplos:
- não aceitar `regionId` inválido
- não aceitar rank impossível
- não aceitar item inexistente
- não aceitar favela inexistente
- não aceitar conflito lógico no mesmo comando

Regras:
- a validação precisa acontecer antes de qualquer mutação parcial
- a mensagem final deve apontar exatamente o campo/argumento inválido
- idealmente deve haver camada compartilhada para isso

Critério:
- o operador recebe erro útil, e o estado não fica “meio aplicado”

### 5.6 — Idempotência quando fizer sentido

Regras:
- comandos como seed de mercado, entrada em facção, rank e flags devem evitar duplicação desnecessária
- a saída final deve dizer quando nada mudou porque o estado já era aquele
- idempotência deve ser preferida em operações repetíveis do dia a dia

Critério:
- repetir comando não degrada o ambiente nem cria lixo operacional

### 5.7 — Histórico consultável

Regras:
- deve existir um comando ou saída padrão para consultar histórico recente
- o histórico precisa permitir filtrar por:
  - player
  - facção
  - favela
  - rodada
  - comando
- a leitura deve ser curta e usável em terminal

Critério da fase:
- cheats internos não causam estado invisível ou irreprodutível

- [x] **5.1** Audit log dedicado
- [x] **5.2** `dry-run`
- [x] **5.3** `confirm` para ações destrutivas
- [x] **5.4** Ambiente restrito
- [x] **5.5** Validação semântica
- [x] **5.6** Idempotência quando fizer sentido
- [x] **5.7** Histórico consultável

### Comandos disponíveis hoje

```bash
npm run ops:player --workspace @cs-rio/server -- --player flucesar --set-money 500000 --dry-run
npm run ops:world --workspace @cs-rio/server -- --favela-code complexo_da_penha --neutralize-favela --confirm
npm run ops:round --workspace @cs-rio/server -- --finish-round --dry-run
npm run ops:scenario --workspace @cs-rio/server -- --apply war-ready --player flucesar --dry-run
npm run ops:audit --workspace @cs-rio/server -- --latest 20
npm run ops:audit --workspace @cs-rio/server -- --source world --faction cv --latest 10
```

### Checklist para considerar a Fase 5 pronta

- [x] os comandos principais suportam `dry-run`
- [x] ações destrutivas exigem confirmação explícita
- [x] execução fica bloqueada fora dos ambientes permitidos
- [x] erros semânticos são claros e impedem mutação parcial
- [x] operações repetíveis são idempotentes quando fizer sentido
- [x] o histórico operacional pode ser consultado por terminal
- [x] o operador entende o que aconteceu sem ler SQL ou logs crus

---

## Fase 6 — DX / Presets / Documentação

Objetivo: tornar isso realmente útil no dia a dia.

> **Saída esperada desta fase:** qualquer pessoa do time consegue preparar e operar um cenário de teste em poucos segundos, por comandos curtos, aliases previsíveis e documentação suficiente para não depender do autor do sistema.

> **Status atual:** concluída. O sistema já expõe scripts amigáveis, biblioteca versionada de cenários, presets rápidos, aliases compostos e um comando de ajuda central para uso diário.

### Decisões operacionais da Fase 6

- A Fase 6 não cria novas capacidades de domínio; ela transforma as fases anteriores em **ferramenta usável no dia a dia**.
- A prioridade aqui é:
  - reduzir atrito
  - reduzir memória operacional
  - reduzir dependência de conhecer o banco ou a sintaxe completa dos comandos
- Sempre que possível, a experiência de uso deve caminhar para:
  - nome curto
  - saída curta
  - cenário reutilizável
  - presets previsíveis
- A documentação deve ser pensada para:
  - desenvolvimento
  - QA
  - playtest local
  - operação de rodada

### Entregáveis funcionais obrigatórios da Fase 6

Ao final da fase, o sistema precisa permitir:

- usar aliases curtos e previsíveis para operações comuns
- aplicar cenários versionados por nome
- consultar exemplos práticos prontos para copiar/colar
- usar presets rápidos de playtest local
- combinar comandos compostos com significado claro
- seguir um checklist mínimo para abrir uma sessão de teste funcional

Exemplos-alvo de uso ao final da fase:

```bash
npm run ops:starter --workspace @cs-rio/server -- --player flucesar
npm run ops:scenario --workspace @cs-rio/server -- --apply war-ready --player flucesar
npm run ops:quick --workspace @cs-rio/server -- --preset no-wait --player flucesar
npm run ops:alias --workspace @cs-rio/server -- --run north-war --player flucesar
```

Exemplos disponíveis hoje:

```bash
npm run ops:starter --workspace @cs-rio/server -- --player flucesar
npm run ops:quick --workspace @cs-rio/server -- --preset market-fill --player flucesar
npm run ops:alias --workspace @cs-rio/server -- --run north-war --player flucesar
npm run ops:help --workspace @cs-rio/server
```

### Arquivos-alvo esperados

- `apps/server/src/scripts/scenarios/`
- `apps/server/src/scripts/scenario-command.ts`
- `apps/server/src/scripts/presets-command.ts`
- `apps/server/src/scripts/alias-command.ts`
- `apps/server/src/scripts/help-command.ts`
- `apps/server/src/test/scenario-ops.test.ts`
- `apps/server/src/test/presets-command.test.ts`
- documentação complementar em:
  - `CHEATS.md`
  - arquivos `.json` ou `.ts` de cenário versionados

### 6.1 — Scripts npm amigáveis

Exemplos desejados:
- `npm run ops:player`
- `npm run ops:scenario`
- `npm run ops:world`
- `npm run ops:round`
- `npm run ops:starter`
- `npm run ops:quick`

Regras:
- o nome do script precisa comunicar o uso sem obrigar a abrir código
- aliases devem evitar flags longas para fluxos repetitivos
- a sintaxe curta deve reutilizar a implementação principal, sem duplicar regra

Critério:
- as operações comuns deixam de depender de lembrar comandos longos

### 6.2 — Biblioteca de cenários versionada

Pasta sugerida:
- `apps/server/src/scripts/scenarios/`

Regras:
- cada cenário deve ser versionado junto com o repositório
- o nome do cenário deve dizer claramente para que ele serve
- cenários devem aceitar override mínimo de alvo (`player`, `round`, `region`, etc.)
- a estrutura precisa ser estável o bastante para reutilização entre rodadas

Critério:
- o time consegue reaplicar cenários previsíveis e reproduzíveis

### 6.3 — Documentação de exemplos

Regras:
- precisa existir um catálogo de exemplos reais de uso
- a documentação deve mostrar:
  - comando
  - efeito esperado
  - quando usar
- idealmente separada por:
  - player
  - mundo
  - rodada
  - cenário

Critério:
- qualquer pessoa consegue começar a usar o sistema por cópia e adaptação

### 6.4 — Cheats rápidos para playtest local

Exemplos:
- `god-lite`
- `no-wait`
- `full-combat-kit`
- `territory-check`
- `market-fill`

Regras:
- presets rápidos devem resolver dores comuns de teste
- precisam ser seguros e previsíveis
- devem preferir composição de comandos já existentes

Critério:
- o atrito de abrir um playtest local cai drasticamente

### 6.5 — Comandos compostos por alias

Exemplos:
- `north-war`
- `tribunal-ready`
- `round-late-game`
- `hospital-loop`

Regras:
- aliases compostos devem ter nome memorável
- a saída final deve listar o que foi executado internamente
- aliases não devem esconder erro; precisam surfacing falha claramente

Critério:
- cenários complexos podem ser disparados por um nome curto

### 6.6 — Checklist de uso em playtest

Regras:
- deve existir um checklist curto para:
  - subir ambiente
  - aplicar cenário
  - validar estado final
  - limpar/reidratar ambiente
- o checklist deve caber em uso diário, não ser um manual longo

Critério da fase:
- qualquer pessoa do time consegue preparar estado de teste sem conhecer o banco

- [x] **6.1** Scripts npm amigáveis
- [x] **6.2** Biblioteca de cenários versionada
- [x] **6.3** Documentação de exemplos
- [x] **6.4** Cheats rápidos para playtest local
- [x] **6.5** Comandos compostos por alias
- [x] **6.6** Checklist de uso em playtest

### Checklist para considerar a Fase 6 pronta

- [x] existem aliases curtos para os fluxos mais comuns
- [x] cenários versionados podem ser aplicados por nome
- [x] há exemplos reais e copiáveis na documentação
- [x] presets rápidos cobrem os principais tipos de playtest
- [x] aliases compostos funcionam sem esconder o que foi executado
- [x] uma pessoa do time consegue iniciar um playtest sem abrir o banco

---

## Ordem Recomendada de Execução

| Passo | Fase | Entrega | Impacto |
|---|---|---|---|
| 1 | 0.1-0.5 | Fundação operacional | Base única para todos os cheats |
| 2 | 1.1-1.6 | Operações de player | Remove atrito principal do playtest |
| 3 | 3.1 | `starter-pack` | Teste inicial instantâneo |
| 4 | 2.1-2.4 | Facção / território / economia | Prepara fluxos centrais |
| 5 | 3.2-3.8 | Cenários reutilizáveis | QA rápido por fluxo |
| 6 | 4.1-4.3 | Rodada / eventos / mundo | Controle total da rodada |
| 7 | 5.1-5.7 | Segurança e auditoria | Operação confiável |
| 8 | 6.1-6.6 | DX e presets | Uso diário sem atrito |

---

## Critérios de Aceite do Sistema

Para considerar este plano concluído:

- eu consigo deixar um jogador pronto para qualquer teste em menos de 30 segundos
- eu consigo preparar um cenário completo com um único comando
- eu não preciso editar banco manualmente para testar fluxos principais
- toda mutação operacional deixa rastro auditável
- nenhuma operação interna depende de client/admin panel
- o sistema continua seguro para não vazar ao usuário final

---

## Observação Final

Esse sistema deve ser tratado como **infraestrutura de desenvolvimento do jogo**, não como “gambiarra temporária”.

Se for bem feito, ele vai:

- acelerar teste manual
- acelerar QA
- acelerar balanceamento
- acelerar debug de rodada
- reduzir risco operacional
- permitir que cada rodada seja preparada e ajustada muito mais rápido
