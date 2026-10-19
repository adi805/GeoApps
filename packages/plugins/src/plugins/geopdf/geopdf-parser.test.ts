import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PDFDocument, PDFName, PDFNumber, PDFString } from "pdf-lib";
import {
  affineToBounds,
  firstGeoreferencedPage,
  looksLikePdf,
  parseGeoPdf,
  parseGeoPdfDocument,
} from "./geopdf-parser";

/**
 * Reference values come from `gdalinfo` and are recorded in the fixture README
 * (`tests/fixtures/geopdf/README.md`, issue #6). They are rounded to six
 * decimals there, so the tolerance below matches that precision.
 */
const TOLERANCE = 1e-4;

const WGS84_WKT =
  'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],' +
  'PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]';

/**
 * Fixtures live in the `uji` lane (#19) and are not on `main` yet. A verified
 * copy is vendored under `factory/bahan/geopdf/` (inside this lane's glob) so the
 * suite still runs in CI; the canonical `tests/fixtures/geopdf/` path wins as
 * soon as #19 lands. An explicit override always wins. When nothing is present
 * the fixture suite skips with a message instead of silently passing.
 */
function findFixtureDir(): string | null {
  const candidates = [
    process.env.GEOPDF_FIXTURES,
    join(process.cwd(), "tests", "fixtures", "geopdf"),
    join(process.cwd(), "factory", "bahan", "geopdf"),
    join(homedir(), "GeoApps-uji-fixture-geopdf", "tests", "fixtures", "geopdf"),
  ].filter((dir): dir is string => Boolean(dir));

  for (const dir of candidates) {
    if (existsSync(join(dir, "esri-arcmap-utm20n.pdf"))) return dir;
  }
  return null;
}

const FIXTURE_DIR = findFixtureDir();
const NO_FIXTURES = FIXTURE_DIR
  ? undefined
  : "fixture GeoPDF tidak tersedia (menunggu #19); set GEOPDF_FIXTURES ke direktori fixture";

function readFixture(name: string): Uint8Array {
  assert.ok(FIXTURE_DIR, "fixture directory must exist");
  return readFileSync(join(FIXTURE_DIR, name));
}

function assertClose(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) < TOLERANCE,
    `${label}: expected ${expected} ± ${TOLERANCE}, got ${actual} (selisih ${Math.abs(actual - expected)})`,
  );
}

function assertBounds(
  bounds: { west: number; east: number; south: number; north: number } | null,
  expected: { west: number; east: number; south: number; north: number },
): void {
  assert.ok(bounds, "bounds must be present");
  assertClose(bounds.west, expected.west, "west");
  assertClose(bounds.east, expected.east, "east");
  assertClose(bounds.south, expected.south, "south");
  assertClose(bounds.north, expected.north, "north");
}

/** Build a page carrying an OGC `/LGIDict` with a UTM 48S projection (EPSG:32748). */
async function pdfWithLgiDict(ctm: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([20, 20]);
  page.node.set(
    PDFName.of("LGIDict"),
    doc.context.obj({
      Type: PDFName.of("LGIDict"),
      Version: PDFString.of("2.1"),
      CTM: ctm,
      Projection: doc.context.obj({
        Datum: PDFString.of("WGE"),
        ProjectionType: PDFString.of("UT"),
        Zone: PDFNumber.of(48),
        Hemisphere: PDFString.of("S"),
      }),
    }),
  );
  return doc.save({ useObjectStreams: false });
}

/** Build a page carrying an Adobe/ISO `/VP` → `/Measure` pair. */
async function pdfWithViewport(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([20, 20]);
  const measure = doc.context.obj({
    Type: PDFName.of("Measure"),
    Subtype: PDFName.of("GEO"),
    GCS: doc.context.obj({ Type: PDFName.of("GEOGCS"), WKT: PDFString.of(WGS84_WKT) }),
    Bounds: [0, 0, 1, 1],
    // ISO order is (lat, lon); LPTS runs from the bbox top edge downwards.
    GPTS: [-9, 100, -9, 101, -10, 101, -10, 100],
    LPTS: [0, 0, 1, 0, 1, 1, 0, 1],
  });
  page.node.set(
    PDFName.of("VP"),
    doc.context.obj([
      doc.context.obj({ Type: PDFName.of("Viewport"), BBox: [0, 20, 20, 0], Measure: measure }),
    ]),
  );
  return doc.save({ useObjectStreams: false });
}

describe("parseGeoPdfDocument fixture #6", { skip: NO_FIXTURES }, () => {
  it("reads ESRI /VP with a projected WKT CRS and reprojects to WGS84", async () => {
    const doc = await parseGeoPdfDocument(readFixture("esri-arcmap-utm20n.pdf"));
    assert.equal(doc.status, "ok");
    assert.equal(doc.encrypted, false);
    assert.equal(doc.pageCount, 1);

    const page = doc.pages[0];
    assert.equal(page.status, "ok");
    assert.equal(page.source, "vp");
    assert.equal(page.crs, "WKT:WGS_1984_UTM_Zone_20N");
    assert.equal(page.width, 612);
    assert.equal(page.height, 792);
    assert.equal(page.rotation, 0);
    assertBounds(page.bounds, {
      west: -65.100733,
      south: 43.968223,
      east: -64.405492,
      north: 44.608042,
    });
    assert.equal(page.corners?.length, 4);
  });

  it("reads the QGIS /VP map spanning almost the whole Web Mercator world", async () => {
    const doc = await parseGeoPdfDocument(readFixture("qgis-3.35-getprint.pdf"));
    assert.equal(doc.status, "ok");

    const page = doc.pages[0];
    assert.equal(page.source, "vp");
    assert.equal(page.crs, "WKT:WGS_1984_Web_Mercator_Auxiliary_Sphere");
    assert.equal(page.width, 842);
    assert.equal(page.height, 595);
    assertBounds(page.bounds, {
      west: 4.249555,
      south: -88.9235,
      east: 29.790392,
      north: 88.761125,
    });
  });

  it("reads the OGC /LGIDict map without touching its CRS", async () => {
    const doc = await parseGeoPdfDocument(readFixture("ogc-lgidict.pdf"));
    assert.equal(doc.status, "ok");

    const page = doc.pages[0];
    assert.equal(page.source, "lgidict");
    assert.equal(page.crs, "EPSG:4326");
    assert.equal(page.width, 20);
    assert.equal(page.height, 20);
    assertBounds(page.bounds, { west: 2, south: 48, east: 3, north: 49 });
  });

  it("reports a PDF without dictionaries as no-georeference, not as a failure", async () => {
    const doc = await parseGeoPdfDocument(readFixture("tanpa-georeferensi.pdf"));
    assert.equal(doc.status, "no-georeference");
    assert.equal(doc.pageCount, 2);
    assert.match(doc.message ?? "", /GeoreferencerDialog/);

    for (const page of doc.pages) {
      assert.equal(page.status, "no-georeference");
      assert.equal(page.source, null);
      assert.equal(page.bounds, null);
      assert.equal(page.corners, null);
    }
    assert.equal(firstGeoreferencedPage(doc), null);
  });
});

describe("parseGeoPdfDocument synthetic dictionaries", () => {
  it("rejects a file without a PDF header", async () => {
    const bytes = new TextEncoder().encode("bukan pdf sama sekali");
    assert.equal(looksLikePdf(bytes), false);

    const doc = await parseGeoPdfDocument(bytes);
    assert.equal(doc.status, "unreadable");
    assert.equal(doc.pageCount, 0);
    assert.equal(doc.encrypted, false);
  });

  it("detects an encrypted PDF instead of guessing its dictionaries", async () => {
    const plain = await PDFDocument.create();
    plain.addPage([20, 20]);
    const text = Buffer.from(await plain.save({ useObjectStreams: false })).toString("latin1");
    const encrypted = text.replace(
      "trailer\n<<",
      "trailer\n<<\n/Encrypt << /Filter /Standard /V 1 /R 2 /O <00> /U <00> /P -4 >>",
    );
    assert.ok(encrypted.includes("/Encrypt"), "fixture must carry an /Encrypt entry");

    const doc = await parseGeoPdfDocument(new Uint8Array(Buffer.from(encrypted, "latin1")));
    assert.equal(doc.status, "encrypted");
    assert.equal(doc.encrypted, true);
    assert.match(doc.message ?? "", /terenkripsi/i);
  });

  it("maps a /VP measure in geographic coordinates", async () => {
    const doc = await parseGeoPdfDocument(await pdfWithViewport());
    assert.equal(doc.status, "ok");

    const page = doc.pages[0];
    assert.equal(page.source, "vp");
    assert.equal(page.crs, "EPSG:4326");
    assertBounds(page.bounds, { west: 100, south: -10, east: 101, north: -9 });
    assert.deepEqual(
      page.corners?.map((corner) => [Math.round(corner.lon), Math.round(corner.lat)]),
      [
        [100, -9],
        [101, -9],
        [101, -10],
        [100, -10],
      ],
    );
  });

  it("reprojects a UTM 48S /LGIDict (EPSG:32748) into WGS84", async () => {
    // 20 pt at 100 m/pt is 2000 m; anchored on the zone's central meridian.
    const doc = await parseGeoPdfDocument(await pdfWithLgiDict([100, 0, 0, 100, 500000, 9000000]));
    assert.equal(doc.status, "ok");

    const page = doc.pages[0];
    assert.equal(page.crs, "EPSG:32748");
    assertBounds(page.bounds, {
      west: 105,
      south: -9.046562,
      east: 105.018198,
      north: -9.028472,
    });
  });

  it("reprojects all four corners when the /CTM carries rotation", async () => {
    const flat = await parseGeoPdfDocument(await pdfWithLgiDict([100, 0, 0, 100, 500000, 9000000]));
    const diagonal = 70.7106781;
    const rotated = await parseGeoPdfDocument(
      await pdfWithLgiDict([diagonal, diagonal, -diagonal, diagonal, 500000, 9000000]),
    );

    const flatBounds = flat.pages[0].bounds;
    const rotatedBounds = rotated.pages[0].bounds;
    assert.ok(flatBounds && rotatedBounds);

    // A square rotated 45° has an axis-aligned box sqrt(2) wider than itself.
    const flatWidth = flatBounds.east - flatBounds.west;
    const rotatedWidth = rotatedBounds.east - rotatedBounds.west;
    assert.ok(
      rotatedWidth > flatWidth * 1.35 && rotatedWidth < flatWidth * 1.5,
      `rotated width ${rotatedWidth} should be ~sqrt(2) x ${flatWidth}`,
    );

    // Each corner touches exactly one side of the box; none sits on a box
    // corner. That only holds if every corner was reprojected on its own.
    const corners = rotated.pages[0].corners;
    assert.equal(corners?.length, 4);
    const boxCorners = [
      { lon: rotatedBounds.west, lat: rotatedBounds.south },
      { lon: rotatedBounds.west, lat: rotatedBounds.north },
      { lon: rotatedBounds.east, lat: rotatedBounds.south },
      { lon: rotatedBounds.east, lat: rotatedBounds.north },
    ];
    for (const corner of corners ?? []) {
      const onBoxCorner = boxCorners.some(
        (box) => Math.abs(box.lon - corner.lon) < 1e-9 && Math.abs(box.lat - corner.lat) < 1e-9,
      );
      assert.equal(onBoxCorner, false, "a rotated map must not reuse the axis-aligned box corners");
    }
    const unique = new Set(corners?.map((corner) => `${corner.lon},${corner.lat}`));
    assert.equal(unique.size, 4);
  });

  it("treats every page as its own map", async () => {
    const georeferenced = await pdfWithLgiDict([100, 0, 0, 100, 500000, 9000000]);
    const doc = await PDFDocument.load(georeferenced, { updateMetadata: false });
    doc.addPage([20, 20]);
    const bytes = await doc.save({ useObjectStreams: false });

    const parsed = await parseGeoPdfDocument(bytes);
    assert.equal(parsed.status, "ok");
    assert.equal(parsed.pageCount, 2);
    assert.equal(parsed.pages[0].status, "ok");
    assert.equal(parsed.pages[0].source, "lgidict");
    assert.equal(parsed.pages[1].status, "no-georeference");
    assert.equal(parsed.pages[1].bounds, null);
    assert.equal(firstGeoreferencedPage(parsed)?.index, 0);
  });
});

describe("legacy parseGeoPdf", () => {
  it("returns an Adobe-order affine that affineToBounds turns into the same bounds", async () => {
    const info = await parseGeoPdf(await pdfWithViewport());
    assert.ok(info, "legacy parser must find the viewport");
    assert.equal(info.crs, "EPSG:4326");

    // `parseGeoPdf` feeds `affineToBounds`, which reads Adobe's
    // `[x0, xscale, xrot, y0, yrot, yscale]`. A wrong reorder here still
    // produces a plausible-looking box, so the bounds are asserted exactly.
    const bounds = affineToBounds(info.affine, info.width, info.height);
    assertClose(bounds.west, 100, "west");
    assertClose(bounds.east, 101, "east");
    assertClose(bounds.south, -10, "south");
    assertClose(bounds.north, -9, "north");
  });

  it("returns null for a PDF without georeference", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([20, 20]);
    assert.equal(await parseGeoPdf(await doc.save()), null);
  });
});
