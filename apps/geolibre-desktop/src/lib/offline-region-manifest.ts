/**
 * Bridge between the device-local offline-region catalogue and the portable
 * project manifest.
 *
 * `offline-regions.ts` records what *this* device has downloaded: tile URLs,
 * asset URLs, and epoch-ms timestamps. `project.json` must not carry any of
 * that. A bundle moves between devices, so the URLs a region warmed here are
 * meaningless on a phone with a different cache, and a numeric timestamp is not
 * something a hand-edited manifest should hold. What a bundle does need is the
 * *identity* of the area the project depends on: bounds, zoom range, how many
 * tiles it costs, and which hosts serve them.
 *
 * So this module is a lossy adapter by design, and the loss is the point:
 *   - `tileUrls` / `assetUrls` are dropped (device-scoped, and huge);
 *   - `createdAt` / `updatedAt` are dropped (device-scoped, and the manifest
 *     already has its own `updatedAt`);
 *   - `bbox` and `hosts` are copied, never aliased, so mutating the manifest
 *     can never corrupt the catalogue that is still in `localStorage`.
 *
 * `bytes` is optional: only a caller that has already measured the region (via
 * `measureRegionBytes`) can fill it, and a manifest without it is still valid.
 *
 * This file imports no Tauri, DOM or React code so the mapping rules are
 * testable in plain Node.
 */

import type { OfflineRegion } from "./offline-regions";
import type { BundleOfflineRegion, ProjectManifest } from "./project-manifest";
import { withOfflineRegions } from "./project-manifest";

/** Sizes keyed by region id, as returned by `measureRegionBytes` per region. */
export type RegionByteSizes = ReadonlyMap<string, number>;

/**
 * Map one catalogue record onto its bundle form.
 *
 * `bytes` is only recorded when it is a finite, non-negative number; a
 * measurement that failed (NaN, Infinity, negative) is treated as unknown
 * rather than written into the manifest as a lie about disk usage.
 */
export function bundleRegionFromOfflineRegion(
  region: OfflineRegion,
  bytes?: number,
): BundleOfflineRegion {
  const mapped: BundleOfflineRegion = {
    id: region.id,
    name: region.name,
    bbox: [region.bbox[0], region.bbox[1], region.bbox[2], region.bbox[3]],
    minZoom: region.minZoom,
    maxZoom: region.maxZoom,
    tileCount: region.tileCount,
    hosts: [...region.hosts],
  };
  if (typeof bytes === "number" && Number.isFinite(bytes) && bytes >= 0) {
    mapped.bytes = bytes;
  }
  return mapped;
}

/** Map the whole catalogue, looking each region's size up by id when known. */
export function bundleRegionsFromOfflineRegions(
  regions: readonly OfflineRegion[],
  sizes?: RegionByteSizes,
): BundleOfflineRegion[] {
  return regions.map((region) => bundleRegionFromOfflineRegion(region, sizes?.get(region.id)));
}

/**
 * Write the catalogue's regions into a manifest and recompute its totals.
 *
 * The regions replace whatever the manifest held: the catalogue is the truth
 * for *this* device, so a region deleted here disappears from the bundle too.
 */
export function applyOfflineRegions(
  manifest: ProjectManifest,
  regions: readonly OfflineRegion[],
  now: string,
  sizes?: RegionByteSizes,
): ProjectManifest {
  return withOfflineRegions(manifest, bundleRegionsFromOfflineRegions(regions, sizes), now);
}

/**
 * Regions the project expects but this device has not downloaded.
 *
 * Reopening a bundle on a fresh install is exactly this case: the manifest
 * lists the areas the project needs, `localStorage` is empty, and the UI has to
 * say "download these" instead of silently showing blank tiles. Returned in
 * manifest order, by id, so the prompt is stable between runs.
 */
export function missingOfflineRegions(
  manifest: ProjectManifest,
  deviceRegions: readonly OfflineRegion[],
): BundleOfflineRegion[] {
  const present = new Set(deviceRegions.map((region) => region.id));
  return manifest.offlineRegions.filter((region) => !present.has(region.id));
}
