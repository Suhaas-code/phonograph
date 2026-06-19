import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/libraries", label: "Libraries" },
  { to: "/tracks", label: "Tracks" },
  { to: "/collections", label: "Collections" },
  { to: "/sharing", label: "Sharing" },
  { to: "/analytics", label: "Analytics" },
  { to: "/bugs", label: "Report Bug" },
  { to: "/health", label: "Health" },
  { to: "/settings", label: "Settings" },
];

function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin?: boolean }) {
  const items = isAdmin ? [...NAV, { to: "/admin", label: "Admin" }] : NAV;
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={(item as { end?: boolean }).end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `block rounded px-3 py-2.5 text-sm ${
              isActive ? "bg-edge text-white" : "text-gray-300 hover:bg-edge/60"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-edge bg-panel px-4 py-3 md:hidden">
        <button
          aria-label="Toggle menu"
          className="btn-ghost px-2 py-1"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="block h-0.5 w-5 bg-gray-200" />
          <span className="mt-1 block h-0.5 w-5 bg-gray-200" />
          <span className="mt-1 block h-0.5 w-5 bg-gray-200" />
        </button>
        <div className="text-lg font-semibold text-white">Phonograph</div>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={logout}>
          Sign out
        </button>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={closeMenu}>
          <div className="absolute inset-0 bg-black/50" />
          <nav
            className="absolute left-0 top-0 h-full w-64 space-y-1 border-r border-edge bg-panel p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 px-3 py-2">
              <div className="truncate text-sm text-gray-200">{user?.username}</div>
              <div className="truncate text-xs text-gray-500">{user?.email}</div>
            </div>
            <NavLinks onNavigate={closeMenu} isAdmin={user?.role === "admin"} />
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-edge bg-panel md:flex">
        <div className="border-b border-edge px-4 py-4">
          <div className="text-lg font-semibold text-white">Phonograph</div>
          <div className="text-xs text-gray-500">metadata-first library</div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          <NavLinks isAdmin={user?.role === "admin"} />
        </nav>
        <div className="border-t border-edge p-3 text-sm">
          <div className="truncate text-gray-200">{user?.username}</div>
          <div className="mb-2 truncate text-xs text-gray-500">{user?.email}</div>
          <button className="btn-ghost w-full" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto" key={location.pathname}>
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
