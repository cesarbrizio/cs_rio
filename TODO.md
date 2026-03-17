# CS Rio — Backlog Frontend

Backlog ativo do app mobile e da experiência do jogador no repositório `cs_rio`.

## Estado atual

- app Expo funcional
- navegação principal e fluxos centrais jogáveis
- pacote de performance do frontend concluído
- backlog de backend e infra movido para `../cs_rio_api/TODO.md`

## Prioridades do frontend

### F.1 — Fechar feedback assíncrono de tela

- guerra com retorno mais legível no app
- treino e universidade com feedback menos opaco
- inflação NPC explicada de forma jogável
- resultados assíncronos mais claros em operações e telas econômicas

### F.2 — Continuar limpeza de hotspots do mobile

- reduzir hotspots de render e estado em telas grandes
- diminuir usos residuais de `any`
- ampliar acessibilidade mínima no app
- adicionar monitoramento mínimo de performance no mobile

### F.3 — UX e clareza sistêmica

- reforçar a fantasia do jogo no mapa e overlays
- reduzir pontos de atrito de navegação
- consolidar feedback visual imediato em ações sensíveis
- manter o app legível em device físico sem depender de scroll confuso

### F.4 — Comunicação e social no app

- fechar a UI de chat
- revisar consistência de contexto entre sessões
- evitar herança indevida de estado visual ou contextual entre contas

## Regra de fronteira

Tudo que for backlog de API, realtime, banco, Redis, comandos operacionais, observabilidade de servidor, hardening HTTP, rollout de backend ou decomposição estrutural do server deve ser mantido em `../cs_rio_api/TODO.md`.
