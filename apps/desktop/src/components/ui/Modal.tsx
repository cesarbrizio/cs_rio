import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  actions?: ReactNode;
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function Modal({
  actions,
  children,
  isOpen,
  onClose,
  title,
}: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ui-modal" role="presentation" onClick={onClose}>
      <div
        aria-modal="true"
        className="ui-modal__dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="ui-modal__header">
          <h2>{title}</h2>
        </header>
        <div className="ui-modal__content">{children}</div>
        {actions ? <footer className="ui-modal__actions">{actions}</footer> : null}
      </div>
    </div>
  );
}
