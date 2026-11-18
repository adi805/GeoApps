/**
 * A portable project bundle as the app uses it: list the bundles on this
 * device, save the open project into one, open one back, delete one.
 *
 * `offline-project-bundle.ts` does the work of copying a project's files in and
 * rewriting its paths; this module is the seam above it that a toolbar can call
 * without knowing where the bytes live. Everything platform-specific is
 * injected — the directory I/O, the absolute root the store sits under, and the
 * reader for the user's original file — so every rule here (which slug a save
 * lands in, what an opened project's paths point at, what a failed read
 * reports) is testable in plain Node. `offline-bundle-device.ts` is the real
 * Tauri binding.
 *
 * Issue #11 asks for the bundle to be *reachable*, not merely correct: a
 * project saved here has to be openable by a user with the network off, which
 * means an opened project's layers must point at files that exist on this
 * device. `openProjectFromBundle` deliberately returns bundle-relative paths
 * (that is what makes the bundle movable), so opening is a two-step that this
 * module owns: verify against the manifest, then resolve those relative paths
 * against the bundle's real directory.
 */

import type { BundleOfflineRegion, BundleStore, ProjectManifest } from "./project-manifest";
import {
  PROJECT_MANIFEST_FILE,
  assertSafeBundlePath,
  bundleTotals,
  isSafeBundlePath,
  projectSlug,
  readManifest,
} from "./project-manifest";
import { createTauriBundleStore, listBundleProjectSlugs, type BundleDirIo } from "./project-bundle-tauri";
import {
  openProjectFromBundle,
  saveProjectToBundle,
  type OpenedProjectBundle,
  type SaveProjectResult,
} from "./offline-project-bundle";
import { joinLocalPath } from "./file-io/paths";

/** What a bundle list row needs, without opening the project. */
export interface BundleSummary {
  slug: string;
  /** Display name from the manifest, or the slug when the manifest is unreadable. */
  name: string;
  /** Files the manifest records, the project file included. */
  files: number;
  /** Bytes the manifest records. */
  bytes: number;
  /** ISO timestamp of the last save, when the manifest could be read. */
  updatedAt: string | null;
  /** Why the manifest could not be read, so a corrupt bundle still shows up. */
  problem?: string;
}

/** A bundle opened as a project, with its paths resolved for this device. */
export interface OpenedBundleProject extends OpenedProjectBundle {
  /** Absolute directory the bundle lives in, for messages and debugging. */
  root: string;
  /** Bundle paths rewritten to absolute paths, in project order. */
  restored: string[];
}

export interface SaveBundleOptions {
  /** ISO timestamp; injected so a save is deterministic in tests. */
  now?: string;
  /** Offline regions to record on a first save (see `offline-region-manifest.ts`). */
  offlineRegions?: BundleOfflineRegion[];
}

export interface SavedBundle {
  slug: string;
  result: SaveProjectResult;
}

/** Everything this module needs from the platform. */
export interface BundleLibraryOptions {
  /** Directory operations over the app's own data directory. */
  dirIo: BundleDirIo;
  /**
   * Absolute path of the directory the store's relative paths resolve against
   * (Tauri's `appLocalDataDir`). Only used to hand the app absolute paths.
   */
  appLocalDataDir: string;
  /** Reads one of the user's original files, by the path the project stored. */
  readSource: (sourcePath: string) => Promise<Uint8Array>;
  /** Current time; defaults to the real clock. */
  now?: () => string;
}

/** The four things a Project menu needs from a bundle store. */
export interface BundleLibrary {
  /** Bundles on this device, newest save first. Unreadable ones are listed too. */
  list(): Promise<BundleSummary[]>;
  /** Copy the project's files in and rewrite its paths to bundle-relative ones. */
  save(project: unknown, options?: SaveBundleOptions): Promise<SavedBundle>;
  /** Verify a bundle against its manifest and resolve its paths for this device. */
  open(slug: string): Promise<OpenedBundleProject>;
  /** Remove every file the bundle lists, and nothing else. */
  delete(slug: string): Promise<string[]>;
}

/** Bundle paths keep their relative shape; an absolute path is already loadable. */
function isBundleRelative(sourcePath: string): boolean {
  return (
    sourcePath.trim() !== "" &&
    !/^[a-zA-Z]:[\\/]/.test(sourcePath) &&
    !sourcePath.startsWith("\\\\") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(sourcePath) &&
    isSafeBundlePath(sourcePath)
  );
}

/**
 * Rewrite every bundle-relative `sourcePath` to an absolute path under `root`.
 *
 * A project opened from a bundle carries `peta/peta.pdf` — correct for the
 * bundle, useless to a layer loader, which needs a path it can read. Resolving
 * here rather than in the loader keeps the bundle format independent of the
 * device while still handing the app something openable.
 *
 * Only `sourcePath` is rewritten, and only when it is a safe bundle path: a
 * network URL, a `data:` URL or an absolute path that somehow survived the
 * save is left exactly as written. A path that would climb out of the bundle is
 * left alone rather than resolved, so a hand-edited manifest cannot make the
 * app read outside the project directory.
 *
 * @param project - Parsed project JSON; not mutated.
 * @param root - Absolute bundle directory.
 * @returns The rewritten project and the paths that were resolved.
 */
export function restoreBundleSourcePaths(
  project: unknown,
  root: string,
): { project: unknown; restored: string[] } {
  const rewritten = structuredClone(project) as unknown;
  const restored: string[] = [];
  if (!rewritten || typeof rewritten !== "object") return { project: rewritten, restored };
  const layers = (rewritten as { layers?: unknown }).layers;
  if (!Array.isArray(layers)) return { project: rewritten, restored };

  for (const candidate of layers) {
    if (!candidate || typeof candidate !== "object") continue;
    const layer = candidate as Record<string, unknown>;
    const sourcePath = layer.sourcePath;
    if (typeof sourcePath !== "string" || !isBundleRelative(sourcePath)) continue;
    const safe = assertSafeBundlePath(sourcePath);
    layer.sourcePath = safe
      .split("/")
      .reduce((dir, segment) => joinLocalPath(dir, segment), root);
    restored.push(sourcePath);
  }
  return { project: rewritten, restored };
}

/** Read a manifest without throwing, so one corrupt bundle cannot hide the rest. */
async function manifestOf(store: BundleStore): Promise<ProjectManifest | null> {
  try {
    return await readManifest(store);
  } catch {
    return null;
  }
}

/**
 * Build a library over `projects/<slug>/` under the app's data directory.
 *
 * The slug for a save comes from the project's own name, exactly as the
 * bundle's directory name does, so saving the same project twice updates one
 * bundle instead of piling up `kebun-utara`, `kebun-utara-2`, …
 *
 * @param options - Injected platform pieces.
 */
export function createBundleLibrary(options: BundleLibraryOptions): BundleLibrary {
  const now = options.now ?? (() => new Date().toISOString());

  const storeFor = (slug: string) => createTauriBundleStore(slug, options.dirIo);

  return {
    async list() {
      const slugs = await listBundleProjectSlugs(options.dirIo);
      const rows: BundleSummary[] = [];
      for (const slug of slugs) {
        const store = await storeFor(slug);
        const manifest = await manifestOf(store);
        if (!manifest) {
          rows.push({
            slug,
            name: slug,
            files: 0,
            bytes: 0,
            updatedAt: null,
            problem: `Unreadable ${PROJECT_MANIFEST_FILE}`,
          });
          continue;
        }
        const totals = bundleTotals(manifest);
        rows.push({
          slug,
          name: manifest.name,
          files: totals.files,
          bytes: totals.bytes,
          updatedAt: manifest.updatedAt ?? null,
        });
      }
      // Newest first: the bundle just saved is the one the user is looking for.
      return rows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    },

    async save(project, saveOptions = {}) {
      const name = (project as { name?: unknown } | null)?.name;
      const slug = projectSlug(typeof name === "string" ? name : "project");
      const store = await storeFor(slug);
      // A previous manifest lets the save skip copies whose bytes did not
      // change, which is what makes saving a project with a 200 MB map quick.
      const previous = await manifestOf(store);
      const result = await saveProjectToBundle({
        project,
        store,
        readSource: options.readSource,
        now: saveOptions.now ?? now(),
        ...(previous ? { manifest: previous } : {}),
        ...(saveOptions.offlineRegions ? { offlineRegions: saveOptions.offlineRegions } : {}),
        projectId: slug,
      });
      return { slug, result };
    },

    async open(slug) {
      const store = await storeFor(slug);
      const opened = await openProjectFromBundle(store);
      // Resolved segment by segment so a Windows data directory yields an
      // all-backslash path instead of `…\app\projects/kebun-utara`.
      const root = store.root
        .split("/")
        .reduce((dir, segment) => joinLocalPath(dir, segment), options.appLocalDataDir);
      const { project, restored } = restoreBundleSourcePaths(opened.project, root);
      return { ...opened, project, root, restored };
    },

    async delete(slug) {
      const store = await storeFor(slug);
      const listed = await store.list();
      const removed: string[] = [];
      for (const path of listed) {
        try {
          await store.remove(path);
          removed.push(path);
        } catch (error) {
          console.warn(`Could not remove bundled file ${path}`, error);
        }
      }
      return removed;
    },
  };
}
