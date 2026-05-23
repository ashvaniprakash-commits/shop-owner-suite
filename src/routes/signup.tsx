import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Sign up — Ledger" }] }),
});

function SignupPage() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
    nav({ to: "/dashboard" });
  };

  return <AuthShell title="Create your shop">
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required />
      <p className="text-xs text-muted-foreground">By signing up you get a fully isolated workspace — only you can see your customers, credit, and reports.</p>
      <button disabled={loading} className="h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
        {loading ? "Creating account…" : "Sign up"}
      </button>
      <div className="text-center text-sm">
        Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
      </div>
    </form>
  </AuthShell>;
}
