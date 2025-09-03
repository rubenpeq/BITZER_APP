import { Outlet } from "react-router-dom";
import AppNavbar from "../components/Navbar";
import "../styles/App.css";

export default function PublicLayout() {
  return (
    <div>
      <AppNavbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
