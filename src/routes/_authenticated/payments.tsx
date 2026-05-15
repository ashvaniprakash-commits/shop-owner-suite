import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { paymentsService, customersService } from "@/services/db";
import { toast } from "sonner";
import { Header, EmptyState, Modal, Input, Select } from "./customers";
import { fmt } from "./dashboard";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Payments — Ledger" }] }),
});

function PaymentsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["payments"], queryFn: paymentsService.list });
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: paymentsService.remove,
    onSuccess: () => { toast.success("Payment removed"); qc.invalidateQueries({ queryKey: ["payments"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Header title="Payments" sub="Mark payments received from customers." action={
        <button onClick={() => setOpen(true)} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">+ Record payment</button>
      }/>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        data.length === 0 ? <EmptyState msg="No payments recorded yet." /> :
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="px-5 py-3 font-medium">{p.customer?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.method ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.notes ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right font-semibold">{fmt(p.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => confirm("Remove?") && remove.mutate(p.id)} className="text-xs text-muted-foreground hover:text-primary">Remove</button>
                  </td>
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
  const [form, setForm] = useState({ customer_id: "", amount: "", method: "", notes: "" });
  const create = useMutation({
    mutationFn: () => paymentsService.create({
      customer_id: form.customer_id,
      amount: Number(form.amount),
      method: form.method || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => { toast.success("Payment recorded"); qc.invalidateQueries({ queryKey: ["payments"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
        <Select label="Customer *" value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })} required
          options={customers.map((c) => ({ value: c.id, label: c.name }))} />
        <Input label="Amount *" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
        <Input label="Method" value={form.method} onChange={(v) => setForm({ ...form, method: v })} />
        <Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-secondary">Cancel</button>
          <button disabled={create.isPending} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">Save</button>
        </div>
      </form>
    </Modal>
  );
}
