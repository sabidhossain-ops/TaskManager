/* Lightweight inline SVG icons (stroke style), no external dependency. */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
};

const make = (paths) =>
  function Icon({ className = 'h-5 w-5', ...props }) {
    return (
      <svg {...base} className={className} {...props}>
        {paths}
      </svg>
    );
  };

export const DashboardIcon = make(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>);
export const TasksIcon = make(<><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>);
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const EyeIcon = make(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const EditIcon = make(<><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>);
export const TrashIcon = make(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>);
export const XIcon = make(<path d="M6 6l12 12M18 6L6 18" />);
export const MenuIcon = make(<path d="M4 6h16M4 12h16M4 18h16" />);
export const LogoutIcon = make(<><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>);
export const ChevronLeftIcon = make(<path d="M15 6l-6 6 6 6" />);
export const ChevronRightIcon = make(<path d="M9 6l6 6-6 6" />);
export const CheckCircleIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>);
export const XCircleIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>);
export const InfoIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const AlertIcon = make(<><path d="M12 3l9.5 17h-19L12 3z" /><path d="M12 10v4M12 17h.01" /></>);
export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const SpinnerArcIcon = make(<path d="M12 3a9 9 0 1 0 9 9" />);
export const RefreshIcon = make(<><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" /><path d="M5 3v5h5M19 21v-5h-5" /></>);
export const InboxIcon = make(<><path d="M3 13l3-8h12l3 8v6H3v-6z" /><path d="M3 13h5l1 3h6l1-3h5" /></>);
