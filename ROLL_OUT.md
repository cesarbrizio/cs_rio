# ROLL_OUT.md — Checklist Operacional

**Projeto:** `cs_rio`  
**Status:** `Ativo`  
**Objetivo:** servir como checklist curto de pre-deploy, deploy, smoke, observabilidade e rollback.

## 1. Pre-deploy

Rodar na raiz de [cs_rio](/home/cesar/projects/cs_rio):

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Rodar tambem na raiz de [cs_rio_api](/home/cesar/projects/cs_rio_api):

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Critério:
- todos os comandos obrigatórios devem passar na revisão atual
- sem pular workspace
- qualquer flake conhecido precisa ser registrado antes do deploy
- contagens históricas de `HARDENING.md` não substituem esta checagem ao vivo

## 2. Variáveis e infra mínimas

Validar no mobile (`cs_rio`):
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_WS_URL`
- `EXPO_PUBLIC_APP_ENV`

Validar no backend (`cs_rio_api`):
- `NODE_ENV`
- `DATABASE_URL`
- `REDIS_URL`
- `PORT`
- `COLYSEUS_PORT`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `TRUST_PROXY`
- `CORS_ALLOWED_ORIGINS`

Regras:
- `JWT_SECRET` e `JWT_REFRESH_SECRET` precisam existir
- ambos precisam ter pelo menos `32` caracteres
- não podem ser iguais
- placeholders legados são inválidos
- em `staging` e `production`, `CORS_ALLOWED_ORIGINS` é obrigatório
- se houver proxy reverso na frente do Fastify, `TRUST_PROXY` deve listar apenas proxies/sub-redes confiáveis
- não usar `X-Forwarded-For` aberto sem configurar `TRUST_PROXY`

Confirmar:
- PostgreSQL acessível
- Redis acessível
- Fastify sobe
- Colyseus sobe
- build mobile atual corresponde ao backend que vai subir

## 3. Subida

### Server

```bash
cd /home/cesar/projects/cs_rio_api
npm run dev
```

Validar:
- sobe sem erro de env
- responde em `/api/health`
- aceita handshake realtime

### Mobile

```bash
npm run dev --workspace @cs-rio/mobile -- --clear
```

Se usar device físico:
- development build instalada
- `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_WS_URL` apontando para IP acessível pelo aparelho

## 4. Smoke imediato

### Backend

Validar pelo menos:
1. login
2. refresh
3. `players/me`
4. mercado responde
5. território responde
6. hospital responde
7. prisão responde
8. realtime regional conecta
9. realtime de facção conecta

### Mobile

Validar pelo menos:
1. login
2. Home abre sem crash
3. mapa local abre
4. macro mapa abre
5. crimes confirmam inline
6. mercado negro compra inline
7. território abre sem erro espontâneo
8. QG da facção abre sem erro espontâneo
9. hospital retorna feedback imediato
10. prisão abre
11. jogo do bicho abre e permite apostar
12. operações expõem maquininha de forma legível
13. logout e login com outra conta não herdam tutorial, DMs, eventos ou estado contextual do jogador anterior

## 5. Observabilidade mínima

No server, confirmar leitura útil de:
- `requestId`
- `route`
- `method`
- `path`
- `ip`
- `playerId`
- `regionId`

Fontes que precisam continuar logando:
- handler HTTP global
- Redis
- realtime
- erros fatais de processo

Sinais de alerta:
- erro HTTP sem `requestId`
- reconnect quebrando em cascata
- Redis emitindo `error` ou `reconnecting` continuamente
- crash de render no mobile sem fallback do `AppErrorBoundary`

## 6. Verificação pós-deploy

Depois da subida, repetir:
1. login real
2. `players/me`
3. um fluxo monetário simples
4. um fluxo monetário composto
5. uma ação protegida por idempotência
6. uma ação bloqueada por prisão/hospital
7. entrada em realtime regional
8. entrada em realtime de facção

## 7. Rollback

Disparar rollback se qualquer um destes ocorrer:
- server não sobe por env/config
- auth quebra
- `players/me` quebra
- mercado, território, hospital ou prisão falham no smoke
- realtime fica inutilizável
- mobile entra em crash loop sem recovery

Checklist de rollback:
1. interromper promoção da build
2. voltar para a versão anterior do server
3. voltar para a build mobile anterior, se necessário
4. revalidar `/api/health`
5. repetir o smoke mínimo
6. registrar causa, sintomas e `requestId`s relevantes

## 8. Regra de manutenção

Este arquivo deve ser revisado sempre que mudar:
- smoke crítico do produto
- requisito de infra
- fluxo principal do app
- critério operacional de rollback
