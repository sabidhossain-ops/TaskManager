import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listMasters, getSlaMinutes } from '../services/masterService';
import { listProfiles } from '../services/profileService';
import { DEFAULT_SLA_MINUTES } from '../constants/task';

const RefDataContext = createContext(null);

/** Shared reference data: master lists, user directory and SLA policies. */
export function RefDataProvider({ children }) {
  const [state, setState] = useState({ masters: {}, profiles: [], sla: DEFAULT_SLA_MINUTES, loaded: false, error: '' });

  const reload = useCallback(async () => {
    try {
      const [masters, profiles, sla] = await Promise.all([listMasters(), listProfiles(), getSlaMinutes()]);
      setState({ masters, profiles, sla, loaded: true, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loaded: true, error: err.message }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => {
    const byId = new Map(state.profiles.map((p) => [p.id, p]));
    return {
      ...state,
      reload,
      profileOf: (id) => byId.get(id) ?? null,
      nameOf: (id) => (id ? (byId.get(id)?.full_name ?? 'Unknown user') : 'Unassigned'),
      describe: (id) => {
        const p = id && byId.get(id);
        if (!p) return id ? 'Unknown user' : 'Unassigned';
        return p.designation ? `${p.full_name} (${p.designation})` : p.full_name;
      },
      // Anyone active can be assigned a task
      assignees: state.profiles.filter((p) => p.active),
      masterValues: (kind) => (state.masters[kind] ?? []).map((m) => m.value),
    };
  }, [state, reload]);

  return <RefDataContext.Provider value={value}>{children}</RefDataContext.Provider>;
}

export function useRefData() {
  const ctx = useContext(RefDataContext);
  if (!ctx) throw new Error('useRefData must be used inside <RefDataProvider>');
  return ctx;
}
