import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRefData } from '../context/RefDataContext';
import { useToast } from '../context/ToastContext';
import { createUser, listNotifications } from '../services/profileService';
import { addMaster, removeMaster } from '../services/masterService';
import { FIELD_LIMITS, MASTER_KINDS, ROLES } from '../constants/task';
import { PERMISSIONS } from '../constants/permissions';
import { validateUserFields } from '../utils/validation';
import { formatDateTime } from '../utils/format';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import Badge from '../components/ui/Badge';
import { EditIcon, RefreshIcon, XIcon } from '../components/ui/Icons';
import UserEditModal from '../components/admin/UserEditModal';

const EMPTY_USER = { username: '', full_name: '', email: '', employee_pin: '', password: '', role: 'Expert', designation: '' };

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
    const found = validateUserFields(v, { isCreate: true });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await createUser(v);
      toast.success(`User "${v.username.trim()}" created.`);
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
      <FormField label="Username (used to sign in)" required error={errors.username} hint="Any text, 3–50 characters, without @.">
        <input value={v.username} onChange={set('username')} maxLength={50} className="input" autoComplete="off" autoCapitalize="none" spellCheck={false} />
      </FormField>
      <FormField label="Full name" required error={errors.full_name}>
        <input value={v.full_name} onChange={set('full_name')} maxLength={FIELD_LIMITS.full_name.max} className="input" autoComplete="off" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <FormField label="Email" error={errors.email} hint="Optional — task emails & password reset.">
          <input type="email" value={v.email} onChange={set('email')} className="input" autoComplete="off" />
        </FormField>
        <FormField label="Employee PIN" error={errors.employee_pin} hint="Optional">
          <input value={v.employee_pin} onChange={set('employee_pin')} maxLength={20} className="input" autoComplete="off" />
        </FormField>
      </div>
      <FormField label="Temporary password" required error={errors.password} hint="At least 8 characters. Share it privately.">
        <input type="password" value={v.password} onChange={set('password')} className="input" autoComplete="new-password" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Role" required error={errors.role} hint="Sets default permissions; adjust later with Edit.">
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

const permLabel = (key) => PERMISSIONS.find((p) => p.key === key)?.label ?? key;

function UsersTable() {
  const { profile } = useAuth();
  const { profiles } = useRefData();
  const [editing, setEditing] = useState(null);

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900">Users ({profiles.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>{['Name', 'Username', 'PIN', 'Email', 'Role', 'Access', 'Status', ''].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profiles.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'bg-slate-50 text-slate-500'}>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-slate-900">{u.full_name}</span>
                  {u.id === profile.id && <span className="ml-1 text-xs text-slate-500">(you)</span>}
                  {u.designation && <span className="block text-xs text-slate-500">{u.designation}</span>}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{u.username}</td>
                <td className="px-3 py-2.5 text-slate-600">{u.employee_pin || '—'}</td>
                <td className="px-3 py-2.5 text-slate-600">{u.email || <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-2.5">{u.role}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600" title={(u.permissions ?? []).map(permLabel).join('\n')}>
                  {(u.permissions ?? []).length} of {PERMISSIONS.length}
                </td>
                <td className="px-3 py-2.5"><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Inactive'}</Badge></td>
                <td className="px-3 py-2.5 text-right">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(u)} aria-label={`Edit ${u.full_name}`}>
                    <EditIcon className="h-4 w-4" /> Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserEditModal user={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

const STATUS_TONE = { sent: 'green', queued: 'blue', skipped: 'slate', failed: 'red' };

function EmailLog() {
  const { nameOf } = useRefData();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await listNotifications());
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Email log</h2>
          <p className="text-xs text-slate-500">Assignment and password-reset emails (latest 30).</p>
        </div>
        <Button size="sm" variant="secondary" onClick={load} aria-label="Refresh email log"><RefreshIcon className="h-4 w-4" /></Button>
      </div>
      {error ? (
        <p className="px-5 py-4 text-sm text-red-600">{error}</p>
      ) : !rows ? (
        <p className="px-5 py-4 text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">No emails yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>{['Time', 'Type', 'To', 'Task', 'Status'].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((n) => (
                <tr key={n.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDateTime(n.created_at)}</td>
                  <td className="px-3 py-2">{n.kind === 'assignment' ? 'Task assigned' : 'Password reset'}</td>
                  <td className="px-3 py-2">{nameOf(n.recipient)}<span className="block text-xs text-slate-500">{n.email || 'no email'}</span></td>
                  <td className="px-3 py-2 font-mono text-xs">{n.task?.task_no ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[n.status]}>{n.status}</Badge>
                    {n.error && <span className="mt-1 block max-w-xs text-xs break-words text-slate-500">{n.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <CreateUserCard />
        <UsersTable />
      </div>
      <EmailLog />
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
