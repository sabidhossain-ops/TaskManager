/** Must match app_private.all_permissions() / role_permissions() in supabase/schema.sql. */
export const PERMISSIONS = [
  { key: 'menu.dashboard', group: 'Menus', label: 'Dashboard' },
  { key: 'menu.all_tasks', group: 'Menus', label: 'All tasks', hint: 'See every task, not only their own' },
  { key: 'menu.my_tasks', group: 'Menus', label: 'My tasks' },
  { key: 'menu.audit', group: 'Menus', label: 'Audit log' },
  { key: 'menu.admin', group: 'Menus', label: 'Users & masters', hint: 'Manage users, permissions and master lists' },
  { key: 'task.create', group: 'Actions', label: 'Create tasks' },
  { key: 'task.assign', group: 'Actions', label: 'Assign / reassign tasks to anyone' },
  { key: 'task.manage', group: 'Actions', label: 'Manage any task', hint: 'Edit, close, cancel, remark, approve extensions' },
  { key: 'task.delete', group: 'Actions', label: 'Delete tasks' },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const ROLE_PRESETS = {
  Admin: ALL_PERMISSION_KEYS,
  Supervisor: ['menu.dashboard', 'menu.all_tasks', 'menu.my_tasks', 'menu.audit', 'task.create', 'task.assign', 'task.manage'],
  Management: ['menu.dashboard', 'menu.all_tasks', 'menu.audit'],
  Expert: ['menu.my_tasks', 'menu.dashboard'],
};
