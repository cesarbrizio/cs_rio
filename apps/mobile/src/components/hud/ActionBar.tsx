import { memo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors } from '../../theme/colors';

export interface ActionBarButton {
  badge?: number;
  compactLabel?: string;
  description?: string;
  featured?: boolean;
  group?: string;
  id: string;
  label: string;
  tone?: 'danger' | 'default';
}

interface ActionBarProps {
  buttons: ActionBarButton[];
  onPress: (buttonId: string) => void;
}

function ActionBarComponent({ buttons, onPress }: ActionBarProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const singleColumn = width < 390;
  const featuredButtons = buttons.filter((button) => button.featured).slice(0, 3);
  const primaryButtons = featuredButtons.length > 0 ? featuredButtons : buttons.slice(0, 3);
  const groupedButtons = buttons.reduce<Record<string, ActionBarButton[]>>((groups, button) => {
    const key = button.group ?? 'Mais';

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key]?.push(button);
    return groups;
  }, {});
  const orderedGroups = ['Na rua', 'Meu corre', 'Rede', 'Conta', 'Mais'].filter(
    (group) => groupedButtons[group]?.length,
  );
  const launcherWidth = singleColumn ? 92 : 104;

  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.quickRow}>
          {primaryButtons.map((button) => (
            <Pressable
              accessibilityLabel={button.label}
              accessibilityRole="button"
              android_ripple={{ borderless: false, color: 'rgba(255,255,255,0.08)' }}
              key={button.id}
              onPress={() => {
                onPress(button.id);
              }}
              style={({ pressed }) => [
                styles.quickAction,
                button.tone === 'danger' ? styles.quickActionDanger : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.quickActionLabel,
                  button.tone === 'danger' ? styles.quickActionLabelDanger : null,
                ]}
              >
                {button.compactLabel ?? button.label}
              </Text>
              {button.badge && button.badge > 0 ? (
                <View style={styles.quickBadge}>
                  <Text style={styles.quickBadgeLabel}>
                    {button.badge > 99 ? '99+' : button.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}

          <Pressable
            accessibilityLabel="Abrir mais ações"
            accessibilityRole="button"
            android_ripple={{ borderless: false, color: 'rgba(255,255,255,0.1)' }}
            onPress={() => {
              setExpanded(true);
            }}
            style={({ pressed }) => [
              styles.launcher,
              { width: launcherWidth },
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.launcherTitle}>Mais</Text>
          </Pressable>
        </View>
      </View>

      <Modal animationType="slide" transparent visible={expanded}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityElementsHidden
            onPress={() => {
              setExpanded(false);
            }}
            style={styles.modalBackdrop}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={[styles.sheetHeader, singleColumn ? styles.sheetHeaderCompact : null]}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>Qual é o próximo movimento?</Text>
                <Text style={styles.sheetSubtitle}>
                  Escolha uma ação do corre sem perder o mapa de vista.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Fechar ações rápidas"
                accessibilityRole="button"
                onPress={() => {
                  setExpanded(false);
                }}
                style={({ pressed }) => [styles.closeButton, pressed ? styles.buttonPressed : null]}
              >
                <Text style={styles.closeButtonLabel}>Fechar</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {orderedGroups.map((group) => (
                <View key={group} style={styles.groupBlock}>
                  <Text style={styles.groupTitle}>{group}</Text>
                  <View style={styles.grid}>
                    {groupedButtons[group]?.map((button) => (
                      <Pressable
                        accessibilityLabel={button.label}
                        accessibilityRole="button"
                        android_ripple={{ borderless: false, color: 'rgba(255,255,255,0.08)' }}
                        key={button.id}
                        onPress={() => {
                          setExpanded(false);
                          onPress(button.id);
                        }}
                        style={({ pressed }) => [
                          styles.button,
                          singleColumn ? styles.buttonFullWidth : null,
                          button.tone === 'danger' ? styles.buttonDanger : null,
                          pressed ? styles.buttonPressed : null,
                        ]}
                      >
                        <View style={styles.buttonTopRow}>
                          <Text
                            style={[
                              styles.buttonLabel,
                              button.tone === 'danger' ? styles.buttonLabelDanger : null,
                            ]}
                          >
                            {button.label}
                          </Text>
                          {button.badge && button.badge > 0 ? (
                            <View style={styles.badge}>
                              <Text style={styles.badgeLabel}>
                                {button.badge > 99 ? '99+' : button.badge}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {button.description ? (
                          <Text style={styles.buttonDescription}>{button.description}</Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export const ActionBar = memo(ActionBarComponent);
ActionBar.displayName = 'ActionBar';

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  quickRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickActionDanger: {
    borderColor: 'rgba(217, 108, 108, 0.28)',
  },
  quickActionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  quickActionLabelDanger: {
    color: '#f0b4b4',
  },
  quickBadge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  quickBadgeLabel: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '800',
  },
  launcher: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  launcherTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  sheet: {
    backgroundColor: 'rgba(17, 17, 17, 0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 14,
    maxHeight: '84%',
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sheetScrollContent: {
    gap: 16,
    paddingBottom: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 999,
    height: 5,
    width: 54,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetHeaderCompact: {
    gap: 10,
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closeButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  groupBlock: {
    gap: 8,
  },
  groupTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: '48%',
  },
  buttonFullWidth: {
    width: '100%',
  },
  buttonDanger: {
    borderColor: 'rgba(217, 108, 108, 0.32)',
  },
  buttonTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  buttonLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    paddingRight: 8,
  },
  buttonLabelDanger: {
    color: colors.danger,
  },
  buttonDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeLabel: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
});
