/**
 * Render GeoPDF → canvas → blob (untuk jadi raster source MapLibre)
 * Digabung dengan geopdf-parser: affine transform + canvas pixels
 */
import * as pdfjs from "pdfjs-dist";
import { parseGeoPdf, affineToBounds, type GeoPdfInfo } from "./geopdf-parser";

export interface RenderedGeoPdf {
  blob: Blob;
  width: number;
  height: number;
  bounds: { west: number; east: number; south: number; north: number };
  crs: string;
}

/** Render halaman pertama PDF ke canvas, return blob PNG + georef info */
export async function renderGeoPdfToBlob(
  data: Uint8Array | ArrayBuffer,
  scale = 2,
): Promise<RenderedGeoPdf | null> {
  try {
    const info = await parseGeoPdf(data);
    if (!info || !info.geoOk) return null;

    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });

    const bounds = affineToBounds(info.affine, canvas.width, canvas.height);
    return { blob, width: canvas.width, height: canvas.height, bounds, crs: info.crs };
  } catch (err) {
    console.error("[GeoKebun] GeoPDF render failed:", err);
    return null;
  }
}

export { parseGeoPdf };
