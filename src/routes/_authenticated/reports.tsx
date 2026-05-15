import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportsService } from "@/services/db";
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

  const generate = useMutation({
    mutationFn: () => {
      const d = new Date();
      return reportsService.generateForMonth(d.getMonth() + 1, d.getFullYear());
    },
    onSuccess: () => { toast.success("Monthly report generated"); qc.invalidateQueries({ queryKey: ["reports"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Header title="Monthly reports" sub="Snapshots of your shop, month by month." action={
        <button disabled={generate.isPending} onClick={() => generate.mutate()} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {generate.isPending ? "Generating…" : "Generate this month"}
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
