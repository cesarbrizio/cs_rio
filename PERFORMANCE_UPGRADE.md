# PERFORMANCE_UPGRADE.md — Pacote de Performance do Frontend

Documento consolidado das melhorias de performance aplicadas no app mobile dentro do repositório `cs_rio`.

## Status

`Concluído em 17/03/2026`

## Escopo do frontend

### Etapa 2 — Remoção de assets não utilizados

- `apps/mobile/assets/examples/` removida
- `zona_norte.tmj` removido
- `city_base.png` removido
- `assetBundlePatterns` restringido aos assets realmente usados
- `apps/mobile/assets/` caiu de `61 MB` para `2.3 MB`

### Etapa 3 — Remoção de dependências não utilizadas do mobile

- removidas dependências diretas não usadas do workspace mobile
- lockfile recalculado
- Expo/dev client continuaram funcionando

### Etapa 4 — Carregamento tardio de telas

- `RootNavigator` passou a usar `getComponent` para telas secundárias
- telas de boot permaneceram eager
- ganho focado em startup e custo de montagem

## Validação executada no frontend

- `npm install`
- `npm run build`
- `npm run lint`
- `npm run test`
- `node ./apps/mobile/scripts/run-expo-with-root-env.mjs config --type public`

## Fora deste repositório

As etapas de separação do backend, índices de banco e cache Redis agora pertencem ao backend e estão documentadas em `../cs_rio_api/PERFORMANCE_UPGRADE.md`.
