import { ChevronUp, HardDrive, MapPin, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatAccuracyShort, formatFreeSpace, useFieldStatus } from "./useFieldStatus";

interface FieldStatusStripProps {
  /** False while the user has hidden the strip; a hidden strip holds no GPS watch. */
  visible: boolean;
  onHide: () => void;
}

/**
 * One-line field readout above the map: GPS accuracy, connection state, and
 * free storage.
 *
 * Design notes from the field problem (standing, one hand, sunlight): the bar is
 * opaque rather than translucent so the values stay legible over a bright map,
 * it never grows past a single row, and its hide control is a full 48x48 target
 * even though the strip itself reads as thin.
 *
 * Args:
 *   visible: Whether the strip is showing.
 *   onHide: Called when the hide control is tapped.
 */
export function FieldStatusStrip({ visible, onHide }: FieldStatusStripProps) {
  const { t } = useTranslation();
  const { accuracyM, offline, freeBytes } = useFieldStatus(visible);
  if (!visible) return null;
  return (
    <div
      data-testid="field-status-strip"
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-3 border-b bg-background px-3 text-xs"
    >
      <span data-testid="field-status-accuracy" className="flex min-h-12 items-center gap-1.5">
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">{t("mobile.status.accuracy", "Akurasi GPS")}</span>
        <span className="font-mono tabular-nums">{formatAccuracyShort(accuracyM)}</span>
      </span>
      <span
        data-testid="field-status-network"
        className="flex min-h-12 items-center gap-1.5"
        data-offline={offline ? "true" : "false"}
      >
        {offline ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <span>{t("mobile.status.offline", "Offline")}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{t("mobile.status.online", "Tersambung")}</span>
        )}
      </span>
      <span data-testid="field-status-storage" className="flex min-h-12 items-center gap-1.5">
        <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">{t("mobile.status.storage", "Sisa penyimpanan")}</span>
        <span className="font-mono tabular-nums">{formatFreeSpace(freeBytes)}</span>
      </span>
      <button
        type="button"
        data-testid="field-status-hide"
        onClick={onHide}
        aria-label={t("mobile.status.hide", "Sembunyikan status lapangan")}
        className="ms-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

interface FieldStatusRevealProps {
  onShow: () => void;
}

/**
 * The way back to a hidden status strip: a 48x48 chip floating at the top-left
 * of the map, inside thumb reach and clear of the bottom navigation.
 *
 * Args:
 *   onShow: Called when the chip is tapped.
 */
export function FieldStatusReveal({ onShow }: FieldStatusRevealProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="field-status-show"
      onClick={onShow}
      aria-label={t("mobile.status.show", "Tampilkan status lapangan")}
      className="absolute start-2 top-2 z-10 flex h-12 w-12 items-center justify-center rounded-md border bg-background/95 shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MapPin className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
