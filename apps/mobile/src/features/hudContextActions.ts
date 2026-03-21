export interface HudContextAction {
  description: string;
  id: string;
  label: string;
  tone?: 'accent' | 'default';
}

export interface HudContextTarget {
  actions: HudContextAction[];
  entityId: string;
  subtitle: string;
  title: string;
}

export function buildHudContextTarget(entityId: string): HudContextTarget {
  if (entityId.startsWith('player:')) {
    return {
      actions: [
        {
          description: 'Abre as estatísticas públicas do jogador.',
          id: 'view_profile',
          label: 'Perfil',
        },
        {
          description: 'Envia um convite para cooperação imediata.',
          id: 'invite_squad',
          label: 'Convidar',
          tone: 'accent',
        },
        {
          description: 'Abre um canal rápido de conversa.',
          id: 'send_message',
          label: 'Mensagem',
        },
      ],
      entityId,
      subtitle: 'Interação social em tempo real',
      title: 'Jogador próximo',
    };
  }

  if (entityId.includes('mercado') || entityId.includes('black_market')) {
    return {
      actions: [
        {
          description: 'Ver o catálogo de armas, coletes e utilitários.',
          id: 'buy',
          label: 'Comprar',
          tone: 'accent',
        },
        {
          description: 'Negociar itens do inventário.',
          id: 'sell',
          label: 'Vender',
        },
        {
          description: 'Reparar equipamento gasto.',
          id: 'repair',
          label: 'Reparar',
        },
      ],
      entityId,
      subtitle: 'Comércio clandestino da região',
      title: 'Mercado Negro',
    };
  }

  if (entityId.includes('boca')) {
    return {
      actions: [
        {
          description: 'Abastecer o ponto com mercadoria e recursos.',
          id: 'resupply',
          label: 'Abastecer',
          tone: 'accent',
        },
        {
          description: 'Auditar caixa, estoque e vendas recentes.',
          id: 'inspect',
          label: 'Inspecionar',
        },
        {
          description: 'Reforçar a segurança local.',
          id: 'fortify',
          label: 'Fortificar',
        },
      ],
      entityId,
      subtitle: 'Ponto de operação territorial',
      title: 'Boca da Favela',
    };
  }

  if (
    entityId.includes('fabrica') ||
    entityId.includes('factory') ||
    entityId.includes('laboratorio') ||
    entityId.includes('lab')
  ) {
    return {
      actions: [
        {
          description: 'Abrir a tela de gestão do laboratório.',
          id: 'manage',
          label: 'Gerenciar',
          tone: 'accent',
        },
        {
          description: 'Enviar componentes do inventário para o estoque interno.',
          id: 'stock',
          label: 'Estocar',
        },
        {
          description: 'Puxar a produção pronta para o inventário.',
          id: 'collect',
          label: 'Coletar',
        },
      ],
      entityId,
      subtitle: 'Operação de laboratório e produção automática',
      title: 'Fábrica',
    };
  }

  if (entityId.includes('rave') || entityId.includes('baile')) {
    return {
      actions: [
        {
          description: 'Abrir o cardápio e consumir uma dose agora.',
          id: 'consume',
          label: 'Consumir',
          tone: 'accent',
        },
        {
          description: 'Ver os tipos de droga disponíveis no ambiente.',
          id: 'menu',
          label: 'Cardápio',
        },
        {
          description: 'Checar o clima e o volume de consumo do local.',
          id: 'vibe',
          label: 'Vibe',
        },
      ],
      entityId,
      subtitle: 'Ponto de consumo e recuperação de brisa',
      title: entityId.includes('baile') ? 'Baile Funk' : 'Rave',
    };
  }

  if (entityId.includes('hospital')) {
    return {
      actions: [
        {
          description: 'Abrir os serviços do hospital agora.',
          id: 'open_hospital',
          label: 'Abrir',
          tone: 'accent',
        },
        {
          description: 'Ver tempo restante de internação e custos.',
          id: 'review_hospital',
          label: 'Ver custos',
        },
      ],
      entityId,
      subtitle: 'Recuperação, vício, plano e cirurgia',
      title: 'Hospital',
    };
  }

  if (entityId.includes('universidade')) {
    return {
      actions: [
        {
          description: 'Abrir os cursos disponíveis.',
          id: 'open_university',
          label: 'Estudar',
          tone: 'accent',
        },
        {
          description: 'Ver passivos e cursos em andamento.',
          id: 'review_university',
          label: 'Cursos',
        },
      ],
      entityId,
      subtitle: 'Progressão passiva e especialização',
      title: 'Universidade',
    };
  }

  if (entityId.includes('doca') || entityId.includes('porto')) {
    return {
      actions: [
        {
          description: 'Abrir o mercado com foco em docas e giro pesado.',
          id: 'open_docks_market',
          label: 'Abrir docas',
          tone: 'accent',
        },
        {
          description: 'Ver a leitura operacional do cais e da demanda.',
          id: 'inspect_docks',
          label: 'Inspecionar',
        },
      ],
      entityId,
      subtitle: 'Canal pesado de giro e logística',
      title: 'Docas',
    };
  }

  if (entityId.includes('desmanche')) {
    return {
      actions: [
        {
          description: 'Abrir o fluxo de veículos e venda paralela.',
          id: 'open_scrapyard',
          label: 'Abrir desmanche',
          tone: 'accent',
        },
        {
          description: 'Marcar o ponto para seu próximo corre.',
          id: 'bookmark_scrapyard',
          label: 'Marcar',
        },
      ],
      entityId,
      subtitle: 'Fluxo de peças, sumiço e rota paralela',
      title: 'Desmanche',
    };
  }

  return {
    actions: [
      {
        description: 'Exibe mais detalhes do local.',
        id: 'inspect',
        label: 'Observar',
      },
      {
        description: 'Marca o ponto para uma ação futura.',
        id: 'bookmark',
        label: 'Marcar',
        tone: 'accent',
      },
    ],
    entityId,
    subtitle: 'Interação contextual disponível',
    title: 'Ponto de interesse',
  };
}
