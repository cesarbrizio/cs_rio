import { useFocusEffect } from '@react-navigation/native';
import { type CharacterAppearance, type HospitalStatItemCode, VocationType } from '@cs-rio/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

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
import {
  ActionCard,
  Banner,
  buildSurgeryPayload,
  ChoiceRow,
  emptyHospitalizationState,
  EmptyState,
  formatDateTime,
  MutationResultModal,
  styles,
  SummaryCard,
  ToneRow,
  unavailableHospitalService,
} from './HospitalScreen.parts';

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
  const [center, setCenter] = useState<Awaited<ReturnType<typeof hospitalApi.getCenter>> | null>(
    null,
  );
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
    () =>
      getLiveHospitalizationStatus(
        center?.hospitalization ?? player?.hospitalization ?? emptyHospitalizationState(),
        nowMs,
      ),
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

  const runHospitalAction = useCallback(
    async (
      action: 'detox' | 'healthPlan' | 'statItem' | 'surgery' | 'treatment',
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
                  ? await hospitalApi.purchaseStatItem({
                      itemCode: payload?.itemCode ?? 'cerebrina',
                    })
                  : await hospitalApi.surgery(
                      buildSurgeryPayload(center, nicknameDraft, appearanceDraft),
                    );

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
    },
    [appearanceDraft, center, nicknameDraft, refreshPlayerProfile, setBootstrapStatus],
  );

  const selectedSkin =
    HOSPITAL_SKIN_OPTIONS.find((option) => option.id === appearanceDraft.skin) ??
    HOSPITAL_SKIN_OPTIONS[1];
  const selectedHair =
    HOSPITAL_HAIR_OPTIONS.find((option) => option.id === appearanceDraft.hair) ??
    HOSPITAL_HAIR_OPTIONS[0];
  const selectedOutfit =
    HOSPITAL_OUTFIT_OPTIONS.find((option) => option.id === appearanceDraft.outfit) ??
    HOSPITAL_OUTFIT_OPTIONS[0];

  return (
    <InGameScreenLayout
      subtitle="Acompanhe a internação, cuide da vida, trate vício, ative o plano de saúde e ajuste o visual do personagem."
      title="Ir ao hospital"
    >
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="HP"
          tone={colors.danger}
          value={`${center?.player.hp ?? player?.resources.hp ?? '--'}`}
        />
        <SummaryCard
          label="Internação"
          tone={hospitalization.isHospitalized ? colors.warning : colors.success}
          value={hospitalization.isHospitalized ? 'Ativa' : 'Livre'}
        />
        <SummaryCard
          label="Restante"
          tone={colors.info}
          value={formatHospitalRemaining(hospitalization.remainingSeconds)}
        />
        <SummaryCard
          label="Créditos"
          tone={colors.accent}
          value={`${center?.player.credits ?? '--'}`}
        />
      </View>

      <NpcInflationPanel summary={center?.npcInflation ?? null} />

      {isLoading && !center ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Carregando centro hospitalar</Text>
          <Text style={styles.loadingCopy}>
            Carregando internação, serviços e ofertas permanentes.
          </Text>
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
          Início:{' '}
          {hospitalization.startedAt ? formatDateTime(hospitalization.startedAt) : 'não informado'}.
        </Text>
        <Text style={styles.metaCopy}>
          Alta prevista: {hospitalization.endsAt ? formatDateTime(hospitalization.endsAt) : 'agora'}
          .
        </Text>
        <Text style={styles.helperCopy}>
          {hospitalization.isHospitalized
            ? 'Enquanto a internação estiver ativa, parte dos serviços continua travada. Use esta tela para acompanhar o tempo e aproveitar o que já foi liberado.'
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
          meta={buildHospitalServiceCopy(
            'treatment',
            center?.services.treatment ?? unavailableHospitalService(),
          )}
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
          meta={buildHospitalServiceCopy(
            'detox',
            center?.services.detox ?? unavailableHospitalService(),
          )}
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
          meta={buildHospitalServiceCopy(
            'healthPlan',
            center?.services.healthPlan ?? unavailableHospitalService(),
          )}
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
            {buildHospitalServiceCopy(
              'surgery',
              center?.services.surgery ?? unavailableHospitalService(),
            )}
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
              pressed || isMutating || !center?.services.surgery.available || !surgeryHasChanges
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
