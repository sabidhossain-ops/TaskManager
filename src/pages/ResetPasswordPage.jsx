import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { setNewPassword, signOut, verifyRecoveryToken } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { validateNewPassword } from '../utils/validation';
import FormField from '../components/ui/FormField';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { Logo } from '../components/layout/Sidebar';

/** Opened from the reset email: /reset-password?token_hash=… */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const tokenHash = params.get('token_hash');
  const navigate = useNavigate();
  const toast = useToast();
  const [stage, setStage] = useState(tokenHash ? 'verifying' : 'invalid');
  const [message, setMessage] = useState('');
  const [v, setV] = useState({ next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!tokenHash || started.current) return;
    started.current = true; // the token works only once (React StrictMode runs effects twice)
    verifyRecoveryToken(tokenHash)
      .then(() => setStage('form'))
      .catch((err) => {
        setMessage(err.message);
        setStage('invalid');
      });
  }, [tokenHash]);

  async function submit(e) {
    e.preventDefault();
    const msg = validateNewPassword(v.next, v.confirm);
    if (msg) return setError(msg);
    setBusy(true);
    try {
      await setNewPassword(v.next);
      await signOut();
      toast.success('Password changed. Please sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
          {stage === 'verifying' && <div className="mt-6 text-brand-500"><Spinner label="Checking your reset link…" /></div>}
          {stage === 'invalid' && (
            <div className="mt-4 space-y-3 text-sm">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                {message || 'This reset link is invalid or has expired.'}
              </p>
              <p className="text-slate-600">Request a new link from the sign-in page, or ask an administrator to set a new password.</p>
              <Link to="/login" className="inline-block font-medium text-brand-600 hover:underline">Back to sign in</Link>
            </div>
          )}
          {stage === 'form' && (
            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
              <FormField label="New password" hint="At least 8 characters.">
                <input type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV((x) => ({ ...x, next: e.target.value }))} className="input" />
              </FormField>
              <FormField label="Confirm new password">
                <input type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV((x) => ({ ...x, confirm: e.target.value }))} className="input" />
              </FormField>
              <Button type="submit" loading={busy} className="w-full">Save new password</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
