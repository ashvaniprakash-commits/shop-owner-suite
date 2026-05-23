import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
  head: () => ({ meta: [{ title: "New password — Ledger" }] }),
});

function ResetPage() {
  const { updatePassword } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    nav({ to: "/dashboard" });
  };

  return <AuthShell title="Choose a new password">
    <form onSubmit={submit} className="space-y-4">
      <Field label="New password" type="password" value={password} onChange={setPassword} required />
      <button disabled={loading} className="h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  </AuthShell>;
}
