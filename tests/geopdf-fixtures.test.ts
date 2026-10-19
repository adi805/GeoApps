/**
 * Fixture GeoPDF: berkasnya utuh, dan angka acuannya masuk akal.
 *
 * Uji ini menjaga bahan, bukan parser. Yang dibuktikan di sini: keempat berkas
 * ada, byte-nya sama dengan yang tercatat (sha256), kamus georeferensinya
 * memang yang diklaim, dan batas WGS84 di README terbaca sebagai angka yang
 * sahih. Parser GeoPDF belum diuji di sini; itu issue #7 di lane `geo-pdf`.
 *
 * Nilai acuan README sengaja diperiksa ulang terhadap berkasnya sendiri kalau
 * `gdalinfo` terpasang: angka yang diketik dari ingatan akan gagal di sini,
 * sementara angka hasil hitung akan lolos.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const FIXTURES = fileURLToPath(new URL("./fixtures/geopdf/", import.meta.url));
const README = join(FIXTURES, "README.md");
const SUMS = join(FIXTURES, "SHA256SUMS");

type Bounds = { west: number; south: number; east: number; north: number };

type Fixture = {
  file: string;
  bytes: number;
  sha256: string;
  pages: number;
  /** Kamus georeferensi yang diklaim README: "/VP", "/LGIDict", atau "-". */
  dictionary: string;
  epsg: number | null;
  bounds: Bounds | null;
};

/** Sel tabel Markdown, tanpa pipa pinggir dan tanpa backtick pembungkus. */
function cells(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/^`|`$/g, ""));
}

/**
 * Baris tabel di README yang mendaftar berkas. Dua tabel lain di README (asal
 * berkas, dan rincian) sengaja dilewati karena kolomnya berbeda: yang dipakai
 * hanya baris dengan sepuluh kolom dan nama berkas `.pdf` di kolom pertama.
 */
function readFixtures(): Fixture[] {
  const lines = readFileSync(README, "utf8").split("\n");
  const rows: Fixture[] = [];

  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const columns = cells(line);
    if (columns.length !== 10 || !columns[0].endsWith(".pdf")) continue;

    const [file, bytes, sha256, pages, dictionary, epsg, west, south, east, north] = columns;
    const numeric = (value: string) => (value === "-" ? null : Number(value));
    const bound = numeric(west);
    rows.push({
      file,
      bytes: Number(bytes),
      sha256,
      pages: Number(pages),
      dictionary,
      epsg: numeric(epsg),
      bounds:
        bound === null
          ? null
          : {
              west: bound,
              south: numeric(south) as number,
              east: numeric(east) as number,
              north: numeric(north) as number,
            },
    });
  }

  return rows;
}

function sha256Of(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Isi berkas sebagai latin1, cukup untuk mencari nama kunci PDF tanpa salah tafsir UTF-8. */
function rawPdf(path: string): string {
  return readFileSync(path).toString("latin1");
}

const fixtures = readFixtures();
const georeferenced = fixtures.filter((fixture) => fixture.dictionary !== "-");
const plain = fixtures.filter((fixture) => fixture.dictionary === "-");

describe("fixture GeoPDF", () => {
  it("mendaftar minimal empat berkas PDF di README", () => {
    assert.ok(fixtures.length >= 4, `README hanya mendaftar ${fixtures.length} berkas`);
  });

  it("mencakup kamus /VP, /LGIDict, dan satu berkas tanpa georeferensi", () => {
    const dictionaries = fixtures.map((fixture) => fixture.dictionary).sort();
    assert.deepEqual(dictionaries, ["-", "/LGIDict", "/VP", "/VP"]);
    assert.equal(plain.length, 1, "harus ada tepat satu berkas negatif tanpa georeferensi");
  });

  it("tidak memuat PDF yang tidak tercatat di README", () => {
    const onDisk = readdirSync(FIXTURES)
      .filter((name) => name.endsWith(".pdf"))
      .sort();
    const recorded = fixtures.map((fixture) => fixture.file).sort();
    assert.deepEqual(onDisk, recorded);
  });

  for (const fixture of fixtures) {
    it(`${fixture.file}: ukuran dan sha256 cocok dengan README`, () => {
      const path = join(FIXTURES, fixture.file);
      const { size } = statSync(path);
      assert.equal(size, fixture.bytes, `ukuran ${fixture.file} berubah`);
      assert.equal(sha256Of(path), fixture.sha256, `isi ${fixture.file} berubah`);
      // Berkas PDF yang masuk akal tidak mungkin kosong atau seukuran gambar penuh.
      assert.ok(size > 500 && size < 5_000_000, `ukuran ${size} byte di luar batas wajar`);
    });

    it(`${fixture.file}: kamus georeferensi sesuai klaim README`, () => {
      const raw = rawPdf(join(FIXTURES, fixture.file));
      const hasViewport = /\/VP\s*\[/.test(raw);
      const hasLgiDict = /\/LGIDict\b/.test(raw);
      const hasMeasure = /\/Measure\b/.test(raw);

      if (fixture.dictionary === "/VP") {
        assert.ok(hasViewport, "README mengklaim /VP tapi berkasnya tidak memuatnya");
        assert.ok(hasMeasure, "array /VP tanpa /Measure tidak bisa dipakai georeferensi");
        assert.ok(!hasLgiDict, "berkas ini tidak boleh memuat /LGIDict");
      } else if (fixture.dictionary === "/LGIDict") {
        assert.ok(hasLgiDict, "README mengklaim /LGIDict tapi berkasnya tidak memuatnya");
        assert.ok(!hasViewport, "berkas ini tidak boleh memuat /VP");
      } else {
        assert.ok(!hasViewport, "berkas negatif tidak boleh memuat /VP");
        assert.ok(!hasLgiDict, "berkas negatif tidak boleh memuat /LGIDict");
        assert.ok(!hasMeasure, "berkas negatif tidak boleh memuat /Measure");
      }
    });
  }

  it("SHA256SUMS sepakat dengan tabel README", () => {
    const sums = new Map<string, string>();
    for (const line of readFileSync(SUMS, "utf8").split("\n")) {
      const match = /^([0-9a-f]{64})\s+(.+\.pdf)$/.exec(line.trim());
      if (match) sums.set(match[2], match[1]);
    }
    assert.equal(sums.size, fixtures.length, "jumlah baris SHA256SUMS tidak sama dengan README");
    for (const fixture of fixtures) {
      assert.equal(sums.get(fixture.file), fixture.sha256, `sha256 ${fixture.file} berbeda`);
    }
  });

  it("batas WGS84 di README terbaca sebagai angka yang masuk akal", () => {
    for (const fixture of georeferenced) {
      const { bounds, epsg, file } = fixture;
      assert.ok(bounds, `${file} bergeoreferensi tapi batasnya kosong`);
      assert.ok(epsg !== null && Number.isInteger(epsg) && epsg > 0, `${file}: EPSG tidak sah`);

      for (const [name, value] of Object.entries(bounds)) {
        assert.ok(Number.isFinite(value), `${file}: ${name} bukan angka (${value})`);
      }
      assert.ok(
        bounds.south >= -90 && bounds.north <= 90 && bounds.south < bounds.north,
        `${file}: lintang di luar -90..90 atau terbalik (${bounds.south}..${bounds.north})`,
      );
      assert.ok(
        bounds.west >= -180 && bounds.east <= 180 && bounds.west < bounds.east,
        `${file}: bujur di luar -180..180 atau terbalik (${bounds.west}..${bounds.east})`,
      );
    }

    for (const fixture of plain) {
      assert.equal(fixture.bounds, null, `${fixture.file}: berkas tanpa georeferensi punya batas`);
      assert.equal(fixture.epsg, null, `${fixture.file}: berkas tanpa georeferensi punya EPSG`);
    }
  });

  it("gdalinfo menguatkan status georeferensi tiap berkas", (t) => {
    if (!hasGdalinfo()) {
      t.skip("gdalinfo tidak ada di PATH; angka README dipakai apa adanya");
      return;
    }

    for (const fixture of plain) {
      const info = gdalinfo(fixture.file);
      assert.ok(
        !/Coordinate System is:/.test(info),
        `${fixture.file} ternyata punya sistem koordinat`,
      );
      assert.ok(!/ID\["EPSG"/.test(info), `${fixture.file} ternyata menyebut EPSG`);
    }

    for (const fixture of georeferenced) {
      const info = gdalinfo(fixture.file);
      assert.ok(
        /Coordinate System is:/.test(info),
        `${fixture.file} tidak punya sistem koordinat menurut gdalinfo`,
      );
      assertClose(fixture, info);
    }
  });
});

function hasGdalinfo(): boolean {
  try {
    execFileSync("gdalinfo", ["--version"], { stdio: "ignore", timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
}

function gdalinfo(file: string): string {
  // stderr dibuang: satu fixture sah memicu peringatan "Non closed ring" dari
  // GDAL sendiri, dan peringatan itu bukan kegagalan uji.
  return execFileSync("gdalinfo", [join(FIXTURES, file)], {
    encoding: "utf8",
    timeout: 60_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/**
 * Hitung ulang batas WGS84 dari origin, pixel size, dan ukuran raster yang
 * dilaporkan `gdalinfo`, lalu bandingkan dengan tabel README.
 *
 * Toleransi 1e-4 derajat (~11 m) dipakai karena README mencatat sudut dalam
 * tiga desimal satuan proyeksi; selisih pembulatan itu tidak boleh membuat uji
 * merah, tapi angka yang dikarang tetap akan jauh di luar toleransi.
 */
function assertClose(fixture: Fixture, info: string): void {
  const origin = /^Origin = \(([-\d.]+),\s*([-\d.]+)\)$/m.exec(info);
  const pixel = /^Pixel Size = \(([-\d.]+),\s*([-\d.]+)\)$/m.exec(info);
  const size = /^Size is (\d+), (\d+)$/m.exec(info);
  const epsg = fixture.epsg as number;
  const expected = fixture.bounds as Bounds;

  assert.ok(origin, `${fixture.file}: gdalinfo tidak melaporkan Origin`);
  assert.ok(pixel, `${fixture.file}: gdalinfo tidak melaporkan Pixel Size`);
  assert.ok(size, `${fixture.file}: gdalinfo tidak melaporkan Size is`);

  const [ox, oy] = [Number(origin[1]), Number(origin[2])];
  const [dx, dy] = [Number(pixel[1]), Number(pixel[2])];
  const [width, height] = [Number(size[1]), Number(size[2])];
  const corners = [
    [ox, oy],
    [ox, oy + dy * height],
    [ox + dx * width, oy],
    [ox + dx * width, oy + dy * height],
  ];

  const transformed = gdaltransform(corners, epsg);
  const lons = transformed.map(([lon]) => lon);
  const lats = transformed.map(([, lat]) => lat);
  const computed: Bounds = {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };

  for (const key of ["west", "south", "east", "north"] as const) {
    assert.ok(
      Math.abs(computed[key] - expected[key]) < 1e-4,
      `${fixture.file}: ${key} README ${expected[key]} vs hitung ${computed[key]}`,
    );
  }
}

function gdaltransform(corners: number[][], epsg: number): number[][] {
  const input = `${corners.map(([x, y]) => `${x} ${y}`).join("\n")}\n`;
  const output = execFileSync(
    "gdaltransform",
    ["-s_srs", `EPSG:${epsg}`, "-t_srs", "EPSG:4326"],
    { input, encoding: "utf8", timeout: 60_000 },
  );
  return output
    .trim()
    .split("\n")
    .map((line) => line.split(/\s+/).slice(0, 2).map(Number));
}
