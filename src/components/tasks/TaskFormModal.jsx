import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { EMPTY_TASK, FIELD_LIMITS, TASK_PRIORITIES, TASK_STATUSES } from '../../constants/task';
import { validateTask } from '../../utils/validation';

/**
 * Create / edit form in a modal. `task` = null means "create".
 * `onSubmit(values)` must return a promise; field errors on the
 * thrown error (err.fieldErrors) are shown inline.
 */
export default function TaskFormModal({ open, task, onClose, onSubmit }) {
  const isEdit = Boolean(task);
  const [values, setValues] = useState(EMPTY_TASK);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setValues(
      task
        ? {
            title: task.title ?? '',
            description: task.description ?? '',
            priority: task.priority ?? EMPTY_TASK.priority,
            status: task.status ?? EMPTY_TASK.status,
            assigned_to: task.assigned_to ?? '',
          }
        : EMPTY_TASK,
    );
    setErrors({});
    setFormError('');
    setSubmitting(false);
  }, [open, task]);

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validateTask(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setFormError('');
    try {
      await onSubmit(values);
    } catch (err) {
      if (err.fieldErrors) setErrors(err.fieldErrors);
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  const descLen = values.description?.length ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit task' : 'Create task'}
      size="lg"
      dismissable={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="task-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {formError}
          </div>
        )}

        <FormField label="Task title" required error={errors.title}>
          <input type="text" value={values.title} onChange={set('title')} maxLength={FIELD_LIMITS.title.max} placeholder="e.g. Prepare monthly field report" className="input" />
        </FormField>

        <FormField label="Description" error={errors.description} hint={`${descLen}/${FIELD_LIMITS.description.max} characters`}>
          <textarea value={values.description} onChange={set('description')} rows={4} maxLength={FIELD_LIMITS.description.max} placeholder="Add details, context or acceptance criteria" className="input resize-y" />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Priority" required error={errors.priority}>
            <select value={values.priority} onChange={set('priority')} className="input">
              {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </FormField>
          <FormField label="Status" required error={errors.status}>
            <select value={values.status} onChange={set('status')} className="input">
              {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>
        </div>

        <FormField label="Assigned to" error={errors.assigned_to} hint="Name or email of the person responsible">
          <input type="text" value={values.assigned_to} onChange={set('assigned_to')} maxLength={FIELD_LIMITS.assigned_to.max} placeholder="e.g. Nusrat Jahan" className="input" />
        </FormField>
      </form>
    </Modal>
  );
}
