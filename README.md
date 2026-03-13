# CS RIO

RPG criminal multiplayer mobile (Android/iOS) ambientado no Rio de Janeiro, com visual isométrico 2D inspirado em Tibia e Age of Empires. Mecânicas baseadas no The Crims, adaptadas para a realidade carioca: facções, favelas, tráfico, tribunal do tráfico e domínio territorial.

## Stack

| Camada | Tecnologia |
|---|---|
| App | Expo (React Native) + TypeScript |
| Game Rendering | @shopify/react-native-skia |
| Game Loop | react-native-game-engine |
| State | Zustand |
| Real-time | Colyseus |
| API | Fastify |
| Database | PostgreSQL + Redis |
| ORM | Drizzle |
| Auth | JWT + bcrypt |
| Monorepo | Turborepo |
| Build | EAS Build |

## Estrutura

```
cs_rio/
├── apps/
│   ├── mobile/          # Expo app (React Native)
│   └── server/          # Game server (Node.js + Colyseus + Fastify)
├── packages/
│   ├── shared/          # Tipos e constantes compartilhados
│   └── game-engine/     # Engine isométrica (Skia)
├── JOGO.md              # Game Design Document completo
├── TODO.md              # Roadmap técnico com 189 tarefas
└── README.md
```

## Status Atual

- Roadmap: `108/189` tarefas concluidas (`57%`)
- Fases concluidas: `0` a `10`
- Slice jogavel atual:
  - auth + criacao de personagem
  - mapa isometrico com HUD e tap-to-move
  - crimes
  - inventario, mercado negro e leiloes
  - drogas, overdose, fabricas e venda por canais
  - propriedades, negocios e patrimonio
  - faccoes com banco, upgrades, politica e chat realtime
  - territorio: conquista, servicos, satisfacao, X9, propina, baile e guerra

## Premissas Estrategicas

- Propriedades pertencem ao jogador, nunca a faccao.
- Faccao atua como camada de protecao, influencia operacional e arrecadacao sobre negocios lucrativos.
- Propriedades lucrativas repassam comissao fixa para a faccao do jogador quando ele for faccionado.
- Propriedades patrimoniais nao geram renda direta; servem para prestigio, conforto, logistica e capacidade, mas exigem manutencao.
- Dominio territorial total de uma regiao concede vantagem forte em protecao, risco e eficiencia operacional, mas nao cria invulnerabilidade.
- Ao trocar de faccao, os ativos continuam do jogador; muda a camada de protecao/comissao associada a eles.

## Documentos

- **[JOGO.md](./JOGO.md)** — Game Design Document com todas as mecânicas
- **[TODO.md](./TODO.md)** — Roadmap técnico detalhado (22 fases, 189 tarefas)
- **[CONTEXT.md](./CONTEXT.md)** — Histórico consolidado das decisões de produto e arquitetura

## Setup Local

### Requisitos

- Node `22+`
- Docker + Docker Compose
- Android SDK instalado
- `adb` no sistema
- Java/JBR para build Android

### `.env`

Exemplo de desenvolvimento local:

```env
NODE_ENV=development

DATABASE_URL=postgresql://cs_rio:cs_rio_dev@localhost:5433/cs_rio
REDIS_URL=redis://localhost:6380

PORT=9000
COLYSEUS_PORT=2567
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too

EXPO_PUBLIC_API_URL=http://192.168.1.20:9000
EXPO_PUBLIC_WS_URL=ws://192.168.1.20:2567
```

Notas:

- Para **celular fisico na mesma rede**, `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_WS_URL` devem usar o **IP local da maquina**, nao `localhost`.
- Para **Android Emulator**, use `10.0.2.2` no lugar do IP da maquina.
- O `PORT` controla a API Fastify; `COLYSEUS_PORT` controla o realtime.
- O workspace mobile agora le o arquivo `.env` da **raiz do monorepo** automaticamente ao rodar `npm run dev --workspace @cs-rio/mobile` ou `npm run android --workspace @cs-rio/mobile`.

### Infraestrutura e banco

Na raiz de [`cs_rio`](./):

```bash
# Instalar dependencias
npm install

# Subir servicos de dev (PostgreSQL + Redis)
docker compose -f docker-compose.dev.yml up -d

# Aplicar schema
npm run db:push --workspace @cs-rio/server

# Popular dados base
npm run db:seed --workspace @cs-rio/server
```

### Rodando server e mobile

Recomendado em terminais separados:

```bash
# Terminal 1
npm run dev --workspace @cs-rio/server
```

```bash
# Terminal 2
npm run dev --workspace @cs-rio/mobile
```

O Expo pode trocar de porta (`8081`, `8082`, `8083`) se alguma ja estiver ocupada. Isso e normal.

Se o app mostrar erro de rede no login/registro, teste primeiro este endpoint no navegador do celular:

```text
http://SEU_IP_LOCAL:9000/api/health
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

# Workspaces
npm run typecheck --workspace @cs-rio/server
npm run test --workspace @cs-rio/server
npm run typecheck --workspace @cs-rio/mobile
npm run test --workspace @cs-rio/mobile
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
