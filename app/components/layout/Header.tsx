import { Form, Link } from "react-router";
import type { AppUser } from "~/lib/types";

interface HeaderProps {
  user: AppUser | null;
}

export function Header({ user }: HeaderProps) {
  const isAdmin = user?.role === "admin";

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          PD Table Tennis
        </Link>

        <nav className="header-nav">
          <Link to="/standings" className="nav-link">
            Standings
          </Link>
          <Link to="/results" className="nav-link">
            Results
          </Link>
          <Link to="/players" className="nav-link">
            Players
          </Link>
          <Link to="/bracket" className="nav-link">
            Bracket
          </Link>
        </nav>

        <div className="header-auth">
          {user ? (
            <div className="user-menu">
              <span className="user-name">{user.fullName || user.email}</span>
              {user.role !== "viewer" && (
                <span className="user-role">{user.role}</span>
              )}
              {isAdmin && (
                <Link to="/admin" className="nav-link admin-link">
                  Admin
                </Link>
              )}
              <Form action="/logout" method="post">
                <button type="submit" className="btn-logout">
                  Logout
                </button>
              </Form>
            </div>
          ) : (
            <Link to="/login" className="btn-login">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
