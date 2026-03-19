export interface DesktopNavigationItem {
  description: string;
  label: string;
  path: string;
}

export const primaryNavigationItems: DesktopNavigationItem[] = [
  {
    description: 'Mapa vivo, status do jogador e telemetria do renderer.',
    label: 'Home',
    path: '/home',
  },
  {
    description: 'Porta para crimes solo e crimes de faccao.',
    label: 'Crimes',
    path: '/crimes',
  },
  {
    description: 'Assalto e emboscada com alvos vindos do realtime.',
    label: 'Combate',
    path: '/combat',
  },
  {
    description: 'Mural de contratos PvP, aceite e execucao.',
    label: 'Contratos',
    path: '/contracts',
  },
  {
    description: 'Mercado, leiloes e ordens por regiao.',
    label: 'Mercado',
    path: '/market',
  },
  {
    description: 'Equipar, consumir, reparar e revisar cada item do loadout.',
    label: 'Inventario',
    path: '/inventory',
  },
  {
    description: 'Operacoes, base, patrimonio e centro de sabotagem.',
    label: 'Operacoes',
    path: '/operations',
  },
  {
    description: 'Gestao de membros, hierarquia e upgrades.',
    label: 'Faccao',
    path: '/faction',
  },
  {
    description: 'Dominio de favela, servicos, arrego, X9 e guerra.',
    label: 'Territorio',
    path: '/territory',
  },
  {
    description: 'Declaracao, preparo e rounds de guerra faccional.',
    label: 'Guerra',
    path: '/war',
  },
  {
    description: 'Pautas do tribunal e leitura dos cues territoriais.',
    label: 'Tribunal',
    path: '/tribunal',
  },
  {
    description: 'Treinos assincronos com resgate de atributos.',
    label: 'Treino',
    path: '/training',
  },
  {
    description: 'Cursos, passivos e trilha de vocacao.',
    label: 'Universidade',
    path: '/university',
  },
  {
    description: 'Cura, detox, cirurgia e plano de saude.',
    label: 'Hospital',
    path: '/hospital',
  },
  {
    description: 'Pena ativa, calor policial e opcoes de soltura.',
    label: 'Prisao',
    path: '/prison',
  },
  {
    description: 'Banca do bicho com sorteio, historico e aposta manual.',
    label: 'Bicho',
    path: '/bicho',
  },
  {
    description: 'Contatos, conversas privadas e envio de mensagens.',
    label: 'Mensagens',
    path: '/messages',
  },
  {
    description: 'Leaderboard da rodada e premio do top 10.',
    label: 'Ranking',
    path: '/ranking',
  },
  {
    description: 'Visao expandida do mapa e deslocamento regional.',
    label: 'Mapa',
    path: '/map',
  },
  {
    description: 'Progressao do personagem e leitura de atributos.',
    label: 'Perfil',
    path: '/profile',
  },
  {
    description: 'Historico local das notificacoes do desktop.',
    label: 'Notificacoes',
    path: '/notifications',
  },
  {
    description: 'Preferencias do desktop, notificacoes e shell.',
    label: 'Config',
    path: '/settings',
  },
];
