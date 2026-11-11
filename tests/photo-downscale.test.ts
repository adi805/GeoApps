/**
 * Aturan perkecilan foto lapangan: keputusan ukuran, dan jalur mundurnya.
 *
 * Yang dijaga: foto kamera HP yang besar diperkecil dulu (bukan ditolak), foto
 * yang sudah kecil tidak di-encode ulang (kualitasnya tidak turun tanpa alasan),
 * dan saat kanvas tidak ada, fungsinya mengembalikan null supaya pemanggil
 * membaca byte aslinya. Encode kanvas sendiri tidak diuji di Node karena tidak
 * ada `createImageBitmap`/`document`; yang diuji kebijakannya.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_STORED_PHOTO_EDGE_PX,
  STORED_PHOTO_JPEG_QUALITY,
  planPhotoResize,
  shrinkPhotoToDataUrl,
} from "../apps/geolibre-desktop/src/lib/photo-downscale";

describe("planPhotoResize", () => {
  it("memotong sisi terpanjang ke batas, menjaga rasio", () => {
    const plan = planPhotoResize(4000, 3000);
    assert.deepEqual(plan, { width: 1600, height: 1200 });
  });

  it("memakai sisi terpanjang, bukan lebar, untuk foto potret", () => {
    const plan = planPhotoResize(3000, 4000);
    assert.deepEqual(plan, { width: 1200, height: 1600 });
  });

  it("mengembalikan null untuk gambar yang sudah muat", () => {
    assert.equal(planPhotoResize(1600, 1200), null);
    assert.equal(planPhotoResize(800, 600), null);
  });

  it("membiarkan gambar yang tepat di batas", () => {
    assert.equal(planPhotoResize(MAX_STORED_PHOTO_EDGE_PX, 900), null);
  });

  it("menghormati batas yang diberikan pemanggil", () => {
    assert.deepEqual(planPhotoResize(1000, 500, 500), { width: 500, height: 250 });
  });

  it("tidak pernah menghasilkan sisi nol, walau rasionya ekstrem", () => {
    const plan = planPhotoResize(20000, 3);
    assert.deepEqual(plan, { width: 1600, height: 1 });
  });

  it("menolak ukuran yang tidak masuk akal", () => {
    assert.equal(planPhotoResize(0, 100), null);
    assert.equal(planPhotoResize(100, -5), null);
    assert.equal(planPhotoResize(Number.NaN, 100), null);
    assert.equal(planPhotoResize(100, 100, 0), null);
  });
});

describe("shrinkPhotoToDataUrl", () => {
  it("mengembalikan null di lingkungan tanpa kanvas, supaya byte aslinya dipakai", async () => {
    const file = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
    assert.equal(await shrinkPhotoToDataUrl(file), null);
  });

  it("kualitas encode berada di rentang yang masuk akal", () => {
    assert.ok(STORED_PHOTO_JPEG_QUALITY > 0.5 && STORED_PHOTO_JPEG_QUALITY < 1);
  });
});
