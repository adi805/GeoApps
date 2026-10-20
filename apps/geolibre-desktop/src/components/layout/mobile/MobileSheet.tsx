import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@geolibre/ui";

/**
 * Resting height of a sheet, as a share of the viewport.
 *
 * The brief caps how much chrome may sit over the map at 25% of the screen
 * height. `peek` is that ceiling and is the height a sheet opens at, so opening
 * a panel never swallows the map. `half` exists because a layer list with a few
 * dozen entries is unusable in 211 px on a phone: the user can drag up to it
 * deliberately, and drag back down.
 */
const SNAP_PEEK_VH = 25;
const SNAP_HALF_VH = 55;

/** Drag distance, in px, past which a release changes snap point. */
const DRAG_THRESHOLD_PX = 60;

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
}

/**
 * Bottom sheet used in place of a desktop side panel.
 *
 * Why a sheet and not the stacked side panel the narrow layout used to produce:
 * `flex-col` on a phone put the Layers panel ABOVE the map, so the map was
 * pushed off-screen and the panel could not be dismissed. A sheet overlays the
 * map, keeps the map visible at its resting height, and closes with a drag or
 * the handle's button.
 *
 * Args:
 *   open: Whether the sheet is showing.
 *   onClose: Called on backdrop tap, drag-down, or the close control.
 *   title: Heading text, also the accessible name.
 *   children: Sheet body.
 *   testId: Optional `data-testid` for the sheet surface.
 */
export function MobileSheet({ open, onClose, title, children, testId }: MobileSheetProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const dragStart = useRef<number | null>(null);

  // A fresh open always starts at the resting height, so the map is never
  // hidden by a height the user picked for a previous panel.
  useEffect(() => {
    if (open) {
      setExpanded(false);
      setDragPx(0);
    }
  }, [open]);

  const heightVh = (expanded ? SNAP_HALF_VH : SNAP_PEEK_VH) + (dragPx / window.innerHeight) * 100;

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    setDragPx(event.clientY - dragStart.current);
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragStart.current === null) return;
      const delta = event.clientY - dragStart.current;
      dragStart.current = null;
      setDragPx(0);
      if (delta > DRAG_THRESHOLD_PX) {
        if (expanded) setExpanded(false);
        else onClose();
        return;
      }
      if (delta < -DRAG_THRESHOLD_PX && !expanded) setExpanded(true);
    },
    [expanded, onClose],
  );

  if (!open) return null;

  return (
    <div
      data-testid={testId ?? "mobile-sheet"}
      role="dialog"
      aria-label={title}
      className={cn(
        "absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-xl border-t bg-background shadow-2xl",
      )}
      style={{ height: `${Math.max(15, Math.min(85, heightVh))}vh` }}
    >
      <div
        className="flex shrink-0 touch-none items-center gap-2 border-b px-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span aria-hidden="true" className="mx-auto my-1.5 h-1 w-10 rounded-full bg-muted-foreground/40" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", "Tutup")}
          className="ms-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}
