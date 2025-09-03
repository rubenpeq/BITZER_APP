import { Outlet } from "react-router-dom";
import AdminNavbar from "../components/AdminNavbar";
import "../styles/Admin.css";

export default function AdminLayout() {
  return (
    <div className="admin-root">
      <AdminNavbar />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
