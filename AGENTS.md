# AGENTS.md - cs_rio

Siga primeiro o guia global em `/home/cesar/projects/mcp/AGENTS.md`.

## Regras deste projeto

- Nao use comandos `git` em nenhuma circunstancia.
- Atualize o arquivo da atividade em `mcp/docs/atividades_em_execucao/atual/` antes de responder no chat.
- Em edicoes manuais de codigo, use `apply_patch`.
- Antes de tratar `JOGO.md` como contrato funcional, consulte `PRODUCT_STATUS.md`.
- Se uma entrega mudar o status real de um sistema do jogo, atualize `PRODUCT_STATUS.md` junto com `JOGO.md` e `TODO.md` quando necessario.

## Guardrails de arquitetura e manutencao

- Clean Code e SOLID nao sao opcionais neste projeto. Toda entrega nova deve privilegiar:
  - responsabilidade unica por modulo, classe, hook e funcao
  - baixo acoplamento e contratos explicitos entre camadas
  - composicao sobre concentracao de regras em arquivos gigantes
  - centralizacao de logica transversal em helpers/servicos reutilizaveis, nao em copias espalhadas
- Antes de adicionar mais codigo a um arquivo grande, avalie primeiro se o comportamento pertence a:
  - um modulo novo
  - um helper dedicado
  - uma subfeature isolada
  - um repositorio/servico mais especializado
- Nao e aceitavel continuar criando ou expandindo arquivos de 1000~2000+ linhas como caminho padrao. Isso e tratado como risco de manutencao e deve ser evitado ativamente.
- Os principios SOLID precisam aparecer no desenho do codigo, nao so no discurso:
  - `S` (`Single Responsibility`): um modulo nao deve concentrar validacao, regra de negocio, persistencia, serializacao e notificacao ao mesmo tempo
  - `O` (`Open/Closed`): extensoes devem preferir registro, composicao e factories, evitando cadeias de `if/else` ou `switch` centrais que exigem edicao recorrente
  - `L` (`Liskov Substitution`): contratos e interfaces devem manter comportamento coerente; mocks e adapters nao podem quebrar invariantes do fluxo real
  - `I` (`Interface Segregation`): dependencias devem enxergar apenas o subconjunto de metodos que realmente usam
  - `D` (`Dependency Inversion`): regras de dominio nao devem depender de detalhes concretos de infra quando um contrato pequeno resolver
- Limites praticos obrigatorios para codigo novo ou refactorado:
  - services/server: alvo de ate `800` linhas; acima disso, split obrigatorio
  - repositories/server: alvo de ate `800` linhas; acima disso, split obrigatorio
  - telas mobile/web: alvo de ate `700` linhas; acima disso, split obrigatorio
  - hooks e controllers de tela: alvo de ate `500` linhas; acima disso, split obrigatorio
  - componentes UI: alvo de ate `400` linhas; acima disso, split obrigatorio
  - documentos tecnicos e roadmaps: alvo de ate `800` linhas por assunto; quando um documento misturar dominios demais, criar indice + subdocs tematicos
  - arquivos acima de `1200` linhas sao considerados estado critico e nao devem receber novas responsabilidades sem decomposicao previa
- Se uma alteracao fizer um arquivo crescer sem reduzir coesao, pare e reorganize. Crescimento linear de responsabilidades e considerado falha de desenho.
- Evite funcoes com multiplos motivos de mudanca. Se a funcao mistura validacao, persistencia, regra de negocio, serializacao e notificacao, ela precisa ser fatiada.
- Evite `god objects`, `god screens`, `god services` e `god repositories`. Se um modulo conhece detalhes demais de subsistemas vizinhos, extraia portas/contratos.
- Regras sistemicas repetidas em 3 ou mais lugares devem virar helper compartilhado, servico especializado ou camada de infraestrutura.
- Todo fluxo mutavel sensivel deve preferir:
  - persistencia atomica
  - helpers de delta/mutacao reutilizaveis
  - contratos que retornem estado real pos-operacao
  em vez de `SELECT -> compute -> UPDATE` ou `SET` absoluto espalhado.
- Refactors estruturais devem preservar comportamento e vir com teste de regressao quando removerem um pattern perigoso ou duplicado.
- Antes de aceitar um arquivo novo ou expandido, passe por este checklist:
  - este arquivo tem um unico motivo dominante de mudanca?
  - existe um contrato menor que reduziria o acoplamento?
  - parte dessa logica pertence a um helper/servico/componente filho?
  - a feature pode crescer no proximo sprint sem empurrar o arquivo para a faixa critica?
  - existe teste cobrindo o risco estrutural que motivou o refactor?
- Documentacao tambem precisa obedecer separacao de responsabilidade:
  - `JOGO.md` nao deve virar changelog tecnico
  - `TODO.md` nao deve absorver especificacao completa de subdominios quando um documento proprio fizer mais sentido
  - planos grandes devem apontar para anexos tematicos em vez de concentrar tudo em um unico arquivo monolitico

## Guardrails de UX e nomenclatura

- `Brisa` e um recurso central do jogador e deve aparecer no `Perfil`, dentro de `Recursos`, ao lado de `Cansaco`, `Disposicao`, `HP`, `Conceito`, `Vicio` e `Caixa`.
- `Brisa` nao pode ser tratada como detalhe escondido de tela secundaria. Sempre que a UI explicar recuperacao de `Cansaco`, consumo de drogas ou overdose, o papel de `Brisa` deve ficar explicito.
- Em `Equipar` (`Inventario`), tocar um item da grade deve expandir o proprio card, revelando status, impacto real e acoes inline. Nao force o jogador a rolar para outro painel de detalhes para agir.
- Mutacoes de `Equipar` como `Equipar`, `Desequipar` e `Reparar` devem abrir modal/popup imediato com o resultado. Nao use apenas feedback perdido na rolagem da tela.
- Evite atalhos duplicados no menu `Mais` que levam ao mesmo destino sem contexto diferente. Se duas entradas abrirem a mesma tela, consolide em uma so ou diferencie claramente a intencao.
- A tela canonica `Gerir ativos` deve separar com clareza:
  - `Operacoes`: ativos que geram caixa, exigem coleta e podem pedir configuracao.
  - `Base e logistica`: imoveis, veiculos e luxo que ampliam mobilidade, slots, recuperacao e protecao.
- Evite rotular ativos de base apenas como `Patrimonio` sem explicar para que servem. O jogador precisa entender o beneficio mecanico do ativo nao lucrativo.
- Em `Dominar area` (`Territorio`), cards de favela e detalhes da favela precisam expor de forma direta a quantidade de `Soldados` e `Bandidos`, sem depender de inferencia ou busca em outra tela.

## Criterio pratico

- Se a acao exigir scroll para descobrir como agir ou para ver o resultado, a UX ainda esta errada.
- Se um recurso ou ativo existir na mecanica e nao estiver explicado na tela onde o jogador espera encontra-lo, a UX ainda esta incompleta.
