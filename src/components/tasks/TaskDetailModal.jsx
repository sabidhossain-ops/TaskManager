import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { PriorityBadge, StatusBadge } from '../ui/Badge';
import { EditIcon, TrashIcon } from '../ui/Icons';
import { formatDateTime } from '../../utils/format';

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="col-span-2 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export default function TaskDetailModal({ task, onClose, onEdit, onDelete }) {
  return (
    <Modal
      open={Boolean(task)}
      onClose={onClose}
      title="Task details"
      size="lg"
      footer={
        task && (
          <>
            <Button variant="secondary" onClick={() => onDelete(task)} className="text-red-600 sm:mr-auto">
              <TrashIcon className="h-4 w-4" /> Delete
            </Button>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={() => onEdit(task)}>
              <EditIcon className="h-4 w-4" /> Edit
            </Button>
          </>
        )
      }
    >
      {task && (
        <>
          <h3 className="text-lg font-semibold break-words text-slate-900">{task.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge value={task.status} />
            <PriorityBadge value={task.priority} />
          </div>
          <p className="mt-4 text-sm whitespace-pre-wrap break-words text-slate-700">
            {task.description || <span className="text-slate-400 italic">No description</span>}
          </p>
          <dl className="mt-5 divide-y divide-slate-100 border-t border-slate-200">
            <Row label="Assigned to">{task.assigned_to || <span className="text-slate-400">Unassigned</span>}</Row>
            <Row label="Created">{formatDateTime(task.created_at)}</Row>
            <Row label="Last updated">{formatDateTime(task.updated_at)}</Row>
            <Row label="Task ID"><code className="text-xs break-all text-slate-500">{task.id}</code></Row>
          </dl>
        </>
      )}
    </Modal>
  );
}
