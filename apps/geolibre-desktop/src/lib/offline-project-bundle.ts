/**
 * Save a project into its bundle, and open it back out.
 *
 * `project-bundle.ts` copies bytes into a bundle and verifies them; it knows
 * nothing about the shape of a project. This module is the half that does: it
 * finds the layers whose `sourcePath` points at a file on the user's disk,
 * copies each one into the bundle, and rewrites the project JSON so those
 * layers carry a **relative** path instead.
 *
 * Why both halves matter, and why neither is enough on its own: a bundle that
 * stores absolute `sourcePath`s is not portable. On Android those paths are
 * `content://` URIs whose read grant dies with the process, so copying the file
 * in while leaving the project pointing at the URI still opens a project with
 * empty layers. Rewriting the path without copying leaves it pointing at a file
 * that is not in the bundle, which is worse: it looks portable and is not.
 * Issue #11 point 1 is exactly this pair of operations.
 *
 * The project JSON is stored in the bundle as {@link PROJECT_DATA_FILE}, so
 * opening a bundle reads the manifest first and the project second, and the
 * manifest's sha256 covers the project file like any other. That is point 2:
 * opening a project means reading the manifest first, never trusting a
 * directory listing.
 *
 * The source reader is injected, so nothing here imports Tauri, DOM or React
 * code and every rule is testable in plain Node.
 */

import type {
  BundleFileKind,
  BundleOfflineRegion,
  BundleStore,
  OpenedBundle,
  ProjectManifest,
} from "./project-manifest";
import {
  PROJECT_MANIFEST_FILE,
  bundleFileKind,
  createManifest,
  projectSlug,
  sha256Hex,
  writeManifest,
} from "./project-manifest";
import { importBundleFile, openBundle } from "./project-bundle";

/** The project JSON inside the bundle. Not `project.json`: that is the manifest. */
export const PROJECT_DATA_FILE = "proyek.geolibre.json";

/** Subdirectory per kind, so a bundle reads as `peta/`, `raster/`, `foto/`. */
const SUBDIR: Record<BundleFileKind, string> = {
  map: "peta",
  raster: "raster",
  photo: "foto",
  other: "berkas",
};

/** Raised when a bundle cannot be opened as a project, with the reason stated. */
export class BundleProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BundleProjectError";
  }
}

/** One layer that points at a file outside the bundle. */
export interface ExternalProjectFile {
  /** Index into `project.layers`, so the caller can map it back to a layer. */
  layerIndex: number;
  layerId?: string;
  layerName?: string;
  /** The path as saved today: absolute, `file://` or `content://`. */
  sourcePath: string;
  kind: BundleFileKind;
}

/** A layer whose copy is missing from (or altered in) the bundle. */
export interface AffectedLayer {
  layerIndex: number;
  layerName?: string;
  bundlePath: string;
}

export interface SaveProjectOptions {
  /** The parsed `.geolibre.json`. Read, never mutated. */
  project: unknown;
  /** Store bound to `projects/<slug>/`. */
  store: BundleStore;
  /** Reads the user's original file. Receives `sourcePath` verbatim. */
  readSource: (sourcePath: string) => Promise<Uint8Array>;
  /** ISO timestamp for the manifest; injected so the output is deterministic. */
  now: string;
  /** Manifest from a previous save: unchanged copies are not written again. */
  manifest?: ProjectManifest;
  /** Regions to record on a first save; on a re-save the manifest carries them. */
  offlineRegions?: BundleOfflineRegion[];
  /** Bundle directory name. Defaults to `projectSlug(project.name)`. */
  projectId?: string;
}

export interface SaveProjectResult {
  /** The rewritten project: `sourcePath` now holds bundle-relative paths. */
  project: unknown;
  manifest: ProjectManifest;
  files: Array<ExternalProjectFile & { bundlePath: string }>;
  /** How many file copies were written this save (0 when nothing changed). */
  copied: number;
}

export interface OpenedProjectBundle {
  project: unknown;
  manifest: ProjectManifest;
  status: "ok" | "incomplete";
  /** Bundle paths the manifest lists but the store cannot read. */
  missing: string[];
  /** Bundle paths whose bytes no longer match the recorded sha256. */
  mismatched: string[];
  /** Layers that point at a missing or altered copy, for the "find it again" list. */
  affectedLayers: AffectedLayer[];
}

/**
 * Does `sourcePath` name a file outside the bundle?
 *
 * Only the two schemes that name a file the app may copy count as external.
 * `http(s):`, `data:` and `blob:` are content the layer already fetches or
 * carries; copying them would freeze a remote source into a stale local copy
 * and turn a working layer into an outdated one. A bare relative path is
 * already a bundle path, which is what makes re-saving idempotent.
 */
export function isExternalProjectPath(sourcePath: string): boolean {
  const value = sourcePath.trim();
  if (value === "") return false;
  // A Windows drive letter also matches the URI-scheme shape (`C:`), so it is
  // tested before the scheme regex rather than after it.
  if (/^[a-zA-Z]:[\\/]/.test(value)) return true;
  if (value.startsWith("\\\\")) return true;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    return name === "content" || name === "file";
  }
  return value.startsWith("/");
}

/** Last path segment of a URI or path, reduced to characters safe in a bundle. */
function safeBaseName(sourcePath: string): string {
  let value = sourcePath.trim();
  // Drop a query or fragment before taking the last segment, so
  // `content://…/scan.pdf?token=x` keeps its extension (and therefore its kind).
  const cut = value.search(/[?#]/);
  if (cut >= 0) value = value.slice(0, cut);
  const parts = value.split(/[\\/]/).filter((part) => part !== "");
  let base = parts.length > 0 ? parts[parts.length - 1] : "";
  if (/%[0-9a-f]{2}/i.test(base)) {
    try {
      base = decodeURIComponent(base);
    } catch {
      // A malformed escape is not worth failing a save over; keep it as written.
    }
  }
  base = base
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/-+$/, "");
  if (base === "" || base === "." || base === "..") return "berkas";
  // Keep the tail (and with it the extension) when a name is absurdly long.
  return base.slice(-120);
}

/**
 * Where a copy goes inside the bundle, never colliding with `taken`.
 *
 * `taken` is passed in rather than read from the store because two layers can
 * name two different files `scan.pdf`; the second becomes `scan-2.pdf` in the
 * same save, not on the next one.
 */
export function bundlePathForSource(
  sourcePath: string,
  kind: BundleFileKind,
  taken: ReadonlySet<string> = new Set(),
): string {
  const base = safeBaseName(sourcePath);
  const dir = SUBDIR[kind];
  const first = `${dir}/${base}`;
  if (!taken.has(first)) return first;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : "";
  for (let n = 2; n <= 999; n += 1) {
    const candidate = `${dir}/${stem}-${n}${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new BundleProjectError(`Too many files named ${base} in one bundle.`);
}

/**
 * The raw `layers` array, unfiltered.
 *
 * Filtering before indexing would shift `layerIndex` whenever a project holds a
 * non-object entry, and the index is what the caller uses to map a copy back to
 * a layer. So the array is kept as written and each entry is checked in place.
 */
function rawLayers(project: unknown): unknown[] {
  if (!project || typeof project !== "object") return [];
  const layers = (project as { layers?: unknown }).layers;
  return Array.isArray(layers) ? layers : [];
}

/**
 * Every layer that points outside the bundle, in project order.
 *
 * Deliberately narrow: `sourcePath` is the only field a `.geolibre.json` uses
 * for "this layer was read from a file on disk". Field-collection photos are
 * base64 in the project today, and remote `source.url`s are fetched, not read,
 * so neither is a copy candidate here.
 */
export function collectExternalFiles(project: unknown): ExternalProjectFile[] {
  const found: ExternalProjectFile[] = [];
  rawLayers(project).forEach((candidate, layerIndex) => {
    if (!candidate || typeof candidate !== "object") return;
    const layer = candidate as Record<string, unknown>;
    const sourcePath = layer.sourcePath;
    if (typeof sourcePath !== "string" || !isExternalProjectPath(sourcePath)) return;
    found.push({
      layerIndex,
      ...(typeof layer.id === "string" ? { layerId: layer.id } : {}),
      ...(typeof layer.name === "string" ? { layerName: layer.name } : {}),
      sourcePath,
      kind: bundleFileKind(sourcePath),
    });
  });
  return found;
}

function projectNameOf(project: unknown): string | undefined {
  if (!project || typeof project !== "object") return undefined;
  const name = (project as { name?: unknown }).name;
  return typeof name === "string" && name.trim() !== "" ? name : undefined;
}

function serializeProject(project: unknown): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

/**
 * Copy a project's files into its bundle and rewrite the project to relative
 * paths.
 *
 * Returns the rewritten project; the caller keeps it in memory and saves it
 * wherever the user expects. Nothing is written outside `store`, and a copy is
 * only written when its bytes differ from the previous manifest, so saving a
 * project repeatedly does not rewrite a 200 MB map PDF each time.
 */
export async function saveProjectToBundle(options: SaveProjectOptions): Promise<SaveProjectResult> {
  const name = projectNameOf(options.project) ?? "project";
  const projectId = options.projectId ?? projectSlug(name);
  if (projectId === PROJECT_MANIFEST_FILE) {
    throw new BundleProjectError(`Project id ${projectId} collides with the manifest name.`);
  }
  const refs = collectExternalFiles(options.project);
  const previous = new Map((options.manifest?.files ?? []).map((entry) => [entry.path, entry]));
  let manifest =
    options.manifest ??
    createManifest({
      projectId,
      name,
      now: options.now,
      offlineRegions: options.offlineRegions ?? [],
    });

  const rewritten = structuredClone(options.project) as unknown;
  const layers = rawLayers(rewritten);
  const taken = new Set<string>();
  const files: Array<ExternalProjectFile & { bundlePath: string }> = [];
  let copied = 0;

  for (const ref of refs) {
    const bytes = await options.readSource(ref.sourcePath);
    const bundlePath = bundlePathForSource(ref.sourcePath, ref.kind, taken);
    taken.add(bundlePath);
    const sha256 = await sha256Hex(bytes);
    const known = previous.get(bundlePath);
    if (!known || known.sha256 !== sha256 || known.bytes !== bytes.byteLength) {
      const written = await importBundleFile(options.store, manifest, {
        path: bundlePath,
        bytes,
        now: options.now,
        kind: ref.kind,
        source: ref.sourcePath,
      });
      manifest = written.manifest;
      copied += 1;
    }
    const layer = layers[ref.layerIndex];
    if (layer && typeof layer === "object") {
      (layer as Record<string, unknown>).sourcePath = bundlePath;
    }
    files.push({ ...ref, bundlePath });
  }

  const projectBytes = new TextEncoder().encode(serializeProject(rewritten));
  const projectCopy = await importBundleFile(options.store, manifest, {
    path: PROJECT_DATA_FILE,
    bytes: projectBytes,
    now: options.now,
    kind: "other",
  });
  manifest = projectCopy.manifest;
  await writeManifest(options.store, manifest);

  return { project: rewritten, manifest, files, copied };
}

/**
 * Which layers point at one of `missingPaths`.
 *
 * The bundle reports paths; a user needs layers. This is the join between the
 * two, so the "files are missing, find them again" list can name the layer
 * whose PDF vanished instead of only its path inside the bundle (issue #11
 * point 3).
 */
export function missingProjectLayers(
  project: unknown,
  missingPaths: readonly string[],
): AffectedLayer[] {
  const missing = new Set(missingPaths);
  const affected: AffectedLayer[] = [];
  rawLayers(project).forEach((candidate, layerIndex) => {
    if (!candidate || typeof candidate !== "object") return;
    const layer = candidate as Record<string, unknown>;
    const sourcePath = layer.sourcePath;
    if (typeof sourcePath !== "string" || !missing.has(sourcePath)) return;
    affected.push({
      layerIndex,
      ...(typeof layer.name === "string" ? { layerName: layer.name } : {}),
      bundlePath: sourcePath,
    });
  });
  return affected;
}

/**
 * Open a bundle as a project: manifest first, then the project file, then the
 * per-file report.
 *
 * A bundle without a readable project file is an error rather than an empty
 * project, for the same reason `openBundle` refuses a directory without a
 * manifest: an empty project looks like the user's data is gone, and saying
 * "this is not a bundle" is both true and actionable.
 */
export async function openProjectFromBundle(store: BundleStore): Promise<OpenedProjectBundle> {
  let opened: OpenedBundle;
  try {
    opened = await openBundle(store);
  } catch (error) {
    throw new BundleProjectError(`Not a project bundle: ${String(error)}`);
  }
  let project: unknown;
  try {
    const bytes = await store.read(PROJECT_DATA_FILE);
    project = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new BundleProjectError(`Project file ${PROJECT_DATA_FILE} is not valid JSON.`);
    }
    throw new BundleProjectError(
      `Bundle has no readable project file (${PROJECT_DATA_FILE}): ${String(error)}`,
    );
  }
  const missing = opened.verification.missing.map((entry) => entry.path);
  const mismatched = opened.verification.mismatched.map((item) => item.entry.path);
  return {
    project,
    manifest: opened.manifest,
    status: opened.status,
    missing,
    mismatched,
    affectedLayers: missingProjectLayers(project, missing),
  };
}
