import { useCallback, useEffect, useState } from 'react';
import { listAudit } from '../services/taskService';
import { useRefData } from '../context/RefDataContext';
import { useTaskUI } from '../context/TaskUIContext';
import { AUDIT_LIMIT } from '../constants/task';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { PageLoader } from '../components/ui/Spinner';
import { AlertIcon } from '../components/ui/Icons';
import { formatDateTime } from '../utils/format';

export default function AuditPage() {
  const { nameOf } = useRefData();
  const { openTask, version } = useTaskUI();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await listAudit());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  if (error)
    return <div className="card"><EmptyState icon={AlertIcon} title="Could not load the audit log" message={error} action={<Button variant="secondary" onClick={load}>Try again</Button>} /></div>;
  if (!rows) return <PageLoader />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">The latest {AUDIT_LIMIT} changes, newest first. Entries are written by the database and cannot be edited.</p>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="No activity recorded yet" />
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                {['Date / time', 'User', 'Action', 'Task', 'Old value', 'New value'].map((h) => <th key={h} scope="col" className="px-3 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDateTime(a.created_at)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{nameOf(a.actor)}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{a.action}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {a.task ? <button onClick={() => openTask(a.task.id)} className="font-mono text-xs text-brand-600 hover:underline">{a.task.task_no}</button> : '—'}
                  </td>
                  <td className="max-w-56 px-3 py-2.5 break-words text-slate-600">{a.old_value}</td>
                  <td className="max-w-56 px-3 py-2.5 break-words text-slate-600">{a.new_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
