/**
 * Portable project bundles: a project that carries its own files instead of
 * pointing at paths outside it.
 *
 * The problem this solves is Android-shaped but not Android-only. A
 * `.geolibre.json` project stores absolute paths to the PDF map, the GeoTIFF
 * and the field photos it uses. On Android those paths are `content://` SAF
 * URIs whose read grant dies with the process, so reopening the project after
 * the app is killed finds nothing to read. Even on desktop, a project is only
 * as portable as the folders it happens to reference.
 *
 * A bundle is a directory the app owns, one per project, holding:
 *
 *   projects/<slug>/project.json   — the manifest described below
 *   projects/<slug>/<relative path> — every imported file, copied in
 *
 * The project records paths *relative to that directory*, so the bundle can be
 * moved, copied or reopened on another device without rewriting anything.
 *
 * This module is the storage-agnostic half: it decides what a manifest holds,
 * how a file is admitted, what "missing" means, and what deleting a project is
 * allowed to touch. It deliberately imports no Tauri, DOM or React code — the
 * `BundleStore` it is handed is the only I/O it performs, which is what makes
 * every rule here testable in plain Node.
 *
 * Safety rules encoded below, because they are the ones that cost data:
 *   - a bundle path is always relative, POSIX-separated, and may not climb out
 *     of the project directory (`..`, absolute paths, drive letters);
 *   - deleting a project removes what the manifest lists plus the manifest, and
 *     nothing else;
 *   - a manifest that fails to parse is an error, never an empty project. An
 *     empty project silently "opened" looks like data loss.
 */

/** Manifest file name inside a project directory. */
export const PROJECT_MANIFEST_FILE = "project.json";

/** Value of {@link ProjectManifest.schema}, so a foreign JSON file is rejected. */
export const PROJECT_MANIFEST_SCHEMA = "geolibre.project.manifest";

/** Current manifest version. Bump only with a migration in {@link parseManifest}. */
export const PROJECT_MANIFEST_VERSION = 1;

/**
 * What a bundled file is for. Kept coarse on purpose: the UI groups by it, and
 * a wrong guess is cosmetic rather than structural.
 */
export type BundleFileKind = "map" | "raster" | "photo" | "other";

/** One file copied into the bundle. */
export interface BundleFileEntry {
  /** Path relative to the project directory, POSIX separators. */
  path: string;
  /** Size in bytes of the bytes as copied in. */
  bytes: number;
  /** Lower-case hex SHA-256 of the copied bytes. */
  sha256: string;
  kind: BundleFileKind;
  /** ISO-8601 timestamp of the copy. */
  importedAt: string;
  /**
   * Where the file came from (original file name, or the `content://` URI on
   * Android). Not used to reopen the project; kept so "find this file again"
   * can name what it is looking for.
   */
  source?: string;
}

/**
 * An offline map region recorded in the bundle.
 *
 * These mirror `offline-regions.ts` records, which are device-scoped and live
 * in `localStorage` rather than the project. Copying the identifying fields
 * into the manifest is what lets the project show a total size and tell a user
 * which regions travel with it; the tile cache itself stays in the service
 * worker cache.
 */
export interface BundleOfflineRegion {
  id: string;
  name: string;
  /** [west, south, east, north] in degrees. */
  bbox: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  hosts: string[];
  /** Bytes held by this region's tiles, when the caller can measure them. */
  bytes?: number;
}

/** Size summary shown to the user. Derived; never trusted from disk. */
export interface BundleTotals {
  files: number;
  bytes: number;
  offlineRegionBytes: number;
}

/** The parsed contents of `project.json`. */
export interface ProjectManifest {
  schema: typeof PROJECT_MANIFEST_SCHEMA;
  version: number;
  /** Stable id of the project (the slug used for the directory). */
  projectId: string;
  name: string;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  files: BundleFileEntry[];
  offlineRegions: BundleOfflineRegion[];
  totals: BundleTotals;
}

/**
 * File operations scoped to ONE project directory.
 *
 * Implementations must treat every path as relative to that directory and must
 * refuse to escape it. The interface is this narrow so a caller cannot ask for
 * a file outside the bundle by construction.
 */
export interface BundleStore {
  /** Write `bytes` to `path`, creating parent directories as needed. */
  write: (path: string, bytes: Uint8Array) => Promise<void>;
  /** Read `path`. Rejects when it is not there. */
  read: (path: string) => Promise<Uint8Array>;
  /** Every file in the project directory, relative, POSIX separators. */
  list: () => Promise<string[]>;
  /** Remove `path`. Rejects when it cannot. */
  remove: (path: string) => Promise<void>;
}

/** Result of checking a bundle's files against its manifest. */
export interface BundleVerification {
  /** Entries whose file is not there. */
  missing: BundleFileEntry[];
  /** Entries whose bytes no longer hash to the recorded value. */
  mismatched: Array<{ entry: BundleFileEntry; actualSha256: string }>;
  /** Entries that matched. */
  ok: number;
}

/** Result of opening a bundle: the manifest plus whatever is wrong with it. */
export interface OpenedBundle {
  manifest: ProjectManifest;
  /**
   * `ok` when every listed file is present and intact. `incomplete` means the
   * caller must show {@link verification} and offer to re-import, not open a
   * half-populated project as if it were whole.
   */
  status: "ok" | "incomplete";
  verification: BundleVerification;
}

/** Thrown for a manifest that exists but cannot be trusted. */
export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

/** Thrown when a path would leave the project directory. */
export class UnsafeBundlePathError extends Error {
  constructor(path: string) {
    super(`Refusing to use a bundle path outside the project directory: ${path}`);
    this.name = "UnsafeBundlePathError";
  }
}

/**
 * Whether `path` is a safe bundle-relative path: non-empty, not absolute, no
 * drive letter, no `..` segment, and no backslashes (which would be ambiguous
 * between the two separator conventions).
 */
export function isSafeBundlePath(path: string): boolean {
  if (path.length === 0 || path.length > 512) return false;
  if (path.includes("\\")) return false;
  if (path.startsWith("/")) return false;
  if (/^[A-Za-z]:/.test(path)) return false;
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }
  // A NUL byte truncates the path in some filesystem APIs; a path carrying one
  // is not a name any caller meant to write.
  return !path.includes("\0");
}

/** {@link isSafeBundlePath}, throwing {@link UnsafeBundlePathError} otherwise. */
export function assertSafeBundlePath(path: string): string {
  if (!isSafeBundlePath(path)) throw new UnsafeBundlePathError(path);
  return path;
}

/**
 * Turn a project name into a directory-safe slug.
 *
 * Deliberately conservative and deterministic: lower-case ASCII letters, digits
 * and single dashes. A name written entirely in a non-Latin script slugs to an
 * empty string, so the caller passes a fallback (`"project"`) rather than
 * getting a directory named "".
 */
export function projectSlug(name: string, fallback = "project"): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : fallback;
}

/** Lower-case hex SHA-256 of `bytes`, via WebCrypto (available in Node 18+). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Classify a file by extension, for grouping in the UI. */
export function bundleFileKind(path: string): BundleFileKind {
  const extension = path.toLowerCase().split(".").pop() ?? "";
  if (extension === "pdf") return "map";
  if (extension === "tif" || extension === "tiff" || extension === "mbtiles") return "raster";
  if (["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension)) return "photo";
  return "other";
}

/** Recompute {@link ProjectManifest.totals} from the entries themselves. */
export function bundleTotals(manifest: Pick<ProjectManifest, "files" | "offlineRegions">): BundleTotals {
  return {
    files: manifest.files.length,
    bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
    offlineRegionBytes: manifest.offlineRegions.reduce((sum, region) => sum + (region.bytes ?? 0), 0),
  };
}

/**
 * Build a manifest from scratch. `now` is injectable so tests are not
 * clock-dependent.
 */
export function createManifest(options: {
  projectId: string;
  name: string;
  now: string;
  files?: BundleFileEntry[];
  offlineRegions?: BundleOfflineRegion[];
}): ProjectManifest {
  const files = options.files ?? [];
  const offlineRegions = options.offlineRegions ?? [];
  return {
    schema: PROJECT_MANIFEST_SCHEMA,
    version: PROJECT_MANIFEST_VERSION,
    projectId: assertSafeBundlePath(options.projectId),
    name: options.name,
    createdAt: options.now,
    updatedAt: options.now,
    files,
    offlineRegions,
    totals: bundleTotals({ files, offlineRegions }),
  };
}

/**
 * Serialize a manifest, with totals recomputed first so a caller that edited
 * `files` directly cannot write a stale size summary.
 */
export function serializeManifest(manifest: ProjectManifest): string {
  const normalized: ProjectManifest = {
    ...manifest,
    files: [...manifest.files].sort((a, b) => a.path.localeCompare(b.path)),
    totals: bundleTotals(manifest),
  };
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseFileEntry(value: unknown): BundleFileEntry {
  if (!value || typeof value !== "object") throw new ManifestError("Manifest file entry is not an object.");
  const entry = value as Record<string, unknown>;
  if (typeof entry.path !== "string" || !isSafeBundlePath(entry.path)) {
    throw new ManifestError(`Manifest file entry has an unsafe path: ${String(entry.path)}`);
  }
  if (!isFiniteNumber(entry.bytes) || entry.bytes < 0) {
    throw new ManifestError(`Manifest file entry has no usable size: ${entry.path}`);
  }
  if (typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
    throw new ManifestError(`Manifest file entry has no usable sha256: ${entry.path}`);
  }
  const kind = entry.kind;
  if (kind !== "map" && kind !== "raster" && kind !== "photo" && kind !== "other") {
    throw new ManifestError(`Manifest file entry has an unknown kind: ${entry.path}`);
  }
  return {
    path: entry.path,
    bytes: entry.bytes,
    sha256: entry.sha256,
    kind,
    importedAt: typeof entry.importedAt === "string" ? entry.importedAt : "",
    ...(typeof entry.source === "string" ? { source: entry.source } : {}),
  };
}

function parseOfflineRegion(value: unknown): BundleOfflineRegion {
  if (!value || typeof value !== "object") throw new ManifestError("Manifest region is not an object.");
  const region = value as Record<string, unknown>;
  const bbox = region.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(isFiniteNumber)) {
    throw new ManifestError(`Manifest region has no usable bbox: ${String(region.id)}`);
  }
  if (typeof region.id !== "string" || region.id.length === 0) {
    throw new ManifestError("Manifest region has no id.");
  }
  return {
    id: region.id,
    name: typeof region.name === "string" ? region.name : region.id,
    bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
    minZoom: isFiniteNumber(region.minZoom) ? region.minZoom : 0,
    maxZoom: isFiniteNumber(region.maxZoom) ? region.maxZoom : 0,
    tileCount: isFiniteNumber(region.tileCount) ? region.tileCount : 0,
    hosts: Array.isArray(region.hosts) ? region.hosts.filter((h): h is string => typeof h === "string") : [],
    ...(isFiniteNumber(region.bytes) ? { bytes: region.bytes } : {}),
  };
}

/**
 * Parse and validate a manifest.
 *
 * Every field is checked rather than cast: this file is the thing a project is
 * reopened from, so a manifest that is subtly wrong must fail loudly here
 * instead of producing a project that renders half its layers.
 */
export function parseManifest(text: string): ProjectManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ManifestError(`Project manifest is not valid JSON: ${(error as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object") throw new ManifestError("Project manifest is not an object.");
  const manifest = parsed as Record<string, unknown>;
  if (manifest.schema !== PROJECT_MANIFEST_SCHEMA) {
    throw new ManifestError(
      `Not a GeoLibre project manifest (schema: ${String(manifest.schema)}).`,
    );
  }
  if (!isFiniteNumber(manifest.version) || manifest.version < 1) {
    throw new ManifestError("Project manifest has no usable version.");
  }
  if (manifest.version > PROJECT_MANIFEST_VERSION) {
    throw new ManifestError(
      `Project manifest version ${manifest.version} is newer than this build understands (${PROJECT_MANIFEST_VERSION}).`,
    );
  }
  if (typeof manifest.projectId !== "string" || !isSafeBundlePath(manifest.projectId)) {
    throw new ManifestError("Project manifest has no usable projectId.");
  }
  if (!Array.isArray(manifest.files)) throw new ManifestError("Project manifest has no files list.");
  if (!Array.isArray(manifest.offlineRegions)) {
    throw new ManifestError("Project manifest has no offlineRegions list.");
  }
  const files = manifest.files.map(parseFileEntry);
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) throw new ManifestError(`Duplicate file path in manifest: ${file.path}`);
    seen.add(file.path);
  }
  const offlineRegions = manifest.offlineRegions.map(parseOfflineRegion);
  return {
    schema: PROJECT_MANIFEST_SCHEMA,
    version: manifest.version,
    projectId: manifest.projectId,
    name: typeof manifest.name === "string" ? manifest.name : manifest.projectId,
    createdAt: typeof manifest.createdAt === "string" ? manifest.createdAt : "",
    updatedAt: typeof manifest.updatedAt === "string" ? manifest.updatedAt : "",
    files,
    offlineRegions,
    totals: bundleTotals({ files, offlineRegions }),
  };
}

/** Read `project.json` through `store` and parse it. */
export async function readManifest(store: BundleStore): Promise<ProjectManifest> {
  const bytes = await store.read(PROJECT_MANIFEST_FILE);
  return parseManifest(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** Serialize and write `project.json` through `store`. */
export async function writeManifest(store: BundleStore, manifest: ProjectManifest): Promise<void> {
  await store.write(PROJECT_MANIFEST_FILE, new TextEncoder().encode(serializeManifest(manifest)));
}

/**
 * Copy `bytes` into the bundle at `path` and return the manifest entry.
 *
 * The copy happens before the manifest is updated, and the entry records the
 * hash of the bytes actually written, so a manifest never claims a file that is
 * not on disk. Re-importing the same path replaces the entry (the newest copy
 * wins) rather than leaving two entries for one file.
 */
export async function importBundleFile(
  store: BundleStore,
  manifest: ProjectManifest,
  options: {
    path: string;
    bytes: Uint8Array;
    now: string;
    kind?: BundleFileKind;
    source?: string;
  },
): Promise<{ manifest: ProjectManifest; entry: BundleFileEntry }> {
  const path = assertSafeBundlePath(options.path);
  if (path === PROJECT_MANIFEST_FILE) {
    throw new UnsafeBundlePathError(path);
  }
  const sha256 = await sha256Hex(options.bytes);
  await store.write(path, options.bytes);
  const entry: BundleFileEntry = {
    path,
    bytes: options.bytes.byteLength,
    sha256,
    kind: options.kind ?? bundleFileKind(path),
    importedAt: options.now,
    ...(options.source ? { source: options.source } : {}),
  };
  const files = [...manifest.files.filter((file) => file.path !== path), entry];
  const next: ProjectManifest = {
    ...manifest,
    files,
    updatedAt: options.now,
    totals: bundleTotals({ files, offlineRegions: manifest.offlineRegions }),
  };
  return { manifest: next, entry };
}

/**
 * Replace the recorded offline regions (see {@link BundleOfflineRegion}) and
 * refresh the size summary.
 */
export function withOfflineRegions(
  manifest: ProjectManifest,
  regions: BundleOfflineRegion[],
  now: string,
): ProjectManifest {
  return {
    ...manifest,
    offlineRegions: [...regions],
    updatedAt: now,
    totals: bundleTotals({ files: manifest.files, offlineRegions: regions }),
  };
}

/**
 * Check every listed file against the manifest: present, and hashing to the
 * recorded value.
 *
 * A missing file is reported, not thrown: the caller shows the list and offers
 * to find it again (issue #11, point 3). A hash mismatch is reported the same
 * way — it means the file changed outside the app, which is a user-visible
 * fact rather than a crash.
 */
export async function verifyBundle(
  store: BundleStore,
  manifest: ProjectManifest,
): Promise<BundleVerification> {
  const missing: BundleFileEntry[] = [];
  const mismatched: BundleVerification["mismatched"] = [];
  let ok = 0;
  for (const entry of manifest.files) {
    let bytes: Uint8Array;
    try {
      bytes = await store.read(entry.path);
    } catch {
      missing.push(entry);
      continue;
    }
    const actualSha256 = await sha256Hex(bytes);
    if (actualSha256 === entry.sha256 && bytes.byteLength === entry.bytes) {
      ok += 1;
    } else {
      mismatched.push({ entry, actualSha256 });
    }
  }
  return { missing, mismatched, ok };
}

/**
 * Open a bundle: read the manifest, then check its files.
 *
 * Reading the manifest is the only way in. A directory without one is not a
 * bundle, and reporting that is better than opening an empty project that looks
 * like the user's data vanished.
 */
export async function openBundle(store: BundleStore): Promise<OpenedBundle> {
  const manifest = await readManifest(store);
  const verification = await verifyBundle(store, manifest);
  const status =
    verification.missing.length === 0 && verification.mismatched.length === 0 ? "ok" : "incomplete";
  return { manifest, status, verification };
}

/**
 * Delete a project bundle: every file the store lists, then the directory's
 * contents are gone.
 *
 * The store is scoped to one project directory, so "everything it lists" cannot
 * reach another project or the user's own files. The manifest is included
 * explicitly even if a store implementation somehow omits it from `list()`.
 * Returns the paths removed, so the caller can show what happened.
 */
export async function deleteBundle(store: BundleStore): Promise<string[]> {
  const listed = new Set(await store.list());
  listed.add(PROJECT_MANIFEST_FILE);
  const removed: string[] = [];
  for (const path of [...listed].sort()) {
    if (!isSafeBundlePath(path)) continue;
    try {
      await store.remove(path);
      removed.push(path);
    } catch (error) {
      // Keep going: one unremovable file must not leave the rest behind. The
      // caller compares `removed` with `listed` to report what survived.
      console.warn(`Could not remove bundled file ${path}`, error);
    }
  }
  return removed;
}
