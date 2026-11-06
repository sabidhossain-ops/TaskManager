import { isOpen } from '../../utils/sla';

/**
 * What the signed-in user may do with a task. public.task_action in
 * supabase/schema.sql enforces the same rules; this only drives the UI.
 *   mine    — the task is assigned to me (I do the work)
 *   creator — I created the task (I can take it myself, edit, close, cancel, decide extensions)
 *   manage  — "task.manage" permission (same powers as creator on every task)
 *   assign  — "task.assign" permission (assign/reassign to anyone)
 */
export function taskRights(task, auth) {
  const me = auth.profile.id;
  const mine = task.assigned_to === me;
  const creator = task.created_by === me;
  const manage = auth.canManage;
  return {
    mine,
    creator,
    canAssignAnyone: auth.canAssign,
    canTakeOver: !mine && (auth.canAssign || creator),
    canEdit: (manage || creator) && isOpen(task),
    canDelete: auth.canDelete,
    canDecideExtension: (pending) => manage || (creator && pending.requested_by !== me),
  };
}

export function availableActions(task, auth) {
  const r = taskRights(task, auth);
  const open = isOpen(task);
  const manageOrCreator = auth.canManage || r.creator;
  const pending = task.extensions?.some((e) => e.state === 'Pending');
  const list = [];

  if (open && !task.assigned_to && r.canTakeOver) list.push({ key: 'take', label: 'Assign to me', primary: !r.canAssignAnyone });
  if (open && r.canAssignAnyone) list.push({ key: 'assign', label: task.assigned_to ? 'Reassign' : 'Assign', form: true });
  else if (open && task.assigned_to && r.canTakeOver) list.push({ key: 'assign', label: 'Take over', form: true, selfOnly: true });

  if (r.mine && open) {
    if (task.status === 'Assigned') list.push({ key: 'acknowledge', label: 'Acknowledge', primary: true });
    if (['Assigned', 'Acknowledged', 'On Hold'].includes(task.status))
      list.push({ key: 'start', label: 'Start work', primary: task.status !== 'Assigned' });
    if (task.status === 'In Progress')
      list.push({ key: 'resolve', label: 'Mark resolved', form: true, primary: true }, { key: 'hold', label: 'Put on hold', form: true });
    list.push({ key: 'forward', label: 'Forward', form: true });
    if (!pending) list.push({ key: 'request_extension', label: 'Request extension', form: true });
  }
  if ((manageOrCreator || r.mine) && open) list.push({ key: 'remark', label: 'Add remark', form: true });
  if (manageOrCreator && task.status === 'Resolved') list.push({ key: 'close', label: 'Close task', form: true, primary: true });
  if (manageOrCreator && open) list.push({ key: 'cancel', label: 'Cancel task', form: true, danger: true });
  return list;
}

export const ACTION_SUCCESS = {
  take: 'Task assigned to you.',
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
