import { colors } from '../theme/colors';

export const territoryScreenActionStyles = {
  actionButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexGrow: 1,
    minHeight: 44,
    justifyContent: 'center',
    minWidth: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonAccent: {
    backgroundColor: colors.accent,
  },
  actionButtonDanger: {
    backgroundColor: colors.danger,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonInfo: {
    backgroundColor: colors.info,
  },
  actionButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  actionButtonPressed: {
    opacity: 0.88,
  },
  actionButtonWarning: {
    backgroundColor: colors.warning,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  banner: {
    alignItems: 'flex-start',
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  bannerButton: {
    backgroundColor: 'rgba(17, 17, 17, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bannerCopy: {
    color: colors.background,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerDanger: {
    backgroundColor: colors.danger,
  },
  bannerInfo: {
    backgroundColor: colors.info,
  },
  cardPressed: {
    opacity: 0.86,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalButtonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 18,
    width: '100%',
  },
  modalCardDanger: {
    borderColor: 'rgba(220, 102, 102, 0.4)',
  },
  modalCardInfo: {
    borderColor: 'rgba(123, 178, 255, 0.36)',
  },
  modalCopy: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusTagDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.2)',
  },
  statusTagLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusTagNeutral: {
    backgroundColor: 'rgba(168, 163, 154, 0.18)',
  },
  statusTagSuccess: {
    backgroundColor: 'rgba(63, 163, 77, 0.2)',
  },
  statusTagWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.2)',
  },
  toggleChip: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleChipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  toggleChipLabelActive: {
    color: colors.background,
  },
} as const;
