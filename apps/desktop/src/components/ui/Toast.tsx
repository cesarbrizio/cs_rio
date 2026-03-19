import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'danger' | 'info' | 'success' | 'warning';

export interface ToastInput {
  description: string;
  title: string;
  tone?: ToastTone;
}

interface ToastRecord extends ToastInput {
  id: string;
}

interface ToastContextValue {
  pushToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): JSX.Element {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((current) => [...current, { ...input, id }]);
    window.setTimeout(() => dismissToast(id), 3200);
  }, [dismissToast]);

  const value = useMemo(
    () => ({
      pushToast,
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-stack" role="status">
        {toasts.map((toast) => (
          <div className={`ui-toast ui-toast--${toast.tone ?? 'info'}`} key={toast.id}>
            <strong>{toast.title}</strong>
            <span>{toast.description}</span>
            <button onClick={() => dismissToast(toast.id)} type="button">
              Fechar
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('ToastProvider ausente na arvore do desktop.');
  }

  return context;
}
