/** Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. */
export default function ConfigErrorPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="card max-w-lg p-6">
        <h1 className="text-lg font-semibold text-slate-900">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Locally: copy <code>.env.example</code> to <code>.env.local</code> and restart <code>npm run dev</code>.</li>
          <li>On Cloudflare Pages: add both under Settings → Variables, then redeploy.</li>
        </ul>
      </div>
    </div>
  );
}
