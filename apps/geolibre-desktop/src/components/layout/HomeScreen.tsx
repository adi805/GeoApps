import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HardDrive, Layers, Map as MapIcon, Plus, Search } from "lucide-react";
import { cn } from "@geolibre/ui";
import type { RecentProjectEntry } from "@geolibre/core";
import { loadRecentProjects } from "../../hooks/useRecentProjectsPersistence";
import {
  MobileAction,
  MobileBadge,
  MobileCard,
  MobileIconButton,
  MobileListRow,
  MobileNotice,
  MobileProgress,
  MobileScreenBody,
  MobileScreenHeader,
  MobileSearchField,
  MobileSectionHeading,
} from "./mobile/mobilePrimitives";
import { relativeOpenedAt } from "./mobile/relativeTime";

export interface HomeScreenProps {
  /** Fired when the user taps a project — the app shell should mount the viewer. */
  onOpenProject: (entry: RecentProjectEntry) => void;
  /** Fired when the user taps "add map" — shell can open AddData flow. */
  onAddProject?: () => void;
  /**
   * Fired with the map file the user picked straight from "Tambah Peta".
   *
   * Avenza's first action is "import a map": the button opens the OS file
   * picker in the same tap, and the map the user chose is what the viewer
   * shows. When this is provided, "Tambah Peta" opens the picker itself
   * instead of asking the shell to mount an empty viewer first.
   */
  onAddMapFile?: (file: File) => void;
}

type HomeTab = "maps" | "layers";

/** Matches a project on its name or its path, so a typed fragment finds either. */
function matchesQuery(entry: RecentProjectEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    entry.name.toLowerCase().includes(needle) || entry.path.toLowerCase().includes(needle)
  );
}

/**
 * The first screen: My Maps list + 2-tab bottom navigation.
 *
 * The shape is the one the visual composition for issue 102 settled on — a
 * titled bar with a context line and a search action, an uppercase section
 * label over the rows, an icon box and a status badge per row, a storage card,
 * and a pale-green pill behind the active tab — rebuilt on the production
 * `mobilePrimitives` so no product screen imports `src/visual/**`. Issue 118
 * asked for exactly that: the composition already existed, the app still looked
 * like the old screen.
 *
 * Two numbers in the composition are deliberately absent. It shows "3 peta ·
 * 1,7 GB dari 4,2 GB" and "12 lapisan · 2 jam lalu", but a `RecentProjectEntry`
 * carries only `path`, `name`, and `openedAt`: there is no measured size and no
 * layer count to read. So the storage card reports zero with "Belum diukur"
 * instead of a made-up gigabyte figure, the section subtitle says the space is
 * unmeasured, and the row's context line shows only the half the record holds
 * (when it was opened). Measuring storage is a separate proposal, not a number
 * this screen is allowed to invent.
 *
 * The badge is "Lokal" for every row, which is true by construction: the record
 * is a path on this device. "Ubin tertunda" from the composition is not drawn
 * because nothing here knows a tile sync state.
 *
 * Every interactive target clears 48 CSS px. The recent-project row stays a real
 * `<button>` whose accessible name starts with the project name: opening a
 * project must work from the keyboard, and the E2E helpers locate the seeded
 * project by that name.
 *
 * The full GIS shell (DesktopShell) stays mounted as the "viewer" — this
 * component only renders above/behind it at the app-router level.
 */
export function HomeScreen({ onOpenProject, onAddProject, onAddMapFile }: HomeScreenProps) {
  const { t, i18n } = useTranslation();
  const addMapInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<HomeTab>("maps");
  const [recentProjects] = useState<RecentProjectEntry[]>(() => loadRecentProjects());
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visibleProjects = useMemo(
    () => recentProjects.filter((entry) => matchesQuery(entry, query)),
    [recentProjects, query],
  );

  // The empty state carries no context line, matching the composition: the
  // notice below already says "Belum ada peta", and printing it twice a few
  // rows apart reads like a rendering bug.
  const subtitle =
    recentProjects.length === 0
      ? undefined
      : t("home.subtitle", "{{count}} peta · ruang penyimpanan belum diukur", {
          count: recentProjects.length,
        });

  const addAction = onAddProject || onAddMapFile ? (
    <MobileAction
      label={t("home.addMap", "Tambah Peta")}
      icon={<Plus className="h-4 w-4" aria-hidden="true" />}
      testId="home-add-map"
      onClick={() => {
        // The picker opens inside this click, so the browser still counts it as
        // a user gesture. Opening it from an effect after the viewer mounts
        // would be blocked on mobile Safari and Chrome.
        if (onAddMapFile) addMapInputRef.current?.click();
        else onAddProject?.();
      }}
    />
  ) : null;

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <MobileScreenHeader
        title={t("home.title", "Peta Saya")}
        description={subtitle}
        actions={
          <MobileIconButton
            label={t("home.searchLabel", "Cari peta")}
            icon={<Search className="h-5 w-5" aria-hidden="true" />}
            expanded={searchOpen}
            controls="home-search"
            onClick={() => {
              if (searchOpen) setQuery("");
              setSearchOpen(!searchOpen);
            }}
          />
        }
      />

      <main className="flex min-h-0 flex-1 flex-col">
        <MobileScreenBody>
          {searchOpen ? (
            <MobileSearchField
              id="home-search"
              label={t("home.searchLabel", "Cari peta")}
              placeholder={t("home.searchPlaceholder", "Cari nama atau lokasi peta")}
              value={query}
              onChange={setQuery}
            />
          ) : null}

          {tab === "maps" ? (
            recentProjects.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center">
                <MobileNotice
                  icon={<MapIcon className="h-5 w-5" aria-hidden="true" />}
                  title={t("home.noMaps", "Belum ada peta")}
                  description={t(
                    "home.noMapsDescription",
                    "Peta yang kamu tambahkan akan muncul di sini dan tetap terbuka tanpa jaringan.",
                  )}
                  tone="info"
                  action={addAction}
                />
              </div>
            ) : (
              <>
                <MobileSectionHeading>{t("home.recentHeading", "Peta terakhir")}</MobileSectionHeading>
                <MobileCard>
                  {visibleProjects.length === 0 ? (
                    <MobileNotice
                      title={t("home.noMatches", "Tidak ada peta yang cocok")}
                      description={t(
                        "home.noMatchesDescription",
                        "Coba kata lain, atau tutup pencarian untuk melihat semua peta.",
                      )}
                      tone="info"
                    />
                  ) : (
                    visibleProjects.map((entry) => (
                      <MobileListRow
                        key={entry.path}
                        icon={<MapIcon className="h-5 w-5" aria-hidden="true" />}
                        title={entry.name}
                        description={relativeOpenedAt(entry.openedAt, i18n.language)}
                        badge={<MobileBadge tone="info">{t("home.badgeLocal", "Lokal")}</MobileBadge>}
                        onClick={() => onOpenProject(entry)}
                      />
                    ))
                  )}
                </MobileCard>

                <MobileCard
                  title={t("home.storageTitle", "Ruang penyimpanan")}
                  description={t("home.storageUnknown", "Belum diukur")}
                >
                  <div className="flex flex-col gap-2 px-3 py-3">
                    <MobileProgress
                      value={0}
                      label={t("home.storageBarLabel", "Ruang penyimpanan terpakai")}
                      valueText={t("home.storageUnknown", "Belum diukur")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "home.storageNote",
                        "Ubin offline dan ukuran proyek belum diukur pada versi ini, jadi bilahnya masih nol.",
                      )}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t("home.storageProposal", "Pengukuran ruang diajukan terpisah.")}
                    </p>
                  </div>
                </MobileCard>
              </>
            )
          ) : (
            <div className="flex flex-1 flex-col justify-center">
              <MobileNotice
                icon={<Layers className="h-5 w-5" aria-hidden="true" />}
                title={t("home.noLayers", "Layer tersimpan akan muncul di sini.")}
                description={t(
                  "home.noLayersDescription",
                  "Buka sebuah peta untuk melihat layer yang tersimpan di dalamnya.",
                )}
                tone="info"
              />
            </div>
          )}
        </MobileScreenBody>
      </main>

      {/* The screen's primary action, pinned above the tabs the way the
          composition draws it (`BilahBawah`): with three projects plus the
          storage card the body scrolls, and an add button at the end of that
          scroll is the one control a new user cannot find. Hidden in the empty
          state, where the notice already offers the same button: two "Tambah
          Peta" targets a few rows apart is one target too many. */}
      {tab === "maps" && addAction && recentProjects.length > 0 ? (
        <div className="shrink-0 border-t bg-background px-3 py-2">{addAction}</div>
      ) : null}

      {/* Bottom navigation — 2 tabs, 48 px targets, active tab on a pill. */}
      <nav
        aria-label={t("home.navLabel", "Navigasi beranda")}
        className="flex shrink-0 items-stretch gap-2 border-t bg-background px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          aria-current={tab === "maps" ? "page" : undefined}
          onClick={() => setTab("maps")}
          className={cn(
            "flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            tab === "maps"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <MapIcon className="h-5 w-5" aria-hidden="true" />
          {t("home.tabMaps", "Peta Saya")}
        </button>
        <button
          type="button"
          aria-current={tab === "layers" ? "page" : undefined}
          onClick={() => setTab("layers")}
          className={cn(
            "flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            tab === "layers"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Layers className="h-5 w-5" aria-hidden="true" />
          {t("home.tabLayers", "Layer")}
        </button>
      </nav>

      {/* One tap, PDF first: the map the user is about to work on is a
          georeferenced PDF in almost every case, so it leads the list and the
          other raster formats follow. Kept out of the tab order: the visible
          button is the accessible control. */}
      {onAddMapFile ? (
        <input
          ref={addMapInputRef}
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="home-add-map-input"
          accept=".pdf,.geotiff,.tif,.tiff,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset first: picking the same file twice must fire again.
            event.target.value = "";
            if (file) onAddMapFile(file);
          }}
        />
      ) : null}
    </div>
  );
}
