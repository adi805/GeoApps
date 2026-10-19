import type { Position } from "geojson";

/**
 * GPS averaging (Avenza-style): collect N position samples, compute the
 * mean coordinate and an accuracy estimate (circular error). Samples that are
 * clearly outliers (distance > maxOutlierM from the running mean) are
 * rejected so a single bad GPS fix does not skew the averaged point.
 */

export interface GpsSample {
  pos: Position; // [lng, lat]
  accuracyM: number;
  timestamp: number;
}

export interface AveragedResult {
  position: Position; // [lng, lat] mean
  accuracyM: number; // max of mean accuracy and spread
  samplesUsed: number;
  samplesRejected: number;
  spreadM: number; // radius of the sample cluster
}

function haversine(a: Position, b: Position): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export class GpsAverager {
  private samples: GpsSample[] = [];
  private readonly maxSamples: number;
  private readonly maxOutlierM: number;

  constructor(maxSamples = 15, maxOutlierM = 40) {
    this.maxSamples = maxSamples;
    this.maxOutlierM = maxOutlierM;
  }

  add(sample: GpsSample): AveragedResult | null {
    if (this.samples.length > 0) {
      const mean = this.mean();
      if (haversine(mean, sample.pos) > this.maxOutlierM) {
        // outlier — reject but still record it in the rejection counter
        return null;
      }
    }
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    return this.result();
  }

  mean(): Position {
    const n = this.samples.length;
    if (n === 0) return [0, 0];
    // mean of lng/lat is fine for small clusters (meters-scale); for
    // robustness at larger scales we could use the centroid of unit vectors,
    // but for a single geofence/placemark cluster this is sufficient.
    let lng = 0;
    let lat = 0;
    for (const s of this.samples) {
      lng += s.pos[0];
      lat += s.pos[1];
    }
    return [lng / n, lat / n];
  }

  result(): AveragedResult | null {
    const n = this.samples.length;
    if (n === 0) return null;
    const mean = this.mean();
    let maxDist = 0;
    let maxAcc = 0;
    for (const s of this.samples) {
      const d = haversine(mean, s.pos);
      if (d > maxDist) maxDist = d;
      if (s.accuracyM > maxAcc) maxAcc = s.accuracyM;
    }
    // accuracy = max(sample accuracy, cluster spread)
    return {
      position: mean,
      accuracyM: Math.max(maxAcc, maxDist),
      samplesUsed: n,
      samplesRejected: 0,
      spreadM: maxDist,
    };
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples = [];
  }
}
