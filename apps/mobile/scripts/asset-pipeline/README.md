# Asset Pipeline

Pipeline novo de geração de assets urbanos isométricos do `cs_rio`.

Ele existe **ao lado** do pipeline legado em [generate-map-structure-svgs.mjs](/home/cesar/projects/cs_rio/apps/mobile/scripts/generate-map-structure-svgs.mjs) e não substitui o fallback atual.

## Objetivo

Sair de SVGs simbólicos e abstratos e migrar para um fluxo modular:

1. análise da referência
2. scene graph
3. composição modular
4. render final SVG
5. preview PNG
6. validação

Direção visual:
- isométrico `2:1`
- sem fundo
- legível em jogo
- sem foto vetorizada literal
- sem “ícone geométrico genérico”
- coerente com uma leitura urbana tipo SimCity 3000

## Estado atual

O pipeline anterior, baseado em composição geométrica genérica e vetorização, falhou visualmente.

O estado real agora é:

- **nova Etapa 1 concluída**
- **nova Etapa 2 concluída**
- **nova Etapa 3 concluída**
- **nova Etapa 4 concluída**
- **nova Etapa 5 concluída**
- **nova Etapa 6 concluída**
- **nova Etapa 7 concluída**
- **nova Etapa 8 concluída**
- estrutura modular criada
- scene graph e composição modular ativos
- biblioteca base criada para `favela`, `favela-cluster`, `barraco` e `baile`
- render final SVG ativo
- preview PNG ativo
- style guide definitivo por família ativo
- validação técnica final ativa

Estado honesto:

- a arquitetura nova já existe
- o fluxo técnico ponta a ponta já existe
- existem exemplos oficiais revisáveis para `favela-cluster` e `baile`
- o pipeline está funcional para exploração visual

## Estrutura

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
│  ├─ barraco/
│  ├─ favela-cluster/
│  ├─ favela/
│  ├─ baile/
│  └─ shared/
├─ config/
│  ├─ style-guide.json
│  ├─ materials.json
│  ├─ perspective.json
│  ├─ validation.json
│  └─ variation.json
└─ utils/
   ├─ fs.mjs
   ├─ image-metadata.mjs
   ├─ scene-graph.mjs
   └─ svg.mjs
```

Saídas de trabalho:

```text
apps/mobile/assets/asset-pipeline/
├─ analysis/
├─ scene-graphs/
├─ previews/
├─ output/
└─ examples/
   ├─ catalog-families/
   ├─ favela-cluster/
   └─ baile/
```

## Dependências

### Ubuntu

```bash
sudo apt update
sudo apt install -y inkscape
```

### Workspace mobile

```bash
cd /home/cesar/projects/cs_rio
npm install -D svgo --workspace @cs-rio/mobile
npm install -D @resvg/resvg-js --workspace @cs-rio/mobile
```

## Comandos

### Doctor

Verifica a infraestrutura local:

```bash
npm run asset:pipeline --workspace @cs-rio/mobile -- doctor
```

Saída esperada:
- diretórios do pipeline
- estado de `inkscape`
- estado de `svgo`
- estado de `resvg`
- status da etapa integrada no código

### Catalog Plan

Resolve o plano de substituição do catálogo atual de `map-structures`:

```bash
npm run asset:pipeline --workspace @cs-rio/mobile -- catalog-plan
```

Saída esperada:
- total de `MapStructureKind` mapeados
- distribuição por família alvo
- distribuição por modo de implementação
- validação de referências ausentes ou duplicadas
- manifesto resolvido em:
  - `assets/asset-pipeline/analysis/map-structure-replacement-plan.json`

### Catalog Families

Materializa a curadoria de referências por família visual:

```bash
npm run asset:pipeline --workspace @cs-rio/mobile -- catalog-families
```

Saída esperada:
- total de famílias curadas
- validação de famílias faltantes, órfãs ou duplicadas
- validação de referências ausentes
- manifesto resolvido em:
  - `assets/asset-pipeline/analysis/map-structure-family-packs.json`
- pacotes materializados em:
  - `assets/asset-pipeline/examples/catalog-families/<family>/`

Cada pack de família passa a conter:
- `family-pack.json`
- `README.md`
- `references/*` com cópia local das referências curadas

### Catalog Generate

Executa a substituição em lote dos `map-structures` atuais usando o plano e os packs de família já curados:

```bash
npm run asset:pipeline --workspace @cs-rio/mobile -- catalog-generate
```

Saída esperada:
- SVGs finais gerados diretamente em:
  - `assets/map-structures/<kind>.svg`
- previews em:
  - `assets/asset-pipeline/previews/`
- manifestos de validação em:
  - `assets/asset-pipeline/output/*.validation.json`
- manifesto consolidado da execução em:
  - `assets/asset-pipeline/analysis/map-structure-generation-stage3.json`

Critério de sucesso:
- todos os `MapStructureKind` processados com `ok: true`
- `build` do mobile permanecendo verde após a substituição

### Catalog Validate

Executa a validação final do catálogo já substituído e materializa a revisão visual mínima:

```bash
npm run asset:pipeline --workspace @cs-rio/mobile -- catalog-validate
```

Saída esperada:
- manifesto consolidado em:
  - `assets/asset-pipeline/analysis/map-structure-stage5-validation.json`
- galeria HTML de revisão visual em:
  - `assets/asset-pipeline/examples/catalog-review/index.html`

Essa etapa confirma:
- existência dos `29` SVGs finais em `assets/map-structures/`
- existência dos previews PNG
- existência dos manifestos de validação
- cobertura dos `29` kinds dentro de `mapStructureSvgCatalog.generated.ts`

### Generate

Executa a etapa estrutural atual do novo pipeline:

```bash
npm run asset:pipeline --workspace @cs-rio/mobile -- \
  generate \
  --type favela-cluster \
  --style-guide dense-favela \
  --ref ./assets/examples/favela/Favela_1.jpg \
  --ref ./assets/examples/tend/barraco_4.jpg \
  --out ./assets/asset-pipeline/output/favela-cluster.svg
```

Parâmetros:
- `--type`: tipo lógico do asset
- `--ref`: imagem de referência, pode repetir
- `--out`: caminho alvo do asset
- `--preview-out`: caminho opcional do preview PNG
- `--style-guide`: perfil visual do projeto
- `--keep-intermediate`: preserva os intermediários explícitos do processo

Saída esperada nesta fase:
- `<nome>.analysis.json`
- `<nome>.scene-graph.json`
- `<nome>.stage1-structure.json`
- `<nome>.composition.svg`
- `<nome>.composition.json`
- `--out` com o SVG final
- `<nome>.render.json`
- `<nome>.preview.png`
- `<nome>.preview.json`
- `<nome>.validation.json`

### Style Guide

Inspeciona qual guia realmente será aplicado:

```bash
npm run asset:pipeline --workspace @cs-rio/mobile -- \
  style-guide \
  --type favela-cluster \
  --style-guide dense-favela
```

Saída:
- perfis disponíveis
- categoria inferida
- perfil resolvido
- policy de outline
- regras visuais efetivas

## Fluxo atual

### 1. Análise

Gera:
- `<nome>.analysis.json`

Esses arquivos vivem em:
- `assets/asset-pipeline/analysis/`

O `.analysis.json` descreve:
- `assetType`
- `category`
- `referenceFiles`
- `density`
- `silhouette`
- `dominantHeight`
- `materials`
- `volumetry`
- `requiredElements`
- `forbiddenElements`
- `requiredModules`
- `forbiddenModules`
- `legibilityRules`
- `cameraHints`
- `paletteHints`
- `composition`
- `compositionHints`
- `resolvedStyleGuide`

### Biblioteca modular atual

Contagem atual:

- `shared`: `2`
- `favela`: `14`
- `favela-cluster`: `5`
- `barraco`: `4`
- `baile`: `11`

Cada modulo agora ja carrega:

- `footprint`
- `anchor`
- `slots`
- `variants`
- `fragment`
- `previewSvg`

### 2. Scene graph

Gera:
- `<nome>.scene-graph.json`

Esses arquivos vivem em:
- `assets/asset-pipeline/scene-graphs/`

Função:
- transformar a análise em um grafo de módulos e massas
- preparar a composição modular futura
- ainda não é o asset final

### 3. Composição modular

Gera:
- `<nome>.composition.svg`
- `<nome>.composition.json`

Esses arquivos vivem em:
- `assets/asset-pipeline/intermediate/`

Função:
- posicionar módulos reais da biblioteca
- aplicar jitter determinístico
- ordenar camadas
- gerar uma cena SVG intermediária antes do renderer final

### 4. Render final SVG

Gera:
- `--out`
- `<nome>.render.json`

Esses arquivos vivem em:
- `assets/asset-pipeline/output/`

Função:
- encaixar a composição no viewBox final do projeto
- materializar o SVG final
- registrar `fit`, `sourceViewBox` e `targetViewBox`

### 5. Preview PNG

Gera:
- `<nome>.preview.png`
- `<nome>.preview.json`

Esses arquivos vivem em:
- `assets/asset-pipeline/previews/`

Funcao:
- rasterizar o SVG final para revisão rápida
- facilitar comparação visual sem abrir o SVG manualmente
- manter o preview no próprio pipeline

### 6. Validação

Gera:
- `<nome>.validation.json`

Esses arquivos vivem em:
- `assets/asset-pipeline/output/`

Regras atuais:
- `viewBox` obrigatório
- `viewBox` esperado = `0 0 160 160`
- centralização do conteúdo
- limite de cores por categoria
- limite de `path` por categoria
- transparências ruins
- fundo opaco indevido

## Style Guide

Perfis disponíveis hoje:
- `default`
- `simcity-urban`
- `dense-favela`

Além do perfil, o style guide agora resolve também por:
- categoria
- família de asset

Famílias explícitas hoje:
- `favela`
- `favela-cluster`
- `barraco`
- `baile`

### `default`

Uso:
- base geral do projeto

Intenção:
- equilíbrio entre legibilidade urbana, contraste e ruído de material

### `simcity-urban`

Uso:
- assets mais institucionais, industriais ou residenciais limpos

Intenção:
- leitura mais organizada
- menos ruído
- massa urbana mais clara

### `dense-favela`

Uso:
- `favela`, `barraco`, `favela-cluster`

Intenção:
- mais densidade
- mais sobreposição
- maior variação de cobertura
- silhouette mais agressiva

### Overrides por categoria

Hoje o pipeline já aplica overrides por categoria para:
- `favela`
- `nightlife`
- `hospital`
- `factory`
- `junkyard`
- `wealthy`
- `residential`
- `poor`

Esses overrides entram:
- na análise
- na composição

### Regras por família

Cada família agora carrega quatro blocos fixos:
- `modulePolicy`
- `compositionPolicy`
- `variationPolicy`
- `visualRules`

Na prática isso significa:
- `favela-cluster` nasce com mais módulos, skyline quebrado e layout comprimido de encosta
- `barraco` nasce menor, com menos nós e ênfase em cobertura/anexo
- `baile` nasce com rua central legível, palco como âncora e blocos laterais enquadrando o evento
- `favela` base mantém massa irregular, lajes e utilidades aparentes

O comando:

```bash
npm run asset:pipeline --workspace @cs-rio/mobile -- \
  style-guide \
  --type favela-cluster \
  --style-guide dense-favela
```

agora retorna:
- perfil resolvido
- família resolvida
- regras de módulos
- regras de composição
- regras de variação
- regras visuais

## Exemplos de uso

### Favela cluster

```bash
cd /home/cesar/projects/cs_rio/apps/mobile

npm run asset:pipeline -- \
  generate \
  --type favela-cluster \
  --style-guide dense-favela \
  --ref ./assets/examples/favela/Favela_1.jpg \
  --ref ./assets/examples/tend/barraco_4.jpg \
  --out ./assets/asset-pipeline/output/favela-cluster.svg
```

Exemplo histórico disponível em:

- [examples/favela-cluster](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/favela-cluster)

Nesse diretório agora existem:
- artefatos antigos `*.example.*`, mantidos como histórico
- artefatos novos `*.modular.*`, que representam a **Etapa 9** do pipeline modular atual

Estado atual do exemplo:
- já tem `analysis`, `scene graph`, `composition`, `svg final`, `preview` e `validation`
- já lê como cluster de favela denso melhor que o baseline abstrato anterior
- já compõe o par oficial de exemplos obrigatórios junto com `baile`

### Baile

```bash
cd /home/cesar/projects/cs_rio/apps/mobile

npm run asset:pipeline -- \
  generate \
  --type baile \
  --style-guide simcity-urban \
  --ref ./assets/examples/funk/baile_funk_1.jpg \
  --ref ./assets/examples/party/palco_4.jpg \
  --out ./assets/asset-pipeline/output/baile.svg
```

Exemplo histórico disponível em:

- [examples/baile](/home/cesar/projects/cs_rio/apps/mobile/assets/asset-pipeline/examples/baile)

Intenção:
- usar referência de evento + palco
- privilegiar frontage, palco e leitura social
- manter rua comprimida, crowd central e massas laterais de favela

Observação:
- o exemplo antigo de `baile` também fica apenas como histórico técnico
- os arquivos `*.modular.*` agora representam o exemplo oficial da **Etapa 10**

## Troubleshooting

### `generate` falha na etapa de preview

Revise primeiro:
- se `@resvg/resvg-js` está instalado
- se o `render.json` foi gerado com `targetViewBox`
- se o SVG final em `output/` abre normalmente

O `doctor` deve mostrar:
- `resvg: available`

### `generate` falha na etapa de validação

Revise:
- o arquivo `<nome>.validation.json`
- o orçamento de cores por categoria em `config/validation.json`
- se o asset ficou fora do `viewBox`
- se algum fundo opaco foi introduzido

### O SVG validado ainda está visualmente ruim

A validação atual garante:
- consistência técnica mínima

Ela **não garante qualidade artística**. A qualidade agora depende de:
- biblioteca modular
- scene graph
- compositor
- renderer final

## Integração com o pipeline legado

O pipeline antigo continua:
- intacto
- funcional
- sendo o fallback do catálogo atual

O pipeline novo:
- não quebra o catálogo atual
- não substitui automaticamente os SVGs do app
- prepara uma trilha de migração gradual
- ainda não está pronto para substituir os assets atuais

## Estado de conclusão desta etapa

A documentação agora cobre:
- dependências
- estrutura
- comandos
- saídas da nova etapa estrutural
- style guide
- troubleshooting

Estado atual do ciclo:
- os dois exemplos obrigatórios (`favela-cluster` e `baile`) já foram fechados
- o próximo passo passa a ser iteração artística e integração com o catálogo do jogo
