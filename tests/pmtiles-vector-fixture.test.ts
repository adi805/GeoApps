import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, it } from "node:test";
import { Compression, PMTiles, TileType } from "pmtiles";

/**
 * Kenapa fixture ini ada, dan kenapa bukan `mini.pmtiles`.
 *
 * `tests/fixtures/mini.pmtiles` adalah arsip RASTER (ubin PNG). Gaya basemap offline
 * GeoLibre adalah gaya VEKTOR (Protomaps/light). Waktu probe render memakai arsip
 * raster, peta tetap kosong walau byte-nya benar-benar sampai ke MapLibre, karena
 * vector source tidak bisa melukis PNG. Kesimpulan "basemap offline rusak" jadi
 * salah sasaran gara-gara fixture-nya, bukan gara-gara kodenya.
 *
 * `mini-vector.pmtiles` (25 KB, z0-z4, satu layer `water` yang menutupi dunia) dibuat
 * khusus supaya pertanyaan "apakah tile offline benar-benar dilukis" bisa dijawab.
 * Generatornya ikut di repo: `scripts/gen-vector-pmtiles-fixture.py`.
 *
 * Tes ini menjaga fixture itu tetap arsip MVT yang sah, bukan cuma file biner yang
 * kebetulan ada. Kalau ada yang menggantinya balik ke raster, tes ini merah.
 */

const fixture = new Uint8Array(
  readFileSync(fileURLToPath(new URL("./fixtures/mini-vector.pmtiles", import.meta.url))),
);
const rasterFixture = new Uint8Array(
  readFileSync(fileURLToPath(new URL("./fixtures/mini.pmtiles", import.meta.url))),
);

/** Membaca arsip dari byte lewat reader pmtiles referensi, bukan parser buatan sendiri. */
function referenceReader(bytes: Uint8Array): PMTiles {
  return new PMTiles({
    getKey: () => "test",
    getBytes: async (offset: number, length: number) => {
      const view = bytes.slice(offset, offset + length);
      return { data: view.buffer };
    },
  });
}

describe("fixture mini-vector.pmtiles", () => {
  it("adalah arsip PMTiles v3 yang diterima reader referensi", () => {
    assert.equal(new TextDecoder().decode(fixture.subarray(0, 7)), "PMTiles");
    assert.equal(fixture[7], 3, "versi header 3");
  });

  it("berisi tile vektor terkompresi gzip, bukan raster", async () => {
    const header = await referenceReader(fixture).getHeader();
    assert.equal(header.tileType, TileType.Mvt, "tile_type harus MVT");
    assert.equal(header.tileCompression, Compression.Gzip, "kompresi gzip");
    assert.equal(header.minZoom, 0);
    assert.equal(header.maxZoom, 4);

    // Fixture raster lama tetap raster: pemisahan dua fixture ini yang membuat
    // kesimpulan probe bisa dibedakan (byte sampai vs vector dilukis).
    const rasterHeader = await referenceReader(rasterFixture).getHeader();
    assert.equal(rasterHeader.tileType, TileType.Png);
    assert.notEqual(rasterHeader.tileType, header.tileType);
  });

  it("menamai layer water di metadata supaya gaya vector punya sesuatu untuk dilukis", async () => {
    const meta = (await referenceReader(fixture).getMetadata()) as {
      format?: string;
      vector_layers?: { id: string }[];
    };
    assert.equal(meta.format, "pbf");
    assert.deepEqual(
      (meta.vector_layers ?? []).map((l) => l.id),
      ["water"],
    );
  });

  it("menjawab ubin di tiap zoom, dan ubinnya MVT yang menyebut layer water", async () => {
    const archive = referenceReader(fixture);
    for (const [z, x, y] of [
      [0, 0, 0],
      [2, 1, 2],
      [3, 2, 4],
    ] as const) {
      const tile = await archive.getZxy(z, x, y);
      assert.ok(tile, `ubin z${z}/${x}/${y} harus ada`);
      let mvt = new Uint8Array(tile.data);
      // Reader pmtiles sudah membuka kompresi header, jadi ubin biasanya datang
      // sebagai MVT mentah; kalau masih ber-gzip, buka dulu supaya tes tidak
      // bergantung pada perilaku reader satu versi.
      if (mvt[0] === 0x1f && mvt[1] === 0x8b) mvt = gunzipSync(mvt);
      assert.ok(mvt.byteLength > 0, `ubin z${z}/${x}/${y} tidak kosong`);
      assert.ok(
        Buffer.from(mvt).includes("water"),
        `ubin z${z}/${x}/${y} menyebut layer water`,
      );
    }
  });

  it("tetap kecil supaya layak di-commit", () => {
    assert.ok(
      fixture.byteLength < 64 * 1024,
      `fixture ${fixture.byteLength} byte melewati batas 64 KB`,
    );
  });
});
