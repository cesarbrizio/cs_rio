import { useInventoryController } from '@cs-rio/ui/hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card, ContextMenu, Modal } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useInventoryStore } from '../stores/inventoryStore';
import {
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

  useEffect(() => {
    if (feedback && feedback !== lastFeedbackRef.current) {
      lastFeedbackRef.current = feedback;
      setResultModal({
        message: feedback,
        title: 'Inventario atualizado',
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
                Abrir mercado
              </Button>
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
          description="O card do proprio item virou a superficie principal de acao. Equipar, desequipar, reparar e consumir agora disparam feedback imediato no desktop."
          title="Inventario"
        />

        {feedback ? <FeedbackCard message={feedback} title="Estado sincronizado" tone="success" /> : null}
        {error ? <FeedbackCard message={error} title="Falha de inventario" tone="danger" /> : null}

        <div className="desktop-metric-grid">
          <MetricCard label="Slots ocupados" tone="neutral" value={`${items.length}`} />
          <MetricCard label="Equipados" tone="success" value={`${equippedCount}`} />
          <MetricCard label="Pedindo reparo" tone="warning" value={`${repairableCount}`} />
          <MetricCard label="Caixa atual" tone="info" value={formatMoney(player.resources.money)} />
        </div>

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
                      <MetricCard label="Nivel" value={item.levelRequired !== null ? `${item.levelRequired}` : 'Livre'} />
                      <MetricCard label="Slot" value={item.equipSlot ?? 'Mochila'} />
                      <MetricCard label="Tipo" value={item.itemType} />
                    </div>

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
                        Abrir mercado
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>

        {selectedItem ? (
          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <h3>Item em foco</h3>
              <Badge tone="info">{selectedItem.itemType}</Badge>
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
