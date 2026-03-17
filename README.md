# CS RIO

RPG criminal multiplayer mobile (Android/iOS) ambientado no Rio de Janeiro, com visual isométrico 2D inspirado em Tibia e Age of Empires. Mecânicas baseadas no The Crims, adaptadas para a realidade carioca: facções, favelas, tráfico, tribunal do tráfico e domínio territorial.

## Stack

| Camada | Tecnologia |
|---|---|
| App | Expo (React Native) + TypeScript |
| Game Rendering | @shopify/react-native-skia |
| Game Loop | @cs-rio/game-engine |
| State | Zustand |
| Shared packages | `packages/shared` + `packages/game-engine` |
| Backend | Repositório irmão `../cs_rio_api` (Fastify + Colyseus + Drizzle + PostgreSQL + Redis) |
| Monorepo | Turborepo (mobile + pacotes compartilhados) |
| Build | EAS Build |

## Estrutura

```
cs_rio/
├── apps/
│   └── mobile/          # Expo app (React Native)
├── packages/
│   ├── shared/          # Tipos e constantes compartilhados
│   └── game-engine/     # Engine isométrica (Skia)
├── JOGO.md              # Game Design Document completo
├── PRODUCT_STATUS.md    # Matriz de aderencia entre documento e produto real
├── TODO.md              # Roadmap técnico histórico + prioridades abertas
├── MAPA.md              # Estado final aprovado do mapa
├── CHEATS.md            # Operações internas / cheats de desenvolvimento
└── README.md
```

O backend foi extraído para o repositório irmão [`../cs_rio_api`](/home/cesar/projects/cs_rio_api).

## Status Atual

- Build atual: **Pré-Alpha funcional**
- Estado operacional: **fase de testes e ajuste fino**
- Esteira técnica: validar `typecheck`, `lint`, `test` e `build` conforme [ROLL_OUT.md](./ROLL_OUT.md) antes de promoção ou playtest crítico
- Sistemas já jogáveis:
  - auth + criação de personagem
  - home/mapa local e macro mapa do Rio
  - crimes
  - inventário, mercado negro e leilões
  - drogas, overdose, fábricas e venda por canais
  - propriedades, negócios e patrimônio
  - facções com banco, upgrades, política e realtime
  - território: conquista, serviços, satisfação, X9, propina, baile e guerra
  - tribunal do tráfico
  - prisão e hospital
- Operações internas e infraestrutura do backend agora vivem em [`../cs_rio_api`](/home/cesar/projects/cs_rio_api).

## Prioridade Atual

O foco imediato não é mais abrir grandes features, e sim:

- estabilização
- hardening técnico
- testes em device
- balanceamento fino
- UX e performance percebida

## Premissas Estrategicas

- Propriedades pertencem ao jogador, nunca a faccao.
- Faccao atua como camada de protecao, influencia operacional e arrecadacao sobre negocios lucrativos.
- Propriedades lucrativas repassam comissao fixa para a faccao do jogador quando ele for faccionado.
- Propriedades patrimoniais nao geram renda direta; servem para conforto, logistica, capacidade e protecao, mas exigem manutencao.
- Dominio territorial total de uma regiao concede vantagem forte em protecao, risco e eficiencia operacional, mas nao cria invulnerabilidade.
- Ao trocar de faccao, os ativos continuam do jogador; muda a camada de protecao/comissao associada a eles.

## Documentos

- **[JOGO.md](./JOGO.md)** — Game Design Document com todas as mecânicas
- **[PRODUCT_STATUS.md](./PRODUCT_STATUS.md)** — Contrato funcional entre `JOGO.md`, produto real, roadmap e QA
- **[TODO.md](./TODO.md)** — Roadmap técnico histórico e backlog ainda aberto
- **[MAPA.md](./MAPA.md)** — Estado final aprovado do mapa para o escopo atual
- **[CHEATS.md](./CHEATS.md)** — Referência histórica das operações internas; a execução atual do backend fica em [`../cs_rio_api`](/home/cesar/projects/cs_rio_api)
- **[HARDENING.md](./HARDENING.md)** — Plano técnico de hardening e estabilização estrutural
- **[ROLL_OUT.md](./ROLL_OUT.md)** — Checklist operacional vivo de pre-deploy, smoke, observabilidade e rollback
- **[CONTEXT.md](./CONTEXT.md)** — Histórico consolidado das decisões de produto e arquitetura

## Setup Local

### Requisitos

- Node `22+`
- Docker + Docker Compose
- Android SDK instalado
- `adb` no sistema
- Java/JBR para build Android

### `.env`

Exemplo de desenvolvimento local para o app:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
EXPO_PUBLIC_WS_URL=ws://192.168.1.20:2567
EXPO_PUBLIC_APP_ENV=development
```

Notas:

- As variaveis de infraestrutura e secrets do backend agora ficam em [`../cs_rio_api/.env.example`](/home/cesar/projects/cs_rio_api/.env.example).
- Para **celular fisico na mesma rede**, `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_WS_URL` devem usar o **IP local da maquina**, nao `localhost`.
- Para **Android Emulator**, use `10.0.2.2` no lugar do IP da maquina.
- O workspace mobile agora le o arquivo `.env` da **raiz do monorepo** automaticamente ao rodar `npm run dev --workspace @cs-rio/mobile` ou `npm run android --workspace @cs-rio/mobile`.

### Infraestrutura e banco

Na raiz de [`cs_rio`](./):

```bash
# Instalar dependencias
npm install
```

No backend separado, em [`../cs_rio_api`](/home/cesar/projects/cs_rio_api):

```bash
cd ../cs_rio_api
npm install

# Subir servicos de dev (PostgreSQL + Redis)
docker compose -f docker-compose.dev.yml up -d

# Aplicar schema
npm run db:push

# Popular dados base
npm run db:seed
```

### Rodando server e mobile

Recomendado em terminais separados:

```bash
# Terminal 1
cd ../cs_rio_api
npm run dev
```

```bash
# Terminal 2
npm run dev --workspace @cs-rio/mobile
```

O Expo pode trocar de porta (`8081`, `8082`, `8083`) se alguma ja estiver ocupada. Isso e normal.

Se o app mostrar erro de rede no login/registro, teste primeiro este endpoint no navegador do celular:

```text
http://SEU_IP_LOCAL:3000/api/health
```

Se isso nao abrir no celular, o problema nao e o backend em si; e conectividade entre o aparelho e a maquina.

### Android fisico via development build

Este projeto **nao deve ser testado com Expo Go**. O app usa `expo-dev-client` e `@shopify/react-native-skia`, entao o fluxo correto e **development build**.

Antes de instalar no Android, garanta que estas variaveis estejam no shell:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export JAVA_HOME=$HOME/android-studio/jbr
export PATH=$PATH:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin
```

Se quiser deixar permanente:

```bash
echo 'export ANDROID_HOME=$HOME/Android/Sdk' >> ~/.bashrc
echo 'export ANDROID_SDK_ROOT=$ANDROID_HOME' >> ~/.bashrc
echo 'export JAVA_HOME=$HOME/android-studio/jbr' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin' >> ~/.bashrc
source ~/.bashrc
```

No celular Android:

- ative `Opcoes do desenvolvedor`
- ative `Depuracao USB`
- em `USB controlado por`, tanto faz, desde que a conexao funcione
- em `Usar USB para`, use **`Transferindo arquivos / Android Auto`**
- **nao** use `Ancoragem USB` para `adb`
- aceite o popup `Permitir depuracao USB`

Confirme que o dispositivo apareceu:

```bash
adb devices -l
```

Depois instale o development build:

```bash
cd apps/mobile
npx expo run:android --device
```

Com o server e o Metro rodando, abra o app instalado no celular.

### Scripts uteis

```bash
# Monorepo inteiro
npm run typecheck
npm run lint
npm run test
npm run build

# Mobile e pacotes compartilhados
npm run typecheck --workspace @cs-rio/mobile
npm run test --workspace @cs-rio/mobile

# Backend separado
cd ../cs_rio_api
npm run typecheck
npm run test
```

## Smoke Test Manual

Fluxo minimo recomendado apos instalar o app:

1. Registrar conta
2. Fazer login
3. Criar personagem
4. Entrar na `Home`
5. Abrir `Crimes`
6. Abrir `Treino`
7. Abrir `Universidade`
8. Abrir `Mercado`
9. Abrir `Patrimonio`
10. Abrir `Faccao`
11. Abrir `Territorio`

## O Que Faz Cada Variavel Android

- `ANDROID_HOME`: aponta para a pasta raiz do Android SDK.
- `ANDROID_SDK_ROOT`: mesma ideia do `ANDROID_HOME`; muitas ferramentas ainda consultam uma ou outra.
- `JAVA_HOME`: aponta para o Java usado pelo Gradle para compilar e instalar o app Android.
- `PATH`: adiciona `adb` e `java` ao shell para que `expo`, `gradle` e scripts consigam chamar essas ferramentas sem caminho absoluto.
```
