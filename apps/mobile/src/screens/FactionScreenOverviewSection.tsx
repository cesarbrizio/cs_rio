import { Text, TextInput, View } from 'react-native';

import {
  resolveFactionNpcProgressionCopy,
  resolveFactionNpcProgressionHeadline,
  resolveFactionNpcProgressionMetrics,
  resolveFactionRankLabel,
  formatFactionCurrency,
} from '../features/faction';
import { colors } from '../theme/colors';
import {
  ActionButton,
  Banner,
  EmptyState,
  Field,
  InfoRow,
  SectionCard,
  styles,
  SummaryCard,
  Tag,
} from './FactionScreen.parts';
import type { FactionScreenController } from './useFactionScreenController';
import {
  buildRealtimeStatusCopy,
  formatDateTimeLabel,
  resolveRealtimeStatusColor,
  resolveRealtimeStatusLabel,
} from './factionScreenSupport';

export function FactionScreenOverviewSection({
  controller,
}: {
  controller: FactionScreenController;
}): JSX.Element {
  const {
    configAbbreviation,
    configDescription,
    configName,
    createAbbreviation,
    createDescription,
    createName,
    currentFaction,
    getFactionAvailableJoinSlots,
    getFactionCanSelfJoin,
    handleCreateFaction,
    handleDissolveFaction,
    handleJoinFixedFaction,
    handleLeaveFaction,
    handleUpdateFaction,
    isMutating,
    latestRealtimeChat,
    latestRealtimeCoordination,
    leadershipCenter,
    myRank,
    realtimeSnapshot,
    setActiveTab,
    setConfigAbbreviation,
    setConfigDescription,
    setConfigName,
    setCreateAbbreviation,
    setCreateDescription,
    setCreateName,
    sortedFactions,
  } = controller;

  if (!currentFaction) {
    return (
      <>
        <SectionCard
          subtitle="Sem facção, o celular vira painel de prospecção. Entradas em facções existentes dependem de recrutamento; por aqui você já consegue fundar a sua."
          title="Criar facção"
        >
          <Field label="Nome">
            <TextInput
              onChangeText={setCreateName}
              placeholder="Ex.: Bonde do Asfalto"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={createName}
            />
          </Field>
          <Field label="Sigla">
            <TextInput
              autoCapitalize="characters"
              maxLength={5}
              onChangeText={setCreateAbbreviation}
              placeholder="BDA"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={createAbbreviation}
            />
          </Field>
          <Field label="Descrição">
            <TextInput
              multiline
              onChangeText={setCreateDescription}
              placeholder="Manifesto curto da facção, foco e postura."
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.textarea]}
              value={createDescription}
            />
          </Field>
          <ActionButton
            disabled={isMutating}
            label="Fundar facção"
            onPress={() => {
              void handleCreateFaction();
            }}
          />
        </SectionCard>

        <SectionCard
          subtitle="Radar das facções que já estão rodando na rodada. Facções fixas aceitam entrada direta enquanto houver vagas abertas; as demais ainda exigem recrutamento."
          title="Facção em atividade"
        >
          {sortedFactions.length > 0 ? (
            <View style={styles.listColumn}>
              {sortedFactions.map((faction) => (
                <View key={faction.id} style={styles.listCard}>
                  <View style={styles.cardHeaderStack}>
                    <View style={styles.flexCopy}>
                      <Text style={styles.cardTitle}>
                        {faction.name} · {faction.abbreviation}
                      </Text>
                      <View style={styles.inlineRow}>
                        <Tag
                          label={faction.isFixed ? 'Fixa' : 'Custom'}
                          tone={faction.isFixed ? 'accent' : 'info'}
                        />
                      </View>
                      <Text style={styles.cardCopy}>
                        {faction.memberCount} membros · {faction.points} pontos · líder{' '}
                        {faction.npcLeaderName ?? 'humano'}
                      </Text>
                    </View>
                  </View>
                  {faction.description ? <Text style={styles.cardCopy}>{faction.description}</Text> : null}
                  <Text style={styles.cardCopy}>
                    {faction.isFixed
                      ? `Vagas abertas: ${getFactionAvailableJoinSlots(faction) ?? 0}`
                      : 'Entrada apenas por recrutamento.'}
                  </Text>
                  {getFactionCanSelfJoin(faction) ? (
                    <View style={styles.inlineRow}>
                      <ActionButton
                        disabled={isMutating}
                        label="Entrar como cria"
                        onPress={() => {
                          void handleJoinFixedFaction(faction.id);
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState copy="Nenhuma facção cadastrada ainda. Fundar a primeira já destrava toda a hierarquia." />
          )}
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <SectionCard
        subtitle="Resumo executivo da facção atual com configuração, status do controle e a sua posição na hierarquia."
        title={`${currentFaction.name} · ${currentFaction.abbreviation}`}
      >
        <View style={styles.listColumn}>
          <InfoRow label="Seu cargo" value={resolveFactionRankLabel(myRank)} />
          <InfoRow
            label="Liderança"
            value={leadershipCenter?.leader.nickname ?? currentFaction.npcLeaderName ?? 'Desconhecida'}
          />
          <InfoRow label="Banco" value={formatFactionCurrency(currentFaction.bankMoney)} />
          <InfoRow label="Pontos" value={`${currentFaction.points}`} />
          <InfoRow label="Membros" value={`${currentFaction.memberCount}`} />
        </View>
        {currentFaction.description ? <Text style={styles.cardCopy}>{currentFaction.description}</Text> : null}
        <View style={styles.inlineRow}>
          <Tag label={currentFaction.isFixed ? 'Facção fixa' : 'Facção criada'} tone="accent" />
          <Tag label={currentFaction.isNpcControlled ? 'Líder NPC' : 'Líder humano'} tone="info" />
          <Tag label={currentFaction.isPlayerMember ? 'Seu bonde' : 'Observando'} tone="success" />
        </View>
        {currentFaction.npcProgression ? (
          <View style={styles.listCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.flexCopy}>
                <Text style={styles.cardTitle}>
                  {resolveFactionNpcProgressionHeadline(currentFaction.npcProgression)}
                </Text>
                <Text style={styles.cardCopy}>
                  {resolveFactionNpcProgressionCopy(currentFaction.npcProgression)}
                </Text>
              </View>
              <Tag
                label={currentFaction.npcProgression.eligibleNow ? 'Pronta' : 'Em progresso'}
                tone={currentFaction.npcProgression.eligibleNow ? 'success' : 'warning'}
              />
            </View>
            {currentFaction.autoPromotionResult ? (
              <Banner
                copy={`Ascensão confirmada: ${resolveFactionRankLabel(currentFaction.autoPromotionResult.previousRank)} -> ${resolveFactionRankLabel(currentFaction.autoPromotionResult.newRank)}.`}
                tone="info"
              />
            ) : null}
            <View style={styles.summaryGrid}>
              {resolveFactionNpcProgressionMetrics(currentFaction.npcProgression).map((metric) => (
                <SummaryCard
                  key={metric.label}
                  label={metric.label}
                  tone={colors.info}
                  value={metric.value}
                />
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.inlineRow}>
          <ActionButton
            disabled={isMutating}
            label="Sair da facção"
            onPress={() => {
              void handleLeaveFaction();
            }}
            tone="danger"
          />
          {currentFaction.canDissolve ? (
            <ActionButton
              disabled={isMutating}
              label="Dissolver"
              onPress={() => {
                void handleDissolveFaction();
              }}
              tone="warning"
            />
          ) : null}
        </View>
      </SectionCard>

      <SectionCard
        subtitle="Entrada rápida para o canal interno da facção, com status da sala, últimas mensagens e último chamado do bonde. As DMs ficam em Contatos; global, local e comércio seguem fora do recorte atual."
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
        {latestRealtimeChat ? (
          <View style={styles.listCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Última mensagem</Text>
              <Tag
                label={latestRealtimeChat.kind === 'system' ? 'Sistema' : latestRealtimeChat.nickname}
                tone="accent"
              />
            </View>
            <Text style={styles.cardCopy}>{latestRealtimeChat.message}</Text>
            <Text style={styles.mutedSmall}>{formatDateTimeLabel(latestRealtimeChat.createdAt)}</Text>
          </View>
        ) : null}
        {latestRealtimeCoordination ? (
          <View style={styles.listCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Último chamado</Text>
              <Tag label={latestRealtimeCoordination.label} tone="warning" />
            </View>
            <Text style={styles.cardCopy}>
              {latestRealtimeCoordination.nickname} · {formatDateTimeLabel(latestRealtimeCoordination.createdAt)}
            </Text>
          </View>
        ) : null}
        {!latestRealtimeChat && !latestRealtimeCoordination ? (
          <EmptyState copy="A sala ainda está vazia. Assim que alguém mandar chat ou coordenação, o histórico curto aparece aqui." />
        ) : null}
        <ActionButton
          disabled={false}
          label="Abrir sala"
          onPress={() => {
            setActiveTab('war');
          }}
        />
      </SectionCard>

      <SectionCard
        subtitle="Radar das outras facções ativas do servidor para leitura política, comparação de banco e entendimento do cenário."
        title="Facções em atividade"
      >
        {sortedFactions.length > 0 ? (
          <View style={styles.listColumn}>
            {sortedFactions
              .filter((faction) => faction.id !== currentFaction.id)
              .map((faction) => (
                <View key={faction.id} style={styles.listCard}>
                  <View style={styles.cardHeaderStack}>
                    <View style={styles.flexCopy}>
                      <Text style={styles.cardTitle}>
                        {faction.name} · {faction.abbreviation}
                      </Text>
                      <View style={styles.inlineRow}>
                        <Tag
                          label={faction.isFixed ? 'Fixa' : 'Custom'}
                          tone={faction.isFixed ? 'accent' : 'info'}
                        />
                      </View>
                      <Text style={styles.cardCopy}>
                        {faction.memberCount} membros · banco {formatFactionCurrency(faction.bankMoney)} · líder{' '}
                        {faction.npcLeaderName ?? 'humano'}
                      </Text>
                    </View>
                  </View>
                  {faction.description ? <Text style={styles.cardCopy}>{faction.description}</Text> : null}
                  <Text style={styles.cardCopy}>
                    {faction.isFixed
                      ? `Vagas abertas: ${getFactionAvailableJoinSlots(faction) ?? 0}`
                      : 'Entrada apenas por recrutamento.'}
                  </Text>
                  {getFactionCanSelfJoin(faction) ? (
                    <View style={styles.inlineRow}>
                      <ActionButton
                        disabled={isMutating}
                        label="Entrar como cria"
                        onPress={() => {
                          void handleJoinFixedFaction(faction.id);
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
          </View>
        ) : (
          <EmptyState copy="Nenhuma outra facção ativa foi encontrada no servidor." />
        )}
      </SectionCard>

      {currentFaction.canConfigure ? (
        <SectionCard
          subtitle="Ajuste identidade e manifesto da facção sem sair do celular. As validações críticas continuam do lado do servidor."
          title="Configurar facção"
        >
          <Field label="Nome">
            <TextInput
              onChangeText={setConfigName}
              placeholder="Nome da facção"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={configName}
            />
          </Field>
          <Field label="Sigla">
            <TextInput
              autoCapitalize="characters"
              onChangeText={setConfigAbbreviation}
              placeholder="Sigla"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={configAbbreviation}
            />
          </Field>
          <Field label="Descrição">
            <TextInput
              multiline
              onChangeText={setConfigDescription}
              placeholder="Resumo, regras e postura da facção."
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.textarea]}
              value={configDescription}
            />
          </Field>
          <ActionButton
            disabled={isMutating}
            label="Salvar configuração"
            onPress={() => {
              void handleUpdateFaction();
            }}
          />
        </SectionCard>
      ) : null}
    </>
  );
}
