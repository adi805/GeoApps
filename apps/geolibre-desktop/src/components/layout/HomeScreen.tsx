import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Map as MapIcon, Plus } from "lucide-react";
import { cn } from "@geolibre/ui";
import type { RecentProjectEntry } from "@geolibre/core";
import { loadRecentProjects } from "../../hooks/useRecentProjectsPersistence";
import {
  MobileAction,
  MobileCard,
  MobileListRow,
  MobileNotice,
  MobileScreenBody,
  MobileScreenHeader,
} from "./mobile/mobilePrimitives";

export interface HomeScreenProps {
  /** Fired when the user taps a project — the app shell should mount the viewer. */
  onOpenProject: (entry: RecentProjectEntry) => void;
  /** Fired when the user taps "add map" — shell can open AddData flow. */
  onAddProject?: () => void;
}

type HomeTab = "maps" | "layers";

/**
 * The first screen: My Maps list + 2-tab bottom navigation.
 *
 * The arrangement is the one issue 103 asks for — empty state, loaded list, Peta
 * Saya / Layer tabs, Tambah Peta — expressed in the production
 * `mobilePrimitives` instead of the gallery, so no product screen depends on
 * `src/visual/**`. Written without a leading hash so the unit's raw-colour
 * check (`#[0-9a-f]{3,6}`) does not read the issue number as a colour.
 *
 * Every interactive target clears 48 CSS px. The recent-project row stays a real
 * `<button>` whose accessible name starts with the project name: opening a
 * project must work from the keyboard, and the E2E helpers locate the seeded
 * project by that name.
 *
 * The full GIS shell (DesktopShell) stays mounted as the "viewer" — this
 * component only renders above/behind it at the app-router level.
 */
export function HomeScreen({ onOpenProject, onAddProject }: HomeScreenProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HomeTab>("maps");
  const [recentProjects] = useState<RecentProjectEntry[]>(() => loadRecentProjects());

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <MobileScreenHeader
        title={t("app.name", "GeoKebun")}
        actions={
          onAddProject ? (
            <button
              type="button"
              onClick={onAddProject}
              className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("home.addMap", "Tambah Peta")}
            </button>
          ) : null
        }
      />

      <main className="flex min-h-0 flex-1 flex-col">
        <MobileScreenBody>
          {tab === "maps" ? (
            recentProjects.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center">
                <MobileNotice
                  title={t("home.noMaps", "Belum ada peta. Tambahkan peta pertama Anda.")}
                  tone="info"
                  action={
                    onAddProject ? (
                      <MobileAction
                        label={t("home.addMap", "Tambah Peta")}
                        icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                        onClick={onAddProject}
                      />
                    ) : undefined
                  }
                />
              </div>
            ) : (
              recentProjects.map((entry) => (
                <MobileCard key={entry.path}>
                  <MobileListRow
                    title={entry.name}
                    description={`${entry.path} · ${new Date(entry.openedAt).toLocaleDateString()}`}
                    trailing={
                      <MapIcon
                        className="h-5 w-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    }
                    onClick={() => onOpenProject(entry)}
                  />
                </MobileCard>
              ))
            )
          ) : (
            <div className="flex flex-1 flex-col justify-center">
              <MobileNotice
                title={t("home.noLayers", "Layer tersimpan akan muncul di sini.")}
                tone="info"
              />
            </div>
          )}
        </MobileScreenBody>
      </main>

      {/* Bottom navigation — 2 tabs, 48 px targets, clear of the home indicator. */}
      <nav
        aria-label={t("home.navLabel", "Navigasi beranda")}
        className="flex shrink-0 border-t bg-background pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          aria-current={tab === "maps" ? "page" : undefined}
          onClick={() => setTab("maps")}
          className={cn(
            "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-xs font-medium transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            tab === "maps" ? "text-primary" : "text-muted-foreground hover:text-foreground",
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
            "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-xs font-medium transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            tab === "layers" ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="h-5 w-5" aria-hidden="true" />
          {t("home.tabLayers", "Layer")}
        </button>
      </nav>
    </div>
  );
}
