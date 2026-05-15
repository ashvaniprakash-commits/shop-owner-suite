import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Ledger — your shop, your numbers" },
      { name: "description", content: "Track customers, credit, and payments. Each account is a fully isolated shop." },
    ],
  }),
});

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="text-xl font-bold tracking-tight">
            <span className="text-primary">●</span> Ledger
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium hover:bg-secondary">
                  Log in
                </Link>
                <Link to="/signup" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="mb-4 text-sm font-medium text-primary">Your shop · Your data</p>
        <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          A clean ledger for the<br />way you actually run your shop.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Track customers, credit, and payments in one place.
          Every account is a fully isolated workspace — your numbers stay yours.
        </p>
        <div className="mt-10 flex gap-3">
          <Link to={user ? "/dashboard" : "/signup"} className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground hover:opacity-90">
            Get started
          </Link>
          <Link to="/login" className="inline-flex h-12 items-center rounded-full border px-7 text-base font-semibold hover:bg-secondary">
            I already have an account
          </Link>
        </div>

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            { t: "Customers", d: "One tidy address book per shop, only visible to you." },
            { t: "Credit & payments", d: "Log who owes what, mark payments, watch balances clear." },
            { t: "Monthly reports", d: "Auto-aggregated totals you can revisit any month." },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border p-6 shadow-[var(--shadow-card)]">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">●</div>
              <h3 className="text-lg font-semibold">{c.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Ledger
      </footer>
    </div>
  );
}
