import { cloneElement, isValidElement, useId } from 'react';

/** Label + control + hint/error, wired up for screen readers. */
export default function FormField({ label, required, error, hint, children, className = '' }) {
  const id = useId();
  const msgId = `${id}-msg`;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? msgId : undefined,
        className: `${children.props.className ?? 'input'} ${error ? 'input-error' : ''}`,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {control}
      {(error || hint) && (
        <p id={msgId} className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
