/**
 * The real-device binding for {@link createBundleLibrary}: Tauri's directory
 * operations over the app's own data directory, the absolute root the store
 * sits under, and the app's existing local-file reader.
 *
 * Kept apart from `offline-bundle-library.ts` so that module stays importable
 * in Node: this one pulls `@tauri-apps/api/path` and the fs plugin binding,
 * neither of which resolves in a test process.
 */

import { appLocalDataDir } from "@tauri-apps/api/path";

import { readLocalFileBytes } from "./file-io/local-fs";
import { createBundleLibrary, type BundleLibrary } from "./offline-bundle-library";
import { tauriBundleDirIo } from "./project-bundle-tauri";

/**
 * A bundle library bound to this device.
 *
 * `readLocalFileBytes` is the same reader project-referenced layers already
 * use, so a file the user picked earlier in this session (or a path recorded in
 * a project) is read through the `read_local_file` command when the fs plugin's
 * runtime scope does not cover it.
 *
 * @returns The library, ready to list/save/open.
 */
export async function createDeviceBundleLibrary(): Promise<BundleLibrary> {
  const [dirIo, root] = await Promise.all([tauriBundleDirIo(), appLocalDataDir()]);
  return createBundleLibrary({
    dirIo,
    appLocalDataDir: root,
    readSource: (sourcePath) => readLocalFileBytes(sourcePath),
  });
}
