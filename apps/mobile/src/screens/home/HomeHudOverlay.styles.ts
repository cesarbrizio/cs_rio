import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  hudLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 6,
  },
  topSection: {
    alignItems: 'flex-start',
    gap: 4,
  },
  topHudRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  statusContainer: {
    flexGrow: 0,
    flexShrink: 1,
    marginRight: 8,
    maxWidth: 218,
  },
  minimapCluster: {
    alignItems: 'flex-end',
    gap: 6,
  },
  connectionStrip: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 112,
    width: '100%',
  },
  connectionDivider: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    height: 1,
  },
  connectionStripText: {
    fontSize: 11,
    fontWeight: '800',
  },
  connectionStripTextDanger: {
    color: colors.danger,
  },
  connectionStripTextWarning: {
    color: colors.warning,
  },
  cameraActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cameraFab: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  cameraFabPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  cameraFabGlyph: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  followChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  followChipActive: {
    backgroundColor: 'rgba(63, 163, 77, 0.22)',
    borderColor: 'rgba(63, 163, 77, 0.45)',
  },
  followChipPressed: {
    opacity: 0.82,
  },
  followChipLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  followChipLabelActive: {
    color: colors.success,
  },
  toastArea: {
    gap: 4,
    maxWidth: '72%',
  },
  bottomHud: {
    alignItems: 'stretch',
    gap: 6,
    paddingBottom: 4,
  },
  resourceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  resourcePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  resourceLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  resourceValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  compactSignalsCard: {
    gap: 8,
    maxWidth: '100%',
  },
  worldPulseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roundPressureChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roundPressureChipLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  worldPulseChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  worldPulseDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  worldPulseLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  worldPulseValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 112,
  },
  compactChipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  expandedInfoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  expandedInfoHeadline: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  expandedInfoDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
});
