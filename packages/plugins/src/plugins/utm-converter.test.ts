/**
 * Uji konversi koordinat (issue #13, bagian 3).
 *
 * Yang dibuktikan: zona dan huruf pita benar untuk Indonesia, konversi bolak-balik
 * UTM <-> DD tidak menghanyutkan posisi (selisih di bawah 1 meter untuk 100 titik
 * acak), DMS/DD terbaca kembali, dan masukan tidak sah ditolak alih-alih ditebak.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDd,
  formatDms,
  formatUtm,
  latLngToUtm,
  parseCoordinate,
  utmBandForLatitude,
  utmToLatLng,
  utmZoneForLongitude,
} from "./utm-converter";

/** Jarak dua titik di permukaan bumi (meter), dipakai mengukur galat bolak-balik. */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Pembangkit acak berbenih tetap: uji harus memberi angka yang sama tiap jalan,
 * karena uji yang berubah hasilnya tidak bisa dipakai membedakan regresi dari
 * kebetulan.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Kotak Indonesia: 94°BT-142°BT, 11°LS-6°LU. */
const INDONESIA = { west: 94, east: 142, south: -11, north: 6 };

describe("zona dan huruf pita", () => {
  it("menaruh kota-kota Indonesia di zona dan pita yang benar", () => {
    const cases: [string, number, number, number, string][] = [
      ["Medan", 98.6722, 3.5952, 47, "N"],
      ["Pontianak", 109.3425, -0.0263, 49, "M"],
      ["Jakarta", 106.8456, -6.2088, 48, "M"],
      ["Bali", 115.2191, -8.6503, 50, "L"],
      ["Kupang", 123.607, -10.1772, 51, "L"],
      ["Merauke", 140.4018, -8.4932, 54, "L"],
    ];
    for (const [name, lng, lat, zone, band] of cases) {
      const utm = latLngToUtm(lng, lat);
      assert.ok(utm, `${name}: konversi gagal`);
      assert.equal(utm.zone, zone, `${name}: zona`);
      assert.equal(utm.band, band, `${name}: pita`);
    }
  });

  it("memakai batas pita resmi, bukan pembulatan ke bawah", () => {
    assert.equal(utmBandForLatitude(0), "N");
    assert.equal(utmBandForLatitude(-0.0001), "M");
    assert.equal(utmBandForLatitude(-8), "M");
    assert.equal(utmBandForLatitude(-8.0001), "L");
    assert.equal(utmBandForLatitude(8), "P");
    assert.equal(utmBandForLatitude(84), "X");
    assert.equal(utmBandForLatitude(-80), "C");
  });

  it("menolak lintang di luar jangkauan UTM, bukan menggeser pita terakhir", () => {
    assert.equal(utmBandForLatitude(84.1), "");
    assert.equal(utmBandForLatitude(-80.1), "");
    assert.equal(latLngToUtm(106.8, 85), null);
    assert.equal(latLngToUtm(106.8, Number.NaN), null);
  });

  it("menormalkan bujur yang belum dibungkus dan menjaga garis tanggal", () => {
    // Bujur 180 dan -180 adalah meridian yang sama; keduanya jatuh di zona 1
    // (zona 60 berakhir tepat di 180), jadi tidak ada zona 61 yang tidak ada.
    assert.equal(utmZoneForLongitude(180), 1);
    assert.equal(utmZoneForLongitude(-180), 1);
    assert.equal(utmZoneForLongitude(181), 1);
    assert.equal(utmZoneForLongitude(-181), 60);
    const before = latLngToUtm(179.999, -5);
    assert.ok(before);
    assert.equal(before.zone, 60);
  });
});

describe("bolak-balik UTM", () => {
  it("kembali ke DD dengan selisih di bawah 1 meter untuk 100 titik acak Indonesia", () => {
    const random = seededRandom(20261019);
    let worst = 0;
    let worstAt = "";
    for (let i = 0; i < 100; i += 1) {
      const lng = INDONESIA.west + random() * (INDONESIA.east - INDONESIA.west);
      const lat = INDONESIA.south + random() * (INDONESIA.north - INDONESIA.south);
      const utm = latLngToUtm(lng, lat);
      assert.ok(utm, `titik ${i} (${lat}, ${lng}) gagal diproyeksikan`);
      const back = utmToLatLng(utm.zone, utm.south, utm.easting, utm.northing);
      assert.ok(back, `titik ${i} gagal dikembalikan`);
      const error = haversineM(lat, lng, back.lat, back.lng);
      if (error > worst) {
        worst = error;
        worstAt = `${lat}, ${lng} -> ${utm.zone}${utm.band} -> ${back.lat}, ${back.lng}`;
      }
    }
    assert.ok(worst < 1, `selisih terburuk ${worst.toFixed(4)} m di ${worstAt}`);
  });

  it("memberi northing belahan selatan yang bertambah ke utara", () => {
    const south = latLngToUtm(106.8, -6.2);
    const north = latLngToUtm(106.8, -6.1);
    assert.ok(south && north);
    assert.equal(south.south, true);
    assert.equal(north.south, true);
    assert.ok(north.northing > south.northing, "northing selatan harus naik ke arah utara");
    // Titik di belahan utara tidak memakai false northing.
    const medan = latLngToUtm(98.6722, 3.5952);
    assert.ok(medan);
    assert.equal(medan.south, false);
    assert.ok(medan.northing < 1000000, "northing utara dekat khatulistiwa di bawah 1.000 km");
  });

  it("menolak easting/northing di luar jangkauan", () => {
    assert.equal(utmToLatLng(0, false, 500000, 0), null);
    assert.equal(utmToLatLng(61, false, 500000, 0), null);
    assert.equal(utmToLatLng(48, true, 0, 9000000), null);
    assert.equal(utmToLatLng(48, true, 500000, 11000000), null);
  });

  it("menulis UTM dalam bentuk yang bisa dibaca balik", () => {
    const utm = latLngToUtm(106.8456, -6.2088);
    assert.ok(utm);
    // Nilai acuan dari alat lain, bukan dari fungsi ini sendiri:
    //   echo "106.8456 -6.2088" | gdaltransform -s_srs EPSG:4326 \
    //     -t_srs "+proj=utm +zone=48 +south +datum=WGS84 +units=m"
    //   -> 704207.168856434 9313358.33924576
    assert.equal(formatUtm(utm), "48M 704207.169 9313358.339");
  });
});

describe("DD dan DMS", () => {
  it("menulis DMS dengan arah mata angin dan menit/detik dua digit", () => {
    assert.equal(formatDms(-6.2088, 106.8456), `6°12'31.68"S 106°50'44.16"E`);
    assert.equal(formatDms(3.5952, 98.6722), `3°35'42.72"N 98°40'19.92"E`);
  });

  it("tidak pernah mencetak detik 60 setelah pembulatan", () => {
    // 0,9999999 menit = 59,99999 detik: pembulatan dua desimal akan jadi 60,00
    // kalau tidak dibawa ke menit.
    const text = formatDms(0.016666665, 0);
    assert.ok(!text.includes("60.00\""), `detik tidak boleh 60: ${text}`);
  });

  it("membaca kembali DMS dan DD yang ditulis sendiri", () => {
    const points: [number, number][] = [
      [-6.2088, 106.8456],
      [3.5952, 98.6722],
      [-8.6503, 115.2191],
      [-0.0263, 109.3425],
    ];
    for (const [lat, lng] of points) {
      const fromDd = parseCoordinate(formatDd(lat, lng));
      assert.ok(fromDd, `DD tidak terbaca: ${formatDd(lat, lng)}`);
      assert.ok(Math.abs(fromDd.lat - lat) < 1e-6);
      assert.ok(Math.abs(fromDd.lng - lng) < 1e-6);

      const fromDms = parseCoordinate(formatDms(lat, lng));
      assert.ok(fromDms, `DMS tidak terbaca: ${formatDms(lat, lng)}`);
      // Dua desimal detik = sekitar 0,3 meter; ambang 1e-4 derajat cukup ketat
      // untuk menangkap sumbu yang tertukar.
      assert.ok(Math.abs(fromDms.lat - lat) < 1e-4, `lintang DMS meleset: ${fromDms.lat} vs ${lat}`);
      assert.ok(Math.abs(fromDms.lng - lng) < 1e-4, `bujur DMS meleset: ${fromDms.lng} vs ${lng}`);
    }
  });

  it("memakai arah mata angin untuk menentukan sumbu, bukan urutan", () => {
    const asWritten = parseCoordinate(`106°50'44.16"E 6°12'31.68"S`);
    assert.ok(asWritten);
    assert.ok(Math.abs(asWritten.lat + 6.2088) < 1e-3);
    assert.ok(Math.abs(asWritten.lng - 106.8456) < 1e-3);
  });

  it("mengembalikan null untuk teks yang tidak bisa dibaca", () => {
    for (const bad of ["", "   ", "Jakarta", "1, 2, 3", "91, 0", "0, 181", "6°70'00\"S 106°E"]) {
      assert.equal(parseCoordinate(bad), null, `harus ditolak: ${bad}`);
    }
  });
});
