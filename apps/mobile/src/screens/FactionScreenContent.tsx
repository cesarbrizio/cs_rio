import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { FACTION_SCREEN_TABS, resolveFactionRankLabel, resolveFactionScreenTabLabel } from '../features/faction';
import { colors } from '../theme/colors';
import { ActionButton, MutationResultModal, styles, SummaryCard } from './FactionScreen.parts';
import { FactionScreenBankSection, FactionScreenMembersSection } from './FactionScreenMembersBankSections';
import { FactionScreenOverviewSection } from './FactionScreenOverviewSection';
import { FactionScreenUpgradesSection, FactionScreenLeadershipSection } from './FactionScreenUpgradesLeadershipSections';
import { FactionScreenWarSection } from './FactionScreenWarSection';
import { type FactionScreenController } from './useFactionScreenController';

export function FactionScreenContent({
  controller,
}: {
  controller: FactionScreenController;
}): JSX.Element {
  const {
    activeTab,
    currentFaction,
    currentFactionId,
    errorMessage,
    feedbackMessage,
    handleRefresh,
    isLoading,
    isMutating,
    loadErrorMessage,
    myRank,
    setActiveTab,
    setErrorMessage,
    setFeedbackMessage,
  } = controller;

  return (
    <InGameScreenLayout
      subtitle="Centro unificado da facção: membros, banco, upgrades, guerra e chat interno sem sair do celular. DMs vivem em Contatos; global, local e comércio ficam fora deste recorte."
      title="Falar com a faccao"
    >
      <View style={styles.topActionRow}>
        <ActionButton
          disabled={isLoading || isMutating}
          label="Atualizar painel"
          onPress={() => {
            void handleRefresh();
          }}
        />
      </View>

      {isLoading && !currentFaction ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Sincronizando facção</Text>
          <Text style={styles.loadingCopy}>
            Carregando membros, banco, upgrades, liderança e sala interna.
          </Text>
        </View>
      ) : null}

      {loadErrorMessage ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Falha ao carregar facção</Text>
          <Text style={styles.resultCopy}>{loadErrorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <SummaryCard label="Facção" tone={colors.accent} value={currentFaction?.abbreviation ?? 'Sem'} />
        <SummaryCard label="Seu cargo" tone={colors.info} value={resolveFactionRankLabel(myRank)} />
        <SummaryCard label="Membros" tone={colors.success} value={`${currentFaction?.memberCount ?? 0}`} />
        <SummaryCard label="Pontos" tone={colors.warning} value={`${currentFaction?.points ?? 0}`} />
      </View>

      <View style={styles.segmentRow}>
        {FACTION_SCREEN_TABS.map((tab) => (
          <Pressable
            accessibilityLabel={`Abrir aba ${resolveFactionScreenTabLabel(tab)}`}
            accessibilityRole="button"
            disabled={!currentFactionId && tab !== 'overview'}
            key={tab}
            onPress={() => {
              setActiveTab(tab);
            }}
            style={({ pressed }) => [
              styles.segmentButton,
              activeTab === tab ? styles.segmentButtonActive : null,
              !currentFactionId && tab !== 'overview' ? styles.segmentButtonDisabled : null,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                activeTab === tab ? styles.segmentLabelActive : null,
                !currentFactionId && tab !== 'overview' ? styles.segmentLabelDisabled : null,
              ]}
            >
              {resolveFactionScreenTabLabel(tab)}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'overview' ? <FactionScreenOverviewSection controller={controller} /> : null}
      {currentFactionId && activeTab === 'members' ? <FactionScreenMembersSection controller={controller} /> : null}
      {currentFactionId && activeTab === 'bank' ? <FactionScreenBankSection controller={controller} /> : null}
      {currentFactionId && activeTab === 'upgrades' ? <FactionScreenUpgradesSection controller={controller} /> : null}
      {currentFactionId && activeTab === 'war' ? <FactionScreenWarSection controller={controller} /> : null}
      {currentFactionId && activeTab === 'leadership' ? <FactionScreenLeadershipSection controller={controller} /> : null}

      <MutationResultModal
        message={errorMessage ?? feedbackMessage}
        onClose={() => {
          setErrorMessage(null);
          setFeedbackMessage(null);
        }}
        tone={errorMessage ? 'danger' : 'info'}
        visible={Boolean(errorMessage ?? feedbackMessage)}
      />
    </InGameScreenLayout>
  );
}
