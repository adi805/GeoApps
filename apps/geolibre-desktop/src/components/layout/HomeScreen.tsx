import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Layers, Map as MapIcon, Plus } from "lucide-react";
import { useAppStore, type RecentProjectEntry } from "@geolibre/core";
import { loadRecentProjects } from "../../hooks/useRecentProjectsPersistence";

export interface HomeScreenProps {
  /** Fired when the user taps a project — the app shell should mount the viewer. */
  onOpenProject: (entry: RecentProjectEntry) => void;
  /** Fired when the user taps "add map" — shell can open AddData flow. */
  onAddProject?: () => void;
}

type HomeTab = "maps" | "layers";

/**
 * Avenza-style home screen: My Maps list + 2-tab bottom navigation.
 * The full GIS shell (DesktopShell) stays mounted as the "viewer" —
 * this component only renders above/behind it at the app-router level.
 */
export function HomeScreen({ onOpenProject, onAddProject }: HomeScreenProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HomeTab>("maps");
  const [recentProjects] = useState<RecentProjectEntry[]>(() => loadRecentProjects());

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5" />
          <span className="text-lg font-semibold">{t("app.name", "GeoKebun")}</span>
        </div>
        <button
          type="button"
          onClick={onAddProject}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("home.addMap", "Tambah Peta")}
        </button>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "maps" ? (
          <div className="space-y-3">
            {recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <FolderOpen className="h-10 w-10 opacity-40" />
                <p className="text-sm">{t("home.noMaps", "Belum ada peta. Tambahkan peta pertama Anda.")}</p>
                {onAddProject ? (
                  <button
                    type="button"
                    onClick={onAddProject}
                    className="mt-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                  >
                    {t("home.addMap", "Tambah Peta")}
                  </button>
                ) : null}
              </div>
            ) : (
              recentProjects.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => onOpenProject(entry)}
                  className="flex w-full items-center gap-3 rounded-lg border p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <MapIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.path} · {new Date(entry.openedAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <Layers className="h-10 w-10 opacity-40" />
            <p className="text-sm">{t("home.noLayers", "Layer tersimpan akan muncul di sini.")}</p>
          </div>
        )}
      </main>

      {/* Bottom navigation — 2 tabs, Avenza-style */}
      <nav className="flex border-t">
        <button
          type="button"
          onClick={() => setTab("maps")}
          className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${
            tab === "maps" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapIcon className="h-5 w-5" />
          {t("home.tabMaps", "Peta Saya")}
        </button>
        <button
          type="button"
          onClick={() => setTab("layers")}
          className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${
            tab === "layers" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-5 w-5" />
          {t("home.tabLayers", "Layer")}
        </button>
      </nav>
    </div>
  );
}
