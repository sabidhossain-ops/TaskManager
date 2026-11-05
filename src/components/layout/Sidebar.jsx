import { NavLink } from 'react-router-dom';
import { XIcon } from '../ui/Icons';

export function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 12.5l4 4L18 8" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className={`text-sm font-bold ${light ? 'text-white' : 'text-slate-900'}`}>Task Management</p>
        <p className={`text-xs ${light ? 'text-slate-300' : 'text-slate-500'}`}>BRAC Healthcare Ltd.</p>
      </div>
    </div>
  );
}

export default function Sidebar({ items, open, onClose }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/50 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo light />
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden" aria-label="Close menu">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-500">v2.0 · Supabase</div>
      </aside>
    </>
  );
}
