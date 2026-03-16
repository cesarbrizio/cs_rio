import { useFocusEffect } from '@react-navigation/native';
import { type CharacterAppearance, type HospitalStatItemCode, VocationType } from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CharacterPreviewCard } from '../components/CharacterPreviewCard';
import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { NpcInflationPanel } from '../components/NpcInflationPanel';
import {
  buildHospitalServiceCopy,
  buildHospitalStatItemCopy,
  formatCurrency,
  formatHospitalizationReason,
  formatHospitalRemaining,
  getLiveHospitalizationStatus,
  HOSPITAL_HAIR_OPTIONS,
  hasImmediateHospitalActions,
  hasSurgeryChanges,
  HOSPITAL_OUTFIT_OPTIONS,
  HOSPITAL_SKIN_OPTIONS,
} from '../features/hospital';
import { formatApiError, hospitalApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

const VOCATION_LABELS: Record<VocationType, string> = {
  [VocationType.Cria]: 'Cria',
  [VocationType.Empreendedor]: 'Empreendedor',
  [VocationType.Gerente]: 'Gerente',
  [VocationType.Politico]: 'Político',
  [VocationType.Soldado]: 'Soldado',
};

export function HospitalScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const [center, setCenter] = useState<Awaited<ReturnType<typeof hospitalApi.getCenter>> | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    'detox' | 'healthPlan' | 'statItem' | 'surgery' | 'treatment' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<'danger' | 'info'>('info');
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [appearanceDraft, setAppearanceDraft] = useState<CharacterAppearance>({
    hair: 'corte_curto',
    outfit: 'camisa_branca',
    skin: 'pele_media',
  });

  const loadHospitalCenter = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await hospitalApi.getCenter();
      setCenter(response);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHospitalCenter();
      return undefined;
    }, [loadHospitalCenter]),
  );

  useEffect(() => {
    if (!center) {
      return;
    }

    setNicknameDraft(center.player.nickname);
    setAppearanceDraft(center.player.appearance);
  }, [center]);

  useEffect(() => {
    setNowMs(Date.now());

    if (!center?.hospitalization.isHospitalized) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [center?.hospitalization.isHospitalized]);

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

  const canActNow = useMemo(() => hasImmediateHospitalActions(center), [center]);
  const surgeryLabel = VOCATION_LABELS[player?.vocation ?? VocationType.Cria];

  const runHospitalAction = useCallback(async (
    action:
      | 'detox'
      | 'healthPlan'
      | 'statItem'
      | 'surgery'
      | 'treatment',
    payload?: {
      itemCode?: HospitalStatItemCode;
    },
  ) => {
    setIsMutating(true);
    setResultMessage(null);
    setPendingAction(action);

    try {
        const response =
          action === 'treatment'
          ? await hospitalApi.applyTreatment()
          : action === 'detox'
            ? await hospitalApi.detox()
            : action === 'healthPlan'
                ? await hospitalApi.purchaseHealthPlan()
                : action === 'statItem'
                  ? await hospitalApi.purchaseStatItem({ itemCode: payload?.itemCode ?? 'cerebrina' })
                  : await hospitalApi.surgery(buildSurgeryPayload(center, nicknameDraft, appearanceDraft));

      setCenter(response);
      await refreshPlayerProfile();
      setBootstrapStatus(response.message);
      setResultTone('info');
      setResultMessage(response.message);
    } catch (error) {
      const message = formatApiError(error).message;
      setBootstrapStatus(message);
      setResultTone('danger');
      setResultMessage(message);
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }, [appearanceDraft, center, nicknameDraft, refreshPlayerProfile, setBootstrapStatus]);

  const selectedSkin = HOSPITAL_SKIN_OPTIONS.find((option) => option.id === appearanceDraft.skin) ?? HOSPITAL_SKIN_OPTIONS[1];
  const selectedHair = HOSPITAL_HAIR_OPTIONS.find((option) => option.id === appearanceDraft.hair) ?? HOSPITAL_HAIR_OPTIONS[0];
  const selectedOutfit = HOSPITAL_OUTFIT_OPTIONS.find((option) => option.id === appearanceDraft.outfit) ?? HOSPITAL_OUTFIT_OPTIONS[0];

  return (
    <InGameScreenLayout
      subtitle="Veja a internação em tempo real, cuide da vida, trate vício, ative o plano de saúde e ajuste o visual do personagem usando os serviços reais do backend."
      title="Hospital"
    >
      <View style={styles.summaryGrid}>
        <SummaryCard label="HP" tone={colors.danger} value={`${center?.player.hp ?? player?.resources.hp ?? '--'}`} />
        <SummaryCard
          label="Internação"
          tone={hospitalization.isHospitalized ? colors.warning : colors.success}
          value={hospitalization.isHospitalized ? 'Ativa' : 'Livre'}
        />
        <SummaryCard label="Restante" tone={colors.info} value={formatHospitalRemaining(hospitalization.remainingSeconds)} />
        <SummaryCard label="Créditos" tone={colors.accent} value={`${center?.player.credits ?? '--'}`} />
      </View>

      <NpcInflationPanel summary={center?.npcInflation ?? null} />

      {isLoading && !center ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Carregando centro hospitalar</Text>
          <Text style={styles.loadingCopy}>Sincronizando internação, serviços e ofertas permanentes.</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <Banner
          actionLabel="Tentar de novo"
          message={errorMessage}
          tone="danger"
          onPress={() => {
            void loadHospitalCenter();
          }}
        />
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Situação atual</Text>
        <Text style={styles.mainReason}>{formatHospitalizationReason(hospitalization)}</Text>
        <Text style={styles.metaCopy}>
          Início: {hospitalization.startedAt ? formatDateTime(hospitalization.startedAt) : 'não informado'}.
        </Text>
        <Text style={styles.metaCopy}>
          Alta prevista: {hospitalization.endsAt ? formatDateTime(hospitalization.endsAt) : 'agora'}.
        </Text>
        <Text style={styles.helperCopy}>
          {hospitalization.isHospitalized
            ? 'Algumas ações continuam bloqueadas pelo backend enquanto a internação estiver ativa. Use esta tela para acompanhar o timer e aproveitar os serviços liberados.'
            : canActNow
              ? 'Você está livre e pode usar normalmente o hospital para cura, detox, cirurgia, plano e consumíveis.'
              : 'Nenhum serviço imediato foi destravado agora, mas o centro continua mostrando custos, limites e o estado atual do personagem.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Serviços rápidos</Text>
        <ActionCard
          accent={colors.danger}
          availability={center?.services.treatment}
          buttonLabel="Tratar HP"
          disabled={isMutating || !center?.services.treatment.available}
          isPending={pendingAction === 'treatment'}
          label="Tratamento"
          meta={buildHospitalServiceCopy('treatment', center?.services.treatment ?? unavailableHospitalService())}
          onPress={() => {
            void runHospitalAction('treatment');
          }}
        />
        <ActionCard
          accent={colors.warning}
          availability={center?.services.detox}
          buttonLabel="Desintoxicar"
          disabled={isMutating || !center?.services.detox.available}
          isPending={pendingAction === 'detox'}
          label="Desintoxicação"
          meta={buildHospitalServiceCopy('detox', center?.services.detox ?? unavailableHospitalService())}
          onPress={() => {
            void runHospitalAction('detox');
          }}
        />
        <ActionCard
          accent={colors.accent}
          availability={center?.services.healthPlan}
          buttonLabel="Ativar plano"
          disabled={isMutating || !center?.services.healthPlan.available}
          isPending={pendingAction === 'healthPlan'}
          label="Plano de saúde"
          meta={buildHospitalServiceCopy('healthPlan', center?.services.healthPlan ?? unavailableHospitalService())}
          onPress={() => {
            void runHospitalAction('healthPlan');
          }}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Consumíveis permanentes</Text>
        {center?.statItems.length ? (
          center.statItems.map((offer) => (
            <ActionCard
              key={offer.itemCode}
              accent={offer.available ? colors.success : colors.line}
              availability={{
                available: offer.available,
                creditsCost: null,
                moneyCost: offer.costMoney,
                reason: offer.reason,
              }}
              buttonLabel="Comprar"
              disabled={isMutating || !offer.available}
              isPending={pendingAction === 'statItem'}
              label={offer.label}
              meta={`${offer.description} ${buildHospitalStatItemCopy(offer)}`}
              onPress={() => {
                void runHospitalAction('statItem', { itemCode: offer.itemCode });
              }}
            />
          ))
        ) : (
          <EmptyState copy="Nenhum consumível hospitalar configurado neste build." />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cirurgia plástica</Text>
        <CharacterPreviewCard
          hairId={appearanceDraft.hair}
          hairLabel={selectedHair.label}
          outfitId={appearanceDraft.outfit}
          outfitLabel={selectedOutfit.label}
          skinId={appearanceDraft.skin}
          skinLabel={selectedSkin.label}
          vocation={player?.vocation ?? VocationType.Cria}
          vocationLabel={surgeryLabel}
        />
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Nickname</Text>
          <TextInput
            accessibilityLabel="Novo nickname"
            autoCapitalize="none"
            onChangeText={setNicknameDraft}
            placeholder="Novo apelido"
            placeholderTextColor={colors.muted}
            style={styles.textInput}
            value={nicknameDraft}
          />

          <Text style={styles.fieldLabel}>Pele</Text>
          <ToneRow
            onSelect={(skin) => {
              setAppearanceDraft((current) => ({ ...current, skin }));
            }}
            selectedId={appearanceDraft.skin}
          />

          <Text style={styles.fieldLabel}>Cabelo</Text>
          <ChoiceRow
            onSelect={(hair) => {
              setAppearanceDraft((current) => ({ ...current, hair }));
            }}
            options={HOSPITAL_HAIR_OPTIONS}
            selectedId={appearanceDraft.hair}
          />

          <Text style={styles.fieldLabel}>Roupa</Text>
          <ChoiceRow
            onSelect={(outfit) => {
              setAppearanceDraft((current) => ({ ...current, outfit }));
            }}
            options={HOSPITAL_OUTFIT_OPTIONS}
            selectedId={appearanceDraft.outfit}
          />

          <Text style={styles.helperCopy}>
            {buildHospitalServiceCopy('surgery', center?.services.surgery ?? unavailableHospitalService())}
          </Text>

          <Pressable
            accessibilityLabel={`Aplicar cirurgia por ${center?.services.surgery.creditsCost ?? 0} créditos`}
            accessibilityRole="button"
            disabled={isMutating || !center?.services.surgery.available || !surgeryHasChanges}
            onPress={() => {
              void runHospitalAction('surgery');
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isMutating || !center?.services.surgery.available || !surgeryHasChanges)
                ? styles.buttonPressed
                : null,
            ]}
          >
            {pendingAction === 'surgery' ? (
              <View style={styles.primaryButtonContent}>
                <ActivityIndicator color={colors.background} size="small" />
                <Text style={styles.primaryButtonLabel}>Aplicando cirurgia...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonLabel}>
                Aplicar cirurgia ({center?.services.surgery.creditsCost ?? 0} créditos)
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <MutationResultModal
        message={resultMessage}
        onClose={() => {
          setResultMessage(null);
        }}
        tone={resultTone}
        visible={Boolean(resultMessage)}
      />
    </InGameScreenLayout>
  );
}

function buildSurgeryPayload(
  center: Awaited<ReturnType<typeof hospitalApi.getCenter>> | null,
  nicknameDraft: string,
  appearanceDraft: CharacterAppearance,
) {
  if (!center) {
    return {};
  }

  const payload: {
    appearance?: CharacterAppearance;
    nickname?: string;
  } = {};
  const nextNickname = nicknameDraft.trim();

  if (nextNickname.length > 0 && nextNickname !== center.player.nickname) {
    payload.nickname = nextNickname;
  }

  if (
    appearanceDraft.skin !== center.player.appearance.skin ||
    appearanceDraft.hair !== center.player.appearance.hair ||
    appearanceDraft.outfit !== center.player.appearance.outfit
  ) {
    payload.appearance = appearanceDraft;
  }

  return payload;
}

function unavailableHospitalService() {
  return {
    available: false,
    creditsCost: null,
    moneyCost: null,
    reason: 'Indisponível agora.',
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

function formatDateTime(dateValue: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateValue));
}

function SummaryCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  accent,
  availability,
  buttonLabel,
  disabled,
  isPending = false,
  label,
  meta,
  onPress,
}: {
  accent: string;
  availability?: {
    available: boolean;
    creditsCost: number | null;
    moneyCost: number | null;
    reason: string | null;
  };
  buttonLabel: string;
  disabled: boolean;
  isPending?: boolean;
  label: string;
  meta: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <View style={styles.actionCard}>
      <View style={styles.actionCopy}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionMeta}>{meta}</Text>
        <Text style={styles.actionCost}>
          {availability?.creditsCost
            ? `${availability.creditsCost} créditos`
            : availability?.moneyCost
              ? formatCurrency(availability.moneyCost)
              : 'Sem custo adicional'}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={buttonLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.inlineButton,
          { borderColor: accent },
          (pressed || disabled) ? styles.buttonPressed : null,
        ]}
      >
        {isPending ? (
          <View style={styles.inlineButtonContent}>
            <ActivityIndicator color={accent} size="small" />
            <Text style={[styles.inlineButtonLabel, { color: accent }]}>Processando...</Text>
          </View>
        ) : (
          <Text style={[styles.inlineButtonLabel, { color: accent }]}>{buttonLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

function Banner({
  actionLabel,
  message,
  onPress,
  tone,
}: {
  actionLabel?: string;
  message: string;
  onPress?: () => void;
  tone: 'danger' | 'info';
}): JSX.Element {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.bannerDanger : styles.bannerInfo]}>
      <Text style={styles.bannerCopy}>{message}</Text>
      {actionLabel && onPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.bannerButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.bannerButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MutationResultModal({
  message,
  onClose,
  tone,
  visible,
}: {
  message: string | null;
  onClose: () => void;
  tone: 'danger' | 'info';
  visible: boolean;
}): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, tone === 'danger' ? styles.modalCardDanger : styles.modalCardInfo]}>
          <Text style={styles.modalTitle}>{tone === 'danger' ? 'Ação falhou' : 'Ação executada'}</Text>
          <Text style={styles.modalCopy}>{message}</Text>
          <Pressable
            accessibilityLabel="Fechar resultado do hospital"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.primaryButtonLabel}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ChoiceRow({
  onSelect,
  options,
  selectedId,
}: {
  onSelect: (id: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
  selectedId: string;
}): JSX.Element {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => (
        <Pressable
          accessibilityLabel={`Selecionar ${option.label}`}
          accessibilityRole="button"
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={({ pressed }) => [
            styles.choicePill,
            selectedId === option.id ? styles.choicePillSelected : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.choicePillLabel}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ToneRow({
  onSelect,
  selectedId,
}: {
  onSelect: (id: string) => void;
  selectedId: string;
}): JSX.Element {
  return (
    <View style={styles.toneRow}>
      {HOSPITAL_SKIN_OPTIONS.map((option) => {
        const isSelected = option.id === selectedId;

        return (
          <Pressable
            accessibilityLabel={`Selecionar tom de pele ${option.label}`}
            accessibilityRole="button"
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.toneOption,
              isSelected ? styles.toneOptionSelected : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <View style={[styles.toneSwatch, { backgroundColor: option.swatch }]} />
            <Text style={styles.toneLabel}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyState({ copy }: { copy: string }): JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  actionCopy: {
    gap: 4,
  },
  actionCost: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  actionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  actionMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  banner: {
    borderRadius: 16,
    gap: 10,
    padding: 14,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '800',
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerDanger: {
    backgroundColor: '#3a1717',
    borderColor: '#6a2e2e',
    borderWidth: 1,
  },
  bannerInfo: {
    backgroundColor: '#172233',
    borderColor: '#2c405f',
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.84,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  choicePill: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  choicePillLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  choicePillSelected: {
    backgroundColor: '#2c2417',
    borderColor: colors.accent,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyState: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  emptyStateCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  helperCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  infoStrip: {
    backgroundColor: '#2e1f15',
    borderColor: '#6b4a2c',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  infoStripCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  infoStripTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inlineButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inlineButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  inlineButtonLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  mainReason: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  metaCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 9, 13, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 22,
    gap: 14,
    padding: 20,
    width: '100%',
  },
  modalCardDanger: {
    backgroundColor: '#3b1f1f',
    borderColor: 'rgba(220, 102, 102, 0.32)',
    borderWidth: 1,
  },
  modalCardInfo: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderWidth: 1,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 2,
    minWidth: 132,
    padding: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  textInput: {
    backgroundColor: '#151515',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toneLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  toneOption: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toneOptionSelected: {
    borderColor: colors.accent,
  },
  toneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  toneSwatch: {
    borderRadius: 999,
    height: 22,
    width: 22,
  },
});
