import { Pressable, Text, TextInput, View } from 'react-native';

import { resolveFactionCoordinationLabel } from '../features/faction';
import { colors } from '../theme/colors';
import { ActionButton, Banner, EmptyState, SectionCard, styles, SummaryCard, Tag } from './FactionScreen.parts';
import type { FactionScreenController } from './useFactionScreenController';
import {
  buildRealtimeStatusCopy,
  formatDateTimeLabel,
  resolveRealtimeStatusColor,
  resolveRealtimeStatusLabel,
} from './factionScreenSupport';

const COORDINATION_KINDS = ['attack', 'defend', 'gather', 'supply'] as const;

export function FactionScreenWarSection({
  controller,
}: {
  controller: FactionScreenController;
}): JSX.Element {
  const {
    canLaunchSelectedCrime,
    chatMessage,
    coordinationKind,
    coordinationLabel,
    eligibleWarMembers,
    handleLaunchFactionCrime,
    handleSendChat,
    handleSendCoordination,
    isMutating,
    realtimeSnapshot,
    selectedCrime,
    selectedCrimeParticipants,
    selectedParticipantIds,
    setChatMessage,
    setCoordinationKind,
    setCoordinationLabel,
    setSelectedCrimeId,
    setSelectedParticipantIds,
    sortedRealtimeChat,
    sortedRealtimeCoordination,
    warCatalog,
  } = controller;

  return (
    <>
      <SectionCard
        subtitle="Canal ao vivo da facção com status de conexão, presença online e feed curto para alinhamento rápido. Este é o chat coletivo do bonde."
        title="Sala da facção"
      >
        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Status"
            tone={resolveRealtimeStatusColor(realtimeSnapshot.status)}
            value={resolveRealtimeStatusLabel(realtimeSnapshot.status)}
          />
          <SummaryCard label="Online" tone={colors.success} value={`${realtimeSnapshot.members.length}`} />
          <SummaryCard label="Chat" tone={colors.accent} value={`${realtimeSnapshot.chatMessages.length}`} />
          <SummaryCard
            label="Chamados"
            tone={colors.warning}
            value={`${realtimeSnapshot.coordinationCalls.length}`}
          />
        </View>
        <Banner
          copy={buildRealtimeStatusCopy(realtimeSnapshot.status)}
          tone={realtimeSnapshot.status === 'connected' ? 'info' : 'danger'}
        />
      </SectionCard>

      <SectionCard
        subtitle="Chat interno da facção em tempo real para alinhamento rápido antes de crimes coletivos. O social atual fecha em facção + DMs; global, local e comércio ficam fora do recorte."
        title="Chat da facção"
      >
        <TextInput
          onChangeText={setChatMessage}
          placeholder="Mensagem curta para o QG..."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textarea]}
          value={chatMessage}
        />
        <ActionButton
          disabled={isMutating || realtimeSnapshot.status !== 'connected'}
          label="Enviar no chat"
          onPress={handleSendChat}
        />
        {sortedRealtimeChat.length > 0 ? (
          <View style={styles.listColumn}>
            {sortedRealtimeChat.map((entry) => (
              <View key={entry.id} style={styles.listCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    {entry.kind === 'system' ? 'Sistema' : entry.nickname}
                  </Text>
                  <Text style={styles.mutedSmall}>{formatDateTimeLabel(entry.createdAt)}</Text>
                </View>
                <Text style={styles.cardCopy}>{entry.message}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState copy="Nenhuma mensagem ainda. Assim que alguém entrar na sala ou mandar chat, o feed aparece aqui." />
        )}
      </SectionCard>

      <SectionCard
        subtitle="Feed curto de coordenação para situações quentes. O mais novo aparece primeiro para resposta rápida."
        title="Chamadas do bonde"
      >
        <View style={styles.filterRow}>
          {COORDINATION_KINDS.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => {
                setCoordinationKind(entry);
              }}
              style={({ pressed }) => [
                styles.filterChip,
                coordinationKind === entry ? styles.filterChipActive : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.filterChipLabel,
                  coordinationKind === entry ? styles.filterChipLabelActive : null,
                ]}
              >
                {resolveFactionCoordinationLabel(entry)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          onChangeText={setCoordinationLabel}
          placeholder="Ex.: Segurar boca principal"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={coordinationLabel}
        />
        <ActionButton
          disabled={isMutating || realtimeSnapshot.status !== 'connected'}
          label="Publicar coordenação"
          onPress={handleSendCoordination}
        />
        {sortedRealtimeCoordination.length > 0 ? (
          <View style={styles.listColumn}>
            {sortedRealtimeCoordination.map((entry) => (
              <View key={entry.id} style={styles.listCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    {resolveFactionCoordinationLabel(entry.kind)} · {entry.label}
                  </Text>
                  <Tag label={entry.nickname} tone="accent" />
                </View>
                <Text style={styles.cardCopy}>{formatDateTimeLabel(entry.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState copy="Sem chamadas ainda. Use o composer acima para puxar ataque, defesa, bonde ou suprimento." />
        )}
      </SectionCard>

      <SectionCard
        subtitle="Crimes coletivos da facção: escolha o alvo, monte a equipe e dispare do próprio celular."
        title="Operação coletiva"
      >
        {warCatalog?.crimes.length ? (
          <>
            <View style={styles.listColumn}>
              {warCatalog.crimes.map((crime) => (
                <Pressable
                  key={crime.id}
                  onPress={() => {
                    setSelectedCrimeId(crime.id);
                  }}
                  style={({ pressed }) => [
                    styles.listCard,
                    selectedCrime?.id === crime.id ? styles.selectedCard : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <View style={styles.cardHeaderStack}>
                    <View style={styles.flexCopy}>
                      <Text style={styles.cardTitle}>{crime.name}</Text>
                      <Text style={styles.cardCopy}>
                        Crew {crime.minimumCrewSize}-{crime.maximumCrewSize} · cansaço {crime.cansacoCost}% · disposição {crime.disposicaoCost}
                      </Text>
                    </View>
                    <Tag
                      label={crime.isRunnable ? 'Pronto' : (crime.lockReason ?? 'Travado')}
                      tone={crime.isRunnable ? 'success' : 'warning'}
                    />
                  </View>
                </Pressable>
              ))}
            </View>

            {selectedCrime ? (
              <>
                <View style={styles.inlineRowWrap}>
                  {eligibleWarMembers.map((member) => {
                    const isSelected = selectedParticipantIds.includes(member.id);

                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => {
                          setSelectedParticipantIds((currentSelection) => {
                            if (currentSelection.includes(member.id)) {
                              return currentSelection.filter((entry) => entry !== member.id);
                            }

                            if (currentSelection.length >= selectedCrime.maximumCrewSize) {
                              return currentSelection;
                            }

                            return [...currentSelection, member.id];
                          });
                        }}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isSelected ? styles.filterChipActive : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipLabel,
                            isSelected ? styles.filterChipLabelActive : null,
                          ]}
                        >
                          {member.nickname}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.cardCopy}>
                  Selecionados: {selectedCrimeParticipants.length} / mínimo {selectedCrime.minimumCrewSize} / máximo {selectedCrime.maximumCrewSize}
                </Text>
                <ActionButton
                  disabled={isMutating || !canLaunchSelectedCrime}
                  label={
                    canLaunchSelectedCrime
                      ? 'Executar crime coletivo'
                      : (selectedCrime.lockReason ?? 'Monte um bonde valido para executar')
                  }
                  onPress={() => {
                    void handleLaunchFactionCrime();
                  }}
                />
              </>
            ) : null}
          </>
        ) : (
          <EmptyState copy="Sem catálogo de crimes coletivos carregado. Verifique se o personagem já está apto para coordenar um bonde." />
        )}
      </SectionCard>
    </>
  );
}
