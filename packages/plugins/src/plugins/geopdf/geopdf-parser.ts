/**
 * GeoPDF georeferencing parser (ESRI ArcMap + OGC format)
 * Baca affine transform + CRS dari PDF via pdfjs-dist.
 * Basis: PETA KERJA AKO+TSJ.pdf (Esri ArcMap 10.4, WGS84)
 */
import * as pdfjs from "pdfjs-dist";

export interface GeoPdfInfo {
  width: number;
  height: number;
  affine: [number, number, number, number, number, number]; // GDAL geoTransform
  crs: string; // "EPSG:4326" atau WKT
  geoOk: boolean;
}

const OGC_REGEXES = [
  /OGC\/\d+\.\d+/i,
  /GEOGCS/i,
  /PROJCS/i,
  /EPSG:(\d+)/i,
  /AffineTransformation/i,
  /A[012345](\s*=|:)/i,
  /CTP:(\d+(?:\.\d+)?)/i,
  /CoordinateTransform/i,
  /WGS\s*84/i,
];

/** Cari affine transform dari teks metadata OGC/ESRI */
export function parseAffineFromText(text: string): number[] | null {
  // Pola umum: A0=..., A1=..., dst (ArcGIS format)
  const params: Record<string, number> = {};
  const aMatch = text.match(/A(\d)\s*=\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi);
  if (aMatch && aMatch.length >= 6) {
    for (const m of aMatch) {
      const mm = m.match(/A(\d)\s*=\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
      if (mm) params[mm[1]] = parseFloat(mm[2]);
    }
    if (params["0"] !== undefined && params["1"] !== undefined && params["3"] !== undefined) {
      return [params["0"], params["1"], params["2"] ?? 0, params["3"], params["4"] ?? 0, params["5"] ?? 0];
    }
  }
  // Pola CTP/CoordinateTransform dari OGC USGS format
  const ctp = text.match(/CTP\s*:\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
  if (ctp) {
    return [parseFloat(ctp[1]), 1, 0, parseFloat(ctp[2]), 0, 1];
  }
  return null;
}

/** Load + parse GeoPDF */
export async function parseGeoPdf(data: ArrayBuffer | Uint8Array): Promise<GeoPdfInfo | null> {
  try {
    const doc = await pdfjs.getDocument({ data }).promise;
    if (doc.numPages < 1) return null;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    // Metadata OGC biasanya di doc.metadata atau extra metadata stream
    let metaText = "";
    try {
      const meta = await doc.getMetadata();
      metaText = JSON.stringify(meta?.info ?? {});
      try { metaText += " " + JSON.stringify(meta?.metadata?.get?.("Metadata") ?? {}); } catch {}
    } catch { /* noop */ }

    const affine = parseAffineFromText(metaText);
    // Fallback: coba attach (OGC metadata kadang di attach stream)
    if (!affine) {
      try {
        const extra = await (doc as any).getExtraMetadata?.() ?? null;
        if (extra) {
          const t = parseAffineFromText(JSON.stringify(extra));
          if (t) {
            return { width: viewport.width, height: viewport.height, affine: t as any, crs: detectCrs(metaText), geoOk: true };
          }
        }
      } catch { /* noop */ }
    }

    return {
      width: viewport.width,
      height: viewport.height,
      affine: (affine as any) ?? [0, 1, 0, 0, 0, 1],
      crs: detectCrs(metaText),
      geoOk: !!affine,
    };
  } catch {
    return null;
  }
}

function detectCrs(text: string): string {
  const m = text.match(/EPSG:(\d+)/i);
  if (m) return `EPSG:${m[1]}`;
  if (/WGS\s*84|GEOGCS/i.test(text)) return "EPSG:4326";
  if (/PROJCS/i.test(text)) return "projcs-custom";
  return "unknown";
}

/** Convert GDAL affine → MapLibre raster bounds (north-up) */
export function affineToBounds(affine: number[], w: number, h: number) {
  const [x0, px, rx, y0, ry, py] = affine;
  const x1 = x0 + px * w + rx * h;
  const y1 = y0 + ry * w + py * h;
  return {
    west: Math.min(x0, x1),
    east: Math.max(x0, x1),
    south: Math.min(y0, y1),
    north: Math.max(y0, y1),
    pixelX: Math.abs(px),
    pixelY: Math.abs(py),
  };
}
