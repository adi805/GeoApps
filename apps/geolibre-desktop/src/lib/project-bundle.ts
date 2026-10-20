/**
 * Portable project bundles: the file operations over a manifest.
 *
 * The manifest itself — schema, types, path safety, SHA-256 — lives in
 * `project-manifest.ts`. This module is the half that touches bytes: copy a
 * file in, verify what is there, open a project, delete one.
 *
 * Everything here goes through a {@link BundleStore}, which is bound to exactly
 * one project directory. That binding is the deletion guarantee: `deleteBundle`
 * removes what the store lists plus the manifest, so it cannot reach another
 * project or a file the user owns. It imports no Tauri, DOM or React code, so
 * every rule is testable in plain Node.
 */

import type {
  BundleFileEntry,
  BundleFileKind,
  BundleStore,
  BundleVerification,
  OpenedBundle,
  ProjectManifest,
} from "./project-manifest";
import {
  PROJECT_MANIFEST_FILE,
  UnsafeBundlePathError,
  assertSafeBundlePath,
  bundleFileKind,
  bundleTotals,
  isSafeBundlePath,
  readManifest,
  sha256Hex,
} from "./project-manifest";

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
