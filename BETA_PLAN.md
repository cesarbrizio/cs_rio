# Reestruturação no cs_rio para o lançamento da versão beta

## Requisitos

É importante que as alterações sejam refletidas no cs_rio mobile e desktop, e também seja ajustado o cs_rio_api para garantir a consistência dos dados e funcionalidades em todas as plataformas.

Nessa reestruturação, NÃO devemos ter RETROCOMPATIBILIDADE, ou seja, as mudanças podem ser significativas e NÃO tem que manter a compatibilidade com versões anteriores do cs_rio, pois ainda não está operacional. Pode mexer - inclusive - em arquivos de migrations já existentes, e não tem que manter a estrutura atual do banco de dados.

Isto posto, vamos:

- Combate PvP
Remover tudo relacionado a combate PvP, incluindo tabelas, modelos, controladores, rotas associadas, painéis no desktop e mobile, além dos itens que possam vir a ser relacionados a essa funcionalidade.

- Contratos PvP
Remover tudo relacionado a contratos PvP, incluindo tabelas, modelos, controladores, rotas associadas, painéis no desktop e mobile, além dos itens que possam vir a ser relacionados a essa funcionalidade.

- Territórios
É preciso haver consistência nos botões, as opções de 'Conquistar', 'Declarar Guerra', não devem ser exibidas quando a favela for dominada pela facção do jogador, somente quando a favela for dominada por outra facção ou estiver neutra.
Já o botão de 'Negociar arrego', deve ser exibido somente quando a favela for dominada pela facção do jogador, e não deve ser exibido quando a favela for dominada por outra facção ou estiver neutra.
Os serviços e baile também só devem ser exibidos quando a favela for dominada pela facção do jogador, e não devem ser exibidos quando a favela for dominada por outra facção ou estiver neutra.
Pode ser que haja mais coisas que não foram mencionadas aqui, mas que também precisem ser ajustadas para garantir a consistência da experiência do usuário em relação aos territórios.

- Inventário
Aparentemente essa opção só está disponível no desktop, e não no mobile. É necessário garantir que o inventário esteja disponível em ambas as plataformas, e que as funcionalidades relacionadas ao inventário sejam consistentes entre elas.

- Operações
Aparentemente essa opção só está disponível no desktop, e não no mobile. É necessário garantir que o inventário esteja disponível em ambas as plataformas, e que as funcionalidades relacionadas ao inventário sejam consistentes entre elas.
Além disso, deve ser exibido no card uma tag "Fundos insuficientes" quando o jogador não tiver dinheiro suficiente para realizar a operação, e essa tag deve ser removida quando o jogador tiver dinheiro suficiente.
Eu não testei nada das operações, portanto eu não sei como está funcionando, é importante garantir que:
> Imóveis (casa, casa de praia, mansão) não gerem nenhum tipo de renda para o jogador e, ainda geram despesas (como manutenção, impostos, etc).
> Artigos de luxo (carro, moto, barco, iate, jet ski, avião, helicóptero, jóias, arte) não gerem nenhum tipo de renda para o jogador e nem despesas.
> Já negócios (boca de fumo, rave, baile funk, puteiro, loja de fachada, maquininha de caça níqueis, fábrica de drogas, etc) geram renda para o jogador, embora também tenham alguma despesa (como segurança, prostitutas, etc) mas eles geram - sobretudo - renda.
> Tudo isso: se gera renda/despesa, qual é o valor dessa renda/despesa por dia, qual é o tipo de item (imóvel, luxo, negócio) se há itens disponíveis para venda, devem ser exibidos no card da operação, e o jogador deve ser informado sobre esses detalhes antes de realizar a compra do item.
> O item "Luxo" não faz sentido nenhum, remover (não confundir com os artigos de luxo, que são itens de luxo, mas que não geram renda nem despesa, ou seja, são apenas itens de coleção, status, etc).
> Além disso, no app mobile, corretamente, após adquirir uma maquininha de caça níqueis ou um puteiro, é possível contratar seguranças, contratar prostitutas, etc. Tudo isso tem que estar disponível no desktop também, e as funcionalidades relacionadas a esses itens devem ser consistentes entre as plataformas.
> Já no mobile, por outro lado, não é possível adquirir uma boca de fumo, rave, baile funk, loja de fachada, fábrica de drogas, imóveis e artigos de luxo não estão sendo exibidos.
> Por fim, os imóveis e negócios devem estar - obrigatoriamente - associados a um item no mapa, ou seja, o jogador só pode adquirir um imóvel ou negócio se houver um item correspondente no mapa, e esse item deve ser exibido no mapa para que o jogador possa interagir com ele.
> Aparentemente isso não funciona assim atualmente, e é extremamente importante que isso seja ajustado com detalhamento e precisão. O que possivelmente podem exigir até mesmo mudanças no editor de mapa para garantir essa consistência. De modo que a quantidade de itens será definida pelo mapa.
> Artigos de luxo não são itens no mapa, mas também deve ter uma quantidade disponível em estoque, que deve ser definida no banco de dados, e os jogadores poderão adquirir até o limite do estoque disponível, e quando o estoque acabar, os jogadores não poderão mais adquirir esse item até que o estoque seja reabastecido. Entretanto, eles poderão vender/comprar de outros jogadores (e isso vale para todo tipo de item, seja ele um imóvel, negócio ou artigo de luxo)

- Sabotagem
Remover tudo relacionado a contratos sabotagem, incluindo tabelas, modelos, controladores, rotas associadas, painéis no desktop e mobile, além dos itens que possam vir a ser relacionados a essa funcionalidade.

- Treino
Remover tudo relacionado a treino, incluindo tabelas, modelos, controladores, rotas associadas, painéis no desktop e mobile, além dos itens que possam vir a ser relacionados a essa funcionalidade.

- Ranking
No desktop tem, no mobile não tem. É necessário garantir que o ranking esteja disponível em ambas as plataformas, e que as funcionalidades relacionadas ao ranking sejam consistentes entre elas.

- Mapa
No mapa do mobile aparece o mapa, de fato, mas no desktop só aparecem as regiões para o jogador clicar, sem o mapa visível. A experiência do mapa mapa deve ser mais próxima da que temos no mobile.

- Eventos
Se um evento não me afetou em nada (por exemplo: ocorreu em uma favela que não tenho participação), não tem porque eu receber uma notificação desse evento. Isso deixa o jogo poluído de notificações irrelevantes, e pode até mesmo fazer com que os jogadores ignorem as notificações, o que é ruim para a experiência do usuário. É necessário revisar o sistema de notificações para garantir que os jogadores recebam apenas notificações relevantes e importantes para eles, evitando poluir a experiência do usuário com informações irrelevantes.
Eu tenho SIM que ser notificado sobre TODOS os eventos que afetaram o jogador, inclusive guerras e o seu resultado, conquistas e perdas de territórios, operações que deram certo ou errado, etc. Mas não tem porque me notificar sobre eventos que não me afetaram em nada, como guerras em territórios que eu não tenho participação, conquistas e perdas de territórios que eu não tenho participação, operações de outros jogadores que não me afetaram em nada, etc.
Ajuste o sistema de notificações para garantir que os jogadores recebam apenas notificações relevantes e importantes para eles, evitando poluir a experiência do usuário com informações irrelevantes.

- UI/UX
Especialmente no desktop, a interface do usuário não está considerando um JOGADOR de um game. É incrível, mas a IA alucinou bizarramente, e ela coloca informações do tipo "Desktop jogavel", "Treinos assincronos reais do backend, com progressao por tempo, custos, ganhos projetados e resgate no fim da sessao.", "Mercado real do backend com livro de ordens, leiloes, minhas ordens e reparo de loadout direto do shell desktop."
Isso não faz nenhum sentido, é uma burrice enorme, não existe expor essas informações técnicas para o jogador, isso é algo que só os desenvolvedores precisam saber, e não tem que ser exposto para os jogadores, pois isso não agrega nada para a experiência do usuário, e pode até mesmo confundir os jogadores, fazendo com que eles não entendam o que estão vendo na tela, além de fazer o jogo parecer extremamente amador, e não profissional. É necessário revisar toda a interface do usuário, especialmente no desktop, para garantir que as informações exibidas sejam relevantes, compreensíveis e agreguem valor para a experiência do jogador, evitando expor informações técnicas desnecessárias que possam confundir ou distrair os jogadores. A interface deve ser projetada com o foco no jogador, garantindo uma experiência intuitiva, agradável e imersiva.
No mobile pode ser que ainda haja resquícios disso, como vamos fazer uma equivalência canônica entre as plataformas, é importante revisar toda a interface do usuário no mobile também, para garantir que as informações exibidas sejam relevantes, compreensíveis e agreguem valor para a experiência do jogador, evitando expor informações técnicas desnecessárias que possam confundir ou distrair os jogadores. A interface deve ser projetada com o foco no jogador, garantindo uma experiência intuitiva, agradável e imersiva em ambas as plataformas.

- Equivalência
O app mobile está bem diferente do desktop, e é CRUCIAL que haja uma equivalência CANÔNICA entre as duas plataformas, ou seja, as funcionalidades, dados e experiência do usuário devem ser consistentes e equivalentes em ambas as plataformas, garantindo que os jogadores tenham a mesma experiência e acesso às mesmas funcionalidades, independentemente de estarem usando o desktop ou o mobile.
Exemplo: No app está 'Fazer corre', no desktop está 'Crimes'. NÃO PODE, tem que ser 'Fazer corre' em ambas as plataformas, ou 'Crimes' em ambas as plataformas, mas não pode ser diferente. O mesmo vale para todas as outras funcionalidades, dados e experiências do usuário em ambas as plataformas.
Tem que ser feito um levantamento minucioso de todas as funcionalidades, dados e experiências do usuário em ambas as plataformas, para garantir que haja uma equivalência canônica entre elas, e que os jogadores tenham a mesma experiência e acesso às mesmas funcionalidades, independentemente de estarem usando o desktop ou o mobile.

## Plano

[escreva aqui o plano detalhado]