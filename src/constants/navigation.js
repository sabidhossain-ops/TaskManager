import { AdminIcon, AuditIcon, DashboardIcon, TasksIcon, UserTasksIcon } from '../components/ui/Icons';

export const PAGES = {
  dashboard: { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  tasks: { path: '/tasks', label: 'All tasks', icon: TasksIcon },
  myTasks: { path: '/my-tasks', label: 'My tasks', icon: UserTasksIcon },
  audit: { path: '/audit', label: 'Audit log', icon: AuditIcon },
  admin: { path: '/admin', label: 'Users & masters', icon: AdminIcon },
};

/** Menu per role, in display order. Optional second item overrides the label. */
const NAV = {
  Admin: [['dashboard'], ['tasks'], ['myTasks'], ['audit'], ['admin']],
  Supervisor: [['dashboard'], ['tasks', 'Team tasks'], ['myTasks'], ['audit']],
  Expert: [['myTasks'], ['dashboard', 'My dashboard']],
  Management: [['dashboard'], ['tasks'], ['audit']],
};

export function navFor(role) {
  return (NAV[role] ?? []).map(([key, label]) => ({ key, ...PAGES[key], label: label ?? PAGES[key].label }));
}

export const canAccess = (role, key) => (NAV[role] ?? []).some(([k]) => k === key);
export const homePath = (role) => navFor(role)[0]?.path ?? '/login';
