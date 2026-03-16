import { type PlayerContactType } from '@cs-rio/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import {
  buildPrivateMessageRoster,
  formatPrivateMessageTimestamp,
} from '../features/private-messages';
import { contactApi, formatApiError, privateMessageApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

export function ContactsScreen(): JSX.Element {
  const player = useAuthStore((state) => state.player);
  const privateMessageThreads = useAppStore((state) => state.privateMessageThreads);
  const setPrivateMessageFeed = useAppStore((state) => state.setPrivateMessageFeed);
  const [contactsBook, setContactsBook] = useState<Awaited<ReturnType<typeof contactApi.list>> | null>(null);
  const [activeThread, setActiveThread] = useState<Awaited<ReturnType<typeof privateMessageApi.getThread>> | null>(
    null,
  );
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [addNickname, setAddNickname] = useState('');
  const [addType, setAddType] = useState<PlayerContactType>('known');
  const [draftMessage, setDraftMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const roster = useMemo(
    () =>
      buildPrivateMessageRoster({
        contacts: contactsBook,
        threads: privateMessageThreads,
      }),
    [contactsBook, privateMessageThreads],
  );
  const selectedRosterEntry = useMemo(
    () => roster.find((entry) => entry.contact.contactId === selectedContactId) ?? null,
    [roster, selectedContactId],
  );
  const partnerLimit = contactsBook?.limits.partner ?? null;
  const knownLimit = contactsBook?.limits.known ?? null;

  const loadHub = useCallback(async (preferredContactId?: string | null) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextContactsBook, nextThreadFeed] = await Promise.all([
        contactApi.list(),
        privateMessageApi.listThreads(),
      ]);
      setContactsBook(nextContactsBook);
      setPrivateMessageFeed(nextThreadFeed);

      const nextSelectedContactId =
        preferredContactId &&
        nextContactsBook.contacts.some((contact) => contact.contactId === preferredContactId)
          ? preferredContactId
          : nextContactsBook.contacts[0]?.contactId ?? null;

      setSelectedContactId(nextSelectedContactId);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, [setPrivateMessageFeed]);

  const loadThread = useCallback(async (contactId: string) => {
    setIsThreadLoading(true);
    setErrorMessage(null);

    try {
      const thread = await privateMessageApi.getThread(contactId);
      setActiveThread(thread);
    } catch (error) {
      setActiveThread(null);
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsThreadLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHub();
      return undefined;
    }, [loadHub]),
  );

  useEffect(() => {
    if (!selectedContactId) {
      setActiveThread(null);
      return;
    }

    void loadThread(selectedContactId);
  }, [loadThread, selectedContactId]);

  useEffect(() => {
    if (selectedContactId && roster.some((entry) => entry.contact.contactId === selectedContactId)) {
      return;
    }

    setSelectedContactId(roster[0]?.contact.contactId ?? null);
  }, [roster, selectedContactId]);

  const handleAddContact = useCallback(async () => {
    if (!addNickname.trim()) {
      setErrorMessage('Digite o nickname do contato para adicionar na rede.');
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const response = await contactApi.add({
        nickname: addNickname,
        type: addType,
      });
      setAddNickname('');
      setContactsBook({
        contacts: response.contacts,
        limits: response.limits,
      });
      setFeedbackMessage(response.message);
      await loadHub(response.contact.contactId);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsMutating(false);
    }
  }, [addNickname, addType, loadHub]);

  const handleRemoveContact = useCallback(async (contactId: string) => {
    setIsMutating(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const response = await contactApi.remove(contactId);
      setContactsBook({
        contacts: response.contacts,
        limits: response.limits,
      });
      setFeedbackMessage(response.message);
      setDraftMessage('');
      await loadHub(selectedContactId === contactId ? null : selectedContactId);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsMutating(false);
    }
  }, [loadHub, selectedContactId]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedContactId) {
      setErrorMessage('Escolha um contato da rede para abrir a DM.');
      return;
    }

    if (!draftMessage.trim()) {
      setErrorMessage('Digite a mensagem privada antes de enviar.');
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const response = await privateMessageApi.send(selectedContactId, {
        message: draftMessage,
      });
      const nextThreadFeed = await privateMessageApi.listThreads();
      setPrivateMessageFeed(nextThreadFeed);
      setActiveThread(response);
      setDraftMessage('');
      setFeedbackMessage(response.message);
    } catch (error) {
      setErrorMessage(formatApiError(error).message);
    } finally {
      setIsMutating(false);
    }
  }, [draftMessage, selectedContactId, setPrivateMessageFeed]);

  return (
    <InGameScreenLayout
      subtitle="Sua rede privada fica aqui: parceiros, conhecidos e DMs 1 para 1. No pre-alpha atual, o social jogável é facção + privado; global, local e comércio ficam fora do recorte."
      title="Contatos e DMs"
    >
      <View style={styles.metricsRow}>
        <MetricCard
          label="Parceiros"
          tone="accent"
          value={partnerLimit ? `${partnerLimit.used}/${partnerLimit.max}` : '--'}
        />
        <MetricCard
          label="Conhecidos"
          tone="info"
          value={knownLimit ? `${knownLimit.used}/${knownLimit.max}` : '--'}
        />
        <MetricCard
          label="Rede ativa"
          tone="success"
          value={`${contactsBook?.contacts.length ?? 0}`}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Adicionar contato</Text>
        <Text style={styles.sectionCopy}>
          Use parceiro para vínculos da mesma facção e conhecido para relações soltas da rua. A DM privada nasce dessa rede.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setAddNickname}
          placeholder="Nickname do contato"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={addNickname}
        />
        <View style={styles.segmentRow}>
          <SegmentButton
            active={addType === 'known'}
            label="Conhecido"
            onPress={() => setAddType('known')}
          />
          <SegmentButton
            active={addType === 'partner'}
            label="Parceiro"
            onPress={() => setAddType('partner')}
          />
        </View>
        <Pressable
          disabled={isMutating}
          onPress={() => {
            void handleAddContact();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isMutating) ? styles.primaryButtonPressed : null,
          ]}
        >
          <Text style={styles.primaryButtonLabel}>
            {isMutating ? 'Atualizando rede...' : 'Adicionar à rede'}
          </Text>
        </Pressable>
      </View>

      {errorMessage ? (
        <View style={[styles.feedbackCard, styles.errorCard]}>
          <Text style={styles.feedbackText}>{errorMessage}</Text>
        </View>
      ) : null}
      {feedbackMessage ? (
        <View style={[styles.feedbackCard, styles.successCard]}>
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Rede atual</Text>
        <Text style={styles.sectionCopy}>
          Toque em um contato para abrir a DM. Remover corta o vínculo e fecha o canal privado.
        </Text>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Sincronizando contatos e threads...</Text>
          </View>
        ) : roster.length === 0 ? (
          <Text style={styles.emptyText}>
            Sua rede ainda está vazia. Adicione alguém para abrir mensagens privadas.
          </Text>
        ) : (
          <View style={styles.contactList}>
            {roster.map((entry) => {
              const isSelected = entry.contact.contactId === selectedContactId;

              return (
                <Pressable
                  key={entry.contact.contactId}
                  onPress={() => {
                    setSelectedContactId(entry.contact.contactId);
                    setFeedbackMessage(null);
                    setErrorMessage(null);
                  }}
                  style={({ pressed }) => [
                    styles.contactCard,
                    isSelected ? styles.contactCardSelected : null,
                    pressed ? styles.contactCardPressed : null,
                  ]}
                >
                  <View style={styles.contactCardTop}>
                    <View style={styles.contactTitleBlock}>
                      <Text style={styles.contactName}>{entry.contact.nickname}</Text>
                      <Text style={styles.contactMeta}>
                        {entry.contactTypeLabel} · {entry.contactOriginLabel}
                      </Text>
                    </View>
                    <Text style={styles.contactTime}>{entry.updatedAtLabel}</Text>
                  </View>
                  <Text style={styles.contactPreview}>{entry.preview}</Text>
                  <View style={styles.contactCardFooter}>
                    <Text style={styles.contactBadge}>
                      {entry.messageCount > 0 ? `${entry.messageCount} msgs` : 'Sem histórico'}
                    </Text>
                    <Pressable
                      disabled={isMutating}
                      onPress={() => {
                        void handleRemoveContact(entry.contact.contactId);
                      }}
                      style={({ pressed }) => [
                        styles.inlineDangerButton,
                        (pressed || isMutating) ? styles.inlineDangerButtonPressed : null,
                      ]}
                    >
                      <Text style={styles.inlineDangerButtonLabel}>Remover</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>DM ativa</Text>
        <Text style={styles.sectionCopy}>
          {selectedRosterEntry
            ? `Conversa privada com ${selectedRosterEntry.contact.nickname}.`
            : 'Escolha um contato da rede para abrir a thread privada.'}
        </Text>

        {selectedRosterEntry ? (
          <>
            <View style={styles.dmHeader}>
              <View>
                <Text style={styles.dmTitle}>{selectedRosterEntry.contact.nickname}</Text>
                <Text style={styles.dmMeta}>
                  {selectedRosterEntry.contact.title} · {selectedRosterEntry.contactTypeLabel}
                </Text>
              </View>
              <Text style={styles.dmMeta}>
                {selectedRosterEntry.contact.faction?.abbreviation ?? 'Sem facção'}
              </Text>
            </View>

            {isThreadLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.info} />
                <Text style={styles.loadingText}>Carregando DM...</Text>
              </View>
            ) : activeThread?.messages.length ? (
              <View style={styles.messageList}>
                {activeThread.messages.map((message) => {
                  const isOwnMessage = message.senderId === player?.id;

                  return (
                    <View
                      key={message.id}
                      style={[
                        styles.messageBubble,
                        isOwnMessage ? styles.messageBubbleMine : styles.messageBubbleTheirs,
                      ]}
                    >
                      <Text style={styles.messageAuthor}>
                        {isOwnMessage ? 'Você' : message.senderNickname}
                      </Text>
                      <Text style={styles.messageBody}>{message.message}</Text>
                      <Text style={styles.messageTime}>
                        {formatPrivateMessageTimestamp(message.sentAt)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Ainda não existe histórico nessa thread. Mande a primeira mensagem privada.
              </Text>
            )}

            <TextInput
              multiline
              onChangeText={setDraftMessage}
              placeholder={`Manda a boa para ${selectedRosterEntry.contact.nickname}`}
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.composerInput]}
              textAlignVertical="top"
              value={draftMessage}
            />
            <Pressable
              disabled={isMutating}
              onPress={() => {
                void handleSendMessage();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || isMutating) ? styles.primaryButtonPressed : null,
              ]}
            >
              <Text style={styles.primaryButtonLabel}>
                {isMutating ? 'Enviando DM...' : 'Enviar mensagem privada'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.emptyText}>
            Sem contato selecionado. Abra a rede acima para escolher quem entra na DM.
          </Text>
        )}
      </View>
    </InGameScreenLayout>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'accent' | 'info' | 'success';
  value: string;
}): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, tone === 'accent' ? styles.metricAccent : null, tone === 'info' ? styles.metricInfo : null, tone === 'success' ? styles.metricSuccess : null]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.segmentButton,
        active ? styles.segmentButtonActive : null,
        pressed ? styles.segmentButtonPressed : null,
      ]}
    >
      <Text style={[styles.segmentButtonLabel, active ? styles.segmentButtonLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  metricAccent: {
    color: colors.accent,
  },
  metricInfo: {
    color: colors.info,
  },
  metricSuccess: {
    color: colors.success,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.26)',
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  composerInput: {
    minHeight: 96,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  segmentButtonActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(224, 176, 75, 0.12)',
  },
  segmentButtonPressed: {
    opacity: 0.88,
  },
  segmentButtonLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  segmentButtonLabelActive: {
    color: colors.text,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonPressed: {
    opacity: 0.82,
  },
  primaryButtonLabel: {
    color: '#20170b',
    fontSize: 14,
    fontWeight: '900',
  },
  feedbackCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorCard: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
    borderColor: colors.danger,
  },
  successCard: {
    backgroundColor: 'rgba(63, 163, 77, 0.14)',
    borderColor: colors.success,
  },
  feedbackText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  contactList: {
    gap: 10,
  },
  contactCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  contactCardSelected: {
    borderColor: colors.info,
    backgroundColor: 'rgba(123, 178, 255, 0.1)',
  },
  contactCardPressed: {
    opacity: 0.9,
  },
  contactCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactTitleBlock: {
    flex: 1,
    gap: 2,
    paddingRight: 10,
  },
  contactName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  contactMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  contactTime: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  contactPreview: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  contactCardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactBadge: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inlineDangerButton: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
    borderColor: 'rgba(217, 108, 108, 0.45)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineDangerButtonPressed: {
    opacity: 0.86,
  },
  inlineDangerButtonLabel: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  dmHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dmTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  dmMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  messageList: {
    gap: 10,
  },
  messageBubble: {
    borderRadius: 18,
    gap: 6,
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(224, 176, 75, 0.14)',
    borderColor: 'rgba(224, 176, 75, 0.36)',
    borderWidth: 1,
  },
  messageBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderWidth: 1,
  },
  messageAuthor: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  messageBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
});
