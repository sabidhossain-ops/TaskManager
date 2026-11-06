import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { requestPasswordReset } from '../services/authService';
import { validateLogin } from '../utils/validation';
import FormField from '../components/ui/FormField';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Logo } from '../components/layout/Sidebar';
import { homePath } from '../constants/navigation';

function ForgotPasswordModal({ open, onClose, initialUsername }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUsername(initialUsername ?? '');
      setDone('');
      setError('');
      setBusy(false);
    }
  }, [open, initialUsername]);

  async function submit(e) {
    e.preventDefault();
    if (username.trim().length < 3) return setError('Enter your username.');
    setBusy(true);
    setError('');
    try {
      setDone((await requestPasswordReset(username.trim())) || 'If this username exists and has an email address, a reset link has been sent.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Forgot password"
      size="sm"
      dismissable={!busy}
      footer={
        done ? (
          <Button onClick={onClose}>Back to sign in</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" form="forgot-form" loading={busy}>Send reset link</Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-2 text-sm text-slate-600">
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800">{done}</p>
          <p>Check your inbox (and spam folder). No email on file? Ask an administrator to set a new password for you.</p>
        </div>
      ) : (
        <form id="forgot-form" onSubmit={submit} noValidate className="space-y-3">
          <p className="text-sm text-slate-600">Enter your username. We will email a reset link to the address on your profile.</p>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <FormField label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="input" />
          </FormField>
        </form>
      )}
    </Modal>
  );
}

export default function LoginPage() {
  const { user, profile, permissions, loading, authError, signIn } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || homePath(permissions);

  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // e.g. inactive account: sign-in succeeded but the profile check signed the user out
  useEffect(() => {
    if (authError) setSubmitting(false);
  }, [authError]);

  if (!loading && user && profile) return <Navigate to={redirectTo} replace />;

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setFormError('');
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validateLogin(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await signIn(values.username, values.password);
      toast.success('Signed in successfully.');
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Use the username and password given by your administrator.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {(formError || authError) && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {formError || authError}
              </div>
            )}
            <FormField label="Username" error={errors.username}>
              <input autoComplete="username" value={values.username} onChange={set('username')} className="input" autoCapitalize="none" spellCheck={false} />
            </FormField>
            <FormField label="Password" error={errors.password}>
              <input type="password" autoComplete="current-password" value={values.password} onChange={set('password')} placeholder="••••••••" className="input" />
            </FormField>
            <div className="flex justify-end">
              <button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Forgot password?
              </button>
            </div>
            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Accounts are created by an administrator under Users &amp; masters.</p>
      </div>
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} initialUsername={values.username} />
    </div>
  );
}
