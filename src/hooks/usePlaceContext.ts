import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaceContext } from "../lib/placeContext";

type ContextStatus = "idle" | "loading" | "ready" | "empty" | "error";
const contextCache = new Map<string, PlaceContext | null>();

export function usePlaceContext(
  center: [number, number],
  label?: string,
) {
  const key = useMemo(
    () => `${center[0].toFixed(4)},${center[1].toFixed(4)},${label ?? ""}`,
    [center[0], center[1], label],
  );
  const [status, setStatus] = useState<ContextStatus>(
    contextCache.has(key) ? (contextCache.get(key) ? "ready" : "empty") : "idle",
  );
  const [context, setContext] = useState<PlaceContext | null>(
    contextCache.get(key) ?? null,
  );
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    requestController.current?.abort();
    const cached = contextCache.get(key);
    setContext(cached ?? null);
    setStatus(contextCache.has(key) ? (cached ? "ready" : "empty") : "idle");
    return () => requestController.current?.abort();
  }, [key]);

  const load = useCallback(async () => {
    const cached = contextCache.get(key);
    if (contextCache.has(key)) {
      setContext(cached ?? null);
      setStatus(cached ? "ready" : "empty");
      return;
    }
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setStatus("loading");
    try {
      const params = new URLSearchParams({
        lat: String(center[0]),
        lng: String(center[1]),
      });
      if (label) params.set("label", label);
      const response = await fetch(`/api/context?${params}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Context ${response.status}`);
      const body = (await response.json()) as { context: PlaceContext | null };
      contextCache.set(key, body.context);
      setContext(body.context);
      setStatus(body.context ? "ready" : "empty");
    } catch {
      if (controller.signal.aborted) return;
      setStatus("error");
    }
  }, [center, key, label]);

  return { context, status, load };
}
