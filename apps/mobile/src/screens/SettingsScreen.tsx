import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
import { useMobileObservabilityStore } from '../features/mobile-observability';
import {
  formatNotificationPermissionStatus,
} from '../features/notifications';
import { useNotifications } from '../notifications/NotificationProvider';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { colors } from '../theme/colors';

export function SettingsScreen(): JSX.Element {
  const logout = useAuthStore((state) => state.logout);
  const audioSettings = useAppStore((state) => state.audioSettings);
  const notificationSettings = useAppStore((state) => state.notificationSettings);
  const setMusicEnabled = useAppStore((state) => state.setMusicEnabled);
  const setMusicVolume = useAppStore((state) => state.setMusicVolume);
  const setNotificationsEnabled = useAppStore((state) => state.setNotificationsEnabled);
  const setSfxEnabled = useAppStore((state) => state.setSfxEnabled);
  const setSfxVolume = useAppStore((state) => state.setSfxVolume);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const diagnosticsApi = useMobileObservabilityStore((state) => state.api);
  const diagnosticsPerformance = useMobileObservabilityStore((state) => state.performance);
  const diagnosticsRealtime = useMobileObservabilityStore((state) => state.realtime);
  const diagnosticsRender = useMobileObservabilityStore((state) => state.render);
  const recentIncidents = useMobileObservabilityStore((state) => state.recentIncidents);
  const resetDiagnostics = useMobileObservabilityStore((state) => state.reset);
  const { requestNotificationPermissions } = useNotifications();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isReviewingPermission, setIsReviewingPermission] = useState(false);

  const handleFeedback = (message: string) => {
    setFeedbackMessage(message);
    setBootstrapStatus(message);
  };

  return (
    <InGameScreenLayout
      subtitle="Controles locais de áudio, qualidade e idioma, junto de gestão básica de conta e links de suporte."
      title="Configurações"
    >
      {feedbackMessage ? (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackBannerCopy}>{feedbackMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Áudio</Text>
        <ToggleRow
          enabled={audioSettings.musicEnabled}
          label="Música"
          onToggle={() => {
            setMusicEnabled(!audioSettings.musicEnabled);
            handleFeedback(!audioSettings.musicEnabled ? 'Música ligada.' : 'Música desligada.');
          }}
        />
        <Stepper
          label="Volume da música"
          value={`${audioSettings.musicVolume}%`}
          onDecrease={() => {
            const nextValue = Math.max(0, audioSettings.musicVolume - 10);
            setMusicVolume(nextValue);
            handleFeedback(`Volume da música ajustado para ${nextValue}%.`);
          }}
          onIncrease={() => {
            const nextValue = Math.min(100, audioSettings.musicVolume + 10);
            setMusicVolume(nextValue);
            handleFeedback(`Volume da música ajustado para ${nextValue}%.`);
          }}
        />
        <ToggleRow
          enabled={audioSettings.sfxEnabled}
          label="Efeitos"
          onToggle={() => {
            setSfxEnabled(!audioSettings.sfxEnabled);
            handleFeedback(!audioSettings.sfxEnabled ? 'Efeitos sonoros ligados.' : 'Efeitos sonoros desligados.');
          }}
        />
        <Stepper
          label="Volume dos efeitos"
          value={`${audioSettings.sfxVolume}%`}
          onDecrease={() => {
            const nextValue = Math.max(0, audioSettings.sfxVolume - 10);
            setSfxVolume(nextValue);
            handleFeedback(`Volume dos efeitos ajustado para ${nextValue}%.`);
          }}
          onIncrease={() => {
            const nextValue = Math.min(100, audioSettings.sfxVolume + 10);
            setSfxVolume(nextValue);
            handleFeedback(`Volume dos efeitos ajustado para ${nextValue}%.`);
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notificações</Text>
        <ToggleRow
          enabled={notificationSettings.enabled}
          label="Alertas do aparelho"
          onToggle={() => {
            setNotificationsEnabled(!notificationSettings.enabled);
            handleFeedback(
              !notificationSettings.enabled
                ? 'Alertas do aparelho ligados.'
                : 'Alertas do aparelho desligados.',
            );
          }}
        />
        <Text style={styles.calloutCopy}>
          Estado atual: {formatNotificationPermissionStatus(notificationSettings.permissionStatus)}.
        </Text>
        <Text style={styles.calloutCopy}>
          No pré-alpha, o app usa notificações locais para eventos, contratos/ataques e fim de timer de prisão ou hospital.
        </Text>
        <Pressable
          onPress={() => {
            setIsReviewingPermission(true);
            setFeedbackMessage('Revisando permissão de notificações...');
            void requestNotificationPermissions()
              .then((status) => {
                handleFeedback(`Permissão de notificações: ${formatNotificationPermissionStatus(status)}.`);
              })
              .finally(() => {
                setIsReviewingPermission(false);
              });
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          {isReviewingPermission ? (
            <View style={styles.inlineButtonContent}>
              <ActivityIndicator color={colors.text} size="small" />
              <Text style={styles.secondaryButtonLabel}>Revisando...</Text>
            </View>
          ) : (
            <Text style={styles.secondaryButtonLabel}>Revisar permissão</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Qualidade Gráfica</Text>
        <MutedCallout copy="Ajuste visual completo entra na estabilização mobile-first. Por enquanto, a build usa o perfil padrão do device." />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Diagnóstico local</Text>
        <Text style={styles.calloutCopy}>
          Instrumentação leve para playtest. Sem SDK pesado e sem envio remoto automático:
          o app guarda latência de API, estado do realtime, falhas de render e sinais básicos
          de FPS para facilitar debug do time.
        </Text>

        <View style={styles.metricsGrid}>
          <MetricCard
            label="API média"
            value={diagnosticsApi.averageLatencyMs !== null ? `${diagnosticsApi.averageLatencyMs} ms` : '—'}
          />
          <MetricCard
            label="API falhas"
            value={`${diagnosticsApi.failedRequests}/${diagnosticsApi.requests}`}
          />
          <MetricCard
            label="Mapa RT"
            value={formatRealtimeStatus(diagnosticsRealtime.region.status)}
          />
          <MetricCard
            label="Facção RT"
            value={formatRealtimeStatus(diagnosticsRealtime.faction.status)}
          />
          <MetricCard
            label="FPS médio"
            value={diagnosticsPerformance.averageFps !== null ? `${diagnosticsPerformance.averageFps}` : '—'}
          />
          <MetricCard
            label="Render fails"
            value={`${diagnosticsRender.failures}`}
          />
        </View>

        <View style={styles.inlineStatsBlock}>
          <InlineStat
            label="Última API"
            value={diagnosticsApi.lastPath ? `${diagnosticsApi.lastMethod} ${diagnosticsApi.lastPath}` : 'Nenhuma requisição ainda.'}
          />
          <InlineStat
            label="Maior latência"
            value={diagnosticsApi.maxLatencyMs !== null ? `${diagnosticsApi.maxLatencyMs} ms` : '—'}
          />
          <InlineStat
            label="Último erro de API"
            value={diagnosticsApi.lastErrorMessage ?? 'Nenhum erro recente.'}
          />
          <InlineStat
            label="Realtime regional"
            value={buildRealtimeSummary(
              diagnosticsRealtime.region.reconnectCount,
              diagnosticsRealtime.region.lastErrorMessage,
            )}
          />
          <InlineStat
            label="Realtime facção"
            value={buildRealtimeSummary(
              diagnosticsRealtime.faction.reconnectCount,
              diagnosticsRealtime.faction.lastErrorMessage,
            )}
          />
          <InlineStat
            label="Rastro de crash"
            value={`${formatObservabilityEnvironment(diagnosticsRender.environment)} · ${diagnosticsRender.crashTrailMode}`}
          />
          <InlineStat
            label="Último erro de render"
            value={diagnosticsRender.lastErrorMessage ?? 'Nenhum erro de render capturado.'}
          />
          <InlineStat
            label="FPS mínimo / baixo FPS"
            value={
              diagnosticsPerformance.minFps !== null
                ? `${diagnosticsPerformance.minFps} · ${diagnosticsPerformance.lowFpsSamples} alerta(s)`
                : 'Sem amostra ainda.'
            }
          />
        </View>

        <Text style={styles.sectionCaption}>Incidentes recentes</Text>
        {recentIncidents.length > 0 ? (
          <View style={styles.incidentList}>
            {recentIncidents.slice(0, 4).map((incident) => (
              <View key={incident.id} style={styles.incidentCard}>
                <Text style={styles.incidentTitle}>
                  {incident.title} · {formatIncidentSeverity(incident.severity)}
                </Text>
                <Text style={styles.incidentDetail}>{incident.detail}</Text>
                <Text style={styles.incidentTimestamp}>
                  {formatTimestamp(incident.occurredAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <MutedCallout copy="Nenhum incidente relevante foi capturado nesta sessão." />
        )}

        <Pressable
          accessibilityLabel="Limpar diagnóstico local"
          accessibilityRole="button"
          onPress={() => {
            resetDiagnostics();
            handleFeedback('Diagnóstico local limpo.');
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Limpar diagnóstico</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Idioma</Text>
        <MutedCallout copy="O pré-alpha está priorizando PT-BR. A troca completa de idioma volta no polish final." />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Conta e Suporte</Text>
        <Pressable
          onPress={() => {
            handleFeedback('Fluxo de troca de senha será conectado ao backend em uma fase futura.');
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Mudar senha</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            handleFeedback('Central de suporte e links externos entram no polish final.');
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.secondaryButtonLabel}>Abrir suporte</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void logout();
          }}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.primaryButtonLabel}>Logout</Text>
        </Pressable>
      </View>
    </InGameScreenLayout>
  );
}

function Stepper({
  label,
  onDecrease,
  onIncrease,
  value,
}: {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  value: string;
}): JSX.Element {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={onDecrease} style={({ pressed }) => [styles.pillButton, pressed ? styles.buttonPressed : null]}>
          <Text style={styles.pillButtonLabel}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable onPress={onIncrease} style={({ pressed }) => [styles.pillButton, pressed ? styles.buttonPressed : null]}>
          <Text style={styles.pillButtonLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({
  enabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  label: string;
  onToggle: () => void;
}): JSX.Element {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.toggleButton,
          enabled ? styles.toggleButtonSelected : null,
          pressed ? styles.buttonPressed : null,
        ]}
      >
        <Text style={[styles.toggleButtonLabel, enabled ? styles.toggleButtonLabelSelected : null]}>
          {enabled ? 'Ligado' : 'Desligado'}
        </Text>
      </Pressable>
    </View>
  );
}

function MutedCallout({ copy }: { copy: string }): JSX.Element {
  return <Text style={styles.calloutCopy}>{copy}</Text>;
}

function MetricCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InlineStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.inlineStatCard}>
      <Text style={styles.inlineStatLabel}>{label}</Text>
      <Text style={styles.inlineStatValue}>{value}</Text>
    </View>
  );
}

function buildRealtimeSummary(reconnectCount: number, lastErrorMessage: string | null): string {
  if (lastErrorMessage) {
    return `${reconnectCount} reconnect(s) · ${lastErrorMessage}`;
  }

  return `${reconnectCount} reconnect(s) · sem erro recente`;
}

function formatObservabilityEnvironment(value: 'development' | 'production' | 'staging' | 'test'): string {
  switch (value) {
    case 'development':
      return 'dev';
    case 'production':
      return 'prod';
    case 'staging':
      return 'staging';
    default:
      return 'test';
  }
}

function formatIncidentSeverity(value: 'danger' | 'info' | 'warning'): string {
  switch (value) {
    case 'danger':
      return 'crítico';
    case 'warning':
      return 'atenção';
    default:
      return 'info';
  }
}

function formatRealtimeStatus(value: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'): string {
  switch (value) {
    case 'connected':
      return 'Conectado';
    case 'connecting':
      return 'Conectando';
    case 'reconnecting':
      return 'Reconectando';
    default:
      return 'Offline';
  }
}

function formatTimestamp(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  feedbackBanner: {
    backgroundColor: 'rgba(123, 178, 255, 0.12)',
    borderColor: 'rgba(123, 178, 255, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackBannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepperLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stepperValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 52,
    textAlign: 'center',
  },
  pillButton: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pillButtonLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  calloutCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '31%',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  inlineStatsBlock: {
    gap: 8,
  },
  inlineStatCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineStatLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inlineStatValue: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionCaption: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  incidentList: {
    gap: 8,
  },
  incidentCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  incidentTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  incidentDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  incidentTimestamp: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  toggleButton: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toggleButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  toggleButtonLabelSelected: {
    color: colors.accent,
  },
  toggleButtonSelected: {
    borderColor: colors.accent,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  inlineButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    color: '#14110c',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
