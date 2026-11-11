/**
 * Kunci layar hidup, di satu tempat yang bisa dipakai siapa pun.
 *
 * KENAPA dipisah dari `lib/navigation/device.ts`. Fungsi ini dipakai dua fitur
 * yang tidak berhubungan: mode navigasi (`useNavigationDrive`) dan perekaman
 * jejak GPS (`GpsTrackingDialog`). Kalau dialog merekam mengimpor `device.ts`,
 * seluruh mesin navigasi ikut masuk ke jalur boot dialog; modul sekecil ini
 * menjaga keduanya tetap terpisah.
 *
 * KENAPA perlu sama sekali. Layar yang mati mem-pause WebView, jadi timer
 * berhenti dan rekaman jejak berhenti tanpa peringatan (audit P0, celah G2,
 * `factory/docs/bukti-apk/02-audit-p0.md`).
 */

/** Kunci layar yang sedang dipegang. */
export interface ScreenWakeLock {
  release: () => Promise<void>;
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<ScreenWakeLock> };
};

/**
 * Minta layar tetap hidup, di platform yang mengizinkannya.
 *
 * Tidak pernah melempar: platform yang tidak mendukung (WebView lama), halaman
 * yang tidak terlihat, atau izin yang ditolak semuanya jadi `null`, dan pemanggil
 * cukup tidak memegang kunci.
 *
 * @returns Kunci yang dipegang, atau null kalau tidak tersedia.
 */
export async function requestScreenWakeLock(): Promise<ScreenWakeLock | null> {
  try {
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    return wakeLock ? await wakeLock.request("screen") : null;
  } catch {
    return null;
  }
}
