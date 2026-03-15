# CS Rio — Roadmap Técnico de Desenvolvimento

> Documento vivo de acompanhamento do desenvolvimento do jogo CS Rio.
> Cada tarefa possui status, dependências e especificação técnica.
> Última atualização: 2026-03-14

## Estado Operacional Atual

> O projeto já roda hoje como **Pré-Alpha funcional** e entrou numa fase de **testes, ajuste fino e estabilização**.
>
> Pontos já consolidados:
> - mapa aprovado para o escopo atual em [MAPA.md](./MAPA.md)
> - cheats internos concluídos em [CHEATS.md](./CHEATS.md)
> - esteira principal verde (`typecheck`, `lint`, `test`, `build`)
>
> Prioridade prática a partir daqui:
> - hardening técnico
> - balanceamento
> - performance percebida
> - UX em device
> - correção de bugs reais de playtest

## Backlog Imediato de Produto — Playtest

> Ajustes de produto identificados em playtest real depois do fechamento do mapa.
> Estes itens não são “nice to have”; eles afetam clareza de loop, feedback e descoberta de sistemas.

### B.1 — Expor `Jogo do Bicho` e `Maquininha de Caça-Níquel`

> **Status atual**
>
> - `Jogo do Bicho` agora está exposto no mobile, com screen própria, rota, CTA de descoberta e UX inline
> - `Maquininha` agora tem descoberta explícita na home e fluxo operacional direto em `Operações`
> - O bloco passou do estado “escondido” para **descoberto, jogável e autoexplicativo**

> **Decisões operacionais**
>
> - `Jogo do Bicho` deve entrar como **ação/aposta**, não como propriedade
> - `Maquininha` deve entrar como **ativo/operação**, não como jogo de aposta instantânea
> - os dois precisam aparecer em pontos diferentes da UX:
>   - `Jogo do Bicho` em tela própria de ação
>   - `Maquininha` no fluxo de patrimônio/operações
> - ambos devem seguir o padrão novo de UX:
>   - seleção inline
>   - ação confirmada na própria card
>   - resultado imediato em modal quando fizer sentido

> **Arquivos-alvo esperados**
>
> - `apps/mobile/App.tsx`
> - `apps/mobile/src/services/api.ts`
> - `apps/mobile/src/components/hud/ActionBar.tsx`
> - `apps/mobile/src/screens/OperationsScreen.tsx`
> - `apps/mobile/src/screens/` com nova screen de `Jogo do Bicho`
> - opcionalmente `apps/mobile/src/features/operations.ts` para copy e descoberta de `Maquininha`

- [x] **B.1.1** Criar infraestrutura mobile de `Jogo do Bicho`
  - criar client API no mobile para:
    - consultar estado atual
    - listar histórico recente
    - apostar
  - adicionar screen própria no app
  - registrar rota e tipo de navegação no `RootStack`

- [x] **B.1.2** Criar UX de `Jogo do Bicho` no padrão atual do app
  - tela própria
  - resumo curto do sistema
  - estado atual do bicho/sorteio
  - histórico recente
  - cards de aposta com expansão inline
  - confirmação da aposta na própria card
  - resultado/feedback imediato sem depender de scroll

- [x] **B.1.3** Expor `Jogo do Bicho` no fluxo de descoberta do jogador
  - CTA claro no `Mais` e/ou outro ponto da home
  - texto curto deixando claro que:
    - isso é uma aposta
    - não é um patrimônio
    - não é uma operação passiva

- [x] **B.1.4** Tornar `Maquininha de Caça-Níquel` descoberta no fluxo do jogador
  - criar ponto de entrada visível
  - explicar o que é
  - mostrar que ela vive em `Operações`
  - deixar claro que é um negócio/passivo, não uma aposta manual

- [x] **B.1.5** Fechar o fluxo operacional da `Maquininha`
  - revisar suporte mobile para:
    - listar
    - instalar
    - configurar
    - coletar
  - o fluxo precisa ficar navegável sem depender de conhecimento prévio escondido

- [x] **B.1.6** Melhorar a linguagem da `Maquininha` dentro de `Operações`
  - copy clara
  - cards legíveis
  - explicação de caixa, comissão faccional, rendimento e capacidade
  - distinção entre:
    - adquirir/instalar
    - configurar
    - coletar caixa

- [x] **B.1.7** Validar a distinção entre os dois sistemas
  - `Jogo do Bicho` = ação/aposta
  - `Maquininha` = ativo/propriedade/operação
  - critério:
    - o jogador entende a diferença sem precisar perguntar
    - o jogador sabe onde abrir cada um

- [x] **B.1.8** Critério final do bloco
  - `Jogo do Bicho` está exposto e jogável no mobile
  - `Maquininha` está descoberta e gerenciável sem fricção
  - os dois usam o padrão novo de UX do projeto

### B.2 — Fechar feedback assíncrono de guerra

> **Status atual**
>
> - concluído
> - o app agora detecta guerra encerrada mesmo depois de retorno offline
> - o desfecho vira:
>   - notificação local quando disponível
>   - modal imediato ao reabrir
>   - resumo persistente no `Painel Territorial`
> - o impacto pessoal também ficou explícito:
>   - se o jogador participou diretamente
>   - ou se sua facção participou sem ele estar na região

> **Decisões operacionais**
>
> - o fim da guerra precisa virar **evento assíncrono de resultado**, não só mudança de estado territorial
> - o feedback deve existir em 3 camadas:
>   - notificação assíncrona ao voltar para o app
>   - modal de resultado imediato ao abrir
>   - histórico/estado legível no `Painel Territorial`
> - o resultado precisa separar:
>   - desfecho da guerra
>   - impacto territorial
>   - impacto pessoal do jogador
> - não pode depender do jogador rolar tela, abrir aba errada ou interpretar score cru

> **Arquivos-alvo esperados**
>
> - `apps/mobile/src/screens/TerritoryScreen.tsx`
> - `apps/mobile/src/screens/HomeScreen.tsx`
> - `apps/mobile/src/features/notifications.ts`
> - `apps/mobile/src/notifications/NotificationProvider.tsx`
> - `apps/mobile/src/services/api.ts`
> - `packages/shared/src/types.ts`
> - `apps/server/src/services/territory.ts`
> - opcionalmente `apps/server/src/api/routes/territory.ts` se o payload precisar ser enriquecido

- [x] **B.2.1** Criar detecção de guerra encerrada para retorno assíncrono
  - identificar quando uma guerra saiu de:
    - `declared`
    - `preparing`
    - `active`
    para:
    - `attacker_won`
    - `defender_won`
    - `draw`
    - `cancelled`
  - o app precisa detectar isso mesmo se o jogador estiver offline no momento da resolução

- [x] **B.2.2** Disparar notificação/alerta quando a guerra terminar
  - notificação local quando fizer sentido
  - fallback por toast/modal ao reabrir o app
  - sem depender de o jogador “caçar” o resultado no `Painel Territorial`

- [x] **B.2.3** Exibir resumo final da guerra em modal de resultado
  - facções envolvidas
  - favela disputada
  - vencedor
  - score final
  - rounds resolvidos
  - espólio
  - impacto territorial

- [x] **B.2.4** Exibir impacto pessoal do jogador na guerra
  - conceito ganho/perdido
  - HP / nervos / stamina consumidos ou perdidos
  - qualquer recompensa individual relevante
  - se o jogador não participou diretamente, isso também precisa ficar claro

- [x] **B.2.5** Manter o desfecho legível dentro do `Painel Territorial`
  - resumo final não pode sumir depois do modal
  - a favela precisa manter um estado final claro por um período útil
  - o painel deve explicar quem ganhou e o que mudou naquela favela

- [x] **B.2.6** Critério final do bloco
  - o jogador recebe aviso quando a guerra termina
  - o jogador entende quem ganhou
  - o jogador entende o que aconteceu com a favela
  - o jogador entende o que aconteceu com ele

### B.3 — Fechar feedback assíncrono de treino e universidade

> **Status atual**
>
> - concluído
> - `Treino` agora dispara lembrete assíncrono, modal de retorno e persistência local de visto
> - `Universidade` agora dispara lembrete assíncrono, modal de conclusão e persistência local de visto
> - o jogador não precisa mais “caçar” o fim do treino/curso ou lembrar sozinho de voltar

> **Decisões operacionais**
>
> - treino e universidade precisam seguir a mesma linha que já fechamos em:
>   - crimes
>   - tribunal
>   - guerra
> - o término deve existir em 3 camadas:
>   - detecção assíncrona ao voltar para o app
>   - notificação local quando fizer sentido
>   - modal imediato de resultado ao reabrir
> - o feedback precisa separar:
>   - ação concluída
>   - custo já consumido
>   - ganho/passivo liberado
>   - impacto prático no personagem
> - o jogador não pode depender de:
>   - scroll
>   - banner perdido na tela
>   - “lembrar de voltar” depois

> **Arquivos-alvo esperados**
>
> - `apps/mobile/src/screens/TrainingScreen.tsx`
> - `apps/mobile/src/screens/UniversityScreen.tsx`
> - `apps/mobile/src/features/notifications.ts`
> - `apps/mobile/src/notifications/NotificationProvider.tsx`
> - `apps/mobile/App.tsx`
> - `apps/mobile/src/stores/appStore.ts`
> - `apps/mobile/src/services/api.ts`
> - opcionalmente helpers novos em `apps/mobile/src/features/`
> - opcionalmente payloads mais explícitos no backend se faltar contexto do resultado

- [x] **B.3.1** Notificar término de treino
  - local notification quando a sessão terminar
  - CTA claro para resgatar

- [x] **B.3.2** Exibir resultado do treino imediatamente no retorno
  - atributos ganhos
  - custo já gasto
  - streak / multiplicador aplicado
  - sem depender de leitura escondida na tela

- [x] **B.3.3** Notificar término de curso universitário
  - local notification quando o curso acabar
  - explicação curta do passivo liberado

- [x] **B.3.4** Exibir conclusão da universidade como resultado
  - curso concluído
  - passivo liberado
  - impacto prático no personagem

- [x] **B.3.5** Persistir conclusão já vista para não repetir modal indefinidamente
  - guardar localmente quais treinos/cursos já tiveram resultado consumido visualmente
  - evitar repetição infinita de pop-up a cada abertura do app

- [x] **B.3.6** Critério final do bloco
  - o jogador recebe aviso quando o treino termina
  - o jogador entende o que ganhou com o treino
  - o jogador recebe aviso quando o curso termina
  - o jogador entende qual passivo foi liberado e o impacto prático
  - conclusão de treino/estudo não pode ser silenciosa

### B.4 — Explicar inflação de forma jogável

> **Status atual**
>
> - concluído
> - a inflação agora é comunicada de forma explícita no app
> - o sistema cobre:
>   - hospital
>   - treino
>   - universidade
>   - ofertas sistêmicas do `Mercado Negro`
> - a leitura existe em 3 camadas:
>   - resumo curto na `Home`
>   - painel detalhado nas telas de NPC
>   - tabela completa por dia/multiplicador

> **Decisões operacionais**
>
> - inflação deve continuar sendo tratada como **pressão sistêmica de NPC**, não como ruído abstrato
> - a comunicação precisa responder, sem exigir interpretação:
>   - o que é inflação
>   - o que ela afeta
>   - quanto está hoje
>   - quando sobe de novo
>   - quanto vai subir
> - a UX deve existir em 3 camadas:
>   - leitura curta na home
>   - leitura detalhada em painéis que cobram preço de NPC
>   - tabela didática completa para quem quiser entender a progressão da rodada
> - a inflação deve ser expandida para os serviços de NPC relevantes antes de ser “vendida” como sistema global
> - o sistema deve explicar a decisão prática:
>   - resolver cedo = mais barato
>   - deixar para depois = mais caro

> **Arquivos-alvo esperados**
>
> - `apps/server/src/services/npc-inflation.ts`
> - `apps/server/src/services/hospital.ts`
> - `apps/server/src/services/training.ts`
> - `apps/server/src/services/university.ts`
> - `apps/server/src/services/market.ts`
> - outros serviços de NPC relevantes que hoje ainda usem custo estático
> - `apps/mobile/src/screens/HomeScreen.tsx`
> - `apps/mobile/src/screens/MarketScreen.tsx`
> - `apps/mobile/src/screens/HospitalScreen.tsx`
> - `apps/mobile/src/screens/TrainingScreen.tsx`
> - `apps/mobile/src/screens/UniversityScreen.tsx`
> - opcionalmente helper novo em `apps/mobile/src/features/` para copiar a tabela e a leitura de progressão
> - `packages/shared/src/types.ts` se o payload precisar trazer:
>   - multiplicador atual
>   - próximo multiplicador
>   - dias restantes
>   - tabela completa

- [x] **B.4.1** Criar explicação curta e clara de inflação no jogo
  - o que é
  - o que ela afeta
  - o que muda ao longo da rodada

- [x] **B.4.2** Expandir a inflação para todos os serviços de NPC relevantes
  - incluir os preços oferecidos por NPCs além de hospital, treino e universidade
  - revisar especialmente `Mercado Negro` e demais painéis operados por NPC
  - critério: o jogador percebe que inflação é uma regra sistêmica de NPC, não uma exceção escondida

- [x] **B.4.3** Mostrar no app o efeito prático atual da inflação
  - multiplicador atual
  - serviços afetados
  - leitura de “barato / subindo / caro”
  - dias restantes para o próximo aumento
  - qual será o próximo multiplicador

- [x] **B.4.4** Exibir tabela clara de progressão da inflação ao longo da rodada
  - lista de faixas por dia
  - multiplicador correspondente
  - leitura didática para jogador novo

- [x] **B.4.5** Conectar inflação com decisão do jogador
  - explicar que agir cedo torna NPC services mais baratos
  - explicar que late game pune quem deixou serviços de NPC para depois

- [x] **B.4.6** Critério final
  - o jogador entende:
    - o que ganha
    - o que perde
    - e por que a inflação existe

### B.5 — Progressão automática em facções fixas lideradas por NPC

> **Status atual**
>
> - concluído
> - facções fixas sob liderança NPC agora promovem automaticamente por regra de permanência + level + conceito + vaga
> - facções lideradas por jogador continuam com promoção manual pela cadeia de comando

> **Decisões operacionais**
>
> - a ascensão automática vale **somente** para facções fixas que ainda estejam sob liderança NPC
> - facções criadas/lideradas por jogador continuam com promoção manual por cadeia de comando
> - a promoção automática não deve disparar só por:
>   - entrar forte na facção
>   - ter level alto isoladamente
>   - ter conceito alto isoladamente
> - a regra deve combinar:
>   - tempo mínimo dentro da facção
>   - level mínimo
>   - conceito mínimo
>   - existência de vaga no cargo seguinte
> - a checagem deve acontecer em pontos naturais do jogo:
>   - login/retorno ao app
>   - refresh de perfil
>   - abertura do QG / estado de facção
> - o resultado precisa ter feedback claro:
>   - promoção concluída
>   - motivo da promoção
>   - cargo antigo
>   - cargo novo
>   - ou motivo do bloqueio quando ainda não subiu

> **Arquivos-alvo esperados**
>
> - `apps/server/src/services/faction.ts`
> - `apps/server/src/services/player.ts`
> - `apps/server/src/api/routes/factions.ts`
> - `apps/server/src/api/routes/players.ts`
> - `packages/shared/src/types.ts`
> - `apps/mobile/src/screens/FactionScreen.tsx`
> - `apps/mobile/src/screens/HomeScreen.tsx`
> - `apps/mobile/src/features/notifications.ts`
> - `apps/mobile/src/notifications/NotificationProvider.tsx`
> - `apps/mobile/src/services/api.ts`

- [x] **B.5.1** Criar progressão automática de cargo em facções fixas com liderança NPC
  - enquanto a facção fixa estiver sob liderança NPC, a ascensão não deve depender de ação manual de general/patrão
  - a regra deve continuar manual em facções comandadas por jogador

- [x] **B.5.2** Definir regra de promoção automática sem exploit óbvio
  - avaliar promoção por combinação de:
    - dias na facção
    - level mínimo
    - conceito mínimo
    - existência de vaga no cargo
  - evitar promoção instantânea sem permanência mínima quando o jogador entra já forte na facção

- [x] **B.5.3** Disparar notificação e resultado de ascensão
  - modal / toast / notificação local
  - cargo anterior
  - novo cargo
  - motivo da promoção
  - eventual bloqueio quando não houver vaga

- [x] **B.5.4** Critério final
  - em facções fixas com líder NPC, o jogador sente progressão orgânica de hierarquia
  - em facções lideradas por jogador, continua valendo a promoção manual por cadeia de comando

### B.6 — Fechar economia coletiva da facção

> **Status atual**
>
> - concluído
> - o banco da facção agora funciona como caixa coletivo real
> - o ledger cobre entradas e saídas legíveis, incluindo negócio e upgrade
> - o `Jogo do Bicho` já repassa comissão automática para a facção
> - upgrades da facção agora consomem tesouraria faccional e aparecem no ledger
> - o `QG da Facção` agora explica visualmente como a economia coletiva funciona

> **Decisões operacionais**
>
> - o banco da facção deve virar **caixa coletivo real**, não só saldo decorativo
> - toda entrada e saída precisa virar evento de ledger legível e auditável
> - o ledger precisa responder claramente:
>   - quanto entrou ou saiu
>   - de onde veio ou para onde foi
>   - qual jogador causou a movimentação, quando existir
>   - qual negócio ou sistema causou a movimentação, quando existir
> - o repasse automático deve cobrir:
>   - `Boca`
>   - `Rave`
>   - `Puteiro`
>   - `Loja de Fachada`
>   - `Maquininha`
>   - `Jogo do Bicho`
>   - e qualquer negócio equivalente que declare comissão faccional
> - upgrade da facção deve consumir dinheiro do banco da facção
> - se pontos continuarem existindo, eles devem virar:
>   - requisito complementar
>   - ou métrica secundária
>   - nunca substituto opaco do caixa faccional
> - o `QG da Facção` precisa explicar o ciclo completo da economia coletiva sem exigir leitura de backend

> **Arquivos-alvo esperados**
>
> - `apps/server/src/services/faction.ts`
> - `apps/server/src/services/faction/repository.ts`
> - `apps/server/src/services/boca.ts`
> - `apps/server/src/services/rave.ts`
> - `apps/server/src/services/puteiro.ts`
> - `apps/server/src/services/front-store.ts`
> - `apps/server/src/services/slot-machine.ts`
> - `apps/server/src/services/bicho.ts`
> - outros serviços que declarem ou apliquem comissão faccional
> - `apps/server/src/api/routes/factions.ts`
> - `packages/shared/src/types.ts`
> - `apps/mobile/src/screens/FactionScreen.tsx`
> - `apps/mobile/src/screens/OperationsScreen.tsx`
> - `apps/mobile/src/screens/BichoScreen.tsx`
> - opcionalmente helpers novos em `apps/mobile/src/features/faction/`

- [x] **B.6.1** Garantir ledger completo de entrada e saída do banco da facção
  - toda movimentação precisa registrar:
    - valor
    - origem/destino
    - tipo
    - jogador envolvido quando existir
    - negócio envolvido quando existir
  - cobrir explicitamente:
    - depósito manual
    - saque manual
    - comissão automática de negócio
    - gasto com upgrade
    - estorno/correção operacional quando existir

- [x] **B.6.2** Incluir `Jogo do Bicho` no repasse automático para a facção
  - se o negócio/aposta estiver ligado à facção do jogador, a comissão automática também deve cair no banco faccional
  - precisa aparecer no ledger do mesmo jeito que boca, rave, fachada, puteiro e maquininha
  - a tela do `Jogo do Bicho` também precisa deixar claro quando existe repasse faccional embutido

- [x] **B.6.3** Fazer upgrades da facção consumirem dinheiro do banco da facção
  - hoje o fluxo de upgrade está ancorado em pontos
  - revisar para usar a tesouraria faccional como recurso principal, ou explicitar claramente um modelo híbrido se mantiver pontos
  - critério:
    - antes de comprar, o jogador vê custo e saldo disponível
    - depois da compra, o ledger registra a saída
    - o upgrade não “brota” só de pontos sem impacto econômico

- [x] **B.6.4** Deixar visível no QG da facção como a tesouraria está sendo usada
  - entradas automáticas
  - depósitos manuais
  - saques
  - gastos com upgrade
  - saldo atual
  - idealmente com:
    - resumo por tipo de entrada/saída
    - histórico recente
    - leitura curta de “como a facção se sustenta”

- [x] **B.6.5** Critério final
  - o jogador entende como o dinheiro da facção entra
  - para onde ele vai
  - e por que vale a pena fortalecer a economia coletiva

### B.7 — Revisar documentação operacional de rollout

> **Status atual**
>
> - concluído
> - o [ROLL_OUT.md](./ROLL_OUT.md) foi reduzido para um checklist curto e operacional
> - o smoke crítico foi alinhado ao estado real do produto hoje
> - a referência no `README` foi ajustada para o papel correto do rollout
> - o documento ficou pronto para uso direto em deploy/smoke/rollback

> **Decisões operacionais**
>
> - o [ROLL_OUT.md](./ROLL_OUT.md) deve continuar existindo como checklist curto e operacional
> - ele não deve virar documento de visão, changelog ou backlog
> - ele deve responder de forma objetiva:
>   - o que precisa validar antes de subir
>   - o que precisa subir
>   - o que precisa testar imediatamente depois
>   - quando precisa voltar atrás
> - o smoke do documento deve refletir os fluxos realmente relevantes do jogo hoje:
>   - login
>   - home
>   - mapa
>   - crimes
>   - mercado
>   - território
>   - facção
>   - hospital
>   - prisão
>   - realtime
> - o checklist precisa continuar legível por qualquer pessoa do time sem depender de contexto implícito

> **Arquivos-alvo esperados**
>
> - `ROLL_OUT.md`
> - `README.md` se a referência ao rollout precisar ser ajustada
> - `TODO.md` para registrar o bloco como concluído depois da revisão

- [x] **B.7.1** Revisar o [ROLL_OUT.md](./ROLL_OUT.md) contra o estado real atual do projeto
  - revalidar:
    - pre-deploy
    - variáveis obrigatórias
    - smoke crítico
    - observabilidade mínima
    - rollback
  - remover qualquer instrução velha ou redundante
  - evitar depender de fases já encerradas ou linguagem de plano antigo

- [x] **B.7.2** Atualizar o smoke crítico para o estado real do produto
  - refletir os fluxos móveis que hoje mais importam no playtest:
    - home
    - mapa local
    - macro mapa
    - crimes
    - mercado negro
    - território
    - QG da facção
    - hospital
    - prisão
    - realtime regional e de facção
  - remover smoke que não agrega ou que não existe mais como fluxo primário

- [x] **B.7.3** Tornar o checklist mais curto, direto e usável
  - separar claramente:
    - pre-deploy
    - deploy
    - smoke
    - pos-deploy
    - rollback
  - reduzir blocos redundantes
  - deixar os critérios de falha/rollback mais rápidos de escanear

- [x] **B.7.4** Alinhar a referência ao rollout no `README`, se necessário
  - garantir que o [README.md](./README.md) aponte para o rollout como checklist operacional
  - evitar duplicar o conteúdo do rollout no README

- [x] **B.7.5** Critério final
  - qualquer pessoa do time consegue usar o `ROLL_OUT.md` como checklist real de subida e validação

## Backlog Técnico Pós-Hardening / Pós-Playtest

> Ajustes identificados depois do fechamento do hardening estrutural e do backlog imediato de produto.
> Estes itens não bloqueiam o Pré-Alpha funcional atual, mas representam a próxima camada de robustez, manutenção, acessibilidade e preparação para escala.

### C.1 — Migrar rate limiting e idempotência para store distribuído

> **Prioridade**
>
> - média
> - aceitável para servidor único de playtest
> - bloqueante antes de escalar horizontalmente ou operar múltiplas instâncias do backend

- [x] **C.1.1** Substituir store in-memory do rate limiting por store com Redis
  - manter mesmo contrato HTTP
  - preservar comportamento atual de bloqueio
  - evitar divergência entre múltiplas instâncias

- [x] **C.1.2** Substituir store in-memory da idempotência por store com Redis
  - impedir replay duplicado mesmo com múltiplas réplicas do server
  - manter TTL e semântica atuais

- [x] **C.1.3** Cobrir cenário distribuído em teste
  - provar que duas instâncias simuladas compartilham o mesmo estado de rate limit/idempotência

- [x] **C.1.4** Critério final
  - rate limiting e idempotência continuam funcionando
  - múltiplas instâncias enxergam o mesmo estado

### C.2 — Reduzir mais os hotspots do mobile

> **Prioridade**
>
> - média
> - não é bug funcional hoje
> - reduz risco de regressão e custo de manutenção nas telas mais críticas

- [x] **C.2.1** Continuar o fatiamento de `HomeScreen`
  - extrair subcomponentes claros de:
    - HUD
    - tutorial
    - painel de eventos
    - feedback de combate
    - overlays específicos

- [x] **C.2.2** Continuar o fatiamento de `GameView`
  - extrair mais responsabilidades visuais/interativas
  - reduzir acoplamento entre render, input e labels

- [x] **C.2.3** Controlar o custo de props na extração
  - evitar prop drilling desnecessário
  - preferir hooks/helpers locais ou contexto quando fizer sentido

- [x] **C.2.4** Critério final
  - `HomeScreen` e `GameView` ficam menores e mais previsíveis
  - comportamento visual permanece igual

### C.3 — Reduzir usos de `any` no mobile

> **Prioridade**
>
> - média
> - não bloqueia o funcionamento atual
> - melhora confiança do TypeScript e reduz bugs silenciosos

- [x] **C.3.1** Mapear os usos de `any` por categoria
  - realtime
  - parsing de payload
  - assertions de componentes
  - utilitários diversos

- [x] **C.3.2** Atacar primeiro os `any` de maior risco
  - serviços realtime
  - payloads de API/socket
  - pontos que atravessam estado global

- [x] **C.3.3** Trocar `any` por tipos explícitos ou `unknown` com narrowing
  - evitar só “trocar por outro tipo frouxo”

- [x] **C.3.4** Critério final
  - queda perceptível da contagem de `any`
  - sem perda de legibilidade

### C.4 — Ampliar cobertura de validação no `shared`

> **Prioridade**
>
> - média
> - baixo risco imediato
> - melhora robustez de contratos reaproveitados em server e mobile

- [x] **C.4.1** Cobrir edge cases de email
  - inválidos comuns
  - uppercase/lowercase
  - whitespace
  - formatos estranhos

- [x] **C.4.2** Cobrir edge cases de nickname e texto
  - unicode
  - comprimento extremo
  - colapso de espaços
  - caracteres não desejados

- [x] **C.4.3** Cobrir edge cases monetários e numéricos
  - precisão extrema
  - decimais fora do esperado
  - limites negativos/zero
  - overflow lógico

- [x] **C.4.4** Critério final
  - validators compartilhados têm cobertura para happy path e edge cases relevantes

### C.5 — Introduzir acessibilidade mínima no mobile

> **Prioridade**
>
> - baixa
> - não impacta a funcionalidade central
> - necessária para conformidade, inclusão e qualidade de UI

- [x] **C.5.1** Definir padrão mínimo de acessibilidade para o app
  - `accessibilityLabel`
  - `accessibilityRole`
  - ordem básica de leitura

- [x] **C.5.2** Aplicar primeiro nas telas mais importantes
  - login
  - home
  - crimes
  - mercado
  - território
  - facção
  - hospital
  - prisão

- [x] **C.5.3** Critério final
  - os fluxos principais têm labels e roles mínimas consistentes

### C.6 — Fechar a UI de chat

> **Prioridade**
>
> - baixa
> - funcionalidade de base existe
> - o que falta é surfacing e UX

- [x] **C.6.1** Expor chat de facção no mobile
  - usar o realtime já existente
  - criar entrada clara no fluxo da facção

- [x] **C.6.2** Definir escopo inicial do chat
  - histórico curto
  - envio de mensagem
  - estado de conexão básico
  - sem tentar resolver chat completo “social” de primeira

- [x] **C.6.3** Critério final
  - o jogador consegue ver e enviar mensagens da facção pelo app

### C.7 — Adicionar monitoramento mínimo de performance no mobile

> **Prioridade**
>
> - baixa
> - não bloqueia o funcionamento atual
> - importante para sair de percepção subjetiva e medir gargalo real

- [x] **C.7.1** Definir observabilidade mínima do mobile
  - latência de API
  - falhas de render
  - falhas de realtime
  - sinais básicos de performance percebida

- [x] **C.7.2** Adicionar medição leve sem poluir o app
  - evitar SDK pesado se não houver necessidade imediata
  - priorizar instrumentação simples e útil

- [x] **C.7.3** Planejar ou instalar trilha de crash reporting
  - mesmo que inicial e reduzida
  - com ambiente de staging/dev claramente separado

- [x] **C.7.4** Critério final
  - o time deixa de depender só de impressão subjetiva para investigar performance e crashes

## Legenda de Status

```
[ ] Não iniciado
[~] Em andamento
[x] Concluído
[!] Bloqueado (ver dependência)
[-] Cancelado/Removido
```

## Stack Definida

| Camada | Tecnologia |
|---|---|
| App Framework | Expo (React Native) SDK 52+ |
| Game Rendering | @shopify/react-native-skia |
| Game Loop | react-native-game-engine |
| UI/HUD | React Native (componentes nativos) |
| Navegação | React Navigation 7+ |
| State Management | Zustand |
| Comunicação Real-time | Colyseus Client SDK |
| Linguagem Client | TypeScript 5.x |
| Game Server | Node.js 22 LTS + Colyseus 0.15+ |
| API REST | Fastify 5.x |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache/Pub-Sub | Redis 7 |
| Auth | JWT (access + refresh) + bcrypt |
| Linguagem Server | TypeScript 5.x |
| Monorepo | Turborepo |
| Build Mobile | EAS Build (Expo) |
| CI/CD | GitHub Actions |
| Containerização | Docker Compose (dev), Docker (prod) |
| CDN/Assets | Cloudflare R2 |
| Deploy Server | Docker em VPS (Hetzner/DigitalOcean) |

---

## Marco de Versão Atual

> **Status do marco vigente:** o marco de **Pré-Alpha está novamente fechado**. A build voltou a ser considerada **Pré-Alpha** após o fechamento completo da **Fase 18 — Configuração Dinâmica / Data-Driven**.
>
> **Sequência que fecha a Pré-Alpha após o replanejamento:**
> - **Fase 15**: fechar o core econômico/jogável
> - **Fase 16 — Áudio e Polish**: adicionar base de áudio, feedback sensorial e polish mínimo com assets provisórios
> - **Fase 17 — Estabilização Mobile-First**: consolidar UX mobile, performance percebida, clareza de fluxo e usabilidade real em device
> - **Fase 18 — Configuração Dinâmica / Data-Driven**: tirar parâmetros críticos do hard-code e passar a rodada a ser dirigida por dados persistidos no banco
>
> **Definição operacional de Pré-Alpha neste projeto:** o jogo precisa cobrir conta/personagem, mapa, crimes, inventário, mercado, drogas, negócios, facções, território, tribunal, PvP, prisão/hospital, economia/roubos iniciais, feedback audiovisual placeholder, experiência mobile-first minimamente legível e um núcleo **configurável por banco/rodada** para evitar que cada ciclo do jogo seja sempre idêntico.
>
> **Próxima prioridade após o fechamento da Pré-Alpha:** abrir a **Fase 19 — Testes e Balanceamento**, com foco em:
> - validar a build em device real e separar bug real de recorte ainda não entregue
> - medir latência percebida, responsividade e gargalos de UX/performance
> - consolidar o backlog final de polimento e balanceamento sobre a base data-driven por rodada
>
> **Regra prática a partir daqui:** valores estatísticos, tabelas operacionais e cadastros estruturais do jogo devem tender a ser `database-defined`; hard-code só é aceitável como fallback técnico temporário de bootstrap/migração.

---

# FASE 0 — Infraestrutura e Setup do Projeto

> Setup inicial do monorepo, ambientes de desenvolvimento, CI/CD e configuração base.
> **Dependência:** Nenhuma
> **Entregável:** Projeto rodando localmente com hot-reload no app e no server.

## 0.1 — Monorepo e Estrutura de Pastas

- [x] **0.1.1** Inicializar monorepo com Turborepo
  - `npx create-turbo@latest`
  - Configurar `turbo.json` com pipelines: `build`, `dev`, `lint`, `test`, `typecheck`
  - Workspaces: `apps/mobile`, `apps/server`, `packages/shared`, `packages/game-engine`
  - Arquivo: `turbo.json`, `package.json` (root)

- [x] **0.1.2** Criar workspace `apps/mobile` — Expo App
  - `npx create-expo-app apps/mobile --template blank-typescript`
  - Configurar `app.json`: nome "CS Rio", slug, versão, orientação (landscape + portrait)
  - Instalar dependências core: `expo-dev-client`
  - Configurar `tsconfig.json` com path aliases (`@/`, `@shared/`, `@engine/`)
  - Arquivos: `apps/mobile/app.json`, `apps/mobile/tsconfig.json`, `apps/mobile/package.json`

- [x] **0.1.3** Criar workspace `apps/server` — Game Server
  - Inicializar Node.js + TypeScript
  - Instalar: `colyseus`, `fastify`, `drizzle-orm`, `pg`, `redis`, `jsonwebtoken`, `bcrypt`
  - Configurar `tsconfig.json` com `target: ES2022`, `moduleResolution: bundler`
  - Script de dev com `tsx watch`
  - Arquivos: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/index.ts`

- [x] **0.1.4** Criar workspace `packages/shared` — Tipos compartilhados
  - Definir tipos base: `Player`, `Crime`, `Faction`, `Favela`, `Item`, `Drug`
  - Definir constantes: `LEVELS`, `VOCATIONS`, `REGIONS`, `DRUGS`, `WEAPONS`
  - Definir enums: `VocationType`, `LevelTitle`, `RegionId`, `DrugType`, `CrimeType`
  - Exportar interfaces de mensagens WebSocket (client→server, server→client)
  - Arquivos: `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`, `packages/shared/src/messages.ts`

- [x] **0.1.5** Criar workspace `packages/game-engine` — Engine Isométrica
  - Módulo isolado com a lógica de renderização isométrica
  - Exporta: `Camera`, `TilemapRenderer`, `SpriteSheet`, `InputHandler`, `Pathfinding`
  - Zero dependência de React Native (puro TypeScript + interfaces para Skia)
  - Arquivos: `packages/game-engine/src/index.ts`

## 0.2 — Ambiente de Desenvolvimento

- [x] **0.2.1** Docker Compose para serviços de backend (dev)
  - PostgreSQL 16 (porta 5433 para não conflitar)
  - Redis 7 (porta 6380)
  - Adminer ou pgAdmin para debug de banco
  - Arquivo: `docker-compose.dev.yml`

- [x] **0.2.2** Configurar variáveis de ambiente
  - `.env.example` com todas as variáveis documentadas
  - `apps/server/.env`: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `COLYSEUS_PORT`
  - `apps/mobile/.env`: `API_URL`, `WS_URL`
  - Usar `dotenv` no server, `expo-constants` no mobile
  - Arquivos: `.env.example`, `apps/server/.env.example`, `apps/mobile/.env.example`

- [x] **0.2.3** Configurar ESLint + Prettier (monorepo)
  - Config compartilhada na raiz
  - Rules: `@typescript-eslint/recommended`, `react-hooks/exhaustive-deps`
  - Prettier: single quotes, trailing comma, 100 print width
  - Arquivo: `.eslintrc.js`, `.prettierrc`

- [x] **0.2.4** Configurar Vitest para testes unitários
  - `packages/shared`: testes de cálculos (probabilidade de crime, fórmulas de poder)
  - `packages/game-engine`: testes de pathfinding, conversão de coordenadas iso↔screen
  - `apps/server`: testes de game logic (sistemas de crime, combate, economia)
  - Arquivo: `vitest.config.ts` (raiz), configs por workspace

## 0.3 — CI/CD

- [x] **0.3.1** GitHub Actions — Pipeline de CI
  - Trigger: push/PR em `main` e `develop`
  - Jobs: `lint`, `typecheck`, `test`, `build-server`, `build-mobile-check`
  - Cache de `node_modules` e `.turbo`
  - Arquivo: `.github/workflows/ci.yml`

- [x] **0.3.2** GitHub Actions — Build Mobile (EAS)
  - Trigger: tag `v*` ou manual
  - Usa `eas-cli` para build Android (APK/AAB) e iOS (IPA)
  - Arquivo: `.github/workflows/mobile-build.yml`

- [x] **0.3.3** GitHub Actions — Deploy Server
  - Trigger: push em `main` (path: `apps/server/**`)
  - Build Docker image, push para registry, deploy via SSH
  - Arquivo: `.github/workflows/deploy-server.yml`

## 0.4 — Database Schema Base

- [x] **0.4.1** Setup Drizzle ORM + migrações
  - Configurar `drizzle.config.ts` com conexão PostgreSQL
  - Script de migrate: `drizzle-kit push` / `drizzle-kit generate`
  - Arquivo: `apps/server/drizzle.config.ts`

- [x] **0.4.2** Schema inicial — tabelas core
  - `players`: id, email, password_hash, nickname, vocation, level, conceito, forca, inteligencia, resistencia, carisma, stamina, nerve, hp, addiction, money, bank_money, region_id, position_x, position_y, faction_id, created_at, last_login
  - `factions`: id, name, abbreviation, is_fixed, leader_id, bank_money, bank_drugs, points, created_at
  - `faction_members`: player_id, faction_id, rank, joined_at
  - `favelas`: id, name, region_id, population, difficulty, controlling_faction_id, satisfaction, propina_value, propina_due_date, state_controlled_until
  - `favela_services`: favela_id, service_type, level, active, installed_at
  - `weapons`: id, name, power, durability_max, level_required, price, weight
  - `vests`: id, name, defense, durability_max, level_required, price, weight
  - `player_inventory`: id, player_id, item_type, item_id, quantity, durability, proficiency, equipped_slot
  - `crimes`: id, name, level_required, stamina_cost, nerve_cost, min_power, reward_min, reward_max, conceito_reward, arrest_chance, cooldown_seconds
  - `drugs`: id, name, stamina_recovery, moral_boost, price, addiction_rate, nerve_boost, production_level, weight
  - `properties`: id, player_id, type (boca/factory/puteiro/rave/house/front_store/slot_machine), region_id, favela_id, level, soldiers_count, created_at
  - `soldiers`: id, property_id, type, power, daily_cost, hired_at
  - `market_orders`: id, player_id, item_type, item_id, quantity, remaining_quantity, price_per_unit, side, status, durability_snapshot, proficiency_snapshot, created_at, expires_at
  - `round`: id, number, started_at, ends_at, status
  - `round_rankings`: round_id, player_id, final_conceito, final_rank
  - Arquivo: `apps/server/src/db/schema.ts`

- [x] **0.4.3** Schema — tabelas de facção e território
  - `faction_upgrades`: faction_id, upgrade_type, level, unlocked_at
  - `faction_wars`: id, attacker_faction_id, defender_faction_id, favela_id, status, declared_at, starts_at, ended_at, winner_faction_id
  - `propina_payments`: id, faction_id, favela_id, amount, paid_at, next_due
  - `x9_events`: id, favela_id, triggered_at, soldiers_arrested, drugs_lost, weapons_lost, money_lost
  - Arquivo: `apps/server/src/db/schema.ts` (continuação)

- [x] **0.4.4** Schema — tabelas de tribunal, eventos, social
  - `tribunal_cases`: id, favela_id, case_type, accuser_charisma_community, accuser_charisma_faction, accused_charisma_community, accused_charisma_faction, community_supports (accuser/accused), antigao_hint, punishment_chosen, moral_moradores_impact, moral_facao_impact, conceito_impact, judged_by, judged_at
  - `game_events`: id, event_type, region_id, favela_id, started_at, ends_at, data_json
  - `chat_messages`: id, channel_type, channel_id, sender_id, message, sent_at
  - `contacts`: player_id, contact_id, type (partner/known), since
  - `assassination_contracts`: id, requester_id, target_id, reward, accepted_by, status, created_at
  - `prison_records`: id, player_id, reason, sentenced_at, release_at, released_early_by
  - `transactions`: id, player_id, type, amount, description, created_at
  - Arquivo: `apps/server/src/db/schema.ts` (continuação)

- [x] **0.4.5** Seed de dados fixos
  - 7 facções fixas (CV, TCP, ADA, TC, MIL, LJ, PCC) com territórios iniciais
  - 6 regiões com metadados (riqueza, densidade, bônus)
  - ~50 favelas reais com população, região, dificuldade
  - Tabela de crimes (todos os ~50 crimes do JOGO.md com stats)
  - Tabela de armas (14 armas com stats)
  - Tabela de coletes (9 coletes com stats)
  - Tabela de drogas (7 drogas com stats)
  - Tabela de soldados (5 tipos com stats)
  - Arquivo: `apps/server/src/db/seed.ts`

---

# FASE 1 — Game Engine (Renderização Isométrica)

> Motor de renderização isométrica 2D usando Skia. Roda 100% no client.
> **Dependência:** 0.1.2, 0.1.5
> **Entregável:** Mapa isométrico navegável com tiles, câmera com pan/zoom e personagem andando.

## 1.1 — Sistema de Coordenadas Isométricas

- [x] **1.1.1** Implementar conversão cartesiano ↔ isométrico
  - `cartToIso(x, y)`: converte coordenada de grid para posição na tela
  - `isoToCart(screenX, screenY)`: converte toque na tela para coordenada de grid
  - Suporte a tiles de 128×64px (losango isométrico padrão)
  - Testes unitários para todas as conversões (Vitest)
  - Arquivo: `packages/game-engine/src/coordinates.ts`

- [x] **1.1.2** Implementar sistema de profundidade (Z-sorting)
  - Sprites renderizados na ordem correta (tiles de trás para frente)
  - Algoritmo: ordenar por `y + x` (painter's algorithm adaptado para iso)
  - Suporte a objetos em múltiplas tiles (prédios 2×2, 3×3)
  - Arquivo: `packages/game-engine/src/depth-sort.ts`

## 1.2 — Tilemap Renderer

- [x] **1.2.1** Parser de mapas Tiled (.tmj / .json)
  - Ler formato JSON exportado pelo Tiled Map Editor
  - Suporte a múltiplas layers: ground, objects, collision, regions
  - Extrair dados de colisão e metadados de região
  - Arquivo: `packages/game-engine/src/tilemap-parser.ts`

- [x] **1.2.2** Renderer de tilemap com Skia Canvas
  - Renderizar apenas tiles visíveis na viewport (culling)
  - Usar `Skia.Image` para drawImage de cada tile do spritesheet
  - Batch rendering: agrupar tiles do mesmo spritesheet para minimizar draw calls
  - Layer order: ground → objects → characters → UI overlay
  - Performance target: 60fps com mapa de 200×200 tiles no dispositivo médio
  - Arquivo: `packages/game-engine/src/tilemap-renderer.ts`

- [x] **1.2.3** Criar mapa protótipo no Tiled
  - Tilesheet base (ruas, calçadas, prédios, vegetação, favela)
  - Mapa 200×200 representando 1 região (Zona Norte como protótipo)
  - Layers: terrain, buildings, collision, spawn_points, region_markers
  - Exportar como JSON
  - Arquivo: `apps/mobile/assets/maps/zona_norte.tmj`, `apps/mobile/assets/tilesets/city_base.png`

## 1.3 — Sistema de Câmera

- [x] **1.3.1** Câmera com pan (arrastar) e zoom (pinch)
  - Pan: gesture handler (react-native-gesture-handler) com inércia
  - Zoom: pinch-to-zoom com limites (0.5x a 3x)
  - Smooth interpolation (lerp) para movimentação fluida
  - Limites de câmera: não permitir scroll para fora do mapa
  - Arquivo: `packages/game-engine/src/camera.ts`

- [x] **1.3.2** Câmera seguindo o personagem
  - Modo "follow": câmera centralizada no jogador com dead-zone
  - Modo "free": jogador pode navegar livremente pelo mapa (toque e arraste)
  - Transição suave entre modos
  - Arquivo: `packages/game-engine/src/camera.ts` (extensão)

## 1.4 — Sistema de Sprites

- [x] **1.4.1** Loader de spritesheets
  - Carregar spritesheet (PNG) + metadata (JSON com frames)
  - Suporte ao formato Aseprite (export JSON array)
  - Cache de imagens carregadas (evitar re-decode)
  - Arquivo: `packages/game-engine/src/spritesheet.ts`

- [x] **1.4.2** Sistema de animação de sprites
  - AnimationController: play, pause, loop, speed
  - Suporte a animações por estado: `idle`, `walk_n`, `walk_s`, `walk_e`, `walk_w`, `walk_ne`, `walk_nw`, `walk_se`, `walk_sw`
  - Frame timing independente do game loop (delta-time based)
  - Arquivo: `packages/game-engine/src/animation.ts`

- [x] **1.4.3** Criar sprites protótipo do personagem
  - Spritesheet com 8 direções × 4 frames de caminhada + 1 frame idle por direção
  - Total: 40 frames (8 idle + 32 walk), cada frame ~48×64px
  - Formato: Aseprite → export PNG + JSON
  - Arquivo: `apps/mobile/assets/sprites/player_base.png`, `apps/mobile/assets/sprites/player_base.json`

## 1.5 — Pathfinding e Movimentação

- [x] **1.5.1** Implementar A* para grid isométrico
  - Pathfinding A* considerando collision layer do tilemap
  - Heurística: distância de Manhattan adaptada para isométrico
  - Custo de movimento: 1 para ortogonal, 1.41 para diagonal
  - Máximo de 100 nós expandidos (evitar freeze em paths longos)
  - Arquivo: `packages/game-engine/src/pathfinding.ts`

- [x] **1.5.2** Movimentação do personagem
  - Tap-to-move: tocar na tela define destino, A* calcula path
  - Personagem segue path tile a tile com animação direcional
  - Velocidade de movimento: 3 tiles/segundo (ajustável)
  - Cancelar path se tocar em novo destino
  - Arquivo: `packages/game-engine/src/movement.ts`

- [x] **1.5.3** Input handler para touch
  - Detectar: tap (mover), long press (abrir menu de ação), pan (câmera), pinch (zoom)
  - Integrar com react-native-gesture-handler
  - Distinguir tap em UI overlay vs. tap no game world
  - Arquivo: `packages/game-engine/src/input-handler.ts`

## 1.6 — Game Loop

- [x] **1.6.1** Implementar game loop principal
  - requestAnimationFrame via Skia canvas callback
  - Delta-time calculation para frame-rate independence
  - Update cycle: input → game logic → physics/movement → render
  - Performance monitoring: FPS counter (debug mode)
  - Arquivo: `packages/game-engine/src/game-loop.ts`

- [x] **1.6.2** Integrar Game Loop com React Native
  - Componente `<GameView />` que encapsula Skia Canvas + Game Loop
  - Props: `mapData`, `playerState`, `entities`, `onTileTap`, `onEntityTap`
  - Comunicação com React via callbacks (sem re-render do canvas a cada frame)
  - Arquivo: `apps/mobile/src/components/GameView.tsx`

---

# FASE 2 — Autenticação e Fundação do Jogador

> Sistema de auth, criação de personagem, persistência e sincronização.
> **Dependência:** 0.2, 0.4
> **Entregável:** Jogador faz login, cria personagem, aparece no mapa com atributos persistidos.

## 2.1 — Autenticação (Server)

- [x] **2.1.1** Endpoint `POST /auth/register`
  - Input: email, password, nickname
  - Validação: email único, nickname único (3-16 chars, alfanumérico + _), senha 8+ chars
  - Hash: bcrypt com salt rounds 12
  - Retorno: JWT access token (15min) + refresh token (30 dias)
  - Arquivo: `apps/server/src/api/routes/auth.ts`

- [x] **2.1.2** Endpoint `POST /auth/login`
  - Input: email, password
  - Validação: bcrypt compare
  - Retorno: JWT access + refresh tokens
  - Rate limiting: 5 tentativas por minuto por IP (Redis)
  - Arquivo: `apps/server/src/api/routes/auth.ts`

- [x] **2.1.3** Endpoint `POST /auth/refresh`
  - Input: refresh token
  - Validação: verificar token, verificar não está na blacklist
  - Retorno: novo access token + novo refresh token (rotation)
  - Blacklist do refresh antigo no Redis (TTL = tempo restante do token)
  - Arquivo: `apps/server/src/api/routes/auth.ts`

- [x] **2.1.4** Middleware de autenticação JWT
  - Extrair token do header `Authorization: Bearer <token>`
  - Verificar assinatura e expiração
  - Injetar `playerId` no request
  - Aplicar em todas as rotas exceto `/auth/*`
  - Arquivo: `apps/server/src/api/middleware/auth.ts`

## 2.2 — Criação de Personagem (Server)

- [x] **2.2.1** Endpoint `POST /players/create`
  - Input: vocation (Cria/Gerente/Soldado/Político/Empreendedor), appearance (skin, hair, outfit)
  - Lógica: atribuir stats iniciais conforme tabela de vocação, nível 1 (Pivete), conceito 0, stamina 100%, HP 100
  - Definir posição inicial (spawn point da região escolhida ou aleatório)
  - Arquivo: `apps/server/src/api/routes/players.ts`

- [x] **2.2.2** Endpoint `GET /players/me`
  - Retorna dados completos do jogador autenticado
  - Inclui: stats, inventário, facção, propriedades, localização
  - Cache: Redis com TTL 30s (invalidar em write)
  - Arquivo: `apps/server/src/api/routes/players.ts`

## 2.3 — Autenticação (Mobile)

- [x] **2.3.1** Tela de Login
  - Formulário: email + senha
  - Validação local antes de enviar
  - Loading state, error handling
  - Salvar tokens em `expo-secure-store`
  - Arquivo: `apps/mobile/src/screens/LoginScreen.tsx`

- [x] **2.3.2** Tela de Registro
  - Formulário: email + senha + confirmação + nickname
  - Validação local (formato email, senha forte, nickname válido)
  - Após registro, auto-login
  - Arquivo: `apps/mobile/src/screens/RegisterScreen.tsx`

- [x] **2.3.3** Tela de Criação de Personagem
  - Seletor de vocação (5 opções com descrição e stats preview)
  - Customização visual (skin tone slider, hair style picker, outfit)
  - Preview do personagem (sprite animado com as escolhas)
  - Botão confirmar → cria personagem no server → navega para GameScreen
  - Status atual: preview visual animado reflete `skin`, `hair`, `outfit` e vocação no card de criação
  - Arquivo: `apps/mobile/src/screens/CharacterCreationScreen.tsx`

- [x] **2.3.4** Auth store (Zustand)
  - State: `token`, `refreshToken`, `player`, `isAuthenticated`, `isLoading`
  - Actions: `login()`, `register()`, `logout()`, `refreshAuth()`, `loadStoredAuth()`
  - Interceptor Axios: attach token em requests, auto-refresh em 401
  - Arquivo: `apps/mobile/src/stores/authStore.ts`

- [x] **2.3.5** API client (Axios)
  - Base URL configurável via env
  - Interceptors: auth token, refresh on 401, error formatting
  - Tipagem forte: cada endpoint com tipos de request/response do `shared`
  - Arquivo: `apps/mobile/src/services/api.ts`

## 2.4 — Conexão WebSocket (Colyseus)

- [x] **2.4.1** Configurar Colyseus Server
  - Criar `GameRoom` com state schema (Colyseus Schema)
  - State: jogadores na sala (posição, estado, animação), NPCs, entidades
  - Autenticação via JWT no `onAuth` do room
  - Room por região: `room_zona_norte`, `room_zona_sul`, etc.
  - Máximo 100 jogadores por room
  - Arquivo: `apps/server/src/rooms/GameRoom.ts`, `apps/server/src/rooms/schemas/GameState.ts`

- [x] **2.4.2** Colyseus Client no mobile
  - Conectar ao room da região do jogador
  - Sincronizar posição de outros jogadores em tempo real
  - Reconexão automática em caso de disconnect
  - Arquivo: `apps/mobile/src/services/colyseus.ts`

- [x] **2.4.3** Sincronização de posição do jogador
  - Client envia posição a cada 100ms (throttled)
  - Server valida velocidade de movimento (anti-teleport)
  - Server broadcast posição para outros jogadores na room
  - Client interpola posição de outros jogadores (smooth movement)
  - Arquivo: `apps/server/src/rooms/handlers/movement.ts`

---

# FASE 3 — HUD e Interface do Jogo

> Todos os componentes de UI sobrepostos ao game view.
> **Dependência:** Fase 1, Fase 2
> **Entregável:** Interface completa com HUD, menus, navegação entre telas.

## 3.1 — HUD Principal (sobreposto ao mapa)

- [x] **3.1.1** Barra de status do jogador
  - Exibe: nome, nível/título, HP (barra vermelha), estamina (barra verde), nervos (barra azul), vício (barra roxa), dinheiro no bolso
  - Posição: topo da tela, compacto
  - Toca para expandir detalhes (stats completos)
  - Arquivo: `apps/mobile/src/components/hud/StatusBar.tsx`

- [x] **3.1.2** Minimap
  - Miniatura do mapa da região no canto superior direito
  - Ponto piscante indicando posição do jogador
  - Pontos coloridos para outros jogadores, propriedades, locais
  - Toque para abrir mapa full-screen
  - Arquivo: `apps/mobile/src/components/hud/Minimap.tsx`

- [x] **3.1.3** Barra de ações rápidas
  - Posição: parte inferior da tela
  - Botões: Crimes, Inventário, Facção, Chat, Menu
  - Ícones com badges (notificações)
  - Arquivo: `apps/mobile/src/components/hud/ActionBar.tsx`

- [x] **3.1.4** Menu de ação contextual
  - Aparece ao tocar em NPC, jogador, prédio ou local no mapa
  - Lista ações disponíveis (ex: tocar em Mercado Negro → Comprar/Vender/Reparar)
  - Arquivo: `apps/mobile/src/components/hud/ContextMenu.tsx`

## 3.2 — Telas de Menu (React Navigation Stack)

- [x] **3.2.1** Tela de Inventário
  - Grid de itens (armas, coletes, drogas, impulsos, consumíveis)
  - Detalhes ao tocar: stats, durabilidade, proficiência
  - Ações: equipar, usar, vender, descartar
  - Arquivo: `apps/mobile/src/screens/InventoryScreen.tsx`

- [x] **3.2.2** Tela de Perfil do Jogador
  - Stats completos, vocação, nível, conceito
  - Histórico de conquistas
  - Estatísticas públicas
  - Opção de trocar vocação
  - Arquivo: `apps/mobile/src/screens/ProfileScreen.tsx`

- [x] **3.2.3** Tela de Mapa Full-Screen
  - Mapa de todas as regiões do RJ
  - Favelas marcadas com cores da facção dominante
  - Zoom para ver detalhes de cada região
  - Fast travel: mototáxi para outra região (custo + tempo)
  - Arquivo: `apps/mobile/src/screens/MapScreen.tsx`

- [x] **3.2.4** Tela de Configurações
  - Volume de som/música, qualidade gráfica, idioma
  - Gerenciamento de conta (mudar senha, logout)
  - Sobre o jogo, links de suporte
  - Arquivo: `apps/mobile/src/screens/SettingsScreen.tsx`

---

# FASE 4 — Core Gameplay: Crimes e Progressão

> Loop principal: cometer crimes, ganhar conceito, subir de nível.
> **Dependência:** Fase 2, Fase 3
> **Entregável:** Jogador pode cometer crimes solo, ganhar/perder recursos, ser preso.

## 4.1 — Sistema de Crimes (Server)

- [x] **4.1.1** Crime engine — lógica central
  - Função `attemptCrime(playerId, crimeId)`:
    1. Verificar nível mínimo
    2. Verificar stamina e nervos suficientes
    3. Verificar cooldown
    4. Calcular poder do jogador (atributos + equip + vocação)
    5. Calcular probabilidade de sucesso
    6. Roll aleatório (Math.random vs. probabilidade)
    7. Se sucesso: calcular recompensa (dinheiro, conceito, chance de drop)
    8. Se falha: calcular penalidade (chance de prisão, perda de HP, perda de conceito)
    9. Deduzir stamina e nervos
    10. Atualizar cooldown
    11. Registrar no log de ações
  - Status atual: implementado com persistência em `players`, `transactions`, `prison_records` e drop inicial de drogas via `player_inventory`
  - Arquivo: `apps/server/src/systems/CrimeSystem.ts`

- [x] **4.1.2** Sistema de cooldowns
  - Redis: `crime:{playerId}:{crimeId}` com TTL = cooldown do crime
  - Verificar antes de permitir ação
  - Arquivo: `apps/server/src/systems/CooldownSystem.ts`

- [x] **4.1.3** Sistema de "calor da polícia"
  - Redis: `heat:{playerId}` — score que decai com tempo
  - Cada crime adiciona heat (proporcional à gravidade)
  - Heat alto: aumenta chance de prisão em qualquer crime
  - Decai: -1 ponto a cada 5 minutos reais de inatividade criminal
  - Arquivo: `apps/server/src/systems/PoliceHeatSystem.ts`

## 4.2 — Sistema de Recursos (Server)

- [x] **4.2.1** Regeneração de estamina
  - Timer server-side: calcula estamina baseado no tempo decorrido e estado de moral
  - Não é tick-based — é calculado sob demanda (quando jogador faz ação)
  - Fórmula: `staminaAtual = min(100, staminaSalva + (tempoDecorrido × taxaRecuperação))`
  - Taxa depende do moral, casa, bônus de facção
  - Status atual: implementado com checkpoint temporal e sincronização no `PlayerService` ao abrir `/players/me`
  - Arquivo: `apps/server/src/systems/StaminaSystem.ts`

- [x] **4.2.2** Regeneração de nervos
  - Similar à estamina: sob demanda, não tick-based
  - Taxa fixa: 1 ponto a cada 5 min reais
  - Máximo: 100
  - Status atual: implementado com checkpoint temporal e sincronização no `PlayerService` ao abrir `/players/me`
  - Arquivo: `apps/server/src/systems/NerveSystem.ts`

- [x] **4.2.3** Decaimento de vício
  - Reduz 1% por hora de jogo sem usar drogas
  - Verificação sob demanda (quando jogador tenta ação ou abre perfil)
  - Status atual: implementado com checkpoint temporal, suporte a `recordDrugUse()` e sincronização no `PlayerService`
  - Arquivo: `apps/server/src/systems/AddictionSystem.ts`

- [x] **4.2.4** Sistema de nível / progressão
  - Ao ganhar conceito: verificar se atingiu threshold do próximo nível
  - Se sim: level up → desbloquear features → notificar client
  - Evento: `onLevelUp(playerId, newLevel)` — pode triggar tutoriais
  - Status atual: implementado no `LevelSystem`, aplicado no `PlayerService` e retornado pelo `CrimeSystem` para a UI futura
  - Arquivo: `apps/server/src/systems/LevelSystem.ts`

## 4.3 — Interface de Crimes (Mobile)

- [x] **4.3.1** Tela de lista de crimes
  - Lista agrupada por nível (abas ou seções)
  - Cada crime mostra: nome, custo (estamina/nervos), probabilidade de sucesso (%), recompensa estimada, cooldown restante
  - Crimes bloqueados (nível insuficiente) aparecem em cinza
  - Crimes em cooldown aparecem com timer
  - Toque para executar → confirmação → animação de resultado
  - Status atual: implementado com catálogo vindo de `/api/crimes`, agrupamento por nível, crime selecionado, CTA de confirmação, resumo de recursos e recarga automática após tentativa
  - Arquivo: `apps/mobile/src/screens/CrimesScreen.tsx`

- [x] **4.3.2** Animação/feedback de resultado de crime
  - Sucesso: som + efeito visual verde + popup com recompensas detalhadas
  - Falha: som + efeito vermelho + popup com penalidades
  - Prisão: tela especial de "Preso!" com opções de saída
  - Status atual: implementado com modal animado, temas visuais por resultado, efeitos sonoros locais via `expo-av` e bloco especial de prisão com ações imediatas
  - Arquivo: `apps/mobile/src/components/CrimeResultModal.tsx`

---

# FASE 5 — Equipamento e Mercado Negro

> **Dependência:** Fase 4
> **Entregável:** Jogador compra/vende armas, coletes, itens. Inventário funcional.

- [x] **5.1** Inventário (Server): CRUD de itens, limites de peso/slots, equipar/desequipar
  - Status atual: implementado com capacidade por slots/peso, loadout persistido (`weapon`/`vest`), rotas protegidas de listagem/aquisicao bootstrap/atualizacao/remocao/equipar/desequipar e invalidação de cache do perfil
- [x] **5.2** Mercado Negro (Server): sistema de ordens de compra/venda, matching, comissão 5%
  - Status atual: implementado com order book, criação/cancelamento de ordens de compra/venda, matching autoritativo com comissão de 5%, reserva/devolução de dinheiro, entrega de itens no inventário e rotas protegidas `/api/market/orders`
- [x] **5.3** Durabilidade e reparo: desgaste por uso, endpoint de reparo com custo
  - Status atual: implementado com desgaste autoritativo de arma/colete em crimes, item quebrado indo para `0` e saindo do slot, reparo protegido em `/api/inventory/:inventoryItemId/repair`, custo calculado por dano acumulado e bloqueio de venda de item quebrado
- [x] **5.4** Proficiência de armas: sistema de XP por arma, bônus crescente
  - Status atual: implementado no `CrimeSystem` com ganho autoritativo de XP por uso da arma equipada, persistencia da proficiencia no inventario, teto de progresso e bonus percentual por tiers aplicado ao `playerPower`
- [x] **5.5** Tela de Mercado Negro (Mobile): listagem, busca, filtros, comprar, vender, reparar
  - Status atual: implementada no mobile com `MarketScreen`, leitura do order book, busca local, filtros por tipo, abertura/cancelamento de ordens, fluxo de compra imediata via buy order, anuncio de itens do inventario e reparo direto de armas/coletes
- [x] **5.6** Sistema de leilão: criar leilão, dar lance, timer, notificação de vitória
  - Status atual: implementado end-to-end com tabelas e migration de leiloes, criacao e lances autoritativos no server, liquidacao por expiracao com devolucao de saldo/item, notificacoes de `outbid`/`won`/`sold`/`returned`, rotas protegidas `/api/market/auctions` e interface mobile integrada ao Mercado Negro com timer, feed de notificacoes, criacao de leilao e envio de lances

---

# FASE 6 — Drogas e Vício

> **Dependência:** Fase 4
> **Entregável:** Jogador consome drogas, sistema de tolerância/vício/overdose funcional.

- [x] **6.1** Drug consumption engine (Server): consumir droga → recuperar estamina + moral + nervos, aumentar tolerância + vício
  - Status atual: implementado no server com novo recurso `morale` em `players`, endpoint protegido `/api/inventory/:inventoryItemId/consume`, consumo autoritativo de droga stackavel, ganho de estamina/moral/nervos, aumento de vicio, persistencia de tolerancia por droga em key-value e retorno do perfil atualizado
- [x] **6.2** Sistema de tolerância por droga: decay com tempo, eficiência decrescente
  - Status atual: implementado com `DrugToleranceSystem.sync`, decaimento de 1 ponto por hora sem uso, aplicacao de tolerancia individual antes do consumo e multiplicador progressivo de eficiencia ate `1/45` do efeito base em tolerancia maxima
- [x] **6.3** Sistema de overdose: trigger, hospitalização, penalidades
  - Status atual: implementado com `OverdoseSystem` em key-value, trigger por `stamina_overflow`, `max_addiction` ou mistura de `3` tipos de droga em `1h`, hospitalizacao por `30` minutos reais, bloqueio de novo consumo durante a internacao, perda de `5%` do conceito, reset de vicio para `50`, moral para `0` e remocao de contatos `known`
- [x] **6.4** Fábricas de drogas (Server): produção automática por ciclo, componentes, manutenção
  - Status atual: implementado com catalogo de `components`, `drug_factory_recipes`, `drug_factories` e estoque interno por fabrica, `FactoryService` autoritativo com ciclos por tempo real, consumo de componentes, cobranca de manutencao diaria, suspensao por inadimplencia, coleta da producao para o inventario e rotas protegidas em `/api/factories`
- [x] **6.5** Venda de drogas: tráfico direto, boca, rave, docas com lógica de preço
  - Status atual: implementado no server com `DrugSaleService`, rotas protegidas `/api/drug-sales/quote` e `/api/drug-sales/sell`, venda autoritativa via `street`, `boca`, `rave` e `docks`, calculo dinamico de preco por canal/regiao/atributo/propriedade/evento, custo de estamina no trafico direto, exigencia de propriedade para `boca`/`rave`, exigencia de `navio_docas` ativo no `Centro` para `docks` e persistencia financeira por `transactions`
- [x] **6.6** Interface de consumo de drogas (Mobile): tela de rave/baile, seletor de droga, aviso de overdose
  - Status atual: implementado no mobile com `DrugUseScreen`, contexto alternavel `Rave/Baile`, cardapio de drogas filtrado do inventario, preview local de efeitos, risco e avisos de overdose, consumo real via `/api/inventory/:inventoryItemId/consume`, atualizacao imediata do `authStore` com o perfil retornado pelo server, feedback pos-consumo com tolerancia/eficiencia e destaque de overdose, alem de entrada pela tela de inventario e pelo mapa/context menu
- [x] **6.7** Interface de fábricas (Mobile): criar, gerenciar, estocar componentes, coletar produção
  - Status atual: implementado no mobile com `FactoriesScreen`, consumo real de `/api/factories`, listagem de receitas e fabricas ativas, criacao de laboratorio por receita, gerenciamento de componentes por fabrica, coleta da producao pronta, refresh imediato do perfil para sincronizar inventario/dinheiro, ponto de entrada pelo mapa/context menu e cobertura de helpers/testes de navegacao contextual

---

# FASE 7 — Negócios e Propriedades

> **Dependência:** Fase 5, Fase 6
> **Entregável:** Bocas, raves, puteiros, lojas de fachada, maquininhas, imóveis funcionais.
> **Premissa de design fixada:** propriedades pertencem ao jogador; faccao protege, influencia risco e arrecada comissao fixa sobre negocios lucrativos; patrimonio pessoal nao gera renda, mas exige manutencao e pode receber protecao faccional.
> **Integracao obrigatoria com o que ja existe:** o slice atual de `fabricas` e `venda de drogas` da Fase 6 passa a ser tratado como prototipo operacional e precisa ser absorvido pela economia formal de propriedades da Fase 7.

- [x] **7.1** Sistema de propriedades (Server): comprar, upgradar, manutencao diaria, soldados, protecao, risco, posse e vinculo operacional com faccao
- [x] **7.2** Bocas de fumo: estoque de drogas, venda automatica a NPCs, lucro por localizacao, comissao fixa da faccao
- [x] **7.3** Raves e Bailes: configurar drogas e preco, fluxo de visitantes, receita, comissao fixa da faccao
- [x] **7.4** Puteiros e GPs: compra de GP, tipos, lucro, riscos (fuga, morte, DST)
- [x] **7.5** Lojas de fachada + lavagem de dinheiro: investir, retorno, risco de investigação
- [x] **7.6** Maquininhas de caça-níquel: compra, instalação, odds configuráveis, lucro passivo
- [x] **7.7** Jogo do bicho: apostar, sorteio, pagamento
- [x] **7.8** Imóveis e patrimônio: casa, carro, joias, barcos, iates, jet ski, casa de praia, mansao, avioes, helicopteros, arte e luxo sem renda direta, com custos e protecao
- [x] **7.9** Telas de gerenciamento de negocios e patrimonio (Mobile): dashboard, coletar renda, pagar manutencao, acompanhar risco/protecao, gerenciar soldados

---

# FASE 8 — Treinamento e Universidade

> **Dependência:** Fase 4
> **Entregável:** Treinos funcionais, Universidade do Crime com cursos por vocação.

- [x] **8.1** Centro de treino (Server): sessões com timer real, ganho de stats, rendimento decrescente
- [x] **8.2** Universidade do Crime (Server): cursos com pré-requisitos, timer, efeitos passivos permanentes
- [x] **8.3** Tela de treino (Mobile): selecionar tipo, iniciar, progresso visual, resultado
- [x] **8.4** Tela de universidade (Mobile): árvore de cursos por vocação, status, iniciar curso

---

# FASE 9 — Facções

> **Dependência:** Fase 4
> **Entregável:** Criar/entrar em facção, hierarquia, banco, upgrades, crimes coletivos.

- [x] **9.1** CRUD de facções (Server): criar, dissolver, configurar (nome, sigla, descrição)
- [x] **9.2** Sistema de membros e hierarquia: entrar, sair, promover, rebaixar, expulsar
- [x] **9.3** Banco da facção: depósitos, saques (por cargo), historico, ledger de comissoes automaticas de propriedades dos membros
- [x] **9.4** Sistema de upgrades de facção: pontos, desbloquear upgrades, aplicar bônus
- [x] **9.5** Crimes de facção (Server): coordenação, custo, poder combinado, recompensa dividida
- [x] **9.6** Facções fixas: seed + lógica de NPC líder quando sem jogador líder
- [x] **9.7** Eleição e desafio de liderança: votação, PvP de desafio
- [x] **9.8** Colyseus: FactionRoom para chat e coordenação em tempo real
- [x] **9.9** Telas de facção (Mobile): visão geral, membros, banco, upgrades, guerra, candidatura

---

# FASE 10 — Sistema Territorial (Favelas)

> **Dependência:** Fase 9
> **Entregável:** Conquista de favelas, serviços, satisfação, X9, propina, baile funk.
> **Premissa de design fixada:** dominio territorial total de uma regiao concede vantagem forte em protecao, risco e eficiencia das propriedades dos membros da faccao naquela regiao, mas nunca imunidade.

- [x] **10.1** Favela state machine (Server): estados (neutra, controlada, em_guerra, estado)
- [x] **10.2** Conquista: combate vs boss NPC, cálculo de poder, transição de controle
- [x] **10.3** Serviços de favela: instalar, upgradar, calcular receita (fórmula completa)
- [x] **10.4** Sistema de satisfação: cálculo contínuo, fatores de aumento/diminuição
- [x] **10.5** Bônus de domínio regional: detectar controle total, aplicar/remover bonus de receita, protecao, risco de invasao/roubo/tomada e eficiencia operacional
- [x] **10.6** X9 event engine: roll diário, trigger incursão, cálculo de perdas, desenrolo
- [x] **10.7** Propina/Arrego (Server): cobrança periódica, negociação, inadimplência, tomada pelo Estado
- [x] **10.8** Baile funk (Server): organizar, calcular resultado, aplicar efeitos
- [x] **10.9** Guerra de facção (Server): declaração, preparação, combate (rounds), resultado, cooldown
- [x] **10.10** Telas de território (Mobile): mapa de favelas, detalhes, serviços, satisfação, organizar baile

---

# FASE 11 — Tribunal do Tráfico

> **Dependência:** Fase 10
> **Entregável:** Casos aleatórios, julgamento interativo, impacto moral, Antigão conselheiro.

- [x] **11.1** Case generator (Server): criar caso aleatório com tipo, carisma dos lados, história
- [x] **11.2** Antigão AI: gerar dicas baseadas na verdade do caso e nos impactos de cada punição
- [x] **11.3** Julgamento (Server): receber punição escolhida, calcular impactos em moradores e facção
- [x] **11.4** Tela do Tribunal (Mobile): apresentação do caso, ambos os lados, Antigão, seletor de punição, resultado
- [x] **11.5** Templates de história: ~5 variações de texto por tipo de caso (50+ textos)

---

# FASE 12 — Combate PvP

> **Dependência:** Fase 5
> **Entregável:** Porrada 1v1, emboscada, contratos de assassinato.

- [x] **12.1** Combat engine (Server): cálculo de poder, roll, dano, morte, recompensa
- [x] **12.2** Porrada 1v1: atacar jogador, resultado, loot, hospitalização
- [x] **12.3** Emboscada: grupo vs solo, poder combinado, divisão de recompensa
- [x] **12.4** Contratos de assassinato: criar, aceitar, executar, recompensar, notificações
- [x] **12.5** Proteção de novato: flag nos primeiros 3 dias, bloquear ataques
- [x] **12.6** Tela de combate (Mobile): seleção de alvo, confirmação, animação de resultado
- [x] **12.7** Tela de contratos (Mobile): lista de contratos, criar, aceitar

---

# FASE 13 — Prisão e Hospital

> **Dependência:** Fase 4
> **Entregável:** Mecânica de prisão completa, hospital com todos os serviços.

- [x] **13.1** Prisão (Server): encarceramento com timer, bloqueio de ações, calor da polícia
  - Status atual: `PrisonSystem` autoritativo com leitura de `prison_records` + `PoliceHeatSystem`, estado exposto em `/players/me`, e middleware global de bloqueio `423` para ações protegidas enquanto o jogador estiver preso
- [x] **13.2** Saída da prisão: esperar, suborno, fiança (créditos), fuga (minigame), resgate de facção
  - Status atual: Centro prisional backend em `/api/prison` com saída por espera, suborno, fiança com créditos, fuga resolvida por chance autoritativa no server e resgate de facção com autorização de `Patrão/General`; no pré-alpha a camada mobile da `13.4` fechou a leitura e a tentativa direta, enquanto o minigame visual da fuga segue adiado
- [x] **13.3** Hospital (Server): cura, desintox, cirurgia, consumíveis de stat, DST, plano de saúde
  - Status atual: Centro hospitalar backend em `/api/hospital` com cura, desintoxicação limpando vício/tolerância, cirurgia de nickname/aparência, tratamento de DST, consumíveis permanentes com limite por ciclo e plano de saúde aplicado às próximas hospitalizações; no pré-alpha o ciclo do hospital usa chave mensal até a rodada completa existir
- [x] **13.4** Tela de prisão (Mobile): status da pena, opções de saída, timer
  - Status atual: Centro prisional mobile em `/apps/mobile/src/screens/PrisonScreen.tsx` com timer ao vivo, leitura da faixa de calor, saídas reais (fiança, suborno e fuga) via backend, banner/atalho na Home enquanto o jogador estiver preso e redirecionamento das ações principais bloqueadas; no pré-alpha a fuga segue como ação direta com confirmação, sem minigame visual dedicado
- [x] **13.5** Tela de hospital (Mobile): menu de serviços, compra, timer de tratamento
  - Status atual: Centro hospitalar mobile em `/apps/mobile/src/screens/HospitalScreen.tsx` com timer ao vivo de internação, menu real de tratamento/desintoxicação/DST/plano de saúde, compra de consumíveis permanentes, cirurgia de nickname/aparência e integração na Home com atalho e banner quando o jogador estiver hospitalizado

---

# FASE 14 — Eventos do Jogo

> **Dependência:** Fase 10, Fase 13, Fase 15
> **Entregável:** Eventos programados e aleatórios funcionais.

- [x] **14.1** Event scheduler (Server): cron job (node-cron) verificando eventos programados e rolls aleatórios
  - Status atual: `EventSchedulerService` com `node-cron` no bootstrap do server, tick inicial no start e rolls reais de eventos ambientais regionais (`seca_drogas`, `bonecas_china`, `chuva_verao`) via `game_events`; no pré-alpha o scheduler fica restrito a janelas randômicas já consumidas pelos serviços atuais, enquanto `navio_docas`, operações policiais, `Saidinha de Natal` e sazonais dedicados seguem para `14.2`-`14.6`
- [x] **14.2** Navio nas Docas: ativar porto, preço premium, timer
  - Status atual: `GameEventService` agenda o `navio_docas` no `Centro`, expõe rota protegida `GET /api/events/docks` com fase/timer e, enquanto ativo, o canal `docks` do tráfico ganha preço premium de `1.5x` e demanda ilimitada efetiva (limitada apenas pelo inventário do jogador)
- [x] **14.3** Operação Policial / Blitz: selecionar região, aplicar efeitos, pressão policial territorial e impacto em satisfação
  - Status atual: `GameEventService` agora agenda `operacao_policial` por favela controlada e `blitz_pm` por região, selecionando alvos por risco/pressão, elevando `regions.policePressure`, aplicando impacto imediato moderado na satisfação das favelas afetadas e expondo leitura protegida em `GET /api/events/police`; no pré-alpha esta entrega fecha a janela sistêmica e os efeitos territoriais centrais, enquanto apreensões/prisões profundas e resposta BOPE ficam concentradas nos próximos eventos da fase
- [x] **14.4** Faca na Caveira (BOPE): evento aleatório puxado por calor policial territorial, apreender armas e drogas, matar 2-5% dos soldados e 12-17% dos bandidos, sem prisioneiros e sem desenrolo, com queda posterior do calor
  - Status atual: `GameEventService` agora agenda `faca_na_caveira` em favelas controladas com pressão policial alta, derruba `regions.policePressure` depois da operação, reduz a satisfação dos moradores e a satisfação interna da facção, apreende estoques reais de `boca`, `rave` e `fábrica`, remove 2-5% dos soldados via backend e também aplica mortes reais no pool territorial de bandidos; o evento sai em `GET /api/events/police` com headline, perdas e antes/depois, mantendo os nomes legados de payload `banditsKilledEstimate` por compatibilidade de contrato neste pré-alpha
- [x] **14.5** Saidinha de Natal: liberar imediatamente presos elegíveis, incluindo bandidos presos por roubo, com notificações de retorno à favela
  - Status atual: `GameEventService` agora agenda `saidinha_natal` como evento global raro, solta imediatamente todos os jogadores presos via backend, libera de forma real os lotes de bandidos presos por roubo de volta para suas favelas e registra a janela em `game_events` com headline e resumo dos libertados; no pré-alpha, o payload preserva o nome legado `releasedBanditsEstimate` por compatibilidade, enquanto as notificações visuais/push ficam concentradas na `14.7`
- [x] **14.6** Eventos sazonais: Carnaval, Ano Novo — ativar bônus por período
  - Status atual: `GameEventService` agora agenda `carnaval`, `ano_novo_copa` e a janela sazonal de `operacao_verao`, expondo leitura protegida em `GET /api/events/seasonal`; os bônus econômicos por região passam a ficar ativos de verdade para os serviços que já consomem esses tipos (`rave`, `puteiro`, `tráfico`, `maquininha`, `fachada`) e o clima “PM distraída/reforçada” entra no backend via modulação das chances de `blitz`, `operação policial` e `BOPE`; no pré-alpha, os multiplicadores sazonais de crimes solo continuam documentados, mas a integração completa com o `CrimeSystem` fica para a fase econômica seguinte
- [x] **14.7** Notificação de eventos (Mobile): push notification + banner in-game
  - Status atual: o mobile agora consulta `GET /api/events/docks`, `/events/police` e `/events/seasonal`, consolida um feed unificado de eventos ativos, exibe banner contextual dentro do mapa e dispara alerta estilo push dentro do app via toast global; no pré-alpha, isso fecha a percepção imediata dos eventos sem depender ainda da infraestrutura de push nativo, que permanece dedicada à `16.7`

---

# FASE 15 — Economia, Banco e Roubos

> **Dependência:** Fase 7, Fase 9, Fase 10, Fase 11, Fase 13
> **Entregável:** Banco funcional, roubos estruturados, fluxo econômico balanceado e renda faccional criminal expandida.
> **Premissa de design fixada:** bandidos da favela sao uma entidade separada dos soldados. Soldados protegem propriedades e custam manutencao; bandidos executam roubos, nao geram custo mensal, podem ser presos por 5-30 dias de jogo e retornar por evento/soltura. Politica de roubos da faccao afeta satisfacao dos moradores e satisfacao interna dos membros.

- [x] **15.1** Banco (Server): depósito (limite diário), saque (taxa), juros diários, proteção
  > Entregue com `/api/bank`, `/api/bank/deposit` e `/api/bank/withdraw`, ledger pessoal, limite diário escalado por nível, juros de `1%` ao dia e taxa de saque de `0,5%`.
  > Simplificação de pré-alpha: os juros são sincronizados nas interações com o banco e o ciclo diário usa `America/Sao_Paulo`; a proteção do saldo bancário fica explícita no payload, apoiada no modelo atual em que apreensão/loot/morte consomem apenas `money`.
- [x] **15.2** Efetivo territorial: teto máximo de soldados por favela + pool de bandidos por favela, com crescimento/queda periódicos, presos, mortos e retornos agendados
  > Entregue com `maxSoldiers` em `favelas`, bloqueio real de contratação acima do teto territorial, pool agregado de bandidos por favela (`ativos`, `presos`, `mortos recentes`) e lotes persistidos de retorno agendado.
  > Também entrou sincronização periódica do efetivo por favela via backend territorial, crescimento/queda puxados por dificuldade/população/satisfação interna da facção, seed inicial do efetivo e integração direta com `Operação Policial`, `Faca na Caveira` e `Saidinha de Natal`.
  > Simplificações de pré-alpha: o pool de bandidos é agregado por favela, não individual por NPC; os nomes de payload policial `banditsKilledEstimate` e `releasedBanditsEstimate` foram mantidos por compatibilidade mesmo com contagem real; e os retornos normais dos bandidos sincronizam nas leituras/interações territoriais em vez de job dedicado separado.
- [x] **15.3** Sistema de roubos (Server): roubo a pedestres, veículos, caminhões e celulares; execução por jogador ou bandidos da favela; risco, recompensa, calor da polícia e repasse percentual para a facção
  > Entregue com catálogo protegido em `/api/robberies` e tentativa autoritativa em `/api/robberies/:robberyType/attempt`, cobrindo `pedestrian`, `cellphones`, `vehicle` e `truck`.
  > O backend agora resolve roubos iniciados pelo jogador ou coordenados por bandidos da favela, aplicando cooldown, stamina/nervos, calor policial individual, pressão policial regional, repasse automático para o banco da facção e ledger `robbery_commission`.
  > Também entrou integração direta com o pool de bandidos da `15.2`: falha dos bandidos gera prisão real, reduz efetivo ativo da favela e cria lote persistido de retorno.
  > Simplificações de pré-alpha: o calor territorial dos roubos continua representado por `regions.policePressure`; o lucro líquido do roubo feito por bandidos ainda entra em `money` do jogador como proxy de caixa operacional; e o roubo de veículos permanece genérico nesta etapa, deixando `resgate`, `desmanche` e `Paraguai` para a `15.4`.
- [x] **15.4** Roubo de veículos: subfluxos de devolução com resgate, desmanche/mercado negro e clonagem/venda no Paraguai, com risco e recompensa próprios por rota
  > Entregue dentro do mesmo endpoint autoritativo `/api/robberies/vehicle/attempt`, agora exigindo `vehicleRoute` com as rotas `ransom`, `chop_shop` e `paraguay`.
  > O backend passou a aplicar perfil próprio de recompensa, calor policial, comissão faccional e risco por rota, com cooldown separado por subfluxo.
  > `ransom` agora responde mais fortemente à riqueza da região; `chop_shop` opera com retorno mais estável e menor influência regional; `paraguay` mantém risco estrutural alto independentemente da riqueza local.
  > Simplificações de pré-alpha: os três desfechos ainda liquidam o retorno diretamente em dinheiro, sem abrir estoque persistente de veículos roubados, cadeia física de peças ou mercado/logística dedicados para Paraguai; esses aprofundamentos ficam para a evolução posterior da economia criminal.
- [x] **15.5** Política de roubos da facção: permitir/proibir roubos globalmente ou por região; proibição regional força deslocamento para outra região e aumenta risco de falha pelo percurso
  > Entregue com leitura/edição protegidas em `/api/factions/:factionId/robbery-policy` e enforcement real no backend de roubos.
  > A facção agora pode proibir roubos globalmente ou por região; proibição global bloqueia a ação, e proibição regional desloca o roubo para outra região permitida, marcando `policyDisplacedFromRegionId` no payload e aplicando penalidade extra de falha pelo percurso.
  > O catálogo `/api/robberies` agora também expõe a política ativa da facção para a experiência de coordenação no cliente.
  > Simplificação de pré-alpha: o deslocamento regional é resolvido automaticamente pelo server para a primeira região permitida disponível, em vez de exigir escolha manual do destino pelo jogador.
- [x] **15.6** Satisfação interna da facção: humor dos membros afetado por política de roubos, decisões do líder no Tribunal do Tráfico e perdas em operações; impacto sobre o crescimento/redução de bandidos nas favelas
  > Entregue ligando a satisfação interna da facção à política de roubos e aos resultados do sistema de roubos no backend.
  > Políticas mais restritivas agora derrubam a satisfação interna imediatamente, políticas mais abertas recuperam esse humor, e os roubos também retroalimentam o estado: sucesso do jogador sobe pouco, sucesso dos bandidos sobe mais, falhas derrubam, especialmente quando queimam bonde de rua.
  > Tribunal do Tráfico e Faca na Caveira continuam afetando o mesmo atributo persistido, fechando o ciclo entre liderança, operação e crescimento/redução de bandidos nas favelas.
  > Simplificações de pré-alpha: os deltas ainda são heurísticos e discretos, sem modelo separado por perfil de membro da facção; o efeito é aplicado no agregado da facção e refletido indiretamente no pool de bandidos pela sincronização territorial já existente.
- [x] **15.7** Sistema de inflação: escalonar preços de NPCs com o dia da rodada
  > Entregue com leitor server-side de inflação por dia da rodada e aplicação real sobre preços de NPC em hospital, treino e universidade.
  > O backend agora calcula `moneyMultiplier` a partir do dia corrente da rodada ativa e encarece progressivamente serviços em dinheiro ao longo da rodada, deixando o late-game mais caro e competitivo.
  > O fluxo foi validado tanto na exibição dos centros quanto no momento da cobrança real das ações.
  > Simplificações de pré-alpha: a inflação foi ligada primeiro aos principais sinks de NPC (`hospital`, `training`, `university`); sem rodada ativa persistida, o multiplicador fica neutro em `1.0` até a `15.8`.
- [x] **15.8** Rodadas (Server): iniciar rodada, timer de fim, calcular ranking final, premiar, resetar
  > Entregue com `RoundService` server-side, rota protegida `GET /api/round`, bootstrap da primeira rodada ativa e sincronização do lifecycle tanto em leitura da API quanto no scheduler do backend.
  > Quando a rodada expira, o server fecha o ranking por `conceito`, grava `round_rankings`, premia o top 10 com `5` créditos cada e reseta o mundo jogável antes de abrir a nova rodada.
  > O reset limpa tabelas dinâmicas de economia, PvP, facção, território, mercado, prisão e eventos; jogadores mantêm conta, nickname, aparência, vocação e créditos, mas voltam a recursos/base zero da nova rodada.
  > Simplificações de pré-alpha: o rollover abre a próxima rodada no `now` do sync sem criar “catch-up rounds” se o servidor ficou parado; `Hall da Fama` e bônus herdados continuam para `15.9` e `15.10`; a proteção de novato não é recalculada por rodada porque `characterCreatedAt` é preservado.
- [x] **15.9** Hall da Fama: persistir rankings entre rodadas
  > Entregue com leitura protegida `GET /api/round/hall-of-fame` e agregação histórica a partir de `round` + `round_rankings`.
  > O backend agora expõe cada rodada encerrada com vencedor, `topThree`, datas e total de rodadas finalizadas, reaproveitando o ranking persistido no rollover da `15.8`.
  > O payload compartilhado do Hall da Fama ficou fechado para o mobile consumir depois sem reabrir a modelagem.
  > Simplificações de pré-alpha: o Hall da Fama usa o `nickname` atual do jogador no momento da consulta, sem snapshot histórico de apelido/facção/visual por rodada; esse congelamento fino fica para evolução futura se passar a ser necessário.
- [x] **15.10** Bônus de rodada anterior: calcular e aplicar na nova rodada
  > Entregue no rollover da rodada com bônus herdado aplicado automaticamente ao abrir o novo ciclo.
  > O backend agora transforma a colocação final da rodada anterior em pacote inicial da nova rodada: campeão recebe `R$ 15.000` no bolso + `R$ 7.500` no banco; top 2-3 recebem `R$ 10.000` + `R$ 5.000`; top 4-10 recebem `R$ 5.000` + `R$ 2.500`.
  > A aplicação acontece no mesmo reset autoritativo da `15.8`, sem abrir ações extras no cliente nem exigir resgate manual.
  > Simplificações de pré-alpha: por enquanto só a colocação final da rodada anterior gera bônus herdado; conquistas especiais, marcos territoriais e heranças temáticas continuam para evolução futura.
  > Ajuste operacional posterior: o reset e o seed também reaplicam territórios iniciais das facções fixas, evitando que a rodada nasça inteiramente neutra por ausência de estado base.

- [x] **15.x** Ajustes operacionais pós-fase: mercado híbrido e entrada direta em facções fixas
  > O Mercado Negro do pré-alpha agora é híbrido: mantém order book e leilão P2P entre usuários, mas também nasce com `Fornecedor da rodada` limitado para armas, coletes, drogas e insumos, com reposição programada pelo backend.
  > As facções fixas também passaram a aceitar entrada direta de novos jogadores enquanto houver vagas de substituição de NPCs; a entrada cai sempre no cargo `Cria` e respeita limite de slots exposto no payload de facção.
  > Esses ajustes continuam internos e database-defined: não existe painel administrativo no client, e o controle segue por seed, banco e regras server-side da rodada.

---

# FASE 16 — Áudio e Polish

> **Dependência:** Fases 0-15
> **Entregável:** Sons, música, animações base e onboarding sensorial mínimo para a reta final antes da versão Pré-Alpha.
> **Premissa de produção fixada:** nesta fase entram **áudios genéricos como placeholder**, escolhidos apenas para validar timing, feedback e atmosfera. Esses assets serão substituídos posteriormente por áudio final sem reabrir a integração técnica.

- [x] **16.1** Sistema de áudio: `expo-av` para sons e música
  > Entregue com `AudioProvider` global no mobile, configuração central de modo de áudio e API única para `playSfx`, `playMusic`, `stopMusic` e sincronização musical por região.
  > A tela de Configurações agora controla volumes e mute de música/efeitos em estado global, e o fluxo inicial já usa o sistema para feedback sonoro de notificações e resultado de crimes.
  > O som isolado de crime foi migrado para a camada central, evitando novos `Audio.Sound.createAsync` espalhados pelo app.
  > Simplificações de pré-alpha: as trilhas por região ainda não possuem assets próprios e o catálogo musical fica preparado em modo placeholder até a `16.3`; os efeitos ainda reaproveitam os placeholders existentes até a `16.2`.
- [x] **16.2** Sound effects placeholder: caminhada, crime, combate, notificação, level up, morte
  > Entregue com catálogo placeholder central no mobile e disparo real dos efeitos de caminhada, crime, combate, notificação, level up e morte sem espalhar players nativos pela UI.
  > `GameView` agora dispara som de caminhada ao iniciar deslocamento; crimes usam regra contextual de prisão/falha/sucesso/level up; combate e contratos usam `combat` ou `death` conforme o resultado; notificações do feed continuam sonorizadas pelo `AudioProvider`.
  > Simplificações de pré-alpha: os placeholders ainda reaproveitam poucos arquivos genéricos, servindo para validar timing e sensação de feedback; a etapa não abre mixagem fina, variações por arma ou ambientação diegética.
- [x] **16.3** Música ambiente placeholder: por região (funk na Z.Norte, bossa na Z.Sul, etc.)
  > Entregue com catálogo musical placeholder por região ligado ao `AudioProvider`, sincronização automática conforme `player.regionId` e retomada correta da trilha ao religar a música em Configurações.
  > O mobile agora toca loops provisórios distintos para `Centro`, `Zona Norte`, `Zona Sul`, `Zona Oeste`, `Zona Sudoeste` e `Baixada`, sem reabrir a integração quando os assets finais chegarem.
  > Simplificações de pré-alpha: os loops ainda reaproveitam poucos arquivos genéricos e servem apenas para validar atmosfera e mudança contextual por região; a identidade musical final segue para substituição posterior dos placeholders.
- [x] **16.4** Tutorial interativo: onboarding nos primeiros 30 minutos (guiado por NPCs)
  > Entregue com tutorial em etapas no mobile, guiado por NPCs, ativo no início da sessão do personagem e progressão real por ação do jogador.
  > O fluxo cobre cinco passos do loop base: andar no mapa, abrir crimes, treino, mercado e território, sempre com copy curta, objetivo claro, CTA e progresso visível.
  > Simplificações de pré-alpha: o tutorial fica no cliente, ancorado na home, com janela de 30 minutos da sessão atual; a persistência longa do onboarding e o rastreio profundo por telemetria ficam para a fase de estabilização.
- [x] **16.5** Animações de transição entre telas
  > Entregue com transição nativa consistente no stack mobile (`slide_from_right`, `fade`, `fade_from_bottom`, gesto habilitado) e entrada animada do conteúdo nas telas internas via `InGameScreenLayout`.
  > As telas do jogo agora entram com fade + leve deslocamento vertical, reduzindo a sensação de “troca seca” entre módulos e ajudando o usuário a perceber mudança de contexto.
  > Simplificações de pré-alpha: a etapa não abre motion design completo por fluxo nem animações customizadas por tela; o objetivo foi fechar uma base uniforme e leve para navegação mobile sem penalizar performance.
- [x] **16.6** Efeitos visuais: partículas em level up, combate, crime
  > Entregue com `FeedbackBurst` placeholder no mobile, disparado nos cards de resultado de crime, combate PvP e execução de contrato, usando variantes visuais para `success`, `danger`, `combat` e `level_up`.
  > Os bursts ficam presos ao container do resultado e reaproveitam uma regra central de mapeamento, evitando ifs visuais espalhados pelas telas e permitindo troca posterior por VFX finais sem reabrir a integração.
  > Simplificações de pré-alpha: as partículas ainda são placeholders 2D leves em `Animated`, sem shader, física ou composição por arma/contexto; o objetivo foi fechar resposta visual imediata para level up, sucesso e risco antes da estabilização mobile-first.
- [x] **16.7** Notificações push: `expo-notifications` para eventos, ataques, fim de timer
  > Entregue com infraestrutura nativa de notificações no mobile via `expo-notifications`, canal Android dedicado, permissões revisáveis em Configurações e integração no app root.
  > O app agora dispara alertas locais para três frentes do pré-alpha: eventos globais detectados pelo feed, notificações de contratos/ataques via mural PvP e fim de timer de prisão/hospital por agendamento nativo.
  > Simplificações de pré-alpha: o recorte usa notificações locais e polling, não push remoto com token Expo/servidor; ataques diretos de porrada/emboscada ainda não geram alerta dedicado fora do fluxo de contratos, e timers cobertos nesta etapa ficam em prisão/hospital.

---

# FASE 17 — Estabilização Mobile-First

> **Dependência:** Fases 1, 2, 3, 10, 16
> **Entregável:** Experiência mobile-first utilizável para playtest real, com mapa protagonista, HUD compacto, linguagem clara, feedback imediato e baseline audiovisual placeholder.
> **Premissa de design fixada:** esta fase é intermediária e corretiva; deve priorizar legibilidade, hierarquia visual, tempo de resposta percebido e onboarding mínimo, sem esperar o polish final definitivo.
> **Critério de aceite fixado para sensação de resposta:** `<50ms` para ações críticas de UI e `<100ms` para manter imediatismo percebido. Acima disso, usar `optimistic UI`, `skeleton loading`, `prefetch` e `cache`.
> **Marco de release:** o fechamento desta fase deixa o jogo pronto para o último gate técnico antes da **versão Pré-Alpha**, que passa a ser a **Fase 18 — Configuração Dinâmica / Data-Driven**.

- [x] **17.1** Reestruturar Home do jogo (Mobile): mapa ocupar a maior parte da tela, remover cabeçalho pesado, respeitar safe area e viewport
- [x] **17.2** HUD mínimo por padrão: status, minimapa e ações recolhidos/expansíveis sob toque, sem poluir o mapa
- [x] **17.3** Ações principais em bottom sheet/menu contextual: reduzir botões espalhados e excesso de cards simultâneos
- [x] **17.4** Mobile-first layout audit: corrigir overflow, largura de botões/cards, áreas de toque e densidade visual em telas críticas
  > Entregue com auditoria dos pontos mais expostos ao playtest em device estreito: `StatusBar`, `Minimap`, `ActionBar`, `HomeScreen` e `InGameScreenLayout`.
  > O mobile agora compacta melhor HUD e header em larguras menores, evita duas colunas quando o espaço real não comporta, reduz densidade visual da shell in-game e protege melhor o mapa contra overflow de overlays.
  > Simplificações de pré-alpha: a auditoria foi concentrada nos módulos mais críticos para leitura do loop; a passada semântica complementar foi fechada em `17.6`.
- [x] **17.5** Feedback imediato ao toque: loading, disabled states, estados vazios e mensagens contextuais nas ações principais
  > Entregue com resposta visual imediata nas ações mais críticas do mobile: `Crimes`, `Combate`, `Contratos`, `Prisão`, `Hospital` e `Configurações`.
  > O app agora troca labels no primeiro toque, exibe progresso por ação (`Executando...`, `Processando...`, `Sincronizando...`, `Aplicando...`), bloqueia reenvio duplicado durante a mutação e dispara mensagens contextuais antes da resposta final da API para reduzir a sensação de falha silenciosa.
  > Simplificações de pré-alpha: o pacote foi concentrado nos fluxos com maior round-trip percebido no playtest; prefetch/optimistic UI mais profundos ficam para a validação de device da Fase 19.
- [x] **17.6** Clareza semântica e linguagem: corrigir acentuação, labels opacas/siglas e explicar “onde estou / o que posso fazer / próximo passo”
  > Entregue com passada semântica nos fluxos mais expostos ao playtest: `HUD`, `Home`, `Crimes`, `Combate`, `Contratos`, `Facção`, `Território`, `Perfil` e `Rave/Baile`.
  > O app agora reduz siglas opacas, corrige acentuação e substitui termos confusos por linguagem mais direta para leitura em device real.
  > Resultado prático: a **Fase 17** fecha a camada de UX mobile-first necessária para o marco Pré-Alpha, mas o release ainda depende da nova **Fase 18 — Configuração Dinâmica / Data-Driven**.
- [x] **17.7** Onboarding mínimo do primeiro uso: guia curto no mapa com loop inicial recomendado para o jogador

### Bloqueadores críticos observados em device real

- **Latência percebida impeditiva:** praticamente todo clique aparenta travar ou falhar. O jogo hoje não atende a meta mínima de resposta imediata para playtest.
- **Mapa voltando a sumir sob overlays:** qualquer iteração futura de HUD deve preservar o viewport do mapa como elemento dominante e sempre visível.
- **HUD ainda quebrando layout em telas estreitas:** labels longas como recursos/status não podem estourar linha de forma confusa; priorizar ícones e nomenclatura curta, clara e nativa de mobile.
- **Ambiguidade entre “bug” e “ainda não implementado”:** enquanto o jogo estiver incompleto, fluxos indisponíveis devem sinalizar claramente `em construção`, `indisponível neste build` ou equivalente para não contaminar o playtest.
- **Conclusão prática registrada:** a estabilização forte desta fase fechou o bloco de UX da Pré-Alpha; a prioridade agora migra para tirar o jogo do hard-code e torná-lo configurável por rodada antes do funil pesado de validação.

---

# FASE 18 — Configuração Dinâmica / Data-Driven

> **Dependência:** Fases 4-17
> **Entregável:** parâmetros críticos do jogo dirigidos por dados persistidos no banco, com ativação por rodada e sem depender de hard-code para balanceamento vivo.
> **Papel no roadmap atual:** esta fase foi puxada para **antes do marco de Pré-Alpha** para garantir que o jogo já nasça ajustável entre rodadas sem exigir reimplantações ou alteração manual de constantes espalhadas no código.

- [x] **18.1** Catálogo central de definições dinâmicas
  - Criar o backbone de configuração persistida com tabelas como `game_config_sets`, `game_config_entries`, `round_config_overrides` e `feature_flags`
  - Suportar escopo por `global`, `round`, `region`, `favela`, `faction_template`, `event_type`, `robbery_type`
  - Cada entrada deve ter `key`, `value_json`, `status (active/inactive)`, `effective_from`, `effective_until`, `notes`
  - O backend deve sempre ler configuração ativa da rodada antes de cair em fallback técnico
  > Entregue com schema persistido, migration, seed idempotente do conjunto padrão `pre_alpha_default_2026_03`, feature flags iniciais e serviço central `GameConfigService` no backend.
  > O catálogo já resolve prioridade `override da rodada > definição ativa do set > fallback técnico`, suporta desativação por status e fallback global por escopo (`region`, `favela`, `event_type`, `robbery_type`).
  > Simplificações desta etapa: ainda não existe client administrativo nem comando operacional; a maior parte dos sistemas ainda usa constantes próprias até a migração progressiva da `18.10`, mas o backbone data-driven já está vivo no banco e seedado para a rodada.

- [x] **18.2** Regiões, favelas e facções fixas 100% database-defined
  - Tirar do hard-code os dados estruturais de `regions`, `favelas` e facções fixas
  - Passar para o banco: população, dificuldade, riqueza, pressão policial base, limites territoriais, teto de soldados, crescimento base de bandidos, bônus regionais, descrições e afinidades
  - Seed continua existindo, mas como carga inicial de banco, não como fonte viva de verdade
  > Entregue com novos campos persistidos em `regions`, `favelas` e `factions` para ordenar, ativar/desativar, definir spawn, pressão policial base, teto de soldados, alvo base de bandidos, satisfação padrão e identidade de templates fixos.
  > O seed agora grava esses valores explicitamente no banco e o runtime passou a consumi-los em pontos críticos: cadastro/login inicial, criação de personagem, reset de rodada, leitura de regiões e sincronização do pool de bandidos.
  > Simplificações desta etapa: os enums/tipos estruturais ainda existem no código como guarda técnica de compatibilidade, mas a rodada deixou de recalcular região/favela/facção fixa por fórmula embutida; a migração mais ampla dos sistemas restantes continua em `18.7` e `18.10`.

- [x] **18.3** Tipos de roubos e rotas de veículos configuráveis
  - Tirar do hard-code a tabela de roubos: `pedestrian`, `cellphones`, `vehicle`, `truck`
  - Roubo de veículo deve ter rotas persistidas: `ransom`, `chop_shop`, `paraguay`
  - Cada tipo/rota precisa ser configurável em risco, recompensa, calor, cooldown, comissão faccional e requisitos
  - Permitir ativar/desativar tipos de assalto por rodada sem expor client administrativo
  > Entregue com seed persistido de `robbery.definition` e `robbery.vehicle_route_definition`, feature flags por tipo e por rota, e leitura central no `RobberyService` via `GameConfigService`.
  > O catálogo `GET /api/robberies` agora já respeita ativação/desativação por rodada, e a execução real também passou a respeitar o banco ao calcular label, requisitos, cooldown, recompensa, calor e comissão.
  > Simplificações desta etapa: os enums/tipos técnicos de `RobberyType` e `VehicleRobberyRoute` continuam existindo por compatibilidade de contrato no Pré-Alpha; a fonte de verdade operacional, porém, já passou a ser o banco.

- [x] **18.4** Eventos 100% configuráveis por banco
  - Tipos de evento deixam de ser fechados no código e passam a usar definições persistidas
  - Cada evento precisa ter: chave, título, headline, janela, peso/probabilidade, regiões elegíveis, regras de ativação, payload base e flag de uso na rodada
  - Cobrir `navio_docas`, `operação_policial`, `blitz_pm`, `faca_na_caveira`, `saidinha_natal`, `carnaval`, `ano_novo_copa`, `operação_verão` e futuros eventos criados diretamente no banco
  > Entregue com seed persistido de `event.definition` para todos os eventos já suportados pelo recorte atual, feature flags por tipo e leitura real no `GameEventService` via `GameConfigService`.
  > O scheduler e os endpoints de eventos agora respeitam o banco para `headline`, duração, cooldown, multiplicadores sazonais, regiões elegíveis, pressão/perdas base e ativação/desativação por rodada, mantendo o comportamento atual só como fallback técnico.
  > Simplificações desta etapa: o backend continua com o scheduler preso ao conjunto de tipos que o server já conhece (`navio_docas`, eventos policiais, `saidinha_natal` e sazonais atuais); criar um evento totalmente novo só pelo banco ainda exigirá suporte de execução no server, enquanto a parametrização dos eventos existentes já deixou de ser hard-coded.

- [x] **18.5** Economia territorial e de negócios parametrizada
  - Mover para o banco os parâmetros de serviços de favela, negócios, comissões, manutenção, multiplicadores regionais, thresholds de satisfação e perdas/ganhos por evento
  - Isso inclui quanto se ganha/perde em BOPE, X9, guerra, propina, operações e serviços
  - O código deve consumir uma camada de `resolved config` e não números literais espalhados
  > Entregue com novo resolvedor de economia (`economy-config`) alimentado por `game_config_entries` para `economy.property_definition`, `economy.property_event_profile`, `territory.service_definition`, `territory.propina_policy` e `territory.propina_region_profile`.
  > Negócios (`boca`, `rave`, `puteiro`, `front_store`, `slot_machine`) e território passaram a ler do banco definições econômicas, perfis de evento, comissão, manutenção, propina e serviços de favela, deixando de depender operacionalmente de números literais espalhados.
  > Simplificações desta etapa: o ciclo técnico de operação dos serviços de favela e parte das fórmulas derivadas de negociação/penalidade ainda vivem no server; a fonte de verdade dos parâmetros centrais já ficou persistida e pode ser rebalanceada por rodada sem refactor.

- [x] **18.6** Snapshot de configuração por rodada
  - Ao abrir uma nova rodada, congelar um snapshot da configuração ativa daquela rodada
  - Mudanças posteriores devem poder valer só para a próxima rodada ou por override explícito
  - Isso evita drift imprevisível no meio do ciclo competitivo
  > Entregue com snapshot automático do catálogo resolvido ao abrir cada rodada, persistindo entradas em `round_config_overrides`, feature flags em `round_feature_flag_overrides` e um marcador estrutural do snapshot da rodada.
  > O `GameConfigService` agora detecta snapshot ativo da rodada e passa a resolver `entries` e `featureFlags` exclusivamente a partir do congelamento daquela rodada, impedindo que mudanças no set ativo vazem para o ciclo competitivo em andamento.
  > Simplificações desta etapa: o snapshot congela os tipos/flags já suportados pelo resolvedor atual; a injeção operacional explícita continua para `18.8`, reaproveitando as mesmas tabelas de override/snapshot em vez de criar client administrativo.

- [x] **18.7** Camada de resolução de configuração no server
  - Criar serviço central de leitura/merge/cache das definições ativas
  - Toda regra que hoje lê constante direta deve migrar para esse resolvedor
  - Prioridade de resolução: `override da rodada > definição ativa do banco > fallback técnico do código`
  > Entregue com `ServerConfigService` unificando catálogo dinâmico, economia resolvida e definições de mundo/região atrás de uma camada única de leitura com cache por rodada e cache estrutural de regiões/favelas/templates.
  > `auth`, `player`, `property` e `realtime` passaram a consumir essa camada central, removendo leituras fragmentadas de `WorldDefinitionService`, `REGIONS` e `PROPERTY_DEFINITIONS` como fonte operacional direta.
  > Simplificações desta etapa: parte das fórmulas auxiliares ainda usa resolvedores especializados em memória (`economy-config`) e a migração exaustiva de todos os sistemas restantes continua para `18.10`, mas a porta de entrada do server para configuração ativa já ficou centralizada.

- [x] **18.8** Comandos internos e injeção operacional
  - Preparar infraestrutura server-side para mudanças operacionais futuras sem client admin
  - O alvo desta etapa não é entregar UI administrativa; é permitir que você injete ajustes por comando/script interno e os aplique na rodada certa
  - Registrar cada mudança em log/auditoria
  > Entregue com `ConfigOperationService`, script interno `npm run ops:config --workspace @cs-rio/server -- --file <payload.json>` (ou `--json`), suporte a batch transacional e seleção de alvo por set ativo/código/id e por rodada ativa/número/id.
  > Os comandos operam sobre `game_config_entries`, `feature_flags`, `round_config_overrides` e `round_feature_flag_overrides`, registram cada mutação em `config_operation_logs`, avançam a versão em `config_runtime_state` e invalidam os caches do `ServerConfigService` sem exigir client admin nem reinício do processo.
  > Simplificações desta etapa: a trilha de auditoria ainda é funcional, mas a validação profunda de `value_json`, constraints semânticas e operações sobre templates estruturais de mundo continuam para `18.9` e `18.10`; por enquanto o foco ficou em injeção operacional segura sobre o catálogo/flags/overrides já persistidos.

- [x] **18.9** Validação, constraints e trilha de auditoria
  - Validar schema dos `value_json` por tipo de configuração
  - Impedir configuração quebrada, incoerente ou sem escopo
  - Registrar quem/quando/o quê foi alterado, mesmo que inicialmente seja sempre alteração local/manual
  > Entregue com `ConfigValidationService`, validando semanticamente `scope`, `targetKey`, existência do alvo e payloads dos tipos já dinamizados (`round.*`, `bank.*`, `territory.*`, `faction.*`, `events.*`, `favelas.max_soldiers`, `robbery.definition`, `robbery.vehicle_route_definition`, `event.definition`, `economy.property_definition`, `economy.property_event_profile`, `territory.service_definition`, `territory.propina_policy` e `territory.propina_region_profile`), além das feature flags operacionais conhecidas.
  > O schema passou a impor constraints de `effective_until > effective_from` e `target_key` não-vazio nas tabelas de catálogo/override/flags, enquanto `config_operation_logs` ganhou `batchId`, `summary`, `validationJson`, `beforeJson` e `afterJson`, fechando a trilha de auditoria por lote e por mutação.
  > Simplificações desta etapa: a validação profunda ficou concentrada nas chaves já migradas para o catálogo dinâmico; a edição estrutural mais rica de templates de mundo e a migração exaustiva dos consumidores restantes continuam para `18.10`.

- [x] **18.10** Migração dos sistemas atuais para o modelo data-driven
  - Refatorar crimes, roubos, eventos, território, facções fixas, regiões, favelas e economia para usar a nova fonte dinâmica
  - O objetivo é sair desta fase com o jogo funcionando no mesmo recorte atual, mas com balanceamento vivo vindo do banco
  > Entregue com migração operacional dos consumidores centrais restantes para resolvedores data-driven: ciclo de rodada (`round`), crimes (`CrimeSystem`), crimes coletivos (`FactionCrimeSystem`), território (`territory`), política padrão de roubos de facções (`faction` / `robbery`) e catálogo econômico seedado a partir do banco.
  > O backend agora resolve políticas críticas por catálogo persistido (`round.*`, `crime.policy`, `faction_crime.policy`, `territory.conquest_policy`, `faction.default_*`) e usa o banco como fonte operacional do balanceamento da rodada, mantendo hard-code apenas como fallback técnico encapsulado para bootstrap/segurança.
  > Resultado prático: a **Fase 18** fecha o gate técnico que havia reaberto a Pré-Alpha. A build volta a ser considerada **Pré-Alpha**, agora com núcleo configurável por banco e snapshot por rodada.

---

# FASE 19 — Testes e Balanceamento

> **Dependência:** Fases 4-18
> **Entregável:** Pré-Alpha validada, balanceada e com backlog crítico consolidado.
> **Papel no roadmap atual:** esta fase é o primeiro grande funil de validação da **versão Pré-Alpha** já incluindo o núcleo data-driven por rodada, com ênfase em device real, latência percebida e separação entre bug real e feature ainda não entregue.

- [ ] **19.1** Testes unitários: todos os sistemas server-side (crime, combate, economia, etc.)
- [ ] **19.2** Testes de integração: fluxos completos (registrar → criar personagem → crime → subir nível)
- [ ] **19.3** Testes de carga: simular 500+ jogadores simultâneos (k6 ou Artillery)
- [ ] **19.4** Balanceamento de economia: simulação de 1 rodada com bots (verificar inflação/deflação)
- [ ] **19.5** Balanceamento de crimes: verificar progressão de dificuldade, recompensa vs risco
- [ ] **19.6** Balanceamento de PvP: verificar que nenhuma vocação é dominante
- [ ] **19.7** Balanceamento territorial: verificar que facções fixas não são imbatíveis
- [ ] **19.8** Playtest fechado: 20-50 testers, coletar feedback, iterar
- [~] **19.9** Testes E2E mobile em device real: fluxo completo do jogador, medir latência percebida, separar bug real de feature ainda não implementada e consolidar backlog final de UX/performance
  > Andamento atual: passada ampla de revisão do português visível no mobile (telas, componentes e mensagens), corrigindo acentuação, cedilha e clareza semântica dos fluxos mais expostos ao playtest.

---

# FASE 20 — Social (Chat e Contatos)

> **Dependência:** Fase 2
> **Entregável:** Chat global/local/facção/privado, contatos, perfis públicos.

- [ ] **20.1** Chat server (Colyseus ou Redis pub/sub): canais global, local, facção, privado, comércio
- [ ] **20.2** Rate limiting de chat: max 1 msg/segundo, anti-flood
- [ ] **20.3** Filtro de palavras proibidas: lista + regex, punição automática
- [ ] **20.4** Sistema de contatos: adicionar parceiro/conhecido, limites, perda por eventos
- [ ] **20.5** Perfil público: stats, conquistas, facção — endpoint + tela
- [ ] **20.6** Tela de chat (Mobile): tabs por canal, input, mensagens, timestamp
- [ ] **20.7** Tela de contatos (Mobile): lista, adicionar, remover, enviar mensagem

---

# FASE 21 — Monetização

> **Dependência:** Fase 3
> **Entregável:** Loja de créditos, compra in-app, itens cosméticos.

- [ ] **21.1** Loja de créditos (Server): catálogo de itens, verificar saldo, comprar
- [ ] **21.2** In-App Purchase: integrar `expo-in-app-purchases` (Google Play + App Store)
- [ ] **21.3** Itens cosméticos: skins, roupas, emotes, molduras — aplicar no personagem
- [ ] **21.4** Créditos gratuitos: recompensa por nível, achievements, login diário
- [ ] **21.5** Tela da loja (Mobile): grid de itens, preview, comprar, equipar

---

# FASE 22 — Anti-Cheat e Segurança

> **Dependência:** Fase 2
> **Entregável:** Detecção de multi-conta, anti-bot, validação server-side.

- [ ] **22.1** Device ID tracking: `expo-application` device ID, vincular à conta
- [ ] **22.2** Validação server-side de todas as ações (nunca confiar no client)
- [ ] **22.3** Rate limiting por endpoint: Redis sliding window
- [ ] **22.4** Anti-speedhack: validar timestamps de ações (cooldowns, movimentação)
- [ ] **22.5** Sistema de report: jogador reporta outro, fila de moderação
- [ ] **22.6** Sistema de ban: ban temporário/permanente, motivo, endpoint admin

---

# FASE 23 — Build e Publicação

> **Dependência:** Fase 19, Fase 22
> **Entregável:** App nas stores, server em produção, monitoramento.

## 23.1 — Infraestrutura de Produção

- [ ] **23.1.1** Provisionar VPS (Hetzner ou DigitalOcean): 4vCPU, 8GB RAM, 80GB SSD
- [ ] **23.1.2** Setup Docker em produção: Dockerfile para server, docker-compose.prod.yml
- [ ] **23.1.3** PostgreSQL em produção: managed database ou self-hosted com backup automático
- [ ] **23.1.4** Redis em produção: managed ou self-hosted com persistência
- [ ] **23.1.5** Nginx reverse proxy: SSL (Let's Encrypt), WebSocket upgrade, rate limiting
- [ ] **23.1.6** Monitoramento: Uptime Kuma ou Grafana + Prometheus para métricas de server
- [ ] **23.1.7** Logging: estruturado com pino (Fastify default), rotação de logs
- [ ] **23.1.8** Backup automatizado: pg_dump diário → Cloudflare R2

## 23.2 — App Stores

- [ ] **23.2.1** Configurar EAS Build: `eas.json` com profiles (development, preview, production)
- [ ] **23.2.2** Configurar signing: keystore Android, certificados iOS
- [ ] **23.2.3** App Store metadata: ícone, screenshots, descrição, classificação etária (18+)
- [ ] **23.2.4** Google Play metadata: ícone, screenshots, descrição, classificação etária
- [ ] **23.2.5** Privacy Policy e Terms of Service (requisito das stores)
- [ ] **23.2.6** Build de produção Android (AAB) via EAS
- [ ] **23.2.7** Build de produção iOS (IPA) via EAS
- [ ] **23.2.8** Submit para review: Google Play (3-7 dias) e App Store (1-3 dias)
- [ ] **23.2.9** Beta fechado: TestFlight (iOS) + Internal Testing (Google Play)

## 23.3 — Lançamento

- [ ] **23.3.1** Soft launch: liberar para região limitada (BR apenas)
- [ ] **23.3.2** Monitorar métricas: DAU, retenção D1/D7/D30, crash rate, server load
- [ ] **23.3.3** Hotfix pipeline: EAS Update (OTA) para correções urgentes sem re-review
- [ ] **23.3.4** Launch público: abrir para todos

---

# Resumo de Dependências entre Fases

```
Fase 0 (Infra)
├── Fase 1 (Engine)
│   └── Fase 3 (HUD/UI) ──→ Fase 21 (Monetização)
├── Fase 2 (Auth/Player) ──→ Fase 20 (Social), Fase 22 (Anti-Cheat)
│   ├── Fase 4 (Crimes/Progressão)
│   │   ├── Fase 5 (Equipamento/Mercado) ──→ Fase 12 (PvP)
│   │   ├── Fase 6 (Drogas/Vício)
│   │   │   └── Fase 7 (Negócios) ──→ Fase 15 (Economia/Roubos)
│   │   ├── Fase 8 (Treino/Universidade)
│   │   ├── Fase 9 (Facções)
│   │   │   └── Fase 10 (Território) ──→ Fase 17 (Estabilização Mobile-First)
│   │   │       ├── Fase 11 (Tribunal) ──→ Fase 15 (Economia/Roubos)
│   │   │       └── Fase 14 (Eventos)
│   │   └── Fase 13 (Prisão/Hospital) ──→ Fase 14 (Eventos), Fase 15 (Economia/Roubos)
│   └── Fase 2.4 (WebSocket)
│
Fases 0-15 ──→ Fase 16 (Áudio e Polish) ──→ Fase 17 (Estabilização Mobile-First) ──→ Fase 18 (Configuração Dinâmica) ──→ Marco Pré-Alpha ──→ Fase 19 (Testes) ──→ Fases 20-23 conforme replanejamento pós-validação
```

---

# Métricas de Progresso

| Fase | Tarefas | Concluídas | % |
|---|---|---|---|
| Fase 0 — Infra | 17 | 17 | 100% |
| Fase 1 — Engine | 15 | 15 | 100% |
| Fase 2 — Auth/Player | 14 | 14 | 100% |
| Fase 3 — HUD/UI | 8 | 8 | 100% |
| Fase 4 — Crimes | 9 | 9 | 100% |
| Fase 5 — Equipamento | 6 | 6 | 100% |
| Fase 6 — Drogas | 7 | 7 | 100% |
| Fase 7 — Negócios | 9 | 9 | 100% |
| Fase 8 — Treino | 4 | 4 | 100% |
| Fase 9 — Facções | 9 | 9 | 100% |
| Fase 10 — Território | 10 | 10 | 100% |
| Fase 11 — Tribunal | 5 | 5 | 100% |
| Fase 12 — PvP | 7 | 7 | 100% |
| Fase 13 — Prisão/Hospital | 5 | 5 | 100% |
| Fase 14 — Eventos | 7 | 7 | 100% |
| Fase 15 — Economia, Banco e Roubos | 10 | 10 | 100% |
| Fase 16 — Áudio e Polish | 7 | 7 | 100% |
| Fase 17 — Estabilização Mobile-First | 7 | 7 | 100% |
| Fase 18 — Configuração Dinâmica / Data-Driven | 10 | 10 | 100% |
| Fase 19 — Testes | 9 | 0 | 0% |
| Fase 20 — Social | 7 | 0 | 0% |
| Fase 21 — Monetização | 5 | 0 | 0% |
| Fase 22 — Anti-Cheat | 6 | 0 | 0% |
| Fase 23 — Launch | 21 | 0 | 0% |
| **TOTAL** | **214** | **166** | **78%** |

---

> Este documento é a fonte de verdade para o progresso do desenvolvimento.
> Atualizar status das tarefas conforme forem sendo implementadas.
