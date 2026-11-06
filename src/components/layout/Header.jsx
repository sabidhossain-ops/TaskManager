import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTaskUI } from '../../context/TaskUIContext';
import { useToast } from '../../context/ToastContext';
import { initials } from '../../utils/format';
import { KeyIcon, LogoutIcon, MenuIcon, PlusIcon } from '../ui/Icons';
import ChangePasswordModal from '../auth/ChangePasswordModal';

export default function Header({ title, onMenuClick }) {
  const { profile, canCreate, signOut } = useAuth();
  const { openCreate } = useTaskUI();
  const toast = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    const esc = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    try {
      await signOut();
      toast.success('You have signed out.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  }

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenuClick} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
        <MenuIcon className="h-5 w-5" />
      </button>
      <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {canCreate && (
          <button onClick={openCreate} className="hidden items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600 sm:inline-flex">
            <PlusIcon className="h-4 w-4" /> Create task
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-3 rounded-lg p-1 hover:bg-slate-50"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            <span className="hidden text-right md:block">
              <span className="block max-w-52 truncate text-sm font-medium text-slate-800">{profile.full_name}</span>
              <span className="block max-w-52 truncate text-xs text-slate-500">
                {[profile.username, profile.designation, profile.role].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials(profile.full_name)}
            </span>
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2 md:hidden">
                <p className="truncate text-sm font-medium text-slate-800">{profile.full_name}</p>
                <p className="truncate text-xs text-slate-500">{profile.username}</p>
              </div>
              <button role="menuitem" className={item} onClick={() => { setMenuOpen(false); setPwOpen(true); }}>
                <KeyIcon className="h-4 w-4" /> Change password
              </button>
              <button role="menuitem" className={item} onClick={handleSignOut}>
                <LogoutIcon className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </header>
  );
}
