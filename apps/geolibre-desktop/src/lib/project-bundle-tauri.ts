/**
 * The Tauri (desktop + Android) side of a portable project bundle: a
 * {@link BundleStore} bound to `projects/<slug>/` under the app's local data
 * directory.
 *
 * Why the app's private data directory and not wherever the project came from:
 * a `.geolibre.json` opened from device storage on Android is identified by a
 * `content://` SAF URI whose read grant dies with the process (see
 * `startup-project-snapshot.ts` for the full story). Copying the files into a
 * directory the app owns makes the bundle readable after a restart, and the
 * relative paths in `project.json` make it movable to another device.
 *
 * Every path here is RELATIVE and every fs-plugin call carries
 * `baseDir: BaseDirectory.AppLocalData`. That is deliberate: an absolute path
 * built from `appLocalDataDir()` would need the fs scope to grant
 * `$APPLOCALDATA/projects/**`, and on Android the absolute root can differ
 * between the JS and the Rust side. With a base directory the plugin resolves
 * the path itself, so the scope entry is just `projects/**` and this store
 * needs no grant for the root it does not create.
 *
 * The I/O is injected ({@link BundleDirIo}) rather than imported, for two
 * reasons: the store's path rules — traversal, separators, recursive listing —
 * are then testable in plain Node, and `@tauri-apps/plugin-fs` is only loaded
 * when a caller actually builds a store, so importing this module costs nothing
 * in a web build. {@link tauriBundleDirIo} is the real binding.
 *
 * Scope: the fs plugin refuses paths outside the `fs:scope` allowlist in
 * `src-tauri/capabilities/default.json`. That file needs one entry for bundles,
 * `projects/**` (resolved against the base directory above), and
 * `capabilities/**` is outside the `offline` lane, so the entry is recorded as
 * the lane `android` request for issue #11. Until it lands, every write here
 * fails with "forbidden path". No absolute-path entry is required.
 */

import type { BaseDirectory, DirEntry } from "@tauri-apps/plugin-fs";

import type { BundleStore } from "./project-manifest";
import {
  PROJECT_MANIFEST_FILE,
  UnsafeBundlePathError,
  assertSafeBundlePath,
  isSafeBundlePath,
} from "./project-manifest";
import { joinLocalPath } from "./file-io/paths";

/**
 * Directory under the app's local data root that holds every project bundle.
 *
 * SYNC: `src-tauri/capabilities/default.json` names this path literally in its
 * `fs:scope` entry, so renaming it here alone makes every write fail with
 * "forbidden path".
 */
export const BUNDLE_PROJECTS_DIR = "projects";

/** One directory entry, the shape both the fs plugin and a test fake can give. */
export interface BundleDirEntry {
  name: string;
  isDirectory: boolean;
}

/**
 * The directory operations a bundle store needs.
 *
 * Every path is relative to `BaseDirectory.AppLocalData`; an implementation
 * must refuse an absolute one rather than treat it as relative, because the
 * whole point of the base directory is that the store never names a root.
 *
 * Deliberately narrower than the fs plugin: no text reads, no stat, no rename.
 * `mkdir` is called with `{ recursive: true }` by the store, so an
 * implementation may assume nested creation.
 */
export interface BundleDirIo {
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array>;
  readDir: (path: string) => Promise<BundleDirEntry[]>;
  remove: (path: string) => Promise<void>;
}

/** A store that also exposes where it is bound, for the UI and for logging. */
export interface TauriBundleStore extends BundleStore {
  /** Project directory relative to app-local data, e.g. `projects/kebun-utara`. */
  readonly root: string;
  /** Path of this project's `project.json`, e.g. `projects/kebun-utara/project.json`. */
  readonly manifestPath: string;
}

/**
 * Directory of one project bundle, relative to app-local data.
 *
 * `slug` must already be a slug (see `projectSlug`); a value that could climb
 * out of the projects directory is rejected rather than sanitised, because a
 * silently-rewritten path would put one project's files inside another's.
 */
export function bundleProjectRoot(slug: string): string {
  if (!isSafeBundlePath(slug) || slug.includes("/")) throw new UnsafeBundlePathError(slug);
  return joinLocalPath(BUNDLE_PROJECTS_DIR, slug);
}

/**
 * Resolve a bundle-relative path against the project directory.
 *
 * The same `assertSafeBundlePath` the manifest uses, so a store call can never
 * reach outside its project even if a caller hands it a hand-built manifest.
 */
export function resolveBundlePath(root: string, relativePath: string): string {
  const safe = assertSafeBundlePath(relativePath);
  return safe.split("/").reduce((dir, segment) => joinLocalPath(dir, segment), root);
}

/** Parent directory of a path, separator style preserved. */
function parentOf(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index > 0 ? path.slice(0, index) : path;
}

/**
 * Build a store over `projects/<slug>/` under app-local data.
 *
 * @param slug - Already-slugged project directory name.
 * @param io - Directory operations; defaults to the real fs plugin binding.
 */
export async function createTauriBundleStore(
  slug: string,
  io?: BundleDirIo,
): Promise<TauriBundleStore> {
  const dirIo = io ?? (await tauriBundleDirIo());
  const root = bundleProjectRoot(slug);

  return {
    root,
    manifestPath: resolveBundlePath(root, PROJECT_MANIFEST_FILE),
    async write(relativePath, bytes) {
      const target = resolveBundlePath(root, relativePath);
      await dirIo.mkdir(parentOf(target), { recursive: true });
      await dirIo.writeFile(target, bytes);
    },
    async read(relativePath) {
      return dirIo.readFile(resolveBundlePath(root, relativePath));
    },
    async list() {
      return listFilesRecursively(dirIo, root, "");
    },
    async remove(relativePath) {
      await dirIo.remove(resolveBundlePath(root, relativePath));
    },
  };
}

/**
 * Every file under `root`, as POSIX-relative paths.
 *
 * Directories are walked, not reported. A directory that disappeared between
 * listing and descending (a concurrent delete) is skipped rather than failing
 * the whole listing, which is what `deleteBundle` needs to keep making progress.
 */
export async function listFilesRecursively(
  io: Pick<BundleDirIo, "readDir">,
  root: string,
  prefix: string,
): Promise<string[]> {
  let entries: BundleDirEntry[];
  try {
    entries = await io.readDir(prefix === "" ? root : resolveBundlePath(root, prefix));
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...(await listFilesRecursively(io, root, path)));
    } else {
      files.push(path);
    }
  }
  return files.sort();
}

/**
 * Slugs of every project bundle on this device.
 *
 * Used by "Open project bundle" before a project is chosen: it only needs the
 * directory names, and reading each `project.json` to get a display name is the
 * caller's decision (a corrupt bundle should still appear, so it can be
 * deleted). A missing `projects/` directory means no bundles, not an error.
 */
export async function listBundleProjectSlugs(
  io: Pick<BundleDirIo, "readDir">,
): Promise<string[]> {
  let entries: BundleDirEntry[];
  try {
    entries = await io.readDir(BUNDLE_PROJECTS_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory && isSafeBundlePath(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * The fs-plugin surface the real binding uses. Injectable so a Node test can
 * assert what actually reaches the plugin: relative path, explicit `baseDir`.
 */
export interface TauriFsModules {
  fs: {
    mkdir: (
      path: string,
      options?: { recursive?: boolean; baseDir?: BaseDirectory },
    ) => Promise<void>;
    writeFile: (
      path: string,
      bytes: Uint8Array,
      options?: { baseDir?: BaseDirectory },
    ) => Promise<void>;
    readFile: (path: string, options?: { baseDir?: BaseDirectory }) => Promise<Uint8Array>;
    readDir: (path: string, options?: { baseDir?: BaseDirectory }) => Promise<DirEntry[]>;
    remove: (path: string, options?: { baseDir?: BaseDirectory }) => Promise<void>;
  };
  BaseDirectory: { AppLocalData: BaseDirectory };
}

/**
 * The real fs-plugin binding.
 *
 * Imported lazily so this module stays importable in Node and in a web build.
 * `remove` is called without `{ recursive: true }` on purpose: a bundle's files
 * are removed one by one, so a bug in the listing can never take a whole
 * directory tree with it.
 *
 * @param load - Module loader; defaults to the real `@tauri-apps/plugin-fs`.
 */
export async function tauriBundleDirIo(
  load: () => Promise<TauriFsModules> = loadTauriFs,
): Promise<BundleDirIo> {
  const modules = await load();
  const baseDir = modules.BaseDirectory.AppLocalData;
  return {
    mkdir: (path, options) => modules.fs.mkdir(path, { ...options, baseDir }),
    writeFile: (path, bytes) => modules.fs.writeFile(path, bytes, { baseDir }),
    readFile: (path) => modules.fs.readFile(path, { baseDir }),
    readDir: (path) => modules.fs.readDir(path, { baseDir }),
    remove: (path) => modules.fs.remove(path, { baseDir }),
  };
}

/** Load the real plugin; separate so the dynamic import stays in one place. */
async function loadTauriFs(): Promise<TauriFsModules> {
  const fs = await import("@tauri-apps/plugin-fs");
  return { fs, BaseDirectory: fs.BaseDirectory };
}
