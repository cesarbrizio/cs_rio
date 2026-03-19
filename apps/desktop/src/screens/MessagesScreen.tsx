import { buildPrivateMessageRoster, formatPrivateMessageTimestamp } from '@cs-rio/domain/notify';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Badge, Button, Card } from '../components/ui';
import type { MessagesNavigationState } from '../router/navigationIntents';
import { contactApi, privateMessageApi } from '../services/api';
import {
  FeedbackCard,
  FormField,
  MetricCard,
  ScreenHero,
} from './shared/DesktopScreenPrimitives';

export function MessagesScreen(): JSX.Element {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [contactsBook, setContactsBook] = useState<Awaited<ReturnType<typeof contactApi.list>> | null>(null);
  const [threadsBook, setThreadsBook] = useState<Awaited<ReturnType<typeof privateMessageApi.listThreads>> | null>(null);
  const [thread, setThread] = useState<Awaited<ReturnType<typeof privateMessageApi.getThread>> | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [newContactNickname, setNewContactNickname] = useState('');
  const [newContactType, setNewContactType] = useState<'known' | 'partner'>('known');
  const [messageDraft, setMessageDraft] = useState('');
  const consumedIntentRef = useRef(false);

  const roster = useMemo(
    () => buildPrivateMessageRoster({
      contacts: contactsBook,
      threads: threadsBook?.threads ?? [],
    }),
    [contactsBook, threadsBook?.threads],
  );
  const selectedEntry = useMemo(
    () => roster.find((entry) => entry.contact.contactId === selectedContactId) ?? roster[0] ?? null,
    [roster, selectedContactId],
  );

  useEffect(() => {
    void loadBooks();
  }, []);

  useEffect(() => {
    if (!roster.length) {
      setSelectedContactId(null);
      setThread(null);
      return;
    }

    if (selectedContactId && roster.some((entry) => entry.contact.contactId === selectedContactId)) {
      return;
    }

    const nextContactId = roster[0]?.contact.contactId;

    if (!nextContactId) {
      return;
    }

    setSelectedContactId(nextContactId);
    void loadThread(nextContactId);
  }, [roster, selectedContactId]);

  useEffect(() => {
    if (consumedIntentRef.current) {
      return;
    }

    const navigationState = location.state as MessagesNavigationState | null;
    const requestedContactId = navigationState?.preselectedContactId ?? null;
    const requestedNickname = navigationState?.prefillContactNickname?.trim() ?? '';

    if (requestedContactId && roster.some((entry) => entry.contact.contactId === requestedContactId)) {
      consumedIntentRef.current = true;
      setSelectedContactId(requestedContactId);
      void loadThread(requestedContactId);
      return;
    }

    if (!requestedNickname) {
      return;
    }

    const matchingEntry = roster.find(
      (entry) => entry.contact.nickname.toLowerCase() === requestedNickname.toLowerCase(),
    );

    consumedIntentRef.current = true;

    if (matchingEntry) {
      setSelectedContactId(matchingEntry.contact.contactId);
      void loadThread(matchingEntry.contact.contactId);
      return;
    }

    setNewContactNickname(requestedNickname);
  }, [location.state, roster]);

  async function loadBooks(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [nextContacts, nextThreads] = await Promise.all([
        contactApi.list(),
        privateMessageApi.listThreads(),
      ]);
      setContactsBook(nextContacts);
      setThreadsBook(nextThreads);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar os contatos.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadThread(contactId: string): Promise<void> {
    try {
      const response = await privateMessageApi.getThread(contactId);
      setThread(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao carregar a conversa.');
    }
  }

  async function handleAddContact(): Promise<void> {
    if (!newContactNickname.trim()) {
      setError('Informe um nickname antes de adicionar o contato.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await contactApi.add({
        nickname: newContactNickname.trim(),
        type: newContactType,
      });
      setContactsBook(response);
      await loadBooks();
      setNewContactNickname('');
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao adicionar o contato.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemoveContact(contactId: string): Promise<void> {
    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await contactApi.remove(contactId);
      setContactsBook(response);
      await loadBooks();
      setThread(null);
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao remover o contato.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSendMessage(): Promise<void> {
    if (!selectedEntry || !messageDraft.trim()) {
      setError('Escolha um contato e escreva uma mensagem.');
      return;
    }

    setIsMutating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await privateMessageApi.send(selectedEntry.contact.contactId, {
        message: messageDraft.trim(),
      });
      setThread(response);
      await loadBooks();
      setMessageDraft('');
      setFeedback(response.message);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Falha ao enviar a mensagem.');
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="desktop-screen">
      <ScreenHero
        actions={
          <Button onClick={() => void loadBooks()} variant="secondary">
            {isLoading ? 'Sincronizando...' : 'Atualizar mensagens'}
          </Button>
        }
        badges={[
          { label: `${contactsBook?.contacts.length ?? 0} contatos`, tone: 'info' },
          { label: `${threadsBook?.threads.length ?? 0} threads`, tone: 'warning' },
        ]}
        description="Lista real de contatos e mensagens privadas, com adicao, remocao, leitura da thread e envio de mensagens pelo backend."
        title="Mensagens"
      />

      {feedback ? <FeedbackCard message={feedback} title="Mensagens sincronizadas" tone="success" /> : null}
      {error ? <FeedbackCard message={error} title="Falha nas mensagens" tone="danger" /> : null}

      <div className="desktop-metric-grid">
        <MetricCard label="Conhecidos" tone="info" value={`${contactsBook?.limits.known.used ?? 0}/${contactsBook?.limits.known.max ?? 0}`} />
        <MetricCard label="Parceiros" tone="warning" value={`${contactsBook?.limits.partner.used ?? 0}/${contactsBook?.limits.partner.max ?? 0}`} />
        <MetricCard label="Threads" tone="neutral" value={`${threadsBook?.threads.length ?? 0}`} />
        <MetricCard label="Contato ativo" tone="success" value={selectedEntry?.contact.nickname ?? '--'} />
      </div>

      <div className="desktop-grid-2">
        <Card className="desktop-panel">
          <div className="desktop-panel__header">
            <h3>Roster</h3>
            <Badge tone="neutral">{roster.length}</Badge>
          </div>
          <div className="desktop-scroll-list">
            {roster.map((entry) => (
              <button
                className={`desktop-list-row desktop-list-row--clickable ${selectedEntry?.contact.contactId === entry.contact.contactId ? 'desktop-list-row--active' : ''}`}
                key={entry.contact.contactId}
                onClick={() => {
                  setSelectedContactId(entry.contact.contactId);
                  void loadThread(entry.contact.contactId);
                }}
                type="button"
              >
                <div className="desktop-list-row__headline">
                  <strong>{entry.contact.nickname}</strong>
                  <Badge tone={entry.unreadIncoming ? 'warning' : 'neutral'}>
                    {entry.contactTypeLabel}
                  </Badge>
                </div>
                <small>{entry.preview}</small>
                <small>{entry.updatedAtLabel}</small>
              </button>
            ))}
          </div>
        </Card>

        <div className="desktop-screen__stack">
          <Card className="desktop-panel">
            <h3>Novo contato</h3>
            <div className="desktop-grid-2">
              <FormField label="Nickname">
                <input onChange={(event) => setNewContactNickname(event.target.value)} value={newContactNickname} />
              </FormField>
              <FormField label="Tipo">
                <select onChange={(event) => setNewContactType(event.target.value as 'known' | 'partner')} value={newContactType}>
                  <option value="known">Conhecido</option>
                  <option value="partner">Parceiro</option>
                </select>
              </FormField>
            </div>
            <Button disabled={isMutating} onClick={() => void handleAddContact()} variant="primary">
              {isMutating ? 'Processando...' : 'Adicionar contato'}
            </Button>
          </Card>

          <Card className="desktop-panel">
            <div className="desktop-panel__header">
              <div>
                <h3>{selectedEntry?.contact.nickname ?? 'Selecione um contato'}</h3>
                <p>{selectedEntry ? `${selectedEntry.contactTypeLabel} · ${selectedEntry.contactOriginLabel}` : 'Abra um contato para ler a thread.'}</p>
              </div>
              {selectedEntry ? (
                <Button disabled={isMutating} onClick={() => void handleRemoveContact(selectedEntry.contact.contactId)} variant="danger">
                  Remover
                </Button>
              ) : null}
            </div>
            <div className="desktop-scroll-list desktop-messages-thread">
              {(thread?.messages ?? []).map((message) => (
                <div className="desktop-list-row" key={message.id}>
                  <div className="desktop-list-row__headline">
                    <strong>{message.senderNickname}</strong>
                    <small>{formatPrivateMessageTimestamp(message.sentAt)}</small>
                  </div>
                  <p>{message.message}</p>
                </div>
              ))}
              {!thread?.messages.length ? <p>Nenhuma mensagem carregada nesta thread.</p> : null}
            </div>
            <FormField label="Nova mensagem">
              <textarea onChange={(event) => setMessageDraft(event.target.value)} value={messageDraft} />
            </FormField>
            <Button data-desktop-primary-action="true" disabled={isMutating || !selectedEntry} onClick={() => void handleSendMessage()} variant="primary">
              {isMutating ? 'Processando...' : 'Enviar mensagem'}
            </Button>
          </Card>
        </div>
      </div>
    </section>
  );
}
