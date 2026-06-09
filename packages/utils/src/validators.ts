/**
 * Indian mobile number: 10 digits starting with 6-9, with an optional
 * +91 / 91 / 0 prefix and optional spaces or dashes between groups.
 *
 *   isValidPhone("9876543210")      → true
 *   isValidPhone("+91 98765 43210") → true
 *   isValidPhone("1234567890")      → false (must start 6-9)
 */
export function isValidPhone(value: string): boolean {
  if (typeof value !== "string") return false;
  const cleaned = value.trim().replace(/[\s-]/g, "");
  return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Pragmatic email validation (single @, no spaces, dot in domain).
 */
export function isValidEmail(value: string): boolean {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * URL-safe kebab-case slug: lowercase alphanumerics separated by single
 * hyphens; no leading/trailing hyphen, no consecutive hyphens.
 *
 *   isValidSlug("abc-music-school") → true
 *   isValidSlug("Abc Music")        → false
 */
export function isValidSlug(value: string): boolean {
  if (typeof value !== "string") return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
