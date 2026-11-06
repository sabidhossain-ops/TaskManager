import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { getMyProfile } from '../services/profileService';

const AuthContext = createContext(null);

/**
 * Session (Supabase Auth) + profile (public.profiles: name, role, designation).
 * Inactive accounts and accounts without a profile are signed out with a message.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState('');
  const uid = session?.user?.id;

  useEffect(() => {
    let active = true;
    authService
      .getSession()
      .then((s) => active && setSession(s ?? null))
      .catch(() => active && setSession(null));
    const unsubscribe = authService.onAuthStateChange((s) => setSession(s ?? null));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!uid) {
      setProfile(null);
      return;
    }
    try {
      const p = await getMyProfile(uid);
      if (!p) {
        setAuthError('Your account has no profile. Ask the administrator to run the database setup (schema.sql).');
        await authService.signOut();
      } else if (!p.active) {
        setAuthError('This account is inactive. Contact the administrator.');
        await authService.signOut();
      } else {
        setProfile(p);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  }, [uid]);

  useEffect(() => {
    if (session === undefined) return;
    setProfile((p) => (p?.id === uid ? p : null));
    loadProfile();
  }, [session === undefined, uid, loadProfile]);

  const signIn = useCallback(async (email, password) => {
    setAuthError('');
    return authService.signIn(email, password);
  }, []);

  const value = useMemo(() => {
    const role = profile?.role ?? null;
    const permissions = profile?.permissions ?? [];
    const can = (p) => permissions.includes(p);
    return {
      session,
      user: session?.user ?? null,
      profile,
      role,
      permissions,
      can,
      isAdmin: can('menu.admin'),
      canCreate: can('task.create'),
      canAssign: can('task.assign'),
      canManage: can('task.manage'),
      canDelete: can('task.delete'),
      // Loading until we know the session and, if signed in, the profile (or an error)
      loading: session === undefined || (Boolean(uid) && profile?.id !== uid && !authError),
      authError,
      signIn,
      signOut: authService.signOut,
      refreshProfile: loadProfile,
    };
  }, [session, profile, uid, authError, signIn, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
