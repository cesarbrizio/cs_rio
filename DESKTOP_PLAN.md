# CS Rio Desktop — Plano Técnico v2

Plano para criar `apps/desktop` dentro do monorepo `cs_rio`, empacotando o jogo para distribuição desktop via **Electron + Vite + React**.

**Meta primária:** Desktop interno jogável (smoke test completo sem integração com lojas).
**Meta secundária:** Produto publicado em Steam, GOG e/ou Epic Games Store.

---

## Decisões Arquiteturais

### Por que Electron?

| Critério | Electron | Tauri | Neutralino |
|---|---|---|---|
| Maturidade para jogos | Alta (vários títulos publicados) | Média | Baixa |
| Steam SDK (Node bindings) | Maduro (`steamworks.js`) | Experimental | Inexistente |
| GOG / Epic SDK | Bindings Node disponíveis | Requer FFI Rust | N/A |
| Ecossistema React | Nativo | Bom | Limitado |
| Tamanho do binário | ~150 MB | ~10 MB | ~5 MB |
| Auto-update | `electron-updater` (maduro) | Tauri updater (bom) | Manual |
| Cross-platform | Win/Mac/Linux | Win/Mac/Linux | Win/Mac/Linux |

Electron é a escolha mais segura para distribuição em lojas de jogos. O tamanho maior do binário é aceitável para desktop.

### Modelo de processo: IPC-first desde o dia 1

O Electron roda dois processos: **main** (Node.js) e **renderer** (Chromium).
Com `contextIsolation: true` e `sandbox: true`, o renderer **não tem acesso a Node.js**.
Toda comunicação entre renderer e recursos nativos passa por IPC via `preload.ts`.

Isso é obrigatório desde a Fase 1 porque:
- Storage (`electron-store`) roda no main process
- Notificações nativas são API do main process
- Tray, menu, auto-update, SDKs de loja — tudo no main process
- Segurança: renderer exposto a conteúdo web não deve ter acesso direto a filesystem

**Arquitetura:**

```
┌─────────────────────────┐       IPC bridge        ┌─────────────────────────┐
│     MAIN PROCESS        │ ◄────(preload.ts)────► │    RENDERER PROCESS     │
│                         │                         │                         │
│  electron-store         │  contextBridge.expose   │  React + Vite           │
│  Notification API       │  ───────────────────►   │  Zustand stores         │
│  Tray / Menu            │  window.electronAPI     │  PixiJS / Canvas        │
│  Auto-updater           │                         │  Axios / Colyseus       │
│  Steamworks SDK         │                         │                         │
└─────────────────────────┘                         └─────────────────────────┘
```

O `preload.ts` expõe um objeto tipado `window.electronAPI` com métodos como:

```typescript
interface ElectronAPI {
  // Storage (main process: electron-store)
  storage: {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
  }
  // Notificações (main process: Electron Notification)
  notify: {
    show(title: string, body: string): Promise<void>
    requestPermission(): Promise<boolean>
  }
  // Window controls
  window: {
    minimize(): void
    maximize(): void
    close(): void
    setFullscreen(on: boolean): void
  }
}
```

O renderer **nunca** importa `electron`, `electron-store` ou qualquer módulo Node.
Axios e `colyseus.js` rodam no renderer normalmente (são HTTP/WS puros).

### Estratégia de rendering: POC Canvas 2D → PixiJS

O editor (`apps/editor`) já tem um renderer Canvas 2D funcional:
- `CanvasRenderer.ts` (449 linhas) — rendering isométrico com tileset, depth sort, câmera
- `WebCameraController.ts` (169 linhas) — pan (middle-click/space+drag), zoom (scroll)
- `MapCanvas.tsx` (467 linhas) — integração React + game loop + dirty flag

Este código já consome `@engine/tilemap-renderer`, `@engine/camera`, `@engine/coordinates` e `@engine/game-loop` — os mesmos módulos que o mobile usa.

**Estratégia em duas etapas:**

1. **Fase 3A — POC com Canvas 2D** baseado no editor: validar assets, input, `RenderPlan` e integração com game-engine no contexto desktop sem depender de lib nova.

2. **Fase 3B — Migração para PixiJS** se Canvas 2D não atender a performance com muitas entidades (jogadores remotos, animações, partículas). Se Canvas 2D for suficiente, pular 3B.

| Critério de decisão | Ficar com Canvas 2D | Migrar para PixiJS |
|---|---|---|
| FPS com 50+ entidades animadas | >= 60 FPS | < 60 FPS |
| Complexidade de sprite batching | Não necessário | Necessário |
| Partículas e efeitos visuais | Sem necessidade imediata | Roadmap exige |

### Escopo real do acoplamento mobile

Investigação do código atual revela acoplamento maior do que `services/` e `stores/`:

**Storage (8 pontos de acoplamento com `expo-secure-store`):**

| Módulo | Uso | Max items |
|---|---|---|
| `stores/authStore.ts` | tokens JWT (access + refresh) | 2 keys |
| `features/private-message-storage.ts` | IDs de mensagens vistas | 120 |
| `features/sabotage-storage.ts` | IDs de sabotagens vistas | 100 |
| `features/event-result-storage.ts` | IDs de eventos vistos | 80 |
| `features/activity-result-storage.ts` | IDs de atividades vistas | 80 |
| `features/tribunal-result-storage.ts` | IDs de tribunais vistos | 80 |
| `features/territory-loss-storage.ts` | IDs de perdas vistas | 80 |
| `features/war-result-storage.ts` | IDs de guerras vistas | 60 |

Todos seguem o mesmo padrão via helper `features/storage.ts` (`parseStoredStringArray`, `warnStorageFallback`).

**Ambiente (2 módulos Expo-dependentes):**
- `config/env.ts` — importa `expo-constants` e `NativeModules` para detectar host em dev
- `config/env-resolver.ts` — fallback chain: `expoHostUri` → `debuggerHost` → `scriptUrl`

**Notificações (superfície muito maior que show/requestPermission):**
- 12 métodos exportados pelo `NotificationProvider`: `notifyAttack`, `notifyAsyncActivity`, `notifyEvent`, `notifyEventResult`, `notifyFactionPromotion`, `notifyPrivateMessage`, `notifySabotageCue`, `notifyTerritoryLoss`, `notifyTribunalCue`, `notifyWarResult`, `requestNotificationPermissions`, `syncTimerNotifications`
- Scheduling com deduplicação via `scheduledIdsRef` Map
- Tracking de entregues via `deliveredIdsRef` Set
- Canal Android com vibration pattern, light color, importância
- Lazy-load via `require('expo-notifications')` com fallback

**Outros acoplamentos Expo:**
- `expo-haptics` — 6 métodos em `utils/haptics.ts`
- `expo-av` — Audio playback em `audio/AudioProvider.tsx`
- `expo-status-bar` — em `navigation/RootNavigator.tsx`

**API client:**
- `services/api.ts` importa `config/env` (Expo-dependente) e `features/mobile-observability`
- Singleton inicializado no import com `appEnv.apiUrl` — sem reconfigurabilidade

**Hooks de cena:**
- `useHomeMapScene.ts` depende de: `data/mapRegionVisuals`, `data/mapStructureCatalog`, `data/zonaNortePrototypeMap`, `services/colyseus`, `theme/colors`, `home/homeHelpers`, `home/homeTypes`

### Arquitetura de pacotes compartilhados (3 camadas)

Em vez de um único `packages/services`, a extração se organiza em 3 camadas:

```
packages/
├── shared/              # (já existe) Tipos, enums, constantes de domínio
├── game-engine/         # (já existe) Tilemap, câmera, pathfinding, animação
├── platform/            # (novo) Contratos de plataforma + adaptadores
│   ├── src/
│   │   ├── contracts/   # interfaces (StoragePort, NotifyPort, AudioPort, EnvPort, HapticsPort)
│   │   ├── mobile/      # implementações expo-*
│   │   └── desktop/     # implementações electron IPC
│   └── package.json
├── domain/              # (novo) Lógica de negócio pura, sem React e sem plataforma
│   ├── src/
│   │   ├── api/         # createApiClient factory + todos endpoints
│   │   ├── realtime/    # ColyseusService
│   │   ├── stores/      # Zustand stores (recebem ports via factory)
│   │   ├── features/    # seen-tracking, polling, timers
│   │   ├── data/        # mapRegionVisuals, mapStructureCatalog, map data
│   │   └── notify/      # NotificationOrchestrator (lógica dos 12 métodos, sem expo)
│   └── package.json
└── ui/                  # (novo, fase 5) Hooks + view-models React reutilizáveis
    ├── src/
    │   ├── hooks/       # useHomeMapScene, useHomeHudController, etc.
    │   ├── view-models/ # lógica de apresentação sem componentes visuais
    │   └── providers/   # NotificationProvider, AudioProvider (abstratos)
    └── package.json
```

**Por que 3 camadas e não 1:**
- `packages/platform` pode ser substituído inteiro por plataforma, sem tocar em lógica
- `packages/domain` é testável sem React e sem plataforma
- `packages/ui` permite que mobile e desktop compartilhem hooks React sem compartilhar componentes visuais

**Regra de dependência (unidirecional):**
```
ui → domain → platform → shared
ui → game-engine
```

### Contrato com o backend

**CORS — modelo desktop:**

O backend (`cs_rio_api/src/config/cors.ts`) em dev aceita localhost e IPs privados automaticamente.
Em produção exige `CORS_ALLOWED_ORIGINS` explícito.

Electron em dev serve via Vite em `http://localhost:5173` — **já coberto** pelo regex de dev.
Electron em produção carrega de `file://` — que **não é suportado** pelo CORS atual.

**Solução:** Registrar custom protocol `csrio://` no Electron (via `protocol.registerSchemesAsPrivileged`).
Em produção, adicionar `csrio://` ao `CORS_ALLOWED_ORIGINS`. Em dev, continuar com localhost.

```typescript
// electron/main.ts
protocol.registerSchemesAsPrivileged([
  { scheme: 'csrio', privileges: { standard: true, secure: true, corsEnabled: true } }
])
```

**Mudanças necessárias no backend:**
1. `CORS_ALLOWED_ORIGINS` em produção incluir a origem desktop (ex: `csrio://app` ou a URL do auto-updater)
2. Nenhuma mudança no código de CORS — ele já aceita origens explícitas

**Variáveis de ambiente desktop:**
```env
VITE_API_URL=http://localhost:3000     # dev
VITE_WS_URL=ws://localhost:2567        # dev
VITE_APP_ENV=development
```

Em produção, injetadas no build ou lidas de arquivo de configuração local.

**Fonte de verdade do `@cs-rio/shared`:**

Hoje existem **duas cópias** independentes: `cs_rio/packages/shared/` e `cs_rio_api/packages/shared/`.
Os arquivos core (`types.ts`, `constants.ts`, `validation.ts`, `messages.ts`) são idênticos.
O frontend tem módulos extras em `map/` (client-only: catálogo de estruturas, SVGs).

**Decisão:** O `cs_rio/packages/shared/` é a fonte de verdade. Sincronização com `cs_rio_api` deve ser formalizada (script de sync ou git subtree). Isso está fora do escopo deste plano, mas é um risco de drift que deve ser endereçado em paralelo.

---

## Fases

### Fase 1 — Scaffold do `apps/desktop` com IPC-first

**Objetivo:** Janela Electron rodando React via Vite, com bridge IPC funcional para storage e notificações.

**Entregas:**

1. Criar `apps/desktop/` com a seguinte estrutura:
   ```
   apps/desktop/
   ├── electron/
   │   ├── main.ts              # processo principal
   │   ├── preload.ts           # contextBridge expondo electronAPI
   │   ├── ipc/
   │   │   ├── storage.ipc.ts   # handlers de storage (electron-store)
   │   │   ├── notify.ipc.ts    # handlers de notificação
   │   │   └── window.ipc.ts    # handlers de controle de janela
   │   └── tsconfig.json
   ├── src/
   │   ├── App.tsx
   │   ├── main.tsx
   │   ├── electron-api.d.ts    # tipagem de window.electronAPI
   │   └── index.html
   ├── package.json
   ├── tsconfig.json
   ├── vite.config.ts
   └── electron-builder.yml
   ```

2. Configurar `package.json` do workspace:
   - Nome: `@cs-rio/desktop`
   - Deps: `react`, `react-dom`
   - DevDeps: `electron`, `electron-builder`, `vite`, `@vitejs/plugin-react`, `vite-plugin-electron`, `electron-store`
   - Workspace refs: `@cs-rio/shared`, `@cs-rio/game-engine`

3. Registrar workspace no `package.json` raiz:
   ```json
   "workspaces": ["apps/editor", "apps/mobile", "apps/desktop", "packages/*"]
   ```

4. `tsconfig.json` estendendo `../../tsconfig.base.json`:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["src/*"],
         "@shared/*": ["../../packages/shared/src/*"],
         "@engine/*": ["../../packages/game-engine/src/*"]
       }
     }
   }
   ```

5. Electron `main.ts`:
   - `BrowserWindow` 1280x720, `contextIsolation: true`, `sandbox: true`
   - Registrar custom protocol `csrio://` via `protocol.registerSchemesAsPrivileged`
   - Carregar Vite dev server (dev) ou `csrio://app/index.html` (prod)
   - Registrar handlers IPC para storage, notify e window

6. `preload.ts` — bridge tipado:
   ```typescript
   contextBridge.exposeInMainWorld('electronAPI', {
     storage: {
       getItem: (key: string) => ipcRenderer.invoke('storage:get', key),
       setItem: (key: string, val: string) => ipcRenderer.invoke('storage:set', key, val),
       removeItem: (key: string) => ipcRenderer.invoke('storage:remove', key),
     },
     notify: {
       show: (title: string, body: string) => ipcRenderer.invoke('notify:show', title, body),
       requestPermission: () => ipcRenderer.invoke('notify:request-permission'),
     },
     window: {
       minimize: () => ipcRenderer.send('window:minimize'),
       maximize: () => ipcRenderer.send('window:maximize'),
       close: () => ipcRenderer.send('window:close'),
       setFullscreen: (on: boolean) => ipcRenderer.send('window:fullscreen', on),
     },
   })
   ```

7. `electron-api.d.ts` — tipagem global para o renderer:
   ```typescript
   declare global {
     interface Window {
       electronAPI: ElectronAPI
     }
   }
   ```

8. `App.tsx` mínimo que testa storage e notify:
   ```tsx
   // Ao montar: window.electronAPI.storage.setItem('test', 'ok')
   // Botão: window.electronAPI.notify.show('CS Rio', 'Desktop funcionando!')
   ```

9. Scripts:
   ```json
   {
     "dev": "vite",
     "dev:electron": "vite build && electron .",
     "build": "vite build && electron-builder",
     "typecheck": "tsc --noEmit",
     "lint": "eslint src/ electron/"
   }
   ```

10. Registrar tasks no `turbo.json` raiz.

**Critério de conclusão:**
- Janela Electron abre com React renderizado.
- Storage IPC funciona (setItem/getItem persiste entre reinícios).
- Notificação nativa desktop dispara ao clicar botão.
- `contextIsolation` e `sandbox` ativos — nenhum import de `electron` no renderer.

---

### Fase 2 — Pacote `packages/platform`: contratos e adaptadores

**Objetivo:** Definir as interfaces de plataforma e criar implementações para mobile e desktop, sem mover nenhuma lógica de negócio ainda.

**Motivação:** Fazer isso antes da extração de domain/services permite testar os adaptadores isoladamente e não quebrar o mobile prematuramente.

**Entregas:**

1. Criar `packages/platform/`:
   ```
   packages/platform/
   ├── src/
   │   ├── contracts/
   │   │   ├── storage.port.ts       # StoragePort interface
   │   │   ├── notify.port.ts        # NotifyPort interface
   │   │   ├── audio.port.ts         # AudioPort interface
   │   │   ├── env.port.ts           # EnvPort interface
   │   │   ├── haptics.port.ts       # HapticsPort interface (noop no desktop)
   │   │   └── index.ts
   │   ├── mobile/
   │   │   ├── expo-storage.adapter.ts
   │   │   ├── expo-notify.adapter.ts
   │   │   ├── expo-audio.adapter.ts
   │   │   ├── expo-env.adapter.ts
   │   │   ├── expo-haptics.adapter.ts
   │   │   └── index.ts
   │   ├── desktop/
   │   │   ├── electron-storage.adapter.ts
   │   │   ├── electron-notify.adapter.ts
   │   │   ├── web-audio.adapter.ts
   │   │   ├── vite-env.adapter.ts
   │   │   ├── noop-haptics.adapter.ts
   │   │   └── index.ts
   │   └── index.ts
   ├── package.json
   └── tsconfig.json
   ```

2. `StoragePort` — cobrindo os 8 pontos de acoplamento reais:
   ```typescript
   export interface StoragePort {
     getItem(key: string): Promise<string | null>
     setItem(key: string, value: string): Promise<void>
     removeItem(key: string): Promise<void>
   }
   ```
   - Mobile impl: thin wrapper sobre `expo-secure-store` (`getItemAsync`, `setItemAsync`, `deleteItemAsync`)
   - Desktop impl: thin wrapper sobre `window.electronAPI.storage` (IPC)

3. `NotifyPort` — cobrindo a superfície real das notificações:
   ```typescript
   export interface NotifyPort {
     /** Dispara notificação imediata */
     show(opts: { id: string; title: string; body: string }): Promise<void>
     /** Agenda notificação futura */
     schedule(opts: {
       id: string; title: string; body: string; triggerAt: Date
     }): Promise<void>
     /** Cancela notificação agendada */
     cancel(id: string): Promise<void>
     /** Cancela todas as agendadas */
     cancelAll(): Promise<void>
     /** Solicita permissão */
     requestPermission(): Promise<boolean>
     /** Verifica se permissão foi concedida */
     hasPermission(): Promise<boolean>
   }
   ```
   - Mobile impl: encapsula `expo-notifications` (channels, scheduling, dedup)
   - Desktop impl: encapsula `Electron.Notification` + tray balloons via IPC

4. `AudioPort`:
   ```typescript
   export interface AudioPort {
     playSfx(key: string): Promise<void>
     playMusic(key: string, opts?: { loop?: boolean; volume?: number }): Promise<void>
     stopMusic(): Promise<void>
     setMusicVolume(v: number): void
     setSfxVolume(v: number): void
   }
   ```
   - Mobile impl: `expo-av`
   - Desktop impl: `howler.js` (roda no renderer, sem IPC)

5. `EnvPort`:
   ```typescript
   export interface EnvPort {
     apiUrl: string
     wsUrl: string
     appEnv: 'development' | 'staging' | 'production'
   }
   ```
   - Mobile impl: resolve via `expo-constants` + `NativeModules` (chain existente)
   - Desktop impl: resolve via `import.meta.env.VITE_*`

6. `HapticsPort`:
   ```typescript
   export interface HapticsPort {
     light(): void
     medium(): void
     heavy(): void
     selection(): void
     success(): void
     error(): void
   }
   ```
   - Mobile impl: `expo-haptics`
   - Desktop impl: noop (desktop não tem haptics)

7. Testar adaptadores isoladamente:
   - Mobile: integrar `expo-storage.adapter` no `authStore` existente **sem mover o store**
   - Desktop: testar storage adapter via IPC no app da Fase 1

**Critério de conclusão:**
- `packages/platform` publicado no workspace com tipagem correta.
- Adaptador mobile de storage funciona no `authStore` sem regressão.
- Adaptador desktop de storage persiste e lê dados via IPC.
- Testes unitários para cada adapter (mocking IPC e expo).

---

### Fase 3 — Pacote `packages/domain`: extração de lógica de negócio

**Objetivo:** Mover serviços, stores e features do mobile para um pacote compartilhado agnóstico de plataforma.

**Estratégia:** Mover módulo por módulo, com o mobile consumindo do novo pacote após cada extração. Não mover tudo de uma vez — testar regressão a cada passo.

**Entregas (em ordem de extração):**

1. **Criar `packages/domain/` com scaffold vazio:**
   ```
   packages/domain/
   ├── src/
   │   ├── api/
   │   ├── realtime/
   │   ├── stores/
   │   ├── features/
   │   ├── data/
   │   └── notify/
   ├── package.json    # deps: @cs-rio/shared, @cs-rio/platform, axios, colyseus.js, zustand
   └── tsconfig.json
   ```

2. **Extrair API client** (`api/`):
   - Mover `services/api.ts` para `packages/domain/src/api/client.ts`
   - Factory: `createApiClient(env: EnvPort, storage: StoragePort)` retorna instância Axios configurada
   - Mover todos os módulos de endpoints intactos (são funções puras que recebem `AxiosInstance`)
   - Remover import de `config/env` e `features/mobile-observability`
   - Mobile: importa de `@cs-rio/domain/api`, injeta `expoEnv` e `expoStorage`
   - Desktop: importa de `@cs-rio/domain/api`, injeta `viteEnv` e `electronStorage`
   - **Testar:** Login funciona no mobile após troca

3. **Extrair ColyseusService** (`realtime/`):
   - Mover `services/colyseus.ts` para `packages/domain/src/realtime/`
   - Parametrizar `wsUrl` via `EnvPort` (em vez de import estático de `config/env`)
   - **Testar:** Conexão realtime funciona no mobile

4. **Extrair Zustand stores** (`stores/`):
   - Mover `authStore.ts` — recebe `StoragePort` via factory pattern:
     ```typescript
     export function createAuthStore(storage: StoragePort, api: ApiClient) {
       return create<AuthState>((set, get) => ({
         // ... toda lógica, usando storage.getItem/setItem em vez de SecureStore
       }))
     }
     ```
   - Mover `appStore.ts`, `uiStore.ts`, `inventoryStore.ts`, `eventFeedStore.ts`, `audioStore.ts`, `tutorialStore.ts`, `notificationStore.ts`
   - **Testar:** Cada store extraída + smoke test mobile após cada uma

5. **Extrair features de seen-tracking** (`features/`):
   - Mover `features/storage.ts` (helpers: `parseStoredStringArray`, `warnStorageFallback`)
   - Mover os 7 módulos `*-storage.ts` — todos recebem `StoragePort` via parâmetro
   - **Testar:** Notificações não reaparecem para eventos já vistos

6. **Extrair dados de mapa** (`data/`):
   - Mover `data/mapRegionVisuals.ts`, `data/mapStructureCatalog.ts`, `data/zonaNortePrototypeMap.ts`
   - Mover `theme/colors.ts` (usado pelo mapa)
   - Mover `screens/home/homeHelpers.ts`, `screens/home/homeTypes.ts`
   - Estes são dados puros sem dependência de plataforma

7. **Extrair NotificationOrchestrator** (`notify/`):
   - Criar `NotificationOrchestrator` com a lógica dos 12 métodos, recebendo `NotifyPort`
   - Scheduling, deduplicação e tracking — lógica pura
   - Separar a lógica de decisão (quando notificar) da entrega (como notificar)
   - Mobile e desktop injetam seus respectivos `NotifyPort`
   - **Testar:** Todos os 12 tipos de notificação funcionam no mobile

**Critério de conclusão:**
- `apps/mobile/src/services/` e `apps/mobile/src/stores/` importam de `@cs-rio/domain`
- `apps/mobile/src/features/*-storage.ts` importam de `@cs-rio/domain`
- Smoke test completo do mobile passa (login, crimes, mercado, facção, território)
- Zero import de `expo-*` dentro de `packages/domain/`

---

### Fase 4 — Renderer desktop: POC Canvas 2D + avaliação PixiJS

**Objetivo:** Renderizar o mapa isométrico no desktop, partindo do renderer existente no editor.

**Fase 4A — POC Canvas 2D (baseado no editor)**

Partindo de `apps/editor/src/canvas/`:

1. **Copiar e adaptar** para `apps/desktop/src/renderer/`:
   ```
   renderer/
   ├── CanvasRenderer.ts      # baseado em editor/CanvasRenderer.ts
   │                          # remover overlays de editor (collision, grid, selection, hover)
   │                          # adicionar rendering de entidades (jogadores, NPCs)
   ├── CameraController.ts    # baseado em editor/WebCameraController.ts
   │                          # adicionar WASD pan, space-to-center, smooth zoom
   ├── EntityRenderer.ts      # NOVO: renderizar jogadores remotos + local
   ├── SpriteCache.ts         # NOVO: cache de tilesets e spritesheets
   ├── drawIsoDiamond.ts      # copiar do editor (utilitário puro)
   └── types.ts               # tipos locais do renderer
   ```

2. **Criar componente React `<GameCanvas />`:**
   - Montar canvas element com `ResizeObserver`
   - Instanciar `GameLoop` do `@engine/game-loop`
   - Instanciar `CanvasRenderer` e `CameraController`
   - Dirty flag pattern (como no editor `MapCanvas.tsx`)
   - Receber `ParsedTilemap` e `CameraState` como props

3. **Integrar com game-engine:**
   - `parseTilemap(zonaNorteMapData)` para gerar mapa
   - `tilemapRenderer.buildRenderPlan(map, camera)` para gerar `RenderPlan`
   - `camera.ts` para estado de câmera (zoom, pan, follow)
   - `coordinates.ts` para conversões cartesiano ↔ isométrico

4. **Adicionar rendering de entidades:**
   - Jogador local: posição do store
   - Jogadores remotos: snapshot do Colyseus
   - Renderizar como sprites ou formas simples inicialmente

5. **Input desktop:**
   - Mouse wheel → zoom
   - Middle-click drag ou Space+drag → pan
   - WASD → pan contínuo
   - Espaço → centralizar no jogador
   - Click em tile → mover jogador (pathfinding via `@engine/pathfinding`)

6. **Benchmark de performance:**
   - Medir FPS com 0, 10, 50, 100 entidades animadas
   - Medir tempo de frame para mapa completo
   - Testar em hardware integrado (Intel UHD) e dedicado

**Fase 4B — Migração para PixiJS (condicional)**

Executar **somente se** Canvas 2D não atingir 60 FPS com a carga esperada.

1. Instalar `pixi.js ^8.x`
2. Substituir `CanvasRenderer` por `PixiRenderer`:
   - `PIXI.Application` com WebGL backend
   - `PIXI.Container` com `sortableChildren` para depth sort
   - `PIXI.Spritesheet` para tilesets
   - `ParticleContainer` para tiles estáticos
3. Manter a mesma interface: recebe `RenderPlan`, `CameraState`, entidades
4. `GameCanvas` troca a instância interna sem mudar API

**Critério de conclusão:**
- Mapa isométrico da Zona Norte renderiza no desktop.
- Câmera responde a mouse e teclado.
- Jogador local visível e movível.
- FPS medido e decisão Canvas 2D vs PixiJS documentada.

---

### Fase 5 — Pacote `packages/ui`: hooks e view-models compartilhados

**Objetivo:** Extrair hooks React reutilizáveis do mobile para que desktop e mobile compartilhem lógica de apresentação.

**Motivação:** Hooks como `useHomeMapScene` e `useHomeHudController` contêm lógica de apresentação complexa (45KB no caso do HUD). Reescrever do zero para desktop seria duplicação massiva. Mas eles dependem de módulos locais do mobile, então precisam ser extraídos com suas dependências (que agora vivem em `@cs-rio/domain`).

**Entregas:**

1. **Criar `packages/ui/`:**
   ```
   packages/ui/
   ├── src/
   │   ├── hooks/
   │   │   ├── useHomeMapScene.ts       # deps: @cs-rio/domain/data, @engine/*
   │   │   ├── useHomeHudController.ts  # deps: @cs-rio/domain/stores, /api
   │   │   ├── useCrimesController.ts
   │   │   ├── useMarketController.ts
   │   │   ├── useInventoryController.ts
   │   │   ├── useFactionController.ts
   │   │   ├── useTerritoryController.ts
   │   │   └── ...demais controllers
   │   ├── providers/
   │   │   ├── PlatformContext.tsx       # injeção dos ports no React tree
   │   │   ├── NotificationProvider.tsx  # orquestra NotificationOrchestrator
   │   │   ├── AudioProvider.tsx         # orquestra AudioPort
   │   │   └── PollManager.tsx           # polling de eventos
   │   └── index.ts
   ├── package.json   # deps: @cs-rio/domain, @cs-rio/platform, @cs-rio/game-engine, react, zustand
   └── tsconfig.json
   ```

2. **Extrair `useHomeMapScene`:**
   - Mover de `apps/mobile/src/screens/home/useHomeMapScene.ts`
   - Imports agora apontam para `@cs-rio/domain/data` (mapRegionVisuals, mapStructureCatalog, etc.)
   - Imports de `@engine/*` já funcionam
   - Retorna `ParsedTilemap`, `RenderPlan`, entidades — dados puros que qualquer renderer consome

3. **Extrair `useHomeHudController`:**
   - Mover de `apps/mobile/src/screens/home/useHomeHudController.ts`
   - Imports de stores apontam para `@cs-rio/domain/stores`
   - Imports de API apontam para `@cs-rio/domain/api`
   - Retorna ações e estado derivado — sem componente visual

4. **Extrair controllers das telas core** (Crimes, Market, Inventory, Profile, Map, Faction, Territory):
   - Mesmo padrão: mover lógica de hook, re-apontar imports

5. **Criar `PlatformContext`:**
   ```tsx
   const PlatformContext = createContext<PlatformPorts>(null!)

   export function PlatformProvider({ ports, children }: Props) {
     return <PlatformContext.Provider value={ports}>{children}</PlatformContext.Provider>
   }

   export function usePlatform() {
     return useContext(PlatformContext)
   }
   ```
   - Mobile injeta `{ storage: expoStorage, notify: expoNotify, audio: expoAudio, ... }`
   - Desktop injeta `{ storage: electronStorage, notify: electronNotify, audio: webAudio, ... }`

6. **Atualizar mobile** para consumir `@cs-rio/ui`:
   - Telas mobile importam hooks de `@cs-rio/ui/hooks`
   - Providers wrappam o app mobile
   - Componentes visuais permanecem locais no mobile

**Critério de conclusão:**
- `apps/mobile` funciona com hooks importados de `@cs-rio/ui`
- `apps/desktop` consegue usar `useHomeMapScene` e obter `RenderPlan`
- Zero import de `react-native` ou `expo-*` dentro de `packages/ui/`

---

### Fase 6 — UI desktop, navegação e fluxo de auth

**Objetivo:** Componentes de UI desktop, navegação entre telas e fluxo completo de auth.

**Entregas:**

1. **React Router** para navegação:
   ```
   /login          → LoginScreen
   /register       → RegisterScreen
   /create-char    → CharacterCreationScreen
   /home           → HomeScreen
   /crimes         → CrimesScreen
   /market         → MarketScreen
   ...etc
   ```

2. **Layouts desktop** (`apps/desktop/src/layouts/`):
   - `AuthLayout.tsx` — centralizado, background temático
   - `GameLayout.tsx` — sidebar fixa + área de conteúdo + HUD overlay
   - `FullscreenLayout.tsx` — mapa/combate sem sidebar

3. **Componentes base** (`apps/desktop/src/components/ui/`):
   - Button, Input, Modal, Card, Badge, ProgressBar, Tabs, Toast
   - Desktop-specific: Tooltip (hover), ContextMenu (right-click), Sidebar

4. **Sistema de estilos:**
   - CSS Modules ou Tailwind (decisão na implementação)
   - Tema visual consistente com mobile (cores, fontes, tom)
   - Responsivo 1024px a 2560px

5. **Sidebar de navegação:**
   ```
   ┌──────────────────────────────────────────┐
   │  SIDEBAR  │        CONTEUDO              │
   │           │                              │
   │  Home     │   [Tela atual renderizada]   │
   │  Crimes   │                              │
   │  Mercado  │                              │
   │  Faccao   │                              │
   │  Mapa     │                              │
   │  ...      │                              │
   │           │                              │
   │  Config   │                              │
   └──────────────────────────────────────────┘
   ```

6. **AuthGuard** (equivalente ao `RootNavigator`):
   ```
   nao hidratado → <LoadingScreen />
   nao autenticado → /login ou /register
   sem personagem → /create-char
   ok → /home (+ rotas protegidas)
   ```

7. **Telas de auth:**
   - `LoginScreen` — formulário web (email/senha)
   - `RegisterScreen` — formulário de cadastro
   - `CharacterCreationScreen` — seleção de vocação e nome
   - Usando `createAuthStore` de `@cs-rio/domain/stores` com `electronStorage`

8. **Sistema de modais:**
   - Reusar lógica de `RootModals` via hooks de `@cs-rio/ui`
   - Componentes visuais HTML/CSS com animações
   - Empilhamento de modais

**Critério de conclusão:** Login → criar personagem → Home com mapa renderizado e sidebar funcional.

---

### Fase 7 — Telas do gameplay core

**Objetivo:** Portar as 8 telas essenciais do gameplay loop.

**Para cada tela:**
- Usar hook/controller de `@cs-rio/ui/hooks` (lógica já extraída na Fase 5)
- Escrever apenas componentes visuais HTML/CSS específicos para desktop
- Layout adaptado para tela maior (mais informação visível)
- Interações desktop: hover, tooltips, atalhos de teclado por tela

**Ordem de implementação:**

1. **HomeScreen** — HUD completo sobre o mapa:
   - `useHomeMapScene` + `useHomeHudController` (de `@cs-rio/ui`)
   - `<GameCanvas />` (de Fase 4) recebendo `RenderPlan`
   - Status: vida, energia, dinheiro, respeito
   - Feed de eventos, indicadores de atividade
   - Players remotos via Colyseus

2. **CrimesScreen** — crimes solo e facção:
   - Lista de crimes, cooldown timer, resultados

3. **MarketScreen** — mercado de drogas e itens:
   - Ordens compra/venda, preços por região, leilões

4. **InventoryScreen** — inventário e equipamento:
   - Grid de itens, equip/desequip, consumíveis

5. **ProfileScreen** — perfil do jogador:
   - Stats, histórico, reputação, config de conta

6. **MapScreen** — viagem entre regiões:
   - Mapa visual de regiões, timer de viagem

7. **FactionScreen** — gestão de facção:
   - Membros, hierarquia, banco, operações

8. **TerritoryScreen** — controle territorial:
   - Mapa de territórios, serviços, disputas

**Critério de conclusão:** Smoke test desktop completo: login → criar personagem → Home → Crimes → Mercado → Facção → Território, sem erros de rede.

---

### Fase 8 — Telas secundárias, notificações e audio

**Objetivo:** Paridade funcional com mobile + sistemas de suporte desktop.

**Telas:**

1. CombatScreen — PvP (atalhos de teclado para ações)
2. ContractsScreen — contratos de assassinato
3. OperationsScreen — propriedades e negócios
4. TrainingScreen — treinamento
5. UniversityScreen — cursos
6. HospitalScreen — recuperação
7. PrisonScreen — prisão e fuga
8. BichoScreen — jogo do bicho
9. RankingScreen — rankings
10. MessagesScreen — mensagens privadas
11. TribunalScreen — tribunal
12. WarScreen — guerras
13. NotificationsScreen — histórico

**Notificações desktop:**
- `NotificationOrchestrator` de `@cs-rio/domain` + `electronNotify` adapter
- `PollManager` de `@cs-rio/ui` orquestrando polling
- Notificações nativas Electron (main process via IPC)
- Toasts in-app para eventos urgentes

**Audio:**
- `howler.js` no renderer (sem IPC — é JS puro)
- Mesmos assets `.mp3` do mobile
- Música por região, SFX por ação
- Controles de volume

**Critério de conclusão:** Paridade funcional completa. Todas as telas acessíveis. Notificações e audio funcionais.

---

### Fase 9 — Qualidade de vida desktop

**Objetivo:** Experiência nativa de desktop.

**Entregas:**

1. **Atalhos de teclado:**
   ```
   ESC        → Fechar modal / Voltar
   1-9        → Navegacao rapida (sidebar)
   WASD       → Pan do mapa
   Espaco     → Centralizar camera no player
   E          → Abrir inventario
   C          → Abrir crimes
   M          → Abrir mapa
   Enter      → Confirmar acao
   Tab        → Alternar painel
   F11        → Fullscreen
   Ctrl+Q     → Sair
   ```

2. **Menu de contexto (right-click):**
   - Em jogadores: ver perfil, atacar, mensagem
   - Em estruturas: interagir, sabotar
   - Em itens: usar, equipar, vender

3. **Configuracoes desktop:**
   - Resolucao e modo de tela (janela, borderless, fullscreen)
   - Qualidade grafica (FPS cap, detail level)
   - Rebind de atalhos
   - Volume e audio

4. **Tray:**
   - Minimizar para bandeja
   - Menu de tray (abrir, silenciar notificacoes, sair)
   - Notificacao de eventos importantes

5. **Cursor customizado** (temático do jogo)

**Critério de conclusão:** Jogo se comporta como app desktop nativo.

---

**>>> MARCO: "DESKTOP INTERNO JOGAVEL" <<<**

Ao final da Fase 9, o jogo desktop é funcional e completo para uso interno/testes.
Daqui em diante, as fases são sobre distribuição comercial.

---

### Fase 10 — Integração com lojas (Steam, GOG, Epic)

**Objetivo:** Preparar para publicação nas plataformas de distribuição.

**Entregas:**

1. **Steam (Steamworks SDK):**
   - `steamworks.js` no main process (Node.js bindings)
   - IPC bridge para o renderer:
     - Auth Steam (login alternativo ao email/senha)
     - Overlay Steam (Shift+Tab)
     - Achievements (mapear conquistas do jogo)
     - Cloud saves (sincronizar estado local)
     - Rich Presence (status no perfil)
   - `steam_appid.txt` e config Steamworks
   - Testar com Steam Dev Comp

2. **GOG Galaxy SDK:**
   - Bindings Node no main process
   - Achievements, cloud saves, multiplayer

3. **Epic Games Store (EOS SDK):**
   - Epic Online Services no main process
   - Auth via Epic account, achievements

4. **Backend — auth por plataforma:**
   - `POST /api/auth/steam` no `cs_rio_api`
   - `POST /api/auth/gog`
   - `POST /api/auth/epic`
   - Vincular conta de plataforma ao jogador existente
   - JWT unificado independente da origem

5. **Deep link / Protocol handler:**
   - `csrio://` para abrir o jogo via links externos

**Critério de conclusão:** Build sobe na Steam como app de teste. Login via Steam funciona.

---

### Fase 11 — Build, packaging e distribuição

**Objetivo:** Pipeline de build automatizado.

**Entregas:**

1. **`electron-builder` config:**
   ```yaml
   appId: com.csrio.desktop
   productName: CS Rio
   directories:
     output: dist-electron
   win:
     target: [nsis, portable]
     icon: assets/icon.ico
   mac:
     target: [dmg, zip]
     icon: assets/icon.icns
     category: public.app-category.games
   linux:
     target: [AppImage, deb]
     icon: assets/icon.png
     category: Game
   ```

2. **Assinatura de código:**
   - Windows: certificado EV (SmartScreen)
   - macOS: Apple Developer ID + notarization
   - Linux: GPG signature

3. **Auto-updater:**
   - `electron-updater` com canal stable + beta
   - Delta updates para patches
   - UI de progresso

4. **CI/CD (GitHub Actions):**
   - Triggers: push to main (beta), tags `v*` (stable)
   - Jobs: build-windows, build-mac, build-linux
   - Publish: upload para Steam/GOG/Epic + GitHub Release

**Critério de conclusão:** Tag `v*` dispara build Win/Mac/Linux. Auto-update funcional.

---

### Fase 12 — QA, beta e lançamento

**Objetivo:** Qualidade, performance e estabilidade para lançamento público.

**Entregas:**

1. **Testes automatizados:**
   - Vitest para lógica compartilhada (`packages/domain`, `packages/ui`)
   - Playwright (Electron mode) para smoke test E2E
   - Cobertura: 70%+ nos módulos críticos

2. **Performance:**
   - 60 FPS constante no mapa
   - Sem memory leaks em sessões 2h+
   - Startup < 3s
   - Otimizar renderer: texture atlases, culling, object pooling

3. **Testes cross-platform:**
   - Windows 10/11, macOS 13+, Ubuntu 22.04+
   - Hardware variado (Intel UHD, NVIDIA, AMD)

4. **Smoke test desktop:**
   1. Instalar via instalador nativo
   2. Registrar + login
   3. Criar personagem
   4. Home (mapa renderiza)
   5. Crimes, Mercado, Facção, Território
   6. Minimizar para tray
   7. Notificação desktop
   8. Fechar e reabrir (sessão persiste)

5. **Beta fechado:**
   - Steam beta branch
   - Feedback de jogadores mobile → desktop
   - Iteração em UX desktop

6. **Lançamento:**
   - Steam Store (página, screenshots, trailer)
   - GOG / Epic (se aprovados)
   - Anúncio para base mobile

**Critério de conclusão:** Publicado em ao menos uma loja. Smoke test passa. Auto-update entregando patches.

---

## Resumo da progressão

```
FUNDACAO
  Fase 1  → Scaffold Electron + IPC bridge funcional
  Fase 2  → packages/platform — contratos e adaptadores
  Fase 3  → packages/domain — logica de negocio extraida do mobile

RENDERING
  Fase 4  → POC Canvas 2D (editor) → avaliacao PixiJS

CODIGO COMPARTILHADO
  Fase 5  → packages/ui — hooks e view-models React

DESKTOP JOGAVEL
  Fase 6  → UI, navegacao, auth
  Fase 7  → 8 telas core do gameplay
  Fase 8  → Telas secundarias + notificacoes + audio
  Fase 9  → Atalhos, tray, config — qualidade de vida

  >>> MARCO: desktop interno jogavel <<<

DISTRIBUICAO COMERCIAL
  Fase 10 → Integracao Steam / GOG / Epic
  Fase 11 → Build pipeline, CI/CD, auto-update
  Fase 12 → QA, beta, lancamento
```

Cada fase depende da anterior. Nenhuma fase pula adiante ou retorna.

---

## Mapeamento de dependências entre fases

```
Fase 1 (scaffold + IPC)
  └─► Fase 2 (platform adapters)
       └─► Fase 3 (domain extraction)
            ├─► Fase 4 (renderer — pode ser paralela à Fase 5)
            └─► Fase 5 (ui hooks)
                 └─► Fase 6 (desktop UI + auth)
                      └─► Fase 7 (telas core)
                           └─► Fase 8 (telas sec. + notif. + audio)
                                └─► Fase 9 (desktop QoL)
                                     └─► MARCO: desktop jogavel
                                          ├─► Fase 10 (lojas)
                                          ├─► Fase 11 (build pipeline)
                                          └─► Fase 12 (QA + launch)
```

Nota: Fases 4 e 5 podem ser parcialmente paralelas após a Fase 3, pois o renderer não depende dos hooks e vice-versa.

---

## Estimativa de complexidade

| Fase | Complexidade | Riscos |
|---|---|---|
| 1 — Scaffold + IPC | Baixa | Nenhum |
| 2 — Platform adapters | Baixa-Média | Interface dos ports pode precisar ajuste iterativo |
| 3 — Domain extraction | **Alta** | Regressão no mobile — maior risco do projeto |
| 4 — Renderer | Média | Performance Canvas 2D incerta |
| 5 — UI hooks | Média-Alta | Hooks acoplados podem exigir refactor maior |
| 6 — Desktop UI + auth | Média | Design system do zero |
| 7 — Telas core | Alta (volume) | Nenhum novo risco |
| 8 — Telas sec. + audio | Alta (volume) | Nenhum novo risco |
| 9 — Desktop QoL | Média | Nenhum |
| 10 — Lojas | Média | Contas dev, NDAs, SDKs instáveis |
| 11 — Build pipeline | Média | Certificados de assinatura |
| 12 — QA + launch | Alta | Tudo acima deve estar estável |

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Fase 3 quebra o mobile | **Crítico** | Extrair módulo a módulo, smoke test após cada extração, nunca batch |
| Canvas 2D insuficiente para performance | Médio | Fase 4B (PixiJS) como fallback planejado |
| Hooks do mobile muito acoplados a RN | Alto | Aceitar refactor incremental; alguns hooks podem precisar ser reescritos |
| Drift de `@cs-rio/shared` entre repos | Médio | Formalizar sync (script ou subtree) em paralelo à Fase 3 |
| CORS para Electron em produção | Baixo | Custom protocol `csrio://` resolvido na Fase 1 |
| Anti-cheat em desktop mais vulnerável | Alto | Validação server-side já existe no backend |
| Custo de manutenção de 3+ plataformas | Alto | Código compartilhado em 4 packages: shared, platform, domain, ui |
| SDK Steam/GOG/Epic instável | Médio | Abstrair via interface no main process |
