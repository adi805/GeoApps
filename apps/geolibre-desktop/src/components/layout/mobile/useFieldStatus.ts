import { useEffect, useState } from "react";
import { watchPosition } from "../../../lib/geolocation";

/** What the field status strip reports about the device right now. */
export interface FieldStatus {
  /** Horizontal accuracy of the last GPS fix in metres, or null before a fix. */
  accuracyM: number | null;
  /** True when the browser reports no network connection. */
  offline: boolean;
  /** Free space available to the origin in bytes, or null when unknown. */
  freeBytes: number | null;
}

const STORAGE_REFRESH_MS = 30_000;

/**
 * Collect the three field signals the strip shows: GPS accuracy, offline state,
 * and free storage.
 *
 * Why a fresh watch instead of reading the tracking dialog's state: that state
 * lives inside `GpsTrackingDialog` and only exists while a recording is open,
 * so a standing strip would have nothing to show. This is a read-only consumer
 * of `lib/geolocation` — it does not touch the tracking logic, and it stops
 * watching the moment the strip unmounts.
 *
 * Args:
 *   enabled: False while the strip is hidden, so a hidden strip holds no watch.
 *
 * Returns:
 *   The current field signals; every field degrades to null/offline on failure.
 */
export function useFieldStatus(enabled: boolean): FieldStatus {
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [offline, setOffline] = useState(() =>
    typeof navigator === "undefined" ? false : navigator.onLine === false,
  );
  const [freeBytes, setFreeBytes] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
      void navigator.storage
        .estimate()
        .then((estimate) => {
          if (cancelled) return;
          const quota = estimate.quota ?? null;
          const usage = estimate.usage ?? 0;
          setFreeBytes(quota === null ? null : Math.max(0, quota - usage));
        })
        .catch(() => {
          if (!cancelled) setFreeBytes(null);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, STORAGE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAccuracyM(null);
      return;
    }
    let stop: (() => void) | null = null;
    let cancelled = false;
    void watchPosition(
      (position) => {
        if (!cancelled) setAccuracyM(position.coords.accuracy);
      },
      () => {
        if (!cancelled) setAccuracyM(null);
      },
    )
      .then((unsubscribe) => {
        if (cancelled) unsubscribe();
        else stop = unsubscribe;
      })
      .catch(() => {
        if (!cancelled) setAccuracyM(null);
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled]);

  return { accuracyM, offline, freeBytes };
}

/**
 * Format a byte count the way a phone's storage screen does: one decimal for
 * gigabytes, whole numbers below that.
 *
 * Args:
 *   bytes: Free space in bytes, or null when unknown.
 *
 * Returns:
 *   A short label such as "2.1 GB", or an em dash when unknown.
 */
export function formatFreeSpace(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "—";
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Format a GPS accuracy radius for the strip.
 *
 * Args:
 *   accuracyM: Accuracy in metres, or null before a fix.
 *
 * Returns:
 *   A label such as "+-4 m", or an em dash before the first fix.
 */
export function formatAccuracyShort(accuracyM: number | null): string {
  if (accuracyM === null || !Number.isFinite(accuracyM) || accuracyM < 0) return "—";
  if (accuracyM < 10) return `±${accuracyM.toFixed(1)} m`;
  return `±${Math.round(accuracyM)} m`;
}
