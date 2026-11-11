import { expect, test, type Page } from "./test";
import { waitForMap } from "./helpers";
import { MAX_STORED_PHOTO_EDGE_PX } from "../apps/geolibre-desktop/src/lib/photo-downscale";

/**
 * Bukti otomatis celah P0 G3 di runtime browser, bukan cuma di unit test.
 *
 * Kenapa perlu, padahal `tests/photo-downscale.test.ts` sudah hijau. Unit test
 * menguji `planPhotoResize` sebagai fungsi murni dan `shrinkPhotoToDataUrl`
 * dengan `createImageBitmap` yang di-stub. Yang tidak diuji di sana: jalur
 * nyata di dialog — berkas dari input kamera, `createImageBitmap` asli,
 * kanvas asli, lalu apa yang benar-benar tersimpan di properti foto. Kalau
 * pemanggilannya lupa dipasang, unit test tetap hijau dan foto HP tetap
 * membengkak. Itu persis bentuk regresi yang lolos.
 *
 * Batas simpan (`MAX_PHOTO_BYTES = 2 MiB`, `field-collection.ts:84`) tidak
 * diimpor di sini dengan sengaja: modul itu menarik `@geolibre/core` ke proses
 * Playwright. Nilainya ditulis sebagai {@link STORED_CAP_BYTES} dengan rujukan
 * barisnya, dan tes ini gagal kalau angkanya bergeser.
 *
 * Dua tes, dua arah: gambar besar WAJIB diperkecil, gambar kecil WAJIB tidak
 * disentuh. Yang kedua itu kontrol, tanpa dia "diperkecil" tidak bisa
 * dibedakan dari "selalu di-encode ulang, kualitas turun tanpa alasan".
 */

/** Batas data URL tersimpan; sama dengan `MAX_PHOTO_BYTES` di `field-collection.ts:84`. */
const STORED_CAP_BYTES = 2 * 1024 * 1024;

/** PNG 1x1, dipakai sebagai kontrol "sudah kecil, jangan diubah". */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

type Dims = { width: number; height: number };

/**
 * Membuat JPEG besar di dalam halaman, meniru foto kamera HP.
 *
 * Digambar di kanvas (gradien + butiran) lalu di-encode. Isinya harus punya
 * detail supaya ukuran berkasnya masuk akal sebagai foto, bukan bidang rata
 * yang JPEG-nya cuma beberapa kilobyte.
 *
 * @param page - Halaman yang dipakai menggambar.
 * @param width - Lebar sumber.
 * @param height - Tinggi sumber.
 * @param quality - Kualitas encode sumber.
 * @returns Data URL JPEG.
 */
async function makeCameraJpeg(
  page: Page,
  width: number,
  height: number,
  quality: number,
): Promise<string> {
  return page.evaluate(
    async ({ width, height, quality }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2d context tidak tersedia");
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#204060");
      gradient.addColorStop(1, "#c08040");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      // Butiran deterministik: memberi entropi tanpa membuat tes bergantung waktu.
      const image = context.getImageData(0, 0, width, height);
      let seed = 987654321;
      for (let i = 0; i < image.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const noise = (seed % 64) - 32;
        image.data[i] = Math.max(0, Math.min(255, image.data[i] + noise));
        image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + noise));
        image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + noise));
      }
      context.putImageData(image, 0, 0);
      return canvas.toDataURL("image/jpeg", quality);
    },
    { width, height, quality },
  );
}

/** Mengukur panjang sisi sebuah data URL gambar di dalam halaman. */
async function measureDataUrl(page: Page, src: string): Promise<Dims> {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, src);
}

/** Jumlah byte yang dikandung data URL base64. */
function dataUrlBytes(src: string): number {
  const comma = src.indexOf(",");
  if (comma < 0) return 0;
  return Math.floor(((src.length - comma - 1) * 3) / 4);
}

/**
 * Membuka dialog Field Collection dan menyiapkan satu target titik.
 *
 * @param page - Halaman yang sudah memuat peta.
 * @returns Locator dialog yang sudah siap menerima foto.
 */
async function openFieldCollection(page: Page) {
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await page.getByRole("menuitem", { name: /Field Collection/ }).click();
  const dialog = page.getByRole("dialog", { name: "Field Collection" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByLabel("Layer name", { exact: true }).fill("Foto G3");
  await dialog.getByRole("button", { name: "Create layer", exact: true }).click();
  await dialog.getByRole("button", { name: "Pick on map", exact: true }).click();
  await page.locator(".maplibregl-canvas").click({ position: { x: 350, y: 240 } });
  return dialog;
}

test.describe("Foto lapangan dikecilkan sebelum disimpan (G3)", () => {
  /**
   * Inti G3: foto kamera 3200x2400 harus tersimpan dengan sisi terpanjang
   * 1600 px, dan ukurannya di bawah batas simpan.
   *
   * Yang membuat tes ini punya daya beda: dimensi sumber dibaca dari data URL
   * yang benar-benar dipasang ke input, bukan dari angka yang ditulis ulang di
   * tes. Sebelum perbaikan, `src` yang tersimpan adalah byte asli, jadi
   * `naturalWidth` akan 3200 dan assertion pertama sudah merah.
   */
  test("foto kamera besar diperkecil ke 1600 px dan masuk batas simpan", async ({ page }) => {
    test.setTimeout(600_000);
    await waitForMap(page, "/?lang=en");
    const dialog = await openFieldCollection(page);

    const source = await makeCameraJpeg(page, 3200, 2400, 0.9);
    const sourceBytes = dataUrlBytes(source);
    const sourceDims = await measureDataUrl(page, source);
    expect(sourceDims, "gambar sumber gagal dibuat").toEqual({ width: 3200, height: 2400 });

    const buffer = Buffer.from(source.slice(source.indexOf(",") + 1), "base64");
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "kamera-hp.jpg",
      mimeType: "image/jpeg",
      buffer,
    });

    const stored = dialog.getByRole("img").first();
    await expect(stored).toBeVisible({ timeout: 180_000 });
    // Salah satu kegagalan lama: foto ditolak mentah-mentah sebagai terlalu besar.
    await expect(dialog.getByText(/That photo is too large/)).toHaveCount(0);

    const src = await stored.getAttribute("src");
    expect(src, "foto tidak tersimpan sebagai data URL").toBeTruthy();
    expect(src!.startsWith("data:image/jpeg;base64,"), "JPEG harus tetap JPEG").toBe(true);

    const storedDims = await measureDataUrl(page, src!);
    expect(
      Math.max(storedDims.width, storedDims.height),
      `sisi terpanjang tersimpan harus ${MAX_STORED_PHOTO_EDGE_PX} px, dapat ${storedDims.width}x${storedDims.height}`,
    ).toBe(MAX_STORED_PHOTO_EDGE_PX);

    // Rasio asli 4:3 harus terjaga, bukan dipotong persegi.
    const sourceRatio = sourceDims.width / sourceDims.height;
    const storedRatio = storedDims.width / storedDims.height;
    expect(Math.abs(storedRatio - sourceRatio)).toBeLessThan(0.01);

    const storedBytes = dataUrlBytes(src!);
    expect(
      storedBytes,
      `data URL tersimpan ${storedBytes} byte melewati batas ${STORED_CAP_BYTES} byte`,
    ).toBeLessThanOrEqual(STORED_CAP_BYTES);
    expect(
      storedBytes,
      "foto tersimpan TIDAK lebih kecil dari sumber: perkecilan tidak berjalan",
    ).toBeLessThan(sourceBytes);

    console.log(
      JSON.stringify({
        phase: "downscale",
        source: { width: sourceDims.width, height: sourceDims.height, bytes: sourceBytes },
        stored: { width: storedDims.width, height: storedDims.height, bytes: storedBytes },
        capBytes: STORED_CAP_BYTES,
        ratioPreserved: Number((storedRatio - sourceRatio).toFixed(6)),
      }),
    );
  });

  /**
   * Kontrol: PNG 1x1 sudah muat, jadi harus tersimpan APA ADANYA.
   *
   * `planPhotoResize` mengembalikan null untuk gambar yang sudah kecil dan
   * pemanggil jatuh ke pembacaan berkas apa adanya. Kalau kontrol ini hijau,
   * tes di atas membuktikan "diperkecil hanya saat perlu", bukan "semua foto
   * di-encode ulang sehingga kualitasnya turun".
   */
  test("foto kecil tidak di-encode ulang (byte identik)", async ({ page }) => {
    test.setTimeout(300_000);
    await waitForMap(page, "/?lang=en");
    const dialog = await openFieldCollection(page);

    await dialog.locator('input[type="file"]').setInputFiles({
      name: "kecil.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    const stored = dialog.getByRole("img").first();
    await expect(stored).toBeVisible({ timeout: 60_000 });
    const src = await stored.getAttribute("src");
    const expected = `data:image/png;base64,${TINY_PNG.toString("base64")}`;
    expect(
      src,
      "PNG yang sudah kecil di-encode ulang: kualitas turun tanpa alasan",
    ).toBe(expected);
    console.log(
      JSON.stringify({ phase: "control", reEncoded: false, bytes: dataUrlBytes(src ?? "") }),
    );
  });
});
