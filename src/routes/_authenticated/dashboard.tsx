import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { customersService, creditsService, paymentsService } from "@/services/db";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Ledger" }] }),
});

function Dashboard() {
  const customers = useQuery({ queryKey: ["customers"], queryFn: customersService.list });
  const credits = useQuery({ queryKey: ["credits"], queryFn: creditsService.list });
  const payments = useQuery({ queryKey: ["payments"], queryFn: paymentsService.list });

  const totalCredit = (credits.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPaid = (payments.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const outstanding = totalCredit - totalPaid;

  const stats = [
    { label: "Customers", value: customers.data?.length ?? 0, link: "/customers" as const },
    { label: "Total credit", value: fmt(totalCredit), link: "/credits" as const },
    { label: "Total paid", value: fmt(totalPaid), link: "/payments" as const },
    { label: "Outstanding", value: fmt(outstanding), link: "/credits" as const, accent: true },
  ];

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-muted-foreground">A quick look at your shop today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.link} className="block rounded-2xl border p-6 transition hover:shadow-[var(--shadow-card)]">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`mt-3 text-2xl font-bold ${s.accent ? "text-primary" : ""}`}>{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Card title="Recent credit" link="/credits">
          {(credits.data ?? []).slice(0, 5).map((c: any) => (
            <Row key={c.id} left={c.customer?.name ?? "—"} right={fmt(c.amount)} sub={c.description ?? ""} />
          ))}
          {(credits.data ?? []).length === 0 && <Empty msg="No credit entries yet." />}
        </Card>
        <Card title="Recent payments" link="/payments">
          {(payments.data ?? []).slice(0, 5).map((p: any) => (
            <Row key={p.id} left={p.customer?.name ?? "—"} right={fmt(p.amount)} sub={p.method ?? ""} />
          ))}
          {(payments.data ?? []).length === 0 && <Empty msg="No payments yet." />}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, link, children }: { title: string; link: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Link to={link} className="text-xs font-medium text-primary hover:underline">View all</Link>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Row({ left, right, sub }: { left: string; right: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
      <div>
        <div className="text-sm font-medium">{left}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="text-sm font-semibold">{right}</div>
    </div>
  );
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{msg}</div>;
}
export function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(n || 0));
}
