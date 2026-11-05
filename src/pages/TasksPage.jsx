import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as taskService from '../services/taskService';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { DEFAULT_PAGE_SIZE } from '../constants/task';
import TaskFilters from '../components/tasks/TaskFilters';
import TaskTable from '../components/tasks/TaskTable';
import TaskFormModal from '../components/tasks/TaskFormModal';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { AlertIcon, PlusIcon, RefreshIcon } from '../components/ui/Icons';

const INITIAL_FILTERS = { search: '', status: '', priority: '' };

export default function TasksPage() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const debouncedSearch = useDebounce(filters.search);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError('');
    try {
      const result = await taskService.listTasks({
        page,
        pageSize,
        search: debouncedSearch,
        status: filters.status,
        priority: filters.priority,
      });
      if (id !== requestId.current) return; // a newer request is in flight
      // If the current page became empty (e.g. after deleting), step back.
      if (!result.rows.length && page > 1) {
        setPage((p) => p - 1);
        return;
      }
      setData(result);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(err.message);
      toast.error(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, filters.status, filters.priority, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Open the create form when arriving from the dashboard's "New task" button.
  useEffect(() => {
    if (location.state?.create) {
      openCreate();
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  function updateFilters(patch) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(task) {
    setViewing(null);
    setEditing(task);
    setFormOpen(true);
  }

  async function handleSubmit(values) {
    if (editing) {
      await taskService.updateTask(editing.id, values);
      toast.success('Task updated.');
    } else {
      await taskService.createTask(values);
      toast.success('Task created.');
      setPage(1);
    }
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await taskService.deleteTask(deleting.id);
      toast.success('Task deleted.');
      setDeleting(null);
      setViewing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const hasFilters = filters.search || filters.status || filters.priority;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">All tasks</h2>
          <p className="text-sm text-slate-500">Create, track and update your team’s work.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} aria-label="Refresh list" title="Refresh">
            <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreate} className="flex-1 sm:flex-none">
            <PlusIcon className="h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      <section className="card overflow-hidden">
        <TaskFilters {...filters} onChange={updateFilters} onReset={() => updateFilters(INITIAL_FILTERS)} />

        {loadError && !loading ? (
          <EmptyState
            icon={AlertIcon}
            title="Could not load tasks"
            message={loadError}
            action={<Button variant="secondary" onClick={load}>Try again</Button>}
          />
        ) : !loading && data.rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No matching tasks' : 'No tasks yet'}
            message={hasFilters ? 'Try a different search or clear the filters.' : 'Create your first task to get started.'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => updateFilters(INITIAL_FILTERS)}>Clear filters</Button>
              ) : (
                <Button onClick={openCreate}><PlusIcon className="h-4 w-4" /> New task</Button>
              )
            }
          />
        ) : (
          <>
            <TaskTable tasks={data.rows} loading={loading && data.rows.length === 0} onView={setViewing} onEdit={openEdit} onDelete={setDeleting} />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </section>

      <TaskFormModal
        open={formOpen}
        task={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <TaskDetailModal task={viewing} onClose={() => setViewing(null)} onEdit={openEdit} onDelete={setDeleting} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete task?"
        message={
          <>
            <p>
              You are about to delete <b className="font-semibold text-slate-800">“{deleting?.title}”</b>.
            </p>
            <p className="mt-1">This cannot be undone.</p>
          </>
        }
        confirmLabel="Delete task"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
