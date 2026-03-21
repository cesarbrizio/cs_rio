import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { WarResultModal } from '../components/WarResultModal';
import {
  buildFavelaForceSummaryLines,
  resolveFavelaStateLabel,
  resolveRegionLabel,
  resolveSatisfactionTierLabel,
  resolveTerritoryActionVisibility,
} from '../features/territory';
import { colors } from '../theme/colors';
import {
  ActionButton,
  InlineBanner,
  MutationResultModal,
  StatusTag,
  styles,
  SummaryCard,
} from './TerritoryScreen.parts';
import { TerritoryScreenConflictSection } from './TerritoryScreenConflictSection';
import { TerritoryScreenSelectedFavelaOverviewSection } from './TerritoryScreenSelectedFavelaOverviewSection';
import { TerritoryScreenServicesBaileSection } from './TerritoryScreenServicesBaileSection';
import { type TerritoryScreenController } from './useTerritoryScreenController';
import {
  resolveSatisfactionColor,
  resolveStateColor,
  resolveStateTone,
} from './territoryScreenSupport';

export function TerritoryScreenContent({
  controller,
}: {
  controller: TerritoryScreenController;
}): JSX.Element {
  const {
    baileBook,
    baileBudgetInput,
    baileEntryPriceInput,
    canAdvanceSelectedWarRound,
    canPrepareSelectedWar,
    errorMessage,
    expandedActionId,
    feedbackMessage,
    handleAdvanceWarRound,
    handleConquer,
    handleDeclareWar,
    handleInstallService,
    handleNegotiatePropina,
    handleOrganizeBaile,
    handlePrepareWar,
    handleSelectFavela,
    handleSelectRegion,
    handleUpgradeService,
    handleX9Desenrolo,
    headlineStats,
    isDetailLoading,
    isLoading,
    isMutating,
    loadErrorMessage,
    loadFavelaDetail,
    loadTerritoryHub,
    nowMs,
    overview,
    playerFactionId,
    recentLosses,
    regionGroups,
    selectedActionVisibility,
    selectedAlerts,
    selectedBaileTier,
    selectedFavela,
    selectedFavelaId,
    selectedRegion,
    selectedRegionId,
    selectedServices,
    selectedWar,
    selectedWarResultCue,
    selectedWarSide,
    servicesBook,
    setBaileBudgetInput,
    setBaileEntryPriceInput,
    setErrorMessage,
    setExpandedActionId,
    setFeedbackMessage,
    setSelectedBaileTier,
    setSelectedFavelaId,
    setSelectedRegionId,
    setWarBudgetInput,
    setWarResultCue,
    setWarSoldierCommitmentInput,
    visibleRegionId,
    warBudgetInput,
    warResultCue,
    warSoldierCommitmentInput,
  } = controller;

  return (
    <InGameScreenLayout
      subtitle="Mapa vivo das favelas, leitura de satisfação, serviços, baile, pressão policial e guerra no mesmo centro de comando."
      title="Dominar area"
    >
      <View style={styles.summaryGrid}>
        <SummaryCard label="Favelas" tone={colors.accent} value={`${headlineStats.totalFavelas}`} />
        <SummaryCard
          label="Sob controle"
          tone={colors.success}
          value={`${headlineStats.playerControlledFavelas}`}
        />
        <SummaryCard
          label="Em guerra"
          tone={colors.danger}
          value={`${headlineStats.atWarFavelas}`}
        />
        <SummaryCard
          label="X9 ativo"
          tone={colors.warning}
          value={`${headlineStats.x9ActiveFavelas}`}
        />
      </View>

      {isLoading && !overview ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Sincronizando território</Text>
          <Text style={styles.loadingCopy}>
            Carregando mapa de favelas, região dominante, serviços e conflitos ativos.
          </Text>
        </View>
      ) : null}

      {loadErrorMessage ? (
        <InlineBanner
          actionLabel="Tentar de novo"
          message={loadErrorMessage}
          onPress={() => {
            void loadTerritoryHub(selectedFavelaId, selectedRegionId);
          }}
          tone="danger"
        />
      ) : null}

      {overview ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Perdas recentes</Text>
            <Text style={styles.sectionSubtitle}>
              Toda perda territorial recente fica registrada aqui, inclusive quando o jogo foi
              aberto depois do fato.
            </Text>

            {recentLosses.length > 0 ? (
              <View style={styles.lossList}>
                {recentLosses.map((loss) => (
                  <Pressable
                    accessibilityLabel={`Focar perda territorial em ${loss.favelaName}`}
                    accessibilityRole="button"
                    key={loss.key}
                    onPress={() => {
                      setSelectedRegionId(loss.regionId);
                      setSelectedFavelaId(loss.favelaId);
                      void loadFavelaDetail(loss.favelaId);
                    }}
                    style={({ pressed }) => [styles.lossCard, pressed ? styles.cardPressed : null]}
                  >
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionHeaderCopy}>
                        <Text style={styles.lossTitle}>{loss.title}</Text>
                        <Text style={styles.lossMeta}>
                          {loss.causeLabel} · {loss.occurredAtLabel}
                        </Text>
                      </View>
                      <StatusTag
                        label={loss.controllerLabel}
                        tone={loss.outcomeTone === 'danger' ? 'danger' : 'warning'}
                      />
                    </View>

                    <Text style={styles.lossBody}>{loss.body}</Text>
                    <Text style={styles.lossImpact}>{loss.territorialImpact}</Text>
                    <Text style={styles.lossImpact}>{loss.economicImpact}</Text>
                    <Text style={styles.lossImpact}>{loss.politicalImpact}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>Sem perdas recentes</Text>
                <Text style={styles.detailCopy}>
                  Quando sua facção perder território, o registro aparece aqui e também vira
                  modal/notificação no retorno ao jogo.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mapa regional</Text>
            <Text style={styles.sectionSubtitle}>
              Toque numa região para focar as favelas dela. Domínio total fortalece receita,
              proteção e segurança.
            </Text>

            <View style={styles.regionGrid}>
              {regionGroups.map((group) => (
                <Pressable
                  accessibilityLabel={`Focar região ${resolveRegionLabel(group.region.regionId)}`}
                  accessibilityRole="button"
                  key={group.region.regionId}
                  onPress={() => {
                    handleSelectRegion(group.region.regionId);
                  }}
                  style={({ pressed }) => [
                    styles.regionCard,
                    group.region.regionId === visibleRegionId ? styles.regionCardActive : null,
                    pressed ? styles.cardPressed : null,
                  ]}
                >
                  <Text style={styles.regionTitle}>
                    {resolveRegionLabel(group.region.regionId)}
                  </Text>
                  <Text style={styles.regionStat}>
                    {group.region.playerFactionControlledFavelas}/{group.region.totalFavelas} sob
                    sua facção
                  </Text>
                  <Text style={styles.regionCopy}>
                    Dominante: {group.region.dominantFaction?.abbreviation ?? '--'} · Guerra:{' '}
                    {group.region.atWarFavelas}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mapa de favelas</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedRegion
                ? `${resolveRegionLabel(selectedRegion.region.regionId)} · ${selectedRegion.favelas.length} favela(s)`
                : 'Nenhuma região carregada'}
            </Text>

            <View style={styles.favelaGrid}>
              {selectedRegion?.favelas.map((favela) => {
                const actionVisibility = resolveTerritoryActionVisibility({
                  favela,
                  playerFactionId,
                });

                return (
                  <Pressable
                    accessibilityLabel={`Selecionar favela ${favela.name}`}
                    accessibilityRole="button"
                    key={favela.id}
                    onPress={() => {
                      handleSelectFavela(favela);
                    }}
                    style={({ pressed }) => [
                      styles.favelaCard,
                      favela.id === selectedFavela?.id ? styles.favelaCardActive : null,
                      pressed ? styles.cardPressed : null,
                    ]}
                  >
                    <View style={styles.favelaHeader}>
                      <Text style={styles.favelaTitle}>{favela.name}</Text>
                      <StatusTag
                        label={resolveFavelaStateLabel(favela.state)}
                        tone={resolveStateTone(favela.state)}
                      />
                    </View>
                    <Text style={styles.favelaMeta}>
                      {favela.controllingFaction
                        ? `Controle: ${favela.controllingFaction.name}`
                        : 'Controle: sem facção'}
                    </Text>
                    <Text style={styles.favelaMeta}>
                      Dificuldade {favela.difficulty} · Satisfação {favela.satisfaction}
                    </Text>
                    <Text style={styles.favelaMeta}>
                      {resolveSatisfactionTierLabel(favela.satisfactionProfile.tier)} · Pop.{' '}
                      {favela.population.toLocaleString('pt-BR')}
                    </Text>
                    {buildFavelaForceSummaryLines(favela).map((line) => (
                      <Text key={`${favela.id}-${line}`} style={styles.favelaMeta}>
                        {line}
                      </Text>
                    ))}

                    {favela.id === selectedFavela?.id ? (
                      <>
                        <View style={styles.actionRow}>
                          {actionVisibility.canConquer ? (
                            <ActionButton
                              disabled={isMutating}
                              label="Conquistar"
                              onPress={() => {
                                setExpandedActionId((current) =>
                                  current === 'conquer' ? null : 'conquer',
                                );
                              }}
                              tone="accent"
                            />
                          ) : null}
                          {actionVisibility.canDeclareWar ? (
                            <ActionButton
                              disabled={isMutating}
                              label="Declarar guerra"
                              onPress={() => {
                                setExpandedActionId((current) =>
                                  current === 'declare-war' ? null : 'declare-war',
                                );
                              }}
                              tone="danger"
                            />
                          ) : null}
                          {actionVisibility.showNegotiatePropina ? (
                            <ActionButton
                              disabled={isMutating}
                              label="Negociar arrego"
                              onPress={() => {
                                setExpandedActionId((current) =>
                                  current === 'propina' ? null : 'propina',
                                );
                              }}
                              tone="warning"
                            />
                          ) : null}
                          {actionVisibility.showX9Desenrolo ? (
                            <ActionButton
                              disabled={isMutating}
                              label="Desenrolo"
                              onPress={() => {
                                setExpandedActionId((current) => (current === 'x9' ? null : 'x9'));
                              }}
                              tone="warning"
                            />
                          ) : null}
                        </View>

                        {expandedActionId === 'conquer' && actionVisibility.canConquer ? (
                          <View style={styles.inlineActionCard}>
                            <Text style={styles.detailTitle}>Tomada da favela</Text>
                            <Text style={styles.detailCopy}>
                              A ação abre uma invasão imediata para disputar {favela.name}. Se o
                              ataque for aceito, a briga começa na hora.
                            </Text>
                            <View style={styles.actionRow}>
                              <ActionButton
                                disabled={isMutating}
                                label="Confirmar conquista"
                                onPress={() => {
                                  setExpandedActionId(null);
                                  void handleConquer();
                                }}
                                tone="accent"
                              />
                            </View>
                          </View>
                        ) : null}

                        {expandedActionId === 'declare-war' && actionVisibility.canDeclareWar ? (
                          <View style={styles.inlineActionCard}>
                            <Text style={styles.detailTitle}>Abrir guerra formal</Text>
                            <Text style={styles.detailCopy}>
                              Isso formaliza o conflito por {favela.name}. Seu cargo, saldo e as
                              regras da facção ainda precisam bater para a guerra abrir.
                            </Text>
                            <View style={styles.actionRow}>
                              <ActionButton
                                disabled={isMutating}
                                label="Confirmar guerra"
                                onPress={() => {
                                  setExpandedActionId(null);
                                  void handleDeclareWar();
                                }}
                                tone="danger"
                              />
                            </View>
                          </View>
                        ) : null}

                        {expandedActionId === 'propina' && actionVisibility.showNegotiatePropina ? (
                          <View style={styles.inlineActionCard}>
                            <Text style={styles.detailTitle}>Negociar arrego</Text>
                            <Text style={styles.detailCopy}>
                              A negociação tenta aliviar a pressão policial atual em {favela.name}.
                              O custo e o efeito podem variar conforme a situação da favela.
                            </Text>
                            <View style={styles.actionRow}>
                              <ActionButton
                                disabled={isMutating}
                                label="Confirmar arrego"
                                onPress={() => {
                                  setExpandedActionId(null);
                                  void handleNegotiatePropina();
                                }}
                                tone="warning"
                              />
                            </View>
                          </View>
                        ) : null}

                        {expandedActionId === 'x9' && actionVisibility.showX9Desenrolo ? (
                          <View style={styles.inlineActionCard}>
                            <Text style={styles.detailTitle}>Tentar desenrolo</Text>
                            <Text style={styles.detailCopy}>
                              O desenrolo tenta neutralizar o evento de X9 em {favela.name}. A
                              tentativa pode falhar e a rua cobra a conta.
                            </Text>
                            <View style={styles.actionRow}>
                              <ActionButton
                                disabled={isMutating}
                                label="Confirmar desenrolo"
                                onPress={() => {
                                  setExpandedActionId(null);
                                  void handleX9Desenrolo();
                                }}
                                tone="warning"
                              />
                            </View>
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {selectedFavela ? (
            <>
              <TerritoryScreenSelectedFavelaOverviewSection controller={controller} />
              <TerritoryScreenServicesBaileSection controller={controller} />
              <TerritoryScreenConflictSection controller={controller} />
            </>
          ) : null}
        </>
      ) : null}

      <MutationResultModal
        message={errorMessage ?? feedbackMessage}
        onClose={() => {
          setErrorMessage(null);
          setFeedbackMessage(null);
        }}
        tone={errorMessage ? 'danger' : 'info'}
        visible={Boolean(errorMessage ?? feedbackMessage)}
      />
      <WarResultModal
        cue={warResultCue}
        onClose={() => {
          setWarResultCue(null);
        }}
        visible={Boolean(warResultCue)}
      />
    </InGameScreenLayout>
  );
}
