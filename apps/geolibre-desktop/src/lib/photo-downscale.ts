/**
 * Perkecil foto lapangan sebelum disimpan ke properti GeoJSON.
 *
 * KENAPA modul ini ada. Foto koleksi lapangan disimpan sebagai data URL base64
 * di properti `geolibre_photos` (`field-collection.ts:55`), dengan batas 2 MiB
 * per foto (`field-collection.ts:84`). Foto kamera HP biasa 4 sampai 8 MB, jadi
 * sebelum aturan ini ada, dua pilihan yang tersedia dua-duanya buruk: tolak
 * fotonya, atau simpan base64 yang membengkak sekitar 33 persen dan membuat
 * proyek lapangan lambat dibuka. Audit P0 mencatatnya sebagai celah G3
 * (`factory/docs/bukti-apk/02-audit-p0.md` bagian 4).
 *
 * Yang dilakukan sekarang: sisi terpanjang dipotong ke
 * {@link MAX_STORED_PHOTO_EDGE_PX} lalu di-encode ulang. Foto yang sudah kecil
 * TIDAK di-encode ulang, supaya kualitas aslinya tidak turun tanpa alasan.
 *
 * Fungsi keputusannya ({@link planPhotoResize}) murni dan bisa diuji di Node;
 * bagian yang butuh kanvas dipisah di {@link shrinkPhotoToDataUrl} dan
 * mengembalikan null kalau lingkungannya tidak mendukung, sehingga pemanggil
 * bisa jatuh ke pembacaan berkas apa adanya.
 */

/** Sisi terpanjang gambar yang disimpan. Cukup untuk popup dan ekspor cetak. */
export const MAX_STORED_PHOTO_EDGE_PX = 1600;

/** Kualitas JPEG hasil encode ulang. 0.82 menyimpan detail tanpa benjolan. */
export const STORED_PHOTO_JPEG_QUALITY = 0.82;

/** Ukuran gambar setelah diperkecil. */
export interface PhotoResizePlan {
  width: number;
  height: number;
}

/**
 * Hitung ukuran gambar setelah sisi terpanjangnya dipotong.
 *
 * @param width - Lebar asli, dalam piksel.
 * @param height - Tinggi asli, dalam piksel.
 * @param maxEdge - Sisi terpanjang yang boleh disimpan.
 * @returns Ukuran baru, atau null saat gambar sudah muat (tidak perlu diubah)
 *   atau saat ukurannya tidak masuk akal.
 */
export function planPhotoResize(
  width: number,
  height: number,
  maxEdge: number = MAX_STORED_PHOTO_EDGE_PX,
): PhotoResizePlan | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) return null;
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Pilihan perkecilan; semuanya punya nilai bawaan. */
export interface PhotoShrinkOptions {
  /** Sisi terpanjang, dalam piksel. */
  maxEdge?: number;
  /** Kualitas JPEG 0 sampai 1. */
  quality?: number;
}

/**
 * Perkecil satu gambar jadi data URL.
 *
 * PNG tetap PNG supaya transparansinya tidak jadi hitam; format lain jadi JPEG.
 * Orientasi EXIF ikut dipanggang, jadi foto potret tidak tersimpan miring.
 *
 * @param file - Berkas gambar dari pemilih berkas atau kamera.
 * @param options - Batas sisi dan kualitas.
 * @returns Data URL hasil perkecilan, atau null saat gambar sudah cukup kecil
 *   atau lingkungannya tidak bisa men-decode (tanpa `createImageBitmap`,
 *   tanpa DOM, HEIC, berkas rusak). Null berarti "pakai byte aslinya".
 */
export async function shrinkPhotoToDataUrl(
  file: Blob,
  options: PhotoShrinkOptions = {},
): Promise<string | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const plan = planPhotoResize(
      bitmap.width,
      bitmap.height,
      options.maxEdge ?? MAX_STORED_PHOTO_EDGE_PX,
    );
    if (!plan) return null;
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, plan.width, plan.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    return canvas.toDataURL(type, options.quality ?? STORED_PHOTO_JPEG_QUALITY);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
