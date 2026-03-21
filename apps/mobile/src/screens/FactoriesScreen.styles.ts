import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: '47%',
    gap: 6,
    padding: 14,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardList: {
    gap: 10,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  cardSelected: {
    backgroundColor: '#242016',
    borderColor: colors.accent,
  },
  compactCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  compactCardSelected: {
    backgroundColor: '#1c2515',
    borderColor: colors.success,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  requirementList: {
    gap: 4,
  },
  requirementText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.9,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonLabel: {
    color: '#1b160d',
    fontSize: 14,
    fontWeight: '900',
  },
  managementCard: {
    backgroundColor: colors.panelAlt,
    borderRadius: 24,
    gap: 14,
    padding: 16,
  },
  managementHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  managementTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  managementCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    backgroundColor: '#161616',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricPillLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  metricPillValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  requirementPanel: {
    gap: 10,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  requirementRow: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  requirementCopy: {
    flex: 1,
    gap: 3,
  },
  requirementName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  requirementSubcopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  compactCardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  compactCardMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  inputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  inputShell: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineButton: {
    minWidth: 120,
  },
  collectButton: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  collectButtonDisabled: {
    opacity: 0.45,
  },
  collectButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipDanger: {
    backgroundColor: '#3b1616',
  },
  statusChipInfo: {
    backgroundColor: '#152234',
  },
  statusChipSuccess: {
    backgroundColor: '#18361f',
  },
  statusChipWarning: {
    backgroundColor: '#3a2910',
  },
  statusChipLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  banner: {
    borderRadius: 16,
    padding: 14,
  },
  bannerDanger: {
    backgroundColor: '#351a1a',
    borderColor: '#5f2d2d',
    borderWidth: 1,
  },
  bannerNeutral: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
  },
  bannerWarning: {
    backgroundColor: '#35270f',
    borderColor: '#5b4420',
    borderWidth: 1,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  buttonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
});
