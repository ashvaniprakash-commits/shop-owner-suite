/**
 * Database service layer.
 * All DB access is abstracted here so the underlying provider (Supabase today)
 * can be swapped without touching components/routes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type CreditEntry = Database["public"]["Tables"]["credit_entries"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type MonthlyReport = Database["public"]["Tables"]["monthly_reports"]["Row"];

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/* ---------- CUSTOMERS ---------- */
export const customersService = {
  list: async (): Promise<Customer[]> => {
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  get: async (id: string): Promise<Customer | null> => {
    const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  create: async (input: { name: string; phone?: string; email?: string; address?: string; notes?: string }) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from("customers").insert({ user_id, ...input }).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id: string, patch: Partial<Customer>) => {
    const { data, error } = await supabase.from("customers").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  },
};

/* ---------- CREDIT ENTRIES ---------- */
export const creditsService = {
  list: async (): Promise<(CreditEntry & { customer?: { name: string } | null })[]> => {
    const { data, error } = await supabase
      .from("credit_entries")
      .select("*, customer:customers(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as any;
  },
  listByCustomer: async (customer_id: string): Promise<CreditEntry[]> => {
    const { data, error } = await supabase
      .from("credit_entries")
      .select("*")
      .eq("customer_id", customer_id)
      .order("created_at", { ascending: false });
    const { data, error } = await supabase
      .from("credit_entries")
      .select("*")
      .eq("customer_id", customer_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  createMany: async (customer_id: string, items: { description: string; amount: number }[]) => {
    if (items.length === 0) return [];
    const user_id = await getUserId();
    const rows = items.map((it) => ({ user_id, customer_id, description: it.description, amount: it.amount }));
    const { data, error } = await supabase.from("credit_entries").insert(rows).select();
    if (error) throw error;
    return data ?? [];
  },
  create: async (input: { customer_id: string; amount: number; description?: string; due_date?: string | null; status?: string }) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from("credit_entries").insert({ user_id, ...input }).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id: string, patch: Partial<CreditEntry>) => {
    const { data, error } = await supabase.from("credit_entries").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("credit_entries").delete().eq("id", id);
    if (error) throw error;
  },
};

/* ---------- PAYMENTS ---------- */
export const paymentsService = {
  list: async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*, customer:customers(name)")
      .order("paid_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  create: async (input: { customer_id: string; credit_entry_id?: string | null; amount: number; method?: string; notes?: string }) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from("payments").insert({ user_id, ...input }).select().single();
    if (error) throw error;
    return data;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) throw error;
  },
};

/* ---------- MONTHLY REPORTS ---------- */
export const reportsService = {
  list: async (): Promise<MonthlyReport[]> => {
    const { data, error } = await supabase
      .from("monthly_reports")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  /** Aggregate current month from credits + payments and upsert a report row. */
  generateForMonth: async (month: number, year: number) => {
    const user_id = await getUserId();
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month, 1).toISOString();

    const [{ data: credits }, { data: pays }] = await Promise.all([
      supabase.from("credit_entries").select("amount").gte("created_at", start).lt("created_at", end),
      supabase.from("payments").select("amount").gte("paid_at", start).lt("paid_at", end),
    ]);
    const total_credit = (credits ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const total_paid = (pays ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const total_outstanding = total_credit - total_paid;

    const { data, error } = await supabase
      .from("monthly_reports")
      .upsert(
        { user_id, month, year, total_credit, total_paid, total_outstanding },
        { onConflict: "user_id,month,year" },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
