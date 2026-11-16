import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

type Props = { children: ReactNode; role?: 'passenger' | 'driver' };

export default function ProtectedRoute({ children, role }: Props) {
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />;

  if (role) {
    let userRole = '';
    try {
      userRole = String(JSON.parse(localStorage.getItem('user') || '{}').role || '').toLowerCase();
    } catch {
      userRole = '';
    }
    if (userRole && userRole !== role) {
      return <Navigate to={userRole === 'driver' ? '/driver' : '/passenger'} replace />;
    }
  }
  return <>{children}</>;
}
