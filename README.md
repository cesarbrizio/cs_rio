# CS RIO

Monorepo frontend do CS Rio. Este repositório concentra o app mobile, o app desktop, o editor web e os pacotes compartilhados consumidos por essas interfaces.

O backend roda em repositório separado: [cs_rio_api](/home/cesar/projects/cs_rio_api/README.md).

## Escopo deste repositório

```text
cs_rio/
├── apps/mobile/          # app Expo / React Native
├── apps/desktop/         # app desktop Electron + Vite + React
├── apps/editor/          # editor web
├── packages/domain/      # lógica compartilhada
├── packages/platform/    # adapters mobile/desktop
├── packages/ui/          # hooks/controllers React compartilhados
├── packages/shared/      # tipos e contratos compartilhados
└── packages/game-engine/ # engine isométrica local
```

## Dependência obrigatória

Este repositório não sobe o backend. Para login, registro, criação de personagem, mapa, crimes, mercado e realtime funcionarem, o `cs_rio_api` precisa estar ativo.

Bootstrap rápido do backend:

```bash
cd /home/cesar/projects/cs_rio_api
cp .env.example .env
npm install
docker compose -f docker-compose.dev.yml up -d
npm run db:push
npm run db:seed
npm run dev
```

Guia completo do backend: [README.md](/home/cesar/projects/cs_rio_api/README.md)

## Requisitos

- Node `22+`
- `npm`
- Backend `cs_rio_api` ativo
- Para mobile Android: Android SDK, `adb` no `PATH` e Java/JBR

## `.env` da raiz

O `.env` da raiz de `cs_rio` e compartilhado entre os fluxos de desenvolvimento.

- O mobile lê `EXPO_PUBLIC_*`
- O desktop em `dev` também reaproveita `EXPO_PUBLIC_*` quando `VITE_*` não estiver definido

Exemplo:

```env
EXPO_PUBLIC_API_URL=http://SEU_HOST:PORTA_API
EXPO_PUBLIC_WS_URL=ws://SEU_HOST:PORTA_WS
EXPO_PUBLIC_APP_ENV=development

# opcionais: sobrescrevem apenas o desktop
# VITE_API_URL=http://SEU_HOST:PORTA_API
# VITE_WS_URL=ws://SEU_HOST:PORTA_WS
# VITE_APP_ENV=development
```

Se ainda não existir:

```bash
cp .env.example .env
```

Regras práticas:

- Em celular físico, use o IP local da máquina, não `localhost`
- Em Android Emulator, use `10.0.2.2`
- No desktop local, `127.0.0.1`, `localhost` ou o IP local funcionam, desde que apontem para o backend real
- O host e a porta do HTTP e do WS precisam bater com o backend realmente ativo

## Começo rápido

Se você quer subir tudo do frontend de uma vez:

```bash
cd /home/cesar/projects/cs_rio
cp .env.example .env
npm install
npm run dev
```

O que `npm run dev` na raiz faz:

- sobe o mobile (`Expo` / `Metro`)
- sobe o desktop (`Electron` + `Vite`)
- sobe o editor web
- coloca os pacotes compartilhados em modo watch

O que `npm run dev` na raiz nao faz:

- nao sobe o backend `cs_rio_api`

## Fluxos de desenvolvimento

### Tudo junto

Use quando quiser trabalhar com mobile, desktop e pacotes compartilhados ao mesmo tempo:

```bash
cd /home/cesar/projects/cs_rio
npm run dev
```

### Somente mobile

Use quando quiser só o Metro:

```bash
cd /home/cesar/projects/cs_rio
npm run dev --workspace @cs-rio/mobile
```

Importante:

- `npm run dev --workspace @cs-rio/mobile` sobe o Metro
- `npm run android --workspace @cs-rio/mobile` instala/abre o app Android
- `npm run ios --workspace @cs-rio/mobile` roda o fluxo iOS
- `npm run build --workspace @cs-rio/mobile` nao abre o app; ele só valida TypeScript e gera um artefato local de build

### Somente desktop

Use quando quiser só o app desktop:

```bash
cd /home/cesar/projects/cs_rio
npm run dev --workspace @cs-rio/desktop
```

Importante:

- a aplicação correta é a janela do Electron
- a URL `http://localhost:5173` ou similar é só o servidor do renderer em desenvolvimento
- se a porta `5173` estiver ocupada, o Vite pode subir em `5174`, `5175` etc.

### Somente editor

```bash
cd /home/cesar/projects/cs_rio
npm run dev --workspace @cs-rio/editor
```

## Fluxo recomendado para Android

Este projeto nao deve ser testado com Expo Go. O fluxo correto é `development build`.

Garanta as variáveis de shell:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export JAVA_HOME=$HOME/android-studio/jbr
export PATH=$PATH:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin
```

Confirme o device:

```bash
adb devices -l
```

Com o Metro já rodando, instale/atualize o app:

```bash
cd /home/cesar/projects/cs_rio
npm run android --workspace @cs-rio/mobile
```

## Verificações rápidas

Se login, registro ou criação de personagem falharem:

1. Confirme que o `cs_rio_api` está ativo
2. Abra `http://HOST:PORTA/api/health` e valide que o backend responde
3. Confira se o `.env` da raiz aponta para o mesmo host/porta do backend
4. Se você mudou o `.env`, reinicie o `npm run dev`

Se o problema for só no desktop:

1. Confirme que a janela do Electron abriu
2. Confirme que o `.env` da raiz está correto
3. Reinicie `npm run dev --workspace @cs-rio/desktop` ou o `npm run dev` da raiz
4. Lembre que abrir a URL do Vite no navegador nao valida IPC, tray, notificações ou storage do app desktop

## Scripts úteis

Na raiz:

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run typecheck
```

Somente mobile:

```bash
npm run dev --workspace @cs-rio/mobile
npm run android --workspace @cs-rio/mobile
npm run ios --workspace @cs-rio/mobile
npm run lint --workspace @cs-rio/mobile
npm run test --workspace @cs-rio/mobile
npm run typecheck --workspace @cs-rio/mobile
```

Somente desktop:

```bash
export VITE_API_URL=http://127.0.0.1:9000
export VITE_WS_URL=ws://127.0.0.1:2567
export VITE_APP_ENV=development
npm run dev --workspace @cs-rio/desktop
```

## Smoke mínimo do app

```bash
npm run dev --workspace @cs-rio/desktop
npm run build --workspace @cs-rio/desktop
npm run package --workspace @cs-rio/desktop -- --dir
npm run lint --workspace @cs-rio/desktop
npm run typecheck --workspace @cs-rio/desktop
```

Somente editor:

```bash
npm run dev --workspace @cs-rio/editor
npm run build --workspace @cs-rio/editor
```

## Smoke mínimo

### Desktop

1. Abrir a janela do Electron
2. Registrar conta
3. Fazer login
4. Criar personagem
5. Abrir `Home`
6. Abrir `Crimes`
7. Abrir `Mercado`
8. Abrir `Facção`
9. Abrir `Território`
10. Abrir `Inventário`
11. Abrir `Config`
12. Validar que nao há erro de rede espontâneo

### Mobile

1. Abrir o dev build no device
2. Registrar conta
3. Fazer login
4. Criar personagem
5. Abrir `Home`
6. Abrir `Crimes`
7. Abrir `Mercado`
8. Abrir `Facção`
9. Abrir `Território`
10. Validar que nao há erro de rede espontâneo

## Documentos deste repositório

- [PRODUCT_STATUS.md](./PRODUCT_STATUS.md)
- [JOGO.md](./JOGO.md)
- [MAPA.md](./MAPA.md)
- [PLANO_CORRECAO_UX.md](./PLANO_CORRECAO_UX.md)
- [TODO.md](./TODO.md)
- [ROLL_OUT.md](./ROLL_OUT.md)
- [PERFORMANCE_UPGRADE.md](./PERFORMANCE_UPGRADE.md)
