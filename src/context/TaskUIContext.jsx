import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToTaskChanges } from '../services/taskService';

const TaskUIContext = createContext(null);

/**
 * App-wide task UI state: which task drawer is open, whether the create
 * form is open, and a `version` counter that bumps whenever tasks change
 * (locally or via Supabase Realtime) so lists and the dashboard refresh.
 */
export function TaskUIProvider({ children }) {
  const [openTaskId, setOpenTaskId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const timer = useRef(null);

  const notifyChanged = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVersion((v) => v + 1), 300);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToTaskChanges(notifyChanged);
    return () => {
      clearTimeout(timer.current);
      unsubscribe();
    };
  }, [notifyChanged]);

  const value = useMemo(
    () => ({
      openTaskId,
      openTask: setOpenTaskId,
      closeTask: () => setOpenTaskId(null),
      createOpen,
      openCreate: () => setCreateOpen(true),
      closeCreate: () => setCreateOpen(false),
      version,
      notifyChanged,
    }),
    [openTaskId, createOpen, version, notifyChanged],
  );

  return <TaskUIContext.Provider value={value}>{children}</TaskUIContext.Provider>;
}

export function useTaskUI() {
  const ctx = useContext(TaskUIContext);
  if (!ctx) throw new Error('useTaskUI must be used inside <TaskUIProvider>');
  return ctx;
}
