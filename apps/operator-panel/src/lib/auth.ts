"use client";
// Operator session helper — httpOnly cookies only (credentials: "include");
// never browser storage. 401s are redirected to /login by the api client.

import { useEffect, useState } from "react";
import { api, mockable } from "./api";
import { mockMe } from "./mocks";
import type { ApiResponse, OperatorProfile } from "./types";

export function useOperatorSession() {
  const [operator, setOperator] = useState<OperatorProfile | null>(null);

  useEffect(() => {
    let alive = true;
    mockable(
      () => api.get<ApiResponse<{ operator: OperatorProfile }>>("/api/auth/operator/me"),
      mockMe()
    )
      .then((res) => {
        if (alive && res.data) setOperator(res.data.operator);
      })
      .catch(() => {
        /* api client already redirects on 401 */
      });
    return () => {
      alive = false;
    };
  }, []);

  return operator;
}
