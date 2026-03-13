import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { InGameScreenLayout } from '../components/InGameScreenLayout';
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
