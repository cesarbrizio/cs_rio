# CS Rio — Plano de Correção UX: "De Dashboard para Jogo"

> Plano consolidado de correção da experiência da HomeScreen e do loop inicial no mobile.
> Atualizado após a rodada real de testes em device no Pré-Alpha.
> Objetivo: transformar a tela inicial de um conjunto de cards funcionais em uma experiência legível, responsiva e com cara de jogo.

> Atualização mais recente:
> o mapa já domina a tela e o jogador já aparece de cara, mas o teste real confirmou uma nova frente crítica:
> latência alta, HUD ainda poluído e mundo ainda pouco reconhecível como “lugar”.

---

## Processo de Execução

### Regra de status

- `Não iniciado`: nada foi executado no código para aquele item dentro deste plano.
- `Em análise`: houve leitura, diagnóstico ou reprodução, mas sem correção entregue.
- `Parcial`: houve alteração no código, mas o critério de aceite do item ainda não foi atingido em device.
- `Concluído`: a entrega foi implementada e o critério do item foi validado.
- `Bloqueado`: existe impedimento externo ou dependência dura antes de seguir.

### Regra de contagem

- Neste plano, **tentativa anterior no código não conta como concluída**.
- Um item só conta como `Concluído` quando o comportamento esperado estiver perceptível e validado no device.
- Se algo já foi “tentado”, mas o problema continua visível no uso real, o status correto continua sendo `Parcial` ou `Em análise`.

---

## Estado Atual Verificado em Device

### O que já existe

- O app abre, autentica e chega à HomeScreen.
- O backend core está amplo: crimes, facções, território, PvP, prisão/hospital, eventos, rounds, economia, roubos.
- Existe `GameView` com canvas Skia, personagem, câmera, tap-to-move, pan e pinch.
- Existe HUD modular:
  - [`StatusBar.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/components/hud/StatusBar.tsx)
  - [`Minimap.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/components/hud/Minimap.tsx)
  - [`ActionBar.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/components/hud/ActionBar.tsx)
- Existe tentativa explícita de mobile-first:
  - ActionBar como bottom sheet
  - minimapa compacto
  - onboarding mínimo
  - feedback imediato em várias telas
  - áudio placeholder e transições

### O que o teste real mostrou

- O usuário **agora percebe o mapa principal** e encontra o personagem de cara.
- O estado de “congelado”/“nada acontece” ainda aparece forte na percepção do usuário.
- O HUD continua com texto e blocos demais tomando a tela.
- A home ainda comunica mais “software com painéis” do que “jogo com mundo”.
- O mapa ainda não parece um lugar vivo:
  - faltam favelas perceptíveis
  - faltam POIs com identidade clara
  - falta leitura territorial/faccional mais visível
- Rodada e dia já aparecem, mas ainda estão grandes e poluentes demais.

### Leitura honesta do estado

O problema hoje não é mais “falta de backend” nem “falta de feature”.
O problema agora é uma combinação de:

1. **Latência percebida alta na home**
2. **HUD ainda denso demais**
3. **Interação espacial ainda pouco confiável**
4. **Fantasia de jogo ainda incompleta**
5. **Mundo sem identidade espacial suficiente**

Em resumo:

- o backend parece jogo
- a home já tem mais cara de jogo do que antes
- mas a experiência ainda não sustenta esse argumento no toque e na leitura do mundo

---

## Diagnóstico Atualizado

## Problema 1 — O mapa agora domina, mas o mundo ainda não parece lugar

### Situação atual

A HomeScreen de fato renderiza o `GameView` como base principal:
- [`HomeScreen.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/screens/HomeScreen.tsx)
- [`GameView.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/components/GameView.tsx)

Mas, na prática, o teste mais recente mostrou uma mudança importante:
- o mapa já domina a viewport
- o jogador já aparece

O problema restante passou a ser:
- o mundo ainda não tem identidade espacial suficiente
- ainda parece um grid com overlays, e não um pedaço reconhecível do Rio

### Hipóteses mais prováveis

- ainda faltam favelas/áreas reconhecíveis
- ainda faltam POIs com identidade forte
- ainda falta leitura territorial/faccional no espaço
- o contraste do mundo melhorou, mas não virou “lugar”

### Conclusão

O problema já não é “o mapa sumiu”.
Agora ele é:

**o mapa existe, mas o mundo ainda não parece um espaço jogável vivo**

---

## Problema 2 — A home não rola, mas isso não está sendo entendido

### Situação atual

A HomeScreen é uma viewport fixa. Isso é coerente com a proposta.

Não existe `ScrollView`, e o comportamento esperado é:
- tocar para mover
- arrastar para pan
- pinch para zoom

### O problema real

Como o mapa não está comunicando presença/controle com clareza, o usuário tenta o gesto natural de app:
- scroll vertical

e conclui que “nada funciona”.

### Conclusão

O problema não é a ausência de scroll em si.
O problema é a **falta de affordance visual** de que aquilo é uma viewport de jogo.

---

## Problema 3 — Toques parecem congelados

### O que o código diz

Os toques estão, em tese, ligados:
- StatusBar expande/recolhe
- Minimap abre a navegação do mapa
- ActionBar abre o sheet de ações
- botões navegam
- `GameView` aceita tap/pan/pinch

### O que o teste diz

Na percepção do usuário:
- clicar não leva a lugar algum
- a tela parece congelada

### Diagnóstico provável

O mais provável hoje é uma dessas combinações:

- conflito entre camada de gesto do mapa e toques dos overlays
- press state existe, mas a consequência visual é fraca demais
- a ação navega, mas sem feedback evidente parece “falhou”
- parte da home depende de uma interação espacial que o jogador não entendeu

### Conclusão

Mesmo que tecnicamente alguns handlers existam, a UX atual não prova isso com clareza.
Para o usuário, isso é equivalente a bug.

---

## Problema 4 — A fantasia do jogo ainda não aparece

### Como o jogo foi pensado

O jogo não era para ser:
- um action RPG tipo Tibia
- nem um RTS puro tipo Age of Empires

O plano sempre foi um híbrido:
- **mundo isométrico como camada de presença**
- **ações sistêmicas/contextuais como camada estratégica**

Fluxo ideal:
1. entro no mapa
2. vejo meu personagem e o mundo
3. me movimento
4. toco em locais/entidades
5. o jogo abre ações contextuais
6. executo algo
7. retorno ao mapa com consequências

### O que aconteceu na execução

O desenvolvimento priorizou:
- sistemas
- backend
- telas de módulo
- loops econômicos

e isso fez a home escorregar para:
- hub de telas
- banners
- cards
- menu launcher

### Conclusão

Hoje a home está mais perto de “shell operacional de sistemas” do que de “espaço jogável”.

---

## Problema 5 — Rodada e dia aparecem, mas ainda poluem demais

### Situação atual

Rounds já existem no backend.
Agora essa informação já aparece na home.

O problema passou a ser:
- o bloco ainda ocupa espaço demais
- ainda parece explicação demais para ficar fixo
- precisa ficar mais discreto por padrão e expandir sob toque

### Conclusão

Isso deixou de ser ausência total de UX e virou problema de **densidade e formato**.
Num jogo vivo por rodada, a informação precisa continuar visível, mas mais compacta.

---

## O Que Já Foi Tentado e Qual o Resultado

### [x] HUD mínimo por padrão

Já foi tentado:
- StatusBar compactável
- Minimap compacto
- ActionBar launcher

Resultado:
- melhorou a estrutura
- **não resolveu a legibilidade do mapa**

### [x] Ações em bottom sheet

Já foi tentado na ActionBar.

Resultado:
- acerto de direção
- mas a home ainda não comunica com clareza que o mapa é o centro

### [x] Feedback e onboarding mínimo

Já foi tentado:
- `bootstrapStatus`
- tutorial de 5 passos
- cards orientadores

Resultado:
- funcionalmente existe
- visualmente ainda reforça a lógica de painel

### [x] Áudio e efeitos placeholder

Já foi implementado.

Resultado:
- útil como infraestrutura
- insuficiente para salvar a leitura geral da home

### [x] Ajustes de português e semântica

Já houve melhora.

Resultado:
- importante
- mas não ataca o núcleo do problema visual/interativo

---

## Novo Plano de Correção

> Este plano substitui a versão inicial do documento.
> Agora ele parte do estado real do código e do feedback real em device.

## BLOCO A — Tornar o mapa o protagonista

> Prioridade: CRÍTICA
> Status do bloco: `Parcial`

### A.1 — Confirmar se o problema é visual, de câmera ou de render
> Status: `Concluído`

Arquivos-alvo:
- [`GameView.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/components/GameView.tsx)
- [`HomeScreen.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/screens/HomeScreen.tsx)

Checklist:
- verificar viewport real do canvas
- verificar posição inicial da câmera
- verificar zoom inicial real em device
- verificar se o tileset está legível
- verificar contraste do mapa contra fundo
- verificar se o player está sendo desenhado em posição perceptível

Critério:
- ao abrir a home, o jogador precisa imediatamente perceber:
  - “isso é um mapa”
  - “esse ponto é meu personagem”

#### Resultado do diagnóstico A.1

Conclusão principal:

- o problema é **majoritariamente de render/legibilidade visual**
- com agravante de **zoom inicial conservador**
- e **não** de spawn fora do mapa ou ausência total de câmera

Achados objetivos:

- a `HomeScreen` já renderiza o `GameView` como base principal, então o mapa não “sumiu” por ausência de montagem
- o `GameView` inicia com zoom `1.2`, o que ainda é tímido para a primeira leitura em device
- o `playerState` vindo do backend está dentro da faixa do mapa protótipo atual, então o caso não aponta para spawn absurdamente fora do mundo
- o `buildMapPicture()` em [`GameView.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/components/GameView.tsx) escolhe **ou** atlas **ou** vetor:
  - se a imagem `city_base.png` carregar, ele desenha só o atlas
  - se a imagem não carregar, ele usa o fallback vetorial colorido
- isso significa que, no cenário normal de device, o mapa perde justamente o fallback com cores mais legíveis e fica dependente de um tileset escuro/baixo contraste
- o jogador também não ganha destaque suficiente:
  - sombra pequena
  - sprite discreto
  - nenhum halo/beacon forte

Diagnóstico final do A.1:

- **não é bug principal de câmera**
- **não é bug principal de viewport**
- **não é bug principal de posição inicial**
- é um problema de:
  1. renderização visual pouco legível do mundo
  2. contraste insuficiente do tileset contra o fundo
  3. leitura fraca do jogador no primeiro frame
  4. zoom inicial ainda tímido para a fantasia de “mapa dominante”

### A.2 — Reprojetar a home para “mapa com overlays”, não “cards sobre jogo”
> Status: `Concluído`

Diretriz:
- topo: status resumido e minimapa
- centro: mapa dominante
- base: ações rápidas e uma linha de feedback
- tutorial/evento: toast ou coach leve, nunca card dominante

Regra de ocupação visual:
- mapa visível em **70%+ da viewport**
- nenhum bloco opaco grande fixo sobre o centro da tela

#### Estado atual do A.2

Implementado no código:

- topo reduzido para HUD mais compacto
- minimapa encolhido
- barra de status encolhida
- launcher de ação deixou de ocupar toda a largura
- toasts da home passaram a obedecer prioridade única, evitando pilha de banners simultâneos
- base da tela ficou mais leve, com feedback curto e launcher menor

Validação em device:

- o mapa voltou a dominar a viewport
- o jogador aparece de cara

Pendente fora do A.2:

- reduzir ainda mais a densidade dos overlays
- impedir que a home continue parecendo dashboard mesmo com o mapa dominante

### A.3 — Dar identidade visual de jogo ao mapa
> Status: `Parcial`

O mundo precisa parecer “lugar” e não “superfície preta”.

Itens de leitura:
- contraste maior nos tiles
- entidades/POIs mais óbvios
- posição do jogador mais evidente
- feedback visual no tile tocado
- destaque espacial de locais relevantes

#### Estado atual do A.3

Implementado no código:

- o `GameView` agora desenha uma base vetorial mais legível por baixo do atlas
- o atlas passou a entrar com alpha mais contido, reduzindo o apagamento do mundo
- o zoom inicial foi aumentado para favorecer leitura em device
- o tile selecionado ganhou destaque mais forte
- POIs ganharam halo visual
- o jogador ganhou destaque espacial mais forte com beacon/halo e marca evidente

Pendente para virar `Concluído`:

- validar em device se o mundo deixou de parecer “superfície preta”
- confirmar se o jogador agora é encontrado no primeiro olhar
- confirmar se os POIs estão legíveis sem virar ruído visual

---

## BLOCO B — Restaurar confiança na interação

> Prioridade: CRÍTICA
> Status do bloco: `Parcial`

### B.1 — Garantir que toda ação principal tenha prova visual imediata
> Status: `Parcial`

Ao toque, o usuário precisa ver em menos de 100ms:
- pressed state
- abertura de modal/sheet
- toast de navegação
- loading local
- mudança de estado perceptível

Se a ação demorar mais:
- optimistic UI
- skeleton
- label de estado

#### Estado atual do B.1

Implementado no código:

- a `HomeScreen` agora dispara um toast curto e dedicado de confirmação imediata para ações principais
- esse toast fica separado dos banners de evento/tutorial, então não depende da navegação terminar para provar que o toque funcionou
- o feedback imediato agora cobre:
  - abertura de módulos pela `ActionBar`
  - toque em entidade do mapa
  - ações do `ContextMenu`
  - CTA de evento
  - CTA do tutorial
  - abertura do perfil pela `StatusBar`
  - abertura do mapa pelo `Minimap`
  - marcação de destino no mapa

Pendente para virar `Concluído`:

- validar em device se esse feedback já elimina a sensação de “toquei e nada aconteceu”
- confirmar se a percepção de congelamento caiu nos atalhos principais da home
- confirmar se ainda falta loading local mais explícito em algum fluxo específico da home

### B.2 — Verificar conflito entre gestos do mapa e Pressables do HUD
> Status: `Parcial`

Arquivos-alvo:
- [`GameView.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/components/GameView.tsx)
- [`HomeScreen.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/screens/HomeScreen.tsx)

Objetivo:
- garantir que toque no HUD seja HUD
- garantir que toque no mapa seja mapa
- impedir “áreas mortas” ou sensação de congelamento

#### Estado atual do B.2

Implementado no código:

- a home agora mede explicitamente a área ocupada pelo topo e pela base do HUD
- essas áreas são repassadas para o `GameView` como zonas bloqueadas de input
- o `InputHandler` do mapa deixa de tratar toque, pan e pinch iniciados debaixo dessas áreas do HUD

Pendente para virar `Concluído`:

- validar em device se o toque no topo/base deixou de disparar gesto do mapa por baixo
- confirmar se a sensação de “tela congelada” reduziu
- confirmar se ainda existem áreas mortas no centro da viewport

### B.3 — Redesenhar a ActionBar para parecer ação jogável, não menu administrativo
> Status: `Parcial`

A direção de bottom sheet está certa.
Mas a entrada precisa parecer:
- “agir no mundo”
e não:
- “abrir um software com módulos”

Isso exige:
- nomes mais orientados à ação
- menos volume de opções simultâneas
- agrupamento por intenção

#### Estado atual do B.3

Implementado no código:

- a superfície visível da `ActionBar` deixou de ser um launcher genérico de módulos
- agora a home expõe só algumas ações rápidas principais, com nomes mais verbais e curtos
- o restante continua acessível no bottom sheet, mas agrupado por intenção:
  - `Na rua`
  - `Meu corre`
  - `Rede`
  - `Conta`
- isso reduz a sensação de “menu administrativo” e aproxima a ação da fantasia de jogo

Pendente para virar `Concluído`:

- validar em device se a `ActionBar` ficou mais clara e menos parecida com software
- confirmar se as ações principais escolhidas fazem sentido no fluxo real
- confirmar se o bottom sheet ficou mais escaneável do que antes

---

## BLOCO C — Clarificar o loop do jogo

> Prioridade: ALTA
> Status do bloco: `Parcial`

### C.1 — Explicitar “onde estou / o que posso fazer / por que fazer”
> Status: `Parcial`

A home precisa responder sem esforço:
- onde estou?
- quem eu sou?
- o que faço agora?
- por que essa ação importa?

#### Estado atual do C.1

Implementado no código:

- a home agora exibe uma faixa contextual compacta com três leituras explícitas:
  - `Onde`
  - `Agora`
  - `Por quê`
- essa faixa usa o estado real do personagem e do tutorial:
  - prisão
  - hospitalização
  - etapa do tutorial
  - presença ou ausência de facção
  - região atual
- a intenção foi responder o loop sem transformar a home de novo em um painel grande de cards

Pendente para virar `Concluído`:

- validar em device se a leitura ficou realmente imediata
- confirmar se o jogador entende melhor o próximo passo sem precisar “adivinhar”
- confirmar se a nova faixa contextual não está roubando protagonismo do mapa

### C.2 — O mapa precisa virar hub real de contexto
> Status: `Parcial`

Ao tocar em POIs e áreas do mapa, o jogo precisa encaminhar a ação.

Diretriz:
- mapa = contexto
- tela/modal = execução

Não:
- mapa decorativo + cards de software

#### Estado atual do C.2

Implementado no código:

- os POIs do mapa deixaram de depender só de um toque exato no tile da entidade
- a home agora resolve pontos de contexto por proximidade no mapa
- ao tocar perto de um POI relevante, o jogo:
  - abre o contexto daquele ponto
  - mostra feedback imediato
  - explica que a ação pode nascer dali
- isso foi aplicado aos POIs estáticos principais do protótipo:
  - Mercado Negro
  - Boca
  - Fábrica
  - Rave / Baile

Pendente para virar `Concluído`:

- validar em device se o jogador percebe que o mapa agora encaminha ações
- confirmar se a necessidade de “abrir módulos” caiu
- confirmar se a proximidade adotada está natural e não gera contexto errado com frequência

### C.3 — Definir a fantasia operacional da home
> Status: `Parcial`

O desenho correto da home deve ser:

“Você está em uma região do Rio. Seu personagem está ali. O mundo existe ao redor. As ações nascem desse contexto.”

Não:

“Você está numa dashboard de módulos do sistema criminal.”

#### Estado atual do C.3

Implementado no código:

- a home agora ganhou uma leitura diegética curta de “estado da rua”
- essa faixa fala com linguagem de jogo:
  - em que região você está
  - qual o clima operacional da rua
  - o que isso significa para o seu corre naquele momento
- com isso, a home deixa de falar só em tom administrativo e passa a comunicar melhor a fantasia de jogo vivo por região

Pendente para virar `Concluído`:

- validar em device se essa camada realmente muda a sensação de “dashboard”
- confirmar se o texto novo está servindo o mapa, e não competindo com ele
- confirmar se o jogador entende melhor que o mundo existe ao redor do personagem

---

## BLOCO D — Surfacing do sistema de rodada

> Prioridade: ALTA
> Status do bloco: `Parcial`

### D.1 — Exibir rodada ativa e dia atual na home
> Status: `Parcial`

Itens mínimos:
- Rodada `#N`
- Dia `X/Y`
- tempo restante

#### Estado atual do D.1

Implementado no código:

- a home agora mostra explicitamente:
  - número da rodada
  - dia atual
  - total de dias da rodada
- essa leitura deixou de ficar escondida só em um pill mínimo e passou a existir em uma faixa própria

Pendente para virar `Concluído`:

- validar em device se a leitura ficou realmente visível no primeiro olhar
- confirmar se o jogador percebe a rodada como sistema vivo, e não como detalhe decorativo

### D.2 — Exibir isso de forma compacta e sempre visível
> Status: `Parcial`

Formato ideal:

`Rodada #3 · Dia 12/30`

ou

`Dia 12/30 · faltam 18 dias`

Sem precisar abrir tela extra.

#### Estado atual do D.2

Implementado no código:

- a home agora exibe uma faixa persistente da rodada com:
  - headline curta (`Rodada #N · Dia X/Y`)
  - subline com tempo restante
- essa faixa fica sempre visível na base da home e não depende de navegação extra

Pendente para virar `Concluído`:

- validar em device se a faixa continua compacta o suficiente
- confirmar se ela não compete demais com o mapa
- confirmar se o tempo restante está fácil de entender no uso real

### D.3 — Explicar por que o dia da rodada importa
> Status: `Parcial`

Esse indicador não pode ser só decorativo.
Precisa comunicar:
- inflação
- eventos
- fim da rodada
- urgência competitiva

#### Estado atual do D.3

Implementado no código:

- a faixa da rodada agora também mostra por que aquele momento da rodada importa
- a leitura muda conforme a fase:
  - começo da rodada
  - meio da rodada
  - fechamento
- isso comunica de forma curta:
  - inflação
  - eventos
  - pressão do ranking

Pendente para virar `Concluído`:

- validar em device se essa leitura ajuda de fato o jogador a entender a urgência da rodada
- confirmar se a faixa continua compacta e não vira outro bloco textual excessivo
- confirmar se a progressão de começo → meio → fim está perceptível no uso real

---

## BLOCO E — Transformar a experiência de “abre telas” em “joga”

> Prioridade: MÉDIA-ALTA
> Status do bloco: `Parcial`

### E.1 — Ações importantes devem voltar para o mapa com continuidade
> Status: `Parcial`

Fluxo desejado:
- entro numa ação
- resolvo a ação
- recebo feedback
- continuo no mapa

#### Estado atual do E.1

Implementado no código:

- as telas internas agora oferecem um retorno explícito de volta ao mapa
- esse retorno registra uma mensagem de continuidade antes de navegar para a home
- a `HomeScreen` consome essa mensagem ao recuperar foco e mostra o contexto de retorno imediatamente
- com isso, o fluxo deixa de parecer “abri uma tela, fiz algo e sumi num módulo solto”

Pendente para virar `Concluído`:

- validar em device se o retorno realmente reforça o loop mapa → ação → mapa
- confirmar se o jogador sente continuidade ao voltar para a home
- confirmar se o botão de retorno ao mapa não virou mais um elemento administrativo em vez de jogável

### E.2 — Mundo mais vivo visualmente
> Status: `Parcial`

Itens desejáveis:
- locais com identidade clara
- sinalização de território/facção
- entidades visíveis no mapa
- efeitos contextuais simples

#### Estado atual do E.2

Implementado no código:

- a home agora expõe sinais compactos de mundo vivo em vez de depender só de texto corrido
- o estado da cidade passou a aparecer como chips de leitura rápida:
  - região
  - facção
  - presença online
  - POI mais próximo
  - evento/estado dominante
- isso reforça a sensação de mundo ativo sem recolocar cards dominantes sobre o mapa

Pendente para virar `Concluído`:

- validar em device se esses sinais realmente ajudam a perceber a cidade como “viva”
- confirmar se o novo bloco não continua parecendo dashboard operacional
- confirmar se o equilíbrio visual com mapa + overlays ficou correto

### E.3 — Mais leitura espacial, menos texto fixo
> Status: `Parcial`

Trocar parte do texto por:
- ícones
- estados curtos
- marcadores visuais
- labels contextuais

#### Estado atual do E.3

Implementado no código:

- o antigo bloco fixo de “Onde / Agora / Por quê” foi reduzido para:
  - chips curtos de leitura situacional
  - um foco atual compacto
  - uma justificativa breve
- o rodapé deixou de manter `bootstrapStatus` como texto persistente quando não há erro real
- isso reduz a sensação de “tela cheia de instrução textual” e empurra a home para leitura mais rápida

Pendente para virar `Concluído`:

- validar em device se ainda existe excesso de texto na home
- confirmar se a leitura ficou de fato mais espacial e menos administrativa
- confirmar se o jogador entende o estado atual sem ter que ler um bloco grande

---

## BLOCO F — Latência e sensação de travamento

> Prioridade: CRÍTICA
> Status do bloco: `Parcial`

### F.1 — Diagnosticar a origem da latência na home
> Status: `Concluído`

Arquivos-alvo:
- [`HomeScreen.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/screens/HomeScreen.tsx)
- [`GameView.tsx`](/home/cesar/projects/cs_rio/apps/mobile/src/components/GameView.tsx)

Objetivo:
- descobrir por que o toque no mapa e nos overlays ainda parece congelado

Checklist:
- medir re-renders da home
- medir re-renders do `GameView`
- verificar timers/intervals concorrentes
- verificar conflito de foco entre overlays e mapa
- verificar ações que navegam só depois de muita lógica

#### Resultado do diagnóstico F.1

Conclusão principal:

- a sensação de travamento vem muito mais de **re-renders e updates concorrentes da home** do que de um único bug de gesto

Achados objetivos:

- a `HomeScreen` mantém dois loops quentes de UI:
  - `setInterpolatedRemotePlayers` a cada `50ms`
  - `setHudPlayerState` a cada `100ms`
- esses loops rerenderizam a home inteira com frequência alta, mesmo quando o usuário não está pedindo nada
- além disso, a home ainda tem outros clocks recorrentes:
  - rodada a cada `30s`
  - tutorial a cada `30s`
  - fetch de rodada a cada `60s`
- esses timers lentos não são o principal problema, mas aumentam a fragmentação do estado

No `GameView`:

- o game loop já roda internamente e ainda chama `onPlayerStateChange` continuamente
- isso alimenta a home, que por sua vez mantém outro loop para refletir esse estado em HUD
- na prática, existe uma cadeia:
  - `GameView` produz estado
  - `HomeScreen` copia esse estado em polling
  - overlays dependem desse estado
  - a home rerenderiza o conjunto inteiro

Também pesa na percepção:

- vários toques da home disparam **mais de uma consequência síncrona** antes da navegação:
  - haptic
  - `showInteractionFeedback`
  - `setBootstrapStatus`
  - `setContextTarget`
  - e só depois navegação
- isso não parece muito no código, mas somado ao rerender frequente vira sensação de atraso

Diagnóstico final do F.1:

1. a principal origem da latência percebida está na **HomeScreen estar viva demais**
2. o `GameView` e a home ainda trocam estado com frequência maior do que a UX suporta
3. o toque parece travado porque a tela já está ocupada rerenderizando estado antes mesmo da ação do usuário
4. `F.2` precisa atacar primeiro:
   - loops de interpolação/espelhamento
   - isolamento de estado
   - redução de updates da home

### F.2 — Cortar updates e re-renders desnecessários na HomeScreen
> Status: `Parcial`

Objetivo:
- fazer a home parar de disputar frame com o mapa

Direção:
- reduzir estado volátil na home
- isolar blocos visuais que não precisam rerenderizar juntos
- cortar texto/estado que muda sem necessidade

#### Estado atual do F.2

Implementado no código:

- a `HomeScreen` deixou de manter interpolação de players remotos em `setInterval(50ms)` dentro da árvore React
- os players remotos agora usam diretamente o snapshot realtime disponível, sem loop artificial extra de render
- o espelhamento do player local em HUD deixou de rodar em polling `setInterval(100ms)`
- `hudPlayerState` agora só atualiza quando há mudança significativa:
  - tile arredondado
  - estado de movimento
  - animação

Impacto esperado:

- menos rerender da home enquanto o mapa já está desenhando seu próprio loop
- menos disputa entre overlays e `GameView`
- menor sensação de congelamento ao tocar

Pendente para virar `Concluído`:

- validar em device se a home realmente ficou mais fluida
- confirmar se minimapa, HUD e contexto continuam corretos mesmo com menos updates

### F.3 — Garantir sensação imediata de resposta nas ações críticas
> Status: `Parcial`

Objetivo:
- aproximar a percepção real das metas:
  - `<50ms` para ações críticas de UI
  - `<100ms` para sensação de imediatismo

Direção:
- navegação percebida imediata
- pressed states mais claros
- fallback visual curto antes da ação terminar
- reduzir a sensação de “travou”

#### Estado atual do F.3

Implementado no código:

- as ações críticas da home agora seguem um fluxo mais barato:
  - haptic
  - feedback curto imediato
  - navegação já
  - `bootstrapStatus`, limpeza de contexto e progresso de tutorial só depois das interações
- isso foi aplicado a:
  - `ActionBar`
  - `StatusBar`
  - `Minimap`
  - CTAs de prisão e hospital
  - CTA de evento
  - ações contextuais do mapa

Impacto esperado:

- menos sensação de toque “travado” antes de abrir tela
- menos custo síncrono na `HomeScreen`
- navegação percebida como resposta imediata

Pendente para virar `Concluído`:

- validar em device se os toques da home pararam de parecer congelados
- confirmar que não houve regressão no feedback contextual

---

## BLOCO G — Reduzir HUD fixo e tornar a tela expansível sob toque

> Prioridade: CRÍTICA
> Status do bloco: `Não iniciado`

### G.1 — Reduzir a home ao mínimo visual por padrão
> Status: `Parcial`

Objetivo:
- deixar só o essencial sempre visível:
  - status mínimo
  - minimapa
  - poucas ações
  - 1 feedback curto

#### Estado atual do G.1

Implementado no código:

- a home deixou de manter três blocos grandes fixos para:
  - rodada
  - contexto da rua
  - estado do mundo / próximo passo
- esses blocos foram reduzidos a uma faixa compacta de sinais em chips
- por padrão, a tela agora mantém só:
  - status
  - minimapa
  - recursos
  - sinais curtos de estado
  - ação rápida
  - feedback curto

Impacto esperado:

- menos poluição visual sobre o mapa
- menos sensação de dashboard
- leitura mais rápida do estado da rodada e do mundo

Pendente para virar `Concluído`:

- validar em device se a home realmente ficou “mínima” o bastante
- confirmar se a informação essencial continua acessível sem os blocos grandes

### G.2 — Tornar blocos informativos expansíveis sob toque
> Status: `Parcial`

Objetivo:
- rodada/dia, contexto da rua e estado do mundo devem ser discretos por padrão
- tocar expande
- tocar de novo recolhe

#### Estado atual do G.2

Implementado no código:

- a faixa compacta de sinais da home agora responde ao toque
- tocar nos chips de:
  - rodada
  - mundo/estado
  - foco atual
  expande um detalhe curto logo abaixo
- tocar de novo recolhe

Impacto esperado:

- manter a tela limpa por padrão
- ainda permitir leitura do contexto quando o jogador quiser
- reduzir a necessidade de texto grande fixo

Pendente para virar `Concluído`:

- validar em device se a expansão ficou clara e rápida
- confirmar se o detalhe expandido realmente substitui os antigos blocos grandes

### G.3 — Eliminar duplicação semântica entre HUD, chips e textos
> Status: `Parcial`

Objetivo:
- parar de mostrar a mesma ideia em três lugares diferentes
- cada camada da home precisa ter função única

#### Estado atual do G.3

Implementado no código:

- a rodada deixou de aparecer duplicada na barra de recursos e na faixa compacta
- a faixa compacta da home deixou de repetir estados transitórios já cobertos pelo toast do topo:
  - evento
  - tutorial
  - prisão
  - hospital
- o topo ficou com contexto transitório
- a base ficou com estado estrutural

Impacto esperado:

- menos sensação de dashboard
- menos repetição de significado entre camadas
- leitura mais limpa do que é persistente versus o que é momentâneo

Pendente para virar `Concluído`:

- validar em device se a home realmente ficou menos redundante
- confirmar que nenhuma informação importante sumiu com a limpeza

---

## BLOCO H — Dar identidade espacial real ao mundo

> Prioridade: ALTA
> Status do bloco: `Parcial`

### H.1 — Mostrar favelas, áreas e pontos relevantes no espaço
> Status: `Parcial`

Objetivo:
- o mapa precisa começar a responder “onde estão as favelas?” sem depender de imaginação

#### Estado atual do H.1

Implementado no código:

- a home agora envia zonas espaciais reais para o `GameView`
- o mapa passou a desenhar áreas de favela com contorno e preenchimento próprios
- os POIs principais agora têm rótulo espacial no próprio mundo:
  - Mercado Negro
  - Fábrica
  - Rave
  - Boca da Favela
- favelas protótipo ganharam leitura visual direta no espaço:
  - Providência
  - Catumbi
  - Gamboa

Impacto esperado:

- o mundo deixa de depender só do minimapa para comunicar estrutura espacial
- o jogador começa a perceber “lugares” e não apenas grid + boneco
- o mapa responde melhor à pergunta “onde estão as favelas e pontos importantes?”

Pendente para virar `Concluído`:

- validar em device se as áreas ficaram perceptíveis sem poluir a tela
- confirmar se os rótulos estão legíveis no uso real
- confirmar se o mapa passou a comunicar melhor “lugar” e não só superfície

### H.2 — Dar leitura territorial/faccional visível no mapa
> Status: `Parcial`

Objetivo:
- território precisa parecer território
- domínio precisa aparecer no espaço, não só em tela separada

#### Estado atual do H.2

Implementado no código:

- as áreas de favela agora carregam dono visível no próprio mapa
- cada zona ganhou leitura faccional direta por rótulo espacial:
  - `TCP domina`
  - `CV domina`
  - `ADA domina`
- a leitura visual também passou a diferenciar relação:
  - aliado
  - inimigo
  - neutro
- isso foi aplicado no protótipo atual sem depender da tela de território

Impacto esperado:

- domínio territorial deixa de existir só como abstração em módulo separado
- o jogador começa a perceber que o espaço tem lado, disputa e pertencimento
- o mapa passa a comunicar facção e território sem exigir leitura longa

Pendente para virar `Concluído`:

- validar em device se a leitura faccional ficou clara sem excesso de ruído
- confirmar se aliado/inimigo/neutro ficam legíveis no uso real
- confirmar se o jogador consegue bater o olho e entender que o espaço está dominado por grupos diferentes

### H.3 — Fazer o mundo parecer um lugar, não um grid
> Status: `Parcial`

Objetivo:
- reduzir sensação de tabuleiro genérico
- aumentar sensação de bairro/região/ponto do Rio

#### Estado atual do H.3

Implementado no código:

- o mapa agora desenha eixos espaciais persistentes no próprio mundo
- entraram trilhas urbanas protótipo com nome e presença visual:
  - `Eixo do Centro`
  - `Rota do Porto`
  - `Subida do Morro`
- essas trilhas ajudam a quebrar a leitura de “grid puro” e passam a sugerir circulação, relevo e fluxo urbano
- os rótulos dessas rotas aparecem dentro do mundo, não só em HUD externo

Impacto esperado:

- o mapa deixa de parecer apenas um tabuleiro isométrico abstrato
- a região começa a parecer um lugar com circulação e direção
- a fantasia espacial do Rio fica mais próxima de bairro/porto/morro do que de grid genérico

Pendente para virar `Concluído`:

- validar em device se as trilhas realmente melhoram a leitura espacial
- confirmar se o mundo começou a parecer “lugar” e não só tabuleiro
- confirmar se o ganho de identidade veio sem virar poluição visual

---

## Ordem Recomendada de Execução

| Passo | Bloco | Entrega | Impacto |
|---|---|---|---|
| 1 | A.1 | Confirmar bug visual do mapa e da câmera | Saber exatamente por que o mapa “sumiu” |
| 2 | A.2 | Reprojetar layout da Home | Mapa volta a ser dominante |
| 3 | B.2 | Resolver conflito de toque entre HUD e mapa | Botões deixam de parecer congelados |
| 4 | B.1 | Garantir feedback imediato em toda ação principal | Confiança na interação |
| 5 | C.1 | Clarificar “onde estou / o que faço agora” | Usuário entende o loop |
| 6 | D.1-D.2 | Mostrar rodada e dia na home | Informação sistêmica essencial |
| 7 | C.2 | Tornar o mapa hub real de contexto | Menos sensação de software |
| 8 | E.1 | Melhorar retorno mapa → ação → mapa | Loop jogável |
| 9 | A.3 | Melhorar legibilidade visual do mundo | Fantasia de jogo |
| 10 | E.2-E.3 | Mundo vivo + menos texto fixo | Imersão |
| 11 | B.3 | Redesenhar a ActionBar | Menos sensação de software |
| 12 | C.3 | Definir a fantasia operacional da home | Home mais “jogo” do que painel |
| 13 | D.3 | Explicar por que o dia da rodada importa | Contexto sistêmico |
| 14 | F.1 | Diagnosticar a origem da latência | Saber por que a home ainda “trava” |
| 15 | F.2 | Cortar updates e re-renders desnecessários | Fluidez e sensação de resposta |
| 16 | F.3 | Garantir resposta imediata nas ações críticas | Confiança no toque |
| 17 | G.1 | Reduzir a home ao mínimo visual | Mapa com menos poluição |
| 18 | G.2 | Tornar blocos expansíveis sob toque | Informação sob demanda |
| 19 | G.3 | Eliminar duplicação semântica | Menos texto e ruído |
| 20 | H.1 | Mostrar favelas, áreas e POIs no espaço | Mundo compreensível |
| 21 | H.2 | Dar leitura territorial/faccional no mapa | Território visível |
| 22 | H.3 | Fazer o mundo parecer lugar, não grid | Fantasia de jogo |

---

## Critérios de Aceite Atualizados

### Legibilidade
- [x] Ao abrir a home, o mapa é percebido imediatamente como elemento principal
- [x] O jogador é visível sem precisar “caçar” sua posição
- [ ] O minimapa volta a ser apoio, não protagonista

### Interação
- [ ] O usuário entende que a home não é scrollável porque o mapa comunica pan/zoom claramente
- [ ] Tocar em botões sempre gera reação visível imediata
- [ ] ActionBar, Minimap e StatusBar respondem de forma inequívoca
- [ ] Tocar no mapa resulta em indicação clara de destino/seleção
- [ ] A home deixa de parecer congelada em device real

### Fantasia de jogo
- [ ] A home parece um jogo, não um software com módulos
- [ ] As ações parecem nascer do mapa e do mundo
- [ ] O loop inicial é entendido sem depender de leitura longa
- [ ] O mapa mostra favelas, áreas e pontos do mundo de forma reconhecível

### Informação essencial
- [ ] Rodada e dia atual estão visíveis na home
- [ ] Estado de conexão é compreensível
- [ ] Recursos essenciais são legíveis sem tomar a tela
- [ ] Rodada e contexto sistêmico ficam discretos por padrão e expansíveis sob toque

### Performance percebida
- [ ] Feedback visual ao toque abaixo de 100ms percebidos
- [ ] Nenhuma ação crítica parece “congelada”
- [ ] O usuário distingue facilmente “carregando” de “travou”

---

## Resumo Executivo

O plano anterior estava correto para a fase em que o problema parecia ser só “cards cobrindo o mapa”.
Depois das entregas de Áudio, Polish e Estabilização, o diagnóstico ficou mais preciso:

- o mapa já voltou a dominar e o jogador já aparece
- o problema central agora é **latência percebida + excesso de HUD + mundo ainda pouco reconhecível**
- a consequência é **a home continuar parecendo software mesmo com o mapa na frente**
- e o resultado final é **fantasia de jogo ainda incompleta**

Este documento passa a ser a referência para a próxima rodada real de correção de UX.

---

## Métricas de Progresso

| Bloco | Tarefas | Concluídas | Parciais | % |
|---|---|---|---|---|
| Bloco A — Tornar o mapa o protagonista | 3 | 2 | 1 | 67% |
| Bloco F — Latência e sensação de travamento | 3 | 1 | 2 | 33% |
| Bloco G — Reduzir HUD fixo e tornar a tela expansível sob toque | 3 | 0 | 3 | 0% |
| Bloco H — Dar identidade espacial real ao mundo | 3 | 0 | 3 | 0% |
| Bloco B — Restaurar confiança na interação | 3 | 0 | 3 | 0% |
| Bloco C — Clarificar o loop do jogo | 3 | 0 | 3 | 0% |
| Bloco D — Surfacing do sistema de rodada | 3 | 0 | 3 | 0% |
| Bloco E — Transformar a experiência de “abre telas” em “joga” | 3 | 0 | 3 | 0% |
| **TOTAL** | **24** | **3** | **21** | **13%** |

### Status por item na ordem de execução

| Passo | Item | Status | Observação |
|---|---|---|---|
| 1 | A.1 | Concluído | Diagnóstico fechado: problema principal é render/legibilidade, não spawn/câmera. |
| 2 | A.2 | Concluído | Validação em device confirmou que o mapa voltou a dominar a home. |
| 3 | B.2 | Parcial | A camada de bloqueio de input do HUD foi implementada, mas ainda falta validação em device. |
| 4 | B.1 | Parcial | Há feedback imediato em várias telas, mas a home ainda não transmite resposta confiável. |
| 5 | C.1 | Parcial | Já existe tutorial/status, mas o jogador ainda não entende naturalmente o loop. |
| 6 | D.1 | Parcial | O dia da rodada já aparece no código, mas não está claro o suficiente no uso real. |
| 6 | D.2 | Parcial | O surfacing da rodada existe parcialmente, mas não está firme como HUD sistêmico. |
| 7 | C.2 | Parcial | O mapa já abre contexto por proximidade nos POIs principais, mas ainda falta validação em device. |
| 8 | E.1 | Parcial | O retorno ao mapa com continuidade foi implementado, mas ainda falta validação em device. |
| 9 | A.3 | Parcial | O reforço visual do mundo entrou no `GameView`, mas ainda falta validação em device. |
| 10 | E.2 | Parcial | A home ganhou sinais compactos de mundo vivo, mas ainda falta validar se isso soa jogável em device. |
| 10 | E.3 | Parcial | O texto fixo caiu bastante, mas ainda falta validar se a leitura ficou realmente mais espacial. |
| 11 | B.3 | Parcial | A ActionBar já é bottom sheet, mas ainda parece launcher administrativo. |
| 12 | C.3 | Parcial | A home agora fala mais como rua/região do que como dashboard, mas ainda falta validação em device. |
| 13 | D.3 | Parcial | A rodada agora comunica inflação, eventos e urgência, mas ainda falta validação em device. |
| 14 | F.1 | Concluído | Diagnóstico fechado: o maior problema está em loops de estado concorrentes na `HomeScreen`, não num único bug de toque. |
| 15 | F.2 | Parcial | A home parou de interpolar players em loop React e deixou de espelhar `hudPlayerState` por polling, mas ainda falta validação em device. |
| 16 | F.3 | Parcial | As ações críticas agora navegam primeiro e empurram estado secundário para depois das interações, mas ainda falta validação em device. |
| 17 | G.1 | Parcial | A home perdeu os blocos grandes fixos e passou a usar uma faixa compacta de sinais, mas ainda falta validação em device. |
| 18 | G.2 | Parcial | Os sinais compactos agora expandem detalhes sob toque, mas ainda falta validação em device. |
| 19 | G.3 | Parcial | A home já separa melhor o que é contexto transitório e o que é estado estrutural, mas ainda falta validação em device. |
| 20 | H.1 | Parcial | Favelas protótipo, áreas e rótulos espaciais entraram no mapa, mas ainda falta validação em device. |
| 21 | H.2 | Parcial | O mapa agora mostra dono e relação faccional das áreas, mas ainda falta validação em device. |
| 22 | H.3 | Parcial | Trilhas e eixos espaciais entraram no mapa, mas ainda falta validação em device. |

### Sequência operacional obrigatória

1. Fechar **A.1** antes de qualquer redesign maior.
2. Fechar **A.2** imediatamente depois, para o mapa voltar a dominar a tela.
3. Fechar **B.2** antes de chamar qualquer ação da home de “funcional”.
4. Só então avançar para **B.1**, **C.1**, **D.1-D.2** e o restante.
5. Depois da primeira validação em device, atacar **latência (F)** antes de seguir polindo texto.
6. Só então avançar para **HUD expansível (G)** e **identidade espacial do mundo (H)**.
