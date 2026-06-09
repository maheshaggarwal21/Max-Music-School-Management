"use client";
// Local workaround: @maxmusic/ui DataTable is constrained to
// `T extends Record<string, unknown>`, which rejects interface row types
// (interfaces have no implicit index signature in TS). This wrapper relaxes
// the generic at one single cast site and keeps call sites fully typed.
// Reported to Dev B/UI backlog: loosen the constraint to `T extends object`.

import {
  DataTable as UiDataTable,
  type DataTableColumn,
  type DataTablePagination,
} from "@maxmusic/ui";

export type { DataTableColumn, DataTablePagination };

export interface TypedDataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: DataTablePagination;
  onRowClick?: (row: T) => void;
  onSort?: (key: string) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>(props: TypedDataTableProps<T>) {
  const Table = UiDataTable as unknown as (p: TypedDataTableProps<T>) => React.ReactElement;
  return <Table {...props} />;
}
