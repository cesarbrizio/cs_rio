import {
  DrugType,
  type DrugConsumeResponse,
  type PlayerInventoryItem,
  type PlayerProfile,
} from '@cs-rio/shared';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useInventoryStore } from '../stores/inventoryStore';
import {
  FeedbackCard,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

type DrugVenue = 'rave' | 'baile';
type DrugRiskLevel = 'blocked' | 'high' | 'medium' | 'low';

interface DrugCatalogEntry {
  addictionRate: number;
  aliases: string[];
  brisaBoost: number;
  cansacoRecovery: number;
  disposicaoBoost: number;
  name: string;
  type: DrugType;
}

interface ResolvedDrugCatalogEntry extends DrugCatalogEntry {
  estimatedUnitPrice: string;
}

interface DrugVenueDefinition {
  crowdLabel: string;
  description: string;
  id: DrugVenue;
  label: string;
  maxDrugsLabel: string;
}

const DRUG_CATALOG: DrugCatalogEntry[] = [
  {
    addictionRate: 0.5,
    aliases: ['maconha'],
    brisaBoost: 1,
    cansacoRecovery: 1,
    disposicaoBoost: 0,
    name: 'Maconha',
    type: DrugType.Maconha,
  },
  {
    addictionRate: 1,
    aliases: ['lanca', 'lanca'],
    brisaBoost: 1,
    cansacoRecovery: 2,
    disposicaoBoost: 2,
    name: 'Lanca',
    type: DrugType.Lanca,
  },
  {
    addictionRate: 1.5,
    aliases: ['bala'],
    brisaBoost: 2,
    cansacoRecovery: 3,
    disposicaoBoost: 5,
    name: 'Bala',
    type: DrugType.Bala,
  },
  {
    addictionRate: 1,
    aliases: ['doce'],
    brisaBoost: 2,
    cansacoRecovery: 4,
    disposicaoBoost: 0,
    name: 'Doce',
    type: DrugType.Doce,
  },
  {
    addictionRate: 2,
    aliases: ['md'],
    brisaBoost: 2,
    cansacoRecovery: 5,
    disposicaoBoost: 3,
    name: 'MD',
    type: DrugType.MD,
  },
  {
    addictionRate: 3,
    aliases: ['cocaina', 'cocaina'],
    brisaBoost: 3,
    cansacoRecovery: 7,
    disposicaoBoost: 10,
    name: 'Cocaina',
    type: DrugType.Cocaina,
  },
  {
    addictionRate: 5,
    aliases: ['crack'],
    brisaBoost: 3,
    cansacoRecovery: 8,
    disposicaoBoost: 15,
    name: 'Crack',
    type: DrugType.Crack,
  },
];

const DRUG_VENUES: DrugVenueDefinition[] = [
  {
    crowdLabel: 'Pista premium, fluxo menor e efeito mais calculado.',
    description: 'Contexto de rave para consumo mais controlado, com foco em brisa e ritmo.',
    id: 'rave',
    label: 'Rave',
    maxDrugsLabel: 'Ate 10 tipos no cardapio',
  },
  {
    crowdLabel: 'Volume alto, pressao social e pico rapido de consumo.',
    description: 'Contexto de baile para consumo em massa, com mais impulso e mais risco.',
    id: 'baile',
    label: 'Baile Funk',
    maxDrugsLabel: 'Ate 5 tipos no cardapio',
  },
];

export function DrugUseScreen(): JSX.Element {
  const navigate = useNavigate();
  const isLoading = useAuthStore((state) => state.isLoading);
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const consumeDrugInventoryItem = useInventoryStore((state) => state.consumeDrugInventoryItem);
  const [venue, setVenue] = useState<DrugVenue>('rave');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DrugConsumeResponse | null>(null);

  const drugItems = useMemo(
    () => filterConsumableDrugItems(player?.inventory ?? []),
    [player?.inventory],
  );
  const selectedDrug = useMemo(
    () => drugItems.find((item) => item.id === selectedInventoryItemId) ?? drugItems[0] ?? null,
    [drugItems, selectedInventoryItemId],
  );
  const selectedDrugDefinition = useMemo(
    () => resolveDrugCatalogEntry(selectedDrug),
    [selectedDrug],
  );
  const venueDefinition = useMemo(() => resolveDrugVenue(venue), [venue]);
  const warnings = useMemo(
    () => buildDrugUseWarnings(player, selectedDrugDefinition),
    [player, selectedDrugDefinition],
  );
  const risk = useMemo(
    () => resolveDrugRiskLevel(player, selectedDrugDefinition),
    [player, selectedDrugDefinition],
  );

  useEffect(() => {
    void refreshPlayerProfile();
  }, [refreshPlayerProfile]);

  useEffect(() => {
    if (!selectedDrug && drugItems.length > 0) {
      setSelectedInventoryItemId(drugItems[0]?.id ?? null);
      return;
    }

    if (selectedDrug && selectedDrug.id !== selectedInventoryItemId) {
      setSelectedInventoryItemId(selectedDrug.id);
      return;
    }

    if (drugItems.length === 0) {
      setSelectedInventoryItemId(null);
    }
  }, [drugItems, selectedDrug, selectedInventoryItemId]);

  async function handleConsume(): Promise<void> {
    if (!selectedDrug) {
      setError('Selecione uma droga para consumir.');
      return;
    }

    setError(null);

    try {
      const response = await consumeDrugInventoryItem(selectedDrug.id);
      setResult(response);
      const nextDrugItems = filterConsumableDrugItems(response.player.inventory);
      setSelectedInventoryItemId((currentId) =>
        nextDrugItems.some((item) => item.id === currentId) ? currentId : nextDrugItems[0]?.id ?? null,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao consumir droga.');
    }
  }

  if (!player) {
    return <></>;
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <>
            <Button onClick={() => navigate('/inventory')} variant="secondary">
              Equipar
            </Button>
            <Button onClick={() => navigate('/hospital')} variant="ghost">
              Ir ao hospital
            </Button>
          </>
        }
        badges={[
          { label: venueDefinition.label, tone: 'warning' },
          { label: `${drugItems.length} drogas`, tone: 'info' },
          { label: player.hospitalization.isHospitalized ? 'Consumo bloqueado' : 'Consumo liberado', tone: player.hospitalization.isHospitalized ? 'danger' : 'success' },
        ]}
        description="Tela propria para rave e baile, com leitura de risco, droga selecionada e retorno imediato da dose."
        title="Rave / Baile"
      />

      {error ? <FeedbackCard message={error} title="Falha no consumo" tone="danger" /> : null}
      {result ? <FeedbackCard message={resolveConsumeResultMessage(result, venueDefinition.label)} title={result.overdose ? 'Overdose registrada' : 'Dose aplicada'} tone={result.overdose ? 'warning' : 'success'} /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Brisa" tone="info" value={`${player.resources.brisa}`} />
        <MetricCard label="Cansaco" tone="success" value={`${player.resources.cansaco}`} />
        <MetricCard label="Vicio" tone="warning" value={`${player.resources.addiction}`} />
        <MetricCard label="Internacao" tone={player.hospitalization.isHospitalized ? 'danger' : 'neutral'} value={player.hospitalization.isHospitalized ? formatRemainingSeconds(player.hospitalization.remainingSeconds) : 'Livre'} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Ambiente</h3>
            <Badge tone="info">{venueDefinition.maxDrugsLabel}</Badge>
          </div>
          <div className="desktop-inline-actions">
            {(DRUG_VENUES).map((entry) => (
              <Button
                key={entry.id}
                onClick={() => setVenue(entry.id)}
                variant={entry.id === venue ? 'primary' : 'ghost'}
              >
                {entry.label}
              </Button>
            ))}
          </div>
          <div className="desktop-detail-list">
            <div>
              <strong>Leitura</strong>
              <small>{venueDefinition.description}</small>
            </div>
            <div>
              <strong>Pressao</strong>
              <small>{venueDefinition.crowdLabel}</small>
            </div>
          </div>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Risco da dose</h3>
            <Badge tone={resolveRiskTone(risk.level)}>{resolveRiskLabel(risk.level)}</Badge>
          </div>
          <p>{risk.copy}</p>
          <div className="desktop-detail-list">
            {warnings.map((warning) => (
              <div key={warning}>
                <strong>Alerta</strong>
                <small>{warning}</small>
              </div>
            ))}
            {!warnings.length ? (
              <div>
                <strong>Alerta</strong>
                <small>Sem alerta extra para a combinacao atual.</small>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Cardapio disponivel</h3>
            <Badge tone="neutral">{drugItems.length} itens</Badge>
          </div>
          <div className="desktop-scroll-list">
            {drugItems.map((item) => {
              const definition = resolveDrugCatalogEntry(item);

              return (
                <button
                  className={`desktop-list-row desktop-list-row--clickable ${selectedDrug?.id === item.id ? 'desktop-list-row--active' : ''}`}
                  key={item.id}
                  onClick={() => setSelectedInventoryItemId(item.id)}
                  type="button"
                >
                  <div className="desktop-list-row__headline">
                    <strong>{item.itemName ?? 'Droga sem nome'}</strong>
                    <Badge tone="info">Qtd {item.quantity}</Badge>
                  </div>
                  <small>{definition?.type ?? item.itemType} · {definition?.estimatedUnitPrice ?? 'sem leitura'}</small>
                  <small>
                    +{definition?.cansacoRecovery ?? 0} CAN · +{definition?.brisaBoost ?? 0} BRI · +{definition?.disposicaoBoost ?? 0} DIS
                  </small>
                </button>
              );
            })}
            {!drugItems.length ? <p>Seu inventario nao tem drogas disponiveis agora.</p> : null}
          </div>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <div>
              <h3>{selectedDrug?.itemName ?? 'Selecione uma dose'}</h3>
              <p>{selectedDrugDefinition ? `${selectedDrugDefinition.name} · risco ${resolveRiskLabel(risk.level)}` : 'Escolha uma droga para abrir a previa.'}</p>
            </div>
            <Button
              disabled={!selectedDrug || player.hospitalization.isHospitalized || isLoading}
              onClick={() => void handleConsume()}
              variant="primary"
            >
              Consumir
            </Button>
          </div>
          {selectedDrugDefinition ? (
            <>
              <div className="desktop-grid-4">
                <MetricCard label="Cansaco" tone="success" value={`+${selectedDrugDefinition.cansacoRecovery}`} />
                <MetricCard label="Brisa" tone="info" value={`+${selectedDrugDefinition.brisaBoost}`} />
                <MetricCard label="Disposicao" tone="warning" value={`+${selectedDrugDefinition.disposicaoBoost}`} />
                <MetricCard label="Vicio" tone="danger" value={`+${selectedDrugDefinition.addictionRate}`} />
              </div>
              <div className="desktop-detail-list">
                <div>
                  <strong>Tolerancia efetiva</strong>
                  <small>{result ? formatToleranceMultiplier(result.tolerance.effectivenessMultiplier) : '--'}</small>
                </div>
                <div>
                  <strong>Impacto recente</strong>
                  <small>{result ? `+${result.effects.brisaRecovered} brisa · +${result.effects.disposicaoRecovered} disposicao · +${result.effects.cansacoRecovered} cansaco` : 'Sem dose aplicada nesta sessao.'}</small>
                </div>
                <div>
                  <strong>Ultima leitura</strong>
                  <small>{result ? resolveOverdoseCopy(result) : 'A dose selecionada ainda nao foi aplicada.'}</small>
                </div>
              </div>
            </>
          ) : (
            <p>Selecione uma droga do inventario para abrir a previa completa.</p>
          )}
        </Card>
      </div>
    </section>
  );
}

function buildDrugUseWarnings(
  player: PlayerProfile | null,
  drug: ResolvedDrugCatalogEntry | null,
): string[] {
  if (!player || !drug) {
    return [];
  }

  const warnings: string[] = [];

  if (player.hospitalization.isHospitalized) {
    warnings.push(`Voce esta hospitalizado por mais ${formatRemainingSeconds(player.hospitalization.remainingSeconds)}.`);
  }

  if (player.resources.cansaco + drug.cansacoRecovery > 100) {
    warnings.push('O cansaco previsto pode ultrapassar 100 e disparar overdose por excesso.');
  }

  if (player.resources.addiction >= 95) {
    warnings.push('Seu vicio esta no limite critico. Qualquer consumo agora pode causar colapso.');
  } else if (player.resources.addiction >= 80) {
    warnings.push('Seu vicio esta muito alto. O risco de overdose ja e relevante.');
  }

  if (drug.addictionRate >= 3) {
    warnings.push('Essa droga acelera muito o vicio e exige uso mais disciplinado.');
  }

  warnings.push('Misturar 3 tipos diferentes em menos de 1h pode causar overdose.');

  return warnings;
}

function filterConsumableDrugItems(items: PlayerInventoryItem[]): PlayerInventoryItem[] {
  return items
    .filter((item) => item.itemType === 'drug' && item.quantity > 0)
    .sort((left, right) =>
      (left.itemName ?? left.itemId ?? '').localeCompare(right.itemName ?? right.itemId ?? '', 'pt-BR'),
    );
}

function formatRemainingSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return '0s';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatToleranceMultiplier(multiplier: number): string {
  return `${Math.round(multiplier * 100)}%`;
}

function resolveDrugCatalogEntry(
  item: Pick<PlayerInventoryItem, 'itemId' | 'itemName'> | null,
): ResolvedDrugCatalogEntry | null {
  if (!item) {
    return null;
  }

  const normalizedSources = [
    normalizeDrugToken(item.itemName),
    normalizeDrugToken(item.itemId),
  ].filter(Boolean);

  const match = DRUG_CATALOG.find((entry) =>
    normalizedSources.some((source) =>
      entry.aliases.some((alias) => normalizeDrugToken(alias) === source),
    ),
  );

  if (!match) {
    return null;
  }

  return {
    ...match,
    estimatedUnitPrice: `R$ ${Math.round(50 + match.addictionRate * 100 + match.cansacoRecovery * 40)}`,
  };
}

function resolveDrugRiskLevel(
  player: PlayerProfile | null,
  drug: ResolvedDrugCatalogEntry | null,
): {
  copy: string;
  level: DrugRiskLevel;
} {
  if (!player || !drug) {
    return {
      copy: 'Selecione uma droga para ver o risco estimado.',
      level: 'low',
    };
  }

  if (player.hospitalization.isHospitalized) {
    return {
      copy: 'Consumo bloqueado ate o fim da hospitalizacao.',
      level: 'blocked',
    };
  }

  let score = 0;

  if (player.resources.addiction >= 95) {
    score += 3;
  } else if (player.resources.addiction >= 80) {
    score += 2;
  } else if (player.resources.addiction >= 60) {
    score += 1;
  }

  if (player.resources.cansaco + drug.cansacoRecovery > 100) {
    score += 3;
  }

  if (drug.addictionRate >= 3) {
    score += 1;
  }

  if (score >= 5) {
    return {
      copy: 'Risco alto de overdose. Revise cansaco, vicio e mistura recente.',
      level: 'high',
    };
  }

  if (score >= 2) {
    return {
      copy: 'Risco moderado. Mistura recente e tolerancia ainda podem piorar o quadro.',
      level: 'medium',
    };
  }

  return {
    copy: 'Risco baixo por agora, mas mistura recente ainda pode virar o jogo.',
    level: 'low',
  };
}

function resolveDrugVenue(venue: DrugVenue): DrugVenueDefinition {
  return DRUG_VENUES.find((entry) => entry.id === venue) ?? DRUG_VENUES[0]!;
}

function resolveConsumeResultMessage(result: DrugConsumeResponse, venueLabel: string): string {
  if (result.overdose) {
    return `Overdose em ${venueLabel}. Internacao por ${formatRemainingSeconds(result.overdose.hospitalization.remainingSeconds)}.`;
  }

  return `${result.drug.name} consumida em ${venueLabel}. Brisa +${result.effects.brisaRecovered}.`;
}

function resolveOverdoseCopy(result: DrugConsumeResponse): string {
  if (!result.overdose) {
    return 'Sem overdose na ultima aplicacao.';
  }

  return `Perdeu ${result.overdose.penalties.conceitoLost} conceito e ficou internado por ${formatRemainingSeconds(result.overdose.hospitalization.remainingSeconds)}.`;
}

function resolveRiskLabel(level: DrugRiskLevel): string {
  if (level === 'blocked') {
    return 'Bloqueado';
  }

  if (level === 'high') {
    return 'Alto';
  }

  if (level === 'medium') {
    return 'Medio';
  }

  return 'Baixo';
}

function resolveRiskTone(level: DrugRiskLevel): 'danger' | 'info' | 'neutral' | 'success' | 'warning' {
  if (level === 'blocked' || level === 'high') {
    return 'danger';
  }

  if (level === 'medium') {
    return 'warning';
  }

  return 'success';
}

function normalizeDrugToken(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/giu, '')
    .toLowerCase();
}
