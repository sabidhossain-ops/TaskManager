import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as taskService from '../services/taskService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { TASK_STATUSES } from '../constants/task';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { AlertIcon, CheckCircleIcon, ClockIcon, PlusIcon, RefreshIcon, TasksIcon } from '../components/ui/Icons';
import { formatDateTime } from '../utils/format';

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const BAR = { pending: 'bg-amber-400', in_progress: 'bg-blue-500', completed: 'bg-green-500' };

export default function DashboardPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, r] = await Promise.all([taskService.getTaskStats(), taskService.getRecentTasks(5)]);
      setStats(s);
      setRecent(r);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const total = stats?.total ?? 0;
  const firstName = (user?.user_metadata?.full_name || user?.email || '').split(/[\s@]/)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Welcome back{firstName ? `, ${firstName}` : ''}</h2>
          <p className="text-sm text-slate-500">Here is where your tasks stand today.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} aria-label="Refresh dashboard" title="Refresh">
            <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => navigate('/tasks', { state: { create: true } })} className="flex-1 sm:flex-none">
            <PlusIcon className="h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      {error && !loading ? (
        <div className="card">
          <EmptyState icon={AlertIcon} title="Could not load the dashboard" message={error} action={<Button variant="secondary" onClick={load}>Try again</Button>} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total tasks" value={total} icon={TasksIcon} accent="brand" loading={loading} footnote="All tasks in the system" />
            <StatCard label="Pending" value={stats?.pending ?? 0} icon={ClockIcon} accent="amber" loading={loading} footnote={`${pct(stats?.pending, total)}% of all tasks`} />
            <StatCard label="In Progress" value={stats?.in_progress ?? 0} icon={RefreshIcon} accent="blue" loading={loading} footnote={`${pct(stats?.in_progress, total)}% of all tasks`} />
            <StatCard label="Completed" value={stats?.completed ?? 0} icon={CheckCircleIcon} accent="green" loading={loading} footnote={`${pct(stats?.completed, total)}% of all tasks`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900">Status breakdown</h3>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Share of tasks by status">
                {!loading && TASK_STATUSES.map((s) => (
                  <div key={s.value} className={BAR[s.value] ?? 'bg-slate-400'} style={{ width: `${pct(stats?.[s.value], total)}%` }} />
                ))}
              </div>
              <ul className="mt-4 space-y-3">
                {TASK_STATUSES.map((s) => (
                  <li key={s.value} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${BAR[s.value] ?? 'bg-slate-400'}`} />
                      {s.label}
                    </span>
                    <span className="font-medium text-slate-900">
                      {loading ? '—' : `${stats?.[s.value] ?? 0} · ${pct(stats?.[s.value], total)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Recently updated</h3>
                <Link to="/tasks" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all →</Link>
              </div>
              {loading ? (
                <ul className="divide-y divide-slate-100">
                  {Array.from({ length: 4 }, (_, i) => (
                    <li key={i} className="px-5 py-4"><div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" /></li>
                  ))}
                </ul>
              ) : recent.length === 0 ? (
                <EmptyState title="No tasks yet" message="Tasks you create will appear here." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recent.map((t) => (
                    <li key={t.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{t.title}</p>
                        <p className="text-xs text-slate-500">
                          {t.assigned_to || 'Unassigned'} · {formatDateTime(t.updated_at || t.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <PriorityBadge value={t.priority} />
                        <StatusBadge value={t.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
