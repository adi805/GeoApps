/**
 * Region mapping rules for portable project bundles (issue #11).
 *
 * The catalogue in `offline-regions.ts` is device-local; `project.json` travels
 * between devices. These tests pin the lossy boundary: what survives, what is
 * dropped on purpose, and that a manifest never aliases live catalogue arrays.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OfflineRegion } from "./offline-regions";
import {
  applyOfflineRegions,
  bundleRegionFromOfflineRegion,
  bundleRegionsFromOfflineRegions,
  missingOfflineRegions,
} from "./offline-region-manifest";
import { createManifest, parseManifest, serializeManifest } from "./project-manifest";

function region(overrides: Partial<OfflineRegion> = {}): OfflineRegion {
  return {
    id: "110.0000,-8.0000,111.0000,-7.0000@8-14",
    name: "Yogyakarta",
    bbox: [110, -8, 111, -7],
    minZoom: 8,
    maxZoom: 14,
    tileUrls: [
      "https://tiles.openfreemap.org/planet/8/210/120.png",
      "https://tiles.openfreemap.org/planet/9/420/240.png",
    ],
    assetUrls: ["https://tiles.openfreemap.org/styles/liberty/style.json"],
    tileCount: 2,
    hosts: ["tiles.openfreemap.org"],
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_900_000,
    ...overrides,
  };
}

describe("bundleRegionFromOfflineRegion", () => {
  it("keeps bounds, zoom range, tile count and hosts", () => {
    const mapped = bundleRegionFromOfflineRegion(region());
    assert.deepEqual(mapped.bbox, [110, -8, 111, -7]);
    assert.equal(mapped.minZoom, 8);
    assert.equal(mapped.maxZoom, 14);
    assert.equal(mapped.tileCount, 2);
    assert.deepEqual(mapped.hosts, ["tiles.openfreemap.org"]);
    assert.equal(mapped.id, region().id);
    assert.equal(mapped.name, "Yogyakarta");
  });

  it("drops device-scoped URLs and timestamps", () => {
    const mapped = bundleRegionFromOfflineRegion(region()) as unknown as Record<string, unknown>;
    assert.equal("tileUrls" in mapped, false);
    assert.equal("assetUrls" in mapped, false);
    assert.equal("createdAt" in mapped, false);
    assert.equal("updatedAt" in mapped, false);
  });

  it("copies bbox and hosts instead of aliasing them", () => {
    const source = region();
    const mapped = bundleRegionFromOfflineRegion(source);
    source.bbox[0] = 0;
    source.hosts.push("evil.example");
    assert.deepEqual(mapped.bbox, [110, -8, 111, -7]);
    assert.deepEqual(mapped.hosts, ["tiles.openfreemap.org"]);
  });

  it("records a measured size only when it is a real number", () => {
    assert.equal(bundleRegionFromOfflineRegion(region(), 0).bytes, 0);
    assert.equal(bundleRegionFromOfflineRegion(region(), 4096).bytes, 4096);
    assert.equal(bundleRegionFromOfflineRegion(region(), Number.NaN).bytes, undefined);
    assert.equal(bundleRegionFromOfflineRegion(region(), Number.POSITIVE_INFINITY).bytes, undefined);
    assert.equal(bundleRegionFromOfflineRegion(region(), -1).bytes, undefined);
    assert.equal(bundleRegionFromOfflineRegion(region()).bytes, undefined);
  });
});

describe("bundleRegionsFromOfflineRegions", () => {
  it("maps every region and looks sizes up by id", () => {
    const first = region();
    const second = region({ id: "112.0000,-8.0000,113.0000,-7.0000@8-14", name: "Surabaya" });
    const sizes = new Map([[second.id, 2048]]);
    const mapped = bundleRegionsFromOfflineRegions([first, second], sizes);
    assert.equal(mapped.length, 2);
    assert.deepEqual(
      mapped.map((entry) => entry.name),
      ["Yogyakarta", "Surabaya"],
    );
    assert.equal(mapped[0].bytes, undefined);
    assert.equal(mapped[1].bytes, 2048);
  });

  it("returns an empty list for an empty catalogue", () => {
    assert.deepEqual(bundleRegionsFromOfflineRegions([]), []);
  });
});

describe("applyOfflineRegions", () => {
  it("replaces the manifest regions and recomputes totals", () => {
    const manifest = createManifest({ projectId: "kebun-utara", name: "Kebun Utara", now: "2026-10-19T10:00:00.000Z" });
    const sizes = new Map([[region().id, 8192]]);
    const updated = applyOfflineRegions(manifest, [region()], "2026-10-19T11:00:00.000Z", sizes);

    assert.equal(updated.offlineRegions.length, 1);
    assert.equal(updated.offlineRegions[0].bytes, 8192);
    assert.equal(updated.totals.offlineRegionBytes, 8192);
    assert.equal(updated.createdAt, "2026-10-19T10:00:00.000Z");
    assert.equal(updated.updatedAt, "2026-10-19T11:00:00.000Z");
    assert.notEqual(updated, manifest);
    assert.equal(manifest.offlineRegions.length, 0);
  });

  it("drops a region deleted on this device from the bundle", () => {
    const manifest = createManifest({
      projectId: "kebun-utara",
      name: "Kebun Utara",
      now: "2026-10-19T10:00:00.000Z",
      offlineRegions: [bundleRegionFromOfflineRegion(region(), 1024)],
    });
    assert.equal(manifest.totals.offlineRegionBytes, 1024);

    const cleared = applyOfflineRegions(manifest, [], "2026-10-19T11:00:00.000Z");
    assert.deepEqual(cleared.offlineRegions, []);
    assert.equal(cleared.totals.offlineRegionBytes, 0);
  });

  it("survives a round trip through serialize and parse", () => {
    const manifest = applyOfflineRegions(
      createManifest({ projectId: "kebun-utara", name: "Kebun Utara", now: "2026-10-19T10:00:00.000Z" }),
      [region()],
      "2026-10-19T10:00:00.000Z",
      new Map([[region().id, 512]]),
    );
    const reparsed = parseManifest(serializeManifest(manifest));
    assert.equal(reparsed.offlineRegions.length, 1);
    assert.equal(reparsed.offlineRegions[0].name, "Yogyakarta");
    assert.equal(reparsed.offlineRegions[0].bytes, 512);
    assert.deepEqual(reparsed.offlineRegions[0].hosts, ["tiles.openfreemap.org"]);
  });
});

describe("missingOfflineRegions", () => {
  it("lists regions the project needs but this device lacks", () => {
    const kept = region();
    const absent = region({ id: "112.0000,-8.0000,113.0000,-7.0000@8-14", name: "Surabaya" });
    const manifest = createManifest({
      projectId: "kebun-utara",
      name: "Kebun Utara",
      now: "2026-10-19T10:00:00.000Z",
      offlineRegions: [kept, absent].map((entry) => bundleRegionFromOfflineRegion(entry)),
    });

    const missing = missingOfflineRegions(manifest, [kept]);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].name, "Surabaya");
  });

  it("is empty when every region is present, and when the manifest needs none", () => {
    const manifest = createManifest({
      projectId: "kebun-utara",
      name: "Kebun Utara",
      now: "2026-10-19T10:00:00.000Z",
      offlineRegions: [bundleRegionFromOfflineRegion(region())],
    });
    assert.deepEqual(missingOfflineRegions(manifest, [region()]), []);

    const bare = createManifest({ projectId: "kebun-utara", name: "Kebun Utara", now: "2026-10-19T10:00:00.000Z" });
    assert.deepEqual(missingOfflineRegions(bare, []), []);
  });
});
