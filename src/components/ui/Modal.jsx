import { useEffect, useId, useRef } from 'react';
import { XIcon } from './Icons';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

/**
 * Accessible modal dialog. Closes on Escape and backdrop click
 * (unless `dismissable` is false, e.g. while saving).
 */
export default function Modal({ open, onClose, title, size = 'md', dismissable = true, footer, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const dismissRef = useRef(dismissable);
  closeRef.current = onClose;
  dismissRef.current = dismissable;

  // Runs only when the dialog opens/closes, so focus is not stolen while typing.
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && dismissRef.current && closeRef.current();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const first = panelRef.current?.querySelector('input, select, textarea, button:not([data-close])');
    (first ?? panelRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div data-modal-open className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={() => dismissable && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${SIZES[size]}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            data-close
            onClick={onClose}
            disabled={!dismissable}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close dialog"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
