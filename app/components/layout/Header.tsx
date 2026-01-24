import { Form, Link } from "react-router";
import type { AppUser } from "~/lib/types";

interface HeaderProps {
  user: AppUser | null;
}

export function Header({ user }: HeaderProps) {
  const isAdmin = user?.role === "admin";
  const canEdit = user?.role === "admin" || user?.role === "editor";

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          <span role="img" aria-label="table tennis">🏓</span>
          PD
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
            <div className="user-dropdown">
              <button className="dropdown-trigger">
                <span className="user-name">{user.fullName || user.email}</span>
                {user.role !== "viewer" && (
                  <span className="user-role hide-mob">{user.role}</span>
                )}
                <svg
                  className="dropdown-arrow"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="dropdown-menu">
                {canEdit && (
                  <Link to="/editor/matches" className="dropdown-item">
                    Submit Results
                  </Link>
                )}
                {isAdmin && (
                  <Link to="/admin" className="dropdown-item">
                    Admin
                  </Link>
                )}
                <div className="dropdown-divider" />
                <Form action="/logout" method="post">
                  <button type="submit" className="dropdown-item">
                    Logout
                  </button>
                </Form>
              </div>
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
