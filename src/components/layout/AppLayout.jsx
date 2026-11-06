import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import TaskDrawer from '../tasks/TaskDrawer';
import TaskFormModal from '../tasks/TaskFormModal';
import { PageLoader } from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';
import { AlertIcon } from '../ui/Icons';
import { useAuth } from '../../context/AuthContext';
import { RefDataProvider, useRefData } from '../../context/RefDataContext';
import { TaskUIProvider, useTaskUI } from '../../context/TaskUIContext';
import { useToast } from '../../context/ToastContext';
import { createTask } from '../../services/taskService';
import { navFor } from '../../constants/navigation';

function CreateTaskModal() {
  const { createOpen, closeCreate, openTask, notifyChanged } = useTaskUI();
  const toast = useToast();
  return (
    <TaskFormModal
      open={createOpen}
      task={null}
      onClose={closeCreate}
      onSubmit={async (values) => {
        const t = await createTask(values);
        toast.success(`${t.task_no} created.`);
        closeCreate();
        notifyChanged();
        openTask(t.id);
      }}
    />
  );
}

function Shell() {
  const { permissions } = useAuth();
  const { loaded, error, reload } = useRefData();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const items = navFor(permissions);
  const title = items.find((i) => i.path === pathname)?.label ?? 'Task Management';

  return (
    <div className="min-h-full">
      <Sidebar items={items} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-h-full flex-col lg:pl-64">
        <Header title={title} onMenuClick={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[90rem] flex-1 p-4 sm:p-6">
          {!loaded ? (
            <PageLoader />
          ) : error ? (
            <div className="card">
              <EmptyState icon={AlertIcon} title="Could not load reference data" message={error} action={<Button variant="secondary" onClick={reload}>Try again</Button>} />
            </div>
          ) : items.length === 0 ? (
            <div className="card">
              <EmptyState title="No menus assigned" message="Your account has no menu permissions yet. Ask an administrator to grant access." />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      {loaded && !error && (
        <>
          <TaskDrawer />
          <CreateTaskModal />
        </>
      )}
    </div>
  );
}

export default function AppLayout() {
  return (
    <RefDataProvider>
      <TaskUIProvider>
        <Shell />
      </TaskUIProvider>
    </RefDataProvider>
  );
}
