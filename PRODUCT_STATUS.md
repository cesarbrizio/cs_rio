# CS Rio - Matriz de Aderencia do Produto

> Fonte de verdade funcional para alinhar `JOGO.md`, roadmap e QA.
> Ultima atualizacao: **2026-03-16**.

## Regra de uso

- `Implementado`: o recorte principal ja existe no produto e deve ser tratado por QA como comportamento jogavel e regressivel.
- `Parcial`: existe entrega real, mas nao cobre todo o contrato descrito no `JOGO.md`; QA deve validar apenas o recorte explicitado aqui, e o roadmap deve tratar os gaps restantes como backlog aberto.
- `Planejado`: continua sendo visao de produto ou especificacao futura; nao deve ser vendido como loop pronto no app nem tratado por QA como obrigatorio fora de escopo.

## Contrato operacional

- Antes de abrir ou priorizar backlog funcional em `TODO.md`, confira o status da secao correspondente aqui.
- Antes de promover uma feature para "pronta" em QA ou playtest, valide se a secao esta `Implementado` ou ainda `Parcial`.
- Sempre que uma entrega mudar a disponibilidade real de um sistema, atualize:
  - `PRODUCT_STATUS.md`
  - `JOGO.md`, se houver promessa acima do produto real
  - `TODO.md`, se houver gap residual ou promocao de status

## Decisoes de escopo congeladas — 2026-03-16

| Bloco | Decisao | Recorte aprovado |
|---|---|---|
| `Vocacao` | `MVP agora` | O app agora entrega `Central de Vocacao` com leitura, troca paga em creditos, cooldown global, serializacao dedicada e ponte direta com a progressao exclusiva por vocacao da `Universidade do Crime`. |
| `Sistema Social` | `MVP agora` | O primeiro social MVP fica limitado a `perfil publico`, `contatos` e `mensagens privadas entre contatos`. Canais `global`, `local` e `comercio` continuam fora do recorte imediato. |
| `Sabotagem` | `MVP agora` | O produto agora entrega backend autoritativo, central dedicada no mobile, feedback imediato, replay offline, notificacao local e recuperacao operacional na mesma superficie. |

## Matriz consolidada

| Secao do `JOGO.md` | Status | Contrato atual do produto |
|---|---|---|
| `1. Conceito Geral` | `Parcial` | O core loop de pre-alpha existe e esta jogavel, mas o principio de rodada totalmente data-driven ainda nao foi cumprido de ponta a ponta. |
| `2. Criacao de Personagem` | `Implementado` | Criacao inicial, atributos, aparencia, `Central de Vocacao`, troca paga com cooldown global e progressao exclusiva por trilha na universidade agora formam um recorte fechado de build do personagem. |
| `3. Recursos e Progressao` | `Implementado` | `Conceito`, `nivel`, `Cansaco`, `Disposicao`, `HP`, `Vicio` e `Brisa` existem no contrato compartilhado, backend e mobile. |
| `4. Sistema de Crimes` | `Implementado` | Crimes solo, crimes coletivos e roubos estruturados ja existem como loop real de jogo. |
| `5. Equipamento e Mercado Negro` | `Implementado` | Armas, coletes, soldados e mercado negro ja existem com efeito mecanico e superficie jogavel. |
| `6. Itens Especiais e Impulsos` | `Parcial` | Ha infraestrutura de itens especiais, impulso contextual e lavagem, mas esse bloco ainda nao esta exposto como conjunto fechado no mesmo nivel dos sistemas centrais. |
| `7. Drogas` | `Implementado` | Consumo, tolerancia, overdose, fabricas e venda de drogas existem com efeito sistemico real. |
| `8. Negocios e Propriedades` | `Implementado` | Operacoes e base logistica estao no jogo com compra, manutencao, coleta, risco e utilidade concreta. |
| `9. Treinamento` | `Implementado` | Centro de treino e universidade ja existem com retorno assincrono e efeito mecanico. |
| `10. Faccoes` | `Implementado` | Faccoes fixas, hierarquia, banco, upgrades, pontuacao e satisfacao interna existem no produto real. |
| `11. Sistema Territorial (Favelas)` | `Implementado` | Conquista, servicos, satisfacao, X9, propina, baile e guerra ja formam um sistema territorial jogavel. |
| `12. Tribunal do Trafico` | `Implementado` | O tribunal existe como sistema assincrono, com abertura, prazo, fallback NPC e resultado persistente. |
| `13. Combate PvP` | `Implementado` | O recorte atual de combate, emboscada e contratos PvP ja existe como sistema jogavel do pre-alpha. |
| `14. Prisao` | `Implementado` | Prisao, calor policial, pena, saida por metodos distintos e efeitos de aprisionamento existem no jogo. |
| `15. Hospital` | `Implementado` | Hospitalizacao e servicos do hospital existem com custo, restricoes e integracao aos recursos do jogador. |
| `16. Locais do Mapa` | `Implementado` | O recorte aprovado do mapa e dos POIs esta entregue para o escopo atual de pre-alpha. |
| `17. Eventos do Jogo` | `Implementado` | Eventos programados e aleatorios existem com entrega de resultado assincrona e historico. |
| `18. Economia` | `Implementado` | Fluxo economico, banco e inflacao existem no produto; a parte de balanceamento totalmente data-driven ainda e complementar, nao bloqueia o loop economico atual. |
| `19. Sistema Social` | `Parcial` | O produto entrega chat e coordenacao de faccao, `perfil publico` minimo no backend, `contatos` com superficie dedicada no mobile e `mensagens privadas` entre contatos; `global`, `local` e `comercio` foram podados do pre-alpha atual e seguem fora do recorte imediato junto da tela de perfil publico. |
| `20. Sabotagem` | `Implementado` | O produto agora entrega sabotagem de propriedades de ponta a ponta: contrato compartilhado, backend autoritativo, efeito real nos negocios, central mobile para atacar e recuperar, modal imediato, replay offline e notificacao para atacante/alvo. |
| `21. Monetizacao (Modelo Free-to-Play)` | `Parcial` | Creditos premium e seus usos sistemicos ja existem, mas a camada completa de monetizacao do documento nao esta fechada como produto. |
| `22. Anti-Cheat e Regras` | `Parcial` | O hardening elevou o nivel tecnico e de observabilidade, mas ainda existem gaps abertos de idempotencia, concorrencia e higiene operacional. |
| `23. Estrategias Avancadas (Meta-Game)` | `Implementado` | Secao documental coerente com o meta atual do pre-alpha e com os loops ja entregues. |
| `24. Glossario` | `Implementado` | Secao documental de apoio, valida como referencia do estado atual. |
| `25. Referencias e Inspiracao` | `Implementado` | Secao documental de contexto e referencia, sem gap funcional associado. |

## Gaps mais relevantes no estado atual

- `19. Sistema Social`
  - perfil publico minimo ja existe no backend
  - modulo de contatos agora existe de ponta a ponta, com leitura, adicao, remocao, limites, perda por evento e tela dedicada no mobile
  - mensageria privada 1:1 entre contatos agora esta entregue no mobile, com notificacao local e feed persistido
  - MVP aprovado: falta superficie dedicada de perfil publico no app
  - canais `global`, `local` e `comercio` foram explicitamente podados das superficies do pre-alpha atual e seguem fora do recorte imediato
- `22. Anti-Cheat e Regras`
  - faltam os fixes residuais de hardening ainda abertos

## Regra de interpretacao para QA

- Se uma secao marcada como `Implementado` falhar em playtest, trate como bug.
- Se uma secao marcada como `Parcial` falhar fora do recorte descrito aqui, trate como gap de escopo e nao como regressao automatica.
- Se uma secao marcada como `Planejado` aparecer em UI ou marketing como se estivesse pronta, trate isso como bug de comunicacao de produto.
