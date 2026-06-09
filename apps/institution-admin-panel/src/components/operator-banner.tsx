"use client";
import { useEffect, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@maxmusic/ui";

/**
 * P2-07 UI shell — Operator-view banner.
 *
 * MOCK MODE (current): the operator panel sets a shared-host cookie before
 * opening this panel in a new tab —
 *   name:  `mm_impersonate`
 *   value: encodeURIComponent(`${slug}|${institutionName}`)
 *   path=/ , session cookie
 * We sniff that cookie after mount and show the banner only when it exists.
 *
 * PRODUCTION (swap at Handoff H5): this is driven by the god-token session —
 * /api/inst/:slug/auth returns the admin session with `impersonatedBy` set
 * when the superadmin acts via the short-lived operator-issued token. The
 * banner then renders from that session field; cookie sniffing is only the
 * mock-mode stand-in and is removed wholesale at H5.
 *
 * WHITE-LABEL: only the word "Operator" appears here — never the operator's
 * own brand. The banner is invisible to institution admins (no cookie).
 */

const COOKIE_NAME = "mm_impersonate";

interface OperatorImpersonation {
  slug: string;
  institutionName: string;
}

function readImpersonationCookie(): OperatorImpersonation | null {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    // Slug is URL-safe (never contains "|"), so the first pipe is the divider.
    const divider = decoded.indexOf("|");
    if (divider <= 0 || divider === decoded.length - 1) return null;
    return {
      slug: decoded.slice(0, divider),
      institutionName: decoded.slice(divider + 1),
    };
  } catch {
    return null; // malformed cookie — treat as no impersonation
  }
}

export function OperatorBanner() {
  const [info, setInfo] = useState<OperatorImpersonation | null>(null);

  // Mount-gate: document.cookie only exists on the client, so the server HTML
  // and the very first client render both produce `null` → nothing. The cookie
  // is read in an effect (post-mount), which guarantees zero hydration
  // mismatch — the banner slides in only after React has taken over.
  useEffect(() => {
    setInfo(readImpersonationCookie());
  }, []);

  if (!info) return null;

  const handleExit = () => {
    // Clear the mock impersonation cookie on the shared host.
    document.cookie = "mm_impersonate=; path=/; max-age=0";
    // The operator panel navigates here in the SAME tab, so exiting returns
    // to it the same way. The operator session lives in its own cookie and
    // is untouched by this navigation. URL via env, dev-port fallback —
    // mirrors openInstitutionAdminPanel() in the operator panel.
    const base =
      process.env.NEXT_PUBLIC_OPERATOR_PANEL_URL ||
      `${window.location.protocol}//${window.location.hostname}:3010`;
    window.location.assign(`${base}/institutions`);
  };

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      role="status"
      aria-label="Operator session active"
      className="relative z-50 flex h-10 w-full shrink-0 items-center gap-2.5 border-b border-violet-500/30 bg-violet-500/10 px-4 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
    >
      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 truncate text-xs font-medium">
        Operator session — full access to{" "}
        <span className="font-semibold">{info.institutionName}</span>
        <span className="ml-2 hidden font-normal text-violet-600/70 dark:text-violet-300/60 sm:inline">
          All actions are audited.
        </span>
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExit}
        className="ml-auto h-7 min-h-0 shrink-0 gap-1.5 px-2.5 text-xs font-medium text-violet-600 hover:bg-violet-500/15 hover:text-violet-700 dark:text-violet-300 dark:hover:bg-violet-500/20 dark:hover:text-violet-200"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        Exit operator view
      </Button>
    </motion.div>
  );
}
