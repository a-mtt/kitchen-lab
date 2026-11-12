import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  success: (message: string) => void;
  error: (message: string) => void;
  /** Shows the error from a failed action. */
  fail: (err: unknown, fallback?: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider');
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);

  const api: FeedbackApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    fail: (err, fallback = 'Something went wrong.') => {
      console.error(err);
      push('error', err instanceof Error && err.message ? err.message : fallback);
    },
    confirm: (opts) => new Promise((resolve) => setPending({ ...opts, resolve })),
  };

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-icon" aria-hidden>
              {t.kind === 'success' ? '✓' : '!'}
            </span>
            <span>{t.message}</span>
            <button
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {pending && (
        <Modal title={pending.title} onClose={() => close(false)} size="small">
          {pending.message && <p className="muted">{pending.message}</p>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => close(false)}>
              Cancel
            </button>
            <button
              className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => close(true)}
              autoFocus
            >
              {pending.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </FeedbackContext.Provider>
  );
}
