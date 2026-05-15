import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { creditsService, customersService } from "@/services/db";
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

  const customer = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => customersService.get(customerId),
  });
  const entries = useQuery({
    queryKey: ["credits-by-customer", customerId],
    queryFn: () => creditsService.listByCustomer(customerId),
  });

  const total = (entries.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);

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

  if (customer.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!customer.data) return <p className="text-sm text-muted-foreground">Customer not found.</p>;

  const c = customer.data;

  return (
    <div>
      <Link to="/customers" className="mb-4 inline-block text-xs text-muted-foreground hover:text-primary">← All customers</Link>

      <Header
        title={c.name}
        sub={[c.phone, c.email].filter(Boolean).join(" · ") || "Customer profile"}
        action={
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {showAdd ? "Close" : "+ Add entry"}
          </button>
        }
      />

      {showAdd && <QuickAddPanel onSubmit={(items) => save.mutate(items)} pending={save.isPending} />}

      <div className="mt-8 overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between bg-secondary px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Credit history</span>
          <span>Total: <span className="text-foreground">{fmt(total)}</span></span>
        </div>
        {entries.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : entries.data?.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No entries yet. Add the first one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-5 py-3">Item</th>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {entries.data!.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-5 py-3 font-medium">{e.description ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-semibold">{fmt(Number(e.amount))}</td>
                </tr>
              ))}
              <tr className="border-t bg-secondary/60">
                <td className="px-5 py-3 font-semibold">Total</td>
                <td></td>
                <td className="px-5 py-3 text-right font-bold text-primary">{fmt(total)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function QuickAddPanel({ onSubmit, pending }: { onSubmit: (items: ParsedItem[]) => void; pending: boolean }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [listening, setListening] = useState(false);
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
          <div className="flex justify-end gap-2 border-t bg-background p-3">
            <button onClick={() => setItems([])} className="h-9 rounded-full border px-4 text-xs font-medium hover:bg-secondary">
              Clear
            </button>
            <button
              disabled={pending || items.length === 0}
              onClick={() => onSubmit(items)}
              className="h-9 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
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
