import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { creditsService, customersService, paymentsService } from "@/services/db";
import { fmt } from "./dashboard";
import { Header } from "./customers";
import { parseItems, type ParsedItem } from "@/lib/parse-items";
import { createSpeechRecognizer, type SpeechHandle } from "@/lib/speech";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  component: CustomerDetail,
  head: () => ({ meta: [{ title: "Customer — Ledger" }] }),
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const navigate = useNavigate();

  const customer = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => customersService.get(customerId),
  });
  const entries = useQuery({
    queryKey: ["credits-by-customer", customerId],
    queryFn: () => creditsService.listByCustomer(customerId),
  });
  const pays = useQuery({
    queryKey: ["payments-by-customer", customerId],
    queryFn: () => paymentsService.listByCustomer(customerId),
  });

  const totalCredit = (entries.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalPaid = (pays.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstanding = totalCredit - totalPaid;

  const save = useMutation({
    mutationFn: (items: ParsedItem[]) =>
      creditsService.createMany(
        customerId,
        items.map((i) => ({ description: i.name, amount: i.price })),
      ),
    onSuccess: () => {
      toast.success("Entries added");
      qc.invalidateQueries({ queryKey: ["credits-by-customer", customerId] });
      qc.invalidateQueries({ queryKey: ["credits"] });
      setShowAdd(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCustomer = useMutation({
    mutationFn: (patch: Partial<any>) => customersService.update(customerId, patch),
    onSuccess: (d) => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setShowEdit(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeCustomer = useMutation({
    mutationFn: () => customersService.remove(customerId),
    onSuccess: () => {
      toast.success("Customer removed");
      qc.invalidateQueries({ queryKey: ["customers"] });
      navigate({ to: "/customers" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (customer.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!customer.data) return <p className="text-sm text-muted-foreground">Customer not found.</p>;

  const c = customer.data;

  const timeline = [
    ...(entries.data ?? []).map((e) => ({ kind: "credit" as const, id: e.id, when: e.created_at, label: e.description ?? "—", amount: Number(e.amount) })),
    ...(pays.data ?? []).map((p) => ({ kind: "payment" as const, id: p.id, when: p.paid_at, label: p.method ? `Payment · ${p.method}` : "Payment", amount: Number(p.amount) })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));

  return (
    <div>
      <Link to="/customers" className="mb-4 inline-block text-xs text-muted-foreground hover:text-primary">← All customers</Link>

      <Header
        title={c.name}
        sub={[c.phone, c.email].filter(Boolean).join(" · ") || "Customer profile"}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
        <button onClick={() => setShowEdit(true)} className="h-10 rounded-full border px-3 sm:px-4 text-sm font-medium hover:bg-secondary">Edit</button>
        <button onClick={() => confirm('Remove this customer?') && removeCustomer.mutate()} className="h-10 rounded-full border px-3 sm:px-4 text-sm font-medium text-red-600 hover:bg-secondary">Remove</button>
        <button
          onClick={async () => {
            try {
              const el = document.getElementById("customer-print");
              if (!el) throw new Error("Content not found");
              const { default: html2canvas } = await import("html2canvas");
              const { jsPDF } = await import("jspdf");
              const canvas = await html2canvas(el, { scale: 2 });
              const imgData = canvas.toDataURL("image/png");
              const pdf = new jsPDF("p", "pt", "a4");
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const imgProps = pdf.getImageProperties(imgData);
              const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
              pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
              const blob = pdf.output("blob");
              const filename = `${c.name.replace(/[^a-z0-9\-\_ ]/gi, "") || "customer"}-ledger.pdf`;
              const file = new File([blob], filename, { type: "application/pdf" });
              if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
                await (navigator as any).share({ files: [file], title: `${c.name} ledger`, text: `Ledger for ${c.name}` });
              } else {
                pdf.save(filename);
              }
            } catch (err: any) {
              toast.error(err?.message || "Failed to create PDF");
            }
          }}
          className="h-10 rounded-full border px-3 sm:px-4 text-sm font-medium hover:bg-secondary"
        >
          Share
        </button>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="h-10 rounded-full bg-primary px-3 sm:px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {showAdd ? "Close" : "+ Add entry"}
        </button>
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowEdit(false)}>
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-xl font-semibold">Edit customer</h2>
            <EditForm initial={c} onCancel={() => setShowEdit(false)} onSave={(patch) => updateCustomer.mutate(patch)} pending={updateCustomer.isPending} />
          </div>
        </div>
      )}

      <div id="customer-print">
        <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total credit" value={fmt(totalCredit)} />
        <Stat label="Total paid" value={fmt(totalPaid)} />
        <Stat label="Outstanding" value={fmt(outstanding)} accent={outstanding > 0} />
        </div>

      {showAdd && <div className="mt-6"><QuickAddPanel onSubmit={(items) => save.mutate(items)} pending={save.isPending} /></div>}

        <div className="mt-8">
          <div className="flex items-center justify-between border-b px-0 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Activity</span>
            <span>Outstanding: <span className={outstanding > 0 ? "text-primary" : "text-foreground"}>{fmt(outstanding)}</span></span>
          </div>
        {entries.isLoading || pays.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : timeline.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-0">
            {timeline.map((t) => (
              <div key={`${t.kind}-${t.id}`} className="flex items-center justify-between border-b py-3 text-sm">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${t.kind === "credit" ? "bg-slate-400" : "bg-green-500"}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.when).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className={`px-3 text-right font-semibold flex-shrink-0 ${t.kind === "payment" ? "text-muted-foreground" : ""}`}>
                  {t.kind === "payment" ? "− " : ""}{fmt(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Remaining due</div>
            <div className="mt-1 text-2xl font-bold text-primary">{fmt(outstanding)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function QuickAddPanel({ onSubmit, pending }: { onSubmit: (items: ParsedItem[]) => void; pending: boolean }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState("en-US");
  const recRef = useRef<SpeechHandle | null>(null);
  const supportsMic = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => () => { recRef.current?.stop(); }, []);

  const parseAndStage = (raw: string) => {
    const parsed = parseItems(raw);
    if (parsed.length === 0) {
      toast.error("Couldn't find a price. Try: 'Milk 50, Bread 30'");
      return;
    }
    setItems((prev) => [...prev, ...parsed]);
    setText("");
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = createSpeechRecognizer({
      onResult: (transcript, isFinal) => {
        if (isFinal) {
          setText("");
          parseAndStage(transcript);
        } else {
          setText(transcript);
        }
      },
      onError: (err) => { toast.error(`Mic: ${err}`); setListening(false); },
      onEnd: () => setListening(false),
      lang,
    });
    if (!rec) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const total = items.reduce((s, i) => s + i.price, 0);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add entries</div>

      <form
        onSubmit={(e) => { e.preventDefault(); parseAndStage(text); }}
        className="flex items-center gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g. "Milk 50, Bread 30" — Enter to add'
          className="h-12 flex-1 rounded-lg border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={toggleMic}
          disabled={!supportsMic}
          title={supportsMic ? "Speak items" : "Mic not supported"}
          className={`flex h-12 w-12 items-center justify-center rounded-lg border transition ${
            listening ? "border-primary bg-primary text-primary-foreground animate-pulse" : "hover:bg-secondary"
          } disabled:opacity-40`}
        >
          <MicIcon />
        </button>
      </form>
      {listening && <p className="mt-2 text-xs text-primary">Listening… speak items like “milk fifty, bread thirty”</p>}

      {items.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5 text-right">Price</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-2">
                    <input value={it.name} onChange={(e) => {
                      const v = e.target.value;
                      setItems((prev) => prev.map((p, i) => i === idx ? { ...p, name: v } : p));
                    }} className="w-full bg-transparent outline-none" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" value={it.price} onChange={(e) => {
                      const v = Number(e.target.value);
                      setItems((prev) => prev.map((p, i) => i === idx ? { ...p, price: v } : p));
                    }} className="w-24 bg-transparent text-right outline-none" />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-muted-foreground hover:text-primary">×</button>
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-secondary/60">
                <td className="px-4 py-2.5 font-semibold">Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-primary">{fmt(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 border-t bg-background p-3">
            <button onClick={() => setItems([])} className="h-9 rounded-full border px-4 text-xs font-medium hover:bg-secondary w-full sm:w-auto">
              Clear
            </button>
            <button
              disabled={pending || items.length === 0}
              onClick={() => onSubmit(items)}
              className="h-9 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 w-full sm:w-auto"
            >
              {pending ? "Saving…" : `Save ${items.length} entr${items.length === 1 ? "y" : "ies"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

function EditForm({ initial, onCancel, onSave, pending }: { initial: any; onCancel: () => void; onSave: (patch: Partial<any>) => void; pending: boolean }) {
  const [form, setForm] = useState({
    name: initial.name || "",
    phone: initial.phone || "",
    email: initial.email || "",
    address: initial.address || "",
    notes: initial.notes || "",
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Name *</span>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Address</span>
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes</span>
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none" />
      </label>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-secondary w-full sm:w-auto">Cancel</button>
        <button disabled={pending} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 w-full sm:w-auto">Save</button>
      </div>
    </form>
  );
}
