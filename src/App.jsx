import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { isSupabaseConfigured } from './lib/supabaseClient';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleRoute, { HomeRedirect } from './components/auth/RoleRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import AuditPage from './pages/AuditPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';
import ConfigErrorPage from './pages/ConfigErrorPage';

export default function App() {
  if (!isSupabaseConfigured) return <ConfigErrorPage />;

  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/dashboard" element={<RoleRoute page="dashboard"><DashboardPage /></RoleRoute>} />
                <Route path="/tasks" element={<RoleRoute page="tasks"><TasksPage key="all" scope="all" /></RoleRoute>} />
                <Route path="/my-tasks" element={<RoleRoute page="myTasks"><TasksPage key="mine" scope="mine" /></RoleRoute>} />
                <Route path="/audit" element={<RoleRoute page="audit"><AuditPage /></RoleRoute>} />
                <Route path="/admin" element={<RoleRoute page="admin"><AdminPage /></RoleRoute>} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
