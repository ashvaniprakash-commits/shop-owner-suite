import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const navItems = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/customers", label: "Customers" },
    { to: "/credits", label: "Credit" },
    { to: "/payments", label: "Payments" },
    { to: "/reports", label: "Reports" },
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/dashboard" className="text-lg font-bold">
            <span className="text-primary">●</span> Ledger
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((it) => {
              const active = loc.pathname.startsWith(it.to);
              return (
                <Link key={it.to} to={it.to} className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  {it.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:inline">{user.email}</span>
            <button onClick={async () => { await signOut(); nav({ to: "/" }); }} className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-secondary">
              Log out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-6 py-2 md:hidden">
          {navItems.map((it) => {
            const active = loc.pathname.startsWith(it.to);
            return (
              <Link key={it.to} to={it.to} className={`rounded-full px-3 py-1.5 text-xs font-medium ${active ? "bg-secondary" : "text-muted-foreground"}`}>
                {it.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
