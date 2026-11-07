/**
 * Menahan shell sampai basemap offline milik proyek selesai dipulihkan.
 *
 * Dipasang di `App`, bukan di `DesktopShell`, karena yang perlu ditahan justru
 * shell-nya: `MapCanvas` membaca `basemapStyleUrl` saat peta dibuat, jadi
 * pemulihan harus selesai sebelum mount pertama. Aturannya ada di
 * `lib/offline-basemap-prewarm.ts` (murni, teruji di Node); berkas ini hanya
 * menjalankan efeknya.
 *
 * Batas waktu dipasang dengan alasan yang sama seperti gerbang startup proyek:
 * IndexedDB di perangkat lambat bisa menggantung, dan shell yang tidak pernah
 * muncul berarti pengguna tidak bisa masuk ke Settings untuk membetulkannya.
 * Sesudah batas itu lewat, shell mount dengan apa pun yang sudah terdaftar.
 */

import { useAppStore } from "@geolibre/core";
import { getOfflineBasemapStyle, OFFLINE_BASEMAP_SENTINEL_PREFIX } from "@geolibre/map";
import { useEffect, useState } from "react";
import { needsOfflineBasemapPrewarm } from "../lib/offline-basemap-prewarm";
import { restoreStartupOfflineBasemap } from "../lib/offline-basemap-startup";

/** Sama dengan gerbang startup proyek; cukup lama untuk baca IndexedDB, cukup
 * pendek untuk tidak terlihat seperti hang. */
const PREWARM_TIMEOUT_MS = 8_000;

/**
 * @param enabled `true` selama peta belum pernah siap (masih startup).
 * @returns `true` selama shell sebaiknya ditahan.
 */
export function useOfflineBasemapPrewarm(enabled: boolean): boolean {
  const styleUrl = useAppStore((state) => state.basemapStyleUrl);
  const [settledStyleUrl, setSettledStyleUrl] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const holding = needsOfflineBasemapPrewarm({
    enabled,
    timedOut,
    settledStyleUrl,
    styleUrl,
    sentinelPrefix: OFFLINE_BASEMAP_SENTINEL_PREFIX,
    isRegistered: (url) => getOfflineBasemapStyle(url) !== null,
  });

  useEffect(() => {
    if (!holding) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      console.warn(
        "[offline-basemap] pemulihan awal melewati batas tunggu; shell dilepas dengan gaya yang ada",
      );
      setTimedOut(true);
    }, PREWARM_TIMEOUT_MS);
    void restoreStartupOfflineBasemap()
      .catch((error: unknown) => {
        // Kegagalan sudah dilaporkan `restoreStartupOfflineBasemap` lewat
        // notify; di sini cukup jejak untuk diagnosis, jangan menahan shell.
        console.warn("[offline-basemap] pemulihan awal gagal", error);
      })
      .finally(() => {
        if (cancelled) return;
        window.clearTimeout(timer);
        setSettledStyleUrl(styleUrl);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [holding, styleUrl]);

  return holding;
}
