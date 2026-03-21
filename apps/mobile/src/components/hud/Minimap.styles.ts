import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 10,
    width: 96,
  },
  cardCompact: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  surface: {
    alignItems: 'stretch',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  fullSurface: {
    alignSelf: 'center',
  },
  gridLine: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    position: 'absolute',
  },
  gridLineVertical: {
    bottom: 0,
    top: 0,
    width: 1,
  },
  gridLineHorizontal: {
    height: 1,
    left: 0,
    right: 0,
  },
  marker: {
    borderRadius: 999,
    height: 8,
    position: 'absolute',
    width: 8,
  },
  localMarker: {
    backgroundColor: colors.success,
    height: 10,
    shadowColor: colors.success,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    width: 10,
  },
  remoteMarker: {
    backgroundColor: colors.accent,
  },
  propertyMarker: {
    backgroundColor: '#6db7ff',
  },
  hint: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 12,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    padding: 20,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  legendSwatch: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendLabel: {
    color: colors.muted,
    fontSize: 12,
  },
});
