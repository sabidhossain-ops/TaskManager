import { STAFF_ROLES } from '../../constants/task';
import { isOpen } from '../../utils/sla';

/**
 * Which workflow buttons a user sees for a task. The database function
 * public.task_action enforces the same rules, so this is only for the UI.
 */
export function availableActions(task, profile) {
  const sup = STAFF_ROLES.includes(profile.role);
  const mine = task.assigned_to === profile.id;
  const open = isOpen(task);
  const pending = task.extensions?.some((e) => e.state === 'Pending');
  const list = [];

  if (sup && open) list.push({ key: 'assign', label: task.assigned_to ? 'Reassign' : 'Assign', form: true });
  if (mine && open) {
    if (task.status === 'Assigned') list.push({ key: 'acknowledge', label: 'Acknowledge', primary: true });
    if (['Assigned', 'Acknowledged', 'On Hold'].includes(task.status))
      list.push({ key: 'start', label: 'Start work', primary: task.status !== 'Assigned' });
    if (task.status === 'In Progress')
      list.push({ key: 'resolve', label: 'Mark resolved', form: true, primary: true }, { key: 'hold', label: 'Put on hold', form: true });
    list.push({ key: 'forward', label: 'Forward', form: true });
    if (!pending) list.push({ key: 'request_extension', label: 'Request extension', form: true });
  }
  if ((sup || mine) && open) list.push({ key: 'remark', label: 'Add remark', form: true });
  if (sup && task.status === 'Resolved') list.push({ key: 'close', label: 'Close task', form: true, primary: true });
  if (sup && open) list.push({ key: 'cancel', label: 'Cancel task', form: true, danger: true });
  return list;
}

export const ACTION_SUCCESS = {
  assign: 'Task assigned.',
  forward: 'Task forwarded.',
  acknowledge: 'Task acknowledged.',
  start: 'Work started.',
  hold: 'Task put on hold.',
  remark: 'Remark added.',
  resolve: 'Task marked as resolved.',
  close: 'Task closed.',
  cancel: 'Task cancelled.',
  request_extension: 'Extension requested.',
  approve_extension: 'Extension approved.',
  reject_extension: 'Extension rejected.',
};
