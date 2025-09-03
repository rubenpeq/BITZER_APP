// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AdminLayout from "../layouts/AdminLayout";

import Home from "../pages/Home";
import OrderDetail from "../pages/Orders";
import OperationDetail from "../pages/Operations";
import TaskDetail from "../pages/Tasks";

import Admin from "../pages/admin/Admin";
import AdminMachines from "../pages/admin/AdminMachines";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminOrders from "../pages/admin/AdminOrders";

import LoginPage from "../pages/Login";
// import RequireAuth from "../components/RequireAuth"; // protect non-admin pages with login later
import AdminGuard from "../components/AdminGuard";

import { AuthProvider } from "../auth/AuthContext";

export default function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public layout */}
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="/order/:orderNumber" element={<OrderDetail />} />
          <Route path="/operation/:operationId" element={<OperationDetail />} />
          <Route path="/task/:taskId" element={<TaskDetail />} />

          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Admin layout — protected by AdminGuard */}
        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Admin />} />
            <Route path="machines/*" element={<AdminMachines />} />
            <Route path="users/*" element={<AdminUsers />} />
            <Route path="orders/*" element={<AdminOrders />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
