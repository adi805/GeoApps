/**
 * Uji rata-rata GPS (issue #13, bagian 2).
 *
 * Yang dibuktikan: N dan ambang akurasi benar-benar parameter (bukan angka
 * hafalan), bacaan kasar dan outlier dibuang serta dihitung, rata-rata
 * menghargai bacaan yang lebih akurat, dan akurasi gabungan tidak pernah lebih
 * optimistis daripada sebaran bacaan yang membentuknya.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GPS_AVERAGING_DEFAULTS, GpsAverager } from "./gps-averaging";

const BASE: [number, number] = [106.8, -6.2];

/** Titik sejauh `meters` ke utara dari BASE (1 derajat lintang ~ 111.320 m). */
function north(meters: number): [number, number] {
  return [BASE[0], BASE[1] + meters / 111320];
}

function sample(pos: [number, number], accuracyM: number, timestamp = 0) {
  return { pos, accuracyM, timestamp };
}

describe("ambang akurasi", () => {
  it("membuang bacaan di atas ambang dan menghitungnya", () => {
    const averager = new GpsAverager({ maxSamples: 5, maxAccuracyM: 10 });
    assert.equal(averager.add(sample(BASE, 25)), null, "akurasi 25 m harus dibuang");
    assert.equal(averager.sampleCount, 0);
    assert.deepEqual(averager.rejectionCounts, { total: 1, accuracy: 1, distance: 0 });

    const kept = averager.add(sample(BASE, 4));
    assert.ok(kept);
    assert.equal(kept.samplesUsed, 1);
    assert.equal(kept.samplesRejected, 1);
  });

  it("mengikuti ambang yang diberikan, bukan angka bawaan", () => {
    const strict = new GpsAverager({ maxAccuracyM: 3 });
    const loose = new GpsAverager({ maxAccuracyM: 30 });
    assert.equal(strict.add(sample(BASE, 5)), null, "ambang 3 m: 5 m dibuang");
    assert.ok(loose.add(sample(BASE, 5)), "ambang 30 m: 5 m diterima");
  });

  it("menolak akurasi yang bukan angka", () => {
    const averager = new GpsAverager();
    assert.equal(averager.add(sample(BASE, Number.NaN)), null);
    assert.equal(averager.rejectionCounts.accuracy, 1);
  });
});

describe("jumlah sampel N", () => {
  it("menahan paling banyak N bacaan dan menandai siap saat N tercapai", () => {
    const averager = new GpsAverager({ maxSamples: 3 });
    for (let i = 0; i < 3; i += 1) {
      const result = averager.add(sample(BASE, 3, i));
      assert.ok(result);
      assert.equal(result.isReady, i === 2, `siap setelah bacaan ke-${i + 1}`);
    }
    const fourth = averager.add(sample(BASE, 3, 3));
    assert.ok(fourth);
    assert.equal(averager.sampleCount, 3, "N=3 tidak boleh menyimpan empat bacaan");
    assert.equal(fourth.samplesUsed, 3);
  });

  it("memakai nilai bawaan yang tercatat di dokumen", () => {
    assert.equal(GPS_AVERAGING_DEFAULTS.maxSamples, 15);
    assert.equal(GPS_AVERAGING_DEFAULTS.maxAccuracyM, 15);
    const averager = new GpsAverager();
    for (let i = 0; i < 15; i += 1) averager.add(sample(BASE, 3, i));
    const result = averager.result();
    assert.ok(result);
    assert.equal(result.isReady, true);
    assert.equal(result.samplesUsed, 15);
  });
});

describe("rata-rata dan akurasi gabungan", () => {
  it("menghargai bacaan yang lebih akurat", () => {
    const averager = new GpsAverager({ maxAccuracyM: 20 });
    averager.add(sample([106.8, 0], 1));
    averager.add(sample([106.802, 0], 10));
    const mean = averager.mean();
    // Bobot 1 m adalah 100x bobot 10 m, jadi hasilnya harus dekat bacaan akurat,
    // bukan di tengah-tengah.
    assert.ok(mean[0] < 106.8005, `rata-rata terlalu dekat bacaan kasar: ${mean[0]}`);
    assert.ok(mean[0] > 106.8, `rata-rata harus di antara kedua bacaan: ${mean[0]}`);
  });

  it("tidak mengklaim akurasi lebih baik daripada sebaran bacaan", () => {
    const averager = new GpsAverager({ maxAccuracyM: 5 });
    // Dua bacaan 11 meter terpisah, masing-masing mengaku akurasi 1 meter.
    averager.add(sample(north(0), 1));
    averager.add(sample(north(11), 1));
    const result = averager.result();
    assert.ok(result);
    assert.ok(
      result.accuracyM >= 5,
      `akurasi gabungan ${result.accuracyM.toFixed(2)} m lebih optimistis daripada sebaran`,
    );
    assert.ok(result.spreadM >= 5, `spread ${result.spreadM.toFixed(2)} m`);
  });

  it("memberi akurasi lebih baik daripada satu bacaan saat bacaan saling mendukung", () => {
    const averager = new GpsAverager({ maxAccuracyM: 5 });
    for (let i = 0; i < 9; i += 1) averager.add(sample(BASE, 5, i));
    const result = averager.result();
    assert.ok(result);
    // Sembilan bacaan yang rapat: galat baku 5/sqrt(9) ~ 1,7 m, sebaran nol.
    assert.ok(result.accuracyM < 3, `akurasi gabungan ${result.accuracyM.toFixed(2)} m`);
  });
});

describe("outlier", () => {
  it("membuang bacaan yang jauh dari cluster dan menghitung alasannya", () => {
    const averager = new GpsAverager({ maxAccuracyM: 20, maxOutlierM: 40 });
    averager.add(sample(BASE, 3));
    averager.add(sample(north(1), 3));
    assert.equal(averager.add(sample(north(200), 3)), null, "200 m harus jadi outlier");
    assert.deepEqual(averager.rejectionCounts, { total: 1, accuracy: 0, distance: 1 });
    const result = averager.result();
    assert.ok(result);
    assert.equal(result.samplesUsed, 2);
    assert.ok(result.spreadM < 5, `outlier tidak boleh menarik titik: spread ${result.spreadM}`);
  });

  it("mengikuti ambang outlier yang diberikan", () => {
    const tight = new GpsAverager({ maxOutlierM: 10 });
    tight.add(sample(BASE, 3));
    tight.add(sample(north(1), 3));
    assert.equal(tight.add(sample(north(20), 3)), null, "ambang 10 m: 20 m dibuang");

    const loose = new GpsAverager({ maxOutlierM: 50 });
    loose.add(sample(BASE, 3));
    loose.add(sample(north(1), 3));
    assert.ok(loose.add(sample(north(20), 3)), "ambang 50 m: 20 m diterima");
  });
});

describe("reset", () => {
  it("mengosongkan sampel dan penghitung penolakan", () => {
    const averager = new GpsAverager({ maxAccuracyM: 5 });
    averager.add(sample(BASE, 30));
    averager.add(sample(BASE, 2));
    averager.reset();
    assert.equal(averager.sampleCount, 0);
    assert.deepEqual(averager.rejectionCounts, { total: 0, accuracy: 0, distance: 0 });
    assert.equal(averager.result(), null);
  });
});
