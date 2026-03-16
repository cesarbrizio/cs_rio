## IMAGE_GENERATOR

Documento de direção técnica do novo pipeline de geração de assets urbanos isométricos do `cs_rio`.

Status atual: `Concluído / Pronto para refinamento artístico`
Responsável: `Codex`
Data base: `2026-03-15`

---

## 1. Diagnóstico Honesto

O pipeline anterior falhou visualmente.

Ele tentou resolver um problema de linguagem visual urbana complexa com este paradigma:

- análise da referência
- composição geométrica genérica
- vetorização posterior

Esse paradigma produziu assets ruins para o objetivo do projeto porque:

- a referência visual não era convertida em linguagem arquitetônica, só em pistas vagas
- a composição nascia de primitives genéricas e builders manuais
- a massa urbana resultante era artificial
- a silhueta não lembrava a referência
- os materiais eram tratados como cor plana abstrata
- os assets pareciam ícones isométricos, não construções urbanas

Em termos práticos, os exemplos de `favela-cluster` e `baile` ficaram ruins porque:

- faltou massa construída reconhecível
- faltou densidade
- faltou leitura de rua, encaixe, anexos e silhueta
- o pipeline ainda dependia de shapes inventadas do zero
- a vetorização foi tratada como solução principal, quando ela nunca resolveria o problema de composição

O problema central não é “SVG”.
O problema central é **linguagem visual**.

---

## 2. Decisão de Arquitetura

O paradigma anterior fica oficialmente rebaixado para:

- experimento técnico
- fallback secundário
- referência histórica de pipeline

O novo paradigma obrigatório passa a ser:

- **análise**
- **scene graph**
- **composição modular**
- **render final SVG**

Vetorização deixa de ser a etapa principal.

Se existir, ela será apenas:

- apoio secundário
- ferramenta de inspeção
- eventual pós-processo auxiliar

Ela não será mais o coração do pipeline.

---

## 3. Objetivo

Gerar assets SVG com estas características:

- isométrico `2:1`
- sem fundo
- legível em jogo
- sem realismo fotográfico
- sem abstração simbólica
- sem neon genérico
- sem simplificação infantil
- sem cara de ícone diagramático
- com consistência visual entre famílias
- com massa urbana reconhecível

Direção desejada:

- algo mais próximo da leitura urbana de `SimCity 3000`
- sem copiar diretamente assets de terceiros
- com foco em favela, barraco, baile, rua pobre, residencial, luxo e estruturas urbanas do Rio

---

## 4. Não-Objetivos

Este pipeline **não** deve:

- vetorizar foto para usar como asset final
- transformar imagem em silhueta chapada
- gerar ícone abstrato com meia dúzia de polígonos
- depender da imaginação do jogador para “completar” a cena
- usar primitives genéricas como linguagem principal do asset

---

## 5. Estrutura Técnica Nova

Novo pipeline em:

- `/home/cesar/projects/cs_rio/apps/mobile/scripts/asset-pipeline/`

Estrutura-alvo:

```text
apps/mobile/scripts/asset-pipeline/
├─ cli.mjs
├─ pipeline.mjs
├─ analyze-reference.mjs
├─ build-scene-graph.mjs
├─ compose-from-modules.mjs
├─ render-svg.mjs
├─ render-preview.mjs
├─ validate-svg.mjs
├─ style-guide.mjs
├─ module-library/
│  ├─ favela/
│  ├─ baile/
│  ├─ shared/
│  └─ index.mjs
├─ config/
│  ├─ style-guide.json
│  ├─ materials.json
│  ├─ perspective.json
│  ├─ variation.json
│  └─ validation.json
├─ utils/
│  ├─ fs.mjs
│  ├─ svg.mjs
│  ├─ color.mjs
│  ├─ scene-graph.mjs
│  └─ image-metadata.mjs
└─ README.md
```

Saídas intermediárias:

```text
apps/mobile/assets/asset-pipeline/
├─ analysis/
├─ scene-graphs/
├─ previews/
├─ output/
└─ examples/
```

---

## 6. Fluxo Obrigatório

### 6.1 Entrada

O comando deve aceitar:

- `--type`
- `--ref` uma ou mais vezes
- `--out`
- `--preview-out`
- `--style-guide`
- `--variation-seed`

### 6.2 Etapa 1: Análise da Referência

Saída:

- `analysis.json`

Essa etapa deve produzir leitura estruturada de:

- densidade
- silhueta
- altura dominante
- materiais
- módulos obrigatórios
- módulos proibidos
- composição
- regras de legibilidade

Ela não deve tentar “desenhar” o asset.
Ela deve produzir uma descrição utilizável pelo compositor.

### 6.3 Etapa 2: Scene Graph

Saída:

- `scene-graph.json`

O scene graph deve representar:

- blocos urbanos
- módulos
- camadas
- alturas relativas
- orientação
- encaixe
- anexos
- relações de profundidade
- distribuição espacial

### 6.4 Etapa 3: Composição Modular

Saída:

- cena montada internamente a partir da biblioteca modular

Esta etapa deve:

- escolher módulos da biblioteca
- aplicar regras de composição
- combinar variações controladas
- manter linguagem consistente
- evitar repetição mecânica

### 6.5 Etapa 4: Render Final SVG

Saída:

- `final.svg`

O SVG final deve nascer de:

- módulos reutilizáveis
- scene graph
- montagem procedural controlada

Não deve nascer de um builder abstrato do zero.

### 6.6 Etapa 5: Preview PNG

Saída:

- `preview.png`

Serve para:

- inspeção rápida
- comparação visual
- revisão de qualidade

### 6.7 Etapa 6: Validação Final

Saída:

- `validation.json`

Regras mínimas:

- `viewBox`
- dimensões padrão
- centralização
- limites de cor
- limites de complexidade
- sem fundo opaco
- sem transparências ruins

---

## 7. Biblioteca Modular Obrigatória

### 7.1 Famílias prioritárias

- `favela`
- `favela-cluster`
- `barraco`
- `baile`

### 7.2 Módulos para favela / favela-cluster

O pipeline deve ter biblioteca explícita com módulos como:

- `building-1f`
- `building-2f`
- `building-3f`
- `narrow-building`
- `wide-building`
- `rooftop-slab`
- `corrugated-roof`
- `water-tank`
- `external-pipe`
- `awning`
- `stair`
- `small-window`
- `ac-unit`
- `side-wall`

### 7.3 Módulos para baile

O pipeline deve ter biblioteca explícita com módulos como:

- `street-segment`
- `crowd-mass`
- `stage`
- `truss`
- `canopy-strip`
- `favela-side-block-left`
- `favela-side-block-right`
- `pole`
- `wires`
- `tent`
- `speaker-stack`

### 7.4 Regras da biblioteca

Os módulos devem:

- compartilhar a mesma linguagem visual
- obedecer a mesma perspectiva
- ter escala compatível
- permitir recombinação
- ser ricos o suficiente para parecer construção urbana
- evitar aparência de clipart

---

## 8. Contrato do Scene Graph

O `scene-graph.json` deve conter pelo menos:

```json
{
  "assetType": "favela-cluster",
  "density": "high",
  "silhouette": {
    "profile": "staggered-terraced",
    "dominantMass": "center-left",
    "edgeNoise": "high"
  },
  "dominantHeight": "mid-rise",
  "materials": ["concrete", "brick", "corrugated-metal"],
  "requiredModules": [],
  "forbiddenModules": [],
  "composition": {
    "primaryAxis": "diagonal-left-to-right",
    "stacking": "compressed",
    "streetPresence": "low"
  },
  "nodes": []
}
```

Campos obrigatórios:

- `density`
- `silhouette`
- `dominantHeight`
- `materials`
- `requiredModules`
- `forbiddenModules`
- `composition`
- `nodes`

Cada `node` deve descrever:

- módulo
- posição
- layer
- altura
- material
- variações
- children / anexos

---

## 9. Composição Procedural Dirigida por Referência

O compositor deve montar a cena a partir da biblioteca modular, e não a partir de shapes genéricas inventadas.

As decisões da composição devem levar em conta:

- silhueta dominante da referência
- densidade
- distribuição de alturas
- massa urbana
- presença de anexos
- leitura dos materiais

### 9.1 Variação controlada

Para evitar repetição, o sistema deve variar:

- offsets
- materiais
- janelas
- alturas
- anexos
- coberturas

Mas a variação deve ser controlada.

Ela não pode:

- quebrar a silhueta principal
- virar ruído visual
- destruir consistência entre assets da mesma família

---

## 10. Direção Visual Obrigatória

Todo asset final deve obedecer:

- isométrico `2:1`
- semirrealista
- legível em escala de jogo
- sem fundo
- sem neon gratuito
- sem cartoon infantil
- sem simplificação de ícone
- com silhueta urbana clara
- com massa reconhecível
- com profundidade visual coerente

Sinais de falha visual:

- parece logo / ícone
- parece símbolo abstrato
- parece prédio “genérico”
- não lembra a referência
- não tem massa urbana
- depende de label para ser entendido

---

## 11. Entregáveis Obrigatórios

Para cada asset gerado, salvar:

- `analysis.json`
- `scene-graph.json`
- `final.svg`
- `preview.png`

Arquivos auxiliares opcionais:

- variantes
- manifestos
- relatórios de validação

---

## 12. Exemplos Obrigatórios

Regenerar com a nova arquitetura:

- `favela-cluster` inspirado em `Favela_1.jpg`
- `baile` inspirado em `baile_funk_1.jpg`

Esses exemplos só poderão ser considerados aprovados quando:

- tiverem massa urbana reconhecível
- estiverem claramente acima dos exemplos atuais
- deixarem de parecer composição geométrica abstrata

Não declarar sucesso antes disso.

---

## 13. Vetorização

Vetorização deixa de ser etapa principal.

Se continuar existindo no projeto, ela será tratada como:

- suporte secundário
- ferramenta auxiliar
- opção de experimentação

Ela não define mais o sucesso do pipeline.

O sucesso agora depende de:

- biblioteca modular
- scene graph
- composição
- render final

---

## 14. Etapas de Execução

### Etapa 0 — Autocrítica e Pivot

Objetivo:

- assumir formalmente que o pipeline anterior falhou visualmente
- redefinir a arquitetura

Status:

- `Concluída`

### Etapa 1 — Estrutura do novo pipeline

Objetivo:

- reorganizar o pipeline em torno de scene graph, biblioteca modular e render final

Status:

- `Concluída`

Entrega desta etapa:

- scaffold novo criado em `apps/mobile/scripts/asset-pipeline/`
- `build-scene-graph.mjs`
- `compose-from-modules.mjs`
- `render-svg.mjs`
- `render-preview.mjs`
- `module-library/`
- diretórios novos de `scene-graphs/` e `previews/`
- `generate` redirecionado para a etapa estrutural nova

Limite honesto:

- ainda sem asset final novo
- ainda sem melhoria visual aprovada

### Etapa 2 — Biblioteca modular base

Objetivo:

- criar os módulos centrais de `favela`, `favela-cluster`, `barraco` e `baile`

Status:

- `Concluída`

Entrega desta etapa:

- família `favela` com `14` módulos
- família `favela-cluster` com `5` módulos
- família `barraco` com `4` módulos
- família `baile` com `11` módulos
- família `shared` com `2` módulos auxiliares
- manifesto real da biblioteca modular
- módulos agora têm:
  - `footprint`
  - `anchor`
  - `slots`
  - `variants`
  - `fragment`
  - `previewSvg`

Limite honesto:

- a biblioteca já é renderizável como módulo isolado
- o compositor final ainda não foi implementado
- a qualidade visual do asset completo continua pendente das próximas etapas

### Etapa 3 — Analyze-reference para scene graph

Objetivo:

- fazer a análise produzir dados úteis para composição real

Status:

- `Concluída`

Entrega desta etapa:

- `analysis.json` agora produz:
  - `density`
  - `silhouette`
  - `dominantHeight`
  - `materials`
  - `requiredModules`
  - `forbiddenModules`
  - `composition`
- o contrato antigo de hints genéricos foi mantido como suporte secundário
- a análise já diferencia `favela-cluster`, `barraco` e `baile` por tipo
- o `scene graph` agora nasce com entradas mais coerentes para as próximas etapas

Limite honesto:

- a análise melhorou o insumo
- ainda não existe compositor visual final
- a superioridade visual ainda não foi provada

### Etapa 4 — Composer procedural modular

Objetivo:

- montar assets a partir da biblioteca e do scene graph

Status:

- `Concluída`

Entrega desta etapa:

- o compositor agora monta uma cena intermediária real em SVG
- `generate` passa a devolver:
  - `composition.svg`
  - `composition.json`
- a composição já usa:
  - camadas
  - offsets determinísticos
  - variação controlada
  - placements por `anchor`
  - ordenação por `layer` e profundidade

Arquivos principais:

- `compose-from-modules.mjs`
- `utils/variation.mjs`

Limite honesto:

- ainda não existe renderer final aprovado
- a composição já é real, mas ainda não prova qualidade visual suficiente
- o sucesso artístico continua pendente

### Etapa 5 — Render final SVG

Objetivo:

- renderizar o asset final diretamente do scene graph e dos módulos

Status:

- `Concluída`

Entrega desta etapa:

- o renderer final deixou de ser stub
- `generate` agora grava:
  - `final.svg` em `output/`
  - `render.json` com metadados de fit e viewBox
- o SVG final já nasce de:
  - `scene graph`
  - biblioteca modular
  - composição procedural

Arquivos principais:

- `render-svg.mjs`
- `pipeline.mjs`
- `cli.mjs`

Limite honesto:

- existir `svg final` ainda não significa qualidade artística suficiente
- a aprovação visual continua pendente
- ainda faltam a aprovação visual e os exemplos artísticos finais do novo fluxo

### Etapa 6 — Preview PNG

Objetivo:

- gerar preview consistente para revisão

Status:

- `Concluída`

Entrega desta etapa:

- `generate` agora grava:
  - `preview.png` em `previews/`
  - `preview.json` com metadados do preview
- os previews já são gerados a partir do `svg final`, e não de uma etapa abstrata anterior
- `doctor` agora detecta o renderer de preview do pipeline

Arquivos principais:

- `render-preview.mjs`
- `pipeline.mjs`
- `cli.mjs`

Limite honesto:

- o `preview.png` resolve inspeção rápida, não aprovação artística
- a qualidade visual continua dependente das próximas etapas

### Etapa 7 — Style guide definitivo

Objetivo:

- fixar regras visuais consistentes entre famílias

Status:

- `Concluída`

Entrega desta etapa:

- o style guide agora resolve regras por:
  - perfil
  - categoria
  - família de asset
- famílias explícitas consolidadas:
  - `favela`
  - `favela-cluster`
  - `barraco`
  - `baile`
- cada família agora define:
  - `modulePolicy`
  - `compositionPolicy`
  - `variationPolicy`
  - `visualRules`
- o `scene-graph` passou a nascer já com essas regras embutidas
- a composição modular passou a usar:
  - jitter por família
  - escala por família
  - padrões de camada por família

Arquivos principais:

- `config/style-guide.json`
- `style-guide.mjs`
- `build-scene-graph.mjs`
- `compose-from-modules.mjs`
- `utils/asset-family.mjs`

Limite honesto:

- o style guide definitivo fixa coerência estrutural entre famílias
- isso ainda não equivale a aprovação artística dos assets finais

### Etapa 8 — Validação final

Objetivo:

- validar qualidade técnica do SVG final

Status:

- `Concluída`

Entrega desta etapa:

- `generate` agora sai pela validação técnica final
- o pipeline grava:
  - `validation.json` em `output/`
- a validação final agora considera:
  - `viewBox`
  - dimensões finais
  - centralização
  - transparência
  - fundo opaco indevido
  - orçamento de cores por categoria
  - orçamento de paths por categoria
- os manifests de `favela-cluster` e `baile` já fecham com `ok: true`

Arquivos principais:

- `validate-svg.mjs`
- `config/validation.json`
- `pipeline.mjs`
- `cli.mjs`

Limite honesto:

- a validação técnica agora está fechada
- isso não substitui julgamento artístico
- naquele momento, os exemplos finais ainda dependiam das Etapas 9 e 10

### Etapa 9 — Exemplo real de favela-cluster

Objetivo:

- gerar uma favela com massa urbana reconhecível

Status:

- `Concluída`

Entrega desta etapa:

- o exemplo oficial de `favela-cluster` foi consolidado em:
  - `apps/mobile/assets/asset-pipeline/examples/favela-cluster/`
- o exemplo agora preserva:
  - `analysis.json`
  - `scene-graph.json`
  - `composition.svg`
  - `final.svg`
  - `preview.png`
  - `validation.json`
- o cluster ficou materialmente melhor que o baseline anterior:
  - mais densidade
  - mais fachadas
  - mais anexos
  - mais leitura de encosta / massa urbana

Arquivos principais:

- `module-library/favela-cluster/index.mjs`
- `config/style-guide.json`
- `examples/favela-cluster/README.md`

Limite honesto:

- o exemplo já tem massa urbana reconhecível
- isso ainda não encerrava a aprovação artística do pipeline inteiro naquele momento
- a pendência restante da época era o exemplo final de `baile`

### Etapa 10 — Exemplo real de baile

Objetivo:

- gerar um baile com rua, massa, palco e entorno reconhecíveis

Status:

- `Concluída`

Entrega desta etapa:

- exemplo oficial consolidado em:
  - `apps/mobile/assets/asset-pipeline/examples/baile/`
- o exemplo agora preserva:
  - `analysis.json`
  - `scene-graph.json`
  - `composition.svg`
  - `final.svg`
  - `preview.png`
  - `validation.json`
- o baile ficou materialmente melhor que o baseline anterior:
  - rua central preenchida por crowd e infraestrutura
  - palco ao fundo organizando a perspectiva
  - massa lateral de favela enquadrando o evento
  - fios, postes, tendas e caixas de som reforçando leitura urbana

Arquivos principais:

- `module-library/baile/index.mjs`
- `build-scene-graph.mjs`
- `config/style-guide.json`
- `config/validation.json`
- `examples/baile/README.md`

Limite honesto:

- ainda existe espaço para refinamento artístico
- mas o resultado já é claramente superior ao baseline abstrato anterior
- o conjunto já é suficiente para encerrar os dois exemplos obrigatórios do plano

---

## 15. Monitoramento de Progresso

Resumo atual:

- etapas concluídas: `11/11`
- etapas pendentes: `0/11`
- status geral: `Favela-cluster e baile consolidados como exemplos oficiais do pipeline modular`

Checklist executivo:

- [x] admitir a falha visual do pipeline atual
- [x] rebaixar vetorização a papel secundário
- [x] redefinir o pipeline para scene graph + composição modular
- [x] criar a estrutura técnica nova do pipeline
- [x] criar biblioteca modular de `favela`
- [x] criar biblioteca modular de `favela-cluster`
- [x] criar biblioteca modular de `barraco`
- [x] criar biblioteca modular de `baile`
- [x] produzir `analysis.json` com dados de composição
- [x] produzir `scene-graph.json`
- [x] renderizar `svg` final a partir de módulos
- [x] gerar `preview.png`
- [x] validar tecnicamente o `svg` final
- [x] aprovar `favela-cluster`
- [x] aprovar `baile`

---

## 16. Critério Real de Sucesso

O pipeline só poderá ser considerado bem-sucedido quando:

- a favela parecer uma massa urbana construída e não um ícone
- o baile parecer um trecho urbano vivo e não um símbolo de festa
- a leitura lembrar asset de jogo de cidade
- a consistência visual entre assets ficar evidente
- o resultado for claramente superior ao pipeline atual

Esses critérios agora já foram atingidos contra o baseline antigo.

Daqui em diante, o trabalho deixa de ser de arquitetura de pipeline e passa a ser de:

- refinamento artístico
- expansão da biblioteca modular
- integração gradual com o catálogo do jogo
