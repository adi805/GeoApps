import type { Position } from "geojson";

/**
 * Rata-rata GPS (gaya Avenza "GPS averaging"): kumpulkan beberapa bacaan di
 * satu titik, buang bacaan yang terlalu kasar, lalu laporkan satu titik dengan
 * akurasi gabungan.
 *
 * Kenapa perlu: satu bacaan GPS di bawah tajuk kebun bisa meleset 10-20 meter,
 * dan titik itu lalu dipakai sebagai batas blok. Menahan alat diam selama
 * beberapa detik dan merata-ratakan bacaan menghasilkan titik yang jauh lebih
 * bisa dipertanggungjawabkan daripada satu bacaan yang kebetulan bagus.
 *
 * Dua angka yang menentukan hasil sengaja jadi parameter, bukan angka hafalan
 * di dalam badan fungsi: berapa bacaan yang dikumpulkan (`maxSamples`) dan
 * seberapa kasar bacaan yang masih diterima (`maxAccuracyM`). Nilai bawaannya
 * ditulis di `factory/bahan/geofence-parameter-bawaan.md`.
 */

export interface GpsSample {
  /** [lng, lat] dalam derajat desimal. */
  pos: Position;
  /** Akurasi horizontal yang dilaporkan perangkat, meter (1 sigma). */
  accuracyM: number;
  /** Waktu bacaan, milidetik epoch. */
  timestamp: number;
}

export interface GpsAveragingOptions {
  /** Jumlah bacaan yang dipakai rata-rata. Bawaan 15. */
  maxSamples?: number;
  /** Bacaan dengan akurasi di atas ini dibuang. Bawaan 15 meter. */
  maxAccuracyM?: number;
  /** Bacaan sejauh ini dari rata-rata berjalan dianggap outlier. Bawaan 40 meter. */
  maxOutlierM?: number;
}

export interface AveragedResult {
  /** Titik hasil rata-rata berbobot, [lng, lat]. */
  position: Position;
  /**
   * Akurasi gabungan: yang lebih buruk antara galat baku rata-rata berbobot
   * dan sebaran RMS sampel. Rata-rata yang rapi tidak boleh mengklaim akurasi
   * lebih baik daripada sebaran bacaan yang membentuknya.
   */
  accuracyM: number;
  /** Sampel yang dipakai. */
  samplesUsed: number;
  /** Sampel yang dibuang, akurasi kasar maupun outlier. */
  samplesRejected: number;
  /** Radius sebaran sampel terhadap titik hasil, meter. */
  spreadM: number;
  /** Sudah mencapai `maxSamples` bacaan? */
  isReady: boolean;
}

/** Bawaan yang dipakai kalau pemanggil tidak menyebut angka. */
export const GPS_AVERAGING_DEFAULTS = {
  maxSamples: 15,
  maxAccuracyM: 15,
  maxOutlierM: 40,
} as const;

function haversine(a: Position, b: Position): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export class GpsAverager {
  private samples: GpsSample[] = [];
  private rejected = 0;
  private rejectedByAccuracy = 0;
  private rejectedByDistance = 0;
  private readonly maxSamples: number;
  private readonly maxAccuracyM: number;
  private readonly maxOutlierM: number;

  constructor(options: GpsAveragingOptions = {}) {
    this.maxSamples = Math.max(
      1,
      Math.floor(options.maxSamples ?? GPS_AVERAGING_DEFAULTS.maxSamples),
    );
    this.maxAccuracyM = options.maxAccuracyM ?? GPS_AVERAGING_DEFAULTS.maxAccuracyM;
    this.maxOutlierM = options.maxOutlierM ?? GPS_AVERAGING_DEFAULTS.maxOutlierM;
  }

  /**
   * Tambah satu bacaan. Mengembalikan null kalau bacaan itu dibuang (akurasi di
   * atas ambang, atau terlalu jauh dari rata-rata berjalan), sehingga pemanggil
   * bisa memberi tahu pengguna bahwa alat belum mendapat bacaan yang layak.
   */
  add(sample: GpsSample): AveragedResult | null {
    if (!Number.isFinite(sample.accuracyM) || sample.accuracyM > this.maxAccuracyM) {
      this.rejected += 1;
      this.rejectedByAccuracy += 1;
      return null;
    }
    // Outlier hanya bermakna setelah ada cluster; dengan satu sampel, jarak ke
    // "rata-rata" selalu nol dan tidak ada yang bisa dibandingkan.
    if (this.samples.length >= 2) {
      const mean = this.mean();
      if (haversine(mean, sample.pos) > this.maxOutlierM) {
        this.rejected += 1;
        this.rejectedByDistance += 1;
        return null;
      }
    }
    this.samples.push(sample);
    // Buang yang paling tua, bukan yang terburuk: bacaan terbaru lebih mewakili
    // posisi sekarang kalau alat sempat bergeser sedikit.
    if (this.samples.length > this.maxSamples) this.samples.shift();
    return this.result();
  }

  /** Rata-rata berbobot invers-varians (bobot 1/akurasi^2). */
  mean(): Position {
    if (this.samples.length === 0) return [0, 0];
    let weightSum = 0;
    let lng = 0;
    let lat = 0;
    for (const sample of this.samples) {
      // Akurasi 0 dilaporkan sebagian perangkat saat baru mendapat fix; jangan
      // sampai bobotnya tak terhingga dan menenggelamkan sampel lain.
      const accuracy = Math.max(sample.accuracyM, 0.1);
      const weight = 1 / (accuracy * accuracy);
      weightSum += weight;
      lng += sample.pos[0] * weight;
      lat += sample.pos[1] * weight;
    }
    return [lng / weightSum, lat / weightSum];
  }

  result(): AveragedResult | null {
    const n = this.samples.length;
    if (n === 0) return null;
    const mean = this.mean();
    let weightSum = 0;
    let weightedSqDistance = 0;
    let maxDistance = 0;
    for (const sample of this.samples) {
      const accuracy = Math.max(sample.accuracyM, 0.1);
      const weight = 1 / (accuracy * accuracy);
      const distance = haversine(mean, sample.pos);
      weightSum += weight;
      weightedSqDistance += weight * distance * distance;
      if (distance > maxDistance) maxDistance = distance;
    }
    // Galat baku rata-rata berbobot dan sebaran RMS: ambil yang lebih konservatif.
    const standardError = Math.sqrt(1 / weightSum);
    const rmsSpread = Math.sqrt(weightedSqDistance / weightSum);
    return {
      position: mean,
      accuracyM: Math.max(standardError, rmsSpread),
      samplesUsed: n,
      samplesRejected: this.rejected,
      spreadM: maxDistance,
      isReady: n >= this.maxSamples,
    };
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  /** Jumlah sampel yang dibuang, dipisah menurut alasannya. */
  get rejectionCounts(): { total: number; accuracy: number; distance: number } {
    return {
      total: this.rejected,
      accuracy: this.rejectedByAccuracy,
      distance: this.rejectedByDistance,
    };
  }

  reset(): void {
    this.samples = [];
    this.rejected = 0;
    this.rejectedByAccuracy = 0;
    this.rejectedByDistance = 0;
  }
}
