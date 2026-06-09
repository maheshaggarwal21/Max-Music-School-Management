"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Modal } from "@maxmusic/ui";

/**
 * Confirmation dialog on top of the shared <Modal> (AnimatePresence inside).
 * Children render extra form fields between the message and the footer.
 */
export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
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
      onClose={onClose}
      title={title}
      subtitle={message}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "brand"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
