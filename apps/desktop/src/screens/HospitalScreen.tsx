import {
  HOSPITAL_HAIR_OPTIONS,
  HOSPITAL_OUTFIT_OPTIONS,
  HOSPITAL_SKIN_OPTIONS,
  buildHospitalServiceCopy,
  buildHospitalStatItemCopy,
  formatHospitalCurrency,
  formatHospitalRemaining,
  formatHospitalizationReason,
  getLiveHospitalizationStatus,
  hasImmediateHospitalActions,
  hasSurgeryChanges,
} from '@cs-rio/ui/hooks';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card } from '../components/ui';
import { hospitalApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  FeedbackCard,
  FormField,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

type HospitalActionId = 'detox' | 'healthPlan' | 'statItem' | 'surgery' | 'treatment';

export function HospitalScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAction, setPendingAction] = useState<HospitalActionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof hospitalApi.getCenter>> | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [appearanceDraft, setAppearanceDraft] = useState({
    hair: 'corte_curto',
    outfit: 'camisa_branca',
    skin: 'pele_media',
  });

  const hospitalization = useMemo(
    () => getLiveHospitalizationStatus(center?.hospitalization ?? player?.hospitalization ?? emptyHospitalizationState(), nowMs),
    [center?.hospitalization, nowMs, player?.hospitalization],
  );
  const surgeryHasChanges = useMemo(() => {
    if (!center) {
      return false;
    }

    return hasSurgeryChanges(
      center.player.appearance,
      center.player.nickname,
      appearanceDraft,
      nicknameDraft,
    );
  }, [appearanceDraft, center, nicknameDraft]);

  useEffect(() => {
    void loadCenter();
  }, []);

  useEffect(() => {
    if (!hospitalization.isHospitalized) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hospitalization.isHospitalized]);

  useEffect(() => {
    if (!center) {
      return;
    }

    setNicknameDraft(center.player.nickname);
    setAppearanceDraft(center.player.appearance);
  }, [center]);

  async function loadCenter(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await hospitalApi.getCenter();
      setCenter(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar o hospital.');
    } finally {
      setIsLoading(false);
    }
  }

  async function runHospitalAction(actionId: HospitalActionId, itemCode?: string): Promise<void> {
    setIsMutating(true);
    setPendingAction(actionId);
    setError(null);
    setFeedback(null);

    try {
      const response =
        actionId === 'treatment'
          ? await hospitalApi.applyTreatment()
          : actionId === 'detox'
            ? await hospitalApi.detox()
            : actionId === 'healthPlan'
              ? await hospitalApi.purchaseHealthPlan()
              : actionId === 'statItem'
                ? await hospitalApi.purchaseStatItem({ itemCode: itemCode as never })
                : await hospitalApi.surgery({
                    appearance: appearanceDraft,
                    nickname: nicknameDraft.trim(),
                  });
      setCenter(response);
      await refreshPlayerProfile();
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao executar a acao hospitalar.');
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadCenter()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar hospital'}
          </Button>
        }
        badges={[
          { label: `${center?.player.credits ?? '--'} creditos`, tone: 'warning' },
          { label: hospitalization.isHospitalized ? 'Internado' : 'Livre', tone: hospitalization.isHospitalized ? 'danger' : 'success' },
          { label: hasImmediateHospitalActions(center) ? 'Servicos abertos' : 'Sem servico imediato', tone: 'info' },
        ]}
        description="Hospital real do backend com cura, detox, plano de saude, cirurgia e itens de atributo no desktop."
        title="Hospital"
      />

      {feedback ? <FeedbackCard message={feedback} title="Hospital sincronizado" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha no hospital" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="HP" tone="danger" value={`${center?.player.hp ?? player?.resources.hp ?? '--'}`} />
        <MetricCard label="Internacao" tone={hospitalization.isHospitalized ? 'warning' : 'success'} value={hospitalization.isHospitalized ? 'Ativa' : 'Livre'} />
        <MetricCard label="Restante" tone="info" value={formatHospitalRemaining(hospitalization.remainingSeconds)} />
        <MetricCard label="Caixa" tone="warning" value={formatHospitalCurrency(center?.player.money ?? player?.resources.money ?? 0)} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <h3>Situacao atual</h3>
          <div className="desktop-detail-list">
            <div>
              <strong>Estado clinico</strong>
              <small>{formatHospitalizationReason(hospitalization)}</small>
            </div>
            <div>
              <strong>Inicio</strong>
              <small>{hospitalization.startedAt ? new Date(hospitalization.startedAt).toLocaleString('pt-BR') : '--'}</small>
            </div>
            <div>
              <strong>Alta prevista</strong>
              <small>{hospitalization.endsAt ? new Date(hospitalization.endsAt).toLocaleString('pt-BR') : 'agora'}</small>
            </div>
          </div>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Servicos rapidos</h3>
            <Badge tone="info">{center ? center.currentCycleKey : '--'}</Badge>
          </div>
          <div className="desktop-detail-list">
            <div>
              <strong>Tratamento</strong>
              <small>{buildHospitalServiceCopy('treatment', center?.services.treatment ?? unavailableService())}</small>
              <Button disabled={isMutating || !center?.services.treatment.available} onClick={() => void runHospitalAction('treatment')} variant="secondary">
                {pendingAction === 'treatment' ? 'Processando...' : 'Tratar HP'}
              </Button>
            </div>
            <div>
              <strong>Detox</strong>
              <small>{buildHospitalServiceCopy('detox', center?.services.detox ?? unavailableService())}</small>
              <Button disabled={isMutating || !center?.services.detox.available} onClick={() => void runHospitalAction('detox')} variant="ghost">
                {pendingAction === 'detox' ? 'Processando...' : 'Fazer detox'}
              </Button>
            </div>
            <div>
              <strong>Plano de saude</strong>
              <small>{buildHospitalServiceCopy('healthPlan', center?.services.healthPlan ?? unavailableService())}</small>
              <Button disabled={isMutating || !center?.services.healthPlan.available} onClick={() => void runHospitalAction('healthPlan')} variant="ghost">
                {pendingAction === 'healthPlan' ? 'Processando...' : 'Ativar plano'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <h3>Itens de atributo</h3>
          <div className="desktop-scroll-list">
            {(center?.statItems ?? []).map((offer) => (
              <div className="desktop-list-row" key={offer.itemCode}>
                <div className="desktop-list-row__headline">
                  <strong>{offer.label}</strong>
                  <Badge tone={offer.available ? 'success' : 'danger'}>
                    {offer.available ? 'Disponivel' : 'Travado'}
                  </Badge>
                </div>
                <small>{offer.description}</small>
                <small>{buildHospitalStatItemCopy(offer)}</small>
                <Button
                  disabled={isMutating || !offer.available}
                  onClick={() => void runHospitalAction('statItem', offer.itemCode)}
                  variant="secondary"
                >
                  {pendingAction === 'statItem' ? 'Processando...' : 'Comprar item'}
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Cirurgia</h3>
            <Badge tone={surgeryHasChanges ? 'warning' : 'neutral'}>
              {surgeryHasChanges ? 'Alteracoes prontas' : 'Sem mudanca'}
            </Badge>
          </div>
          <FormField label="Nickname">
            <input onChange={(event) => setNicknameDraft(event.target.value)} value={nicknameDraft} />
          </FormField>
          <div className="desktop-grid-3">
            <FormField label="Pele">
              <select onChange={(event) => setAppearanceDraft((current) => ({ ...current, skin: event.target.value as never }))} value={appearanceDraft.skin}>
                {HOSPITAL_SKIN_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Cabelo">
              <select onChange={(event) => setAppearanceDraft((current) => ({ ...current, hair: event.target.value as never }))} value={appearanceDraft.hair}>
                {HOSPITAL_HAIR_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Roupa">
              <select onChange={(event) => setAppearanceDraft((current) => ({ ...current, outfit: event.target.value as never }))} value={appearanceDraft.outfit}>
                {HOSPITAL_OUTFIT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <Button
            disabled={isMutating || !surgeryHasChanges || !center?.services.surgery.available}
            onClick={() => void runHospitalAction('surgery')}
            variant="primary"
          >
            {pendingAction === 'surgery' ? 'Processando...' : 'Aplicar cirurgia'}
          </Button>
        </Card>
      </div>
    </section>
  );
}

function unavailableService() {
  return {
    available: false,
    creditsCost: null,
    moneyCost: null,
    reason: 'Indisponivel agora.',
  };
}

function emptyHospitalizationState() {
  return {
    endsAt: null,
    isHospitalized: false,
    reason: null,
    remainingSeconds: 0,
    startedAt: null,
    trigger: null,
  };
}
