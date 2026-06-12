"use client";
// Wide parameterized edit modal — shared by /teachers and /students.
// LEFT (~58%): config-driven 2-column form with uppercase section headings.
// RIGHT (~42%): the live ActivityGraph rail, full height with internal scroll.
// On save: diff vs original → PATCH (page-owned onSave) → one activity event
// per changed field streamed into the rail → modal stays open so the stream
// is visible, table row updates optimistically behind it.
//
// Local wide variant of the shared Modal pattern (AnimatePresence + overlay +
// BorderBeam) because @maxmusic/ui Modal is fixed at max-w-lg and packages/ui
// is read-only for this task.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  BorderBeam,
  Button,
  DatePicker,
  Input,
  Select,
  type SelectOption,
} from "@maxmusic/ui";
import { isValidPhone } from "@maxmusic/utils";
import { ActivityGraph } from "@/components/activity-graph";
import { api, mockable } from "@/lib/api";
import { useOperatorSession } from "@/lib/auth";
import { mockEntityActivity, recordEntityActivity } from "@/lib/mocks";
import type { ApiResponse, AuditLogItem, Paginated } from "@/lib/types";

export type EditFieldType = "text" | "phone" | "currency" | "number" | "select" | "date" | "textarea";

export interface EditField {
  key: string;
  label: string;
  type: EditFieldType;
  options?: SelectOption[]; // for type "select"
  placeholder?: string;
  required?: boolean;
}

export interface EditSection {
  title: string; // rendered uppercase, e.g. "Profile" → PROFILE
  fields: EditField[];
}

export interface EntityEditModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  entityId: string;
  sections: EditSection[];
  /** Canonical units: PAISE for currency, ISO/yyyy-mm-dd for date. */
  initialValues: Record<string, string | number | null>;
  /** Read-only context (chips + helper) rendered under the sections. */
  readOnly?: { title: string; content: React.ReactNode; helper?: string };
  /** GET path for the activity rail when a real API is wired. */
  activityPath: string;
  /** PATCH the entity (canonical units) + update the table row optimistically. Throw to abort. */
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}

type Display = string | null;

function toCanonical(f: EditField, v: Display): unknown {
  switch (f.type) {
    case "currency":
      return v == null || v === "" ? null : Math.round(Number(v) * 100); // rupees → paise
    case "number":
      return v == null || v === "" ? null : Math.round(Number(v));
    case "date":
      return v || null; // yyyy-mm-dd
    case "select":
      return v ?? null;
    default:
      return (v ?? "").trim();
  }
}

function toDisplay(f: EditField, init: string | number | null): Display {
  if (init == null) return f.type === "select" || f.type === "date" ? null : "";
  switch (f.type) {
    case "currency":
      return String(Math.round(Number(init) / 100)); // paise → rupees
    case "date":
      return String(init).slice(0, 10);
    default:
      return String(init);
  }
}

const same = (a: unknown, b: unknown) => (a == null && b == null) || String(a) === String(b);

export function EntityEditModal({
  open,
  onClose,
  title,
  subtitle,
  entityId,
  sections,
  initialValues,
  readOnly,
  activityPath,
  onSave,
}: EntityEditModalProps) {
  const operator = useOperatorSession();
  const allFields = useMemo(() => sections.flatMap((s) => s.fields), [sections]);

  const [values, setValues] = useState<Record<string, Display>>({});
  const [base, setBase] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<AuditLogItem[]>([]);
  const [liveBatch, setLiveBatch] = useState<string[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // (Re)initialize the form when opening a new entity.
  useEffect(() => {
    if (!open) return;
    const v: Record<string, Display> = {};
    const b: Record<string, unknown> = {};
    for (const f of allFields) {
      const init = initialValues[f.key] ?? null;
      v[f.key] = toDisplay(f, init);
      // canonical date base = yyyy-mm-dd so full-ISO initials compare cleanly
      b[f.key] = f.type === "date" ? (init ? String(init).slice(0, 10) : null) : init;
    }
    setValues(v);
    setBase(b);
    setErrors({});
    setLiveBatch([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityId]);

  // Load the entity-scoped activity feed.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setActivityLoading(true);
    mockable(
      // CONTRACT GAP: flag for Dev A — GET /api/operator/changes has no entityId
      // filter; this rail needs entity-scoped history at the operator level
      // (mirror of GET /api/inst/:slug/admin/students/:id/activity).
      () => api.get<ApiResponse<Paginated<AuditLogItem>>>(activityPath),
      mockEntityActivity(entityId)
    )
      .then((res) => {
        if (alive && res.data) setEntries(res.data.items);
      })
      .catch(() => {
        /* the rail is non-blocking — form still works */
      })
      .finally(() => {
        if (alive) setActivityLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, entityId, activityPath]);

  // Escape to close + body scroll lock (parity with the shared Modal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const setValue = useCallback((key: string, v: Display) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSave = async () => {
    // validate
    const errs: Record<string, string> = {};
    for (const f of allFields) {
      const v = values[f.key];
      const canon = toCanonical(f, v);
      if (f.required && (canon == null || canon === ""))
        errs[f.key] = `${f.label} is required`;
      else if (f.type === "phone" && v && !isValidPhone(v))
        errs[f.key] = "Enter a valid Indian mobile number";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Fix the highlighted fields");
      return;
    }

    // diff form vs original → one change per edited field
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    for (const f of allFields) {
      const to = toCanonical(f, values[f.key]);
      const from = base[f.key] ?? null;
      if (!same(from, to)) changes.push({ field: f.key, from, to });
    }
    if (changes.length === 0) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const patch = Object.fromEntries(changes.map((c) => [c.field, c.to]));
      await onSave(patch); // page-owned PATCH + optimistic row update

      // stream the events into the rail — newest lands on top
      const recorded = recordEntityActivity(entityId, changes, {
        name: operator?.name ?? "Operator",
        role: "superadmin",
      });
      const display = [...recorded].reverse(); // newest first
      setEntries((prev) => [...display, ...prev]);
      setLiveBatch(display.map((e) => e._id));
      setBase((prev) => ({ ...prev, ...patch }));
      toast.success("Changes saved");
      // modal intentionally stays open so the live stream is visible
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f: EditField) => {
    const v = values[f.key];
    const err = errors[f.key];
    if (f.type === "select")
      return (
        <Select
          key={f.key}
          label={f.label}
          required={f.required}
          error={err}
          options={f.options ?? []}
          value={v}
          onChange={(nv) => setValue(f.key, nv)}
        />
      );
    if (f.type === "date")
      return (
        <DatePicker
          key={f.key}
          label={f.label}
          required={f.required}
          error={err}
          value={v}
          onChange={(nv) => setValue(f.key, nv)}
        />
      );
    if (f.type === "textarea")
      return (
        <label key={f.key} className="flex w-full flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">{f.label}</span>
          <textarea
            rows={2}
            placeholder={f.placeholder}
            value={v ?? ""}
            onChange={(e) => setValue(f.key, e.target.value)}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
      );
    return (
      <Input
        key={f.key}
        label={f.label}
        required={f.required}
        error={err}
        type={f.type === "currency" || f.type === "number" ? "number" : "text"}
        min={f.type === "currency" || f.type === "number" ? 0 : undefined}
        inputMode={f.type === "phone" ? "tel" : undefined}
        placeholder={f.placeholder}
        value={v ?? ""}
        onChange={(e) => setValue(f.key, e.target.value)}
      />
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => !saving && onClose()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              role="dialog"
              aria-modal="true"
              className="relative flex h-[min(660px,88vh)] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            >
              <BorderBeam size={90} duration={9} />

              {/* LEFT — the edit form */}
              <div className="flex min-w-0 flex-1 flex-col lg:basis-[58%]">
                <div className="shrink-0 border-b border-border px-6 py-5">
                  <h2 className="text-lg font-semibold">{title}</h2>
                  {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                  {sections.map((s) => (
                    <section key={s.title}>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                        {s.title}
                      </h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {s.fields.map(renderField)}
                      </div>
                    </section>
                  ))}

                  {readOnly && (
                    <section className="rounded-lg border border-border/70 bg-muted/30 p-4">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {readOnly.title}
                      </h3>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {readOnly.content}
                      </div>
                      {readOnly.helper && (
                        <p className="mt-2 text-xs text-muted-foreground">{readOnly.helper}</p>
                      )}
                    </section>
                  )}
                </div>

                {/* Sticky footer */}
                <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
                  <Button variant="ghost" onClick={onClose} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="brand" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>

              {/* RIGHT — live activity rail */}
              <aside className="hidden min-h-0 w-[42%] shrink-0 border-l border-border bg-muted/10 lg:flex lg:flex-col">
                <ActivityGraph
                  entries={entries}
                  liveBatch={liveBatch}
                  loading={activityLoading}
                />
              </aside>

              {/* Close */}
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
