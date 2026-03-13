# CS RIO — Contexto Completo do Projeto

> Registro integral de todas as decisões, perguntas e respostas da sessão de concepção do projeto.
> Data: 2026-03-10

---

## Sessão 1 — Concepção Inicial

### Pergunta do Usuário

> Eu quero criar um jogo tipo o The Crims (https://www.thecrims.com/) porém que seja não só site, mas ele tenha elementos visuais, como o primeiro jogo do age of empires da década de 90 ou o Tibia (tibia.com)
>
> Como poderíamos fazer isso? Quais seriam os requisitos técnicos, linguagem, etc?

### Resposta

Foi apresentado um planejamento inicial com conceito de um crime RPG multiplayer com visual isométrico 2D no browser. Stack proposta inicialmente:

**Frontend (Client):**
- Game Engine: Phaser 3 (ou PixiJS) para isométrico 2D no browser
- UI/HUD: React ou Vue com overlay
- Comunicação: WebSocket (Socket.IO ou ws)
- Build: Vite + TypeScript

**Backend (Server):**
- Game Server: Node.js + TypeScript
- API REST: Fastify ou Express
- Real-time: Colyseus ou Socket.IO
- Database: PostgreSQL
- Cache/Session: Redis
- Auth: JWT + bcrypt

**Infraestrutura:**
- Deploy: Docker + VPS (Hetzner, DigitalOcean)
- Assets: CDN (Cloudflare)
- CI/CD: GitHub Actions

Arquitetura de alto nível com Browser → WebSocket + REST → Game Server → PostgreSQL + Redis.

Módulos sugeridos em 4 fases:
- **Core (MVP):** Mapa isométrico, personagem com sprite, sistema de crimes, inventário, NPCs, chat, auth
- **Fase 2:** Gangues/clãs, PvP, economia entre jogadores, prisão, ranking
- **Fase 3:** Casas/propriedades, veículos, eventos
- **Fase 4:** Mobile — PWA ou wrapper com Capacitor

Visual isométrico com Tiled Map Editor, tiles 64x32 ou 128x64, assets via itch.io/kenney.nl/Aseprite/IA.

---

## Sessão 2 — Correção de Rumo (Mobile Nativo + React)

### Pergunta do Usuário

> Entre o Vue e o React eu prefiro o React
> Ele não deve ser web-based, e sim app Android e iOS, portanto a ideia de PWA ou wrapper com capacitor não é por aí
>
> Considere isso e refaça o seu planejamento
> Eu criei a pasta cs_rio (que é o nome do jogo) em projects

### Resposta

Planejamento refeito completamente para app nativo:

**Stack Revisada:**

| Componente | Tecnologia |
|---|---|
| Framework | Expo (React Native) |
| Game Rendering | @shopify/react-native-skia |
| Game Loop | react-native-game-engine |
| UI/HUD | React Native (nativo) |
| Navegação | React Navigation |
| Real-time | WebSocket (Colyseus client) |
| State | Zustand |
| Linguagem | TypeScript |

Backend mantido (Node.js + Colyseus + Fastify + PostgreSQL + Redis).

Justificativa de Skia vs WebView: performance GPU direto, sem overhead de WebView (~100MB), gestos nativos, aprovação tranquila na App Store.

Estrutura de projeto definida:
```
cs_rio/
├── app/              # Expo app
│   ├── src/
│   │   ├── engine/   # GameLoop, Camera, TilemapRenderer, SpriteSheet, Pathfinding, InputHandler
│   │   ├── screens/  # Auth, Game, Inventory, Gang
│   │   ├── components/ # HUD, ChatOverlay, MiniMap, ActionMenu
│   │   ├── stores/   # Zustand stores
│   │   ├── network/  # Colyseus, API
│   │   └── assets/   # Sprites, tilesets, sons
├── server/           # Game server
│   ├── src/
│   │   ├── rooms/    # Colyseus rooms
│   │   ├── systems/  # Crime, Combat, Economy
│   │   ├── api/      # REST endpoints
│   │   └── models/   # Drizzle ORM
├── shared/           # Tipos compartilhados
```

Fases de desenvolvimento:
1. Protótipo jogável (mapa, movimento, primeiro crime)
2. Core gameplay (crimes, NPCs, inventário, chat, progressão, multiplayer)
3. Social & PvP (gangues, PvP, economia, prisão, ranking)
4. Polish & Launch (áreas do mapa, veículos, eventos, monetização, stores)

---

## Sessão 3 — Game Design Document (JOGO.md)

### Pergunta do Usuário

> Está bom, mas agora precisamos definir a storyline, aspectos e etc do jogo
>
> Ele será muito similar ao The Crims
> A diferença que a cidade será o Rio de Janeiro (inclusive será o mapa do Rio de Janeiro/Brasil)
> No jogo original (https://thecrims.tawk.help/article/guia-do-jogo-vers%C3%A3o-mais-curta-52-dias; https://www.thecrims.com/help/guide#/), temos:
> Armas e coletes;
> Guardas (serão chamados de Soldados);
> Esteróides (serão chamados de Tadalafila)
> Rápida recuperação (serão chamados de Viagra)
> Óculos da fortuna (não terá)
> Talismã do conhecimento (não terá)
> Pedra falante (não terá)
> Anel de fogo (não terá)
> Bolinho de droga da fortuna (não terá)
> Esconder pontos de doação de gangue (não terá)
> Ocultar pontos de inventário (não terá)
> Reforço de treinamento (vai ser chamado de Impulso de Milico)
> Preservativos (vai ser chamado de camisinha)
> Transfusão de sangue (vai ter)
> Meia transfusão de sangue (vai ter)
> Roofies (não vai ter)
> Big Brother (vai ser chamado de Impulso de Conceito Alto)
> Putas (serão chamadas de GP ou garotas do Job)
> Amor ao Trabalho (vai ser chamado de Impulso de Cria)
> Lavagem de Dinheiro (vai ter)
> Bingo (vai ser chamado de Impulso de Jogo do Bicho)
> Viciado em componentes (vai ser chamado de Impulso de Dono da Boca)
> Laboratórios NASA (Vai ser chamado de Impulso de Dono da Facção)
> Mercados de Ações Frenético (Impulso de Fintech)
>
> As drogas serão:
> MD
> Bala
> Doce
> Lança
> Cocaína
> Crack
> Maconha
>
> No jogo original tem gangues, nesse teremos facções, e o jogo deve nascer com algumas facções fixas: Comando Vermelho (CV), Terceiro Comando Puro (TCP), Amigo dos Amigos (ADA), Terceiro Comando (TC), Milícia (MIL), Liga da Justiça (LJ), Primeiro Comando da Capital (PCC)
> Essas facções deverão sempre existir, mas os jogadores poderão criar novas gangues e dar um nome a elas
> As facções vão ganhar pontos não só pelos roubos, mas também por toda e qualquer atividade criminosa do mercado negro: venda de armas/coletes, venda de drogas, cafetinagem
>
> Também vai ter o seguinte: após o domínio de uma região por uma facção, eles poderão limitar as atividades dos moradores da região a utilizar somente recursos da gangue, que serão:
> - GatoNet
> - TVGato
> - Botijão de gás
> - Mototaxi
> - Van
> - Comércio local
>
> As regiões serão chamadas de 'favela' e cada favela terá uma quantidade de moradores, quanto mais moradores, mais dinheiro em cada uma dessas atividades a facção irá receber
>
> Favelas mais densas trarão recompensas maiores mas serão mais difíceis de manter. A taxa vai mudar de acordo com uma outra taxa, que será de 'Satisfação dos moradores', quanto mais alta for a satisfação dos moradores, maior a recompensa e menor a probabilidade de X9
> Um X9 será um evento que irá ocorrer aliado a satisfação dos moradores que irá resultar numa incursão da PM que irá fazer a facção perder alguns recursos como armas, dinheiro e drogas e também vai levar 1 ou mais soldados presos e a facção poderá negociar o 'desenrolo' para liberar o soldado com a polícia
>
> A facção também poderá promover 'baile na favela', que será um sucesso ou um fracaso conforme a satisfação dos moradores, poderá ocorrer 1x a cada X tempo e irá alavancar a venda de drogas e satisfação dos moradores no período
>
> A conquista de toda e qualquer favela incidirá uma taxa de propina para a PM (policia), que irá exigir um valor e aceitar uma negociação percentual, em caso de falha na negociação a PM fará incursões na favela e a taxa de recursos obtidos irá reduzir durante o período de incursões policiais até que se chegue em um acordo
> Se levar um tempo sem acordo, a PM irá tomar a favela da facção que ficará sob domínio do estado por algum tempo determinado até poder ser reconquistada
>
> Aqui é um breve resumo em relação a algumas mecânicas do jogo
> Eu preciso que você crie um arquivo com toda a instrução e mecânica do jogo (não limitado ao que eu disse acima) e coloque em um arquivo JOGO.md

### Resposta

Foi criado o arquivo JOGO.md v1 com 23 seções cobrindo:
1. Conceito geral e ciclo de rodada
2. Criação de personagem (5 vocações, 4 atributos, aparência)
3. Progressão (10 níveis, conceito, estamina, vida)
4. Sistema de crimes (solo e facção, probabilidade)
5. Equipamento (14 armas, 9 coletes, 5 tipos de soldados, mercado negro)
6. Itens especiais e impulsos (todos os renomeados conforme solicitado)
7. Drogas (7 tipos, tolerância, overdose, fábricas, canais de venda)
8. Negócios (bocas, raves, bailes, puteiros/GPs, lojas de fachada, cassino/bicho, imóveis)
9. Treinamento (centro de treino, universidade do crime)
10. Facções (7 fixas + criadas, hierarquia, banco, pontuação)
11. Sistema territorial (favelas, conquista, 6 serviços, satisfação, X9, propina, baile, guerra)
12. Combate PvP (porrada, emboscada, assassinato por encomenda)
13. Prisão
14. Hospital
15. Locais do mapa (fixos e de jogadores)
16. Eventos
17. Economia
18. Social
19. Sabotagem
20. Monetização (F2P, sem P2W)
21. Anti-cheat
22. Glossário
23. Referências

---

## Sessão 4 — Refinamento do JOGO.md

### Pergunta do Usuário

> Ficou MUITO BOM seu arquivo, muito bom MESMO!
>
> Eu pedi ao chatgpt para listar a mecanica do thecrims
>
> Ele trouxe
>
> [Mecânicas completas do The Crims — texto do ChatGPT com 14 seções cobrindo: estrutura básica (Energy, Nerve, Health, Addiction, Respect, Cash), sistema de tempo (regeneração em tempo real), crimes (pickpocket a bank robbery), drogas (Cannabis a Heroin com addiction/overdose), combate (força + armas + sorte), gangues (cooperação, guerras, distritos), distritos com bônus, respeito como ranking, prisão, hospital, economia, rodadas competitivas, estratégias avançadas (gerenciar energia, drogas estratégicas, melhor risco/recompensa), mecânicas ocultas (otimização matemática, farm de respeito)]
>
> Alinhe isso ao que disse que vai mudar (favela e tudo o que eu coloquei)
> Ao que você construiu (que está bom PRA CARALHO, tenha cuidado para não mudar radicalmente)
> E seja MUITO detalhista (já está com um bom nível de detalhes)
>
> Em relação as classes de vocação de personagens: Cria, Gerente, Soldado (ao invés de Sicário), Político (ao invés de Cafetão) e Empreendedor
> Em relação as regiões do Rio, na verdade são: Zona Sul (muito rica, densamente povoada), Zona Norte (pobre, densamente povoada), Centro (nem pobre nem rico, nem pouco povoada nem muito povoada), Zona Oeste (média, pouco povoada), Zona Sudoeste (rica, povoação média), Baixada (muito pobre, povoação média); é importante frisar que cada região terá várias favelas, e se uma única facção dominar todas as favelas de uma região, então ele terá um bônus de ganho em todas as atividades nas favelas da região
> Em relação aos níveis de progressão, a ordem seria: 1- Pivete, 2- Aviãozinho, 3- Fogueteiro, 4- Vapor, 5- Soldado, 6- Gerente de Boca, 7- Frente, 8- Dono da Boca, 9- Líder da Facção, 10- Prefeito (isso tem que mudar o item 4.1 - Crimes de solo, também)
>
> Ao invés de 'Cassino' chama de 'Maquininha de Caça Níquel' (no RJ tem um comércio de maquininhas de caça-níquel, cassinos não existem)
>
> Na universidade do crime: ao invés de sicário, coloca PQD
>
> Também coloca um evento aleatório onde um morador de uma favela denuncia outro e leva para o 'tribunal do tráfico'. Nesse evento o líder da facção deverá 'desenrolar' e escolher uma punição (liberar só com aviso, dar uma surra, expulsar da favela, matar, esquartejar, queimar no pneu)
> Ambos vão apresentar sua versão, serão histórias de:
> Morador que roubou outro morador na favela
> Morador que talaricou com a esposa de outro morador da favela
> Morador que fez dívida em jogos de azar e não pagou a outro morador da favela
> Morador que fez dívida de drogas e não pagou a facção
> Morador que estuprou moradora da favela
> Morador que agrediu morador da favela
> Morador que matou outro morador da favela sem permissão
>
> Cada lado terá um certo nível de carisma dentro da comunicado vs nível de carisma entre os membros da facção, o jogador terá que escolher reduzir a moral na facção ou entre os moradores
> Terão níveis de impacto para cada tipo de evento e cada tipo de punição
> Sempre haverá alguém intercedendo (denominado de 'antigão') que irá facilitar a identificação do jogador quanto ao aumento/queda de sua moral para cada tipo de escolha

### Resposta

JOGO.md reescrito por completo (v2) com 25 seções, incorporando:

**Correções aplicadas:**
- Vocações: Cria, Gerente, **Soldado** (não Sicário), **Político** (não Cafetão), Empreendedor — com distribuição de stats iniciais
- Progressão: Pivete → Aviãozinho → **Fogueteiro** → **Vapor** → Soldado → Gerente de Boca → Frente → Dono da Boca → **Líder da Facção** → **Prefeito**
- Crimes solo reestruturados para 10 níveis (incluindo nível 9 e 10 separados)
- Cassino → **Maquininha de Caça-Níquel**
- Universidade do Crime: Sicário → **PQD (Paraquedista)**
- 6 regiões com perfil socioeconômico: Z.Sul (muito rica, densa), Z.Norte (pobre, densa), Centro (média, média), Z.Oeste (média, pouco povoada), **Z.Sudoeste** (rica, média), Baixada (muito pobre, média)
- **Bônus de Domínio Regional** para facção que controla todas as favelas de uma região

**Novos sistemas adicionados:**
- **Seção 3.4 — Nervos (Nerve):** recurso secundário que limita crimes arriscados, regenera lentamente, consumido por crimes nível 3+
- **Seção 3.6 — Vício (Addiction):** sistema completo com 6 faixas de efeito (0-100%), efeitos negativos progressivos, overdose automática em 100%
- **Seção 4 (crimes) expandida:** consumo de nervos por tier, crimes até nível 10, "O Grande Golpe" como crime lendário
- **Seção 12 — Tribunal do Tráfico:** seção inteira nova (~200 linhas) com:
  - 7 tipos de caso (roubo, talaricagem, dívida de jogo, dívida de drogas, estupro, agressão, homicídio não autorizado)
  - 6 punições (liberar com aviso, surra, expulsar, matar, esquartejar, queimar no pneu)
  - Tabelas completas de impacto moral (moradores vs facção) para cada combinação
  - Mecânica do **Antigão** como NPC conselheiro
  - Conceito ganho/perdido por tipo de decisão
- **Seção 14.2 — Calor da Polícia:** mecânica invisível de atenção policial acumulativa
- **Seção 23 — Estratégias Avançadas:** meta-game, otimização de estamina/drogas/progressão/economia/PvP
- **Seção 1.3 — Filosofia de Design:** explicita que é jogo de otimização estratégica, não ação direta
- Tabelas de preço para todas as armas/coletes
- Detalhamento de todas as 6 regiões com favelas reais, bairros e características

---

## Sessão 5 — Roadmap Técnico (TODO.md)

### Pergunta do Usuário

> Agora coloca o escopo técnico, muito bem definido, com etapas estruturadas, status de progressão para seguirmos um fluxo, no arquivo TODO.md
> Precisar ser muito detalhado, técnico e bem definido

### Resposta

Criado TODO.md com **189 tarefas** em **22 fases** (0-21):

- **Fase 0 — Infraestrutura (15 tarefas):** Monorepo Turborepo com 4 workspaces (apps/mobile, apps/server, packages/shared, packages/game-engine), Docker Compose dev (PostgreSQL 16 + Redis 7), ESLint/Prettier, Vitest, 3 pipelines GitHub Actions (CI, mobile build EAS, deploy server), schema PostgreSQL completo (20+ tabelas com DDL detalhado), seed de dados (facções, regiões, favelas, crimes, armas, coletes, drogas)

- **Fase 1 — Engine Isométrica (13 tarefas):** Conversão cartesiano↔iso, Z-sorting, parser de Tiled maps, renderer Skia com culling, mapa protótipo 200×200, câmera pan/zoom/follow, loader de spritesheets (Aseprite), sistema de animação 8-direcional, A* pathfinding, tap-to-move, input handler, game loop 60fps, componente GameView React Native

- **Fase 2 — Auth e Player (12 tarefas):** Endpoints register/login/refresh com JWT + bcrypt, middleware auth, criação de personagem com vocação, telas login/registro/criação (Mobile), auth store Zustand, API client Axios com interceptors, Colyseus server com GameRoom por região (100 jogadores max), client WebSocket, sincronização de posição com anti-teleport

- **Fase 3 — HUD e Interface (8 tarefas):** StatusBar, Minimap, ActionBar, ContextMenu, telas de Inventário/Perfil/Mapa/Configurações

- **Fases 4-15 — Gameplay:** Crime engine, cooldowns Redis, calor da polícia, regeneração sob demanda (estamina/nervos/vício), progressão, inventário, mercado negro, leilão, drogas, fábricas, negócios (bocas/raves/puteiros/fachada/maquininhas/bicho/imóveis), treino, universidade, facções CRUD, hierarquia, banco, upgrades, crimes coletivos, favela state machine, conquista, serviços, satisfação, domínio regional, X9, propina, baile funk, guerra, tribunal do tráfico (case generator, Antigão AI, 50+ templates), PvP (1v1/emboscada/contratos), prisão/hospital, event scheduler, navio/blitz/sazonais, banco/inflação/rodadas

- **Fase 16 — Audio e Polish:** Audio (expo-av), SFX placeholder, musica por regiao placeholder, tutorial onboarding, animacoes, particulas, push notifications

- **Fase 17 — Estabilizacao Mobile-First:** mapa protagonista, HUD compacto, clareza semantica, feedback imediato, responsividade percebida e fechamento da camada de UX antes do gate final da Pre-Alpha

- **Fase 18 — Configuracao Dinamica / Data-Driven (10 tarefas):** tirar parametros criticos do hard-code, snapshot por rodada, ativacao/desativacao via banco e migracao dos sistemas centrais para config persistida

- **Fase 19 — Testes e Balanceamento:** unitarios, integracao, carga, balanceamento e E2E mobile
- **Fases 20-22 — Suporte pós-Pre-Alpha:** Social, Monetizacao e Anti-Cheat

- **Fase 23 — Launch (17 tarefas):** VPS 4vCPU/8GB, Docker prod, PostgreSQL/Redis managed, Nginx SSL + WebSocket, monitoramento (Uptime Kuma/Grafana), logging (pino), backup automático (pg_dump → R2), EAS Build config, signing Android/iOS, metadata stores, privacy policy, builds AAB/IPA, submit review, beta TestFlight/Internal, soft launch BR, métricas DAU/retenção, OTA hotfix, launch público

Grafo de dependências e tabela de métricas de progresso incluídos.

---

## Sessão 6 — Ajuste de Evento

### Pergunta do Usuário

> Eu quero mudar de **Fuga do Presídio** para **Saidinha de Natal**

### Resposta

Alterado no JOGO.md seção 17.2 (Eventos Aleatórios): "Fuga do Presídio" → "Saidinha de Natal" (mantido efeito: 3%/dia, todos os presos são liberados).

---

## Sessão 7 — README.md

### Pergunta do Usuário

> Agora ajusta o README.md
> O nome do jogo é CS RIO

### Resposta

Criado README.md com: título "CS RIO", descrição do projeto, tabela de stack completa, estrutura de pastas, links para JOGO.md e TODO.md, comandos de dev (docker compose, npm install, turbo dev).

---

## Sessão 8 — Modelo de Propriedades, Faccao e Territorio

### Pergunta do Usuário

> Propriedades pertencem ao proprio jogador
> E se o jogador pertencer a uma faccao, as taxas de possibilidade de invasao, roubo, tomada sao mais robustas, pois a faccao da protecao
> O proprio jogador podera ter propriedades nao lucrativas, como casa, carro, joias, barcos, iates, lanchas, jet ski, casa de praia, mansao, avioes, helicopteros, pecas de arte, artigos de luxo, que serao protegidas pela faccao
> Ja as propriedades lucrativas serao do jogador mas a faccao recebera uma comissao fixa
> Se o jogador mudar de faccao, as propriedades dele mudam junto
> Dominio territorial da regiao da bonus, muda taxa, risco de invasao e protecao

### Resposta

Ficou consolidado o seguinte modelo de design:

- **Toda propriedade pertence ao jogador.** A faccao nunca vira dona do ativo.
- **Faccao atua como camada de protecao e arrecadacao**, nao de posse.
- **Ativos foram divididos em duas familias:**
  - **Patrimoniais:** casa, carro, joias, barcos, iates, lanchas, jet ski, casa de praia, mansao, avioes, helicopteros, arte e luxo. Nao geram renda direta; entregam prestigio, utilidade, conforto e logistica, com custo de manutencao.
  - **Operacionais:** boca, rave, fabrica, puteiro, loja de fachada, maquininha e outros negocios. Geram receita, mas pagam comissao fixa para a faccao do dono, se houver.
- **Troca de faccao nao transfere a posse.** O bem continua do jogador, mas a camada de protecao/comissao passa a obedecer a nova faccao apos um cooldown de transicao.
- **Dominio territorial total de uma regiao fortalece a defesa e a operacao das propriedades dos membros da faccao naquela area**, reduzindo risco de invasao, roubo e tomada e melhorando eficiencia. Isso **nao** torna as propriedades invulneraveis.
- **Tomada de propriedade deve priorizar impacto operacional** (estoque, producao, funcionamento, extorsao, dano) antes de perda definitiva do ativo.

Impactos diretos no planejamento:

- Fase 7 passa a ser a fase de formalizacao da economia de propriedades.
- Fase 9 precisa receber ledger e caixa de faccao para absorver comissoes automaticas.
- Fase 10 precisa aplicar bonus territoriais tambem sobre propriedades dos membros, nao apenas sobre receita da favela.
- O slice atual de `fabricas` e `venda de drogas` da Fase 6 deve ser absorvido pela economia formal de propriedades na Fase 7, mantendo a posse no `playerId`.

---

## Sessão 9 — Roubos, Bandidos da Favela e Faca na Caveira

### Pergunta do Usuário

> Quais as fontes de dinheiro da facção?
> Quero incluir renda faccional por roubos.
> Os assaltos podem ser cometidos pelo jogador ou por bandidos da favela.
> Bandidos da favela nao sao os soldados da facção.
> Cada favela deve ter quantidade propria de bandidos.
> Um percentual dos roubos deve ir para a facção.
> A facção pode proibir roubos no geral ou por região.
> A satisfação dos membros da facção muda conforme a política de roubos e decisões do Tribunal do Tráfico.
> Quero também teto máximo de soldados por favela.
> E um evento aleatório "Faca na Caveira", mais provável com calor policial alto, sem prisioneiros e sem desenrolo.

### Resposta

Ficou consolidado o seguinte modelo de design:

- **Roubos viram um sistema próprio**, separado dos crimes solo genéricos.
- **Roubos podem ser executados de duas formas:**
  - **pelo jogador**
  - **pelos bandidos da favela**
- **Bandidos da favela sao uma entidade separada dos soldados.**
  - **Soldados** protegem propriedades e territorio, custam manutencao e podem ser presos em X9.
  - **Bandidos** executam roubos, nao geram custo mensal fixo, podem ser presos por roubos mal sucedidos e retornam depois.
- **Roubo de veiculo possui tres rotas especificas:**
  - devolucao com resgate
  - desmanche e venda de pecas
  - clonagem e venda no Paraguai
- **Politica de roubos da faccao pode ser global ou regional.**
  - Se o roubo for proibido na regiao, ele nao ocorre ali.
  - A operacao e deslocada para outra regiao.
  - O percurso maior aumenta a chance de falha.
- **Faccao recebe percentual dos roubos** como nova fonte de renda criminal.
- **Satisfacao interna da faccao** passa a existir como sistema separado da satisfacao dos moradores.
  - E afetada por politica de roubos, resultado de roubos e decisoes do Tribunal do Trafico.
  - Afeta crescimento ou reducao do efetivo de bandidos nas favelas.
- **Cada favela passa a ter um teto maximo proprio de soldados**, separado da capacidade por propriedade.
- **Faca na Caveira** fica consolidado como evento extremo do BOPE:
  - puxado por calor policial territorial alto
  - apreende armas e drogas
  - mata parte dos soldados
  - mata parte maior dos bandidos
  - nao faz prisioneiros
  - nao permite desenrolo
  - reduz o calor policial apos a operacao
- **Saidinha de Natal** tambem deve liberar bandidos presos elegiveis, nao apenas jogadores presos.

Impactos diretos no planejamento:

- O `TODO.md` foi expandido para absorver esse escopo nas Fases 14 e 15.
- `JOGO.md` passa a ser a fonte de verdade funcional dessas mecanicas.
- Fase 15 deve tratar juntos:
  - teto de soldados por favela
  - pool de bandidos por favela
  - sistema de roubos
  - politica de roubos da faccao
  - satisfacao interna da faccao
- Fase 14 deve tratar:
  - `Faca na Caveira`
  - `Saidinha de Natal`
  - eventos policiais territoriais ligados ao calor

## Sessão 10 — Fechamento de Lacunas de Especificação

Após uma revisão do `JOGO.md`, foram identificados blocos ainda muito abertos para implementação futura. O documento foi ajustado para ficar mais executável sem depender do histórico do chat.

### Blocos fechados nesta sessão

- **Prisão e hospitalização**
  - fórmulas e modificadores mais claros
  - correção da incoerência do `Plano de Saúde`
  - distinção explícita entre prisão do jogador e prisão de bandidos da favela
- **Serviços da favela**
  - slots por favela
  - elegibilidade por infraestrutura
  - níveis de upgrade
  - estados de dano e custo de reparo
- **Facções criadas por jogadores**
  - marcos de progressão com bônus concretos
- **Eventos policiais gerais**
  - `Operação Policial`
  - `Blitz da PM`
  - `Saidinha de Natal`
- **Nomenclatura**
  - `embalo` como estado do jogador
  - `satisfação dos moradores` como estado da favela
  - `satisfação interna da facção` como estado da facção

### Objetivo

Reduzir ambiguidades de implementação nas fases futuras sem alterar o roadmap nem abrir novas mecânicas.

## Sessão 11 — Fechamento de PvP, Sabotagem e Monetização

Foi feita uma segunda passada documental no `JOGO.md` para elevar as seções de `PvP`, `Sabotagem` e `Monetização` ao mesmo nível de especificação dos blocos mais maduros do projeto.

### Blocos fechados nesta sessão

- **PvP**
  - elegibilidade
  - restrições
  - cooldowns por alvo
  - faixas de resolução por razão de poder
  - contrato de assassinato com retenção de recompensa e prazo
- **Sabotagem**
  - elegibilidade
  - cooldown por propriedade
  - resolução por razão ataque/defesa
  - diferença entre avaria e destruição
  - custos e tempo de recuperação
- **Monetização**
  - regras de conveniência
  - limites de inventário
  - restrições de revenda/loot
  - teto de créditos gratuitos por rodada
  - vedação explícita a gacha paga e vantagem mecânica premium

### Objetivo

Fechar as partes que ainda estavam conceituais demais para futura implementação e evitar que fases 12, 17 e 20 sejam reabertas por ambiguidade de regra.

## Sessão 12 — Prisão: saídas do cárcere (MVP server)

Foi fechado o slice backend de saídas da prisão da Fase 13, cobrindo o centro prisional e os métodos de soltura mais críticos para o loop do jogo.

### O que entrou

- `GET /api/prison` com leitura do estado atual da pena e da disponibilidade de ações
- `POST /api/prison/bribe` com custo em dinheiro e chance autoritativa dependente de carisma, vocação e calor
- `POST /api/prison/bail` com custo fixo de `10` créditos e soltura imediata
- `POST /api/prison/escape` com uma tentativa por pena, resolução autoritativa, falha adicionando `+50%` de tempo restante e `+10` de calor
- `POST /api/prison/faction-rescue/:targetPlayerId` com autorização de `Patrão` ou `General`, usando caixa da facção

### Simplificações assumidas no MVP

- o **minigame visual da fuga** não foi entregue neste slice server; nesta fase a fuga já é resolvida por chance autoritativa e a camada interativa fica para a tela mobile da `13.4`
- o **resgate da facção** ficou inicialmente restrito a membros `Gerente+`
- a elegibilidade alternativa de “membro envolvido em defesa/guerra nas últimas 24h” continua como regra-alvo do design, mas não entrou neste MVP por ainda não existir um trilho persistido suficientemente confiável dessa participação

### Objetivo

Fechar o backend do ciclo de soltura sem travar a Fase 13 por dependências de UI e sem perder de vista a regra-alvo documentada no `JOGO.md`.

---

## Sessão 14 — Hospital (Server)

### Contexto

Fechamento do `13.3` da Fase 13, entregando o backend completo do hospital sem depender ainda das telas mobile.

### Decisões e implementação

- criado o centro hospitalar em `/api/hospital` com:
  - tratamento de HP
  - desintoxicação
  - cirurgia de `nickname` e aparência
  - tratamento de DST
  - compra de consumíveis permanentes de atributo
  - compra de plano de saúde
- o estado leve de saúde do jogador ficou acoplado ao próprio registro de `players`:
  - `has_dst`
  - `dst_recovers_at`
  - `health_plan_cycle_key`
- o limite dos consumíveis permanentes ficou persistido por jogador/ciclo/item em tabela separada
- a hospitalização continuou sendo resolvida pelo `OverdoseSystem`, mas agora ele respeita o `Plano de Saúde` ao iniciar uma nova internação

### Simplificações assumidas no MVP

- como a mecânica formal de rodada ainda não está fechada, o **ciclo do hospital** usa uma chave **mensal de pré-alpha**
- isso vale para:
  - limite de compra dos consumíveis permanentes
  - ativação do `Plano de Saúde`
- quando a infraestrutura de rodada for concluída, essa chave mensal deverá ser substituída pelo identificador real da rodada

### Objetivo

Fechar o backend do hospital de forma coerente com o restante da Fase 13, sem criar um subsistema paralelo de estado e sem bloquear o pré-alpha por dependência da fase de rodadas.

---

## Sessão 15 — Prisão (Mobile)

### Contexto

Fechamento do `13.4` da Fase 13, entregando a tela mobile da prisão para deixar o fluxo legível no pré-alpha sem depender ainda de um minigame visual de fuga.

### Decisões e implementação

- criada a tela `PrisonScreen` com:
  - timer ao vivo da pena
  - leitura do calor atual e da faixa de risco
  - visualização clara das saídas imediatas
  - feedback contextual de sucesso/erro após cada tentativa
- a Home passou a:
  - exibir atalho dedicado para a prisão quando o jogador estiver preso
  - redirecionar ações principais bloqueadas para o centro prisional, em vez de deixar o jogador sem contexto
- o fluxo mobile ficou coerente com o backend da `13.2`, reutilizando as rotas reais de:
  - fiança
  - suborno
  - fuga

### Simplificações assumidas no pré-alpha

- a **fuga** continua como ação direta com confirmação e resposta autoritativa do backend
- o **minigame visual de fuga** continua adiado; ele não bloqueia o fechamento funcional da Fase 13 e pode entrar depois como camada de UX/polish
- o **resgate da facção** aparece nesta tela como leitura de elegibilidade e instrução operacional, mas continua sendo executado por outro membro autorizado, não pelo próprio preso

### Objetivo

Fechar o loop mobile da prisão com clareza suficiente para playtest, reduzindo a ambiguidade entre “ação bloqueada”, “ação indisponível” e “ainda preso”.

---

## Sessão 17 — Event Scheduler (Server)

### Contexto

Fechamento do `14.1` da Fase 14, entregando a infraestrutura de agendamento de eventos sem atropelar as tarefas específicas de `navio_docas`, operações policiais, `Saidinha de Natal` e eventos sazonais.

### Decisões e implementação

- criado o `EventSchedulerService` com `node-cron`
- o scheduler roda um **tick inicial no bootstrap** do server e depois segue em cron fixo
- o `14.1` ficou restrito a **eventos ambientais regionais** que o código atual já consegue consumir apenas pela presença de janelas em `game_events`:
  - `seca_drogas`
  - `bonecas_china`
  - `chuva_verao`
- os rolls são feitos por região com:
  - duração própria por evento
  - cooldown por evento/região
  - chance de ativação por tick
- os registros de `game_events` criados pelo scheduler recebem marcação em `data_json` para rastrear origem e regra de ativação
- o serviço foi ligado no `index.ts` com desligamento explícito junto do shutdown do server

### Simplificações assumidas no pré-alpha

- o `14.1` **não** agenda ainda:
  - `navio_docas`
  - `operacao_policial`
  - `blitz_pm`
  - `saidinha_natal`
  - `carnaval`
  - `ano_novo_copa`
  - `operacao_verao`
- esses tipos permanecem nas tarefas `14.2` a `14.6`, porque exigem regra de negócio dedicada, efeitos adicionais e/ou comunicação de produto própria
- a escolha foi intencional para não marcar como “pronto” um evento que só teria a janela temporal criada, mas ainda sem o fluxo completo do design

### Objetivo

Fechar a infraestrutura de scheduler e rolls randômicos de eventos do jogo, destravando as próximas tarefas da Fase 14 sem inflar artificialmente o progresso funcional dos eventos específicos.

---

## Sessão 18 — Navio nas Docas (Server)

### Contexto

Fechamento do `14.2` da Fase 14, ativando de fato o evento `navio_docas` para o canal `docks` do tráfico e deixando o timer consultável pelo cliente.

### Decisões e implementação

- criado o `GameEventService` para lidar com eventos programados específicos que precisam expor status público de leitura
- o `navio_docas` passou a:
  - ser sempre agendado para a região `Centro`
  - criar uma janela futura em `game_events` quando não houver evento ativo ou programado
  - expor status por rota protegida `GET /api/events/docks`
- o payload dessa rota informa:
  - `phase` (`scheduled` ou `active`)
  - `startsAt`
  - `endsAt`
  - `secondsUntilStart`
  - `remainingSeconds`
  - multiplicador premium e flag de demanda ilimitada
- o `EventSchedulerService` agora também chama `syncScheduledEvents()` antes dos rolls randômicos, para manter o próximo navio planejado
- no `DrugSaleService`, enquanto o `navio_docas` estiver ativo:
  - a venda nas docas continua restrita ao `Centro`
  - o multiplicador premium do evento segue em `1.5x`
  - a demanda deixa de ser capada e passa a ser limitada apenas pelo inventário do jogador

### Simplificações assumidas no pré-alpha

- como a infraestrutura formal de “dias de jogo” da rodada ainda não foi centralizada, o agendamento do navio usa equivalência real baseada no design atual:
  - próxima chegada entre `18h` e `30h` reais
  - janela ativa de `6h` reais
- isso mantém coerência com a regra documentada de `1 dia de jogo = 6h reais`, sem depender ainda do sistema completo de rodadas

### Objetivo

Fechar o primeiro evento programado concreto do jogo com efeito real de economia, leitura de timer e integração direta com uma mecânica já jogável no backend.

---

## Sessão 19 — Operação Policial / Blitz (Server)

### Contexto

Fechamento do `14.3` da Fase 14, transformando `operacao_policial` e `blitz_pm` em eventos realmente orquestrados pelo backend, com alvo regional/favela, aumento de pressão policial e impacto imediato na satisfação territorial.

### Decisões e implementação

- o `GameEventService` passou a sincronizar também eventos policiais, além do `navio_docas`
- `operacao_policial`:
  - escolhe automaticamente uma favela controlada com maior risco relativo
  - usa como sinal principal a combinação de `regions.policePressure`, baixa satisfação e dificuldade da favela
  - aumenta a pressão policial da região
  - reduz imediatamente a satisfação da favela alvo
  - grava a janela ativa em `game_events` com `favelaId` e antes/depois do impacto
- `blitz_pm`:
  - escolhe automaticamente uma região com favela controlada e pressão policial relevante
  - aumenta a pressão policial regional
  - reduz levemente a satisfação das favelas controladas daquela região
  - grava a janela ativa em `game_events`
- foi adicionada a rota protegida `GET /api/events/police` para leitura dos eventos policiais ativos, com:
  - tipo do evento
  - região
  - favela alvo quando aplicável
  - timers
  - pressão policial antes/depois
  - satisfação antes/depois

### Simplificação assumida no pré-alpha

- este passo fecha a parte sistêmica de seleção, pressão territorial e degradação imediata de satisfação
- as consequências mais pesadas descritas no design final, como apreensão de armas/drogas, prisões em massa e danos profundos à favela, continuam distribuídas entre os próximos itens da Fase 14, principalmente `14.4`
- a duração real usada neste slice foi mantida pragmática para playtest:
  - `operacao_policial`: `2h` reais
  - `blitz_pm`: `90min` reais

### Objetivo

Fazer os eventos policiais existirem de forma observável e economicamente relevante já no pré-alpha, sem depender ainda da camada completa de consequências extremas do design final.

---

## Sessão 20 — Faca na Caveira / BOPE (Server)

### Contexto

Fechamento do `14.4` da Fase 14, transformando o `faca_na_caveira` em um evento realmente autoritativo do backend, ligado à pressão policial territorial e com perdas materiais concretas na favela.

### Decisões e implementação

- o `GameEventService` passou a sincronizar também o evento `faca_na_caveira`
- o gatilho atual do BOPE usa:
  - `regions.policePressure >= 60`
  - risco relativo da favela baseado em pressão, baixa satisfação e dificuldade
  - cooldown regional próprio do evento
- quando o evento dispara, o backend:
  - reduz a pressão policial regional depois da operação
  - reduz a satisfação dos moradores da favela
  - reduz a `internalSatisfaction` da facção controladora
  - apreende estoques reais de `boca`, `rave` e `factory`
  - remove 2-5% dos soldados cadastrados nas propriedades da favela
  - grava headline e before/after no `game_events`
- o payload de `GET /api/events/police` foi expandido para expor:
  - headline do BOPE
  - perdas estimadas/efetivas
  - impacto em satisfação territorial
  - impacto em satisfação interna da facção

### Simplificação assumida no pré-alpha

- o design final prevê mortes reais de 12-17% dos bandidos da favela
- como o pool persistente de bandidos ainda pertence à `15.2`, o `14.4` registra por enquanto apenas `banditsKilledEstimate` dentro do próprio evento
- as perdas reais já entregues neste slice são:
  - apreensão de drogas
  - mortes de soldados
  - queda de satisfação dos moradores
  - queda de satisfação interna da facção
  - redução posterior da pressão policial regional

### Objetivo

Fazer o BOPE existir de forma economicamente destrutiva e visível já no pré-alpha, sem esperar a implementação completa do efetivo de bandidos da Fase 15.

---

## Sessão 21 — Saidinha de Natal (Server)

### Contexto

Fechamento do `14.5` da Fase 14, transformando a `saidinha_natal` em um evento global raro do backend, com soltura imediata dos jogadores presos e registro estruturado do retorno estimado dos bandidos às favelas.

### Decisões e implementação

- o `GameEventService` passou a sincronizar também o evento `saidinha_natal`
- o gatilho atual usa:
  - quantidade de jogadores atualmente presos
  - quantidade de favelas controladas no mapa
  - cooldown global próprio do evento
- quando o evento dispara, o backend:
  - solta imediatamente todos os jogadores com prisão ativa, atualizando `prison_records.releaseAt`
  - grava uma janela global em `game_events` com headline, ids dos jogadores libertados e totais do evento
  - estima quantos bandidos presos voltaram para as favelas para preservar o comportamento de design antes da `15.2`

### Simplificação assumida no pré-alpha

- a soltura de jogadores presos já é **real**
- a soltura de bandidos ainda não altera um pool persistente, porque esse efetivo só entra na `15.2`
- por isso, o evento persiste apenas:
  - `releasedPlayers`
  - `releasedPlayerIds`
  - `releasedBanditsEstimate`
- as notificações visuais e push desse retorno continuam concentradas na `14.7`

### Objetivo

Fazer a Saidinha de Natal existir de forma sistêmica e economicamente relevante no pré-alpha, liberando presos reais agora e preservando o efeito planejado sobre bandidos até a chegada do efetivo territorial completo.

---

## Sessão 22 — Eventos sazonais (Server)

### Contexto

Fechamento do `14.6` da Fase 14, ativando no backend os eventos sazonais que já estavam previstos no design e parcialmente consumidos por serviços econômicos: `carnaval`, `ano_novo_copa` e `operacao_verao`.

### Decisões e implementação

- o `GameEventService` passou a agendar janelas sazonais reais por região:
  - `carnaval` em `Zona Sul` e `Centro`
  - `ano_novo_copa` em `Zona Sul` e `Centro`
  - `operacao_verao` em `Zona Sul`
- foi criada a leitura protegida `GET /api/events/seasonal`, expondo:
  - tipo do evento
  - região
  - headline
  - `bonusSummary`
  - `remainingSeconds`
  - estado de humor policial (`distracted` ou `reinforced`)
- os serviços que já liam `game_events` sazonais passam a receber janelas reais do backend, ativando de fato os bônus por período em:
  - `rave`
  - `puteiro`
  - `tráfico`
  - `maquininha`
  - `fachada`
- o clima “PM distraída/reforçada” entrou no backend sem hack visual:
  - `carnaval` e `ano_novo_copa` reduzem a chance de `blitz`, `operacao_policial` e `faca_na_caveira` nas regiões afetadas
  - `operacao_verao` reforça essas chances na `Zona Sul`

### Simplificação assumida no pré-alpha

- como o sistema de rodadas ainda só entra na `15.8`, os sazonais usam **cooldown recorrente real** no scheduler em vez de gatilho “1x por rodada”
- as durações seguem equivalências coerentes com o design atual:
  - `carnaval`: `42h`
  - `ano_novo_copa`: `18h`
  - `operacao_verao`: `24h`
- os bônus sazonais de **crimes solo** continuam documentados no `JOGO.md`, mas nesta entrega os efeitos reais ficaram concentrados em:
  - negócios/receita
  - leitura pública dos eventos
  - modulação do comportamento policial
- essa escolha evita acoplar `CrimeSystem` a `game_events` antes da Fase 15, mantendo o pré-alpha coerente sem inflar a entrega

### Objetivo

Fechar a camada sazonal do jogo no pré-alpha com janelas reais, bônus econômicos ativos e influência sistêmica sobre o policiamento, deixando a notificação mobile dedicada para a `14.7`.

---

## Sessão 23 — Notificação de eventos (Mobile)

### Contexto

Fechamento do `14.7` da Fase 14, conectando o mobile ao backend de eventos para tornar `navio_docas`, operações policiais/BOPE e eventos sazonais visíveis de forma imediata no device.

### Decisões e implementação

- adicionada a camada `eventApi` no client mobile para consultar:
  - `GET /api/events/docks`
  - `GET /api/events/police`
  - `GET /api/events/seasonal`
- criado um agregador de feed em `features/events.ts`, responsável por:
  - normalizar os eventos vindos de fontes diferentes
  - priorizar perigos reais (`BOPE` / operações) acima de sazonais e docas
  - definir destino sugerido da CTA (`territory`, `map`, `market`)
- o `App.tsx` agora faz polling leve do feed e:
  - atualiza o store global de eventos
  - gera um alerta estilo push dentro do app (`EventToastOverlay`) quando surge um evento novo
- a `HomeScreen` ganhou banner in-game contextual, com:
  - título
  - resumo do evento
  - tempo restante
  - CTA para a tela mais útil naquele contexto

### Simplificação assumida no pré-alpha

- o item `14.7` foi fechado como **notificação imediata dentro do app**, não como push nativo do sistema operacional
- a escolha foi intencional para:
  - evitar abrir dependência nativa e rebuild extra antes da Fase 16
  - manter o foco na percepção do evento durante playtest
- o push real com `expo-notifications` continua concentrado na `16.7`, junto de áudio/polish e timers mais maduros

### Objetivo

Garantir que os eventos do jogo já sejam percebidos no pré-alpha com clareza e urgência, sem depender ainda da infraestrutura nativa final de notificações.

---

## Decisões Consolidadas

| Decisão | Valor |
|---|---|
| Nome do jogo | CS RIO |
| Plataforma | App nativo Android + iOS (Expo/React Native) |
| Framework UI | React (não Vue) |
| Rendering | @shopify/react-native-skia (não WebView/Phaser) |
| Não usar | PWA, Capacitor, WebView |
| Vocações | Cria, Gerente, Soldado, Político, Empreendedor |
| Níveis (1-10) | Pivete, Aviãozinho, Fogueteiro, Vapor, Soldado, Gerente de Boca, Frente, Dono da Boca, Líder da Facção, Prefeito |
| Regiões (6) | Z.Sul, Z.Norte, Centro, Z.Oeste, Z.Sudoeste, Baixada |
| Facções fixas (7) | CV, TCP, ADA, TC, MIL, LJ, PCC |
| Drogas (7) | Maconha, Lança, Bala, Doce, MD, Cocaína, Crack |
| Cassino | Não existe. Usa "Maquininha de Caça-Níquel" |
| Escola do Soldado | PQD (Paraquedista) |
| Cafetão | Renomeado para Político |
| Sicário | Renomeado para Soldado |
| Fuga do Presídio | Renomeado para Saidinha de Natal |
| Gangues | Chamadas de Facções |
| Putas | GPs (Garotas do Job) |
| Distritos | Favelas |
| Guardas | Soldados |
| Respeito | Conceito |
| Posse de propriedades | Sempre do jogador |
| Papel da facção sobre propriedades | Protecao + comissao sobre negocios lucrativos |
| Patrimonio pessoal | Nao gera renda direta; gera custo, prestigio e utilidade |
| Troca de faccao | Mantem posse, migra camada de protecao/comissao |
| Dominio territorial total | Aumenta receita, protecao e eficiencia; nao da imunidade |
| Roubos estruturados | Sistema proprio, separado dos crimes solo genericos |
| Execucao de roubos | Pode ser por jogador ou por bandidos da favela |
| Soldados vs bandidos | Entidades separadas com funcoes diferentes |
| Teto de soldados por favela | Existe alem da capacidade por propriedade |
| Politica de roubos da faccao | Global ou regional, afetando satisfacao e risco |
| Satisfacao interna da faccao | Sistema separado da satisfacao dos moradores |
| Faca na Caveira | Evento BOPE sem prisioneiros e sem desenrolo |
| Saidinha de Natal | Libera presos elegiveis, inclusive bandidos da favela |
| Contrato de assassinato falho | Alvo e avisado e o contrato volta ao mural ate executar ou expirar |
| Protecao de novato | Conta da criacao do personagem e bloqueia atacar/ser atacado enquanto ativa |
| Marco atual de release | Pre-Alpha reaberta: depende agora tambem da nova Fase 18 data-driven |

---

> Este arquivo deve ser consultado no início de cada nova sessão de trabalho para manter o contexto.

## Estrategia de release consolidada

- O objetivo imediato do projeto deixa de ser apenas fechar o **core funcional** e passa a incluir tambem uma camada **data-driven por rodada**
- A conclusao isolada da **Fase 17** nao fecha mais, sozinha, a **versao Pre-Alpha**
- A sequencia consolidada da Pre-Alpha passa a ser:
  - **Fase 15**: core economico/jogavel
  - **Fase 16 — Audio e Polish**: feedback audiovisual base, usando audios genericos como placeholder
  - **Fase 17 — Estabilizacao Mobile-First**: consolidacao de UX mobile, performance percebida e clareza de fluxo
  - **Fase 18 — Configuracao Dinamica / Data-Driven**: tirar parametros criticos do hard-code e dirigir a rodada por dados persistidos no banco
- So depois desse novo bloco a build volta a ser tratada como **Pre-Alpha**
- O funil de validacao pesada fica empurrado para a nova **Fase 19 — Testes e Balanceamento**
- Ate chegar a Pre-Alpha, correcoes de UX/performance seguem acontecendo apenas quando forem bloqueadoras para playtest ou para o desenvolvimento do core

## Sessão 24 — Banco pessoal (Server)

### O que foi implementado

- `15.1` foi fechado com centro bancario server-side:
  - `GET /api/bank`
  - `POST /api/bank/deposit`
  - `POST /api/bank/withdraw`
- entrou ledger pessoal persistido para deposito, saque e juros
- o deposito diario passou a respeitar limite base de `R$ 500.000`, escalado por nivel do jogador
- o saque passou a cobrar taxa bancaria fixa de `0,5%`
- o banco passou a sincronizar juros diarios de `1%` sobre o saldo guardado

### Simplificacao assumida no pre-alpha

- o juro diario e sincronizado nas interacoes com o banco (`/bank`, deposito e saque), sem job dedicado em background
- o ciclo diario do banco usa `America/Sao_Paulo`
- a "protecao" do saldo bancario nao abriu um subsistema novo; ela se apoia no modelo ja existente, em que:
  - apreensao policial consome `money`
  - loot de PvP consome `money`
  - perdas por morte/derrota nao drenam `bankMoney`

### Objetivo

Fechar a primeira camada economica do pre-alpha com banco funcional, regras claras de deposito/saque e juros diarios sem abrir ainda o pacote maior de inflacao, rodadas e roubos estruturados.

## 2026-03-12 — Fase 15.2 (Efetivo territorial)

### O que foi implementado

- entrou teto maximo de soldados por favela, persistido em `favelas.max_soldiers`
- a contratacao de soldados agora respeita:
  - a capacidade da propriedade
  - e o teto territorial agregado da favela
- entrou pool persistente de bandidos por favela com:
  - `banditsActive`
  - `banditsArrested`
  - `banditsDeadRecent`
  - `banditsSyncedAt`
- entraram lotes de retorno agendado em `favela_bandit_returns`
- o backend territorial passou a sincronizar crescimento/queda dos bandidos por favela nas leituras do territorio
- o alvo de bandidos ativos agora reage a:
  - populacao da favela
  - dificuldade
  - satisfacao interna da faccao controladora
- `Operacao Policial` agora prende bandidos reais e agenda seus retornos
- `Faca na Caveira` agora mata bandidos reais do pool territorial
- `Saidinha de Natal` agora devolve bandidos reais presos para as favelas

### Simplificacoes assumidas no pre-alpha

- o pool de bandidos e agregado por favela; ainda nao existem NPCs/bandidos individualizados
- os retornos ordinarios dos bandidos sincronizam nas leituras/interacoes territoriais, sem cron dedicado exclusivo
- os eventos policiais mantem os nomes legados de payload:
  - `banditsKilledEstimate`
  - `releasedBanditsEstimate`
  mesmo quando os valores ja representam contagem real
- `banditsDeadRecent` e usado como memoria curta de perdas recentes para leitura de estado e proximas regras economicas, sem abrir ainda cemitério/historico detalhado por individuo

### Objetivo

Fechar a base estrutural do efetivo territorial antes do sistema de roubos da `15.3`, deixando soldados e bandidos claramente separados e permitindo que economia, BOPE, saidinha e politica de roubos conversem com o mesmo estado persistente.

## 2026-03-12 — Fase 15.3 (Sistema de roubos)

### O que foi implementado

- entrou o catalogo protegido de roubos em `/api/robberies`
- entrou a tentativa autoritativa em `/api/robberies/:robberyType/attempt`
- o backend agora cobre os quatro roubos-base do pre-alpha:
  - `pedestrian`
  - `cellphones`
  - `vehicle`
  - `truck`
- cada roubo passou a ter:
  - cooldown proprio
  - risco
  - recompensa
  - delta de calor policial
  - delta de pressao policial regional
  - comissao fixa para a faccao
- o jogador passou a poder executar o roubo diretamente, consumindo `stamina` e `nerve`
- a faccao passou a poder executar o roubo via bandidos da favela, consumindo o efetivo real da `15.2`
- falha dos bandidos agora:
  - prende bandidos reais
  - reduz `banditsActive`
  - aumenta `banditsArrested`
  - cria lote persistido de retorno em `favela_bandit_returns`
- sucesso do roubo agora credita comissao automatica no banco da faccao e no ledger com:
  - `entryType = robbery_commission`
  - `originType = robbery`

### Simplificacoes assumidas no pre-alpha

- o "calor territorial" dos roubos continua representado por `regions.policePressure`, sem um medidor separado por favela/regiao criminal
- o lucro liquido do roubo executado por bandidos ainda entra em `money` do jogador como proxy de "caixa operacional", sem abrir ainda uma conta/caixa dedicada por favela
- o roubo de veiculos nesta etapa ainda e generico; os subfluxos:
  - resgate/devolucao
  - desmanche/pecas
  - clonagem/Paraguai
  ficam para a `15.4`
- a politica de roubos da faccao continua fora desta etapa e entra apenas na `15.5`

### Objetivo

Fechar a primeira camada funcional de roubos do pre-alpha para que economia faccional, efetivo de bandidos, calor policial e territorio passem a operar sobre o mesmo fluxo server-side antes de abrir os subfluxos especializados de veiculos e a politica de roubos da faccao.

## 2026-03-12 — Fase 15.4 (Roubo de veiculos)

### O que foi implementado

- o roubo de veiculos agora exige a escolha de uma rota explicita:
  - `ransom`
  - `chop_shop`
  - `paraguay`
- o catalogo de roubos passou a expor essas rotas em `/api/robberies`
- a tentativa em `/api/robberies/vehicle/attempt` agora valida `vehicleRoute`
- cada rota passou a ter:
  - recompensa base propria
  - calor policial proprio
  - comissao faccional propria
  - risco proprio
  - cooldown proprio
- `ransom` agora escala melhor em regioes mais ricas e tambem carrega mais calor/risco
- `chop_shop` virou a rota mais estavel, com menor upside regional
- `paraguay` virou a rota de risco estrutural alto, com menor dependencia da riqueza local

### Simplificacoes assumidas no pre-alpha

- os tres desfechos ainda liquidam em dinheiro direto no mesmo fluxo de roubo
- ainda nao existe estoque persistente de veiculos roubados
- ainda nao existe cadeia fisica de:
  - pecas de desmanche
  - oficinas receptadoras
  - escoamento/logistica dedicada para Paraguai
- a diferenciacao desta fase e economica/operacional, nao ainda de inventario/logistica

### Objetivo

Fechar a especializacao mais importante do sistema de roubos antes da politica regional de roubos da `15.5`, deixando o pre-alpha com tres perfis distintos de roubo de veiculo e balanceamento coerente com o documento de jogo.

## 2026-03-12 — Fase 15.5 (Politica de roubos da faccao)

### O que foi implementado

- entrou a leitura protegida da politica de roubos em:
  - `GET /api/factions/:factionId/robbery-policy`
- entrou a edicao protegida da politica de roubos em:
  - `PATCH /api/factions/:factionId/robbery-policy`
- a politica agora pode ser configurada por:
  - `global: allowed | forbidden`
  - `regions: { [regionId]: allowed | forbidden }`
- o backend de roubos agora consome essa politica antes de executar o roubo
- `GET /api/robberies` agora devolve a politica ativa da faccao do jogador
- quando a faccao proibe roubos globalmente:
  - o roubo e bloqueado com erro `403`
- quando a faccao proibe roubos apenas na regiao atual:
  - o backend desloca a execucao para outra regiao permitida
  - marca `policyDisplacedFromRegionId`
  - aplica penalidade de risco pelo percurso

### Simplificacoes assumidas no pre-alpha

- o deslocamento regional ainda e automatico e escolhe a primeira regiao permitida disponivel no backend
- o jogador ainda nao escolhe manualmente a regiao-destino do roubo deslocado
- a politica ainda nao altera diretamente:
  - satisfacao dos moradores
  - satisfacao interna da faccao
  - crescimento/queda dos bandidos
- esses efeitos entram apenas na `15.6`

### Objetivo

Fechar a camada politica do sistema de roubos antes da satisfacao interna da faccao, garantindo que regras do lider, deslocamento territorial e economia criminal passem a conversar sobre o mesmo fluxo server-side no pre-alpha.

## 2026-03-12 — Fase 15.6 (Satisfacao interna da faccao)

### O que foi implementado

- a satisfacao interna da faccao passou a reagir imediatamente a mudancas na politica de roubos
- politicas mais restritivas agora derrubam `internalSatisfaction`
- politicas mais abertas recuperam parte desse humor
- o sistema de roubos tambem passou a retroalimentar a satisfacao interna:
  - sucesso executado pelo jogador sobe pouco
  - sucesso executado pelos bandidos sobe mais
  - falhas derrubam
  - falhas dos bandidos pesam mais que falhas individuais
- Tribunal do Trafico, Faca na Caveira, politica de roubos e resultado operacional agora convergem sobre o mesmo atributo persistido da faccao
- o crescimento/reducao do pool de bandidos por favela passa a refletir esse estado sem novo acoplamento, porque a sincronizacao territorial ja consome `internalSatisfaction`

### Simplificacoes assumidas no pre-alpha

- os deltas de satisfacao interna ainda sao heuristicas discretas, nao um modelo continuo sofisticado
- ainda nao existe segmentacao por perfil de membro da faccao (cria, vapor, soldado etc.) para o humor interno
- o efeito ainda e agregado por faccao, nao por favela
- a resposta da satisfacao interna aos roubos foi calibrada para manter o sistema legivel no pre-alpha:
  - politica mais restritiva derruba mais
  - politica mais aberta recupera
  - sucesso do jogador sobe pouco
  - sucesso dos bandidos sobe mais
  - falha dos bandidos derruba mais

### Objetivo

Fechar o elo entre lideranca, politica de rua e operacao criminal antes da `15.7`, garantindo que o pre-alpha ja tenha um estado interno coerente para explicar variacao do efetivo de bandidos entre favelas sob a mesma faccao.

## 2026-03-12 — Fase 15.7 (Inflacao de NPCs)

### O que foi implementado

- entrou um leitor server-side de inflacao baseado no dia da rodada ativa
- o backend agora calcula um `moneyMultiplier` crescente ao longo da rodada
- os principais sinks de NPC do pre-alpha passaram a consumir esse multiplicador:
  - hospital
  - treino
  - universidade
- a inflacao e aplicada tanto na leitura dos centros/catalogos quanto na cobranca real das acoes
- os testes passaram a validar explicitamente custo inflado em:
  - `training`
  - `university`
  - `hospital`

### Simplificacoes assumidas no pre-alpha

- a inflacao ainda nao cobre todos os sistemas economicos do jogo
- nesta etapa ela foi ligada apenas aos principais servicos de NPC pagos em dinheiro
- custos em creditos ficaram fora do multiplicador
- sem rodada ativa persistida em `round`, o multiplicador fica neutro em `1.0`
- a calibragem usa curva simples de late-game, suficiente para pre-alpha, e pode ser refinada junto da `15.8` e da futura fase de testes/balanceamento

### Objetivo

Fechar a primeira camada de pressao economica de fim de rodada antes de implementar a rodada em si na `15.8`, garantindo que o pre-alpha ja tenha um vetor concreto de encarecimento do late-game nos servicos centrais de NPC.

## 2026-03-12 — Fase 15.8 (Rodadas)

### O que foi implementado

- entrou um `RoundService` autoritativo no backend para abrir, sincronizar e encerrar rodadas
- o backend agora garante uma rodada ativa no bootstrap e no scheduler
- foi criada a leitura protegida `GET /api/round` para expor:
  - rodada atual
  - dia corrente da rodada
  - tempo restante
  - leaderboard vivo por `conceito`
  - premio do top 10
- quando a rodada expira:
  - o ranking final e calculado por `conceito`
  - o resultado e persistido em `round_rankings`
  - o top 10 recebe `5` creditos cada
  - o mundo jogavel e resetado
  - uma nova rodada e aberta imediatamente
- o reset de rodada cobre o estado dinamico principal do pre-alpha:
  - economia
  - inventario
  - propriedades e negocios
  - faccoes e lideranca
  - territorio
  - mercado
  - prisao
  - eventos
  - PvP

### Simplificacoes assumidas no pre-alpha

- a proxima rodada nasce no `now` do sync; se o servidor ficou parado por muito tempo, nao sao criadas “catch-up rounds”
- contas, nickname, aparencia, vocacao e creditos sao preservados entre rodadas
- o reset devolve o personagem ao baseline da vocacao atual, em vez de reabrir criacao de personagem
- `Hall da Fama` ainda nao foi exposto nesta etapa; a persistencia bruta do ranking ficou pronta em `round_rankings`, e a camada de historico/consulta fica para a `15.9`
- bonus herdados da rodada anterior ficam para a `15.10`
- `characterCreatedAt` foi preservado; por isso a protecao de novato nao e recalculada a cada rodada neste pre-alpha

### Objetivo

Fechar o lifecycle central da rodada antes do Hall da Fama e dos bonus herdados, para que o pre-alpha ja tenha começo, meio e fim de competicao com ranking final, recompensa premium e reset de mundo coerente.

## 2026-03-12 — Fase 15.9 (Hall da Fama)

### O que foi implementado

- a rodada ganhou leitura historica protegida em `GET /api/round/hall-of-fame`
- o backend agora agrega `round` + `round_rankings` e devolve, para cada rodada encerrada:
  - `roundId`
  - `roundNumber`
  - `startedAt`
  - `endedAt`
  - vencedor
  - `topThree`
- o contrato compartilhado do Hall da Fama foi fechado em `@cs-rio/shared`, preparando o consumo mobile sem reabrir a camada de modelagem

### Simplificacoes assumidas no pre-alpha

- o Hall da Fama usa o `nickname` atual do jogador no momento da consulta
- nao ha snapshot historico de:
  - nickname
  - faccao
  - visual
  - titulo/level
- o Hall da Fama foi fechado primeiro como leitura server-side; a tela mobile dedicada pode ser encaixada depois sem mexer no backend

### Objetivo

Fechar a memoria competitiva do pre-alpha imediatamente depois do lifecycle de rodada, reaproveitando `round_rankings` sem inventar um segundo modelo de ranking historico.

## 2026-03-12 — Fase 15.10 (Bonus herdados da rodada anterior)

### O que foi implementado

- o rollover da rodada agora aplica bonus herdados imediatamente na abertura do novo ciclo
- a colocacao final da rodada anterior virou pacote inicial da rodada seguinte:
  - campeao: `R$ 15.000` no bolso + `R$ 7.500` no banco
  - top 2-3: `R$ 10.000` + `R$ 5.000`
  - top 4-10: `R$ 5.000` + `R$ 2.500`
- a aplicacao acontece no mesmo reset autoritativo que reabre o mundo na `15.8`

### Simplificacoes assumidas no pre-alpha

- nesta etapa o bonus herdado considera apenas a colocacao final da rodada anterior
- nao entram ainda:
  - conquistas especiais
  - marcos territoriais
  - herancas tematicas por vocacao/faccao
  - resgate manual de bonus no cliente
- o bonus e aplicado direto em `money` e `bankMoney`, sem nova UI dedicada

### Objetivo

Fechar a heranca minima entre rodadas no pre-alpha com impacto jogavel imediato, sem inflar ainda um sistema maior de achievements persistentes.

## 2026-03-12 — Fase 16.1 (Infraestrutura de audio)

### O que foi implementado

- entrou um `AudioProvider` global no app mobile, centralizando:
  - `playSfx`
  - `playMusic`
  - `stopMusic`

## 2026-03-12 — Ajustes operacionais de facções fixas, mercado e territórios-base

### O que foi implementado

- facções fixas passaram a aceitar **entrada direta** de novos jogadores enquanto houver vagas de substituição de NPCs
  - a entrada cai sempre no cargo `Cria`
  - o payload da facção agora expõe `availableJoinSlots` e `canSelfJoin`
  - o app mobile mostra `Entrar como cria` quando a facção fixa ainda comporta novos membros
- o Mercado Negro do pré-alpha passou a ser **híbrido**
  - continua com order book e leilão P2P entre usuários
  - mas agora também nasce com `Fornecedor da rodada` para armas, coletes, drogas e insumos
  - esse fornecedor tem estoque limitado e reposição controlada pelo backend/seed
- o seed e o rollover de rodada passaram a reaplicar **territórios iniciais** das facções fixas
  - isso evita que o mundo renasça totalmente neutro
  - o Painel Territorial e o mapa deixam de depender de ajuste manual no banco para mostrar domínio base da rodada

### Simplificações assumidas no pré-alpha

- a entrada direta em facção fixa continua limitada a slots iniciais; acima disso, o fluxo volta a depender de recrutamento/hierarquia normal
- o fornecedor da rodada é controlado por seed e backend, sem painel administrativo no cliente
- a conquista solo de favela neutra sem facção ainda não entrou neste recorte; o domínio territorial continua modelado como posse de facção

### Objetivo

Melhorar o estado inicial de cada rodada para playtest real:
- facções fixas deixarem de parecer clubes fechados controlados só por NPC
- mercado não nascer vazio
- território não nascer inconsistente entre mapa e painel
  - sincronizacao de musica por regiao
- a configuracao de audio passou a ser estado global em `appStore`, com:
  - volume de musica
  - volume de efeitos
  - mute de musica
  - mute de efeitos
- a tela de `Configuracoes` deixou de usar estado local fake e passou a controlar o sistema real
- o feedback sonoro do `CrimeResultModal` saiu do uso isolado de `expo-av` e foi migrado para a camada central
- notificacoes novas do feed de eventos passaram a disparar som via o mesmo sistema

### Simplificacoes assumidas no pre-alpha

- a infraestrutura de musica por regiao ficou pronta antes dos assets definitivos
- nesta etapa:
  - ainda nao existem trilhas dedicadas por regiao
  - o catalogo de musica fica em modo placeholder ate a `16.3`
  - os efeitos ainda reaproveitam placeholders disponiveis ate a `16.2`
- a persistencia das preferencias de audio fora do ciclo atual do app pode entrar depois, se continuar valendo para o pre-alpha

### Objetivo

Fechar a base tecnica unica de audio antes de espalhar novos sons e trilhas pelo projeto, para que `16.2` e `16.3` apenas troquem assets e liguem novos eventos sem retrabalho estrutural.

## 2026-03-12 — Fase 16.2 (SFX placeholder)

### O que foi implementado

- o mobile agora usa regras centrais de disparo de SFX placeholder para:
  - caminhada no mapa
  - resultado de crime
  - combate PvP
  - execucao de contratos
  - notificacoes de eventos
  - level up
  - morte em combate
- `GameView` passou a tocar caminhada ao iniciar um deslocamento valido, com throttle para evitar spam
- o resultado de crime agora distingue:
  - prisao
  - falha
  - sucesso
  - level up
- combate e contratos passaram a tocar:
  - `combat` em resultado normal
  - `death` quando a fatalidade realmente acontece
- as regras ficaram isoladas em helpers testados, evitando condicao de audio espalhada pelas telas

### Simplificacoes assumidas no pre-alpha

- os efeitos ainda reaproveitam poucos arquivos genericos ja existentes
- nao entrou variacao por arma, tipo de golpe, tipo de veiculo ou contexto territorial
- o objetivo desta etapa foi validar:
  - timing
  - feedback imediato
  - percepcao basica de resposta
  sem travar o roadmap aguardando design sonoro final

### Objetivo

Fechar o pacote minimo de feedback sonoro placeholder da pre-alpha antes de entrar em musica ambiente, tutorial sensorial e polish audiovisual mais amplo.

## 2026-03-12 — Fase 16.3 (Musica ambiente placeholder)

### O que foi implementado

- o catalogo musical placeholder passou a ter trilha provisoria para todas as regioes jogaveis:
  - `Centro`
  - `Zona Norte`
  - `Zona Sul`
  - `Zona Oeste`
  - `Zona Sudoeste`
  - `Baixada`
- o `AudioProvider` agora guarda a trilha desejada da regiao e consegue:
  - iniciar a musica correta ao entrar no mapa
  - trocar automaticamente quando a regiao muda
  - retomar a trilha ao religar a musica nas configuracoes
- o app segue usando o mesmo contrato de sincronizacao musical por `regionId`, entao a substituicao futura dos placeholders fica isolada no catalogo

### Simplificacoes assumidas no pre-alpha

- as “musicas” ainda reaproveitam poucos arquivos genericos existentes no projeto
- o objetivo desta etapa nao foi fechar identidade sonora final, e sim validar:
  - mudanca contextual por regiao
  - convivencia entre SFX e musica
  - comportamento de mute/volume no fluxo real
- a direcao musical definitiva continua para troca posterior dos assets, sem mudar a integracao tecnica

### Objetivo

Fechar a camada minima de ambiencia musical por regiao para que o pre-alpha ja tenha contraste sensorial basico entre areas do mapa, mesmo ainda com audio placeholder.

## 2026-03-12 — Fase 16.4 (Tutorial interativo)

### O que foi implementado

- o onboarding minimo da home virou um tutorial em etapas guiado por NPCs
- o fluxo agora acompanha cinco passos reais do loop base:
  - andar no mapa
  - abrir crimes
  - abrir treino
  - abrir mercado
  - abrir territorio
- cada etapa passou a ter:
  - NPC guia
  - copy curta
  - CTA objetiva
  - progresso visivel
  - janela temporal de 30 minutos
- a progressao avanca por acao real do jogador, sem botao fake de “proximo”

### Simplificacoes assumidas no pre-alpha

- o tutorial fica no cliente e e ancorado principalmente na `HomeScreen`
- a janela de 30 minutos vale para a sessao/tutorial local atual, sem persistencia longa entre reinstalacao/reinicio do app
- o fluxo ainda nao abre telemetria detalhada, checkpoint server-side nem tutorial contextual em todas as telas
- o objetivo desta etapa foi garantir:
  - compreensao inicial do loop
  - clareza de “onde estou / o que faco agora”
  - uma primeira camada de orientacao sem travar o restante do roadmap

### Objetivo

Fechar o onboarding interativo minimo da pre-alpha antes de entrar nas animacoes, VFX e notificacoes push, para que a sessao inicial ja ensine o loop em vez de depender so de textos soltos na home.

## 2026-03-12 — Fase 16.5 (Animacoes de transicao)

### O que foi implementado

- o stack mobile passou a ter animacao nativa consistente entre telas
- a navegacao agora combina:
  - `slide_from_right` para telas internas
  - `fade_from_bottom` em pontos de entrada de fluxo
  - `fade` para a volta ao mapa/home
- as telas internas baseadas em `InGameScreenLayout` ganharam entrada animada do conteudo com:
  - fade
  - leve subida do layout

### Simplificacoes assumidas no pre-alpha

- esta etapa fecha uma base uniforme de transicao, nao um sistema completo de motion design
- nao entrou animacao customizada por modulo, shared element transition ou coreografia por CTA
- a prioridade foi melhorar:
  - percepcao de mudanca de contexto
  - leitura de fluxo entre telas
  - sensacao minima de polish
  sem aumentar muito o custo de manutencao antes da estabilizacao mobile-first

### Objetivo

Evitar trocas secas entre modulos e deixar a navegacao da pre-alpha com um baseline de movimento coerente antes de entrar em VFX e notificacoes push.

## 2026-03-12 — Fase 16.6 (Efeitos visuais placeholder)

### O que foi implementado

- crimes agora exibem burst visual placeholder dentro do `CrimeResultModal`
- combate PvP passou a disparar burst visual no card de resultado da porrada/emboscada
- contratos de assassinato passaram a usar o mesmo baseline visual na ultima execucao
- entrou uma regra central para mapear resultado em variante visual:
  - `success`
  - `danger`
  - `combat`
  - `level_up`

### Simplificacoes assumidas no pre-alpha

- os efeitos ainda sao placeholders leves em `Animated`, sem shader, sprite sheet ou sistema dedicado de particulas
- nao entrou variacao por arma, tipo de crime, favela, faccao ou clima
- o objetivo desta etapa foi fechar:
  - resposta visual imediata
  - contraste minimo entre sucesso, perigo e level up
  - uma base simples de VFX que nao force mudanca nativa antes da pre-alpha

### Objetivo

Evitar que resultado importante chegue apenas por texto e audio, adicionando uma camada visual minima de impacto antes do fechamento da fase de audio/polish.

## 2026-03-12 — Fase 16.7 (Notificacoes push placeholder)

### O que foi implementado

- entrou `expo-notifications` no mobile com canal Android dedicado para o pre-alpha
- o app ganhou `NotificationProvider` centralizando:
  - permissao
  - disparo imediato de alertas locais
  - agendamento de timers
- o app root agora usa notificacoes locais para:
  - eventos do feed (`docks`, policiais e sazonais)
  - avisos de contratos/ataques vindos do mural PvP
  - fim de timer de prisao e hospital
- a tela de `Configuracoes` passou a expor:
  - toggle de alertas do aparelho
  - status atual da permissao
  - CTA para revisar a permissao no fluxo do app

### Simplificacoes assumidas no pre-alpha

- esta etapa fecha notificacao local/schedule-driven, nao push remoto completo com token Expo, backend dedicado ou fanout server-side
- a fonte de “ataques” no pre-alpha fica concentrada nas notificacoes de contratos PvP, que ja existem de forma persistida no dominio
- timers cobertos aqui:
  - prisao
  - hospital
- outros timers do jogo podem entrar depois sem reabrir a infraestrutura

### Objetivo

Fechar a ultima lacuna da fase de audio/polish com alertas nativos suficientes para o pre-alpha, permitindo perceber eventos, risco PvP e fim de timer mesmo fora da tela de origem.

## 2026-03-12 — Fase 17.4 (Layout audit mobile-first)

### O que foi implementado

- a shell in-game ficou mais compacta em larguras menores, com:
  - menos padding vertical/horizontal
  - hero mais contido
  - titulo/subtitulo menos expansivos
- o HUD principal do mapa foi ajustado para device estreito:
  - `StatusBar` mais compacta
  - recursos resumidos em labels curtas no modo rapido
  - `Minimap` menor no estado compacto
  - `ActionBar` em coluna unica quando a largura real nao comporta duas colunas
- a `HomeScreen` ganhou limites mais seguros para o container do status dentro da camada do mapa

### Simplificacoes assumidas no pre-alpha

- a auditoria desta etapa foi concentrada nos pontos que mais apareciam no playtest:
  - mapa
  - HUD
  - bottom sheet de acoes
  - shell das telas internas
- nao foi uma passada de pixel-perfect em todos os modulos do app
- o restante fica dividido entre:
  - `17.5` para resposta imediata e estados de acao
  - `17.6` para clareza semantica e linguagem

### Objetivo

Fechar a maior parte dos estouros e da densidade visual mais agressiva antes da reta final de estabilizacao mobile-first, sem abrir ainda um polish visual definitivo.

## 2026-03-12 — Fase 17.5 (Feedback imediato ao toque)

### O que foi implementado

- os fluxos com round-trip mais perceptivel no mobile passaram a responder no primeiro toque com estado visual e texto de progresso:
  - `Crimes`
  - `Combate`
  - `Contratos`
  - `Prisão`
  - `Hospital`
  - `Configurações`
- os botoes principais dessas telas agora:
  - trocam label imediatamente
  - exibem `ActivityIndicator` durante a mutacao
  - bloqueiam reenvio duplicado enquanto a acao esta em andamento
- as telas tambem passaram a disparar mensagens contextuais antes da resposta final da API, reduzindo a sensacao de “cliquei e nada aconteceu”

### Simplificacoes assumidas no pre-alpha

- esta etapa fecha a resposta imediata nos fluxos mais sensiveis ao playtest, nao uma camada completa de optimistic UI no app inteiro
- nao entrou prefetch profundo de todos os modulos nem reestruturacao global de cache
- a ideia foi atacar primeiro onde a percepcao de falha silenciosa estava mais forte:
  - mutacoes de backend
  - sincronizacao de listas
  - botoes de acao unica

### Objetivo

Reduzir a latencia percebida do app antes do fechamento da pre-alpha, deixando claro para o jogador que o toque foi aceito mesmo quando a resposta final ainda depende da API.

## 2026-03-12 — Fase 17.6 (Clareza semantica e linguagem)

### O que foi implementado

- passada semantica final nos modulos mais expostos ao playtest real:
  - `HUD`
  - `Home`
  - `Crimes`
  - `Combate`
  - `Contratos`
  - `Facção`
  - `Território`
  - `Perfil`
  - `Rave/Baile`
- o mobile agora:
  - corrige acentuacao em labels mais visiveis
  - reduz siglas opacas
  - troca termos pouco naturais por linguagem mais direta
  - reforca melhor contexto de leitura em telas densas

### Simplificacoes assumidas no pre-alpha

- esta etapa nao representa auditoria linguistica absoluta do app inteiro
- a prioridade foi fechar os pontos que mais contaminavam o playtest e a compreensao do loop central
- a passada editorial fina e abrangente segue como trabalho vivo dentro da fase de validacao posterior

### Objetivo

Fechar o ultimo item da estabilizacao mobile-first com linguagem minimamente clara para device real, deixando o projeto pronto para o gate final data-driven da pre-alpha sem manter o fluxo principal preso em labels confusas ou texto cru demais.

### Resultado de roadmap

- com a entrega da `17.6`, a `Fase 17` fecha em `100%`
- esse fechamento deixa pronta a camada de UX mobile-first do projeto, mas nao encerra mais sozinho a `Pre-Alpha`
- a prioridade seguinte passa a ser a nova `Fase 18`, que reabre o marco para garantir configuracao dinamica por rodada antes do funil pesado de validacao

## 2026-03-12 — Fase 19.9 (Revisao ampla do portugues visivel no mobile)

### O que foi implementado

- passada ampla, tela por tela e componente por componente, nos textos mais visiveis do app mobile
- correcao de:
  - acentuacao
  - cedilha
  - termos com grafia quebrada
  - labels de status
  - mensagens de erro e feedback
- revisao aplicada nos fluxos mais expostos ao playtest:
  - login e registro
  - crimes
  - mercado
  - faccao
  - territorio
  - treino
  - universidade
  - fabricas
  - patrimonio/operacoes
  - hospital/prisao
  - HUD e mensagens realtime

### Simplificacoes assumidas nesta passada

- esta etapa foi focada no texto visivel ao jogador dentro do mobile
- nao houve auditoria completa de todos os textos internos do backend, seeds ou documentacao tecnica
- placeholders tecnicos e ids internos nao foram renomeados quando nao afetavam a leitura do jogador

### Objetivo

Reduzir ruido de linguagem no playtest real, removendo a impressao de produto inacabado causada por texto sem acento, sem cedilha ou com leitura truncada nas telas mais usadas.

## 2026-03-12 — Reabertura da Pre-Alpha por configuracao dinamica via banco

### Decisao

Foi decidido que o marco de **Pre-Alpha** nao deve mais ser tratado como concluido apenas pelo fechamento do core funcional e da UX mobile.

Antes da Pre-Alpha, o projeto agora precisa fechar uma etapa adicional: **Fase 18 — Configuracao Dinamica / Data-Driven**.

### Motivo

CS Rio e um jogo **vivo por rodada**. Se os parametros criticos continuarem presos em hard-code, cada rodada tende a repetir o mesmo comportamento estrutural e o custo de balanceamento/iteracao fica alto demais.

### O que precisa deixar de ser hard-coded

- tipos de evento
- tipos de roubo/assalto
- rotas de roubo de veiculo
- configuracao de regioes
- configuracao de favelas
- faccoes fixas
- limites territoriais
- crescimento e perdas de bandidos/soldados
- multiplicadores economicos
- ganhos e perdas de eventos
- thresholds e pesos usados por sistemas centrais

### Restricoes explicitas

- isso **nao** significa expor painel administrativo ao jogador
- isso **nao** significa abrir client para configuracao
- as alteracoes continuam sendo internas, por:
  - seed
  - banco
  - comandos server-side futuros

### Modelo alvo

- o banco vira a **fonte de verdade** da rodada ativa para definicoes relevantes de balanceamento
- cada definicao importante precisa suportar:
  - ativa/inativa
  - validade por rodada
  - override de rodada
  - escopo global ou localizado
- o codigo mantem fallback tecnico apenas para bootstrap e seguranca de execucao

### Impacto no roadmap

- a Pre-Alpha foi **reaberta**
- a nova **Fase 18** entra antes do marco
- a antiga fase de **Testes e Balanceamento** foi empurrada para a **Fase 19**
- o objetivo agora e chegar na Pre-Alpha ja com o jogo suficientemente configuravel para variar entre rodadas sem refactor de codigo

## 2026-03-12 — Fase 18.1 (Catalogo central de definicoes dinamicas)

### O que foi implementado

- criadas as tabelas-base do modelo data-driven:
  - `game_config_sets`
  - `game_config_entries`
  - `round_config_overrides`
  - `feature_flags`
- criado o `GameConfigService` no backend como resolvedor central da configuracao ativa
- seedado o conjunto padrao `pre_alpha_default_2026_03` com:
  - chaves globais de rodada e banco
  - exemplos escopados por regiao, favela e tipo de roubo
  - feature flags iniciais por evento e tipo de roubo
- adicionada cobertura automatizada da prioridade de resolucao:
  - set base
  - override de rodada
  - desativacao por status
  - fallback global por escopo

### Decisoes de modelagem

- `target_key` usa `*` como alvo generico padrao, simplificando unicidade e fallback
- `feature_flags` permanecem separados de `game_config_entries` para deixar claro o caso “liga/desliga” sem misturar com tuning numerico
- `round_config_overrides` podem tanto sobrescrever quanto **desativar** uma definicao do set base ao usar `status = inactive`

### Simplificacoes assumidas nesta etapa

- o backbone data-driven foi entregue **antes** da migracao massiva dos sistemas
- crimes, eventos, economia, territorio e outros modulos ainda nao consomem amplamente esse catalogo; isso continua nas proximas tarefas da Fase 18, principalmente `18.7` e `18.10`
- ainda nao existe comando interno nem interface operacional para alterar configuracoes durante a rodada; isso fica para `18.8`

### Objetivo

Fechar a espinha dorsal persistida da configuracao por rodada para que o restante da migracao deixe de depender de constantes hard-coded espalhadas no codigo.

## 2026-03-12 — Fase 18.2 (Regioes, favelas e faccoes fixas persistidas)

### O que foi implementado

- `regions` ganhou campos persistidos de ordenacao/ativacao e baseline operacional:
  - `sort_order`
  - `is_active`
  - `is_default_spawn`
  - `wealth_label`
  - `density_label`
  - `spawn_position_x`
  - `spawn_position_y`
  - `default_police_pressure`
- `favelas` ganhou campos persistidos para deixar de depender de formula embutida no reset:
  - `sort_order`
  - `is_active`
  - `base_bandit_target`
  - `default_satisfaction`
- `factions` ganhou identidade de template e ordenacao/ativacao:
  - `template_code`
  - `sort_order`
  - `is_active`
- o seed foi refeito para gravar explicitamente esses valores no banco e fazer `upsert` idempotente das definicoes estruturais
- a criacao inicial de conta agora escolhe a regiao padrao de spawn a partir do banco
- a criacao de personagem passa a usar o spawn persistido da regiao
- o rollover da rodada passou a resetar:
  - `regions.police_pressure` usando `default_police_pressure`
  - `favelas.max_soldiers`, `base_bandit_target` e `default_satisfaction` usando os valores persistidos
- o pool de bandidos territorial/roubo agora calcula `targetActive` a partir de `base_bandit_target` persistido em vez de derivar tudo novamente da formula original
- foi criado o `WorldDefinitionService` para leitura estruturada de:
  - regioes ativas
  - favelas ativas
  - templates fixos de faccao
  - regiao default de spawn

### Decisoes de modelagem

- os enums tecnicos de regiao continuam existindo por compatibilidade nesta fase, mas a **fonte de verdade operacional** das definicoes estruturais passa a ser o banco
- `max_soldiers` continua na propria favela como configuracao persistida do teto daquela favela
- `base_bandit_target` foi separado de `bandits_active` para deixar claro o que e baseline configuravel e o que e estado vivo da rodada
- `default_police_pressure` foi separado de `police_pressure` para permitir reset por rodada sem perder a configuracao-base da regiao

### Simplificacoes assumidas nesta etapa

- o seed continua existindo como carga inicial de bootstrap, mas a rodada parou de tratar aqueles arrays como verdade viva
- ainda nao abrimos cadastro dinamico de novos ids de regiao fora do enum tecnico atual; o ganho desta fase foi tirar o comportamento operacional do hard-code, deixando a evolucao total para a migracao mais ampla de `18.10`
- o mobile ainda pode ter metadados auxiliares em constantes locais, mas o backend ja usa o banco como verdade para spawn, reset e templates estruturais

### Objetivo

Fechar o primeiro bloco estrutural da migracao data-driven, tirando do codigo os baselines de regiao/favela/faccao fixa que ainda eram recalculados ou assumidos por constante durante a rodada.

## 2026-03-12 — Fase 18.3 (Roubos e rotas de veiculo configuraveis)

### O que foi implementado

- o seed dinamico passou a persistir definicoes completas de roubo em `game_config_entries`:
  - `robbery.definition` para:
    - `pedestrian`
    - `cellphones`
    - `vehicle`
    - `truck`
  - `robbery.vehicle_route_definition` para:
    - `vehicle_route:ransom`
    - `vehicle_route:chop_shop`
    - `vehicle_route:paraguay`
- o catalogo dinamico tambem ganhou `feature_flags` dedicadas por tipo e por rota:
  - `robberies.pedestrian.enabled`
  - `robberies.cellphones.enabled`
  - `robberies.vehicle.enabled`
  - `robberies.truck.enabled`
  - `robberies.vehicle_route.<rota>.enabled`
- `RobberyService` passou a resolver o catalogo efetivo via `GameConfigService` antes de:
  - montar `GET /api/robberies`
  - executar `POST /api/robberies/:robberyType/attempt`
- a execucao real agora respeita o banco para:
  - label
  - nivel minimo
  - cooldown
  - faixa de recompensa
  - faixa de calor
  - taxa de comissao faccional
  - executores permitidos
- roubos/rotas desativados por flag deixam de aparecer no catalogo e passam a bloquear tentativa com erro explicito de rodada
- entrou teste de integracao alterando diretamente `game_config_entries` e `feature_flags` para provar que:
  - o catalogo muda sem refactor
  - a execucao muda sem refactor
  - tipos/rotas inativos somem do catalogo e ficam bloqueados

### Decisoes de modelagem

- mantivemos `RobberyType` e `VehicleRobberyRoute` no shared por compatibilidade de contrato do Pre-Alpha, mas a **fonte de verdade operacional** do catalogo de roubos passou a ser o banco
- as rotas de veiculo foram modeladas no catalogo dinamico como `target_key = vehicle_route:<rota>` dentro do escopo `robbery_type`, evitando abrir um escopo novo so para essa etapa
- `feature_flags` controlam disponibilidade por rodada e `game_config_entries` controlam tuning numerico/estrutural do tipo de roubo

### Simplificacoes assumidas nesta etapa

- formulas derivadas de roubo que ainda vivem em funcoes auxiliares do server (ex.: penalidades secundarias e multiplicadores contextuais) continuam fora do catalogo nesta entrega; a etapa fechou o catalogo-base de tipo/rota
- o mobile segue consumindo o catalogo do backend, sem client administrativo nem tela interna de configuracao
- o contrato HTTP continua validando os ids tecnicos de tipo/rota por enum; a flexibilizacao total de criacao arbitraria de novos ids ainda depende da migracao mais ampla prevista em `18.10`

### Objetivo

Tirar do hard-code a tabela viva de roubos da rodada, permitindo ajustar e ligar/desligar tipos e rotas diretamente no banco sem reabrir o codigo do server.

## 2026-03-12 — Fase 18.4 (Eventos configuraveis por banco)

### O que foi implementado

- o seed dinamico passou a persistir `event.definition` para todos os eventos atualmente suportados pelo backend:
  - `navio_docas`
  - `operacao_policial`
  - `blitz_pm`
  - `faca_na_caveira`
  - `saidinha_natal`
  - `carnaval`
  - `ano_novo_copa`
  - `operacao_verao`
- o catalogo dinamico tambem ganhou `feature_flags` dedicadas para todos esses tipos de evento
- `GameEventService` passou a resolver o catalogo efetivo via `GameConfigService` antes de:
  - expor `GET /api/events/docks`
  - expor `GET /api/events/police`
  - expor `GET /api/events/seasonal`
  - sincronizar `syncDocks`
  - sincronizar `syncOperationPolicial`
  - sincronizar `syncBlitzPm`
  - sincronizar `syncFacaNaCaveira`
  - sincronizar `syncSaidinhaNatal`
  - sincronizar `syncSeasonalEvents`
- o bootstrap real do server (`createApp` e `index.ts`) passou a injetar `GameConfigService` no `GameEventService`, deixando o runtime de dev/producao ler o banco em vez do leitor `noop`
- a cobertura automatizada passou a provar que:
  - `navio_docas` desabilitado por flag nao agenda evento
  - `navio_docas` customizado pelo catalogo muda janela, multiplicador e regiao
  - `carnaval` customizado pelo catalogo muda regioes, headline e bonus
  - eventos sazonais desabilitados por flag nao entram no scheduler

### Decisoes de modelagem

- mantivemos um fallback tecnico no codigo para cada evento conhecido, mas a **fonte de verdade operacional** passou a ser o banco
- `headline`, duracao, cooldown, regioes elegiveis, multiplicadores e pesos principais saem do `event.definition`
- `feature_flags` continuam sendo o mecanismo explicito de liga/desliga da rodada para cada tipo de evento
- `navio_docas` passou a escolher a regiao-alvo a partir da definicao persistida, em vez de assumir `Centro` como valor operacional fixo
- o multiplicador sazonal de pressao policial deixou de ser inferido so por `policeMood` e ganhou campo numerico explicito (`policeRollMultiplier`) no catalogo

### Simplificacoes assumidas nesta etapa

- a etapa deixou os **eventos existentes** data-driven, mas o scheduler continua preso ao conjunto de tipos que o server conhece hoje
- isso significa que criar um evento totalmente novo direto no banco **ainda nao** basta para ele rodar sozinho; sera necessario entregar a execucao correspondente no server
- em compensacao, os eventos ja suportados pelo recorte atual deixaram de depender de valores hard-coded espalhados
- os endpoints continuam retornando contratos tipados do pre-alpha; a flexibilidade entregue aqui e de parametrizacao e ativacao, nao de schema aberto ao client

### Objetivo

Fechar o bloco de eventos conhecidos do pre-alpha como configuracao data-driven de verdade, permitindo rebalancear duracao, cooldown, ativacao, regioes, headlines e multiplicadores diretamente no banco entre rodadas.

## 2026-03-12 — Fase 18.5 (Economia territorial e de negocios parametrizada)

### O que foi implementado

- o catalogo dinamico passou a persistir definicoes de economia territorial e de negocios em `game_config_entries`:
  - `economy.property_definition`
  - `economy.property_event_profile`
  - `territory.service_definition`
  - `territory.propina_policy`
  - `territory.propina_region_profile`
- entrou um resolvedor dedicado de economia no backend (`economy-config`) para transformar esse catalogo em definicoes operacionais com cache por runtime
- os negocios do pre-alpha passaram a consumir o banco para definicoes economicas e perfis de evento:
  - `boca`
  - `rave`
  - `puteiro`
  - `front_store`
  - `slot_machine`
- a camada territorial passou a consumir o banco para:
  - definicoes de servicos de favela
  - politica base de propina
  - perfil regional da propina
- o seed `pre_alpha_default_2026_03` passou a gravar esses perfis dinamicos de economia, em vez de depender apenas de constantes espalhadas no server
- a cobertura automatizada continuou passando com a economia real do backend lendo do catalogo resolvido

### Decisoes de modelagem

- mantivemos um resolvedor especializado (`economy-config`) em vez de espalhar parsing de `value_json` pelos servicos
- `GameConfigService` continua sendo a porta de entrada do catalogo resolvido; `economy-config` fica responsavel por traduzir esse catalogo em definicoes prontas de economia
- servicos de favela, propina e negocios passaram a operar por **definicao resolvida**, nao por tabela hard-coded operacional
- a configuracao dinamica desta etapa ficou organizada por dominio:
  - `property_type`
  - `service_type`
  - `region`

### Simplificacoes assumidas nesta etapa

- o ciclo tecnico de operacao dos servicos de favela ainda permanece como constante de infraestrutura do server
- formulas derivadas de negociacao e parte das penalidades contextuais ainda vivem em funcoes auxiliares do backend
- `factory` ainda nao foi totalmente migrada para a camada economica dinamica nesta etapa; o foco ficou em territorio e negocios ja acoplados ao loop principal do pre-alpha

### Objetivo

Tirar do hard-code os parametros centrais da economia territorial e dos negocios, permitindo rebalancear lucro, manutencao, comissao, servicos e propina diretamente no banco entre rodadas.

## 2026-03-12 — Fase 18.6 (Snapshot de configuracao por rodada)

### O que foi implementado

- entrou a tabela `round_feature_flag_overrides` para persistir o congelamento das feature flags por rodada
- o `RoundService` passou a capturar um snapshot automatico do catalogo resolvido ao abrir cada rodada
- esse snapshot agora persiste:
  - entradas resolvidas em `round_config_overrides`
  - flags resolvidas em `round_feature_flag_overrides`
  - um marcador estrutural do snapshot da rodada em `round_config_overrides`
- o marcador do snapshot guarda metadados do set resolvido naquele momento:
  - `setId`
  - `setCode`
  - `setName`
  - `setDescription`
  - `setNotes`
  - `setStatus`
  - `isDefault`
  - `snapshottedAt`
- `GameConfigService` passou a detectar esse marcador e, quando ele existe, resolve o catalogo do round **a partir do snapshot congelado**, ignorando drift posterior do set ativo
- a cobertura automatizada passou a provar que:
  - a rodada nasce com snapshot persistido
  - entradas novas adicionadas ao set ativo depois do snapshot nao vazam para a rodada em andamento
  - flags novas/alteradas no set ativo depois do snapshot nao vazam para a rodada em andamento

### Decisoes de modelagem

- reutilizamos `round_config_overrides` como armazenamento do snapshot de `entries`, evitando abrir mais uma tabela so para configuracoes nao-flag
- abrimos `round_feature_flag_overrides` porque as flags precisavam de congelamento proprio para nao depender do set ativo no meio da rodada
- o snapshot por rodada agora estabelece uma ordem operacional clara:
  - snapshot da rodada
  - override explicito da propria rodada (na mesma estrutura)
  - set ativo so passa a valer para a proxima rodada
- o snapshot foi acoplado ao lifecycle real da rodada no `RoundService`, nao a um comando manual

### Simplificacoes assumidas nesta etapa

- a injecao operacional explicita continua para `18.8`; nesta etapa fechamos o congelamento automatico, nao a ergonomia de mudanca operacional
- o snapshot congela o que o resolvedor atual ja sabe ler; configuracoes futuras entram automaticamente depois que passarem a usar `GameConfigService`
- os contratos HTTP/publicos nao expõem gestao administrativa; o controle continua interno por script/comando e acesso direto ao banco

### Objetivo

Evitar drift imprevisivel no meio do ciclo competitivo, garantindo que cada rodada use um catalogo congelado no momento em que abre e que mudancas posteriores fiquem para a proxima rodada, salvo override explicito.

## 2026-03-12 — Fase 18.7 (Camada de resolucao de configuracao no server)

### O que foi implementado

- entrou um resolvedor central do backend em `apps/server/src/services/server-config.ts`
- essa camada agora unifica tres frentes de leitura:
  - catalogo dinamico por rodada (`GameConfigService`)
  - definicoes economicas resolvidas (`economy-config`)
  - definicoes de mundo vindas do banco (`WorldDefinitionService`)
- o novo resolvedor passou a oferecer uma porta unica para:
  - `getResolvedCatalog`
  - definicoes de propriedade
  - definicoes de servico de favela
  - politica/regra regional de propina
  - regioes ativas
  - spawn padrao
  - definicoes de salas realtime por regiao
- `auth` passou a usar essa camada para resolver a regiao padrao de spawn
- `player` passou a usar essa camada para resolver o spawn do personagem e deixou de depender diretamente de `WorldDefinitionService`
- `property` passou a consumir a lista de propriedades disponiveis pelo resolvedor central e deixou de usar `PROPERTY_DEFINITIONS` como fonte operacional direta
- `realtime` passou a abrir as salas por definicao vinda do resolvedor central, e nao mais por `REGIONS` hard-coded
- a cobertura automatizada nova garante:
  - resolucao de definicao economica com fallback preservado
  - fallback tecnico de regioes para realtime/spawn quando o banco nao retorna definicoes ativas

### Decisoes de modelagem

- mantivemos `GameConfigService`, `economy-config` e `WorldDefinitionService` como camadas especializadas, mas o server agora passa por uma porta unica de resolucao para consumo operacional
- o cache por rodada continua concentrado no catalogo resolvido, enquanto o cache estrutural de regioes/favelas/templates fica no novo resolvedor central
- o fallback tecnico do codigo ficou encapsulado nessa camada, em vez de seguir espalhado nos consumidores

### Simplificacoes assumidas nesta etapa

- algumas formulas auxiliares ainda usam resolvedores especializados em memoria, especialmente no dominio economico
- a migracao exaustiva de todos os servicos restantes para a nova porta unica continua para `18.10`
- as definicoes de favelas e faccoes fixas seguem vindas do banco; o fallback tecnico forte desta etapa foi priorizado para regioes/spawn/realtime, que eram os pontos mais sensiveis de bootstrap

### Objetivo

Criar uma camada unica de leitura/merge/cache das definicoes ativas no backend, reduzindo acoplamento a constantes e preparando o server para as etapas de injecao operacional e migracao total do modelo data-driven.

## 2026-03-12 — Fase 18.8 (Comandos internos e injecao operacional)

### O que foi implementado

- entrou um servico dedicado de operacao interna no backend em `apps/server/src/services/config-operations.ts`
- esse servico suporta cinco tipos de mutacao operacional:
  - `activate_set`
  - `upsert_set_entry`
  - `upsert_round_override`
  - `upsert_feature_flag`
  - `upsert_round_feature_flag`
- foi adicionado o script interno `npm run ops:config --workspace @cs-rio/server -- --file <payload.json>` com suporte a:
  - payload unico
  - lote de comandos
  - selecao de set por `active`, `code` ou `id`
  - selecao de rodada por `active`, `number` ou `id`
- cada operacao agora grava log persistido em `config_operation_logs`
- o backend ganhou `config_runtime_state` para versionar mudancas operacionais
- `ServerConfigService` passou a vigiar essa versao e invalidar cache quando houver injecao nova, sem depender de restart

### Decisoes de modelagem

- a injecao operacional foi feita **sem** client admin e **sem** rota administrativa publica
- o formato escolhido foi comando interno via script + batch transacional, porque esse caminho e suficiente para a operacao da rodada e evita abrir superficie de produto antes da hora
- a invalidacao ficou em dois niveis:
  - notificacao local no mesmo processo
  - leitura da versao persistida em `config_runtime_state` para cobrir mudancas feitas por outro processo/script
- o script aceita lote atomico de comandos; uma rodada de ajuste entra inteira ou falha inteira

### Simplificacoes assumidas nesta etapa

- esta fase opera sobre o catalogo dinamico, flags e overrides; nao abriu ainda comandos dedicados para editar templates estruturais de mundo (`regions`, `favelas`, `factions`) por DSL propria
- a auditoria ja existe e persiste `quem/origem/o que/alvo/quando`, mas a validacao semantica profunda do `value_json` ainda fica para `18.9`
- o polling da versao de runtime usa intervalo curto para manter o cache fresco sem custo exagerado; a telemetria/performance fina disso fica para a fase de testes

### Objetivo

Permitir ajuste real de rodada por comando interno e sem client administrativo, com trilha persistida e efeito quase imediato no backend, preparando o projeto para fechar a configuracao data-driven da Pre-Alpha.

## 2026-03-12 — Fase 18.9 (Validacao, constraints e trilha de auditoria)

### O que foi implementado

- entrou um servico dedicado de validacao semantica em `apps/server/src/services/config-validation.ts`
- essa camada passou a validar, antes de qualquer mutacao operacional:
  - `scope`
  - `targetKey`
  - existencia/compatibilidade do alvo
  - schema de `valueJson` para as chaves dinamicas ja suportadas
  - coerencia de feature flags por chave, escopo e target
- `ConfigOperationService` foi integrado a essa validacao e passou a enriquecer os logs com:
  - `batchId`
  - `summary`
  - `validationJson`
  - `beforeJson`
  - `afterJson`
- o schema ganhou constraints SQL nas tabelas de configuracao/override/flag para:
  - impedir `target_key` vazio
  - impedir janelas temporais invalidas (`effective_until <= effective_from`)
- a cobertura automatizada nova passou a provar:
  - rejeicao de payload invalido antes de gravar qualquer mutacao
  - trilha de auditoria por lote com snapshots antes/depois
  - consistencia das feature flags operacionais reconhecidas

### Decisoes de modelagem

- a validacao profunda ficou acoplada ao catalogo dinamico ja existente, em vez de tentar criar um validador generico opaco para qualquer JSON arbitrario
- a auditoria foi enriquecida na propria `config_operation_logs`, evitando abrir uma segunda tabela de diffs/historico para este recorte de Pre-Alpha
- `batchId` virou a chave de agrupamento operacional para uma injecao inteira, permitindo rastrear uma rodada de ajuste como unidade unica

### Simplificacoes assumidas nesta etapa

- a validacao semantica cobre em profundidade as chaves que ja migraram para o modelo data-driven; templates estruturais de mundo com mutacoes mais ricas continuam para `18.10`
- o backend ainda nao expõe endpoint/admin UI para esse fluxo; a operacao segue via script interno e acesso local
- a auditoria guarda snapshots sem normalizacao semantica extra; analise humana e ferramentas posteriores continuam possiveis a partir do JSON persistido

### Objetivo

Fechar a parte de seguranca operacional do catalogo dinamico, impedindo configuracoes quebradas no banco e deixando uma trilha rastreavel de quem mudou o que, quando e com qual efeito.

## 2026-03-12 — Fase 18.10 (Migracao dos sistemas atuais para o modelo data-driven)

### O que foi implementado

- entrou uma camada nova de politicas de gameplay em `apps/server/src/services/gameplay-config.ts`
- essa camada passou a resolver, a partir do catalogo dinamico da rodada:
  - ciclo de rodada
  - recompensa do top 10
  - satisfacao interna padrao de faccoes fixas
  - politica padrao de roubos de faccao
  - politica de crimes
  - politica de crimes coletivos
  - politica de conquista/gestao territorial
- `RoundService` foi migrado para usar essas definicoes dinamicas no fechamento e na abertura da rodada
- `CrimeSystem` passou a consumir `crime.policy` como fonte operacional de `minimumPowerRatio` e `prisonMinutesPerLevel`
- `FactionCrimeSystem` passou a consumir `faction_crime.policy` como fonte operacional de:
  - ranks coordenadores
  - crew minima/maxima
  - busted chance minima/maxima
  - bonus de coordenacao por membro extra
- `TerritoryService` passou a consumir `territory.conquest_policy` para:
  - ranks de comando
  - ranks de gestao
  - crew minima/maxima
  - bonus de coordenacao
  - horas de estabilizacao
- criacao de faccao e fallback de politica de roubos em `FactionService` e `RobberyService` passaram a usar a configuracao padrao da rodada em vez de constante operacional fixa
- o seed economico foi alinhado para gravar o conjunto estrutural de propriedades no catalogo dinamico, sem depender de atributo inexistente no contrato compartilhado
- o catalogo de roubos continuou preservando o conjunto tecnico base do jogo, mas agora aplicando override/configuracao e feature flags do banco como fonte operacional do balanceamento

### Decisoes de modelagem

- o conjunto atual de tipos de roubo e rotas de veiculo foi mantido como fallback tecnico e de compatibilidade de contrato no Pre-Alpha; o balanceamento e a ativacao por rodada passaram a ser definidos pelo banco
- a rodada agora fecha/reabre usando os mesmos resolvedores dinamicos do restante do backend, reduzindo o risco de drift entre reset de mundo e catalogo ativo
- o hard-code restante desta etapa foi mantido apenas como fallback encapsulado de bootstrap/seguranca, e nao mais como fonte operacional primaria da rodada

### Simplificacoes assumidas nesta etapa

- o backend continua com alguns conjuntos tecnicos fechados por tipo/enum para manter contratos de API e compatibilidade do cliente neste recorte de Pre-Alpha
- a criacao de um evento totalmente novo ou de um tipo de roubo totalmente novo apenas pelo banco ainda depende de suporte de execucao no server; o objetivo desta etapa foi migrar o comportamento do recorte atual para a fonte dinamica e fechar o gate da rodada viva
- o catalogo economico e de gameplay agora e a fonte operacional da rodada, mas os fallbacks tecnicos permanecem para nao quebrar bootstrap local, testes isolados e ambientes sem seed completo

### Objetivo

Encerrar a migracao do recorte atual para o modelo data-driven, fechando novamente o gate tecnico da Pre-Alpha com rodada configuravel por banco, snapshot por rodada e ajuste operacional sem refactor de codigo.
