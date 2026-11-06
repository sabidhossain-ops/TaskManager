import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { useRefData } from '../../context/RefDataContext';
import { useToast } from '../../context/ToastContext';
import { adminUpdateProfile, setUserPassword, setUsername } from '../../services/profileService';
import { PERMISSIONS, ROLE_PRESETS } from '../../constants/permissions';
import { FIELD_LIMITS, ROLES } from '../../constants/task';
import { validateUserFields } from '../../utils/validation';

const GROUPS = ['Menus', 'Actions'];
const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** Edit a user's details, role preset, permissions and password (Users & masters). */
export default function UserEditModal({ user, onClose }) {
  const { profile: me } = useAuth();
  const { masterValues, reload } = useRefData();
  const toast = useToast();
  const [v, setV] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const self = user?.id === me.id;

  useEffect(() => {
    if (!user) return;
    setV({
      username: user.username,
      full_name: user.full_name,
      email: user.email ?? '',
      employee_pin: user.employee_pin ?? '',
      designation: user.designation ?? '',
      role: user.role,
      permissions: [...(user.permissions ?? [])],
      active: user.active,
    });
    setErrors({});
    setFormError('');
    setPassword('');
    setBusy(false);
  }, [user]);

  if (!user || !v) return null;

  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };
  const setRole = (e) => {
    const role = e.target.value;
    setV((x) => ({ ...x, role, permissions: [...ROLE_PRESETS[role]] }));
  };
  const toggle = (key) =>
    setV((x) => ({ ...x, permissions: x.permissions.includes(key) ? x.permissions.filter((p) => p !== key) : [...x.permissions, key] }));
  const locked = (key) => self && key === 'menu.admin'; // can't remove your own admin access

  async function save(e) {
    e.preventDefault();
    const found = validateUserFields(v, { isCreate: false });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFormError('');
    try {
      // Always (re)links sign-in to this username — also switches accounts
      // created before usernames existed (they signed in with email).
      await setUsername(user.id, v.username);
      await adminUpdateProfile(user.id, {
        full_name: v.full_name.trim(),
        email: v.email.trim(),
        employee_pin: v.employee_pin.trim(),
        designation: v.designation,
        role: v.role,
        permissions: v.permissions,
        active: v.active,
      });
      toast.success(`${v.full_name.trim()} updated.`);
      await reload();
      onClose();
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  async function savePassword() {
    if (password.length < 8) return toast.error('Password must be at least 8 characters.');
    setPwBusy(true);
    try {
      await setUserPassword(user.id, password);
      setPassword('');
      toast.success(`Password updated for ${user.full_name}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  const presetMatch = same(v.permissions, ROLE_PRESETS[v.role] ?? []);

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={`Edit user — ${user.full_name}`}
      size="lg"
      dismissable={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="user-edit-form" loading={busy}>Save changes</Button>
        </>
      }
    >
      <form id="user-edit-form" onSubmit={save} noValidate className="space-y-5">
        {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formError}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Username (sign-in)" required error={errors.username} hint="This person signs in with this username after you save.">
            <input value={v.username} onChange={set('username')} maxLength={50} className="input" autoComplete="off" />
          </FormField>
          <FormField label="Full name" required error={errors.full_name}>
            <input value={v.full_name} onChange={set('full_name')} maxLength={FIELD_LIMITS.full_name.max} className="input" />
          </FormField>
          <FormField label="Email" error={errors.email} hint="Optional — for task emails and password reset.">
            <input type="email" value={v.email} onChange={set('email')} className="input" autoComplete="off" />
          </FormField>
          <FormField label="Employee PIN" error={errors.employee_pin}>
            <input value={v.employee_pin} onChange={set('employee_pin')} maxLength={20} className="input" autoComplete="off" />
          </FormField>
          <FormField label="Designation">
            <select value={v.designation} onChange={set('designation')} className="input">
              <option value="">—</option>
              {[...new Set([v.designation, ...masterValues('designation')].filter(Boolean))].map((d) => <option key={d}>{d}</option>)}
            </select>
          </FormField>
          <FormField label="Role" hint="Choosing a role applies its default permissions.">
            <select value={v.role} onChange={setRole} className="input">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          </FormField>
        </div>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Permissions</legend>
          <p className="mb-3 text-xs text-slate-500">
            {presetMatch ? `Default permissions for ${v.role}.` : `Custom permissions (differ from the ${v.role} defaults).`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g}</p>
                <ul className="space-y-2">
                  {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                    <li key={p.key}>
                      <label className={`flex items-start gap-2 text-sm ${locked(p.key) ? 'opacity-60' : ''}`}>
                        <input
                          type="checkbox"
                          checked={v.permissions.includes(p.key)}
                          onChange={() => toggle(p.key)}
                          disabled={locked(p.key)}
                          className="mt-0.5 h-4 w-4 accent-brand-500"
                        />
                        <span>
                          <span className="text-slate-800">{p.label}</span>
                          {p.hint && <span className="block text-xs text-slate-500">{p.hint}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </fieldset>

        <label className={`flex items-center gap-2 text-sm ${self ? 'opacity-60' : ''}`}>
          <input type="checkbox" checked={v.active} disabled={self} onChange={(e) => setV((x) => ({ ...x, active: e.target.checked }))} className="h-4 w-4 accent-brand-500" />
          Account active {self && <span className="text-xs text-slate-500">(you cannot deactivate yourself)</span>}
        </label>
      </form>

      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Set a new password</p>
        <p className="mb-2 text-xs text-slate-500">Share it privately; the user can change it later under their name → Change password.</p>
        <div className="flex gap-2">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" className="input" aria-label="New password" />
          <Button variant="secondary" onClick={savePassword} loading={pwBusy} disabled={!password}>Set</Button>
        </div>
      </div>
    </Modal>
  );
}
