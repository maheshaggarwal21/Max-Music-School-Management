// Typed API client for the institution student panel.
// - Auth is httpOnly cookies only (credentials: "include") — NEVER localStorage.
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
        window.location.href = `/${getInstSlug()}/student/login`;
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

// ── Institution slug resolution ──────────────────────────────────────────────
// Deploy URL pattern: https://<PLATFORM_DOMAIN>/<slug>/student — the slug is the
// first path segment. NEXT_PUBLIC_INST_SLUG can pin it explicitly (single-tenant
// preview deploys). NEVER hardcode a domain or slug in source.
export function getInstSlug(): string {
  const fromEnv = process.env.NEXT_PUBLIC_INST_SLUG;
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const seg = window.location.pathname.split("/").filter(Boolean)[0];
    if (seg) return seg;
  }
  return "";
}

/** Build a student-panel API path: /api/inst/:slug/student<ep> */
export const studentPath = (ep: string) => `/api/inst/${getInstSlug()}/student${ep}`;

/** Build a student-auth API path: /api/inst/:slug/auth/student<ep> */
export const studentAuthPath = (ep: string) =>
  `/api/inst/${getInstSlug()}/auth/student${ep}`;
