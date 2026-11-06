import { AdminIcon, AuditIcon, DashboardIcon, TasksIcon, UserTasksIcon } from '../components/ui/Icons';

/** Each page and the permission that shows it in the menu. */
export const PAGES = {
  dashboard: { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon, perm: 'menu.dashboard' },
  tasks: { path: '/tasks', label: 'All tasks', icon: TasksIcon, perm: 'menu.all_tasks' },
  myTasks: { path: '/my-tasks', label: 'My tasks', icon: UserTasksIcon, perm: 'menu.my_tasks' },
  audit: { path: '/audit', label: 'Audit log', icon: AuditIcon, perm: 'menu.audit' },
  admin: { path: '/admin', label: 'Users & masters', icon: AdminIcon, perm: 'menu.admin' },
};

const ORDER = ['dashboard', 'tasks', 'myTasks', 'audit', 'admin'];

export function navFor(permissions = []) {
  return ORDER.filter((k) => permissions.includes(PAGES[k].perm)).map((key) => ({ key, ...PAGES[key] }));
}

export const canAccess = (permissions = [], key) => permissions.includes(PAGES[key]?.perm);
export const homePath = (permissions = []) => navFor(permissions)[0]?.path ?? '/no-access';
