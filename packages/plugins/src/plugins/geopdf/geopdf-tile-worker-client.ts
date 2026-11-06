// Sisi main thread dari worker tile GeoPDF.
//
// Tugasnya cuma tiga: bikin worker sekali, memasangkan balasan ke permintaan
// lewat `id`, dan mengurutkan permintaan supaya pdf.js di dalam worker tidak
// pernah menerima dua `render()` bersamaan. Semua kerja mahal (rasterisasi +
// encode PNG) terjadi di sisi worker; di sini tidak ada kanvas sama sekali.
import type { Affine6 } from "./geopdf-affine";
import type { TilePlan } from "./geopdf-tiles";
import type { TileWorkerRequest, TileWorkerResponse } from "./geopdf-tile.worker";

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
  resolve(message: Extract<TileWorkerResponse, { type: "tile" }>): void;
  reject(error: Error): void;
}

function abortNamed(): Error {
  const error = new Error("The GeoPDF tile render was aborted.");
  error.name = "AbortError";
  return error;
}

/**
 * Buat client worker untuk satu dokumen PDF.
 *
 * @returns `null` kalau lingkungan ini tidak bisa membuat module worker
 *   (WebView lama, atau `Worker` tidak ada). Pemanggil lalu memakai jalur
 *   main thread yang sudah ada, jadi GeoPDF tetap jalan tanpa worker.
 */
export function createTileWorker(page: TileWorkerPage): TileWorkerClient | null {
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

  worker.addEventListener("message", (event: MessageEvent<TileWorkerResponse>) => {
    const message = event.data;
    const waiter = waiters.get(message.id);
    if (!waiter) return;
    waiters.delete(message.id);
    if (message.type === "error") {
      waiter.reject(new Error(message.message));
      return;
    }
    // `empty` dan `closed` bukan jalur tile: keduanya dijawab terpisah di
    // pemanggilnya, jadi kalau sampai ke sini artinya pemanggil sudah pergi.
    if (message.type !== "tile") waiter.reject(new Error(`balasan ${message.type} tidak terduga`));
    else waiter.resolve(message);
  });
  worker.addEventListener("error", (event: ErrorEvent) => {
    fail(event.message || "GeoPDF tile worker gagal dimuat");
  });

  const send = (
    request: TileWorkerRequest,
    transfer: Transferable[] = [],
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
        if (response.type !== "tile") throw new Error("worker tidak mengembalikan tile");
        return response.png;
      });
      queue = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      fail("GeoPDF tile worker sudah ditutup");
      worker.postMessage({ type: "close", id: nextId++ } satisfies TileWorkerRequest);
      worker.terminate();
    },
  };
}