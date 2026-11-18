import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Position } from "geojson";
import {
  GEOFENCE_CSV_COLUMNS,
  GEOFENCE_EVENTS_STORAGE_KEY,
  GEOFENCE_ZONES_STORAGE_KEY,
  addGeofenceZone,
  clearGeofenceEvents,
  exportGeofenceEventsCsv,
  getAllGeofenceZones,
  getGeofenceEvents,
  removeGeofenceZone,
  setGeofenceZoneEnabled,
  zoneFromFeature,
  zoneToFeature,
  type GeofenceZone,
} from "../packages/plugins/src/plugins/maplibre-geofence";

/**
 * CRUD zona geofence yang tersimpan di perangkat.
 *
 * Uji ini ada di `tests/` (bukan di samping modulnya) karena hanya
 * `tests/*.test.ts` yang dijalankan suite frontend: uji yang tinggal di
 * `packages/plugins/src/plugins/*.test.ts` tidak pernah jalan, jadi ia mengunci
 * perilaku tanpa membuktikan apa pun.
 */

/** Titik pusat uji; nilainya tidak penting, yang penting tetap sama. */
const CENTER: Position = [106.8, -6.2];

/**
 * Penyimpanan palsu untuk uji CRUD.
 *
 * Node tidak punya `localStorage`, jadi tanpa ini `saveZones()` hanya menulis ke
 * tempat sampah dan uji akan lulus tanpa membuktikan apa pun. Stub ini dipasang
 * dan dilepas per uji supaya keadaan satu uji tidak bocor ke uji lain.
 *
 * Args:
 *   run: Uji yang berjalan dengan penyimpanan palsu terpasang.
 */
function withFakeStorage(run: () => void): void {
  const store = new Map<string, string>();
  const fake = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  const holder = globalThis as { localStorage?: unknown };
  const previous = holder.localStorage;
  holder.localStorage = fake;
  try {
    run();
  } finally {
    if (previous === undefined) delete holder.localStorage;
    else holder.localStorage = previous;
  }
}

/** Zona lingkaran untuk uji CRUD. */
function circleZone(id: string, name: string, enabled?: boolean): GeofenceZone {
  return { id, name, kind: "circle", center: CENTER, radiusM: 250, enabled } as GeofenceZone;
}

describe("CRUD zona geofence tersimpan", () => {
  it("menyimpan zona lalu membacanya kembali", () => {
    withFakeStorage(() => {
      assert.deepEqual(getAllGeofenceZones(), []);
      addGeofenceZone(circleZone("zona-a", "Blok C"));
      const zones = getAllGeofenceZones();
      assert.equal(zones.length, 1);
      assert.equal(zones[0]?.name, "Blok C");
      assert.equal(zones[0]?.kind, "circle");
      if (zones[0]?.kind !== "circle") return;
      assert.equal(zones[0].radiusM, 250);
      assert.deepEqual(zones[0].center, CENTER);
    });
  });

  it("menulis ke kunci penyimpanan yang diekspor, bukan kunci lain", () => {
    withFakeStorage(() => {
      addGeofenceZone(circleZone("zona-a", "Blok C"));
      const raw = localStorage.getItem(GEOFENCE_ZONES_STORAGE_KEY);
      assert.ok(raw);
      const parsed = JSON.parse(raw ?? "{}") as { type: string; features: unknown[] };
      assert.equal(parsed.type, "FeatureCollection");
      assert.equal(parsed.features.length, 1);
    });
  });

  it("mengganti zona dengan id yang sama, bukan menduplikasinya", () => {
    withFakeStorage(() => {
      addGeofenceZone(circleZone("zona-a", "Blok C"));
      addGeofenceZone({ ...circleZone("zona-a", "Blok C baru"), radiusM: 400 } as GeofenceZone);
      const zones = getAllGeofenceZones();
      assert.equal(zones.length, 1);
      assert.equal(zones[0]?.name, "Blok C baru");
      if (zones[0]?.kind === "circle") assert.equal(zones[0].radiusM, 400);
    });
  });

  it("menghapus zona berdasarkan id dan mengabaikan id yang tidak ada", () => {
    withFakeStorage(() => {
      addGeofenceZone(circleZone("zona-a", "Blok C"));
      addGeofenceZone(circleZone("zona-b", "Kantor desa"));
      removeGeofenceZone("zona-tidak-ada");
      assert.equal(getAllGeofenceZones().length, 2);
      removeGeofenceZone("zona-a");
      const zones = getAllGeofenceZones();
      assert.equal(zones.length, 1);
      assert.equal(zones[0]?.id, "zona-b");
    });
  });

  it("mematikan dan menyalakan zona tanpa menghapusnya", () => {
    withFakeStorage(() => {
      addGeofenceZone(circleZone("zona-a", "Blok C"));
      setGeofenceZoneEnabled("zona-a", false);
      const off = getAllGeofenceZones();
      // Zona nonaktif tetap ada di daftar; yang berubah hanya pengawasannya.
      assert.equal(off.length, 1);
      assert.equal(off[0]?.enabled, false);
      setGeofenceZoneEnabled("zona-a", true);
      assert.equal(getAllGeofenceZones()[0]?.enabled, true);
    });
  });

  it("membaca zona tanpa bidang enabled sebagai aktif", () => {
    withFakeStorage(() => {
      addGeofenceZone(circleZone("zona-lama", "Gudang lama"));
      const stored = JSON.parse(localStorage.getItem(GEOFENCE_ZONES_STORAGE_KEY) ?? "{}") as {
        features: { properties: Record<string, unknown> }[];
      };
      // Buang bidangnya, meniru zona yang ditulis versi sebelum saklar ini ada.
      delete stored.features[0]?.properties.geofence_enabled;
      localStorage.setItem(GEOFENCE_ZONES_STORAGE_KEY, JSON.stringify(stored));
      assert.equal(getAllGeofenceZones()[0]?.enabled, true);
    });
  });

  it("bertahan pada satu bentuk: yang ditulis bisa dibaca kembali", () => {
    withFakeStorage(() => {
      const zone = circleZone("zona-a", "Blok C", false);
      addGeofenceZone(zone);
      const back = zoneFromFeature(zoneToFeature(zone));
      assert.ok(back);
      assert.equal(back.name, "Blok C");
      assert.equal(back.enabled, false);
      if (back.kind === "circle") assert.equal(back.radiusM, 250);
    });
  });

  it("mulai dari kosong saat penyimpanannya rusak", () => {
    withFakeStorage(() => {
      localStorage.setItem(GEOFENCE_ZONES_STORAGE_KEY, "{bukan json");
      // Penyimpanan rusak bukan alasan meledak: panel harus tetap terbuka.
      assert.deepEqual(getAllGeofenceZones(), []);
    });
  });
});

describe("jurnal peristiwa geofence tersimpan", () => {
  const event = {
    area: "Blok C",
    kind: "masuk",
    at: "2026-10-24T01:14:00.000Z",
    lat: -6.9,
    lng: 107.6,
    distanceToBoundaryM: -12,
  };

  it("membaca jurnal yang tersimpan", () => {
    withFakeStorage(() => {
      localStorage.setItem(GEOFENCE_EVENTS_STORAGE_KEY, JSON.stringify([event]));
      const events = getGeofenceEvents();
      assert.equal(events.length, 1);
      assert.equal(events[0]?.area, "Blok C");
      assert.equal(events[0]?.kind, "masuk");
    });
  });

  it("mengosongkan jurnal lewat clearGeofenceEvents", () => {
    withFakeStorage(() => {
      localStorage.setItem(GEOFENCE_EVENTS_STORAGE_KEY, JSON.stringify([event]));
      assert.equal(getGeofenceEvents().length, 1);
      clearGeofenceEvents();
      assert.deepEqual(getGeofenceEvents(), []);
    });
  });

  it("mengekspor jurnal tersimpan sebagai CSV dengan kepala kolom", () => {
    withFakeStorage(() => {
      localStorage.setItem(GEOFENCE_EVENTS_STORAGE_KEY, JSON.stringify([event]));
      const csv = exportGeofenceEventsCsv();
      // Kepala kolom dibandingkan dengan konstanta yang sama, bukan salinannya:
      // salinan akan basi diam-diam saat nama kolomnya diubah.
      assert.ok(csv.startsWith(`${GEOFENCE_CSV_COLUMNS.join(",")}\n`));
      assert.match(csv, /Blok C,masuk/);
    });
  });

  it("mengabaikan jurnal yang bentuknya bukan daftar", () => {
    withFakeStorage(() => {
      localStorage.setItem(GEOFENCE_EVENTS_STORAGE_KEY, '{"bukan":"daftar"}');
      assert.deepEqual(getGeofenceEvents(), []);
    });
  });
});