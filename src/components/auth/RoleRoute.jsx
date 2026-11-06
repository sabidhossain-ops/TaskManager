import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccess, homePath } from '../../constants/navigation';

/** Shows the page only if the user has its menu permission. */
export default function RoleRoute({ page, children }) {
  const { permissions } = useAuth();
  if (!canAccess(permissions, page)) return <Navigate to={homePath(permissions)} replace />;
  return children;
}

export function HomeRedirect() {
  const { permissions } = useAuth();
  return <Navigate to={homePath(permissions)} replace />;
}
