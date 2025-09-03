import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar, Container, NavDropdown, Button } from "react-bootstrap";
import logo from "../assets/bitzer_logo.svg";
import { useAuth } from "../auth/AuthContext";

/**
 * Public AppNavbar
 * - Centered brand (original look)
 * - Right-side account controls (pinned to the far right via CSS)
 * - Admin button (React-Bootstrap Button) when user.is_admin
 */
export default function AppNavbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;

    // Set initial padding so content starts below navbar (prevents overlap)
    const setBodyPadding = () => {
      const h = navEl.offsetHeight;
      document.body.style.paddingTop = `${h}px`;
    };

    // Handle scroll: when scrolled down, add overlay class and remove padding so navbar overlays content.
    // When near top, remove overlay class and restore padding so navbar doesn't overlap.
    const onScroll = () => {
      const scrolled = window.scrollY > 10; // threshold, adjust if needed
      if (scrolled) {
        navEl.classList.add("app-navbar--overlay");
        document.body.style.paddingTop = "0px";
      } else {
        navEl.classList.remove("app-navbar--overlay");
        setBodyPadding();
      }
    };

    // Initial setup
    setBodyPadding();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", setBodyPadding);

    // cleanup
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", setBodyPadding);
      document.body.style.paddingTop = ""; // restore
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    // forward ref to the navbar DOM element (react-bootstrap forwards refs)
    <Navbar ref={navRef as any} fixed="top" className="justify-content-center py-3 app-navbar" role="navigation">
      <Container className="justify-content-center app-navbar-container">
        <Navbar.Brand as={Link} to={"/"}>
          <img src={logo} alt="Bitzer Logo" height="60" className="d-inline-block align-top" />
        </Navbar.Brand>

        <div className="app-navbar-right">
          {user?.is_admin && (
            <Button
              variant="link"
              className="app-admin-button"
              onClick={() => navigate("/admin")}
            >
              Admin
            </Button>
          )}

          {user ? (
            <div className="app-user-dropdown-wrap">
              <NavDropdown
                id="public-user-dropdown"
                title={<span className="app-user-title">{user.name ?? "Conta"}</span>}
                align="end"
                menuVariant="dark"
                className="app-user-dropdown"
              >
                <NavDropdown.Item onClick={() => navigate("/profile")}>Perfil</NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleLogout}>Sair</NavDropdown.Item>
              </NavDropdown>
            </div>
          ) : (
            <Button variant="link" onClick={() => navigate("/login")} className="app-login-button">
              Entrar
            </Button>
          )}
        </div>
      </Container>
    </Navbar>
  );
}
