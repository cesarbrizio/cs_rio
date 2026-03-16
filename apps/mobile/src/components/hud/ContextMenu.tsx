import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  type HudContextAction,
  type HudContextTarget,
} from '../../features/hudContextActions';
import { colors } from '../../theme/colors';
import { hapticLight } from '../../utils/haptics';

interface ContextMenuProps {
  onActionPress: (action: HudContextAction, target: HudContextTarget) => void;
  onClose: () => void;
  target: HudContextTarget | null;
}

function ContextMenuComponent({
  onActionPress,
  onClose,
  target,
}: ContextMenuProps): JSX.Element | null {
  if (!target) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable onPress={onClose} style={styles.backdrop} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{target.title}</Text>
        <Text style={styles.subtitle}>{target.subtitle}</Text>

        <View style={styles.actions}>
          {target.actions.map((action) => (
            <Pressable
              android_ripple={{ borderless: false, color: 'rgba(255,255,255,0.08)' }}
              key={action.id}
              onPress={() => {
                hapticLight();
                onActionPress(action, target);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                action.tone === 'accent' ? styles.actionButtonAccent : null,
                pressed ? styles.actionButtonPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  action.tone === 'accent' ? styles.actionLabelAccent : null,
                ]}
              >
                {action.label}
              </Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

export const ContextMenu = memo(ContextMenuComponent);
ContextMenu.displayName = 'ContextMenu';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  sheet: {
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: colors.panelAlt,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  actionButtonAccent: {
    borderColor: 'rgba(224, 176, 75, 0.36)',
  },
  actionButtonPressed: {
    opacity: 0.92,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  actionLabelAccent: {
    color: colors.accent,
  },
  actionDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
});
