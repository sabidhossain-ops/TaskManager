import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTaskUI } from '../../context/TaskUIContext';
import { useToast } from '../../context/ToastContext';
import { initials } from '../../utils/format';
import { LogoutIcon, MenuIcon, PlusIcon } from '../ui/Icons';
import Spinner from '../ui/Spinner';

export default function Header({ title, onMenuClick }) {
  const { profile, isStaff, signOut } = useAuth();
  const { openCreate } = useTaskUI();
  const toast = useToast();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      toast.success('You have signed out.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenuClick} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
        <MenuIcon className="h-5 w-5" />
      </button>
      <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {isStaff && (
          <button onClick={openCreate} className="hidden items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600 sm:inline-flex">
            <PlusIcon className="h-4 w-4" /> Create task
          </button>
        )}
        <div className="hidden text-right md:block">
          <p className="max-w-52 truncate text-sm font-medium text-slate-800">{profile.full_name}</p>
          <p className="max-w-52 truncate text-xs text-slate-500">{[profile.designation, profile.role].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700" title={`${profile.full_name} · ${profile.role}`} aria-hidden="true">
          {initials(profile.full_name)}
        </div>
        <button onClick={handleSignOut} disabled={signingOut} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          {signingOut ? <Spinner className="h-4 w-4" /> : <LogoutIcon className="h-4 w-4" />}
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
