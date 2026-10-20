/**
 * Uji geofence lapangan (issue #13, bagian 1, 4, 5).
 *
 * Yang dibuktikan: jarak ke batas diukur dalam meter (bukan derajat), posisi
 * tepat di batas tidak memicu peristiwa berulang, zona yang melintasi garis
 * tanggal tetap dinilai benar, jurnal CSV bolak-balik tanpa kolom bergeser, dan
 * pemeriksaan posisi dijarangkan menurut jarak dan waktu.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Feature, Geometry, Position } from "geojson";
import {
  GeofenceMonitor,
  eventsFromCsv,
  eventsToCsv,
  pointInRing,
  unwrapLongitude,
  zoneFromFeature,
  zoneSignedDistance,
  type GeofenceZone,
} from "./maplibre-geofence";

/** Bujur/lintang ke meter pada lintang tertentu (pendekatan lokal). */
const M_PER_DEG_LAT = 111132.92;
const mPerDegLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Geser titik sejauh `meters` ke utara. */
function north(point: Position, meters: number): Position {
  return [point[0], point[1] + meters / M_PER_DEG_LAT];
}

/** Geser titik sejauh `meters` ke timur. */
function east(point: Position, meters: number): Position {
  return [point[0] + meters / mPerDegLng(point[1]), point[1]];
}

/** Bujur "berjalan" (tidak dibungkus) untuk uji, mis. 179,99 + 0,02 = 180,01. */
function ring(points: [number, number][]): Position[] {
  return points.map(([lng, lat]) => [lng, lat] as Position);
}

const CENTER: Position = [106.8, -6.2];

/** Kotak 200 x 200 meter di sekitar CENTER. */
const BOX: GeofenceZone = {
  id: "blok-a",
  name: "Blok A",
  kind: "polygon",
  rings: [
    ring([
      [CENTER[0] - 100 / mPerDegLng(CENTER[1]), CENTER[1] - 100 / M_PER_DEG_LAT],
      [CENTER[0] + 100 / mPerDegLng(CENTER[1]), CENTER[1] - 100 / M_PER_DEG_LAT],
      [CENTER[0] + 100 / mPerDegLng(CENTER[1]), CENTER[1] + 100 / M_PER_DEG_LAT],
      [CENTER[0] - 100 / mPerDegLng(CENTER[1]), CENTER[1] + 100 / M_PER_DEG_LAT],
      [CENTER[0] - 100 / mPerDegLng(CENTER[1]), CENTER[1] - 100 / M_PER_DEG_LAT],
    ]),
  ],
};

const CIRCLE: GeofenceZone = {
  id: "mata-air",
  name: "Mata Air",
  kind: "circle",
  center: CENTER,
  radiusM: 50,
};

describe("jarak ke batas", () => {
  it("mengukur dalam meter, bukan derajat", () => {
    const inside = zoneSignedDistance(BOX, CENTER);
    assert.equal(inside.inside, true);
    // Titik pusat kotak 200x200: 100 meter dari tiap sisi.
    assert.ok(Math.abs(inside.signedM + 100) < 0.5, `jarak ${inside.signedM} m`);

    const outside = zoneSignedDistance(BOX, east(CENTER, 150));
    assert.equal(outside.inside, false);
    assert.ok(Math.abs(outside.signedM - 50) < 0.5, `jarak ${outside.signedM} m`);
  });

  it("memberi tanda positif di luar dan negatif di dalam untuk lingkaran", () => {
    const inside = zoneSignedDistance(CIRCLE, north(CENTER, 30));
    assert.equal(inside.inside, true);
    assert.ok(Math.abs(inside.signedM + 20) < 0.2, `jarak ${inside.signedM} m`);

    const outside = zoneSignedDistance(CIRCLE, north(CENTER, 80));
    assert.equal(outside.inside, false);
    assert.ok(Math.abs(outside.signedM - 30) < 0.2, `jarak ${outside.signedM} m`);
  });

  it("menganggap titik tepat di batas berjarak nol", () => {
    const onEdge = zoneSignedDistance(BOX, east(CENTER, 100));
    assert.ok(Math.abs(onEdge.signedM) < 0.5, `jarak ${onEdge.signedM} m`);
    const onCircle = zoneSignedDistance(CIRCLE, north(CENTER, 50));
    assert.ok(Math.abs(onCircle.signedM) < 0.2, `jarak ${onCircle.signedM} m`);
  });
});

describe("lintas garis tanggal", () => {
  // Kotak 0,02 derajat di kedua sisi meridian 180: separuh di 179,99-180,
  // separuh di -180 sampai -179,99. Tanpa penyesuaian bujur, poligon ini
  // terbaca membentang 360 derajat ke arah yang salah.
  const DATELINE: GeofenceZone = {
    id: "tanggal",
    name: "Lintas Tanggal",
    kind: "polygon",
    rings: [ring([[179.99, -1], [180.01, -1], [180.01, 1], [179.99, 1], [179.99, -1]])],
  };

  it("menilai titik di kedua sisi meridian sebagai di dalam", () => {
    assert.equal(pointInRing([179.995, 0], DATELINE.rings[0]), true);
    assert.equal(pointInRing([-179.995, 0], DATELINE.rings[0]), true);
  });

  it("menilai titik jauh di luar sebagai di luar", () => {
    assert.equal(pointInRing([170, 0], DATELINE.rings[0]), false);
    assert.equal(pointInRing([-170, 0], DATELINE.rings[0]), false);
  });

  it("mengukur jarak ke batas tanpa melompati seluruh bumi", () => {
    const result = zoneSignedDistance(DATELINE, [-179.995, 0]);
    assert.equal(result.inside, true);
    // Batas terdekat 0,005 derajat bujur ~ 556 meter di khatulistiwa.
    assert.ok(result.signedM < 0 && Math.abs(result.signedM) < 700, `jarak ${result.signedM} m`);
  });

  it("menggeser bujur ke jendela 180 derajat dari acuan", () => {
    assert.equal(unwrapLongitude(179.9, -179.9), -180.1);
    assert.equal(unwrapLongitude(-179.9, 179.9), 180.1);
    assert.equal(unwrapLongitude(106.8, 106.8), 106.8);
  });
});

describe("status awal", () => {
  it("posisi pertama menetapkan status tanpa menulis peristiwa", () => {
    const monitor = new GeofenceMonitor({ hysteresisM: 10, minDistanceM: 0, minIntervalMs: 0 });
    monitor.setZones([BOX]);
    assert.equal(monitor.getStatus("blok-a"), "unknown", "sebelum ada posisi, status belum diketahui");

    // Buka aplikasi di dalam zona: bukan peristiwa "masuk".
    assert.deepEqual(monitor.update(CENTER, 0), []);
    assert.equal(monitor.getStatus("blok-a"), "inside");
    assert.equal(monitor.events().length, 0);

    // Buka aplikasi di luar zona: bukan peristiwa "keluar".
    const outside = new GeofenceMonitor({ hysteresisM: 10, minDistanceM: 0, minIntervalMs: 0 });
    outside.setZones([BOX]);
    assert.deepEqual(outside.update(north(CENTER, 500), 0), []);
    assert.equal(outside.getStatus("blok-a"), "outside");
    assert.equal(outside.events().length, 0);
  });

  it("zona yang belum dipantau dilaporkan unknown, bukan dianggap di luar", () => {
    const monitor = new GeofenceMonitor();
    monitor.setZones([BOX]);
    monitor.update(CENTER, 0);
    assert.equal(monitor.getStatus("blok-a"), "inside");
    assert.equal(monitor.getStatus("tidak-ada"), "unknown");
    // Zona yang dilepas membuang statusnya, jadi tidak tersisa status basi.
    monitor.setZones([]);
    assert.equal(monitor.getStatus("blok-a"), "unknown");
  });
});

describe("histeresis di batas", () => {
  it("tidak memicu peristiwa saat posisi tepat di batas", () => {
    const monitor = new GeofenceMonitor({ hysteresisM: 10, minDistanceM: 0, minIntervalMs: 0 });
    monitor.setZones([BOX]);
    // Posisi pertama hanya menetapkan status, tidak menulis peristiwa.
    monitor.update(CENTER, 0);
    const edge = east(CENTER, 100);
    let events = 0;
    for (let i = 0; i < 100; i += 1) {
      // Bergoyang beberapa sentimeter di sekitar batas, seperti GPS yang diam.
      const wobble: Position = [edge[0] + (i % 2 === 0 ? 0.02 : -0.02) / mPerDegLng(CENTER[1]), edge[1]];
      events += monitor.update(wobble, (i + 1) * 1000).length;
    }
    assert.equal(events, 0, "tepat di batas tidak boleh memicu peristiwa");
    assert.equal(monitor.events().length, 0);
  });

  it("baru memicu setelah melewati pita histeresis, satu kali per lintasan", () => {
    const monitor = new GeofenceMonitor({ hysteresisM: 10, minDistanceM: 0, minIntervalMs: 0 });
    monitor.setZones([BOX]);
    monitor.update(CENTER, 0); // mulai di dalam, tanpa peristiwa

    const edge = east(CENTER, 100);
    // Keluar 5 meter: masih di dalam pita, belum dianggap keluar.
    assert.equal(monitor.update(east(edge, 5), 1000).length, 0);
    // Keluar 15 meter: melewati pita, jadi keluar.
    const exitEvents = monitor.update(east(edge, 15), 2000);
    assert.equal(exitEvents.length, 1);
    assert.equal(exitEvents[0].kind, "keluar");
    assert.equal(exitEvents[0].area, "Blok A");
    assert.ok(Math.abs(exitEvents[0].distanceToBoundaryM - 15) < 1, "jarak ke batas tercatat");

    // Masih di luar: tidak ada peristiwa baru.
    assert.equal(monitor.update(east(edge, 40), 3000).length, 0);

    // Masuk kembali 5 meter dari batas: masih di pita, belum dianggap masuk.
    assert.equal(monitor.update(east(edge, 5), 4000).length, 0);
    // Masuk 15 meter: melewati pita ke arah dalam.
    const enterEvents = monitor.update(east(edge, -15), 5000);
    assert.equal(enterEvents.length, 1);
    assert.equal(enterEvents[0].kind, "masuk");
  });

  it("memakai lebar pita dari opsi, bukan angka tetap", () => {
    const wide = new GeofenceMonitor({ hysteresisM: 50, minDistanceM: 0, minIntervalMs: 0 });
    wide.setZones([CIRCLE]);
    wide.update(CENTER, 0);
    const edge = north(CENTER, 50);
    assert.equal(wide.update(north(edge, 20), 1000).length, 0, "pita 50 m menahan 20 m");
    assert.equal(wide.update(north(edge, 60), 2000).length, 1, "60 m melewati pita 50 m");
  });
});

describe("penjarangan pemeriksaan (baterai)", () => {
  it("melewati pemeriksaan saat gerak dan waktu belum cukup", () => {
    const monitor = new GeofenceMonitor({ minDistanceM: 10, minIntervalMs: 15000 });
    monitor.setZones([BOX]);
    assert.equal(monitor.shouldEvaluate(CENTER, 0), true, "posisi pertama selalu diperiksa");
    monitor.update(CENTER, 0);
    assert.equal(monitor.shouldEvaluate(north(CENTER, 5), 1000), false, "5 m dalam 1 detik");
    assert.equal(monitor.shouldEvaluate(north(CENTER, 12), 2000), true, "12 m melewati jarak minimum");
    monitor.update(north(CENTER, 12), 2000);
    assert.equal(monitor.shouldEvaluate(north(CENTER, 14), 3000), false, "2 m lagi belum cukup");
    assert.equal(monitor.shouldEvaluate(north(CENTER, 14), 17000), true, "selang waktu terlampaui");
  });

  it("hanya menjalankan satu pemeriksaan untuk sepuluh sampel rapat dalam lima detik", () => {
    const monitor = new GeofenceMonitor({ minDistanceM: 10, minIntervalMs: 15000 });
    monitor.setZones([BOX]);
    let evaluations = 0;
    for (let i = 0; i < 10; i += 1) {
      const point = north(CENTER, i * 0.5);
      if (monitor.shouldEvaluate(point, i * 500)) evaluations += 1;
      monitor.update(point, i * 500);
    }
    assert.equal(evaluations, 1, `${evaluations} pemeriksaan untuk 10 sampel diam`);
  });
});

describe("jurnal peristiwa dan CSV", () => {
  const events = [
    {
      area: 'Blok A, "utara"',
      kind: "masuk" as const,
      at: "2026-10-19T23:59:59.000Z",
      lat: -6.2,
      lng: 106.8,
      distanceToBoundaryM: -12.5,
    },
    {
      area: "Blok B",
      kind: "keluar" as const,
      at: "2026-10-20T00:00:01.000Z",
      lat: -6.201,
      lng: 106.801,
      distanceToBoundaryM: 3.25,
    },
  ];

  it("menulis kepala kolom yang dituntut brief", () => {
    const csv = eventsToCsv(events);
    assert.equal(csv.split("\n")[0], "area,jenis,waktu,lat,lon,jarak_ke_batas_m");
  });

  it("membaca kembali CSV tanpa kolom bergeser, termasuk nama area berkoma dan berapit", () => {
    const back = eventsFromCsv(eventsToCsv(events));
    assert.deepEqual(back, events);
  });

  it("bertahan melewati tengah malam tanpa mengubah urutan waktu", () => {
    const back = eventsFromCsv(eventsToCsv(events));
    assert.ok(back[0].at < back[1].at, "waktu tetap terurut setelah bolak-balik");
  });

  it("menolak CSV dengan jumlah sel tidak sesuai kepala", () => {
    assert.throws(
      () => eventsFromCsv("area,jenis,waktu,lat,lon,jarak_ke_batas_m\nBlok A,masuk,2026-10-19T00:00:00Z,-6.2,106.8\n"),
      /baris 2/,
    );
  });

  it("menolak CSV tanpa kolom yang dituntut", () => {
    assert.throws(
      () => eventsFromCsv("area,jenis,waktu,lat,lon\nBlok A,masuk,2026-10-19T00:00:00Z,-6.2,106.8\n"),
      /jarak_ke_batas_m/,
    );
    assert.throws(() => eventsFromCsv("area,jenis\nBlok A,masuk\n"), /CSV tidak memuat kolom/);
  });

  it("mencatat peristiwa dari monitor dan mengekspornya", () => {
    const monitor = new GeofenceMonitor({ hysteresisM: 5, minDistanceM: 0, minIntervalMs: 0 });
    monitor.setZones([CIRCLE]);
    monitor.update(CENTER, Date.parse("2026-10-19T23:59:00Z"));
    const fresh = monitor.update(north(CENTER, 100), Date.parse("2026-10-20T00:00:30Z"));
    assert.equal(fresh.length, 1);
    const csv = monitor.toCsv();
    const back = eventsFromCsv(csv);
    assert.equal(back.length, 1);
    assert.equal(back[0].area, "Mata Air");
    assert.equal(back[0].kind, "keluar");
    assert.equal(back[0].at, "2026-10-20T00:00:30.000Z");
  });

  it("membuang peristiwa tertua saat jurnal penuh", () => {
    const monitor = new GeofenceMonitor({
      hysteresisM: 1,
      minDistanceM: 0,
      minIntervalMs: 0,
      maxEvents: 2,
    });
    monitor.setZones([CIRCLE]);
    monitor.update(CENTER, 0);
    for (let i = 1; i <= 4; i += 1) {
      monitor.update(i % 2 === 0 ? CENTER : north(CENTER, 100), i * 1000);
    }
    assert.equal(monitor.events().length, 2);
  });
});

describe("membaca zona dari feature", () => {
  /**
   * `Circle` bukan tipe GeoJSON standar, jadi bentuknya tidak ada di tipe
   * `geojson`. Cast di sini hanya menyatakan bentuk masukan yang memang
   * disimpan lapisan peta; yang diuji adalah tafsir pembacanya.
   */
  function circleFeature(
    coordinates: unknown,
    properties: Record<string, unknown> = {},
  ): Feature<Geometry> {
    return {
      type: "Feature",
      id: "mata-air",
      properties: { name: "Mata Air", ...properties },
      geometry: { type: "Circle", coordinates },
    } as unknown as Feature<Geometry>;
  }

  it("membaca bentuk pusat saja [lng, lat]", () => {
    const zone = zoneFromFeature(circleFeature([106.8, -6.2], { geofence_radius_m: 50 }));
    assert.ok(zone);
    assert.equal(zone.kind, "circle");
    if (zone.kind !== "circle") return; // sempitkan tipe untuk pemeriksaan di bawah
    assert.deepEqual(zone.center, [106.8, -6.2]);
    assert.equal(zone.radiusM, 50);
    // Radius tidak boleh diambil dari lintang: pusat zona wajib di dalam.
    assert.equal(zoneSignedDistance(zone, [106.8, -6.2]).inside, true);
  });

  it("membaca bentuk pusat dan radius [[lng, lat], radius]", () => {
    const zone = zoneFromFeature(circleFeature([[106.8, -6.2], 120], { geofence_radius_m: 50 }));
    assert.ok(zone);
    assert.equal(zone.kind, "circle");
    if (zone.kind !== "circle") return;
    assert.deepEqual(zone.center, [106.8, -6.2]);
    // Radius dari geometri menang atas properti: 120, bukan 50.
    assert.equal(zone.radiusM, 120);
    assert.equal(zoneSignedDistance(zone, east(CENTER, 100)).inside, true);
    assert.equal(zoneSignedDistance(zone, east(CENTER, 130)).inside, false);
  });

  it("memakai radius bawaan saat radius tidak disebut di mana pun", () => {
    const zone = zoneFromFeature(circleFeature([106.8, -6.2]));
    assert.ok(zone);
    assert.equal(zone.kind, "circle");
    if (zone.kind !== "circle") return;
    assert.equal(zone.radiusM, 50);
  });
});
