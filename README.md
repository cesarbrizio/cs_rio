# CS RIO

Frontend mobile do CS RIO em Expo/React Native. Este repositório concentra apenas o app, os pacotes compartilhados usados pelo app e a engine isométrica local.

## Escopo deste repositório

```text
cs_rio/
├── apps/mobile/          # app Expo
├── packages/shared/      # tipos e contratos consumidos pelo app
├── packages/game-engine/ # engine local usada no render isométrico
└── docs de produto, mapa, UX e backlog do frontend
```

O app só funciona corretamente com o servidor `cs_rio_api` em execução.

## Stack do frontend

| Camada | Tecnologia |
|---|---|
| App | Expo + React Native + TypeScript |
| Navegação | React Navigation |
| Estado | Zustand |
| Render do jogo | `@shopify/react-native-skia` |
| Engine local | `@cs-rio/game-engine` |
| Build | EAS Build |

## Requisitos

- Node `22+`
- Android SDK instalado
- `adb` disponível no `PATH`
- Java/JBR para build Android
- Backend compatível do CS RIO já rodando

## Variáveis de ambiente do app

O mobile lê automaticamente o `.env` da raiz de `cs_rio` via [`apps/mobile/scripts/run-expo-with-root-env.mjs`](./apps/mobile/scripts/run-expo-with-root-env.mjs).

Exemplo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:9000
EXPO_PUBLIC_WS_URL=ws://192.168.1.20:2567
EXPO_PUBLIC_APP_ENV=development
```

Se ainda não existir `.env`:

```bash
cp .env.example .env
```

Regras práticas:

- Em celular físico, use o IP local da máquina, não `localhost`.
- Em Android Emulator, use `10.0.2.2`.
- `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_WS_URL` precisam apontar para o backend realmente ativo.

## Subida rápida do frontend

Instale dependências na raiz:

```bash
npm install
```

Com o backend já rodando, suba o app:

```bash
npm run dev --workspace @cs-rio/mobile
```

Se quiser só validar o config resolvido do Expo:

```bash
cd apps/mobile
node ./scripts/run-expo-with-root-env.mjs config --type public
```

## Fluxo recomendado em device Android

Este projeto não deve ser testado com Expo Go. O fluxo correto é development build.

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

Instale/atualize o app:

```bash
cd apps/mobile
node ./scripts/run-expo-with-root-env.mjs run:android --device
```

Depois abra o app instalado com o backend e o Metro já rodando.

## Verificações rápidas

Se login/registro falharem no app:

1. Abra `http://SEU_IP_LOCAL:PORTA_DO_BACKEND/api/health` no navegador do celular.
2. Confirme que `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_WS_URL` apontam para o mesmo host do backend.
3. Confirme que o dev client instalado corresponde ao estado atual do projeto.

## Scripts úteis

Na raiz de `cs_rio`:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Somente mobile:

```bash
npm run typecheck --workspace @cs-rio/mobile
npm run lint --workspace @cs-rio/mobile
npm run test --workspace @cs-rio/mobile
npm run build --workspace @cs-rio/mobile
```

Somente desktop:

```bash
export VITE_API_URL=http://127.0.0.1:9000
export VITE_WS_URL=ws://127.0.0.1:2567
export VITE_APP_ENV=development
npm run dev --workspace @cs-rio/desktop
```

## Smoke mínimo do app

1. Registrar conta
2. Fazer login
3. Criar personagem
4. Abrir `Home`
5. Abrir `Crimes`
6. Abrir `Mercado`
7. Abrir `Facção`
8. Abrir `Território`
9. Validar que não há erro de rede espontâneo

## Documentos deste repositório

- [PRODUCT_STATUS.md](./PRODUCT_STATUS.md)
- [JOGO.md](./JOGO.md)
- [MAPA.md](./MAPA.md)
- [PLANO_CORRECAO_UX.md](./PLANO_CORRECAO_UX.md)
- [TODO.md](./TODO.md)
- [ROLL_OUT.md](./ROLL_OUT.md)
- [PERFORMANCE_UPGRADE.md](./PERFORMANCE_UPGRADE.md)
