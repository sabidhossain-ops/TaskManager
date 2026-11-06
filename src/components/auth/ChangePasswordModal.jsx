import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { changePassword } from '../../services/authService';
import { useToast } from '../../context/ToastContext';
import { validateNewPassword } from '../../utils/validation';

export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setV({ current: '', next: '', confirm: '' });
      setError('');
      setBusy(false);
    }
  }, [open]);

  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setError('');
  };

  async function submit(e) {
    e.preventDefault();
    if (!v.current) return setError('Enter your current password.');
    const msg = validateNewPassword(v.next, v.confirm);
    if (msg) return setError(msg);
    if (v.next === v.current) return setError('The new password must be different from the current one.');
    setBusy(true);
    try {
      await changePassword(v.current, v.next);
      toast.success('Your password has been changed.');
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      size="sm"
      dismissable={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="change-password-form" loading={busy}>Change password</Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
        <FormField label="Current password" required>
          <input type="password" autoComplete="current-password" value={v.current} onChange={set('current')} className="input" />
        </FormField>
        <FormField label="New password" required hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" value={v.next} onChange={set('next')} className="input" />
        </FormField>
        <FormField label="Confirm new password" required>
          <input type="password" autoComplete="new-password" value={v.confirm} onChange={set('confirm')} className="input" />
        </FormField>
      </form>
    </Modal>
  );
}
