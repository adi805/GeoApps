/**
 * The Tauri (desktop + Android) side of a portable project bundle: a
 * {@link BundleStore} bound to `$APPLOCALDATA/projects/<slug>/`.
 *
 * Why the app's private data directory and not wherever the project came from:
 * a `.geolibre.json` opened from device storage on Android is identified by a
 * `content://` SAF URI whose read grant dies with the process (see
 * `startup-project-snapshot.ts` for the full story). Copying the files into a
 * directory the app owns makes the bundle readable after a restart, and the
 * relative paths in `project.json` make it movable to another device.
 *
 * The I/O is injected ({@link BundleDirIo}) rather than imported, for two
 * reasons: the store's path rules — traversal, separators, recursive listing —
 * are then testable in plain Node, and `@tauri-apps/plugin-fs` is only loaded
 * when a caller actually builds a store, so importing this module costs nothing
 * in a web build. {@link tauriBundleDirIo} is the real binding.
 *
 * Scope: the fs plugin refuses paths outside the `fs:scope` allowlist in
 * `src-tauri/capabilities/default.json`. That file names
 * `$APPLOCALDATA/projects/**` for bundles — adding it is the lane `android`
 * request recorded for issue #11, because `capabilities/**` is outside the
 * `offline` lane. Until it lands, every write here fails with "forbidden path".
 */

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
 * Deliberately narrower than the fs plugin: no text reads, no stat, no rename.
 * `mkdir` is called with `{ recursive: true }` by the store, so an
 * implementation may assume nested creation.
 */
export interface BundleDirIo {
  /** Absolute path of the app's local data directory (`$APPLOCALDATA`). */
  appLocalDataDir: () => Promise<string>;
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array>;
  readDir: (path: string) => Promise<BundleDirEntry[]>;
  remove: (path: string) => Promise<void>;
}

/** A store that also exposes where it is bound, for the UI and for logging. */
export interface TauriBundleStore extends BundleStore {
  /** Absolute project directory, e.g. `<appLocalData>/projects/kebun-utara`. */
  readonly root: string;
  /** Absolute path of this project's `project.json`. */
  readonly manifestPath: string;
}

/**
 * Absolute directory of one project bundle.
 *
 * `slug` must already be a slug (see `projectSlug`); a value that could climb
 * out of the projects directory is rejected rather than sanitised, because a
 * silently-rewritten path would put one project's files inside another's.
 */
export function bundleProjectRoot(appLocalData: string, slug: string): string {
  if (!isSafeBundlePath(slug) || slug.includes("/")) throw new UnsafeBundlePathError(slug);
  return joinLocalPath(joinLocalPath(appLocalData, BUNDLE_PROJECTS_DIR), slug);
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

/** Join a directory entry name onto its parent, separator style preserved. */
function parentOf(absolutePath: string): string {
  const index = Math.max(absolutePath.lastIndexOf("/"), absolutePath.lastIndexOf("\\"));
  return index > 0 ? absolutePath.slice(0, index) : absolutePath;
}

/**
 * Build a store over `$APPLOCALDATA/projects/<slug>/`.
 *
 * @param slug - Already-slugged project directory name.
 * @param io - Directory operations; defaults to the real fs plugin binding.
 */
export async function createTauriBundleStore(
  slug: string,
  io?: BundleDirIo,
): Promise<TauriBundleStore> {
  const dirIo = io ?? (await tauriBundleDirIo());
  const root = bundleProjectRoot(await dirIo.appLocalDataDir(), slug);

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
  io: Pick<BundleDirIo, "appLocalDataDir" | "readDir">,
): Promise<string[]> {
  const projectsDir = joinLocalPath(await io.appLocalDataDir(), BUNDLE_PROJECTS_DIR);
  let entries: BundleDirEntry[];
  try {
    entries = await io.readDir(projectsDir);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory && isSafeBundlePath(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * The real fs-plugin binding.
 *
 * Imported lazily so this module stays importable in Node and in a web build.
 * `remove` is called without `{ recursive: true }` on purpose: a bundle's files
 * are removed one by one, so a bug in the listing can never take a whole
 * directory tree with it.
 */
export async function tauriBundleDirIo(): Promise<BundleDirIo> {
  const fs = await import("@tauri-apps/plugin-fs");
  const path = await import("@tauri-apps/api/path");
  return {
    appLocalDataDir: () => path.appLocalDataDir(),
    mkdir: (path, options) => fs.mkdir(path, options),
    writeFile: (path, bytes) => fs.writeFile(path, bytes),
    readFile: (path) => fs.readFile(path),
    readDir: (path) => fs.readDir(path),
    remove: (path) => fs.remove(path),
  };
}
