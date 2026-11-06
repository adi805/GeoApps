// Sisi main thread dari worker tile GeoPDF.
//
// Tugasnya cuma tiga: bikin worker sekali, memasangkan balasan ke permintaan
// lewat `id`, dan mengurutkan permintaan supaya pdf.js di dalam worker tidak
// pernah menerima dua `render()` bersamaan. Semua kerja mahal (rasterisasi +
// encode PNG) terjadi di sisi worker; di sini tidak ada kanvas sama sekali.
import type { Affine6 } from "./geopdf-affine";
import { TILE_SIZE, type TilePlan } from "./geopdf-tiles";
import type {
  TileWorkerRequest,
  TileWorkerResponse,
} from "./geopdf-tile.worker";

/** Halaman yang dibuka di worker; semuanya tetap sama untuk seluruh tile. */
export interface TileWorkerPage {
  data: ArrayBuffer;
  /** Nomor halaman 1-based. */
  pageNumber: number;
  pageAffine: Affine6;
  pageWidth: number;
  pageHeight: number;
}

export interface TileWorkerClient {
  /** Resolve setelah dokumen terbuka di worker. Dipanggil sekali per halaman. */
  ready(): Promise<void>;
  /** Render satu tile jadi PNG. */
  render(plan: TilePlan, signal?: AbortSignal): Promise<ArrayBuffer>;
  /** Tutup dokumen dan hentikan worker. Aman dipanggil berkali-kali. */
  dispose(): void;
}

interface Waiter {
  resolve(message: TileWorkerResponse): void;
  reject(error: Error): void;
}

function abortNamed(): Error {
  const error = new Error("The GeoPDF tile render was aborted.");
  error.name = "AbortError";
  return error;
}

/**
 * PNG transparan sekali-buat, untuk jawaban `empty`.
 *
 * Worker menjawab `empty` kalau rencana tile-nya kosong (di luar lembar).
 * Jalur main thread sudah menjawab kasus itu dengan `transparentTile()` sebelum
 * memanggil worker, jadi cabang ini praktis tak terjangkau; kontrak `render()`
 * tetap harus mengembalikan PNG, bukan menolak.
 */
let emptyTilePng: Promise<ArrayBuffer> | null = null;
function transparentTilePng(): Promise<ArrayBuffer> {
  emptyTilePng ??= (async () => {
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error(
        "OffscreenCanvas tidak tersedia untuk tile kosong GeoPDF"
      );
    }
    const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return blob.arrayBuffer();
  })();
  return emptyTilePng;
}

/**
 * Buat client worker untuk satu dokumen PDF.
 *
 * @returns `null` kalau lingkungan ini tidak bisa membuat module worker
 *   (WebView lama, atau `Worker` tidak ada). Pemanggil lalu memakai jalur
 *   main thread yang sudah ada, jadi GeoPDF tetap jalan tanpa worker.
 */
export function createTileWorker(
  page: TileWorkerPage
): TileWorkerClient | null {
  if (typeof Worker === "undefined") return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL("./geopdf-tile.worker.ts", import.meta.url), {
      type: "module",
      name: "geopdf-tile",
    });
  } catch {
    return null;
  }

  const waiters = new Map<number, Waiter>();
  let nextId = 1;
  let disposed = false;
  // Permintaan diantrekan: `page.render()` di pdf.js menolak berjalan paralel
  // pada halaman yang sama, dan antrean juga menjaga pemakaian memori worker
  // tetap satu tile pada satu waktu.
  let queue: Promise<unknown> = Promise.resolve();

  const fail = (reason: string): void => {
    const error = new Error(reason);
    for (const waiter of waiters.values()) waiter.reject(error);
    waiters.clear();
  };

  worker.addEventListener(
    "message",
    (event: MessageEvent<TileWorkerResponse>) => {
      const message = event.data;
      const waiter = waiters.get(message.id);
      if (!waiter) return;
      waiters.delete(message.id);
      if (message.type === "error") {
        waiter.reject(new Error(message.message));
        return;
      }
      // `closed` cuma balasan `close`, dan `dispose` sudah menolak semua waiter
      // yang mungkin masih menunggu; kalau sampai ke sini pemanggilnya pergi.
      if (message.type === "closed") {
        waiter.reject(new Error("GeoPDF tile worker sudah ditutup"));
        return;
      }
      // Setiap jawaban yang sah harus resolve, bukan cuma `tile`: `ready` adalah
      // jawaban `open`. Menyaring `type !== "tile"` membuat dokumen yang BERHASIL
      // dibuka justru ditolak, jadi `render()` gagal sebelum pernah mengirim satu
      // permintaan tile. Itu yang bikin layer GeoPDF "gagal dimuat" tanpa satu pun
      // tile diminta ke worker (#14).
      waiter.resolve(message);
    }
  );
  worker.addEventListener("error", (event: ErrorEvent) => {
    fail(event.message || "GeoPDF tile worker gagal dimuat");
  });

  const send = (
    request: TileWorkerRequest,
    transfer: Transferable[] = []
  ): Promise<TileWorkerResponse> =>
    new Promise<TileWorkerResponse>((resolve, reject) => {
      if (disposed) {
        reject(new Error("GeoPDF tile worker sudah ditutup"));
        return;
      }
      waiters.set(request.id, {
        resolve: (message) => resolve(message),
        reject,
      });
      worker.postMessage(request, transfer);
    });

  const ready = (() => {
    const promise = send({
      type: "open",
      id: nextId++,
      data: new Uint8Array(page.data),
      pageNumber: page.pageNumber,
    })
      .then(() => undefined)
      .catch((error: unknown) => {
        fail("GeoPDF tile worker tidak bisa membuka dokumen");
        throw error;
      });
    // Satu penanganan awal supaya unhandled rejection tidak muncul kalau
    // pemanggil belum sempat menunggu.
    promise.catch(() => undefined);
    return promise;
  })();

  return {
    ready: () => ready,
    render(plan, signal) {
      if (signal?.aborted) return Promise.reject(abortNamed());
      const task = queue.then(async () => {
        await ready;
        if (signal?.aborted) throw abortNamed();
        const response = await send({
          type: "tile",
          id: nextId++,
          pageAffine: page.pageAffine,
          pageWidth: page.pageWidth,
          pageHeight: page.pageHeight,
          z: plan.z,
          x: plan.x,
          y: plan.y,
        });
        if (signal?.aborted) throw abortNamed();
        // Tile di luar lembar: worker tidak menggambar apa pun. Kontrak
        // `render()` tetap PNG, jadi jawab dengan tile transparan yang sama
        // seperti jalur main thread.
        if (response.type === "empty") return transparentTilePng();
        if (response.type !== "tile") {
          throw new Error(
            `worker tidak mengembalikan tile (balasan ${response.type})`
          );
        }
        return response.png;
      });
      queue = task.then(
        () => undefined,
        () => undefined
      );
      return task;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      fail("GeoPDF tile worker sudah ditutup");
      worker.postMessage({
        type: "close",
        id: nextId++,
      } satisfies TileWorkerRequest);
      worker.terminate();
    },
  };
}
