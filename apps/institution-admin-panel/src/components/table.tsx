"use client";
// LOCAL WORKAROUND (packages/ui is read-only for Dev B's institution scope):
// @maxmusic/ui DataTable constrains T to Record<string, unknown>, which
// interface-based contract types (PaymentRow, StudentRow, …) do not satisfy —
// interfaces have no implicit index signature. This thin wrapper keeps pages
// fully typed and funnels through the shared component unchanged.
// → Reported: relax the constraint to `T extends object` in packages/ui.
import {
  DataTable as UIDataTable,
  type DataTableColumn,
  type DataTablePagination,
} from "@maxmusic/ui";

export type { DataTableColumn, DataTablePagination };

export interface TableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: DataTablePagination;
  onRowClick?: (row: T) => void;
  onSort?: (key: string) => void;
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({ columns, data, onRowClick, ...rest }: TableProps<T>) {
  return (
    <UIDataTable
      {...rest}
      columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
      data={data as unknown as Record<string, unknown>[]}
      onRowClick={
        onRowClick as unknown as ((row: Record<string, unknown>) => void) | undefined
      }
    />
  );
}
