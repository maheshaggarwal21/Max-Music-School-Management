import type { JoinStatus } from "./constants";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Format an amount stored in paise as Indian rupees with Indian digit grouping.
 *
 *   formatCurrency(600000)   → "₹6,000"
 *   formatCurrency(12345678) → "₹1,23,457"  (rounded to whole rupees)
 *
 * No space after ₹ — a breaking space lets narrow cards wrap the symbol
 * onto its own line.
 */
export function formatCurrency(paise: number): string {
  if (!Number.isFinite(paise)) return "₹0";
  const rupees = Math.round(paise / 100);
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.abs(rupees));
  return `${rupees < 0 ? "-" : ""}₹${formatted}`;
}

/**
 * Format an ISO date string (or Date) as a short en-IN style date.
 *
 *   formatDate("2026-01-12T00:00:00.000Z") → "12 Jan 2026"
 */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format an Indian mobile number for display.
 *
 *   formatPhone("9876543210")    → "+91 98765 43210"
 *   formatPhone("+919876543210") → "+91 98765 43210"
 *
 * Returns the input unchanged when it does not look like an Indian mobile.
 */
export function formatPhone(str: string | null | undefined): string {
  if (!str) return "—";
  const digits = str.replace(/\D/g, "");
  const ten =
    digits.length === 10
      ? digits
      : digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith("0")
          ? digits.slice(1)
          : null;
  if (!ten) return str;
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

const JOIN_STATUS_LABELS: Record<JoinStatus, string> = {
  trial: "Trial",
  active_soon: "Active Soon",
  active: "Active",
  inactive: "Inactive",
};

/**
 * Human-readable label for a student joinStatus.
 *
 *   joinStatusLabel("active_soon") → "Active Soon"
 *
 * Unknown values fall back to Title Case of the raw string.
 */
export function joinStatusLabel(status: string): string {
  if (status in JOIN_STATUS_LABELS) {
    return JOIN_STATUS_LABELS[status as JoinStatus];
  }
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
