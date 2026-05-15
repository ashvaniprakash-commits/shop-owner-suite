import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { creditsService, customersService, paymentsService } from "@/services/db";
import { toast } from "sonner";
import { Header, EmptyState, Modal, Input } from "./customers";
import { fmt } from "./dashboard";

export const Route = createFileRoute("/_authenticated/credits")({
  component: CreditsPage,
  head: () => ({ meta: [{ title: "Credit — Ledger" }] }),
});

type CustomerSummary = {
  customer_id: string;
  name: string;
  total_credit: number;
  total_paid: number;
  outstanding: number;
  entries: number;
  last_at: string;
};

function CreditsPage() {
  const credits = useQuery({ queryKey: ["credits"], queryFn: creditsService.list });
  const payments = useQuery({ queryKey: ["payments"], queryFn: paymentsService.list });
  const [open, setOpen] = useState(false);

  const summaries = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();
    for (const c of credits.data ?? []) {
      if (!c.customer_id) continue;
      const cur = map.get(c.customer_id) ?? {
        customer_id: c.customer_id,
        name: (c as any).customer?.name ?? "—",
        total_credit: 0, total_paid: 0, outstanding: 0, entries: 0, last_at: c.created_at,
      };
      cur.total_credit += Number(c.amount || 0);
      cur.entries += 1;
      if (c.created_at > cur.last_at) cur.last_at = c.created_at;
      map.set(c.customer_id, cur);
    }
    for (const p of payments.data ?? []) {
      if (!p.customer_id) continue;
      const cur = map.get(p.customer_id);
      if (cur) cur.total_paid += Number(p.amount || 0);
    }
    return Array.from(map.values())
      .map((s) => ({ ...s, outstanding: s.total_credit - s.total_paid }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [credits.data, payments.data]);

  const isLoading = credits.isLoading || payments.isLoading;

  return (
    <div>
      <Header title="Credit" sub="One row per customer — tap to see entries." action={
        <button onClick={() => setOpen(true)} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">+ New credit entry</button>
      }/>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        summaries.length === 0 ? <EmptyState msg="No credit entries yet." /> :
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Entries</th>
                <th className="px-5 py-3">Last entry</th>
                <th className="px-5 py-3 text-right">Credit</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Outstanding</th>
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
                  <td className="px-5 py-3 text-muted-foreground">{s.entries}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(s.last_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">{fmt(s.total_credit)}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{fmt(s.total_paid)}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${s.outstanding > 0 ? "text-primary" : ""}`}>{fmt(s.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      {open && <CreditDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function CreditDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: customersService.list });
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const [form, setForm] = useState({ amount: "", description: "" });

  const submit = useMutation({
    mutationFn: async () => {
      let cid = customerId;
      if (mode === "new") {
        if (!newCustomer.name.trim()) throw new Error("Customer name required");
        const c = await customersService.create(newCustomer);
        cid = c.id;
      }
      if (!cid) throw new Error("Pick a customer");
      return creditsService.create({
        customer_id: cid,
        amount: Number(form.amount),
        description: form.description || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Credit added");
      qc.invalidateQueries({ queryKey: ["credits"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Modal title="New credit entry" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-4">
        <div className="flex gap-2 rounded-lg bg-secondary p-1">
          <button type="button" onClick={() => setMode("existing")}
            className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${mode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            Existing customer
          </button>
          <button type="button" onClick={() => setMode("new")}
            className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${mode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            + Add new
          </button>
        </div>

        {mode === "existing" ? (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Customer *</span>
            <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">Select…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        ) : (
          <div className="space-y-3 rounded-lg border bg-secondary/40 p-3">
            <Input label="Name *" value={newCustomer.name} onChange={(v) => setNewCustomer({ ...newCustomer, name: v })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Phone" value={newCustomer.phone} onChange={(v) => setNewCustomer({ ...newCustomer, phone: v })} />
              <Input label="Email" type="email" value={newCustomer.email} onChange={(v) => setNewCustomer({ ...newCustomer, email: v })} />
            </div>
          </div>
        )}

        <Input label="Amount (₹) *" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
        <Input label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <p className="text-xs text-muted-foreground">Date and time are recorded automatically.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-secondary">Cancel</button>
          <button disabled={submit.isPending} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">Save</button>
        </div>
      </form>
    </Modal>
  );
}
