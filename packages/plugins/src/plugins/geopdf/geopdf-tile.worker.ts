// Web Worker: rasterisasi GeoPDF + encode tile, keluar dari main thread.
//
// Kenapa ada file ini: hasil ukur di HP (Chromium, 390x844, DPR 2) nunjukin
// `toBlob` = 24.054 ms self-time dan satu tile 512px makan 4.229 ms; total
// 33.236 ms main thread ke-block setelah impor GeoPDF, satu blok terpanjang
// 15.060 ms. Mahalnya bukan encoder PNG (benchmark kanvas biasa cuma 280 ms)
// tapi rasterisasi pdf.js + downscale lembar A1 ke 512 di thread yang sama
// dengan UI. Jadi rasterisasi dan encode dipindah ke sini.
//
// Kontrak: satu pesan masuk = satu jawaban keluar, dipasangkan lewat `id`.
// Worker memegang paling banyak satu dokumen terbuka; `open` otomatis menutup
// dokumen sebelumnya, dan `close` wajib dipanggil kalau halaman sudah selesai.
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { Affine6 } from "./geopdf-affine";
import { TILE_SIZE, planTile } from "./geopdf-tiles";

export type TileWorkerRequest =
  | {
      type: "open";
      id: number;
      /** Byte PDF. Worker menyalinnya sendiri, jadi pemanggil tidak kehilangan aslinya. */
      data: Uint8Array;
      /** Nomor halaman 1-based, seperti yang dipakai pdf.js. */
      pageNumber: number;
    }
  | {
      type: "tile";
      id: number;
      /** Page points → Web Mercator, dari `pageToMercatorAffine`. */
      pageAffine: Affine6;
      pageWidth: number;
      pageHeight: number;
      z: number;
      x: number;
      y: number;
    }
  | { type: "close"; id: number };

export type TileWorkerResponse =
  | { type: "ready"; id: number }
  | { type: "tile"; id: number; png: ArrayBuffer }
  /** Tile di luar lembar: tidak ada yang perlu digambar. */
  | { type: "empty"; id: number }
  | { type: "closed"; id: number }
  | { type: "error"; id: number; message: string };

// `lib` paket ini cuma DOM (tanpa lib.webworker), jadi tipe global worker tidak
// tersedia. Bentuk minimal ini cukup dan tidak menarik DOM lib ke dalamnya.
const ctx = self as unknown as {
  postMessage(message: TileWorkerResponse, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<TileWorkerRequest>) => void,
  ): void;
};

// Dari dalam worker, pdf.js tidak bisa spawn worker lain dan jatuh ke fake
// worker yang jalan di thread ini juga. Itu tetap benar untuk kita: thread ini
// bukan main thread, jadi blocking-nya tidak membekukan UI. `workerSrc` tetap
// diset supaya pdf.js tidak mencoba memuat berkas dari path tebakan.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

let openPage: { doc: PDFDocumentProxy; page: PDFPageProxy } | null = null;

function post(message: TileWorkerResponse, transfer?: Transferable[]): void {
  ctx.postMessage(message, transfer);
}

async function closeDocument(): Promise<void> {
  if (!openPage) return;
  const { doc } = openPage;
  openPage = null;
  // `PDFDocumentProxy` tidak punya `destroy()`; yang memilikinya loading task,
  // dan itulah yang membebaskan buffer PDF serta worker internal pdf.js.
  await doc.loadingTask.destroy().catch(() => undefined);
}

async function handleOpen(
  request: Extract<TileWorkerRequest, { type: "open" }>,
): Promise<void> {
  await closeDocument();
  // `slice()` di sini penting: pdf.js mengambil alih buffer yang dikirim, dan
  // pemanggil masih butuh byte aslinya untuk hash serta re-register proyek.
  const doc = await pdfjsLib.getDocument({ data: request.data.slice() }).promise;
  const page = await doc.getPage(request.pageNumber);
  openPage = { doc, page };
  post({ type: "ready", id: request.id });
}

async function handleTile(
  request: Extract<TileWorkerRequest, { type: "tile" }>,
): Promise<void> {
  if (!openPage) throw new Error("tile diminta sebelum dokumen dibuka");
  const { page } = openPage;
  const plan = planTile(
    request.pageAffine,
    request.pageWidth,
    request.pageHeight,
    request.z,
    request.x,
    request.y,
  );
  if (!plan) {
    post({ type: "empty", id: request.id });
    return;
  }

  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("OffscreenCanvas 2d context tidak tersedia");
  // Kanvas tile sengaja dibiarkan transparan, sama seperti jalur main thread:
  // latar putih datang dari halaman PDF sendiri. Kalau di-fill putih di sini,
  // tepi lembar jadi kotak putih yang menutup basemap di bawahnya.
  context.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  // `transform` di pdf.js diterapkan setelah viewport 1:1, jadi matriks ini
  // persis menempatkan page point ke pixel tile: hasilnya identik dengan
  // (rasterisasi ke scratch, lalu drawImage pakai transform yang sama).
  // Satu langkah, tanpa kanvas scratch dan tanpa downscale drawImage di main
  // thread, yang justru biaya terbesar pada pengukuran tadi.
  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport: page.getViewport({ scale: 1 }),
    transform: plan.transform,
  }).promise;

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const png = await blob.arrayBuffer();
  post({ type: "tile", id: request.id, png }, [png]);
}

ctx.addEventListener("message", (event: MessageEvent<TileWorkerRequest>) => {
  const request = event.data;
  const work =
    request.type === "open"
      ? handleOpen(request)
      : request.type === "tile"
        ? handleTile(request)
        : closeDocument().then(() => {
            post({ type: "closed", id: request.id });
          });
  void work.catch((error: unknown) => {
    post({
      type: "error",
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  });
});