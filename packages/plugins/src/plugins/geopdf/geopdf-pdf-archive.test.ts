/**
 * Arsip byte PDF GeoPDF: aturannya, diuji tanpa browser.
 *
 * Yang dijaga di sini adalah janji yang membuat fitur buka-ulang bekerja:
 * byte yang disimpan bisa dibaca lagi dengan hash yang sama, hash dinormalkan,
 * dan berkas yang terlalu besar dilewati dengan jujur (bukan disimpan separuh).
 * Jalur IndexedDB-nya sendiri tidak diuji di Node karena tidak ada `indexedDB`;
 * yang diuji kebijakannya, di atas tabel `Map`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_ARCHIVED_PDF_BYTES,
  MemoryPdfArchiveTable,
  createGeoPdfPdfArchive,
  setSharedGeoPdfPdfArchive,
  sharedGeoPdfPdfArchive,
  type PdfArchiveTable,
} from "./geopdf-pdf-archive";

const HASH = "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0";

function bytesOf(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buffer).set(encoded);
  return buffer;
}

function textOf(buffer: ArrayBuffer | null): string | null {
  return buffer === null ? null : new TextDecoder().decode(new Uint8Array(buffer));
}

describe("createGeoPdfPdfArchive", () => {
  it("menyimpan lalu mengembalikan byte yang sama persis", async () => {
    const archive = createGeoPdfPdfArchive(new MemoryPdfArchiveTable());
    const bytes = bytesOf("%PDF-1.7 isi peta");

    assert.equal(await archive.save(HASH, bytes), true);
    assert.equal(textOf(await archive.load(HASH)), "%PDF-1.7 isi peta");
  });

  it("mencocokkan hash tanpa peduli huruf besar-kecil", async () => {
    const archive = createGeoPdfPdfArchive(new MemoryPdfArchiveTable());

    await archive.save(HASH.toUpperCase(), bytesOf("peta"));
    assert.equal(textOf(await archive.load(HASH)), "peta");
    assert.deepEqual(await archive.keys(), [HASH]);
  });

  it("mengembalikan null untuk hash yang tidak pernah diarsipkan", async () => {
    const archive = createGeoPdfPdfArchive(new MemoryPdfArchiveTable());
    assert.equal(await archive.load(HASH), null);
  });

  it("melewati berkas di atas batas, dan tidak menyimpan sebagian", async () => {
    const archive = createGeoPdfPdfArchive(new MemoryPdfArchiveTable());
    const tooBig = new ArrayBuffer(MAX_ARCHIVED_PDF_BYTES + 1);

    assert.equal(await archive.save(HASH, tooBig), false);
    assert.equal(await archive.load(HASH), null);
    assert.deepEqual(await archive.keys(), []);
  });

  it("menolak byte kosong, karena itu bukan PDF yang bisa dirender", async () => {
    const archive = createGeoPdfPdfArchive(new MemoryPdfArchiveTable());
    assert.equal(await archive.save(HASH, new ArrayBuffer(0)), false);
    assert.equal(await archive.load(HASH), null);
  });

  it("menghapus satu arsip tanpa menyentuh yang lain", async () => {
    const archive = createGeoPdfPdfArchive(new MemoryPdfArchiveTable());
    const other = "aa".repeat(32);

    await archive.save(HASH, bytesOf("satu"));
    await archive.save(other, bytesOf("dua"));
    await archive.remove(HASH);

    assert.equal(await archive.load(HASH), null);
    assert.equal(textOf(await archive.load(other)), "dua");
  });

  it("membaca kembali nilai yang tersimpan sebagai Blob", async () => {
    const table = new MemoryPdfArchiveTable();
    // Host tertentu menyimpan Blob apa adanya; kebijakannya harus tetap jalan.
    await table.put(HASH, new Blob([bytesOf("dari blob")]));
    const archive = createGeoPdfPdfArchive(table);

    assert.equal(textOf(await archive.load(HASH)), "dari blob");
  });

  it("membaca kembali nilai yang tersimpan sebagai view", async () => {
    const table = new MemoryPdfArchiveTable();
    const view = new Uint8Array(bytesOf("dari view"));
    await table.put(HASH, view);
    const archive = createGeoPdfPdfArchive(table);

    assert.equal(textOf(await archive.load(HASH)), "dari view");
  });

  it("meneruskan error penyimpanan, bukan menelannya", async () => {
    const failing: PdfArchiveTable = {
      get: async () => undefined,
      put: async () => {
        throw new Error("QuotaExceededError");
      },
      delete: async () => undefined,
      keys: async () => [],
      clear: async () => undefined,
    };
    const archive = createGeoPdfPdfArchive(failing);

    await assert.rejects(() => archive.save(HASH, bytesOf("peta")), /QuotaExceededError/);
  });
});

describe("arsip bersama", () => {
  it("bisa diganti untuk uji lalu dikembalikan", async () => {
    const previous = sharedGeoPdfPdfArchive();
    const replacement = createGeoPdfPdfArchive(new MemoryPdfArchiveTable());

    setSharedGeoPdfPdfArchive(replacement);
    assert.equal(sharedGeoPdfPdfArchive(), replacement);

    await replacement.save(HASH, bytesOf("peta"));
    assert.equal(textOf(await sharedGeoPdfPdfArchive().load(HASH)), "peta");

    setSharedGeoPdfPdfArchive(previous);
    assert.equal(sharedGeoPdfPdfArchive(), previous);
  });
});
