# ROLL_OUT.md — Checklist Operacional do Frontend

**Projeto:** `cs_rio`  
**Escopo:** app mobile

## 1. Preflight

Rodar na raiz de `cs_rio`:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Critério:

- esteira verde no app e nos pacotes compartilhados do frontend
- sem regressão visual conhecida ignorada
- dev client compatível com o estado atual do app

## 2. Ambiente mínimo

Validar:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_WS_URL`
- `EXPO_PUBLIC_APP_ENV`
- backend compatível já em execução
- Metro/Expo acessível pelo device usado no teste

## 3. Subida do app

```bash
npm run dev --workspace @cs-rio/mobile -- --clear
```

Se usar device físico:

- development build instalada
- `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_WS_URL` apontando para host acessível pelo aparelho

## 4. Smoke mínimo do app

Validar pelo menos:

1. login
2. criação de personagem
3. `Home` abre sem crash
4. mapa local abre
5. macro mapa abre
6. crimes confirmam inline
7. mercado abre sem erro espontâneo
8. facção abre sem erro espontâneo
9. território abre sem erro espontâneo
10. logout e login com outra conta não herdam estado contextual indevido

## 5. Sinais de alerta

- erro de rede em tela inicial com backend já saudável
- travamento de navegação entre telas principais
- queda de FPS perceptível em mapa e overlays
- crash sem fallback visível da camada de erro do app

## 6. Rollback do frontend

Acionar rollback se:

- o app não sobe
- login quebra
- Home ou mapa entram em crash
- build instalada fica inutilizável em device

Checklist:

1. interromper promoção da build
2. voltar para a build mobile anterior
3. validar novamente login, Home e mapa
4. registrar sintomas e cenário de reprodução
