import type { PlayerProfile } from '@cs-rio/shared';

import type { ActionBarButton } from '../../components/hud/ActionBar';
import { orderBookBadge } from './homeHelpers';

export function buildQuickActions(player: PlayerProfile | null): ActionBarButton[] {
  return [
    ...(player?.prison.isImprisoned
      ? [
          {
            badge: 1,
            compactLabel: 'Prisao',
            description: 'Veja o tempo restante da pena e as saidas liberadas.',
            group: 'Meu corre',
            id: 'prison',
            label: 'Ver prisao',
            tone: 'danger' as const,
          },
        ]
      : []),
    {
      badge: player?.hospitalization.isHospitalized ? 1 : 0,
      compactLabel: 'Hospital',
      description: player?.hospitalization.isHospitalized
        ? 'Acompanhe a internacao e os servicos liberados.'
        : 'Cure HP, trate vicio, plano e cirurgia.',
      group: 'Meu corre',
      id: 'hospital',
      label: 'Ir ao hospital',
      tone: player?.hospitalization.isHospitalized ? ('default' as const) : undefined,
    },
    {
      badge: 0,
      compactLabel: 'Corre',
      description: 'Faca seu proximo corre e evolua o personagem.',
      featured: true,
      group: 'Na rua',
      id: 'crimes',
      label: 'Fazer corre',
    },
    {
      badge: orderBookBadge(player?.inventory.length ?? 0, player?.resources.money ?? 0),
      compactLabel: 'Negociar',
      description: 'Compre, venda e repare equipamento.',
      group: 'Meu corre',
      id: 'market',
      label: 'Negociar',
    },
    {
      badge: 0,
      compactLabel: 'Bicho',
      description: 'Aposta manual da rua. Abra a banca e entre no sorteio atual.',
      group: 'Meu corre',
      id: 'bicho',
      label: 'Jogo do Bicho',
    },
    {
      badge: 0,
      compactLabel: 'Eventos',
      description: 'Veja eventos ativos e o historico recente dos resultados do mapa.',
      group: 'Na rua',
      id: 'events',
      label: 'Ver eventos',
    },
    {
      badge: player?.inventory.length ?? 0,
      compactLabel: 'Equipar',
      description: 'Equipe armas, coletes e consumiveis.',
      group: 'Meu corre',
      id: 'inventory',
      label: 'Equipar',
    },
    {
      badge: player?.properties.length ?? 0,
      compactLabel: 'Ativos',
      description: 'Gerencie operacoes que giram caixa e a sua base de imoveis, veiculos e protecao.',
      group: 'Meu corre',
      id: 'ops',
      label: 'Gerir ativos',
    },
    {
      badge: 0,
      compactLabel: 'Dominar',
      description: 'Veja dominio, servicos, X9 e guerras.',
      featured: true,
      group: 'Na rua',
      id: 'territory',
      label: 'Dominar area',
    },
    {
      badge: 0,
      compactLabel: 'Julgar',
      description: 'Julgue casos da favela e aplique a punicao escolhida.',
      group: 'Na rua',
      id: 'tribunal',
      label: 'Julgar caso',
    },
    {
      badge: player?.faction ? 1 : 0,
      compactLabel: 'Faccao',
      description: 'Membros, banco, upgrades, lideranca e o chat interno da faccao.',
      group: 'Rede',
      id: 'faction',
      label: 'Falar com a faccao',
    },
    {
      badge: 0,
      compactLabel: 'Contatos',
      description: 'Gerencie parceiros, conhecidos e DMs; global, local e comercio ficam fora do recorte atual.',
      group: 'Rede',
      id: 'contacts',
      label: 'Contatos',
    },
    {
      badge: 0,
      compactLabel: 'Estudar',
      description: 'Cursos, perks exclusivos e timers da sua trilha.',
      group: 'Meu corre',
      id: 'university',
      label: 'Estudar',
    },
    {
      badge: 0,
      compactLabel: 'Vocacao',
      description: 'Troque a build, veja cooldown e acompanhe o impacto real da sua trilha.',
      group: 'Meu corre',
      id: 'vocation',
      label: 'Gerir vocacao',
    },
    {
      badge: 0,
      compactLabel: 'Perfil',
      description: 'Consulte atributos, vocacao e equipamentos.',
      group: 'Conta',
      id: 'profile',
      label: 'Ver perfil',
    },
    {
      badge: 0,
      compactLabel: 'Ranking',
      description: 'Veja quem esta puxando conceito na rodada e o premio do top 10.',
      group: 'Conta',
      id: 'ranking',
      label: 'Ranking',
    },
    {
      badge: 0,
      compactLabel: 'Ajustes',
      description: 'Som, preferencias e sessao do dispositivo.',
      group: 'Conta',
      id: 'settings',
      label: 'Ajustar jogo',
    },
    {
      badge: 0,
      compactLabel: 'Sair',
      description: 'Encerrar a sessao neste aparelho.',
      group: 'Conta',
      id: 'logout',
      label: 'Sair',
      tone: 'danger',
    },
  ];
}
