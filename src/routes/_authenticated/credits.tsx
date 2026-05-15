import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { creditsService, customersService } from "@/services/db";
import { toast } from "sonner";
import { Header, EmptyState, Modal, Input } from "./customers";
import { fmt } from "./dashboard";

export const Route = createFileRoute("/_authenticated/credits")({
  component: CreditsPage,
  head: () => ({ meta: [{ title: "Credit — Ledger" }] }),
});

function CreditsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["credits"], queryFn: creditsService.list });
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: creditsService.remove,
    onSuccess: () => { toast.success("Entry removed"); qc.invalidateQueries({ queryKey: ["credits"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => creditsService.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credits"] }),
  });

  return (
    <div>
      <Header title="Credit" sub="Track who owes what." action={
        <button onClick={() => setOpen(true)} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">+ New credit entry</button>
      }/>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        data.length === 0 ? <EmptyState msg="No credit entries yet." /> :
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="px-5 py-3 font-medium">
                    {c.customer_id ? (
                      <Link to="/customers/$customerId" params={{ customerId: c.customer_id }} className="hover:text-primary hover:underline">
                        {c.customer?.name ?? "—"}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{c.description ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <select value={c.status} onChange={(e) => updateStatus.mutate({ id: c.id, status: e.target.value })}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${c.status === "paid" ? "bg-secondary" : "text-primary"}`}>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">{fmt(c.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => confirm("Remove?") && remove.mutate(c.id)} className="text-xs text-muted-foreground hover:text-primary">Remove</button>
                  </td>
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
  const [form, setForm] = useState({ amount: "", description: "", due_date: "" });

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
        due_date: form.due_date || null,
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

        <Input label="Amount *" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
        <Input label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <Input label="Due date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-secondary">Cancel</button>
          <button disabled={submit.isPending} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">Save</button>
        </div>
      </form>
    </Modal>
  );
}
