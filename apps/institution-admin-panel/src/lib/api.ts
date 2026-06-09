// Typed API client for the institution admin panel.
// - Auth is httpOnly cookies only (credentials: "include") — never browser storage.
// - Base URL comes exclusively from NEXT_PUBLIC_API_URL — NEVER hardcode a domain.
// - When NEXT_PUBLIC_API_URL is empty/unset, the panel runs in MOCK MODE:
//   pages use mockable(realCall, mockData) and get the mock with simulated latency.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** True when no API origin is configured ⇒ all data comes from local mocks. */
export const MOCKS_ENABLED = !process.env.NEXT_PUBLIC_API_URL;

/**
 * Resolve `mock` (with simulated latency) when mocks are enabled,
 * otherwise execute the real API call.
 *
 *   const data = await mockable(() => api.get<ApiResponse<X>>("/api/operator/x"), MOCK_X);
 */
export function mockable<T>(
  realCall: () => Promise<T>,
  mock: T,
  delayMs = 350
): Promise<T> {
  if (MOCKS_ENABLED) {
    return new Promise<T>((resolve) => {
      setTimeout(() => resolve(mock), delayMs);
    });
  }
  return realCall();
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include", // sends httpOnly cookie — always required
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        window.location.href = "/login";
      }
      let message = "API error";
      try {
        message = (await res.json()).message || message;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(message);
    }
    return res.json();
  }
  get<T>(ep: string) { return this.request<T>(ep); }
  post<T>(ep: string, b: unknown) { return this.request<T>(ep, { method: "POST", body: JSON.stringify(b) }); }
  put<T>(ep: string, b: unknown) { return this.request<T>(ep, { method: "PUT", body: JSON.stringify(b) }); }
  patch<T>(ep: string, b: unknown) { return this.request<T>(ep, { method: "PATCH", body: JSON.stringify(b) }); }
  delete<T>(ep: string) { return this.request<T>(ep, { method: "DELETE" }); }
}

export const api = new ApiClient();

// ── Institution path helpers ──────────────────────────────────────────────────
// In production the panel is served at https://<PLATFORM_DOMAIN>/<slug>/admin,
// so the institution slug is the first path segment. The slug NEVER comes from
// a hardcoded value — and in mock mode (no NEXT_PUBLIC_API_URL) these paths are
// short-circuited by mockable() and never reach the network.
const INTERNAL_ROUTES = new Set([
  "login", "dashboard", "requests", "students", "teachers",
  "batches", "attendance", "payments", "settings",
]);

export function getInstSlug(): string {
  if (typeof window !== "undefined") {
    const first = window.location.pathname.split("/").filter(Boolean)[0];
    if (first && !INTERNAL_ROUTES.has(first)) return first;
  }
  return "_slug_"; // mock mode only — never used for a real request
}

/** /api/inst/:slug/auth/admin/<ep> */
export const authPath = (ep: string) => `/api/inst/${getInstSlug()}/auth/admin${ep}`;
/** /api/inst/:slug/admin/<ep> */
export const adminPath = (ep: string) => `/api/inst/${getInstSlug()}/admin${ep}`;
