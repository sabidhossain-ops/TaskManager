import { useState } from 'react';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { FIELD_LIMITS } from '../../constants/task';
import { useRefData } from '../../context/RefDataContext';
import { useAuth } from '../../context/AuthContext';
import { validateAction } from '../../utils/validation';
import { fromLocalInput, toLocalInput } from '../../utils/format';

const TEXT_LABEL = {
  hold: 'Reason for hold',
  remark: 'Remark',
  cancel: 'Cancellation reason',
  close: 'Closure remark (optional)',
  request_extension: 'Reason',
};

/** Inline form for a workflow action inside the task drawer. */
export default function TaskActionForm({ action, task, onSubmit, onCancel }) {
  const { assignees, masterValues } = useRefData();
  const { profile } = useAuth();
  // Who can be picked: Take over → only me; Forward → anyone but me; Assign → anyone
  const people = assignees.filter((u) =>
    u.id !== task.assigned_to &&
    (action.selfOnly ? u.id === profile.id : action.key === 'forward' ? u.id !== profile.id : true));
  const initialTo = action.selfOnly ? profile.id : '';
  const [v, setV] = useState(() => ({
    to: initialTo,
    reason: '',
    text: '',
    summary: '',
    root_cause: masterValues('root_cause')[0] ?? 'Unknown',
    action_taken: '',
    preventive_action: '',
    requested_deadline: toLocalInput(new Date(task.deadline).getTime() + 864e5),
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setError('');
  };

  async function submit(e) {
    e.preventDefault();
    const msg = validateAction(action.key, v, task);
    if (msg) return setError(msg);
    const payload = {
      assign: { to: v.to, reason: v.reason },
      forward: { to: v.to, reason: v.reason },
      hold: { text: v.text },
      remark: { text: v.text },
      cancel: { text: v.text },
      close: { text: v.text },
      resolve: { summary: v.summary, root_cause: v.root_cause, action_taken: v.action_taken, preventive_action: v.preventive_action },
      request_extension: { requested_deadline: fromLocalInput(v.requested_deadline), text: v.text },
    }[action.key];
    setBusy(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const textArea = (k, label, required) => (
    <FormField label={label} required={required}>
      <textarea rows={2} value={v[k]} onChange={set(k)} maxLength={FIELD_LIMITS.text.max} className="input resize-y" />
    </FormField>
  );

  return (
    <form onSubmit={submit} noValidate className="card space-y-3 border-brand-200 p-4">
      <p className="text-sm font-semibold text-slate-900">{action.label}</p>

      {(action.key === 'assign' || action.key === 'forward') && (
        <>
          <FormField label={action.key === 'forward' ? 'Forward to' : 'Assign to'} required>
            <select value={v.to} onChange={set('to')} className="input" disabled={action.selfOnly}>
              {!action.selfOnly && <option value="">Select user</option>}
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === profile.id ? `Me (${u.full_name})` : u.full_name}{u.designation ? ` — ${u.designation}` : ''}
                </option>
              ))}
            </select>
          </FormField>
          {textArea('reason', task.assigned_to ? 'Reason for the transfer' : 'Reason (optional)', Boolean(task.assigned_to))}
        </>
      )}

      {action.key === 'request_extension' && (
        <FormField label="Requested deadline" required>
          <input type="datetime-local" value={v.requested_deadline} onChange={set('requested_deadline')} className="input" />
        </FormField>
      )}

      {TEXT_LABEL[action.key] && textArea('text', TEXT_LABEL[action.key], action.key !== 'close')}

      {action.key === 'resolve' && (
        <>
          {textArea('summary', 'Resolution summary', true)}
          <FormField label="Root cause" required>
            <select value={v.root_cause} onChange={set('root_cause')} className="input">
              {masterValues('root_cause').map((r) => <option key={r}>{r}</option>)}
            </select>
          </FormField>
          {textArea('action_taken', 'Action taken', true)}
          {textArea('preventive_action', 'Preventive action', false)}
        </>
      )}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={busy} variant={action.danger ? 'danger' : 'primary'}>Submit</Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}
