export interface DesktopNavigationItem {
  description: string;
  label: string;
  path: string;
}

export const primaryNavigationItems: DesktopNavigationItem[] = [
  {
    description: 'Volte para a rua, acompanhe a rodada e veja o que esta pegando ao seu redor.',
    label: 'Na rua',
    path: '/home',
  },
  {
    description: 'Escolha seu proximo corre, veja risco e bote dinheiro no bolso.',
    label: 'Fazer corre',
    path: '/crimes',
  },
  {
    description: 'Compre, venda, repare e dispute leiloes no mercado negro.',
    label: 'Negociar',
    path: '/market',
  },
  {
    description: 'Equipar, consumir, reparar e revisar cada item do loadout.',
    label: 'Equipar',
    path: '/inventory',
  },
  {
    description: 'Cuide dos negocios, da base e dos bens que sustentam seu corre.',
    label: 'Gerir ativos',
    path: '/operations',
  },
  {
    description: 'Comande membros, caixa, liderança e melhorias da faccao.',
    label: 'Falar com a faccao',
    path: '/faction',
  },
  {
    description: 'Dominio de favela, servicos, arrego, X9 e guerra.',
    label: 'Dominar area',
    path: '/territory',
  },
  {
    description: 'Julgue os casos da favela e acompanhe os avisos do tribunal.',
    label: 'Julgar caso',
    path: '/tribunal',
  },
  {
    description: 'Estude, libere passivos e avance na sua trilha.',
    label: 'Estudar',
    path: '/university',
  },
  {
    description: 'Troque a build, veja o cooldown e acompanhe o peso da sua vocacao.',
    label: 'Gerir vocacao',
    path: '/vocation',
  },
  {
    description: 'Cura, detox, cirurgia e plano de saude.',
    label: 'Ir ao hospital',
    path: '/hospital',
  },
  {
    description: 'Pena ativa, calor policial e opcoes de soltura.',
    label: 'Prisão',
    path: '/prison',
  },
  {
    description: 'Banca do bicho com sorteio, historico e aposta manual.',
    label: 'Jogo do Bicho',
    path: '/bicho',
  },
  {
    description: 'Abra os contatos, leia conversas e mande recados privados.',
    label: 'Contatos',
    path: '/messages',
  },
  {
    description: 'Veja quem lidera a rodada e o premio guardado para o top 10.',
    label: 'Ranking',
    path: '/ranking',
  },
  {
    description: 'Escolha a proxima regiao e compare rota, custo e tempo de viagem.',
    label: 'Mapa',
    path: '/map',
  },
  {
    description: 'Veja atributos, recursos, vocacao e o peso da sua reputacao.',
    label: 'Ver perfil',
    path: '/profile',
  },
  {
    description: 'Revise avisos recentes de eventos, guerras, recados e retornos do seu corre.',
    label: 'Ver eventos',
    path: '/events',
  },
  {
    description: 'Ajuste som, janela, atalhos e alertas deste aparelho.',
    label: 'Ajustar jogo',
    path: '/settings',
  },
];
