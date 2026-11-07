import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProtomapsBasemapStyle,
  evictOfflineBasemapStyle,
  getOfflineBasemapStyle,
  isOfflineBasemapSentinel,
  registerOfflineBasemapStyle,
} from "../packages/map/src/protomaps-basemap";

describe("buildProtomapsBasemapStyle", () => {
  it("emits a v8 style with a pmtiles vector source and flavor assets", () => {
    const style = buildProtomapsBasemapStyle({
      sourceUrl: "pmtiles://abc.pmtiles",
      flavor: "dark",
    });
    assert.equal(style.version, 8);
    const source = style.sources.protomaps as { type: string; url: string };
    assert.equal(source.type, "vector");
    assert.equal(source.url, "pmtiles://abc.pmtiles");
    // Sprite path carries the flavor; glyphs come from the same asset base.
    assert.match(String(style.sprite), /\/sprites\/v4\/dark$/);
    assert.ok(Array.isArray(style.layers) && style.layers.length > 0);
  });

  it("prefixes a bare source url and honours a sub-path assets base", () => {
    const style = buildProtomapsBasemapStyle({
      sourceUrl: "abc.pmtiles",
      flavor: "light",
      assetsBaseUrl: "/geolibre/basemaps-assets/",
    });
    assert.equal((style.sources.protomaps as { url: string }).url, "pmtiles://abc.pmtiles");
    // Trailing slash is trimmed and the sub-path prefix is kept.
    assert.equal(style.glyphs, "/geolibre/basemaps-assets/fonts/{fontstack}/{range}.pbf");
  });
});

describe("offline-basemap style registry", () => {
  it("registers a unique sentinel per call and resolves it back", () => {
    const style = buildProtomapsBasemapStyle({
      sourceUrl: "pmtiles://x.pmtiles",
      flavor: "light",
    });
    const first = registerOfflineBasemapStyle("id-1", style);
    assert.ok(isOfflineBasemapSentinel(first));
    assert.equal(getOfflineBasemapStyle(first), style);

    // Re-registering the same id mints a *new* sentinel and drops the old one,
    // so the map treats a re-apply (e.g. flavor change) as a real change.
    const second = registerOfflineBasemapStyle("id-1", style);
    assert.notEqual(first, second);
    assert.equal(getOfflineBasemapStyle(first), null);
    assert.equal(getOfflineBasemapStyle(second), style);
  });

  it("evicts every sentinel for an id", () => {
    const style = buildProtomapsBasemapStyle({
      sourceUrl: "pmtiles://y.pmtiles",
      flavor: "light",
    });
    const sentinel = registerOfflineBasemapStyle("id-evict", style);
    assert.equal(getOfflineBasemapStyle(sentinel), style);
    evictOfflineBasemapStyle("id-evict");
    assert.equal(getOfflineBasemapStyle(sentinel), null);
  });

  it("treats non-sentinel urls as not registered", () => {
    assert.equal(isOfflineBasemapSentinel("https://example.com/style.json"), false);
    assert.equal(isOfflineBasemapSentinel(undefined), false);
    assert.equal(getOfflineBasemapStyle(undefined), null);
    assert.equal(getOfflineBasemapStyle("not-a-sentinel"), null);
  });

  it("never re-mints the sentinel a reopened project already carries", () => {
    const style = buildProtomapsBasemapStyle({
      sourceUrl: "pmtiles://reload.pmtiles",
      flavor: "light",
    });
    const scope = globalThis as typeof globalThis & {
      __geolibreOfflineBasemapSeq?: number;
    };
    const current = scope.__geolibreOfflineBasemapSeq;
    try {
      // A fresh process (app restart): the counter is gone but the project file
      // still holds the sentinel an earlier session minted. Minting that same
      // URL again is invisible to the map, which only applies a style when the
      // URL changed, so the restored basemap never reached the screen.
      delete scope.__geolibreOfflineBasemapSeq;
      const sentinel = registerOfflineBasemapStyle("id-reload", style);
      assert.ok(!/\/1$/.test(sentinel), `sentinel must not restart the numbering: ${sentinel}`);
    } finally {
      scope.__geolibreOfflineBasemapSeq = current;
    }
  });
});
