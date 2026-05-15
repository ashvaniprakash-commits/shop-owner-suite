
-- Helper function for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers select" ON public.customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own customers insert" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own customers update" ON public.customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own customers delete" ON public.customers FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX customers_user_id_idx ON public.customers(user_id);

-- CREDIT ENTRIES
CREATE TABLE public.credit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credits select" ON public.credit_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own credits insert" ON public.credit_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own credits update" ON public.credit_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own credits delete" ON public.credit_entries FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER credit_entries_set_updated_at BEFORE UPDATE ON public.credit_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX credit_entries_user_id_idx ON public.credit_entries(user_id);
CREATE INDEX credit_entries_customer_id_idx ON public.credit_entries(customer_id);

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  credit_entry_id UUID REFERENCES public.credit_entries(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments select" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own payments insert" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own payments update" ON public.payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own payments delete" ON public.payments FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX payments_user_id_idx ON public.payments(user_id);
CREATE INDEX payments_customer_id_idx ON public.payments(customer_id);

-- MONTHLY REPORTS
CREATE TABLE public.monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  total_credit NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_outstanding NUMERIC(12,2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports select" ON public.monthly_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own reports insert" ON public.monthly_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reports update" ON public.monthly_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own reports delete" ON public.monthly_reports FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER monthly_reports_set_updated_at BEFORE UPDATE ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX monthly_reports_user_id_idx ON public.monthly_reports(user_id);

-- Storage bucket for PDF reports (private, scoped per user via folder = user_id)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own reports storage select" ON storage.objects FOR SELECT
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own reports storage insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own reports storage update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own reports storage delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
