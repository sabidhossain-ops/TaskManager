import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { FIELD_LIMITS, PRIORITIES } from '../../constants/task';
import { useAuth } from '../../context/AuthContext';
import { useRefData } from '../../context/RefDataContext';
import { validateTaskForm } from '../../utils/validation';
import { fromLocalInput, toLocalInput } from '../../utils/format';

/** Options from a master list, keeping the current value even if it was removed from the list. */
function Options({ values, current }) {
  const list = current && !values.includes(current) ? [current, ...values] : values;
  return list.map((v) => (
    <option key={v} value={v}>
      {v}
    </option>
  ));
}

/**
 * Create a task (task = null) or edit its details (task = existing row).
 * `onSubmit(values)` returns a promise; errors are shown in the form.
 */
export default function TaskFormModal({ open, task, onClose, onSubmit }) {
  const isCreate = !task;
  const { profile } = useAuth();
  const { masterValues, experts } = useRefData();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = (kind) => masterValues(kind)[0] ?? '';
    setValues(
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            task_type: task.task_type,
            priority: task.priority,
            center: task.center,
            department: task.department,
            source: task.source,
            raised_by: task.raised_by,
            contact: task.contact,
          }
        : {
            title: '',
            description: '',
            task_type: first('task_type'),
            priority: 'Medium',
            center: first('center'),
            department: first('department'),
            source: first('source'),
            raised_by: profile?.full_name ?? '',
            contact: '',
            assigned_to: '',
            deadline: toLocalInput(Date.now() + 2 * 864e5),
          },
    );
    setErrors({});
    setFormError('');
    setSubmitting(false);
  }, [open, task]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validateTaskForm(values, { isCreate });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    setFormError('');
    try {
      await onSubmit({ ...values, deadline: isCreate ? fromLocalInput(values.deadline) : undefined });
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isCreate ? 'Create task' : `Edit ${task.task_no}`}
      size="lg"
      dismissable={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="task-form" loading={submitting}>{isCreate ? 'Create task' : 'Save changes'}</Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formError}</div>
        )}

        <FormField label="Task title" required error={errors.title}>
          <input type="text" value={values.title ?? ''} onChange={set('title')} maxLength={FIELD_LIMITS.title.max} className="input" placeholder="e.g. Printer not working at Badda Centre" />
        </FormField>
        <FormField label="Details" error={errors.description}>
          <textarea rows={4} value={values.description ?? ''} onChange={set('description')} maxLength={FIELD_LIMITS.description.max} className="input resize-y" placeholder="What happened, who is affected, any error messages" />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Task type" required error={errors.task_type}>
            <select value={values.task_type ?? ''} onChange={set('task_type')} className="input"><Options values={masterValues('task_type')} current={values.task_type} /></select>
          </FormField>
          <FormField label="Priority" required error={errors.priority}>
            <select value={values.priority ?? ''} onChange={set('priority')} className="input"><Options values={PRIORITIES} current={values.priority} /></select>
          </FormField>
          <FormField label="Center" required error={errors.center}>
            <select value={values.center ?? ''} onChange={set('center')} className="input"><Options values={masterValues('center')} current={values.center} /></select>
          </FormField>
          <FormField label="Department" required error={errors.department}>
            <select value={values.department ?? ''} onChange={set('department')} className="input"><Options values={masterValues('department')} current={values.department} /></select>
          </FormField>
          <FormField label="Source" required error={errors.source}>
            <select value={values.source ?? ''} onChange={set('source')} className="input"><Options values={masterValues('source')} current={values.source} /></select>
          </FormField>
          <FormField label="Raised by" required error={errors.raised_by}>
            <input type="text" value={values.raised_by ?? ''} onChange={set('raised_by')} maxLength={FIELD_LIMITS.raised_by.max} className="input" />
          </FormField>
          <FormField label="Raised by contact number" required error={errors.contact}>
            <input type="tel" inputMode="tel" value={values.contact ?? ''} onChange={set('contact')} maxLength={20} className="input" placeholder="+880 17XX-XXXXXX" />
          </FormField>

          {isCreate && (
            <>
              <FormField label="Assign to" error={errors.assigned_to}>
                <select value={values.assigned_to ?? ''} onChange={set('assigned_to')} className="input">
                  <option value="">Leave unassigned</option>
                  {experts.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}{u.designation ? ` — ${u.designation}` : ''}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Deadline" required error={errors.deadline}>
                <input type="datetime-local" value={values.deadline ?? ''} onChange={set('deadline')} className="input" />
              </FormField>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
