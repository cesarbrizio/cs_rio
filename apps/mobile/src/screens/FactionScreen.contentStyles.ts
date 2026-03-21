import { colors } from '../theme/colors';

export const factionScreenContentStyles = {
  cardCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardHeaderStack: {
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterChip: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(224, 176, 75, 0.12)',
    borderColor: colors.accent,
  },
  filterChipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipLabelActive: {
    color: colors.accent,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flexCopy: {
    flex: 1,
    gap: 4,
  },
  formGrid: {
    gap: 10,
  },
  infoLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  infoValue: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlineRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listCard: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  listColumn: {
    gap: 10,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  loadingCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 360,
    textAlign: 'center',
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  metricValueDanger: {
    color: colors.danger,
  },
  metricValueSuccess: {
    color: colors.success,
  },
  mutedSmall: {
    color: colors.muted,
    fontSize: 11,
  },
  resultCard: {
    backgroundColor: 'rgba(224, 176, 75, 0.08)',
    borderColor: 'rgba(224, 176, 75, 0.22)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  resultCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionBody: {
    gap: 12,
  },
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  segmentButton: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(224, 176, 75, 0.12)',
    borderColor: colors.accent,
  },
  segmentButtonDisabled: {
    opacity: 0.42,
  },
  segmentLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentLabelActive: {
    color: colors.accent,
  },
  segmentLabelDisabled: {
    color: colors.muted,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedCard: {
    borderColor: colors.accent,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 6,
    minWidth: 130,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  tag: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagAccent: {
    backgroundColor: 'rgba(224, 176, 75, 0.12)',
    borderColor: colors.accent,
  },
  tagInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.12)',
    borderColor: colors.info,
  },
  tagLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tagSuccess: {
    backgroundColor: 'rgba(63, 163, 77, 0.12)',
    borderColor: colors.success,
  },
  tagWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.12)',
    borderColor: colors.warning,
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  topActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
} as const;
