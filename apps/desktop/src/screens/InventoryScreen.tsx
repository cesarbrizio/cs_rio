import {
  INVENTORY_EXPANSION_HINT,
  INVENTORY_SCREEN_DESCRIPTION,
  resolveInventoryItemTypeLabel,
  useInventoryController,
} from '@cs-rio/ui/hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card, ContextMenu, Modal } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useInventoryStore } from '../stores/inventoryStore';
import {
  EmptyStateCard,
  FeedbackCard,
  formatMoney,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

interface InventoryModalState {
  message: string;
  title: string;
  tone: 'danger' | 'info';
}

export function InventoryScreen(): JSX.Element {
  const navigate = useNavigate();
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const actions = useInventoryStore();
  const [resultModal, setResultModal] = useState<InventoryModalState | null>(null);
  const lastFeedbackRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const {
    buildInventoryBenefitLines,
    equippedCount,
    error,
    feedback,
    items,
    repairableCount,
    resolveInventoryItemPresentation,
    runAction,
    selectedItem,
    selectedItemId,
    setSelectedItemId,
    submittingItemId,
  } = useInventoryController({
    actions,
    player,
  });
  const hasConsumableDrugs = items.some((item) => item.itemType === 'drug' && item.quantity > 0);

  useEffect(() => {
    void refreshPlayerProfile();
  }, [refreshPlayerProfile]);

  useEffect(() => {
    if (feedback && feedback !== lastFeedbackRef.current) {
      lastFeedbackRef.current = feedback;
      setResultModal({
        message: feedback,
        title: 'Equipar atualizado',
        tone: 'info',
      });
    }
  }, [feedback]);

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      setResultModal({
        message: error,
        title: 'Acao nao concluida',
        tone: 'danger',
      });
    }
  }, [error]);

  if (!player) {
    return <></>;
  }

  return (
    <>
      <section className="desktop-screen">
        <ScreenHero
          actions={
            <>
              <Button onClick={() => navigate('/market')} variant="secondary">
                Negociar
              </Button>
              {hasConsumableDrugs ? (
                <Button onClick={() => navigate('/drug-use')} variant="ghost">
                  Rave / Baile
                </Button>
              ) : null}
              <Button onClick={() => navigate('/profile')} variant="ghost">
                Ver perfil
              </Button>
            </>
          }
          badges={[
            { label: `${items.length} itens`, tone: 'neutral' },
            { label: `${equippedCount} equipados`, tone: 'success' },
            { label: `${repairableCount} pedindo reparo`, tone: 'warning' },
          ]}
          description={INVENTORY_SCREEN_DESCRIPTION}
          title="Equipar"
        />

        {feedback ? <FeedbackCard message={feedback} title="Equipar atualizado" tone="success" /> : null}
        {error ? <FeedbackCard message={error} title="Falha de inventario" tone="danger" /> : null}

        <div className="desktop-metric-grid">
          <MetricCard label="Slots ocupados" tone="neutral" value={`${items.length}`} />
          <MetricCard label="Equipados" tone="success" value={`${equippedCount}`} />
          <MetricCard label="Pedindo reparo" tone="warning" value={`${repairableCount}`} />
          <MetricCard label="Caixa atual" tone="info" value={formatMoney(player.resources.money)} />
        </div>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Grade de Itens</h3>
            <Badge tone="info">Acoes inline</Badge>
          </div>
          <p>{INVENTORY_EXPANSION_HINT}</p>
        </Card>

        {items.length === 0 ? (
          <EmptyStateCard
            action={{
              label: 'Negociar',
              onClick: () => navigate('/market'),
              variant: 'secondary',
            }}
            description="O personagem ainda nao possui itens. Crimes, mercado negro e drops vao alimentar esta tela."
            title="Sem itens no inventario"
          />
        ) : null}

        <div className="desktop-expand-grid">
          {items.map((item) => {
            const presentation = resolveInventoryItemPresentation(item, player.level);
            const isSelected = selectedItemId === item.id;
            const isSubmittingThisItem = submittingItemId === item.id;
            const benefitLines = buildInventoryBenefitLines(item);
            const contextItems = [
              presentation.primaryAction && !presentation.primaryAction.disabledReason
                ? {
                    id: 'primary-action',
                    label: presentation.primaryAction.label,
                    onSelect: () => {
                      void runAction(
                        presentation.primaryAction!.kind,
                        item.id,
                        item.itemName ?? item.itemType,
                      );
                    },
                  }
                : null,
              presentation.secondaryAction
                ? {
                    id: 'secondary-action',
                    label: presentation.secondaryAction.label,
                    onSelect: () => {
                      void runAction(
                        presentation.secondaryAction!.kind,
                        item.id,
                        item.itemName ?? item.itemType,
                      );
                    },
                  }
                : null,
              {
                id: 'sell-item',
                label: 'Vender no mercado',
                onSelect: () => navigate('/market'),
              },
            ].filter((item): item is { id: string; label: string; onSelect: () => void } => Boolean(item));

            return (
              <Card
                className={`desktop-expand-card ${isSelected ? 'desktop-expand-card--active' : ''}`}
                key={item.id}
                padding="sm"
              >
                <ContextMenu items={contextItems}>
                  <button
                    className="desktop-list-row desktop-list-row--clickable"
                    onClick={() => {
                      setSelectedItemId(isSelected ? null : item.id);
                    }}
                    type="button"
                  >
                    <div className="desktop-list-row__headline">
                      <strong>{item.itemName ?? item.itemType}</strong>
                      <Badge tone={mapInventoryTone(presentation.statusTone)}>
                        {presentation.statusLabel}
                      </Badge>
                    </div>
                    <small>
                      Qtd {item.quantity} · durabilidade {resolveDurabilityValue(item)}
                    </small>
                    <small>
                      Peso {item.totalWeight} · proficiencia {item.proficiency}
                    </small>
                  </button>
                </ContextMenu>

                {isSelected ? (
                  <div className="desktop-screen__stack">
                    <div className="desktop-grid-3">
                      <MetricCard label="Durabilidade" value={resolveDurabilityValue(item)} />
                      <MetricCard label="Proficiencia" value={`${item.proficiency}`} />
                      <MetricCard label="Nivel" value={item.levelRequired !== null ? `${item.levelRequired}` : 'Livre'} />
                    </div>

                    {item.equipment?.slot === 'weapon' && typeof item.equipment.power === 'number' ? (
                      <div className="desktop-grid-3">
                        <MetricCard label="Poder" value={`+${item.equipment.power}`} />
                        <MetricCard label="Crime/Guerra" value={`+${item.equipment.power}`} />
                        <MetricCard label="Combate" value={`+${item.equipment.power}`} />
                      </div>
                    ) : null}

                    {item.equipment?.slot === 'vest' && typeof item.equipment.defense === 'number' ? (
                      <div className="desktop-grid-3">
                        <MetricCard label="Defesa" value={`+${item.equipment.defense}`} />
                        <MetricCard label="Crime/Guerra" value={`+${item.equipment.defense * 6}`} />
                        <MetricCard label="Combate" value={`+${item.equipment.defense}`} />
                      </div>
                    ) : null}

                    {benefitLines.length > 0 ? (
                      <div className="desktop-detail-list">
                        {benefitLines.map((line) => (
                          <div key={line}>
                            <strong>Beneficio real</strong>
                            <small>{line}</small>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {presentation.primaryAction?.disabledReason ? (
                      <FeedbackCard
                        message={presentation.primaryAction.disabledReason}
                        title="Acao indisponivel"
                        tone="warning"
                      />
                    ) : null}

                    <div className="desktop-inline-actions">
                      {presentation.primaryAction ? (
                        <Button
                          data-desktop-primary-action="true"
                          disabled={Boolean(presentation.primaryAction.disabledReason) || Boolean(submittingItemId)}
                          onClick={() => {
                            void runAction(
                              presentation.primaryAction!.kind,
                              item.id,
                              item.itemName ?? item.itemType,
                            );
                          }}
                          variant="primary"
                        >
                          {isSubmittingThisItem ? 'Sincronizando...' : presentation.primaryAction.label}
                        </Button>
                      ) : null}

                      {presentation.secondaryAction ? (
                        <Button
                          disabled={Boolean(submittingItemId)}
                          onClick={() => {
                            void runAction(
                              presentation.secondaryAction!.kind,
                              item.id,
                              item.itemName ?? item.itemType,
                            );
                          }}
                          variant="secondary"
                        >
                          {presentation.secondaryAction.label}
                        </Button>
                      ) : null}

                      <Button
                        onClick={() => navigate('/market')}
                        variant="ghost"
                      >
                        Negociar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>

        {selectedItemId && selectedItem ? (
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Item em foco</h3>
              <Badge tone="info">{resolveInventoryItemTypeLabel(selectedItem)}</Badge>
            </div>
            <p>
              {selectedItem.itemName ?? selectedItem.itemType} · quantidade {selectedItem.quantity} ·{' '}
              durabilidade {resolveDurabilityValue(selectedItem)}
            </p>
          </Card>
        ) : null}
      </section>

      <Modal
        actions={
          <Button onClick={() => setResultModal(null)} variant="primary">
            Fechar
          </Button>
        }
        isOpen={Boolean(resultModal)}
        onClose={() => setResultModal(null)}
        title={resultModal?.title ?? 'Inventario'}
      >
        <div className="desktop-screen__stack">
          <Badge tone={resultModal?.tone === 'danger' ? 'danger' : 'info'}>
            {resultModal?.tone === 'danger' ? 'Erro' : 'Sucesso'}
          </Badge>
          <p>{resultModal?.message}</p>
        </div>
      </Modal>
    </>
  );
}

function mapInventoryTone(
  tone: 'accent' | 'danger' | 'info' | 'muted' | 'success' | 'warning',
): 'danger' | 'info' | 'neutral' | 'success' | 'warning' {
  if (tone === 'accent' || tone === 'muted') {
    return 'neutral';
  }

  return tone;
}

function resolveDurabilityValue(item: {
  durability: number | null;
  maxDurability: number | null;
}): string {
  if (item.durability === null || item.maxDurability === null) {
    return '--';
  }

  return `${item.durability}/${item.maxDurability}`;
}
