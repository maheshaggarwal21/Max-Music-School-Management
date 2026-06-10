import { redirect } from "next/navigation";

// Dev-only root (/). In production nginx routes only /<slug>/admin/* to this
// app, so this is never reached; institution entry is /<slug>/admin.
// In mock mode (no API configured) we land on the demo school so localhost
// always opens something useful.
export default function Home() {
  if (!process.env.NEXT_PUBLIC_API_URL) {
    redirect("/sunrise-school-of-music/admin/dashboard");
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">
        Open your school&apos;s admin panel at{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          /your-school/admin
        </code>
      </p>
    </main>
  );
}
