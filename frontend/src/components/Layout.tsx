import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/libraries", label: "Libraries" },
  { to: "/tracks", label: "Tracks" },
  { to: "/collections", label: "Collections" },
  { to: "/sharing", label: "Sharing" },
  { to: "/search", label: "Search" },
  { to: "/analytics", label: "Analytics" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-edge bg-panel">
        <div className="border-b border-edge px-4 py-4">
          <div className="text-lg font-semibold text-white">Phonograph</div>
          <div className="text-xs text-gray-500">metadata-first library</div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive ? "bg-edge text-white" : "text-gray-300 hover:bg-edge/60"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive ? "bg-edge text-white" : "text-gray-300 hover:bg-edge/60"
                }`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>
        <div className="border-t border-edge p-3 text-sm">
          <div className="truncate text-gray-200">{user?.username}</div>
          <div className="mb-2 text-xs text-gray-500">{user?.email}</div>
          <button className="btn-ghost w-full" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
