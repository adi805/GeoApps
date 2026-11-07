import { FolderOpen, Layers, Map as MapIcon, Route, Ruler } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@geolibre/ui";

/** The five destinations of the mobile bottom navigation. */
export type MobileTab = "map" | "layers" | "measure" | "track" | "project";

interface MobileTabBarProps {
  activeTab: MobileTab;
  onSelect: (tab: MobileTab) => void;
}

/**
 * Tinggi tab bar HP dalam CSS px, tanpa `env(safe-area-inset-bottom)`.
 *
 * Dipakai `NotificationRegion` untuk menaruh toast di atas tab bar: angka ini
 * yang membuat kedua komponen tidak bisa berbeda pendapat soal di mana tab bar
 * berakhir. Isinya pt-1 (4 px) + tombol min-h-12 (48 px) + pb 4 px = 56 px;
 * perubahannya harus lewat sini, bukan dengan menggeser padding tab bar
 * sendirian, karena toast akan kembali menutupi ikon tab kalau angkanya basi.
 */
export const MOBILE_TAB_BAR_HEIGHT_PX = 56;

/**
 * Order matters: the map is the resting state and sits leftmost, and the two
 * field actions (measure, track) stay inside thumb reach on the right half of a
 * one-handed grip. Every target is at least 48x48 CSS px with an 8 px gutter
 * between neighbours, so a gloved thumb cannot hit two tabs at once.
 */
const TABS: { id: MobileTab; icon: typeof MapIcon; labelKey: string; fallback: string }[] = [
  { id: "map", icon: MapIcon, labelKey: "mobile.tab.map", fallback: "Peta" },
  { id: "layers", icon: Layers, labelKey: "mobile.tab.layers", fallback: "Daftar" },
  { id: "measure", icon: Ruler, labelKey: "mobile.tab.measure", fallback: "Ukur" },
  { id: "track", icon: Route, labelKey: "mobile.tab.track", fallback: "Jejak" },
  { id: "project", icon: FolderOpen, labelKey: "mobile.tab.project", fallback: "Proyek" },
];

/**
 * Bottom navigation for phone-width viewports: five thumb-sized destinations,
 * replacing the desktop toolbar and its nested menus.
 *
 * Args:
 *   activeTab: The destination currently showing.
 *   onSelect: Called when a tab is tapped.
 */
export function MobileTabBar({ activeTab, onSelect }: MobileTabBarProps) {
  const { t } = useTranslation();
  return (
    <nav
      data-testid="mobile-tab-bar"
      aria-label={t("mobile.navLabel", "Navigasi utama")}
      // Angka yang sama dipakai `NotificationRegion` untuk mengangkat toast di
      // atas tab bar, jadi tinggi ini satu sumber, bukan tebakan di dua tempat.
      style={{ minHeight: MOBILE_TAB_BAR_HEIGHT_PX }}
      className="flex shrink-0 items-stretch justify-between gap-2 border-t bg-background px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      {TABS.map(({ id, icon: Icon, labelKey, fallback }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`mobile-tab-${id}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(id)}
            className={cn(
              // 48 px floor in both axes: the smallest target that still works
              // with gloves on.
              "flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[11px] font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{t(labelKey, fallback)}</span>
          </button>
        );
      })}
    </nav>
  );
}
