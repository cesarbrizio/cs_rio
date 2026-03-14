# MAPA.md — Mapa Interativo Compacto

> Este plano substitui a estratégia anterior de “urbanismo do mapa”.
>
> O diagnóstico final no device foi:
>
> - os mapas ainda estão **grandes demais**
> - existe **espaço morto demais**
> - ruas, casas e prédios sem interação **não ajudam o jogo**
> - os assets SVG melhoraram muito, mas ainda podem parecer **flutuando**
>
> Então a direção correta mudou:
>
> - o mapa local precisa ser **menor**
> - o mapa local precisa ser **mais denso**
> - o mapa local precisa mostrar **só o que interessa para jogar**
> - o mapa local não precisa parecer cidade realista
> - o mapa local precisa parecer **tabuleiro tático de lugares interativos**

## Objetivo

Transformar o mapa de:

- região grande demais
- boneco andando mais do que o necessário
- muita leitura irrelevante
- ruas que confundem
- construções passivas que não ajudam
- SVGs sem assentamento suficiente no chão

em:

- **mapa regional compacto**
- **foco em elementos interativos**
- **leitura rápida das favelas e POIs**
- **distâncias curtas e objetivas**
- **assets SVG assentados no chão**
- **regiões diferentes pela composição dos lugares, não pelo excesso de cenário**

## Premissas

### 1. O mapa local deve ter cerca de 30% do tamanho atual

O objetivo não é fazer o jogador passear.

O objetivo é:

- abrir a região
- ver rapidamente as favelas relevantes
- ver rapidamente boca, baile, rave, fábrica, hospital, prisão, mercado, treino, universidade e afins
- acessar tudo com pouco deslocamento

### 2. O mapa local é de jogo, não de urbanismo realista

Não precisamos de:

- rua por rua
- quarteirão por quarteirão
- casa aleatória
- prédio aleatório
- malha viária “bonita”

Se isso não ajuda a jogar, isso atrapalha.

### 3. O foco deve ser nos elementos interativos

O que realmente interessa no mapa:

- favela
- boca
- baile
- rave
- fábrica
- hospital
- prisão
- mercado negro
- treino
- universidade
- docas
- desmanche

Todo o resto só entra se ajudar a leitura desses pontos.

### 4. O SVG não pode flutuar

Cada asset precisa:

- tocar o chão
- ter base compatível
- ter anchor compatível
- parecer colocado no mapa, não pairando sobre ele

### 5. Regiões continuam existindo, mas de forma compacta

Cada região deve continuar tendo personalidade:

- `Centro`
- `Zona Norte`
- `Zona Sul`
- `Zona Oeste`
- `Zona Sudoeste`
- `Baixada`

Mas essa personalidade virá de:

- densidade dos interativos
- agrupamento das favelas
- tipo de POI dominante
- relação entre favela, serviço, mercado e produção

e não de:

- excesso de prédio sem função
- ruas decorativas
- cenário passivo demais

## O que continua válido do trabalho anterior

Esses blocos continuam sendo base útil:

1. **Biblioteca SVG de estruturas**
2. **Catálogo de tipos de construção/POI**
3. **Sistema de presets por região**
4. **Base de lote/placement**

## O que foi descartado como direção principal

Esses objetivos deixam de ser prioridade:

- fazer rua parecer rua realista
- povoar mapa com casa/prédio sem função
- construir “urbanismo bonito” por si só
- usar cenário passivo como protagonista do mapa

## Regra de execução

Só marcar etapa como concluída quando:

- a entrega existir no código
- e a mudança fizer diferença perceptível no device

Se a implementação entrar no código, mas o jogador ainda disser algo como:

- “o mapa continua grande demais”
- “tem coisa demais sem função”
- “a rua só confunde”
- “os SVGs continuam flutuando”

então a etapa **não** está concluída.

---

## Etapa 0 — Direção Aprovada

### Saída esperada

Fixar a nova direção do mapa local.

- [x] `0.1` Assumir que o mapa está grande demais
- [x] `0.2` Assumir que o foco deve ser nos elementos interativos
- [x] `0.3` Assumir que rua/prédio/casa passivos não são prioridade
- [x] `0.4` Assumir que o SVG precisa assentar no chão

---

## Etapa 1 — Biblioteca SVG Interativa

### Saída esperada

Ter uma biblioteca visual dos tipos realmente úteis para o jogo.

### Status atual

Concluída no código.

### O que esta etapa já entrega

- barracos
- favela cluster
- boca
- baile
- rave
- hospital
- prisão
- fábrica
- mercado negro
- treino
- universidade
- docas
- desmanche

### Itens

- [x] `1.1` Biblioteca de SVGs criada
- [x] `1.2` Catálogo de tipos criado
- [x] `1.3` Footprint padrão por tipo definido
- [x] `1.4` Integração do renderer com os SVGs
- [x] `1.5` Presets regionais consumindo os tipos
- [x] `1.6` Base pronta para iterar no layout compacto
- [x] `1.7` Tipos principais do jogo cobertos
- [x] `1.8` Reuso entre regiões habilitado

### Arquivos centrais

- [apps/mobile/src/data/mapStructureCatalog.ts](/home/cesar/projects/cs_rio/apps/mobile/src/data/mapStructureCatalog.ts)
- [apps/mobile/src/data/generated/mapStructureSvgCatalog.generated.ts](/home/cesar/projects/cs_rio/apps/mobile/src/data/generated/mapStructureSvgCatalog.generated.ts)
- [apps/mobile/src/data/mapStructureSvgCatalog.ts](/home/cesar/projects/cs_rio/apps/mobile/src/data/mapStructureSvgCatalog.ts)
- [apps/mobile/assets/map-structures](/home/cesar/projects/cs_rio/apps/mobile/assets/map-structures)

---

## Etapa 2 — Compactação Regional

### Saída esperada

Reduzir drasticamente a escala do mapa local para cada região.

### Status atual

Parcial.

### O que esta etapa precisa entregar

- regiões com cerca de **30% do tamanho atual**
- menos caminhada
- mais densidade
- mais objetividade

### Entregas obrigatórias

- [x] `2.1` Reduzir a área jogável efetiva do `Centro`
- [x] `2.2` Reduzir a área jogável efetiva da `Zona Norte`
- [x] `2.3` Reduzir a área jogável efetiva das demais regiões
- [x] `2.4` Aproximar favelas e POIs entre si
- [x] `2.5` Reduzir distâncias mortas entre elementos
- [ ] `2.6` Garantir que a maior parte dos interativos caiba em leitura rápida

### Critério de aceite

Ao abrir a região, o jogador precisa sentir:

- “vejo rápido o que importa”
- “não preciso atravessar um mapa enorme”
- “os lugares úteis estão próximos e claros”

---

## Etapa 3 — Poda para Interativos

### Saída esperada

Eliminar do mapa local tudo que não ajuda a jogar.

### Status atual

Parcial.

### O que esta etapa precisa entregar

Remover ou reduzir fortemente:

- ruas decorativas
- casas sem função
- prédios sem função
- enchimento que não melhora a leitura

Manter:

- favelas
- POIs interativos
- terreno mínimo necessário para contexto

### Entregas obrigatórias

- [x] `3.1` Remover ruas como protagonista do mapa local
- [x] `3.2` Remover prédios residenciais passivos do layout principal
- [x] `3.3` Remover casas passivas do layout principal
- [x] `3.4` Remover prédios comerciais passivos do layout principal
- [x] `3.5` Preservar só elementos que ajudam a ler interatividade
- [x] `3.6` Simplificar a composição visual para leitura rápida
- [ ] `3.7` Garantir que o mapa ficou mais claro, e não mais vazio

### Critério de aceite

O jogador precisa pensar:

- “só estou vendo o que interessa”

e não:

- “tem um monte de coisa desenhada que não serve para nada”

---

## Etapa 4 — Assentamento dos SVGs no Chão

### Saída esperada

Fazer os assets parecerem realmente apoiados no mapa.

### Status atual

Em validação no device.

### O que esta etapa precisa entregar

- base de chão compatível por asset
- anchor corrigido
- sombra coerente
- remoção da sensação de “flutuar”

### Entregas obrigatórias

- [x] `4.1` Revisar anchor vertical dos SVGs
- [x] `4.2` Revisar offset por tipo
- [x] `4.3` Revisar base/lote visual por tipo interativo
- [x] `4.4` Revisar sombra dos SVGs
- [x] `4.5` Corrigir favela cluster e barracos primeiro
- [x] `4.6` Corrigir boca, baile, rave, fábrica e equipamentos depois

### Critério de aceite

O jogador precisa olhar e pensar:

- “isso está no chão”

e não:

- “isso está pairando”

---

## Etapa 5 — Centro Compacto e Interativo

### Saída esperada

Fazer o `Centro` virar um mapa compacto focado no que importa.

### Status atual

Parcial.

### O que esta etapa precisa entregar

- `Providência` claramente visível
- `Mercado Negro`
- `Hospital`
- `Treino`
- `Universidade`
- `Boca`
- `Baile`
- `Rave`
- `Docas`
- `Fábrica`

Todos próximos, legíveis e acessíveis.

### Entregas obrigatórias

- [x] `5.1` Compactar o `Centro`
- [x] `5.2` Manter a Providência como favela central do recorte
- [x] `5.3` Reorganizar os interativos do Centro em leitura rápida
- [x] `5.4` Reduzir drasticamente elementos passivos
- [x] `5.5` Garantir que o Centro parece região rica/comercial/portuária
- [ ] `5.6` Validar que o jogador entende rapidamente onde estão os pontos importantes

### Critério de aceite

Ao abrir o `Centro`, o jogador precisa ver em pouco tempo:

- favela
- mercado
- hospital
- treino
- porto/docas
- produção
- festa

---

## Etapa 6 — Zona Norte Compacta e Interativa

### Saída esperada

Fazer a `Zona Norte` virar um mapa compacto focado em favela/produção/periferia.

### Status atual

Parcial.

### O que esta etapa precisa entregar

- favela(s) mais evidentes
- boca
- baile
- fábrica
- desmanche
- hospital
- treino
- menos caminhada
- menos cenário passivo

### Entregas obrigatórias

- [x] `6.1` Compactar a `Zona Norte`
- [x] `6.2` Concentrar a leitura de favela e encosta
- [x] `6.3` Aproximar boca, baile e produção
- [x] `6.4` Reduzir elementos passivos
- [x] `6.5` Garantir identidade periférica/fabril
- [ ] `6.6` Validar leitura rápida da região

### Critério de aceite

Ao abrir a `Zona Norte`, o jogador precisa sentir:

- “isso é favela/periferia/produção”

com leitura mais rápida do que hoje.

---

## Etapa 7 — Demais Regiões Compactas

### Saída esperada

Aplicar o mesmo método nas outras regiões.

### Status atual

Parcial.

### Regiões

- `Zona Sul`
- `Zona Oeste`
- `Zona Sudoeste`
- `Baixada`

### Entregas obrigatórias

- [x] `7.1` Compactar a `Zona Sul`
- [x] `7.2` Compactar a `Zona Oeste`
- [x] `7.3` Compactar a `Zona Sudoeste`
- [x] `7.4` Compactar a `Baixada`
- [x] `7.5` Podar elementos passivos em todas elas
- [x] `7.6` Garantir identidade por composição interativa
- [ ] `7.7` Validar que cada região mudou claramente de sensação
- [ ] `7.8` Garantir que nenhuma região virou “Centro com outra cor”

### Critério de aceite

Trocar de região precisa mudar:

- densidade
- riqueza
- tipo de favela
- tipo de produção
- tipo de POI dominante

sem depender do HUD.

---

## Etapa 8 — Fechamento e Validação Final

### Saída esperada

Encerrar o plano só quando o mapa realmente ficar rápido, objetivo e jogável.

### Status atual

Em validação no device.

### Estado real do plano

As etapas de implementação já entraram no código:

- compactação regional
- poda para interativos
- assentamento dos SVGs
- `Centro` autorado
- `Zona Norte` autorada
- `Zona Sul`, `Zona Oeste`, `Zona Sudoeste` e `Baixada` autoradas

O que falta agora não é mais “escrever outra arquitetura”.

O que falta é confirmar no aparelho que o resultado ficou:

- menor
- mais denso
- mais objetivo
- mais legível
- mais parecido com jogo

Se o teste no device falhar, o plano não fecha.

### Entregas obrigatórias

- [ ] `8.1` Validar que o mapa local ficou claramente menor e mais objetivo
- [ ] `8.2` Validar que a maior parte do que aparece é interativo
- [ ] `8.3` Validar que os SVGs assentam no chão
- [ ] `8.4` Validar que o jogador encontra rápido favela, boca, baile, rave, fábrica e hospital
- [ ] `8.5` Validar que as regiões mudam de sensação entre si
- [ ] `8.6` Validar que o mapa parece jogo e não overlay técnico

### Roteiro objetivo de validação

#### `Centro`

- confirmar se a `Providência` aparece de cara como favela principal
- confirmar se `Mercado`, `Hospital`, `Treino`, `Universidade`, `Docas`, `Fábrica`, `Boca`, `Baile` e `Rave` ficam próximos
- confirmar se o `Centro` parece comercial/portuário sem poluição inútil

#### `Zona Norte`

- confirmar se a leitura de favela/encosta/produção aparece de cara
- confirmar se `Boca`, `Baile`, `Fábrica` e `Desmanche` parecem o mesmo ecossistema
- confirmar se a região não parece só “Centro com outra cor”

#### `Zona Sul`, `Zona Oeste`, `Zona Sudoeste` e `Baixada`

- trocar entre as quatro e confirmar diferença clara de sensação
- checar qual POI domina a leitura de cada uma
- checar se alguma região ainda parece versão reciclada de outra

#### Global

- confirmar se o mapa está menor e mais objetivo
- confirmar se o jogador anda pouco
- confirmar se a maior parte do que aparece é jogável
- confirmar se algum asset ainda parece flutuando
- confirmar se o mapa parece jogo e não overlay técnico

### Pendências reais para encerrar o plano

- `2.6` validar leitura rápida do recorte compacto
- `3.7` validar que a poda deixou o mapa claro, e não vazio
- `5.6` validar entendimento rápido do `Centro`
- `6.6` validar leitura rápida da `Zona Norte`
- `7.7` validar mudança clara de sensação entre as regiões
- `7.8` validar que nenhuma região virou “Centro com outra cor”
- `8.1` a `8.6` validar o veredito final do mapa

### Critério de aceite

Só considerar o plano fechado quando o veredito final for algo próximo de:

- “agora o mapa está objetivo”
- “vejo rápido o que importa”
- “os lugares interativos estão claros”
- “não tem mais um monte de coisa inútil poluindo”
- “os assets parecem no chão”
- “agora isso parece jogo”

Se ainda vier algo como:

- “continua grande demais”
- “continua com muita coisa inútil”
- “continua confuso”
- “continua parecendo overlay”

então o plano falhou.

---

## Ordem Recomendada de Execução

| Passo | Etapa | Entrega | Impacto |
|---|---|---|---|
| 1 | Etapa 2 | Compactação regional | Menos caminhada, mais densidade |
| 2 | Etapa 3 | Poda para interativos | Menos poluição, mais objetividade |
| 3 | Etapa 4 | Assentamento dos SVGs | Assets deixam de flutuar |
| 4 | Etapa 5 | Centro compacto | Primeira região realmente objetiva |
| 5 | Etapa 6 | Zona Norte compacta | Segunda região realmente objetiva |
| 6 | Etapa 7 | Demais regiões | Mundo inteiro entra na nova lógica |
| 7 | Etapa 8 | Validação final | Só fecha quando parecer jogo |

## Métricas de Progresso

| Etapa | Tarefas | Concluídas | % |
|---|---|---|---|
| Etapa 0 — Direção Aprovada | 4 | 4 | 100% |
| Etapa 1 — Biblioteca SVG Interativa | 8 | 8 | 100% |
| Etapa 2 — Compactação Regional | 6 | 5 | 83% |
| Etapa 3 — Poda para Interativos | 7 | 6 | 86% |
| Etapa 4 — Assentamento dos SVGs no Chão | 6 | 6 | 100% |
| Etapa 5 — Centro Compacto e Interativo | 6 | 5 | 83% |
| Etapa 6 — Zona Norte Compacta e Interativa | 6 | 5 | 83% |
| Etapa 7 — Demais Regiões Compactas | 8 | 6 | 75% |
| Etapa 8 — Fechamento e Validação Final | 6 | 0 | 0% |
| **TOTAL** | **57** | **45** | **79%** |
