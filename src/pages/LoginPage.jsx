import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateLogin } from '../utils/validation';
import FormField from '../components/ui/FormField';
import Button from '../components/ui/Button';
import { Logo } from '../components/layout/Sidebar';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/dashboard';

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={redirectTo} replace />;

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
      await signIn(values.email, values.password);
      toast.success('Signed in successfully.');
      navigate(redirectTo, { replace: true });
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
          <p className="mt-1 text-sm text-slate-500">Use your work account to manage tasks.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {formError}
              </div>
            )}
            <FormField label="Email address" error={errors.email}>
              <input type="email" autoComplete="email" value={values.email} onChange={set('email')} placeholder="you@organisation.org" className="input" />
            </FormField>
            <FormField label="Password" error={errors.password}>
              <input type="password" autoComplete="current-password" value={values.password} onChange={set('password')} placeholder="••••••••" className="input" />
            </FormField>
            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Accounts are created by an administrator in Supabase.
        </p>
      </div>
    </div>
  );
}
