"use client";
import * as React from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { api, mockable, studentPath } from "@/lib/api";
import { MOCK_ME, type MeResponse } from "@/lib/mocks";
import type { ApiResponse, BrandingPublic, StudentSelf } from "@/lib/types";

interface StudentContextValue {
  student: StudentSelf | null;
  branding: BrandingPublic | null;
  loading: boolean;
}

const StudentContext = createContext<StudentContextValue>({
  student: null,
  branding: null,
  loading: true,
});

export function useStudent(): StudentContextValue {
  return useContext(StudentContext);
}

/**
 * Loads GET /api/inst/:slug/student/me (mockable) once for the authenticated
 * area and exposes { student, branding }. Branding feeds BrandingProvider —
 * the ONLY identity ever rendered on this panel (white-label).
 */
export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () =>
        api.get<ApiResponse<MeResponse>>(studentPath("/me")).then((r) => {
          if (!r.data) throw new Error(r.message);
          return r.data;
        }),
      MOCK_ME
    )
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StudentContext.Provider
      value={{
        student: me?.student ?? null,
        branding: me?.institution ?? null,
        loading,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
}
