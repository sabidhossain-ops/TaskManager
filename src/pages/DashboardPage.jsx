import { useCallback, useEffect, useState } from 'react';
import * as taskService from '../services/taskService';
import { useAuth } from '../context/AuthContext';
import { useTaskUI } from '../context/TaskUIContext';
import { PRIORITIES, STATUSES } from '../constants/task';
import BarList from '../components/ui/BarList';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { AlertIcon, RefreshIcon } from '../components/ui/Icons';
import { formatDuration } from '../utils/sla';

function Kpi({ label, value, alert, loading }) {
  return (
    <div className={`card px-4 py-3.5 ${alert && value > 0 ? 'border-red-200 bg-red-50/60' : ''}`}>
      {loading ? (
        <div className="h-7 w-12 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className={`text-2xl font-semibold tabular-nums ${alert && value > 0 ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      )}
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { can } = useAuth();
  const { version } = useTaskUI();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await taskService.getDashboardStats());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  // Re-evaluate overdue / due-today every minute
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !loading)
    return (
      <div className="card">
        <EmptyState icon={AlertIcon} title="Could not load the dashboard" message={error} action={<Button variant="secondary" onClick={load}>Try again</Button>} />
      </div>
    );

  const st = stats?.by_status ?? {};
  const c = (s) => st[s] ?? 0;
  const busy = loading && !stats;
  const kpis = [
    ['Total', stats?.total ?? 0],
    ['New', c('New')],
    ['Assigned', c('Assigned') + c('Acknowledged')],
    ['In progress', c('In Progress')],
    ['On hold', c('On Hold')],
    ['Resolved', c('Resolved')],
    ['Closed', c('Closed')],
    ['Critical open', stats?.critical_open ?? 0, true],
    ['Overdue', stats?.overdue ?? 0, true],
    ['SLA breached', stats?.sla_breached ?? 0, true],
    ['Due today', stats?.due_today ?? 0],
    ['Avg resolution', stats?.avg_resolution_minutes != null ? formatDuration(stats.avg_resolution_minutes) : '—'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {can('menu.all_tasks') ? 'Live figures across all tasks.' : 'Figures for tasks assigned to or created by you.'}
        </p>
        <Button variant="secondary" size="sm" onClick={load} aria-label="Refresh dashboard">
          <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {kpis.map(([label, value, alert]) => <Kpi key={label} label={label} value={value} alert={alert} loading={busy} />)}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Tasks by status">
          <BarList loading={busy} items={STATUSES.map((s) => ({ label: s, value: c(s) }))} />
        </Panel>
        <Panel title="Tasks by priority">
          <BarList loading={busy} barClass="bg-orange-500" items={PRIORITIES.map((p) => ({ label: p, value: stats?.by_priority?.[p] ?? 0 }))} />
        </Panel>
        <Panel title="Open task aging">
          <BarList loading={busy} barClass="bg-amber-500" items={Object.entries(stats?.aging ?? {}).map(([label, value]) => ({ label, value }))} />
        </Panel>
        <Panel title="Open tasks by assignee">
          <BarList loading={busy} barClass="bg-teal-600" empty="No open assigned tasks." items={(stats?.open_by_assignee ?? []).map((e) => ({ label: e.name, value: e.open }))} />
        </Panel>
      </div>
    </div>
  );
}
