"use client";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@maxmusic/ui/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface BaseProps {
  options: SelectOption[];
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
}

export type SelectProps =
  | (BaseProps & { multiple?: false; value: string | null; onChange: (value: string | null) => void })
  | (BaseProps & { multiple: true; value: string[]; onChange: (value: string[]) => void });

/**
 * Controlled select with optional search and multi-select variant.
 * Custom popover implementation (no native <select>) so it matches the
 * design system in both themes.
 */
export function Select(props: SelectProps) {
  const {
    options, label, error, required, placeholder = "Select…",
    searchable = false, disabled = false, className,
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // focus search + reset query when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedValues: string[] = props.multiple
    ? props.value
    : props.value != null
      ? [props.value]
      : [];

  const isSelected = (v: string) => selectedValues.includes(v);

  const toggle = (opt: SelectOption) => {
    if (opt.disabled) return;
    if (props.multiple) {
      const next = isSelected(opt.value)
        ? props.value.filter((v) => v !== opt.value)
        : [...props.value, opt.value];
      props.onChange(next);
    } else {
      props.onChange(opt.value);
      setOpen(false);
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.multiple) props.onChange([]);
    else props.onChange(null);
  };

  const display =
    selectedValues.length === 0
      ? null
      : props.multiple
        ? options.filter((o) => isSelected(o.value)).map((o) => o.label).join(", ")
        : options.find((o) => o.value === props.value)?.label ?? null;

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)} ref={rootRef}>
      {label && (
        <span className="text-xs font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            error && "border-destructive"
          )}
        >
          <span className={cn("truncate text-left", !display && "text-muted-foreground")}>
            {display ?? placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {selectedValues.length > 0 && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                onClick={clear}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {searchable && (
              <div className="relative border-b border-border">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
                  placeholder="Search…"
                  className="h-8 w-full bg-transparent pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}
            <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No options</li>
              ) : (
                filtered.map((opt) => (
                  <li key={opt.value} role="option" aria-selected={isSelected(opt.value)}>
                    <button
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => toggle(opt)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                        isSelected(opt.value) && "bg-brand/10 text-brand"
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected(opt.value) && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
