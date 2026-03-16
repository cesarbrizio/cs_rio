# AGENTS.md - cs_rio

Siga primeiro o guia global em `/home/cesar/projects/mcp/AGENTS.md`.

## Regras deste projeto

- Nao use comandos `git` em nenhuma circunstancia.
- Atualize o arquivo da atividade em `mcp/docs/atividades_em_execucao/atual/` antes de responder no chat.
- Em edicoes manuais de codigo, use `apply_patch`.
- Antes de tratar `JOGO.md` como contrato funcional, consulte `PRODUCT_STATUS.md`.
- Se uma entrega mudar o status real de um sistema do jogo, atualize `PRODUCT_STATUS.md` junto com `JOGO.md` e `TODO.md` quando necessario.

## Guardrails de UX e nomenclatura

- `Brisa` e um recurso central do jogador e deve aparecer no `Perfil`, dentro de `Recursos`, ao lado de `Cansaco`, `Disposicao`, `HP`, `Conceito`, `Vicio` e `Caixa`.
- `Brisa` nao pode ser tratada como detalhe escondido de tela secundaria. Sempre que a UI explicar recuperacao de `Cansaco`, consumo de drogas ou overdose, o papel de `Brisa` deve ficar explicito.
- No `Inventario`, tocar um item da grade deve expandir o proprio card, revelando status, impacto real e acoes inline. Nao force o jogador a rolar para outro painel de detalhes para agir.
- Mutacoes do `Inventario` como `Equipar`, `Desequipar` e `Reparar` devem abrir modal/popup imediato com o resultado. Nao use apenas feedback perdido na rolagem da tela.
- Evite atalhos duplicados no menu `Mais` que levam ao mesmo destino sem contexto diferente. Se duas entradas abrirem a mesma tela, consolide em uma so ou diferencie claramente a intencao.
- A tela hoje chamada de `Operacoes e Base` deve separar com clareza:
  - `Operacoes`: ativos que geram caixa, exigem coleta e podem pedir configuracao.
  - `Base e logistica`: imoveis, veiculos e luxo que ampliam mobilidade, slots, recuperacao e protecao.
- Evite rotular ativos de base apenas como `Patrimonio` sem explicar para que servem. O jogador precisa entender o beneficio mecanico do ativo nao lucrativo.
- Em `Territorio`, cards de favela e detalhes da favela precisam expor de forma direta a quantidade de `Soldados` e `Bandidos`, sem depender de inferencia ou busca em outra tela.

## Criterio pratico

- Se a acao exigir scroll para descobrir como agir ou para ver o resultado, a UX ainda esta errada.
- Se um recurso ou ativo existir na mecanica e nao estiver explicado na tela onde o jogador espera encontra-lo, a UX ainda esta incompleta.
