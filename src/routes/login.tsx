import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Log in — Ledger" }] }),
});

function LoginPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    nav({ to: "/dashboard" });
  };

  return <AuthShell title="Log in to your shop">
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required />
      <button disabled={loading} className="h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
        {loading ? "Signing in…" : "Log in"}
      </button>
      <div className="flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">Forgot password?</Link>
        <Link to="/signup" className="hover:underline">Create account</Link>
      </div>
    </form>
  </AuthShell>;
}

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-20 max-w-6xl items-center px-6">
          <Link to="/" className="text-xl font-bold"><span className="text-primary">●</span> Ledger</Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col px-6 py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Field({ label, type = "text", value, onChange, required }: { label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-lg border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
