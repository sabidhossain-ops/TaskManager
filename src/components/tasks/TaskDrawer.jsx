import { useCallback, useEffect, useState } from 'react';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import Badge, { PriorityBadge, SlaBadge, StatusBadge } from '../ui/Badge';
import Timeline from '../ui/Timeline';
import ConfirmDialog from '../ui/ConfirmDialog';
import { PageLoader } from '../ui/Spinner';
import { EditIcon, TrashIcon } from '../ui/Icons';
import TaskActionForm from './TaskActionForm';
import TaskFormModal from './TaskFormModal';
import { ACTION_SUCCESS, availableActions, taskRights } from './taskActions';
import * as taskService from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';
import { useRefData } from '../../context/RefDataContext';
import { useTaskUI } from '../../context/TaskUIContext';
import { useToast } from '../../context/ToastContext';
import { formatDateTime } from '../../utils/format';
import { isOverdue, slaState, taskAge } from '../../utils/sla';

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-slate-800">{children}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

export default function TaskDrawer() {
  const { openTaskId, closeTask, version, notifyChanged } = useTaskUI();
  const auth = useAuth();
  const { profile } = auth;
  const { nameOf, describe, sla } = useRefData();
  const toast = useToast();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null); // action object
  const [busyKey, setBusyKey] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!openTaskId) return;
      if (!quiet) setLoading(true);
      try {
        const t = await taskService.getTask(openTaskId);
        if (!t) {
          toast.info('This task is no longer visible to you.');
          closeTask();
          return;
        }
        setTask(t);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    },
    [openTaskId, closeTask, toast],
  );

  // Reset when a different task opens
  useEffect(() => {
    setTask(null);
    setForm(null);
    setEditing(false);
    load();
  }, [openTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh quietly when tasks change elsewhere (Realtime)
  useEffect(() => {
    if (openTaskId && task) load(true);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(key, payload) {
    // "Assign to me" is the assign action with myself as the target
    if (key === 'take') await taskService.runTaskAction(task.id, 'assign', { to: profile.id });
    else await taskService.runTaskAction(task.id, key, payload);
    toast.success(ACTION_SUCCESS[key] ?? 'Task updated.');
    setForm(null);
    notifyChanged();
    await load(true);
  }

  async function quickAction(key) {
    setBusyKey(key);
    try {
      await run(key, {});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyKey('');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await taskService.deleteTask(task.id);
      toast.success(`${task.task_no} deleted.`);
      setConfirmDelete(false);
      notifyChanged();
      closeTask();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const open = Boolean(openTaskId);
  if (!open) return null;

  const s = task && slaState(task, sla);
  const pending = task?.extensions.find((e) => e.state === 'Pending');
  const actions = task ? availableActions(task, auth) : [];
  const rights = task ? taskRights(task, auth) : null;

  return (
    <Drawer open={open} onClose={closeTask} title={task?.task_no ?? 'Loading…'} subtitle={task ? `Created ${formatDateTime(task.created_at)} by ${nameOf(task.created_by)}` : ''}>
      {loading || !task ? (
        <PageLoader label="Loading task…" />
      ) : (
        <>
          <h2 className="text-xl font-semibold break-words text-slate-900">{task.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge value={task.status} />
            <PriorityBadge value={task.priority} />
            <SlaBadge value={s} />
            {isOverdue(task) && <Badge tone="red">Overdue</Badge>}
          </div>

          <dl className="card mt-4 grid grid-cols-2 gap-x-6 gap-y-3 p-4 sm:grid-cols-3">
            <Fact label="Type">{task.task_type}</Fact>
            <Fact label="Center">{task.center}</Fact>
            <Fact label="Department">{task.department}</Fact>
            <Fact label="Source">{task.source}</Fact>
            <Fact label="Raised by">{task.raised_by}</Fact>
            <Fact label="Contact">
              {task.contact ? <a href={`tel:${task.contact}`} className="text-brand-600 hover:underline">{task.contact}</a> : '—'}
            </Fact>
            <Fact label="Assigned to">{describe(task.assigned_to)}</Fact>
            <Fact label="Deadline">
              <span className={isOverdue(task) ? 'font-medium text-red-600' : ''}>{formatDateTime(task.deadline)}</span>
              {task.extension_count > 0 && (
                <span className="block text-xs text-slate-500">Extended {task.extension_count}× · original {formatDateTime(task.original_deadline)}</span>
              )}
            </Fact>
            <Fact label="Aging">{taskAge(task)}</Fact>
            <Fact label="First response">{formatDateTime(task.first_response_at)}</Fact>
            <Fact label="Resolved">{formatDateTime(task.resolved_at)}</Fact>
            <Fact label="Closed">{formatDateTime(task.closed_at)}</Fact>
          </dl>

          <p className="mt-4 text-sm break-words whitespace-pre-wrap text-slate-700">
            {task.description || <span className="text-slate-400 italic">No description.</span>}
          </p>

          {task.resolution_summary && (
            <div className="card mt-4 border-green-200 bg-green-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Resolution</h3>
              <p className="mt-1 text-sm text-slate-700">{task.resolution_summary}</p>
              <p className="mt-2"><Badge tone="green">{task.root_cause}</Badge></p>
              <p className="mt-2 text-sm"><b className="font-medium">Action taken:</b> {task.action_taken}</p>
              {task.preventive_action && <p className="mt-1 text-sm"><b className="font-medium">Preventive action:</b> {task.preventive_action}</p>}
            </div>
          )}

          {pending && (
            <div className="card mt-4 border-amber-200 bg-amber-50/60 p-4 text-sm">
              <p>
                <b className="font-medium">Extension requested</b> by {nameOf(pending.requested_by)}: {formatDateTime(pending.current_deadline)} →{' '}
                <b className="font-medium">{formatDateTime(pending.requested_deadline)}</b>
              </p>
              <p className="mt-1 text-slate-700">{pending.reason}</p>
              {rights.canDecideExtension(pending) && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" loading={busyKey === 'approve_extension'} onClick={() => quickAction('approve_extension')}>Approve</Button>
                  <Button size="sm" variant="secondary" className="text-red-600" loading={busyKey === 'reject_extension'} onClick={() => quickAction('reject_extension')}>Reject</Button>
                </div>
              )}
            </div>
          )}

          {(actions.length > 0 || rights.canEdit || rights.canDelete) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button
                  key={a.key}
                  size="sm"
                  variant={a.danger ? 'secondary' : a.primary ? 'primary' : 'secondary'}
                  className={a.danger ? 'text-red-600' : ''}
                  loading={busyKey === a.key}
                  onClick={() => (a.form ? setForm(a) : quickAction(a.key))}
                >
                  {a.label}
                </Button>
              ))}
              {rights.canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><EditIcon className="h-4 w-4" /> Edit details</Button>
              )}
              {rights.canDelete && (
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}><TrashIcon className="h-4 w-4" /> Delete</Button>
              )}
            </div>
          )}

          {form && (
            <div className="mt-3">
              <TaskActionForm key={form.key} action={form} task={task} onSubmit={(p) => run(form.key, p)} onCancel={() => setForm(null)} />
            </div>
          )}

          <Section title="Timeline">
            <Timeline
              items={task.audit.map((a) => ({
                key: a.id,
                title: (
                  <>
                    <b className="font-medium">{a.action}</b>
                    {(a.old_value || a.new_value) && (
                      <span className="text-slate-600"> — {a.old_value}{a.old_value && a.new_value ? ' → ' : ''}{a.new_value}</span>
                    )}
                  </>
                ),
                meta: `${formatDateTime(a.created_at)} · ${nameOf(a.actor)}`,
              }))}
            />
          </Section>

          <Section title="Worklog">
            <Timeline
              empty="No remarks yet."
              items={task.worklogs.map((w) => ({
                key: w.id,
                title: w.kind === 'Resolution' ? <b className="font-medium">Resolution</b> : null,
                body: w.body,
                meta: `${formatDateTime(w.created_at)} · ${nameOf(w.created_by)} · ${w.status}`,
              }))}
            />
          </Section>

          {task.assignments.length > 0 && (
            <Section title="Assignment history">
              <Timeline
                items={task.assignments.map((a) => ({
                  key: a.id,
                  title: <>{a.from_user ? `${nameOf(a.from_user)} → ` : ''}<b className="font-medium">{nameOf(a.to_user)}</b></>,
                  meta: `${formatDateTime(a.created_at)} · by ${nameOf(a.assigned_by)}${a.reason ? ` · ${a.reason}` : ''}`,
                }))}
              />
            </Section>
          )}

          {task.extensions.length > 0 && (
            <Section title="Deadline history">
              <Timeline
                items={task.extensions.map((e) => ({
                  key: e.id,
                  title: <>{formatDateTime(e.current_deadline)} → {formatDateTime(e.requested_deadline)} · <b className="font-medium">{e.state}</b></>,
                  body: e.reason,
                  meta: `${formatDateTime(e.created_at)} · ${nameOf(e.requested_by)}${e.decided_by ? ` · decided by ${nameOf(e.decided_by)}` : ''}`,
                }))}
              />
            </Section>
          )}

          <TaskFormModal
            open={editing}
            task={task}
            onClose={() => setEditing(false)}
            onSubmit={async (v) => {
              await taskService.updateTaskDetails(task.id, v);
              toast.success('Task details updated.');
              setEditing(false);
              notifyChanged();
              await load(true);
            }}
          />
          <ConfirmDialog
            open={confirmDelete}
            title="Delete task?"
            message={<><p>You are about to permanently delete <b className="font-semibold text-slate-800">{task.task_no}</b> and its full history.</p><p className="mt-1">This cannot be undone. To keep the record, cancel the task instead.</p></>}
            confirmLabel="Delete task"
            loading={deleting}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        </>
      )}
    </Drawer>
  );
}
