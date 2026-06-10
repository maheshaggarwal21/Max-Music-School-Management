"use client";
// Live institution filter options. Fetches the real institution list from the
// backend (/api/operator/institutions) so filter dropdowns reflect the database,
// not hardcoded data. Falls back to INSTITUTION_OPTIONS only in mock mode.

import { useEffect, useState } from "react";
import { api, mockable } from "@/lib/api";
import { INSTITUTION_OPTIONS, mockInstitutionList } from "@/lib/mocks";
import type { ApiResponse, InstitutionListItem, Paginated } from "@/lib/types";

export type InstitutionOption = { value: string; label: string };

export function useInstitutionOptions(): InstitutionOption[] {
  const [options, setOptions] = useState<InstitutionOption[]>(INSTITUTION_OPTIONS);

  useEffect(() => {
    let alive = true;
    mockable(
      () =>
        api.get<ApiResponse<Paginated<InstitutionListItem>>>(
          "/api/operator/institutions?limit=100"
        ),
      mockInstitutionList({ page: 1, limit: 100, search: "", mode: "all", status: "all" })
    )
      .then((res) => {
        if (!alive || !res.data) return;
        setOptions(res.data.items.map((i) => ({ value: i._id, label: i.name })));
      })
      .catch(() => {
        /* keep the fallback options on error */
      });
    return () => {
      alive = false;
    };
  }, []);

  return options;
}
