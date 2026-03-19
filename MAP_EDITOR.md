# Map Editor — Plano Tecnico

Editor web WYSIWYG para o mapa isometrico do cs_rio.
Vive em `apps/editor/`, reutiliza `packages/game-engine`, roda no browser via `npm run dev`.

---

## Analise da Base Existente

O `packages/game-engine` e 100% TypeScript puro, sem dependencias de React Native.
Tudo reutilizavel no editor web:

| Modulo | Funcao |
|--------|--------|
| `tilemap-parser.ts` | `parseTilemap()` — parse do JSON Tiled |
| `tilemap-renderer.ts` | `buildRenderPlan()` — gera plano de rendering agnostico de plataforma |
| `coordinates.ts` | `cartToIso()`, `isoToCart()`, `screenToTile()` |
| `camera.ts` | Pan, zoom, bounds clamping, inercia |
| `depth-sort.ts` | Ordenacao de profundidade isometrica |
| `game-loop.ts` | Loop com `requestAnimationFrame` (funciona no browser) |

A abstracao central e o **`RenderPlan`**: o engine produz coordenadas de tela, cores, source rects — tudo agnostico.
O mobile consome com Skia. O editor consome com Canvas 2D. Mesmos dados, renderers diferentes.

### O que precisa ser portado do mobile

| Codigo mobile | O que faz | Equivalente web |
|---------------|-----------|-----------------|
| `geometry.ts` (`createDiamondPath`) | Cria paths Skia | `Path2D` ou `ctx.beginPath()` |
| `renderers.tsx` (`renderMapStructure`) | Renderiza estruturas via Skia | Canvas 2D draw calls |
| `GameCanvasScene.tsx` | Skia `<Canvas>` com matrix | `<canvas>` com `ctx.setTransform()` |
| `mapStructureSvgCatalog.ts` | `Skia.SVG.MakeFromString()` | `new Blob([svg])` + `Image()` |
| `useGameCamera.ts` / `useGameInput.ts` | Gestos RN + Reanimated | DOM events (wheel, pointer) |

### Stack do editor

| Proposito | Escolha | Motivo |
|-----------|---------|--------|
| Build | Vite | Ja no ecossistema, mais rapido |
| UI | React 18 | Ja no monorepo |
| State | Zustand | Ja usado no mobile |
| Rendering | Canvas 2D nativo | `RenderPlan` da tudo, zero deps |
| UI Components | Radix UI | Acessivel, sem estilo forcado |
| Icons | Lucide React | Leve |

Sem Pixi.js/Phaser/Three.js — diamantes preenchidos + imagens SVG e trivial para Canvas 2D.

---

## Fase 0 — Scaffolding

**Objetivo:** `apps/editor/` bootando no browser com imports do game-engine funcionando.

**O que fazer:**

1. Criar `apps/editor/` com Vite + React + TypeScript
2. `apps/editor/package.json` com deps: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@cs-rio/game-engine`
3. `apps/editor/tsconfig.json` estendendo o base do monorepo, com alias `@engine/*`
4. `apps/editor/vite.config.ts` com `resolve.alias` apontando para `packages/game-engine/src`
5. Registrar `apps/editor` no `workspaces` do `package.json` raiz
6. Extrair tipos compartilhados para pacote acessivel por ambos os apps:
   - `MapStructureKind`, `MapEntityKind` (hoje em `apps/mobile/src/data/mapRegionVisuals.ts`)
   - `MapStructureCatalog`, `getMapStructureDefinition()` (hoje em `mapStructureCatalog.ts`)
   - SVG markup catalog (strings puras, sem deps de RN)

**Validacao:** `turbo run build` e `turbo run typecheck` passam para todos os workspaces.

**Entregavel:** App vazio abrindo em `localhost:5173`, imports do game-engine resolvendo.

**Criterio de conclusao:** Importar `parseTilemap` e `cartToIso` do game-engine no editor sem erros.

---

## Fase 1 — Viewer Read-Only (Terreno)

**Objetivo:** Carregar `zona_norte.json`, renderizar o mapa isometrico com pan/zoom.

**Depende de:** Fase 0 concluida.

**Estrutura de arquivos:**

```
apps/editor/src/
  canvas/
    MapCanvas.tsx            <- <canvas> com resize handling
    CanvasRenderer.ts        <- Consome RenderPlan, desenha no Canvas 2D
    WebCameraController.ts   <- Wheel=zoom, drag=pan, wraps Camera class
    drawIsoDiamond.ts        <- Desenha diamante isometrico preenchido
  state/
    editorStore.ts           <- Zustand: mapa carregado, camera state
```

**Implementacao:**

1. **CanvasRenderer** consome `RenderPlan` do `TilemapRenderer.buildRenderPlan()`.
   Para cada `RenderTile`:
   - Desenha diamante: `ctx.beginPath()` -> 4 pontos -> `fill(color)` + `stroke()`
   - Se tileset PNG carregado: `ctx.drawImage(tilesetImg, sourceRect, destRect)`

2. **Camera transform**: `ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY)` antes de desenhar.
   Equivale ao `createCameraMatrix()` do mobile.

3. **WebCameraController**:
   - `wheel` -> `camera.zoomBy()` com ancora na posicao do cursor
   - `pointerdown`/`pointermove`/`pointerup` -> `camera.panBy()` (middle mouse ou shift+left)
   - Usa a classe `Camera` do game-engine sem modificacoes

4. **Tile hover**: `screenToTile(mousePos)` do `coordinates.ts` -> highlight no diamante sob o cursor.

5. **Game loop**: Usa `GameLoop` do game-engine. So redesenha quando camera muda (dirty flag).

**Performance:** Frustum culling do engine limita a ~2000-4000 tiles visiveis. Canvas 2D lida a 60fps.

**Entregavel:** Mapa inteiro visivel no browser, pan/zoom funcional, coordenada do tile no hover.

**Criterio de conclusao:** Navegar pelo mapa 200x200 com zoom fluido e ver tiles coloridos corretos.

---

## Fase 2 — Renderizacao de Estruturas

**Objetivo:** Mostrar estruturas (predios, favelas, bocas, etc.) sobre o terreno. WYSIWYG real.

**Depende de:** Fase 1 concluida (terreno renderizando).

**Implementacao:**

1. **Carregar SVGs** do catalogo como `HTMLImageElement`:
   ```ts
   const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
   const img = new Image();
   img.src = URL.createObjectURL(blob);
   // cachear em Map<MapStructureKind, HTMLImageElement>
   ```

2. **Posicionamento**: Portar calculo de `renderers.tsx` (Skia -> Canvas 2D):
   - `cartToIso(gridPos)` -> posicao de tela
   - `MapStructureDefinition.placement` -> offset/escala do sprite
   - Depth sort para ordem correta de desenho

3. **Desenhar estruturas** apos o terreno:
   - `ctx.drawImage(svgImage, spriteX, spriteY, spriteW, spriteH)` para cada estrutura

4. **Dados de estruturas**: Persistidos como objectgroup `structures` dentro do JSON Tiled
   (mesma convencao de `spawn_points` e `region_markers` — arquivo unico, zero desync).
   Cada estrutura e um objeto Tiled nativo:
   ```json
   {
     "name": "boca_principal",
     "type": "boca",
     "x": 3200,
     "y": 1600,
     "width": 256,
     "height": 128,
     "properties": [
       { "name": "kind", "type": "string", "value": "boca" },
       { "name": "footprintW", "type": "int", "value": 2 },
       { "name": "footprintH", "type": "int", "value": 1 }
     ]
   }
   ```
   O parser converte `x/y` pixels para coordenadas de grid.
   Interface interna do editor:
   ```ts
   interface EditorStructure {
     id: string;
     kind: MapStructureKind;
     gridX: number;
     gridY: number;
     footprint: { w: number; h: number };
     properties?: Record<string, string>;
   }
   ```

**Entregavel:** Mapa renderiza terreno + estruturas igual ao jogo.

**Criterio de conclusao:** Abrir o editor e ver o mapa como aparece no celular.

---

## Fase 3 — Edicao de Terreno (Paint)

**Objetivo:** Pintar terrain tiles clicando/arrastando no mapa.

**Depende de:** Fase 2 concluida (viewer completo com terreno + estruturas).

**Estrutura de arquivos:**

```
apps/editor/src/
  tools/
    ToolManager.ts           <- State machine do tool ativo
    PaintTool.ts             <- Brush: click/drag pinta tiles
    EraseTool.ts             <- Limpa tile (gid=0)
    EyedropperTool.ts        <- Pega tipo do tile clicado
  panels/
    ToolBar.tsx              <- Sidebar esquerda com tools
    TilePalette.tsx          <- 8 tipos de terreno com preview
    LayerPanel.tsx           <- Visibilidade e selecao de layer
  state/
    historyManager.ts        <- Undo/redo com command pattern
```

**Implementacao:**

1. **Mapa editavel**: Grid mutavel `Uint16Array(200*200)` sincronizado com o JSON raw.
   A cada edicao, patcha o array e re-roda `parseTilemap()` + `buildRenderPlan()`.
   Com 40K tiles, parsing leva <10ms.

2. **Paint tool**: `pointerdown` com tool ativo:
   - `screenToTile(mousePos)` -> coordenada do grid
   - `grid[y * width + x] = selectedGid`
   - Push undo entry: `{ tiles: [{x, y, oldGid, newGid}] }`
   - Re-render

3. **Brush modes**: 1x1, 3x3, 5x5, linha, retangulo. Todos produzem arrays de mudancas.

4. **Tile palette**: 8 diamantes coloridos com labels (grass, road, concrete, favela_roof, water, trees, civic, alley).

5. **Layer panel**: Toggle visibilidade de terrain/buildings/collision. Selecionar layer ativo.

6. **Undo/redo**: `Ctrl+Z` / `Ctrl+Shift+Z`. Command pattern com stack de operacoes.

**Entregavel:** Pintar terreno, ver mudancas ao vivo, undo/redo funcional.

**Criterio de conclusao:** Pintar uma estrada de um ponto a outro e desfazer com Ctrl+Z.

---

## Fase 4 — Placement de Estruturas

**Objetivo:** Colocar, mover e remover estruturas interativamente.

**Depende de:** Fase 3 concluida (edicao de terreno funcional, tools e panels existem).

**Estrutura de arquivos:**

```
apps/editor/src/
  tools/
    SelectTool.ts            <- Seleciona estrutura, drag para mover
    PlaceTool.ts             <- Coloca nova estrutura do catalogo
    DeleteTool.ts            <- Remove estrutura selecionada
  panels/
    StructureCatalog.tsx     <- Grid de 30+ estruturas por categoria
    PropertyPanel.tsx        <- Edita propriedades da estrutura selecionada
  canvas/
    SelectionOverlay.ts      <- Contorno de selecao, highlight de footprint
```

**Implementacao:**

1. **Placement tool**: Seleciona no catalogo -> ghost 50% opacidade segue cursor snap-to-grid -> click coloca.

2. **Selection tool**: Click -> hit test no footprint de cada estrutura. Selecionada mostra contorno de diamante.

3. **Move**: Drag da estrutura selecionada, snap to grid.

4. **Delete**: Tecla `Delete` ou botao remove a estrutura selecionada.

5. **Colisao visual**: Highlight vermelho se posicao conflita com outra estrutura.

6. **Catalogo**: 7 categorias (favela, clandestino, comercial, etc.) como tabs. Cada item mostra preview SVG + label.
   Reutiliza `MAP_STRUCTURE_CATALOG` do pacote compartilhado.

7. **Undo/redo**: Extende o `historyManager` com comandos de place/move/delete.

**Entregavel:** Edicao completa de estruturas: colocar do catalogo, mover, deletar.

**Criterio de conclusao:** Colocar uma boca-de-fumo no mapa, mover para outra posicao, desfazer.

---

## Fase 5 — Collision, Spawns e Regions

**Objetivo:** Editar as layers de dados (colisao, pontos de spawn, marcadores de regiao).

**Depende de:** Fase 4 concluida (sistema de tools e panels maduro).

**Implementacao:**

1. **Collision layer**:
   - Modo paint que toggle flag de colisao no tile
   - Overlay semi-transparente vermelho sobre tiles com colisao
   - Usa a layer `collision` existente no tilemap

2. **Spawn points**:
   - Click para colocar spawn point (renderiza como marcador com label)
   - Drag para mover
   - Painel de propriedades: nome, tipo
   - Mapeiam para a objectgroup `spawn_points` do JSON

3. **Region markers**:
   - Click para colocar/mover marcadores de regiao
   - Propriedades: nome, custom properties
   - Mapeiam para a objectgroup `region_markers` do JSON

4. **Toggles visuais**: Botoes na toolbar para mostrar/esconder cada overlay independentemente.

5. **Undo/redo**: Todos os comandos integrados no `historyManager`.

**Entregavel:** Edicao de todas as 5 layers do tilemap.

**Criterio de conclusao:** Pintar zona de colisao, colocar spawn point com nome, salvar e recarregar.

---

## Fase 6 — Export/Import (Round-trip)

**Objetivo:** Salvar/carregar JSON compativel com o jogo. Garantir round-trip perfeito.

**Depende de:** Fase 5 concluida (todas as layers editaveis).

**Implementacao:**

1. **Serializer** — converte estado do editor para JSON no formato exato do `parseTilemap()`:
   - Tile layers: reconstroi array `data` flat (200*200 = 40.000 entries) a partir do grid
   - Object layers: serializa spawn points e region markers no formato Tiled
   - Tilesets: preserva metadata inalterada
   - Estruturas: serializa para objectgroup `structures` no mesmo JSON (decisao fechada)

2. **Save**:
   - File System Access API (salva direto no disco, browsers modernos)
   - Fallback: download do JSON via `Blob` + `URL.createObjectURL()`

3. **Open**:
   - `<input type="file">` para selecionar JSON
   - Drag-and-drop no editor

4. **New map**:
   - Dialog: dimensoes (largura x altura), tileset padrao
   - Gera JSON vazio com layers obrigatorias

5. **Validacao no save**:
   - GIDs validos (existem no tileset)
   - Dimensoes consistentes
   - Layers obrigatorias presentes (terrain, collision, spawn_points, region_markers)

6. **Teste de integridade**: `parseTilemap(serialize(editorState))` deve produzir `ParsedTilemap` valido.

**Entregavel:** Round-trip completo: load JSON -> editar -> save JSON -> jogo carrega corretamente.

**Criterio de conclusao:** Editar mapa no editor, salvar, carregar no jogo mobile e ver as mudancas.

---

## Fase 7 — Polish e Qualidade de Vida

**Objetivo:** Features que tornam o editor pratico para uso diario.

**Depende de:** Fase 6 concluida (editor funcional com round-trip).

**Features (em ordem de prioridade):**

1. **Atalhos de teclado**: `B` brush, `E` eraser, `V` select, `I` eyedropper, `Space+drag` pan, `+`/`-` zoom, `Delete` remove
2. **Grid overlay**: Toggle de linhas isometricas sobre o mapa
3. **Minimap**: Overview do mapa 200x200 no canto. Click para navegar
4. **Dark theme**: Visual coerente com a estetica do jogo
5. **Auto-save**: Draft em `localStorage`, restaura ao reabrir
6. **Copy/paste de regioes**: Seleciona retangulo de tiles, copia, cola em outro lugar
7. **Export PNG**: Renderiza viewport atual ou mapa inteiro para PNG (documentacao)
8. **Rulers/coordinates**: Regua com coordenadas do grid nas bordas

---

## Fase 8 — Lazy Loading do Catalogo SVG

**Objetivo:** Reduzir o bundle JS do editor de ~33 MB para <1 MB eliminando o catalogo SVG monolitico
(`mapStructureSvgCatalog.generated.ts`, 34 MB de markup inline) do chunk principal.

**Depende de:** Fase 7 concluida (editor completo e funcional).

**Contexto do problema:**

O arquivo `packages/shared/src/map/generated/mapStructureSvgCatalog.generated.ts` contem todas as
markup SVGs das 30+ estruturas como strings em um unico modulo. No mobile isso e aceitavel (bundle
nativo empacota tudo). No editor web, o Vite empacota esse arquivo inteiro no JS principal, gerando
um bundle de 33.5 MB que o browser precisa baixar e parsear antes de renderizar qualquer coisa.

**Implementacao:**

### Etapa 8.1 — Separar SVGs em arquivos individuais

1. Criar diretorio `packages/shared/src/map/generated/svgs/`
2. Script de build que le `mapStructureSvgCatalog.generated.ts` e gera um arquivo `.svg` por kind:
   ```
   svgs/
     barraco.svg
     boca.svg
     hospital.svg
     factory.svg
     ...
   ```
3. Gerar indice `svgs/index.ts` que exporta apenas os nomes disponiveis (sem markup):
   ```ts
   export const AVAILABLE_SVG_KINDS: string[] = ['barraco', 'boca', 'hospital', ...];
   ```
4. O script deve ser idempotente e integravel no pipeline de build (`turbo run generate`).

### Etapa 8.2 — Loader async no editor

1. Substituir o import estatico do catalogo por um loader que busca SVGs sob demanda:
   ```ts
   async function loadStructureSvg(kind: MapStructureKind): Promise<string> {
     const module = await import(`@shared/map/generated/svgs/${kind}.svg?raw`);
     return module.default;
   }
   ```
   O `?raw` do Vite retorna o conteudo como string sem processar.

2. Atualizar `useStructureImageCatalog.ts`:
   - Ao iniciar, carregar apenas os kinds presentes no mapa atual (via `map.structures`)
   - Ao colocar uma estrutura nova do catalogo, carregar o SVG sob demanda se ainda nao cacheado
   - Manter o cache `Map<MapStructureKind, HTMLImageElement>` — carregou uma vez, nao carrega de novo

3. Loading state: Enquanto um SVG nao carregou, renderizar placeholder (diamante com borda tracejada + label do kind).

### Etapa 8.3 — Code-split do catalogo de definicoes

1. Separar `structureCatalog.ts` (definicoes, paletas, footprints) do catalogo SVG.
   As definicoes sao leves (~10 KB) e podem continuar no bundle principal.
   Apenas a markup SVG deve ser lazy.

2. O `StructureCatalog.tsx` (painel do editor) deve mostrar previews SVG carregados sob demanda:
   - Ao expandir uma categoria, dispara load dos SVGs daquela categoria
   - Preview aparece quando o SVG estiver pronto
   - Antes disso, mostra placeholder com as cores da paleta da estrutura

### Etapa 8.4 — Manter compatibilidade com o mobile

1. O mobile continua importando `mapStructureSvgCatalog.generated.ts` normalmente (sem mudanca).
2. O script da etapa 8.1 gera os arquivos individuais **a partir** do catalogo gerado — nao substitui.
3. Os dois formatos coexistem: monolitico para mobile, individual para editor.

### Etapa 8.5 — Validacao

1. Build do editor: `npx vite build` deve produzir chunk principal < 1 MB (gzip).
   SVGs individuais ficam como chunks separados carregados sob demanda.
2. O mobile nao deve ser afetado: `turbo run typecheck` e `turbo run build` passam para ambos os apps.
3. Teste funcional: abrir editor, verificar que estruturas aparecem no mapa e no catalogo apos loading.

**Entregavel:** Bundle JS principal do editor < 1 MB. SVGs carregados sob demanda. Nenhuma regressao no mobile.

**Criterio de conclusao:** `npx vite build` mostra chunk principal < 500 KB gzip. Estruturas renderizam
corretamente no editor apos lazy load. Mobile continua buildando sem mudancas.

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Performance com 200x200 tiles no Canvas 2D | Frustum culling ja limita a ~2000-4000 tiles visiveis. Canvas 2D lida trivialmente |
| Qualidade de SVGs no Canvas | Rasterizar cada SVG para `Image` em 2x resolucao, cachear |
| Compatibilidade do JSON exportado com o jogo | Teste automatizado: `parseTilemap(serialize(state))` valida o round-trip |
| Dados de estruturas nao existem no JSON atual | Decisao fechada: objectgroup `structures` no mesmo JSON. Atualizar `parseTilemap()` para extrair essa layer |
| Catalogo SVG gerado e muito grande (arquivo monolitico) | Fase 8: lazy loading com SVGs individuais + import dinamico via Vite `?raw` |

---

## Regra de Progressao

Cada fase depende estritamente da anterior. A ordem e sequencial e inviolavel:

```
Fase 0 (scaffolding)
  -> Fase 1 (viewer terreno)
    -> Fase 2 (viewer estruturas)
      -> Fase 3 (editar terreno)
        -> Fase 4 (editar estruturas)
          -> Fase 5 (editar collision/spawns/regions)
            -> Fase 6 (export/import)
              -> Fase 7 (polish)
                -> Fase 8 (lazy loading SVG — otimizacao de bundle)
```

Nao se avanca para a proxima fase ate a atual estar concluida e validada pelo criterio de conclusao.
