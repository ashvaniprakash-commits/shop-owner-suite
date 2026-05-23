import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { creditsService, customersService, paymentsService } from "@/services/db";
import { toast } from "sonner";
import { Header, EmptyState, Modal, Input } from "./customers";
import { fmt } from "./dashboard";
import { parseItems, type ParsedItem } from "@/lib/parse-items";
import { createSpeechRecognizer, type SpeechHandle } from "@/lib/speech";

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
        <button onClick={() => setOpen(true)} className="inline-flex w-full sm:w-auto h-10 items-center justify-center rounded-full bg-primary px-3 sm:px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 whitespace-nowrap">+ New entry</button>
      }/>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        summaries.length === 0 ? <EmptyState msg="No credit entries yet." /> :
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 sm:px-5 py-3 whitespace-nowrap">Customer</th>
                <th className="px-3 sm:px-5 py-3 hidden sm:table-cell whitespace-nowrap">Entries</th>
                <th className="px-3 sm:px-5 py-3 whitespace-nowrap">Last entry</th>
                <th className="px-3 sm:px-5 py-3 text-right whitespace-nowrap">Credit</th>
                <th className="px-3 sm:px-5 py-3 text-right hidden sm:table-cell whitespace-nowrap">Paid</th>
                <th className="px-3 sm:px-5 py-3 text-right hidden sm:table-cell whitespace-nowrap">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.customer_id} className="border-t hover:bg-secondary/40">
                  <td className="px-3 sm:px-5 py-3 font-medium whitespace-nowrap">
                    <Link to="/customers/$customerId" params={{ customerId: s.customer_id }} className="hover:text-primary hover:underline truncate block">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-3 sm:px-5 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">{s.entries}</td>
                  <td className="px-3 sm:px-5 py-3 text-muted-foreground whitespace-nowrap">{new Date(s.last_at).toLocaleDateString()}</td>
                  <td className="px-3 sm:px-5 py-3 text-right whitespace-nowrap">{fmt(s.total_credit)}</td>
                  <td className="px-3 sm:px-5 py-3 text-right text-muted-foreground hidden sm:table-cell whitespace-nowrap">{fmt(s.total_paid)}</td>
                  <td className={`px-3 sm:px-5 py-3 text-right font-semibold hidden sm:table-cell whitespace-nowrap ${s.outstanding > 0 ? "text-primary" : ""}`}>{fmt(s.outstanding)}</td>
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
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [itemText, setItemText] = useState("");
  const [listeningDescription, setListeningDescription] = useState(false);
  const [listeningItems, setListeningItems] = useState(false);
  const descRecRef = useRef<SpeechHandle | null>(null);
  const itemsRecRef = useRef<SpeechHandle | null>(null);
  const supportsMic = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const [descLang, setDescLang] = useState<string>(() => {
    if (typeof navigator === "undefined") return "en-US";
    const userLang = navigator.languages?.find((l) => l.startsWith("hi")) ?? navigator.language ?? "en-US";
    return userLang.startsWith("hi") ? "hi-IN" : "en-US";
  });

  const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
  const descriptionFromItems = (itemList: ParsedItem[]) => itemList.map((item) => `${item.name} - ${fmt(item.price)}`).join("\n");
  const descriptionToSave = items.length > 0
    ? `${descriptionFromItems(items)}${form.description.trim() ? `\n\n${form.description.trim()}` : ""}`
    : form.description.trim();

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
        description: descriptionToSave || undefined,
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

  useEffect(() => {
    if (items.length > 0) {
      setForm((f) => ({ ...f, amount: String(itemsTotal) }));
    }
  }, [itemsTotal, items.length]);

  const parseAndStageItems = (raw: string) => {
    const parsed = parseItems(raw);
    if (parsed.length === 0) {
      toast.error("Couldn't find item prices. Try: milk 50, bread 30");
      return;
    }
    setItems((prev) => [...prev, ...parsed]);
    setItemText("");
  };

  const toggleDescriptionMic = () => {
    if (!supportsMic) {
      toast.error("Speech recognition not supported");
      return;
    }
    if (listeningDescription) {
      descRecRef.current?.stop();
      setListeningDescription(false);
      return;
    }
    const rec = createSpeechRecognizer({
      onResult: (transcript, isFinal) => {
        setForm((f) => ({ ...f, description: transcript }));
        if (isFinal) {
          setListeningDescription(false);
        }
      },
      onError: (err) => { toast.error(`Mic: ${err}`); setListeningDescription(false); },
      onEnd: () => setListeningDescription(false),
      lang: descLang,
    });
    if (!rec) {
      toast.error("Speech recognition not supported");
      return;
    }
    descRecRef.current = rec;
    rec.start();
    setListeningDescription(true);
  };

  const toggleItemsMic = () => {
    if (!supportsMic) {
      toast.error("Speech recognition not supported");
      return;
    }
    if (listeningItems) {
      itemsRecRef.current?.stop();
      setListeningItems(false);
      return;
    }
    const rec = createSpeechRecognizer({
      onResult: (transcript, isFinal) => {
        setItemText(transcript);
        if (isFinal) {
          parseAndStageItems(transcript);
          setListeningItems(false);
        }
      },
      onError: (err) => { toast.error(`Mic: ${err}`); setListeningItems(false); },
      onEnd: () => setListeningItems(false),
      lang: descLang,
    });
    if (!rec) {
      toast.error("Speech recognition not supported");
      return;
    }
    itemsRecRef.current = rec;
    rec.start();
    setListeningItems(true);
  };

  useEffect(() => () => {
    descRecRef.current?.stop();
    itemsRecRef.current?.stop();
  }, []);

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
        <div className="rounded-2xl border bg-secondary/40 p-3 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Items</div>
              <p className="text-sm text-muted-foreground">Speak or type item names and prices to build the list. The total amount will update automatically.</p>
            </div>
            <button type="button" onClick={() => setItems([])} disabled={items.length === 0} className="text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-50 whitespace-nowrap">Clear</button>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <input
              type="text"
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && itemText.trim()) {
                  e.preventDefault();
                  parseAndStageItems(itemText);
                }
              }}
              placeholder='e.g. "Milk 50, Bread 30"'
              className="h-10 sm:h-11 flex-1 rounded-lg border bg-background px-2 sm:px-3 text-xs sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => parseAndStageItems(itemText)}
              className="inline-flex h-10 sm:h-11 items-center justify-center rounded-lg bg-primary px-2 sm:px-4 text-xs sm:text-sm font-semibold text-primary-foreground hover:opacity-90 whitespace-nowrap"
            >
              Add
            </button>
            <button
              type="button"
              onClick={toggleItemsMic}
              disabled={!supportsMic}
              title={supportsMic ? "Speak item names and prices" : "Mic not supported"}
              className={`inline-flex h-10 sm:h-11 w-10 sm:w-11 items-center justify-center rounded-lg border transition ${listeningItems ? "border-primary bg-primary text-primary-foreground animate-pulse" : "hover:bg-secondary"} disabled:opacity-40`}
            >
              <MicIcon />
            </button>
          </div>
          {listeningItems && <p className="text-xs text-primary">Listening… speak items and prices in English or Hindi.</p>}
          {items.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Item</th>
                    <th className="px-4 py-2.5 text-right">Price</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-2">
                        <input
                          value={item.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setItems((prev) => prev.map((it, i) => i === idx ? { ...it, name } : it));
                          }}
                          className="w-full bg-transparent text-sm outline-none"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.price}
                          onChange={(e) => {
                            const price = Number(e.target.value);
                            setItems((prev) => prev.map((it, i) => i === idx ? { ...it, price } : it));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                          className="w-24 bg-transparent text-right text-sm outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="text-xs text-muted-foreground hover:text-primary">×</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-secondary/60">
                    <td className="px-4 py-2.5 font-semibold">Total</td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary">{fmt(itemsTotal)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="h-10 sm:h-11 flex-1 rounded-lg border bg-background px-2 sm:px-3 text-xs sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={toggleDescriptionMic}
              disabled={!supportsMic}
              title={supportsMic ? "Dictate description" : "Mic not supported"}
              className={`inline-flex h-10 sm:h-11 w-10 sm:w-11 items-center justify-center rounded-lg border transition ${listeningDescription ? "border-primary bg-primary text-primary-foreground animate-pulse" : "hover:bg-secondary"} disabled:opacity-40`}
            >
              <MicIcon />
            </button>
          </div>
          {listeningDescription && <p className="text-xs text-primary">Listening… speak a description in English or Hindi.</p>}
        </div>
        <p className="text-xs text-muted-foreground">Date and time are recorded automatically.</p>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border px-5 text-sm font-medium hover:bg-secondary w-full sm:w-auto">Cancel</button>
          <button disabled={submit.isPending} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 w-full sm:w-auto">Save</button>
        </div>
      </form>
    </Modal>
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
