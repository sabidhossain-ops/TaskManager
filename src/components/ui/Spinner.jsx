import { SpinnerArcIcon } from './Icons';

export default function Spinner({ className = 'h-5 w-5', label }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <SpinnerArcIcon className={`animate-spin ${className}`} />
      {label ? <span className="text-sm text-slate-500">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-brand-500">
      <Spinner className="h-7 w-7" label={label} />
    </div>
  );
}
