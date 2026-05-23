import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { paymentsService, customersService, creditsService } from "@/services/db";
import { toast } from "sonner";
import { Header, EmptyState, Modal, Input, Select } from "./customers";
import { fmt } from "./dashboard";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Payments — Ledger" }] }),
});

function PaymentsPage() {
  const credits = useQuery({ queryKey: ["credits"], queryFn: creditsService.list });
  const payments = useQuery({ queryKey: ["payments"], queryFn: paymentsService.list });
  const [open, setOpen] = useState(false);

  const summaries = useMemo(() => {
    const map = new Map<string, { customer_id: string; name: string; total_paid: number; total_credit: number; outstanding: number; payments: number; last_at: string }>();
    for (const c of credits.data ?? []) {
      if (!c.customer_id) continue;
      const cur = map.get(c.customer_id) ?? { customer_id: c.customer_id, name: (c as any).customer?.name ?? "—", total_paid: 0, total_credit: 0, outstanding: 0, payments: 0, last_at: "" };
      cur.total_credit += Number(c.amount || 0);
      map.set(c.customer_id, cur);
    }
    for (const p of payments.data ?? []) {
      if (!p.customer_id) continue;
      const cur = map.get(p.customer_id) ?? { customer_id: p.customer_id, name: (p as any).customer?.name ?? "—", total_paid: 0, total_credit: 0, outstanding: 0, payments: 0, last_at: "" };
      cur.total_paid += Number(p.amount || 0);
      cur.payments += 1;
      if (!cur.last_at || p.paid_at > cur.last_at) cur.last_at = p.paid_at;
      map.set(p.customer_id, cur);
    }
    return Array.from(map.values())
      .filter((s) => s.payments > 0)
      .map((s) => ({ ...s, outstanding: s.total_credit - s.total_paid }))
      .sort((a, b) => (b.last_at > a.last_at ? 1 : -1));
  }, [credits.data, payments.data]);

  const isLoading = credits.isLoading || payments.isLoading;

  return (
    <div>
      <Header title="Payments" sub="Each payment auto-deducts from the customer's outstanding." action={
        <>
          <button onClick={() => setOpen(true)} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:hidden whitespace-nowrap" >Add New</button>
          <button onClick={() => setOpen(true)} className="hidden sm:inline-flex h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">+ Record payment</button>
        </>
      }/>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        summaries.length === 0 ? <EmptyState msg="No payments recorded yet." /> :
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 hidden sm:table-cell">Payments</th>
                <th className="px-5 py-3">Last paid</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right hidden sm:table-cell">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.customer_id} className="border-t hover:bg-secondary/40">
                  <td className="px-5 py-3 font-medium">
                    <Link to="/customers/$customerId" params={{ customerId: s.customer_id }} className="hover:text-primary hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{s.payments}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(s.last_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right font-semibold">{fmt(s.total_paid)}</td>
                  <td className={`px-5 py-3 text-right font-semibold hidden sm:table-cell ${s.outstanding > 0 ? "text-primary" : "text-muted-foreground"}`}>{fmt(s.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      {open && <PaymentDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function PaymentDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: customersService.list });
  const [form, setForm] = useState({ customer_id: "", amount: "", notes: "" });

  const create = useMutation({
    mutationFn: () => paymentsService.create({
      customer_id: form.customer_id,
      amount: Number(form.amount),
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success("Payment recorded — outstanding updated");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["credits"] });
      qc.invalidateQueries({ queryKey: ["payments-by-customer"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Modal title="Record payment" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
        <Select label="Customer *" value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })} required
          options={customers.map((c) => ({ value: c.id, label: c.name }))} />
        <Input label="Amount (₹) *" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
        <Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-secondary">Cancel</button>
          <button disabled={create.isPending} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">Save</button>
        </div>
      </form>
    </Modal>
  );
}

