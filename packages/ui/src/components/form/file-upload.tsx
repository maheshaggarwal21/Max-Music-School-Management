"use client";
import * as React from "react";
import { useRef, useState } from "react";
import { CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@maxmusic/ui/lib/utils";

export interface PresignedUpload {
  /** Pre-signed S3 PUT url. */
  uploadUrl: string;
  /** Public/final file URL stored on the entity. */
  fileUrl: string;
}

export interface FileUploadProps {
  /**
   * Asks the backend for a pre-signed S3 URL for this file.
   * When omitted (mock mode), upload progress is simulated and a local
   * object URL is returned instead.
   */
  getPresignedUrl?: (file: File) => Promise<PresignedUpload>;
  /** Called with the final uploaded file URL. */
  onUploaded?: (url: string) => void;
  accept?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function FileUpload({
  getPresignedUrl, onUploaded, accept, label, error,
  required, disabled = false, className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const reset = () => {
    setState("idle");
    setProgress(0);
    setFileName(null);
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const simulateUpload = (file: File) =>
    new Promise<string>((resolve) => {
      let pct = 0;
      const tick = window.setInterval(() => {
        pct = Math.min(pct + 8 + Math.random() * 14, 100);
        setProgress(Math.round(pct));
        if (pct >= 100) {
          window.clearInterval(tick);
          resolve(URL.createObjectURL(file));
        }
      }, 120);
    });

  const putWithProgress = (url: string, file: File) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed"));
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    });

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setUploadError(null);
    setProgress(0);
    setState("uploading");
    try {
      let finalUrl: string;
      if (getPresignedUrl) {
        const { uploadUrl, fileUrl } = await getPresignedUrl(file);
        await putWithProgress(uploadUrl, file);
        finalUrl = fileUrl;
      } else {
        finalUrl = await simulateUpload(file);
      }
      setState("done");
      setProgress(100);
      onUploaded?.(finalUrl);
    } catch {
      setState("error");
      setUploadError("Upload failed. Try again.");
    }
  };

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label && (
        <span className="text-xs font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled || state === "uploading"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {state === "idle" && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-input bg-background text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud className="h-5 w-5" />
          <span>Click to upload{accept ? ` (${accept})` : ""}</span>
        </button>
      )}

      {state !== "idle" && (
        <div className="rounded-md border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {state === "uploading" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />}
              {state === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />}
              {state === "error" && <X className="h-4 w-4 shrink-0 text-destructive" />}
              <span className="truncate">{fileName}</span>
            </span>
            <button
              type="button"
              onClick={reset}
              aria-label="Remove file"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-brand transition-all duration-200", state === "error" && "bg-destructive")}
              style={{ width: `${progress}%` }}
            />
          </div>
          {uploadError && <p className="mt-1.5 text-xs text-destructive">{uploadError}</p>}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
