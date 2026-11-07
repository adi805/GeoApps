/**
 * Lokasi glyph dan sprite Protomaps yang dibundel app.
 *
 * KENAPA dipisah jadi modul: URL ini dipakai dua jalur yang harus memberi hasil
 * identik — `buildProtomapsBasemapStyle` di BasemapExtractPanel (saat ekstrak dan
 * saat "pakai sebagai basemap") dan pemulihan basemap saat app dibuka ulang.
 * Menyalin regex base-URL ke dua tempat berarti satu jalur bisa memakai URL relatif
 * yang ditolak MapLibre ("must be absolute") tanpa ada yang gagal saat build.
 *
 * Dihitung dengan `document.baseURI` supaya bekerja di dua bentuk base Vite:
 * path relatif (`"./"`, untuk build embed/demo) dan sub-path. Base relatif harus
 * jadi URL absolut karena MapLibre menolak sprite/glyph relatif, sedangkan base
 * absolut `"/basemaps-assets"` akan 404 kalau app disajikan di bawah sub-path.
 */
export function basemapAssetsBase(): string {
  return new URL(`${import.meta.env.BASE_URL}basemaps-assets`, document.baseURI).href;
}