import { useAppStore } from "@geolibre/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchProjectFromUrl, projectUrlFromLocation } from "../lib/project-url";
import { resolveProjectXyzLayers } from "../lib/xyz-url";

export type ProjectUrlLoadState =
  | { error: null; message: null; status: "idle" }
  | { error: null; message: string; status: "loading" | "loaded" }
  | { error: string; message: null; status: "error" };

export type ProjectUrlLoaderResult = ProjectUrlLoadState & {
  /**
   * `true` selama shell sebaiknya belum dipasang karena proyek dari URL masih
   * dimuat. Lihat `PROJECT_URL_GATE_TIMEOUT_MS`.
   */
  holding: boolean;
};

/**
 * Berapa lama shell ditahan menunggu proyek dari URL.
 *
 * Tanpa gerbang ini shell memasang peta lebih dulu, dan peta membaca
 * `basemapStyleUrl` yang masih basemap default. Untuk proyek yang membawa
 * basemap offline, itu berarti gaya default diminta ke jaringan sebelum proyek
 * sempat menulis sentinelnya: di lapangan tanpa sinyal peta tampil kosong, dan
 * dengan sinyal basemap default sempat menimpa peta offline pengguna.
 *
 * Batas waktunya ada supaya host yang menggantung tidak meninggalkan jendela
 * berputar selamanya. Sesudah lewat, shell dipasang di atas workspace default
 * dan proyeknya menyusul lewat jalur biasa.
 */
const PROJECT_URL_GATE_TIMEOUT_MS = 10_000;

export function useProjectUrlLoader(): ProjectUrlLoaderResult {
  const loadProject = useAppStore((state) => state.loadProject);
  const projectUrl = useMemo(() => projectUrlFromLocation(), []);
  const clearMessageTimeoutRef = useRef<number | null>(null);
  const [gateExpired, setGateExpired] = useState(false);
  // Status awal dibaca sinkron dari URL, bukan menunggu efek. Kalau menunggu efek,
  // render pertama masih "idle" dan shell sudah terlanjur melakukan effect-nya
  // (mount peta) sebelum efek di berkas ini sempat menyetel "loading".
  const [state, setState] = useState<ProjectUrlLoadState>(() =>
    projectUrl
      ? { error: null, message: "Loading project from URL...", status: "loading" }
      : { error: null, message: null, status: "idle" },
  );

  useEffect(() => {
    if (!projectUrl || state.status !== "loading") return;
    const timer = window.setTimeout(() => setGateExpired(true), PROJECT_URL_GATE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [projectUrl, state.status]);

  useEffect(() => {
    if (!projectUrl) return;

    const abortController = new AbortController();
    setState({
      error: null,
      message: "Loading project from URL...",
      status: "loading",
    });

    void fetchProjectFromUrl(projectUrl, { signal: abortController.signal })
      .then((project) => resolveProjectXyzLayers(project, abortController.signal))
      .then((project) => {
        if (abortController.signal.aborted) return;
        // A `?url=` deep link is reloaded on every visit, so treat it as
        // transient rather than persisting it to the recent-projects list.
        loadProject(project, projectUrl, { rememberRecent: false });
        setState({
          error: null,
          message: `Loaded ${project.name}`,
          status: "loaded",
        });
        clearMessageTimeoutRef.current = window.setTimeout(() => {
          clearMessageTimeoutRef.current = null;
          setState({ error: null, message: null, status: "idle" });
        }, 4000);
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        setState({
          error: error instanceof Error ? error.message : "Could not load the project URL.",
          message: null,
          status: "error",
        });
      });

    return () => {
      abortController.abort();
      if (clearMessageTimeoutRef.current !== null) {
        window.clearTimeout(clearMessageTimeoutRef.current);
        clearMessageTimeoutRef.current = null;
      }
    };
  }, [loadProject, projectUrl]);

  return { ...state, holding: state.status === "loading" && !gateExpired };
}
