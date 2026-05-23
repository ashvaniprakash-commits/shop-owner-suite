import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { customersService, type Customer } from "@/services/db";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
  head: () => ({ meta: [{ title: "Customers — Ledger" }] }),
});

function CustomersPage() {
  const qc = useQueryClient();
  const loc = useLocation();
  const { data = [], isLoading } = useQuery({ queryKey: ["customers"], queryFn: customersService.list });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const remove = useMutation({
    mutationFn: customersService.remove,
    onSuccess: () => { toast.success("Customer removed"); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const customerSelected = loc.pathname.startsWith("/customers/");

  return (
    <div>
      <Header title="Customers" sub="Your private address book." action={
        <button onClick={() => setOpen(true)} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 whitespace-nowrap">+ New customer</button>
      }/>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        data.length === 0 ? <EmptyState msg="No customers yet. Add your first one." /> :
        (customerSelected ? (
          <div className="rounded-xl border bg-background p-6 shadow-sm">
            <Outlet />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers" className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none" />
              </div>
              <div className="w-40">
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none">
                  <option value="all">All</option>
                  <option value="hasPhone">Has phone</option>
                  <option value="hasNotes">Has notes</option>
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-background">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    .filter((c: Customer) => {
                      const q = query.trim().toLowerCase();
                      if (q && ![c.name, c.phone, c.notes].join(" ").toLowerCase().includes(q)) return false;
                      if (filter === "hasPhone" && !c.phone) return false;
                      if (filter === "hasNotes" && !c.notes) return false;
                      return true;
                    })
                    .slice(0, 25)
                    .map((c: Customer) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-5 py-3 font-medium">
                          <Link to="/customers/$customerId" params={{ customerId: c.id }} className="hover:text-primary hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{c.notes ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      }
      {open && <CustomerDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function CustomerDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const create = useMutation({
    mutationFn: customersService.create,
    onSuccess: () => { toast.success("Customer added"); qc.invalidateQueries({ queryKey: ["customers"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Modal title="Add customer" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="space-y-4">
        <Input label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        </div>
        <Input label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        <Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-secondary">Cancel</button>
          <button disabled={create.isPending} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function Header({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
export function EmptyState({ msg }: { msg: string }) {
  return <div className="rounded-2xl border bg-secondary p-12 text-center text-sm text-muted-foreground">{msg}</div>;
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
export function Input({ label, type = "text", value, onChange, required }: { label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}
export function Select({ label, value, onChange, options, required }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <select required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
