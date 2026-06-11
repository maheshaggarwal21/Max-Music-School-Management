// Typed API client for the operator panel.
// - Auth is httpOnly cookies only (credentials: "include") — never browser storage.
// - Base URL comes exclusively from NEXT_PUBLIC_API_URL — NEVER hardcode a domain.
// - When NEXT_PUBLIC_API_URL is empty/unset, the panel runs in MOCK MODE:
//   pages use mockable(realCall, mockData) and get the mock with simulated latency.
// - PROXY MODE (NEXT_PUBLIC_API_PROXY="1"): requests go to the panel's OWN origin
//   ("" base ⇒ relative URLs) and next.config rewrites proxy /api/* to the backend.
//   This makes the auth cookie strictly first-party/same-origin — the reliable way
//   to run panel + API on different localhost ports without cross-site cookie loss.

const PROXY = process.env.NEXT_PUBLIC_API_PROXY === "1";
const BASE_URL = PROXY ? "" : (process.env.NEXT_PUBLIC_API_URL ?? "");

/** True when no API origin is configured AND not proxying ⇒ all data from mocks. */
export const MOCKS_ENABLED = !PROXY && !process.env.NEXT_PUBLIC_API_URL;

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
