import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRefData } from '../context/RefDataContext';
import { useToast } from '../context/ToastContext';
import { adminUpdateProfile, createUser, setUserPassword } from '../services/profileService';
import { addMaster, removeMaster } from '../services/masterService';
import { FIELD_LIMITS, MASTER_KINDS, ROLES } from '../constants/task';
import { validateNewUser } from '../utils/validation';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import Badge from '../components/ui/Badge';
import { XIcon } from '../components/ui/Icons';

const EMPTY_USER = { full_name: '', email: '', password: '', role: 'Expert', designation: '' };

function CreateUserCard() {
  const { masterValues, reload } = useRefData();
  const toast = useToast();
  const [v, setV] = useState(EMPTY_USER);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const found = validateNewUser(v);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await createUser({ ...v, full_name: v.full_name.trim(), email: v.email.trim(), designation: v.designation || null });
      toast.success(`User ${v.full_name.trim()} created.`);
      setV(EMPTY_USER);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold text-slate-900">Create user</h2>
      <FormField label="Full name" required error={errors.full_name}>
        <input value={v.full_name} onChange={set('full_name')} maxLength={FIELD_LIMITS.full_name.max} className="input" autoComplete="off" />
      </FormField>
      <FormField label="Email (used to sign in)" required error={errors.email}>
        <input type="email" value={v.email} onChange={set('email')} className="input" autoComplete="off" />
      </FormField>
      <FormField label="Temporary password" required error={errors.password} hint="At least 8 characters. Share it privately.">
        <input type="password" value={v.password} onChange={set('password')} className="input" autoComplete="new-password" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Role" required error={errors.role}>
          <select value={v.role} onChange={set('role')} className="input">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        </FormField>
        <FormField label="Designation">
          <select value={v.designation} onChange={set('designation')} className="input">
            <option value="">—</option>
            {masterValues('designation').map((d) => <option key={d}>{d}</option>)}
          </select>
        </FormField>
      </div>
      <Button type="submit" loading={busy}>Create user</Button>
    </form>
  );
}

function UsersTable() {
  const { profile } = useAuth();
  const { profiles, masterValues, reload } = useRefData();
  const toast = useToast();
  const [busyId, setBusyId] = useState('');
  const [passwords, setPasswords] = useState({});

  async function update(u, patch, message) {
    setBusyId(u.id);
    try {
      await adminUpdateProfile(u.id, patch);
      toast.success(message);
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function savePassword(u) {
    const pw = passwords[u.id] ?? '';
    if (pw.length < 8) return toast.error('Password must be at least 8 characters.');
    setBusyId(u.id);
    try {
      await setUserPassword(u.id, pw);
      setPasswords((p) => ({ ...p, [u.id]: '' }));
      toast.success(`Password updated for ${u.full_name}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  }

  const designations = masterValues('designation');

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900">Users ({profiles.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>{['Name', 'Email', 'Designation', 'Role', 'Status', 'Password'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profiles.map((u) => {
              const self = u.id === profile.id;
              const busy = busyId === u.id;
              return (
                <tr key={u.id} className={u.active ? '' : 'bg-slate-50 text-slate-500'}>
                  <td className="px-3 py-2.5 font-medium text-slate-900">{u.full_name}{self && <span className="ml-1 text-xs text-slate-500">(you)</span>}</td>
                  <td className="px-3 py-2.5 text-slate-600">{u.email}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={u.designation ?? ''}
                      disabled={busy}
                      onChange={(e) => update(u, { designation: e.target.value }, 'Designation updated.')}
                      className="input py-1.5"
                      aria-label={`Designation of ${u.full_name}`}
                    >
                      <option value="">—</option>
                      {[...new Set([u.designation, ...designations].filter(Boolean))].map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={u.role}
                      disabled={busy || self}
                      onChange={(e) => update(u, { role: e.target.value }, `${u.full_name} is now ${e.target.value}.`)}
                      className="input py-1.5"
                      aria-label={`Role of ${u.full_name}`}
                    >
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Inactive'}</Badge>
                    {!self && (
                      <button
                        disabled={busy}
                        onClick={() => update(u, { active: !u.active }, u.active ? `${u.full_name} deactivated.` : `${u.full_name} activated.`)}
                        className="ml-2 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                      >
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={passwords[u.id] ?? ''}
                        onChange={(e) => setPasswords((p) => ({ ...p, [u.id]: e.target.value }))}
                        placeholder="New password"
                        autoComplete="new-password"
                        className="input w-36 py-1.5"
                        aria-label={`New password for ${u.full_name}`}
                      />
                      <Button size="sm" variant="secondary" disabled={busy || !passwords[u.id]} onClick={() => savePassword(u)}>Set</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MasterCard({ kind, label }) {
  const { masters, reload } = useRefData();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const items = masters[kind] ?? [];

  async function add(e) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return toast.error('Enter a value.');
    if (items.some((i) => i.value.toLowerCase() === v.toLowerCase())) return toast.error('This value already exists.');
    setBusy(true);
    try {
      await addMaster(kind, v);
      setValue('');
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (items.length <= 1) return toast.error('Keep at least one value in the list.');
    setBusy(true);
    try {
      await removeMaster(item.id);
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-900">{label} <span className="font-normal text-slate-500">({items.length})</span></h2>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={FIELD_LIMITS.master.max} placeholder="New value" className="input py-1.5" aria-label={`New ${label} value`} />
        <Button type="submit" size="sm" disabled={busy}>Add</Button>
      </form>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-xs text-slate-700">
            {i.value}
            <button onClick={() => remove(i)} disabled={busy} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-600" aria-label={`Remove ${i.value}`}>
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <CreateUserCard />
        <UsersTable />
      </div>
      <div>
        <h2 className="mb-1 text-base font-semibold text-slate-900">Master lists</h2>
        <p className="mb-4 text-sm text-slate-500">Values offered in the task and user forms. Removing a value does not change existing tasks.</p>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {MASTER_KINDS.map((m) => <MasterCard key={m.kind} {...m} />)}
        </div>
      </div>
    </div>
  );
}
