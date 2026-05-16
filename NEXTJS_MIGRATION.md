# Next.js Migration Guide

Step-by-step guide for porting this **TanStack Start + Vite + Supabase** ledger app to **Next.js 15 (App Router)**. Lovable itself does not support Next.js — perform this migration in a separate repo outside Lovable.

---

## 0. Why this is a port, not a flag-flip

This project uses:
- TanStack Start (Vite-based SSR) — Next.js uses its own runtime/bundler.
- File-based routes in `src/routes/*.tsx` with `createFileRoute`.
- `createServerFn` for type-safe RPC.
- Supabase Auth via a React context + a redirect-based `_authenticated` layout.
- Tailwind v4 via `@import "tailwindcss"` in `src/styles.css`.

Each maps cleanly to Next.js primitives, but file names, conventions, and imports all change.

---

## 1. Scaffold the Next.js project

```bash
npx create-next-app@latest ledger-next \
  --typescript --app --tailwind --src-dir --eslint --no-turbopack
cd ledger-next
npm i @supabase/supabase-js @supabase/ssr @tanstack/react-query sonner zod lucide-react
```

Copy across from the old project:
- `src/components/ui/*` (shadcn — keep as-is)
- `src/lib/utils.ts`, `src/lib/parse-items.ts`, `src/lib/speech.ts`, `src/lib/use-mic.tsx`
- `src/styles.css` → rename to `src/app/globals.css` and import in `src/app/layout.tsx`
- `supabase/migrations/*` (unchanged — same DB)

---

## 2. Environment variables

| Old (Vite)                       | New (Next.js)                       |
| -------------------------------- | ----------------------------------- |
| `VITE_SUPABASE_URL`              | `NEXT_PUBLIC_SUPABASE_URL`          |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | `NEXT_PUBLIC_SUPABASE_ANON_KEY`     |
| `SUPABASE_SERVICE_ROLE_KEY`      | `SUPABASE_SERVICE_ROLE_KEY` (same)  |

Reads `import.meta.env.VITE_X` → `process.env.NEXT_PUBLIC_X` (works in both server and client components).

---

## 3. Supabase clients

Replace `src/integrations/supabase/*` with three thin files using `@supabase/ssr`:

```ts
// src/lib/supabase/client.ts  (browser)
import { createBrowserClient } from "@supabase/ssr";
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

```ts
// src/lib/supabase/server.ts  (RSC / route handlers / server actions)
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
export async function getSupabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll: () => store.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => store.set(name, value, options)),
    }},
  );
}
```

```ts
// src/lib/supabase/admin.ts  (service role — server only)
import { createClient } from "@supabase/supabase-js";
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
```

---

## 4. Route mapping

TanStack uses flat dot-separated route files. Next.js App Router uses folders + `page.tsx`/`layout.tsx`. Dynamic segments `$param` become `[param]`.

| Current file                                            | Next.js path                                            |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `src/routes/__root.tsx`                                 | `src/app/layout.tsx`                                    |
| `src/routes/index.tsx` (redirect to `/dashboard`)       | `src/app/page.tsx` (redirect)                           |
| `src/routes/login.tsx`                                  | `src/app/login/page.tsx`                                |
| `src/routes/signup.tsx`                                 | `src/app/signup/page.tsx`                               |
| `src/routes/forgot-password.tsx`                        | `src/app/forgot-password/page.tsx`                      |
| `src/routes/reset-password.tsx`                         | `src/app/reset-password/page.tsx`                       |
| `src/routes/_authenticated.tsx` (layout)                | `src/app/(app)/layout.tsx` (route group)                |
| `src/routes/_authenticated/dashboard.tsx`               | `src/app/(app)/dashboard/page.tsx`                      |
| `src/routes/_authenticated/customers.tsx`               | `src/app/(app)/customers/page.tsx`                      |
| `src/routes/_authenticated/customers.$customerId.tsx`   | `src/app/(app)/customers/[customerId]/page.tsx`         |
| `src/routes/_authenticated/credits.tsx`                 | `src/app/(app)/credits/page.tsx`                        |
| `src/routes/_authenticated/payments.tsx`                | `src/app/(app)/payments/page.tsx`                       |
| `src/routes/_authenticated/reports.tsx`                 | `src/app/(app)/reports/page.tsx`                        |

Replace all imports:

| TanStack                                                   | Next.js                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `import { Link } from "@tanstack/react-router"`            | `import Link from "next/link"`                     |
| `<Link to="/x" params={{ id }}>`                           | `<Link href={`/x/${id}`}>`                         |
| `useNavigate() → nav({ to: "/x" })`                        | `useRouter().push("/x")` from `next/navigation`   |
| `useLocation().pathname`                                   | `usePathname()` from `next/navigation`             |
| `Route.useParams()`                                        | `useParams()` from `next/navigation`               |
| `createFileRoute("/x")({ head: () => ({ meta: [...] }) })` | `export const metadata = { title, description }`   |

Each page that uses React state / event handlers / mic recording must start with `"use client"`.

---

## 5. Auth: replace `_authenticated.tsx` with middleware + a layout

Old: client-side guard that calls `nav({ to: "/login" })` if no session.

New: edge middleware checks the session cookie before render.

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    }},
  );
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthPage = ["/login", "/signup", "/forgot-password", "/reset-password"].includes(req.nextUrl.pathname);
  if (!user && !isAuthPage) return NextResponse.redirect(new URL("/login", req.url));
  if (user && isAuthPage) return NextResponse.redirect(new URL("/dashboard", req.url));
  return res;
}

export const config = { matcher: ["/((?!_next|api/public|.*\\..*).*)"] };
```

`src/lib/auth.tsx` (the React context with `signIn / signUp / signOut`) ports unchanged — just point it at the new browser client. Wrap it in `src/app/layout.tsx`.

Password reset flow stays identical: `resetPasswordForEmail` from the client, plus a `/reset-password` page that calls `supabase.auth.updateUser({ password })` after detecting `type=recovery` in the URL hash.

---

## 6. Server functions → Server Actions

Replace `createServerFn` with **Server Actions** (`"use server"` files). They are Next.js's typed RPC equivalent.

Old:
```ts
// src/lib/customers.functions.ts
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("customers").select("*");
    return data;
  });
```

New:
```ts
// src/lib/customers.actions.ts
"use server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function listCustomers() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data, error } = await supabase.from("customers").select("*").order("name");
  if (error) throw error;
  return data;
}
```

Call from a client component the same way you call any async function:
```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { listCustomers } from "@/lib/customers.actions";
const { data } = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
```

For inputs, validate with `zod` at the top of the action:
```ts
const Input = z.object({ name: z.string().min(1) });
export async function createCustomer(raw: unknown) {
  const input = Input.parse(raw);
  // ...
}
```

Tip: keep the existing `src/services/db.ts` shape — just rewrite each method to call a server action instead of hitting Supabase directly from the browser. The UI components don't need to change.

---

## 7. Webhooks / public APIs

Old `src/routes/api/public/*` (TanStack server routes) →
Next.js Route Handlers at `src/app/api/public/<name>/route.ts`:

```ts
// src/app/api/public/webhook/route.ts
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

export async function POST(req: Request) {
  const sig = req.headers.get("x-webhook-signature") ?? "";
  const body = await req.text();
  const expected = createHmac("sha256", process.env.WEBHOOK_SECRET!).update(body).digest("hex");
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  // ... handle payload
  return NextResponse.json({ ok: true });
}
```

---

## 8. React Query setup

```tsx
// src/app/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>{children}<Toaster /></AuthProvider>
    </QueryClientProvider>
  );
}
```

Mount in `src/app/layout.tsx`:
```tsx
import "./globals.css";
import { Providers } from "./providers";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
```

---

## 9. Tailwind v4

If the new scaffold installs Tailwind v3, upgrade to v4:
```bash
npm i -D tailwindcss@next @tailwindcss/postcss@next
```
Then `globals.css`:
```css
@import "tailwindcss";
/* paste the @theme / :root tokens from the old src/styles.css */
```
No `tailwind.config.js` needed for v4.

---

## 10. Things that just work (no changes)

- shadcn components in `src/components/ui/*`
- `parse-items.ts`, `speech.ts`, `use-mic.tsx` (pure browser code)
- SQL migrations, RLS policies, Supabase schema
- Currency formatting helper (`fmt`)

---

## 11. Verification checklist

- [ ] Sign up → land on `/dashboard`
- [ ] Refresh on any `(app)` route stays signed in (cookie session)
- [ ] Log out clears cookies and bounces to `/login`
- [ ] `/customers/[id]` loads via direct URL (deep linking)
- [ ] Mic button works on all inputs (Chrome / Safari)
- [ ] Adding a credit / payment invalidates and refetches lists
- [ ] Forgot password email links to `/reset-password` and updates password
- [ ] Build passes: `next build`

---

## 12. Deployment

- **Vercel** is the no-config path. Set the three Supabase env vars in the project settings.
- For Cloudflare Workers, use `@opennextjs/cloudflare` — most things work but middleware + cookies need their adapter docs.

Database stays on Supabase; only the frontend/runtime moves.
