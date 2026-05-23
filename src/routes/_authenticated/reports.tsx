import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { reportsService, creditsService, paymentsService } from "@/services/db";
import { toast } from "sonner";
import { Header, EmptyState } from "./customers";
import { fmt } from "./dashboard";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — Ledger" }] }),
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function ReportsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["reports"], queryFn: reportsService.list });
  const credits = useQuery({ queryKey: ["credits"], queryFn: creditsService.list });
  const payments = useQuery({ queryKey: ["payments"], queryFn: paymentsService.list });

  const generate = useMutation({
    mutationFn: () => {
      const d = new Date();
      return reportsService.generateForMonth(d.getMonth() + 1, d.getFullYear());
    },
    onSuccess: () => { toast.success("Monthly report generated"); qc.invalidateQueries({ queryKey: ["reports"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const customerRows = useMemo(() => {
    const map = new Map<string, { customer_id: string; name: string; total_credit: number; total_paid: number }>();
    for (const c of credits.data ?? []) {
      if (!c.customer_id) continue;
      const cur = map.get(c.customer_id) ?? { customer_id: c.customer_id, name: (c as any).customer?.name ?? "—", total_credit: 0, total_paid: 0 };
      cur.total_credit += Number(c.amount || 0);
      map.set(c.customer_id, cur);
    }
    for (const p of payments.data ?? []) {
      if (!p.customer_id) continue;
      const cur = map.get(p.customer_id) ?? { customer_id: p.customer_id, name: (p as any).customer?.name ?? "—", total_credit: 0, total_paid: 0 };
      cur.total_paid += Number(p.amount || 0);
      map.set(p.customer_id, cur);
    }
    return Array.from(map.values())
      .map((s) => ({ ...s, outstanding: s.total_credit - s.total_paid }))
      .sort((a, b) => b.total_credit - a.total_credit);
  }, [credits.data, payments.data]);

  const dailyCreditGroups = useMemo(() => {
    const groups = new Map<string, { date: string; entries: any[] }>();
    for (const credit of credits.data ?? []) {
      const dateKey = new Date(credit.created_at).toLocaleDateString();
      const entry = groups.get(dateKey);
      if (entry) entry.entries.push(credit);
      else groups.set(dateKey, { date: dateKey, entries: [credit] });
    }
    return Array.from(groups.values()).sort((a, b) => {
      const dateA = new Date(a.entries[0].created_at).getTime();
      const dateB = new Date(b.entries[0].created_at).getTime();
      return dateB - dateA;
    });
  }, [credits.data]);

  return (
    <div>
      <Header title="Monthly reports" sub="Snapshots of your shop, month by month." action={
        <button disabled={generate.isPending} onClick={() => generate.mutate()} className="w-full sm:w-auto h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {generate.isPending ? "Generating…" : "Generate"}
        </button>
      }/>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        data.length === 0 ? <EmptyState msg="No reports yet. Generate one above." /> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <div key={r.id} className="rounded-2xl border p-6">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{MONTHS[r.month - 1]} {r.year}</div>
              <div className="mt-4 space-y-2 text-sm">
                <Line label="Credit" value={fmt(Number(r.total_credit))} />
                <Line label="Paid" value={fmt(Number(r.total_paid))} />
                <Line label="Outstanding" value={fmt(Number(r.total_outstanding))} accent />
              </div>
            </div>
          ))}
        </div>
      }

      <div className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Daily itemized purchases</h2>
        <p className="mt-1 text-sm text-muted-foreground">See what was bought on each day from credit entries.</p>
        {credits.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : dailyCreditGroups.length === 0 ? (
          <div className="mt-6"><EmptyState msg="No daily purchase entries yet." /></div>
        ) : (
          <div className="mt-6 space-y-4">
            {dailyCreditGroups.map((group) => (
              <div key={group.date} className="rounded-2xl border p-5">
                <div className="mb-3 font-medium">{group.date}</div>
                <div className="space-y-3">
                  {group.entries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border bg-background p-4">
                      <div className="flex items-center justify-between gap-4 text-sm font-medium">
                        <span>{fmt(Number(entry.amount || 0))}</span>
                        <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {entry.description ? (
                        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                          {entry.description.split("\n").map((line: string, idx: number) => line.trim() ? <div key={idx}>• {line}</div> : null)}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">No item details.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold tracking-tight">Customer report</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sorted by highest credit. Tap a name to open their dashboard.</p>

        {credits.isLoading || payments.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : customerRows.length === 0 ? (
          <div className="mt-6"><EmptyState msg="No customer activity yet." /></div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 sm:px-5 py-3 whitespace-nowrap">Customer</th>
                  <th className="px-3 sm:px-5 py-3 text-right whitespace-nowrap">Credit</th>
                  <th className="px-3 sm:px-5 py-3 text-right whitespace-nowrap">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.map((s) => (
                  <tr key={s.customer_id} className="border-t hover:bg-secondary/40">
                    <td className="px-3 sm:px-5 py-3 font-medium min-w-max">
                      <Link to="/customers/$customerId" params={{ customerId: s.customer_id }} className="hover:text-primary hover:underline truncate block">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-3 sm:px-5 py-3 text-right whitespace-nowrap min-w-max">{fmt(s.total_credit)}</td>
                    <td className={`px-3 sm:px-5 py-3 text-right font-semibold whitespace-nowrap min-w-max ${s.outstanding > 0 ? "text-primary" : ""}`}>{fmt(s.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Line({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}
