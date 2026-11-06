// Regresi #14: klien worker GeoPDF menerima jawaban `ready` sebagai PENOLAKAN.
//
// Kenapa test ini ada: `open` dikirim saat worker dibuat, dan jawabannya
// `{type: "ready"}`. Listener dulu menganggap `tile` satu-satunya jawaban sah
// (`message.type !== "tile"` → reject), jadi dokumen yang BERHASIL dibuka
// justru memicu "balasan ready tidak terduga". `render()` lalu gagal di
// `await ready` sebelum pernah mengirim satu permintaan tile: layer tampak
// "gagal dimuat" padahal worker-nya sehat. Tidak ada tes yang menyentuh klien
// ini, jadi bug-nya lolos ke build dan baru ketemu lewat tap kabel di browser.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Affine6 } from "./geopdf-affine";
import type { TilePlan } from "./geopdf-tiles";
import { createTileWorker } from "./geopdf-tile-worker-client";
import type {
  TileWorkerRequest,
  TileWorkerResponse,
} from "./geopdf-tile.worker";

/** Pekerja palsu: mencatat pesan keluar dan bisa disuruh menjawab. */
class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly posted: TileWorkerRequest[] = [];
  terminated = false;
  #listeners = new Map<
    string,
    ((event: { data: TileWorkerResponse }) => void)[]
  >();

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: (event: { data: TileWorkerResponse }) => void
  ): void {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }

  postMessage(message: TileWorkerRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Kirim satu balasan ke klien, seperti worker sungguhan. */
  emit(message: TileWorkerResponse): void {
    for (const listener of this.#listeners.get("message") ?? [])
      listener({ data: message });
  }
}

const AFFINE: Affine6 = [0.0001, 0, 0, -0.0001, 0.3, 0.4];
const PLAN: TilePlan = {
  z: 10,
  x: 326,
  y: 369,
  pageRect: { x: 0, y: 0, width: 612, height: 792 },
  scale: 1,
  renderWidth: 512,
  renderHeight: 512,
  transform: [1, 0, 0, 1, 0, 0],
};

/** Biarkan rantai microtask di klien selesai sebelum memeriksa pesan keluar. */
async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

const originalWorker = globalThis.Worker;

beforeEach(() => {
  FakeWorker.instances = [];
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
});

afterEach(() => {
  globalThis.Worker = originalWorker;
});

describe("createTileWorker", () => {
  it("menyelesaikan `ready` dari balasan worker, bukan menolaknya", async () => {
    const client = createTileWorker({
      data: new ArrayBuffer(16),
      pageNumber: 1,
      pageAffine: AFFINE,
      pageWidth: 612,
      pageHeight: 792,
    });
    assert.ok(client, "worker harus terbentuk saat `Worker` tersedia");
    const worker = FakeWorker.instances[0]!;
    assert.equal(worker.posted.length, 1);
    assert.equal(worker.posted[0]!.type, "open");

    worker.emit({ type: "ready", id: worker.posted[0]!.id });
    await client.ready();
  });

  it("meminta tile setelah `ready` dan mengembalikan PNG-nya", async () => {
    const client = createTileWorker({
      data: new ArrayBuffer(16),
      pageNumber: 1,
      pageAffine: AFFINE,
      pageWidth: 612,
      pageHeight: 792,
    });
    assert.ok(client);
    const worker = FakeWorker.instances[0]!;
    worker.emit({ type: "ready", id: worker.posted[0]!.id });
    await client.ready();

    const rendering = client.render(PLAN);
    await settle();
    const tileRequest = worker.posted.find(
      (message) => message.type === "tile"
    );
    assert.ok(tileRequest, "render() harus mengirim permintaan tile ke worker");

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    worker.emit({ type: "tile", id: tileRequest.id, png });
    assert.deepEqual(new Uint8Array(await rendering), new Uint8Array(png));
  });

  it("menolak `ready` saat worker melaporkan error saat membuka dokumen", async () => {
    const client = createTileWorker({
      data: new ArrayBuffer(16),
      pageNumber: 1,
      pageAffine: AFFINE,
      pageWidth: 612,
      pageHeight: 792,
    });
    assert.ok(client);
    const worker = FakeWorker.instances[0]!;
    worker.emit({
      type: "error",
      id: worker.posted[0]!.id,
      message: "PDF rusak",
    });
    await assert.rejects(client.ready(), /PDF rusak/);
  });
});
