"use client";
// Confirm dialog on top of the shared Modal — supports danger styling and
// an optional extra field (e.g. payment reference) via children.

import { useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { Button, Modal } from "@maxmusic/ui";

export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={
        <span className="inline-flex items-center gap-2">
          {danger ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-brand" />
          )}
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "destructive" : "brand"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </div>
    </Modal>
  );
}
