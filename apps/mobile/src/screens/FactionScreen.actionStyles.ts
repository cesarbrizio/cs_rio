import { colors } from '../theme/colors';

export const factionScreenActionStyles = {
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonDanger: {
    backgroundColor: colors.danger,
  },
  actionButtonLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  actionButtonWarning: {
    backgroundColor: colors.warning,
  },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  bannerCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  bannerDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.12)',
    borderColor: 'rgba(217, 108, 108, 0.28)',
  },
  bannerInfo: {
    backgroundColor: 'rgba(123, 178, 255, 0.12)',
    borderColor: 'rgba(123, 178, 255, 0.28)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  miniButton: {
    backgroundColor: 'rgba(123, 178, 255, 0.14)',
    borderColor: 'rgba(123, 178, 255, 0.24)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  miniButtonDanger: {
    backgroundColor: 'rgba(217, 108, 108, 0.14)',
    borderColor: 'rgba(217, 108, 108, 0.24)',
  },
  miniButtonLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  miniButtonSuccess: {
    backgroundColor: 'rgba(63, 163, 77, 0.14)',
    borderColor: 'rgba(63, 163, 77, 0.24)',
  },
  miniButtonWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.14)',
    borderColor: 'rgba(255, 184, 77, 0.24)',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 9, 13, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  modalButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalCard: {
    borderRadius: 22,
    gap: 14,
    padding: 20,
    width: '100%',
  },
  modalCardDanger: {
    backgroundColor: '#3b1f1f',
    borderColor: 'rgba(220, 102, 102, 0.32)',
    borderWidth: 1,
  },
  modalCardInfo: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.line,
    borderWidth: 1,
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
} as const;
