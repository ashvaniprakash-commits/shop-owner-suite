import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
  head: () => ({ meta: [{ title: "Reset password — Ledger" }] }),
});

function ForgotPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  return <AuthShell title="Reset your password">
    {sent ? (
      <div className="rounded-lg border bg-secondary p-6 text-sm">
        We sent a reset link to <strong>{email}</strong>. Open it on this device to set a new password.
      </div>
    ) : (
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <button disabled={loading} className="h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <div className="text-center text-sm">
          <Link to="/login" className="hover:underline">Back to log in</Link>
        </div>
      </form>
    )}
  </AuthShell>;
}
