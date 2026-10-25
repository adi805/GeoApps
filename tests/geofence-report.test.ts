import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GeofenceEvent, GeofenceZone } from "@geolibre/plugins";
import {
  GEOFENCE_MIN_RADIUS_M,
  clampRadiusM,
  countZoneEventsToday,
  describeBoundarySide,
  eventCaption,
  eventTitle,
  formatClock,
  isZoneEnabled,
  newZoneId,
  zoneRowCaption,
  zoneShapeLabel,
  zonesSummary,
} from "../apps/geolibre-desktop/src/lib/geofence-report";

/** Zona lingkaran dengan nilai bawaan yang wajar; tiap uji menimpanya. */
function circleZone(overrides: Partial<GeofenceZone> = {}): GeofenceZone {
  return {
    id: "zona-a",
    name: "Blok C",
    kind: "circle",
    center: [107.609118, -6.914352],
    radiusM: 250,
    ...overrides,
  } as GeofenceZone;
}

/** Peristiwa pada waktu tertentu; nama areanya menentukan pencocokan. */
function event(area: string, at: string, kind: "masuk" | "keluar" = "masuk"): GeofenceEvent {
  return { area, kind, at, lat: -6.914352, lng: 107.609118, distanceToBoundaryM: -12 };
}

describe("clampRadiusM", () => {
  it("menahan radius di bawah batas galat GPS", () => {
    // Batas 8 m lebih kecil dari galat GPS, jadi peringatannya akan salah
    // terus: yang disimpan harus batas minimum, bukan angka yang diketik.
    assert.equal(clampRadiusM(8), GEOFENCE_MIN_RADIUS_M);
    assert.equal(clampRadiusM(0), GEOFENCE_MIN_RADIUS_M);
    assert.equal(clampRadiusM(-50), GEOFENCE_MIN_RADIUS_M);
  });

  it("membiarkan radius yang sudah layak, dibulatkan ke meter", () => {
    assert.equal(clampRadiusM(250), 250);
    assert.equal(clampRadiusM(249.6), 250);
    assert.equal(clampRadiusM(GEOFENCE_MIN_RADIUS_M), GEOFENCE_MIN_RADIUS_M);
  });

  it("memakai batas minimum saat nilainya bukan angka", () => {
    assert.equal(clampRadiusM(Number.NaN), GEOFENCE_MIN_RADIUS_M);
    assert.equal(clampRadiusM(Number.POSITIVE_INFINITY), GEOFENCE_MIN_RADIUS_M);
  });
});

describe("isZoneEnabled", () => {
  it("menganggap bidang yang tidak ada sebagai aktif", () => {
    // Zona yang ditulis versi lama tidak punya `enabled`; membacanya sebagai
    // nonaktif akan mematikan pengawasan semua zona lama tanpa diminta.
    assert.equal(isZoneEnabled(circleZone()), true);
    assert.equal(isZoneEnabled(circleZone({ enabled: undefined })), true);
  });

  it("membaca false sebagai nonaktif", () => {
    assert.equal(isZoneEnabled(circleZone({ enabled: false })), false);
  });
});

describe("zoneShapeLabel", () => {
  it("menulis radius bulat untuk zona lingkaran", () => {
    assert.equal(zoneShapeLabel(circleZone({ radiusM: 250 })), "radius 250 m");
    assert.equal(zoneShapeLabel(circleZone({ radiusM: 120.4 })), "radius 120 m");
  });

  it("menulis jumlah titik untuk zona poligon", () => {
    const polygon = {
      id: "zona-p",
      name: "Kantor desa",
      kind: "polygon",
      rings: [
        [
          [107.6, -6.9],
          [107.61, -6.9],
          [107.61, -6.91],
          [107.6, -6.9],
        ],
      ],
    } as GeofenceZone;
    assert.equal(zoneShapeLabel(polygon), "poligon 4 titik");
  });
});

describe("zonesSummary", () => {
  it("menghitung yang aktif dari total", () => {
    assert.equal(
      zonesSummary([circleZone(), circleZone({ id: "b" }), circleZone({ id: "c", enabled: false })]),
      "2 aktif dari 3",
    );
  });

  it("nol dari nol saat belum ada zona", () => {
    assert.equal(zonesSummary([]), "0 aktif dari 0");
  });
});

describe("countZoneEventsToday", () => {
  const reference = new Date(2026, 9, 24, 12, 0, 0);

  it("menghitung peristiwa hari ini untuk nama zona yang sama", () => {
    const events = [
      event("Blok C", new Date(2026, 9, 24, 8, 14).toISOString()),
      event("Blok C", new Date(2026, 9, 24, 7, 52).toISOString(), "keluar"),
      event("Blok C", new Date(2026, 9, 23, 18, 0).toISOString()),
      event("Gudang lama", new Date(2026, 9, 24, 9, 0).toISOString()),
    ];
    assert.equal(countZoneEventsToday(events, circleZone(), reference), 2);
  });

  it("tidak menghitung peristiwa yang stempel waktunya rusak", () => {
    assert.equal(countZoneEventsToday([event("Blok C", "bukan-waktu")], circleZone(), reference), 0);
  });
});

describe("zoneRowCaption", () => {
  const reference = new Date(2026, 9, 24, 12, 0, 0);

  it("menyebut tidak ada peringatan saat jurnalnya kosong", () => {
    assert.equal(
      zoneRowCaption(circleZone(), [], reference),
      "radius 250 m · tidak ada peringatan hari ini",
    );
  });

  it("menyebut jumlah peringatan hari ini", () => {
    const events = [
      event("Blok C", new Date(2026, 9, 24, 8, 14).toISOString()),
      event("Blok C", new Date(2026, 9, 24, 7, 52).toISOString(), "keluar"),
    ];
    assert.equal(
      zoneRowCaption(circleZone(), events, reference),
      "radius 250 m · 2 peringatan hari ini",
    );
  });
});

describe("eventTitle dan eventCaption", () => {
  it("menulis arah dan nama area", () => {
    assert.equal(eventTitle(event("Blok C", "2026-10-24T01:14:00.000Z")), "Masuk Blok C");
    assert.equal(
      eventTitle(event("Blok C", "2026-10-24T01:14:00.000Z", "keluar")),
      "Keluar Blok C",
    );
  });

  it("menyebut jam setempat dan sisi batas", () => {
    const inside = event("Blok C", new Date(2026, 9, 24, 8, 14).toISOString());
    assert.equal(eventCaption(inside), "08:14 · 12 m di dalam batas");
  });
});

describe("describeBoundarySide", () => {
  it("memakai tanda jarak untuk menyebut sisi", () => {
    assert.equal(describeBoundarySide(-12), "12 m di dalam batas");
    assert.equal(describeBoundarySide(12), "12 m di luar batas");
    assert.equal(describeBoundarySide(0), "tepat di batas");
  });
});

describe("formatClock", () => {
  it("memberi dua digit pada jam dan menit", () => {
    assert.equal(formatClock(new Date(2026, 9, 24, 7, 5).toISOString()), "07:05");
  });

  it("memakai placeholder saat stempel waktunya rusak", () => {
    assert.equal(formatClock("bukan-waktu"), "--:--");
  });
});

describe("newZoneId", () => {
  it("memakai seed sebagai dasar id", () => {
    assert.equal(newZoneId([], 1_700_000_000_000), `zona-${(1_700_000_000_000).toString(36)}`);
  });

  it("menambah akhiran saat id-nya sudah dipakai", () => {
    // Id yang bentrok membuat zona kedua menimpa zona pertama tanpa pesan.
    const seed = 1_700_000_000_000;
    const first = newZoneId([], seed);
    const second = newZoneId([first], seed);
    assert.notEqual(second, first);
    assert.equal(second, `${first}-1`);
  });
});
