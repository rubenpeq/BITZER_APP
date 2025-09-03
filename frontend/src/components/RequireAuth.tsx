import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();

  if (!user) {
    // redirect to login and keep original destination in state
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  // If children provided, render them; otherwise render Outlet for nested route usage
  return children ?? <Outlet />;
}
