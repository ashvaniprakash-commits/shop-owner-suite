import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { creditsService, customersService } from "@/services/db";
import { toast } from "sonner";
import { Header, EmptyState, Modal, Input, Select } from "./customers";
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
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="px-5 py-3 font-medium">{c.customer?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.description ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.due_date ?? "—"}</td>
                  <td className="px-5 py-3">
                    <select value={c.status} onChange={(e) => updateStatus.mutate({ id: c.id, status: e.target.value })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${c.status === "paid" ? "bg-secondary" : "text-primary"}`}>
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
  const [form, setForm] = useState({ customer_id: "", amount: "", description: "", due_date: "" });
  const create = useMutation({
    mutationFn: () => creditsService.create({
      customer_id: form.customer_id,
      amount: Number(form.amount),
      description: form.description || undefined,
      due_date: form.due_date || null,
    }),
    onSuccess: () => { toast.success("Credit added"); qc.invalidateQueries({ queryKey: ["credits"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Modal title="New credit entry" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
        <Select label="Customer *" value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })} required
          options={customers.map((c) => ({ value: c.id, label: c.name }))} />
        <Input label="Amount *" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
        <Input label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <Input label="Due date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-secondary">Cancel</button>
          <button disabled={create.isPending} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">Save</button>
        </div>
      </form>
    </Modal>
  );
}
