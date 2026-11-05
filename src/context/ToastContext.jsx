import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircleIcon, XCircleIcon, InfoIcon, XIcon } from '../components/ui/Icons';

const ToastContext = createContext(null);

const STYLES = {
  success: { box: 'border-green-200 bg-green-50 text-green-800', Icon: CheckCircleIcon },
  error: { box: 'border-red-200 bg-red-50 text-red-800', Icon: XCircleIcon },
  info: { box: 'border-blue-200 bg-blue-50 text-blue-800', Icon: InfoIcon },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message, duration = type === 'error' ? 6000 : 3500) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
        aria-live="polite"
        role="status"
      >
        {toasts.map(({ id, type, message }) => {
          const { box, Icon } = STYLES[type];
          return (
            <div
              key={id}
              className={`animate-toast-in pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-3 text-sm shadow-lg ${box}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1">{message}</p>
              <button
                onClick={() => dismiss(id)}
                className="rounded p-0.5 opacity-60 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
