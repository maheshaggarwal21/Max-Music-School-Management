import Link from "next/link";

// Neutral 404 (WHITE-LABEL: no platform identity). The panel moved under
// /<slug>/admin/* — this catches stale bookmarks from the old flat URLs
// (/dashboard, /settings, /suitable-days, …) and points at the new format.
export default function NotFound() {
  const mock = !process.env.NEXT_PUBLIC_API_URL;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl font-bold">404</p>
      <p className="text-sm text-muted-foreground">
        This page doesn&apos;t exist. Admin pages now live at{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          /your-school/admin/…
        </code>{" "}
        — update any old bookmarks.
      </p>
      {mock && (
        <Link
          href="/sunrise-school-of-music/admin/dashboard"
          className="rounded-full bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
        >
          Open the demo dashboard
        </Link>
      )}
    </main>
  );
}
