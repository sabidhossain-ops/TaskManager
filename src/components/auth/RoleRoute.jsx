import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccess, homePath } from '../../constants/navigation';

/** Shows the page only if the user's role has it in its menu. */
export default function RoleRoute({ page, children }) {
  const { role } = useAuth();
  if (!canAccess(role, page)) return <Navigate to={homePath(role)} replace />;
  return children;
}

export function HomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={homePath(role)} replace />;
}
