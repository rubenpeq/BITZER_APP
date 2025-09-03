import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * AdminGuard: requires authenticated user with is_admin === true.
 * If user is not logged, redirect to /login.
 * If logged but not admin, redirect to / (or a "no access" page).
 */
export default function AdminGuard() {
  const { user } = useAuth();
  const loc = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }
  if (!user.is_admin) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
