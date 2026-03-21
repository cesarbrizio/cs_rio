import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export const styles = StyleSheet.create({
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
