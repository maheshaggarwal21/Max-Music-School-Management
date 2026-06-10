"use client";
// Socket.io client hook for institution panels.
//
// Why a dedicated token instead of the panel cookie:
// The inst_teacher_token cookie is httpOnly + path-scoped to /api/inst/:slug,
// so the browser never sends it to /socket.io. We call the authenticated REST
// endpoint to mint a 2-minute socket-only token, then hand it to the Socket.io
// handshake. The room is derived from the VERIFIED token server-side — never
// from client input.

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { api, teacherPath } from "./api";
import type { ApiResponse } from "./types";

type Status = "idle" | "connecting" | "connected" | "error";

interface UseSocketOptions {
  /** Skip connecting entirely (e.g. mock mode when NEXT_PUBLIC_API_URL is unset). */
  enabled?: boolean;
}

interface UseSocketReturn {
  status: Status;
  /** Subscribe to a Socket.io event; returns an unsubscribe function. */
  on: <T = unknown>(event: string, handler: (data: T) => void) => () => void;
}

const SOCKET_URL =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL ?? ""
    : "";

export function useSocket({ enabled = true }: UseSocketOptions = {}): UseSocketReturn {
  const [status, setStatus] = useState<Status>("idle");
  const socketRef = useRef<Socket | null>(null);
  // Listeners registered before the socket is ready are queued and replayed.
  const pendingRef = useRef<Array<[string, (d: unknown) => void]>>([]);

  useEffect(() => {
    if (!enabled || !SOCKET_URL) return;

    let cancelled = false;
    let socket: Socket | null = null;

    setStatus("connecting");

    // 1. Mint a short-lived socket token via the authenticated REST endpoint.
    api
      .get<ApiResponse<{ token: string }>>(teacherPath("/realtime-token"))
      .then(({ data }) => {
        if (cancelled || !data?.token) return;

        // 2. Connect to the Socket.io server on the API origin.
        socket = io(SOCKET_URL, {
          auth: { token: data.token },
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        // Replay any listeners that were registered before the socket existed.
        for (const [event, handler] of pendingRef.current) {
          socket.on(event, handler);
        }
        pendingRef.current = [];

        socket.on("connect", () => setStatus("connected"));
        socket.on("connect_error", () => setStatus("error"));
        socket.on("disconnect", () => setStatus("idle"));
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      setStatus("idle");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const on = useCallback(
    <T = unknown>(event: string, handler: (data: T) => void): (() => void) => {
      const s = socketRef.current;
      if (s) {
        s.on(event, handler as (d: unknown) => void);
        return () => s.off(event, handler as (d: unknown) => void);
      }
      // Socket not yet ready — queue for replay once connected.
      const entry: [string, (d: unknown) => void] = [event, handler as (d: unknown) => void];
      pendingRef.current.push(entry);
      return () => {
        pendingRef.current = pendingRef.current.filter((e) => e !== entry);
      };
    },
    []
  );

  return { status, on };
}
