"use client";
import * as React from "react";
import { useState } from "react";
import { cn } from "@maxmusic/ui/lib/utils";

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = !!src && !errored;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-brand/10 font-semibold text-brand",
        sizes[size],
        className
      )}
      title={name}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
